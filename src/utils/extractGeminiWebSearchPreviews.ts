/**
 * OpenClaw / Gemini web_search tool payloads often wrap untrusted HTML or text inside
 * `content` behind <<<EXTERNAL_UNTRUSTED_CONTENT ...>>> markers. This module unwraps
 * that envelope and derives LinkPreview[] for the carousel.
 */

import { sanitizeDisplayText } from './sanitizeDisplayText';
import {
  type LinkPreview,
  extractLinkPreviewsFromParsedJson,
  extractLinkPreviewsFromTextSegment,
  stripLeadingLinkListJsonFromBody,
} from './extractLinkPreviews';

const MAX_INNER_CHARS = 200_000;
const MAX_LINKS = 20;

/** Opening tag: <<<EXTERNAL_UNTRUSTED_CONTENT ...>>> */
const EXTERNAL_OPEN = /<<<EXTERNAL_UNTRUSTED_CONTENT\b[\s\S]*?>>>/;
const EXTERNAL_CLOSE = /<<<\s*\/\s*EXTERNAL_UNTRUSTED_CONTENT\s*>>>/gi;
const EXTERNAL_END = /<<<END_EXTERNAL_UNTRUSTED_CONTENT\s*>>>/gi;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isHttpUrlString(s: string): boolean {
  const t = s.trim();
  return t.startsWith('https://') || t.startsWith('http://');
}

export function isGeminiWebSearchToolEnvelope(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const ec = payload.externalContent;
  if (isRecord(ec) && ec.source === 'web_search') return true;
  const c = payload.content;
  if (typeof c === 'string' && c.includes('EXTERNAL_UNTRUSTED_CONTENT')) return true;
  return false;
}

/**
 * Strip Gemini external-content markers from the inner string.
 */
export function unwrapExternalUntrustedContentString(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^[\s\n]*/, '');
  s = s.replace(EXTERNAL_OPEN, '');
  s = s.replace(EXTERNAL_CLOSE, '');
  s = s.replace(EXTERNAL_END, '');
  return s.trim();
}

function dedupeCap(previews: LinkPreview[]): LinkPreview[] {
  const seen = new Set<string>();
  const out: LinkPreview[] = [];
  for (const p of previews) {
    if (!isHttpUrlString(p.url) || seen.has(p.url) || out.length >= MAX_LINKS) continue;
    seen.add(p.url);
    out.push({
      url: p.url.trim(),
      ...(p.title ? { title: sanitizeDisplayText(p.title) } : {}),
    });
  }
  return out;
}

function extractFromHtmlAnchors(inner: string): LinkPreview[] {
  const re = /<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const out: LinkPreview[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null && out.length < MAX_LINKS) {
    let url = trimUrlTail(m[1]!.trim());
    if (!isHttpUrlString(url)) continue;
    const rawTitle = m[2]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const title = rawTitle ? sanitizeDisplayText(rawTitle.slice(0, 200)) : undefined;
    out.push({ url, ...(title ? { title } : {}) });
  }
  return dedupeCap(out);
}

function extractFromMarkdownLinks(inner: string): LinkPreview[] {
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const out: LinkPreview[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null && out.length < MAX_LINKS) {
    const title = sanitizeDisplayText(m[1]!.trim());
    let url = m[2]!.trim();
    url = url.replace(/[),.;]+$/g, '');
    if (!isHttpUrlString(url)) continue;
    out.push({ url, ...(title ? { title } : {}) });
  }
  return dedupeCap(out);
}

function trimUrlTail(url: string): string {
  return url.replace(/[),.;:'"`]+$/g, '');
}

/**
 * Last resort: find http(s) URLs and use same-line text before the URL as a title hint.
 */
function extractFromPlainUrls(inner: string): LinkPreview[] {
  const lines = inner.split(/\r?\n/);
  const urlRe = /\bhttps?:\/\/[^\s\])"'<>]+/gi;
  const out: LinkPreview[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (out.length >= MAX_LINKS) break;
    let m: RegExpExecArray | null;
    urlRe.lastIndex = 0;
    while ((m = urlRe.exec(line)) !== null && out.length < MAX_LINKS) {
      let url = trimUrlTail(m[0]!);
      if (!isHttpUrlString(url) || seen.has(url)) continue;
      seen.add(url);
      const before = line.slice(0, m.index).trim();
      const title =
        before.length > 0 && before.length <= 200 ? sanitizeDisplayText(before.replace(/^[-*•\d.)\s]+/, '')) : undefined;
      out.push({ url, ...(title ? { title } : {}) });
    }
  }
  return dedupeCap(out);
}

/**
 * Parse unwrapped inner text: JSON link lists, markdown links, then plain URLs.
 */
export function extractLinkPreviewsFromWebSearchInner(innerRaw: string): LinkPreview[] {
  const inner =
    innerRaw.length > MAX_INNER_CHARS ? innerRaw.slice(0, MAX_INNER_CHARS) : innerRaw;
  const trimmed = inner.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const fromJson = extractLinkPreviewsFromParsedJson(parsed);
    if (fromJson.length > 0) return dedupeCap(fromJson);
  } catch {
    /* not whole-string JSON */
  }

  const stripped = stripLeadingLinkListJsonFromBody(trimmed);
  if (stripped.links.length > 0) return dedupeCap(stripped.links);

  const segment = stripped.body.trim() || trimmed;
  const { links, consumed } = extractLinkPreviewsFromTextSegment(segment);
  if (consumed && links.length > 0) return dedupeCap(links);

  const html = extractFromHtmlAnchors(trimmed);
  if (html.length > 0) return html;

  const md = extractFromMarkdownLinks(trimmed);
  if (md.length > 0) return md;

  return extractFromPlainUrls(trimmed);
}

/**
 * If `payload` is a Gemini / web_search tool envelope, extract carousel previews from
 * `payload.content`. Returns [] when not applicable or when inner parse yields nothing.
 */
export function extractLinkPreviewsFromGeminiWebSearchPayload(payload: unknown): LinkPreview[] {
  if (!isGeminiWebSearchToolEnvelope(payload) || !isRecord(payload)) return [];
  const c = payload.content;
  if (typeof c !== 'string' || !c.trim()) return [];

  const unwrapped = unwrapExternalUntrustedContentString(c);
  return extractLinkPreviewsFromWebSearchInner(unwrapped);
}
