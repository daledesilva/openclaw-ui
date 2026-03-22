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

## JSX optional branches (`*.tsx` / `*.jsx`)

When the **false** branch renders **nothing** (`null` only), use **`{condition && (…)}`** instead of **`{condition ? (…) : null}`**. Precompute a boolean for long conditions. See **`.cursor/rules/jsx-conditional-render-and.mdc`**.

## Imports section divider (`*.ts` / `*.tsx`)

When the file contains any **`import`** or **`import type`** statements:

1. Group **all** import lines at the **top** (after an optional shebang, **`/// <reference … />`**, or other required first-line tooling headers).
2. Immediately after the last import, add **two identical** full lines of **`/`** characters (same pattern as elsewhere in the repo, e.g. **`///////////////////////////`**), **then exactly one blank line**, then everything else (types, exports, implementation).

**Omit** this divider if the file has **no** `import` statements.

The **Supporting functions** banner stays **below** the main implementation as in **Function declarations and file layout** — it does not replace this divider.

See **`.cursor/rules/typescript-imports-section-divider.mdc`**.

## Branch Comments Go Inside the Branch

Place comments that explain a branch at the **start of that branch**, not before the `if` statement.

## React UI (this repo)

Use React function components and hooks. Prefer **MUI** components and the **MUI theme** (`sx`, `useTheme`, breakpoints). Use direct DOM APIs only when necessary.

Colocate styles: MUI `sx`/`styled` on the component file, or colocated CSS where the project already uses it.

**State:** `useState` / `useReducer` for UI state; gateway/session patterns live under `src/api/`.

## Single `props` parameter (no destructuring)

When a function’s inputs are a **single object** (React function components, render props, and similar), define it with **exactly one parameter** named **`props`**, typed as that object.

- **Do not** destructure in the parameter list (e.g. `({ title, onClose }) =>`).
- **Do not** unpack `props` in the body (e.g. `const { title, onClose } = props`) only to use those fields.
- **Always** read fields as **`props.fieldName`** so anything coming from the caller is visibly prefixed with `props.`.

```tsx
// ❌ BAD
export const Example: React.FC<ExampleProps> = ({ title, onClose }) => (
  <Box onClick={onClose}>{title}</Box>
);

// ❌ BAD
export const Example: React.FC<ExampleProps> = (props) => {
  const { title, onClose } = props;
  return <Box onClick={onClose}>{title}</Box>;
};

// ✅ GOOD
export const Example: React.FC<ExampleProps> = (props) => (
  <Box onClick={props.onClose}>{props.title}</Box>
);
```

**Out of scope:** zero-argument functions, multiple **positional** parameters, or a single **non-object** parameter (e.g. `id: string`) — use normal signatures there.

## Props `interface` immediately before the function

When a function takes a single **`props`** object, declare its shape as a **named `export interface`** placed **immediately above** that function (nothing else between the interface and the function).

- Name the interface **`{ComponentOrFunctionName}Props`** (e.g. `AgentChatBubbleProps` before `AgentChatBubble`).
- Prefer **`interface`** for that object; do not replace it with only an inline anonymous type on the parameter when this component or function owns the shape.
- If the **same** props shape is shared across modules, use a **named** shared props interface (define or import it); avoid an unnamed object type on `props`.

```tsx
export interface AgentChatBubbleProps {
  messageText: string;
  thoughtItems: ThoughtItem[];
  openChainOfThoughtModal?: (content: ChainOfThoughtModalContent) => void;
}

/** Renders the agent message bubble and chain-of-thought entry. */
export function AgentChatBubble(props: AgentChatBubbleProps): React.ReactNode {
  // use props.messageText, props.thoughtItems, etc.
}
```

## Function declarations and file layout

Prefer **`function` declarations** (`function name() {}` / `export function name() {}`) for named file-level (or nested named) functions. Use **arrow functions only when necessary** (array callbacks, `styled`/`sx` API shapes, short inline JSX handlers, type predicates in `.filter`).

Put the file’s **primary export** near the top: after **imports**, then **types/constants** this file owns for its API, then the **main `export function`** (or primary hook/component). Place **supporting helpers below** a large divider comment:

```ts
// =============================================================================
// Supporting functions
// =============================================================================
```

Then **non-trivial MUI `sx`** in a **`// Styles`** block at the **file bottom** (see **MUI `sx` — Styles section at file bottom** below).

Helpers below the divider should also use **`function`** syntax, not `const fn = () => {}`, when both work. **`const` from `styled()`**, **`React.memo`**, and **`useCallback`** stay as expressions where the API requires it.

## Minimal TSDoc on every named function

Every **named** function (`function foo`, exported or file-local) and every **`const` binding** whose value is a function or React component must have a **TSDoc** block **`/** … */`** **directly above** that declaration.

- Keep it **minimal**: usually **one short sentence** (what it does or what the component shows). Add `@param` / `@returns` only when a single sentence is not enough.
- **Omit** TSDoc for **inline** function expressions passed as arguments (e.g. `.map((id) => id)`, short `onClick` lambdas) when a comment would only repeat the code.

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

## MUI `sx` — Styles section at file bottom

For **non-trivial** `sx` (multi-property, theme callbacks, or repeated in the file), define **`const`** values typed as **`SxProps<Theme>`** at the **bottom** of the file after a banner:

```tsx
// =============================================================================
// Styles
// =============================================================================
```

Import **`SxProps`** and **`Theme`** from **`@mui/material/styles`**. **`export`ed** `sx` constants: **file-scoped prefix**. **Private** `sx` in a single-primary-component file: **role** names (`outerSx`), no redundant component/filename unless disambiguating. See **`.cursor/rules/mui-sx-styles-section.mdc`** and **`.cursor/rules/naming-conventions.mdc`**.

## No Raw Inline Styles Except Dynamic Values

Avoid `style={{}}` except for truly runtime-only values.

## Do Not Add Another CSS Framework

MUI + Emotion only unless the project explicitly migrates.

## Markdown and User Content

Preserve sanitization (`rehype-sanitize`) when changing rich message rendering.
