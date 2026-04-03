import type { ToolDefinition, ToolExecutor, ToolProvider } from '../tool-runtime.js'

/**
 * A single tool contributed by a Skill: its definition + executor bundled together.
 */
export interface SkillToolEntry {
  definition: ToolDefinition
  executor: ToolExecutor
}

/**
 * Minimal Skill manifest. A Skill is a self-contained capability unit that
 * contributes a set of tools to the Agent without requiring an external process
 * or protocol.
 */
export interface SkillManifest {
  /** Skill unique identifier; must be unique within the same SkillToolProvider instance */
  id: string
  /** Human-readable name */
  name: string
  /** Tools this Skill contributes */
  tools: SkillToolEntry[]
}

/**
 * A ToolProvider backed by one or more SkillManifests.
 *
 * - sourceType: 'skill'
 * - No async initialisation required (no connect/disconnect lifecycle).
 * - When two skills register a tool with the same name, the last-registered one wins.
 */
export class SkillToolProvider implements ToolProvider {
  readonly sourceType = 'skill' as const
  readonly id: string

  private readonly toolMap = new Map<string, { definition: ToolDefinition; executor: ToolExecutor }>()

  constructor(manifests: SkillManifest[]) {
    // Use the first manifest's id as provider id, or a stable fallback
    this.id = manifests.length > 0 ? `skill:${manifests.map((m) => m.id).join(',')}` : 'skill:empty'

    for (const manifest of manifests) {
      for (const entry of manifest.tools) {
        // Later entries overwrite earlier ones with the same name (last-registered wins)
        this.toolMap.set(entry.definition.name, {
          definition: entry.definition,
          executor: entry.executor,
        })
      }
    }
  }

  async listTools(): Promise<ToolDefinition[]> {
    return [...this.toolMap.values()].map((e) => e.definition)
  }

  async getExecutor(name: string): Promise<ToolExecutor | undefined> {
    return this.toolMap.get(name)?.executor
  }
}
