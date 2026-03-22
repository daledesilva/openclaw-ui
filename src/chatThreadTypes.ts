export type MessageBubbleKind = 'assistant' | 'reasoningTrace';

/** Buffered non-answer signals; flushed into a `reasoningTrace` message on assistant final. */
export type ThoughtItem =
  | { kind: 'toolHint'; label: string }
  | { kind: 'toolResult'; summary: string }
  | { kind: 'reasoningChunk'; text: string };

export interface Message {
  id: string;
  role: 'user' | 'ai';
  kind?: MessageBubbleKind;
  content: string;
  /** Legacy: assistant-only chain-of-thought text (prefer `reasoningTrace` + `proseReasoning`). */
  reasoning?: string;
  senderLabel?: string;
  timestamp?: number;
  isError?: boolean;
  /** When `kind === 'reasoningTrace'`: items shown as a tool/thinking trace list */
  thoughtItems?: ThoughtItem[];
  /** Structured thinking from final parse or history, shown in the trace bubble */
  proseReasoning?: string;
  /** Sum of client Gemini/Vertex estimates for this bubble (see docs/gemini-pricing-estimates.md) */
  estimatedCostUsd?: number;
}
