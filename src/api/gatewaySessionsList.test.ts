import { describe, expect, it } from 'vitest';
import {
  chatSessionKeysMatchForRouting,
  displayTotalTokens,
  extractDefaultAgentIdFromHealthPayload,
  extractDefaultAgentIdFromSessionsListPayload,
  extractSessionTokenStatsByKey,
  openClawSessionSuffixFromCanonicalKey,
  resolveSessionKeyFromEntry,
} from './gatewaySessionsList';

describe('chatSessionKeysMatchForRouting', () => {
  it('matches short webchat key to canonical agent key', () => {
    expect(
      chatSessionKeysMatchForRouting(
        'webchat-ea37ec97-64d0-4063-9a5d-06bc9372e01e',
        'agent:main:webchat-ea37ec97-64d0-4063-9a5d-06bc9372e01e'
      )
    ).toBe(true);
  });
  it('matches identical keys', () => {
    expect(chatSessionKeysMatchForRouting('main', 'main')).toBe(true);
  });
  it('rejects different sessions', () => {
    expect(chatSessionKeysMatchForRouting('webchat-a', 'agent:main:webchat-b')).toBe(false);
  });
});

describe('extractSessionTokenStatsByKey', () => {
  it('parses array of sessions with sessionKey and camelCase tokens', () => {
    const payload = [
      { sessionKey: 'webchat-a', totalTokens: 100, inputTokens: 60, outputTokens: 40 },
      { sessionKey: 'webchat-b', contextTokens: 5000 },
    ];
    const map = extractSessionTokenStatsByKey(payload);
    expect(map['webchat-a']).toEqual({
      totalTokens: 100,
      inputTokens: 60,
      outputTokens: 40,
    });
    expect(map['webchat-b']).toEqual({ contextTokens: 5000 });
  });

  it('parses nested sessions array', () => {
    const payload = {
      sessions: [{ key: 'main', total_tokens: 42, input_tokens: 30, output_tokens: 12 }],
    };
    expect(extractSessionTokenStatsByKey(payload)['main']).toEqual({
      totalTokens: 42,
      inputTokens: 30,
      outputTokens: 12,
    });
  });

  it('parses map keyed by session key with inner stats', () => {
    const payload = {
      'agent:main:webchat-1': { totalTokens: 999 },
    };
    expect(extractSessionTokenStatsByKey(payload)['agent:main:webchat-1']).toEqual({
      totalTokens: 999,
    });
  });

  it('prefers inner sessionKey over outer key when both present', () => {
    const payload = {
      outer: { sessionKey: 'inner-key', totalTokens: 1 },
    };
    expect(extractSessionTokenStatsByKey(payload).outer).toBeUndefined();
    expect(extractSessionTokenStatsByKey(payload)['inner-key']).toEqual({ totalTokens: 1 });
  });

  it('aliases canonical OpenClaw key to UI session suffix (webchat-uuid)', () => {
    const payload = {
      sessions: [
        {
          key: 'agent:main:webchat-abc',
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 100,
        },
      ],
    };
    const map = extractSessionTokenStatsByKey(payload);
    expect(map['agent:main:webchat-abc']?.totalTokens).toBe(100);
    expect(map['webchat-abc']?.totalTokens).toBe(100);
    expect(map['webchat-abc']?.inputTokens).toBe(10);
  });

  it('extractDefaultAgentIdFromSessionsListPayload reads agent id from key', () => {
    const payload = {
      sessions: [{ key: 'agent:main:webchat-x', totalTokens: 1 }],
    };
    expect(extractDefaultAgentIdFromSessionsListPayload(payload)).toBe('main');
  });
});

describe('openClawSessionSuffixFromCanonicalKey', () => {
  it('returns tail after agent:id', () => {
    expect(openClawSessionSuffixFromCanonicalKey('agent:main:main')).toBe('main');
    expect(openClawSessionSuffixFromCanonicalKey('agent:main:telegram:direct:1')).toBe('telegram:direct:1');
  });

  it('returns undefined for short keys', () => {
    expect(openClawSessionSuffixFromCanonicalKey('main')).toBeUndefined();
  });
});

describe('extractDefaultAgentIdFromHealthPayload', () => {
  it('reads defaultAgentId string', () => {
    expect(extractDefaultAgentIdFromHealthPayload({ defaultAgentId: 'main' })).toBe('main');
  });

  it('reads default flag on agents array', () => {
    expect(
      extractDefaultAgentIdFromHealthPayload({
        agents: [{ agentId: 'other' }, { agentId: 'main', isDefault: true }],
      })
    ).toBe('main');
  });
});

describe('displayTotalTokens', () => {
  it('uses totalTokens when set', () => {
    expect(displayTotalTokens({ totalTokens: 10, inputTokens: 99 })).toBe(10);
  });

  it('sums input and output when total missing', () => {
    expect(displayTotalTokens({ inputTokens: 3, outputTokens: 7 })).toBe(10);
  });

  it('returns undefined when empty', () => {
    expect(displayTotalTokens(undefined)).toBeUndefined();
    expect(displayTotalTokens({})).toBeUndefined();
  });
});

describe('resolveSessionKeyFromEntry', () => {
  it('uses outer key as fallback', () => {
    expect(resolveSessionKeyFromEntry({ totalTokens: 1 }, 'k')).toBe('k');
  });
});
