export { echoToolDefinition, echoToolExecutor } from './echo.js'
export { getCurrentTimeToolDefinition, getCurrentTimeToolExecutor } from './get-current-time.js'
export { McpToolProvider, type McpToolProviderOptions } from './mcp-tool-provider.js'
export { listSkillsToolDefinition, listSkillsToolExecutor, listSkills, type SkillEntry } from './list-skills.js'
export { readSkillToolDefinition, readSkillToolExecutor } from './read-skill.js'
export { runScriptToolDefinition, runScriptToolExecutor } from './run-script.js'
export { writeSkillToolDefinition, writeSkillToolExecutor } from './write-skill.js'
export { readLogsToolDefinition, readLogsToolExecutor } from './read-logs.js'
export { runCommandToolDefinition, runCommandToolExecutor } from './run-command.js'
export {
  readFileToolDefinition,
  readFileToolExecutor,
  writeFileToolDefinition,
  writeFileToolExecutor,
  listDirToolDefinition,
  listDirToolExecutor,
} from './fs-tools.js'

import { StaticToolProvider } from '../tool-runtime.js'
import { getCurrentTimeToolDefinition, getCurrentTimeToolExecutor } from './get-current-time.js'
import { listSkillsToolDefinition, listSkillsToolExecutor } from './list-skills.js'
import { readSkillToolDefinition, readSkillToolExecutor } from './read-skill.js'
import { runScriptToolDefinition, runScriptToolExecutor } from './run-script.js'
import { writeSkillToolDefinition, writeSkillToolExecutor } from './write-skill.js'
import { readLogsToolDefinition, readLogsToolExecutor } from './read-logs.js'
import { runCommandToolDefinition, runCommandToolExecutor } from './run-command.js'
import {
  readFileToolDefinition,
  readFileToolExecutor,
  writeFileToolDefinition,
  writeFileToolExecutor,
  listDirToolDefinition,
  listDirToolExecutor,
} from './fs-tools.js'

/**
 * Core built-in tools available to the Agent:
 * - get_current_time
 * - run_command   (execute shell commands)
 * - read_file     (read a file)
 * - write_file    (write a file)
 * - list_dir      (list directory contents)
 *
 * Note: `echo` is intentionally excluded — it was misleading the model into
 * using it as a "thinking output" tool. Use run_command for real shell work.
 */
export function createBuiltinToolProvider(): StaticToolProvider {
  return new StaticToolProvider(
    'builtin',
    'builtin',
    [
      getCurrentTimeToolDefinition,
      runCommandToolDefinition,
      readFileToolDefinition,
      writeFileToolDefinition,
      listDirToolDefinition,
    ],
    {
      get_current_time: getCurrentTimeToolExecutor,
      run_command: runCommandToolExecutor,
      read_file: readFileToolExecutor,
      write_file: writeFileToolExecutor,
      list_dir: listDirToolExecutor,
    },
  )
}

/**
 * Skill toolset:
 * - list_skills   (discover available Skills)
 * - read_skill    (load SKILL.md)
 * - run_script    (execute skill script)
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
 * Self-management tools:
 * - write_skill   (create / update Skills)
 * - read_logs     (review recent tool-call logs)
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
