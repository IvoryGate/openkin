import { readCompatEnv } from '@theworld/core'

const DEFAULT_BASE_URL =
  readCompatEnv('THEWORLD_SERVER_URL', 'OPENKIN_SERVER_URL') ?? 'http://127.0.0.1:3333'

export type CliContext = {
  baseUrl: string
  apiKey?: string
  json: boolean
}

export type ParsedCli = {
  ctx: CliContext
  command: string[]
  help: boolean
}

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1]
  if (!value) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

export function parseCli(argv: string[]): ParsedCli {
  const command: string[] = []
  let json = false
  let help = false
  let baseUrl = DEFAULT_BASE_URL
  let apiKey = readCompatEnv('THEWORLD_API_KEY', 'OPENKIN_API_KEY')

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--json') {
      json = true
      continue
    }
    if (arg === '--help' || arg === '-h') {
      help = true
      continue
    }
    if (arg.startsWith('--server-url=')) {
      baseUrl = arg.slice('--server-url='.length)
      continue
    }
    if (arg === '--server-url') {
      baseUrl = readFlagValue(argv, i, '--server-url')
      i++
      continue
    }
    if (arg.startsWith('--api-key=')) {
      apiKey = arg.slice('--api-key='.length)
      continue
    }
    if (arg === '--api-key') {
      apiKey = readFlagValue(argv, i, '--api-key')
      i++
      continue
    }

    command.push(arg)
  }

  return {
    ctx: { baseUrl, apiKey, json },
    command,
    help,
  }
}
