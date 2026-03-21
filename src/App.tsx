import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { ChatBubble } from './components/ChatBubble';
import { ReasoningTraceBubble } from './components/ReasoningTraceBubble';
import { MessageInput } from './components/MessageInput';
import { ChainOfThoughtModal, type ChainOfThoughtModalContent } from './components/ChainOfThoughtModal';
import { TokenSetupScreen } from './components/TokenSetupScreen';
import type { Message, ThoughtItem } from './chatThreadTypes';
import {
  appendThoughtItem,
  applyAssistantFinalWithThoughtBuffer,
  findLastHistoricalChainOfThought,
  foldFetchedHistoryToMessages,
} from './utils/recentThoughtsReducer';
import {
  initGatewayConnection,
  sendChatMessage,
  fetchChatHistory,
  hasGatewayToken,
  isGatewaySessionKeyPinnedByBuild,
  startNewWebchatSession,
  clearStoredGatewayToken,
  disconnectGateway,
  requestGatewayReconnect,
} from './api/gateway';
import type { FetchedChatMessage } from './api/gateway';
import { useLiveAppVersion } from './useLiveAppVersion';
import { sanitizeDisplayText } from './utils/sanitizeDisplayText';
import {
  type AgentRunActivity,
  inputPlaceholderForActivity,
  isAgentRunBlockingInput,
  nextActivityFromContentChunk,
  nextActivityFromDeltaHints,
  nextActivityFromReasoningChunk,
  phaseBubbleDisplayText,
} from './utils/agentRunActivity';
import type { StreamPhaseStyle } from './components/ChatBubble';

export type { Message } from './chatThreadTypes';

type ConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

/** Default watchdog when no stream activity (ms). */
const AGENT_RUN_STALE_AFTER_MS = 90_000;

type RunTerminalNotice = { kind: 'error'; message: string } | { kind: 'aborted' };

export default function App() {
  const appVersion = useLiveAppVersion();
  const [tokenReady, setTokenReady] = useState(hasGatewayToken());
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeReasoning, setActiveReasoning] = useState<string>('');
  const [agentActivity, setAgentActivity] = useState<AgentRunActivity>('idle');
  const agentActivityRef = useRef<AgentRunActivity>('idle');
  const [liveLastToolSummary, setLiveLastToolSummary] = useState<string | null>(null);
  const [runTerminalNotice, setRunTerminalNotice] = useState<RunTerminalNotice | null>(null);
  const lastStreamActivityAtRef = useRef<number>(Date.now());
  const [cotOpen, setCotOpen] = useState(false);
  /** Snapshot when opening the chain-of-thought modal (structured trace or plain legacy text). */
  const [cotModalPayload, setCotModalPayload] = useState<ChainOfThoughtModalContent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [newChatDialogOpen, setNewChatDialogOpen] = useState(false);
  const [newChatBusy, setNewChatBusy] = useState(false);
  /** Non-answer signals for the current turn; flushed on `onAssistantFinal`. */
  const recentThoughtsRef = useRef<ThoughtItem[]>([]);
  const traceSeqRef = useRef(0);
  const sessionKeyPinnedByBuild = isGatewaySessionKeyPinnedByBuild();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const lastReasoningLine =
    sanitizeDisplayText(activeReasoning).trim().split('\n').pop() || '';
  const lastHistoricalChainOfThought = useMemo(
    () => findLastHistoricalChainOfThought(messages),
    [messages]
  );

  useEffect(() => {
    agentActivityRef.current = agentActivity;
  }, [agentActivity]);

  const touchStreamActivity = () => {
    lastStreamActivityAtRef.current = Date.now();
  };

  const syncStateFromFetchedHistory = useCallback((history: FetchedChatMessage[]) => {
    setMessages(foldFetchedHistoryToMessages(history));
    const reasoningBlocks = history
      .filter((m) => {
        const role = m.role.toLowerCase();
        return (role === 'assistant' || role === 'ai') && m.reasoning.trim();
      })
      .map((m) => m.reasoning);
    setActiveReasoning(
      reasoningBlocks.length
        ? reasoningBlocks.map((r) => sanitizeDisplayText(r)).join('\n\n---\n\n')
        : ''
    );
  }, []);

  useEffect(() => {
    if (agentActivity === 'idle' || agentActivity === 'stale') return;
    const tick = () => {
      if (Date.now() - lastStreamActivityAtRef.current >= AGENT_RUN_STALE_AFTER_MS) {
        setAgentActivity('stale');
      }
    };
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [agentActivity]);

  useEffect(() => {
    if (!tokenReady) return;
    initGatewayConnection({
      onMessage: (message) => {
        if (import.meta.env.DEV) {
          console.log('[OpenClaw gateway] generic message:', message);
        }
      },
      onReasoning: (chunk) => {
        touchStreamActivity();
        setAgentActivity((prev) => nextActivityFromReasoningChunk(prev));
        const safe = sanitizeDisplayText(chunk);
        setActiveReasoning((prev) => prev + safe);
        recentThoughtsRef.current = appendThoughtItem(recentThoughtsRef.current, {
          kind: 'reasoningChunk',
          text: safe,
        });
      },
      onChatDelta: (info) => {
        touchStreamActivity();
        setAgentActivity((prev) => nextActivityFromDeltaHints(prev, info.hints));
        if (info.lastToolSummary) {
          setLiveLastToolSummary(info.lastToolSummary);
          recentThoughtsRef.current = appendThoughtItem(recentThoughtsRef.current, {
            kind: 'toolHint',
            label: info.lastToolSummary,
          });
        }
      },
      onAgentStreamToolHint: (label) => {
        touchStreamActivity();
        const trimmed = sanitizeDisplayText(label).trim();
        if (trimmed) {
          setLiveLastToolSummary(trimmed);
          recentThoughtsRef.current = appendThoughtItem(recentThoughtsRef.current, {
            kind: 'toolHint',
            label: trimmed,
          });
        }
      },
      onContent: (chunk) => {
        touchStreamActivity();
        setAgentActivity((prev) => nextActivityFromContentChunk(prev));
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
          const buffer = recentThoughtsRef.current;
          recentThoughtsRef.current = [];
          traceSeqRef.current += 1;
          return applyAssistantFinalWithThoughtBuffer(
            prev,
            payload,
            buffer,
            `trace-${Date.now()}-${traceSeqRef.current}`
          );
        });
      },
      onChatTerminal: (info) => {
        setAgentActivity('idle');
        setLiveLastToolSummary(null);
        recentThoughtsRef.current = [];
        touchStreamActivity();
        if (info.state === 'error') {
          setRunTerminalNotice({
            kind: 'error',
            message: (info.errorMessage?.trim() || 'Run failed').slice(0, 500),
          });
        } else if (info.state === 'aborted') {
          setRunTerminalNotice({ kind: 'aborted' });
        } else {
          setRunTerminalNotice(null);
        }
      },
      onConnected: () => {
        setConnectionStatus('ready');
        setConnectionError(null);
        fetchChatHistory()
          .then((history) => {
            syncStateFromFetchedHistory(history);
          })
          .catch((err) => {
            console.error('[OpenClaw gateway] chat.history failed:', err);
          });
      },
      onConnectError: (error) => {
        setConnectionStatus('error');
        setConnectionError(error);
      },
      onDisconnected: () => {
        setConnectionStatus('disconnected');
        setConnectionError('Disconnected from gateway.');
        setAgentActivity('idle');
        setLiveLastToolSummary(null);
        recentThoughtsRef.current = [];
      },
    });
    return () => disconnectGateway();
  }, [tokenReady, syncStateFromFetchedHistory]);

  if (!tokenReady) {
    return <TokenSetupScreen onTokenSet={() => setTokenReady(true)} />;
  }

  const handleReenterToken = () => {
    clearStoredGatewayToken();
    setTokenReady(false);
  };

  const resetLocalChatState = () => {
    setMessages([]);
    recentThoughtsRef.current = [];
    setActiveReasoning('');
    setLiveLastToolSummary(null);
    setRunTerminalNotice(null);
    setAgentActivity('idle');
    setCotOpen(false);
    setCotModalPayload(null);
    lastStreamActivityAtRef.current = Date.now();
  };

  const handleConfirmNewChat = async () => {
    setNewChatBusy(true);
    try {
      startNewWebchatSession();
      resetLocalChatState();
      const history = await fetchChatHistory();
      syncStateFromFetchedHistory(history);
    } catch (err) {
      console.error('[OpenClaw gateway] new chat / chat.history failed:', err);
    } finally {
      setNewChatBusy(false);
      setNewChatDialogOpen(false);
    }
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
    recentThoughtsRef.current = [];
    setRunTerminalNotice(null);
    setLiveLastToolSummary(null);
    setAgentActivity('pending');
    touchStreamActivity();

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
              {connectionStatus === 'disconnected' && connectionError && (
                <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mt: 0.5 }}>
                  {connectionError}
                </Typography>
              )}
              {connectionStatus === 'error' && connectionError && (
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {connectionError}
                </Typography>
              )}
              {connectionStatus === 'ready' && agentActivity !== 'idle' && (
                <Chip
                  size="small"
                  label={
                    agentActivity === 'pending'
                      ? 'Waiting'
                      : agentActivity === 'reasoning'
                        ? 'Thinking'
                        : agentActivity === 'acting'
                          ? 'Using tools'
                          : agentActivity === 'responding'
                            ? 'Writing'
                            : 'No recent activity'
                  }
                  sx={{ mt: 0.75, height: 22, fontSize: '0.7rem', bgcolor: 'rgba(255,255,255,0.2)' }}
                />
              )}
              {connectionStatus === 'ready' && runTerminalNotice && (
                <Chip
                  size="small"
                  color={runTerminalNotice.kind === 'error' ? 'error' : 'default'}
                  label={
                    runTerminalNotice.kind === 'aborted'
                      ? 'Stopped'
                      : runTerminalNotice.message.slice(0, 80) +
                        (runTerminalNotice.message.length > 80 ? '…' : '')
                  }
                  onDelete={() => setRunTerminalNotice(null)}
                  sx={{ mt: 0.5, height: 22, maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              <Tooltip
                title={
                  sessionKeyPinnedByBuild
                    ? 'Session key is fixed in the build (VITE_OPENCLAW_SESSION_KEY). Remove it in .env.local to start new chats from this UI.'
                    : 'Start a new conversation (the current thread cannot be reopened here)'
                }
              >
                <span>
                  <IconButton
                    color="inherit"
                    size="small"
                    aria-label="New chat"
                    disabled={
                      connectionStatus !== 'ready' ||
                      isAgentRunBlockingInput(agentActivity) ||
                      sessionKeyPinnedByBuild
                    }
                    onClick={() => setNewChatDialogOpen(true)}
                    sx={{ opacity: 0.92 }}
                  >
                    <ChatBubbleOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              {(sanitizeDisplayText(activeReasoning).trim() || lastHistoricalChainOfThought) && (
                <Tooltip title="Chain of thought">
                  <IconButton
                    color="inherit"
                    size="small"
                    aria-label="Open chain of thought"
                    onClick={() => {
                      const activeTrim = sanitizeDisplayText(activeReasoning).trim();
                      if (activeTrim) {
                        const refSnapshot = [...recentThoughtsRef.current];
                        if (refSnapshot.length > 0) {
                          setCotModalPayload({ mode: 'structured', thoughtItems: refSnapshot });
                        } else {
                          setCotModalPayload({ mode: 'plain', text: activeReasoning });
                        }
                      } else if (lastHistoricalChainOfThought) {
                        if (lastHistoricalChainOfThought.kind === 'structured') {
                          setCotModalPayload({
                            mode: 'structured',
                            thoughtItems: lastHistoricalChainOfThought.thoughtItems,
                            ...(lastHistoricalChainOfThought.proseReasoning
                              ? { proseReasoning: lastHistoricalChainOfThought.proseReasoning }
                              : {}),
                          });
                        } else {
                          setCotModalPayload({
                            mode: 'plain',
                            text: sanitizeDisplayText(lastHistoricalChainOfThought.text),
                          });
                        }
                      } else {
                        setCotModalPayload({ mode: 'plain', text: '' });
                      }
                      setCotOpen(true);
                    }}
                    sx={{ opacity: 0.92 }}
                  >
                    <PsychologyOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Paper>

        <Dialog
          open={newChatDialogOpen}
          onClose={() => !newChatBusy && setNewChatDialogOpen(false)}
          aria-labelledby="new-chat-dialog-title"
        >
          <DialogTitle id="new-chat-dialog-title">New chat?</DialogTitle>
          <DialogContent>
            <DialogContentText component="div">
              This starts a <strong>new gateway session</strong> for this browser (new session key in
              local storage). The current conversation will disappear from this app and cannot be
              reopened here. Older transcripts may still exist on the gateway under the previous
              session id.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewChatDialogOpen(false)} disabled={newChatBusy}>
              Cancel
            </Button>
            <Button onClick={() => void handleConfirmNewChat()} color="primary" disabled={newChatBusy}>
              {newChatBusy ? 'Starting…' : 'New chat'}
            </Button>
          </DialogActions>
        </Dialog>

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

        {connectionStatus === 'disconnected' && (
          <Alert
            severity="warning"
            sx={{ m: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setConnectionStatus('connecting');
                  setConnectionError(null);
                  requestGatewayReconnect();
                }}
              >
                Reconnect
              </Button>
            }
          >
            {connectionError ?? 'Connection lost.'} Use Reconnect or refresh the page.
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
          {messages.map((msg, index) => {
            if (msg.role === 'ai' && msg.kind === 'reasoningTrace') {
              return (
                <ReasoningTraceBubble
                  key={msg.id}
                  thoughtItems={msg.thoughtItems ?? []}
                  proseReasoning={msg.proseReasoning}
                  onViewFullReasoning={() => {
                    setCotModalPayload({
                      mode: 'structured',
                      thoughtItems: msg.thoughtItems ?? [],
                      ...(msg.proseReasoning?.trim() ? { proseReasoning: msg.proseReasoning } : {}),
                    });
                    setCotOpen(true);
                  }}
                />
              );
            }
            const isLastMessage = index === messages.length - 1;
            const runInFlight = agentActivity !== 'idle';
            const isEmptyStreamingAssistantSlot =
              msg.role === 'ai' &&
              (!msg.kind || msg.kind === 'assistant') &&
              !msg.content.trim() &&
              !(msg.imageUrls?.length) &&
              !(msg.linkPreviews?.length) &&
              !msg.isError;
            if (isEmptyStreamingAssistantSlot && isLastMessage && runInFlight) {
              return null;
            }
            const viewReasoningHandler =
              msg.role === 'ai' &&
              (!msg.kind || msg.kind === 'assistant') &&
              msg.reasoning?.trim()
                ? () => {
                    setCotModalPayload({ mode: 'plain', text: sanitizeDisplayText(msg.reasoning!) });
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
          {agentActivity !== 'idle' && agentActivity !== 'responding' && (
            <ChatBubble
              role="ai"
              content={phaseBubbleDisplayText(agentActivity, lastReasoningLine, liveLastToolSummary)}
              isThinking={true}
              streamPhase={agentActivity as StreamPhaseStyle}
              onClick={() => {
                const refSnapshot = [...recentThoughtsRef.current];
                if (refSnapshot.length > 0) {
                  setCotModalPayload({ mode: 'structured', thoughtItems: refSnapshot });
                } else {
                  setCotModalPayload({ mode: 'plain', text: activeReasoning });
                }
                setCotOpen(true);
              }}
            />
          )}
        </Box>

        <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
          <MessageInput
            onSend={handleSend}
            disabled={connectionStatus !== 'ready' || isAgentRunBlockingInput(agentActivity)}
            placeholder={inputPlaceholderForActivity(agentActivity, connectionStatus)}
          />
        </Box>
      </Box>

      <ChainOfThoughtModal
        open={cotOpen}
        onClose={() => {
          setCotOpen(false);
          setCotModalPayload(null);
        }}
        content={cotModalPayload ?? { mode: 'plain', text: '' }}
      />
    </Box>
  );
}
