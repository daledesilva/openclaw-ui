import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../chatThreadTypes';
import { computeThreadConversationStats, computeThreadMessageCount } from './conversationStats';

describe('computeThreadConversationStats', () => {
  it('counts messages and sums content length', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'ai', content: 'world' },
    ];
    expect(computeThreadConversationStats(messages)).toEqual({
      messageCount: 2,
      textCharacterCount: 10,
    });
  });

  it('includes reasoning and reasoningTrace text', () => {
    const messages: ChatMessage[] = [
      {
        role: 'ai',
        content: '',
        thoughtItems: [{ kind: 'toolCall', toolName: 'read', content: '' }],
        proseReasoning: 'thinking',
      },
      { role: 'ai', content: 'ok', reasoning: 'because' },
    ];
    const { textCharacterCount } = computeThreadConversationStats(messages);
    expect(textCharacterCount).toBe('read'.length + 'thinking'.length + 'ok'.length + 'because'.length);
  });

  it('omits trailing empty assistant row when requested', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'ai', content: '' },
    ];
    expect(
      computeThreadConversationStats(messages, { omitTrailingEmptyAssistantPlaceholder: true })
    ).toEqual({ messageCount: 1, textCharacterCount: 2 });
  });
});

describe('computeThreadMessageCount', () => {
  it('matches messageCount from computeThreadConversationStats', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'ai', content: 'world' },
    ];
    expect(computeThreadMessageCount(messages)).toBe(
      computeThreadConversationStats(messages).messageCount
    );
  });
});
