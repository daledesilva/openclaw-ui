# Copilot Instructions

These instructions apply to all files in this repository.

---

## Project Overview

**openclaw-ui** is a PWA web UI for OpenClaw: chat with the gateway over WebSockets, built with Vite and served as static **`dist/`** beside the gateway or via preview/static hosting.

**Folder structure:**

| Folder | Purpose |
|---|---|
| `src/` | React + TypeScript UI |
| `src/api/` | Gateway WebSocket client and types |
| `src/components/` | Feature UI |
| `scripts/` | Deploy webhook and host helpers |
| `public/` | Static assets |
| `docs/` | Optional deeper documentation (README is the deploy playbook) |

**Architecture:** SPA connects to the OpenClaw gateway via **`VITE_OPENCLAW_GATEWAY_URL`**. Production builds often omit that var so the WS URL follows the page origin. GitHub Actions can trigger **`deploy:local`** on a host via **`webhook:deploy`** (see README).

**Key constraints:** Do not set `VITE_OPENCLAW_GATEWAY_URL` on gateway production builds unless intentional. `VITE_*` vars are public in the bundle. Dev from another origin may require gateway **`allowedOrigins`** updates.

---

## Tech Stack

Update this section as the **final step** of any plan that changes dependencies or tools.

- **Frontend:** React 18, TypeScript, Vite 5
- **UI:** MUI v5, Emotion
- **Content:** react-markdown, remark-gfm, rehype-sanitize
- **Realtime:** WebSocket to gateway (`src/api/gateway.ts`)
- **PWA:** vite-plugin-pwa
- **Testing:** Vitest — `npm run test`; also `npm run build` for `tsc` + Vite
- **CI / deploy:** GitHub Actions, `npm run deploy:local`, `npm run webhook:deploy`

---

## AI Instruction Consistency

When adding or updating any convention or coding standard, always update **both** locations so they never diverge:

| Rule type | Cursor file | Copilot file |
|---|---|---|
| Repo-wide / always-apply | `.cursor/rules/*.mdc` | `.github/copilot-instructions.md` |
| File-scoped | `.cursor/rules/*.mdc` (with `globs:`) | `.github/instructions/*.instructions.md` (with `applyTo:`) |

---

## Documentation Standards

Store optional deep docs in `docs/`. The **README** remains the operator source for deploy, webhooks, and gateway setup.

Each `docs/` page: why it exists → conceptual model → flows → technical details → technical gotchas. Use Mermaid for diagrams.

---

## Editing Guidelines

**Respect existing patterns.** **Verify every fix** (e.g. `npm run build`). **Keep console logs until the fix is confirmed.** **Update `docs/`** when it exists and behavior changes.

---

## Environment File Conventions

Single-package repo at root: **`.env.local`** (gitignored dev), **`.env.example`** (documented `VITE_*` template), **`.env.webhook`** (host-only deploy secret; gitignored). Update `.env.example` whenever you add or change `VITE_*` variables.

---

## Git Workflow

Branch format: `<prefix>/<short-description>` in kebab-case (`feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `experiment/`). Delete branches after merge to `main`.

---

## Naming Conventions

Self-explanatory names; full words over abbreviations; avoid `data`, `info`, `result`; booleans like `isLoading`, `hasError`; include owning entity when it clarifies meaning.

---

## Planning Workflow

Plans end with documentation updates. Use Mermaid for diagrams.

---

## Testing Practices

Run **`npm run test`** (Vitest) for unit tests and **`npm run build`** for typecheck and production bundle. Do not start dev/preview/webhook/gateway unless the user asks. Add or update tests for meaningful parsing or logic changes.

---

## Vite / React / PWA

Use **`npm run build`** for production verification; output is **`dist/`**. Do not run **`npm run dev`**, **`preview`**, or **`webhook:deploy`** unless the user requests. See README for deploy and tunnel setup.

**Kotlin / Android rules** in `.cursor/rules/` apply only if Kotlin or Android XML is added; this repo is web-only by default.
