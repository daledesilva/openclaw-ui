import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import type { ThoughtItem } from '../chatThreadTypes';
import {
  thoughtItemsToModalSegments,
  type ThoughtProcessModalSegment,
} from '../utils/recentThoughtsReducer';

export type ChainOfThoughtModalContent =
  | { mode: 'structured'; thoughtItems: ThoughtItem[]; proseReasoning?: string }
  | { mode: 'plain'; text: string };

export interface ChainOfThoughtModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the dialog header */
  title?: string;
  content: ChainOfThoughtModalContent;
}

function segmentCaption(kind: ThoughtProcessModalSegment['kind']): string | undefined {
  if (kind === 'toolHint') return 'Tool';
  if (kind === 'toolResult') return 'Result';
  if (kind === 'prose') return 'Summary';
  if (kind === 'reasoning') return 'Thought';
  return undefined;
}

function ThoughtSegmentBubble({ segment }: { segment: ThoughtProcessModalSegment }) {
  const caption = segmentCaption(segment.kind);
  const body = sanitizeDisplayText(segment.text);
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
      <Paper
        elevation={0}
        sx={(theme) => ({
          maxWidth: '90%',
          px: 1.25,
          py: 1,
          borderRadius: '14px',
          borderTopLeftRadius: theme.spacing(1.5),
          borderBottomRightRadius: theme.spacing(1.5),
          backgroundColor: theme.palette.grey[100],
          color: theme.palette.text.secondary,
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        })}
      >
        {caption ? (
          <Typography
            variant="caption"
            sx={{ display: 'block', fontWeight: 600, opacity: 0.75, mb: 0.25, letterSpacing: '0.02em' }}
          >
            {caption}
          </Typography>
        ) : null}
        <Typography
          variant="body2"
          component="div"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '0.8125rem',
            lineHeight: 1.45,
          }}
        >
          {body || '\u00a0'}
        </Typography>
      </Paper>
    </Box>
  );
}

export const ChainOfThoughtModal: React.FC<ChainOfThoughtModalProps> = ({
  open,
  onClose,
  title = 'Chain of thought',
  content,
}) => {
  const segments = useMemo(() => {
    if (content.mode === 'plain') {
      const t = sanitizeDisplayText(content.text || '').trim();
      return t ? [{ kind: 'reasoning' as const, text: t }] : [];
    }
    return thoughtItemsToModalSegments(content.thoughtItems, content.proseReasoning);
  }, [content]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      aria-labelledby="chain-of-thought-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: 'min(85dvh, 560px)',
          m: 2,
          width: '100%',
        },
      }}
    >
      <DialogTitle
        id="chain-of-thought-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pr: 1,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography component="span" variant="subtitle1" fontWeight="bold">
          {title}
        </Typography>
        <IconButton
          aria-label="Close chain of thought"
          onClick={onClose}
          size="small"
          edge="end"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          pt: 2,
          pb: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          alignItems: 'stretch',
        }}
      >
        {segments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Awaiting task…
          </Typography>
        ) : (
          segments.map((segment, index) => (
            <ThoughtSegmentBubble key={`${segment.kind}-${index}-${segment.text.slice(0, 24)}`} segment={segment} />
          ))
        )}
      </DialogContent>
    </Dialog>
  );
};
