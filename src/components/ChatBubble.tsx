import React from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import type { LinkPreview } from '../utils/extractLinkPreviews';
import { MarkdownMessage } from './MarkdownMessage';
import { SearchResultsCarousel } from './SearchResultsCarousel';

const BubblePaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'isUser' && prop !== 'isThinking' && prop !== 'isError',
})<{ isUser: boolean; isThinking?: boolean; isError?: boolean }>(({ theme, isUser, isThinking, isError }) => ({
  padding: theme.spacing(1.5, 2),
  maxWidth: '85%',
  width: '100%',
  minWidth: 0,
  borderRadius: '16px',
  backgroundColor: isUser
    ? theme.palette.primary.main
    : isThinking
      ? theme.palette.grey[100]
      : theme.palette.background.paper,
  color: isUser
    ? theme.palette.primary.contrastText
    : isThinking
      ? theme.palette.text.secondary
      : isError
        ? theme.palette.error.dark
        : theme.palette.text.primary,
  borderBottomRightRadius: isUser ? 4 : 16,
  borderTopLeftRadius: isUser ? 16 : 4,
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  borderLeft: isError ? `3px solid ${theme.palette.error.main}` : undefined,
  cursor: isThinking ? 'pointer' : 'default',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: theme.spacing(0.75),
}));

interface ChatBubbleProps {
  role: 'user' | 'ai';
  content: string;
  /** Image URLs from gateway content parts (horizontal strip below body) */
  imageUrls?: string[];
  /** Link previews extracted from structured JSON in gateway content */
  linkPreviews?: LinkPreview[];
  isThinking?: boolean;
  onClick?: () => void;
  /** e.g. gateway `senderLabel` */
  caption?: string;
  /** Assistant message that is only an error / failure */
  isError?: boolean;
}

/**
 * Custom wrapper for MUI components providing a chat bubble UI.
 * This abstraction allows mass UI customization across the app.
 * It now supports a special 'isThinking' state for mobile CoT view.
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({
  role,
  content,
  imageUrls,
  linkPreviews,
  isThinking,
  onClick,
  caption,
  isError,
}) => {
  const isUser = role === 'user';
  const safeContent = sanitizeDisplayText(content || '');
  const safeCaption = caption ? sanitizeDisplayText(caption) : '';
  const tone = isUser ? 'user' : isThinking ? 'thinking' : 'assistant';
  const showImages = imageUrls && imageUrls.length > 0;
  const showLinks = linkPreviews && linkPreviews.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 1,
        maxWidth: '100%',
        minWidth: 0,
      }}
      onClick={onClick}
    >
      <BubblePaper isUser={isUser} isThinking={isThinking} isError={isError} elevation={0}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0, maxWidth: '100%' }}>
          {isThinking && <CircularProgress size={16} color="inherit" sx={{ mt: 0.25, flexShrink: 0 }} />}
          <Box sx={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
            {safeContent.trim() ? (
              <MarkdownMessage tone={tone} isError={isError}>
                {safeContent}
              </MarkdownMessage>
            ) : isThinking ? (
              <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'inherit' }}>
                …
              </Typography>
            ) : (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                …
              </Typography>
            )}
            {showLinks ? <SearchResultsCarousel linkPreviews={linkPreviews!} /> : null}
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
                {imageUrls!.map((url) => (
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
        {safeCaption ? (
          <Typography variant="caption" sx={{ opacity: isUser ? 0.85 : 0.7, display: 'block' }}>
            {safeCaption}
          </Typography>
        ) : null}
      </BubblePaper>
    </Box>
  );
};
