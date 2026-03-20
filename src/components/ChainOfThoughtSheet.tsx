import React from 'react';
import { SwipeableDrawer, Box, Typography, styled } from '@mui/material';

const StyledBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2, 2, 4, 2),
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  height: '40vh',
}));

const Puller = styled(Box)(({ theme }) => ({
  width: 30,
  height: 6,
  backgroundColor: theme.palette.grey[300],
  borderRadius: 3,
  position: 'absolute',
  top: 8,
  left: 'calc(50% - 15px)',
}));

interface ChainOfThoughtSheetProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  reasoning: string;
}

export const ChainOfThoughtSheet: React.FC<ChainOfThoughtSheetProps> = ({ open, onClose, onOpen, reasoning }) => {
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={onOpen}
      PaperProps={{
        elevation: 0,
        style: {
          borderTop: '1px solid #E0E0E0',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }
      }}
    >
      <StyledBox>
        <Puller />
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, mt: 2 }}>
          Chain of Thought
        </Typography>
        <Box 
          sx={{ 
            height: 'calc(100% - 48px)',
            overflowY: 'auto', 
            fontFamily: 'monospace', 
            fontSize: '0.85rem', 
            color: '#555', 
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        >
          {reasoning || 'Awaiting task...'}
        </Box>
      </StyledBox>
    </SwipeableDrawer>
  );
};
