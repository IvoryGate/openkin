/**
 * L4 105: local plan artifact under .theworld/plan (init → show → review accept).
 */
import { readFileSync, rmSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const cli = join(root, 'packages/cli/src/index.ts')

function runPlan(args, planBase) {
  const r = spawnSync(
    process.execPath,
    ['--import=tsx/esm', cli, ...args],
    {
      encoding: 'utf8',
      cwd: root,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, THEWORLD_API_KEY: '', THEWORLD_PLAN_CWD: planBase },
    },
  )
  if (r.status !== 0 && r.status != null) {
    throw new Error(`plan ${args.join(' ')} exit ${r.status}: ${r.stdout ?? ''}${r.stderr ?? ''}`)
  }
  return `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}`
}

const tmp = mkdtempSync(join(tmpdir(), 'theworld-l4plan-'))
try {
  const w1 = runPlan(['plan', 'init', '--title', 'smoke plan 105', '--json'], tmp)
  if (!w1.includes('"v": 1') || !w1.includes('smoke plan 105')) {
    console.error('plan init json\n', w1.slice(0, 800))
    process.exit(1)
  }
  const p = join(tmp, '.theworld', 'plan', 'state.json')
  if (!existsSync(p)) {
    console.error('missing', p)
    process.exit(1)
  }
  const raw = readFileSync(p, 'utf8')
  const j = JSON.parse(raw)
  if (j.state !== 'draft') {
    console.error('expected draft', j)
    process.exit(1)
  }
  const show = runPlan(['plan', 'show'], tmp)
  if (!show.includes('state:') || !show.includes('105')) {
    console.error('plan show\n', show.slice(0, 600))
    process.exit(1)
  }
  const acc = runPlan(['plan', 'review', 'accept'], tmp)
  if (!acc && !readFileSync(p, 'utf8').includes('"approved"')) {
    /* accept may be quiet */
  }
  const j2 = JSON.parse(readFileSync(p, 'utf8'))
  if (j2.state !== 'approved') {
    console.error('expected approved', j2)
    process.exit(1)
  }
} finally {
  try {
    rmSync(tmp, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

const doc = readFileSync(
  join(root, 'docs/architecture-docs-for-agent/fourth-layer/L4_PLAN_REVIEW_EXECUTE.md'),
  'utf8',
)
if (!doc.includes('105')) {
  console.error('L4_PLAN_REVIEW_EXECUTE.md should reference 105')
  process.exit(1)
}
const map = readFileSync(join(root, 'packages/cli/src/l4-product-map.ts'), 'utf8')
if (!map.includes("id: 'plan:init'")) {
  console.error('l4-product-map should list plan:init')
  process.exit(1)
}

console.log('test:l4-plan passed')
