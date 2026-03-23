import { describe, expect, it } from 'vitest';
import { parseFetchedHistoryIntoChatMessages } from './recentThoughtsReducer';
import { mapRawHistoryMessage } from '../api/gateway-types';
import { mockAllBubblesRawHistoryItems } from '../mocks/mockChatHistory/mockAllBubblesRawHistoryItems';

describe('recentThoughtsReducer helpers', () => {
  it('parseFetchedHistoryIntoChatMessages returns empty for empty input', () => {
    expect(parseFetchedHistoryIntoChatMessages([])).toEqual([]);
  });

  it('mock bubble fixture maps into user/message/error/abortion rows', () => {
    const mapped = mockAllBubblesRawHistoryItems.map((m) => mapRawHistoryMessage(m));
    const chatMessages = parseFetchedHistoryIntoChatMessages(mapped);

    // Toolresult rows are consumed into a thought buffer and should not appear as chat messages.
    expect(chatMessages).toHaveLength(4);

    const userRow = chatMessages.find((m) => m.role === 'user');
    expect(userRow).toBeDefined();

    const assistantMessages = chatMessages.filter((m) => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(3);

    const errorRow = assistantMessages.find((m) => m.kind === 'error');
    const abortedRow = assistantMessages.find((m) => m.kind === 'abortion');
    const successRow = assistantMessages.find((m) => m.kind === 'message');

    expect(errorRow).toBeDefined();
    expect(abortedRow).toBeDefined();
    expect(successRow).toBeDefined();

    expect(errorRow?.thoughtItems?.length).toBeGreaterThan(0);
    expect(abortedRow?.thoughtItems?.length).toBeGreaterThan(0);
  });
});
