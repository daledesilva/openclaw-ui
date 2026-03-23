import type { ChatMessage } from '../chatThreadTypes';

function messageContentLength(message: ChatMessage): number {
  return typeof message.content === 'string' ? message.content.length : String(message.content ?? '').length;
}

function approxTextCharactersFromMessage(message: ChatMessage): number {
  let n = messageContentLength(message);
  const reasoning = (message as { reasoning?: unknown }).reasoning;
  if (typeof reasoning === 'string') n += reasoning.length;
  const proseReasoning = (message as { proseReasoning?: unknown }).proseReasoning;
  if (typeof proseReasoning === 'string') n += proseReasoning.length;
  for (const item of message.thoughtItems ?? []) {
    if (item.kind === 'internalMonologue') n += item.thought.length;
    else if (item.kind === 'toolCall') {
      n += String(item.content ?? '').length;
      const tn = item.toolName ?? '';
      if (tn) n += tn.length;
    }
  }
  return n;
}

function isTrailingEmptyAssistantPlaceholder(message: ChatMessage): boolean {
  const contentStr = typeof message.content === 'string' ? message.content : String(message.content ?? '');
  const kind = message.kind ?? 'message';
  return (
    (message.role === 'ai' || message.role === 'assistant') &&
    !contentStr.trim() &&
    kind === 'message'
  );
}

/**
 * Counts visible transcript rows and summed text length (content + reasoning + trace text).
 * Intended as a loose proxy for context size, not token usage.
 */
export function computeThreadConversationStats(
  messages: ChatMessage[],
  options?: { omitTrailingEmptyAssistantPlaceholder?: boolean }
): { messageCount: number; textCharacterCount: number } {
  let rows = messages;
  if (options?.omitTrailingEmptyAssistantPlaceholder && rows.length > 0) {
    const last = rows[rows.length - 1];
    if (isTrailingEmptyAssistantPlaceholder(last)) {
      rows = rows.slice(0, -1);
    }
  }

  let textCharacterCount = 0;
  for (const m of rows) {
    textCharacterCount += approxTextCharactersFromMessage(m);
  }
  return { messageCount: rows.length, textCharacterCount };
}

/** Message row count only (same trailing empty-assistant rule as {@link computeThreadConversationStats}). */
export function computeThreadMessageCount(
  messages: ChatMessage[],
  options?: { omitTrailingEmptyAssistantPlaceholder?: boolean }
): number {
  return computeThreadConversationStats(messages, options).messageCount;
}
