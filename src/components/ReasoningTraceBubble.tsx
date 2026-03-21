import React from 'react';
import { Box, Paper, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { ThoughtItem } from '../chatThreadTypes';

const TracePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1, 1.5),
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
}));

export interface ReasoningTraceBubbleProps {
  thoughtItems: ThoughtItem[];
  proseReasoning?: string;
  onViewFullReasoning?: () => void;
}

function traceHasDisplayableContent(
  thoughtItems: ThoughtItem[],
  proseReasoning: string | undefined,
  hasOpenHandler: boolean
): boolean {
  if (!hasOpenHandler) return false;
  if (proseReasoning?.trim()) return true;
  return thoughtItems.length > 0;
}

/**
 * Compact inline affordance for one assistant turn; full trace opens in the chain-of-thought modal.
 */
export const ReasoningTraceBubble: React.FC<ReasoningTraceBubbleProps> = ({
  thoughtItems,
  proseReasoning,
  onViewFullReasoning,
}) => {
  const canOpen = traceHasDisplayableContent(thoughtItems, proseReasoning, !!onViewFullReasoning);
  if (!canOpen) return null;

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
        <Button
          variant="text"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            onViewFullReasoning?.();
          }}
          sx={{
            alignSelf: 'flex-start',
            py: 0.5,
            px: 0.75,
            minHeight: 0,
            textTransform: 'none',
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
        >
          View Thought Process
        </Button>
      </TracePaper>
    </Box>
  );
};
