import { runChatCommand } from './cmd-chat.js'
import { runInspectCommand } from './cmd-inspect.js'
import { runSessionsCommand } from './cmd-sessions.js'
import { runPlanCommand } from './cmd-plan.js'
import { runTasksCommand } from './cmd-tasks.js'
import { parseCli } from './args.js'
import { printHelpForCommand, printHelpRoot } from './help.js'
import { exitWithError } from './io.js'
import { errorRecoveryExtraLines } from './l4-onboarding.js'
import { L4_KNOWN_CLI_VERBS } from './l4-product-map.js'
import { formatCliError } from './errors.js'

const KNOWN_VERBS = new Set<string>(L4_KNOWN_CLI_VERBS)

/** `pnpm run <script> -- args` injects `--`; strip so `theworld -- help` works. */
function normalizeArgv(argv: string[]): string[] {
  let a = argv
  while (a[0] === '--') {
    a = a.slice(1)
  }
  return a
}

async function main(): Promise<void> {
  let parsed
  try {
    parsed = parseCli(normalizeArgv(process.argv.slice(2)))
  } catch (e: unknown) {
    exitWithError(e instanceof Error ? e.message : String(e))
  }

  const { ctx, command, help } = parsed

  if (command.length === 0) {
    printHelpRoot()
    return
  }

  const [cmd0, ...rest] = command

  if (cmd0 === 'help') {
    printHelpForCommand(command)
    return
  }

  if (help) {
    printHelpForCommand(command)
    return
  }

  // 048: `pnpm world -c`, `pnpm world "hello"`, etc. omit the `chat` subcommand — treat as chat args.
  if (!KNOWN_VERBS.has(cmd0)) {
    await runChatCommand(ctx, command)
    return
  }

  try {
    switch (cmd0) {
      case 'chat':
        await runChatCommand(ctx, rest)
        return
      case 'sessions':
        await runSessionsCommand(ctx, rest)
        return
      case 'inspect':
        await runInspectCommand(ctx, rest)
        return
      case 'tasks':
        await runTasksCommand(ctx, rest)
        return
      case 'plan':
        await runPlanCommand(ctx, rest)
        return
      default:
        exitWithError(
          `Unknown command: ${command.join(' ')}\nRun \`theworld help\` or \`pnpm theworld help\` to see available commands.`,
        )
    }
  } catch (e: unknown) {
    const msg = formatCliError(e)
    process.stderr.write(`${msg}\n`)
    for (const line of errorRecoveryExtraLines(msg)) {
      process.stderr.write(`${line}\n`)
    }
    process.exit(1)
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`theworld error: ${message}\n`)
  process.exit(1)
})
