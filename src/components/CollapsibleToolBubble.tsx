import React, { useState } from 'react';
import { Box, ButtonBase, Collapse, Paper, Typography } from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';

const MAX_JSON_CHARS = 100_000;

export function formatToolPayloadForDisplay(payload: unknown): string {
  if (payload === undefined) {
    return '(no data)';
  }
  try {
    const text = JSON.stringify(payload, null, 2);
    if (text.length <= MAX_JSON_CHARS) {
      return text;
    }
    return `${text.slice(0, MAX_JSON_CHARS)}\n\n… truncated (${text.length} characters total)`;
  } catch {
    return sanitizeDisplayText(String(payload));
  }
}

export interface CollapsibleToolBubbleProps {
  /** Text after `Tool:` */
  summary: string;
  /** Value to pretty-print when expanded */
  expandPayload: unknown;
  defaultExpanded?: boolean;
}

/**
 * Collapsed: `Tool: {summary}`. Expanded: pretty-printed JSON in a scrollable pre.
 */
export const CollapsibleToolBubble: React.FC<CollapsibleToolBubbleProps> = ({
  summary,
  expandPayload,
  defaultExpanded = false,
}) => {
  const [open, setOpen] = useState(defaultExpanded);
  const safeSummary = sanitizeDisplayText(summary || '');

  return (
    <Box sx={{ mb: 1, maxWidth: '100%', minWidth: 0, alignSelf: 'stretch' }}>
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          borderRadius: 2,
          borderColor: 'divider',
          bgcolor: 'grey.50',
          overflow: 'hidden',
        }}
      >
        <ButtonBase
          component="button"
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            px: 1.5,
            py: 1,
            textAlign: 'left',
            gap: 1,
          }}
        >
          <Typography
            variant="body2"
            component="span"
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: 500,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
              Tool:{' '}
            </Typography>
            {safeSummary || '…'}
          </Typography>
          {open ? (
            <ExpandLess sx={{ color: 'text.secondary', flexShrink: 0 }} fontSize="small" />
          ) : (
            <ExpandMore sx={{ color: 'text.secondary', flexShrink: 0 }} fontSize="small" />
          )}
        </ButtonBase>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box
            component="pre"
            sx={{
              m: 0,
              px: 1.5,
              pb: 1.5,
              pt: 0,
              maxHeight: 320,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              lineHeight: 1.45,
              color: 'text.secondary',
              whiteSpace: 'pre',
              wordBreak: 'break-word',
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            {formatToolPayloadForDisplay(expandPayload)}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};
