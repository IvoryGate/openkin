/**
 * L4 Engineering Product Shell — command → surface index (exec-plan 099).
 * Keep in sync with: docs/architecture-docs-for-agent/fourth-layer/L4_PRODUCT_SHELL_MAP.md
 */

/** CLI top-level verbs (must match `index.ts` KNOWN_VERBS + `help`). */
export const L4_KNOWN_CLI_VERBS = ['help', 'chat', 'sessions', 'inspect', 'tasks', 'plan'] as const

/**
 * L4 product surfaces — same vocabulary for CLI + TUI.
 * `product_control_plane` is the cross-surface aggregate (local, not L5).
 */
export const L4_PRODUCT_SURFACES = [
  'home_shell',
  'conversation_shell',
  'session_thread',
  'inspect',
  'task',
  'logs',
  'product_control_plane',
] as const
export type L4ProductSurface = (typeof L4_PRODUCT_SURFACES)[number]

/** L3 data categories that feed the local product control plane display. */
export const L4_CONTROL_PLANE_STATE_SOURCES = [
  'session',
  'run',
  'context',
  'approval',
  'tool',
  'task',
  'log',
] as const
export type L4ControlPlaneStateSource = (typeof L4_CONTROL_PLANE_STATE_SOURCES)[number]

export type L4CommandKind = 'cli_verb' | 'cli_sub' | 'slash' | 'tui_route'

export type L4CommandEntry = {
  id: string
  kind: L4CommandKind
  primarySurface: L4ProductSurface
  secondarySurfaces?: L4ProductSurface[]
  l3Data: L4ControlPlaneStateSource[]
  note?: string
}

/**
 * One row per *stable* product entry (verb:sub, slash head, or TUI note).
 * Used for help taxonomy and drift tests; not a full parser.
 */
export const L4_CLI_COMMAND_INDEX: L4CommandEntry[] = [
  { id: 'help:root', kind: 'cli_verb', primarySurface: 'home_shell', l3Data: [] },
  { id: 'help:topic', kind: 'cli_sub', primarySurface: 'home_shell', l3Data: [] },
  { id: 'chat', kind: 'cli_verb', primarySurface: 'conversation_shell', secondarySurfaces: ['home_shell', 'product_control_plane'], l3Data: ['session', 'run', 'tool'], note: 'line UI + optional TUI; status / spinner' },
  { id: 'sessions:list', kind: 'cli_sub', primarySurface: 'session_thread', l3Data: ['session'] },
  { id: 'sessions:show', kind: 'cli_sub', primarySurface: 'session_thread', l3Data: ['session'] },
  { id: 'sessions:messages', kind: 'cli_sub', primarySurface: 'session_thread', l3Data: ['session'] },
  { id: 'sessions:delete', kind: 'cli_sub', primarySurface: 'session_thread', l3Data: ['session'] },
  { id: 'sessions:runs', kind: 'cli_sub', primarySurface: 'session_thread', l3Data: ['run', 'session'] },
  { id: 'sessions:cancel_run', kind: 'cli_sub', primarySurface: 'session_thread', l3Data: ['run', 'session'] },
  { id: 'inspect:health', kind: 'cli_sub', primarySurface: 'inspect', l3Data: [] },
  { id: 'inspect:status', kind: 'cli_sub', primarySurface: 'product_control_plane', l3Data: ['session', 'tool', 'task', 'log'] },
  { id: 'inspect:logs', kind: 'cli_sub', primarySurface: 'logs', l3Data: ['log'] },
  { id: 'inspect:tools', kind: 'cli_sub', primarySurface: 'inspect', l3Data: ['tool'] },
  { id: 'inspect:skills', kind: 'cli_sub', primarySurface: 'inspect', l3Data: ['tool'] },
  { id: 'inspect:context', kind: 'cli_sub', primarySurface: 'inspect', l3Data: ['context', 'run', 'session'], note: 'L3 ContextBuildReportDto' },
  { id: 'inspect:memory', kind: 'cli_sub', primarySurface: 'inspect', l3Data: ['context', 'run', 'session'], note: 'L4 102 taxonomy + memory slice of same GET' },
  { id: 'inspect:approvals', kind: 'cli_sub', primarySurface: 'inspect', l3Data: ['approval', 'run', 'session'], note: 'L3 queue list GET /v1/approvals' },
  { id: 'inspect:approval', kind: 'cli_sub', primarySurface: 'inspect', l3Data: ['approval', 'run', 'session'], note: 'get/approve/deny/cancel by id' },
  { id: 'inspect:resume', kind: 'cli_sub', primarySurface: 'inspect', l3Data: ['run', 'session'], note: 'L4 104 vocabulary (no I/O)' },
  { id: 'tasks:list', kind: 'cli_sub', primarySurface: 'task', l3Data: ['task'] },
  { id: 'tasks:show', kind: 'cli_sub', primarySurface: 'task', l3Data: ['task'] },
  { id: 'tasks:create', kind: 'cli_sub', primarySurface: 'task', l3Data: ['task', 'session'] },
  { id: 'tasks:trigger', kind: 'cli_sub', primarySurface: 'task', l3Data: ['task', 'run'] },
  { id: 'tasks:enable', kind: 'cli_sub', primarySurface: 'task', l3Data: ['task'] },
  { id: 'tasks:disable', kind: 'cli_sub', primarySurface: 'task', l3Data: ['task'] },
  { id: 'tasks:runs', kind: 'cli_sub', primarySurface: 'task', l3Data: ['task', 'run'] },
  { id: 'plan:init', kind: 'cli_sub', primarySurface: 'home_shell', secondarySurfaces: ['conversation_shell'], l3Data: ['session', 'run'], note: 'L4 105 plan artifact' },
  { id: 'plan:show', kind: 'cli_sub', primarySurface: 'home_shell', l3Data: ['session', 'run'] },
  { id: 'plan:review', kind: 'cli_sub', primarySurface: 'home_shell', l3Data: ['session', 'run'] },
  { id: 'plan:execute', kind: 'cli_sub', primarySurface: 'conversation_shell', l3Data: ['run', 'session'] },
  { id: 'slash:/help', kind: 'slash', primarySurface: 'conversation_shell', l3Data: [] },
  { id: 'slash:/exit', kind: 'slash', primarySurface: 'conversation_shell', l3Data: [] },
  { id: 'slash:/clear', kind: 'slash', primarySurface: 'conversation_shell', l3Data: [] },
  { id: 'slash:/session', kind: 'slash', primarySurface: 'session_thread', l3Data: ['session'] },
  { id: 'slash:/inspect', kind: 'slash', primarySurface: 'inspect', secondarySurfaces: ['product_control_plane'], l3Data: [] },
  { id: 'slash:/tasks', kind: 'slash', primarySurface: 'task', l3Data: ['task', 'run'] },
  { id: 'slash:/skills', kind: 'slash', primarySurface: 'inspect', l3Data: ['tool'] },
  { id: 'slash:/compact', kind: 'slash', primarySurface: 'conversation_shell', l3Data: ['context', 'run', 'session'] },
  { id: 'slash:/context', kind: 'slash', primarySurface: 'inspect', l3Data: ['context', 'run', 'session'] },
  { id: 'slash:/memory', kind: 'slash', primarySurface: 'inspect', l3Data: ['context', 'run', 'session'] },
  { id: 'slash:/approvals', kind: 'slash', primarySurface: 'inspect', l3Data: ['approval', 'session'] },
  { id: 'slash:/runs', kind: 'slash', primarySurface: 'session_thread', l3Data: ['run', 'session'] },
  { id: 'slash:/rename', kind: 'slash', primarySurface: 'session_thread', l3Data: [] },
  { id: 'slash:/rewind', kind: 'slash', primarySurface: 'session_thread', l3Data: [] },
  { id: 'tui:session_list', kind: 'tui_route', primarySurface: 'session_thread', secondarySurfaces: ['home_shell'], l3Data: ['session'] },
  { id: 'tui:splash', kind: 'tui_route', primarySurface: 'home_shell', secondarySurfaces: ['conversation_shell'], l3Data: [] },
]

const surfacePrimaryCount = new Map<L4ProductSurface, number>()

export function assertL4ProductMapInvariants(): void {
  if (L4_PRODUCT_SURFACES.length !== 7) {
    throw new Error(`L4_PRODUCT_SURFACES: expected 7, got ${L4_PRODUCT_SURFACES.length}`)
  }
  if (L4_CONTROL_PLANE_STATE_SOURCES.length !== 7) {
    throw new Error(`L4_CONTROL_PLANE_STATE_SOURCES: expected 7, got ${L4_CONTROL_PLANE_STATE_SOURCES.length}`)
  }
  const dup = L4_COMMAND_ENTRY_IDS()
  const seen = new Set<string>()
  for (const id of dup) {
    if (seen.has(id)) {
      throw new Error(`L4 command id duplicated: ${id}`)
    }
    seen.add(id)
  }
  for (const e of L4_CLI_COMMAND_INDEX) {
    if (!L4_PRODUCT_SURFACES.includes(e.primarySurface)) {
      throw new Error(`Invalid primarySurface: ${e.id} -> ${e.primarySurface}`)
    }
    for (const s of e.secondarySurfaces ?? []) {
      if (!L4_PRODUCT_SURFACES.includes(s)) {
        throw new Error(`Invalid secondarySurface: ${e.id} -> ${s}`)
      }
    }
    for (const d of e.l3Data) {
      if (!L4_CONTROL_PLANE_STATE_SOURCES.includes(d)) {
        throw new Error(`Invalid l3Data ref: ${e.id} -> ${d}`)
      }
    }
  }
  for (const s of L4_PRODUCT_SURFACES) {
    surfacePrimaryCount.set(s, 0)
  }
  for (const e of L4_CLI_COMMAND_INDEX) {
    const n = surfacePrimaryCount.get(e.primarySurface) ?? 0
    surfacePrimaryCount.set(e.primarySurface, n + 1)
  }
  for (const s of L4_PRODUCT_SURFACES) {
    if ((surfacePrimaryCount.get(s) ?? 0) < 1) {
      throw new Error(`L4 surface "${s}" has no primary entry (update L4_CLI_COMMAND_INDEX)`)
    }
  }
}

function L4_COMMAND_ENTRY_IDS(): string[] {
  return L4_CLI_COMMAND_INDEX.map((e) => e.id)
}

export function l4ProductShellMapSnapshotLine(): string {
  return `L4 surfaces=${L4_PRODUCT_SURFACES.join(',')}; controlPlaneSources=${L4_CONTROL_PLANE_STATE_SOURCES.join(',')}; entries=${L4_CLI_COMMAND_INDEX.length}`
}
