import {
  loadOrCreateDeviceIdentity,
  createDeviceBlock,
  isDeviceSigningAvailable,
} from './device-auth';
import { VITE_APP_VERSION_FULL } from '../appVersion';
import {
  type ChatHistoryResponse,
  type FetchedChatMessage,
  type RawHistoryMessage,
  extractStreamText,
  inferStreamPhaseHints,
  mapRawHistoryMessage,
  parseAssistantDisplayPayload,
  type StreamPhaseHints,
} from './gateway-types';
import { lastToolSummaryFromStreamMessage, toolHintFromAgentStreamData } from '../utils/toolBubbleSummary';

export type { FetchedChatMessage } from './gateway-types';

const LOG = '[OpenClaw gateway]';
const DEBUG = import.meta.env.VITE_OPENCLAW_DEBUG === '1' || import.meta.env.DEV;

/** Terminal `chat` event payload surfaced to the UI (after stream handling when applicable). */
export interface ChatTerminalInfo {
  state: 'final' | 'aborted' | 'error';
  errorMessage?: string;
  runId?: string;
}

/** Per-`delta` chat event: structured hints for inferring tool vs answer vs thinking in the stream. */
export interface ChatDeltaInfo {
  runId?: string;
  seq?: number;
  hints: StreamPhaseHints;
  /** Collapsed label for the last `toolCall` part in this delta, if any. */
  lastToolSummary: string | null;
}

function logOutbound(obj: unknown, redactToken = false) {
  const safe = redactToken && typeof obj === 'object' && obj !== null && 'params' in obj
    ? {
        ...(obj as Record<string, unknown>),
        params: (obj as { params?: Record<string, unknown> }).params
          ? { ...(obj as { params: Record<string, unknown> }).params, auth: '(redacted)' }
          : undefined,
      }
    : obj;
  console.log(`${LOG} out`, DEBUG ? JSON.stringify(safe, null, 2) : JSON.stringify(safe));
}

function logInbound(data: unknown, summary: string) {
  console.log(`${LOG} ${summary}`);
  if (DEBUG) {
    console.log(`${LOG} in full:`, JSON.stringify(data, null, 2));
  }
}

function logUnhandled(data: unknown) {
  console.log(`${LOG} unhandled:`, JSON.stringify(data, null, 2));
}

let socket: WebSocket | null = null;
/** When set, `chat` events whose `payload.sessionKey` differs are ignored (multi-thread UI). */
let getActiveChatSessionKeyForChatRouting: (() => string | undefined) | null = null;
let onMessageCallback: ((message: unknown) => void) | null = null;
let onReasoningCallback: ((chunk: string) => void) | null = null;
let onContentCallback: ((chunk: string) => void) | null = null;
let onConnectedCallback: (() => void) | null = null;
let onConnectErrorCallback: ((error: string) => void) | null = null;
let onAssistantFinalCallback: ((payload: ReturnType<typeof parseAssistantDisplayPayload>) => void) | null =
  null;
let onChatDeltaCallback: ((info: ChatDeltaInfo) => void) | null = null;
let onChatTerminalCallback: ((info: ChatTerminalInfo) => void) | null = null;
let onAgentStreamToolHintCallback: ((label: string) => void) | null = null;
let onDisconnectedCallback: (() => void) | null = null;
/** True after a successful `connect` res; cleared on socket close. Used to detect mid-session drops. */
let gatewayHandshakeOk = false;

const pendingReqs = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let connectReqId: string | null = null;

/** Set from connect hello `snapshot.sessionDefaults.mainSessionKey` when env override is unset */
let resolvedMainSessionKey: string | null = null;

const ROUTINE_EVENTS = new Set(['health', 'tick', 'heartbeat', 'presence']);

/** Same host as the page (ws / wss matches the page). Use when the UI is served from the OpenClaw machine. */
function defaultGatewayWebSocketUrl(): string {
  const { protocol, hostname } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${hostname}:18789`;
}

function gatewayWebSocketUrl(): string {
  const fromEnv = import.meta.env.VITE_OPENCLAW_GATEWAY_URL?.trim();
  if (fromEnv) return fromEnv;
  return defaultGatewayWebSocketUrl();
}

const WEBCHAT_SESSION_STORAGE_KEY = 'openclaw-ui-session-key';

function getStoredWebchatSessionKey(): string | null {
  try {
    const t = localStorage.getItem(WEBCHAT_SESSION_STORAGE_KEY);
    return t && t.trim() ? t.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Start a new gateway conversation: persist a fresh `sessionKey` for this origin.
 * Subsequent `chat.send` / `chat.history` use it until the user starts another new chat.
 */
export function startNewWebchatSession(): string {
  const key = `webchat-${crypto.randomUUID()}`;
  try {
    localStorage.setItem(WEBCHAT_SESSION_STORAGE_KEY, key);
  } catch {
    /* quota or disabled */
  }
  return key;
}

/** When true, `VITE_OPENCLAW_SESSION_KEY` pins the session — UI cannot rotate the thread. */
export function isGatewaySessionKeyPinnedByBuild(): boolean {
  return !!import.meta.env.VITE_OPENCLAW_SESSION_KEY?.trim();
}

function sessionKey(): string {
  const fromEnv = import.meta.env.VITE_OPENCLAW_SESSION_KEY?.trim();
  if (fromEnv) return fromEnv;
  const stored = getStoredWebchatSessionKey();
  if (stored) return stored;
  if (resolvedMainSessionKey) return resolvedMainSessionKey;
  return 'main';
}

const TOKEN_STORAGE_KEY = 'openclaw-gateway-token';

function getStoredToken(): string | null {
  try {
    const t = localStorage.getItem(TOKEN_STORAGE_KEY);
    return t && t.trim() ? t.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredGatewayToken(token: string): void {
  const trimmed = token?.trim();
  if (trimmed) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
    } catch {
      /* quota or disabled */
    }
  }
}

export function clearStoredGatewayToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* ignored */
  }
}

export function hasGatewayToken(): boolean {
  return !!(import.meta.env.VITE_OPENCLAW_GATEWAY_TOKEN?.trim() || getStoredToken());
}

function gatewayToken(): string | undefined {
  return import.meta.env.VITE_OPENCLAW_GATEWAY_TOKEN?.trim() || getStoredToken() || undefined;
}

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log(`${LOG} already connected`);
    return;
  }

  gatewayHandshakeOk = false;
  resolvedMainSessionKey = null;

  const url = gatewayWebSocketUrl();
  console.log(`${LOG} connecting to`, url);
  socket = new WebSocket(url);

  let challengeReceived = false;
  let handshakeComplete = false;
  let connectTimeout: ReturnType<typeof setTimeout> | null = null;

  const sendConnect = async (nonce: string) => {
    if (connectReqId || !socket || socket.readyState !== WebSocket.OPEN) return;
    if (connectTimeout) {
      clearTimeout(connectTimeout);
      connectTimeout = null;
    }
    const hasNonce = nonce.trim().length > 0;
    logInbound({ _: 'sending_connect', hasNonce }, hasNonce ? 'sending connect with device signing' : 'sending connect without device (fallback)');

    let device: { id: string; publicKey: string; signature: string; signedAt: number; nonce: string } | undefined;
    if (hasNonce && isDeviceSigningAvailable()) {
      try {
        const identity = await loadOrCreateDeviceIdentity();
        device = await createDeviceBlock({
          identity,
          nonce,
          token: gatewayToken(),
        });
        if (DEBUG) console.log(`${LOG} device block created for ${device.id}`);
      } catch (err) {
        console.error(`${LOG} device signing failed:`, err);
        onConnectErrorCallback?.(
          'Device signing failed. Try a modern browser (Chrome 137+, Firefox 129+, Safari 17+) or configure gateway.controlUi.allowInsecureAuth.'
        );
        return;
      }
    } else if (hasNonce && !isDeviceSigningAvailable()) {
      console.warn(`${LOG} Ed25519 not available, connecting without device (may fail with DEVICE_IDENTITY_REQUIRED)`);
    }

    const connectPayload = {
      type: 'req',
      id: (connectReqId = `connect-${Date.now()}`),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'webchat-ui',
          version: VITE_APP_VERSION_FULL,
          platform: 'web',
          mode: 'webchat',
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        commands: [],
        permissions: {} as Record<string, boolean>,
        auth: gatewayToken() ? { token: gatewayToken() } : undefined,
        device,
      },
    };
    logOutbound(connectPayload, !!gatewayToken());
    socket.send(JSON.stringify(connectPayload));
  };

  socket.onopen = () => {
    logInbound({ _: 'socket_open' }, 'socket opened, waiting for connect.challenge');
    // Fallback: some gateways don't send connect.challenge (e.g. allowInsecureAuth). Send connect after 2s if nothing arrives.
    connectTimeout = setTimeout(() => {
      if (!challengeReceived) {
        console.log(`${LOG} no connect.challenge received, sending connect anyway (fallback, no device)`);
        void sendConnect('');
      }
    }, 2000);
  };

  socket.onmessage = (event) => {
    let data: unknown;
    try {
      data = JSON.parse(event.data as string);
    } catch (e) {
      console.error(`${LOG} parse failed:`, event.data, e);
      return;
    }

    console.log(`${LOG} message`, data);

    const t = (data as { type?: string }).type;
    const ev = (data as { event?: string }).event;

    if (t === 'event' && ev === 'connect.challenge') {
      challengeReceived = true;
      logInbound(data, `in event connect.challenge`);
      const payload = (data as { payload?: { nonce?: string } }).payload;
      const nonce = (payload?.nonce ?? '').trim();
      if (DEBUG && nonce) console.log(`${LOG} challenge nonce present, signing with device`);
      void sendConnect(nonce);
      return;
    }

    if (t === 'res') {
      const res = data as {
        id?: string;
        ok?: boolean;
        payload?: unknown;
        error?: { code?: string; message?: string; details?: { code?: string } };
      };
      logInbound(data, `in res id=${res.id} ok=${res.ok}`);

      if (res.id === connectReqId) {
        connectReqId = null;
        handshakeComplete = true;
        if (res.ok) {
          const hello = res.payload as {
            snapshot?: { sessionDefaults?: { mainSessionKey?: string } };
          };
          const mainKey = hello?.snapshot?.sessionDefaults?.mainSessionKey?.trim();
          if (mainKey) resolvedMainSessionKey = mainKey;
          console.log(`${LOG} handshake ok, connected`);
          gatewayHandshakeOk = true;
          onConnectedCallback?.();
        } else {
          const code = res.error?.details?.code ?? res.error?.code ?? '';
          const errMsg =
            code === 'AUTH_TOKEN_MISSING'
              ? 'Gateway token required. Paste the token from the gateway host (openclaw config get gateway.auth.token) or add VITE_OPENCLAW_GATEWAY_TOKEN to .env.local.'
              : code === 'DEVICE_IDENTITY_REQUIRED' || res.error?.message === 'device identity required'
                ? 'Device identity required. Ensure device signing succeeded (modern browser) or set gateway.controlUi.allowInsecureAuth.'
                : code === 'NOT_PAIRED' || code === 'PAIRING_REQUIRED'
                  ? 'Device pending approval. Run `openclaw devices list` then `openclaw devices approve <requestId>` on the gateway host (or `openclaw devices approve --latest`).'
                  : res.error?.message ?? res.error?.code ?? 'Connect failed';
          console.error(`${LOG} connect error:`, res.error);
          onConnectErrorCallback?.(errMsg);
        }
        return;
      }

      const pending = pendingReqs.get(res.id ?? '');
      if (pending) {
        pendingReqs.delete(res.id ?? '');
        if (res.ok) {
          pending.resolve(res.payload);
        } else {
          pending.reject(new Error(res.error?.message ?? res.error?.code ?? 'Request failed'));
        }
        return;
      }

      if (DEBUG && res.ok === false) {
        console.warn(`${LOG} unmatched res error id=${res.id}`, res.error);
      }
      return;
    }

    if (t === 'event' && ev === 'chat') {
      const payload = (data as { payload?: ChatEventPayload }).payload;
      logInbound(data, `in event chat seq=${payload?.seq} state=${payload?.state}`);
      handleChatEvent(payload);
      return;
    }

    if (t === 'event') {
      logInbound(data, `in event ${ev}`);
      if (ev?.startsWith('agent') || ev?.includes('stream')) {
        const p = (data as { payload?: { stream?: string; data?: unknown } }).payload;
        if (p?.stream === 'reasoning' && p?.data && typeof (p.data as Record<string, unknown>).text === 'string') {
          onReasoningCallback?.((p.data as { text: string }).text);
        }
        const toolLabel = p?.data ? toolHintFromAgentStreamData(p.data) : null;
        if (toolLabel) {
          onAgentStreamToolHintCallback?.(toolLabel);
        }
      } else if (ev && !ROUTINE_EVENTS.has(ev)) {
        logUnhandled(data);
      }
      onMessageCallback?.(data);
      return;
    }

    logUnhandled(data);
    onMessageCallback?.(data);
  };

  socket.onerror = (error) => {
    console.error(`${LOG} WebSocket error:`, error);
    if (!handshakeComplete) {
      onConnectErrorCallback?.('WebSocket error. Is the gateway running? Check URL, firewall, and port 18789.');
    }
  };

  socket.onclose = (event) => {
    console.log(`${LOG} WebSocket closed`, event.code, event.reason);
    if (connectTimeout) {
      clearTimeout(connectTimeout);
      connectTimeout = null;
    }
    const wasReady = gatewayHandshakeOk;
    const intentionalClientClose =
      event.code === 1000 && (event.reason === 'client' || event.reason === 'reconnect');
    socket = null;
    connectReqId = null;
    gatewayHandshakeOk = false;
    if (!handshakeComplete && event.code !== 1000) {
      const msg = event.reason || (event.code === 1006 ? 'Connection refused or gateway unreachable. Is the gateway running at the URL?' : `WebSocket closed (${event.code})`);
      onConnectErrorCallback?.(msg);
    } else if (wasReady && !intentionalClientClose) {
      onDisconnectedCallback?.();
    }
  };
}

interface ChatEventPayload {
  runId?: string;
  sessionKey?: string;
  seq?: number;
  state?: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
}

function handleChatEvent(payload: ChatEventPayload | undefined) {
  if (!payload) return;

  const eventSessionKey = payload.sessionKey?.trim();
  const activeForRouting = getActiveChatSessionKeyForChatRouting?.()?.trim();
  if (eventSessionKey && activeForRouting && eventSessionKey !== activeForRouting) {
    if (DEBUG) {
      console.log(
        `${LOG} chat event ignored (sessionKey mismatch) event=${eventSessionKey} active=${activeForRouting}`
      );
    }
    return;
  }

  const { state, message, errorMessage, runId, seq } = payload;

  if (state === 'delta') {
    const hints = inferStreamPhaseHints(message);
    const lastToolSummary = lastToolSummaryFromStreamMessage(message);
    onChatDeltaCallback?.({ runId, seq, hints, lastToolSummary });
  }

  if (state === 'delta' || state === 'final') {
    if (message !== undefined && message !== null) {
      const text = extractStreamText(message);
      if (text) {
        onContentCallback?.(text);
      } else if (DEBUG && typeof message === 'object' && message !== null) {
        console.log(`${LOG} chat message shape:`, JSON.stringify(message, null, 2));
      }
    }
  }

  if (state === 'final' && message !== undefined && message !== null) {
    onAssistantFinalCallback?.(
      parseAssistantDisplayPayload(message, {
        errorMessage,
        role: 'assistant',
      })
    );
  }

  if (state === 'final' || state === 'aborted' || state === 'error') {
    if (errorMessage) {
      console.error(`${LOG} chat ${state}:`, errorMessage);
    }
    onChatTerminalCallback?.({ state, errorMessage, runId });
  }
}

function sendReq<T>(method: string, params: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected'));
      return;
    }
    const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const frame = { type: 'req', id, method, params };
    pendingReqs.set(id, { resolve: resolve as (v: unknown) => void, reject });
    logOutbound(frame, false);
    socket.send(JSON.stringify(frame));
  });
}

export function sendChatMessage(message: string, options?: { sessionKey?: string }): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error(`${LOG} cannot send: not connected`);
    return;
  }
  const key = options?.sessionKey?.trim() || sessionKey();
  const params = {
    sessionKey: key,
    message,
    idempotencyKey: crypto.randomUUID(),
  };
  const id = `msg-${Date.now()}`;
  const frame = { type: 'req', id, method: 'chat.send', params };
  logOutbound(frame, false);
  socket.send(JSON.stringify(frame));
}

/** @deprecated Use sendChatMessage */
export function sendMessageToGateway(message: string) {
  sendChatMessage(message);
}

export function fetchChatHistory(limit = 100, sessionKeyOverride?: string): Promise<FetchedChatMessage[]> {
  const key = sessionKeyOverride?.trim() || sessionKey();
  return sendReq<ChatHistoryResponse | RawHistoryMessage[]>('chat.history', {
    sessionKey: key,
    limit,
  }).then((res) => {
    const list = Array.isArray(res) ? res : (res?.messages ?? []);
    return (list as RawHistoryMessage[]).map((m) => mapRawHistoryMessage(m));
  });
}

/** Close the socket and reject in-flight requests (e.g. React StrictMode cleanup). */
export function disconnectGateway(): void {
  for (const [, pending] of pendingReqs) {
    pending.reject(new Error('Disconnected'));
  }
  pendingReqs.clear();
  const ws = socket;
  socket = null;
  connectReqId = null;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.close(1000, 'client');
  }
}

/** Drop the socket and open a new one (callbacks from the last `initGatewayConnection` are kept). */
export function requestGatewayReconnect(): void {
  disconnectGateway();
  connect();
}

export function initGatewayConnection({
  onMessage,
  onReasoning,
  onContent,
  onAssistantFinal,
  onChatDelta,
  onChatTerminal,
  onAgentStreamToolHint,
  onConnected,
  onConnectError,
  onDisconnected,
  getActiveChatSessionKey,
}: {
  onMessage: (message: unknown) => void;
  onReasoning: (chunk: string) => void;
  onContent: (chunk: string) => void;
  onAssistantFinal?: (payload: ReturnType<typeof parseAssistantDisplayPayload>) => void;
  /** Each `chat` event with `state: 'delta'` (before `onContent` when text is extracted). */
  onChatDelta?: (info: ChatDeltaInfo) => void;
  /** After `final` / `aborted` / `error` (after `onAssistantFinal` when `state === 'final'`). */
  onChatTerminal?: (info: ChatTerminalInfo) => void;
  /** When agent/stream events carry a tool-shaped payload but chat deltas omit tools (gateway-dependent). */
  onAgentStreamToolHint?: (label: string) => void;
  onConnected?: () => void;
  onConnectError?: (error: string) => void;
  /** Socket closed after a successful handshake (not a deliberate `disconnectGateway` / client close). */
  onDisconnected?: () => void;
  /**
   * Return the UI’s active gateway `sessionKey`. When the gateway includes `sessionKey` on `chat` events,
   * events for other sessions are ignored so background threads do not mutate the visible transcript.
   */
  getActiveChatSessionKey?: () => string | undefined;
}) {
  getActiveChatSessionKeyForChatRouting = getActiveChatSessionKey ?? null;
  onMessageCallback = onMessage;
  onReasoningCallback = onReasoning;
  onContentCallback = onContent;
  onAssistantFinalCallback = onAssistantFinal ?? null;
  onChatDeltaCallback = onChatDelta ?? null;
  onChatTerminalCallback = onChatTerminal ?? null;
  onAgentStreamToolHintCallback = onAgentStreamToolHint ?? null;
  onConnectedCallback = onConnected ?? null;
  onConnectErrorCallback = onConnectError ?? null;
  onDisconnectedCallback = onDisconnected ?? null;
  connect();
}

export function getGatewaySessionKey(): string {
  return sessionKey();
}
