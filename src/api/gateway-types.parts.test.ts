import { describe, expect, it } from 'vitest';
import { mapRawHistoryMessage, parseContentParts } from './gateway-types';

describe('parseContentParts plain object tool payloads', () => {
  it('treats web search JSON object as non-body payload (no visible text)', () => {
    const content = {
      organic_results: [{ link: 'https://a.com', title: 'A' }],
    };
    const parsed = parseContentParts(content);
    expect(parsed.body).toBe('');
    expect(parsed.toolCalls).toEqual([]);
  });
});

describe('mapRawHistoryMessage toolresult + object content', () => {
  it('preserves raw payload for toolresult rows', () => {
    const payload = {
      results: [{ url: 'https://u.test', title: 'U' }],
    };
    const row = mapRawHistoryMessage({
      role: 'toolresult',
      toolName: 'web_search',
      content: payload,
    });
    expect(row.toolRawPayload).toEqual(payload);
    expect(row.content).toBe('');
    expect(row.toolName).toBe('web_search');
  });

  it('preserves Gemini web_search envelope on toolresult', () => {
    const payload = {
      query: 'test',
      externalContent: { source: 'web_search', provider: 'gemini' },
      content:
        '<<<EXTERNAL_UNTRUSTED_CONTENT id="i">>>\n[Doc](https://doc.example/a)\n<<</EXTERNAL_UNTRUSTED_CONTENT>>>',
    };
    const row = mapRawHistoryMessage({
      role: 'toolresult',
      toolName: 'web_search',
      content: payload,
    });
    expect(row.toolRawPayload).toEqual(payload);
    expect(row.content).toBe('');
  });
});
