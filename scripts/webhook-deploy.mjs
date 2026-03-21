import http from 'http';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

/**
 * Optional host-only env file (gitignored). Does not override existing process.env keys.
 */
function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

const envFile = process.env.WEBHOOK_ENV_FILE || join(repoRoot, '.env.webhook');
loadDotEnvFile(envFile);

const secret = process.env.DEPLOY_WEBHOOK_SECRET;
const listenHost = process.env.WEBHOOK_LISTEN_HOST || '127.0.0.1';
const listenPort = parseInt(process.env.WEBHOOK_LISTEN_PORT || '8788', 10);

if (!secret) {
  console.error(
    'Missing DEPLOY_WEBHOOK_SECRET (environment variable or .env.webhook in repo root)'
  );
  process.exit(1);
}

function verifyBearer(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const a = Buffer.from(secret, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

let deployInProgress = false;

/**
 * Run deploy in the background so HTTP responds quickly. Cloudflare (and other
 * proxies) typically time out around ~100s; npm ci + build often exceeds that (524).
 */
function startDeployInBackground() {
  const child = spawn('npm', ['run', 'deploy:local'], {
    cwd: repoRoot,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  child.on('error', (err) => {
    console.error('[webhook] deploy spawn error:', err);
    deployInProgress = false;
  });
  child.on('close', (code) => {
    deployInProgress = false;
    if (code === 0) {
      console.log('[webhook] deploy:local finished OK');
    } else {
      console.error('[webhook] deploy:local exited with code', code);
    }
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (req.method === 'POST' && url.pathname === '/deploy') {
    if (!verifyBearer(req.headers.authorization)) {
      json(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }

    if (deployInProgress) {
      json(res, 429, { ok: false, error: 'deploy_in_progress' });
      return;
    }

    deployInProgress = true;
    try {
      await readBody(req);
    } catch (e) {
      deployInProgress = false;
      console.error(e);
      json(res, 400, { ok: false, error: 'bad_request' });
      return;
    }

    try {
      startDeployInBackground();
    } catch (e) {
      deployInProgress = false;
      console.error(e);
      json(res, 500, {
        ok: false,
        error: 'spawn_failed',
        message: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    json(res, 202, {
      ok: true,
      message: 'deploy_started',
      note: 'npm run deploy:local runs in the background; watch this terminal for result.',
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

server.listen(listenPort, listenHost, () => {
  console.log(
    `[webhook-deploy] http://${listenHost}:${listenPort}  POST /deploy  GET /health`
  );
});
