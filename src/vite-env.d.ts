/// <reference types="vite/client" />

declare module 'virtual:app-version' {
  /** Semver core from package.json plus build metadata, e.g. `0.1.0+7`. */
  export const VITE_APP_VERSION_FULL: string;
}

interface ImportMetaEnv {
  /** Full WebSocket URL to the OpenClaw gateway, e.g. ws://192.168.1.50:18789. Omit on the server machine so the UI uses the same host as the page. */
  readonly VITE_OPENCLAW_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
