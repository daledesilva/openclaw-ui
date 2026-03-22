# Multiple chat threads (per `sessionKey`)

## Why it exists

Operators often need **more than one isolated conversation** with the gateway without opening extra browser profiles. The gateway already partitions transcripts and live traffic by **`sessionKey`**; this UI keeps a **thread list** so each row maps to its own key and history.

## Conceptual model

```mermaid
flowchart LR
  subgraph browser [Browser]
    LS["localStorage threads"]
    UI[Thread list + chat pane]
  end
  GW[Gateway]
  LS <--> UI
  UI -->|"chat.history / chat.send per sessionKey"| GW
```

- **Thread** — One UI row: label, gateway `sessionKey`, `updatedAt`. Not the same as OpenClaw **workspaces** (Telegram channels, CLI profiles, etc.); those are product concepts configured on the gateway. This app only controls which **`sessionKey`** is sent on the operator WebSocket.
- **Active thread** — Drives `chat.send`, `chat.history`, and which incoming **`chat` events** are applied (see below).

## Flows

### Load and migrate

1. On first load, the app reads **`openclaw-ui-chat-threads-v1`** from `localStorage`.
2. If that key is missing but the legacy **`openclaw-ui-session-key`** exists, the app **migrates** to a single thread and removes the legacy key.
3. If neither exists, the app creates **Chat 1** with `sessionKey` **`main`** unless **`VITE_OPENCLAW_SESSION_KEY`** is set (build-pinned key).

### Switch thread

1. User selects another thread (drawer / sidebar).
2. UI sets the active `sessionKey`, clears in-flight transcript state, and calls **`chat.history`** for that key.
3. A generation counter drops **stale** history responses if the user switches again before the request completes.
4. Incoming WebSocket **`chat` events** include `sessionKey` when the gateway sends it; the client **ignores** events whose key does not match the active thread so background sessions cannot corrupt the visible pane.

### New conversation

**New conversation** (speech-bubble-plus icon in the Conversations panel header) appends a thread with a fresh `webchat-<uuid>` key, activates it, and loads history (typically empty). Older threads remain in the list.

### Build-pinned session

When **`VITE_OPENCLAW_SESSION_KEY`** is set, the gateway session is fixed. The UI **collapses** to a single thread using that key and **disables** the Conversations header **New conversation** control—same constraint as before multi-thread support.

## Technical details

| Piece | Role |
| --- | --- |
| [`src/utils/chatThreadsStorage.ts`](../src/utils/chatThreadsStorage.ts) | Snapshot shape (`version`, `threads`, `activeThreadId`), persist, migrate, helpers. |
| [`src/api/gateway.ts`](../src/api/gateway.ts) | `sendChatMessage(msg, { sessionKey })`, `fetchChatHistory(limit, sessionKeyOverride)`, `getActiveChatSessionKey` on `initGatewayConnection` for event routing. |
| [`src/App.tsx`](../src/App.tsx) | Thin top bar (version, connection, chips, stats); drawer (mobile) / permanent sidebar (desktop); thread selection; stale history guard. Top bar and each sidebar row show **message count** and **approximate character total** (transcript text only—not tokens). |

## Technical gotchas

- **Gateways that omit `sessionKey` on `chat` events** — The client cannot filter by session; avoid relying on multiple simultaneous in-flight runs across threads on such gateways.
- **No server-side thread list** — Threads exist only in this browser’s `localStorage` unless the gateway later exposes session enumeration.
- **Operator naming** — Prefer **conversation** / **`sessionKey`** in UI copy; reserve **workspace** for gateway docs and multi-channel setup ([configuration reference](https://docs.openclaw.ai/gateway/configuration-reference)).

## Related documentation

- [New chat session](new-chat-session.md) — history of session rotation and env pin.
- [Agent run phase](agent-run-phase.md) — new conversation disabled while a run blocks input.
