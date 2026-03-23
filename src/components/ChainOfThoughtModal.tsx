import React, { useMemo } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/material/styles';
import type { ThoughtItem } from '../chatThreadTypes';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';

export type ChainOfThoughtModalContent =
  | { mode: 'structured'; thoughtItems: ThoughtItem[]; proseReasoning?: string; finalDetails?: string }
  | { mode: 'plain'; text: string };

export interface ChainOfThoughtModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the dialog header */
  title?: string;
  content: ChainOfThoughtModalContent;
}

function safeTrim(s: string | undefined): string | undefined {
  const v = s?.trim();
  return v ? v : undefined;
}

function thoughtItemToPillText(item: ThoughtItem): string {
  if (item.kind === 'internalMonologue') {
    return sanitizeDisplayText(item.thought ?? '');
  }
  const name = item.toolName?.trim() || 'tool';
  const rawContent = item.content;
  let contentStr = '';
  if (typeof rawContent === 'string') {
    contentStr = rawContent;
  } else if (rawContent === undefined || rawContent === null) {
    contentStr = '';
  } else {
    try {
      contentStr = JSON.stringify(rawContent);
    } catch {
      contentStr = String(rawContent);
    }
  }

  const trimmed = contentStr.trim();
  return trimmed ? `• ${name}(${trimmed})` : `• ${name}()`;
}

/** Plain-text export of trace + prose (same structure as structured modal sections). Exported for tests. */
export function formatThoughtItemsForModal(items: ThoughtItem[], proseReasoning?: string): string {
  const toolLines: string[] = [];
  const reasoningParts: string[] = [];
  for (const item of items) {
    if (item.kind === 'toolCall') {
      const name = item.toolName?.trim() || 'tool';
      const preview = typeof item.content === 'string' ? item.content : String(item.content ?? '');
      toolLines.push(preview.trim() ? `• ${name}(${preview})` : `• ${name}()`);
    } else if (item.kind === 'internalMonologue') {
      reasoningParts.push(item.thought);
    }
  }
  const chunks = [
    toolLines.length ? `Tools\n${toolLines.join('\n')}` : '',
    reasoningParts.join('').trim() ? reasoningParts.join('') : '',
    proseReasoning?.trim() ? proseReasoning.trim() : '',
  ].filter(Boolean);
  return chunks.join('\n\n---\n\n');
}

const thoughtPillSx: SxProps<Theme> = (theme) => ({
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
  color: theme.palette.mode === 'dark' ? theme.palette.grey[100] : theme.palette.grey[800],
  borderRadius: '9999px',
  padding: theme.spacing(0.65, 1.25),
  fontSize: '0.74rem',
  lineHeight: 1.25,
  textAlign: 'center',
  maxWidth: '100%',
  width: '100%',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
});

export const ChainOfThoughtModal: React.FC<ChainOfThoughtModalProps> = (props) => {
  const theme = useTheme();

  const bubbles = useMemo(() => {
    if (props.content.mode !== 'structured') return [];

    const thoughtBubbles = props.content.thoughtItems.map((item) => thoughtItemToPillText(item)).filter(Boolean);
    const proseBubble = safeTrim(props.content.proseReasoning);
    const finalDetailsBubble = safeTrim(props.content.finalDetails);

    const all = [...thoughtBubbles];
    if (proseBubble) all.push(proseBubble);
    if (finalDetailsBubble) all.push(finalDetailsBubble);

    return all;
  }, [props.content]);

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth aria-labelledby="cot-title">
      <DialogTitle id="cot-title" sx={{ pr: 5 }}>
        {props.title ?? 'Thought process'}
        <IconButton
          aria-label="Close"
          onClick={props.onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          maxHeight: '70vh',
          overflowY: 'auto',
          p: 2,
          bgcolor: theme.palette.mode === 'dark' ? 'transparent' : 'background.paper',
        }}
      >
        {props.content.mode === 'plain' ? (
          <Box sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.4 }}>
            {props.content.text}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.1 }}>
            {bubbles.length ? (
              bubbles.map((t, i) => (
                <Box key={`${i}-${t.slice(0, 24)}`} sx={thoughtPillSx}>
                  <Typography variant="body2" component="div" sx={{ width: '100%' }}>
                    {sanitizeDisplayText(t)}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                No thought trace available.
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
