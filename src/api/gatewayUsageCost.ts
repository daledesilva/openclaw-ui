const LOG = '[OpenClaw gateway] usage.cost probe';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function readFiniteNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim())) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function sessionsListDebugEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    (import.meta.env.VITE_OPENCLAW_DEBUG === '1' || import.meta.env.VITE_OPENCLAW_SESSIONS_DEBUG === '1')
  );
}

export type ParsedGatewayUsageCost = {
  /** All-sessions or window total when the gateway returns one number. */
  aggregateUsd?: number;
  /** Per canonical or suffix session key when present in payload. */
  bySessionKey?: Record<string, number>;
};

const TOP_LEVEL_USD_KEYS = [
  'totalUsd',
  'total_usd',
  'estimatedUsd',
  'estimated_usd',
  'costUsd',
  'cost_usd',
  'usd',
  'totalCostUsd',
  'total_cost_usd',
];

function tryAggregateFromRecord(obj: Record<string, unknown>): number | undefined {
  for (const k of TOP_LEVEL_USD_KEYS) {
    const n = readFiniteNumber(obj[k]);
    if (n !== undefined) return n;
  }
  const nested = obj.totals ?? obj.summary ?? obj.total;
  if (isRecord(nested)) {
    for (const k of TOP_LEVEL_USD_KEYS) {
      const n = readFiniteNumber(nested[k]);
      if (n !== undefined) return n;
    }
  }
  return undefined;
}

function mergeBySession(target: Record<string, number>, key: string, usd: number): void {
  const k = key.trim();
  if (!k) return;
  target[k] = (target[k] ?? 0) + usd;
}

/** Best-effort parse of `usage.cost` RPC payload (shape varies by gateway version). */
export function parseGatewayUsageCostPayload(payload: unknown): ParsedGatewayUsageCost {
  const out: ParsedGatewayUsageCost = {};
  if (!isRecord(payload)) return out;

  out.aggregateUsd = tryAggregateFromRecord(payload);

  const byKey: Record<string, number> = {};

  const sessions = payload.sessions;
  if (Array.isArray(sessions)) {
    for (const row of sessions) {
      if (!isRecord(row)) continue;
      const key = typeof row.key === 'string' ? row.key.trim() : '';
      if (!key) continue;
      let usd: number | undefined;
      for (const k of [...TOP_LEVEL_USD_KEYS, 'sessionCostUsd', 'session_cost_usd', 'cost']) {
        usd = readFiniteNumber(row[k]);
        if (usd !== undefined) break;
      }
      if (usd !== undefined) mergeBySession(byKey, key, usd);
    }
  }

  const bySession = payload.bySession ?? payload.bySessionKey ?? payload.sessionsByKey;
  if (isRecord(bySession)) {
    for (const [k, v] of Object.entries(bySession)) {
      const n = readFiniteNumber(v);
      if (n !== undefined) mergeBySession(byKey, k, n);
    }
  }

  if (Object.keys(byKey).length) out.bySessionKey = byKey;
  return out;
}

export function logGatewayUsageCostProbe(payload: unknown, context?: { sessionKey?: string }): void {
  if (!sessionsListDebugEnabled()) return;
  console.log(LOG, 'raw payload (JSON)=', JSON.stringify(payload, null, 2));
  if (context?.sessionKey) {
    console.log(LOG, 'requested sessionKey=', context.sessionKey);
  }
  const parsed = parseGatewayUsageCostPayload(payload);
  console.log(LOG, 'parsed summary=', parsed);
}

/** Build canonical key for `usage.cost` when the UI only stores the tail (e.g. `webchat-uuid`). */
export function canonicalOpenClawSessionKey(threadSessionKey: string, defaultAgentId: string): string {
  const trimmed = threadSessionKey.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(':')) return trimmed;
  const agent = defaultAgentId.trim() || 'main';
  return `agent:${agent}:${trimmed}`;
}

/** Per-session USD from `bySessionKey` only (no aggregate fallback). */
export function sessionOnlyUsageCostUsd(
  uiSessionKey: string,
  parsed: ParsedGatewayUsageCost,
  defaultAgentId: string
): number | undefined {
  const map = parsed.bySessionKey;
  if (!map || Object.keys(map).length === 0) return undefined;

  const direct = map[uiSessionKey];
  if (direct !== undefined) return direct;

  const canonical = canonicalOpenClawSessionKey(uiSessionKey, defaultAgentId);
  const fromCanonical = map[canonical];
  if (fromCanonical !== undefined) return fromCanonical;

  for (const k of Object.keys(map)) {
    if (k === uiSessionKey || k.endsWith(`:${uiSessionKey}`)) {
      return map[k];
    }
  }

  return undefined;
}

/** Header: per-session from map when possible, else gateway aggregate. */
export function usageCostUsdForUiSessionKey(
  uiSessionKey: string,
  parsed: ParsedGatewayUsageCost,
  defaultAgentId: string
): number | undefined {
  return sessionOnlyUsageCostUsd(uiSessionKey, parsed, defaultAgentId) ?? parsed.aggregateUsd;
}

export function formatUsdEstimate(usd: number): string {
  if (!Number.isFinite(usd)) return '';
  const abs = Math.abs(usd);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
  return `~$${usd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits })}`;
}

export function mergeParsedGatewayUsageCost(
  a: ParsedGatewayUsageCost,
  b: ParsedGatewayUsageCost
): ParsedGatewayUsageCost {
  const mergedMap = { ...a.bySessionKey, ...b.bySessionKey };
  const hasMap = Object.keys(mergedMap).length > 0;
  return {
    aggregateUsd: a.aggregateUsd ?? b.aggregateUsd,
    ...(hasMap ? { bySessionKey: mergedMap } : {}),
  };
}
