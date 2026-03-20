import React from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

const BubblePaper = styled(Paper)<{ isUser: boolean, isThinking?: boolean }>(({ theme, isUser, isThinking }) => ({
  padding: theme.spacing(1.5, 2),
  maxWidth: '85%',
  borderRadius: '16px',
  backgroundColor: isUser ? theme.palette.primary.main : (isThinking ? theme.palette.grey[100] : theme.palette.background.paper),
  color: isUser ? theme.palette.primary.contrastText : (isThinking ? theme.palette.text.secondary : theme.palette.text.primary),
  borderBottomRightRadius: isUser ? 4 : 16,
  borderTopLeftRadius: isUser ? 16 : 4,
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  cursor: isThinking ? 'pointer' : 'default',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

interface ChatBubbleProps {
  role: 'user' | 'ai';
  content: string;
  isThinking?: boolean;
  onClick?: () => void;
}

/**
 * Custom wrapper for MUI components providing a chat bubble UI.
 * This abstraction allows mass UI customization across the app.
 * It now supports a special 'isThinking' state for mobile CoT view.
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content, isThinking, onClick }) => {
  const isUser = role === 'user';
  
  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 1 }} onClick={onClick}>
      <BubblePaper isUser={isUser} isThinking={isThinking} elevation={0}>
        {isThinking && <CircularProgress size={16} color="inherit" />}
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontStyle: isThinking ? 'italic' : 'normal' }}>
          {content || '...'}
        </Typography>
      </BubblePaper>
    </Box>
  );
};
