import { createRunError, type Message, type ToolCall } from '@openkin/shared-contracts'
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

function messageToOpenAi(message: Message): Record<string, unknown> {
  if (message.role === 'tool') {
    return toolMessageToOpenAi(message)
  }
  const textParts = message.content
    .filter((p): p is Extract<Message['content'][number], { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
  const jsonParts = message.content.filter((p) => p.type === 'json').map((p) => JSON.stringify(p.value))
  const content = [...textParts, ...jsonParts].join('\n')
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
 * OpenAI-compatible `POST .../chat/completions` provider (sync `generate` only; no token streaming).
 */
export class OpenAiCompatibleChatProvider implements LLMProvider {
  private readonly config: OpenAiCompatibleChatProviderConfig
  private readonly url: string
  private readonly fetchFn: typeof fetch

  constructor(config: OpenAiCompatibleChatProviderConfig) {
    this.config = config
    this.url = `${normalizeBaseUrl(config.baseUrl)}/chat/completions`
    this.fetchFn = config.fetch ?? globalThis.fetch
  }

  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages.map(messageToOpenAi),
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
      if (e instanceof Error && e.name === 'AbortError') {
        throw createRunError('LLM_TIMEOUT', 'LLM request aborted (timeout)', 'llm', { url: this.url })
      }
      throw createRunError(
        'LLM_UNAVAILABLE',
        e instanceof Error ? e.message : 'LLM request failed',
        'llm',
        { url: this.url },
        true,
      )
    } finally {
      if (timer) clearTimeout(timer)
    }

    const rawText = await res.text()
    if (!res.ok) {
      throw mapHttpError(res.status, rawText)
    }

    let json: unknown
    try {
      json = JSON.parse(rawText)
    } catch {
      throw createRunError('LLM_INVALID_RESPONSE', 'Non-JSON response from LLM', 'llm', { snippet: rawText.slice(0, 200) })
    }

    return parseChatCompletion(json)
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
