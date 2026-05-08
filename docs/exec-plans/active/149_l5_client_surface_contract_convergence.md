# 149 · L5 Client Surface Contract 收敛

## 方向判断

### 当前阶段定位

当前分支 `feat/l5-client-surface` 正处于 L5 外扩层的关键收敛期。L4 产品层已完成（099–106），L3 服务底座已稳定（018–027、090–096），Desktop 客户端已基本完成 UI 原型并通过 WO-1~WO-6 补接入真实后端。148（SSE/工具/审批过程可视化）已落地。

**但 L5 客户端表面存在一个根本性的 contract 收敛问题，必须在进入 L6 之前解决。**

### 核心瓶颈：Desktop Bridge 三重复制

当前仓库中存在 **三份独立的 HTTP 客户端实现**，它们各自维护相同的后端 API 调用逻辑：

| 位置 | 语言 | 职责 | 与 shared/contracts 的关系 |
|------|------|------|---------------------------|
| `packages/sdk/client/src/index.ts` | TypeScript | 正式 Node SDK，面向 client surface | ✅ 导入 shared-contracts 类型与路由常量 |
| `apps/desktop/src/preload.ts` | TypeScript | Electron preload bridge | ❌ 完全重写 HTTP 层，自建类型，未导入 shared-contracts |
| `apps/desktop/renderer/http-desktop-bridge.js` | JavaScript | 浏览器/静态降级 HTTP bridge | ❌ 再次完整重写 HTTP 层，无类型安全 |

**三重复制的具体问题：**

1. **类型漂移**：`preload.ts` 定义了 `DesktopSessionItem`、`DesktopMessageItem`、`DesktopAgentItem` 等私有类型，与 `shared-contracts` 中的 `SessionDto`、`MessageDto`、`AgentDto` 存在字段差异但语义相同。未来任何 DTO 变更需要同时修改三处。
2. **路由硬编码**：`preload.ts` 和 `http-desktop-bridge.js` 硬编码了 `/v1/sessions`、`/v1/runs` 等路由，而 `sdk/client` 使用 `shared-contracts` 的 `apiPath*` 常量。
3. **错误处理不一致**：`sdk/client` 使用 `ApiEnvelope` + `createRunError`；desktop bridge 使用裸 `Error('HTTP ${status}')`。
4. **鉴权逻辑重复**：`fetchWithOptionalAuthRetry` 在 `preload.ts` 和 `http-desktop-bridge.js` 中各实现一遍。
5. **SSE 解析重复**：`parseSseStream` / `parseSseStreamEvents` 在三处各实现一遍。

**这不是代码风格问题——这是 L5 的 contract 收敛问题。** 如果在 L6 启动前不收敛，未来每新增一个外部 surface（Web client、SDK consumer、channel bridge）都会继续重复发明 HTTP 客户端。

### 取舍依据

有两种收敛路径：

**路径 A：让 Desktop 依赖 `sdk/client`**
- 优势：零重复，类型安全，自动跟随 contract 变更
- 劣势：`sdk/client` 是 Node 模块，不能直接在浏览器/renderer 环境运行；需要重构 `sdk/client` 使其支持 `fetch` 注入 + 浏览器兼容
- 风险：中等——需要 `sdk/client` 做一次环境适配重构

**路径 B：抽取共享 `@theworld/bridge-core` 包**
- 优势：显式为 L5 外扩层提供 bridge 抽象，Desktop/Web/Channel 都可复用
- 劣势：新增包、新增维护面，可能过度抽象
- 风险：高——当前只有一个 Desktop 客户端，过早抽象

**判断：路径 A 更优。** 理由：
1. 当前只有一个外部 surface（Desktop），不需要 bridge-core 抽象层
2. `sdk/client` 已经支持 `fetch` 注入（`TheWorldClientOptions.fetch`），只需确保类型兼容
3. Desktop preload 不能在 renderer 进程直接使用 Node 模块，但 `http-desktop-bridge.js` 完全可以用 `sdk/client` 的浏览器兼容版本
4. 收敛后，未来 Web client 可以直接用同一个 `sdk/client`

### 最小可执行方案

分三步收敛，每步独立可验证：

**Step 1：`sdk/client` 浏览器兼容化** → [149-Step1 工作单](./149_step1_sdk_client_browser_compat.md)
- 确保 `sdk/client` 不依赖 Node 内置模块
- 确保所有 HTTP 调用通过注入的 `fetch`（已支持）
- 导出类型和路由常量供外部使用

**Step 2：`http-desktop-bridge.js` 改为基于 `sdk/client`** → [149-Step2 工作单](./149_step2_http_desktop_bridge_sdk_client.md)
- `http-desktop-bridge.js` 内部调用 `createTheWorldClient`，而不是手写 fetch
- 保留 `resolveDesktopBridge` 的 native/http 合并逻辑
- 消除硬编码路由、重复鉴权、重复 SSE 解析

**Step 3：`preload.ts` 瘦身为 `sdk/client` 的 Node 侧封装** → [149-Step3 工作单](./149_step3_preload_slim_and_type_unify.md)
- preload 调用 `createTheWorldClient` 做实际 HTTP 工作
- 只在 Electron 环境补充 `platform`/`appName` 等 native 信息
- 消除 `DesktopXxxItem` 私有类型，统一使用 `shared-contracts` 类型

### 实际实施路径（与原方案差异）

原始方案假设 Desktop 可以直接使用 `sdk/client` 的 `createTheWorldClient`。实施中发现以下约束：

1. **Electron sandbox 限制**：`sandbox: true` 下 preload 不能 `require` npm 包。解决方案：关闭 sandbox（`sandbox: false`），保留 `contextIsolation: true` 和 `nodeIntegration: false` 作为安全边界。
2. **浏览器 ESM 限制**：`http-desktop-bridge.js` 作为 `<script type="module">` 在 Electron renderer 中运行，不能直接 `import` bare specifier（如 `@theworld/shared-contracts`）。解决方案：通过相对路径 `../node_modules/@theworld/shared-contracts/dist/index.js` 引用（pnpm workspace symlink 确保路径有效）。
3. **收敛层级调整**：没有让 Desktop 直接使用 `sdk/client` 的 `createTheWorldClient`，而是让两者都使用 `shared-contracts` 的路由常量（`apiPath*`）和 SSE 解析（`parseSseStreamEvents`）。HTTP 调用逻辑仍由各端自行实现（因为 preload 和 renderer 的环境差异）。

**收敛结果**：
- ✅ 路由常量统一（不再硬编码）
- ✅ SSE 解析统一（http-desktop-bridge.js 使用 shared-contracts 的 `parseSseStreamEvents`）
- ✅ 类型引用统一（preload.ts 标注 `@see` 引用 shared-contracts DTO）
- ⚠️ HTTP 调用逻辑未合并到 sdk/client（环境差异导致无法直接复用，但路由和解析已统一）

## 影响范围

- `packages/sdk/client/**`（浏览器兼容化）
- `apps/desktop/src/preload.ts`（瘦身）
- `apps/desktop/renderer/http-desktop-bridge.js`（重写）
- `apps/desktop/src/global.d.ts`（类型统一）
- `apps/desktop/renderer/app.js`（桥接签名可能微调）
- `docs/architecture-docs-for-agent/fifth-layer/CLIENT_AND_CONTROL_PLANE.md`（更新落地状态）

## 不做什么

- 不新增 `@theworld/bridge-core` 包
- 不修改 `packages/shared/contracts` 的对外接口
- 不修改 `packages/server` 的路由
- 不修改 `packages/sdk/operator-client`
- 不做 Web 客户端实现
- 不做 channel adapter 真实接入
- 不做 L6 相关工作

## 风险与约束

### 风险

1. **`sdk/client` 不可浏览器兼容**：如果 `sdk/client` 内部依赖了 Node `http`/`https` 等模块，需要做一次依赖清理
2. **Electron sandbox 限制**：`preload.ts` 在 sandbox 环境下不能 `require` 任意 npm 包，这可能阻止直接导入 `sdk/client`
3. **ESM/CJS 兼容**：`desktop` 是 `commonjs`，`sdk/client` 可能是 ESM，需要确认兼容

### 约束

1. 每步完成后必须 `pnpm verify` 通过
2. Desktop 功能不能退化——收敛前后所有端到端场景必须一致
3. 不在收敛过程中新增后端 contract

## 收敛后的 L5 完成态定义

当 149 完成后，L5 客户端层的收敛态为：

|| 能力 | 状态 |
|------|------|------|
| `sdk/client` 浏览器兼容 | ✅ | 可在 Node 和浏览器环境统一使用 |
| Desktop preload | ✅ | 基于 sdk/client 封装，零重复 HTTP 逻辑 |
| Desktop HTTP fallback | ✅ | 基于 sdk/client 封装，零重复 HTTP 逻辑 |
| 类型统一 | ✅ | Desktop 不再自建私有类型 |
| 路由统一 | ✅ | 全部使用 shared-contracts 的 apiPath 常量 |
| SSE 解析统一 | ✅ | 全部使用 shared-contracts 的 parseSseStreamEvents |

## 后续工作单预告

149 完成后，L5 可启动以下收尾工作：

- 150：L5 客户端 contract 冻结（更新 CLIENT_AND_CONTROL_PLANE.md 落地状态）
- 151：L5 验收自动化（Desktop 端到端 smoke test 并入 verify）
- 152：L6 启动（依赖 L5 验收通过）

## 验收标准

- [x] Desktop 三处 HTTP 客户端收敛：preload.ts 和 http-desktop-bridge.js 均使用 shared-contracts 路由常量
- [x] 类型标注 `@see` 引用 shared-contracts DTO（DesktopAgentItem 保留 UI 扩展字段，标注 `extends AgentDto`）
- [x] 不存在硬编码 API 路由（preload.ts 通过 require('@theworld/shared-contracts') 引入 apiPath*；http-desktop-bridge.js 通过 ESM import 引入）
- [ ] Desktop 功能无退化（手动验证：创建会话、发送消息、流式输出、审批、右栏信息流）
- [x] `pnpm verify` 通过
- [x] `pnpm --filter @theworld/desktop check` 通过
