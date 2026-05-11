# 149-Step3 · preload.ts 瘦身与类型统一

## 任务边界

本单将 `apps/desktop/src/preload.ts` 瘦身为 `sdk/client` 的 Node 侧封装，并统一类型定义消除 `DesktopXxxItem` 私有类型。

**依赖**：149-Step2 完成。

## 影响范围

- `apps/desktop/src/preload.ts`
- `apps/desktop/src/global.d.ts`
- `apps/desktop/renderer/app.js`（可能需要适配类型变更）

## 不做什么

- 不修改 `packages/sdk/client`
- 不修改 `packages/shared/contracts`
- 不修改 `packages/server`
- 不修改 `apps/desktop/renderer/http-desktop-bridge.js`（Step 2 已处理）

## 实施步骤（单一路径）

1. **preload.ts 瘦身**：
   - 删除所有 `DesktopXxxItem` 私有类型定义
   - 删除所有手写 HTTP 函数（`fetchWithOptionalAuthRetry`、`buildHeaders` 等）
   - 删除 `parseSseStream` / `parseSseStreamEvents` 重复实现
   - 改为导入 `@theworld/sdk-client` 的 `createTheWorldClient`
   - preload 内部使用 `createTheWorldClient` 做所有 HTTP 调用
   - 保留 `platform`、`appName` 等 Electron native 信息

2. **类型统一**：
   - `global.d.ts` 中的 `TheworldDesktopSession` → 使用 `SessionDto` from `@theworld/shared-contracts`
   - `TheworldDesktopMessage` → 使用 `MessageDto`
   - `TheworldDesktopAgent` → 使用 `AgentDto` from `@theworld/shared-contracts`
   - `DesktopApprovalRecord` → 使用 `ApprovalRecordDto`（Desktop 当前缺少 `riskClass`、`runId`、`requestedAt`、`expiresAt`、`resolvedAt`、`reason` 等字段，收敛后可自动获得）
   - **⚠️ `AgentDto` 缺少 Desktop 需要的字段**：`displayName`、`avatarUrl`、`avatar`、`iconUrl`、`imageUrl` 在 `AgentDto` 中不存在。处理方式：
     - 方案 A：在 `shared-contracts` 的 `AgentDto` 中补齐这些字段（需要后端也返回）
     - 方案 B：在 `global.d.ts` 中定义 `TheworldDesktopAgent extends AgentDto` 扩展类型
     - **推荐方案 B**：这些字段可能是 Desktop 端 UI 特有需求（如头像 URL 可能需要通过其他 API 或映射得到），不应要求 `shared-contracts` 扩展

3. **operator surface 处理**：
   - Approval、Agent CRUD、System Status 在 preload 中使用 `shared-contracts` 路由常量
   - 或通过 `@theworld/sdk-operator-client` 调用

4. **Electron sandbox 约束**：
   - ⚠️ Electron sandbox 模式下 `preload.ts` 不能 `require` npm 包
   - 如果此约束成立，preload 保持为薄壳（只暴露 `platform`/`appName`），所有 HTTP 逻辑走 `http-desktop-bridge.js`（Step 2 已改造）
   - 此时 preload 中的 HTTP 函数可以完全删除，renderer 统一通过 `http-desktop-bridge.js` 调用

5. **app.js 适配**（仅限类型变更导致的编译错误）：
   - 如果 `TheworldDesktopSession` → `SessionDto` 后字段名有差异，做最小映射
   - 不做功能变更

## 验收标准

- [ ] `preload.ts` 不包含手写 HTTP 函数（或仅保留 Electron sandbox 必需的最小封装）
- [ ] `global.d.ts` 不包含 `DesktopXxxItem` 私有类型（使用 `shared-contracts` 类型或其扩展）
- [ ] 不存在硬编码 API 路由
- [ ] Desktop 功能无退化
- [ ] `pnpm verify` 通过
- [ ] `pnpm --filter @theworld/desktop check` 通过

## 升级条件（命中即停）

- Electron sandbox 不允许 preload 导入 `sdk/client`
- `shared-contracts` 中缺少 Desktop 需要的关键字段，且不适合扩展
- `SessionDto` 与 Desktop 原有类型字段差异过大，需要大量映射代码
- 连续两轮 `pnpm verify` 失败
