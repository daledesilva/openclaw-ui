import { describe, expect, it } from 'vitest';
import { mapRawHistoryMessage, parseContentParts } from './gateway-types';

describe('parseContentParts plain object tool payloads', () => {
  it('extracts link previews from web search JSON object', () => {
    const content = {
      organic_results: [{ link: 'https://a.com', title: 'A' }],
    };
    const parsed = parseContentParts(content);
    expect(parsed.linkPreviews).toEqual([{ url: 'https://a.com', title: 'A' }]);
    expect(parsed.body).toBe('');
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
