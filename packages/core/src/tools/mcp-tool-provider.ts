import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createRunError } from '@openkin/shared-contracts'
import type { ToolDefinition, ToolExecutor, ToolProvider } from '../tool-runtime.js'

export interface McpToolProviderOptions {
  /** Unique identifier, used as ToolProvider.id */
  id: string
  /** MCP server launch command, e.g. 'npx' */
  command: string
  /** Command arguments, e.g. ['-y', '@modelcontextprotocol/server-everything'] */
  args?: string[]
  /** Environment variables to pass to the child process */
  env?: Record<string, string>
}

/**
 * A ToolProvider that connects to a local MCP server via stdio transport.
 *
 * Lifecycle:
 * - Call `connect()` before injecting into InMemoryToolRuntime.
 * - Call `disconnect()` on process exit (SIGINT / SIGTERM).
 *
 * Tool list is fetched once at connect() time and cached; subsequent calls to
 * listTools() return the cached list without extra round-trips.
 */
export class McpToolProvider implements ToolProvider {
  readonly sourceType = 'mcp' as const
  readonly id: string

  private readonly options: McpToolProviderOptions
  private client: Client | null = null
  private cachedTools: ToolDefinition[] = []
  private connected = false

  constructor(options: McpToolProviderOptions) {
    this.id = options.id
    this.options = options
  }

  /**
   * Starts the MCP server subprocess, establishes the MCP session, and
   * pre-fetches the tool list. Must be called (and awaited) before use.
   */
  async connect(): Promise<void> {
    const transport = new StdioClientTransport({
      command: this.options.command,
      args: this.options.args,
      env: this.options.env,
      stderr: 'ignore',
    })

    const client = new Client(
      { name: 'openkin-mcp-client', version: '0.1.0' },
      { capabilities: {} },
    )

    await client.connect(transport)
    this.client = client
    this.connected = true

    // Pre-fetch and cache the tool list
    const result = await client.listTools()
    this.cachedTools = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }))
  }

  /**
   * Closes the MCP client connection and terminates the server subprocess.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close()
      } catch {
        // ignore errors on disconnect
      }
      this.client = null
    }
    this.connected = false
  }

  async listTools(): Promise<ToolDefinition[]> {
    return this.cachedTools
  }

  async getExecutor(name: string): Promise<ToolExecutor | undefined> {
    const def = this.cachedTools.find((t) => t.name === name)
    if (!def) return undefined

    const provider = this
    return {
      async execute(input, context) {
        if (!provider.connected || !provider.client) {
          return {
            toolCallId: `${name}-${context.stepIndex}`,
            name,
            output: createRunError(
              'TOOL_EXECUTION_FAILED',
              `MCP provider "${provider.id}" is not connected`,
              'tool',
              { toolName: name },
            ),
            isError: true,
          }
        }

        try {
          const result = await provider.client.callTool({ name, arguments: input })

          // Extract text content from MCP result
          const textParts = (result.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === 'text' && typeof c.text === 'string')
            .map((c) => c.text as string)

          const output: Record<string, unknown> =
            textParts.length === 1
              ? { text: textParts[0] }
              : textParts.length > 1
                ? { parts: textParts }
                : { raw: result.content }

          if (result.isError) {
            return {
              toolCallId: `${name}-${context.stepIndex}`,
              name,
              output: createRunError(
                'TOOL_EXECUTION_FAILED',
                textParts.join('\n') || `MCP tool "${name}" returned an error`,
                'tool',
                { toolName: name },
              ),
              isError: true,
            }
          }

          return {
            toolCallId: `${name}-${context.stepIndex}`,
            name,
            output,
          }
        } catch (err) {
          return {
            toolCallId: `${name}-${context.stepIndex}`,
            name,
            output: createRunError(
              'TOOL_EXECUTION_FAILED',
              err instanceof Error ? err.message : `MCP tool "${name}" failed`,
              'tool',
              { toolName: name },
            ),
            isError: true,
          }
        }
      },
    }
  }
}
