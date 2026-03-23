import type { RawHistoryItem } from '../../api/gateway-types';

/**
 * Stable session key used by:
 * - `src/utils/chatThreadsStorage.ts` localStorage seeding
 * - `src/api/gateway.ts` `fetchChatHistory` mock routing
 */
export const MOCK_ALL_BUBBLES_SESSION_KEY = 'mock-all-bubbles-session-v1';

export const MOCK_ALL_BUBBLES_THREAD_LABEL = 'Mock bubbles';

/**
 * Raw history items (pre-normalization) intended to exercise all bubble render paths in `src/App.tsx`:
 * - `UserChatBubble` via `role: "user"`
 * - `AgentChatBubble` via `role: "assistant"` with normal content
 * - `AssistantErrorChatBubble` via `role: "assistant"` + `errorMessage` with empty `content`
 * - `AssistantAbortedChatBubble` via `role: "assistant"` + `stopReason: "aborted"`
 *
 * Note on "thoughtItems": `parseHistoryIntoChatMessages` builds thought buffer from
 * preceding `role: "toolresult"` rows, then attaches it to the next assistant row.
 */
export const mockAllBubblesRawHistoryItems: RawHistoryItem[] = [
  {
    role: 'user',
    content: 'Show me all bubble types in this UI.',
    timestamp: Date.now() - 60_000,
  },
  {
    role: 'toolresult',
    toolName: 'statusCheck',
    content: { ok: true, stage: 'pre-run' },
    timestamp: Date.now() - 55_000,
  },
  {
    role: 'assistant',
    content: 'This is a normal assistant response bubble.',
    timestamp: Date.now() - 50_000,
  },
  {
    role: 'toolresult',
    toolName: 'maybeWebSearch',
    content: { query: 'status', results: [] },
    timestamp: Date.now() - 45_000,
  },
  {
    role: 'assistant',
    // Error bubble detection uses:
    // - `errorMessage` being present
    // - parsed assistant `content` being empty
    // - parsed toolLines/toolCalls being empty
    content: '',
    errorMessage: '503 {"type":"error","error":{"message":"Upstream timeout while generating the response"}}',
    timestamp: Date.now() - 40_000,
    model: 'gemini-mock-model',
  },
  {
    role: 'toolresult',
    toolName: 'cancelSignal',
    content: { reason: 'user_cancelled' },
    timestamp: Date.now() - 35_000,
  },
  {
    role: 'assistant',
    content: 'Request aborted. The run was cancelled before completion.',
    timestamp: Date.now() - 30_000,
    stopReason: 'aborted',
  },
];

