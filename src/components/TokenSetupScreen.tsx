import { useState } from 'react';
import { Box, Typography, TextField, Button, Paper } from '@mui/material';
import { setStoredGatewayToken } from '../api/gateway';

interface TokenSetupScreenProps {
  onTokenSet: () => void;
}

export function TokenSetupScreen({ onTokenSet }: TokenSetupScreenProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setError('Please paste the gateway token.');
      return;
    }
    setError(null);
    setStoredGatewayToken(trimmed);
    setToken('');
    onTokenSet();
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper sx={{ p: 3, maxWidth: 400, width: '100%' }} elevation={2}>
        <Typography variant="h6" gutterBottom>
          Connect to OpenClaw
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Paste your gateway token below. Get it from the gateway host:{' '}
          <code style={{ fontSize: '0.85em', background: 'var(--code-bg)', padding: '2px 6px', borderRadius: 4 }}>
            openclaw config get gateway.auth.token
          </code>
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            type="password"
            autoComplete="off"
            label="Gateway token"
            placeholder="Paste token here"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            error={!!error}
            helperText={error}
            sx={{ mb: 2 }}
          />
          <Button type="submit" variant="contained" fullWidth>
            Connect
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
