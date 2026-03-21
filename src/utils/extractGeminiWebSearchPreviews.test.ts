import { describe, expect, it } from 'vitest';
import {
  extractLinkPreviewsFromGeminiWebSearchPayload,
  extractLinkPreviewsFromWebSearchInner,
  isGeminiWebSearchToolEnvelope,
  unwrapExternalUntrustedContentString,
} from './extractGeminiWebSearchPreviews';

describe('isGeminiWebSearchToolEnvelope', () => {
  it('is true when externalContent.source is web_search', () => {
    expect(
      isGeminiWebSearchToolEnvelope({
        query: 'q',
        externalContent: { source: 'web_search', provider: 'gemini' },
        content: 'plain',
      })
    ).toBe(true);
  });

  it('is true when content mentions EXTERNAL_UNTRUSTED_CONTENT', () => {
    expect(
      isGeminiWebSearchToolEnvelope({
        content: '<<<EXTERNAL_UNTRUSTED_CONTENT id="a">>>\n[x](https://x.test)',
      })
    ).toBe(true);
  });

  it('is false for unrelated objects', () => {
    expect(isGeminiWebSearchToolEnvelope({ results: [{ url: 'https://a.com' }] })).toBe(false);
  });
});

describe('unwrapExternalUntrustedContentString', () => {
  it('removes open and close tags', () => {
    const raw =
      '\n<<<EXTERNAL_UNTRUSTED_CONTENT id="fd26c32">>>\n[One](https://one.example)\n<<</EXTERNAL_UNTRUSTED_CONTENT>>>';
    expect(unwrapExternalUntrustedContentString(raw).trim()).toBe('[One](https://one.example)');
  });
});

describe('extractLinkPreviewsFromWebSearchInner', () => {
  it('parses markdown links', () => {
    const inner = '[A](https://a.test/foo) and [B](https://b.test/bar)';
    expect(extractLinkPreviewsFromWebSearchInner(inner)).toEqual([
      { url: 'https://a.test/foo', title: 'A' },
      { url: 'https://b.test/bar', title: 'B' },
    ]);
  });

  it('parses JSON array of results', () => {
    const inner = JSON.stringify([{ url: 'https://u.test', title: 'U' }]);
    expect(extractLinkPreviewsFromWebSearchInner(inner)).toEqual([{ url: 'https://u.test', title: 'U' }]);
  });

  it('extracts plain URLs from lines', () => {
    const inner = 'See https://plain.example/page for details';
    expect(extractLinkPreviewsFromWebSearchInner(inner)).toEqual([
      { url: 'https://plain.example/page', title: 'See' },
    ]);
  });
});

describe('extractLinkPreviewsFromGeminiWebSearchPayload', () => {
  it('extracts from full tool envelope', () => {
    const payload = {
      query: 'tall upright freezer',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      tookMs: 10311,
      externalContent: { untrusted: true, source: 'web_search', provider: 'gemini', wrapped: true },
      content:
        '\n<<<EXTERNAL_UNTRUSTED_CONTENT id="abc123">>>\n' +
        '[Retailer A](https://shop-a.example/freezers)\n' +
        '[Retailer B](https://shop-b.example/deals)\n' +
        '<<</EXTERNAL_UNTRUSTED_CONTENT>>>',
    };
    const links = extractLinkPreviewsFromGeminiWebSearchPayload(payload);
    expect(links).toEqual([
      { url: 'https://shop-a.example/freezers', title: 'Retailer A' },
      { url: 'https://shop-b.example/deals', title: 'Retailer B' },
    ]);
  });

  it('returns empty when not an envelope', () => {
    expect(extractLinkPreviewsFromGeminiWebSearchPayload({ foo: 1 })).toEqual([]);
  });

  it('truncates huge inner content without throwing', () => {
    const filler = 'x'.repeat(250_000);
    const payload = {
      externalContent: { source: 'web_search' },
      content: `<<<EXTERNAL_UNTRUSTED_CONTENT id="x">>>${filler}https://tiny.test/z`,
    };
    const links = extractLinkPreviewsFromGeminiWebSearchPayload(payload);
    expect(links.length).toBeGreaterThanOrEqual(0);
    expect(links.length).toBeLessThanOrEqual(20);
  });
});
