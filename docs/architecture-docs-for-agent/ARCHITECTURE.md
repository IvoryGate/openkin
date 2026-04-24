# Architecture

## 目标

`openkin` 的目标不是只做一个后端 Agent 服务，而是逐步演进成一个可扩展的全栈智能体系统。

因此架构需要同时满足两件事：

1. 第一层核心运行时必须稳定
2. 后续服务层、客户端 SDK、即时通讯接入和上层应用都可以在不推翻底层的前提下逐层长出来

## 架构原则

1. 下层是上层的基础设施，上层不应反向侵入下层内部实现。
2. 优先冻结跨层 contract，再实现具体能力。
3. 共享 schema 必须集中沉淀，避免 server、sdk、channel 各自定义一套协议。
4. 平台适配必须通过统一 adapter contract 接入，避免每接一个平台就改核心。
5. 文档、计划、约束、验证都是架构的一部分，不是附属品。

## 演进后的分层

```mermaid
flowchart TD
  AppLayer[AppAndOrchestration]
  ClientLayer[ClientSDKAndClients]
  ChannelLayer[ChannelAdapterFramework]
  ServiceLayer[ServiceAndProtocolLayer]
  ToolLayer[ToolAndIntegrationLayer]
  CoreLayer[CoreRuntimeLayer]

  AppLayer --> ClientLayer
  AppLayer --> ChannelLayer
  ClientLayer --> ServiceLayer
  ChannelLayer --> ServiceLayer
  ServiceLayer --> ToolLayer
  ServiceLayer --> CoreLayer
  ToolLayer --> CoreLayer
```

## 各层职责

### 1. Core Runtime Layer

这是当前设计最成熟的一层。

负责：

- Agent 运行时
- Session 与 SessionRuntime
- RunEngine 与 RunState
- ContextManager
- Tool Runtime
- Hook
- Memory Port
- Error / Cancel / Trace 模型
- `LLMProvider`：`MockLLMProvider`（默认 harness）与 `OpenAiCompatibleChatProvider`（OpenAI-compatible `chat/completions`，配置由上层注入）

探索分支下，第一层 **首期 harness**（执行计划 `007`–`012`）已在代码与文档上收口：默认验证为 `pnpm verify`（含第一层 scenarios，不含外网）；真实 OpenAI-compatible 跑通见 `first-layer/DEMO_FIRST_LAYER.md` 与 `pnpm test:first-layer-real`；可靠性边界摘要见 `../governance/RELIABILITY.md`。

当前第一层关于记忆边界的首期约束是：

- `history` 表示会话内原始消息链
- `memory` 只表示通过 `MemoryPort` 注入的摘要型上下文
- `memory` 必须在 prompt 构建阶段进入 `ContextBlock` 链
- `memory` 进入后仍要经过统一压缩策略，不能在裁剪后绕回 prompt

权威文档：

- `architecture-docs-for-human/backend-plan/AI_Agent_Backend_Tech_Plan.md`
- `architecture-docs-for-human/backend-plan/layer1-design/重构版方案/`

### 2. Tool And Integration Layer

负责：

- **内置工具**（`builtin`）：静态注册，同进程函数调用，如 `echo`、`get_current_time`
- **MCP**（`mcp`）：通过官方 `@modelcontextprotocol/sdk` 接入 MCP server（首期 stdio），支持 `listChanged` 动态刷新工具列表；支持运行时热注册（`InMemoryToolRuntime.registerProvider()` / `unregisterProvider()`）
- **Skill**（`skill`）：文档驱动的能力单元；每个 Skill 是 `workspace/skills/<name>/` 目录，包含 `SKILL.md`（能力描述 + 权限声明）和任意脚本；Agent 通过 System Prompt 注入感知可用 Skill 列表，通过 `read_skill` 加载完整文档，通过 `run_script` 执行；`list_skills` 作为兜底工具
- **Agent 自我管理工具**（`builtin`）：`write_skill`（创建新 Skill）、`read_logs`（查看工具调用日志）；与 `manage-mcp` Skill 配合实现 MCP 动态配置
- **自定义工具**（`custom`）：上层业务侧注入的一次性扩展

这一层扩展的是"能力来源"，而不是推翻核心运行时模型。`ToolProvider` / `ToolRuntime` / `ToolExecutor` 接口已冻结，所有新工具来源均通过实现 `ToolProvider` 接入（Skill 除外——Skill 通过内置工具暴露给 Agent）。

**日志系统**：所有工具调用、Skill 执行、MCP 调用均产生结构化日志（JSON Lines），写入 `workspace/logs/`；同时输出格式化文本到 stderr。`Logger` 接口可注入，测试时使用 `NoopLogger`。

**沙箱**（017 起）：`run_script` 在 Deno 可用时使用 Deno 子进程执行，通过 `--allow-read` / `--allow-net` / `--allow-env` 提供进程级权限隔离；权限由 `SKILL.md` frontmatter 的 `permissions` 字段声明。

当前第二层文档：`architecture-docs-for-agent/second-layer/DEMO_SECOND_LAYER.md`、`architecture-docs-for-agent/second-layer/SECOND_LAYER_COVERAGE.md`。

### 3. Service And Protocol Layer

负责：

- HTTP / WebSocket / Stream API
- 认证与会话入口
- trace 查询入口
- 对外事件协议
- 服务端网关

这一层的关键是：

> 把 Core Runtime 的能力稳定暴露给 SDK、客户端和通道层，而不是把内部细节直接暴露出去。

在第三层继续深化之前，服务面对外能力先冻结为三类：

- **client surface**：面向普通客户端与 `packages/sdk/client`，只包含会话、run、run stream、基础健康检查等用户侧调用能力
- **operator surface**：面向受信任的运维侧或服务端应用，包含 trace 查询、metrics、Agent 配置、定时任务等管理与观测能力
- **internal surface**：仅限 loopback / 进程内使用的内部入口，如 `/_internal/*`

在未来扩展时，还要额外预留两类**上层依赖的组合能力**，但它们不应直接压回第一层：

- **orchestration-facing interfaces**：供多 Agent 编排、计划模式、工作流、投票模式等上层编排逻辑消费
- **event subscription interfaces**：供 CLI / GUI / Web / Desktop 订阅心跳、SSE、任务事件、长运行状态变化等实时信号

冻结规则：

- `packages/sdk/client` 只包装 `client surface`，不默认暴露 operator / internal 能力
- Channel framework 只允许调用最小 run 链路，不得把 operator / internal 路由当作平台接入依赖
- 新增 endpoint、DTO 或 SDK 方法前，必须先声明其属于哪一类 surface，避免把观测、管理、用户调用混成同一套公开协议

当前探索分支的落地状态：

**已完成（004）最小骨架：**
- `packages/shared/contracts` 提供 v1 REST DTO、路由常量与 `StreamEvent` + SSE 线格式约定（`event` = `StreamEvent.type`，`data` = 完整 JSON）。
- `packages/server` 提供 `POST /v1/sessions`、`GET /v1/sessions/:sessionId`、`POST /v1/runs`、`GET /v1/runs/:traceId/stream`（SSE），以及 `/_internal/mcp/*`（loopback-only）。
- 验收入口：`pnpm verify` 与 `pnpm test:server`。

**018（SQLite 持久化，已落地）：**

- DB 路径：`$THEWORLD_WORKSPACE_DIR/theworld.db`（`packages/server/src/db/`：迁移、`SessionRepository` / `MessageRepository` / `TraceRepository`）。
- `POST /v1/sessions` 与成功完成的 `POST /v1/runs` 会写入 `sessions` / `messages`；运行结束通过 `PersistenceHook` 写入 `agent_run_traces`。
- `GET /v1/sessions/:id` 在进程内无会话时会回退查询 DB，以便重启后仍能校验会话存在。
- 验收入口：`pnpm test:persistence`（含重启后 `GET /v1/sessions/:id`）。

**第三层深化计划（018–023，已归档于 `docs/exec-plans/completed/`）：**

| 计划 | 增量 |
|------|------|
| `018` | SQLite 持久化：Session/Message/Trace 三张表，server 重启后历史不丢失 |
| `019` | Session/Message REST API：列表、消息历史查询、会话删除 |
| `020` | API Key 鉴权、`GET /health` 健康检查、优雅退出、请求体大小限制 |
| `021` | HTTP 系统日志、`GET /v1/runs/:traceId` Trace 查询 API、`GET /metrics`（Prometheus） |
| `022` | Agent 配置 CRUD API（动态创建/更新/禁用 Agent，运行时生效） |
| `023` | 定时任务系统（Cron/Once/Interval 触发，Task Run 持久化，高阶可选） |

第三层完成后，通过 HTTP 接口可以管理多个 Agent、查询完整推理轨迹、实现鉴权隔离、监控关键指标。

其中需要额外保持的边界是：

- Session / Run / Stream 仍是默认公开的 client contract
- Trace 查询、metrics、Agent CRUD 属于 operator surface，不默认进入 `packages/sdk/client`
- `agentId` 作为一次 run 的选择参数可以属于 client surface，但 Agent 定义的创建、更新、禁用属于 operator surface
- `cancelRun(traceId)` 属于 client surface；其幂等 noop（已终态 run → 200 / `cancelled=false`）也跟随 `packages/sdk/client`
- `GET /v1/sessions/:id/runs` 继续留在 operator surface；Web Console 可直连 operator fetch，但不因此扩张 `packages/sdk/client`

**遗漏点（待 024 收口）**：018–023 已覆盖核心基础设施，但开发期 debug 仍缺少系统状态快照、日志查询 HTTP API、工具/Skill 清单端点、MCP Provider 实时状态等能力，建议合并为 `024_debug_and_introspection_api` 计划落地。

当前第三层文档：`architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`。

### 4. Channel Adapter Framework

负责：

- 即时通讯平台接入
- 账号生命周期
- 入站事件标准化
- 出站消息标准化
- 平台网关管理

它优先抽象统一框架，再逐个接具体平台。

### 5. Client SDK And Clients

当前探索阶段优先冻结**共享客户端接口**，而不是先做某一个具体壳层。

负责：

- 对第三层 `client surface` / `operator surface` 做稳定封装
- 会话调用 API 封装
- 流式响应消费
- 事件模型封装
- 错误模型对齐
- 认证、配置、重试等跨客户端通用策略
- 为不同壳层提供统一的调用入口

这里需要额外明确一层解耦：

- **shared client interfaces**：面向产品能力的统一接口，负责调用 service contract，并向上暴露稳定的 TypeScript / SDK surface
- **shells**：CLI、GUI、Web、桌面端、本地客户端等具体交互壳层，只负责参数输入、界面呈现、状态展示和本地壳特有交互

冻结规则：

- CLI 不是产品能力 contract 的定义者，只是某一个 shell
- Web / GUI / Desktop 不应各自直接重新拼装 HTTP 协议细节
- shell 层不得把展示逻辑、命令命名、组件状态反向写入 shared contract
- 若某项能力需要同时服务 CLI、GUI、Web，优先先补 shared interface，再做单个 shell 落地
- 若某项能力未来会被多 Agent 编排、计划模式、定时任务、heartbeat 订阅同时依赖，也应优先定义共享接口，而不是在单个 shell 内私下实现

因此后续目标不是“先做 CLI，再考虑 GUI”，而是：

> 先冻结一套可被 CLI、GUI、Web、桌面端共同消费的接口层，再让不同壳层在其上独立演进。

这套接口层在规划时必须显式考虑未来四类对接：

- **多 Agent 编排**：上层可能需要把一个目标拆成多个 `run()`，并汇聚 execution / subtask / trace 结果
- **plan mode**：上层可能存在先 plan、再 execute 的两段式流程，不应由单个壳层偷偷定义自己的 plan 数据结构
- **定时任务**：现有 `cron` / `once` / `interval` 已在第三层落地，共享接口必须允许各壳层一致消费这些能力
- **heartbeat / 实时事件**：CLI、GUI、Web 未来都可能消费 SSE 心跳、任务事件、运行状态流；订阅接口应独立于具体渲染壳层
- **CLI chat 全屏 TUI**：`THEWORLD_CHAT_TUI=1` 或 `theworld chat --tui`（仅 TTY）启用 Ink 壳；流式助手内容经壳内状态渲染，不得与行模式混写 raw `stdout`。默认与 `pnpm test:project-cli` 等仍走行模式（exec-plan 056）。可选 `THEWORLD_CHAT_TUI_MODEL` 仅在 TUI 状态栏展示人类可读模型标签（与 Service 配置解耦，058）。

### 6. App And Orchestration

负责：

- 具体产品体验
- 多 Agent 编排
- 计划模式、投票模式、工作流
- 面向业务的场景化能力

这一层不应反向改写 Core Runtime contract。

但为了让这一层未来可落地，当前应保持以下边界：

- 多 Agent 编排本质上是多个 `run()` 与多个 Session / Trace 的组织，不应要求第一层理解“Supervisor / DAG / Planner”这些业务概念
- plan mode 本质上是上层两段式流程，不应直接把 plan 数据模型压回 core
- 定时任务当前仍属于第三层基础设施；未来若触发多 Agent 或 plan mode，应通过上层编排层组合，而不是重写调度器语义
- heartbeat 与事件流是跨壳层共同依赖的实时信号，不应只在 CLI 或 Web Console 私有实现

## 建议目录形态

```text
packages/
  core/
    src/
      tools/     # builtin 工具实现（echo、get_current_time、read_skill、run_script、write_skill、read_logs、list_skills）
      logger.ts  # Logger 接口 + NoopLogger + 所有 *LogEvent 类型
  lib/
  shared/
    contracts/
  server/
    src/
      logger.ts  # FileLogger 实现（JSON Lines 写入 workspace/logs/）
  sdk/
    client/
  channel-core/
  channel-adapters/
apps/
  dev-console/
    src/       # 可执行入口（如 demo、交互 REPL）与 demo 共享模块
    tests/     # 第一层 scenarios 与 audit（Mock / 真实 API），由 pnpm test:* 调用
workspace/           # Agent 运行时工作区（不在 pnpm workspace，由 THEWORLD_WORKSPACE_DIR 配置）
  skills/            # Skill 根目录（每个子目录含 SKILL.md + 任意脚本）
    weather/
    manage-mcp/      # 内置 Skill：MCP server 动态管理
  mcp-registry.json  # MCP server 持久化配置（提交到 git）
  logs/              # 运行时结构化日志（JSON Lines，gitignore）
docs/
  architecture-docs-for-agent/    # 面向 Agent 的架构文档（简洁、结构化）
    first-layer/   # 第一层文档目录
    second-layer/  # 第二层文档目录（Tool & Integration Layer）
    third-layer/   # 第三层文档目录（Service & Protocol Layer 深化）
  architecture-docs-for-human/    # 面向人类的详细设计文档（历史方案、层设计）
    backend-plan/
      layer1-design/
      layer2-design/
      layer3-design/   # 第三层详细设计
scripts/         # smoke 脚本（test-tools.mjs、test-mcp.mjs、test-skills.mjs 等）
```

`workspace/` 目录通过环境变量 `THEWORLD_WORKSPACE_DIR` 配置，默认指向项目根目录的 `./workspace`，部署时可挂载不同目录。

第一层测试文件说明见 `apps/dev-console/tests/README.md`。

## 当前优先实施顺序

1. 建立文档地图与执行计划目录
2. 建立 monorepo 骨架与 shared contracts
3. 落第一层最小运行时闭环
4. 定义 service API 与 streaming contract
5. 落客户端 SDK 最小版本
6. 落 channel adapter framework
7. 再接具体 IM 平台或具体 UI 客户端

## 当前明确不做的事

- 不先做多个 IM 平台
- 不先做完整 Web/Desktop/Mobile 客户端
- 不先做复杂多 Agent 编排
- 不把探索分支上的文档组织强行和 `main` 完全一致
