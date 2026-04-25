import { CLI_TITLE } from './branding.js'
import { println } from './io.js'

export function printHelpRoot(): void {
  println(`${CLI_TITLE} — command-line shell for a running server.`)
  println()
  println('Run via `pnpm theworld` / `pnpm world` (same entry) or call the CLI file directly.')
  println()
  println('Surface product name is TheWorld; configure the CLI with THEWORLD_* env vars.')
  println('L4 product surfaces + command map: packages/cli/src/l4-product-map.ts (see docs/.../L4_PRODUCT_SHELL_MAP.md).')
  println()
  println('First run (L4 100, local terminal only):')
  println('  1) In another terminal: pnpm dev:server  (from repo that runs `packages/server`)')
  println('  2) theworld inspect health  ·  theworld inspect tools  ·  theworld inspect skills')
  println('  3) theworld chat  (or: THEWORLD_CHAT_TUI=1 theworld chat  for full-screen TUI)')
  println('  Risk: shell/file tools are dangerous-class; the server may require approval (L3 093).')
  println(
    '  Runs & plan (L4 104–105): theworld sessions runs <id>  ·  theworld inspect resume  ·  theworld plan …',
  )
  println()
  println('Shell entry (home vs conversation):')
  println('  `chat` opens a session: line UI shows a home hint panel; TUI shows a home shell over')
  println('  an empty transcript until you send. Help and sessions list are the main discoverability')
  println('  surfaces. Thread identity is always: displayName → local alias → short id.')
  println()
  println('Chat shorthand (omit the `chat` subcommand):')
  println('  pnpm world -c | --continue     attach to the latest chat session (or start new)')
  println('  pnpm world --resume <id|alias> same as --session (alias from /rename in chat)')
  println('  pnpm world "your message"     open chat and send the first message, then REPL')
  println('  Subcommands (sessions, inspect, tasks, plan, help) must be spelled exactly.')
  println()
  println('In chat: type / for slash commands (see /help); they are not sent to the server.')
  println('  /help  ·  /inspect <sub>  ·  /rename <alias>  ·  /clear  ·  /exit (or `exit` / Ctrl+C exit)')
  println()
  println('Usage:')
  println('  theworld help [topic]')
  println('  theworld chat [flags] [initial message...]')
  println(
    '    flags: --session <id|alias> | --resume <id|alias> | -c | --continue | --pick (TTY) | --tui',
  )
  println('  theworld sessions <subcommand> ...')
  println('  theworld inspect <subcommand> ...  (see `inspect context` / `inspect memory` for L3/L4 reports)')
  println('  theworld tasks <subcommand> ...')
  println('  theworld plan <subcommand> ...         L4 105: local plan / review / execute (see `help plan`)')
  println()
  println('Topics:  help sessions | inspect | tasks | plan')
  println()
  println('Global flags:')
  println('  --json                  Machine-readable JSON where supported')
  println('  --server-url <url>      Server base URL')
  println('  --api-key <key>         API key')
  println('  -h, --help              Help for the current command')
  println()
  println('Environment:')
  println('  --server-url / --api-key      see Global flags (highest wins over env)')
  println('  Default server URL:            http://127.0.0.1:3333')
  println('  THEWORLD_SERVER_URL')
  println('  THEWORLD_API_KEY')
  println('  THEWORLD_SESSION_ALIASES_PATH  optional JSON for /rename aliases (default: ~/.theworld/session-aliases.json)')
  println('  THEWORLD_PLAN_CWD            optional base dir for `.theworld/plan/` (default: process cwd; used by tests)')
  println('  .theworld/tui.yaml         optional project file: tui.theme, tui.display.show_sidebar (see 076)')
  println('  THEWORLD_CHAT_STATUS=0       disable one-line status above the prompt in chat')
  println('  THEWORLD_CHAT_PLAIN_INPUT=1  force pipe-style input (no readline history)')
  println('  THEWORLD_CHAT_SPINNER=ascii|dots|braille  run-wait spinner')
  println('  THEWORLD_CHAT_TUI=1            full-screen Ink TUI (TTY only)')
  println('  THEWORLD_TUI_SPLASH=0          skip the full TUI open (reveal, CTA, 3s auto); use in CI/automation')
  println('  THEWORLD_TUI_SHOW_CURSOR=1     keep the terminal hardware cursor visible in chat TUI (default hides it)')
  println('  In chat TUI:  Ctrl+L  open session list  ·  j/k  Enter  Esc/q  (list opens over the shell)')
  println('  THEWORLD_CHAT_TUI_MODEL=<name> optional label in TUI status bar')
  println('  NO_COLOR=1 / TERM=dumb         disable ANSI colors (line UI + TUI)')
  println()
  println('Start the server in another terminal:  pnpm dev:server')
}

export function printHelpSessions(): void {
  println('theworld sessions — list and manage chat sessions (client API)')
  println()
  println('Usage:')
  println('  theworld sessions list [--json]')
  println('  theworld sessions show <id> [--json]')
  println('  theworld sessions messages <id> [--limit <n>] [--json]')
  println('  theworld sessions delete <id> [--json]')
  println('  theworld sessions runs <id> [--status running|completed|failed] [--limit <n>] [--json]  (L4 104)')
  println('  theworld sessions cancel-run <traceId> [--json]   POST /v1/runs/.../cancel (052)')
  println()
  println('Identity order everywhere: `sessions list`, picker --pick, and headers use')
  println('  displayName (if set) → alias (if different) → short id.')
  println('`chat` without --session creates a new session; use show/list to copy an id,')
  println('then `theworld chat --session <id>` or a name from `/rename` to continue.')
}

export function printHelpInspect(): void {
  println('theworld inspect — health and operator introspection')
  println()
  println('Usage:')
  println('  theworld inspect health [--json]        GET /health (liveness)')
  println('  theworld inspect status [--json]        GET /v1/system/status')
  println('  theworld inspect context <traceId> [--json]  GET /v1/runs/.../context (L3 094, L4 101)')
  println('  theworld inspect memory [traceId] [--json]   L4 102: taxonomy, or per-run memory slice (same GET as context)')
  println('  theworld inspect resume                      L4 104: print background/resume/cancel vocabulary')
  println('  theworld inspect approvals [--json]         L3 093 / L4 103: list in-memory approval queue')
  println('  theworld inspect approval <id> [approve|deny [--reason t]|cancel] [--json]')
  println('  theworld inspect logs [--json]          GET /v1/logs (optional --date, --limit)')
  println('  theworld inspect tools [--json]         GET /v1/tools')
  println('  theworld inspect skills [--json]        GET /v1/skills')
  println()
  println('Logs query flags (only for `inspect logs`):')
  println('  --date YYYY-MM-DD       Log file date (default: today on server)')
  println('  --limit <n>             Max lines (default server-side: 100, max 500)')
}

export function printHelpTasks(): void {
  println('theworld tasks — scheduled tasks (operator API)')
  println()
  println('Usage:')
  println('  theworld tasks list [--json]')
  println('  theworld tasks show <id> [--json]')
  println('  theworld tasks create --file <path.json>')
  println('  theworld tasks trigger <id>')
  println('  theworld tasks enable <id>')
  println('  theworld tasks disable <id>')
  println('  theworld tasks runs <id> [--json]')
  println()
  println('`create` expects a JSON file matching CreateTaskRequest (name, triggerType,')
  println('triggerConfig, agentId, input, optional enabled / webhookUrl).')
}

export function printHelpPlan(): void {
  println('theworld plan — L4 105 single-agent plan → review → execute (local file in .theworld/plan/)')
  println()
  println('Usage:')
  println('  theworld plan init --title <text> [--session <id>]   create state.json (edit body in editor)')
  println('  theworld plan show  |  plan status  [--json]         display current artifact')
  println('  theworld plan review accept | revise --note <t> | cancel')
  println('  theworld plan execute --session <id> [--json]        streamRun with approved plan (needs LLM server)')
  println()
  println('Review gate is local; L3 approval for dangerous tools is separate (`inspect approvals`).')
}

export function printHelpForCommand(command: string[]): void {
  const head = command[0]
  const topic = command[0] === 'help' ? command[1] : undefined

  if (topic === 'sessions' || head === 'sessions') {
    printHelpSessions()
    return
  }
  if (topic === 'inspect' || head === 'inspect') {
    printHelpInspect()
    return
  }
  if (topic === 'tasks' || head === 'tasks') {
    printHelpTasks()
    return
  }
  if (topic === 'plan' || head === 'plan') {
    printHelpPlan()
    return
  }

  printHelpRoot()
}
