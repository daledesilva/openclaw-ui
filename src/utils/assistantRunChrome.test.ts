import { describe, expect, it } from 'vitest';
import { inputPlaceholderForAssistantRun, isAssistantRunBlockingInput } from './assistantRunChrome';

describe('isAssistantRunBlockingInput', () => {
  it('blocks only while running', () => {
    expect(isAssistantRunBlockingInput('running')).toBe(true);
    expect(isAssistantRunBlockingInput('idle')).toBe(false);
    expect(isAssistantRunBlockingInput('stale')).toBe(false);
  });
});

describe('inputPlaceholderForAssistantRun', () => {
  const ready = 'ready' as const;

  it('uses connection status when not ready', () => {
    expect(inputPlaceholderForAssistantRun('idle', 'connecting')).toBe('Connecting…');
    expect(inputPlaceholderForAssistantRun('running', 'disconnected')).toContain('Disconnected');
    expect(inputPlaceholderForAssistantRun('running', 'error')).toContain('Fix connection');
  });

  it('uses shell state when connected', () => {
    expect(inputPlaceholderForAssistantRun('idle', ready)).toContain('Send a message');
    expect(inputPlaceholderForAssistantRun('running', ready)).toBe('Assistant is working…');
    expect(inputPlaceholderForAssistantRun('stale', ready)).toContain('Still waiting');
  });
});
