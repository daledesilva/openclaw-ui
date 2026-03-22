/** Shell-only state for input lock, stale watchdog, and placeholder (not assistant bubble content). */
export type AssistantRunChromeState = 'idle' | 'running' | 'stale';

export function isAssistantRunBlockingInput(state: AssistantRunChromeState): boolean {
  return state === 'running';
}

export function inputPlaceholderForAssistantRun(
  state: AssistantRunChromeState,
  connectionStatus: 'disconnected' | 'connecting' | 'ready' | 'error'
): string {
  if (connectionStatus === 'connecting') return 'Connecting…';
  if (connectionStatus === 'disconnected') return 'Disconnected — reconnect or refresh to continue…';
  if (connectionStatus === 'error') return 'Fix connection or token to chat…';
  if (state === 'stale') return 'Still waiting? Try sending again or reconnect.';
  if (state === 'running') return 'Assistant is working…';
  return 'Send a message to OpenClaw…';
}
