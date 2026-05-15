#!/bin/bash
# run.sh — entry point for create-task skill
# Executed by the skill runner with SKILL_ARGS set in environment.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Use tsx if available (preferred for TypeScript), otherwise fall back to node with ts-node
if command -v tsx &> /dev/null; then
  exec tsx "$SCRIPT_DIR/create-task.ts"
elif command -v ts-node &> /dev/null; then
  exec ts-node --esm "$SCRIPT_DIR/create-task.ts"
else
  echo "Error: Neither tsx nor ts-node is available. Install one of them to run this skill." >&2
  exit 1
fi
