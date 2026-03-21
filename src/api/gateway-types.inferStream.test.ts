import { describe, expect, it } from 'vitest';
import { inferStreamPhaseHints } from './gateway-types';

describe('inferStreamPhaseHints', () => {
  it('returns empty hints for nullish', () => {
    expect(inferStreamPhaseHints(undefined)).toEqual({
      hasAssistantText: false,
      hasThinking: false,
      hasToolCalls: false,
    });
  });

  it('detects tool calls in content array', () => {
    const hints = inferStreamPhaseHints({
      content: [{ type: 'toolCall', name: 'read_file', arguments: { path: '/x' } }],
    });
    expect(hints.hasToolCalls).toBe(true);
    expect(hints.hasAssistantText).toBe(false);
  });

  it('detects assistant text and thinking in content array', () => {
    const hints = inferStreamPhaseHints({
      content: [
        { type: 'thinking', thinking: 'plan' },
        { type: 'text', text: 'Hello' },
      ],
    });
    expect(hints.hasThinking).toBe(true);
    expect(hints.hasAssistantText).toBe(true);
  });

  it('detects plain text on message.text', () => {
    expect(inferStreamPhaseHints({ text: 'Hi' }).hasAssistantText).toBe(true);
  });
});
