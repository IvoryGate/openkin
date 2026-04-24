import type { CliContext } from './args.js'
import { CLI_CHAT_TITLE, CLI_PRODUCT } from './branding.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { println } from './io.js'
import { S, T, line as hrule } from './style.js'

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

/** Opening banner for interactive chat (054 Phase A). */
export function printChatWelcome(ctx: CliContext): void {
  const version = readCliVersion()
  println()
  println(hrule())
  println(`${S.bold}${T.brand}${CLI_CHAT_TITLE}${S.reset}  ${T.dim}v${version}${S.reset}`)
  println(`${T.dim}${CLI_PRODUCT} · server ${ctx.baseUrl}${S.reset}`)
  println(hrule())
  println(`${T.dim}Messages go to the server; lines starting with / are local slash commands (/help).${S.reset}`)
  println(`${T.dim}Quit: /exit  or  exit  ·  Ctrl+C${S.reset}`)
  println(hrule('·'))
  println()
}

/** 067: home / empty shell hints (line mode); mirrors TUI ChatTuiHomeShell narrative. */
export function printShellHomeHintsLineMode(): void {
  println(`${T.dim}— Home shell —${S.reset}`)
  println(`${T.dim}  Type a message and press Enter · theworld help · theworld sessions list${S.reset}`)
  println(`${T.dim}  Resume: -c | --continue · attach: --resume <id|alias> · TTY: --pick${S.reset}`)
  println(`${T.dim}  In chat: /help, /inspect health, /rename <alias>${S.reset}`)
  println()
}
