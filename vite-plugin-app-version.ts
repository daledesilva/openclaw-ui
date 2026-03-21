import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { OPENCLAW_APP_VERSION_HMR_EVENT } from './src/versionHmrEvent';

const VIRTUAL_ID = 'virtual:app-version';
const RESOLVED = '\0' + VIRTUAL_ID;
const REV_FILE = '.openclaw-build-rev';

function readPackageVersion(root: string): string {
  const raw = readFileSync(resolve(root, 'package.json'), 'utf8');
  const v = JSON.parse(raw)?.version;
  return typeof v === 'string' && v.length > 0 ? v : '0.0.0';
}

function readRevFromFile(root: string): number {
  const path = resolve(root, REV_FILE);
  if (!existsSync(path)) return 0;
  const n = parseInt(readFileSync(path, 'utf8').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function writeRevFile(root: string, n: number): void {
  writeFileSync(resolve(root, REV_FILE), String(n), 'utf8');
}

function bumpRevFile(root: string): number {
  const next = readRevFromFile(root) + 1;
  writeRevFile(root, next);
  return next;
}

function envBuildRev(mode: string, root: string): string | undefined {
  const v = loadEnv(mode, root, ['VITE_']).VITE_BUILD_REV?.trim();
  return v && v.length > 0 ? v : undefined;
}

function computeVersionFull(mode: string, root: string): string {
  const base = readPackageVersion(root);
  const ev = envBuildRev(mode, root);
  const rev = ev ?? String(readRevFromFile(root));
  return `${base}+${rev}`;
}

export function appVersionPlugin(): Plugin {
  let mode = 'development';
  let root = process.cwd();

  return {
    name: 'app-version',

    configResolved(config) {
      mode = config.mode;
      root = config.root;
    },

    buildStart() {
      if (envBuildRev(mode, root)) return;
      bumpRevFile(root);
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED;
      return undefined;
    },

    load(id) {
      if (id !== RESOLVED) return null;
      const full = computeVersionFull(mode, root);
      return `export const VITE_APP_VERSION_FULL = ${JSON.stringify(full)};`;
    },

    configureServer(server) {
      let debounce: ReturnType<typeof setTimeout> | undefined;

      const bumpAndNotify = () => {
        const { mode: m, root: r } = server.config;
        if (envBuildRev(m, r)) return;
        bumpRevFile(r);
        const full = computeVersionFull(m, r);
        server.ws.send({
          type: 'custom',
          event: OPENCLAW_APP_VERSION_HMR_EVENT,
          data: { full },
        });
      };

      server.watcher.on('change', (file) => {
        const norm = file.replace(/\\/g, '/');
        if (!norm.includes('/src/') && !norm.endsWith('/index.html')) return;
        clearTimeout(debounce);
        debounce = setTimeout(bumpAndNotify, 300);
      });
    },
  };
}
