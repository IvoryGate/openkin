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

> 一个**目录**，包含 `SKILL.md`（能力说明文档）和任意数量的辅助脚本。Agent 通过 System Prompt 中注入的 Skill 描述感知有哪些能力，再通过 `read_skill` 加载完整文档，根据文档指引调用文档中引用的工具、MCP 或直接执行目录内的脚本。

Skill 与其他能力来源的对比：

| 来源 | sourceType | 控制主体 | 调用方式 | 适用场景 |
|---|---|---|---|---|
| 内置工具 | `builtin` | 静态注册 | 编译时确定 | 框架核心能力（echo、time）|
| MCP | `mcp` | MCP server | 协议动态发现 | 跨语言外部服务 |
| **Skill** | `skill` | **Agent 运行时** | **读文档 + 动态执行** | 可插拔的文档化能力包 |

### Skill 与 ToolProvider 的根本区别

| | `ToolProvider` 模型 | Skill 模型 |
|---|---|---|
| 工具发现时机 | 编译时/启动时静态注册 | **System Prompt 注入（description）+ 按需 `read_skill`（全文）** |
| 执行入口 | 固定 `ToolExecutor` 函数 | `SKILL.md` 描述的任意脚本/工具/MCP |
| Agent 角色 | 调用已知工具 | 理解文档 → 决定执行路径 |
| 脚本名称 | 固定（如 `handler.ts`） | **任意，不固定** |

因此，**Skill 不能塞进现有 `ToolProvider` 接口**。

---

## 已冻结决策

### Skill 的存放位置：`workspace/skills/`

Skill 是**运行时内容**（能力配置、文档、脚本），不是框架源码。因此**不放在 `packages/` 源码目录内**，而是放在根目录的 `workspace/` 工作区：

```
openkin/
  packages/         ← 框架代码（pnpm 管理，不变）
  apps/             ← 应用代码（pnpm 管理，不变）
  workspace/        ← Agent 运行时工作区（不在 pnpm workspace）
    skills/
      weather/
        SKILL.md
        weather.ts
      <其他 Skill>/
    mcp-registry.json   ← MCP 配置持久化（016 添加）
    logs/               ← 运行时日志（016 添加）
  scripts/          ← smoke 脚本
```

框架通过环境变量 `OPENKIN_WORKSPACE_DIR` 定位工作区，默认值为项目根目录下的 `./workspace`。

`.gitignore` 策略：
- `workspace/logs/` 忽略（运行时产生）
- `workspace/mcp-registry.json` **提交**（持久化配置）
- `workspace/skills/` **提交**（内容库）

### Skill 的最小文件结构

```
workspace/skills/
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
description: |             # 给 Agent 读的能力描述（注入 System Prompt，保持简短）
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
// weather.ts 接受环境变量 SKILL_ARGS（JSON）
// 示例：SKILL_ARGS='{"city":"Beijing"}' tsx weather.ts
```

## 返回格式

```json
{ "city": "Beijing", "forecast": "晴，25°C" }
```
```

### Agent 发现 Skill 的机制：System Prompt 注入

**Skill 的发现不靠工具调用，靠 System Prompt**。

`cli.ts` 启动时扫描 `workspace/skills/` 目录，读取每个 `SKILL.md` 的 frontmatter，把所有 Skill 的 `skill-id` + `description` 动态拼入 System Prompt：

```
你可用的 Skill（调用 read_skill 获取完整使用文档）：
- weather: 查询城市天气预报，输入 city（城市名），返回天气预报字符串。
- [其他 Skill...]

如果你需要使用某个 Skill：
1. 调用 read_skill { skillId: "..." } 获取完整文档
2. 按文档指引调用 run_script 执行

如果你认为当前 Skill 列表不满足需求，可调用 list_skills 查看完整列表（兜底）。
```

这与 CatPaw 的 `<available_skills>` 设计完全一致：description 短小（几十字），全量注入；完整文档按需加载。

### Agent 调用 Skill 的内置工具（两个主力 + 一个兜底）

#### `read_skill`（内置工具，主力）

```typescript
name: 'read_skill'
description: '读取指定 Skill 的完整 SKILL.md 内容，让 Agent 了解如何调用该 Skill'
inputSchema: { skillId: string }
output: { content: string }  // SKILL.md 的完整 markdown 内容
```

实现：根据 `skillId` 在 `$OPENKIN_WORKSPACE_DIR/skills/<skillId>/SKILL.md` 找到文件并读取。

#### `run_script`（内置工具，主力）

```typescript
name: 'run_script'
description: '在 Skill 目录中执行指定脚本文件'
inputSchema: {
  skillId: string          // 所属 Skill
  script: string           // 脚本文件名（相对于 skill 目录）
  args?: Record<string, unknown>  // 传入脚本的参数（通过 SKILL_ARGS 环境变量）
}
output: { stdout: string, stderr: string, exitCode: number }
```

实现：
- 在对应 Skill 目录中用 `tsx` 执行指定文件，`args` 序列化为 JSON 通过 `SKILL_ARGS` 环境变量传入
- 超时：30 秒（防止 Agent 无限等待）
- 安全（首期）：只允许执行 `$OPENKIN_WORKSPACE_DIR/skills/` 目录下的文件，拒绝路径穿越
- 环境变量隔离：子进程只继承白名单环境变量（`SKILL_ARGS`、`SKILL_ID`、`NODE_ENV`），不透传 `OPENAI_API_KEY` 等敏感变量
- stdout/stderr 输出限制：各 64KB，超出截断
- **`inline` 模式首期禁用**（待 017 Deno 沙箱落地后启用）

> 注：`inline` 模式（执行内联代码片段）留到 017 沙箱计划实现，首期不开放。

#### `list_skills`（内置工具，兜底）

```typescript
name: 'list_skills'
description: '列出所有可用 Skill 及其描述（兜底工具，通常 System Prompt 已包含列表）'
inputSchema: {}
output: { skills: [{ skillId: string, description: string, path: string }] }
```

实现：扫描 `$OPENKIN_WORKSPACE_DIR/skills/` 下所有 `SKILL.md`，读取 frontmatter，返回列表。

**定位**：在 Skill 数量增多、System Prompt 空间不足，或运行时动态新增 Skill 后（无需重启），Agent 可通过此工具发现完整列表。日常情况下 Agent 不需要调用它，因为 System Prompt 已包含描述。

### ReAct 循环中的 Skill 调用路径

```
用户: "帮我查一下北京的天气"
  └─▶ Agent 从 System Prompt 中感知到有 weather Skill
  └─▶ Agent: [tool_call] read_skill { skillId: 'weather' }
        └─▶ 返回: SKILL.md 全文（含调用方式）
  └─▶ Agent: [tool_call] run_script { skillId: 'weather', script: 'weather.ts', args: { city: '北京' } }
        └─▶ 返回: { stdout: '{"city":"北京","forecast":"晴，25°C"}', exitCode: 0 }
  └─▶ Agent: 北京今天天气晴，25°C。
```

相比旧设计（三步：`list_skills → read_skill → run_script`），新设计减少一步（System Prompt 替代 `list_skills`），Agent 调用路径更自然。

### 首期 Demo Skill：天气查询

首期提供一个 Demo Skill：`workspace/skills/weather/`，包含：
- `SKILL.md`：描述查询天气的能力、参数格式、调用方式
- `weather.ts`：实际执行逻辑（固定天气表，与 `demo-shared.ts` 的 `get_weather` 逻辑类似但独立）

**不修改** `apps/dev-console/src/demo-shared.ts`。

### 安全边界（首期，016 之前）

- `run_script` 只允许执行 `$OPENKIN_WORKSPACE_DIR/skills/` 内的文件（路径校验）
- 子进程只继承白名单环境变量，不透传宿主进程的敏感环境变量
- stdout/stderr 各限 64KB，超出截断
- 超时 30 秒强杀
- `inline` 模式**禁用**（待 017 Deno 沙箱）

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
| `workspace/skills/weather/` | 新建；含 `SKILL.md`、`weather.ts` |
| `packages/core/src/tools/` | 新增 `list-skills.ts`、`read-skill.ts`、`run-script.ts`；更新 `index.ts` 导出 |
| `packages/core/src/index.ts` | re-export 新增的 Skill 工具 |
| `packages/server/src/cli.ts` | 启动时扫描 `workspace/skills/` 拼入 System Prompt；把三个 Skill 工具加入 `InMemoryToolRuntime` |
| `scripts/` | 新增 `test-skills.mjs` smoke 脚本 |
| `package.json`（根） | 新增 `test:skills` 脚本，纳入 `verify` |
| `docs/architecture/ARCHITECTURE.md` | 更新目录结构图，说明 `workspace/` 位置 |

---

## 允许修改的目录

- `workspace/skills/`（新建）
- `workspace/`（新建根目录）
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

1. **新建** `workspace/skills/weather/SKILL.md`
   - frontmatter：`skill-id: weather`、`description`（简短，用于 System Prompt 注入）
   - 正文：能力说明、参数、调用方式（引用 `weather.ts`）、返回格式

2. **新建** `workspace/skills/weather/weather.ts`
   - 读取环境变量 `SKILL_ARGS`（JSON 字符串），解析 `city`
   - 固定天气表查询，stdout 输出 JSON 结果，exitCode 0

3. **新建** `packages/core/src/tools/list-skills.ts`
   - 扫描 `$OPENKIN_WORKSPACE_DIR/skills/`（默认 `./workspace/skills`）目录
   - 读取各子目录的 `SKILL.md` frontmatter
   - 返回 `{ skills: [{ skillId, description, path }] }`

4. **新建** `packages/core/src/tools/read-skill.ts`
   - 根据 `skillId` 定位 `SKILL.md`，读取并返回完整内容
   - 找不到时返回错误

5. **新建** `packages/core/src/tools/run-script.ts`
   - 支持 `script` 模式（执行 Skill 目录中的指定文件）
   - 路径安全校验（防止穿越到 skills 目录之外）
   - 环境变量白名单隔离（只透传 `SKILL_ARGS`、`SKILL_ID`、`NODE_ENV`）
   - stdout/stderr 各限 64KB，超时 30 秒强杀
   - 返回 `{ stdout, stderr, exitCode }`
   - **`inline` 模式不实现**（返回明确错误提示，告知用户等待 017）

6. **更新** `packages/core/src/tools/index.ts`
   - 导出 `listSkillsToolDefinition`、`listSkillsToolExecutor`
   - 导出 `readSkillToolDefinition`、`readSkillToolExecutor`
   - 导出 `runScriptToolDefinition`、`runScriptToolExecutor`
   - 更新 `createBuiltinToolProvider()` 包含这三个工具（或单独导出 `createSkillToolset()`）

7. **更新** `packages/server/src/cli.ts`
   - 启动时读取 `OPENKIN_WORKSPACE_DIR`（默认 `./workspace`）
   - 扫描 `skills/` 子目录，构建 Skill 描述列表，动态拼入 System Prompt
   - 在 `InMemoryToolRuntime` 中注入 Skill 三件套工具

8. **新增** `scripts/test-skills.mjs`
   - 启动 server 子进程
   - 创建 session → 发起 run（prompt 引导 Agent 调用 `read_skill`、`run_script`）
   - SSE 确认 `run_completed`，断言 steps 中有 `read_skill`、`run_script` 的 tool call
   - 注：因 System Prompt 已注入 Skill 描述，不再断言 `list_skills` 调用

9. **更新** 根 `package.json`：`"test:skills": "node scripts/test-skills.mjs"` 纳入 `verify`

---

## 本轮不做

- 不实现 Skill 的文件系统动态热加载（新 Skill 后下次重启 System Prompt 自动更新；热加载见 016）
- 不实现 Skill 的版本管理
- 不实现 `run_script` 的 `inline` 模式（待 017 Deno 沙箱）
- 不实现 `run_script` 的网络/文件系统沙箱隔离（待 017）
- 不实现多 Skill 并发执行
- 不实现 `write_skill` 工具（Agent 自我添加 Skill，见 016）
- 不把 Skill 暴露为 Service API
- 不修改 `ToolProvider` / `ToolRuntime` / `ToolExecutor` 接口

---

## 验收标准

1. `workspace/skills/weather/SKILL.md` 存在，frontmatter 含 `skill-id` 和 `description`。
2. `workspace/skills/weather/weather.ts` 可被 `run_script` 执行，返回正确 JSON。
3. `list_skills` 工具可列出 weather skill（兜底路径验证）。
4. `read_skill` 工具可读取 `SKILL.md` 全文。
5. `run_script` 工具可执行 `weather.ts`；路径穿越攻击被拒绝；敏感环境变量不透传子进程。
6. `cli.ts` 启动时 System Prompt 包含 weather Skill 的描述。
7. `packages/server/src/cli.ts` 注入三个 Skill 工具，ReAct 循环中 Agent 可走完 `read_skill → run_script` 路径。
8. `scripts/test-skills.mjs` smoke 通过：run 完成，steps 中有 `read_skill`、`run_script` 的 tool call。
9. `apps/dev-console/src/demo-shared.ts` 未被修改。
10. `pnpm verify` 通过（含新增 `test:skills`）。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:skills`

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- 需要修改 `ToolProvider` / `ToolRuntime` / `ToolExecutor` 接口定义
- `run_script` 的安全边界无法用路径校验简单实现
- Agent 在 smoke 中无法稳定走完两步调用路径（需要调整 System Prompt 策略）
- 需要在 `packages/shared/contracts` 中新增 Skill 相关跨层 DTO
- 连续两轮无法让 `pnpm verify` 与 `pnpm test:skills` 同时通过

---

## 依赖与顺序

- **前置**：[`013`](./013_tool_and_integration_layer_v1.md)（builtin tool 注册路径已验证）
- **与 014 的关系**：014 和 015 都改 `cli.ts`，建议先完成 014 再执行 015
- **后续**：
  - `016` — Agent 自我管理（`write_skill`、`manage-mcp` Skill、日志系统、MCP 热注册）
  - `017` — Deno 沙箱（`inline` 启用、文件/网络/env 权限隔离）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|---|---|---|
| Skill 目录位置 | `workspace/skills/`（根目录工作区） | Skill 是运行时内容，不是源码；放 `packages/` 内混淆关注点；`workspace/` 可通过环境变量配置，部署时挂载不同目录 |
| Skill 发现机制 | System Prompt 注入（主） + `list_skills`（兜底） | description 短小，全量注入 System Prompt token 代价低（类比 CatPaw `<available_skills>`）；减少 Agent 一次无意义工具调用 |
| `list_skills` 定位 | 降为兜底工具 | System Prompt 已覆盖主要发现路径；兜底用于 Skill 数量多或运行时动态新增的场景 |
| Skill 接入方式 | 两个内置工具（read/run）+ System Prompt | Skill 是运行时文档驱动的；静态注册无法表达其动态性 |
| `SKILL.md` 作为核心 | `SKILL.md` 是唯一强制文件 | 文档是 Skill 的 contract；脚本是实现，命名自由 |
| 脚本名称不固定 | 任意命名，由 SKILL.md 描述 | 符合 Skill 标准语义；强制 handler.ts 是错误设计 |
| `inline` 模式 | 首期禁用 | 无沙箱隔离时允许执行任意内联代码不安全；待 017 Deno 沙箱后启用 |
| 环境变量隔离 | 白名单透传（`SKILL_ARGS`、`SKILL_ID`、`NODE_ENV`） | 防止子进程读取 `OPENAI_API_KEY` 等宿主敏感变量；首期最小安全边界 |
| stdout 限制 | 各 64KB | 防止异常脚本产生超大输出占满内存 |
| `SKILL_ARGS` 传参方式 | 环境变量（JSON 字符串） | 最简单的跨进程参数传递；避免 stdin 竞争 |
| `OPENKIN_WORKSPACE_DIR` | 环境变量配置，默认 `./workspace` | 支持不同部署环境挂载不同工作区；开发时默认指向项目根目录的 `workspace/` |
| Demo Skill 内容 | weather 查询（独立副本） | 有固定输出可断言；不依赖外部 API；不改 demo-shared.ts |
