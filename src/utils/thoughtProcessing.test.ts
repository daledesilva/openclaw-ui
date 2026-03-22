import { describe, expect, it } from 'vitest';
import { deriveRecentToolSummaryLine } from './thoughtProcessing';

describe('deriveRecentToolSummaryLine', () => {
  it('returns null for empty items', () => {
    expect(deriveRecentToolSummaryLine([])).toBeNull();
  });

  it('returns the last tool hint or result scanning from the end', () => {
    expect(
      deriveRecentToolSummaryLine([
        { kind: 'toolHint', label: 'a()' },
        { kind: 'reasoningChunk', text: 'x' },
        { kind: 'toolResult', summary: 'done' },
      ])
    ).toBe('done');
    expect(deriveRecentToolSummaryLine([{ kind: 'reasoningChunk', text: 'x' }, { kind: 'toolHint', label: 'b()' }])).toBe(
      'b()'
    );
  });
});
