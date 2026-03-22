import { describe, expect, it, vi } from 'vitest';
import {
  addThreadToSnapshot,
  collapseThreadsSnapshotForPinnedSessionKey,
  normalizeChatThreadsSnapshot,
  setActiveThreadInSnapshot,
  touchThreadInSnapshot,
  updateThreadCachedGatewayTokensInSnapshot,
  updateThreadCachedMessageCountInSnapshot,
  type ChatThreadRecord,
  type ChatThreadsSnapshot,
} from './chatThreadsStorage';

function thread(partial: Partial<ChatThreadRecord> & Pick<ChatThreadRecord, 'threadId'>): ChatThreadRecord {
  return {
    label: 'Chat',
    sessionKey: 'main',
    updatedAt: 1,
    ...partial,
  };
}

describe('normalizeChatThreadsSnapshot', () => {
  it('points activeThreadId at first thread when missing', () => {
    const snap = normalizeChatThreadsSnapshot({
      version: 1,
      threads: [thread({ threadId: 'a' })],
      activeThreadId: 'ghost',
    });
    expect(snap.activeThreadId).toBe('a');
  });
});

describe('setActiveThreadInSnapshot', () => {
  it('no-ops when thread id is unknown', () => {
    const base: ChatThreadsSnapshot = {
      version: 1,
      threads: [thread({ threadId: 'a' })],
      activeThreadId: 'a',
    };
    expect(setActiveThreadInSnapshot(base, 'x')).toEqual(base);
  });

  it('updates active thread when id exists', () => {
    const base: ChatThreadsSnapshot = {
      version: 1,
      threads: [thread({ threadId: 'a' }), thread({ threadId: 'b', sessionKey: 'other' })],
      activeThreadId: 'a',
    };
    const next = setActiveThreadInSnapshot(base, 'b');
    expect(next.activeThreadId).toBe('b');
  });
});

describe('addThreadToSnapshot', () => {
  it('prepends thread and activates it', () => {
    const base: ChatThreadsSnapshot = {
      version: 1,
      threads: [thread({ threadId: 'old', label: 'Old' })],
      activeThreadId: 'old',
    };
    const next = addThreadToSnapshot(base, 'New', 'webchat-1');
    expect(next.activeThreadId).not.toBe('old');
    expect(next.threads[0].sessionKey).toBe('webchat-1');
    expect(next.threads[0].label).toBe('New');
    expect(next.threads.some((t) => t.threadId === 'old')).toBe(true);
  });
});

describe('updateThreadCachedMessageCountInSnapshot', () => {
  it('updates only the matching thread', () => {
    const base: ChatThreadsSnapshot = {
      version: 1,
      threads: [thread({ threadId: 'a' }), thread({ threadId: 'b' })],
      activeThreadId: 'a',
    };
    const next = updateThreadCachedMessageCountInSnapshot(base, 'b', 9);
    expect(next.threads.find((t) => t.threadId === 'a')).not.toHaveProperty('cachedMessageCount');
    expect(next.threads.find((t) => t.threadId === 'b')).toMatchObject({
      cachedMessageCount: 9,
    });
  });
});

describe('updateThreadCachedGatewayTokensInSnapshot', () => {
  it('sets cachedGatewayTotalTokens from session key map', () => {
    const base: ChatThreadsSnapshot = {
      version: 1,
      threads: [
        thread({ threadId: 'a', sessionKey: 'sk1' }),
        thread({ threadId: 'b', sessionKey: 'sk2' }),
      ],
      activeThreadId: 'a',
    };
    const next = updateThreadCachedGatewayTokensInSnapshot(base, {
      sk1: { totalTokens: 100 },
      sk2: { inputTokens: 5, outputTokens: 5 },
    });
    expect(next.threads.find((t) => t.threadId === 'a')?.cachedGatewayTotalTokens).toBe(100);
    expect(next.threads.find((t) => t.threadId === 'b')?.cachedGatewayTotalTokens).toBe(10);
  });
});

describe('touchThreadInSnapshot', () => {
  it('bumps updatedAt for matching thread', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const base: ChatThreadsSnapshot = {
      version: 1,
      threads: [thread({ threadId: 'a', updatedAt: 1 }), thread({ threadId: 'b', updatedAt: 2 })],
      activeThreadId: 'a',
    };
    vi.setSystemTime(9999);
    const next = touchThreadInSnapshot(base, 'b');
    expect(next.threads.find((t) => t.threadId === 'b')?.updatedAt).toBe(9999);
    expect(next.threads.find((t) => t.threadId === 'a')?.updatedAt).toBe(1);
    vi.useRealTimers();
  });
});

describe('collapseThreadsSnapshotForPinnedSessionKey', () => {
  it('returns snapshot unchanged when pin is null (override)', () => {
    const snap: ChatThreadsSnapshot = {
      version: 1,
      threads: [
        thread({ threadId: 'a', sessionKey: 'k1' }),
        thread({ threadId: 'b', sessionKey: 'k2' }),
      ],
      activeThreadId: 'b',
    };
    expect(collapseThreadsSnapshotForPinnedSessionKey(snap, null)).toEqual(snap);
  });

  it('collapses to one thread using pinned key when override is non-empty', () => {
    const snap: ChatThreadsSnapshot = {
      version: 1,
      threads: [
        thread({ threadId: 'a', sessionKey: 'k1', label: 'First' }),
        thread({ threadId: 'b', sessionKey: 'k2' }),
      ],
      activeThreadId: 'b',
    };
    const out = collapseThreadsSnapshotForPinnedSessionKey(snap, 'pinned-key');
    expect(out.threads).toHaveLength(1);
    expect(out.threads[0].sessionKey).toBe('pinned-key');
    expect(out.activeThreadId).toBe(out.threads[0].threadId);
  });
});
