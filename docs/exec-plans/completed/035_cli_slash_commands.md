# 035 CLI Slash Commands（交互态斜杠命令）

## 目标

在保留外层 CLI 子命令的前提下，为 `openkin chat` 增加**交互态内部斜杠命令**。

冻结原则：

- 外层命令继续存在：`openkin chat`、`openkin sessions ...`、`openkin inspect ...`、`openkin tasks ...`
- 进入 `chat` 之后，内部控制命令改为 slash commands
- slash commands 只在 CLI 壳层内拦截，不新增 service contract

---

## 当前前置状态

假定以下已完成：

- `029` 基础 CLI Foundation
- `031` 会话工作流
- `033` tasks 与 inspect

当前已知缺口：

- 进入 `chat` 后，`/help`、`/session ...`、`/inspect ...`、`/tasks ...` 仍会被当作普通用户消息发给 server

---

## 本轮范围（冻结）

必须实现以下 slash commands：

1. `/help`
2. `/session show`
3. `/session messages`
4. `/session delete`
5. `/inspect health`
6. `/inspect status`
7. `/tasks list`
8. `/tasks show`
9. `/tasks runs`
10. `/exit`

允许的行为：

- slash command 在本地 CLI 内执行
- 正常文本输入继续走聊天链路

---

## 本轮不做

- 不做 slash command 自动补全
- 不做 fuzzy 选择器
- 不做 `/agents`
- 不做 `/plan`
- 不做多 Agent / plan mode
- 不做 slash 命令动态注册系统
- 不做服务端 slash command 协议

---

## 单一路径实现要求

1. 在 `packages/cli/src/cmd-chat.ts` 内识别 `/` 前缀输入
2. 建立最小 slash command parser
3. 先支持 `/help` 与 `/exit`
4. 再接 `session` / `inspect` / `tasks` 只读或低风险命令
5. 尽量复用已有 CLI 命令处理逻辑，不复制业务实现
6. 更新 help 文案，说明“外层子命令 + 交互态 slash commands”的双层模型
7. 新增 smoke 覆盖 `/help` 和至少 2 条 slash command

---

## 允许修改的目录

- `packages/cli/`
- `scripts/`
- 根目录 `package.json`（仅 CLI/test scripts）
- `docs/exec-plans/active/`

## 禁止修改的目录

- `packages/sdk/client/src/`
- `packages/sdk/operator-client/`（默认不改）
- `packages/shared/contracts/src/`
- `packages/server/src/http-server.ts`
- `packages/core/src/`

---

## 验收标准

1. `openkin chat` 内输入 `/help` 能显示帮助
2. `openkin chat` 内输入 `/exit` 能退出
3. 至少 3 条 slash command 能正常执行
4. 普通文本输入仍按聊天消息发送
5. `pnpm test:project-cli` 通过
6. `pnpm verify` 通过

---

## 必跑命令

1. `pnpm test:project-cli`
2. `pnpm verify`

---

## 升级条件

命中以下任一情况时立即停止并升级：

- 需要把 slash commands 下沉为服务端协议
- 需要改共享 contract 或 SDK 边界
- 需要引入 plan mode、多 Agent、回滚、打断
- 需要做动态命令注册系统
- 连续两轮无法同时通过 `pnpm test:project-cli` 与 `pnpm verify`

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

当前任务：
为 `openkin chat` 增加交互态 slash commands。

任务范围：
- 允许修改的目录：
  - packages/cli/
  - scripts/
  - package.json（仅 CLI/test scripts）
- 不允许修改的目录：
  - packages/sdk/client/src/
  - packages/shared/contracts/src/
  - packages/server/src/http-server.ts
  - packages/core/src/

不做什么：
- 不做动态命令系统
- 不做 /plan
- 不做多 Agent
- 不做服务端 slash 协议

验收标准：
- `pnpm test:project-cli` 通过
- `pnpm verify` 通过

升级条件：
- 需要改 contract / SDK 边界
- 需要扩到 plan mode / 多 Agent / 回滚 / 打断
- 连续两轮无法通过验收
```
