import { sanitizeDisplayText } from './sanitizeDisplayText';
import type { ToolCallEntry } from '../api/gateway-types';

const SUMMARY_MAX = 52;
const QUERY_TRUNCATE = 48;

function truncateSummary(s: string): string {
  const t = s.trim();
  if (t.length <= SUMMARY_MAX) return t;
  return `${t.slice(0, SUMMARY_MAX - 1)}…`;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function firstStringField(obj: Record<string, unknown>, skipKeys: Set<string>): string | null {
  for (const [key, val] of Object.entries(obj)) {
    if (skipKeys.has(key)) continue;
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

export interface SummarizeToolResultInput {
  toolName?: string;
  isError?: boolean;
  raw: unknown;
}

/**
 * One-line summary for collapsed tool **result** rows (`Tool: …`).
 */
export function summarizeToolResult(input: SummarizeToolResultInput): string {
  const { toolName, isError, raw } = input;
  const name = (toolName ?? '').toLowerCase();

  if (isError) {
    if (isRecord(raw)) {
      const err =
        typeof raw.error === 'string'
          ? raw.error
          : typeof raw.errorMessage === 'string'
            ? raw.errorMessage
            : typeof raw.message === 'string'
              ? raw.message
              : null;
      if (err?.trim()) return truncateSummary(sanitizeDisplayText(err.trim()));
    }
    return 'Error';
  }

  if (raw === undefined || raw === null) {
    return '(no output)';
  }

  if (Array.isArray(raw)) {
    const n = raw.length;
    if (n === 0) return 'Empty result';
    const label = name.includes('product') ? 'products found' : 'items';
    return `${n} ${label}`;
  }

  if (isRecord(raw)) {
    const q =
      typeof raw.query === 'string' && raw.query.trim()
        ? raw.query.trim()
        : typeof raw.q === 'string' && raw.q.trim()
          ? raw.q.trim()
          : null;
    if (q && (name.includes('search') || name === 'web_search')) {
      const qq = q.length > QUERY_TRUNCATE ? `${q.slice(0, QUERY_TRUNCATE - 1)}…` : q;
      return truncateSummary(`Search for '${sanitizeDisplayText(qq)}'`);
    }

    const nested = raw.results ?? raw.items ?? raw.data;
    if (Array.isArray(nested) && nested.length > 0) {
      const n = nested.length;
      const label = name.includes('product') ? 'products found' : 'results';
      return `${n} ${label}`;
    }

    const fs = firstStringField(raw, new Set(['externalContent', 'content', 'provider', 'model']));
    if (fs) {
      return truncateSummary(sanitizeDisplayText(fs));
    }
  }

  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return '(no output)';
    return truncateSummary(sanitizeDisplayText(t.replace(/\s+/g, ' ')));
  }

  try {
    return truncateSummary(sanitizeDisplayText(JSON.stringify(raw).replace(/\s+/g, ' ')));
  } catch {
    return '(output)';
  }
}

/**
 * One-line summary for collapsed tool **call** rows (`Tool: …`).
 */
export function summarizeToolCall(entry: ToolCallEntry): string {
  const name = entry.name.toLowerCase();
  const args = entry.arguments;

  if (args && isRecord(args)) {
    const q =
      typeof args.query === 'string' && args.query.trim()
        ? args.query.trim()
        : typeof args.q === 'string' && args.q.trim()
          ? args.q.trim()
          : null;
    if (q && (name.includes('search') || name === 'web_search')) {
      const qq = q.length > QUERY_TRUNCATE ? `${q.slice(0, QUERY_TRUNCATE - 1)}…` : q;
      return truncateSummary(`Search for '${sanitizeDisplayText(qq)}'`);
    }
  }

  const line = entry.argumentsPreview
    ? `${entry.name}(${entry.argumentsPreview})`
    : `${entry.name}()`;
  return truncateSummary(sanitizeDisplayText(line));
}
