import { stripFinalEnvelope } from '../api/gateway-types';
import { sanitizeDisplayText } from './sanitizeDisplayText';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type ProviderTextExtractor = (message: unknown) => string | undefined;

function extractGeminiTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  const textBits: string[] = [];

  for (const part of parts) {
    if (!isRecord(part)) continue;
    const text = part.text;
    if (typeof text === 'string' && text.trim()) {
      textBits.push(sanitizeDisplayText(stripFinalEnvelope(text)));
    }
  }

  return textBits.length ? textBits.join('\n\n') : '';
}

/**
 * Extract user-visible message text from `ChatEvent.message` (provider-native payloads).
 *
 * Extensibility: add more provider extractors (OpenAI, Anthropic, Bedrock, etc.) as small
 * functions returning `string | undefined`, then register them below.
 */
export function extractMessageFromProviderPayload(message: unknown): string {
  if (message === undefined || message === null) return '';

  const extractors: ProviderTextExtractor[] = [
    // Common shapes used by multiple providers.
    (m) => {
      if (typeof m !== 'string') return undefined;
      return sanitizeDisplayText(stripFinalEnvelope(m));
    },
    (m) => {
      if (!isRecord(m)) return undefined;
      if (typeof m.text !== 'string') return undefined;
      return sanitizeDisplayText(stripFinalEnvelope(m.text));
    },

    // Gemini only (for now).
    (m) => {
      if (!isRecord(m)) return undefined;
      if ('parts' in m) return extractGeminiTextFromParts(m.parts);
      if ('content' in m && isRecord(m.content) && 'parts' in m.content) {
        return extractGeminiTextFromParts(m.content.parts);
      }
      return undefined;
    },
  ];

  for (const extractor of extractors) {
    const extracted = extractor(message);
    if (extracted !== undefined) return extracted;
  }

  return '';
}

