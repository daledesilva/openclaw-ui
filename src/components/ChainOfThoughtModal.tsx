import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { sanitizeDisplayText } from '../utils/sanitizeDisplayText';

export interface ChainOfThoughtModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the dialog header */
  title?: string;
  reasoning: string;
}

export const ChainOfThoughtModal: React.FC<ChainOfThoughtModalProps> = ({
  open,
  onClose,
  title = 'Chain of thought',
  reasoning,
}) => {
  const safe = sanitizeDisplayText(reasoning || '');
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
        }}
      >
        <Box
          component="pre"
          sx={{
            m: 0,
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: 'text.secondary',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {safe || 'Awaiting task…'}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
