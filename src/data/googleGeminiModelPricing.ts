/**
 * Curated USD per **1M tokens** (Vertex AI **Standard** list prices, not Priority/Flex/Batch).
 * Source: https://cloud.google.com/vertex-ai/generative-ai/pricing (Gemini 2.0 / 2.5 / 3 sections).
 * Gemini Developer API (ai.google.dev) may differ; this table is for UI estimates only.
 */
export const GEMINI_MODEL_PRICING_AS_OF = '2026-03-22';

export const PRICING_SOURCE_NOTES =
  'Vertex AI Generative AI pricing (Standard tier, USD). Long context (>200K), audio/video, and grounding are billed differently on GCP.';

export type GeminiModelPriceRow = {
  /** Display name for the modal */
  displayName: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  /** Cached input tokens (when applicable); omit if same as input or unknown */
  cacheReadUsdPerMillion?: number;
  cacheWriteUsdPerMillion?: number;
};

/**
 * Keys are normalized ids from {@link normalizeGoogleModelRef} (lowercase, no `google/` prefix).
 * Include common preview suffixes OpenClaw uses.
 */
export const GOOGLE_GEMINI_MODEL_PRICING: Record<string, GeminiModelPriceRow> = {
  'gemini-2.5-pro': {
    displayName: 'Gemini 2.5 Pro',
    inputUsdPerMillion: 1.25,
    outputUsdPerMillion: 10,
    cacheReadUsdPerMillion: 0.13,
    cacheWriteUsdPerMillion: 0.25,
  },
  'gemini-2.5-pro-preview': {
    displayName: 'Gemini 2.5 Pro (preview alias)',
    inputUsdPerMillion: 1.25,
    outputUsdPerMillion: 10,
    cacheReadUsdPerMillion: 0.13,
    cacheWriteUsdPerMillion: 0.25,
  },
  'gemini-2.5-flash': {
    displayName: 'Gemini 2.5 Flash',
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
    cacheReadUsdPerMillion: 0.03,
    cacheWriteUsdPerMillion: 0.03,
  },
  'gemini-2.5-flash-preview': {
    displayName: 'Gemini 2.5 Flash (preview alias)',
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
    cacheReadUsdPerMillion: 0.03,
    cacheWriteUsdPerMillion: 0.03,
  },
  'gemini-2.5-flash-lite': {
    displayName: 'Gemini 2.5 Flash-Lite',
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
    cacheReadUsdPerMillion: 0.01,
    cacheWriteUsdPerMillion: 0.01,
  },
  'gemini-2.5-flash-lite-preview': {
    displayName: 'Gemini 2.5 Flash-Lite (preview alias)',
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
    cacheReadUsdPerMillion: 0.01,
    cacheWriteUsdPerMillion: 0.01,
  },
  'gemini-2.0-flash': {
    displayName: 'Gemini 2.0 Flash',
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
  },
  'gemini-2.0-flash-lite': {
    displayName: 'Gemini 2.0 Flash-Lite',
    inputUsdPerMillion: 0.075,
    outputUsdPerMillion: 0.3,
  },
  'gemini-3-flash-preview': {
    displayName: 'Gemini 3 Flash Preview',
    inputUsdPerMillion: 0.5,
    outputUsdPerMillion: 3,
    cacheReadUsdPerMillion: 0.05,
    cacheWriteUsdPerMillion: 0.05,
  },
  'gemini-3-pro-preview': {
    displayName: 'Gemini 3 Pro Preview',
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 12,
    cacheReadUsdPerMillion: 0.2,
    cacheWriteUsdPerMillion: 0.4,
  },
  'gemini-3.1-pro-preview': {
    displayName: 'Gemini 3.1 Pro Preview',
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 12,
    cacheReadUsdPerMillion: 0.2,
    cacheWriteUsdPerMillion: 0.4,
  },
  'gemini-3.1-flash-lite-preview': {
    displayName: 'Gemini 3.1 Flash-Lite Preview',
    inputUsdPerMillion: 0.25,
    outputUsdPerMillion: 1.5,
    cacheReadUsdPerMillion: 0.03,
    cacheWriteUsdPerMillion: 0.03,
  },
};
