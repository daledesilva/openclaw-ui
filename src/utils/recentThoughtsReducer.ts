import { useCallback, useRef, useState } from 'react';
import type { RawHistoryItem } from '../api/gateway-types';
import type { FetchedChatMessage, GatewayChatEventPayload, GatewayEventFrame } from '../api/gateway';
import type { ChatMessage, ThoughtItem } from '../chatThreadTypes';
import { extractMessageFromProviderPayload } from './extractMessageFromProviderPayload';

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
          toolName: historyItem.toolName ?? '',
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

function isGatewayEventFrame(raw: unknown): raw is GatewayEventFrame {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { type?: string }).type === 'event' &&
    typeof (raw as { event?: unknown }).event === 'string'
  );
}

/**
 * Owns transcript rows, the live thought buffer, and all `RawHistoryItem` / `FetchedChatMessage` folding.
 */
export function useChatMessageThread() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const recentsThoughtsRef = useRef<ThoughtItem[]>([]);

  const handleStreamEvent = useCallback((raw: unknown) => {
    console.log('handleStreamEvent', raw);
    if (!isGatewayEventFrame(raw)) return;

    const { event: ev, payload } = raw;

    if (ev === 'chat') {
      const p = payload as GatewayChatEventPayload | undefined;
      if (!p) return;
      const { state, message } = p;

      if (state === 'final') {
        if (message == undefined || message == null) return;
        const contentStr = extractMessageFromProviderPayload(message);
        const thoughtItemsSnapshot = [...recentsThoughtsRef.current];

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            kind: 'message',
            content: contentStr,
            thoughtItems: thoughtItemsSnapshot,
          },
        ]);

        recentsThoughtsRef.current = [];
        return;
      }

      else if (state === 'aborted') {
        const contentStr = extractMessageFromProviderPayload(message);
        const thoughtItemsSnapshot = [...recentsThoughtsRef.current];

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            kind: 'abortion',
            content: contentStr,
            thoughtItems: thoughtItemsSnapshot,
          },
        ]);

        recentsThoughtsRef.current = [];
        return;
      }

      else if (state === 'error') {
        const contentStr = extractMessageFromProviderPayload(message);
        const thoughtItemsSnapshot = [...recentsThoughtsRef.current];

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            kind: 'error',
            content: contentStr,
            thoughtItems: thoughtItemsSnapshot,
          },
        ]);

        recentsThoughtsRef.current = [];
        return;
      }
      return;
    }

    // if (typeof ev === 'string' && (ev.startsWith('agent') || ev.includes('stream'))) {
    //   const p = payload as { stream?: string; data?: unknown } | undefined;
    //   if (p?.stream === 'reasoning' && p.data && typeof (p.data as { text?: unknown }).text === 'string') {
    //     const text = (p.data as { text: string }).text;
    //     recentsThoughtsRef.current = [
    //       ...recentsThoughtsRef.current,
    //       { kind: 'internalMonologue', thought: text },
    //     ];
    //     setMessages((prev) => [...prev, { role: 'assistant', content: null, thoughtItems: recentsThoughtsRef.current }]);
    //   }
    //   const toolLabel = p?.data ? toolHintFromAgentStreamData(p.data) : null;
    //   if (toolLabel) {
    //     recentsThoughtsRef.current = [
    //       ...recentsThoughtsRef.current,
    //       { kind: 'toolCall', toolName: toolLabel },
    //     ];
    //     setMessages((prev) => [...prev, { role: 'assistant', content: null, thoughtItems: recentsThoughtsRef.current }]);
    //   }
    // }
  }, []);

  const addUserMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
  }, []);

  const replaceFromFetchedHistory = useCallback((history: FetchedChatMessage[]) => {
    recentsThoughtsRef.current = [];
    setMessages(parseFetchedHistoryIntoChatMessages(history));
  }, []);

  return {
    messages,
    addUserMessage,
    handleStreamEvent,
    replaceFromFetchedHistory,
  };
}
