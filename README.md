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
  **Important:** Do this **now**, not “later after Actions.” If this secret is missing, pushes to `main` will **never** call the host even when CI passes.

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
- **Ask the human to:** In **GitHub → Settings → Secrets and variables → Actions**, add **`DEPLOY_WEBHOOK_URL`** = **`https://<their-hostname>/deploy`** (must include the **`/deploy`** path; GitHub Actions POSTs here).  
  **Both** **`DEPLOY_WEBHOOK_SECRET`** and **`DEPLOY_WEBHOOK_URL`** must exist or the notify job is **skipped** while CI still looks green.

**6 — Optional: smoke-test POST**

- **OpenClaw:**  
  `curl -i -X POST "https://<their-hostname>/deploy" -H "Authorization: Bearer <same-secret-as-env>"`  
  Expect **200** and JSON with **`deploy_complete`** after `npm run deploy:local` finishes (may take minutes the first time).

**7 — Serve the UI (separate from the tunnel)**

- **OpenClaw / human:** From repo root run **`scripts\setup-and-serve.cmd`** (Windows) or equivalent; keep it **running**. This is **port 4173** (`0.0.0.0`). After webhook deploys, **`dist/`** updates; **`serve`** usually does **not** need a restart.

**8 — Remind the developer**

- **Ask the human to:** On the dev machine, copy [`.env.example`](.env.example) → **`.env.local`** with `VITE_OPENCLAW_GATEWAY_URL=ws://<gateway-LAN-IP>:18789` and run **`npm run dev`**.

---

### After setup: each push to `main`

1. [`.github/workflows/deploy-host.yml`](.github/workflows/deploy-host.yml) runs **`npm ci`** + **`npm run build`** on GitHub. If it **fails**, fix the build first—the host is not notified.  
2. If **both** Action secrets are set, GitHub **POSTs** **`DEPLOY_WEBHOOK_URL`** with **`Authorization: Bearer`** `DEPLOY_WEBHOOK_SECRET`.  
3. On the host, **tunnel**, **`npm run webhook:deploy`**, and **`serve`** (4173) should still be running. The listener runs **`npm run deploy:local`** (`git reset --hard origin/main`, etc.).  
4. Stale PWA: suggest hard refresh.

---

### Manual deploy (no GitHub)

On the host: **`scripts\deploy-local.cmd`** or **`npm run deploy:local`** (discards uncommitted changes on that clone).

---

### If something fails

| Symptom | Check |
|--------|--------|
| **`Cannot unmarshal !!str 'http…'`** in cloudflared | `ingress` rules each start with **`-`**; **`credentials-file`** uses **`/`** not `\`; catch‑all **`http_status:404`** present. |
| CI green but host never updates | **`DEPLOY_WEBHOOK_URL`** *and* **`DEPLOY_WEBHOOK_SECRET`** in GitHub; **`/health`** works over **HTTPS**; webhook process + tunnel running. |
| **401** on POST | Bearer secret ≠ **`.env.webhook`**. |
| UI won’t connect to agent | Gateway up; dev **`.env.local`**; firewall / bind **18789** on LAN. |
| UI stale on host | **`serve`** serving **this** repo’s **`dist/`**; run **`deploy-local`**; PWA cache. |

---

## Human quick start (local development)

1. Install dependencies: `npm install`
2. Run the dev server: `npm run dev`
3. Open the URL shown (usually `http://localhost:5173`).

If the gateway runs on **another machine**, copy `.env.example` to `.env.local` and set `VITE_OPENCLAW_GATEWAY_URL` to that machine’s WebSocket URL (see **If you are OpenClaw** above). Leave `.env.local` **off** the gateway PC so production builds use the page hostname.

---

## Two-machine summary

| Machine | Role | Typical steps |
|--------|------|----------------|
| **Dev laptop** | Edit UI, hot reload | `.env.local` with `VITE_OPENCLAW_GATEWAY_URL=ws://…:18789`, then `npm run dev` |
| **OpenClaw host** | Gateway + served `dist` | Follow **Playbook** (tunnel + `webhook:deploy` + `setup-and-serve.cmd` + **both** GitHub secrets). Push `main` → CI → webhook → updated `dist/` |

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
