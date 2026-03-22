import type { StreamPhaseHints } from '../api/gateway-types';

/** In-flight assistant work surfaced in the chat chrome (not persisted). */
export type AgentRunActivity = 'idle' | 'pending' | 'reasoning' | 'acting' | 'responding' | 'stale';

export function nextActivityFromDeltaHints(
  current: AgentRunActivity,
  hints: StreamPhaseHints
): AgentRunActivity {
  if (current === 'idle' || current === 'stale') return current;
  if (hints.hasAssistantText) return 'responding';
  if (hints.hasToolCalls) return 'acting';
  if (hints.hasThinking) return 'reasoning';
  return current;
}

export function nextActivityFromReasoningChunk(current: AgentRunActivity): AgentRunActivity {
  if (current === 'idle' || current === 'stale') return current;
  if (current === 'responding') return current;
  return 'reasoning';
}

export function nextActivityFromContentChunk(current: AgentRunActivity): AgentRunActivity {
  if (current === 'idle' || current === 'stale') return current;
  return 'responding';
}

/**
 * Body text for the in-flight assistant slot when the answer is not shown yet (spinner is separate in `AgentChatBubble`).
 * `responding` is omitted here — phase fallback is not used once answer chunks drive activity to `responding`.
 */
export function phaseBubbleDisplayText(
  activity: AgentRunActivity,
  lastReasoningLine: string,
  liveLastToolSummary: string | null
): string {
  switch (activity) {
    case 'pending':
      return '';
    case 'reasoning':
      return lastReasoningLine.trim();
    case 'acting':
      return (liveLastToolSummary ?? '').trim();
    case 'stale':
      return 'No response for a while. You can send again or reconnect.';
    default:
      return '';
  }
}

export function inputPlaceholderForActivity(
  activity: AgentRunActivity,
  connectionStatus: 'disconnected' | 'connecting' | 'ready' | 'error'
): string {
  if (connectionStatus === 'connecting') return 'Connecting…';
  if (connectionStatus === 'disconnected') return 'Disconnected — reconnect or refresh to continue…';
  if (connectionStatus === 'error') return 'Fix connection or token to chat…';
  switch (activity) {
    case 'pending':
    case 'reasoning':
    case 'acting':
    case 'responding':
      return 'Assistant is working…';
    case 'stale':
      return 'Still waiting? Try sending again or reconnect.';
    default:
      return 'Send a message to OpenClaw…';
  }
}

export function isAgentRunBlockingInput(activity: AgentRunActivity): boolean {
  return activity === 'pending' || activity === 'reasoning' || activity === 'acting' || activity === 'responding';
}
