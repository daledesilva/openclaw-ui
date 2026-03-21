# openclaw-ui

A dedicated PWA web interface for OpenClaw.

---

## If you are OpenClaw

**Your job is to** (1) get **openclaw-ui** running on the **gateway host** so the built UI is served next to OpenClaw, (2) wire **auto-deploy** so pushes to **`main`** refresh that host without manual pulls, and (3) help debug **WebSocket** issues between the browser and the gateway (default port **18789**). Follow **Phase 1** for first-time setup; use **Phase 2** when the user cares about deploys after `main` changes; use **If something fails** when they report stale UI, broken webhook, or connection errors.

### Layout (keep this in mind)

- **Gateway host:** runs the OpenClaw gateway **and** serves **`dist/`** from this repo (often Windows). **Do not** set `VITE_OPENCLAW_GATEWAY_URL` when building here — the UI uses the **same hostname as the page** for `ws:` / `wss:` (e.g. page at `http://192.168.1.10:4173` → socket to that host on **18789**).
- **Dev machine:** may run `npm run dev`; it needs **`.env.local`** with `VITE_OPENCLAW_GATEWAY_URL=ws://<gateway-lan-ip>:18789` (see **Human quick start**).
- **LAN / firewall:** If the UI is opened from another device, the gateway must be reachable on the LAN (not only `127.0.0.1`) and the firewall must allow **18789**.

---

### Phase 1 — First-time setup (gateway host)

Run through this list **once** (or when the user says the machine has never been set up for this UI):

| Step | What to do |
|------|------------|
| 1 | Install **[Node.js LTS](https://nodejs.org/)** and **`git`**. Confirm `npm` works in the shell you use. |
| 2 | **Clone** this repo to a **dedicated directory** (recommended: production UI only). `cd` into it; use branch **`main`**. |
| 3 | On this machine, **do not** use `.env.local` with `VITE_OPENCLAW_GATEWAY_URL` for production builds (omit it or leave that unset). |
| 4 | **Process A — serve the UI:** From the repo root run **`scripts\setup-and-serve.cmd`** (install, build, then **`serve`** on **`0.0.0.0:4173`**). Keep it **running** (own window, Task Scheduler, or process manager). Optional: `set PORT=...` or `set GIT_PULL=1` before running. |
| 5 | **Process B — webhook (for auto-deploy):** Generate a long random **`DEPLOY_WEBHOOK_SECRET`**. Put it in **`.env.webhook`** in the **repo root** as `DEPLOY_WEBHOOK_SECRET=...` ([`.env.example`](.env.example) shows optional vars). **Never commit** `.env.webhook`. |
| 6 | Start a **tunnel** (Cloudflare Tunnel, ngrok, etc.) so a **public HTTPS** URL reaches **`http://127.0.0.1:8788`** (or **`WEBHOOK_LISTEN_PORT`**). Configure path routing so GitHub’s **`POST`** hits the listener’s **`/deploy`** route (often the public URL ends with **`/deploy`** — **`DEPLOY_WEBHOOK_URL`** in GitHub must be that **full** URL). **`GET /health`** should map to **`/health`** if you test the tunnel. |
| 7 | In **GitHub → Settings → Secrets and variables → Actions**, set **`DEPLOY_WEBHOOK_URL`** (public URL from step 6) and **`DEPLOY_WEBHOOK_SECRET`** (same string as in `.env.webhook`). |
| 8 | From the repo root, start **`npm run webhook:deploy`** and keep it **running** (separate session from process A; use Task Scheduler / NSSM for boot persistence if needed). |

**After Phase 1 you should have two long-running processes:** **A** = static UI; **B** = webhook listener. When **B** runs **`deploy:local`**, it refreshes **`dist/`**; **A** usually keeps serving new files **without** restart.

**Remind the developer:** On their laptop, **`.env.local`** + **`npm run dev`** with `VITE_OPENCLAW_GATEWAY_URL` pointing at this gateway.

---

### Phase 2 — Ongoing: auto-deploy (every push to `main`)

| Step | What happens |
|------|----------------|
| 1 | Someone pushes (or merges) to **`main`**. |
| 2 | [`.github/workflows/deploy-host.yml`](.github/workflows/deploy-host.yml) runs **`npm ci`** and **`npm run build`** on GitHub. If this **fails**, **stop** — fix the build; the host is not notified. |
| 3 | If **`DEPLOY_WEBHOOK_URL`** and **`DEPLOY_WEBHOOK_SECRET`** are both set, Actions **POSTs** to that URL with **`Authorization: Bearer <secret>`**. If either secret is missing, the notify step is **skipped** (CI can still be green). |
| 4 | On the host, **process B** must be up; the **tunnel** must still forward to **`127.0.0.1:<port>`**. The listener runs **`npm run deploy:local`** (same as **`scripts\deploy-local.cmd`**: fetch, **`git reset --hard origin/main`**, **`npm ci`**, **`npm run build`**). |
| 5 | **Process A** should still be serving **this repo’s `dist/`**. If the user sees an old UI, suggest a hard refresh or PWA cache clear. |

---

### Manual deploy (no GitHub notify)

On the host: **`scripts\deploy-local.cmd`** or **`npm run deploy:local`**. Same as webhook path; **discards** uncommitted changes on that clone (`reset --hard`).

---

### If something fails

| Symptom | Check |
|--------|--------|
| UI loads but **does not connect** to the agent | Gateway running; dev **`.env.local`**; LAN bind + firewall **18789**. |
| UI **stale or blank** on host | **Process A** still running and pointing at **this** repo’s **`dist/`**; last Actions run succeeded; webhook returned **200**; run **`deploy-local`** manually; PWA cache. |
| **Auto-deploy never fires** | Both GitHub secrets set; **process B** running; tunnel → **`127.0.0.1:8788`** (or your port); **`DEPLOY_WEBHOOK_URL`** is a **public** URL (not LAN-only); Bearer secret matches **`.env.webhook`**. |
| **Deploy / git errors** | `origin` auth and network; disk space; dedicated clone (avoid editing files on host that you need to keep). |

---

## Deploy webhook (reference)

**Flow:** Push to **`main`** → workflow **verify** → optional **`curl` POST** with **Bearer** `DEPLOY_WEBHOOK_SECRET`.

| GitHub secret | Purpose |
|---------------|---------|
| `DEPLOY_WEBHOOK_URL` | Full public HTTPS URL (include **`/deploy`** path if your tunnel is set up that way). |
| `DEPLOY_WEBHOOK_SECRET` | Same value as **`DEPLOY_WEBHOOK_SECRET`** in **`.env.webhook`**. |

**Listener:** **`npm run webhook:deploy`** — **GET `/health`**, **POST `/deploy`**. Defaults: **`127.0.0.1:8788`**.

**Security:** Rotate secret if leaked. **`deploy:local`** uses **`git reset --hard origin/main`** — use a **dedicated** production clone.

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
| **OpenClaw host** | Gateway + served `dist` | **Phase 1:** processes **A** (`setup-and-serve.cmd`) + **B** (`webhook:deploy`) + tunnel + GitHub secrets. **Phase 2:** push `main` → CI → webhook → updated `dist/` |

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
