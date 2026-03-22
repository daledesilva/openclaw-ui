const LOG = '[OpenClaw gateway] sessions.list cost probe';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function readNumericField(obj: Record<string, unknown>, camel: string, snake: string): number | undefined {
  const v = obj[camel] ?? obj[snake];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return undefined;
}

export type GatewaySessionTokenStats = {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextTokens?: number;
};

function statsFromSessionObject(obj: Record<string, unknown>): GatewaySessionTokenStats {
  return {
    totalTokens: readNumericField(obj, 'totalTokens', 'total_tokens'),
    inputTokens: readNumericField(obj, 'inputTokens', 'input_tokens'),
    outputTokens: readNumericField(obj, 'outputTokens', 'output_tokens'),
    contextTokens: readNumericField(obj, 'contextTokens', 'context_tokens'),
  };
}

function mergeStats(a: GatewaySessionTokenStats, b: GatewaySessionTokenStats): GatewaySessionTokenStats {
  return {
    totalTokens: b.totalTokens ?? a.totalTokens,
    inputTokens: b.inputTokens ?? a.inputTokens,
    outputTokens: b.outputTokens ?? a.outputTokens,
    contextTokens: b.contextTokens ?? a.contextTokens,
  };
}

/** Resolve gateway session key from an entry; `outerKey` is used when the payload is a map keyed by session key. */
export function resolveSessionKeyFromEntry(
  obj: Record<string, unknown>,
  outerKey?: string
): string | undefined {
  const candidates = [obj.sessionKey, obj.session_key, obj.key, obj.id];
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  if (outerKey && outerKey.trim()) return outerKey.trim();
  return undefined;
}

/**
 * OpenClaw canonical keys look like `agent:<agentId>:<suffix>` (suffix may contain colons).
 * The UI stores the short form (e.g. `webchat-<uuid>`) while `sessions.list` uses full `key`.
 */
export function openClawSessionSuffixFromCanonicalKey(canonicalKey: string): string | undefined {
  const parts = canonicalKey.split(':');
  if (parts.length < 3) return undefined;
  return parts.slice(2).join(':');
}

/**
 * Normalize `sessions.list` payload into sessionKey → token stats.
 * Handles several plausible gateway shapes without assuming a fixed schema.
 */
export function extractSessionTokenStatsByKey(payload: unknown): Record<string, GatewaySessionTokenStats> {
  const out: Record<string, GatewaySessionTokenStats> = {};

  const addEntry = (obj: Record<string, unknown>, outerKey?: string) => {
    const sessionKey = resolveSessionKeyFromEntry(obj, outerKey);
    if (!sessionKey) return;
    const next = statsFromSessionObject(obj);
    const hasAny =
      next.totalTokens !== undefined ||
      next.inputTokens !== undefined ||
      next.outputTokens !== undefined ||
      next.contextTokens !== undefined;
    if (!hasAny) return;
    out[sessionKey] = out[sessionKey] ? mergeStats(out[sessionKey], next) : next;
    const suffixKey = openClawSessionSuffixFromCanonicalKey(sessionKey);
    if (suffixKey && suffixKey !== sessionKey) {
      out[suffixKey] = out[suffixKey] ? mergeStats(out[suffixKey], next) : next;
    }
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (isRecord(item)) addEntry(item);
    }
    return out;
  }

  if (!isRecord(payload)) return out;

  const sessions = payload.sessions;
  if (Array.isArray(sessions)) {
    for (const item of sessions) {
      if (isRecord(item)) addEntry(item);
    }
    return out;
  }

  const entries = payload.entries;
  if (Array.isArray(entries)) {
    for (const item of entries) {
      if (isRecord(item)) addEntry(item);
    }
    return out;
  }

  for (const [outerKey, val] of Object.entries(payload)) {
    if (isRecord(val)) addEntry(val, outerKey);
  }

  return out;
}

const COST_LIKE_KEY = /cost|usd|price|billing|cache\s*read|cache\s*write|cache_read|cache_write|cacheRead|cacheWrite/i;

function collectEntryObjects(payload: unknown): Array<{ keyHint?: string; obj: Record<string, unknown> }> {
  const list: Array<{ keyHint?: string; obj: Record<string, unknown> }> = [];

  const push = (obj: Record<string, unknown>, keyHint?: string) => {
    list.push({ obj, keyHint });
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (isRecord(item)) push(item);
    }
    return list;
  }
  if (!isRecord(payload)) return list;

  if (Array.isArray(payload.sessions)) {
    for (const item of payload.sessions) {
      if (isRecord(item)) push(item);
    }
    return list;
  }
  if (Array.isArray(payload.entries)) {
    for (const item of payload.entries) {
      if (isRecord(item)) push(item);
    }
    return list;
  }

  for (const [outerKey, val] of Object.entries(payload)) {
    if (isRecord(val)) push(val, outerKey);
  }
  return list;
}

/** First `agent:<id>:…` entry in `sessions.list` payload → agent id (e.g. `main`). */
export function extractDefaultAgentIdFromSessionsListPayload(payload: unknown): string | undefined {
  const rows = collectEntryObjects(payload);
  for (const { obj } of rows) {
    const k = typeof obj.key === 'string' ? obj.key.trim() : '';
    if (k.startsWith('agent:')) {
      const parts = k.split(':');
      if (parts.length >= 2 && parts[1]) return parts[1];
    }
  }
  return undefined;
}

/** `health` event payload often includes `defaultAgentId` / `agents[].agentId`. */
export function extractDefaultAgentIdFromHealthPayload(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const direct = payload.defaultAgentId;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const agents = payload.agents;
  if (!Array.isArray(agents)) return undefined;
  for (const a of agents) {
    if (!isRecord(a)) continue;
    if (a.isDefault === true && typeof a.agentId === 'string' && a.agentId.trim()) {
      return a.agentId.trim();
    }
  }
  const first = agents[0];
  if (isRecord(first) && typeof first.agentId === 'string' && first.agentId.trim()) {
    return first.agentId.trim();
  }
  return undefined;
}

function entryMatchesUiSessionKey(
  uiKey: string,
  obj: Record<string, unknown>,
  keyHint?: string
): boolean {
  const resolved = resolveSessionKeyFromEntry(obj, keyHint);
  if (!resolved) return false;
  if (resolved === uiKey) return true;
  const suffix = openClawSessionSuffixFromCanonicalKey(resolved);
  if (suffix === uiKey) return true;
  return resolved.endsWith(`:${uiKey}`);
}

function shallowCostLikeHits(obj: Record<string, unknown>): Array<{ key: string; sampleValue: unknown }> {
  const hits: Array<{ key: string; sampleValue: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    if (COST_LIKE_KEY.test(k)) {
      hits.push({ key: k, sampleValue: v });
    }
  }
  return hits;
}

function oneLevelNestedCostHits(obj: Record<string, unknown>): Array<{ path: string; sampleValue: unknown }> {
  const hits: Array<{ path: string; sampleValue: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    if (!isRecord(v)) continue;
    for (const [inner, innerVal] of Object.entries(v)) {
      if (COST_LIKE_KEY.test(inner)) {
        hits.push({ path: `${k}.${inner}`, sampleValue: innerVal });
      }
    }
  }
  return hits;
}

function sessionsListDebugEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    (import.meta.env.VITE_OPENCLAW_DEBUG === '1' || import.meta.env.VITE_OPENCLAW_SESSIONS_DEBUG === '1')
  );
}

/**
 * Log raw `sessions.list` shape and any cost-related fields (for future per-session USD support).
 * Gated by `DEV` and (`VITE_OPENCLAW_DEBUG=1` or `VITE_OPENCLAW_SESSIONS_DEBUG=1`).
 */
export function logGatewaySessionsListCostProbe(
  payload: unknown,
  options?: { activeSessionKey?: string }
): void {
  if (!sessionsListDebugEnabled()) return;

  if (payload === null || payload === undefined) {
    console.log(LOG, 'payload is null/undefined');
    return;
  }

  if (Array.isArray(payload)) {
    console.log(LOG, `top: array length=${payload.length}`);
  } else if (isRecord(payload)) {
    console.log(LOG, 'top: object keys=', Object.keys(payload));
  } else {
    console.log(LOG, 'top: typeof=', typeof payload);
  }

  const rows = collectEntryObjects(payload);
  console.log(LOG, `parsed ${rows.length} session-like entries`);

  const active = options?.activeSessionKey?.trim();
  if (active) {
    const match = rows.find(({ obj, keyHint }) => entryMatchesUiSessionKey(active, obj, keyHint));
    if (match) {
      console.log(LOG, 'active session entry (full JSON)=', JSON.stringify(match.obj, null, 2));
    } else {
      console.log(LOG, 'no entry matched activeSessionKey=', active);
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const { obj, keyHint } = rows[i];
    const sk = resolveSessionKeyFromEntry(obj, keyHint);
    const shallow = shallowCostLikeHits(obj);
    const nested = oneLevelNestedCostHits(obj);
    if (shallow.length || nested.length) {
      console.log(LOG, 'cost-like fields', {
        index: i,
        sessionKey: sk,
        shallow,
        nested,
      });
    }
  }
}

/** Display total for header/sidebar: prefer explicit total, else sum input+output when present. */
export function displayTotalTokens(stats: GatewaySessionTokenStats | undefined): number | undefined {
  if (!stats) return undefined;
  if (stats.totalTokens !== undefined) return stats.totalTokens;
  if (stats.inputTokens !== undefined || stats.outputTokens !== undefined) {
    const a = stats.inputTokens ?? 0;
    const b = stats.outputTokens ?? 0;
    return a + b;
  }
  return undefined;
}

/** Tooltip / detail: total plus in/out when the gateway sends them. */
export function formatTokenBreakdown(stats: GatewaySessionTokenStats | undefined): string | undefined {
  const total = displayTotalTokens(stats);
  if (total === undefined) return undefined;
  const { inputTokens, outputTokens } = stats ?? {};
  if (inputTokens !== undefined || outputTokens !== undefined) {
    const inPart = inputTokens !== undefined ? inputTokens.toLocaleString() : '—';
    const outPart = outputTokens !== undefined ? outputTokens.toLocaleString() : '—';
    return `${total.toLocaleString()} tokens (in ${inPart} · out ${outPart})`;
  }
  return `${total.toLocaleString()} tokens`;
}
