import { useCallback, useState } from 'react';
import type { RawHistoryItem } from '../api/gateway-types';
import type { FetchedChatMessage, GatewayStreamEvent } from '../api/gateway';
import type { ChatMessage, ThoughtItem } from '../chatThreadTypes';
import { sanitizeDisplayText } from './sanitizeDisplayText';

//

/** True when opening the chain-of-thought modal would have structured or prose content. */
export function traceHasDisplayableContent(
  thoughtItems: ThoughtItem[],
  proseReasoning: string | undefined,
  hasOpenHandler: boolean
): boolean {
  if (!hasOpenHandler) return false;
  if (proseReasoning?.trim()) return true;
  return thoughtItems.length > 0;
}

export function createUserChatMessage(historyItem: RawHistoryItem): ChatMessage {
  return {
    ...historyItem,
  };
}

export function createAgentChatMessage(historyItem: RawHistoryItem, thoughtItems: ThoughtItem[]): ChatMessage {
  return {
    ...historyItem,
    thoughtItems,
  };
}

export function parseHistoryIntoChatMessages(historyItems: RawHistoryItem[]): ChatMessage[] {
  const chatMessages: ChatMessage[] = [];
  let thoughtBuffer: ThoughtItem[] = [];

  historyItems.forEach((historyItem) => {
    const role = historyItem.role?.toLowerCase();

    switch (role) {
      case 'user':
        chatMessages.push(createUserChatMessage(historyItem));
        return;

      case 'toolresult':
        thoughtBuffer.push({
          kind: 'toolCall',
          ...historyItem,
        });
        return;

      case 'assistant':
      case 'ai':
        chatMessages.push(createAgentChatMessage(historyItem, thoughtBuffer));
        thoughtBuffer = [];
        return;

      default:
        return;
    }
  });

  return chatMessages;
}

/**
 * `fetchChatHistory` returns normalized rows; the fold buffer logic expects raw-shaped roles
 * (`user` / `toolresult` / `assistant` / `ai`), which these rows satisfy.
 */
export function parseFetchedHistoryIntoChatMessages(history: FetchedChatMessage[]): ChatMessage[] {
  return parseHistoryIntoChatMessages(history as unknown as RawHistoryItem[]);
}

/**
 * Owns transcript rows, the live thought buffer, and all `RawHistoryItem` / `FetchedChatMessage` folding.
 */
export function useChatMessageThread() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentThoughts, setRecentThoughts] = useState<ThoughtItem[]>([]);

  const appendAssistantContentDelta = useCallback((chunk: string) => {
    const safe = sanitizeDisplayText(chunk);
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && (lastMsg.role === 'assistant' || lastMsg.role === 'ai')) {
        const updatedMessages = [...prev];
        const priorContent = typeof lastMsg.content === 'string' ? lastMsg.content : '';
        updatedMessages[updatedMessages.length - 1] = {
          ...lastMsg,
          content: priorContent + safe,
        };
        return updatedMessages;
      }
      return prev;
    });
  }, []);

  const handleStreamEvent = useCallback(
    (event: GatewayStreamEvent) => {
      switch (event.kind) {
        case 'reasoning':
          setRecentThoughts((prev) => [...prev, { kind: 'internalMonologue', thought: event.text }]);
          break;
        case 'content':
          // appendAssistantContentDelta(event.text);
          setMessages((prev) => [...prev, { role: 'assistant', content: event.text }]);
          break;
        // case 'chatDelta':
        // case 'agentStreamToolHint':
        //   onStreamActivityRef.current?.();
        //   break;
        // case 'assistantFinal':
        //   break;
        case 'chatTerminal':
          setRecentThoughts([]);
          break;
      }
    },
    [appendAssistantContentDelta]
  );

  const addUserMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
  }, []);

  return {
    messages,
    addUserMessage,
    handleStreamEvent,
  };
}
