export { echoToolDefinition, echoToolExecutor } from './echo.js'
export { getCurrentTimeToolDefinition, getCurrentTimeToolExecutor } from './get-current-time.js'
export { McpToolProvider, type McpToolProviderOptions } from './mcp-tool-provider.js'
export { listSkillsToolDefinition, listSkillsToolExecutor, listSkills, type SkillEntry } from './list-skills.js'
export { readSkillToolDefinition, readSkillToolExecutor } from './read-skill.js'
export { runScriptToolDefinition, runScriptToolExecutor } from './run-script.js'
export { writeSkillToolDefinition, writeSkillToolExecutor } from './write-skill.js'
export { readLogsToolDefinition, readLogsToolExecutor } from './read-logs.js'

import { StaticToolProvider } from '../tool-runtime.js'
import { echoToolDefinition, echoToolExecutor } from './echo.js'
import { getCurrentTimeToolDefinition, getCurrentTimeToolExecutor } from './get-current-time.js'
import { listSkillsToolDefinition, listSkillsToolExecutor } from './list-skills.js'
import { readSkillToolDefinition, readSkillToolExecutor } from './read-skill.js'
import { runScriptToolDefinition, runScriptToolExecutor } from './run-script.js'
import { writeSkillToolDefinition, writeSkillToolExecutor } from './write-skill.js'
import { readLogsToolDefinition, readLogsToolExecutor } from './read-logs.js'

/**
 * Returns a StaticToolProvider pre-loaded with built-in tools:
 * - echo
 * - get_current_time
 */
export function createBuiltinToolProvider(): StaticToolProvider {
  return new StaticToolProvider(
    'builtin',
    'builtin',
    [echoToolDefinition, getCurrentTimeToolDefinition],
    {
      echo: echoToolExecutor,
      get_current_time: getCurrentTimeToolExecutor,
    },
  )
}

/**
 * Returns a StaticToolProvider pre-loaded with Skill toolset:
 * - list_skills (fallback discovery)
 * - read_skill (load full SKILL.md)
 * - run_script (execute skill script)
 */
export function createSkillToolProvider(): StaticToolProvider {
  return new StaticToolProvider(
    'skill',
    'skill',
    [listSkillsToolDefinition, readSkillToolDefinition, runScriptToolDefinition],
    {
      list_skills: listSkillsToolExecutor,
      read_skill: readSkillToolExecutor,
      run_script: runScriptToolExecutor,
    },
  )
}

/**
 * Returns a StaticToolProvider pre-loaded with self-management tools:
 * - write_skill (create / update Skills)
 * - read_logs  (review recent tool-call logs)
 */
export function createSelfManagementToolProvider(): StaticToolProvider {
  return new StaticToolProvider(
    'self-management',
    'builtin',
    [writeSkillToolDefinition, readLogsToolDefinition],
    {
      write_skill: writeSkillToolExecutor,
      read_logs: readLogsToolExecutor,
    },
  )
}
