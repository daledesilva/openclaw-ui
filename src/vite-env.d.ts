/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full WebSocket URL to the OpenClaw gateway, e.g. ws://192.168.1.50:18789. Omit on the server machine so the UI uses the same host as the page. */
  readonly VITE_OPENCLAW_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
