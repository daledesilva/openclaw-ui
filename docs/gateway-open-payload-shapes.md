# Gateway open payload shapes (by provider)

## Why this page exists

The [Gateway WebSocket frames](./gateway-websocket-frames.md) page follows OpenClaw **`ProtocolSchemas`**, where many fields are **`unknown`**, **`TAny`**, or **`Record<string, unknown>`**. This page **indexes** those wire contexts and holds **illustrative shapes** (TypeScript-style) you can compare to captures. Canonical **model-provider** detail for chat fields lives in the companion pages below.

**Source convention:** Immediately above every fenced code block, **Source:** links to the OpenClaw gateway/protocol doc, vendor API, or companion schema page that motivates the shape.

## Model-provider companion pages (wire reference)

| Open field in frames doc | Companion |
| ------------------------ | --------- |
| `ChatEvent.message?` | [Gateway schema: chat `message`](./gateway-schema-chat-message.md) |
| `ChatEvent.usage?` | [Gateway schema: chat `usage`](./gateway-schema-chat-usage.md) |
| `AgentEvent.data` | [Gateway schema: agent `data`](./gateway-schema-agent-data.md) |

## Inventory (link targets)

Use these anchors from the frames doc.

| Anchor | Wire context | Protocol note |
| ------ | ------------ | ------------- |
| [Request `params`](#request-params) | `req.params?` | Optional; method-specific. |
| [`chat.send` `attachments`](#chat-send-attachments) | `chat.send` | Array elements are **`unknown`** in schema. |
| [RPC payloads & `usage.cost`](#rpc-payloads-and-usage-cost) | Various `res.payload` | Methods not in **`ProtocolSchemas`** export. |
| [Response `payload`](#response-payload) | `res.payload?` when `ok` | Per-method result type. |
| [Response `error.details`](#response-error-details) | `res.error.details?` | Structured codes / hints. |
| [`hello-ok` `snapshot.health`](#snapshot-health) | Connect snapshot | TypeBox **`TAny`**. |
| [Event `payload`](#event-payload) | `event.payload?` | Per `event` name. |
| [`chat` `message`](#chat-message) | `ChatEvent.message?` | **`TAny`** — see [chat `message` companion](./gateway-schema-chat-message.md). |
| [`chat` `usage`](#chat-usage) | `ChatEvent.usage?` | Token / billing blob — see [chat `usage` companion](./gateway-schema-chat-usage.md). |
| [`agent` `data`](#agent-data) | `AgentEvent.data` | **`Record<string, unknown>`** — see [agent `data` companion](./gateway-schema-agent-data.md). |
| [`presence` / `health` / `heartbeat` events](#presence-health-heartbeat-events) | Push payloads | Not separate named schema types in plugin SDK export. |
| [`chat.history` result](#chat-history-payload) | `res` body for `chat.history` | Not a single exported row in plugin SDK typings. |
| [`exec.approval.requested`](#exec-approval-requested-payload) | Event payload | No **`ProtocolSchemas.*Event`** in verified npm build. |
| [OpenClaw provider index](#openclaw-provider-index) | Documentation | **`docs.openclaw.ai/providers/`** checklist. |

<a id="request-params"></a>

### Request `params`

**Illustrative shapes** (method-dependent; everything optional in practice):

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (RPC **`params`** are method-specific; see **`ProtocolSchemas`** / npm `openclaw`).

```typescript
// Generic envelope
type GatewayRequestParams = Record<string, unknown>;

// Example: chat-oriented RPC might carry session routing
type ChatMethodParamsExample = {
  sessionKey?: string;
  threadId?: string;
  model?: string;
  metadata?: Record<string, unknown>;
};

// Example: device / pairing style hints (names vary by gateway build)
type DeviceParamsExample = {
  deviceId?: string;
  clientName?: string;
  capabilities?: string[];
};
```

<a id="chat-send-attachments"></a>

### `chat.send` `attachments`

Elements are **`unknown`** in schema. Typical **multimodal** patterns mirror OpenAI **content parts** or raw bytes metadata:

**Source:** [OpenAI API — Vision / image inputs (message content)](https://platform.openai.com/docs/guides/vision), [Gemini API — `Part` (REST)](https://ai.google.dev/api/rest/v1beta/Part).

```typescript
type ChatSendAttachmentOpenAIStyle = {
  type?: 'image_url' | 'file' | 'input_audio';
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
  file?: { filename?: string; file_data?: string; mime_type?: string };
  input_audio?: { data: string; format: string };
};

type ChatSendAttachmentGeminiStyle = {
  inlineData?: { mimeType?: string; data?: string };
  fileData?: { mimeType?: string; fileUri?: string };
};

type ChatSendAttachmentPassthrough = Record<string, unknown>;
```

<a id="rpc-payloads-and-usage-cost"></a>

### RPC payloads and `usage.cost`

**`usage.cost`:** Params and result vary by gateway; not under **`ProtocolSchemas`** for every published build. Treat as **opaque** until you capture your server version.

**Illustrative result shape** (invented field names — align with live gateway docs):

**Source:** [OpenClaw — API usage and costs](https://docs.openclaw.ai/reference/api-usage-costs) and [Token use](https://docs.openclaw.ai/reference/token-use) (exact RPC schema is gateway-version-specific).

```typescript
type UsageCostRpcResultExample = {
  currency?: string;
  totalUsd?: number;
  lineItems?: Array<{
    model?: string;
    provider?: string;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  }>;
  raw?: Record<string, unknown>;
};
```

<a id="response-payload"></a>

### Response `payload`

**Per-method** `ok` payloads differ. Illustrative patterns:

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`res.payload` per advertised `features.methods`; match your `openclaw` build).

```typescript
type GatewayOkPayload =
  | { method: 'chat.history'; messages: unknown[]; sessionKey?: string }
  | { method: 'sessions.list'; sessions: Array<Record<string, unknown>> }
  | { method: 'usage.cost'; breakdown: UsageCostRpcResultExample }
  | Record<string, unknown>;
```

<a id="response-error-details"></a>

### Response `error.details`

Structured hints vary by auth mode and gateway version:

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (error model and device auth flows).

```typescript
type GatewayErrorDetailsExample = {
  code?: string; // e.g. AUTH_TOKEN_MISSING, RATE_LIMIT, INVALID_SESSION
  hint?: string;
  pairingCode?: string;
  deviceCode?: string;
  expiresAt?: string;
  retryAfterMs?: number;
  provider?: string;
  upstreamStatus?: number;
  [k: string]: unknown;
};
```

<a id="snapshot-health"></a>

### `hello-ok` `snapshot.health`

TypeBox **`TAny`** on the wire. Typical **health snapshot** sketch:

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`hello-ok.snapshot.health` is **`TAny`** — no fixed vendor schema).

```typescript
type HelloOkHealthSnapshotExample = {
  status?: 'ok' | 'degraded' | 'error';
  gateway?: { version?: string; uptimeMs?: number };
  providers?: Record<string, { ok?: boolean; latencyMs?: number; message?: string }>;
  disk?: { freeBytes?: number };
  [k: string]: unknown;
};
```

<a id="event-payload"></a>

### Event `payload`

Per **`event`** string from `hello-ok.features.events`. Generic container:

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (push `event` + `payload` envelope).

```typescript
type GatewayPushEventExample = {
  event: string;
  payload?: Record<string, unknown>;
};
```

<a id="chat-message"></a>

### `chat` `message`

**Wire:** **`TAny`**. Provider-native shapes are catalogued per vendor in the companion page.

**Minimal illustrative wire values** (after any gateway wrapping):

**Source:** Vendor APIs in [Gateway schema: chat `message`](./gateway-schema-chat-message.md) (each code block lists a **Source** URL).

```typescript
// String shortcut some gateways use
type ChatMessageWire = string;

// Wrapped text
type ChatMessageWrapped = { text: string } | { content: string };

// Provider-native object (see companion for per-vendor unions)
type ChatMessageProviderNative = Record<string, unknown>;
```

**Vendor reference:** [Gateway schema: chat `message`](./gateway-schema-chat-message.md) — includes **every OpenClaw `/providers/`** entry with a TypeScript-oriented shape.

<a id="chat-usage"></a>

### `chat` `usage`

**Wire:** token / billing **`unknown`**.

**Source:** [OpenAI Chat completion `usage`](https://platform.openai.com/docs/api-reference/chat/object), [Anthropic Messages `usage`](https://docs.anthropic.com/en/api/messages), [Gemini usage metadata](https://ai.google.dev/gemini-api/docs/tokens).

```typescript
// OpenAI-style (many compatible vendors)
const chatUsageOpenAIExample = {
  prompt_tokens: 42,
  completion_tokens: 18,
  total_tokens: 60,
};

// Anthropic-style
const chatUsageAnthropicExample = {
  input_tokens: 100,
  output_tokens: 40,
};

// Gemini-style (often usageMetadata on HTTP; gateway may flatten)
const chatUsageGeminiExample = {
  promptTokenCount: 100,
  candidatesTokenCount: 50,
  totalTokenCount: 150,
};
```

**Vendor reference:** [Gateway schema: chat `usage`](./gateway-schema-chat-usage.md).

<a id="agent-data"></a>

### `agent` `data`

**Wire:** **`Record<string, unknown>`** plus sibling **`stream`** on the event.

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`AgentEvent`); upstream chunk shapes in [Gateway schema: agent `data`](./gateway-schema-agent-data.md) (each block has a **Source** URL).

```typescript
type AgentDataWireExample = {
  // gateway-defined substream label
  stream?: string;
  // parsed upstream chunk (OpenAI delta, Anthropic SSE JSON, Gemini chunk, …)
  delta?: Record<string, unknown>;
  raw?: string;
  index?: number;
  [k: string]: unknown;
};
```

**Vendor reference:** [Gateway schema: agent `data`](./gateway-schema-agent-data.md).

<a id="presence-health-heartbeat-events"></a>

### `presence` / `health` / `heartbeat` (and similar)

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (payloads for these pushes are not fixed in **`ProtocolSchemas`** in all builds — illustrative only).

```typescript
type PresencePayloadExample = {
  clients?: number;
  sessions?: number;
  [k: string]: unknown;
};

type HealthPayloadExample = {
  status?: string;
  checks?: Array<{ name: string; ok: boolean; detail?: string }>;
  [k: string]: unknown;
};

type HeartbeatPayloadExample = {
  ts?: number;
  seq?: number;
  [k: string]: unknown;
};
```

<a id="chat-history-payload"></a>

### `chat.history` result

Transcript rows are **not** one exported TypeScript row in all SDK builds. Illustrative:

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`chat.history` result; verify against your gateway version).

```typescript
type ChatHistoryResultExample = {
  sessionKey?: string;
  messages: Array<{
    role?: string;
    content?: unknown;
    id?: string;
    ts?: string;
    metadata?: Record<string, unknown>;
  }>;
  hasMore?: boolean;
  cursor?: string;
};
```

<a id="exec-approval-requested-payload"></a>

### `exec.approval.requested`

Align with your gateway’s exec approval RPC; illustrative:

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`exec.approval.*` / `ExecApprovalRequestParams` in **`ProtocolSchemas`**).

```typescript
type ExecApprovalRequestedExample = {
  requestId: string;
  command?: string[];
  cwd?: string;
  risk?: 'low' | 'medium' | 'high';
  summary?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};
```

---

<a id="openclaw-provider-index"></a>

## OpenClaw provider index

OpenClaw documents **model providers** (LLM inference). Use this checklist with [llms.txt](https://docs.openclaw.ai/llms.txt) when pages move.

### Hub pages

| Resource | URL |
| -------- | --- |
| Provider directory | [https://docs.openclaw.ai/providers/index](https://docs.openclaw.ai/providers/index) |
| Model providers (concept) | [https://docs.openclaw.ai/concepts/model-providers](https://docs.openclaw.ai/concepts/model-providers) |
| Models / CLI (concept) | [https://docs.openclaw.ai/concepts/models](https://docs.openclaw.ai/concepts/models) |
| Provider quickstart | [https://docs.openclaw.ai/providers/models](https://docs.openclaw.ai/providers/models) |
| Messages (concept) | [https://docs.openclaw.ai/concepts/messages](https://docs.openclaw.ai/concepts/messages) |
| Streaming and chunking | [https://docs.openclaw.ai/concepts/streaming](https://docs.openclaw.ai/concepts/streaming) |
| Usage tracking | [https://docs.openclaw.ai/concepts/usage-tracking](https://docs.openclaw.ai/concepts/usage-tracking) |
| Local models | [https://docs.openclaw.ai/gateway/local-models](https://docs.openclaw.ai/gateway/local-models) |
| OpenAI Chat Completions (gateway) | [https://docs.openclaw.ai/gateway/openai-http-api](https://docs.openclaw.ai/gateway/openai-http-api) |
| OpenResponses API (gateway) | [https://docs.openclaw.ai/gateway/openresponses-http-api](https://docs.openclaw.ai/gateway/openresponses-http-api) |
| Token use / costs | [https://docs.openclaw.ai/reference/token-use](https://docs.openclaw.ai/reference/token-use) |
| API usage and costs | [https://docs.openclaw.ai/reference/api-usage-costs](https://docs.openclaw.ai/reference/api-usage-costs) |
| Transcript hygiene | [https://docs.openclaw.ai/reference/transcript-hygiene](https://docs.openclaw.ai/reference/transcript-hygiene) |
| Full doc index (`llms.txt`) | [https://docs.openclaw.ai/llms.txt](https://docs.openclaw.ai/llms.txt) |

### Dedicated provider docs (`/providers/`)

| Topic | OpenClaw doc |
| ----- | ------------- |
| Anthropic | [anthropic](https://docs.openclaw.ai/providers/anthropic) |
| Amazon Bedrock | [bedrock](https://docs.openclaw.ai/providers/bedrock) |
| Claude Max API proxy | [claude-max-api-proxy](https://docs.openclaw.ai/providers/claude-max-api-proxy) |
| Cloudflare AI Gateway | [cloudflare-ai-gateway](https://docs.openclaw.ai/providers/cloudflare-ai-gateway) |
| Deepgram (voice / STT) | [deepgram](https://docs.openclaw.ai/providers/deepgram) |
| GitHub Copilot | [github-copilot](https://docs.openclaw.ai/providers/github-copilot) |
| GLM models | [glm](https://docs.openclaw.ai/providers/glm) |
| Google (Gemini) | [google](https://docs.openclaw.ai/providers/google) |
| Groq | [groq](https://docs.openclaw.ai/providers/groq) |
| Hugging Face Inference | [huggingface](https://docs.openclaw.ai/providers/huggingface) |
| Kilo Gateway | [kilocode](https://docs.openclaw.ai/providers/kilocode) |
| LiteLLM | [litellm](https://docs.openclaw.ai/providers/litellm) |
| MiniMax | [minimax](https://docs.openclaw.ai/providers/minimax) |
| Mistral | [mistral](https://docs.openclaw.ai/providers/mistral) |
| Model Studio | [modelstudio](https://docs.openclaw.ai/providers/modelstudio) |
| Moonshot AI | [moonshot](https://docs.openclaw.ai/providers/moonshot) |
| NVIDIA | [nvidia](https://docs.openclaw.ai/providers/nvidia) |
| Ollama | [ollama](https://docs.openclaw.ai/providers/ollama) |
| OpenAI | [openai](https://docs.openclaw.ai/providers/openai) |
| OpenCode | [opencode](https://docs.openclaw.ai/providers/opencode) |
| OpenCode Go | [opencode-go](https://docs.openclaw.ai/providers/opencode-go) |
| OpenRouter | [openrouter](https://docs.openclaw.ai/providers/openrouter) |
| Perplexity (provider) | [perplexity-provider](https://docs.openclaw.ai/providers/perplexity-provider) |
| Qianfan | [qianfan](https://docs.openclaw.ai/providers/qianfan) |
| Qwen | [qwen](https://docs.openclaw.ai/providers/qwen) |
| SGLang | [sglang](https://docs.openclaw.ai/providers/sglang) |
| Synthetic | [synthetic](https://docs.openclaw.ai/providers/synthetic) |
| Together AI | [together](https://docs.openclaw.ai/providers/together) |
| Venice AI | [venice](https://docs.openclaw.ai/providers/venice) |
| Vercel AI Gateway | [vercel-ai-gateway](https://docs.openclaw.ai/providers/vercel-ai-gateway) |
| vLLM | [vllm](https://docs.openclaw.ai/providers/vllm) |
| Volcengine (Doubao) | [volcengine](https://docs.openclaw.ai/providers/volcengine) |
| xAI | [xai](https://docs.openclaw.ai/providers/xai) |
| Xiaomi MiMo | [xiaomi](https://docs.openclaw.ai/providers/xiaomi) |
| Z.AI | [zai](https://docs.openclaw.ai/providers/zai) |

### Plugin provider id to doc (exceptions)

| Provider id (config) | Typical OpenClaw doc |
| -------------------- | -------------------- |
| `openai-codex` | [OpenAI](https://docs.openclaw.ai/providers/openai) + [model-providers](https://docs.openclaw.ai/concepts/model-providers) |
| `google-vertex`, `google-gemini-cli` | [Google (Gemini)](https://docs.openclaw.ai/providers/google) |
| `qwen-portal` | [Qwen](https://docs.openclaw.ai/providers/qwen) |
| `byteplus`, `byteplus-plan` | [Volcengine](https://docs.openclaw.ai/providers/volcengine) + concept examples |
| `volcengine-plan` | [Volcengine](https://docs.openclaw.ai/providers/volcengine) |
| `kimi-coding` | [Moonshot](https://docs.openclaw.ai/providers/moonshot) + concept |
| `cerebras` | [model-providers](https://docs.openclaw.ai/concepts/model-providers) |

---

## By provider

Canonical **message / usage / stream** TypeScript-oriented shapes for **each** OpenClaw provider page are in:

- [Gateway schema: chat `message`](./gateway-schema-chat-message.md)
- [Gateway schema: chat `usage`](./gateway-schema-chat-usage.md)
- [Gateway schema: agent `data`](./gateway-schema-agent-data.md)

<a id="provider-google-gemini"></a>

### Google / Gemini

Vendor shapes: [chat `message` — Google / Gemini](./gateway-schema-chat-message.md#google-gemini), [chat `usage`](./gateway-schema-chat-usage.md), [agent `data`](./gateway-schema-agent-data.md).

<a id="provider-anthropic"></a>

### Anthropic

Vendor shapes: [chat `message` — Anthropic](./gateway-schema-chat-message.md#anthropic), [chat `usage`](./gateway-schema-chat-usage.md), [agent `data`](./gateway-schema-agent-data.md).

<a id="provider-other"></a>

### Other

Per-provider subsections with code blocks: [chat `message` companion](./gateway-schema-chat-message.md) (OpenAI-compatible family and each `/providers/` row). Same for [usage](./gateway-schema-chat-usage.md) and [agent stream chunks](./gateway-schema-agent-data.md).

## Technical gotchas

- **Samples age quickly** — note **`openclaw`** package version and gateway **`server.version`** from **`hello-ok`**.
- **PII** — redact tokens, session keys, and user text in any captures you store beside these illustrations.
- **Provider table** — re-sync from [llms.txt](https://docs.openclaw.ai/llms.txt) when OpenClaw adds pages.
