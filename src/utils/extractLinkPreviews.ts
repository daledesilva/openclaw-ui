/**
 * Detect JSON-only text segments that represent link/search result lists and extract
 * structured previews so the UI can render a carousel instead of a raw JSON block.
 */

export interface LinkPreview {
  url: string;
  title?: string;
}

const MAX_LINKS = 20;

/**
 * Object keys whose values are arrays of result rows, or (for nested APIs) an object
 * with a `value` array (e.g. Bing `webPages`).
 */
const ARRAY_PROPERTY_ALLOWLIST = [
  'results',
  'links',
  'items',
  'organic',
  'organic_results',
  'organicResults',
  'search_results',
  'searchResults',
  'pages',
  'documents',
] as const;

/** Keys where the payload is `{ value: [...] }` (Bing-style). */
const NESTED_VALUE_KEYS = ['webPages', 'relatedSearches'] as const;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isHttpUrlString(s: string): boolean {
  const t = s.trim();
  return t.startsWith('https://') || t.startsWith('http://');
}

function pickTitle(row: Record<string, unknown>): string | undefined {
  const candidates = ['title', 'name', 'headline', 'snippet', 'description'] as const;
  for (const key of candidates) {
    const v = row[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickUrlFromRow(row: Record<string, unknown>): string | null {
  for (const key of ['url', 'link', 'href'] as const) {
    const v = row[key];
    if (typeof v === 'string' && isHttpUrlString(v)) return v.trim();
  }
  return null;
}

function rowToPreview(row: unknown): LinkPreview | null {
  if (!isRecord(row)) return null;
  const urlRaw = pickUrlFromRow(row);
  if (!urlRaw) return null;
  const title = pickTitle(row);
  return { url: urlRaw, ...(title ? { title } : {}) };
}

function resultArrayFromRecord(obj: Record<string, unknown>): unknown[] | null {
  for (const key of ARRAY_PROPERTY_ALLOWLIST) {
    const v = obj[key];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  for (const key of NESTED_VALUE_KEYS) {
    const v = obj[key];
    if (isRecord(v) && Array.isArray(v.value) && v.value.length > 0) {
      return v.value;
    }
  }
  const data = obj.data;
  if (isRecord(data)) {
    for (const key of ARRAY_PROPERTY_ALLOWLIST) {
      const v = data[key];
      if (Array.isArray(v) && v.length > 0) return v;
    }
    for (const key of NESTED_VALUE_KEYS) {
      const v = data[key];
      if (isRecord(v) && Array.isArray(v.value) && v.value.length > 0) {
        return v.value;
      }
    }
  }
  return null;
}

function previewsFromParsedJson(parsed: unknown): LinkPreview[] {
  if (Array.isArray(parsed)) {
    const out: LinkPreview[] = [];
    for (const row of parsed) {
      const p = rowToPreview(row);
      if (p) out.push(p);
    }
    return out;
  }
  if (isRecord(parsed)) {
    const direct = resultArrayFromRecord(parsed);
    if (direct) {
      return previewsFromParsedJson(direct);
    }
  }
  return [];
}

/**
 * Extract link previews from an already-parsed JSON value (object or array).
 * Use when the gateway sends tool output as a plain object instead of chat content parts.
 */
export function extractLinkPreviewsFromParsedJson(parsed: unknown): LinkPreview[] {
  const raw = previewsFromParsedJson(parsed);
  return dedupeByUrl(raw);
}

function dedupeByUrl(previews: LinkPreview[]): LinkPreview[] {
  const seen = new Set<string>();
  const out: LinkPreview[] = [];
  for (const p of previews) {
    const key = p.url;
    if (seen.has(key) || out.length >= MAX_LINKS) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * If `segment` is JSON-only (entire string trims to valid JSON), and the value matches
 * the narrow link-list schema, return extracted links and consumed: true.
 */
export function extractLinkPreviewsFromTextSegment(segment: string): { links: LinkPreview[]; consumed: boolean } {
  const trimmed = segment.trim();
  if (!trimmed) return { links: [], consumed: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { links: [], consumed: false };
  }

  const raw = previewsFromParsedJson(parsed);
  if (raw.length === 0) return { links: [], consumed: false };
  return { links: dedupeByUrl(raw), consumed: true };
}

/** Try to peel a leading JSON object/array from `text` (with string-aware bracket matching). */
export function tryConsumeLeadingJsonValue(text: string): { jsonText: string | null; rest: string } {
  const s = text;
  let i = 0;
  while (i < s.length && /\s/.test(s[i]!)) i++;
  if (i >= s.length) return { jsonText: null, rest: text };
  const start = s[i];
  if (start !== '[' && start !== '{') return { jsonText: null, rest: text };

  const open = start;
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let j = i; j < s.length; j++) {
    const c = s[j]!;
    if (inString) {
      if (escape) {
        escape = false;
      } else if (c === '\\') {
        escape = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === open) depth++;
    if (c === close) {
      depth--;
      if (depth === 0) {
        const jsonText = s.slice(i, j + 1);
        const rest = s.slice(j + 1);
        return { jsonText, rest };
      }
    }
  }
  return { jsonText: null, rest: text };
}

/**
 * Remove leading (and optionally repeated) JSON link-list blocks from a markdown body
 * and merge extracted links. Bounded: only peels JSON values that fully match the extractor.
 */
export function stripLeadingLinkListJsonFromBody(body: string): { body: string; links: LinkPreview[] } {
  let rest = body;
  const merged: LinkPreview[] = [];
  const seen = new Set<string>();

  while (rest.trim().length > 0) {
    const { jsonText, rest: after } = tryConsumeLeadingJsonValue(rest);
    if (!jsonText) break;
    const { links, consumed } = extractLinkPreviewsFromTextSegment(jsonText);
    if (!consumed) break;
    for (const p of links) {
      if (seen.has(p.url) || merged.length >= MAX_LINKS) continue;
      seen.add(p.url);
      merged.push(p);
    }
    rest = after.replace(/^\s+/, '').replace(/^\n+/, '');
  }

  return { body: rest.trim(), links: merged };
}
