# 015 Skill Framework

## 目标

建立 openkin 的 **Skill 框架**：定义 Skill 的文件结构约定，并为 Agent 提供**读取和执行 Skill** 的内置能力，让 Agent 在 ReAct 循环中能发现、理解和调用 Skill。

本计划**不做静态 `ToolProvider` 绑定**，而是让 Skill 成为 Agent 在运行时动态理解和执行的能力单元。

本计划建立在 [`013`](./013_tool_and_integration_layer_v1.md) 已完成的前提上。

---

## 背景：Skill 的标准含义

### 标准参考

参照 OpenAI Agents SDK 的定义：
> **Skills** are pre-installed named scripts in a container. The agent uses tools (like `ShellTool`) to invoke them. A skill is: **a named script + documentation describing what it does and how to call it**.

参照 CatPaw Skill 的定义：
> A Skill is a **directory** containing a `SKILL.md` (capability description + invocation contract) and optionally one or more scripts. The scripts may be referenced from `SKILL.md` or inlined as code blocks. **The script name is not fixed**; the `SKILL.md` describes how to use it.

### openkin Skill 的定位

在 openkin 的语境中，Skill 是：

> 一个**目录**，包含 `SKILL.md`（能力说明文档）和任意数量的辅助脚本。Agent 通过读取 `SKILL.md` 理解该 Skill 能做什么，再根据文档指引调用文档中引用的工具、MCP 或直接执行目录内的脚本。

Skill 与其他能力来源的对比：

| 来源 | sourceType | 控制主体 | 调用方式 | 适用场景 |
|---|---|---|---|---|
| 内置工具 | `builtin` | 静态注册 | 编译时确定 | 框架核心能力（echo、time）|
| MCP | `mcp` | MCP server | 协议动态发现 | 跨语言外部服务 |
| **Skill** | `skill` | **Agent 运行时** | **读文档 + 动态执行** | 可插拔的文档化能力包 |

### Skill 与 ToolProvider 的根本区别

| | `ToolProvider` 模型 | Skill 模型 |
|---|---|---|
| 工具发现时机 | 编译时/启动时静态注册 | 运行时读 `SKILL.md` |
| 执行入口 | 固定 `ToolExecutor` 函数 | `SKILL.md` 描述的任意脚本/工具/MCP |
| Agent 角色 | 调用已知工具 | 理解文档 → 决定执行路径 |
| 脚本名称 | 固定（如 `handler.ts`） | **任意，不固定** |

因此，**Skill 不能塞进现有 `ToolProvider` 接口**。

---

## 已冻结决策

### Skill 的最小文件结构

```
packages/core/src/skills/
  <skill-name>/
    SKILL.md          ← 必须：能力说明、参数、脚本调用方式（可内嵌代码块）
    <任意>.ts         ← 可选：SKILL.md 引用的脚本，名称不固定
    <任意>.mjs        ← 可选：同上，可以有多个辅助脚本
```

约束：
- `SKILL.md` 是唯一强制文件，其余文件名不做约定
- `SKILL.md` 包含 YAML frontmatter（`skill-id`、`description`）+ markdown 正文
- 正文描述：该 Skill 能做什么、需要什么输入、如何调用（内嵌代码块或引用文件）
- 脚本可以内嵌在 `SKILL.md` 的代码块中（Agent 直接执行）
- 脚本也可以是独立文件（Agent 根据 `SKILL.md` 指引调用）
- **不存在固定的入口文件名**（不是 `handler.ts`，不是 `index.ts`）

### `SKILL.md` 标准格式

```markdown
---
skill-id: weather          # 唯一标识
description: |             # 给 Agent 读的能力描述（用于 skill 发现）
  查询城市天气的模拟工具。
  输入 city（城市名），返回天气预报字符串。
---

# Weather Skill

## 能力说明

查询指定城市的模拟天气预报。

## 参数

- `city`（string，必填）：城市名，支持中文或英文

## 调用方式

通过执行本目录下的 `weather.ts` 脚本：

```typescript
// weather.ts
import { ... } from '...'
// ...
```

或者直接使用以下内联逻辑：

```typescript
const table = { Beijing: '晴，25°C', Shanghai: '多云，28°C' }
const result = table[city] ?? '未知城市'
```

## 返回格式

```json
{ "city": "Beijing", "forecast": "晴，25°C" }
```
```

### Agent 调用 Skill 的两个内置工具

Skill 不通过 `ToolProvider` 静态注册，而是通过两个**内置工具**让 Agent 在运行时发现和执行 Skill：

#### `list_skills`（内置工具）

```typescript
// 工具描述
name: 'list_skills'
description: '列出所有可用的 Skill 及其描述，帮助 Agent 了解有哪些扩展能力可以使用'
inputSchema: {}  // 无参数

// 返回
output: {
  skills: [
    { skillId: string, description: string, path: string }
  ]
}
```

实现：扫描 `packages/core/src/skills/` 下所有 `SKILL.md`，读取 frontmatter，返回列表。

#### `read_skill`（内置工具）

```typescript
// 工具描述
name: 'read_skill'
description: '读取指定 Skill 的完整 SKILL.md 内容，让 Agent 了解如何调用该 Skill'
inputSchema: { skillId: string }

// 返回
output: { content: string }  // SKILL.md 的完整 markdown 内容
```

实现：根据 `skillId` 找到对应目录，读取 `SKILL.md`。

#### `run_script`（内置工具）

```typescript
// 工具描述
name: 'run_script'
description: '在 Skill 目录中执行指定脚本文件，或执行内联代码片段'
inputSchema: {
  skillId: string          // 所属 Skill
  script?: string          // 脚本文件名（相对于 skill 目录），与 inline 二选一
  inline?: string          // 内联 TypeScript/JavaScript 代码，与 script 二选一
  args?: Record<string, unknown>  // 传入脚本的参数（通过环境变量或 stdin）
}

// 返回
output: { stdout: string, stderr: string, exitCode: number }
```

实现：
- `script` 模式：在对应 Skill 目录中用 `tsx` 执行指定文件，`args` 通过环境变量传入
- `inline` 模式：把代码写入临时文件，用 `tsx` 执行，执行完删除临时文件
- 超时：30 秒（防止 Agent 无限等待）
- 安全：**首期只允许执行 `packages/core/src/skills/` 目录下的文件**，拒绝路径穿越

### ReAct 循环中的 Skill 调用路径

```
用户: "帮我查一下北京的天气"
  └─▶ Agent: [tool_call] list_skills
        └─▶ 返回: [{ skillId: 'weather', description: '查询城市天气...' }]
  └─▶ Agent: [tool_call] read_skill { skillId: 'weather' }
        └─▶ 返回: SKILL.md 全文（含调用方式）
  └─▶ Agent: [tool_call] run_script { skillId: 'weather', script: 'weather.ts', args: { city: '北京' } }
        └─▶ 返回: { stdout: '{"city":"北京","forecast":"晴，25°C"}', exitCode: 0 }
  └─▶ Agent: 北京今天天气晴，25°C。
```

### 首期 Demo Skill：天气查询

首期提供一个 Demo Skill：`packages/core/src/skills/weather/`，包含：
- `SKILL.md`：描述查询天气的能力、参数格式、调用方式
- `weather.ts`：实际执行逻辑（固定天气表，与 `demo-shared.ts` 的 `get_weather` 逻辑类似但独立）

**不修改** `apps/dev-console/src/demo-shared.ts`。

### 安全边界（首期）

- `run_script` 只允许执行 `packages/core/src/skills/` 内的文件（路径校验）
- `inline` 代码执行写入系统临时目录，执行后立即删除
- 不允许网络访问控制（首期不做沙箱）
- 超时 30 秒

### 对现有 contract 的影响

| 文件 | 是否修改 | 说明 |
|---|---|---|
| `packages/core/src/tool-runtime.ts` | **否** | 接口不变；`list_skills` / `read_skill` / `run_script` 作为 builtin 工具注册 |
| `packages/core/src/run-engine.ts` | **否** | ReAct 引擎不感知 Skill 存在 |
| `packages/shared/contracts/` | **否** | Skill 是框架内部机制 |
| `packages/server/src/http-server.ts` | **否** | 路由不变 |

---

## 影响范围

| 层级 | 影响 |
|---|---|
| `packages/core/src/skills/` | 新建目录；新增 `weather/SKILL.md`、`weather/weather.ts` |
| `packages/core/src/tools/` | 新增 `list-skills.ts`、`read-skill.ts`、`run-script.ts`；更新 `index.ts` 导出 |
| `packages/core/src/index.ts` | re-export 新增的 Skill 工具 |
| `packages/server/src/cli.ts` | 把 `list_skills` / `read_skill` / `run_script` 三个工具加入 `InMemoryToolRuntime` |
| `scripts/` | 新增 `test-skills.mjs` smoke 脚本 |
| `package.json`（根） | 新增 `test:skills` 脚本，纳入 `verify` |
| `docs/architecture/ARCHITECTURE.md` | 更新 Tool Layer Skill 状态说明 |

---

## 允许修改的目录

- `packages/core/src/skills/`（新建）
- `packages/core/src/tools/`
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
- `packages/shared/contracts/`
- `packages/server/src/http-server.ts`
- `packages/sdk/client/`
- `packages/channel-core/`
- `apps/dev-console/src/demo-shared.ts`（**不修改**）
- `apps/dev-console/tests/`

---

## 本轮范围

1. **新建** `packages/core/src/skills/weather/SKILL.md`
   - frontmatter：`skill-id: weather`、`description`
   - 正文：能力说明、参数、调用方式（引用 `weather.ts`）、返回格式

2. **新建** `packages/core/src/skills/weather/weather.ts`
   - 读取环境变量 `SKILL_ARGS`（JSON 字符串），解析 `city`
   - 固定天气表查询，stdout 输出 JSON 结果，exitCode 0

3. **新建** `packages/core/src/tools/list-skills.ts`
   - 扫描 `packages/core/src/skills/` 目录，读取各子目录的 `SKILL.md` frontmatter
   - 返回 `{ skills: [{ skillId, description, path }] }`

4. **新建** `packages/core/src/tools/read-skill.ts`
   - 根据 `skillId` 定位 `SKILL.md`，读取并返回完整内容
   - 找不到时返回错误

5. **新建** `packages/core/src/tools/run-script.ts`
   - 支持 `script` 模式（执行 Skill 目录中的指定文件）和 `inline` 模式（执行内联代码）
   - 路径安全校验（防止穿越到 skills 目录之外）
   - 超时 30 秒，返回 `{ stdout, stderr, exitCode }`

6. **更新** `packages/core/src/tools/index.ts`
   - 导出 `listSkillsToolDefinition`、`listSkillsToolExecutor`
   - 导出 `readSkillToolDefinition`、`readSkillToolExecutor`
   - 导出 `runScriptToolDefinition`、`runScriptToolExecutor`
   - 更新 `createBuiltinToolProvider()` 包含这三个工具（或单独导出 `createSkillToolset()`）

7. **更新** `packages/server/src/cli.ts`
   - 在 `InMemoryToolRuntime` 中注入 Skill 三件套工具

8. **新增** `scripts/test-skills.mjs`
   - 启动 server 子进程
   - 创建 session → 发起 run（prompt 引导 Agent 调用 `list_skills`、`read_skill`、`run_script`）
   - SSE 确认 `run_completed`，断言 steps 中有 `list_skills`、`read_skill`、`run_script` 的 tool call

9. **更新** 根 `package.json`：`"test:skills": "node scripts/test-skills.mjs"` 纳入 `verify`

---

## 本轮不做

- 不实现 Skill 的文件系统动态热加载（新 Skill 需重启 server）
- 不实现 Skill 的版本管理
- 不实现 `run_script` 的沙箱隔离（网络/文件系统访问控制）
- 不实现多 Skill 并发执行
- 不把 Skill 暴露为 Service API
- 不修改 `ToolProvider` / `ToolRuntime` / `ToolExecutor` 接口
- 不新增 shared contract 中的 DTO
- 不实现 Skill 的依赖声明（Skill 所需 npm 包由 server 环境提供）

---

## 验收标准

1. `packages/core/src/skills/weather/SKILL.md` 存在，frontmatter 含 `skill-id` 和 `description`。
2. `packages/core/src/skills/weather/weather.ts` 可被 `run_script` 执行，返回正确 JSON。
3. `list_skills` 工具可列出 weather skill。
4. `read_skill` 工具可读取 `SKILL.md` 全文。
5. `run_script` 工具可执行 `weather.ts`，路径穿越攻击被拒绝。
6. `packages/server/src/cli.ts` 注入三个 Skill 工具，ReAct 循环中 Agent 可完整走完 `list_skills → read_skill → run_script` 路径。
7. `scripts/test-skills.mjs` smoke 通过：run 完成，steps 中有三个工具调用。
8. `apps/dev-console/src/demo-shared.ts` 未被修改。
9. `pnpm verify` 通过（含新增 `test:skills`）。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:skills`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- 需要修改 `ToolProvider` / `ToolRuntime` / `ToolExecutor` 接口定义
- `run_script` 的安全边界无法用路径校验简单实现（如需要真正的沙箱）
- `inline` 代码执行出现无法处理的安全问题
- Agent 在 smoke 中无法稳定走完三步调用路径（需要调整 system prompt 策略）
- 需要在 `packages/shared/contracts` 中新增 Skill 相关跨层 DTO
- 连续两轮无法让 `pnpm verify` 与 `pnpm test:skills` 同时通过

---

## 依赖与顺序

- **前置**：[`013`](./013_tool_and_integration_layer_v1.md)（builtin tool 注册路径已验证）
- **与 014 的关系**：014 和 015 都改 `cli.ts`，建议先完成 014 再执行 015
- **后续候选**：
  - `run_script` 沙箱隔离（网络/文件系统访问控制）
  - Skill 热加载（不重启 server 即可发现新 Skill）
  - 远程 Skill 分发（npm 包形式）
  - `run_script` 对多语言脚本的支持（Python、bash 等）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|---|---|---|
| Skill 接入方式 | 三个内置工具（list/read/run），不做静态 ToolProvider | Skill 是运行时文档驱动的，静态注册无法表达其动态性 |
| `SKILL.md` 作为核心 | `SKILL.md` 是唯一强制文件 | 文档是 Skill 的 contract；脚本是实现，命名自由 |
| 脚本名称不固定 | 任意命名，由 SKILL.md 描述 | 符合 Skill 标准语义（CatPaw/OpenAI Agent SDK）；强制 handler.ts 是错误设计 |
| 不做静态 SkillManifest | 推翻原 015 设计 | 原设计把 Skill 变成了有命名空间的 StaticToolProvider，失去 Skill 核心价值 |
| `run_script` 安全边界 | 首期只限 skills 目录，路径校验 | 最小可用安全边界；沙箱留后续 |
| inline 代码执行 | 写临时文件，用 tsx 执行 | 与 script 模式统一执行环境；执行后立即删除 |
| `SKILL_ARGS` 传参方式 | 环境变量（JSON 字符串） | 最简单的跨进程参数传递方式；避免 stdin 竞争 |
| Demo Skill 内容 | weather 查询（独立副本） | 有固定输出可断言；不依赖外部 API；不改 demo-shared.ts |
