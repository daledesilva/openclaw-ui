import React from 'react';
import { Box, Paper, Typography, CircularProgress, Link } from '@mui/material';
import { styled } from '@mui/material/styles';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import type { LinkPreview } from '../utils/extractLinkPreviews';
import { MarkdownMessage } from './MarkdownMessage';
import { SearchResultsCarousel } from './SearchResultsCarousel';

export type StreamPhaseStyle = 'pending' | 'reasoning' | 'acting' | 'responding' | 'stale';

const BubblePaper = styled(Paper, {
  shouldForwardProp: (prop) =>
    prop !== 'isUser' && prop !== 'isThinking' && prop !== 'isError' && prop !== 'streamPhase',
})<{
  isUser: boolean;
  isThinking?: boolean;
  isError?: boolean;
  streamPhase?: StreamPhaseStyle;
}>(({ theme, isUser, isThinking, isError, streamPhase }) => ({
  padding: theme.spacing(1.5, 2),
  maxWidth: '85%',
  width: '100%',
  minWidth: 0,
  borderRadius: '16px',
  backgroundColor: isUser
    ? theme.palette.primary.main
    : isThinking
      ? streamPhase === 'stale'
        ? theme.palette.warning.light
        : streamPhase === 'acting'
          ? theme.palette.info.light
          : streamPhase === 'responding'
            ? theme.palette.background.paper
            : theme.palette.grey[100]
      : theme.palette.background.paper,
  color: isUser
    ? theme.palette.primary.contrastText
    : isThinking
      ? streamPhase === 'stale'
        ? theme.palette.warning.contrastText
        : streamPhase === 'acting'
          ? theme.palette.info.contrastText
          : streamPhase === 'responding'
            ? theme.palette.text.primary
            : theme.palette.text.secondary
      : isError
        ? theme.palette.error.dark
        : theme.palette.text.primary,
  borderBottomRightRadius: isUser ? 4 : 16,
  borderTopLeftRadius: isUser ? 16 : 4,
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  borderLeft: isError ? `3px solid ${theme.palette.error.main}` : undefined,
  cursor: 'default',
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
  /** e.g. gateway `senderLabel` */
  caption?: string;
  /** Assistant message that is only an error / failure */
  isError?: boolean;
  /** When `isThinking`, distinguishes run phase for colour hints */
  streamPhase?: StreamPhaseStyle;
  /** Opens chain-of-thought modal for this message (assistant bubbles with saved reasoning) */
  onViewReasoning?: () => void;
  /**
   * When the assistant slot has no user-visible answer yet, show this text (e.g. in-run phase line)
   * below the header, with thinking tone.
   */
  phaseFallbackText?: string;
  /** Do not show the "…" placeholder when body is empty (e.g. orphan reasoningTrace row). */
  hideEmptyBodyPlaceholder?: boolean;
}

/**
 * Custom wrapper for MUI components providing a chat bubble UI.
 * This abstraction allows mass UI customization across the app.
 * It supports a special 'isThinking' state for in-run phase chrome on the assistant slot.
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({
  role,
  content,
  imageUrls,
  linkPreviews,
  isThinking,
  caption,
  isError,
  streamPhase = 'reasoning',
  onViewReasoning,
  phaseFallbackText,
  hideEmptyBodyPlaceholder,
}) => {
  const isUser = role === 'user';
  const safeContent = sanitizeDisplayText(content || '');
  const safePhaseFallback = phaseFallbackText ? sanitizeDisplayText(phaseFallbackText) : '';
  const safeCaption = caption ? sanitizeDisplayText(caption) : '';
  const showImages = imageUrls && imageUrls.length > 0;
  const showLinks = linkPreviews && linkPreviews.length > 0;
  const hasStreamedText = !!safeContent.trim();
  const hasAnswerMedia = showLinks || showImages;
  const showsAnswer = hasStreamedText || hasAnswerMedia;

  const phaseBody = !showsAnswer && !!safePhaseFallback.trim();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 1,
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <BubblePaper
        isUser={isUser}
        isThinking={isThinking}
        isError={isError}
        streamPhase={isThinking ? streamPhase : undefined}
        elevation={0}
      >
        {!isUser && onViewReasoning ? (
          <Link
            component="button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onViewReasoning();
            }}
            underline="always"
            sx={(theme) => ({
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
            })}
          >
            thought process
          </Link>
        ) : null}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0, maxWidth: '100%' }}>
          {isThinking && <CircularProgress size={16} color="inherit" sx={{ mt: 0.25, flexShrink: 0 }} />}
          <Box sx={{ flex: 1, minWidth: 0, maxWidth: '100%' }}>
            {hasStreamedText ? (
              <MarkdownMessage tone={isUser ? 'user' : 'assistant'} isError={isError}>
                {safeContent}
              </MarkdownMessage>
            ) : null}
            {phaseBody ? (
              <MarkdownMessage tone={isUser ? 'user' : isThinking ? 'thinking' : 'assistant'} isError={isError}>
                {safePhaseFallback}
              </MarkdownMessage>
            ) : null}
            {!hasStreamedText && !phaseBody && !showsAnswer && !isThinking && !hideEmptyBodyPlaceholder ? (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                …
              </Typography>
            ) : null}
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
