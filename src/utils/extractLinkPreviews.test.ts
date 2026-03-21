import { describe, expect, it } from 'vitest';
import {
  extractLinkPreviewsFromParsedJson,
  extractLinkPreviewsFromTextSegment,
  stripLeadingLinkListJsonFromBody,
  tryConsumeLeadingJsonValue,
} from './extractLinkPreviews';

describe('extractLinkPreviewsFromTextSegment', () => {
  it('consumes array of url/title objects', () => {
    const json = JSON.stringify([
      { url: 'https://a.example/page', title: 'A' },
      { url: 'http://b.example/', name: 'B' },
    ]);
    const { links, consumed } = extractLinkPreviewsFromTextSegment(`  ${json}  `);
    expect(consumed).toBe(true);
    expect(links).toEqual([
      { url: 'https://a.example/page', title: 'A' },
      { url: 'http://b.example/', title: 'B' },
    ]);
  });

  it('consumes wrapped object with results array', () => {
    const json = JSON.stringify({
      results: [{ url: 'https://x.test', snippet: 'Snip' }],
    });
    const { links, consumed } = extractLinkPreviewsFromTextSegment(json);
    expect(consumed).toBe(true);
    expect(links).toEqual([{ url: 'https://x.test', title: 'Snip' }]);
  });

  it('does not consume invalid JSON', () => {
    expect(extractLinkPreviewsFromTextSegment('not json')).toEqual({ links: [], consumed: false });
  });

  it('does not consume JSON without http(s) urls', () => {
    const { consumed } = extractLinkPreviewsFromTextSegment('[{"url":"ftp://x"}]');
    expect(consumed).toBe(false);
  });

  it('does not consume prose mixed in same string', () => {
    const { consumed } = extractLinkPreviewsFromTextSegment('Hello\n\n[{"url":"https://a.com"}]');
    expect(consumed).toBe(false);
  });

  it('dedupes by url and caps length', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      url: `https://t.example/${i % 3}`,
      title: String(i),
    }));
    const { links } = extractLinkPreviewsFromTextSegment(JSON.stringify(rows));
    expect(links.length).toBeLessThanOrEqual(20);
    expect(new Set(links.map((l) => l.url)).size).toBe(links.length);
  });
});

describe('stripLeadingLinkListJsonFromBody', () => {
  it('strips leading JSON block and preserves markdown', () => {
    const json = JSON.stringify([{ url: 'https://a.com', title: 'A' }]);
    const body = `${json}\n\nHere is **prose**.`;
    const { body: cleaned, links } = stripLeadingLinkListJsonFromBody(body);
    expect(links).toHaveLength(1);
    expect(cleaned).toContain('**prose**');
    expect(cleaned).not.toContain('https://a.com');
  });
});

describe('extractLinkPreviewsFromParsedJson', () => {
  it('reads Serp-style organic_results with link field', () => {
    const parsed = {
      organic_results: [
        { link: 'https://one.example/a', title: 'One', snippet: 'S1' },
        { link: 'https://two.example/b', title: 'Two' },
      ],
    };
    const links = extractLinkPreviewsFromParsedJson(parsed);
    expect(links).toEqual([
      { url: 'https://one.example/a', title: 'One' },
      { url: 'https://two.example/b', title: 'Two' },
    ]);
  });

  it('reads Bing-style webPages.value', () => {
    const parsed = {
      webPages: {
        value: [{ url: 'https://x.test', name: 'X page', snippet: 'Desc' }],
      },
    };
    expect(extractLinkPreviewsFromParsedJson(parsed)).toEqual([
      { url: 'https://x.test', title: 'X page' },
    ]);
  });

  it('reads nested data.results', () => {
    const parsed = {
      data: {
        results: [{ href: 'https://h.test', headline: 'H' }],
      },
    };
    expect(extractLinkPreviewsFromParsedJson(parsed)).toEqual([{ url: 'https://h.test', title: 'H' }]);
  });
});

describe('tryConsumeLeadingJsonValue', () => {
  it('handles strings with escaped quotes inside', () => {
    const inner = '[{"url":"https://a.com","title":"Say \\"hi\\""}]';
    const { jsonText, rest } = tryConsumeLeadingJsonValue(`  ${inner} tail`);
    expect(jsonText).toBe(inner);
    expect(rest.trim()).toBe('tail');
  });
});
