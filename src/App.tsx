import { useState, useEffect } from 'react';
import { Box, Paper, Typography, Drawer, useMediaQuery, Theme, Alert, Button } from '@mui/material';
import { ChatBubble } from './components/ChatBubble';
import { MessageInput } from './components/MessageInput';
import { ChainOfThoughtSheet } from './components/ChainOfThoughtSheet';
import { TokenSetupScreen } from './components/TokenSetupScreen';
import {
  initGatewayConnection,
  sendChatMessage,
  fetchChatHistory,
  hasGatewayToken,
  clearStoredGatewayToken,
} from './api/gateway';
import { useLiveAppVersion } from './useLiveAppVersion';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  reasoning?: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

function mapHistoryToMessages(
  history: { role: string; content: string }[]
): Message[] {
  return history.map((msg, index) => ({
    id: `hist-${index}`,
    role: msg.role === 'assistant' ? 'ai' : 'user',
    content: msg.content,
  }));
}

export default function App() {
  const appVersion = useLiveAppVersion();
  const [tokenReady, setTokenReady] = useState(hasGatewayToken());
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeReasoning, setActiveReasoning] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const [cotSheetOpen, setCotSheetOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const lastReasoningLine = activeReasoning.trim().split('\n').pop() || '';

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
        setActiveReasoning((prev) => prev + chunk);
      },
      onContent: (chunk) => {
        setIsThinking(false);
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'ai') {
            const updatedMessages = [...prev];
            updatedMessages[updatedMessages.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + chunk,
            };
            return updatedMessages;
          }
          return prev;
        });
      },
      onConnected: () => {
        setConnectionStatus('ready');
        setConnectionError(null);
        fetchChatHistory()
          .then((history) => {
            setMessages(mapHistoryToMessages(history));
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
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', content: '', reasoning: '' }]);

    sendChatMessage(text);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 0 }}>
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

        <Box sx={{ flex: 1, overflowY: 'auto', p: isMobile ? 2 : 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {messages.map((msg) => (
            <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isThinking && isMobile && (
            <ChatBubble
              role="ai"
              content={lastReasoningLine || 'Thinking…'}
              isThinking={true}
              onClick={() => setCotSheetOpen(true)}
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

      {!isMobile && (
        <Drawer
          variant="permanent"
          anchor="right"
          sx={{
            width: 350,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: 350, boxSizing: 'border-box', bgcolor: '#fdfdfd' },
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: '#f0f0f0' }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Chain of Thought
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: '#555',
              whiteSpace: 'pre-wrap',
            }}
          >
            {activeReasoning || 'Awaiting task…'}
          </Box>
        </Drawer>
      )}

      <ChainOfThoughtSheet
        open={cotSheetOpen}
        onClose={() => setCotSheetOpen(false)}
        onOpen={() => setCotSheetOpen(true)}
        reasoning={activeReasoning}
      />
    </Box>
  );
}
