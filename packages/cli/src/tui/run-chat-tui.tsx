import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout, render } from 'ink'
import { createTheWorldClient, type MessageDto } from '@theworld/client-sdk'
import type { CliContext } from '../args.js'
import { parseChatArgs } from '../chat-args.js'
import { resolveChatSessionId } from '../chat-session-resolve.js'
import { createTuiTranscriptStreamSink, runChatStreamWithSink } from '../chat-stream-sink.js'
import { formatCliError } from '../errors.js'
import { println } from '../io.js'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runSlashCommand } from '../slash-chat.js'
import { getSessionAlias, resolveSessionRef } from '../session-alias.js'
import { hostLabelFromBaseUrl, shortSessionIdLabel } from '../chat-status.js'
import { S, T, colorEnabled, ink, motionEnabled } from '../style.js'
import type { TuiRunEvent } from '../chat-stream-sink.js'
import { nextTuiBlockId, type TuiTranscriptBlock } from './tui-transcript-model.js'
import { completeSlashLine } from '../slash-complete.js'
import {
  CHAT_TUI_DRAFT_CURSORS,
  CHAT_TUI_STREAM_CURSORS,
  CHAT_TUI_THINK_FRAMES,
} from './chat-tui-art.js'
import { ChatTuiHeader } from './chat-tui-header.js'
import { ChatTuiHomeShell } from './chat-tui-home-shell.js'
import { ChatTuiInputBar } from './chat-tui-inputbar.js'
import { ChatTuiSidebar } from './chat-tui-sidebar.js'
import { ChatTuiTranscript } from './chat-tui-transcript.js'
import { ChatTuiStatusBar, type ChatTuiContextStats } from './chat-tui-statusbar.js'
import type { TuiRunPhase } from './tui-run-phase.js'
import { loadTuiFileConfig } from '../tui-config.js'
import { computeTranscriptBlockBudget } from './tui-transcript-viewport.js'
import { TUI_SIDEBAR_MIN_COLS, TUI_SIDEBAR_WIDTH_COLS } from './tui-layout-constants.js'
import { ChatTuiSplash } from './chat-tui-splash.js'
import { ChatTuiSessionPicker } from './chat-tui-session-picker.js'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function mapMessageToBlock(message: MessageDto): TuiTranscriptBlock | null {
  if (message.role === 'user') {
    return { id: nextTuiBlockId(), type: 'user', text: message.content }
  }
  if (message.role === 'assistant') {
    return { id: nextTuiBlockId(), type: 'assistant', text: message.content }
  }
  if (message.role === 'system') {
    return { id: nextTuiBlockId(), type: 'system_hint', text: message.content }
  }
  if (message.role === 'tool') {
    return { id: nextTuiBlockId(), type: 'note', text: message.content }
  }
  return null
}

function readCliVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../../../package.json')
    const raw = readFileSync(pkgPath, 'utf8')
    const v = JSON.parse(raw) as { version?: string }
    return v.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

type ChatTuiAppProps = {
  ctx: CliContext
  sessionId: string
  initialText?: string
}

function ChatTuiRoot(props: ChatTuiAppProps): React.ReactElement {
  const skipSplash =
    process.env.THEWORLD_TUI_SPLASH?.trim() === '0' || Boolean(props.initialText?.trim())
  const [showApp, setShowApp] = useState(skipSplash)
  const onSplashComplete = useCallback(() => {
    setShowApp(true)
  }, [])
  if (!showApp) {
    return <ChatTuiSplash onComplete={onSplashComplete} />
  }
  return <ChatTuiApp {...props} />
}

type InputMode = 'idle' | 'busy' | 'blocked'

function ChatTuiApp({ ctx, sessionId: initialSession, initialText }: ChatTuiAppProps): React.ReactElement {
  const { stdout } = useStdout()
  const cols = stdout.columns ?? 80
  const rows = stdout.rows ?? 24
  const narrow = cols < 56
  const tuiFile = useMemo(() => loadTuiFileConfig(), [])
  const wideLayout = useMemo(
    () => cols >= TUI_SIDEBAR_MIN_COLS && tuiFile.showSidebar !== false,
    [cols, tuiFile],
  )
  const workspaceLabel = basename(process.cwd())

  const { exit } = useApp()
  const [sessionId, setSessionId] = useState(initialSession)
  const sessionRef = useRef(sessionId)
  useEffect(() => {
    sessionRef.current = sessionId
  }, [sessionId])

  const [blocks, setBlocks] = useState<TuiTranscriptBlock[]>([])
  const blocksRef = useRef<TuiTranscriptBlock[]>([])
  useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])
  const [assistantStream, setAssistantStream] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [cursorIndex, setCursorIndex] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const runningRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [interaction, setInteraction] = useState<'none' | 'llm' | 'slash'>('none')
  const initialSentRef = useRef(false)
  const historyHydrationRef = useRef(0)
  const [thinkingActive, setThinkingActive] = useState(false)
  const [thinkTick, setThinkTick] = useState(0)
  const [runUiActive, setRunUiActive] = useState(false)
  const [streamBlink, setStreamBlink] = useState(0)
  const [draftBlink, setDraftBlink] = useState(0)
  const [agentId, setAgentId] = useState<string | undefined>(undefined)
  const [displayName, setDisplayName] = useState<string | undefined>(undefined)
  const [contextStats, setContextStats] = useState<ChatTuiContextStats | null>(null)
  const [runPhase, setRunPhase] = useState<TuiRunPhase>('idle')
  const [sessionListOpen, setSessionListOpen] = useState(false)
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setAssistantStreamTr = useCallback((t: string | null) => {
    setAssistantStream(t)
    if (t !== null) {
      setRunPhase('streaming')
    }
  }, [])

  const inputMode: InputMode = useMemo(
    () =>
      interaction === 'slash' ? 'blocked' : busy || runUiActive ? 'busy' : 'idle',
    [busy, runUiActive, interaction],
  )

  const modelEnv = useMemo(() => process.env.THEWORLD_CHAT_TUI_MODEL?.trim() ?? '', [])
  const version = readCliVersion()
  const host = hostLabelFromBaseUrl(ctx.baseUrl)
  const alias = getSessionAlias(sessionId)
  const shortId = shortSessionIdLabel(sessionId)

  const refreshSessionMeta = useCallback(
    async (sid: string): Promise<void> => {
      const client = createTheWorldClient({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
      })
      try {
        const session = await client.getSession(sid)
        setAgentId(session.agentId)
        setDisplayName(session.displayName?.trim() || undefined)
      } catch {
        setAgentId(undefined)
        setDisplayName(undefined)
      }
      try {
        const { messages } = await client.getMessages(sid, { limit: 500 })
        const chars = messages.reduce((a, m) => a + m.content.length, 0)
        setContextStats({ msgs: messages.length, chars })
      } catch {
        setContextStats(null)
      }
    },
    [ctx.apiKey, ctx.baseUrl],
  )

  const hydrateSessionHistory = useCallback(
    async (sid: string, opts?: { force?: boolean }): Promise<void> => {
      const requestId = ++historyHydrationRef.current
      const client = createTheWorldClient({
        baseUrl: ctx.baseUrl,
        apiKey: ctx.apiKey,
      })
      try {
        const { messages } = await client.getMessages(sid, { limit: 500 })
        if (historyHydrationRef.current !== requestId || sessionRef.current !== sid) return
        if (!opts?.force && (blocksRef.current.length > 0 || runningRef.current)) return
        const nextBlocks = messages
          .map(mapMessageToBlock)
          .filter((block): block is TuiTranscriptBlock => block !== null)
        setBlocks(nextBlocks)
      } catch {
        /* ignore hydration miss */
      }
    },
    [ctx.apiKey, ctx.baseUrl],
  )

  const handleSessionPick = useCallback(
    (id: string): void => {
      setSessionListOpen(false)
      if (id === sessionRef.current) return
      sessionRef.current = id
      setSessionId(id)
      setBlocks([])
      setScrollOffset(0)
      setAssistantStream(null)
      void refreshSessionMeta(id)
      void hydrateSessionHistory(id, { force: true })
    },
    [hydrateSessionHistory, refreshSessionMeta],
  )

  useEffect(() => {
    void refreshSessionMeta(sessionId)
    void hydrateSessionHistory(sessionId)
  }, [hydrateSessionHistory, refreshSessionMeta, sessionId])

  useEffect(
    () => () => {
      if (completedTimerRef.current) clearTimeout(completedTimerRef.current)
    },
    [],
  )

  const pushBlock = useCallback((b: TuiTranscriptBlock) => {
    setBlocks(prev => (prev.length > 3_000 ? [...prev.slice(-2_999), b] : [...prev, b]))
    setScrollOffset(0)
  }, [])

  const thinking = useMemo(
    () => ({
      begin: (): void => {
        setThinkingActive(true)
        setRunPhase('thinking')
      },
      end: (): void => {
        setThinkingActive(false)
      },
    }),
    [],
  )

  useEffect(() => {
    if (!thinkingActive || !motionEnabled) return
    const id = setInterval(() => {
      setThinkTick(t => t + 1)
    }, 88)
    return () => clearInterval(id)
  }, [thinkingActive])

  const streamCursorActive = runUiActive && assistantStream !== null
  useEffect(() => {
    if (!streamCursorActive || !motionEnabled) return
    const id = setInterval(() => {
      setStreamBlink(b => b + 1)
    }, 420)
    return () => clearInterval(id)
  }, [streamCursorActive])

  const draftCaretActive = !busy && !runUiActive
  useEffect(() => {
    if (!draftCaretActive || !motionEnabled) return
    const id = setInterval(() => {
      setDraftBlink(b => b + 1)
    }, 420)
    return () => clearInterval(id)
  }, [draftCaretActive])

  const runOneTurn = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        const a = getSessionAlias(sessionId)
        const verified = a && resolveSessionRef(a) === sessionId ? a : undefined
        pushBlock({
          id: nextTuiBlockId(),
          type: 'system_hint',
          text: `Resume: theworld chat --resume ${sessionId}${verified ? `  or  theworld chat --resume ${verified}` : ''}`,
        })
        exit()
        return
      }
      const isClearSlash = trimmed === '/clear' || trimmed.startsWith('/clear ')
      if (isClearSlash) {
        setBlocks([])
        setScrollOffset(0)
        setAssistantStreamTr(null)
        void refreshSessionMeta(sessionRef.current)
        return
      }
      if (trimmed.startsWith('/')) {
        runningRef.current = true
        setBusy(true)
        setInteraction('slash')
        const emit = (s: string): void => {
          for (const ln of s.split('\n')) {
            if (ln) {
              pushBlock({ id: nextTuiBlockId(), type: 'system_hint', text: ln })
            }
          }
        }
        try {
          const slash = await runSlashCommand(ctx, sessionRef.current, trimmed, emit)
          if (slash.kind === 'exit') {
            exit()
            return
          }
          if (slash.kind === 'new_session') {
            setBlocks([])
            setScrollOffset(0)
            sessionRef.current = slash.sessionId
            setSessionId(slash.sessionId)
          }
        } finally {
          runningRef.current = false
          setBusy(false)
          setInteraction('none')
          void refreshSessionMeta(sessionRef.current)
        }
        return
      }

      setRunPhase('idle')
      pushBlock({ id: nextTuiBlockId(), type: 'user', text: trimmed })
      setScrollOffset(0)
      runningRef.current = true
      setBusy(true)
      setInteraction('llm')
      setRunUiActive(true)
      setAssistantStreamTr(null)

      const onRunEvent = (e: TuiRunEvent): void => {
        if (e.kind === 'run_start') {
          return
        }
        if (e.kind === 'run_end' && e.outcome === 'ok') {
          setRunPhase('completed')
          if (completedTimerRef.current) clearTimeout(completedTimerRef.current)
          completedTimerRef.current = setTimeout(() => {
            setRunPhase('idle')
            completedTimerRef.current = null
          }, 450)
          return
        }
        if (e.kind === 'run_failed') {
          setRunPhase('failed')
        }
      }

      const sink = createTuiTranscriptStreamSink({
        setAssistantStream: setAssistantStreamTr,
        pushBlock,
        onRunEvent,
      })
      try {
        await runChatStreamWithSink(ctx, sessionRef.current, trimmed, sink, thinking)
      } catch (e: unknown) {
        setRunPhase('failed')
        pushBlock({
          id: nextTuiBlockId(),
          type: 'error',
          message: formatCliError(e),
          tip: 'theworld inspect health',
        })
      } finally {
        runningRef.current = false
        setBusy(false)
        setInteraction('none')
        setRunUiActive(false)
        setAssistantStreamTr(null)
        void refreshSessionMeta(sessionRef.current)
      }
    },
    [ctx, exit, pushBlock, refreshSessionMeta, setAssistantStreamTr, sessionId, thinking],
  )

  useInput(
    (input, key) => {
    if (runningRef.current) return
    if (key.ctrl && (input === 'l' || input === 'L' || (input.length === 1 && input.charCodeAt(0) === 12))) {
      setSessionListOpen(true)
      return
    }
    if (key.return) {
      const t = draft
      setDraft('')
      setCursorIndex(0)
      void runOneTurn(t)
      return
    }
    if (key.tab && draft.trimStart().startsWith('/')) {
      const [hits] = completeSlashLine(draft)
      if (hits[0]) {
        setDraft(hits[0])
        setCursorIndex(hits[0].length)
      }
      return
    }
    if (key.upArrow) {
      setScrollOffset(value => value + 3)
      return
    }
    if (key.downArrow) {
      setScrollOffset(value => Math.max(0, value - 3))
      return
    }
    if (key.leftArrow) {
      setCursorIndex(value => Math.max(0, value - 1))
      return
    }
    if (key.rightArrow) {
      setCursorIndex(value => Math.min(draft.length, value + 1))
      return
    }
    if (key.backspace) {
      if (cursorIndex === 0) return
      setDraft(value => value.slice(0, cursorIndex - 1) + value.slice(cursorIndex))
      setCursorIndex(value => Math.max(0, value - 1))
      return
    }
    if (key.delete) {
      setDraft(value => value.slice(0, cursorIndex) + value.slice(cursorIndex + 1))
      return
    }
    if (input && !key.ctrl && !key.meta) {
      setDraft(value => value.slice(0, cursorIndex) + input + value.slice(cursorIndex))
      setCursorIndex(value => value + input.length)
    }
  },
    { isActive: !sessionListOpen },
  )

  useEffect(() => {
    if (!initialText?.trim() || initialSentRef.current) return
    initialSentRef.current = true
    void runOneTurn(initialText)
  }, [initialText, runOneTurn])

  const thinkGlyph = motionEnabled
    ? CHAT_TUI_THINK_FRAMES[thinkTick % CHAT_TUI_THINK_FRAMES.length]
    : '*'
  const streamCursor =
    motionEnabled && runUiActive && assistantStream !== null
      ? CHAT_TUI_STREAM_CURSORS[streamBlink % CHAT_TUI_STREAM_CURSORS.length]
      : ''
  const draftCaret =
    motionEnabled && draftCaretActive ? CHAT_TUI_DRAFT_CURSORS[draftBlink % CHAT_TUI_DRAFT_CURSORS.length] : colorEnabled ? '|' : ''

  const showHome =
    blocks.length === 0 &&
    assistantStream === null &&
    !runUiActive &&
    !initialText?.trim()

  const transcriptBudget = useMemo(
    () => computeTranscriptBlockBudget(rows, { reservedRows: showHome ? 12 : wideLayout ? 13 : 15 }),
    [rows, showHome, wideLayout],
  )

  const { visibleBlocks, hiddenBeforeCount, hiddenAfterCount } = useMemo(() => {
    if (blocks.length <= transcriptBudget) {
      return { visibleBlocks: blocks, hiddenBeforeCount: 0, hiddenAfterCount: 0 }
    }
    const maxOffset = Math.max(0, blocks.length - transcriptBudget)
    const safeOffset = clamp(scrollOffset, 0, maxOffset)
    const start = Math.max(0, blocks.length - transcriptBudget - safeOffset)
    const end = Math.min(blocks.length, start + transcriptBudget)
    return {
      visibleBlocks: blocks.slice(start, end),
      hiddenBeforeCount: start,
      hiddenAfterCount: blocks.length - end,
    }
  }, [blocks, scrollOffset, transcriptBudget])

  if (sessionListOpen) {
    return (
      <ChatTuiSessionPicker
        ctx={ctx}
        currentSessionId={sessionId}
        onPick={handleSessionPick}
        onClose={() => {
          setSessionListOpen(false)
        }}
      />
    )
  }

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <ChatTuiHeader
        columns={cols}
        workspaceLabel={workspaceLabel}
        displayName={displayName}
        alias={alias}
        shortId={shortId}
        runPhase={runPhase}
        showHome={showHome}
      />
      <Box flexDirection="column" flexGrow={1} minHeight={2} overflow="hidden">
        {showHome ? (
          <ChatTuiHomeShell
            ctx={ctx}
            currentSessionId={sessionId}
            columns={cols}
            narrow={narrow}
          />
        ) : (
          <Box flexDirection="row" flexGrow={1} overflow="hidden">
            <Box
              flexDirection="column"
              flexGrow={1}
              minHeight={2}
              overflow="hidden"
              borderStyle="round"
              borderColor={ink.panelBorder}
              paddingX={1}
              marginRight={wideLayout ? 1 : 0}
            >
              <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
                <Text bold color={ink.accent}>
                  Conversation
                </Text>
                <Text dimColor>
                  {scrollOffset > 0 ? 'manual scroll' : 'following latest'}
                </Text>
              </Box>
              <Box flexDirection="column" flexGrow={1} overflow="hidden">
                <ChatTuiTranscript
                  blocks={visibleBlocks}
                  assistantStream={assistantStream}
                  streamCursor={streamCursor}
                  hiddenBeforeCount={hiddenBeforeCount}
                  hiddenAfterCount={hiddenAfterCount}
                />
              </Box>
            </Box>
            {wideLayout ? (
              <ChatTuiSidebar
                width={TUI_SIDEBAR_WIDTH_COLS}
                runPhase={runPhase}
                host={host}
                modelEnv={modelEnv}
                agentId={agentId}
                context={contextStats}
                displayName={displayName}
                alias={alias}
                shortId={shortId}
              />
            ) : null}
          </Box>
        )}
      </Box>
      <Box flexDirection="column" height={1} justifyContent="center" marginTop={0}>
        {thinkingActive ? (
          <Box flexDirection="row">
            <Text color={ink.thinkAccent}>{`${thinkGlyph} `}</Text>
            <Text dimColor>working…</Text>
          </Box>
        ) : (
          <Text> </Text>
        )}
      </Box>
      <ChatTuiInputBar
        columns={cols}
        draft={inputMode === 'blocked' ? '…' : draft}
        cursorIndex={cursorIndex}
        caret={draftCaret}
        inputMode={inputMode}
        showHome={showHome}
      />
      <ChatTuiStatusBar
        columns={cols}
        narrow={narrow}
        runPhase={runPhase}
        modelEnv={modelEnv}
        agentId={agentId}
        context={contextStats}
        host={host}
        sessionAlias={alias}
        sessionShort={shortId}
        workspacePath={process.cwd()}
        version={version}
      />
    </Box>
  )
}

export async function runChatTuiSession(ctx: CliContext, lineArgs: string[]): Promise<void> {
  const parsed = parseChatArgs(lineArgs)
  let sessionId: string
  try {
    sessionId = await resolveChatSessionId(ctx, parsed)
  } catch (error: unknown) {
    const message = formatCliError(error)
    const explicitId = parsed.sessionId
    if (explicitId) {
      println(`${S.red}Session not found or unreachable: ${message}${S.reset}`)
      println(`${T.dim}List ids: theworld sessions list${S.reset}`)
    } else {
      println(`${S.red}Cannot connect to server: ${message}${S.reset}`)
      println(
        `${T.dim}Start the server: pnpm dev:server  ·  check URL with theworld inspect health${S.reset}`,
      )
    }
    process.exit(1)
    return
  }

  const { waitUntilExit } = render(
    <ChatTuiRoot ctx={ctx} sessionId={sessionId} initialText={parsed.initialText} />,
    { exitOnCtrlC: true },
  )
  await waitUntilExit()
}
