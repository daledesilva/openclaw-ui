import React, { useMemo } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import type { ThoughtItem } from '../chatThreadTypes';

const TracePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  maxWidth: '85%',
  width: '100%',
  minWidth: 0,
  borderRadius: '16px',
  borderTopLeftRadius: theme.spacing(2),
  borderBottomRightRadius: theme.spacing(2),
  backgroundColor: theme.palette.grey[100],
  color: theme.palette.text.secondary,
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: theme.spacing(1),
}));

export interface ReasoningTraceBubbleProps {
  thoughtItems: ThoughtItem[];
  proseReasoning?: string;
  onViewFullReasoning?: () => void;
}

function toolListLines(items: ThoughtItem[]): string[] {
  const lines: string[] = [];
  for (const item of items) {
    if (item.kind === 'toolHint') lines.push(item.label);
    else if (item.kind === 'toolResult') lines.push(`Result: ${item.summary}`);
  }
  return lines;
}

function joinedReasoningChunks(items: ThoughtItem[]): string {
  return items
    .filter((i): i is Extract<ThoughtItem, { kind: 'reasoningChunk' }> => i.kind === 'reasoningChunk')
    .map((i) => i.text)
    .join('');
}

/**
 * Inline bubble listing tools (and optional streamed thinking) for one assistant turn.
 */
export const ReasoningTraceBubble: React.FC<ReasoningTraceBubbleProps> = ({
  thoughtItems,
  proseReasoning,
  onViewFullReasoning,
}) => {
  const toolLines = useMemo(() => toolListLines(thoughtItems), [thoughtItems]);
  const streamedThinking = useMemo(() => joinedReasoningChunks(thoughtItems), [thoughtItems]);
  const safeProse = proseReasoning ? sanitizeDisplayText(proseReasoning) : '';
  const safeStreamed = sanitizeDisplayText(streamedThinking).trim();

  const hasModalContent =
    onViewFullReasoning &&
    (toolLines.length > 0 || safeProse.trim() || safeStreamed.length > 0);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-start',
        mb: 1,
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <TracePaper elevation={0}>
        <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: '0.02em', opacity: 0.85 }}>
          Reasoning
        </Typography>
        {toolLines.length > 0 ? (
          <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 0 }}>
            {toolLines.map((line, index) => (
              <Typography
                key={`${index}-${line.slice(0, 24)}`}
                component="li"
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {sanitizeDisplayText(line)}
              </Typography>
            ))}
          </Box>
        ) : null}
        {safeStreamed ? (
          <Typography
            variant="body2"
            component="div"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.8rem',
              opacity: 0.92,
            }}
          >
            {safeStreamed}
          </Typography>
        ) : null}
        {safeProse.trim() ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: 0.95 }}>
            {safeProse.trim()}
          </Typography>
        ) : null}
        {hasModalContent ? (
          <Button
            variant="text"
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              onViewFullReasoning?.();
            }}
            sx={{ alignSelf: 'flex-start', py: 0.25, px: 0.5, minHeight: 0, textTransform: 'none' }}
          >
            View full reasoning
          </Button>
        ) : null}
      </TracePaper>
    </Box>
  );
};
