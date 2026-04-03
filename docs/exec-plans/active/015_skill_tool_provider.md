# 015 Skill Tool Provider

## 目标

把 **Skill** 作为一种工具来源接入 `ToolProvider` 体系，建立首期 Skill 加载框架，让 Skill 能以**文件系统本地加载**的方式注册工具，进入 ReAct 循环。

Skill 是比 MCP 更轻量的内部能力单元：它不需要独立进程、不需要网络协议，直接在 TypeScript 模块层面注册工具定义和执行器。它适合**框架内部扩展**（区别于 MCP 的跨进程/跨语言外部扩展）。

本计划默认建立在 [`013`](./013_tool_and_integration_layer_v1.md) 已完成的前提上。

---

## 背景与概念边界

在本仓库的分层语境中，"Skill"的含义是：

> 一个自包含的能力单元，向 Agent 贡献一批工具定义与执行器，可以按需加载，不依赖外部进程或协议。

与其他工具来源的对比：

| 来源 | sourceType | 通信方式 | 适用场景 |
|---|---|---|---|
| 内置工具 | `builtin` | 同进程函数调用 | 框架默认能力（echo、time） |
| Skill | `skill` | 同进程模块加载 | 内部能力包、场景化工具集 |
| MCP | `mcp` | 子进程 stdio / HTTP | 跨语言外部工具服务 |
| Custom | `custom` | 上层注入 | 业务侧一次性扩展 |

Skill 与 builtin 的核心区别：builtin 工具是框架硬编码的默认能力；Skill 是**可插拔的、按需加载**的能力包，可以在不修改 core 的前提下扩展工具集。

---

## 已冻结决策

### Skill 的最小结构

首期 Skill 只需要满足以下接口，不做复杂元数据或版本系统：

```typescript
export interface SkillManifest {
  /** Skill 唯一标识，在同一 SkillRegistry 中不允许重复 */
  id: string
  /** 人类可读名称 */
  name: string
  /** 此 Skill 贡献的工具列表 */
  tools: SkillToolEntry[]
}

export interface SkillToolEntry {
  definition: ToolDefinition
  executor: ToolExecutor
}
```

一个 Skill 模块的默认导出必须是：

```typescript
// 例：packages/core/src/skills/weather-skill.ts
export default {
  id: 'weather',
  name: 'Weather Skill',
  tools: [
    { definition: weatherToolDef, executor: weatherExecutor },
  ],
} satisfies SkillManifest
```

### Skill 加载方式

首期只支持 **静态注册**：在 server 启动时显式 `import` 并传入 `SkillToolProvider`。

不支持：
- 从文件系统目录动态扫描加载（即不做 `fs.readdir` + 动态 `import()`）
- 运行时热加载 / 热卸载
- npm 包形式的远程 Skill 拉取

原因：动态加载引入运行时安全和可预期性问题，超出首期目标；静态注册足以验证接口抽象是否正确。

### `SkillToolProvider` 的位置

新建 `packages/core/src/tools/skill-tool-provider.ts`，与 `mcp-tool-provider.ts` 同目录。

### 首期 Demo Skill：迁移 `get_weather`

为了让测试有意义，首期 Demo Skill 将 `apps/dev-console/src/demo-shared.ts` 中的 `get_weather` 提炼成一个**独立的 Demo Skill 模块**，放在 `packages/core/src/skills/demo-weather-skill.ts`。

注意：**不修改** `demo-shared.ts` 本身——它继续持有自己的 `get_weather`，供 dev-console 的 live/interactive demo 使用。`demo-weather-skill.ts` 是独立副本，仅用于 smoke 测试中验证 Skill 接入路径。

原因：
- `get_weather` 有固定输出（可断言），适合 smoke
- 迁移对 dev-console 无影响
- 与 builtin 的 `echo` / `get_current_time` 形成明确的来源区分（`skill` vs `builtin`）

### 首期冻结接口：`SkillToolProvider`

```typescript
export class SkillToolProvider implements ToolProvider {
  readonly id: string
  readonly sourceType = 'skill' as const

  constructor(manifests: SkillManifest[]) { ... }

  async listTools(): Promise<ToolDefinition[]>
  async getExecutor(name: string): Promise<ToolExecutor | undefined>
}
```

- 构造时将所有 manifest 的 tools 展平为内部 Map
- 同名工具：后注册的覆盖先注册的（首期简单策略，不升级条件）
- 无异步初始化，不需要 `connect()` / `disconnect()`

### `SkillManifest` 的存放位置

`SkillManifest` 和 `SkillToolEntry` 接口定义放在 `packages/core/src/tools/skill-tool-provider.ts` 中，**不放入 `packages/shared/contracts`**。

原因：Skill 是框架内部的能力组织机制，不需要跨层共享（SDK 和 channel 不感知 Skill 的存在）。

### 错误模型

与现有错误路径对齐：
- 工具执行失败 → `ToolResult.isError = true`，`output` 为 `RunError`（`TOOL_EXECUTION_FAILED`）
- Skill 中不存在的工具 → `getExecutor` 返回 `undefined`，由 `executeToolCall` 转为 `TOOL_NOT_FOUND`（已有逻辑）

---

## 影响范围

| 层级 | 影响 |
|---|---|
| `packages/core/src/tools/` | 新增 `skill-tool-provider.ts`，更新 `index.ts` 导出 |
| `packages/core/src/skills/` | 新建目录，新增 `demo-weather-skill.ts` |
| `packages/server/src/cli.ts` | 注入包含 `SkillToolProvider`（含 demo-weather skill）的 `InMemoryToolRuntime` |
| `scripts/` | 新增 `test-skills.mjs` smoke 脚本 |
| `package.json`（根） | 新增 `test:skills` 脚本，纳入 `verify` |
| 文档 | 更新 `docs/architecture/ARCHITECTURE.md`（Tool Layer Skill 状态说明） |

---

## 允许修改的目录

- `packages/core/src/tools/`
- `packages/core/src/skills/`（新建）
- `packages/core/src/index.ts`
- `packages/server/src/cli.ts`
- `scripts/`
- `docs/architecture/ARCHITECTURE.md`
- `docs/exec-plans/active/`
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/src/tool-runtime.ts`（接口不变）
- `packages/core/src/run-engine.ts`
- `packages/core/src/types.ts`
- `packages/shared/contracts/`（Skill 不是跨层 DTO）
- `packages/server/src/http-server.ts`
- `packages/sdk/client/`
- `packages/channel-core/`
- `apps/dev-console/src/demo-shared.ts`（**不修改**，demo-weather-skill 是独立副本）

---

## 本轮范围

1. **新建** `packages/core/src/tools/skill-tool-provider.ts`
   - 定义 `SkillManifest`、`SkillToolEntry` 接口
   - 实现 `SkillToolProvider`（`sourceType: 'skill'`）
   - 构造时展平所有 manifest 工具到内部 Map

2. **更新** `packages/core/src/tools/index.ts`
   - 导出 `SkillToolProvider`、`SkillManifest`、`SkillToolEntry`

3. **新建** `packages/core/src/skills/demo-weather-skill.ts`
   - 提炼 `get_weather` 工具（固定天气表，城市推断逻辑）
   - 默认导出 `SkillManifest` 对象

4. **新建** `packages/core/src/skills/index.ts`
   - 导出 `demoWeatherSkill`（及未来其他 skill）

5. **更新** `packages/core/src/index.ts`
   - re-export `packages/core/src/skills/index.ts`

6. **更新** `packages/server/src/cli.ts`
   - 在 `InMemoryToolRuntime` 中追加 `SkillToolProvider([demoWeatherSkill])`
   - 与已有的 builtin provider 并列（以及 MCP provider，如果 014 已完成）

7. **新增** `scripts/test-skills.mjs`
   - 启动本地 server 子进程
   - 创建 session → 发起 run（prompt 触发 `get_weather`）
   - SSE 确认 `run_completed`，断言 `steps` 中的 `toolCalls` 来自 skill 工具

8. **更新** 根 `package.json`：`"test:skills": "node scripts/test-skills.mjs"` 纳入 `verify`

---

## 本轮不做

- 不实现 Skill 的文件系统动态扫描加载
- 不实现 Skill 的版本管理、依赖声明、冲突解决
- 不实现 Skill 的热加载 / 热卸载
- 不实现 Skill 的权限声明（首期 `AllowAllToolAccessPolicy` 已足够）
- 不实现 Skill 的 npm 包分发
- 不把 Skill 暴露为 Service API（无 skill 注册/列表 endpoint）
- 不修改 `ToolProvider` / `ToolRuntime` / `ToolExecutor` 接口
- 不新增 shared contract 中的 DTO

---

## 验收标准

1. `packages/core` 导出 `SkillToolProvider`，接受 `SkillManifest[]`，实现 `ToolProvider` 接口（`sourceType: 'skill'`）。
2. `packages/core/src/skills/demo-weather-skill.ts` 满足 `SkillManifest` 接口，可被 `SkillToolProvider` 加载。
3. `packages/server/src/cli.ts` 注入包含 skill 工具的 `InMemoryToolRuntime`，ReAct 循环可触发 skill 工具调用。
4. `scripts/test-skills.mjs` smoke 通过：session 创建、run 提交、SSE 收到 `run_completed`，且 `steps` 中有 skill 工具的 `toolCalls`。
5. `apps/dev-console/src/demo-shared.ts` 未被修改（原有 `get_weather` 行为不变）。
6. `pnpm verify` 通过（含新增 `test:skills`）。
7. `docs/architecture/ARCHITECTURE.md` Tool Layer Skill 状态说明已更新。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:skills`

在 `test:skills` 尚未落地前，不允许宣称本计划完成。

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- 需要修改 `ToolProvider` / `ToolRuntime` / `ToolExecutor` 接口定义
- 需要在 `packages/shared/contracts` 中新增 Skill 相关跨层 DTO
- 需要实现动态文件系统扫描加载（超出本计划范围）
- 需要为 Skill 设计版本或依赖管理机制
- 需要把 `SkillManifest` 暴露为跨层 contract（当前只在 core 内部）
- 需要修改 `apps/dev-console/src/demo-shared.ts`（应保持不动）
- 连续两轮无法让 `pnpm verify` 与 `pnpm test:skills` 同时通过

---

## 依赖与顺序

- **前置**：[`013`](./013_tool_and_integration_layer_v1.md)（builtin tool 注册路径已验证）
- **与 014 的关系**：014 和 015 共享 `packages/server/src/cli.ts` 的修改点（都需要往 `InMemoryToolRuntime` 中注入 provider）。建议**先完成 014，再执行 015**，避免并行修改同一文件产生冲突。如需并行，必须先由 high-capability mode 明确冲突控制方式。
- **后续候选**：
  - Skill 元数据系统（版本、依赖声明）
  - Skill 动态加载框架（文件系统扫描 + 按需 import）
  - 工具级权限声明（在 `SkillManifest` 中声明所需权限）
  - 多 provider 工具名冲突解决策略（首期为覆盖，后续可升级为报错或命名空间）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|---|---|---|
| Skill 加载方式 | 静态注册 | 首期验证接口抽象；动态加载引入安全和可预期性问题，超出范围 |
| `SkillManifest` 位置 | `packages/core/src/tools/` | Skill 是框架内部机制，不需要跨层；放 core 保持边界清晰 |
| Demo Skill 内容 | 提炼 `get_weather` 为独立副本 | 有固定输出可断言；不改 demo-shared，不影响现有 demo |
| 同名工具冲突策略 | 后注册覆盖先注册 | 首期最简策略，符合预期，不引入复杂冲突解决机制 |
| `connect()` / `disconnect()` | 不需要，无异步初始化 | Skill 是同进程模块，无外部资源，无生命周期管理需求 |
| `SkillManifest` 接口是否进入 shared-contracts | **否** | SDK 和 channel 不需要感知 Skill 存在；共享反而是过度设计 |
| 与 014 的执行顺序 | 建议先 014 后 015 | 两者都改 `cli.ts`，顺序执行避免冲突 |
