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
| `src/components/atoms/` | Shared styled primitives (e.g. chat bubble shell) |
| `scripts/` | Deploy webhook and host helpers |
| `public/` | Static assets |
| `docs/` | Optional deeper documentation (README is the deploy playbook) |

**Architecture:** SPA connects to the OpenClaw gateway via **`VITE_OPENCLAW_GATEWAY_URL`**. Production builds often omit that var so the WS URL follows the page origin. Chat UI folds gateway streams through a **`recentThoughts`** buffer and **`applyAssistantFinalWithThoughtBuffer`** (`src/utils/recentThoughtsReducer.ts`); tools and tool results are not separate chat bubbles—they appear in the chain-of-thought modal; persisted trace data uses a **`reasoningTrace`** message merged into the assistant **`AgentChatBubble`** in the UI. Per-thread token totals use WebSocket **`sessions.list`** (`fetchGatewaySessionsList`, `src/api/gatewaySessionsList.ts`); canonical `agent:<id>:…` keys are aliased to short UI `sessionKey` values. **`usage.cost`** (`fetchGatewayUsageCost`, `src/api/gatewayUsageCost.ts`) can supply per-session USD on conversation rows when parseable; the top bar shows a **client-side Gemini session total** (~$X.XX, two decimals) for the active chat (not gateway rollups). See **`docs/gemini-pricing-estimates.md`**. See **`docs/chain-of-thought.md`**, **`docs/assistant-run-chrome.md`**, and **`docs/multiple-chat-threads.md`**. Shell state is **`idle` / `running` / `stale`** (`src/utils/assistantRunChrome.ts`); assistant bubble chrome comes from **`AgentChatBubble`** props and reducers, not stream “phase” hints. No link-preview carousel or inline chat images. GitHub Actions can trigger **`deploy:local`** on a host via **`webhook:deploy`** (see README).

**Key constraints:** Do not set `VITE_OPENCLAW_GATEWAY_URL` on gateway production builds unless intentional. `VITE_*` vars are public in the bundle. Dev from another origin may require gateway **`allowedOrigins`** updates. Optional dev logging: **`VITE_OPENCLAW_DEBUG`** and **`VITE_OPENCLAW_SESSIONS_DEBUG`** (see README / `.env.example`).

---

## Tech Stack

Update this section as the **final step** of any plan that changes dependencies or tools.

- **Frontend:** React 18, TypeScript, Vite 5
- **UI:** MUI v5, Emotion
- **Content:** react-markdown, remark-gfm, rehype-sanitize
- **Realtime:** WebSocket to gateway (`src/api/gateway.ts`); run chrome (`idle`/`running`/`stale`), terminal payloads, reconnect, per-thread `sessionKey`, multi-thread list (`src/utils/chatThreadsStorage.ts`) — `docs/assistant-run-chrome.md`, `docs/multiple-chat-threads.md`, `docs/new-chat-session.md`
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

## TypeScript: imports section divider

In **`*.ts` / `*.tsx`**, when the file has any **`import`** statements, put **all** imports at the top, then **two identical** full lines of **`/`** (imports-section divider, see rule file for the exact shape), then **one blank line**, then the rest of the file (types, exports, code). Omit the divider when there are **no** imports. See **`.cursor/rules/typescript-imports-section-divider.mdc`** and **`.github/instructions/typescript.instructions.md`** (Imports section divider).

---

## TypeScript: function style and file layout

For **`*.ts` / `*.tsx`**: use **`function` declarations** for named file-level (and nested named) helpers instead of **`const fn = () => {}`** when both work. Use **arrows only when necessary** (callbacks, `styled`/`sx` shapes, tiny inline handlers).

Put the file’s **primary export** first after the imports divider (when present), **file-owned types**, then the main export, then a **banner divider** (`// =============================================================================` / `Supporting functions` / `=============================================================================`), then **supporting functions** below it.

Full detail: **`.cursor/rules/function-declaration-and-file-layout.mdc`** and **`.github/instructions/typescript.instructions.md`** (Function declarations and file layout).

---

## MUI: Styles section for `sx`

In **`*.tsx`**, put **non-trivial** `sx` objects (several properties, `(theme) => …`, or reused) in a **`// Styles`** block at the **bottom** as **`const …Sx: SxProps<Theme>`** — **file-scoped prefix** if **`export`ed**; **role** names without repeating the component name if **private** (single-primary-component files). See **`.cursor/rules/mui-sx-styles-section.mdc`** and **`.github/instructions/typescript.instructions.md`**.

---

## JSX: `&&` instead of `? : null`

When optional JSX has **no else** UI, use **`{flag && (…)}`**, not **`{flag ? (…) : null}`**. See **`.cursor/rules/jsx-conditional-render-and.mdc`**.

---

## Documentation Standards

Store optional deep docs in `docs/`. The **README** remains the operator source for deploy, webhooks, and gateway setup.

Documentation MUST not be used as an authoritative reference for how the project currently works or how specific code paths behave. For behavior/implementation details, use the codebase and any relevant external/official service documentation instead—unless the task explicitly instructs you to use `docs/`.

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

**Export boundary:** anything **`export`ed** for other files **should** use a **file-scoped prefix**; **not exported** module-private helpers in a single-primary-component **`.tsx`** file should **not** repeat the component/file name — use role names (e.g. `outerSx` not `userBubbleOuterSx`). See **`.cursor/rules/naming-conventions.mdc`**.

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
