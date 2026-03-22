import type { Message } from '../chatThreadTypes';

function approxTextCharactersFromMessage(message: Message): number {
  let n = message.content.length;
  if (message.reasoning?.trim()) {
    n += message.reasoning.length;
  }
  if (message.kind === 'reasoningTrace') {
    if (message.proseReasoning?.trim()) {
      n += message.proseReasoning.length;
    }
    for (const item of message.thoughtItems ?? []) {
      if (item.kind === 'reasoningChunk') n += item.text.length;
      else if (item.kind === 'toolHint') n += item.label.length;
      else if (item.kind === 'toolResult') n += item.summary.length;
    }
  }
  return n;
}

function isTrailingEmptyAssistantPlaceholder(message: Message): boolean {
  return (
    message.role === 'ai' &&
    (!message.kind || message.kind === 'assistant') &&
    !message.content.trim() &&
    !(message.imageUrls?.length) &&
    !(message.linkPreviews?.length) &&
    !message.isError
  );
}

/**
 * Counts visible transcript rows and summed text length (content + reasoning + trace text).
 * Intended as a loose proxy for context size, not token usage.
 */
export function computeThreadConversationStats(
  messages: Message[],
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
