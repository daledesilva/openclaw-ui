# Chain of thought in the UI

## Why it exists

The gateway can stream model **reasoning** separately from the main answer, and chat **deltas** can carry **tool** metadata. Operators need a compact thread view: answer text in the main assistant bubble, with a single inline affordance to open the full trace, plus a dismissible **modal** that reads like a small secondary thread.

## Conceptual model

- **`recentThoughts` buffer (live):** While a run is in progress, `App.tsx` appends **non-answer** signals to a ref-backed list (`ThoughtItem[]`): reasoning stream chunks (`onReasoning`), tool labels from `onChatDelta` / `onAgentStreamToolHint`, and (on history replay) tool results. **Answer body text** still streams only via `onContent` into the last assistant bubble.
- **Flush on final:** When `onAssistantFinal` fires, if the buffer is non-empty **or** the final payload carries **prose reasoning** (`parseAssistantDisplayPayload` thinking), the UI inserts a **`reasoningTrace`** message **immediately above** the streaming assistant slot, then merges the final display payload into that assistant bubble. The buffer is cleared (and again on `aborted` / `error` / disconnect / new send).
- **Live overflow:** `activeReasoning` still mirrors streamed reasoning for the header brain icon and the in-run phase bubble; completed turns expose the same structured data via the **`reasoningTrace`** row (**View Thought Process** → modal). Opening the modal while a run is in flight prefers a **snapshot** of `recentThoughtsRef` when non-empty, otherwise plain `activeReasoning`.
- **Gateway `thinking` vs UI `reasoning`:** Raw history uses content parts with `type: "thinking"`. [`parseContentParts`](src/api/gateway-types.ts) aggregates those into a string field named **`reasoning`** on [`FetchedChatMessage`](src/api/gateway-types.ts) and on live `parseAssistantDisplayPayload` output. That rename is UI-side normalization, not a second gateway event type.
- **History fold:** [`foldFetchedHistoryToMessages`](src/utils/recentThoughtsReducer.ts) walks `chat.history` in order. For each assistant row it appends tool hints, tool results (from prior `toolresult` rows), and **`reasoning`** text as **`reasoningChunk`** items into one buffer. It emits a **`reasoningTrace`** **only immediately before** an assistant row that **displays to the user**—non-empty body text, link previews, images, or an error ([`assistantHistoryRowDisplaysToUser`](src/utils/recentThoughtsReducer.ts)). Thinking-only or tool-only assistant rows do **not** flush by themselves (avoids double trace bubbles). If the transcript ends with a non-empty buffer and no such row, a final orphan **`reasoningTrace`** is emitted. **`toolresult`** rows only extend the buffer (no separate tool bubbles in the main thread).

## Flow

```mermaid
sequenceDiagram
  participant GW as Gateway
  participant API as gateway.ts
  participant UI as App.tsx
  participant R as recentThoughtsReducer

  GW->>API: event chat state delta
  API->>UI: onReasoning / onChatDelta / onAgentStreamToolHint
  UI->>UI: append ThoughtItem to recentThoughtsRef
  API->>UI: onContent answer chunks
  UI->>UI: append text to last assistant bubble
  GW->>API: event chat state final
  API->>UI: onAssistantFinal
  UI->>R: applyAssistantFinalWithThoughtBuffer
  R->>UI: insert reasoningTrace then merge assistant
  API->>UI: onChatTerminal
  UI->>UI: clear recentThoughtsRef
```

```mermaid
flowchart TB
  subgraph thread [Main thread]
    TraceRow[reasoningTrace row]
    TraceRow --> Btn[View Thought Process]
  end
  Btn --> Modal[ChainOfThoughtModal]
  Modal --> Bubbles[Scrollable gray bubbles per tool result thought summary]
```

## Technical details

- **Types:** `src/chatThreadTypes.ts` — `Message`, `ThoughtItem`, `kind: 'reasoningTrace'`.
- **Reducer:** `src/utils/recentThoughtsReducer.ts` — `appendThoughtItem` (dedupes consecutive identical tool hints), `assistantHistoryRowDisplaysToUser`, `applyAssistantFinalWithThoughtBuffer`, `foldFetchedHistoryToMessages`, `formatThoughtItemsForModal` (string export / tests), `thoughtItemsToModalSegments` (merges adjacent `reasoningChunk` for modal rows), `findLastHistoricalChainOfThought` (header / history open).
- **Inline UI:** `src/components/ReasoningTraceBubble.tsx` — **View Thought Process** only; no inline tool or thinking text.
- **Modal:** `src/components/ChainOfThoughtModal.tsx` — `content` is either `{ mode: 'structured', thoughtItems, proseReasoning? }` or `{ mode: 'plain', text }` (legacy assistant `reasoning`). Renders `ThoughtProcessModalSegment` rows as small gray bubbles; `sanitizeDisplayText` on each segment body.
- **Triggers:** Header brain icon when `activeReasoning` is non-empty or `findLastHistoricalChainOfThought(messages)` is non-null; trace row button; in-run phase bubble (`phaseBubbleDisplayText` — see [Agent run phase](agent-run-phase.md)); assistant **View reasoning** when `Message.reasoning` is set on older rows.

## Technical gotchas

- **`onAssistantFinal` and `onChatTerminal`** may run in the same tick; the buffer is cleared inside the `setMessages` callback for final, then again on terminal — idempotent.
- **Prose-only final:** If the buffer is empty but `payload.reasoning` is non-empty, a trace bubble is still inserted (the button still opens modal content that includes that prose segment).
- **Modal + mobile:** Dialog content uses bottom padding with `env(safe-area-inset-bottom)`; hard refresh if a service worker serves a stale bundle.
- **Brain icon vs tools-only live buffer:** If tools stream before any reasoning text, `activeReasoning` may still be empty while `recentThoughtsRef` is not; the phase bubble still opens structured content from the ref. The header icon may not appear until reasoning text arrives unless that condition is broadened separately.
