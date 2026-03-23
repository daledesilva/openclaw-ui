import type { GatewaySessionTokenStats } from '../api/gatewaySessionsList';
import { displayTotalTokens } from '../api/gatewaySessionsList';
import {
  MOCK_ALL_BUBBLES_SESSION_KEY,
  MOCK_ALL_BUBBLES_THREAD_LABEL,
} from '../mocks/mockChatHistory/mockAllBubblesRawHistoryItems';

/** Persisted chat threads (gateway `sessionKey` per conversation). */
export const CHAT_THREADS_STORAGE_KEY = 'openclaw-ui-chat-threads-v1';

const LEGACY_WEBCHAT_SESSION_KEY = 'openclaw-ui-session-key';

export type ChatThreadRecord = {
  threadId: string;
  label: string;
  sessionKey: string;
  updatedAt: number;
  /** Filled when the thread was last active; used in the sidebar for non-active threads. */
  cachedMessageCount?: number;
  /** Last known total from gateway `sessions.list` (for sidebar when thread is inactive). */
  cachedGatewayTotalTokens?: number;
  /** @deprecated No longer written; kept for older localStorage payloads. */
  cachedApproxTextCharacters?: number;
};

export type ChatThreadsSnapshot = {
  version: 1;
  threads: ChatThreadRecord[];
  activeThreadId: string;
};

export function generateWebchatSessionKey(): string {
  return `webchat-${crypto.randomUUID()}`;
}

function pinnedSessionKeyFromEnv(): string | null {
  const fromEnv = import.meta.env.VITE_OPENCLAW_SESSION_KEY?.trim();
  return fromEnv || null;
}

export function createDefaultChatThreadsSnapshot(options?: {
  /** Override env / default session key (for tests). */
  initialSessionKey?: string;
}): ChatThreadsSnapshot {
  const sessionKey = options?.initialSessionKey ?? pinnedSessionKeyFromEnv() ?? 'main';
  const thread: ChatThreadRecord = {
    threadId: crypto.randomUUID(),
    label: 'Chat 1',
    sessionKey,
    updatedAt: Date.now(),
  };
  return { version: 1, threads: [thread], activeThreadId: thread.threadId };
}

export function normalizeChatThreadsSnapshot(snapshot: ChatThreadsSnapshot): ChatThreadsSnapshot {
  if (!snapshot.threads.length) {
    return createDefaultChatThreadsSnapshot();
  }
  const exists = snapshot.threads.some((t) => t.threadId === snapshot.activeThreadId);
  if (!exists) {
    return { ...snapshot, activeThreadId: snapshot.threads[0].threadId };
  }
  return snapshot;
}

export function persistChatThreadsSnapshot(snapshot: ChatThreadsSnapshot): void {
  try {
    localStorage.setItem(CHAT_THREADS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota or disabled */
  }
}

function tryMigrateFromLegacyWebchatKey(): ChatThreadsSnapshot | null {
  try {
    const legacy = localStorage.getItem(LEGACY_WEBCHAT_SESSION_KEY);
    if (!legacy?.trim()) return null;
    const thread: ChatThreadRecord = {
      threadId: crypto.randomUUID(),
      label: 'Chat 1',
      sessionKey: legacy.trim(),
      updatedAt: Date.now(),
    };
    const snap: ChatThreadsSnapshot = { version: 1, threads: [thread], activeThreadId: thread.threadId };
    persistChatThreadsSnapshot(snap);
    localStorage.removeItem(LEGACY_WEBCHAT_SESSION_KEY);
    return snap;
  } catch {
    return null;
  }
}

/**
 * When `VITE_OPENCLAW_SESSION_KEY` is set, the gateway session is fixed: keep a single thread using that key.
 * @param pinnedSessionKeyOverride — for tests; when set, replaces the env-derived pin (omit to use `import.meta.env`).
 */
export function collapseThreadsSnapshotForPinnedSessionKey(
  snapshot: ChatThreadsSnapshot,
  pinnedSessionKeyOverride?: string | null
): ChatThreadsSnapshot {
  const pinned =
    pinnedSessionKeyOverride !== undefined ? pinnedSessionKeyOverride || null : pinnedSessionKeyFromEnv();
  if (!pinned) return snapshot;
  const first = snapshot.threads[0];
  const base: ChatThreadRecord = first
    ? { ...first, sessionKey: pinned, updatedAt: Date.now() }
    : {
        threadId: crypto.randomUUID(),
        label: 'Chat 1',
        sessionKey: pinned,
        updatedAt: Date.now(),
      };
  return normalizeChatThreadsSnapshot({
    version: 1,
    threads: [base],
    activeThreadId: base.threadId,
  });
}

/** Load threads from `localStorage`, migrate legacy `openclaw-ui-session-key` once, or create defaults. */
export function loadChatThreadsFromStorage(): ChatThreadsSnapshot {
  let snapshot: ChatThreadsSnapshot | null = null;
  let usedFreshSnapshot = false;

  try {
    const raw = localStorage.getItem(CHAT_THREADS_STORAGE_KEY);
    if (raw?.trim()) {
      const parsed = JSON.parse(raw) as ChatThreadsSnapshot;
      if (parsed.version === 1 && Array.isArray(parsed.threads) && parsed.threads.length > 0) {
        snapshot = collapseThreadsSnapshotForPinnedSessionKey(normalizeChatThreadsSnapshot(parsed));
      }
    }
  } catch {
    /* fall through */
  }

  if (!snapshot) {
    const migrated = tryMigrateFromLegacyWebchatKey();
    if (migrated) snapshot = collapseThreadsSnapshotForPinnedSessionKey(migrated);
  }

  if (!snapshot) {
    snapshot = createDefaultChatThreadsSnapshot();
    usedFreshSnapshot = true;
    persistChatThreadsSnapshot(snapshot);
  }

  const shouldSeedMockThread = import.meta.env.DEV && !pinnedSessionKeyFromEnv();
  if (shouldSeedMockThread) {
    const hasMockThread = snapshot.threads.some((t) => t.sessionKey === MOCK_ALL_BUBBLES_SESSION_KEY);
    if (!hasMockThread) {
      const originalActiveThreadId = snapshot.activeThreadId;
      const next = addThreadToSnapshot(snapshot, MOCK_ALL_BUBBLES_THREAD_LABEL, MOCK_ALL_BUBBLES_SESSION_KEY);
      const out = usedFreshSnapshot ? next : { ...next, activeThreadId: originalActiveThreadId };
      persistChatThreadsSnapshot(out);
      return out;
    }
  }

  return snapshot;
}

export function addThreadToSnapshot(
  snapshot: ChatThreadsSnapshot,
  label: string,
  sessionKey: string
): ChatThreadsSnapshot {
  const thread: ChatThreadRecord = {
    threadId: crypto.randomUUID(),
    label,
    sessionKey,
    updatedAt: Date.now(),
  };
  return normalizeChatThreadsSnapshot({
    ...snapshot,
    threads: [thread, ...snapshot.threads],
    activeThreadId: thread.threadId,
  });
}

export function setActiveThreadInSnapshot(
  snapshot: ChatThreadsSnapshot,
  activeThreadId: string
): ChatThreadsSnapshot {
  const exists = snapshot.threads.some((t) => t.threadId === activeThreadId);
  if (!exists) return snapshot;
  return { ...snapshot, activeThreadId };
}

export function touchThreadInSnapshot(snapshot: ChatThreadsSnapshot, threadId: string): ChatThreadsSnapshot {
  const now = Date.now();
  return {
    ...snapshot,
    threads: snapshot.threads.map((t) => (t.threadId === threadId ? { ...t, updatedAt: now } : t)),
  };
}

export function nextThreadLabel(snapshot: ChatThreadsSnapshot): string {
  const n = snapshot.threads.length + 1;
  return `Chat ${n}`;
}

export function updateThreadCachedMessageCountInSnapshot(
  snapshot: ChatThreadsSnapshot,
  threadId: string,
  cachedMessageCount: number
): ChatThreadsSnapshot {
  return {
    ...snapshot,
    threads: snapshot.threads.map((t) =>
      t.threadId === threadId ? { ...t, cachedMessageCount } : t
    ),
  };
}

/** Merge gateway token totals into threads whose `sessionKey` appears in the map. */
export function updateThreadCachedGatewayTokensInSnapshot(
  snapshot: ChatThreadsSnapshot,
  tokensBySessionKey: Record<string, GatewaySessionTokenStats>
): ChatThreadsSnapshot {
  return {
    ...snapshot,
    threads: snapshot.threads.map((t) => {
      const stats = tokensBySessionKey[t.sessionKey];
      const total = displayTotalTokens(stats);
      if (total === undefined) return t;
      return { ...t, cachedGatewayTotalTokens: total };
    }),
  };
}
