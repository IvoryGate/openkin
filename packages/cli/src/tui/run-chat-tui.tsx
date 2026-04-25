import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout, render } from 'ink'
import { createTheWorldClient, type MessageDto } from '@theworld/client-sdk'
import { createTheWorldOperatorClient } from '@theworld/operator-client'
import type { CliContext } from '../args.js'
import { parseChatArgs } from '../chat-args.js'
import { resolveChatSessionId } from '../chat-session-resolve.js'
import { createTuiTranscriptStreamSink, runChatStreamWithSink } from '../chat-stream-sink.js'
import { formatCliError } from '../errors.js'
import { formatL4ApprovalSessionRailSuffix } from '../l4-approval-surface.js'
import { formatL4RunsSessionRailSuffix } from '../l4-background-resume.js'
import { formatL4ContextAndMemoryRailLine } from '../l4-layered-memory.js'
import { errorRecoveryExtraLines } from '../l4-onboarding.js'
import { println } from '../io.js'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runSlashCommand } from '../slash-chat.js'
import { getSessionAlias, resolveSessionRef } from '../session-alias.js'
import { hostLabelFromBaseUrl, shortSessionIdLabel } from '../chat-status.js'
import { S, T, colorEnabled, ink, motionEnabled } from '../style.js'
import { getTuiPalette } from './tui-ink-palette.js'
import { TuiThemeProvider, useTuiPalette } from './tui-theme-context.js'
import type { TuiFileConfig } from '../tui-config.js'
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
import { TUI_SIDEBAR_MIN_COLS, tuiSidebarWidthCols } from './tui-layout-constants.js'
import { ChatTuiSplash } from './chat-tui-splash.js'
import { ChatTuiSessionPicker } from './chat-tui-session-picker.js'
import { ChatTuiSettings } from './chat-tui-settings.js'
import { fetchTuiSessionList, type TuiSessionRow } from './tui-session-list.js'
import { TuiBox } from './tui-box.js'
import { TuiTextFill } from './tui-text-fill.js'
import { padStringToWidth } from './tui-pad-to-width.js'
import { tuiCursorHideWithCli, tuiCursorShowWithCli, tuiCursorHideEnabled } from './tui-cursor-visibility.js'
import { ChatTuiContextRail } from './chat-tui-context-rail.js'
import {
  countDraftLines,
  insertClamped,
  TUI_DRAFT_MAX_LINES,
} from './tui-input-draft.js'

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
  tuiFile: TuiFileConfig
}

type ChatTuiRootProps = Omit<ChatTuiAppProps, 'tuiFile'>

function ChatTuiRoot(props: ChatTuiRootProps): React.ReactElement {
  const tuiFile = useMemo(() => loadTuiFileConfig(), [])
  const palette = useMemo(() => getTuiPalette(tuiFile.theme, colorEnabled), [tuiFile.theme])
  const skipSplash =
    process.env.THEWORLD_TUI_SPLASH?.trim() === '0' || Boolean(props.initialText?.trim())
  const [showApp, setShowApp] = useState(skipSplash)
  const onSplashComplete = useCallback(() => {
    setShowApp(true)
  }, [])
  if (!showApp) {
    return (
      <TuiThemeProvider value={palette}>
        <ChatTuiSplash onComplete={onSplashComplete} />
      </TuiThemeProvider>
    )
  }
  return (
    <TuiThemeProvider value={palette}>
      <ChatTuiApp {...props} tuiFile={tuiFile} />
    </TuiThemeProvider>
  )
}

type InputMode = 'idle' | 'busy' | 'blocked'

function ChatTuiApp({ ctx, sessionId: initialSession, initialText, tuiFile }: ChatTuiAppProps): React.ReactElement {
  const p = useTuiPalette()
  const { stdout } = useStdout()
  const cols = stdout.columns ?? 80
  const rows = stdout.rows ?? 24
  const narrow = cols < 56
  const wideLayout = useMemo(
    () => cols >= TUI_SIDEBAR_MIN_COLS && tuiFile.showSidebar !== false,
    [cols, tuiFile],
  )
  const workspaceLabel = basename(process.cwd())
  const [sidebarRecent, setSidebarRecent] = useState<TuiSessionRow[] | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
  const draftRef = useRef(draft)
  const cursorRef = useRef(cursorIndex)
  draftRef.current = draft
  cursorRef.current = cursorIndex
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
  const [l4ContextHint, setL4ContextHint] = useState<string | null>(null)
  const [runPhase, setRunPhase] = useState<TuiRunPhase>('idle')
  const [sessionListOpen, setSessionListOpen] = useState(false)
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void (async () => {
      const r = await fetchTuiSessionList(ctx, { limit: 20 })
      if (r.ok) {
        setSidebarRecent(r.rows)
      } else {
        setSidebarRecent([])
      }
    })()
  }, [ctx, sessionId])

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

  const inputVisibleLines = useMemo(
    () =>
      inputMode === 'blocked' ? 1 : Math.min(TUI_DRAFT_MAX_LINES, countDraftLines(draft)),
    [draft, inputMode],
  )
  const inputExtraRows = Math.max(0, inputVisibleLines - 1)

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
      setL4ContextHint(null)
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

  useEffect(() => {
    if (!tuiCursorHideEnabled()) {
      return
    }
    tuiCursorHideWithCli()
    return () => {
      tuiCursorShowWithCli()
    }
  }, [])

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
      const firstLine = text.split('\n')[0].trim()
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
      const isClearSlash = firstLine === '/clear' || firstLine.startsWith('/clear ')
      if (isClearSlash) {
        setBlocks([])
        setScrollOffset(0)
        setAssistantStreamTr(null)
        void refreshSessionMeta(sessionRef.current)
        return
      }
      if (firstLine.startsWith('/')) {
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
          const slash = await runSlashCommand(ctx, sessionRef.current, firstLine, emit)
          if (slash.kind === 'exit') {
            exit()
            return
          }
          if (slash.kind === 'new_session') {
            setBlocks([])
            setScrollOffset(0)
            sessionRef.current = slash.sessionId
            setSessionId(slash.sessionId)
            setL4ContextHint(null)
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
        const { traceId } = await runChatStreamWithSink(
          ctx,
          sessionRef.current,
          trimmed,
          sink,
          thinking,
        )
        setL4ContextHint(null)
        {
          const op = createTheWorldOperatorClient({
            baseUrl: ctx.baseUrl,
            apiKey: ctx.apiKey,
          })
          let line: string | null = null
          if (traceId) {
            try {
              const body = await op.getRunContext(traceId)
              line = formatL4ContextAndMemoryRailLine(body)
            } catch {
              line = 'ctx·eng: —'
            }
          }
          try {
            const { approvals } = await op.listApprovals()
            const sfx = formatL4ApprovalSessionRailSuffix(sessionRef.current, approvals)
            if (sfx) {
              line = line != null ? `${line} · ${sfx}` : sfx
            }
          } catch {
            /* ignore */
          }
          try {
            const { runs } = await op.listSessionRuns(sessionRef.current, { limit: 24 })
            const rfx = formatL4RunsSessionRailSuffix(runs)
            if (rfx) {
              line = line != null ? `${line} · ${rfx}` : rfx
            }
          } catch {
            /* ignore */
          }
          if (line != null) {
            setL4ContextHint(line)
          }
        }
      } catch (e: unknown) {
        setRunPhase('failed')
        const em = formatCliError(e)
        const tips = errorRecoveryExtraLines(em)
        pushBlock({
          id: nextTuiBlockId(),
          type: 'error',
          message: em,
          tip: [tips[0], tips[1]].filter(Boolean).join(' · ') || 'theworld help',
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
      // Ink 可能长期持有**首次渲染**的闭包，禁止依赖 draft/cursor 的 state 快照；用 ref（082/本修复）。
      const d0 = draftRef.current
      const c0 = cursorRef.current
      /**
       * Ink `parseKeypress`：`\b` → `key.backspace`；`\x7f(127)` → `key.name === 'delete'`（见
       * `parse-keypress.js` 注释：与「删除」键同码）。常见终端「退格」发 127，原先把 `key.delete` 当
       * 向前删：光标在**串尾**时 `slice(c+1)` 无字可删，表现即「能输入不能退格」。
       * 多行编辑里统一为**删光标前**一字（与 shell 行编辑一致）。真·向前删若需可另绑键。
       */
      const isDeleteCharBefore = (
        key.delete || // 含 127 标成 delete
        key.backspace ||
        (key.ctrl && (input === 'h' || input === 'H')) ||
        (input.length === 1 && (input.charCodeAt(0) === 8 || input.charCodeAt(0) === 127))
      )
      if (key.ctrl && input === ',') {
        setSettingsOpen(s => !s)
        return
      }
      if (key.ctrl && (input === 'l' || input === 'L' || (input.length === 1 && input.charCodeAt(0) === 12))) {
        setSessionListOpen(true)
        return
      }
      // 草案内换行：终端若只发裸 `\n`/`\r`，与 Ink 的 `key.shift` 无法区分（见下）；Ctrl+O 为可靠换行键。
      if (key.ctrl && (input === 'o' || input === 'O')) {
        if (countDraftLines(d0) >= TUI_DRAFT_MAX_LINES) {
          return
        }
        const { draft: nd, cursorIndex: ni } = insertClamped(d0, c0, '\n')
        setDraft(nd)
        setCursorIndex(ni)
        return
      }
      /**
       * `parseKeypress`：常见 `\r` → `name === 'return'`（`key.return`）；
       * 不少 raw 终端**单键 Enter** 只发 `\n`（`name === 'enter'`），**没有** `key.return`，
       * 若当普通字符 `insert` 会「全是换行」。
       * Ink `use-input.js`：对单字输入若 `c.toUpperCase() === c` 会设 `key.shift`；**`\n`/`\r` 也满足**，
       * 故裸 Enter 会被误标成 Shift+Enter → 必须只在**非裸**行尾序列上信任 `key.shift` 才插入换行。
       */
      const isEnterKey =
        key.return || (input.length === 1 && (input === '\n' || input === '\r'))
      if (isEnterKey) {
        const isBareLineEnding = input === '\n' || input === '\r' || key.return
        if (key.shift && !isBareLineEnding) {
          if (countDraftLines(d0) >= TUI_DRAFT_MAX_LINES) {
            return
          }
          const { draft: nd, cursorIndex: ni } = insertClamped(d0, c0, '\n')
          setDraft(nd)
          setCursorIndex(ni)
          return
        }
        const t = d0
        setDraft('')
        setCursorIndex(0)
        void runOneTurn(t)
        return
      }
      if (key.tab) {
        const firstLine = d0.split('\n')[0]
        if (!firstLine.trimStart().startsWith('/')) {
          return
        }
        const [hits] = completeSlashLine(firstLine)
        if (hits[0]) {
          const rest = d0.split('\n').slice(1)
          const next = rest.length > 0 ? `${hits[0]}\n${rest.join('\n')}` : hits[0]
          setDraft(next)
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
        setCursorIndex(v => Math.min(draftRef.current.length, v + 1))
        return
      }
      if (isDeleteCharBefore) {
        const d = draftRef.current
        const c = cursorRef.current
        if (c === 0) return
        setDraft(d.slice(0, c - 1) + d.slice(c))
        setCursorIndex(c - 1)
        return
      }
      if (
        input &&
        input.length > 1 &&
        !key.ctrl &&
        !key.meta &&
        (input.includes('\n') || input.includes('\r'))
      ) {
        const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const d = draftRef.current
        const c = cursorRef.current
        const { draft: nd, cursorIndex: ni } = insertClamped(d, c, normalized)
        setDraft(nd)
        setCursorIndex(ni)
        return
      }
      if (input && !key.ctrl && !key.meta) {
        const d = draftRef.current
        const c = cursorRef.current
        const { draft: nd, cursorIndex: ni } = insertClamped(d, c, input)
        setDraft(nd)
        setCursorIndex(ni)
      }
    },
    { isActive: !sessionListOpen && !settingsOpen },
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
    () =>
      computeTranscriptBlockBudget(rows, {
        /** 084: 多行草案 + 086 上下文带 + 081/082 底栏色带 */
        reservedRows:
          (showHome ? 15 : wideLayout ? 17 : 19) + inputExtraRows,
      }),
    [rows, showHome, wideLayout, inputExtraRows],
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

  if (settingsOpen) {
    return <ChatTuiSettings tuiFile={tuiFile} onClose={() => setSettingsOpen(false)} />
  }

  const sidebarW = wideLayout ? tuiSidebarWidthCols(cols) : 0
  const mainColumnW = wideLayout ? cols - sidebarW - 1 : cols
  const transcriptFillW = Math.max(8, mainColumnW - 2)
  const thinkW = Math.max(0, cols - 2)

  return (
    <TuiBox
      flexDirection="column"
      width={cols}
      height={rows}
      backgroundColor={p.color ? p.background : undefined}
    >
      <ChatTuiHeader
        columns={cols}
        workspaceLabel={workspaceLabel}
        displayName={displayName}
        alias={alias}
        shortId={shortId}
        runPhase={runPhase}
        showHome={showHome}
      />
      <TuiBox
        flexDirection="column"
        flexGrow={1}
        minHeight={2}
        overflow="hidden"
        backgroundColor={p.color ? p.background : undefined}
      >
        {showHome ? (
          <ChatTuiHomeShell
            ctx={ctx}
            currentSessionId={sessionId}
            columns={cols}
            narrow={narrow}
          />
        ) : (
          <Box flexDirection="row" flexGrow={1} overflow="hidden">
            <TuiBox
              flexDirection="column"
              flexGrow={1}
              minHeight={2}
              overflow="hidden"
              backgroundColor={p.color ? p.background : undefined}
              paddingX={1}
              marginRight={wideLayout ? 1 : 0}
            >
              <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
                <Text bold color={p.accent ?? ink.accent}>
                  Conversation
                </Text>
                <Text dimColor color={!p.color ? undefined : p.textMuted}>
                  {scrollOffset > 0 ? 'manual scroll' : 'following latest'}
                </Text>
              </Box>
              {p.color && p.border ? (
                <Box flexDirection="column" marginBottom={0}>
                  <TuiTextFill width={transcriptFillW} backgroundColor={p.border} />
                </Box>
              ) : null}
              <Box flexDirection="column" flexGrow={1} overflow="hidden">
                <ChatTuiTranscript
                  blocks={visibleBlocks}
                  assistantStream={assistantStream}
                  streamCursor={streamCursor}
                  hiddenBeforeCount={hiddenBeforeCount}
                  hiddenAfterCount={hiddenAfterCount}
                />
              </Box>
            </TuiBox>
            {wideLayout ? (
              <ChatTuiSidebar
                width={sidebarW}
                runPhase={runPhase}
                host={host}
                modelEnv={modelEnv}
                agentId={agentId}
                context={contextStats}
                displayName={displayName}
                alias={alias}
                shortId={shortId}
                currentSessionId={sessionId}
                recentRows={sidebarRecent}
              />
            ) : null}
          </Box>
        )}
      </TuiBox>
      <TuiBox
        flexDirection="column"
        height={1}
        justifyContent="center"
        marginTop={0}
        backgroundColor={p.color ? p.surface : undefined}
        paddingX={1}
      >
        {p.color && p.surface ? (
          <Text
            backgroundColor={p.surface}
            color={thinkingActive ? p.accent ?? ink.thinkAccent : p.surface}
            dimColor={false}
            wrap="truncate-end"
          >
            {padStringToWidth(
              thinkingActive ? `${thinkGlyph} working…` : ' ',
              thinkW,
            )}
          </Text>
        ) : thinkingActive ? (
          <Box flexDirection="row">
            <Text color={p.accent ?? ink.thinkAccent}>{`${thinkGlyph} `}</Text>
            <Text dimColor color={!p.color ? undefined : p.textMuted}>
              working…
            </Text>
          </Box>
        ) : (
          <Text> </Text>
        )}
      </TuiBox>
      <ChatTuiInputBar
        columns={cols}
        draft={draft}
        cursorIndex={cursorIndex}
        caret={draftCaret}
        inputMode={inputMode}
        showHome={showHome}
      />
      <ChatTuiContextRail
        columns={cols}
        runPhase={runPhase}
        modelEnv={modelEnv}
        agentId={agentId}
        context={contextStats}
        l4ContextHint={l4ContextHint}
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
        includeModelContext={false}
      />
    </TuiBox>
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
    } else {
      println(`${S.red}Cannot connect to server: ${message}${S.reset}`)
    }
    for (const line of errorRecoveryExtraLines(message)) {
      println(`${T.dim}${line}${S.reset}`)
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
