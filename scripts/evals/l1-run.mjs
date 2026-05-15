/**
 * L1 evaluation harness (208 / thesis §8–9): fixed commands + JSON report.
 * Used by `pnpm eval:l1`, `scripts/verify/l1-core.mjs`, and optional CI job `eval-l1`.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

const steps = ['test:scenarios', 'test:first-layer-audit']
const results = []
for (const step of steps) {
  const result = spawnSync('pnpm', [step], { stdio: 'inherit', cwd: root })
  results.push({ step, status: result.status })
  if (result.status !== 0) break
}

const meta = {
  node: process.version,
  cwd: process.cwd(),
  platform: process.platform,
  envCi: process.env.CI === 'true',
}

const summary = {
  ok: results.length === steps.length && results.every((r) => r.status === 0),
  meta,
  results,
}

console.error('\n--- L1 eval report (JSON on stdout) ---')
console.log(JSON.stringify(summary, null, 2))

const exitCode = summary.ok ? 0 : results.at(-1)?.status ?? 1
process.exit(typeof exitCode === 'number' ? exitCode : 1)
