import { describe, expect, it } from 'vitest';
import { deriveRecentToolSummaryLine } from './thoughtProcessing';

describe('deriveRecentToolSummaryLine', () => {
  it('returns null for empty items', () => {
    expect(deriveRecentToolSummaryLine([])).toBeNull();
  });

  it('returns the last tool hint or result scanning from the end', () => {
    expect(
      deriveRecentToolSummaryLine([
        { kind: 'toolCall', toolName: 'a', content: '' },
        { kind: 'internalMonologue', thought: 'x' },
        { kind: 'toolCall', toolName: 't', content: 'done' },
      ])
    ).toBe('done');
    expect(
      deriveRecentToolSummaryLine([
        { kind: 'internalMonologue', thought: 'x' },
        { kind: 'toolCall', toolName: 'b', content: 'b()' },
      ])
    ).toBe('b()');
  });
});
