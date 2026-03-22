import React from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import { MarkdownMessage } from './MarkdownMessage';
import { ChatBubblePaper } from './atoms/ChatBubblePaper';

//////////////////////////////////////////////////////
//////////////////////////////////////////////////////

export interface UserChatBubbleProps {
  messageText: string;
}

export function UserChatBubble(props: UserChatBubbleProps): React.ReactNode {
  const safeContent = sanitizeDisplayText(props.messageText || '');
  const hasStreamedText = !!safeContent.trim();

  return (
    <Box sx={outerSx}>
      <ChatBubblePaper messageRole="user" elevation={0}>
        <Box sx={bodyRowSx}>
          <Box sx={contentColumnSx}>
            {hasStreamedText && (
              <MarkdownMessage tone="user" isError={undefined}>
                {safeContent}
              </MarkdownMessage>
            )}
            {!hasStreamedText && (
              <Typography variant="body1" sx={ellipsisTypographySx}>
                …
              </Typography>
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

const outerSx: SxProps<Theme> = {
  display: 'flex',
  justifyContent: 'flex-end',
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

const contentColumnSx: SxProps<Theme> = {
  flex: 1,
  minWidth: 0,
  maxWidth: '100%',
};

const ellipsisTypographySx: SxProps<Theme> = {
  whiteSpace: 'pre-wrap',
};
