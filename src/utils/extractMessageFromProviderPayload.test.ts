import { describe, expect, it } from 'vitest';
import { extractMessageFromProviderPayload } from './extractMessageFromProviderPayload';

describe('extractMessageFromProviderPayload', () => {
  it('extracts plain string messages', () => {
    expect(extractMessageFromProviderPayload('hello')).toBe('hello');
  });

  it('extracts gemini content.parts text segments', () => {
    const message = {
      role: 'model',
      parts: [{ text: 'Hello' }, { text: 'world' }],
    };
    expect(extractMessageFromProviderPayload(message)).toBe('Hello\n\nworld');
  });

  it('extracts wrapped gemini content { content: { parts } }', () => {
    const message = {
      content: {
        role: 'model',
        parts: [{ text: 'A' }, { text: 'B' }],
      },
    };
    expect(extractMessageFromProviderPayload(message)).toBe('A\n\nB');
  });

  it('returns empty string for unsupported shapes', () => {
    expect(extractMessageFromProviderPayload({ foo: 'bar' })).toBe('');
  });
});

