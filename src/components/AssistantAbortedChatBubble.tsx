import React from 'react';
import { Box, Link, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ChainOfThoughtModalContent } from './ChainOfThoughtModal';
import type { ThoughtItem } from '../chatThreadTypes';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import { MarkdownMessage } from './MarkdownMessage';
import { ChatBubblePaper } from './atoms/ChatBubblePaper';

export interface AssistantAbortedChatBubbleProps {
  messageText: string;
  thoughtItems: ThoughtItem[];
  openChainOfThoughtModal?: (content: ChainOfThoughtModalContent) => void;
}

export function AssistantAbortedChatBubble(props: AssistantAbortedChatBubbleProps): React.ReactNode {
  const safeMessage = sanitizeDisplayText(props.messageText || '');
  const hasThoughts = props.thoughtItems.length > 0;

  return (
    <Box sx={agentBubbleSx}>
      <ChatBubblePaper messageRole="ai" elevation={0}>
        {props.openChainOfThoughtModal && hasThoughts && (
          <Link
            component="button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              props.openChainOfThoughtModal?.({ mode: 'structured', thoughtItems: props.thoughtItems });
            }}
            underline="always"
            sx={thoughtProcessLinkSx}
          >
            thought process
          </Link>
        )}

        <Typography variant="caption" sx={abortedLabelSx}>
          Request aborted.
        </Typography>

        {safeMessage && (
          <Box sx={contentColumnSx}>
            <MarkdownMessage tone="assistant">{safeMessage}</MarkdownMessage>
          </Box>
        )}
      </ChatBubblePaper>
    </Box>
  );
}

// =============================================================================
// Styles
// =============================================================================

const agentBubbleSx: SxProps<Theme> = {
  display: 'flex',
  justifyContent: 'flex-start',
  mb: 1,
  maxWidth: '100%',
  minWidth: 0,
};

const contentColumnSx: SxProps<Theme> = {
  flex: 1,
  minWidth: 0,
  maxWidth: '100%',
};

const abortedLabelSx: SxProps<Theme> = (theme) => ({
  color: theme.palette.warning.dark,
  fontWeight: 600,
  mb: 0.5,
});

const thoughtProcessLinkSx: SxProps<Theme> = (theme) => ({
  alignSelf: 'flex-start',
  p: 0,
  m: 0,
  minHeight: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.4375rem',
  fontWeight: 500,
  lineHeight: 1.1,
  textUnderlineOffset: '1px',
  color: theme.palette.mode === 'dark' ? '#c4b5fd' : '#6d28d9',
  '&:hover': {
    color: theme.palette.mode === 'dark' ? '#e9d5ff' : '#5b21b6',
  },
});

