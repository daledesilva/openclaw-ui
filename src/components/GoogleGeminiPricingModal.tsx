import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
  GEMINI_MODEL_PRICING_AS_OF,
  GOOGLE_GEMINI_MODEL_PRICING,
  PRICING_SOURCE_NOTES,
} from '../data/googleGeminiModelPricing';

export interface GoogleGeminiPricingModalProps {
  open: boolean;
  onClose: () => void;
}

function fmtRate(n: number | undefined): string {
  if (n === undefined) return '—';
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

export function GoogleGeminiPricingModal({ open, onClose }: GoogleGeminiPricingModalProps) {
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return Object.entries(GOOGLE_GEMINI_MODEL_PRICING)
      .map(([id, row]) => ({ id, ...row }))
      .filter(
        (r) => !q || r.id.includes(q) || r.displayName.toLowerCase().includes(q)
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [filter]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="gemini-pricing-title">
      <DialogTitle id="gemini-pricing-title" sx={{ pr: 5 }}>
        Gemini model pricing (estimate)
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {PRICING_SOURCE_NOTES} As of {GEMINI_MODEL_PRICING_AS_OF}. Rates are USD per 1M tokens (Vertex AI
          Standard list prices where applicable). Not your invoice—actual billing depends on region, tier,
          long context, and Google&apos;s current price list.
        </Typography>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter by model id or name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Model id</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Input /1M</TableCell>
                <TableCell align="right">Output /1M</TableCell>
                <TableCell align="right">Cache read /1M</TableCell>
                <TableCell align="right">Cache write /1M</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.id}</TableCell>
                  <TableCell>{r.displayName}</TableCell>
                  <TableCell align="right">{fmtRate(r.inputUsdPerMillion)}</TableCell>
                  <TableCell align="right">{fmtRate(r.outputUsdPerMillion)}</TableCell>
                  <TableCell align="right">{fmtRate(r.cacheReadUsdPerMillion)}</TableCell>
                  <TableCell align="right">{fmtRate(r.cacheWriteUsdPerMillion)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {rows.length === 0 && (
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No models match this filter.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
