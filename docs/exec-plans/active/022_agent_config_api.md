# 022 Agent Config API（Agent 定义 CRUD）

## 目标

为 Service 层新增 Agent 配置管理 API，允许运行时动态创建、查询、更新、禁用 Agent 定义，
而不需要重启服务或修改代码。

完成后，上层（Channel Adapter、App 层）可以通过 REST API 管理多个 Agent 实例，
每个 Agent 拥有独立的 System Prompt、LLM 配置、工具/Skill 声明和记忆行为配置。

---

## 背景

### 当前 Agent 管理现状

| 能力 | 状态 |
|------|------|
| Agent 定义 | ✗（当前 `AgentDefinition` 在 `cli.ts` 硬编码，重启才能改） |
| 多 Agent 支持 | ✗（`OpenKinAgent` 是单 Agent） |
| Agent CRUD API | ✗ |
| Agent 配置持久化 | ✗ |

### 与 018 的关系

本计划依赖 018 的 SQLite，需要新增 `agents` 表。

### 设计取舍：首期做什么

原始方案（`AI_Agent_Backend_Tech_Plan.md` 2.3.3）的 `AgentConfig` 非常完整，包含 LLM 配置、Skills、MCP servers、RAG 开关等。
但在第三层首期，**大部分字段只做持久化存储，不做运行时生效**（例如 `mcpServers` 字段记录但不实际启停 MCP）。
运行时生效的复杂编排属于第四层的多 Agent 调度能力，不在本计划范围内。

**本计划只保证：**
- Agent 定义可持久化存储与 CRUD
- `systemPrompt`、`name`、`description` 字段在下一次 run 时生效（通过 `AgentDefinition` 注入）
- `enabled` 字段可以控制 Agent 是否对新 Session/run 可用

---

## 已冻结决策

### Agent 配置数据模型

**数据库新表（018 迁移脚本中追加，或新建 `002_agents.sql`）：**

```sql
CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  system_prompt TEXT NOT NULL,
  model         TEXT,            -- 可选，空则使用 server 默认 LLM
  enabled       INTEGER NOT NULL DEFAULT 1,  -- 0 | 1
  is_builtin    INTEGER NOT NULL DEFAULT 0,  -- 内置 Agent 不可删除
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
```

**首期只持久化以下字段（其他配置字段延后）：**

| 字段 | 说明 | 是否运行时生效 |
|------|------|---------------|
| `id` | Agent 唯一 ID | ✓ |
| `name` | 显示名称 | ✓（用于日志标识） |
| `description` | 能力描述（用于上层选 Agent） | 存储 |
| `systemPrompt` | 核心 System Prompt | ✓（注入到 `AgentDefinition`） |
| `model` | 指定 LLM 模型名（可选） | 存储，暂不切换 LLM provider |
| `enabled` | 是否可用 | ✓（POST /v1/runs 时检查） |
| `isBuiltin` | 是否内置（不可删除） | ✓ |

**不在本计划实现的字段：**
- `skills`、`mcpServers`、`plugins`（Skill/MCP 运行时绑定属于第四层）
- `memoryEnabled`、`ragEnabled`（记忆和 RAG 属于第四层）
- `temperature`、`maxTokens`、`maxSteps`（LLM 参数调优属于第四层）

### REST API 路由

```
GET    /v1/agents                获取 Agent 列表
GET    /v1/agents/:agentId       获取单个 Agent 配置
POST   /v1/agents                创建 Agent
PUT    /v1/agents/:agentId       更新 Agent（支持部分更新）
DELETE /v1/agents/:agentId       删除 Agent（isBuiltin=true 返回 403）
POST   /v1/agents/:agentId/enable    启用 Agent
POST   /v1/agents/:agentId/disable   禁用 Agent
```

### DTO 设计

```typescript
// 新增到 packages/shared/contracts
export interface AgentDto {
  id: string
  name: string
  description?: string
  systemPrompt: string
  model?: string
  enabled: boolean
  isBuiltin: boolean
  createdAt: number
  updatedAt: number
}

export interface CreateAgentRequest {
  id?: string            // 可选，不传则自动生成
  name: string
  description?: string
  systemPrompt: string
  model?: string
}

export interface UpdateAgentRequest {
  name?: string
  description?: string
  systemPrompt?: string
  model?: string
}

export interface ListAgentsResponseBody {
  agents: AgentDto[]
}
```

### `POST /v1/runs` 改造

当前 `POST /v1/runs` 不要求指定 `agentId`（使用 server 启动时注入的默认 Agent）。
本计划增加可选的 `agentId` 字段：

```typescript
export interface CreateRunRequest {
  sessionId: string
  input: RunInputDto
  agentId?: string     // 新增可选字段（向后兼容，不传则使用默认 Agent）
}
```

**如果 `agentId` 指定了：**
- 从 DB 查找对应 Agent
- 如果不存在或 `enabled=false`：返回 404 / 400
- 动态构建 `AgentDefinition`（systemPrompt 从 DB 取）并用于本次 run

### 默认 Agent

Server 启动时，如果 `agents` 表中没有任何 `isBuiltin=true` 的 Agent，自动插入一条以 `cli.ts` 中 `AgentDefinition` 为基础的内置 Agent，
`id` 为 `"default"`，`isBuiltin=true`。

这样现有的 `POST /v1/runs`（不传 `agentId`）等同于 `agentId: "default"`，完全向后兼容。

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/server/src/db/migrations/002_agents.sql` | 新增 `agents` 表 DDL |
| `packages/server/src/db/index.ts` | `Db` 接口增加 `agents: AgentRepository` |
| `packages/server/src/db/repositories.ts` | 实现 `AgentRepository` |
| `packages/server/src/http-server.ts` | 新增 Agent CRUD 路由；`POST /v1/runs` 支持可选 `agentId` |
| `packages/server/src/cli.ts` | 启动时写入内置 Agent（如果不存在） |
| `packages/shared/contracts/src/index.ts` | 新增 `AgentDto`、CRUD DTO、路由辅助函数 |
| `packages/sdk/client/src/index.ts` | 新增 Agent 管理方法 |
| `scripts/test-agent-config.mjs` | 新增 smoke 脚本 |
| `package.json`（根） | 新增 `test:agent-config`，纳入 `verify` |

---

## 允许修改的目录

- `packages/server/src/db/`
- `packages/server/src/http-server.ts`
- `packages/server/src/cli.ts`
- `packages/shared/contracts/src/index.ts`
- `packages/sdk/client/src/index.ts`
- `scripts/`
- `docs/exec-plans/active/`
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/`（不修改 `AgentDefinition` 接口）
- `packages/channel-core/`
- `apps/dev-console/`
- 现有路由的 DTO（breaking change）

---

## 本轮范围

1. **新建** `packages/server/src/db/migrations/002_agents.sql`
   - `agents` 表 DDL

2. **修改** `packages/server/src/db/index.ts`
   - `Db` 接口增加 `agents: AgentRepository`

3. **修改** `packages/server/src/db/repositories.ts`
   - 实现 `AgentRepository`（`insert`、`findById`、`listAll`、`update`、`delete`）

4. **修改** `packages/server/src/http-server.ts`
   - 7 条 Agent CRUD 路由
   - `POST /v1/runs` 支持可选 `agentId`（不传走默认 `"default"` Agent）

5. **修改** `packages/server/src/cli.ts`
   - 启动时检查并写入内置默认 Agent

6. **修改** `packages/shared/contracts/src/index.ts`
   - 新增 Agent DTO 和路由辅助函数

7. **修改** `packages/sdk/client/src/index.ts`
   - 新增 `listAgents()`、`getAgent(id)`、`createAgent(req)`、`updateAgent(id, req)`、`deleteAgent(id)`、`enableAgent(id)`、`disableAgent(id)`

8. **新增** `scripts/test-agent-config.mjs`
   - 创建 Agent → 查询 → 用该 Agent 发起 run → 禁用 → 验证 run 返回错误 → 删除

9. **更新** 根 `package.json`：`"test:agent-config": "node scripts/test-agent-config.mjs"` 纳入 `verify`

---

## 本轮不做

- 不实现 Skill / MCP 的 Agent 绑定运行时生效
- 不实现 `temperature`、`maxTokens`、`maxSteps` 运行时参数
- 不实现多 Agent 并发调度（属于第四层）
- 不实现 Agent 访问权限（ACL）
- 不实现 Agent 版本历史

---

## 验收标准

1. `POST /v1/agents` 创建 Agent 成功并持久化。
2. `GET /v1/agents` 列出包括默认内置 Agent 在内的所有 Agent。
3. `PUT /v1/agents/:id` 更新 systemPrompt 后，下次 `POST /v1/runs?agentId=xxx` 使用新 prompt。
4. `DELETE /v1/agents/:id`（非内置）成功；`isBuiltin=true` 的 Agent 删除返回 403。
5. `POST /v1/agents/:id/disable` 后，用该 `agentId` 发起 run 返回 400。
6. smoke 脚本所有断言通过。
7. `pnpm verify` 通过。
8. 不传 `agentId` 的 `POST /v1/runs` 行为与以前完全一致（向后兼容）。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:agent-config`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级：

- 需要修改 `packages/core/` 的 `AgentDefinition` 接口
- 需要实现 Skill/MCP 的运行时绑定（超出首期范围）
- `POST /v1/runs` 支持 `agentId` 时发现需要改 `ReActRunEngine` 接口
- 连续两轮无法让 `pnpm verify` 与 `test:agent-config` 同时通过

---

## 依赖与顺序

- **前置**：[`018`](./018_persistence_layer.md)（SQLite 基础设施必须存在）
- **前置**：[`020`](./020_auth_and_health.md)（Agent CRUD 必须受鉴权保护）
- **建议顺序**：018 → 020 → 021 → 022
- **解锁**：第四层多 Agent 调度（`agentId` 路由已建立，可扩展 Supervisor 模式）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 首期字段范围 | 只做 name/systemPrompt/enabled/isBuiltin | 避免过早锁定 Skill/MCP 绑定语义；运行时生效的复杂编排属于第四层 |
| 默认 Agent | 自动插入 `id="default"` | 保证向后兼容；Channel Adapter 可以直接指定 `agentId="default"` |
| `POST /v1/runs` 中 `agentId` 可选 | 是 | 向后兼容；Channel Adapter 可逐步迁移到指定 agentId |
| 内置 Agent 不可删 | 返回 403 | 防止默认 Agent 被误删导致现有 channel/SDK 调用全部失败 |
