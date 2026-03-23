import { describe, expect, it } from 'vitest';
import { formatThoughtItemsForModal } from './ChainOfThoughtModal';

describe('formatThoughtItemsForModal', () => {
  it('joins tools and prose', () => {
    const text = formatThoughtItemsForModal(
      [
        { kind: 'toolCall', toolName: 'a', content: '' },
        { kind: 'internalMonologue', thought: 'think' },
      ],
      'final prose'
    );
    expect(text).toContain('• a()');
    expect(text).toContain('think');
    expect(text).toContain('final prose');
  });
});
