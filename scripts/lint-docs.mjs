import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredPaths = [
  'AGENTS.md',
  'README.md',
  'docs/index.md',
  'docs/v2/00-overview.md',
  'docs/v2/01-principles.md',
  'docs/v2/02-cicd.md',
  'docs/v2/10-l1-core.md',
  'docs/v2/90-governance.md',
  'docs/v2/91-model-modes.md',
  'docs/exec-plans/active/README.md',
  'docs/exec-plans/completed/README.md',
  'docs/exec-plans/active/200_v2_agent_driven_cicd_overview.md',
  'docs/exec-plans/active/201_v2_wave0_cicd_skeleton.md',
]

const errors = []

for (const rel of requiredPaths) {
  if (!existsSync(path.join(root, rel))) {
    errors.push(`Missing required docs path: ${rel}`)
  }
}

const agents = readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
if (!agents.includes('explore/v2-from-scratch')) {
  errors.push('AGENTS.md must reference explore/v2-from-scratch as the v2 branch')
}

if (errors.length > 0) {
  console.error('Docs lint failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Docs lint passed.')
