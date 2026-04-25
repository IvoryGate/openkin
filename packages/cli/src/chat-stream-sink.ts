import { createTheWorldClient, type StreamEvent } from '@theworld/client-sdk'
import type { CliContext } from './args.js'
import {
  nextTuiBlockId,
  summarizeToolInput,
  summarizeToolResultOutput,
  type TuiTranscriptBlock,
} from './tui/tui-transcript-model.js'
import { S, T, label } from './style.js'

/** Abstracts `streamRun` side-effects so line UI and Ink TUI can share one runner (056). */
export interface ChatStreamSink {
  onRunStart(): void
  onTextDeltaBegin(): void
  onTextDelta(delta: string): void
  onToolCalls(calls: Array<{ name: string; input: unknown }>): void
  onToolResult(name: string, output: unknown, isError: boolean): void
  onThinking(text: string): void
  onRunCompletedStreamingEnd(): void
  onRunCompletedFinalText(text: string): void
  onRunCompletedBannerEnd(): void
  onRunFailed(message: string, codeSuffix: string): void
  /** If we were mid-`text_delta`, emit a trailing newline before the failure banner. */
  flushStreamingLineBreak(): void
}

export function createLineChatStreamSink(
  println: (s: string) => void,
  writeStdout: (s: string) => void,
  opts: {
    printToolCall: (name: string, input: unknown) => void
    printToolResult: (name: string, output: unknown, isError: boolean) => void
    printThinking: (text: string) => void
  },
): ChatStreamSink {
  return {
    onRunStart() {
      println(`${T.dim}--- run start ---${S.reset}`)
    },
    onTextDeltaBegin() {
      writeStdout(`${S.bold}${T.assistant}${label('agent')}Agent${S.reset}${S.bold}: ${S.reset}`)
    },
    onTextDelta(delta) {
      writeStdout(delta)
    },
    onToolCalls(calls) {
      for (const toolCall of calls) {
        opts.printToolCall(toolCall.name, toolCall.input)
      }
    },
    onToolResult(name, output, isError) {
      opts.printToolResult(name, output, isError)
    },
    onThinking(text) {
      opts.printThinking(text)
    },
    onRunCompletedStreamingEnd() {
      writeStdout('\n')
      println(`${T.dim}--- run end ---${S.reset}`)
    },
    onRunCompletedFinalText(text) {
      println(
        `${S.bold}${T.assistant}${label('agent')}Agent${S.reset}${S.bold}: ${S.reset}${text}`,
      )
      println(`${T.dim}--- run end ---${S.reset}`)
    },
    onRunCompletedBannerEnd() {
      println(`${T.dim}--- run end ---${S.reset}`)
    },
    onRunFailed(message, codeSuffix) {
      println(`${T.danger}${label('error')}Run failed${codeSuffix}: ${message}${S.reset}`)
      println(
        `${T.dim}Tip: theworld inspect health  ·  theworld sessions messages <id>${S.reset}`,
      )
      println(`${T.dim}--- run end ---${S.reset}`)
    },
    flushStreamingLineBreak() {
      writeStdout('\n')
    },
  }
}

/** TUI shell / header consumes this (063–064). */
export type TuiRunEvent =
  | { kind: 'run_start' }
  | { kind: 'run_end'; outcome: 'ok' }
  | { kind: 'run_failed'; message: string; codeSuffix: string }

export type TuiTranscriptSinkHandlers = {
  setAssistantStream: (text: string | null) => void
  pushBlock: (block: TuiTranscriptBlock) => void
  onRunEvent: (e: TuiRunEvent) => void
}

/**
 * TUI: semantic transcript blocks, no `--- run start/end ---` in the main narrative.
 * Line mode continues to use `createLineChatStreamSink`.
 */
export function createTuiTranscriptStreamSink(h: TuiTranscriptSinkHandlers): ChatStreamSink {
  let assistantBuf = ''
  const pushAssistantIfAny = (): void => {
    if (assistantBuf.length > 0) {
      const text = assistantBuf.trimEnd()
      h.pushBlock({
        id: nextTuiBlockId(),
        type: 'assistant',
        text: text.length > 0 ? text : assistantBuf,
      })
    }
    assistantBuf = ''
    h.setAssistantStream(null)
  }

  return {
    onRunStart() {
      assistantBuf = ''
      h.setAssistantStream(null)
      h.onRunEvent({ kind: 'run_start' })
    },
    onTextDeltaBegin() {
      assistantBuf = ''
      h.setAssistantStream('')
    },
    onTextDelta(delta) {
      assistantBuf += delta
      h.setAssistantStream(assistantBuf)
    },
    onToolCalls(calls) {
      pushAssistantIfAny()
      for (const tc of calls) {
        h.pushBlock({
          id: nextTuiBlockId(),
          type: 'tool_call',
          name: tc.name,
          inputSummary: summarizeToolInput(tc.input),
        })
      }
    },
    onToolResult(name, output, isError) {
      h.pushBlock({
        id: nextTuiBlockId(),
        type: 'tool_result',
        name,
        summary: summarizeToolResultOutput(output, isError),
        ok: !isError,
      })
    },
    onThinking(text) {
      const t = text.trim()
      if (t) {
        h.pushBlock({ id: nextTuiBlockId(), type: 'note', text: t })
      }
    },
    onRunCompletedStreamingEnd() {
      pushAssistantIfAny()
      h.onRunEvent({ kind: 'run_end', outcome: 'ok' })
    },
    onRunCompletedFinalText(text) {
      const final = text.trim()
      if (final) {
        h.pushBlock({ id: nextTuiBlockId(), type: 'assistant', text: final })
      }
      assistantBuf = ''
      h.setAssistantStream(null)
      h.onRunEvent({ kind: 'run_end', outcome: 'ok' })
    },
    onRunCompletedBannerEnd() {
      pushAssistantIfAny()
      h.onRunEvent({ kind: 'run_end', outcome: 'ok' })
    },
    onRunFailed(message, codeSuffix) {
      pushAssistantIfAny()
      h.pushBlock({
        id: nextTuiBlockId(),
        type: 'error',
        message: `Run failed${codeSuffix}: ${message}`,
        codeSuffix: codeSuffix || undefined,
        tip: 'theworld inspect health  ·  theworld sessions messages <id>',
      })
      h.onRunEvent({ kind: 'run_failed', message, codeSuffix })
    },
    flushStreamingLineBreak() {
      pushAssistantIfAny()
    },
  }
}

export async function runChatStreamWithSink(
  ctx: CliContext,
  sessionId: string,
  text: string,
  sink: ChatStreamSink,
  thinking: { begin(): void; end(): void },
): Promise<{ traceId?: string }> {
  const client = createTheWorldClient({
    baseUrl: ctx.baseUrl,
    apiKey: ctx.apiKey,
  })

  let streamingAnswer = false
  let terminalSeen = false
  let traceId: string | undefined

  try {
    sink.onRunStart()
    thinking.begin()
    await client.streamRun({ sessionId, input: { text } }, (event: StreamEvent) => {
      if (traceId === undefined && event.traceId) {
        traceId = event.traceId
      }
      if (event.type === 'text_delta') {
        if (!streamingAnswer) {
          thinking.end()
          streamingAnswer = true
          sink.onTextDeltaBegin()
        }
        const payload = event.payload as { delta?: string }
        if (payload.delta) {
          sink.onTextDelta(payload.delta)
        }
        return
      }

      if (event.type === 'tool_call') {
        thinking.end()
        streamingAnswer = false
        sink.onToolCalls(event.payload as Array<{ name: string; input: unknown }>)
        thinking.begin()
        return
      }

      if (event.type === 'tool_result') {
        thinking.end()
        streamingAnswer = false
        const result = event.payload as {
          name: string
          output: unknown
          isError?: boolean
        }
        sink.onToolResult(result.name, result.output, result.isError ?? false)
        thinking.begin()
        return
      }

      if (event.type === 'message') {
        thinking.end()
        streamingAnswer = false
        const payload = event.payload as { text?: string }
        if (payload.text) {
          sink.onThinking(payload.text)
        }
        thinking.begin()
        return
      }

      if (event.type === 'run_completed') {
        terminalSeen = true
        thinking.end()
        if (streamingAnswer) {
          sink.onRunCompletedStreamingEnd()
          streamingAnswer = false
          return
        }
        const payload = event.payload as {
          output?: { content: Array<{ type: string; text?: string }> }
        }
        const finalText = (payload.output?.content ?? [])
          .filter(part => part.type === 'text')
          .map(part => part.text ?? '')
          .join('')
          .trim()
        if (finalText) {
          sink.onRunCompletedFinalText(finalText)
        } else {
          sink.onRunCompletedBannerEnd()
        }
        return
      }

      if (event.type === 'run_failed') {
        terminalSeen = true
        thinking.end()
        if (streamingAnswer) {
          sink.flushStreamingLineBreak()
          streamingAnswer = false
        }
        const payload = event.payload as {
          error?: { message?: string; code?: string }
          message?: string
        }
        const errorMessage = payload.error?.message ?? payload.message ?? 'Unknown error'
        const code = payload.error?.code ? ` [${payload.error.code}]` : ''
        sink.onRunFailed(errorMessage, code)
      }
    })
  } finally {
    thinking.end()
    if (streamingAnswer && !terminalSeen) {
      sink.flushStreamingLineBreak()
    }
  }
  return { traceId }
}
