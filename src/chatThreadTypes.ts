export type MessageBubbleKind = 'assistant' | 'reasoningTrace';
import { RawHistoryItem } from './api/gateway-types';

export type ChatMessageKind = 'message' | 'abortion' | 'error';

export type InternalMonologue = {
  kind: 'internalMonologue';
  thought: string;
}

export type ToolCall = RawHistoryItem & {
  kind: 'toolCall';
  toolName: string;
};

export type ThoughtItem = ToolCall | InternalMonologue;

export interface ChatMessage extends RawHistoryItem {
  /**
   * UI selection hint for which assistant-row bubble to render.
   * For most successful responses, this can be omitted.
   */
  kind?: ChatMessageKind;
  thoughtItems?: ThoughtItem[];
  estimatedCostUsd?: number;
  modelRef?: string;
  provider?: string;
  /** Parsed thinking / chain-of-thought prose (assistant rows). */
  reasoning?: string;
  /** UI-only prose alongside structured trace rows. */
  proseReasoning?: string;
}