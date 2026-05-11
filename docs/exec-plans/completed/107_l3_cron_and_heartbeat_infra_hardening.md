# 107 · L3 Cron 与 Heartbeat 基础设施收口

## 背景与问题边界

当前“定时任务创建”主要由 `workspace/skills/create-task` 触发。Skill 层本质是可变扩展层，不适合作为 L3 调度能力的唯一入口，导致以下风险：

- 调度入口依赖 Skill 可用性与脚本约定，稳定性不达基础设施标准
- 提示词容易把“定时任务”误导为“写 Skill 实现”
- heartbeat 仅体现在 SSE keepalive 注释，缺少统一状态视图

本单目标是把 Cron 与 Heartbeat 明确收口为 L3 基础设施 contract，而非 Skill 约定。

## 影响范围（跨层）

- **L3 Service & Protocol Layer**
  - 新增内置工具 `create_task`（直接写入 `scheduled_tasks`）
  - `GET /v1/system/status` 增补 heartbeat 视图
- **L4 Engineering Product Shell**
  - Agent 系统提示词切换为“优先 `create_task`”，不再依赖 `create-task` Skill
- **不影响**
  - 不改 `scheduled_tasks` / `task_runs` 表结构
  - 不改现有 `POST /v1/tasks` API contract
  - 不引入分布式 scheduler / leader election

## 冻结决策

1. `create-task` Skill 保留兼容，但不再是首选路径。
2. Cron/interval/once 创建能力以内置工具 `create_task` 为主路径。
3. heartbeat 先做**进程内可观测收口**，不在本单引入跨进程全序心跳。

## 实施清单（单一路径）

1. 新增 `packages/server/src/task-infra-tool-provider.ts`
   - `create_task` 输入校验
   - 复用 `validateTaskTrigger` / `computeInitialNextRun`
   - 写入 DB 并返回结构化任务信息
2. 在 `packages/server/src/cli.ts` 注入该 provider，并改写系统提示词中的调度指引
3. 新增 heartbeat 注册表（进程内）
   - scheduler tick 记心跳
   - task SSE keepalive 定时器记心跳
4. 扩展 `SystemStatusResponseBody` 与 `/v1/system/status` 返回 heartbeat 字段
5. 执行 `pnpm verify`

## 验收结果

- `pnpm verify` 通过（本单收口时已完整执行）
- 运行中 `GET /v1/system/status` 包含：
  - `taskScheduler.*`（既有）
  - `heartbeat.schedulerLastBeatAt`
  - `heartbeat.taskSseLastBeatAt`
- Agent 在“定时/周期”请求下优先调用 `create_task`，而非要求新建 Skill

## 升级条件（交给 high-capability 或人工）

- 需要跨进程 heartbeat 真理源（control plane / DB lease）
- 需要改动 `scheduled_tasks`/`task_runs` schema
- 需要引入分布式 cron 分片或 leader 选主
