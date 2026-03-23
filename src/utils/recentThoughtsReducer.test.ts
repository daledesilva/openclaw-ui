import { describe, expect, it } from 'vitest';
import { parseFetchedHistoryIntoChatMessages } from './recentThoughtsReducer';

describe('recentThoughtsReducer helpers', () => {
  it('parseFetchedHistoryIntoChatMessages returns empty for empty input', () => {
    expect(parseFetchedHistoryIntoChatMessages([])).toEqual([]);
  });
});
