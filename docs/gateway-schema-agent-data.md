# Gateway schema: agent `data`

Maps **`AgentEvent.data`** (**`Record<string, unknown>`** per [Gateway WebSocket frames](./gateway-websocket-frames.md#agent-payload)) to **streaming / multiplex chunks** as produced by model vendors or their adapters. **`stream`** on the event labels the logical substream (gateway-defined; often mirrors provider event types).

See [OpenClaw provider index](./gateway-open-payload-shapes.md#openclaw-provider-index). Redacted wire samples can be filed under [Gateway open payload shapes](./gateway-open-payload-shapes.md#agent-data).

**Source convention:** Immediately above every fenced code block, **Source:** links to the vendor API page or OpenClaw doc that defines (or is the best match for) that shape.

## OpenClaw references

- [Streaming and chunking](https://docs.openclaw.ai/concepts/streaming)
- [Messages](https://docs.openclaw.ai/concepts/messages)

---

## Canonical streaming chunk shapes

<a id="stream-openai-chunk"></a>

### OpenAI Chat Completions stream — `choices[0].delta`

**Source:** [OpenAI API reference — Chat streaming (chunk object)](https://platform.openai.com/docs/api-reference/chat-streaming).

```typescript
type OpenAIChatStreamChunk = {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
      refusal?: string | null;
    };
    finish_reason?: string | null;
    logprobs?: null | Record<string, unknown>;
  }>;
};
```

Final chunk may include **`usage`** (when usage is requested per OpenAI API options).

**Source:** [OpenAI API reference — Chat streaming (`usage` on final chunks)](https://platform.openai.com/docs/api-reference/chat-streaming).

```typescript
type OpenAIChatStreamFinalUsage = {
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    [k: string]: unknown;
  };
};
```

<a id="stream-anthropic-events"></a>

### Anthropic Messages stream — SSE event payloads

**Source:** [Anthropic API — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming).

```typescript
type AnthropicStreamEvent =
  | { type: 'message_start'; message: Record<string, unknown> }
  | { type: 'content_block_start'; index: number; content_block: Record<string, unknown> }
  | {
      type: 'content_block_delta';
      index: number;
      delta:
        | { type: 'text_delta'; text: string }
        | { type: 'input_json_delta'; partial_json: string }
        | { type: 'thinking_delta'; thinking: string }
        | Record<string, unknown>;
    }
  | { type: 'content_block_stop'; index: number }
  | {
      type: 'message_delta';
      delta: { stop_reason?: string; stop_sequence?: string | null };
      usage: { output_tokens: number };
    }
  | { type: 'message_stop' }
  | { type: 'ping' }
  | { type: 'error'; error: { type: string; message: string } }
  | { type: string; [k: string]: unknown };
```

<a id="stream-gemini-chunk"></a>

### Google Gemini stream — `GenerateContentResponse` chunk

**Source:** [Gemini API — Text generation (streaming responses)](https://ai.google.dev/gemini-api/docs/text-generation).

```typescript
type GeminiStreamChunk = {
  candidates?: Array<{
    content?: { role?: string; parts?: Array<Record<string, unknown>> };
    finishReason?: string;
    index?: number;
    safetyRatings?: unknown[];
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    [k: string]: unknown;
  };
  modelVersion?: string;
  promptFeedback?: Record<string, unknown>;
};
```

<a id="stream-ollama-chunk"></a>

### Ollama `/api/chat` stream

**Source:** [Ollama API — Chat (streaming)](https://github.com/ollama/ollama/blob/main/docs/api.md).

```typescript
type OllamaChatStreamChunk = {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
    tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
};
```

---

## Per-provider `AgentEvent.data` expectations

The gateway may wrap these in **`Record<string, unknown>`**; compare **`stream`** labels to your build.

### OpenAI — `openai`, `openai-codex`

Payloads follow [OpenAI stream chunk](#stream-openai-chunk) (often one chunk per event after parsing SSE).

### GitHub Copilot — `github-copilot`

Same family as [OpenAI stream chunk](#stream-openai-chunk).

### Groq, Mistral, xAI, Together, OpenRouter, Perplexity, NVIDIA, Moonshot, Z.AI, GLM, MiniMax, Qwen, Qianfan (compatible), Volcengine, Xiaomi, Venice, Cerebras — OpenAI-compatible ids

**Source:** [OpenAI API reference — Chat streaming](https://platform.openai.com/docs/api-reference/chat-streaming) (same chunk shape on compatible servers).

```typescript
type StreamDataOpenAIFamily = OpenAIChatStreamChunk | OpenAIChatStreamFinalUsage;
```

### vLLM — `vllm`

OpenAI-compatible streaming: [OpenAI stream chunk](#stream-openai-chunk).

### SGLang — `sglang`

OpenAI-compatible HTTP stream: [OpenAI stream chunk](#stream-openai-chunk).

### LiteLLM — `litellm`

Adapter-dependent; normalized streaming often still yields **OpenAI-like** chunk objects.

### Anthropic — `anthropic`, Claude Max proxy, Synthetic

**Source:** [Anthropic API — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming).

```typescript
type StreamDataAnthropicFamily = AnthropicStreamEvent;
```

### Google (Gemini) — `google`, `google-vertex`, `google-gemini-cli`

**Source:** [Gemini API — Text generation (streaming)](https://ai.google.dev/gemini-api/docs/text-generation).

```typescript
type StreamDataGeminiFamily = GeminiStreamChunk;
```

### Amazon Bedrock — `bedrock`

- **Converse stream**: AWS documents **ConverseStream** events (`contentBlockDelta`, `messageStop`, etc.) — structurally similar to multiplexed text/tool deltas.
- **InvokeModel with Anthropic**: raw SSE lines parse to [Anthropic stream events](#stream-anthropic-events).

**Source:** [AWS Bedrock — `ConverseStream`](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html) (event union in API reference).

```typescript
// Illustrative Converse stream member (names per AWS API reference)
type BedrockConverseStreamEvent = {
  contentBlockDelta?: { delta?: { text?: string; toolUse?: Record<string, unknown> } };
  messageStop?: Record<string, unknown>;
  metadata?: { usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } };
  [k: string]: unknown;
};
```

### Ollama — `ollama`

**Source:** [Ollama API — Chat (streaming)](https://github.com/ollama/ollama/blob/main/docs/api.md).

```typescript
type StreamDataOllama = OllamaChatStreamChunk;
```

### Hugging Face Inference — `huggingface`

Token streaming varies (TGI, router, custom handler). Often **server-sent JSON lines** with a `token` or `generated_text` field—not unified.

**Source:** [Hugging Face — Text Generation Inference / streaming](https://huggingface.co/docs/text-generation-inference/conceptual/streaming) (patterns vary by deployment).

```typescript
type HuggingFaceStreamLine = {
  token?: { id: number; text: string; logprob?: number };
  generated_text?: string;
  details?: Record<string, unknown>;
};
```

### Kilo, Cloudflare AI Gateway, Vercel AI Gateway

Passthrough: use the chunk shape of the **routed** backend (OpenAI, Anthropic, or Gemini families above).

### OpenCode / OpenCode Go

Upstream-dependent; match configured provider chunk family.

### Model Studio — `modelstudio`

Match the endpoint’s documented stream (often OpenAI- or Gemini-like).

### Deepgram — `deepgram`

Real-time STT streams **transcript deltas**, not LLM tokens:

**Source:** [Deepgram — Streaming transcription](https://developers.deepgram.com/docs/getting-started-with-live-streaming-audio).

```typescript
type DeepgramStreamDelta = {
  channel?: { alternatives?: Array<{ transcript: string }> };
  is_final?: boolean;
  speech_final?: boolean;
};
```

---

## Reasoning / “thinking” channels

Some providers emit **separate delta types** (Anthropic `thinking_delta`, Gemini reasoning parts, OpenAI **`reasoning`** / o-series where documented). Align with the same vendor streaming docs as [chat `message`](./gateway-schema-chat-message.md).

## Tool call fragments

- **OpenAI family:** incremental `tool_calls[].function.arguments` strings in [delta](#stream-openai-chunk).
- **Anthropic family:** `content_block_delta` with `input_json_delta.partial_json`.
- **Gemini:** `functionCall.args` may arrive incrementally depending on API version.

## Technical gotchas

- **`data` is not one schema** across providers or even across **`stream`** values on the same provider.
- Prefer **vendor streaming documentation** plus **captured frames** over guessing.
- **SSE framing:** many vendors wrap JSON in `data: {...}` lines; the gateway may strip or re-emit only the inner object.
