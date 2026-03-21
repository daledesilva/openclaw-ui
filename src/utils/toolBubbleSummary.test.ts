import { describe, expect, it } from 'vitest';
import { summarizeToolCall, summarizeToolResult } from './toolBubbleSummary';

describe('summarizeToolResult', () => {
  it('returns Error when isError', () => {
    expect(summarizeToolResult({ isError: true, raw: {} })).toBe('Error');
  });

  it('uses error string when present', () => {
    expect(summarizeToolResult({ isError: true, raw: { error: 'Not found' } })).toBe('Not found');
  });

  it('summarizes non-empty arrays', () => {
    expect(summarizeToolResult({ raw: [{}, {}], toolName: 'list' })).toBe('2 items');
  });

  it('uses products label when tool name hints products', () => {
    expect(summarizeToolResult({ raw: [1, 2, 3], toolName: 'get_products' })).toBe('3 products found');
  });

  it('summarizes web search query', () => {
    expect(
      summarizeToolResult({
        toolName: 'web_search',
        raw: { query: 'tall upright freezer', provider: 'x' },
      })
    ).toContain('Search for');
    expect(
      summarizeToolResult({
        toolName: 'web_search',
        raw: { query: 'tall upright freezer', provider: 'x' },
      })
    ).toContain('freezer');
  });

  it('counts nested results array', () => {
    expect(summarizeToolResult({ raw: { results: [{ u: 1 }, { u: 2 }] }, toolName: 'x' })).toBe(
      '2 results'
    );
  });
});

describe('summarizeToolCall', () => {
  it('summarizes web_search with query in arguments', () => {
    expect(
      summarizeToolCall({
        name: 'web_search',
        argumentsPreview: '{"query":"abc"}',
        arguments: { query: 'hello world search' },
      })
    ).toContain('Search for');
  });

  it('falls back to name and preview', () => {
    expect(
      summarizeToolCall({
        name: 'read_file',
        argumentsPreview: '{"path":"/tmp/a"}',
      })
    ).toContain('read_file');
  });
});
