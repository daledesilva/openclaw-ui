import { Box, Paper, Typography, IconButton, Chip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { formatUsdSessionClientTotal } from '../api/gatewayUsageCost';

export type RunTerminalNotice = { kind: 'error'; message: string } | { kind: 'aborted' };

export type ChatHeaderConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

export type ChatHeaderProps = {
  appVersion: string;
  connectionStatus: ChatHeaderConnectionStatus;
  isMobile: boolean;
  onOpenThreadDrawer: () => void;
  connectionError: string | null;
  runTerminalNotice: RunTerminalNotice | null;
  onDismissRunTerminalNotice: () => void;
  showThreadStats: boolean;
  activeMessageCount: number;
  activeThreadTokenSegment: string | null;
  sessionGeminiEstimateUsd: number | undefined;
};

export function ChatHeader({
  appVersion,
  connectionStatus,
  isMobile,
  onOpenThreadDrawer,
  connectionError,
  runTerminalNotice,
  onDismissRunTerminalNotice,
  showThreadStats,
  activeMessageCount,
  activeThreadTokenSegment,
  sessionGeminiEstimateUsd,
}: ChatHeaderProps) {
  return (
    <Paper elevation={0} sx={{ py: 0.75, px: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 0 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: showThreadStats ? 'minmax(0, 1fr) max-content' : 'minmax(0, 1fr)',
          alignItems: 'start',
          columnGap: 1.25,
          rowGap: 0.35,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {isMobile && (
            <IconButton
              color="inherit"
              size="small"
              aria-label="Open conversation list"
              onClick={onOpenThreadDrawer}
              sx={{ p: 0.5, flexShrink: 0, opacity: 0.92 }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
          )}
          <Typography
            component="h1"
            sx={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              p: 0,
              m: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            OpenClaw
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 0.5,
              columnGap: 1,
              minWidth: 0,
            }}
          >
            <Typography
              variant="caption"
              component="span"
              sx={{ opacity: 0.72, fontSize: '0.68rem', letterSpacing: '0.02em' }}
            >
              {appVersion}
            </Typography>
            {connectionStatus === 'connecting' && (
              <Typography variant="caption" component="span" sx={{ opacity: 0.88, fontSize: '0.68rem' }}>
                Connecting…
              </Typography>
            )}
            {connectionStatus === 'disconnected' && connectionError && (
              <Typography
                variant="caption"
                component="span"
                sx={{ opacity: 0.88, fontSize: '0.68rem', lineHeight: 1.3 }}
              >
                {connectionError}
              </Typography>
            )}
            {connectionStatus === 'error' && connectionError && (
              <Typography variant="caption" component="span" sx={{ opacity: 0.88, fontSize: '0.68rem' }}>
                {connectionError}
              </Typography>
            )}
            {connectionStatus === 'ready' && runTerminalNotice && (
              <Chip
                size="small"
                color={runTerminalNotice.kind === 'error' ? 'error' : 'default'}
                label={
                  runTerminalNotice.kind === 'aborted'
                    ? 'Stopped'
                    : runTerminalNotice.message.slice(0, 80) +
                      (runTerminalNotice.message.length > 80 ? '…' : '')
                }
                onDelete={onDismissRunTerminalNotice}
                sx={{
                  height: 20,
                  maxWidth: '100%',
                  fontSize: '0.65rem',
                  '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                }}
              />
            )}
          </Box>
        </Box>
        {showThreadStats && (
          <Box sx={{ justifySelf: 'end', minWidth: 0, alignSelf: 'start' }}>
            <Typography
              variant="caption"
              component="span"
              sx={{
                display: 'block',
                m: 0,
                pt: 0.125,
                opacity: 0.7,
                fontSize: '0.68rem',
                lineHeight: 1.35,
                letterSpacing: '0.01em',
                textAlign: 'right',
                whiteSpace: 'nowrap',
                maxWidth: 'min(280px, 42vw)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeMessageCount} messages
              {activeThreadTokenSegment ? ` · ${activeThreadTokenSegment}` : ''}
              {sessionGeminiEstimateUsd !== undefined
                ? ` · ${formatUsdSessionClientTotal(sessionGeminiEstimateUsd)}`
                : ''}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
