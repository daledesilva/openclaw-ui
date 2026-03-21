import type { AssistantDisplayPayload, FetchedChatMessage } from '../api/gateway-types';
import type { Message, ThoughtItem } from '../chatThreadTypes';
import { summarizeToolCall, summarizeToolResult } from './toolBubbleSummary';

export type { ThoughtItem };

export function appendThoughtItem(thoughts: ThoughtItem[], item: ThoughtItem): ThoughtItem[] {
  if (item.kind === 'toolHint' && thoughts.length > 0) {
    const last = thoughts[thoughts.length - 1]!;
    if (last.kind === 'toolHint' && last.label === item.label) return thoughts;
  }
  return [...thoughts, item];
}

export function findLastAssistantIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === 'ai' && (!m.kind || m.kind === 'assistant')) return i;
  }
  return -1;
}

/**
 * Insert a reasoning trace bubble immediately before the last assistant message.
 * Returns a new array, or null if there is nothing to insert or no assistant slot.
 */
export function withReasoningTraceBeforeLastAssistant(
  messages: Message[],
  options: { thoughtItems: ThoughtItem[]; traceId: string; proseReasoning?: string }
): Message[] | null {
  const hasProse = !!options.proseReasoning?.trim();
  if (options.thoughtItems.length === 0 && !hasProse) return null;
  const assistantIdx = findLastAssistantIndex(messages);
  if (assistantIdx < 0) return null;
  const trace: Message = {
    id: options.traceId,
    role: 'ai',
    kind: 'reasoningTrace',
    content: '',
    thoughtItems: options.thoughtItems.length > 0 ? options.thoughtItems : [],
    ...(hasProse ? { proseReasoning: options.proseReasoning!.trim() } : {}),
  };
  return [...messages.slice(0, assistantIdx), trace, messages[assistantIdx]!];
}

export function mergeAssistantFinalIntoMessages(
  prev: Message[],
  payload: AssistantDisplayPayload
): Message[] {
  const lastIdx = prev.length - 1;
  if (lastIdx < 0) return prev;
  const last = prev[lastIdx]!;
  if (last.role !== 'ai') return prev;
  if (last.kind && last.kind !== 'assistant') return prev;

  const mergedAssistant: Message = {
    ...last,
    kind: 'assistant',
    content: payload.content,
    imageUrls: payload.imageUrls.length ? payload.imageUrls : undefined,
    linkPreviews: payload.linkPreviews.length ? payload.linkPreviews : undefined,
    isError: payload.isError,
  };
  return [...prev.slice(0, lastIdx), mergedAssistant];
}

/**
 * On gateway `final`: optionally splice trace before last assistant, merge final payload into that assistant.
 */
export function applyAssistantFinalWithThoughtBuffer(
  prev: Message[],
  payload: AssistantDisplayPayload,
  thoughtBuffer: ThoughtItem[],
  traceId: string
): Message[] {
  let next = prev;
  const proseReasoning = payload.reasoning.trim() ? payload.reasoning : undefined;
  if (thoughtBuffer.length > 0 || proseReasoning) {
    const withTrace = withReasoningTraceBeforeLastAssistant(prev, {
      thoughtItems: thoughtBuffer,
      traceId,
      proseReasoning,
    });
    if (withTrace) next = withTrace;
  }
  return mergeAssistantFinalIntoMessages(next, payload);
}

/**
 * True when this assistant history row would show something in the main assistant bubble
 * (user-visible body, media, link previews, or error). Not tool-only or thinking-only rows.
 */
export function assistantHistoryRowDisplaysToUser(msg: FetchedChatMessage): boolean {
  const role = msg.role.toLowerCase();
  if (role !== 'assistant' && role !== 'ai') return false;
  return (
    msg.content.trim().length > 0 ||
    (msg.linkPreviews?.length ?? 0) > 0 ||
    (msg.imageUrls?.length ?? 0) > 0 ||
    !!msg.isError
  );
}

/**
 * Rebuild thread messages from `chat.history` using the same trace + assistant ordering as live.
 */
export function foldFetchedHistoryToMessages(history: FetchedChatMessage[]): Message[] {
  const out: Message[] = [];
  let buffer: ThoughtItem[] = [];

  history.forEach((msg, index) => {
    if (msg.role === 'toolresult') {
      buffer = appendThoughtItem(buffer, {
        kind: 'toolResult',
        summary: summarizeToolResult({
          toolName: msg.toolName,
          isError: msg.isError,
          raw: msg.toolRawPayload,
        }),
      });
      return;
    }

    const idBase = `hist-${msg.timestamp ?? 'x'}-${index}`;

    if (msg.role === 'assistant' || msg.role === 'ai') {
      for (const tc of msg.toolCalls ?? []) {
        buffer = appendThoughtItem(buffer, { kind: 'toolHint', label: summarizeToolCall(tc) });
      }

      const reasoningTrimmed = msg.reasoning.trim();
      if (reasoningTrimmed) {
        buffer = appendThoughtItem(buffer, { kind: 'reasoningChunk', text: reasoningTrimmed });
      }

      if (!assistantHistoryRowDisplaysToUser(msg)) return;

      if (buffer.length > 0) {
        out.push({
          id: `${idBase}-trace`,
          role: 'ai',
          kind: 'reasoningTrace',
          content: '',
          thoughtItems: [...buffer],
        });
        buffer = [];
      }

      out.push({
        id: idBase,
        role: 'ai',
        kind: 'assistant',
        content: msg.content,
        senderLabel: msg.senderLabel,
        timestamp: msg.timestamp,
        isError: msg.isError,
        imageUrls: msg.imageUrls,
        linkPreviews: msg.linkPreviews,
      });
      return;
    }

    out.push({
      id: idBase,
      role: msg.role === 'user' ? 'user' : 'ai',
      content: msg.content,
      reasoning: msg.reasoning?.trim() ? msg.reasoning : undefined,
      senderLabel: msg.senderLabel,
      timestamp: msg.timestamp,
      isError: msg.isError,
      imageUrls: msg.imageUrls,
      linkPreviews: msg.linkPreviews,
    });
  });

  if (buffer.length > 0) {
    out.push({
      id: `hist-orphan-${history.length}`,
      role: 'ai',
      kind: 'reasoningTrace',
      content: '',
      thoughtItems: [...buffer],
    });
  }

  return out;
}

/** One row in the chain-of-thought modal (after merging adjacent streamed chunks). */
export type ThoughtProcessModalSegment =
  | { kind: 'toolHint'; text: string }
  | { kind: 'toolResult'; text: string }
  | { kind: 'reasoning'; text: string }
  | { kind: 'prose'; text: string };

/**
 * Turns `ThoughtItem[]` into modal rows: consecutive `reasoningChunk` merged into one segment,
 * then optional `proseReasoning` as a final segment.
 */
export function thoughtItemsToModalSegments(
  items: ThoughtItem[],
  proseReasoning?: string
): ThoughtProcessModalSegment[] {
  const segments: ThoughtProcessModalSegment[] = [];
  let reasoningBuffer = '';

  const flushReasoning = () => {
    const trimmed = reasoningBuffer.trim();
    if (trimmed) {
      segments.push({ kind: 'reasoning', text: trimmed });
    }
    reasoningBuffer = '';
  };

  for (const item of items) {
    if (item.kind === 'reasoningChunk') {
      reasoningBuffer += item.text;
    } else {
      flushReasoning();
      if (item.kind === 'toolHint') {
        segments.push({ kind: 'toolHint', text: item.label });
      } else {
        segments.push({ kind: 'toolResult', text: item.summary });
      }
    }
  }
  flushReasoning();

  const proseTrimmed = proseReasoning?.trim();
  if (proseTrimmed) {
    segments.push({ kind: 'prose', text: proseTrimmed });
  }

  return segments;
}

/** Latest completed trace or legacy assistant reasoning for header / history modal. */
export function findLastHistoricalChainOfThought(
  messages: Message[]
):
  | { kind: 'structured'; thoughtItems: ThoughtItem[]; proseReasoning?: string }
  | { kind: 'plain'; text: string }
  | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.kind === 'reasoningTrace') {
      const thoughtItems = m.thoughtItems ?? [];
      const prose = m.proseReasoning;
      if (thoughtItems.length > 0 || prose?.trim()) {
        return {
          kind: 'structured',
          thoughtItems,
          ...(prose?.trim() ? { proseReasoning: prose.trim() } : {}),
        };
      }
    }
    if (m.role === 'ai' && (!m.kind || m.kind === 'assistant') && m.reasoning?.trim()) {
      return { kind: 'plain', text: m.reasoning };
    }
  }
  return null;
}

/** Format trace + prose for the chain-of-thought modal. */
export function formatThoughtItemsForModal(items: ThoughtItem[], proseReasoning?: string): string {
  const toolLines: string[] = [];
  const reasoningParts: string[] = [];
  for (const item of items) {
    if (item.kind === 'toolHint') toolLines.push(`• ${item.label}`);
    else if (item.kind === 'toolResult') toolLines.push(`• Result: ${item.summary}`);
    else reasoningParts.push(item.text);
  }
  const chunks = [
    toolLines.length ? `Tools\n${toolLines.join('\n')}` : '',
    reasoningParts.join('').trim() ? reasoningParts.join('') : '',
    proseReasoning?.trim() ? proseReasoning.trim() : '',
  ].filter(Boolean);
  return chunks.join('\n\n---\n\n');
}
