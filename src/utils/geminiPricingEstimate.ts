import {
  GOOGLE_GEMINI_MODEL_PRICING,
  type GeminiModelPriceRow,
} from '../data/googleGeminiModelPricing';

export type GatewayUsageLike = {
  input?: number;
  output?: number;
  totalTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
};

function readFiniteNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string' && v.trim() !== '' && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim())) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  return undefined;
}

/** Strip `google/` prefix, lowercase, trim. */
export function normalizeGoogleModelRef(ref: string): string {
  let s = ref.trim().toLowerCase();
  if (s.startsWith('google/')) s = s.slice('google/'.length);
  return s.trim();
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Parse loose gateway `usage` objects from history / final payloads. */
export function parseGatewayUsageLike(raw: unknown): GatewayUsageLike | undefined {
  if (!isRecord(raw)) return undefined;
  const input =
    readFiniteNumber(raw.input) ??
    readFiniteNumber(raw.promptTokens) ??
    readFiniteNumber(raw.prompt_tokens);
  const output =
    readFiniteNumber(raw.output) ??
    readFiniteNumber(raw.completionTokens) ??
    readFiniteNumber(raw.completion_tokens);
  const totalTokens = readFiniteNumber(raw.totalTokens) ?? readFiniteNumber(raw.total_tokens);
  const cacheRead = readFiniteNumber(raw.cacheRead) ?? readFiniteNumber(raw.cache_read);
  const cacheWrite = readFiniteNumber(raw.cacheWrite) ?? readFiniteNumber(raw.cache_write);
  const hasAny =
    input !== undefined ||
    output !== undefined ||
    totalTokens !== undefined ||
    cacheRead !== undefined ||
    cacheWrite !== undefined;
  if (!hasAny) return undefined;
  return { input, output, totalTokens, cacheRead, cacheWrite };
}

export function pricingRowForNormalizedModel(normalizedId: string): GeminiModelPriceRow | undefined {
  if (!normalizedId) return undefined;
  const direct = GOOGLE_GEMINI_MODEL_PRICING[normalizedId];
  if (direct) return direct;
  const withoutPreview = normalizedId.replace(/-preview$/, '');
  if (withoutPreview !== normalizedId) {
    return GOOGLE_GEMINI_MODEL_PRICING[withoutPreview];
  }
  return undefined;
}

/**
 * True when we should apply the Gemini price table (avoid pricing Anthropic/OpenAI rows).
 */
export function isGooglePricedAssistant(provider: string | undefined, modelRef: string | undefined): boolean {
  const p = provider?.trim().toLowerCase();
  if (p === 'google' || p === 'google-generative-ai' || p === 'google_gemini' || p === 'vertex') {
    return true;
  }
  const m = modelRef?.trim().toLowerCase() ?? '';
  if (!m) return false;
  if (m.startsWith('google/') || m.includes('gemini')) return true;
  return false;
}

/**
 * Estimated USD for one assistant turn from token counts × static Vertex table.
 * Returns undefined if model unknown, usage missing input/output breakdown, or non-Google.
 */
export function estimateUsdFromUsage(
  provider: string | undefined,
  modelRef: string | undefined,
  usageRaw: unknown
): number | undefined {
  if (!isGooglePricedAssistant(provider, modelRef)) return undefined;
  const normalized = normalizeGoogleModelRef(modelRef ?? '');
  const row = pricingRowForNormalizedModel(normalized);
  if (!row) return undefined;

  const usage = parseGatewayUsageLike(usageRaw);
  if (!usage) return undefined;

  const input = usage.input;
  const output = usage.output;
  if (input === undefined || output === undefined) return undefined;

  let usd = (input / 1_000_000) * row.inputUsdPerMillion + (output / 1_000_000) * row.outputUsdPerMillion;
  if (usage.cacheRead !== undefined && row.cacheReadUsdPerMillion !== undefined) {
    usd += (usage.cacheRead / 1_000_000) * row.cacheReadUsdPerMillion;
  }
  if (usage.cacheWrite !== undefined && row.cacheWriteUsdPerMillion !== undefined) {
    usd += (usage.cacheWrite / 1_000_000) * row.cacheWriteUsdPerMillion;
  }
  return Number.isFinite(usd) ? usd : undefined;
}

export function sumMessageEstimatedUsd(messages: { estimatedCostUsd?: number }[]): number | undefined {
  let sum = 0;
  let any = false;
  for (const m of messages) {
    const v = m.estimatedCostUsd;
    if (v !== undefined && Number.isFinite(v)) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : undefined;
}
