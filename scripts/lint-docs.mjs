import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredPaths = [
  'AGENTS.md',
  'docs/index.md',
  'docs/ARCHITECTURE.md',
  'docs/SDK.md',
  'docs/CHANNELS.md',
  'docs/QUALITY_SCORE.md',
  'docs/RELIABILITY.md',
  'docs/SECURITY.md',
  'docs/MODEL_OPERATING_MODES.md',
  'docs/MODEL_PROMPT_CHEATSHEET.md',
  'docs/archive/README.md',
  'docs/exec-plans/active/README.md',
  'docs/exec-plans/completed/README.md',
]

const currentDocsMustNotReferenceLegacyRoot = [
  'docs/AI_Agent_Backend_Tech_Plan.md',
  'docs/第一层详细设计/',
  'docs/具体模块扩展介绍/',
]

const filesToCheck = [
  'AGENTS.md',
  'README.md',
  'docs/index.md',
  'docs/ARCHITECTURE.md',
]

const errors = []

for (const rel of requiredPaths) {
  if (!existsSync(path.join(root, rel))) {
    errors.push(`Missing required docs path: ${rel}`)
  }
}

for (const rel of filesToCheck) {
  const full = path.join(root, rel)
  const content = readFileSync(full, 'utf8')
  for (const forbidden of currentDocsMustNotReferenceLegacyRoot) {
    if (content.includes(forbidden)) {
      errors.push(`Current entry doc ${rel} still references legacy root path: ${forbidden}`)
    }
  }
}

if (errors.length > 0) {
  console.error('Docs lint failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Docs lint passed.')
