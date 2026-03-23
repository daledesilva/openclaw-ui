import React from 'react';
import { Box, CircularProgress, Link } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ChainOfThoughtModalContent } from './ChainOfThoughtModal';
import type { ThoughtItem } from '../chatThreadTypes';
import { deriveRecentToolSummaryLine } from '../utils/thoughtProcessing';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import { MarkdownMessage } from './MarkdownMessage';
import { ChatBubblePaper } from './atoms/ChatBubblePaper';

//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

export interface AgentChatBubbleProps {
  messageText: string | null;
  thoughtItems: ThoughtItem[];
  openChainOfThoughtModal?: (content: ChainOfThoughtModalContent) => void;
}

export function AgentChatBubble(props: AgentChatBubbleProps): React.ReactNode {
  
  let isThinking = true;
  let message = '';
  if(props.messageText) {
    isThinking = false;
    message = sanitizeDisplayText(props.messageText || deriveRecentToolSummaryLine(props.thoughtItems) || '');
  }

  return (
    <Box sx={agentBubbleSx}>
      <ChatBubblePaper messageRole="ai" elevation={0}>
        {props.openChainOfThoughtModal && (
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
        <Box sx={bodyRowSx}>
          {isThinking && (
            <CircularProgress size={16} color="inherit" sx={spinnerSx} />
          )}
          <Box sx={contentColumnSx}>
            {message && (
              <MarkdownMessage tone="assistant">
                {message}
              </MarkdownMessage>
            )}
          </Box>
        </Box>
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

const bodyRowSx: SxProps<Theme> = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 1.5,
  minWidth: 0,
  maxWidth: '100%',
};

const spinnerSx: SxProps<Theme> = {
  mt: 0.25,
  flexShrink: 0,
};

const contentColumnSx: SxProps<Theme> = {
  flex: 1,
  minWidth: 0,
  maxWidth: '100%',
};

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
