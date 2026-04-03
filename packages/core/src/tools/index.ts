import { StaticToolProvider } from '../tool-runtime.js'
import { echoToolDefinition, echoToolExecutor } from './echo.js'
import { getCurrentTimeToolDefinition, getCurrentTimeToolExecutor } from './get-current-time.js'

export { echoToolDefinition, echoToolExecutor } from './echo.js'
export { getCurrentTimeToolDefinition, getCurrentTimeToolExecutor } from './get-current-time.js'
export { McpToolProvider, type McpToolProviderOptions } from './mcp-tool-provider.js'
export { SkillToolProvider, type SkillManifest, type SkillToolEntry } from './skill-tool-provider.js'

/**
 * Creates a StaticToolProvider pre-loaded with the built-in tools:
 * - echo: returns the input text unchanged
 * - get_current_time: returns the current UTC ISO timestamp
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
