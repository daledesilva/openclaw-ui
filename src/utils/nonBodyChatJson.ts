/**
 * Detect JSON blobs that should not become visible assistant body text (search/link-list payloads).
 * No structured previews are built — we only strip or treat as empty body.
 */

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isHttpUrlString(s: string): boolean {
  const t = s.trim();
  return t.startsWith('https://') || t.startsWith('http://');
}

function pickUrlFromRow(row: Record<string, unknown>): string | null {
  for (const key of ['url', 'link', 'href'] as const) {
    const v = row[key];
    if (typeof v === 'string' && isHttpUrlString(v)) return v.trim();
  }
  return null;
}

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

const NESTED_VALUE_KEYS = ['webPages', 'relatedSearches'] as const;

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
  }
  return null;
}

function rowHasHttpUrl(row: unknown): boolean {
  return isRecord(row) && pickUrlFromRow(row) !== null;
}

/** True when parsed JSON is (or unwraps to) a list of HTTP URL rows — former link-preview payloads. */
export function parsedJsonIsLinkOrSearchResultList(parsed: unknown): boolean {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return false;
    return parsed.some(rowHasHttpUrl);
  }
  if (isRecord(parsed)) {
    const direct = resultArrayFromRecord(parsed);
    if (direct) return parsedJsonIsLinkOrSearchResultList(direct);
  }
  return false;
}

export function isGeminiWebSearchToolEnvelope(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const ec = payload.externalContent;
  if (isRecord(ec) && ec.source === 'web_search') return true;
  const c = payload.content;
  if (typeof c === 'string' && c.includes('EXTERNAL_UNTRUSTED_CONTENT')) return true;
  return false;
}

/** Try to peel a leading JSON object/array from `text` (string-aware bracket matching). */
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

/** Remove leading JSON blocks that are link/search lists only (discarded, not shown). */
export function stripLeadingNonBodyJsonBlocks(body: string): string {
  let rest = body;
  while (rest.trim().length > 0) {
    const { jsonText, rest: after } = tryConsumeLeadingJsonValue(rest);
    if (!jsonText) break;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      break;
    }
    if (!parsedJsonIsLinkOrSearchResultList(parsed)) break;
    rest = after.replace(/^\s+/, '').replace(/^\n+/, '');
  }
  return rest.trim();
}
