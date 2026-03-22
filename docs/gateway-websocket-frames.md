# Gateway WebSocket frames and events

TypeScript-shaped summaries aligned with OpenClaw **`ProtocolSchemas`** (**`PROTOCOL_VERSION` 3**) from the published **`openclaw` npm package** (verified against **`openclaw@2026.3.13`**).

**Authoritative sources**

- Install: `npm pack openclaw` → inspect **`package/dist/plugin-sdk/gateway/protocol/schema/protocol-schemas.d.ts`** (and siblings).
- Upstream Git: TypeBox sources under **`src/gateway/protocol/`** ([TypeBox / protocol](https://docs.openclaw.ai/concepts/typebox)). A raw **`dist/protocol.schema.json`** URL on GitHub may 404 depending on branch/publish; prefer npm or a local clone.
- Framing and handshake: [Gateway protocol](https://docs.openclaw.ai/gateway/protocol).
- **Open / `unknown` fields:** inventory + per-provider samples → [Gateway open payload shapes](./gateway-open-payload-shapes.md) (includes [OpenClaw provider index](./gateway-open-payload-shapes.md#openclaw-provider-index)).
- **Model-provider wire shapes** (for **`unknown`** / open fields): [gateway-schema-chat-message.md](./gateway-schema-chat-message.md), [gateway-schema-chat-usage.md](./gateway-schema-chat-usage.md), [gateway-schema-agent-data.md](./gateway-schema-agent-data.md) (property-named links under the relevant TypeScript blocks).

**Source convention:** Each TypeScript frame summary below is preceded by **Source:** → [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (structures mirror TypeBox **`ProtocolSchemas`** in the **`openclaw` npm package**).

Named push-payload types below are exactly those exported on **`ProtocolSchemas`** in this version. Other **`event`** strings appear at runtime (**`hello-ok.features.events`**); their payloads are often **`unknown`** to the generic frame validator unless listed here — see [open payload shapes](./gateway-open-payload-shapes.md#event-payload).

## Conceptual model

| `type`  | Role |
| ------- | ---- |
| `req`   | Client → gateway RPC. |
| `res`   | Gateway → client reply to a prior `req` (matched by **`id`**). |
| `event` | Gateway → client push (discriminated by **`event`**). |

---

## `req`

**Role:** Client → gateway RPC.

### Frame envelope

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (TypeBox **`ProtocolSchemas`** in the published **`openclaw` npm package**; verified **`openclaw@2026.3.13`**).

```typescript
// type: 'req'  (RequestFrame)
{
  type: 'req';                           // Request discriminator
  id: string;                            // Same id on the matching res
  method: string;                        // RPC method name
  params?: unknown;                      // Optional method body — [open shapes](./gateway-open-payload-shapes.md#request-params)
}
```

### `connect` params

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`ConnectParams` in **`ProtocolSchemas`**).

```typescript
// method: 'connect'  (ConnectParams)
{
  minProtocol: number;                   // Lowest protocol version offered
  maxProtocol: number;                   // Highest protocol version offered
  client: {
    id: string;                          // Literal union in schema (cli, webchat-ui, openclaw-macos, …)
    displayName?: string;                // Human-facing label
    version: string;                     // Client version
    platform: string;                    // OS / runtime platform
    deviceFamily?: string;               // Hardware family when known
    modelIdentifier?: string;            // Device model when known
    mode: string;                        // Literal union: node | cli | ui | webchat | test | backend | probe
    instanceId?: string;                 // Distinguishes concurrent instances
  };
  caps?: string[];                       // Node capability categories
  commands?: string[];                   // Node command allowlist
  permissions?: Record<string, boolean>; // Node permission toggles
  pathEnv?: string;                      // PATH override for child processes when set
  role?: string;                         // e.g. operator | node (gateway interprets)
  scopes?: string[];                     // Operator scopes when role is operator
  device?: {
    id: string;                          // Stable device id
    publicKey: string;                   // Ed25519 public key
    signature: string;                     // Challenge signature
    signedAt: number;                    // Unix ms
    nonce: string;                       // From connect.challenge
  };
  auth?: {
    token?: string;                      // Gateway token
    bootstrapToken?: string;             // Bootstrap flow token
    deviceToken?: string;                // Cached device token
    password?: string;                   // Password auth when enabled
  };
  locale?: string;                      // BCP 47 locale
  userAgent?: string;                   // Client user-agent
}
```

### `chat.send` params

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`ChatSendParams` in **`ProtocolSchemas`**).

```typescript
// method: 'chat.send'  (ChatSendParams)
{
  sessionKey: string;                    // Target session
  message: string;                     // User text
  thinking?: string;                    // Optional thinking / reasoning hint
  deliver?: boolean;                    // Delivery toggle when supported
  attachments?: unknown[];             // Attachment blobs — [open shapes](./gateway-open-payload-shapes.md#chat-send-attachments)
  timeoutMs?: number;                  // Send-side timeout
  systemInputProvenance?: {
    kind: string;
    originSessionId?: string;
    sourceSessionKey?: string;
    sourceChannel?: string;
    sourceTool?: string;
  };
  systemProvenanceReceipt?: string;
  idempotencyKey: string;               // Required dedupe key
}
```

### `chat.history` params

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`ChatHistoryParams` in **`ProtocolSchemas`**).

```typescript
// method: 'chat.history'  (ChatHistoryParams)
{
  sessionKey: string;
  limit?: number;                        // Max rows when set
}
```

### `chat.abort` / `chat.inject` params

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`ChatAbortParams` in **`ProtocolSchemas`**).

```typescript
// method: 'chat.abort'  (ChatAbortParams)
{
  sessionKey: string;
  runId?: string;                        // Abort specific run when set
}
```

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`ChatInjectParams` in **`ProtocolSchemas`**).

```typescript
// method: 'chat.inject'  (ChatInjectParams)
{
  sessionKey: string;
  message: string;
  label?: string;
}
```

### `sessions.list` params

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`SessionsListParams` in **`ProtocolSchemas`**).

```typescript
// method: 'sessions.list'  (SessionsListParams)
{
  limit?: number;
  activeMinutes?: number;
  includeGlobal?: boolean;
  includeUnknown?: boolean;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  label?: string;
  spawnedBy?: string;
  agentId?: string;
  search?: string;
}
```

### Other RPC methods

Hundreds of methods share the same **`req`** envelope; params types are **`ProtocolSchemas['<Name>Params']`** (e.g. **`SendParams`**, **`AgentParams`**, **`NodeInvokeParams`**, …). **`usage.cost`** is **not** present under that name in **`ProtocolSchemas`** for **`openclaw@2026.3.13`**—if your gateway lists it under **`hello-ok.features.methods`**, treat params/result as version-specific **`unknown`** until you match your installed package — [open shapes](./gateway-open-payload-shapes.md#rpc-payloads-and-usage-cost).

Side-effecting methods require **`idempotencyKey`** where the schema marks them ([Gateway protocol](https://docs.openclaw.ai/gateway/protocol)).

---

## `res`

**Role:** Gateway → client reply to a prior **`req`**.

### Frame envelope

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`ResponseFrame` in **`ProtocolSchemas`**).

```typescript
// res  (ResponseFrame)
{
  type: 'res';                           // Response discriminator
  id: string;                            // Same id as the req
  ok: boolean;                           // Success vs failure
  payload?: unknown;                     // Present when ok === true — [open shapes](./gateway-open-payload-shapes.md#response-payload)
  error?: {
    code: string;                        // Error code
    message: string;                     // Human-readable message
    details?: unknown;                   // Structured details — [open shapes](./gateway-open-payload-shapes.md#response-error-details)
    retryable?: boolean;                 // Client may retry when true
    retryAfterMs?: number;               // Suggested backoff
  };
}
```

### `connect` success payload (`hello-ok`)

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`HelloOk` in **`ProtocolSchemas`**).

```typescript
// res ok — payload for method: 'connect'  (HelloOk)
{
  type: 'hello-ok';                      // Handshake success marker
  protocol: number;                      // Negotiated protocol (3 in this era)
  server: {
    version: string;                     // Gateway version string
    connId: string;                      // Connection id for this socket
  };
  features: {
    methods: string[];                   // Advertised RPC methods
    events: string[];                    // Advertised push event names
  };
  snapshot: {
    presence: [
      {
        host?: string;
        ip?: string;
        version?: string;
        platform?: string;
        deviceFamily?: string;
        modelIdentifier?: string;
        mode?: string;
        lastInputSeconds?: number;
        reason?: string;
        tags?: string[];
        text?: string;
        ts: number;                      // Entry timestamp (required)
        deviceId?: string;
        roles?: string[];
        scopes?: string[];
        instanceId?: string;
      },
    ];
    health: unknown;                     // Schema: TAny — [open shapes](./gateway-open-payload-shapes.md#snapshot-health)
    stateVersion: {
      presence: number;                   // Monotonic presence revision
      health: number;                   // Monotonic health revision
    };
    uptimeMs: number;
    configPath?: string;
    stateDir?: string;
    sessionDefaults?: {
      defaultAgentId: string;
      mainKey: string;
      mainSessionKey: string;
      scope?: string;
    };
    authMode?: 'none' | 'token' | 'password' | 'trusted-proxy';
    updateAvailable?: {
      currentVersion: string;
      latestVersion: string;
      channel: string;
    };
  };
  canvasHostUrl?: string;
  auth?: {
    deviceToken: string;
    role: string;
    scopes: string[];
    issuedAtMs?: number;
  };
  policy: {
    maxPayload: number;                   // Max WS frame payload bytes
    maxBufferedBytes: number;             // Buffered bytes limit
    tickIntervalMs: number;             // Server tick period
  };
}
```

---

## `event`

**Role:** Gateway → client push.

### Frame envelope

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`EventFrame` in **`ProtocolSchemas`**).

```typescript
// type: 'event'  (EventFrame)
{
  type: 'event';                         // Push discriminator
  event: string;                         // Event name (see hello-ok.features.events)
  payload?: unknown;                     // Event body — [open shapes](./gateway-open-payload-shapes.md#event-payload)
  seq?: number;                          // Optional ordering
  stateVersion?: {
    presence: number;                    // Aligns with snapshot.stateVersion.presence
    health: number;                      // Aligns with snapshot.stateVersion.health
  };
}
```

### `chat` payload

**`chat`** is what transcript UIs should prefer: it scopes to **`sessionKey`** and defines **`state`**.

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`ChatEvent` in **`ProtocolSchemas`**).

```typescript
// event: 'chat'  (ChatEvent)
{
  runId: string;                         // Assistant run id
  sessionKey: string;                    // Session this turn belongs to
  seq: number;                           // Ordering within the run
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;                    // Schema: TAny — [open shapes](./gateway-open-payload-shapes.md#chat-message)
  errorMessage?: string;                 // When state is error / aborted with message
  usage?: unknown;                      // Token / billing — [open shapes](./gateway-open-payload-shapes.md#chat-usage)
  stopReason?: string;                  // Model stop reason when present
}
```

[message](./gateway-schema-chat-message.md) | [usage](./gateway-schema-chat-usage.md)

### `agent` payload

**No `sessionKey`.** **`data`** is **deliberately untyped** (`Record<string, unknown>`) so model providers (and the gateway’s **`stream`** multiplexing) can define their own structure—**shape differs by provider** (and often by **`stream`** / version).

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`AgentEvent` in **`ProtocolSchemas`**).

```typescript
// event: 'agent'  (AgentEvent)
{
  runId: string;                         // Agent run id
  seq: number;                           // Chunk order for this run
  stream: string;                        // Logical substream name
  ts: number;                            // Chunk timestamp (Unix ms)
  data: {
    [key: string]: unknown;              // Provider/stream-specific
  };
}
```

[data](./gateway-schema-agent-data.md)

### `connect.challenge` payload

From [Gateway protocol](https://docs.openclaw.ai/gateway/protocol) (pre-`connect`).

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`connect.challenge` event).

```typescript
// event: 'connect.challenge'
{
  nonce: string;                         // Sign and echo on connect.device
  ts: number;                            // Server time (Unix ms)
}
```

### `tick` / `shutdown` payloads

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`TickEvent` in **`ProtocolSchemas`**).

```typescript
// event: 'tick'  (TickEvent)
{
  ts: number;                            // Server timestamp (Unix ms)
}
```

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`ShutdownEvent` in **`ProtocolSchemas`**).

```typescript
// event: 'shutdown'  (ShutdownEvent)
{
  reason: string;                        // Why the gateway is stopping
  restartExpectedMs?: number;           // Hint when a restart is planned
}
```

### Device pair payloads

Exact **`event`** strings are whatever the gateway lists in **`features.events`** (often device-pair related names). Shapes:

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`DevicePairRequestedEvent` in **`ProtocolSchemas`**).

```typescript
// event: device pair requested  (DevicePairRequestedEvent)
{
  requestId: string;
  deviceId: string;
  publicKey: string;
  displayName?: string;
  platform?: string;
  deviceFamily?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  silent?: boolean;
  isRepair?: boolean;
  ts: number;
}
```

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`DevicePairResolvedEvent` in **`ProtocolSchemas`**).

```typescript
// event: device pair resolved  (DevicePairResolvedEvent)
{
  requestId: string;
  deviceId: string;
  decision: string;                     // approve | reject | … (gateway-defined)
  ts: number;
}
```

### `node.invoke.request` payload

**Source:** [OpenClaw gateway protocol](https://docs.openclaw.ai/gateway/protocol) (`NodeInvokeRequestEvent` in **`ProtocolSchemas`**).

```typescript
// event: node invoke toward operator  (NodeInvokeRequestEvent)
{
  id: string;                            // Invoke request id
  nodeId: string;
  command: string;
  paramsJSON?: string;                  // JSON string of params when set
  timeoutMs?: number;
  idempotencyKey?: string;
}
```

### Exec approval broadcast

[Gateway protocol](https://docs.openclaw.ai/gateway/protocol): **`exec.approval.requested`**. There is no separate **`ProtocolSchemas.*Event`** entry for it in **`openclaw@2026.3.13`**; the RPC shape **`exec.approval.request`** is **`ExecApprovalRequestParams`** (large struct including optional **`systemRunPlan`**, **`commandArgv`**, **`sessionKey`**, …). Treat the **event** payload as the same information the gateway uses for that request, but validate against your gateway version — [open shapes](./gateway-open-payload-shapes.md#exec-approval-requested-payload).

### `presence`, `health`, `heartbeat`, and other events

Companion: [presence / health / heartbeat](./gateway-open-payload-shapes.md#presence-health-heartbeat-events).

- **`snapshot.health`** in **`hello-ok`** is **`TAny`** in TypeBox — no fixed JSON schema.
- **`presence`** / **`health`** / **`heartbeat`** (and similar) are **not** separate named event payload types on **`ProtocolSchemas`** in this package build: the wire payload is **`unknown`** unless you derive it from server source or capture samples.
- For **presence-like** rows, the **`hello-ok.snapshot.presence[]`** element shape above is the typed **`PresenceEntry`** model.

### `ChatEvent.message` and `chat.history` rows

**`ChatEvent.message`** is **`unknown`** in the schema — [open shapes](./gateway-open-payload-shapes.md#chat-message). **`chat.history`** success **`payload`** is not expressed as a single exported **`ProtocolSchemas`** row in the plugin SDK typings—expect a session transcript structure (e.g. messages array) defined in the full gateway build — [open shapes](./gateway-open-payload-shapes.md#chat-history-payload). Inspect **`features.methods`** and your gateway version’s types or JSON Schema if you need exact transcript fields.

## References

| Resource | Use |
| -------- | --- |
| [Gateway protocol](https://docs.openclaw.ai/gateway/protocol) | Handshake, **`connect.challenge`**, exec approvals, device auth. |
| [TypeBox / protocol](https://docs.openclaw.ai/concepts/typebox) | Where schemas live; **`pnpm protocol:gen`**. |
| **`openclaw` npm package** | **`dist/plugin-sdk/gateway/protocol/schema/protocol-schemas.d.ts`**. |
| [Documentation index](https://docs.openclaw.ai/llms.txt) | All published OpenClaw docs. |
| [Gateway open payload shapes](./gateway-open-payload-shapes.md) | **`unknown` / `TAny`** fields; [OpenClaw provider index](./gateway-open-payload-shapes.md#openclaw-provider-index); companion schema pages. |

## Technical gotchas

- **`params`** on **`req`** is optional in **`RequestFrame`**; **`connect`** still supplies **`params`** in normal clients.
- **`ok: true`** responses may omit **`payload`** for void methods; **`ok: false`** supplies **`error`**.
- **`stateVersion`** on **`event`** mirrors **`snapshot.stateVersion`** (`presence` / `health` counters).
- **`ChatEvent`** requires **`runId`**, **`sessionKey`**, and **`seq`** in TypeBox; if you see looser traffic, the server may predate stricter validation—still prefer the schema for new clients.
