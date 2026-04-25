# 032 CLI Operator Client Foundation（Operator 调用层基础）

## 目标

为 CLI 后续的 `inspect` 与 `tasks` 命令建立独立的 operator 调用层，但不破坏 `packages/sdk/client` 的已冻结边界。

本工作单只做**调用层基础设施**，不要求一次性实现所有 CLI 命令。

---

## 当前前置状态

假定以下内容已存在：

- 基础 CLI 包 `packages/cli/`
- `packages/sdk/client` 继续只负责 client surface
- 第三层 operator API 已落地：
  - `GET /v1/system/status`
  - `GET /v1/logs`
  - `GET /v1/tools`
  - `GET /v1/skills`
  - `GET/POST/... /v1/tasks`

---

## 本轮范围（冻结）

必须完成：

1. 新增独立包：
   - `packages/sdk/operator-client/`
2. 至少提供以下 typed methods：
   - `getSystemStatus()`
   - `listLogs(params?)`
   - `listTools()`
   - `listSkills()`
   - `listTasks()`
   - `getTask(taskId)`
   - `createTask(req)`
   - `triggerTask(taskId)`
   - `enableTask(taskId)`
   - `disableTask(taskId)`
   - `listTaskRuns(taskId)`
3. 基础错误处理与 `baseUrl/apiKey` 注入方式对齐现有 client sdk
4. 为该包补最小 smoke 或 typecheck 验证

---

## 本轮不做

- 不做 Agent CRUD 调用层
- 不做 heartbeat / SSE 订阅统一抽象
- 不做 task events SSE client
- 不做 logs stream SSE client
- 不做多 Agent / plan mode / orchestration interface
- 不改 `packages/sdk/client` 已有公开方法

---

## 单一路径实现要求

1. 新建 `packages/sdk/operator-client/`
2. 风格对齐 `packages/sdk/client`
3. 只包装现有 operator surface
4. 由 CLI 后续工作单消费该包
5. 为新包加入 workspace `check`

---

## 允许修改的目录

- `packages/sdk/operator-client/`
- `package.json`（仅脚本或 workspace 验证相关）
- `scripts/`
- `docs/exec-plans/active/`

## 禁止修改的目录

- `packages/sdk/client/src/`
- `packages/shared/contracts/src/`（默认不改）
- `packages/server/src/http-server.ts`
- `packages/core/src/`
- `packages/cli/`（除非仅接线极小导入修正；默认不改）

---

## 验收标准

1. 新包可通过 `pnpm check`
2. 至少有一条 smoke 路径验证 operator-client 可实际调用 server
3. `packages/sdk/client` 边界未被扩张
4. `pnpm verify` 通过

---

## 必跑命令

1. `pnpm check`
2. 与本包相关的 smoke 命令
3. `pnpm verify`

---

## 升级条件

命中以下任一情况时立即停止并升级：

- 需要为 operator-client 新增服务端 endpoint
- 需要修改 `packages/sdk/client` 的公开边界
- 需要修改共享 contract 才能表达现有 operator API 返回
- 需要把 SSE / heartbeat 抽象提升为共享订阅接口
- 连续两轮无法通过 `pnpm check` 与 `pnpm verify`

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

当前任务：
新增独立 operator-client 包，供 CLI 后续接入 inspect/tasks 命令使用。

任务范围：
- 允许修改的目录：
  - packages/sdk/operator-client/
  - scripts/
  - package.json（仅验证相关）
- 不允许修改的目录：
  - packages/sdk/client/src/
  - packages/shared/contracts/src/（默认不改）
  - packages/server/src/http-server.ts
  - packages/core/src/

不做什么：
- 不做 Agent CRUD
- 不做 SSE / heartbeat 抽象
- 不改 client sdk 边界

验收标准：
- `pnpm check` 通过
- 相关 smoke 通过
- `pnpm verify` 通过

升级条件：
- 需要新增 endpoint / DTO
- 需要改 client sdk 边界
- 连续两轮无法通过验收
```
