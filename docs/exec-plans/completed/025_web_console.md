# 025 Web Console（Web 调试控制台）

## 目标

在 `apps/web-console/` 下落地一个面向**开发者调试**的轻量 SPA，将 024 提供的自检 API 以及现有的 Session、Trace、Agent 管理 API 可视化展示，使开发者不需要手工拼接 curl 命令即可观察 Agent 系统的实时运行状态。

完成后，开发者可以：
- 一屏看清系统整体健康状态（Session 数、工具加载、MCP 连接、版本）
- 实时浏览 Agent 运行日志，按日期/级别过滤
- 查看所有已注册工具和 Skill
- 列出历史会话，点进去看消息历史和推理轨迹（Trace steps）
- 管理 Agent 配置（创建、更新、禁用）
- 查看定时任务列表和执行历史

本计划依赖 024（自检 API）。

---

## 背景

### 当前调试体验

| 调试任务 | 现有方式 | 痛点 |
|---------|---------|------|
| 看系统状态 | `curl /v1/system/status` | 需要手工拼 curl，JSON 裸输出难读 |
| 看运行日志 | 打开 `workspace/logs/agent-xxx.log` | 文件量大，无过滤，不实时 |
| 看历史会话 | `curl /v1/sessions` | 裸 JSON，无法展开消息或 trace |
| 看工具列表 | 无 HTTP API（需等 024） | 完全没有 |
| 管理 Agent | `curl -X POST /v1/agents` | 手工拼 JSON body |

### 定位

`apps/web-console` 是**开发期工具**，不是产品侧用户界面：

- 目标用户：开发者本人（在本机或局域网内访问）
- 访问方式：打开浏览器直连 `http://127.0.0.1:5173`（dev server），API 请求代理到 `http://127.0.0.1:3333`（server）
- 不要求：响应式布局、国际化、无障碍、生产安全加固

---

## 技术选型（已冻结）

| 维度 | 选择 | 原因 |
|------|------|------|
| 构建工具 | Vite | monorepo 中已有 ESM 生态；零配置快速启动 |
| 框架 | Vue 3 + Composition API | 轻量；与 TypeScript 配合好；比 React 少一层状态管理心智负担 |
| 路由 | Vue Router 4 | 官方配套，SPA 路由标配 |
| HTTP 请求 | 直接使用 `fetch`（复用 `@openkin/client-sdk`） | 已有 SDK 覆盖所有 client surface API；operator API 用原生 fetch 封装轻量 helper |
| UI 组件库 | **无**（首期不引入 Ant Design / Element Plus 等） | 调试控制台页面简单；组件库引入增加构建体积和学习成本；纯 CSS 配合 Flexbox/Grid 足够 |
| 样式 | 原生 CSS（变量 + Scoped） | 轻量；不引入 Tailwind / UnoCSS（避免构建配置复杂化） |
| 状态管理 | Vue 3 `reactive` / `ref`（不引入 Pinia/Vuex） | 页面少且独立；跨页共享状态极少（只有 `baseUrl` 和 `apiKey` 配置） |
| TypeScript | 全量（`strict: true`） | 与 monorepo 其他包保持一致 |
| 包管理 | pnpm workspace（`@openkin/web-console`） | 与其他包统一 |

---

## 目录结构

```text
apps/web-console/
  package.json                 # @openkin/web-console
  tsconfig.json
  vite.config.ts               # 含 server.proxy 把 /v1/* 代理到 :3333
  index.html
  src/
    main.ts                    # Vue app 入口
    App.vue                    # 根组件：顶部导航 + <RouterView>
    router.ts                  # Vue Router 路由表
    api/
      client.ts                # 初始化 @openkin/client-sdk
      operator.ts              # operator surface HTTP helper（system/status、logs、tools、skills）
    views/
      StatusView.vue           # 系统概览（GET /v1/system/status）
      LogsView.vue             # 日志查询（GET /v1/logs）
      ToolsView.vue            # 工具 + Skill 清单（GET /v1/tools + /v1/skills）
      SessionsView.vue         # 会话列表（GET /v1/sessions）
      SessionDetailView.vue    # 单个会话：消息历史 + Trace 列表
      TraceDetailView.vue      # 单条 Trace：steps 展开
      AgentsView.vue           # Agent 管理（GET/POST/PUT/DELETE /v1/agents）
      TasksView.vue            # 定时任务列表（GET /v1/tasks）
      TaskDetailView.vue       # 单个任务：执行历史（GET /v1/tasks/:id/runs）
      SettingsView.vue         # 控制台设置（baseUrl + apiKey 本地存储）
    components/
      NavBar.vue               # 顶部导航（含连接状态指示灯）
      StatusCard.vue           # 系统状态卡片
      LogLine.vue              # 单条日志渲染（含级别颜色）
      TraceStep.vue            # 单步 trace 折叠展示
      AgentForm.vue            # 创建/编辑 Agent 的表单
      EmptyState.vue           # 通用空状态占位
      ErrorBanner.vue          # 通用错误提示
    styles/
      base.css                 # CSS Reset + 基础变量（颜色、字体、间距）
      layout.css               # 页面骨架布局
```

---

## 路由表

```
/                    → 重定向到 /status
/status              → StatusView        系统概览
/logs                → LogsView          日志查询
/tools               → ToolsView         工具 + Skill 清单
/sessions            → SessionsView      会话列表
/sessions/:id        → SessionDetailView 会话详情（消息 + Trace 列表）
/traces/:traceId     → TraceDetailView   Trace 步骤详情
/agents              → AgentsView        Agent 管理
/tasks               → TasksView         定时任务列表
/tasks/:id           → TaskDetailView    任务执行历史
/settings            → SettingsView      控制台配置
```

---

## 各视图设计

### StatusView（系统概览）

**数据来源**：`GET /v1/system/status` + `GET /health`

**展示内容**：
```
┌─────────────────────────────────────────────────────────┐
│  OpenKin Console          v0.1.0  ● Connected  Uptime 4h │
├──────────────┬──────────────┬──────────────┬────────────┤
│  Sessions    │  Tools       │  Skills      │  DB        │
│     3        │   13         │    4         │ connected  │
│  active      │ (8 builtin,  │ weather      │            │
│              │  5 mcp)      │ manage-mcp   │            │
├──────────────┴──────────────┴──────────────┴────────────┤
│  MCP Providers                                           │
│  ● filesystem   connected   5 tools                     │
│  ✕ notion       error       last err: connection refused │
└─────────────────────────────────────────────────────────┘
```

**刷新策略**：页面加载时请求一次；提供手动刷新按钮（不做轮询，避免干扰 server 日志）。

---

### LogsView（日志查询）

**数据来源**：`GET /v1/logs?date=&level=&limit=&before=`

**展示内容**：
- 顶部筛选栏：日期选择（默认今天）+ 级别下拉（全部/INFO/WARN/ERROR）+ 关键词搜索框
- 日志条目列表：时间戳 | 级别（彩色徽标）| type | sessionId（截断） | message
- "加载更多"按钮（`before` 时间游标分页，每次 100 条）

**颜色方案**：
- DEBUG → 灰色
- INFO → 默认文字色
- WARN → 橙色
- ERROR → 红色

---

### ToolsView（工具 + Skill 清单）

**数据来源**：`GET /v1/tools` + `GET /v1/skills`

**展示内容**：
- 两个 Tab：`工具（13）` | `Skill（4）`
- 工具 Tab：按 source 分组（builtin / mcp / skill / custom），每个工具显示 name + description
- Skill Tab：卡片列表，显示 id、title、description 首行（200字截断）、是否有脚本

---

### SessionsView（会话列表）

**数据来源**：`GET /v1/sessions?limit=20&offset=`

**展示内容**：表格（sessionId 缩略 | kind | agentId | 创建时间 | 操作）

**操作**：
- 点 sessionId → 跳转 `SessionDetailView`
- 删除按钮 → 确认弹出 → `DELETE /v1/sessions/:id`

**分页**：offset 翻页（不做游标）

---

### SessionDetailView（会话详情）

**数据来源**：`GET /v1/sessions/:id/messages` + `GET /v1/sessions/:id/traces`

**展示内容**：左栏消息历史（气泡样式，区分 user/assistant/tool），右栏 Trace 列表（时间 | 状态 | 步数 | 耗时 | 点击展开）

**点击 Trace** → 跳转 `TraceDetailView`

---

### TraceDetailView（Trace 详情）

**数据来源**：`GET /v1/runs/:traceId`

**展示内容**：
- 头部：traceId | status | duration | stepCount
- Steps 时间轴：每步可折叠
  - `thought`：紫色斜体文字
  - `toolCalls`：工具名 + 入参 JSON（折叠）
  - `toolResults`：成功/失败图标 + outputSummary
  - `finalAnswer`：绿色文字

---

### AgentsView（Agent 管理）

**数据来源**：`GET /v1/agents`，操作：`POST / PUT / DELETE / enable / disable`

**展示内容**：
- Agent 列表（name | model | enabled 开关 | 内置标记 | 操作按钮）
- "新建 Agent" 按钮 → 右侧抽屉（AgentForm）
- 点 Agent 行 → 右侧抽屉展示详情（含 systemPrompt 编辑）

**enabled 开关**：toggle 直接调 enable/disable API，乐观更新

---

### TasksView + TaskDetailView（定时任务）

**数据来源**：`GET /v1/tasks`，详情：`GET /v1/tasks/:id/runs`

**TasksView**：
- 任务列表（name | triggerType | triggerConfig | enabled | 下次触发时间 | 操作）
- 操作：enable/disable toggle + "立即触发"按钮 + 删除

**TaskDetailView**：
- 任务基本信息 + 执行历史列表（status | 开始时间 | 耗时 | traceId 链接）
- 点 traceId → 跳转 TraceDetailView

---

### SettingsView（控制台配置）

**存储**：`localStorage`（key: `openkin_console_base_url` / `openkin_console_api_key`）

**展示内容**：
```
Server URL:  [http://127.0.0.1:3333        ] [Test Connection]
API Key:     [••••••••••••••••••••••••••••  ] [Show/Hide]
```

**Test Connection**：调 `GET /health`，成功显示 `✓ 已连接 (v0.1.0)`，失败显示错误。

---

## API 接入层设计

### `src/api/client.ts`

封装 `@openkin/client-sdk`，从 `localStorage` 读取 `baseUrl` 和 `apiKey`：

```typescript
import { createOpenKinClient } from '@openkin/client-sdk'

export function getClient() {
  const baseUrl = localStorage.getItem('openkin_console_base_url') ?? 'http://127.0.0.1:3333'
  const apiKey = localStorage.getItem('openkin_console_api_key') ?? undefined
  return createOpenKinClient({ baseUrl, apiKey })
}
```

### `src/api/operator.ts`

封装 operator surface 的 HTTP 调用（024 新增的 5 个接口以及 Agent / Trace 接口），使用同样的 `baseUrl` + `apiKey`：

```typescript
export async function getSystemStatus(): Promise<SystemStatusResponseBody> { ... }
export async function getLogs(params: ListLogsRequest): Promise<ListLogsResponseBody> { ... }
export async function getTools(): Promise<ListToolsResponseBody> { ... }
export async function getSkills(): Promise<ListSkillsApiResponseBody> { ... }
export async function listAgents(): Promise<ListAgentsResponseBody> { ... }
export async function createAgent(req: CreateAgentRequest): Promise<AgentDto> { ... }
export async function updateAgent(id: string, req: UpdateAgentRequest): Promise<AgentDto> { ... }
export async function deleteAgent(id: string): Promise<void> { ... }
export async function enableAgent(id: string): Promise<void> { ... }
export async function disableAgent(id: string): Promise<void> { ... }
export async function getTrace(traceId: string): Promise<TraceDto> { ... }
export async function listTraces(sessionId: string): Promise<ListTracesResponseBody> { ... }
```

---

## Vite 配置关键点

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://127.0.0.1:3333',
      '/health': 'http://127.0.0.1:3333',
      '/_internal': 'http://127.0.0.1:3333',
    },
  },
  build: {
    outDir: 'dist',
    // 产出单文件 HTML（不做 CDN 拆分），方便嵌入 server 静态服务
  },
})
```

**代理说明**：开发时所有 `/v1/*` 请求自动代理到 server，不存在 CORS 问题。生产构建产出物放到 `packages/server/public/`，由 server 提供静态服务（未来扩展，不在本计划范围内）。

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `apps/web-console/` | **新建整个目录**（SPA 源码） |
| `apps/web-console/package.json` | `@openkin/web-console`，依赖 `vue`、`vue-router`、`vite`、`@vue/tsconfig`、`@openkin/client-sdk`、`@openkin/shared-contracts` |
| `apps/web-console/vite.config.ts` | Vite 配置，含 dev proxy 和 build 配置 |
| `package.json`（根） | 新增 `dev:web-console`、`build:web-console` 脚本 |
| `pnpm-workspace.yaml` | 确认 `apps/web-console` 已纳入 workspace |
| `docs/exec-plans/active/README.md` | 更新 025 状态 |

---

## 允许修改的目录

- `apps/web-console/`（全新目录）
- `package.json`（根，仅 `scripts` 字段）
- `pnpm-workspace.yaml`（仅 `packages` 列表，确认 `apps/*` 已覆盖）
- `docs/exec-plans/active/`（本计划文档）

## 禁止修改的目录

- `packages/core/`、`packages/server/`、`packages/sdk/client/`（不因 UI 反向改后端）
- `packages/shared/contracts/`（不新增 DTO，直接消费 024 新增的 DTO）
- `apps/dev-console/`
- 现有任何路由或 DTO（不 breaking change）

---

## 本轮范围

1. **新建** `apps/web-console/` 骨架：
   - `package.json`（`@openkin/web-console`）
   - `tsconfig.json`
   - `vite.config.ts`（含 dev proxy）
   - `index.html`

2. **新建** `src/main.ts` + `src/App.vue` + `src/router.ts`

3. **新建** `src/api/client.ts` + `src/api/operator.ts`

4. **新建** `src/styles/base.css` + `src/styles/layout.css`

5. **新建** 全部 10 个 View 组件（每个完整实现，不做 placeholder）：
   - `StatusView.vue`
   - `LogsView.vue`
   - `ToolsView.vue`
   - `SessionsView.vue`
   - `SessionDetailView.vue`
   - `TraceDetailView.vue`
   - `AgentsView.vue`
   - `TasksView.vue`
   - `TaskDetailView.vue`
   - `SettingsView.vue`

6. **新建** 通用组件：`NavBar.vue`、`StatusCard.vue`、`LogLine.vue`、`TraceStep.vue`、`AgentForm.vue`、`EmptyState.vue`、`ErrorBanner.vue`

7. **修改** 根 `package.json`：
   - `"dev:web-console": "pnpm --filter @openkin/web-console dev"`
   - `"build:web-console": "pnpm --filter @openkin/web-console build"`

---

## 本轮不做

- 不实现 Server 静态托管（Server 不内嵌 web-console 产出）
- 不做响应式移动端布局
- 不实现消息输入框（发起新 run）—— web-console 是只读调试工具，不是聊天界面
- 不实现 WebSocket 实时推送（用手动刷新替代，保持 server 干净）
- 不做用户认证（API Key 即鉴权边界）
- 不引入 Element Plus / Ant Design Vue 等组件库
- 不引入 Pinia / Vuex 状态管理
- 不把 web-console 纳入 `pnpm verify`（UI 测试属于第五层，不是当前重点）
- 不实现 Trace 的完整 LLM 消息内容展示（API 层本身已做过滤）

---

## 验收标准

1. `pnpm dev:web-console` 启动后，浏览器打开 `http://localhost:5173` 能看到控制台导航。
2. 确保 server 已运行（`pnpm dev:server`）的前提下：
   - `/status` 页展示系统状态卡片，`tools.total` > 0。
   - `/logs` 页能正常加载（空列表或有日志均可）。
   - `/tools` 页展示至少一个 builtin 工具（`echo`）。
   - `/sessions` 页展示会话列表（空列表也可）。
   - `/agents` 页展示 `default` 内置 Agent。
   - `/tasks` 页展示任务列表（空列表也可）。
   - `/settings` 页能修改 baseUrl 并 Test Connection 成功。
3. `pnpm build:web-console` 不报错，产出 `apps/web-console/dist/` 目录。
4. TypeScript 编译无报错（`tsc --noEmit`）。

---

## 必跑命令

1. `pnpm dev:web-console`（确认 dev server 正常启动，无编译错误）
2. `pnpm build:web-console`（确认 production build 无报错）
3. `pnpm check`（确认 monorepo 整体类型检查通过）

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级：

- `@openkin/client-sdk` 无法在浏览器环境中使用（Node built-ins 污染导致 Vite 构建报错，需要拆分 Node/Browser 两个 entry）
- 需要在 web-console 和 server 之间引入 BFF（Backend For Frontend）层
- 需要为 operator API 设计独立的 auth 机制（超出 API Key 范围）
- 发现 Vue Router 的 `history` 模式与 Vite dev server 的 proxy 有冲突，需要切换路由模式
- 任意 View 的 API 数据类型与 `@openkin/shared-contracts` 不对齐，需要修改 contracts（应先升级确认是否合理，再修改）
- 连续两轮无法让 `pnpm build:web-console` 无报错通过

---

## 依赖与顺序

- **强前置**：[`024`](./024_debug_and_introspection_api.md)（`/v1/system/status`、`/v1/logs`、`/v1/tools`、`/v1/skills` 后端 API 必须存在）
- **软前置**：022（Agent API）、023（Task API）已完成，DTO 已在 contracts 中
- **解锁**：第五层 App & Orchestration（UI 骨架已具备，可在此基础上扩展更复杂的交互）

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 框架 | Vue 3 | 轻量，TypeScript 集成好；首选 React 的团队可在本计划基础上替换，骨架不变 |
| 不引入组件库 | 裸 CSS | 调试控制台 UI 简单；组件库主要解决复杂表单/业务组件，此处不必要 |
| 不引入状态管理 | `ref` / `reactive` | 页面少且独立；无需跨页全局状态同步（`baseUrl`/`apiKey` 直接读 localStorage） |
| 配置存 localStorage | 是 | 开发期工具；不需要后端存储用户偏好；刷新后配置不丢失 |
| dev proxy 而不是 CORS | Vite proxy | 避免为调试工具改动 server 的 CORS 配置；production build 另行决策 |
| web-console 不纳入 verify | 是 | UI 测试体系与后端 smoke 脚本性质不同；首期不建立 E2E 框架 |
| 只读调试，不做发送消息 | 是 | 混入会话输入会模糊工具定位；需要发消息用 `pnpm chat` 或 SDK 即可 |
