/**
 * fibonacci-calculator skill script
 * Args (via SKILL_ARGS env): { n?: number }
 * Calls fibonacci.py and prints the result.
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = JSON.parse(process.env.SKILL_ARGS || '{}') as { n?: number }
const n = Number(args.n ?? 10)

if (!Number.isInteger(n) || n < 0) {
  process.stderr.write('Error: n must be a non-negative integer\n')
  process.exit(1)
}

const scriptPath = join(__dirname, 'fibonacci.py')

const child = spawn('python3', [scriptPath, String(n)], {
  stdio: ['ignore', 'pipe', 'pipe'],
})

child.stdout.on('data', (chunk: Buffer) => process.stdout.write(chunk))
child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk))

child.on('close', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  process.stderr.write(`Failed to run python3: ${err.message}\n`)
  process.exit(1)
})
