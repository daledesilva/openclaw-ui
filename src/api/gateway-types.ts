import { formatGatewayErrorForDisplay, sanitizeDisplayText } from '../utils/sanitizeDisplayText';
import {
  type LinkPreview,
  extractLinkPreviewsFromParsedJson,
  extractLinkPreviewsFromTextSegment,
  stripLeadingLinkListJsonFromBody,
} from '../utils/extractLinkPreviews';
import { extractLinkPreviewsFromGeminiWebSearchPayload } from '../utils/extractGeminiWebSearchPreviews';
import { estimateUsdFromUsage } from '../utils/geminiPricingEstimate';

export type { LinkPreview } from '../utils/extractLinkPreviews';

/** Content blocks as returned by chat.history / agent payloads */
export type ChatContentPart =
  | { type: 'text'; text?: string }
  | { type: 'thinking'; thinking?: string }
  | { type: 'toolCall'; id?: string; name?: string; arguments?: Record<string, unknown> }
  | { type: 'image'; url?: string; image_url?: { url?: string } }
  | { type: 'image_url'; image_url?: { url?: string } };

const MAX_TOOL_MICRO = 120;
const MAX_TOOL_ARGS_JSON_CHARS = 120_000;
const MAX_LINK_PREVIEWS = 20;

export interface ToolCallEntry {
  name: string;
  argumentsPreview: string;
  /** Full tool arguments when small enough to stringify for expanded JSON in the UI */
  arguments?: Record<string, unknown>;
}

export interface ParsedContentParts {
  /** User-visible assistant / user text */
  body: string;
  /** Concatenated thinking blocks */
  reasoning: string;
  /** One line per tool call (legacy / stream) */
  toolLines: string[];
  /** Structured tool rows for compact bubbles */
  toolCalls: ToolCallEntry[];
  /** HTTP(S) or data:image URLs from image parts */
  imageUrls: string[];
  /** Extracted search / link-list previews */
  linkPreviews: LinkPreview[];
}

/** Strip Gemini-style `<final>…</final>` wrapper when it wraps the whole payload. */
export function stripFinalEnvelope(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^<final>([\s\S]*)<\/final>$/i);
  return m ? m[1].trim() : text;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function toolCallEntryFromPart(part: Extract<ChatContentPart, { type: 'toolCall' }>): ToolCallEntry {
  const name = part.name ?? 'tool';
  let argumentsPreview = '';
  let args: Record<string, unknown> | undefined;
  if (part.arguments !== undefined && part.arguments !== null) {
    try {
      const serialized = JSON.stringify(part.arguments);
      argumentsPreview = truncate(serialized, MAX_TOOL_MICRO);
      if (serialized.length <= MAX_TOOL_ARGS_JSON_CHARS) {
        args = part.arguments;
      }
    } catch {
      argumentsPreview = '[arguments]';
    }
  }
  return { name, argumentsPreview, ...(args !== undefined ? { arguments: args } : {}) };
}

function formatToolLine(entry: ToolCallEntry): string {
  return entry.argumentsPreview ? `${entry.name}(${entry.argumentsPreview})` : `${entry.name}()`;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function allowImageUrl(url: string): string | null {
  const u = url.trim();
  if (u.startsWith('https://') || u.startsWith('http://')) return u;
  if (u.startsWith('data:image/')) return u;
  return null;
}

function extractImageUrlFromPart(raw: Record<string, unknown>): string | null {
  const type = raw.type;
  if (type === 'image') {
    if (typeof raw.url === 'string') return allowImageUrl(raw.url);
    const nested = raw.image_url;
    if (isRecord(nested) && typeof nested.url === 'string') return allowImageUrl(nested.url);
  }
  if (type === 'image_url') {
    const nested = raw.image_url;
    if (isRecord(nested) && typeof nested.url === 'string') return allowImageUrl(nested.url);
  }
  return null;
}

function normalizeTextForBody(raw: string): string {
  return sanitizeDisplayText(stripFinalEnvelope(raw));
}

function mergeLinkPreviews(target: LinkPreview[], more: LinkPreview[]): void {
  const seen = new Set(target.map((p) => p.url));
  for (const p of more) {
    if (seen.has(p.url) || target.length >= MAX_LINK_PREVIEWS) continue;
    seen.add(p.url);
    target.push(p);
  }
}

function ingestTextSegment(
  segment: string,
  textBits: string[],
  linkAccumulator: LinkPreview[]
): void {
  const normalized = normalizeTextForBody(segment);
  if (!normalized.trim()) return;

  const { links, consumed } = extractLinkPreviewsFromTextSegment(normalized);
  if (consumed) {
    mergeLinkPreviews(linkAccumulator, links);
    return;
  }
  textBits.push(normalized);
}

/** Normalize gateway `content` (array of parts, legacy string, or missing). */
export function parseContentParts(content: unknown): ParsedContentParts {
  const toolLines: string[] = [];
  const toolCalls: ToolCallEntry[] = [];
  const textBits: string[] = [];
  const thinkingBits: string[] = [];
  const imageUrls: string[] = [];
  const linkPreviews: LinkPreview[] = [];
  const seenUrls = new Set<string>();

  if (typeof content === 'string') {
    const normalized = normalizeTextForBody(content);
    const trimmedStart = normalized.trim();
    if (trimmedStart.startsWith('{')) {
      try {
        const parsedObject: unknown = JSON.parse(trimmedStart);
        if (isRecord(parsedObject)) {
          mergeLinkPreviews(linkPreviews, extractLinkPreviewsFromGeminiWebSearchPayload(parsedObject));
          if (linkPreviews.length > 0) {
            return { body: '', reasoning: '', toolLines, toolCalls, imageUrls, linkPreviews };
          }
        }
      } catch {
        /* not JSON; fall through */
      }
    }
    if (normalized.trim()) {
      const { links, consumed } = extractLinkPreviewsFromTextSegment(normalized);
      if (consumed) {
        mergeLinkPreviews(linkPreviews, links);
        return { body: '', reasoning: '', toolLines, toolCalls, imageUrls, linkPreviews };
      }
      ingestTextSegment(content, textBits, linkPreviews);
    }
    let body = textBits.join('\n\n');
    const stripped = stripLeadingLinkListJsonFromBody(body);
    body = stripped.body;
    mergeLinkPreviews(linkPreviews, stripped.links);
    return { body, reasoning: '', toolLines, toolCalls, imageUrls, linkPreviews };
  }

  if (Array.isArray(content)) {
    for (const raw of content) {
      if (!isRecord(raw)) continue;
      const type = raw.type;
      const img = extractImageUrlFromPart(raw);
      if (img && !seenUrls.has(img)) {
        seenUrls.add(img);
        imageUrls.push(img);
      }
      if (type === 'text' && typeof raw.text === 'string' && raw.text.trim()) {
        ingestTextSegment(raw.text, textBits, linkPreviews);
      } else if (type === 'thinking' && typeof raw.thinking === 'string' && raw.thinking.trim()) {
        thinkingBits.push(sanitizeDisplayText(raw.thinking));
      } else if (type === 'toolCall') {
        const part = raw as Extract<ChatContentPart, { type: 'toolCall' }>;
        const entry = toolCallEntryFromPart(part);
        toolCalls.push(entry);
        toolLines.push(formatToolLine(entry));
      }
    }

    let body = textBits.join('\n\n');
    const stripped = stripLeadingLinkListJsonFromBody(body);
    body = stripped.body;
    mergeLinkPreviews(linkPreviews, stripped.links);
    const reasoning = thinkingBits.join('\n\n');
    return { body, reasoning, toolLines, toolCalls, imageUrls, linkPreviews };
  }

  if (isRecord(content)) {
    mergeLinkPreviews(linkPreviews, extractLinkPreviewsFromGeminiWebSearchPayload(content));
    if (linkPreviews.length === 0) {
      mergeLinkPreviews(linkPreviews, extractLinkPreviewsFromParsedJson(content));
    }
    return { body: '', reasoning: '', toolLines, toolCalls, imageUrls, linkPreviews };
  }

  return { body: '', reasoning: '', toolLines, toolCalls, imageUrls, linkPreviews };
}

/** Build main bubble text from parsed parts + optional tool summary lines */
export function bodyWithToolSummary(parsed: ParsedContentParts): string {
  const { body, toolLines } = parsed;
  if (!toolLines.length) return body;
  const toolsBlock = toolLines.map((line) => `• ${line}`).join('\n');
  if (!body.trim()) return toolsBlock;
  return `${body}\n\n${toolsBlock}`;
}

export interface RawHistoryMessage {
  role?: string;
  content?: unknown;
  timestamp?: number;
  senderLabel?: string;
  errorMessage?: string;
  stopReason?: string;
  model?: string;
  /** e.g. `google` / `google-generative-ai` when present on assistant rows */
  provider?: string;
  /** Transport label (e.g. `google-generative-ai`); used when `provider` is absent */
  api?: string;
  /** Gateway usage object (`input` / `output` / `cacheRead` / …) */
  usage?: unknown;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
}

/** Normalized row for UI after chat.history */
export interface FetchedChatMessage {
  role: string;
  content: string;
  reasoning: string;
  senderLabel?: string;
  timestamp?: number;
  isError?: boolean;
  imageUrls?: string[];
  linkPreviews?: LinkPreview[];
  toolCalls?: ToolCallEntry[];
  /** Present for `toolresult` rows */
  toolName?: string;
  /** Original gateway `content` for tool results (pretty-print when expanded) */
  toolRawPayload?: unknown;
  /** Client estimate from Vertex-style $/1M table (Google models only) */
  estimatedCostUsd?: number;
  modelRef?: string;
  provider?: string;
}

export interface ChatHistoryResponse {
  sessionKey?: string;
  sessionId?: string;
  messages?: RawHistoryMessage[];
}

export interface AssistantDisplayPayload {
  content: string;
  reasoning: string;
  linkPreviews: LinkPreview[];
  imageUrls: string[];
  toolCalls: ToolCallEntry[];
  isError?: boolean;
  estimatedCostUsd?: number;
}

export function assistantDisplayBody(
  role: string,
  parsed: ParsedContentParts,
  raw: Pick<RawHistoryMessage, 'errorMessage' | 'stopReason' | 'model'>,
  options?: { omitToolSummary?: boolean }
): string {
  const base = options?.omitToolSummary
    ? sanitizeDisplayText(parsed.body)
    : sanitizeDisplayText(bodyWithToolSummary(parsed));
  if (base.trim()) return base;
  if (role !== 'assistant' && role !== 'ai') return base;
  const err = raw.errorMessage?.trim();
  if (!err) return base;
  const friendly = formatGatewayErrorForDisplay(err);
  const meta = [
    raw.model && `model: ${sanitizeDisplayText(String(raw.model))}`,
    raw.stopReason &&
      raw.stopReason !== 'error' &&
      `stop: ${sanitizeDisplayText(String(raw.stopReason))}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return meta ? `${friendly}\n\n(${meta})` : friendly;
}

export function mapRawHistoryMessage(m: RawHistoryMessage): FetchedChatMessage {
  const role = (m.role ?? 'user').toLowerCase();

  if (role === 'toolresult') {
    const parsed = parseContentParts(m.content);
    const toolName =
      typeof m.toolName === 'string' && m.toolName.trim() ? sanitizeDisplayText(m.toolName.trim()) : 'tool';
    return {
      role: 'toolresult',
      content: '',
      reasoning: '',
      toolName,
      toolRawPayload: m.content,
      senderLabel:
        typeof m.senderLabel === 'string' ? sanitizeDisplayText(m.senderLabel) : undefined,
      timestamp: typeof m.timestamp === 'number' ? m.timestamp : undefined,
      isError: !!m.isError,
      imageUrls: parsed.imageUrls.length ? parsed.imageUrls : undefined,
    };
  }

  const parsed = parseContentParts(m.content);
  const hasAssistantError = role === 'assistant' && !!(m.errorMessage?.trim());
  const isError =
    hasAssistantError && !parsed.body.trim() && !parsed.toolLines.length && !parsed.toolCalls.length;
  const content = assistantDisplayBody(role, parsed, m, {
    omitToolSummary: role === 'assistant' || role === 'ai',
  });
  const pricingProvider =
    (typeof m.provider === 'string' && m.provider) ||
    (typeof m.api === 'string' && m.api) ||
    undefined;
  const modelRef = typeof m.model === 'string' ? m.model : undefined;
  const estimatedCostUsd =
    role === 'assistant' || role === 'ai'
      ? estimateUsdFromUsage(pricingProvider, modelRef, m.usage)
      : undefined;
  return {
    role,
    content,
    reasoning: parsed.reasoning,
    senderLabel:
      typeof m.senderLabel === 'string' ? sanitizeDisplayText(m.senderLabel) : undefined,
    timestamp: typeof m.timestamp === 'number' ? m.timestamp : undefined,
    isError,
    imageUrls: parsed.imageUrls.length ? parsed.imageUrls : undefined,
    linkPreviews: parsed.linkPreviews.length ? parsed.linkPreviews : undefined,
    toolCalls: parsed.toolCalls.length ? parsed.toolCalls : undefined,
    ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
    ...(modelRef !== undefined ? { modelRef } : {}),
    ...(typeof m.provider === 'string' ? { provider: m.provider } : {}),
  };
}

/**
 * Normalized assistant payload for final chat events and history alignment.
 */
export function parseAssistantDisplayPayload(
  message: unknown,
  raw?: Pick<RawHistoryMessage, 'errorMessage' | 'stopReason' | 'model' | 'provider' | 'usage'> & {
    role?: string;
  }
): AssistantDisplayPayload {
  const role = (raw?.role ?? 'assistant').toLowerCase();
  const mergedRaw: Pick<RawHistoryMessage, 'errorMessage' | 'stopReason' | 'model' | 'provider' | 'usage'> & {
    role?: string;
  } = { ...raw };
  if (isRecord(message)) {
    if (typeof message.model === 'string') mergedRaw.model = message.model;
    if (typeof message.provider === 'string') mergedRaw.provider = message.provider;
    if ('usage' in message) mergedRaw.usage = message.usage;
    if (typeof message.api === 'string' && !mergedRaw.provider) mergedRaw.provider = message.api;
  }
  let contentPayload: unknown = message;
  if (typeof message === 'string') {
    contentPayload = message;
  } else if (isRecord(message)) {
    if (typeof message.text === 'string') {
      contentPayload = normalizeTextForBody(message.text);
    } else if ('content' in message) {
      contentPayload = (message as { content: unknown }).content;
    }
  }
  const parsed = parseContentParts(contentPayload);
  const content = assistantDisplayBody(role, parsed, mergedRaw, { omitToolSummary: true });
  const hasAssistantError = role === 'assistant' && !!(mergedRaw.errorMessage?.trim());
  const isError =
    hasAssistantError && !parsed.body.trim() && !parsed.toolCalls.length && !parsed.toolLines.length;
  const estimatedCostUsd =
    role === 'assistant' || role === 'ai'
      ? estimateUsdFromUsage(mergedRaw.provider, mergedRaw.model, mergedRaw.usage)
      : undefined;
  return {
    content,
    reasoning: parsed.reasoning,
    linkPreviews: parsed.linkPreviews,
    imageUrls: parsed.imageUrls,
    toolCalls: parsed.toolCalls,
    isError: isError || undefined,
    ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
  };
}

/**
 * Extract incremental text from chat stream payloads (string, { text }, or { content } parts).
 * Omits tool summary lines so tool rows are supplied via final payload / history, not duplicated in stream text.
 */
export function extractStreamText(message: unknown): string {
  if (message === undefined || message === null) return '';
  if (typeof message === 'string') return sanitizeDisplayText(stripFinalEnvelope(message));
  if (!isRecord(message)) return '';
  if (typeof message.text === 'string') return sanitizeDisplayText(stripFinalEnvelope(message.text));
  const parsed = parseContentParts(message.content);
  return sanitizeDisplayText(parsed.body);
}

/** Hints for UI run phase (delta payloads); heuristic when the gateway omits explicit tool phases. */
export interface StreamPhaseHints {
  hasAssistantText: boolean;
  hasThinking: boolean;
  hasToolCalls: boolean;
}

/**
 * Derive phase hints from a chat `delta` message shape (mirrors {@link extractStreamText} unpacking).
 */
export function inferStreamPhaseHints(message: unknown): StreamPhaseHints {
  if (message === undefined || message === null) {
    return { hasAssistantText: false, hasThinking: false, hasToolCalls: false };
  }
  if (typeof message === 'string') {
    const parsed = parseContentParts(message);
    return {
      hasAssistantText: !!parsed.body.trim(),
      hasThinking: !!parsed.reasoning.trim(),
      hasToolCalls: parsed.toolCalls.length > 0 || parsed.toolLines.length > 0,
    };
  }
  if (!isRecord(message)) {
    return { hasAssistantText: false, hasThinking: false, hasToolCalls: false };
  }
  if (typeof message.text === 'string') {
    const body = sanitizeDisplayText(stripFinalEnvelope(message.text)).trim();
    return { hasAssistantText: body.length > 0, hasThinking: false, hasToolCalls: false };
  }
  const parsed = parseContentParts(message.content);
  return {
    hasAssistantText: !!parsed.body.trim(),
    hasThinking: !!parsed.reasoning.trim(),
    hasToolCalls: parsed.toolCalls.length > 0 || parsed.toolLines.length > 0,
  };
}
