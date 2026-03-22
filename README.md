# openclaw-ui

A dedicated PWA web interface for OpenClaw.

---

## If you are OpenClaw

**Your job is to** run this repo on the **gateway host** (serve **`dist/`** next to the gateway), wire **GitHub Actions → webhook → `deploy:local`**, and fix **WebSocket** issues (**18789**). Follow the numbered playbook **in order**. When a step says **Human**, the browser or OS UI is involved—you must **tell them exactly what to click or type**; do not assume they know to add GitHub secrets after the workflow file exists.

**Remember:** The **tunnel hostname** (e.g. `something.their-domain.com`) is only for the **deploy webhook** (port **8788**). The **chat UI** is usually **`http://<LAN-IP>:4173`** from **`setup-and-serve.cmd`** unless they add a **second** tunnel rule later.

**Gateway host:** Do **not** set `VITE_OPENCLAW_GATEWAY_URL` for production builds here. **Dev laptop:** `.env.local` with `VITE_OPENCLAW_GATEWAY_URL` → see **Human quick start**.

---

### Playbook: first-time setup (do in this order)

**1 — Repo on the gateway machine**

- **OpenClaw:** `cd` to a **dedicated** folder for production UI; `git clone` this repo if needed; `git checkout main`.
- **Ask the human to:** Install **[Node.js LTS](https://nodejs.org/)** and **Git** if missing. Confirm `node -v`, `npm -v`, `git --version`.

**2 — Deploy secret (before GitHub URL exists)**

- **OpenClaw:** Generate a **long random** string (e.g. 32+ chars). In the **repo root**, create **`.env.webhook`** (gitignored) with exactly:  
  `DEPLOY_WEBHOOK_SECRET=<that-string>`  
  Optional: `WEBHOOK_LISTEN_PORT=8788` (default).
- **Ask the human to:** In **GitHub → this repository → Settings → Secrets and variables → Actions → New repository secret**, add **`DEPLOY_WEBHOOK_SECRET`** with the **same** string.  
  **Important:** Do this **now**, not “later after Actions.” If **`DEPLOY_WEBHOOK_SECRET`** or **`DEPLOY_WEBHOOK_URL`** is missing, the **notify** job still runs but **skips** the HTTP call and the workflow stays **green**—so missing secrets are easy to miss unless you read the **notify-host** job log.

**3 — Webhook listener**

- **OpenClaw:** From repo root, run **`npm install`** once if `node_modules` is missing. Start **`npm run webhook:deploy`** and keep it running (separate terminal / Task Scheduler / NSSM). It listens on **`127.0.0.1:8788`**: **GET `/health`**, **POST `/deploy`** (Bearer token = `DEPLOY_WEBHOOK_SECRET`).

**4 — Cloudflare Tunnel (public URL → localhost:8788)**

- **Ask the human to:** Install **cloudflared** ([downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)). Run **`cloudflared tunnel login`** and complete the browser flow (pick the Cloudflare account that has **their domain**).
- **OpenClaw:** Run **`cloudflared tunnel create openclaw-ui-deploy`** (or another name; use that name consistently). Then run **`dir %USERPROFILE%\.cloudflared`** (Windows) or `ls ~/.cloudflared` (Unix) and note the **`.json`** credentials filename and the **tunnel UUID** from the create output.
- **OpenClaw:** Create or edit **`%USERPROFILE%\.cloudflared\config.yml`** (Windows). **Ask the human to** open it if needed: `notepad %USERPROFILE%\.cloudflared\config.yml`. Paste the template below; replace **`TUNNEL_UUID`**, **`credentials-file`** (path from **`dir %USERPROFILE%\.cloudflared`**), and **`hostname`** (they pick any subdomain on their Cloudflare zone, e.g. `openclaw-ui-deploy.example.com`).

```yaml
tunnel: TUNNEL_UUID
credentials-file: C:/Users/THEIR_WINDOWS_USER/.cloudflared/TUNNEL_UUID.json

ingress:
  - hostname: openclaw-ui-deploy.example.com
    service: http://127.0.0.1:8788
  - service: http_status:404
```

**YAML rules (if cloudflared errors with “Cannot unmarshal !!str 'http…'”):**  
- Each ingress rule must start with **`-`** (a **list**).  
- **`credentials-file`** on Windows: use **forward slashes** (`C:/Users/...`).  
- No **tabs**—spaces only.  
- The last line **`- service: http_status:404`** is required (catch‑all).

- **OpenClaw:** Run **`cloudflared tunnel route dns openclaw-ui-deploy openclaw-ui-deploy.example.com`** using the **same tunnel name** as in `tunnel create` and the **same `hostname`** as in `config.yml` (adjust to their real FQDN).
- **Ask the human to:** Start the tunnel and leave it running: **`cloudflared tunnel run openclaw-ui-deploy`**. Optionally install **cloudflared as a Windows service** so it survives reboot ([docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/as-a-service/)).

**5 — Prove the tunnel, then set the URL secret**

- **OpenClaw:** With tunnel + **`webhook:deploy`** running, open or `curl` **`https://<their-hostname>/health`** — body must be **`ok`**. If this fails, **do not** continue.
- **Ask the human to:** In **GitHub → Settings → Secrets and variables → Actions**, add **`DEPLOY_WEBHOOK_URL`** = **`https://<their-hostname>/deploy`** (must include the **`/deploy`** path).  
  **Both** secrets must be set for **`curl`** to run. (GitHub does **not** allow `secrets` in a **job-level** `if`, so the workflow checks inside the step and prints **“Skipping deploy webhook…”** when either secret is empty.)

**6 — Optional: smoke-test POST**

- **OpenClaw:**  
  `curl -i -X POST "https://<their-hostname>/deploy" -H "Authorization: Bearer <same-secret-as-env>"`  
  Expect **202** and **`deploy_started`** immediately; **`deploy:local`** then runs **in the background** on the host (watch the **`webhook:deploy`** terminal for success or errors). This avoids **Cloudflare 524** (timeout while **`npm ci`** / build runs).

**7 — Serve the UI (separate from the tunnel)**

- **OpenClaw / human:** From repo root run **`scripts\setup-and-serve.cmd`** (Windows) or equivalent; keep it **running**. This is **port 4173** (`0.0.0.0`). After webhook deploys, **`dist/`** updates; **`serve`** usually does **not** need a restart.

**7a — Allow dev UI origins (two-machine dev setup)**

- **OpenClaw:** When the developer runs **`npm run dev`** on another machine, the browser opens the UI at `http://localhost:5173` (or similar). The gateway checks the WebSocket **`Origin`** header and rejects connections from origins not in **`gateway.controlUi.allowedOrigins`**. In `~/.openclaw/openclaw.json`, under **`gateway`**, add:

```json
"controlUi": {
  "allowedOrigins": [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175"
  ]
}
```

- Covers common Vite ports (5173–5175) and both `localhost` and `127.0.0.1`. If the developer accesses the UI via their machine’s LAN IP (e.g. `http://192.168.50.42:5173`), add that origin too. Restart the gateway after editing.

**8 — Remind the developer**

- **Ask the human to:** On the dev machine, copy [`.env.example`](.env.example) → **`.env.local`** with `VITE_OPENCLAW_GATEWAY_URL=ws://<gateway-LAN-IP>:18789` and run **`npm run dev`**.

---

### After setup: each push to `main`

1. [`.github/workflows/deploy-host.yml`](.github/workflows/deploy-host.yml) runs **`verify`** (`npm ci` + `npm run build`). If it **fails**, fix the build first—the host is not notified.  
2. Job **`notify-host`** always runs after **verify**. Open its log → step **“Trigger deploy webhook”**: either **`curl`** ran (secrets set) or **“Skipping deploy webhook…”** (one or both secrets missing—workflow is still green).  
3. When **`curl`** runs, it **POSTs** the webhook; the listener answers **202** right away and runs **`npm run deploy:local`** in the **background** (so Cloudflare does not hit **524** waiting for a long build). **GitHub green does not prove** the host build succeeded—check the **`webhook:deploy`** window for **`deploy:local finished OK`** or an error.  
4. On the host, **tunnel**, **`npm run webhook:deploy`**, and **`serve`** (4173) should still be running.  
5. Stale PWA: suggest hard refresh.

**OpenClaw (workflow edits):** Never add **`if: ${{ secrets.… }}`** on a **job**—GitHub rejects it. Optional notify logic belongs in a **step** (this repo uses a shell check + skip message).

---

### Manual deploy (no GitHub)

On the host: **`scripts\deploy-local.cmd`** or **`npm run deploy:local`** (discards uncommitted changes on that clone).

---

### If something fails

| Symptom | Check |
|--------|--------|
| **`Cannot unmarshal !!str 'http…'`** in cloudflared | `ingress` rules each start with **`-`**; **`credentials-file`** uses **`/`** not `\`; catch‑all **`http_status:404`** present. |
| CI green but host never updates | Open **notify-host** → if log says **Skipping deploy webhook**, set **both** Action secrets. If **`curl`** ran, check tunnel, **`webhook:deploy`**, and **`/health`**. |
| **notify-host failed** (HTTP **502**) | **Tunnel reached Cloudflare but not your app.** On the gateway PC: (1) **`npm run webhook:deploy`** running and listening on **127.0.0.1:8788**; (2) **`cloudflared tunnel run …`** running; (3) **`config.yml`** `ingress` **`service:`** is **`http://127.0.0.1:8788`** (same port). Test locally: **`curl http://127.0.0.1:8788/health`** → **`ok`**. Start **webhook** before or with **cloudflared**. |
| **524** / slow notify | Webhook returns **202** quickly; if you still see **524**, pull latest **`webhook-deploy.mjs`** and restart **`webhook:deploy`**. |
| Other notify errors | **401** = Bearer secret ≠ **`.env.webhook`**; **404** URL/path; **429** overlapping deploy. Workflow retries **502/503/504** a few times. |
| UI won’t connect to agent | Gateway up; **`gateway.bind: "lan"`** (not `loopback`) so port 18789 listens on LAN; auth set for non-loopback; **`gateway.controlUi.allowedOrigins`** includes dev UI origin (e.g. `http://localhost:5173`); dev **`.env.local`**; firewall allows 18789. |
| UI stale on host | **`serve`** serving **this** repo’s **`dist/`**; run **`deploy-local`**; PWA cache. |

---

## Human quick start (local development)

**Prerequisites:** The OpenClaw gateway must listen on the LAN so the UI can connect from another machine. In `~/.openclaw/openclaw.json`, set `gateway.bind` to `"lan"` (use named modes: `lan`, `loopback`, `tailnet`, `auto`, `custom`—not IPs like `0.0.0.0`). Non-loopback binds require `gateway.auth.token` or `gateway.auth.password`. See [Gateway configuration](https://docs.openclaw.ai/gateway/configuration-reference). If it binds to loopback only, you’ll see WebSocket 1006 / connection refused.

1. Install dependencies: `npm install`
2. Copy [`.env.example`](.env.example) to `.env.local` and set `VITE_OPENCLAW_GATEWAY_URL` to your gateway WebSocket URL (e.g. `ws://192.168.1.50:18789` for remote, or `ws://localhost:18789` if the gateway runs locally).
3. **Token required:** When the gateway binds to LAN (non-loopback), it enforces auth. Either add `VITE_OPENCLAW_GATEWAY_TOKEN` in `.env.local`, or leave it unset and paste the token on first load (stored in `localStorage`). Get the token from the gateway host: `openclaw config get gateway.auth.token`. Without a token, the gateway rejects the connection with "gateway token missing".
4. Run the dev server: `npm run dev`
5. Open the URL shown (usually `http://localhost:5173`).

**First-time device approval:** After the token passes, a new device may need one-time approval. If you see "Device pending approval", run `openclaw devices list` then `openclaw devices approve <requestId>` (or `--latest`) on the gateway host. For a remote gateway, add `--url ws://<gateway-IP>:18789` and `--token <gateway-token>`. Device identity is stored in `localStorage`; clearing it creates a new device and requires another approval. Requires a modern browser (Chrome 137+, Firefox 129+, Safari 17+).

Leave `.env.local` **off** the gateway PC when running `npm run build` so production builds use the page hostname. Set `VITE_OPENCLAW_DEBUG=1` for verbose gateway frame logging in the console. In dev, `VITE_OPENCLAW_SESSIONS_DEBUG=1` additionally logs `sessions.list` and `usage.cost` JSON (for token/cost UI work).

---

## Two-machine summary

| Machine | Role | Typical steps |
|--------|------|----------------|
| **Dev laptop** | Edit UI, hot reload | `.env.local` with `VITE_OPENCLAW_GATEWAY_URL=ws://…:18789`, then `npm run dev` |
| **OpenClaw host** | Gateway + served `dist` | Follow **Playbook** (tunnel + `webhook:deploy` + `setup-and-serve.cmd` + **both** GitHub secrets). Push `main` → CI → webhook → updated `dist/` |

---

## App version (header + gateway)

The UI shows **`package.json` version + SemVer build metadata**, e.g. `0.1.0+12`. The part after **`+`** is a refresh counter:

- **Local `npm run dev` / `npm run build`:** increments a gitignored file **`.openclaw-build-rev`** on each build and on debounced saves under **`src/`** (and **`index.html`**). The header uses a **custom Vite HMR event** so the new `+<rev>` shows immediately without a full reload.
- **GitHub Actions** (this repo’s workflow): sets **`VITE_BUILD_REV`** to the workflow **`run_number`**, so production builds use that instead of the local file.

Bump **`MAJOR.MINOR.PATCH`** only by editing **`package.json`** / **`npm version`** when you want a new release line.

---

## Windows script reference

| Item | Detail |
|------|--------|
| **`scripts\setup-and-serve.cmd`** | `npm install`, `npm run build`, then **`serve`** in foreground (Ctrl+C stops). Optional `GIT_PULL=1`, `PORT`. |
| **`scripts\deploy-local.cmd`** | **`npm run deploy:local`** — `git fetch`, **`reset --hard origin/main`**, **`npm ci`**, **`npm run build`**. |
| **`npm run webhook:deploy`** | HTTP listener: **GET `/health`**, **POST `/deploy`** (Bearer secret). Bind `127.0.0.1:8788` by default. |
| **Default UI HTTP port** | `4173` (via `setup-and-serve.cmd` `PORT`) |
| **Default webhook port** | `8788` (`WEBHOOK_LISTEN_PORT`) |

**Requires:** Node.js (`npm`, `npx`); `git` for deploy and optional `GIT_PULL`.

---

## Architecture & documentation

See the [docs folder](docs/) for stack choices, component patterns, and design notes.

**Chain of thought:** Reasoning and tools open in a **dismissible dialog** (not a side drawer) as a scrollable column of small gray bubbles. In the main thread, use the small **View Thought Process** control on the **assistant** bubble (same bubble as the answer; it also appears on the in-run slot while the model works). Legacy transcripts may still open plain reasoning from that control when only `Message.reasoning` exists. Details: [docs/chain-of-thought.md](docs/chain-of-thought.md).

**Assistant run chrome:** The thin top bar shows version, connection state, status chips, and transcript stats. The shell tracks **`idle` / `running` / `stale`** for input lock and placeholders only. The **last assistant bubble** derives spinner and optional tool-line hints **inside** `AgentChatBubble` from streamed text and `thoughtItems`, not from that shell enum. There are no separate in-thread tool-call bubbles. Details: [docs/assistant-run-chrome.md](docs/assistant-run-chrome.md).

**Conversations:** A **sidebar thread list** maps each row to its own gateway `sessionKey` and history. **New conversation** (speech-bubble-plus icon in the Conversations panel header) adds a thread with a fresh key; you can switch threads without losing the list (stored in `localStorage`). Details: [docs/multiple-chat-threads.md](docs/multiple-chat-threads.md) and [docs/new-chat-session.md](docs/new-chat-session.md).
