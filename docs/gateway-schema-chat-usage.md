# Gateway schema: chat `usage`

Maps **`ChatEvent.usage?`** (**`unknown`** on the wire per [Gateway WebSocket frames](./gateway-websocket-frames.md#chat-payload)) to **token / billing objects** defined by model vendors. Field names on the wire may differ (`prompt_tokens` vs `input`, etc.); the gateway may normalize or passthrough.

See [OpenClaw provider index](./gateway-open-payload-shapes.md#openclaw-provider-index). Redacted wire samples can be filed under [Gateway open payload shapes](./gateway-open-payload-shapes.md#chat-usage).

**Source convention:** Immediately above every fenced code block, **Source:** links to the vendor API page or OpenClaw doc that defines (or is the best match for) that shape.

## OpenClaw references

- [Usage tracking](https://docs.openclaw.ai/concepts/usage-tracking)
- [Token use and costs](https://docs.openclaw.ai/reference/token-use)
- [API usage and costs](https://docs.openclaw.ai/reference/api-usage-costs)

---

## Canonical `usage` families

<a id="usage-openai-family"></a>

### OpenAI Chat Completions — `usage`

**Source:** [OpenAI API reference — Chat completion object (`usage`)](https://platform.openai.com/docs/api-reference/chat/object).

```typescript
type OpenAIChatUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
    [k: string]: unknown;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
    [k: string]: unknown;
  };
};
```

<a id="usage-anthropic-family"></a>

### Anthropic Messages — `usage`

**Source:** [Anthropic API — Messages (response `usage`)](https://docs.anthropic.com/en/api/messages).

```typescript
type AnthropicMessageUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: Record<string, unknown>;
};
```

<a id="usage-gemini-family"></a>

### Google Gemini — `usageMetadata`

**Source:** [Gemini API — Count tokens / usage metadata](https://ai.google.dev/gemini-api/docs/tokens).

```typescript
type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
  toolUsePromptTokenCount?: number;
  promptTokensDetails?: Array<{ modality?: string; tokenCount?: number }>;
  candidatesTokensDetails?: Array<{ modality?: string; tokenCount?: number }>;
};
```

<a id="usage-bedrock-family"></a>

### Amazon Bedrock Converse — `usage`

**Source:** [AWS Bedrock — `Converse` response (`usage`)](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html) (`inputTokens`, `outputTokens`, `totalTokens`; SDK may camelCase).

```typescript
type BedrockConverseUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};
```

<a id="usage-ollama-family"></a>

### Ollama — token counts on chat response

**Source:** [Ollama API — Chat endpoint (response fields)](https://github.com/ollama/ollama/blob/main/docs/api.md) — not named `usage`; counts on the root object.

```typescript
type OllamaChatTokenFields = {
  prompt_eval_count?: number;
  eval_count?: number;
};
```

---

## Per-provider `usage` shapes (OpenClaw `/providers/`)

### OpenAI — `openai`, `openai-codex`

**Source:** [OpenAI API reference — Chat completion object (`usage`)](https://platform.openai.com/docs/api-reference/chat/object).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 120,
  completion_tokens: 48,
  total_tokens: 168,
};
```

### GitHub Copilot — `github-copilot`

Typically **OpenAI-shaped** completion usage:

**Source:** [OpenAI API reference — Chat completion object (`usage`)](https://platform.openai.com/docs/api-reference/chat/object) (Copilot model endpoints follow the same completion envelope; see [GitHub Copilot documentation](https://docs.github.com/en/copilot)).

```typescript
const usage: OpenAIChatUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
```

### Groq — `groq`

OpenAI-style **`usage`**, often with **timing** extensions on the same object (vendor-specific):

**Source:** [Groq API reference — Chat completions](https://console.groq.com/docs/api-reference#chat-completions).

```typescript
type GroqChatUsage = OpenAIChatUsage & {
  prompt_time?: number;
  completion_time?: number;
  total_time?: number;
};
```

### Mistral — `mistral`

**Source:** [Mistral AI — Usage / tokens](https://docs.mistral.ai/capabilities/completion/usage).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 50,
  completion_tokens: 20,
  total_tokens: 70,
};
```

### xAI — `xai`

**Source:** [xAI API — Chat completions](https://docs.x.ai/docs/guides/chat).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 10,
  completion_tokens: 32,
  total_tokens: 42,
};
```

### Together AI — `together`

**Source:** [Together AI API — Chat completions](https://docs.together.ai/reference/chat-completions).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 100,
  completion_tokens: 200,
  total_tokens: 300,
};
```

### OpenRouter — `openrouter`

OpenAI-style **`usage`** on chat completions; may also expose **billing** fields on the response envelope (see OpenRouter docs).

**Source:** [OpenRouter API — Chat completions (response schema)](https://openrouter.ai/docs/api/reference/chat/completions).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 24,
  completion_tokens: 150,
  total_tokens: 174,
};
```

### Perplexity — `perplexity-provider`

OpenAI-compatible **`usage`** plus optional **`search_context_size`** or citation-related usage on some models (check current Perplexity API reference).

**Source:** [Perplexity API — Chat completions](https://docs.perplexity.ai/api-reference/chat-completions-post).

```typescript
type PerplexityUsage = OpenAIChatUsage & {
  search_context_size?: string;
};
```

### NVIDIA — `nvidia`

**Source:** [NVIDIA NIM / OpenAI-compatible LLM APIs](https://docs.nvidia.com/nim/large-language-models/latest/getting-started.html) (completion `usage` matches OpenAI-style fields on compatible endpoints).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 64,
  completion_tokens: 128,
  total_tokens: 192,
};
```

### Moonshot / Kimi — `moonshot`, `kimi-coding`

**Source:** [Moonshot AI — API reference (chat completions)](https://platform.moonshot.cn/docs/api/chat).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 200,
  completion_tokens: 100,
  total_tokens: 300,
};
```

### Z.AI / GLM — `zai`, `glm`

**Source:** [Z.AI documentation](https://docs.z.ai/guides/overview/overview) (OpenAI-compatible `usage` on chat endpoints; verify current API reference).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 80,
  completion_tokens: 40,
  total_tokens: 120,
};
```

### MiniMax — `minimax`

**Source:** [MiniMax API — Text (chat)](https://www.minimax.io/document/guides/chat-model).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 30,
  completion_tokens: 60,
  total_tokens: 90,
};
```

### Qwen — `qwen`, `qwen-portal`

Compatible endpoints: OpenAI-style **`usage`**.

**Source:** [Alibaba Cloud Model Studio — API overview](https://www.alibabacloud.com/help/en/model-studio/getting-started/models) (DashScope / compatible OpenAI-style responses; see service API reference for your endpoint).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 55,
  completion_tokens: 44,
  total_tokens: 99,
};
```

### Qianfan — `qianfan`

ERNIE responses typically include **`usage`** with **`prompt_tokens`**, **`completion_tokens`**, **`total_tokens`** (names may vary slightly by endpoint version).

**Source:** [Baidu Qianfan / ERNIE API documentation](https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Ilkkcm0z2).

```typescript
type QianfanUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};
```

### Volcengine / BytePlus — `volcengine`, `byteplus`, `byteplus-plan`, `volcengine-plan`

OpenAI-compatible responses:

**Source:** [Volcengine — OpenAI-compatible chat API](https://www.volcengine.com/docs/82379/1099455).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 12,
  completion_tokens: 34,
  total_tokens: 46,
};
```

### Xiaomi MiMo — `xiaomi`

**Source:** [OpenClaw — Xiaomi MiMo provider](https://docs.openclaw.ai/providers/xiaomi) (OpenAI-compatible `usage` when using compatible mode).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 20,
  completion_tokens: 25,
  total_tokens: 45,
};
```

### Venice AI — `venice`

**Source:** [Venice AI — API reference](https://docs.venice.ai/api-reference/api-reference).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 40,
  completion_tokens: 80,
  total_tokens: 120,
};
```

### Cerebras — `cerebras`

**Source:** [Cerebras inference — API reference](https://inference-docs.cerebras.ai/api-reference).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 512,
  completion_tokens: 256,
  total_tokens: 768,
};
```

### vLLM — `vllm`

OpenAI-compatible **`usage`**.

**Source:** [vLLM — OpenAI-compatible server](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 1000,
  completion_tokens: 500,
  total_tokens: 1500,
};
```

### SGLang — `sglang`

**Source:** [SGLang — OpenAI-compatible APIs](https://docs.sglang.ai/backend/openai_api.html).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 90,
  completion_tokens: 45,
  total_tokens: 135,
};
```

### LiteLLM — `litellm`

Normalized responses often include OpenAI-like **`usage`** regardless of upstream.

**Source:** [LiteLLM — Token usage](https://docs.litellm.ai/docs/completion/token_usage).

```typescript
const usage: OpenAIChatUsage = {
  prompt_tokens: 10,
  completion_tokens: 20,
  total_tokens: 30,
};
```

### Kilo, Cloudflare AI Gateway, Vercel AI Gateway — `kilocode`, `cloudflare-ai-gateway`, `vercel-ai-gateway`

**Passthrough** from upstream: expect **`OpenAIChatUsage`**, **`AnthropicMessageUsage`**, or **`GeminiUsageMetadata`** depending on the routed model.

### OpenCode / OpenCode Go — `opencode`, `opencode-go`

Reflects the **configured LLM backend**; use the matching family above.

### Model Studio — `modelstudio`

SKU-dependent; most expose OpenAI-like or Gemini-like usage—match the endpoint family.

### Anthropic — `anthropic`

**Source:** [Anthropic API — Messages (response `usage`)](https://docs.anthropic.com/en/api/messages).

```typescript
const usage: AnthropicMessageUsage = {
  input_tokens: 100,
  output_tokens: 50,
};
```

### Claude Max API proxy — `claude-max-api-proxy`

Same as Anthropic **`usage`** on Messages responses.

**Source:** [Anthropic API — Messages (response `usage`)](https://docs.anthropic.com/en/api/messages).

```typescript
const usage: AnthropicMessageUsage = { input_tokens: 80, output_tokens: 40 };
```

### Synthetic — `synthetic`

Anthropic-shaped test traffic:

**Source:** [Anthropic API — Messages (response `usage`)](https://docs.anthropic.com/en/api/messages).

```typescript
const usage: AnthropicMessageUsage = { input_tokens: 10, output_tokens: 10 };
```

### Google (Gemini) — `google`, `google-vertex`, `google-gemini-cli`

**Source:** [Gemini API — Count tokens / usage metadata](https://ai.google.dev/gemini-api/docs/tokens).

```typescript
const usage: GeminiUsageMetadata = {
  promptTokenCount: 60,
  candidatesTokenCount: 30,
  totalTokenCount: 90,
};
```

### Amazon Bedrock — `bedrock`

Converse:

**Source:** [AWS Bedrock — `Converse` response (`usage`)](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html).

```typescript
const usage: BedrockConverseUsage = {
  inputTokens: 200,
  outputTokens: 100,
  totalTokens: 300,
};
```

`InvokeModel` bodies embed usage inside **model-specific** JSON (e.g. Anthropic-shaped **`usage`** inside the model response).

### Ollama — `ollama`

**Source:** [Ollama API — Chat endpoint (response fields)](https://github.com/ollama/ollama/blob/main/docs/api.md).

```typescript
const ollamaCounts: OllamaChatTokenFields = {
  prompt_eval_count: 11,
  eval_count: 18,
};
```

### Hugging Face Inference — `huggingface`

Many endpoints omit a standard **`usage`** object; some return **`details`** or nothing. Treat as **opaque** unless the chosen router documents counts.

**Source:** [Hugging Face — Inference Providers documentation](https://huggingface.co/docs/inference-providers/en/index) (response schema is task- and provider-specific).

```typescript
type HuggingFaceInferenceUsage = Record<string, unknown>;
```

### Deepgram — `deepgram`

Billing for STT is **not** LLM token usage; response metadata includes duration / model info, not `prompt_tokens`.

**Source:** [Deepgram API — Metadata fields](https://developers.deepgram.com/docs/metadata) (see product docs for your endpoint).

```typescript
type DeepgramUsageLike = {
  duration?: number;
  channels?: number;
  model?: string;
};
```

---

## Technical gotchas

- **Naming:** vendors and gateway versions use different keys; treat **`usage`** as **opaque** until you match your traffic.
- **Redact** keys and PII in stored samples.
- **Gateway mapping:** OpenClaw may rename fields when normalizing; compare **`hello-ok.server.version`** with your capture set.
