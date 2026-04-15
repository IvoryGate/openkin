import { CLI_TITLE } from './branding.js'
import { println } from './io.js'

export function printHelpRoot(): void {
  println(`${CLI_TITLE} — command-line shell for a running server.`)
  println()
  println('Run via `pnpm theworld` / `pnpm world` (same entry) or call the CLI file directly.')
  println()
  println('Surface product name is TheWorld; configure the CLI with THEWORLD_* env vars.')
  println()
  println('Chat shorthand (omit the `chat` subcommand):')
  println('  pnpm world -c | --continue     attach to the latest chat session (or start new)')
  println('  pnpm world --resume <id>       same as --session <id>')
  println('  pnpm world "your message"     open chat and send the first message, then REPL')
  println('  Subcommands (sessions, inspect, tasks, help) must be spelled exactly.')
  println()
  println('In chat: type /help for local slash commands (not sent to the server).')
  println()
  println('Configuration (highest priority first):')
  println('  --server-url <url>     Overrides THEWORLD_SERVER_URL')
  println('  --api-key <key>        Overrides THEWORLD_API_KEY')
  println('  Default server URL:    http://127.0.0.1:3333')
  println()
  println('Usage:')
  println('  theworld help [topic]')
  println('  theworld chat [flags] [initial message...]')
  println('    flags: --session <id> | --resume <id> | -c | --continue')
  println('  theworld sessions <subcommand> ...')
  println('  theworld inspect <subcommand> ...')
  println('  theworld tasks <subcommand> ...')
  println()
  println('Topics:  help sessions | inspect | tasks')
  println()
  println('Global flags:')
  println('  --json                  Machine-readable JSON where supported')
  println('  --server-url <url>      Server base URL')
  println('  --api-key <key>         API key')
  println('  -h, --help              Help for the current command')
  println()
  println('Start the server in another terminal:  pnpm dev:server')
}

export function printHelpSessions(): void {
  println('theworld sessions — list and manage chat sessions (client API)')
  println()
  println('Commands:')
  println('  theworld sessions list [--json]')
  println('  theworld sessions show <id> [--json]')
  println('  theworld sessions messages <id> [--limit <n>] [--json]')
  println('  theworld sessions delete <id> [--json]')
  println()
  println('`chat` without --session creates a new session; use show/list to copy an id,')
  println('then `theworld chat --session <id>` to continue the same conversation.')
}

export function printHelpInspect(): void {
  println('theworld inspect — health and operator introspection')
  println()
  println('Commands:')
  println('  theworld inspect health [--json]        GET /health (liveness)')
  println('  theworld inspect status [--json]        GET /v1/system/status')
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
  println('Commands:')
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

  printHelpRoot()
}
