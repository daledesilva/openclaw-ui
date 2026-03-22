import { describe, expect, it } from 'vitest';
import { formatThoughtItemsForModal } from './ChainOfThoughtModal';

describe('formatThoughtItemsForModal', () => {
  it('joins tools and prose', () => {
    const text = formatThoughtItemsForModal(
      [
        { kind: 'toolHint', label: 'a()' },
        { kind: 'reasoningChunk', text: 'think' },
      ],
      'final prose'
    );
    expect(text).toContain('• a()');
    expect(text).toContain('think');
    expect(text).toContain('final prose');
  });
});
