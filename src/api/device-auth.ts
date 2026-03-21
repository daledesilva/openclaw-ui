/**
 * Browser device identity and Ed25519 signing for OpenClaw gateway connect.
 * Matches OpenClaw v3 device auth payload format.
 */

const STORAGE_KEY = 'openclaw-device-identity';

function normalizeMetadata(value?: string | null): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const buf = data instanceof ArrayBuffer ? data : new Uint8Array(data);
  return crypto.subtle.digest('SHA-256', buf as BufferSource);
}

function hexEncode(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface DeviceIdentity {
  deviceId: string;
  publicKeyBase64Url: string;
  privateKeyJwk: JsonWebKey;
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  );
  return pair;
}

async function deriveDeviceId(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', publicKey);
  const hash = await sha256(raw);
  return hexEncode(hash);
}

async function exportPublicKeyBase64Url(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', publicKey);
  return base64UrlEncode(raw);
}

export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { deviceId?: string; publicKeyBase64Url?: string; privateKeyJwk?: JsonWebKey };
      if (parsed?.deviceId && parsed?.publicKeyBase64Url && parsed?.privateKeyJwk) {
        return {
          deviceId: parsed.deviceId,
          publicKeyBase64Url: parsed.publicKeyBase64Url,
          privateKeyJwk: parsed.privateKeyJwk,
        };
      }
    }
  } catch {
    /* invalid stored data */
  }

  const pair = await generateKeyPair();
  const deviceId = await deriveDeviceId(pair.publicKey);
  const publicKeyBase64Url = await exportPublicKeyBase64Url(pair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

  const identity: DeviceIdentity = {
    deviceId,
    publicKeyBase64Url,
    privateKeyJwk,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
}): string {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  const platform = normalizeMetadata(params.platform);
  const deviceFamily = normalizeMetadata(params.deviceFamily);
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join('|');
}

export async function signDevicePayload(identity: DeviceIdentity, payload: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    identity.privateKeyJwk,
    { name: 'Ed25519' },
    false,
    ['sign']
  );
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const sig = await crypto.subtle.sign('Ed25519', privateKey, data);
  return base64UrlEncode(sig);
}

export async function createDeviceBlock(params: {
  identity: DeviceIdentity;
  nonce: string;
  token?: string;
}): Promise<{ id: string; publicKey: string; signature: string; signedAt: number; nonce: string }> {
  const signedAtMs = Date.now();
  const payload = buildDeviceAuthPayloadV3({
    deviceId: params.identity.deviceId,
    clientId: 'webchat-ui',
    clientMode: 'webchat',
    role: 'operator',
    scopes: ['operator.read', 'operator.write'],
    signedAtMs,
    token: params.token ?? null,
    nonce: params.nonce,
    platform: 'web',
    deviceFamily: null,
  });
  const signature = await signDevicePayload(params.identity, payload);
  return {
    id: params.identity.deviceId,
    publicKey: params.identity.publicKeyBase64Url,
    signature,
    signedAt: signedAtMs,
    nonce: params.nonce,
  };
}

export function isDeviceSigningAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined' && typeof crypto.subtle.generateKey === 'function';
}
