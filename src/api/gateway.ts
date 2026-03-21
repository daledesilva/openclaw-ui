import {
  loadOrCreateDeviceIdentity,
  createDeviceBlock,
  isDeviceSigningAvailable,
} from './device-auth';

const LOG = '[OpenClaw gateway]';
const DEBUG = import.meta.env.VITE_OPENCLAW_DEBUG === '1' || import.meta.env.DEV;

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
let onMessageCallback: ((message: unknown) => void) | null = null;
let onReasoningCallback: ((chunk: string) => void) | null = null;
let onContentCallback: ((chunk: string) => void) | null = null;
let onConnectedCallback: (() => void) | null = null;
let onConnectErrorCallback: ((error: string) => void) | null = null;

const pendingReqs = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let connectReqId: string | null = null;

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

function sessionKey(): string {
  const fromEnv = import.meta.env.VITE_OPENCLAW_SESSION_KEY?.trim();
  return fromEnv || 'main';
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
          version: '0.1.0',
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
          console.log(`${LOG} handshake ok, connected`);
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
        const p = (data as { payload?: { stream?: string; data?: Record<string, unknown> } }).payload;
        if (p?.stream === 'reasoning' && typeof p?.data?.text === 'string') {
          onReasoningCallback?.(p.data.text);
        }
      } else {
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
    socket = null;
    connectReqId = null;
    if (!handshakeComplete && event.code !== 1000) {
      const msg = event.reason || (event.code === 1006 ? 'Connection refused or gateway unreachable. Is the gateway running at the URL?' : `WebSocket closed (${event.code})`);
      onConnectErrorCallback?.(msg);
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

  const { state, message, errorMessage } = payload;

  if (state === 'delta' || state === 'final') {
    if (message !== undefined && message !== null) {
      if (typeof message === 'string') {
        onContentCallback?.(message);
      } else if (typeof message === 'object' && message !== null && 'text' in message && typeof (message as { text: string }).text === 'string') {
        onContentCallback?.((message as { text: string }).text);
      } else if (typeof message === 'object' && message !== null) {
        if (DEBUG) {
          console.log(`${LOG} chat message shape:`, JSON.stringify(message, null, 2));
        }
        const m = message as Record<string, unknown>;
        if (typeof m.content === 'string') onContentCallback?.(m.content);
        else if (typeof m.text === 'string') onContentCallback?.(m.text);
      }
    }
  }

  if (state === 'final' || state === 'aborted' || state === 'error') {
    if (errorMessage) {
      console.error(`${LOG} chat ${state}:`, errorMessage);
    }
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

export function sendChatMessage(message: string): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error(`${LOG} cannot send: not connected`);
    return;
  }
  const params = {
    sessionKey: sessionKey(),
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

export function fetchChatHistory(limit = 100): Promise<{ role: string; content: string }[]> {
  return sendReq<{ messages?: { role?: string; content?: string }[] } | { role?: string; content?: string }[]>('chat.history', {
    sessionKey: sessionKey(),
    limit,
  }).then((res) => {
    const list = Array.isArray(res) ? res : (res as { messages?: unknown[] })?.messages ?? [];
    return (list as { role?: string; content?: string }[]).map((m) => ({
      role: (m?.role ?? 'user').toLowerCase(),
      content: typeof m?.content === 'string' ? m.content : String(m?.content ?? ''),
    }));
  });
}

export function initGatewayConnection({
  onMessage,
  onReasoning,
  onContent,
  onConnected,
  onConnectError,
}: {
  onMessage: (message: unknown) => void;
  onReasoning: (chunk: string) => void;
  onContent: (chunk: string) => void;
  onConnected?: () => void;
  onConnectError?: (error: string) => void;
}) {
  onMessageCallback = onMessage;
  onReasoningCallback = onReasoning;
  onContentCallback = onContent;
  onConnectedCallback = onConnected ?? null;
  onConnectErrorCallback = onConnectError ?? null;
  connect();
}

export function getGatewaySessionKey(): string {
  return sessionKey();
}
