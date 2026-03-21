import React, { useState } from 'react';
import { TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { styled } from '@mui/material/styles';

const StyledForm = styled('form')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'flex-end',
}));

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Custom wrapper around MUI TextField for the chat input.
 * Abstracts out standard behavior (enter to send) and styling.
 */
export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  disabled,
  placeholder = 'Send a message to OpenClaw…',
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <StyledForm onSubmit={handleSubmit}>
      <TextField
        fullWidth
        multiline
        maxRows={4}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        variant="outlined"
        size="small"
        sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
      />
      <IconButton 
        color="primary" 
        type="submit" 
        disabled={!text.trim() || disabled}
        sx={{ bgcolor: 'primary.light', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' } }}
      >
        <SendIcon />
      </IconButton>
    </StyledForm>
  );
};
