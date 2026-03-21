# openclaw-ui

A dedicated PWA web interface for OpenClaw.

---

## If you are OpenClaw

**Your job is to** keep this UI buildable and served beside the gateway, and to make sure the browser can reach both the static UI and the gateway WebSocket. When the user asks you to “run the UI,” “update the UI,” or “fix the connection,” use this checklist.

1. **Know the layout**
   - The **OpenClaw / gateway machine** (often Windows) should host the **built** static files (`dist/`) and run the **gateway** (default WebSocket port **18789**).
   - The **developer machine** may run `npm run dev` elsewhere; that machine needs `VITE_OPENCLAW_GATEWAY_URL` in `.env.local` pointing at *this* gateway (see below).

2. **On the gateway host (production-style UI)**
   - Ensure [Node.js LTS](https://nodejs.org/) and `git` are installed if you use the script or `GIT_PULL`.
   - **Do not** set `VITE_OPENCLAW_GATEWAY_URL` when building here. The app then uses the **same host as the page** for `ws:` / `wss:` (e.g. `http://192.168.1.10:4173` → `ws://192.168.1.10:18789`).
   - **Preferred on Windows:** from the repo root run `scripts\setup-and-serve.cmd`. It runs `npm install`, `npm run build`, then serves `dist` on **all interfaces** at port **4173** (`0.0.0.0`).
   - To **pull then rebuild** in one go: `set GIT_PULL=1` then run `scripts\setup-and-serve.cmd`.
   - To change the HTTP port: `set PORT=8080` then run the script (default **4173**).
   - **Manual equivalent (any OS):** `git pull` → `npm ci` or `npm install` → `npm run build` → `npx --yes serve dist -s -l tcp://0.0.0.0:4173` (adjust host/port as needed).

3. **Gateway and network**
   - If the user opens the UI from **another device** on the LAN, the gateway must listen beyond `127.0.0.1` (e.g. `0.0.0.0` or the machine’s LAN IP) and the OS **firewall must allow** the gateway port (commonly **18789**).
   - If only a browser **on the same PC** uses `http://localhost:4173`, localhost WebSocket to the gateway is enough.

4. **When the user develops on another computer**
   - They should copy `.env.example` to **`.env.local`** (gitignored) and set:
     - `VITE_OPENCLAW_GATEWAY_URL=ws://<gateway-pc-lan-ip>:18789`
   - They run `npm run dev` locally; the UI loads from Vite but talks to **your** WebSocket.

5. **If something fails**
   - **UI loads but never connects:** check gateway is up, URL/port in `.env.local` on the dev machine, and LAN/firewall/binding on the gateway host.
   - **Blank or old UI on the gateway PC:** run a fresh `git pull`, rebuild (`npm run build` or `setup-and-serve.cmd`), and confirm no stale `dist` is being served from another folder.

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
| **OpenClaw host** | Gateway + served `dist` | `git pull` → build → serve `dist` (e.g. `scripts\setup-and-serve.cmd` on Windows) |

---

## Windows script reference

| Item | Detail |
|------|--------|
| **Script** | `scripts\setup-and-serve.cmd` |
| **Default HTTP port** | `4173` |
| **Custom port** | `set PORT=8080` then run the script |
| **Pull before build** | `set GIT_PULL=1` then run the script |
| **Requires** | Node.js (`npm`, `npx`); `git` only if using `GIT_PULL=1` |

You can point automation (Task Scheduler, hooks, etc.) at this `.cmd`, or run it manually.

---

## Architecture & documentation

See the [docs folder](docs/) for stack choices, component patterns, and design notes.
