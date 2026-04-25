import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createRunError } from '@theworld/shared-contracts'
import type { ToolDefinition, ToolExecutor, ToolProvider } from '../tool-runtime.js'
import type { ToolResult } from '@theworld/shared-contracts'

export interface McpToolProviderOptions {
  /** Unique identifier for this provider */
  id: string
  /** Command to launch the MCP server process */
  command: string
  /** Arguments to the command */
  args?: string[]
  /** Environment variables to pass to the subprocess */
  env?: Record<string, string>
}

export class McpToolProvider implements ToolProvider {
  readonly id: string
  readonly sourceType = 'mcp' as const

  private _client: Client | null = null
  private _tools: ToolDefinition[] = []
  private _connected = false
  private _refreshing = false
  private readonly _options: McpToolProviderOptions

  constructor(options: McpToolProviderOptions) {
    this._options = options
    this.id = options.id
  }

  async connect(): Promise<void> {
    const transport = new StdioClientTransport({
      command: this._options.command,
      args: this._options.args ?? [],
      env: this._options.env,
    })

    this._client = new Client(
      { name: `theworld-mcp-${this.id}`, version: '1.0.0' },
      {
        capabilities: {},
        listChanged: {
          tools: {
            autoRefresh: false, // We handle refresh manually
            debounceMs: 0,
            onChanged: () => {
              // Called when server sends tools/list_changed notification
              // autoRefresh=false means items will be null; we refresh manually
              this.refreshTools().catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err)
                console.error(`[McpToolProvider:${this.id}] refreshTools error after listChanged: ${msg}`)
              })
            },
          },
        },
      },
    )

    await this._client.connect(transport)
    this._connected = true

    // Initial tool list
    await this.refreshTools()
  }

  async disconnect(): Promise<void> {
    if (this._client) {
      try {
        await this._client.close()
      } catch {
        // ignore close errors
      }
      this._client = null
    }
    this._connected = false
    this._tools = []
  }

  async refreshTools(): Promise<void> {
    if (!this._client || !this._connected) return
    // Serialize: if already refreshing, skip this cycle
    if (this._refreshing) return
    this._refreshing = true
    try {
      const result = await this._client.listTools()
      this._tools = (result.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description ?? '',
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
        metadata: { sourceType: 'mcp', providerId: this.id },
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[McpToolProvider:${this.id}] refreshTools error: ${msg}`)
      // Retain stale cache; do not rethrow – server must not crash
    } finally {
      this._refreshing = false
    }
  }

  async listTools(): Promise<ToolDefinition[]> {
    return this._tools
  }

  async getExecutor(name: string): Promise<ToolExecutor | undefined> {
    if (!this._tools.find((t) => t.name === name)) return undefined

    const client = this._client
    const providerId = this.id
    const getConnected = () => this._connected

    return {
      async execute(input: Record<string, unknown>, context): Promise<ToolResult> {
        if (!client || !getConnected()) {
          return {
            toolCallId: `mcp-${context.stepIndex}`,
            name,
            output: createRunError(
              'TOOL_EXECUTION_FAILED',
              `MCP provider ${providerId} is not connected`,
              'tool',
            ),
            isError: true,
          }
        }

        try {
          const result = await client.callTool({ name, arguments: input })
          const isError = result.isError === true
          return {
            toolCallId: `mcp-${context.stepIndex}`,
            name,
            output: result.content,
            isError,
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          return {
            toolCallId: `mcp-${context.stepIndex}`,
            name,
            output: createRunError('TOOL_EXECUTION_FAILED', `MCP tool ${name} failed: ${msg}`, 'tool'),
            isError: true,
          }
        }
      },
    }
  }
}
