---
skill-id: manage-mcp
description: |
  管理 MCP (Model Context Protocol) server 的注册与注销。
  支持查看当前已注册列表、添加新 server、卸载 server。
  配置持久化到 workspace/mcp-registry.json，重启后自动恢复。
permissions:
  read: [".", "workspace"]
  net: ["127.0.0.1"]
  write: ["workspace"]
  env: ["SKILL_ARGS", "SKILL_ID", "THEWORLD_INTERNAL_PORT", "THEWORLD_WORKSPACE_DIR", "OPENKIN_INTERNAL_PORT", "OPENKIN_WORKSPACE_DIR"]
---

# manage-mcp Skill

## 能力说明

让 Agent 动态管理 MCP server 的接入，无需重启服务：

- **list-mcp.ts**：查看当前已持久化的 MCP server 列表
- **add-mcp.ts**：注册新的 MCP server（stdio 方式），热更新到运行中的 server
- **remove-mcp.ts**：注销 MCP server，同时从持久化配置中删除

## 持久化格式（workspace/mcp-registry.json）

```json
{
  "version": 1,
  "servers": [
    {
      "id": "everything",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "env": {}
    }
  ]
}
```

- `id`：唯一标识符（只允许 `[a-z0-9-]+`）
- `command`：可执行文件路径（如 `npx`、`node`、绝对路径）
- `args`：命令行参数数组
- `env`：注入给子进程的额外环境变量

## 脚本说明

所有脚本通过 `SKILL_ARGS`（JSON 字符串）接收参数，通过 `stdout` 输出 JSON 结果。

### list-mcp.ts

列出 `mcp-registry.json` 中所有已注册的 server。

```bash
SKILL_ARGS='{}' SKILL_ID="manage-mcp" tsx list-mcp.ts
```

输出：
```json
{ "servers": [ { "id": "...", "command": "...", "args": [], "env": {} } ] }
```

### add-mcp.ts

添加新的 MCP server 并热注册到运行中的 server。

```bash
SKILL_ARGS='{"id":"my-mcp","command":"npx","args":["-y","some-mcp-server"],"env":{}}' SKILL_ID="manage-mcp" tsx add-mcp.ts
```

参数：
- `id`（string，必填）：唯一标识，格式 `[a-z0-9-]+`
- `command`（string，必填）：可执行文件
- `args`（string[]，可选）：命令行参数
- `env`（object，可选）：额外环境变量

输出：
```json
{ "id": "my-mcp", "registered": true }
```

### remove-mcp.ts

卸载并热注销 MCP server。

```bash
SKILL_ARGS='{"id":"my-mcp"}' SKILL_ID="manage-mcp" tsx remove-mcp.ts
```

参数：
- `id`（string，必填）：要卸载的 server id

输出：
```json
{ "id": "my-mcp", "unregistered": true }
```

## 内部 API（仅 loopback）

脚本通过以下 HTTP API 与运行中的 server 通信：

- `GET  /_internal/mcp/list`
- `POST /_internal/mcp/register`  —  body: `{ id, command, args, env }`
- `POST /_internal/mcp/unregister` — body: `{ id }`

兼容说明：

- 默认优先读取 `THEWORLD_INTERNAL_PORT` 与 `THEWORLD_WORKSPACE_DIR`
- 兼容期内仍回退读取 `OPENKIN_INTERNAL_PORT` 与 `OPENKIN_WORKSPACE_DIR`
