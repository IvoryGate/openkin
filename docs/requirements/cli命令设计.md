# cli命令设计

## 已实现命令

### 启动命令

```bash
TheWorld CLI — command-line shell for a running server.

Run via `pnpm theworld` or call the CLI entry directly.

Surface product name is TheWorld; configure the CLI with THEWORLD_* env vars.

In chat: type /help for local slash commands (not sent to the server).

Configuration (highest priority first):
  --server-url <url>     Overrides THEWORLD_SERVER_URL
  --api-key <key>        Overrides THEWORLD_API_KEY
  Default server URL:    http://127.0.0.1:3333

Usage:
  theworld help [topic]
  theworld chat [--session <id>]
  theworld sessions <subcommand> ...
  theworld inspect <subcommand> ...
  theworld tasks <subcommand> ...

Topics:  help sessions | inspect | tasks

Global flags:
  --json                  Machine-readable JSON where supported
  --server-url <url>      Server base URL
  --api-key <key>         API key
  -h, --help              Help for the current command
```

### 斜杠命令

```bash
/help
/exit
/session show
/session messages [limit]
/session delete   → deletes this session, starts a new one
/inspect health
/inspect status
/tasks list
/tasks show <task-id>
/tasks runs <task-id>
```

## 第二批计划

`theworld`太长，且不好记忆，将启动命令简写为`world`

### 启动命令

| 命令                        | 功能            |
| ------------------------- | ------------- |
| `world`                   | 启动交互式 REPL 会话 |
| `world "task"`            | 带初始提示启动会话     |
| `world -c` / `--continue` | 继续当前目录的最近一次会话 |
| `world --resume <id>`     | 恢复指定 ID 的会话   |
| `world --verbose`         | 启用详细日志输出      |

### 斜杠命令

- `/skills` 显示所有可用skills
- `/clear` 清空上下文
- `/compact [require]` 压缩上下文，可添加说明
- `/rewind [step_id]` 默认回退到上一步，可选会退到指定步，这里也许需要和git之类的结合起来使用，避免创建修改的某些文件回不去
- `/rename <name>` 重命名当前会话
- `/resume [name\|id]` 恢复之前的会话