import { describe, expect, it } from 'vitest';
import {
  estimateUsdFromUsage,
  isGooglePricedAssistant,
  normalizeGoogleModelRef,
  parseGatewayUsageLike,
  pricingRowForNormalizedModel,
} from './geminiPricingEstimate';

describe('normalizeGoogleModelRef', () => {
  it('strips google/ prefix and lowercases', () => {
    expect(normalizeGoogleModelRef('Google/gemini-2.5-pro')).toBe('gemini-2.5-pro');
  });
});

describe('isGooglePricedAssistant', () => {
  it('accepts google provider', () => {
    expect(isGooglePricedAssistant('google', 'gemini-2.5-pro')).toBe(true);
  });
  it('rejects anthropic with gemini-looking id only if provider wrong', () => {
    expect(isGooglePricedAssistant('anthropic', 'claude-3')).toBe(false);
  });
  it('accepts gemini in model id', () => {
    expect(isGooglePricedAssistant(undefined, 'gemini-2.5-flash')).toBe(true);
  });
});

describe('estimateUsdFromUsage', () => {
  it('computes 2.5 Pro cost for 1M input + 1M output', () => {
    const row = pricingRowForNormalizedModel('gemini-2.5-pro');
    expect(row?.inputUsdPerMillion).toBe(1.25);
    expect(row?.outputUsdPerMillion).toBe(10);
    const usd = estimateUsdFromUsage('google', 'gemini-2.5-pro', {
      input: 1_000_000,
      output: 1_000_000,
    });
    expect(usd).toBeCloseTo(1.25 + 10, 5);
  });

  it('returns undefined without input+output breakdown', () => {
    expect(
      estimateUsdFromUsage('google', 'gemini-2.5-pro', { totalTokens: 5000 })
    ).toBeUndefined();
  });

  it('returns undefined for non-Google provider', () => {
    expect(
      estimateUsdFromUsage('anthropic', 'claude-opus-4-6', { input: 100, output: 50 })
    ).toBeUndefined();
  });

  it('includes cache read when row defines it', () => {
    const usd = estimateUsdFromUsage('google', 'gemini-2.5-pro', {
      input: 1_000_000,
      output: 0,
      cacheRead: 1_000_000,
    });
    expect(usd).toBeCloseTo(1.25 + 0.13, 5);
  });
});

describe('parseGatewayUsageLike', () => {
  it('reads snake_case', () => {
    expect(parseGatewayUsageLike({ input: 1, output: 2, cache_read: 3 })).toEqual({
      input: 1,
      output: 2,
      totalTokens: undefined,
      cacheRead: 3,
      cacheWrite: undefined,
    });
  });
});
