# 048 CLI Chat Enhancements

## 目标

在现有 `pnpm theworld chat`（或 `pnpm world`）基础上，增加以下实用功能：

1. `world "task"` — 带初始提示启动会话（不进入 REPL 等待，直接发第一条消息后进入交互）
2. `world -c` / `world --continue` — 继续当前目录最近一次会话（从 DB 查最新 session）
3. `world --resume <id>` — 恢复指定 ID 的会话（等同于 `--session <id>`，更语义化）
4. 新增 slash 命令：
   - `/skills` — 列出可用 skills（调用 `GET /v1/skills`）
   - `/clear` — 清空当前回显（只是终端视觉清屏，不删 DB 数据）
   - `/compact [note]` — 在对话中发送一条特殊 system-level 提示让 Agent 压缩上下文摘要（前端约定，不改 API contract）
   - `/rename <name>` — 在本地标注当前会话 name（存 localStorage/本地文件，不写 DB，operator 层暂不支持）
   - `/rewind` — 保留占位，输出「暂不支持，需要服务端消息删除 API」

---

## 背景

`docs/requirements/cli命令设计.md` 已定义第二批计划中的命令设计。本工作单只实现 shell 层，不改 shared contract 和 server。

---

## 修改范围（冻结）

**允许修改（仅 `packages/cli/`）：**

- `packages/cli/src/args.ts` — 新增 `--continue`/`-c` 和 `--resume <id>` flag 解析；支持 positional arg 作为初始文本（`chat [text]`）
- `packages/cli/src/cmd-chat.ts` — 实现 `--continue` 逻辑（调用 `listSessions` 取最新 session）；支持初始提示直接发送后进入 REPL；支持 `--resume` 作为 `--session` 别名
- `packages/cli/src/slash-chat.ts` — 新增 `/skills`、`/clear`、`/compact`、`/rename`、`/rewind` 五个 slash 命令处理
- `packages/cli/src/help.ts` — 同步更新 `chat` 子命令帮助文本

**允许访问：**

- `packages/sdk/operator-client` 的 `listSessions` 方法（用于 `--continue` 查最新 session）
- 只读调用 `GET /v1/skills`（通过 `@theworld/operator-client` 中已有接口）

**禁止修改：**

- `packages/shared/contracts/`
- `packages/server/`
- `packages/core/`
- `packages/sdk/client/`
- `packages/channel-core/`
- DB schema

---

## 各功能详细设计（冻结）

### `world "task"` / `world chat "task"`

```bash
pnpm world "写一首关于春天的诗"
# 等价于：pnpm world chat "写一首关于春天的诗"
```

行为：
1. 创建新会话
2. 自动发送初始消息
3. 显示 Agent 回复后继续等待用户输入（进入 REPL）

实现：`cmd-chat.ts` 中如果 `args` 第一个非 flag 参数存在，则在会话创建后自动 `runChatTurn(ctx, sessionId, initialText)`。

### `world -c` / `world --continue`

行为：
1. 调用 `operatorClient.listSessions({ limit: 1 })` 获取最新 chat session
2. 如果找到，复用该 session（等同于 `--session <id>`）
3. 如果没有，创建新 session（输出提示「No recent session, starting new」）

注意：`operatorClient` 的 `listSessions` 已存在于 `packages/sdk/operator-client`。

### `world --resume <id>`

等同于 `--session <id>`，只是更语义化的别名。实现：`args.ts` 中将 `--resume` 映射到同一个 `sessionId` 字段。

### Slash 命令

**`/skills`**：调用 `GET /v1/skills`，以列表形式输出 skill id + 描述。

**`/clear`**：`process.stdout.write('\x1b[2J\x1b[H')` 清屏。不发 API 请求，不删数据。

**`/compact [note]`**：向当前 session 发送一条隐性提示（通过 `runChatTurn`）：
```
[System note] Please summarize the conversation so far into a compact context. Note: ${note || ''}
```
这是一个用户侧约定，不改 API contract，等于用户手动触发一次"请帮我总结"的 Run。

**`/rename <name>`**：在 CLI 进程本地记录一个 `Map<sessionId, name>`，在 banner 中展示。进程退出后不持久化（本期不做文件持久化）。

**`/rewind`**：打印「/rewind is not yet supported. It requires server-side message deletion API.」并提示用户改用 `--session` 开新会话。

---

## 验收标准

1. `pnpm world "hello"` 能直接发第一条消息后继续等待输入
2. `pnpm world -c` 能继续最近会话（或提示无历史）
3. `pnpm world --resume <id>` 能复用指定会话
4. `/skills` slash 命令在 chat 中可用
5. `/clear` 清屏后仍可继续对话
6. `/compact` 发送压缩请求后 Agent 回复
7. `/rename test` 后 slash 输出中能看到别名
8. `/rewind` 输出友好提示
9. `pnpm check` 通过
10. `pnpm verify` 通过（`test:project-cli` smoke 已覆盖基础 chat）

---

## 升级条件

如遇以下情况停止并升级到 high-capability mode：

- 需要修改 shared contract 才能实现某功能
- 需要 server 新增 endpoint
- `pnpm verify` 连续两轮不通过

---

## 依赖

- `047_world_cli_alias` 建议先完成（保证 `world` 命令入口存在），但本计划不严格依赖 047，可并行

---

## 必跑命令

```bash
pnpm check
pnpm verify
```

---

## 不做什么

- 不实现 `session rename` 的 server 端持久化（需要单独 API plan）
- 不实现 `/rewind` 的实际回滚（需要 server message delete API）
- 不做多模态输入（需要 Message 模型 contract 扩展）
- 不做 TTY 打断（需要 cancel run API 语义）
