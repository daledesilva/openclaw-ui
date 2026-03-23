import React from 'react';
import { Box, Link, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ChainOfThoughtModalContent } from './ChainOfThoughtModal';
import type { ThoughtItem } from '../chatThreadTypes';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import { ChatBubblePaper } from './atoms/ChatBubblePaper';

export interface AssistantErrorChatBubbleProps {
  messageText: string;
  thoughtItems: ThoughtItem[];
  openChainOfThoughtModal?: (content: ChainOfThoughtModalContent) => void;
}

export function AssistantErrorChatBubble(props: AssistantErrorChatBubbleProps): React.ReactNode {
  const safeMessage = sanitizeDisplayText(props.messageText || '');
  const finalDetails = safeMessage.trim() ? safeMessage : undefined;

  return (
    <Box sx={agentBubbleSx}>
      <ChatBubblePaper messageRole="ai" elevation={0} sx={alertBubblePaperSx}>
        <Typography variant="caption" sx={errorLabelSx}>
          Request failed.
        </Typography>

        {props.openChainOfThoughtModal && (
          <Link
            component="button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              props.openChainOfThoughtModal?.({
                mode: 'structured',
                thoughtItems: props.thoughtItems,
                finalDetails,
              });
            }}
            underline="always"
            sx={thoughtProcessLinkSx}
          >
            Details
          </Link>
        )}

        {/* Body intentionally omitted: operators can open `Details` to see trace + abort/error details. */}
      </ChatBubblePaper>
    </Box>
  );
}

// =============================================================================
// Styles
// =============================================================================

const agentBubbleSx: SxProps<Theme> = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  mb: 0,
  minWidth: 0,
};

const errorLabelSx: SxProps<Theme> = (theme) => ({
  color: theme.palette.mode === 'dark' ? theme.palette.grey[300] : theme.palette.grey[700],
  fontWeight: 500,
  mb: 0,
  fontSize: '0.7rem',
  textAlign: 'center',
  whiteSpace: 'nowrap',
});

const alertBubblePaperSx: SxProps<Theme> = (theme) => ({
  // Small, fully-rounded grey "pill" for errors.
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
  color: theme.palette.mode === 'dark' ? theme.palette.grey[200] : theme.palette.grey[700],
  boxShadow: 'none',
  padding: theme.spacing(0.75, 2.5),
  maxWidth: '100%',
  width: 'fit-content',
  flexDirection: 'row',
  borderRadius: '9999px',
  borderBottomRightRadius: '9999px',
  borderTopLeftRadius: '9999px',
  borderTopRightRadius: '9999px',
  borderBottomLeftRadius: '9999px',
  alignItems: 'center',
  textAlign: 'center',
  gap: theme.spacing(0.35),
  cursor: 'default',
});

const thoughtProcessLinkSx: SxProps<Theme> = (theme) => ({
  p: 0,
  m: 0,
  minHeight: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.6rem',
  fontWeight: 500,
  lineHeight: 1.1,
  textUnderlineOffset: '1px',
  whiteSpace: 'nowrap',
  color: theme.palette.mode === 'dark' ? theme.palette.grey[300] : theme.palette.grey[600],
  '&:hover': {
    color: theme.palette.mode === 'dark' ? theme.palette.grey[200] : theme.palette.grey[800],
  },
});

