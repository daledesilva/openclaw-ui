import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  Box,
  Typography,
  useMediaQuery,
  Theme,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
} from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';
import { AgentChatBubble } from './components/AgentChatBubble';
import { AssistantAbortedChatBubble } from './components/AssistantAbortedChatBubble';
import { AssistantErrorChatBubble } from './components/AssistantErrorChatBubble';
import { ChatHeader, type RunTerminalNotice } from './components/ChatHeader';
import { UserChatBubble } from './components/UserChatBubble';
import { MessageInput } from './components/MessageInput';
import { ChainOfThoughtModal, type ChainOfThoughtModalContent } from './components/ChainOfThoughtModal';
import { GoogleGeminiPricingModal } from './components/GoogleGeminiPricingModal';
import { TokenSetupScreen } from './components/TokenSetupScreen';
import { useChatMessageThread } from './utils/recentThoughtsReducer';
import { MOCK_ALL_BUBBLES_SESSION_KEY } from './mocks/mockChatHistory/mockAllBubblesRawHistoryItems';
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
import { useLiveAppVersion } from './useLiveAppVersion';
import { sumMessageEstimatedUsd } from './utils/geminiPricingEstimate';
import {
  type AssistantRunChromeState,
  inputPlaceholderForAssistantRun,
  isAssistantRunBlockingInput,
} from './utils/assistantRunChrome';

export type { ChatMessage as Message } from './chatThreadTypes';

type ConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

/** Default watchdog when no stream activity (ms). */
const AGENT_RUN_STALE_AFTER_MS = 90_000;

const THREAD_DRAWER_WIDTH = 268;

export default function App() {
  const appVersion = useLiveAppVersion();
  const [tokenReady, setTokenReady] = useState(hasGatewayToken());
  const lastStreamActivityAtRef = useRef<number>(Date.now());
  const touchStreamActivity = useCallback(() => {
    lastStreamActivityAtRef.current = Date.now();
  }, []);
  const {
    messages,
    handleStreamEvent,
    replaceFromFetchedHistory,
  } = useChatMessageThread();
  const [assistantRunChrome, setAssistantRunChrome] = useState<AssistantRunChromeState>('idle');
  const assistantRunChromeRef = useRef<AssistantRunChromeState>('idle');
  const [runTerminalNotice, setRunTerminalNotice] = useState<RunTerminalNotice | null>(null);
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
  const scheduleRefreshSessionMeta = useCallback((delayMs: number) => {
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
    scheduleRefreshSessionMeta(150);
  }, [activeThread?.threadId, connectionStatus, scheduleRefreshSessionMeta]);

  // Dev-only: load mock bubbles immediately when the active thread is the mock session.
  // This keeps the UI usable even if the gateway websocket never becomes `ready`.
  useEffect(() => {
    if (activeThread?.sessionKey !== MOCK_ALL_BUBBLES_SESSION_KEY) return;
    const fetchGeneration = ++historyFetchGenerationRef.current;
    void fetchChatHistory(100, activeThread.sessionKey)
      .then((history) => {
        if (fetchGeneration !== historyFetchGenerationRef.current) return;
        replaceFromFetchedHistory(history);
      })
      .catch((err) => {
        console.error('[OpenClaw gateway] mock chat.history failed:', err);
      });
  }, [activeThread?.sessionKey, replaceFromFetchedHistory]);

  useEffect(() => {
    assistantRunChromeRef.current = assistantRunChrome;
  }, [assistantRunChrome]);

  useEffect(() => {
    if (assistantRunChrome === 'idle' || assistantRunChrome === 'stale') return;
    const tick = () => {
      if (Date.now() - lastStreamActivityAtRef.current >= AGENT_RUN_STALE_AFTER_MS) {
        setAssistantRunChrome('stale');
      }
    };
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [assistantRunChrome]);

  useEffect(() => {
    if (!tokenReady) return;
    initGatewayConnection({
      getActiveChatSessionKey: () => routingSessionKeyRef.current || undefined,
      onEvent: (frame) => {
        console.log('[EVENT] onEvent', frame);
        if (import.meta.env.DEV) {
          console.log('[OpenClaw gateway] event frame:', frame);
        }
        if (frame.event === 'health' && frame.payload !== undefined) {
          const fromHealth = extractDefaultAgentIdFromHealthPayload(frame.payload);
          if (fromHealth) {
            gatewayDefaultAgentIdRef.current = fromHealth;
            setGatewayDefaultAgentId(fromHealth);
          }
        }
        handleStreamEvent(frame);
        scheduleRefreshSessionMeta(300);
      },
      onConnected: () => {
        console.log('[EVENT] onConnected');
        setConnectionStatus('ready');
        setConnectionError(null);
        void refreshGatewaySessionTokensRef.current();
        const sessionKeyWhenHistoryRequested = routingSessionKeyRef.current;
        fetchChatHistory(100, sessionKeyWhenHistoryRequested || undefined)
          .then((_history) => {
            if (routingSessionKeyRef.current !== sessionKeyWhenHistoryRequested) return;
            replaceFromFetchedHistory(_history);
          })
          .catch((err) => {
            console.error('[OpenClaw gateway] chat.history failed:', err);
          });
      },
      onConnectError: (error) => {
        console.log('[EVENT] onConnectError', error);
        setConnectionStatus('error');
        setConnectionError(error);
      },
      onDisconnected: () => {
        console.log('[EVENT] onDisconnected');
        setConnectionStatus('disconnected');
        setConnectionError('Disconnected from gateway.');
        setAssistantRunChrome('idle');
      },
    });
    return () => {
      if (sessionsListDebounceRef.current !== null) window.clearTimeout(sessionsListDebounceRef.current);
      disconnectGateway();
    };
  }, [tokenReady, scheduleRefreshSessionMeta, handleStreamEvent]);

  const openChainOfThoughtModal = useCallback((content: ChainOfThoughtModalContent) => {
    setCotModalPayload(content);
    setCotOpen(true);
  }, []);

  if (!tokenReady) {
    return <TokenSetupScreen onTokenSet={() => setTokenReady(true)} />;
  }

  const handleReenterToken = () => {
    clearStoredGatewayToken();
    setTokenReady(false);
  };

  const resetLocalChatState = () => {
    setRunTerminalNotice(null);
    setAssistantRunChrome('idle');
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
      const _history = await fetchChatHistory(100, newSessionKey);
      if (fetchGeneration !== historyFetchGenerationRef.current) return;
      replaceFromFetchedHistory(_history);
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
      .then((_history) => {
        if (fetchGeneration !== historyFetchGenerationRef.current) return;
        replaceFromFetchedHistory(_history);
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

    setRunTerminalNotice(null);
    setAssistantRunChrome('running');
    touchStreamActivity();


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
                isAssistantRunBlockingInput(assistantRunChrome) ||
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
        <ChatHeader
          appVersion={appVersion}
          connectionStatus={connectionStatus}
          isMobile={isMobile}
          onOpenThreadDrawer={() => setThreadDrawerOpen(true)}
          connectionError={connectionError}
          runTerminalNotice={runTerminalNotice}
          onDismissRunTerminalNotice={() => setRunTerminalNotice(null)}
          showThreadStats={connectionStatus === 'ready' && Boolean(activeThread)}
          activeMessageCount={activeMessageCount}
          activeThreadTokenSegment={activeThreadTokenSegment}
          sessionGeminiEstimateUsd={sessionGeminiEstimateUsd}
        />

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
          {messages.map((msg, messageIndex) => {
            return msg.role === 'user' ? (
              <UserChatBubble key={messageIndex} messageText={String(msg.content ?? '')} />
            ) : msg.kind === 'error' ? (
              <AssistantErrorChatBubble
                key={messageIndex}
                messageText={String(msg.content ?? '')}
                thoughtItems={msg.thoughtItems ?? []}
                openChainOfThoughtModal={(thoughtItems) => openChainOfThoughtModal(thoughtItems)}
              />
            ) : msg.kind === 'abortion' ? (
              <AssistantAbortedChatBubble
                key={messageIndex}
                messageText={String(msg.content ?? '')}
                thoughtItems={msg.thoughtItems ?? []}
                openChainOfThoughtModal={(thoughtItems) => openChainOfThoughtModal(thoughtItems)}
              />
            ) : (
              <AgentChatBubble
                key={messageIndex}
                messageText={msg.content ? String(msg.content) : null}
                thoughtItems={msg.thoughtItems ?? []}
                openChainOfThoughtModal={(thoughtItems) => openChainOfThoughtModal(thoughtItems)}
              />
            );
          })}
        </Box>

        <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
          <MessageInput
            onSend={handleSend}
            disabled={connectionStatus !== 'ready'}// || isAssistantRunBlockingInput(assistantRunChrome)}
            placeholder={inputPlaceholderForAssistantRun(assistantRunChrome, connectionStatus)}
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
