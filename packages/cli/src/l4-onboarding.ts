/**
 * L4 onboarding / empty-state / recovery hints (exec-plan 100).
 * @see docs/architecture-docs-for-agent/fourth-layer/L4_ONBOARDING.md
 */
import { readEnv } from '@theworld/core'
import type { CliContext } from './args.js'

function workspaceLabel(): string {
  const w = readEnv('THEWORLD_WORKSPACE_DIR')?.trim()
  if (w) return w
  return `${process.cwd()}/workspace (default when unset)`
}

/**
 * dim lines for line-mode welcome + TUI home (same facts, different render).
 */
export function describeLocalProfileLines(ctx: CliContext): string[] {
  const lines: string[] = [
    `Workspace  ${workspaceLabel()}`,
    `Server     ${ctx.baseUrl}`,
    `API key    ${ctx.apiKey ? 'set (env or --api-key)' : 'not set'}`,
  ]
  const tuiModel = readEnv('THEWORLD_CHAT_TUI_MODEL')?.trim()
  if (tuiModel) {
    lines.push(`TUI model label  THEWORLD_CHAT_TUI_MODEL=${tuiModel}`)
  }
  lines.push('LLM / provider  configured in the server process (.env on server); not exposed here')
  return lines
}

/**
 * After welcome banner: local profile, discoverability, risk note (one screen).
 */
export function printL4OnboardingBlock(
  ctx: CliContext,
  emit: (line: string) => void,
  dim: string,
  reset: string,
): void {
  emit(`${dim}— Local profile (100) —${reset}`)
  for (const line of describeLocalProfileLines(ctx)) {
    emit(`${dim}  ${line}${reset}`)
  }
  emit(`${dim}— Discoverability —${reset}`)
  emit(
    `${dim}  Tools / skills  theworld inspect tools  ·  theworld inspect skills  ·  in chat: /skills${reset}`,
  )
  emit(
    `${dim}  System snapshot   theworld inspect status  ·  logs: theworld inspect logs${reset}`,
  )
  emit(
    `${dim}  Session runs     theworld sessions runs <id>  ·  in chat: /runs  ·  theworld inspect resume  (L4 104)${reset}`,
  )
  emit(
    `${dim}  Plan locally     theworld plan  — .theworld/plan/state.json  (L4 105, see: theworld help plan)${reset}`,
  )
  emit(
    `${dim}  Risk              shell and file tools are high-risk; server may require approval (L3 093)${reset}`,
  )
}

/** Extra dim lines to print after a formatted CLI error. */
export function errorRecoveryExtraLines(formattedMessage: string): string[] {
  const m = formattedMessage.toLowerCase()
  const out: string[] = []
  if (
    m.includes('econnrefused') ||
    m.includes('fetch failed') ||
    m.includes('network') ||
    m.includes('enotfound') ||
    m.includes('econnreset') ||
    m.includes('etimedout')
  ) {
    out.push('→ Start the API: pnpm dev:server  (repo root, separate terminal)')
    out.push('→ Check: theworld inspect health  ·  URL: THEWORLD_SERVER_URL or --server-url')
  }
  if (m.includes('401') || m.includes('403') || m.includes('unauthorized') || m.includes('forbidden')) {
    out.push('→ API key: set THEWORLD_API_KEY or --api-key to match the server')
  }
  if ((m.includes('not found') || m.includes('404') || m.includes('not_found')) && m.includes('session')) {
    out.push('→ Sessions: theworld sessions list  ·  theworld chat --resume <id|alias>')
  }
  out.push('→ theworld help  ·  theworld inspect status')
  return out
}
