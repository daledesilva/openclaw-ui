import React from 'react';
import { Box, Typography } from '@mui/material';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import type { Message } from '../chatThreadTypes';
import { MarkdownMessage } from './MarkdownMessage';
import { SearchResultsCarousel } from './SearchResultsCarousel';
import { ChatBubblePaper } from './atoms/ChatBubblePaper';

export interface UserChatBubbleProps {
  message: Message;
}

export const UserChatBubble: React.FC<UserChatBubbleProps> = ({ message }) => {
  const safeContent = sanitizeDisplayText(message.content || '');
  const showImages = message.imageUrls && message.imageUrls.length > 0;
  const showLinks = message.linkPreviews && message.linkPreviews.length > 0;
  const hasStreamedText = !!safeContent.trim();
  const hasAnswerMedia = showLinks || showImages;
  const showsAnswer = hasStreamedText || hasAnswerMedia;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        mb: 1,
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <ChatBubblePaper messageRole="user" elevation={0}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0, maxWidth: '100%' }}>
          <Box sx={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
            {hasStreamedText ? (
              <MarkdownMessage tone="user" isError={undefined}>
                {safeContent}
              </MarkdownMessage>
            ) : null}
            {!hasStreamedText && !showsAnswer ? (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                …
              </Typography>
            ) : null}
            {showLinks ? <SearchResultsCarousel linkPreviews={message.linkPreviews!} /> : null}
            {showImages ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 1,
                  mt: 1,
                  overflowX: 'auto',
                  pb: 0.5,
                  maxWidth: '100%',
                  width: '100%',
                }}
              >
                {message.imageUrls!.map((url) => (
                  <Box
                    key={url}
                    component="img"
                    src={url}
                    alt=""
                    sx={{
                      flexShrink: 0,
                      maxHeight: 220,
                      maxWidth: 'min(100%, 320px)',
                      objectFit: 'contain',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                    }}
                  />
                ))}
              </Box>
            ) : null}
          </Box>
        </Box>
      </ChatBubblePaper>
    </Box>
  );
};
