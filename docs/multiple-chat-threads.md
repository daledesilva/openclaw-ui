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
  UI -->|"chat.history / chat.send / sessions.list / usage.cost"| GW
```

- **Thread** — One UI row: label plus a stats line (message count, optional tokens / USD); the gateway `sessionKey` is stored for routing but not shown in the list. Not the same as OpenClaw **workspaces** (Telegram channels, CLI profiles, etc.); those are product concepts configured on the gateway. This app only controls which **`sessionKey`** is sent on the operator WebSocket.
- **Canonical vs short `sessionKey`** — The UI stores short keys for new web chats (e.g. `webchat-<uuid>`) and sends them on `chat.send` / `chat.history` (the gateway accepts them). `sessions.list` returns each row’s canonical **`key`** (e.g. `agent:main:webchat-<uuid>`). The client **aliases** token stats to both forms so lookups match. See [`openClawSessionSuffixFromCanonicalKey`](../src/api/gatewaySessionsList.ts).
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
| [`src/api/gateway.ts`](../src/api/gateway.ts) | `sendChatMessage(msg, { sessionKey })`, `fetchChatHistory(limit, sessionKeyOverride)`, `fetchGatewaySessionsList()` (`sessions.list`), `fetchGatewayUsageCost()` (`usage.cost`), `getActiveChatSessionKey` on `initGatewayConnection` for event routing. |
| [`src/api/gatewaySessionsList.ts`](../src/api/gatewaySessionsList.ts) | Parse `sessions.list` into token stats; **suffix aliasing** for `agent:<id>:…` keys; default agent id from list or **`health`** payload; optional `sessions.list` cost-probe logging (`VITE_OPENCLAW_DEBUG` or `VITE_OPENCLAW_SESSIONS_DEBUG` in dev). |
| [`src/api/gatewayUsageCost.ts`](../src/api/gatewayUsageCost.ts) | Defensive parse of `usage.cost` (aggregate + optional per-session map); merges unscoped + `sessionKey`-scoped responses; debug logging alongside sessions probe. |
| [`src/App.tsx`](../src/App.tsx) | Thin top bar (version, connection, chips, stats); drawer (mobile) / permanent sidebar (desktop); thread selection; stale history guard. Top bar stats show **message count**, **token totals** (`sessions.list`), and a **Gemini session total (~$X.XX)** for the **active chat only** (client-side per-turn usage × list-price table; [Gemini pricing estimates](./gemini-pricing-estimates.md)). Conversation **rows** may show **gateway `usage.cost`** when the payload includes a **per-session** figure. Cached token totals in `localStorage` for inactive threads. |

## Technical gotchas

- **Gateways that omit `sessionKey` on `chat` events** — The client cannot filter by session; avoid relying on multiple simultaneous in-flight runs across threads on such gateways.
- **Thread labels are local** — Row titles and ordering live in this browser’s `localStorage`. Token totals are refreshed from the gateway via **`sessions.list`**. Optional **USD on each conversation row** comes from **`usage.cost`** when the parser finds a **per-session** amount for that thread’s `sessionKey`; rows do not show a global aggregate. The **top bar** does **not** show gateway rollups; it shows a **client-side Gemini session total** (two decimals) for the visible transcript only ([Gemini pricing estimates](./gemini-pricing-estimates.md)). See [API usage & costs](https://docs.openclaw.ai/reference/api-usage-costs) and [Token use & costs](https://docs.openclaw.ai/reference/token-use).
- **`usage.cost` window vs header USD** — OpenClaw’s public docs describe **how** gateway dollar estimates are derived in [Token use & costs](https://docs.openclaw.ai/reference/token-use) (e.g. chat **`/usage cost`**, **`/usage full`**, **`/status`**) but do not document every WebSocket field. Gateways often return **`days`**, a **`daily`** array, and **`totals.totalCost`** as a **multi-day rollup**. A **`sessionKey`** parameter may still yield a **global rollup** if the server does not scope cost by session—this UI no longer surfaces that in the **header**; use gateway tools/docs for aggregate billing views. **Per-chat** header USD uses **client-side** aggregation from **`chat.history`** / live **`chat` finals (per-turn `usage` + model).
- **Gateways that omit `sessions.list` or return an unexpected shape** omit token counts in the header/sidebar until the RPC succeeds or the session appears in the list.
- **Operator naming** — Prefer **conversation** / **`sessionKey`** in UI copy; reserve **workspace** for gateway docs and multi-channel setup ([configuration reference](https://docs.openclaw.ai/gateway/configuration-reference)).

## Related documentation

- [New chat session](new-chat-session.md) — history of session rotation and env pin.
- [Agent run phase](agent-run-phase.md) — new conversation disabled while a run blocks input.
