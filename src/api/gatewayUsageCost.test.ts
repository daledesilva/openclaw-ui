import { describe, expect, it } from 'vitest';
import {
  canonicalOpenClawSessionKey,
  mergeParsedGatewayUsageCost,
  parseGatewayUsageCostPayload,
  sessionOnlyUsageCostUsd,
} from './gatewayUsageCost';

describe('parseGatewayUsageCostPayload', () => {
  it('reads top-level totalUsd', () => {
    expect(parseGatewayUsageCostPayload({ totalUsd: 12.34 }).aggregateUsd).toBe(12.34);
  });

  it('reads sessions array with key and costUsd', () => {
    const p = parseGatewayUsageCostPayload({
      sessions: [
        { key: 'agent:main:webchat-a', costUsd: 1.5 },
        { key: 'agent:main:main', totalUsd: 0.25 },
      ],
    });
    expect(p.bySessionKey?.['agent:main:webchat-a']).toBe(1.5);
    expect(p.bySessionKey?.['agent:main:main']).toBe(0.25);
  });

  it('reads bySessionKey map', () => {
    const p = parseGatewayUsageCostPayload({
      bySessionKey: { 'agent:main:main': 9.99 },
    });
    expect(p.bySessionKey?.['agent:main:main']).toBe(9.99);
  });
});

describe('canonicalOpenClawSessionKey', () => {
  it('prefixes short keys', () => {
    expect(canonicalOpenClawSessionKey('webchat-abc', 'main')).toBe('agent:main:webchat-abc');
  });

  it('leaves canonical keys unchanged', () => {
    expect(canonicalOpenClawSessionKey('agent:main:main', 'x')).toBe('agent:main:main');
  });
});

describe('sessionOnlyUsageCostUsd', () => {
  it('matches canonical and suffix keys', () => {
    const parsed = parseGatewayUsageCostPayload({
      sessions: [{ key: 'agent:main:webchat-x', costUsd: 2 }],
    });
    expect(sessionOnlyUsageCostUsd('webchat-x', parsed, 'main')).toBe(2);
    expect(sessionOnlyUsageCostUsd('agent:main:webchat-x', parsed, 'main')).toBe(2);
  });
});

describe('mergeParsedGatewayUsageCost', () => {
  it('merges session maps and prefers first aggregate', () => {
    const a = parseGatewayUsageCostPayload({ totalUsd: 1, sessions: [{ key: 'a', costUsd: 0.1 }] });
    const b = parseGatewayUsageCostPayload({ totalUsd: 99, sessions: [{ key: 'b', costUsd: 0.2 }] });
    const m = mergeParsedGatewayUsageCost(a, b);
    expect(m.aggregateUsd).toBe(1);
    expect(m.bySessionKey?.a).toBe(0.1);
    expect(m.bySessionKey?.b).toBe(0.2);
  });
});
