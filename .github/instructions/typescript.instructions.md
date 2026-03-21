---
applyTo: "**/*.{ts,tsx,js,jsx}"
---

# TypeScript / JavaScript Coding Style

## Avoid Ternary Branching

Use ternary (`?:`) only when both branches are plain values or single variables. For any logic, side effects, or function calls, use a full `if` statement.

```ts
// ❌ BAD
const label = isActive ? getActiveLabel() : computeFallback(item);

// ✅ GOOD
let label: string;
if (isActive) {
    label = getActiveLabel();
} else {
    label = computeFallback(item);
}
```

## Precompute Complex Conditions

Do not run complex expressions directly inside an `if` condition. Precompute them as named constants first.

```ts
// ❌ BAD
if (user.role === 'admin' && permissions.includes('write') && !session.isExpired()) { ... }

// ✅ GOOD
const isAuthorisedEditor = user.role === 'admin' && permissions.includes('write') && !session.isExpired();
if (isAuthorisedEditor) { ... }
```

## Branch Comments Go Inside the Branch

Place comments that explain a branch at the **start of that branch**, not before the `if` statement.

## React UI (this repo)

Use React function components and hooks. Prefer **MUI** components and the **MUI theme** (`sx`, `useTheme`, breakpoints). Use direct DOM APIs only when necessary.

Colocate styles: MUI `sx`/`styled` on the component file, or colocated CSS where the project already uses it.

**State:** `useState` / `useReducer` for UI state; gateway/session patterns live under `src/api/`.

---

# UI and Styling

## Use MUI Theme and Tokens

Use palette, spacing, typography, and breakpoints from the theme — avoid hardcoded hex and magic pixels.

```tsx
// ❌ BAD
<Box sx={{ color: '#3a86ff', p: '13px' }} />

// ✅ GOOD
<Box sx={{ color: 'primary.main', p: 2 }} />
```

## Prefer `sx` and MUI Primitives

Use MUI layout primitives and **`sx`**; use **`styled`** when a pattern repeats.

## No Raw Inline Styles Except Dynamic Values

Avoid `style={{}}` except for truly runtime-only values.

## Do Not Add Another CSS Framework

MUI + Emotion only unless the project explicitly migrates.

## Markdown and User Content

Preserve sanitization (`rehype-sanitize`) when changing rich message rendering.
