import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { dirname } from 'node:path';
import {
  OPENKIN_DIR,
  AGENTS_DIR,
  SESSIONS_DIR,
  CONFIG_FILE,
} from './paths.js';

/** 确保目录存在（递归创建） */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** 读取文本文件，不存在时返回 null */
export function readText(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf-8');
}

/** 写入文本文件（自动创建父目录） */
export function writeText(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf-8');
}

/** 读取 JSON 文件，不存在时返回 null */
export function readJson<T>(filePath: string): T | null {
  const raw = readText(filePath);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 写入 JSON 文件（格式化） */
export function writeJson(filePath: string, data: unknown): void {
  writeText(filePath, JSON.stringify(data, null, 2));
}

/** 列出目录下的所有子目录名，不存在时返回空数组 */
export function listSubDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/** 删除文件或目录（递归） */
export function remove(targetPath: string): void {
  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }
}

/**
 * 初始化应用数据目录和默认配置文件
 * 幂等：已存在时不覆盖
 */
export function initAppDataDir(): void {
  ensureDir(OPENKIN_DIR);
  ensureDir(AGENTS_DIR);
  ensureDir(SESSIONS_DIR);

  if (!existsSync(CONFIG_FILE)) {
    writeJson(CONFIG_FILE, {
      version: '1.0',
      initialized: false,
      active_agent_id: null,
      api_keys: { openai: '', anthropic: '', custom_endpoint: '' },
      ui: { theme: 'dark', language: 'zh-CN' },
    });
  }
}
