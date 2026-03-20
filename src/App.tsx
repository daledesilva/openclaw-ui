import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Drawer, useMediaQuery, Theme } from '@mui/material';
import { ChatBubble } from './components/ChatBubble';
import { MessageInput } from './components/MessageInput';
import { ChainOfThoughtSheet } from './components/ChainOfThoughtSheet';
import { initGatewayConnection, sendMessageToGateway } from './api/gateway';
import conversationHistory from './history.json';

// Define a more specific type for imported history
interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  reasoning?: string;
}

// Helper to convert history to the app's message format
const mapHistoryToMessages = (history: HistoryMessage[]): Message[] => {
  return history.map((msg, index) => ({
    id: `hist-${index}`,
    role: msg.role === 'assistant' ? 'ai' : 'user',
    content: msg.content,
  }));
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeReasoning, setActiveReasoning] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const [cotSheetOpen, setCotSheetOpen] = useState(false);
  
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const lastReasoningLine = activeReasoning.trim().split('\n').pop() || '';

  useEffect(() => {
    // Load initial history
    setMessages(mapHistoryToMessages(conversationHistory as HistoryMessage[]));

    // Initialize WebSocket connection
    initGatewayConnection({
      onMessage: (message) => console.log('Received generic message:', message),
      onReasoning: (chunk) => {
        setIsThinking(true);
        setActiveReasoning(prev => prev + chunk);
      },
      onContent: (chunk) => {
        setIsThinking(false);
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'ai') {
            // Append content to the last AI message
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
    });
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    
    // Reset for new response
    setActiveReasoning('');
    setIsThinking(true);
    
    // Create a placeholder for the AI's response
    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', content: '', reasoning: '' }]);
    
    sendMessageToGateway(text);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Main Chat Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 0 }}>
          <Typography variant="h6">OpenClaw UI</Typography>
        </Paper>
        
        <Box sx={{ flex: 1, overflowY: 'auto', p: isMobile ? 2 : 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {messages.map((msg) => (
            <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isThinking && isMobile && (
            <ChatBubble 
              role="ai" 
              content={lastReasoningLine || "Thinking..."} 
              isThinking={true}
              onClick={() => setCotSheetOpen(true)} 
            />
          )}
        </Box>

        <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
          <MessageInput onSend={handleSend} disabled={isThinking} />
        </Box>
      </Box>

      {/* Reasoning Side Panel (Desktop Only) */}
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
            <Typography variant="subtitle1" fontWeight="bold">Chain of Thought</Typography>
          </Box>
          <Box sx={{ p: 2, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#555', whiteSpace: 'pre-wrap' }}>
            {activeReasoning || 'Awaiting task...'}
          </Box>
        </Drawer>
      )}

      {/* Reasoning Bottom Sheet (Mobile Only) */}
      <ChainOfThoughtSheet
        open={cotSheetOpen}
        onClose={() => setCotSheetOpen(false)}
        onOpen={() => setCotSheetOpen(true)}
        reasoning={activeReasoning}
      />
    </Box>
  );
}
