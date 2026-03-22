import { describe, expect, it } from 'vitest';
import type { Message } from '../chatThreadTypes';
import { computeThreadConversationStats } from './conversationStats';

describe('computeThreadConversationStats', () => {
  it('counts messages and sums content length', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'hello' },
      { id: '2', role: 'ai', kind: 'assistant', content: 'world' },
    ];
    expect(computeThreadConversationStats(messages)).toEqual({
      messageCount: 2,
      textCharacterCount: 10,
    });
  });

  it('includes reasoning and reasoningTrace text', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'ai',
        kind: 'reasoningTrace',
        content: '',
        thoughtItems: [{ kind: 'toolHint', label: 'read' }],
        proseReasoning: 'thinking',
      },
      { id: '2', role: 'ai', kind: 'assistant', content: 'ok', reasoning: 'because' },
    ];
    const { textCharacterCount } = computeThreadConversationStats(messages);
    expect(textCharacterCount).toBe('read'.length + 'thinking'.length + 'ok'.length + 'because'.length);
  });

  it('omits trailing empty assistant row when requested', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'hi' },
      { id: '2', role: 'ai', kind: 'assistant', content: '' },
    ];
    expect(
      computeThreadConversationStats(messages, { omitTrailingEmptyAssistantPlaceholder: true })
    ).toEqual({ messageCount: 1, textCharacterCount: 2 });
  });
});
