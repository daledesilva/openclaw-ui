import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  useMediaQuery,
  Theme,
  Alert,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import { ChatBubble } from './components/ChatBubble';
import { MessageInput } from './components/MessageInput';
import { ChainOfThoughtModal } from './components/ChainOfThoughtModal';
import { TokenSetupScreen } from './components/TokenSetupScreen';
import { ToolCallBubble } from './components/ToolCallBubble';
import { ToolResultBubble } from './components/ToolResultBubble';
import { summarizeToolCall, summarizeToolResult } from './utils/toolBubbleSummary';
import {
  initGatewayConnection,
  sendChatMessage,
  fetchChatHistory,
  hasGatewayToken,
  clearStoredGatewayToken,
  disconnectGateway,
} from './api/gateway';
import type { FetchedChatMessage } from './api/gateway';
import type { AssistantDisplayPayload, LinkPreview, ToolCallEntry } from './api/gateway-types';
import { useLiveAppVersion } from './useLiveAppVersion';
import { sanitizeDisplayText } from './utils/sanitizeDisplayText';

export type MessageBubbleKind = 'assistant' | 'toolCall' | 'toolResult';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  kind?: MessageBubbleKind;
  content: string;
  reasoning?: string;
  senderLabel?: string;
  timestamp?: number;
  isError?: boolean;
  imageUrls?: string[];
  linkPreviews?: LinkPreview[];
  /** Collapsed tool row label (after `Tool: `) */
  toolSummary?: string;
  /** Pretty-print source for expanded tool call / tool result */
  toolRawPayload?: unknown;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

function toolCallLine(entry: ToolCallEntry): string {
  return entry.argumentsPreview ? `${entry.name}(${entry.argumentsPreview})` : `${entry.name}()`;
}

function mapHistoryToMessages(history: FetchedChatMessage[]): Message[] {
  const out: Message[] = [];
  history.forEach((msg, index) => {
    const idBase = `hist-${msg.timestamp ?? 'x'}-${index}`;

    if (msg.role === 'toolresult') {
      out.push({
        id: idBase,
        role: 'ai',
        kind: 'toolResult',
        content: msg.content,
        isError: msg.isError,
        senderLabel: msg.senderLabel,
        timestamp: msg.timestamp,
        toolSummary: summarizeToolResult({
          toolName: msg.toolName,
          isError: msg.isError,
          raw: msg.toolRawPayload,
        }),
        toolRawPayload: msg.toolRawPayload,
      });
      return;
    }

    if (msg.role === 'assistant' || msg.role === 'ai') {
      const toolCalls = msg.toolCalls ?? [];
      toolCalls.forEach((tc, t) => {
        out.push({
          id: `${idBase}-tc-${t}`,
          role: 'ai',
          kind: 'toolCall',
          content: toolCallLine(tc),
          toolSummary: summarizeToolCall(tc),
          toolRawPayload: { name: tc.name, arguments: tc.arguments ?? {} },
        });
      });
      const hasAssistantBubble =
        msg.content.trim().length > 0 ||
        (msg.linkPreviews?.length ?? 0) > 0 ||
        (msg.imageUrls?.length ?? 0) > 0 ||
        msg.isError;
      if (hasAssistantBubble || toolCalls.length === 0) {
        out.push({
          id: idBase,
          role: 'ai',
          kind: 'assistant',
          content: msg.content,
          reasoning: msg.reasoning?.trim() ? msg.reasoning : undefined,
          senderLabel: msg.senderLabel,
          timestamp: msg.timestamp,
          isError: msg.isError,
          imageUrls: msg.imageUrls,
          linkPreviews: msg.linkPreviews,
        });
      }
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
  return out;
}

function mergeAssistantFinalIntoMessages(
  prev: Message[],
  payload: AssistantDisplayPayload,
  placeholderId: string
): Message[] {
  const lastIdx = prev.length - 1;
  if (lastIdx < 0) return prev;
  const last = prev[lastIdx]!;
  if (last.role !== 'ai') return prev;
  if (last.kind && last.kind !== 'assistant') return prev;

  const toolCalls = payload.toolCalls;
  const pieces: Message[] = [];
  if (toolCalls.length) {
    toolCalls.forEach((tc, t) => {
      pieces.push({
        id: `${placeholderId}-f-${t}`,
        role: 'ai',
        kind: 'toolCall',
        content: toolCallLine(tc),
        toolSummary: summarizeToolCall(tc),
        toolRawPayload: { name: tc.name, arguments: tc.arguments ?? {} },
      });
    });
  }
  pieces.push({
    ...last,
    kind: 'assistant',
    content: payload.content,
    imageUrls: payload.imageUrls.length ? payload.imageUrls : undefined,
    linkPreviews: payload.linkPreviews.length ? payload.linkPreviews : undefined,
    isError: payload.isError,
  });
  return [...prev.slice(0, lastIdx), ...pieces];
}

function patchLastAssistantWithReasoning(messages: Message[], reasoningRaw: string): Message[] {
  const trimmed = sanitizeDisplayText(reasoningRaw).trim();
  if (!trimmed) return messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === 'ai' && (!m.kind || m.kind === 'assistant')) {
      const next = [...messages];
      next[i] = { ...m, reasoning: trimmed };
      return next;
    }
  }
  return messages;
}

export default function App() {
  const appVersion = useLiveAppVersion();
  const [tokenReady, setTokenReady] = useState(hasGatewayToken());
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeReasoning, setActiveReasoning] = useState<string>('');
  const activeReasoningRef = useRef<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const [cotOpen, setCotOpen] = useState(false);
  /** When set, modal shows this text instead of live `activeReasoning` (e.g. history bubble). */
  const [cotReasoningOverride, setCotReasoningOverride] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const lastReasoningLine =
    sanitizeDisplayText(activeReasoning).trim().split('\n').pop() || '';
  const cotModalText = cotReasoningOverride ?? activeReasoning;

  const lastReasoningFromHistory = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.role === 'ai' && (!m.kind || m.kind === 'assistant') && m.reasoning?.trim()) {
        return m.reasoning;
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    activeReasoningRef.current = activeReasoning;
  }, [activeReasoning]);

  useEffect(() => {
    if (!tokenReady) return;
    initGatewayConnection({
      onMessage: (message) => {
        if (import.meta.env.DEV) {
          console.log('[OpenClaw gateway] generic message:', message);
        }
      },
      onReasoning: (chunk) => {
        setIsThinking(true);
        setActiveReasoning((prev) => prev + sanitizeDisplayText(chunk));
      },
      onContent: (chunk) => {
        setIsThinking(false);
        const safe = sanitizeDisplayText(chunk);
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'ai' && (!lastMsg.kind || lastMsg.kind === 'assistant')) {
            const updatedMessages = [...prev];
            updatedMessages[updatedMessages.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + safe,
            };
            return updatedMessages;
          }
          return prev;
        });
      },
      onAssistantFinal: (payload) => {
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          const placeholderId =
            last?.role === 'ai' && (!last.kind || last.kind === 'assistant') ? last.id : 'stream';
          return mergeAssistantFinalIntoMessages(prev, payload, placeholderId);
        });
      },
      onChatTerminal: () => {
        setIsThinking(false);
        setMessages((prev) => patchLastAssistantWithReasoning(prev, activeReasoningRef.current));
      },
      onConnected: () => {
        setConnectionStatus('ready');
        setConnectionError(null);
        fetchChatHistory()
          .then((history) => {
            setMessages(mapHistoryToMessages(history));
            const reasoningBlocks = history
              .filter((m) => m.role === 'assistant' && m.reasoning.trim())
              .map((m) => m.reasoning);
            if (reasoningBlocks.length) {
              setActiveReasoning(
                reasoningBlocks.map((r) => sanitizeDisplayText(r)).join('\n\n---\n\n')
              );
            }
          })
          .catch((err) => {
            console.error('[OpenClaw gateway] chat.history failed:', err);
          });
      },
      onConnectError: (error) => {
        setConnectionStatus('error');
        setConnectionError(error);
      },
    });
    return () => disconnectGateway();
  }, [tokenReady]);

  if (!tokenReady) {
    return <TokenSetupScreen onTokenSet={() => setTokenReady(true)} />;
  }

  const handleReenterToken = () => {
    clearStoredGatewayToken();
    setTokenReady(false);
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    if (connectionStatus !== 'ready') {
      setConnectionError('Not connected. Please wait for the gateway to connect.');
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    setActiveReasoning('');
    setIsThinking(true);

    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: 'ai', kind: 'assistant', content: '' },
    ]);

    sendChatMessage(text);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="h1">
                OpenClaw UI
              </Typography>
              <Typography
                variant="caption"
                component="p"
                sx={{ display: 'block', mt: 0.25, opacity: 0.72, fontSize: '0.68rem', letterSpacing: '0.02em' }}
              >
                {appVersion}
              </Typography>
              {connectionStatus === 'connecting' && (
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Connecting…
                </Typography>
              )}
              {connectionStatus === 'error' && connectionError && (
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {connectionError}
                </Typography>
              )}
            </Box>
            {(sanitizeDisplayText(activeReasoning).trim() || lastReasoningFromHistory) && (
              <Tooltip title="Chain of thought">
                <IconButton
                  color="inherit"
                  size="small"
                  aria-label="Open chain of thought"
                  onClick={() => {
                    if (sanitizeDisplayText(activeReasoning).trim()) {
                      setCotReasoningOverride(null);
                    } else if (lastReasoningFromHistory) {
                      setCotReasoningOverride(sanitizeDisplayText(lastReasoningFromHistory));
                    } else {
                      setCotReasoningOverride(null);
                    }
                    setCotOpen(true);
                  }}
                  sx={{ flexShrink: 0, opacity: 0.92 }}
                >
                  <PsychologyOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Paper>

        {connectionError && connectionStatus === 'error' && (
          <Alert
            severity="error"
            sx={{ m: 2 }}
            onClose={() => setConnectionError(null)}
            action={
              <Button color="inherit" size="small" onClick={handleReenterToken}>
                Re-enter token
              </Button>
            }
          >
            {connectionError}
          </Alert>
        )}

        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: isMobile ? 2 : 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          {messages.map((msg) => {
            if (msg.role === 'ai' && msg.kind === 'toolCall') {
              return (
                <ToolCallBubble
                  key={msg.id}
                  summary={msg.toolSummary ?? msg.content}
                  expandPayload={msg.toolRawPayload ?? { name: 'tool', arguments: {} }}
                />
              );
            }
            if (msg.role === 'ai' && msg.kind === 'toolResult') {
              return (
                <ToolResultBubble
                  key={msg.id}
                  summary={msg.toolSummary ?? '(result)'}
                  expandPayload={msg.toolRawPayload ?? null}
                />
              );
            }
            const viewReasoningHandler =
              msg.role === 'ai' &&
              (!msg.kind || msg.kind === 'assistant') &&
              msg.reasoning?.trim()
                ? () => {
                    setCotReasoningOverride(sanitizeDisplayText(msg.reasoning!));
                    setCotOpen(true);
                  }
                : undefined;
            return (
              <ChatBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                imageUrls={msg.imageUrls}
                linkPreviews={msg.linkPreviews}
                caption={msg.role === 'user' ? msg.senderLabel : undefined}
                isError={msg.role === 'ai' ? msg.isError : undefined}
                onViewReasoning={viewReasoningHandler}
              />
            );
          })}
          {isThinking && (
            <ChatBubble
              role="ai"
              content={lastReasoningLine || 'Thinking…'}
              isThinking={true}
              onClick={() => {
                setCotReasoningOverride(null);
                setCotOpen(true);
              }}
            />
          )}
        </Box>

        <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
          <MessageInput
            onSend={handleSend}
            disabled={isThinking || connectionStatus !== 'ready'}
          />
        </Box>
      </Box>

      <ChainOfThoughtModal
        open={cotOpen}
        onClose={() => {
          setCotOpen(false);
          setCotReasoningOverride(null);
        }}
        reasoning={cotModalText}
      />
    </Box>
  );
}
