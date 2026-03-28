import { homedir } from 'node:os';
import { join } from 'node:path';

export const OPENKIN_DIR = join(homedir(), '.openkin');
export const AGENTS_DIR = join(OPENKIN_DIR, 'agents');
export const SESSIONS_DIR = join(OPENKIN_DIR, 'sessions');
export const CONFIG_FILE = join(OPENKIN_DIR, 'config.json');
export const BACKEND_PORT_FILE = join(OPENKIN_DIR, '.backend_port');

export function agentDir(agentId: string): string {
  return join(AGENTS_DIR, agentId);
}

export function soulMdPath(agentId: string): string {
  return join(AGENTS_DIR, agentId, 'soul.md');
}

export function metaJsonPath(agentId: string): string {
  return join(AGENTS_DIR, agentId, 'meta.json');
}

export function sessionFilePath(agentId: string, sessionId: string): string {
  return join(SESSIONS_DIR, agentId, `${sessionId}.json`);
}
