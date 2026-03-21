/** C0 controls except tab, LF, CR */
const ASCII_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Zero-width and bidi override characters (spoofing / layout tricks) */
const BIDI_AND_ZW = /[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]/g;

/**
 * Safe plain text for React/MUI text nodes: strip controls and risky Unicode,
 * normalize newlines. Does not interpret HTML (React already escapes); this
 * removes garbage from gateway/model output.
 */
export function sanitizeDisplayText(input: string): string {
  if (!input) return input;
  let s = input.replace(ASCII_CONTROLS, '').replace(BIDI_AND_ZW, '');
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return s;
}

/**
 * OpenClaw often returns assistant errors like:
 * `403 {"type":"error","error":{"message":"…"}}`
 * Pull out the inner human message when JSON is present.
 */
export function formatGatewayErrorForDisplay(raw: string): string {
  const t = raw.trim();
  const brace = t.indexOf('{');
  if (brace === -1) return sanitizeDisplayText(t);

  const prefix = t.slice(0, brace).trim();
  const jsonPart = t.slice(brace);

  try {
    const obj = JSON.parse(jsonPart) as {
      error?: { message?: string; type?: string };
      message?: string;
    };
    const inner = obj?.error?.message ?? obj?.message;
    if (typeof inner === 'string' && inner.trim()) {
      const msg = inner.trim();
      const combined = prefix ? `${prefix} — ${msg}` : msg;
      return sanitizeDisplayText(combined);
    }
  } catch {
    /* use full string */
  }

  return sanitizeDisplayText(t);
}
