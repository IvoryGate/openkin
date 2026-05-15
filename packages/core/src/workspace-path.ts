/**
 * Workspace / project path allowlist for L2 filesystem & shell tools (208 / thesis §10).
 */
import * as path from 'node:path'
import { readEnv } from './env.js'

export function getDefaultWorkspaceDir(): string {
  const raw = readEnv('THEWORLD_WORKSPACE_DIR')
  return path.resolve(raw ?? path.join(process.cwd(), 'workspace'))
}

/** Optional second root (repo root); defaults to cwd so dev can touch packages/ when needed. */
export function getDefaultProjectRoot(): string {
  const raw = readEnv('THEWORLD_PROJECT_ROOT')
  return path.resolve(raw ?? process.cwd())
}

export function getAllowedPathRoots(): string[] {
  return [getDefaultWorkspaceDir(), getDefaultProjectRoot()]
}

/** True if `resolved` is under `root` (after realpath). */
export function isPathUnderRoot(resolved: string, root: string): boolean {
  const rootResolved = path.resolve(root)
  const candidate = path.resolve(resolved)
  const rel = path.relative(rootResolved, candidate)
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && !rel.startsWith('..') && !path.isAbsolute(rel))
}

export function assertPathAllowedForTools(resolvedPath: string): void {
  const roots = getAllowedPathRoots()
  const ok = roots.some((root) => isPathUnderRoot(resolvedPath, root))
  if (!ok) {
    throw new Error(
      `Path outside allowed roots: ${resolvedPath}. Allowed: ${roots.join(' | ')}. Set THEWORLD_WORKSPACE_DIR / THEWORLD_PROJECT_ROOT if needed.`,
    )
  }
}
