import { describe, expect, it } from 'vitest';
import {
  lastToolSummaryFromStreamMessage,
  summarizeToolCall,
  summarizeToolResult,
  toolHintFromAgentStreamData,
} from './toolBubbleSummary';

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

describe('lastToolSummaryFromStreamMessage', () => {
  it('returns null when no tools', () => {
    expect(lastToolSummaryFromStreamMessage({ content: [{ type: 'text', text: 'Hi' }] })).toBeNull();
  });

  it('returns summary for last toolCall in content array', () => {
    const summary = lastToolSummaryFromStreamMessage({
      content: [
        { type: 'toolCall', name: 'a', arguments: {} },
        { type: 'toolCall', name: 'read_file', arguments: { path: '/x' } },
      ],
    });
    expect(summary).toBeTruthy();
    expect(summary).toContain('read_file');
  });

  it('parses JSON array in message.text for toolCall parts', () => {
    const text = JSON.stringify([
      { type: 'toolCall', name: 'read_file', arguments: { path: '/y' } },
    ]);
    const summary = lastToolSummaryFromStreamMessage({ text });
    expect(summary).toBeTruthy();
    expect(summary).toContain('read_file');
  });

  it('returns null for plain message.text without JSON tools', () => {
    expect(lastToolSummaryFromStreamMessage({ text: 'hello' })).toBeNull();
  });
});

describe('toolHintFromAgentStreamData', () => {
  it('returns null for reasoning-shaped payload', () => {
    expect(toolHintFromAgentStreamData({ text: 'thinking…' })).toBeNull();
  });

  it('reads nested toolCall', () => {
    const hint = toolHintFromAgentStreamData({
      toolCall: { name: 'list_dir', arguments: { path: '/tmp' } },
    });
    expect(hint).toBeTruthy();
    expect(hint).toContain('list_dir');
  });

  it('reads top-level name + arguments', () => {
    const hint = toolHintFromAgentStreamData({ name: 'web_search', arguments: { query: 'cats' } });
    expect(hint).toBeTruthy();
    expect(hint).toContain('Search for');
  });
});
