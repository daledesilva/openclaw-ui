import { sanitizeDisplayText } from './sanitizeDisplayText';
import { parseContentParts, type ToolCallEntry } from '../api/gateway-types';

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

const LOOSE_TOOL_ARGS_PREVIEW_MAX = 200;

function looseToolRecordToEntry(rec: Record<string, unknown>): ToolCallEntry | null {
  const rawName = rec.name ?? rec.toolName;
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;
  if (!name) return null;
  let argumentsPreview = '';
  let args: Record<string, unknown> | undefined;
  const rawArgs = rec.arguments ?? rec.args;
  if (rawArgs && typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)) {
    try {
      const serialized = JSON.stringify(rawArgs);
      argumentsPreview =
        serialized.length > LOOSE_TOOL_ARGS_PREVIEW_MAX
          ? `${serialized.slice(0, LOOSE_TOOL_ARGS_PREVIEW_MAX - 1)}…`
          : serialized;
      args = rawArgs as Record<string, unknown>;
    } catch {
      argumentsPreview = '[arguments]';
    }
  } else if (typeof rawArgs === 'string' && rawArgs.trim()) {
    const s = rawArgs.trim();
    argumentsPreview =
      s.length > LOOSE_TOOL_ARGS_PREVIEW_MAX ? `${s.slice(0, LOOSE_TOOL_ARGS_PREVIEW_MAX - 1)}…` : s;
  }
  return { name, argumentsPreview, ...(args ? { arguments: args } : {}) };
}

/**
 * Best-effort one-line tool label from `agent…` / `stream` event `payload.data` when chat deltas omit tools.
 */
export function toolHintFromAgentStreamData(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const nestedKeys = ['toolCall', 'tool', 'tool_call'] as const;
  for (const key of nestedKeys) {
    const nested = data[key];
    if (isRecord(nested)) {
      const entry = looseToolRecordToEntry(nested);
      if (entry) return summarizeToolCall(entry);
    }
  }
  const top = looseToolRecordToEntry(data);
  return top ? summarizeToolCall(top) : null;
}

/**
 * One-line label for the **last** tool call in a chat `delta` message (same shaping as stream text / phase hints).
 */
export function lastToolSummaryFromStreamMessage(message: unknown): string | null {
  if (message === undefined || message === null) return null;
  if (typeof message === 'string') {
    const parsed = parseContentParts(message);
    const n = parsed.toolCalls.length;
    const last = n > 0 ? parsed.toolCalls[n - 1] : undefined;
    return last ? summarizeToolCall(last) : null;
  }
  if (!isRecord(message)) return null;
  if (typeof message.text === 'string') {
    const trimmed = message.text.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsedArray: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsedArray)) {
          const parsed = parseContentParts(parsedArray);
          const n = parsed.toolCalls.length;
          const last = n > 0 ? parsed.toolCalls[n - 1] : undefined;
          if (last) return summarizeToolCall(last);
        }
      } catch {
        /* not JSON content parts */
      }
    }
    return null;
  }
  const parsed = parseContentParts(message.content);
  const n = parsed.toolCalls.length;
  const last = n > 0 ? parsed.toolCalls[n - 1] : undefined;
  return last ? summarizeToolCall(last) : null;
}
