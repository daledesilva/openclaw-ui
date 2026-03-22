# Gateway schema: chat `message`

Maps **`ChatEvent.message?`** (**`unknown`** / **`TAny`** on the wire per [Gateway WebSocket frames](./gateway-websocket-frames.md#chat-payload)) to **canonical model-provider message/content shapes**. The gateway may serialize, wrap, or merge these; compare with captures from your **`openclaw`** version.

See [OpenClaw provider index](./gateway-open-payload-shapes.md#openclaw-provider-index). Wire samples (redacted) can still be filed under [Gateway open payload shapes](./gateway-open-payload-shapes.md#chat-message).

---

## Canonical families (reuse across providers)

These types are **illustrative** (field names follow public vendor docs as of typical API versions; always verify against live API references).

**Source convention:** Immediately above every fenced code block, **Source:** links to the vendor API page or OpenClaw doc that defines (or is the best match for) that shape.

<a id="canonical-openai-chat-message"></a>

### OpenAI Chat Completions — assistant `choices[0].message`

**Source:** [OpenAI API reference — Chat completion object](https://platform.openai.com/docs/api-reference/chat/object).

```typescript
type OpenAIChatCompletionMessage = {
  role: 'assistant' | 'developer' | 'user' | 'system' | 'tool';
  content?: string | null | Array<OpenAIChatContentPart>;
  refusal?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  function_call?: { name: string; arguments: string }; // legacy
};

type OpenAIChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'refusal'; refusal: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } }
  | { type: string; [k: string]: unknown };
```

<a id="canonical-anthropic-message"></a>

### Anthropic Messages — assistant `message`

**Source:** [Anthropic API — Messages](https://docs.anthropic.com/en/api/messages).

```typescript
type AnthropicAssistantMessage = {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<AnthropicContentBlock>;
  model: string;
  stop_reason?: string | null;
  stop_sequence?: string | null;
};

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'thinking'; thinking: string }
  | { type: 'redacted_thinking'; data: string }
  | { type: string; [k: string]: unknown };
```

<a id="canonical-gemini-content"></a>

### Google Gemini — `Content` / `Part`

**Source:** [Gemini API — `Content` (REST)](https://ai.google.dev/api/rest/v1beta/Content), [`Part`](https://ai.google.dev/api/rest/v1beta/Part).

```typescript
type GeminiContent = {
  role?: 'user' | 'model';
  parts: Array<GeminiPart>;
};

type GeminiPart =
  | { text: string }
  | { inlineData?: { mimeType?: string; data?: string } }
  | { fileData?: { mimeType?: string; fileUri?: string } }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response?: Record<string, unknown> } }
  | { [k: string]: unknown };
```

<a id="canonical-bedrock-converse"></a>

### Amazon Bedrock Converse — `Message` / `ContentBlock`

**Source:** [AWS Bedrock — `Message`](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Message.html), [`ContentBlock`](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ContentBlock.html).

```typescript
type BedrockConverseMessage = {
  role: 'user' | 'assistant';
  content: BedrockContentBlock[];
};

type BedrockContentBlock =
  | { text: string }
  | { image?: Record<string, unknown> }
  | { document?: Record<string, unknown> }
  | { toolUse: { toolUseId: string; name: string; input: Record<string, unknown> } }
  | { toolResult: { toolUseId: string; content: BedrockContentBlock[]; status?: string } }
  | { reasoningContent?: Record<string, unknown> }
  | { [k: string]: unknown };
```

<a id="canonical-ollama-chat"></a>

### Ollama — `/api/chat` `message`

**Source:** [Ollama API — Generate a chat completion](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion).

```typescript
type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[]; // base64, user messages
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
};
```

---

## Per-provider `message` shapes (OpenClaw `/providers/`)

Each subsection names the **typical upstream** assistant / model turn shape. Aggregators and gateways usually **passthrough** one of the canonical families above.

<a id="google-gemini"></a>

### Google (Gemini) — `google`, `google-vertex`, `google-gemini-cli`

Same as [Gemini `Content`](#canonical-gemini-content) in conversation arrays; final model turn uses `role: 'model'` and `parts`.

**Source:** [Gemini API — Text generation (multi-turn)](https://ai.google.dev/gemini-api/docs/text-generation).

```typescript
// Typical model turn in a multi-turn GenerateContent request/response
const geminiModelTurn: GeminiContent = {
  role: 'model',
  parts: [{ text: '…' }, { functionCall: { name: '…', args: {} } }],
};
```

OpenClaw: [Google](https://docs.openclaw.ai/providers/google).

<a id="anthropic"></a>

### Anthropic — `anthropic`

Same as [Anthropic assistant `message`](#canonical-anthropic-message).

OpenClaw: [Anthropic](https://docs.openclaw.ai/providers/anthropic).

### Claude Max API proxy — `claude-max-api-proxy` (conceptually)

Upstream is the **Anthropic Messages** wire format; assistant payload matches [Anthropic assistant `message`](#canonical-anthropic-message).

OpenClaw: [claude-max-api-proxy](https://docs.openclaw.ai/providers/claude-max-api-proxy).

### Synthetic — `synthetic`

Documented as exercising Anthropic-shaped traffic in OpenClaw; treat assistant content as [Anthropic content blocks](#canonical-anthropic-message).

OpenClaw: [Synthetic](https://docs.openclaw.ai/providers/synthetic).

<a id="openai-and-openai-compatible"></a>

### OpenAI — `openai`, `openai-codex`

Same as [OpenAI Chat Completions `message`](#canonical-openai-chat-message). Responses API uses a different top-level object but still exposes assistant content and tool calls in vendor-defined fields.

OpenClaw: [OpenAI](https://docs.openclaw.ai/providers/openai).

### GitHub Copilot — `github-copilot`

Copilot Chat / model endpoints are **OpenAI-style** chat messages (`role`, `content`, optional `tool_calls`). Shape aligns with [OpenAI Chat Completions `message`](#canonical-openai-chat-message).

OpenClaw: [GitHub Copilot](https://docs.openclaw.ai/providers/github-copilot).

### Groq — `groq`

OpenAI-compatible Chat Completions: [OpenAI Chat Completions `message`](#canonical-openai-chat-message).

OpenClaw: [Groq](https://docs.openclaw.ai/providers/groq).

### Mistral — `mistral`

Chat API mirrors OpenAI-style `choices[].message` with string or **part array** `content` (e.g. `type: 'text'`). Tool calls use the same pattern as OpenAI.

**Source:** [Mistral API — Chat completions](https://docs.mistral.ai/api/#tag/chat).

```typescript
// Mistral assistant message (response choice.message) — same idea as OpenAI
type MistralChatMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [Mistral](https://docs.openclaw.ai/providers/mistral).

### xAI — `xai`

Groq-style OpenAI-compatible completions; assistant `message` matches [OpenAI Chat Completions `message`](#canonical-openai-chat-message).

OpenClaw: [xAI](https://docs.openclaw.ai/providers/xai).

### Together AI — `together`

OpenAI-compatible chat completions message object.

**Source:** [Together AI API — Chat completions](https://docs.together.ai/reference/chat-completions).

```typescript
type TogetherAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [Together](https://docs.openclaw.ai/providers/together).

### OpenRouter — `openrouter`

Returns OpenAI-style `choices[0].message` (plus vendor extensions on the envelope). Assistant body:

**Source:** [OpenRouter API — Chat completions](https://openrouter.ai/docs/api/reference/chat/completions).

```typescript
type OpenRouterAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [OpenRouter](https://docs.openclaw.ai/providers/openrouter).

### Perplexity — `perplexity-provider`

Chat Completions–compatible API; assistant `message` is OpenAI-shaped. Search/citations may appear as **additional top-level fields** on the response, not always inside `message`.

**Source:** [Perplexity API — Chat completions](https://docs.perplexity.ai/api-reference/chat-completions-post).

```typescript
type PerplexityAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [Perplexity provider](https://docs.openclaw.ai/providers/perplexity-provider).

### NVIDIA — `nvidia`

NIM / NVIDIA-hosted OpenAI-compatible endpoints: [OpenAI Chat Completions `message`](#canonical-openai-chat-message).

OpenClaw: [NVIDIA](https://docs.openclaw.ai/providers/nvidia).

### Moonshot / Kimi — `moonshot`, `kimi-coding`

Public API is **OpenAI-compatible** (`/v1/chat/completions`); assistant message matches [OpenAI Chat Completions `message`](#canonical-openai-chat-message).

OpenClaw: [Moonshot](https://docs.openclaw.ai/providers/moonshot).

### Z.AI / GLM — `zai`, `glm`

GLM APIs expose OpenAI-compatible chat; assistant message:

**Source:** [Z.AI API documentation](https://docs.z.ai/guides/overview/overview) (OpenAI-compatible chat surface; verify current endpoint docs).

```typescript
type ZaiGlmAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [Z.AI](https://docs.openclaw.ai/providers/zai), [GLM](https://docs.openclaw.ai/providers/glm).

### MiniMax — `minimax`

Typically OpenAI-compatible chat completion message shape when using the REST API.

**Source:** [MiniMax API — Text (chat)](https://www.minimax.io/document/guides/chat-model).

```typescript
type MiniMaxAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [MiniMax](https://docs.openclaw.ai/providers/minimax).

### Qwen — `qwen`, `qwen-portal`

DashScope / OpenAI-compatible modes: assistant message follows [OpenAI Chat Completions `message`](#canonical-openai-chat-message) when using compatible endpoints.

OpenClaw: [Qwen](https://docs.openclaw.ai/providers/qwen).

### Qianfan — `qianfan`

ERNIE / Baidu model APIs return a **message-like** object with `role` and `content` (string or structured); treat as OpenAI-family unless you use a legacy endpoint with different names.

**Source:** [Baidu Qianfan / ERNIE Bot API documentation](https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Ilkkcm0z2) (message shape varies by endpoint; verify live reference).

```typescript
type QianfanAssistantMessage = {
  role: 'assistant';
  content: string;
  function_call?: { name: string; arguments: string };
};
```

OpenClaw: [Qianfan](https://docs.openclaw.ai/providers/qianfan).

### Volcengine / BytePlus — `volcengine`, `byteplus`, `byteplus-plan`, `volcengine-plan`

Doubao and related APIs are commonly **OpenAI-compatible**; assistant message:

**Source:** [Volcengine — Ark / OpenAI-compatible chat](https://www.volcengine.com/docs/82379/1099455).

```typescript
type VolcengineAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [Volcengine](https://docs.openclaw.ai/providers/volcengine).

### Xiaomi MiMo — `xiaomi`

Documented against OpenAI-compatible chat patterns in provider guides; assistant message:

**Source:** [OpenClaw — Xiaomi MiMo provider](https://docs.openclaw.ai/providers/xiaomi) (links to vendor API; message body matches OpenAI chat completion shape when using compatible mode).

```typescript
type XiaomiAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [Xiaomi](https://docs.openclaw.ai/providers/xiaomi).

### Venice AI — `venice`

OpenAI-compatible API surface:

**Source:** [Venice AI — API reference](https://docs.venice.ai/api-reference/api-reference).

```typescript
type VeniceAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [Venice](https://docs.openclaw.ai/providers/venice).

### Cerebras — `cerebras`

OpenAI-compatible inference API; assistant message matches [OpenAI Chat Completions `message`](#canonical-openai-chat-message).

OpenClaw: [model-providers](https://docs.openclaw.ai/concepts/model-providers) (plugin id `cerebras`).

### vLLM — `vllm`

OpenAI-compatible server; streaming and final assistant `message` match OpenAI.

**Source:** [vLLM — OpenAI-compatible server](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html).

```typescript
type VllmAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [vLLM](https://docs.openclaw.ai/providers/vllm).

### SGLang — `sglang`

OpenAI-compatible HTTP server mode: same assistant `message` shape.

**Source:** [SGLang — OpenAI-compatible APIs](https://docs.sglang.ai/backend/openai_api.html).

```typescript
type SglangAssistantMessage = OpenAIChatCompletionMessage;
```

OpenClaw: [SGLang](https://docs.openclaw.ai/providers/sglang).

### LiteLLM — `litellm`

LiteLLM normalizes many backends to an OpenAI-like **`ModelResponse`**; the assistant text/tool payload is still conceptually [OpenAI Chat Completions `message`](#canonical-openai-chat-message) after normalization.

OpenClaw: [LiteLLM](https://docs.openclaw.ai/providers/litellm).

### Kilo (Kilo Gateway) — `kilocode`

Aggregator/proxy; upstream-defined but commonly OpenAI- or Anthropic-shaped passthrough.

**Source:** [OpenClaw — Kilo Gateway provider](https://docs.openclaw.ai/providers/kilocode) (upstream vendor docs define the exact message JSON).

```typescript
type KiloPassthroughAssistant =
  | OpenAIChatCompletionMessage
  | Pick<AnthropicAssistantMessage, 'role' | 'content'>;
```

OpenClaw: [Kilocode](https://docs.openclaw.ai/providers/kilocode).

### Cloudflare AI Gateway — `cloudflare-ai-gateway`

Passthrough to configured upstream; assistant shape is whichever family the origin API uses (usually [OpenAI](#canonical-openai-chat-message) or [Anthropic](#canonical-anthropic-message)).

OpenClaw: [Cloudflare AI Gateway](https://docs.openclaw.ai/providers/cloudflare-ai-gateway).

### Vercel AI Gateway — `vercel-ai-gateway`

Same as Cloudflare: **passthrough** to routed provider.

OpenClaw: [Vercel AI Gateway](https://docs.openclaw.ai/providers/vercel-ai-gateway).

### OpenCode / OpenCode Go — `opencode`, `opencode-go`

Agent surfaces aggregate upstream LLM calls; on the wire you still see **provider-native** assistant payloads from the configured backend (typically OpenAI or Anthropic families above).

OpenClaw: [OpenCode](https://docs.openclaw.ai/providers/opencode), [OpenCode Go](https://docs.openclaw.ai/providers/opencode-go).

### Model Studio — `modelstudio`

Provider-specific hosted APIs vary by region SKU; most chat flows expose **OpenAI-compatible** or **Gemini-like** JSON. Compare captures to [OpenAI](#canonical-openai-chat-message) or [Gemini](#canonical-gemini-content) families.

OpenClaw: [Model Studio](https://docs.openclaw.ai/providers/modelstudio).

### Amazon Bedrock — `bedrock`

Use [Bedrock Converse `Message` / `ContentBlock`](#canonical-bedrock-converse). Legacy `InvokeModel` JSON differs by **model supplier** (Anthropic JSON in body vs. Amazon Titan structures).

OpenClaw: [Bedrock](https://docs.openclaw.ai/providers/bedrock).

### Ollama — `ollama`

Native chat uses [Ollama `message`](#canonical-ollama-chat) (not identical to OpenAI field names).

OpenClaw: [Ollama](https://docs.openclaw.ai/providers/ollama).

### Hugging Face Inference — `huggingface`

Highly **model- and router-dependent**. Chat-template models often return generated text or a JSON object with a `generated_text` or choices array; there is no single global schema.

**Source:** [Hugging Face — Inference Providers / task schemas](https://huggingface.co/docs/inference-providers/en/tasks/index) (response shape varies by task and router).

```typescript
// Illustrative text-generation style (not universal)
type HuggingFaceTextGenOutput = {
  generated_text?: string;
  details?: Record<string, unknown>;
};
```

OpenClaw: [Hugging Face](https://docs.openclaw.ai/providers/huggingface).

### Deepgram — `deepgram`

Not an LLM **chat** `message` in the same sense: speech APIs return **transcript** results (alternatives, confidence, channels). Different from `ChatEvent.message` for LLM turns.

**Source:** [Deepgram — Pre-recorded transcription response](https://developers.deepgram.com/docs/pre-recorded-audio) (streaming / real-time schemas in [streaming docs](https://developers.deepgram.com/docs/getting-started-with-live-streaming-audio)).

```typescript
// Illustrative: STT result channel (vendor-specific)
type DeepgramTranscriptSummary = {
  channel?: { alternatives?: Array<{ transcript: string; confidence: number }> };
};
```

OpenClaw: [Deepgram](https://docs.openclaw.ai/providers/deepgram).

---

## Technical gotchas

- **Gateway normalization:** wire **`message`** may be a string, a `{ text }` / `{ content }` wrapper, or provider-native JSON at rest—match your gateway version.
- **PII:** redact samples in [open payload shapes](./gateway-open-payload-shapes.md).
- **API drift:** vendor docs add content block types (reasoning, citations); extend the unions from their reference pages.
