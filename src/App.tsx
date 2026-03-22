import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
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
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
} from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';
import MenuIcon from '@mui/icons-material/Menu';
import { AgentChatBubble } from './components/AgentChatBubble';
import { UserChatBubble } from './components/UserChatBubble';
import { MessageInput } from './components/MessageInput';
import { ChainOfThoughtModal, type ChainOfThoughtModalContent } from './components/ChainOfThoughtModal';
import { GoogleGeminiPricingModal } from './components/GoogleGeminiPricingModal';
import { TokenSetupScreen } from './components/TokenSetupScreen';
import type { Message, ThoughtItem } from './chatThreadTypes';
import {
  appendThoughtItem,
  applyAssistantFinalWithThoughtBuffer,
  foldFetchedHistoryToMessages,
} from './utils/recentThoughtsReducer';
import {
  initGatewayConnection,
  sendChatMessage,
  fetchChatHistory,
  fetchGatewaySessionsList,
  fetchGatewayUsageCost,
  hasGatewayToken,
  isGatewaySessionKeyPinnedByBuild,
  clearStoredGatewayToken,
  disconnectGateway,
  requestGatewayReconnect,
} from './api/gateway';
import {
  displayTotalTokens,
  extractDefaultAgentIdFromHealthPayload,
  extractDefaultAgentIdFromSessionsListPayload,
  extractSessionTokenStatsByKey,
  logGatewaySessionsListCostProbe,
  type GatewaySessionTokenStats,
} from './api/gatewaySessionsList';
import {
  canonicalOpenClawSessionKey,
  formatUsdEstimate,
  formatUsdSessionClientTotal,
  logGatewayUsageCostProbe,
  mergeParsedGatewayUsageCost,
  parseGatewayUsageCostPayload,
  type ParsedGatewayUsageCost,
  sessionOnlyUsageCostUsd,
} from './api/gatewayUsageCost';
import {
  addThreadToSnapshot,
  collapseThreadsSnapshotForPinnedSessionKey,
  generateWebchatSessionKey,
  loadChatThreadsFromStorage,
  nextThreadLabel,
  persistChatThreadsSnapshot,
  setActiveThreadInSnapshot,
  touchThreadInSnapshot,
  updateThreadCachedGatewayTokensInSnapshot,
  updateThreadCachedMessageCountInSnapshot,
  type ChatThreadsSnapshot,
} from './utils/chatThreadsStorage';
import { computeThreadMessageCount } from './utils/conversationStats';
import type { FetchedChatMessage } from './api/gateway';
import { useLiveAppVersion } from './useLiveAppVersion';
import { sanitizeDisplayText } from './utils/sanitizeDisplayText';
import { sumMessageEstimatedUsd } from './utils/geminiPricingEstimate';
import {
  type AgentRunActivity,
  inputPlaceholderForActivity,
  isAgentRunBlockingInput,
  nextActivityFromContentChunk,
  nextActivityFromDeltaHints,
  nextActivityFromReasoningChunk,
} from './utils/agentRunActivity';

export type { Message } from './chatThreadTypes';

type ConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

/** Default watchdog when no stream activity (ms). */
const AGENT_RUN_STALE_AFTER_MS = 90_000;

const THREAD_DRAWER_WIDTH = 268;

type RunTerminalNotice = { kind: 'error'; message: string } | { kind: 'aborted' };

export default function App() {
  const appVersion = useLiveAppVersion();
  const [tokenReady, setTokenReady] = useState(hasGatewayToken());
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentActivity, setAgentActivity] = useState<AgentRunActivity>('idle');
  const agentActivityRef = useRef<AgentRunActivity>('idle');
  const [runTerminalNotice, setRunTerminalNotice] = useState<RunTerminalNotice | null>(null);
  const lastStreamActivityAtRef = useRef<number>(Date.now());
  const [cotOpen, setCotOpen] = useState(false);
  /** Snapshot when opening the chain-of-thought modal (structured trace or plain legacy text). */
  const [cotModalPayload, setCotModalPayload] = useState<ChainOfThoughtModalContent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [newConversationBusy, setNewConversationBusy] = useState(false);
  const [threadsSnapshot, setThreadsSnapshot] = useState<ChatThreadsSnapshot>(() => loadChatThreadsFromStorage());
  /** Latest gateway `sessions.list` token stats by `sessionKey`. */
  const [gatewaySessionTokensByKey, setGatewaySessionTokensByKey] = useState<
    Record<string, GatewaySessionTokenStats>
  >({});
  /** Default agent id from `sessions.list` / `health` (for canonical keys + usage.cost). */
  const [gatewayDefaultAgentId, setGatewayDefaultAgentId] = useState<string>('main');
  const gatewayDefaultAgentIdRef = useRef<string>('main');
  const [gatewayUsageCost, setGatewayUsageCost] = useState<ParsedGatewayUsageCost | null>(null);
  const [threadDrawerOpen, setThreadDrawerOpen] = useState(false);
  const [geminiPricingModalOpen, setGeminiPricingModalOpen] = useState(false);
  /** Ignore late `chat.history` results after the user switched threads. */
  const historyFetchGenerationRef = useRef(0);
  /** Active gateway `sessionKey` for routing incoming `chat` events (updated synchronously on switch). */
  const routingSessionKeyRef = useRef<string>('');
  /** Non-answer signals for the current turn; flushed on `onAssistantFinal`. */
  const recentThoughtsRef = useRef<ThoughtItem[]>([]);
  /** Bumped when the ref gains items so render re-runs and CoT affordance reads fresh `recentThoughtsRef`. */
  const [thoughtBufferRevision, setThoughtBufferRevision] = useState(0);
  const traceSeqRef = useRef(0);
  const sessionKeyPinnedByBuild = isGatewaySessionKeyPinnedByBuild();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const activeThread = useMemo(
    () => threadsSnapshot.threads.find((t) => t.threadId === threadsSnapshot.activeThreadId),
    [threadsSnapshot]
  );

  const sortedThreads = useMemo(
    () => [...threadsSnapshot.threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threadsSnapshot.threads]
  );

  /** `null` when the gateway has not reported totals for this thread yet (e.g. brand-new chat). */
  const activeThreadTokenSegment = useMemo((): string | null => {
    if (!activeThread) return null;
    const n =
      displayTotalTokens(gatewaySessionTokensByKey[activeThread.sessionKey]) ??
      activeThread.cachedGatewayTotalTokens;
    return n !== undefined ? `${n.toLocaleString()} tokens` : null;
  }, [activeThread, gatewaySessionTokensByKey]);

  const activeMessageCount = useMemo(
    () =>
      computeThreadMessageCount(messages, {
        omitTrailingEmptyAssistantPlaceholder: false,
      }),
    [messages]
  );

  const sessionGeminiEstimateUsd = useMemo(() => sumMessageEstimatedUsd(messages), [messages]);

  const refreshGatewaySessionTokens = useCallback(async () => {
    try {
      const raw = await fetchGatewaySessionsList();
      logGatewaySessionsListCostProbe(raw, { activeSessionKey: routingSessionKeyRef.current || undefined });
      const agentFromList = extractDefaultAgentIdFromSessionsListPayload(raw);
      if (agentFromList) {
        gatewayDefaultAgentIdRef.current = agentFromList;
        setGatewayDefaultAgentId(agentFromList);
      }
      const map = extractSessionTokenStatsByKey(raw);
      setGatewaySessionTokensByKey(map);
      setThreadsSnapshot((previousSnapshot) => {
        const merged = updateThreadCachedGatewayTokensInSnapshot(previousSnapshot, map);
        const out = sessionKeyPinnedByBuild ? collapseThreadsSnapshotForPinnedSessionKey(merged) : merged;
        persistChatThreadsSnapshot(out);
        return out;
      });

      let mergedCost: ParsedGatewayUsageCost = {};
      const agentId = agentFromList ?? gatewayDefaultAgentIdRef.current ?? 'main';
      gatewayDefaultAgentIdRef.current = agentId;

      try {
        const unscoped = await fetchGatewayUsageCost({});
        logGatewayUsageCostProbe(unscoped, {});
        mergedCost = mergeParsedGatewayUsageCost(mergedCost, parseGatewayUsageCostPayload(unscoped));
      } catch (costErr) {
        console.warn('[OpenClaw gateway] usage.cost (unscoped) failed:', costErr);
      }

      const uiKey = routingSessionKeyRef.current?.trim();
      if (uiKey) {
        try {
          const canonical = canonicalOpenClawSessionKey(uiKey, agentId);
          const scoped = await fetchGatewayUsageCost({ sessionKey: canonical });
          logGatewayUsageCostProbe(scoped, { sessionKey: canonical });
          mergedCost = mergeParsedGatewayUsageCost(mergedCost, parseGatewayUsageCostPayload(scoped));
        } catch (scopedErr) {
          console.warn('[OpenClaw gateway] usage.cost (sessionKey) failed:', scopedErr);
        }
      }

      const hasCostData =
        mergedCost.aggregateUsd !== undefined ||
        (mergedCost.bySessionKey !== undefined && Object.keys(mergedCost.bySessionKey).length > 0);
      setGatewayUsageCost(hasCostData ? mergedCost : null);
    } catch (err) {
      console.warn('[OpenClaw gateway] sessions.list failed:', err);
    }
  }, [sessionKeyPinnedByBuild]);

  const refreshGatewaySessionTokensRef = useRef(refreshGatewaySessionTokens);
  useLayoutEffect(() => {
    refreshGatewaySessionTokensRef.current = refreshGatewaySessionTokens;
  }, [refreshGatewaySessionTokens]);

  const sessionsListDebounceRef = useRef<number | null>(null);
  const scheduleRefreshGatewaySessionTokens = useCallback((delayMs: number) => {
    if (sessionsListDebounceRef.current !== null) window.clearTimeout(sessionsListDebounceRef.current);
    sessionsListDebounceRef.current = window.setTimeout(() => {
      sessionsListDebounceRef.current = null;
      void refreshGatewaySessionTokensRef.current();
    }, delayMs);
  }, []);

  const commitThreadsSnapshot = useCallback(
    (next: ChatThreadsSnapshot) => {
      const out = sessionKeyPinnedByBuild ? collapseThreadsSnapshotForPinnedSessionKey(next) : next;
      persistChatThreadsSnapshot(out);
      setThreadsSnapshot(out);
    },
    [sessionKeyPinnedByBuild]
  );

  useLayoutEffect(() => {
    routingSessionKeyRef.current = activeThread?.sessionKey ?? '';
  }, [activeThread?.sessionKey]);

  useLayoutEffect(() => {
    gatewayDefaultAgentIdRef.current = gatewayDefaultAgentId;
  }, [gatewayDefaultAgentId]);

  useEffect(() => {
    const threadId = activeThread?.threadId;
    if (!threadId) return;
    const messageCount = activeMessageCount;
    const timeoutId = window.setTimeout(() => {
      setThreadsSnapshot((previousSnapshot) => {
        const currentRow = previousSnapshot.threads.find((t) => t.threadId === threadId);
        if (currentRow?.cachedMessageCount === messageCount) {
          return previousSnapshot;
        }
        const merged = updateThreadCachedMessageCountInSnapshot(previousSnapshot, threadId, messageCount);
        const out = sessionKeyPinnedByBuild ? collapseThreadsSnapshotForPinnedSessionKey(merged) : merged;
        persistChatThreadsSnapshot(out);
        return out;
      });
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [activeMessageCount, activeThread?.threadId, sessionKeyPinnedByBuild]);

  useEffect(() => {
    if (connectionStatus !== 'ready' || !activeThread?.threadId) return;
    scheduleRefreshGatewaySessionTokens(150);
  }, [activeThread?.threadId, connectionStatus, scheduleRefreshGatewaySessionTokens]);

  useEffect(() => {
    agentActivityRef.current = agentActivity;
  }, [agentActivity]);

  const touchStreamActivity = () => {
    lastStreamActivityAtRef.current = Date.now();
  };

  const syncStateFromFetchedHistory = useCallback((history: FetchedChatMessage[]) => {
    setMessages(foldFetchedHistoryToMessages(history));
  }, []);

  const appendLiveThoughtItem = useCallback((item: ThoughtItem) => {
    const prev = recentThoughtsRef.current;
    const next = appendThoughtItem(prev, item);
    recentThoughtsRef.current = next;
    if (next !== prev) {
      setThoughtBufferRevision((revision) => revision + 1);
    }
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
      getActiveChatSessionKey: () => routingSessionKeyRef.current || undefined,
      onMessage: (message) => {
        if (import.meta.env.DEV) {
          console.log('[OpenClaw gateway] generic message:', message);
        }
        const envelope = message as { type?: string; event?: string; payload?: unknown };
        if (envelope.type === 'event' && envelope.event === 'health' && envelope.payload !== undefined) {
          const fromHealth = extractDefaultAgentIdFromHealthPayload(envelope.payload);
          if (fromHealth) {
            gatewayDefaultAgentIdRef.current = fromHealth;
            setGatewayDefaultAgentId(fromHealth);
          }
        }
      },
      onReasoning: (chunk) => {
        touchStreamActivity();
        setAgentActivity((prev) => nextActivityFromReasoningChunk(prev));
        const safe = sanitizeDisplayText(chunk);
        appendLiveThoughtItem({
          kind: 'reasoningChunk',
          text: safe,
        });
      },
      onChatDelta: (info) => {
        touchStreamActivity();
        setAgentActivity((prev) => nextActivityFromDeltaHints(prev, info.hints));
        if (info.lastToolSummary) {
          appendLiveThoughtItem({
            kind: 'toolHint',
            label: info.lastToolSummary,
          });
        }
      },
      onAgentStreamToolHint: (label) => {
        touchStreamActivity();
        const trimmed = sanitizeDisplayText(label).trim();
        if (trimmed) {
          appendLiveThoughtItem({
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
        const bufferSnapshot = [...recentThoughtsRef.current];
        recentThoughtsRef.current = [];
        setThoughtBufferRevision((r) => r + 1);
        traceSeqRef.current += 1;
        const traceId = `trace-${Date.now()}-${traceSeqRef.current}`;
        setMessages((prev) =>
          applyAssistantFinalWithThoughtBuffer(prev, payload, bufferSnapshot, traceId)
        );
      },
      onChatTerminal: (info) => {
        setAgentActivity('idle');
        recentThoughtsRef.current = [];
        setThoughtBufferRevision((r) => r + 1);
        touchStreamActivity();
        scheduleRefreshGatewaySessionTokens(300);
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
        void refreshGatewaySessionTokensRef.current();
        const sessionKeyWhenHistoryRequested = routingSessionKeyRef.current;
        fetchChatHistory(100, sessionKeyWhenHistoryRequested || undefined)
          .then((history) => {
            if (routingSessionKeyRef.current !== sessionKeyWhenHistoryRequested) return;
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
        recentThoughtsRef.current = [];
        setThoughtBufferRevision((r) => r + 1);
      },
    });
    return () => {
      if (sessionsListDebounceRef.current !== null) window.clearTimeout(sessionsListDebounceRef.current);
      disconnectGateway();
    };
  }, [tokenReady, syncStateFromFetchedHistory, scheduleRefreshGatewaySessionTokens, appendLiveThoughtItem]);

  const openChainOfThoughtModal = useCallback((content: ChainOfThoughtModalContent) => {
    setCotModalPayload(content);
    setCotOpen(true);
  }, []);

  const liveThoughtItems = useMemo(
    () => [...recentThoughtsRef.current],
    [thoughtBufferRevision]
  );

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
    setThoughtBufferRevision((r) => r + 1);
    setRunTerminalNotice(null);
    setAgentActivity('idle');
    setCotOpen(false);
    setCotModalPayload(null);
    lastStreamActivityAtRef.current = Date.now();
  };

  const startNewConversationThread = async () => {
    setNewConversationBusy(true);
    try {
      const newSessionKey = generateWebchatSessionKey();
      const label = nextThreadLabel(threadsSnapshot);
      const nextSnapshot = addThreadToSnapshot(threadsSnapshot, label, newSessionKey);
      routingSessionKeyRef.current = newSessionKey;
      const fetchGeneration = ++historyFetchGenerationRef.current;
      commitThreadsSnapshot(nextSnapshot);
      resetLocalChatState();
      const history = await fetchChatHistory(100, newSessionKey);
      if (fetchGeneration !== historyFetchGenerationRef.current) return;
      syncStateFromFetchedHistory(history);
    } catch (err) {
      console.error('[OpenClaw gateway] new chat / chat.history failed:', err);
    } finally {
      setNewConversationBusy(false);
    }
  };

  const handleSelectThread = (threadId: string) => {
    if (threadId === threadsSnapshot.activeThreadId) {
      setThreadDrawerOpen(false);
      return;
    }
    const target = threadsSnapshot.threads.find((t) => t.threadId === threadId);
    if (!target) return;
    const fetchGeneration = ++historyFetchGenerationRef.current;
    routingSessionKeyRef.current = target.sessionKey;
    commitThreadsSnapshot(setActiveThreadInSnapshot(threadsSnapshot, threadId));
    resetLocalChatState();
    setThreadDrawerOpen(false);
    fetchChatHistory(100, target.sessionKey)
      .then((history) => {
        if (fetchGeneration !== historyFetchGenerationRef.current) return;
        syncStateFromFetchedHistory(history);
      })
      .catch((err) => {
        console.error('[OpenClaw gateway] chat.history failed on thread switch:', err);
      });
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    if (connectionStatus !== 'ready') {
      setConnectionError('Not connected. Please wait for the gateway to connect.');
      return;
    }
    const sessionKeyForSend = activeThread?.sessionKey;
    if (!sessionKeyForSend) {
      setConnectionError('No active conversation. Pick a thread from the list.');
      return;
    }

    setThreadsSnapshot((previousSnapshot) => {
      const touched = touchThreadInSnapshot(previousSnapshot, previousSnapshot.activeThreadId);
      const nextSnapshot = sessionKeyPinnedByBuild
        ? collapseThreadsSnapshotForPinnedSessionKey(touched)
        : touched;
      persistChatThreadsSnapshot(nextSnapshot);
      return nextSnapshot;
    });

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    recentThoughtsRef.current = [];
    setThoughtBufferRevision((r) => r + 1);
    setRunTerminalNotice(null);
    setAgentActivity('pending');
    touchStreamActivity();

    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: aiMsgId, role: 'ai', kind: 'assistant', content: '' },
    ]);

    sendChatMessage(text, { sessionKey: sessionKeyForSend });
  };

  const threadDrawer = (
    <Box sx={{ width: THREAD_DRAWER_WIDTH, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar
        variant="dense"
        disableGutters
        sx={{
          minHeight: 48,
          px: 1.5,
          pr: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.5,
        }}
      >
        <Typography variant="subtitle2" component="p" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
          Conversations
        </Typography>
        <Tooltip
          title={
            sessionKeyPinnedByBuild
              ? 'Session key is fixed in the build (VITE_OPENCLAW_SESSION_KEY). Remove it in .env.local to start new chats from this UI.'
              : newConversationBusy
                ? 'Creating conversation…'
                : 'New conversation'
          }
        >
          <span>
            <IconButton
              size="small"
              color="inherit"
              edge="end"
              aria-label="New conversation"
              disabled={
                connectionStatus !== 'ready' ||
                isAgentRunBlockingInput(agentActivity) ||
                sessionKeyPinnedByBuild ||
                newConversationBusy
              }
              onClick={() => void startNewConversationThread()}
            >
              <AddCommentIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Toolbar>
      <List dense sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
        {sortedThreads.map((thread) => {
          const isRowActive = thread.threadId === threadsSnapshot.activeThreadId;
          const messageCountForRow = isRowActive
            ? activeMessageCount
            : (thread.cachedMessageCount ?? 0);
          const tokenTotalForRow =
            displayTotalTokens(gatewaySessionTokensByKey[thread.sessionKey]) ??
            thread.cachedGatewayTotalTokens;
          const rowCostUsd =
            gatewayUsageCost !== null
              ? sessionOnlyUsageCostUsd(thread.sessionKey, gatewayUsageCost, gatewayDefaultAgentId)
              : undefined;
          const costSuffix = rowCostUsd !== undefined ? ` · ${formatUsdEstimate(rowCostUsd)}` : '';
          const tokenPart =
            tokenTotalForRow !== undefined ? ` · ${tokenTotalForRow.toLocaleString()} tokens` : '';
          return (
            <ListItemButton
              key={thread.threadId}
              selected={isRowActive}
              onClick={() => handleSelectThread(thread.threadId)}
            >
              <ListItemText
                primary={thread.label}
                secondary={`${messageCountForRow} msgs${tokenPart}${costSuffix}`}
                primaryTypographyProps={{ noWrap: true }}
                secondaryTypographyProps={{
                  sx: {
                    fontSize: '0.62rem',
                    opacity: 0.88,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.35,
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
      <Box
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: 'divider',
          px: 1,
          py: 0.75,
        }}
      >
        <Button
          size="small"
          variant="text"
          color="inherit"
          fullWidth
          sx={{ fontSize: '0.72rem', justifyContent: 'center' }}
          onClick={() => setGeminiPricingModalOpen(true)}
        >
          Model pricing
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {isMobile ? (
        <Drawer
          anchor="left"
          open={threadDrawerOpen}
          onClose={() => setThreadDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
        >
          {threadDrawer}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          open
          sx={{
            width: THREAD_DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: THREAD_DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          {threadDrawer}
        </Drawer>
      )}
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
        <Paper elevation={0} sx={{ py: 0.75, px: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns:
                connectionStatus === 'ready' && activeThread
                  ? 'minmax(0, 1fr) max-content'
                  : 'minmax(0, 1fr)',
              alignItems: 'start',
              columnGap: 1.25,
              rowGap: 0.35,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              {isMobile && (
                <IconButton
                  color="inherit"
                  size="small"
                  aria-label="Open conversation list"
                  onClick={() => setThreadDrawerOpen(true)}
                  sx={{ p: 0.5, flexShrink: 0, opacity: 0.92 }}
                >
                  <MenuIcon fontSize="small" />
                </IconButton>
              )}
              <Typography
                component="h1"
                sx={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  p: 0,
                  m: '-1px',
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              >
                OpenClaw
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 0.5,
                  columnGap: 1,
                  minWidth: 0,
                }}
              >
                <Typography
                  variant="caption"
                  component="span"
                  sx={{ opacity: 0.72, fontSize: '0.68rem', letterSpacing: '0.02em' }}
                >
                  {appVersion}
                </Typography>
                {connectionStatus === 'connecting' && (
                  <Typography variant="caption" component="span" sx={{ opacity: 0.88, fontSize: '0.68rem' }}>
                    Connecting…
                  </Typography>
                )}
                {connectionStatus === 'disconnected' && connectionError && (
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{ opacity: 0.88, fontSize: '0.68rem', lineHeight: 1.3 }}
                  >
                    {connectionError}
                  </Typography>
                )}
                {connectionStatus === 'error' && connectionError && (
                  <Typography variant="caption" component="span" sx={{ opacity: 0.88, fontSize: '0.68rem' }}>
                    {connectionError}
                  </Typography>
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
                    sx={{
                      height: 20,
                      maxWidth: '100%',
                      fontSize: '0.65rem',
                      '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                    }}
                  />
                )}
              </Box>
            </Box>
            {connectionStatus === 'ready' && activeThread && (
              <Box sx={{ justifySelf: 'end', minWidth: 0, alignSelf: 'start' }}>
                <Typography
                  variant="caption"
                  component="span"
                  sx={{
                    display: 'block',
                    m: 0,
                    pt: 0.125,
                    opacity: 0.7,
                    fontSize: '0.68rem',
                    lineHeight: 1.35,
                    letterSpacing: '0.01em',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    maxWidth: 'min(280px, 42vw)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activeMessageCount} messages
                  {activeThreadTokenSegment ? ` · ${activeThreadTokenSegment}` : ''}
                  {sessionGeminiEstimateUsd !== undefined
                    ? ` · ${formatUsdSessionClientTotal(sessionGeminiEstimateUsd)}`
                    : ''}
                </Typography>
              </Box>
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
          data-live-thought-revision={thoughtBufferRevision}
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
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <UserChatBubble key={msg.id} message={msg} />
            ) : (
              <AgentChatBubble
                key={msg.id}
                messageText={msg.content}
                thoughtItems={liveThoughtItems}
                openChainOfThoughtModal={openChainOfThoughtModal}
              />
            )
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
      <GoogleGeminiPricingModal
        open={geminiPricingModalOpen}
        onClose={() => setGeminiPricingModalOpen(false)}
      />
    </Box>
  );
}
