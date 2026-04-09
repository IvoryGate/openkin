# 033 CLI Tasks And Inspect（任务与自检命令）

## 目标

在基础 CLI 和独立 operator-client 的前提下，交付一组真正能用于开发/值班的 CLI 命令。

本工作单完成后，CLI 至少应具备：

- 查看系统状态
- 查看工具与 Skill 清单
- 查询日志
- 列出与管理定时任务

---

## 当前前置状态

假定以下已完成：

- `029` 基础 CLI Foundation
- `031` 会话工作流
- `032` operator-client 基础

---

## 本轮范围（冻结）

必须实现以下命令：

### Inspect

1. `openkin inspect status`
2. `openkin inspect logs`
3. `openkin inspect tools`
4. `openkin inspect skills`

以上均要求：

- 文本输出
- `--json`

### Tasks

1. `openkin tasks list`
2. `openkin tasks show <id>`
3. `openkin tasks create --file <json-file>`
4. `openkin tasks trigger <id>`
5. `openkin tasks enable <id>`
6. `openkin tasks disable <id>`
7. `openkin tasks runs <id>`

其中：

- `create` 首期只接受 `--file <json-file>`
- 不做交互式表单
- 不做 Task 事件流订阅

---

## 本轮不做

- 不做 `agents` 命令
- 不做 logs stream SSE
- 不做 tasks events SSE
- 不做 task create 的自然语言封装
- 不做 task create 的交互向导
- 不做 heartbeat / 订阅抽象
- 不做多 Agent / plan mode

---

## 单一路径实现要求

1. 先接 `inspect` 只读命令
2. 再接 `tasks` 命令
3. 所有 operator 调用必须通过独立 `operator-client`
4. `tasks create` 使用 JSON 文件输入，避免在本阶段发明复杂 CLI 参数 DSL
5. 新增 smoke 覆盖：
   - `inspect status`
   - `inspect tools`
   - `tasks list`
   - `tasks create`
   - `tasks trigger`

---

## 允许修改的目录

- `packages/cli/`
- `packages/sdk/operator-client/`
- `scripts/`
- `package.json`（仅 CLI/test scripts）
- `docs/exec-plans/active/`

## 禁止修改的目录

- `packages/sdk/client/src/`
- `packages/shared/contracts/src/`（默认不改）
- `packages/server/src/http-server.ts`
- `packages/core/src/`
- `apps/web-console/`
- `apps/dev-console/`

---

## 验收标准

1. `inspect` 四条命令可执行
2. `tasks` 七条命令可执行
3. 文本输出和 `--json` 路径至少覆盖 `inspect status`、`tasks list`
4. `tasks create --file <json-file>` 成功创建任务
5. `pnpm test:project-cli` 通过
6. `pnpm verify` 通过

---

## 必跑命令

1. `pnpm test:project-cli`
2. `pnpm verify`

---

## 升级条件

命中以下任一情况时立即停止并升级：

- 需要新增 operator endpoint 或 DTO
- 需要实现 SSE / heartbeat 共享抽象
- 需要为 tasks create 发明新的复杂参数协议
- 需要把 agent 命令一并并入本计划
- 连续两轮无法同时通过 `pnpm test:project-cli` 与 `pnpm verify`

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

当前任务：
实现 CLI 的 inspect 与 tasks 命令，供真实开发/值班使用。

任务范围：
- 允许修改的目录：
  - packages/cli/
  - packages/sdk/operator-client/
  - scripts/
  - package.json（仅 CLI/test scripts）
- 不允许修改的目录：
  - packages/sdk/client/src/
  - packages/shared/contracts/src/（默认不改）
  - packages/server/src/http-server.ts
  - packages/core/src/

不做什么：
- 不做 agents
- 不做 SSE/heartbeat 抽象
- 不做自然语言 task create
- 不做多 Agent / plan mode

验收标准：
- `pnpm test:project-cli` 通过
- `pnpm verify` 通过

升级条件：
- 需要新增 endpoint / DTO
- 需要引入订阅抽象
- 连续两轮无法通过验收
```
