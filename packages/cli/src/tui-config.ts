/**
 * Optional project file: `.theworld/tui.yaml` (076).
 * Priority when wiring with flags/env in a later ticket: CLI flag > env > this file > built-in default.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

export const DEFAULT_TUI_THEME = 'dark'

export type TuiFileConfig = {
  /** `tui.theme` in YAML, else {@link DEFAULT_TUI_THEME}. */
  theme: string
  /** `tui.display.show_sidebar` when present and boolean; otherwise `undefined` (no override). */
  showSidebar: boolean | undefined
  /** Absolute path to the read file, or `null` if missing or unreadable. */
  configFilePath: string | null
}

const defaultConfig = (): TuiFileConfig => ({
  theme: DEFAULT_TUI_THEME,
  showSidebar: undefined,
  configFilePath: null,
})

function parseTuiYamlDocument(doc: unknown): Pick<TuiFileConfig, 'theme' | 'showSidebar'> {
  const out: Pick<TuiFileConfig, 'theme' | 'showSidebar'> = {
    theme: DEFAULT_TUI_THEME,
    showSidebar: undefined,
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return out
  const root = doc as Record<string, unknown>
  const tui = root.tui
  if (!tui || typeof tui !== 'object' || Array.isArray(tui)) return out
  const t = tui as Record<string, unknown>
  if (typeof t.theme === 'string' && t.theme.trim() !== '') {
    out.theme = t.theme.trim()
  }
  const display = t.display
  if (display && typeof display === 'object' && !Array.isArray(display)) {
    const d = display as Record<string, unknown>
    if (typeof d.show_sidebar === 'boolean') {
      out.showSidebar = d.show_sidebar
    }
  }
  return out
}

/**
 * Load `.theworld/tui.yaml` under `cwd` if it exists. Never throws; invalid files fall back to defaults.
 */
export function loadTuiFileConfig(cwd: string = process.cwd()): TuiFileConfig {
  const configFilePath = join(cwd, '.theworld', 'tui.yaml')
  if (!existsSync(configFilePath)) {
    return defaultConfig()
  }
  try {
    const raw = readFileSync(configFilePath, 'utf8')
    const doc = parse(raw) as unknown
    const parsed = parseTuiYamlDocument(doc)
    return {
      theme: parsed.theme,
      showSidebar: parsed.showSidebar,
      configFilePath,
    }
  } catch {
    return defaultConfig()
  }
}
