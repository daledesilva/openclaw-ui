import { describe, expect, it } from 'vitest';
import {
  nextActivityFromContentChunk,
  nextActivityFromDeltaHints,
  nextActivityFromReasoningChunk,
  phaseBubbleDisplayText,
} from './agentRunActivity';

describe('nextActivityFromDeltaHints', () => {
  it('prefers assistant text over tools', () => {
    expect(
      nextActivityFromDeltaHints('acting', {
        hasAssistantText: true,
        hasToolCalls: true,
        hasThinking: true,
      })
    ).toBe('responding');
  });

  it('does not change idle or stale', () => {
    const hints = { hasAssistantText: true, hasToolCalls: true, hasThinking: true };
    expect(nextActivityFromDeltaHints('idle', hints)).toBe('idle');
    expect(nextActivityFromDeltaHints('stale', hints)).toBe('stale');
  });

  it('moves pending to acting when only tools', () => {
    expect(
      nextActivityFromDeltaHints('pending', {
        hasAssistantText: false,
        hasToolCalls: true,
        hasThinking: false,
      })
    ).toBe('acting');
  });
});

describe('nextActivityFromReasoningChunk', () => {
  it('does not downgrade from responding', () => {
    expect(nextActivityFromReasoningChunk('responding')).toBe('responding');
  });

  it('promotes pending to reasoning', () => {
    expect(nextActivityFromReasoningChunk('pending')).toBe('reasoning');
  });
});

describe('nextActivityFromContentChunk', () => {
  it('sets responding from pending', () => {
    expect(nextActivityFromContentChunk('pending')).toBe('responding');
  });
});

describe('phaseBubbleDisplayText', () => {
  it('returns empty for pending', () => {
    expect(phaseBubbleDisplayText('pending', 'x', 'tool')).toBe('');
  });

  it('shows last tool summary when acting', () => {
    expect(phaseBubbleDisplayText('acting', '', 'read_file(/a)')).toBe('read_file(/a)');
  });

  it('shows stale copy', () => {
    expect(phaseBubbleDisplayText('stale', '', null)).toContain('No response');
  });
});
