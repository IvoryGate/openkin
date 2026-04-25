import { createRunError, type Message, type ToolCall } from '@theworld/shared-contracts'
import { Agent, fetch as undiciFetch, type Dispatcher } from 'undici'
import { describeFetchError } from './fetch-error.js'
import { readEnv } from './env.js'
import type { LLMGenerateRequest, LLMGenerateResponse, LLMProvider } from './llm.js'
import type { ToolDefinition } from './tool-runtime.js'

/** Explicit configuration; callers read env in app/demo — not in core (exec-plan 008). */
export interface OpenAiCompatibleChatProviderConfig {
  apiKey: string
  /** e.g. `https://api.openai.com/v1` or any OpenAI-compatible root including `/v1`. */
  baseUrl: string
  model: string
  fetch?: typeof fetch
  /** Optional client-side timeout for the HTTP request. */
  timeoutMs?: number
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

/**
 * Node's global `fetch` may prefer IPv6; some OpenAI-compatible hosts reset TLS on that path.
 * Undici with `family: 4` matches browsers/curl that work reliably (e.g. api.longcat.chat).
 *
 * `THEWORLD_LLM_CONNECT_FAMILY`:
 * `4` (default) | `6` | `0` / `auto` (use global fetch, dual-stack).
 */
function resolveDefaultFetch(override?: typeof fetch): typeof fetch {
  if (override) return override
  const mode = readEnv('THEWORLD_LLM_CONNECT_FAMILY') ?? '4'
  if (mode === '0' || mode === 'auto') {
    return globalThis.fetch.bind(globalThis)
  }
  const family = mode === '6' ? 6 : 4
  const agent = new Agent({ connect: { family } })
  // Cast: undici RequestInit/Response vs DOM types differ slightly; runtime is compatible.
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    undiciFetch(
      input as never,
      {
        ...init,
        dispatcher: (init as { dispatcher?: Dispatcher } | undefined)?.dispatcher ?? agent,
      } as Parameters<typeof undiciFetch>[1],
    )) as typeof fetch
}

/** Tool messages encode `tool_call_id` on the first line; remainder is JSON output (see `toolResultToMessage`). */
function toolMessageToOpenAi(message: Message): { role: 'tool'; tool_call_id: string; content: string } {
  const text = message.content
    .filter((p): p is Extract<Message['content'][number], { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('')
  const nl = text.indexOf('\n')
  if (nl === -1) {
    return {
      role: 'tool',
      tool_call_id: message.name ?? 'unknown',
      content: text,
    }
  }
  return {
    role: 'tool',
    tool_call_id: text.slice(0, nl),
    content: text.slice(nl + 1),
  }
}

type OpenAiContentPart = Record<string, unknown>

/**
 * 095: map `MessagePart[]` to OpenAI `content` (string, or for vision, an array of text / image_url parts).
 */
function partsToOpenAiUserContent(
  message: Message,
): { kind: 'string'; value: string } | { kind: 'parts'; value: OpenAiContentPart[] } {
  const parts: OpenAiContentPart[] = []
  for (const p of message.content) {
    if (p.type === 'text') {
      if (p.text.length > 0) parts.push({ type: 'text', text: p.text })
    } else if (p.type === 'json') {
      parts.push({ type: 'text', text: JSON.stringify(p.value) })
    } else if (p.type === 'image') {
      const detail = p.detail ?? 'auto'
      parts.push({
        type: 'image_url',
        image_url: { url: p.url, detail },
      })
    } else if (p.type === 'file_ref') {
      const label = p.name && p.name.length > 0 ? p.name : 'file'
      const line = p.mimeType
        ? `[Attached file: ${label}] ref=${p.ref} mimeType=${p.mimeType}`
        : `[Attached file: ${label}] ref=${p.ref}`
      parts.push({ type: 'text', text: line })
    }
  }
  if (parts.length === 0) {
    return { kind: 'string', value: '' }
  }
  if (parts.length === 1 && parts[0] && parts[0].type === 'text' && typeof parts[0].text === 'string') {
    return { kind: 'string', value: String(parts[0].text) }
  }
  return { kind: 'parts', value: parts }
}

function systemMessageToOpenAi(message: Message): Record<string, unknown> {
  const mapped = partsToOpenAiUserContent({ ...message, role: 'user' })
  const base: Record<string, unknown> = { role: 'system' }
  if (mapped.kind === 'string') {
    base.content = mapped.value.length > 0 ? mapped.value : null
  } else {
    base.content = mapped.value
  }
  return base
}

function userMessageToOpenAi(message: Message): Record<string, unknown> {
  const mapped = partsToOpenAiUserContent(message)
  const base: Record<string, unknown> = { role: 'user' }
  if (mapped.kind === 'string') {
    base.content = mapped.value.length > 0 ? mapped.value : null
  } else {
    base.content = mapped.value
  }
  if (message.name) {
    base.name = message.name
  }
  return base
}

function messageToOpenAi(message: Message): Record<string, unknown> {
  if (message.role === 'tool') {
    return toolMessageToOpenAi(message)
  }

  // Assistant messages that carry tool-call decisions are stored with json parts
  // (each part value = { tool_call_id, name, arguments }).
  // Convert them to the OpenAI `tool_calls` array format instead of stringifying.
  if (message.role === 'assistant') {
    const jsonParts = message.content.filter((p) => p.type === 'json')
    if (jsonParts.length > 0) {
      const toolCalls = jsonParts.map((p) => {
        const v = (p as Extract<Message['content'][number], { type: 'json' }>).value as {
          tool_call_id?: string
          name?: string
          arguments?: unknown
        }
        return {
          id: v.tool_call_id ?? `tc-${Date.now()}`,
          type: 'function',
          function: {
            name: v.name ?? '',
            arguments: typeof v.arguments === 'string' ? v.arguments : JSON.stringify(v.arguments ?? {}),
          },
        }
      })
      return { role: 'assistant', content: null, tool_calls: toolCalls }
    }
  }

  if (message.role === 'system') {
    return systemMessageToOpenAi(message)
  }
  if (message.role === 'user') {
    return userMessageToOpenAi(message)
  }

  const textParts = message.content
    .filter((p): p is Extract<Message['content'][number], { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
  const content = textParts.join('\n')
  const base: Record<string, unknown> = {
    role: message.role,
    content: content.length > 0 ? content : null,
  }
  if (message.name) {
    base.name = message.name
  }
  return base
}

function toolsToOpenAi(tools: ToolDefinition[]): unknown[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema ?? { type: 'object', properties: {} },
    },
  }))
}

function mapHttpError(status: number, bodyText: string): ReturnType<typeof createRunError> {
  const hint = bodyText.slice(0, 500)
  if (status === 429) {
    return createRunError('LLM_RATE_LIMIT', `Rate limited: ${hint}`, 'llm', { httpStatus: status }, true)
  }
  if (status === 408) {
    return createRunError('LLM_TIMEOUT', `Timeout: ${hint}`, 'llm', { httpStatus: status })
  }
  if (status >= 500) {
    return createRunError('LLM_UNAVAILABLE', `Server error (${status}): ${hint}`, 'llm', { httpStatus: status }, true)
  }
  return createRunError('LLM_INVALID_RESPONSE', `HTTP ${status}: ${hint}`, 'llm', { httpStatus: status })
}

/**
 * OpenAI-compatible `POST .../chat/completions` provider.
 *
 * Streaming strategy:
 * - When `onTextDelta` is provided, use `stream: true` for true token-level streaming.
 * - All SSE deltas are accumulated before parsing tool calls (so XML-in-content like
 *   LongCat's <longcat_tool_call> is reassembled correctly before regex matching).
 * - `onTextDelta` is called for each text delta as it arrives for real-time display.
 * - When `onTextDelta` is not provided, use `stream: false` (plain JSON response).
 */
export class OpenAiCompatibleChatProvider implements LLMProvider {
  private readonly config: OpenAiCompatibleChatProviderConfig
  private readonly url: string
  private readonly fetchFn: typeof fetch

  constructor(config: OpenAiCompatibleChatProviderConfig) {
    this.config = config
    this.url = `${normalizeBaseUrl(config.baseUrl)}/chat/completions`
    this.fetchFn = resolveDefaultFetch(config.fetch)
  }

  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const useStream = typeof request.onTextDelta === 'function'

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages.map(messageToOpenAi),
      stream: useStream,
    }
    if (request.tools.length > 0) {
      body.tools = toolsToOpenAi(request.tools)
      body.tool_choice = 'auto'
    }

    const controller = new AbortController()
    const timer =
      this.config.timeoutMs != null && this.config.timeoutMs > 0
        ? setTimeout(() => controller.abort(), this.config.timeoutMs)
        : undefined

    let res: Response
    try {
      res = await this.fetchFn(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (e) {
      if (timer) clearTimeout(timer)
      if (e instanceof Error && e.name === 'AbortError') {
        throw createRunError('LLM_TIMEOUT', 'LLM request aborted (timeout)', 'llm', { url: this.url })
      }
      const detail = describeFetchError(e)
      throw createRunError(
        'LLM_UNAVAILABLE',
        detail || 'LLM request failed',
        'llm',
        { url: this.url },
        true,
      )
    }

    if (!res.ok) {
      if (timer) clearTimeout(timer)
      const errText = await res.text()
      throw mapHttpError(res.status, errText)
    }

    if (useStream) {
      try {
        return await parseStreamingResponse(res, request.onTextDelta!)
      } finally {
        if (timer) clearTimeout(timer)
      }
    }

    // Non-streaming path
    const rawText = await res.text()
    if (timer) clearTimeout(timer)

    let json: unknown
    try {
      json = JSON.parse(rawText)
    } catch {
      throw createRunError('LLM_INVALID_RESPONSE', 'Non-JSON response from LLM', 'llm', { snippet: rawText.slice(0, 200) })
    }

    return parseChatCompletion(json)
  }
}

// ─── Streaming SSE parser ───────────────────────────────────────────────────

/**
 * Parse an OpenAI streaming chat completion response.
 *
 * Key design: accumulate ALL text deltas into `fullText` before attempting
 * tool-call parsing. This ensures XML-embedded tool calls (like LongCat's
 * <longcat_tool_call>) are reassembled from fragments before regex matching.
 * `onTextDelta` is fired per-chunk for real-time CLI display.
 *
 * Standard OpenAI tool_calls (delta.tool_calls[]) are also accumulated per-index.
 */
async function parseStreamingResponse(
  res: Response,
  onTextDelta: (delta: string) => void,
): Promise<LLMGenerateResponse> {
  const decoder = new TextDecoder()
  let carry = ''

  let fullText = ''
  let finishReason = 'stop'

  // Standard OpenAI tool call accumulation (indexed by tool_call.index)
  const toolCallMap = new Map<number, { id: string; name: string; argsRaw: string }>()

  function processLine(line: string): void {
    if (!line.startsWith('data:')) return
    // Support both "data: " (standard SSE) and "data:" (no space, e.g. LongCat)
    const data = line.slice(5).trim()
    if (data === '[DONE]') return

    let chunk: {
      choices?: Array<{
        delta?: {
          content?: string | null
          tool_calls?: Array<{
            index?: number; id?: string; type?: string
            function?: { name?: string; arguments?: string }
          }>
        }
        finish_reason?: string | null
      }>
    }
    try {
      chunk = JSON.parse(data)
    } catch {
      return
    }

    const choice = chunk.choices?.[0]
    if (!choice) return
    if (choice.finish_reason) finishReason = choice.finish_reason

    const delta = choice.delta
    if (!delta) return

    // Text delta — fire callback immediately for real-time display,
    // AND accumulate into fullText for post-stream tool-call parsing.
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      fullText += delta.content
      onTextDelta(delta.content)
    }

    // Standard tool_call delta accumulation
    if (delta.tool_calls?.length) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0
        if (!toolCallMap.has(idx)) {
          toolCallMap.set(idx, { id: '', name: '', argsRaw: '' })
        }
        const entry = toolCallMap.get(idx)!
        if (tc.id) entry.id = tc.id
        if (tc.function?.name) entry.name += tc.function.name
        if (tc.function?.arguments) entry.argsRaw += tc.function.arguments
      }
    }
  }

  // Consume body as async stream
  const body = res.body
  if (body && typeof (body as unknown as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function') {
    for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
      const text = carry + decoder.decode(chunk, { stream: true })
      const lines = text.split('\n')
      carry = lines.pop() ?? ''
      for (const line of lines) processLine(line)
    }
  } else {
    const text = await res.text()
    for (const line of text.split('\n')) processLine(line)
  }

  // Flush any trailing bytes
  const tail = carry + decoder.decode()
  for (const line of tail.split('\n')) processLine(line)

  // ── 1. Standard OpenAI tool_calls (accumulated via delta.tool_calls) ───────
  if (toolCallMap.size > 0) {
    const toolCalls: ToolCall[] = []
    for (const idx of [...toolCallMap.keys()].sort((a, b) => a - b)) {
      const entry = toolCallMap.get(idx)!
      if (!entry.name) continue
      let input: Record<string, unknown> = {}
      if (entry.argsRaw) {
        try {
          const parsed = JSON.parse(entry.argsRaw) as unknown
          input = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>) : {}
        } catch {
          input = { raw: entry.argsRaw }
        }
      }
      toolCalls.push({ id: entry.id || `tc-stream-${idx}`, name: entry.name, input })
    }
    if (toolCalls.length > 0) return { toolCalls, finishReason: 'tool_calls' }
  }

  // ── 2. Longcat XML tool calls reassembled from accumulated text ─────────────
  // fullText now contains the complete content string even though it arrived
  // in fragments — safe to run regex matching here.
  if (fullText.includes('<longcat_tool_call>')) {
    const toolCalls = parseLongcatToolCalls(fullText)
    if (toolCalls) return { toolCalls, finishReason: 'tool_calls' }
  }

  // ── 3. Plain text reply ─────────────────────────────────────────────────────
  return {
    message: { role: 'assistant', content: [{ type: 'text', text: fullText }] },
    finishReason,
  }
}

/** Parse longcat-style XML tool calls embedded in content text.
 *
 * Some models (e.g. longcat) emit tool calls as XML inside the `content` field:
 *   <longcat_tool_call>{"name":"foo","arguments":{...}}</longcat_tool_call>
 * instead of the standard OpenAI `tool_calls` array.
 */
function parseLongcatToolCalls(text: string): ToolCall[] | null {
  // Match one or more <longcat_tool_call>...</longcat_tool_call> blocks
  const TAG_RE = /<longcat_tool_call>([\s\S]*?)<\/longcat_tool_call>/g
  const toolCalls: ToolCall[] = []
  let counter = 0

  for (const match of text.matchAll(TAG_RE)) {
    const raw = match[1]?.trim() ?? ''
    try {
      const parsed = JSON.parse(raw) as { name?: string; arguments?: unknown }
      const name = parsed.name
      if (typeof name !== 'string' || !name) continue
      const argsRaw = parsed.arguments
      let input: Record<string, unknown> = {}
      if (argsRaw && typeof argsRaw === 'object' && !Array.isArray(argsRaw)) {
        input = argsRaw as Record<string, unknown>
      } else if (typeof argsRaw === 'string') {
        try {
          const p = JSON.parse(argsRaw) as unknown
          input = typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
        } catch {
          input = { raw: argsRaw }
        }
      }
      counter += 1
      toolCalls.push({ id: `longcat-tc-${Date.now()}-${counter}`, name, input })
    } catch {
      // Malformed JSON inside tag — skip
    }
  }

  return toolCalls.length > 0 ? toolCalls : null
}

function parseChatCompletion(json: unknown): LLMGenerateResponse {
  if (!json || typeof json !== 'object') {
    throw createRunError('LLM_INVALID_RESPONSE', 'Empty LLM response', 'llm')
  }
  const root = json as {
    choices?: Array<{
      message?: {
        role?: string
        content?: string | null
        tool_calls?: Array<{
          id?: string
          type?: string
          function?: { name?: string; arguments?: string }
        }>
      }
      finish_reason?: string
    }>
  }
  const choice = root.choices?.[0]
  const msg = choice?.message
  if (!msg) {
    throw createRunError('LLM_INVALID_RESPONSE', 'Missing choices[0].message', 'llm', { json })
  }

  const finishReason = choice?.finish_reason ?? 'stop'

  // ── 1. Standard OpenAI tool_calls ─────────────────────────────────────────
  if (msg.tool_calls?.length) {
    const toolCalls: ToolCall[] = []
    for (const tc of msg.tool_calls) {
      const name = tc.function?.name
      if (!name || !tc.id) continue
      let input: Record<string, unknown> = {}
      const argStr = tc.function?.arguments
      if (argStr) {
        try {
          const parsed = JSON.parse(argStr) as unknown
          input = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
        } catch {
          input = { raw: argStr }
        }
      }
      toolCalls.push({ id: tc.id, name, input })
    }
    if (toolCalls.length === 0) {
      throw createRunError('LLM_INVALID_RESPONSE', 'tool_calls present but none parsed', 'llm')
    }
    return {
      toolCalls,
      finishReason: finishReason === 'tool_calls' ? 'tool_calls' : finishReason,
    }
  }

  const text = typeof msg.content === 'string' ? msg.content : ''

  // ── 2. Longcat XML tool call embedded in content ───────────────────────────
  if (text.includes('<longcat_tool_call>')) {
    const toolCalls = parseLongcatToolCalls(text)
    if (toolCalls) {
      return { toolCalls, finishReason: 'tool_calls' }
    }
  }

  // ── 3. Plain text reply ────────────────────────────────────────────────────
  return {
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
    },
    finishReason,
  }
}
