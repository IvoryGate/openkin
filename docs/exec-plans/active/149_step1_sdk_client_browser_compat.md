# 149-Step1 · sdk/client 浏览器兼容化

## 任务边界

本单只处理 `packages/sdk/client` 的浏览器兼容化改造，使其可在 Node 和浏览器环境统一使用。

**前置判断（已完成）**：当前 `sdk/client` 已支持 `fetch` 注入（`TheWorldClientOptions.fetch`），但需要确认是否存在 Node 专属依赖。

## 影响范围

- `packages/sdk/client/**`
- `packages/sdk/client/package.json`（可能需要调整 exports/build 配置）

## 不做什么

- 不修改 `packages/shared/contracts`
- 不修改 Desktop 代码
- 不修改 `packages/server`
- 不新增 API 方法

## 实施步骤（单一路径）

1. 检查 `packages/sdk/client/src/index.ts` 中所有 import，确认无 Node 内置模块依赖（`http`、`https`、`fs`、`path`、`url` 等）
2. 检查 `packages/sdk/client/package.json` 的 `main`/`module`/`exports` 字段，确保浏览器环境可正确导入
3. 如果存在 Node 专属代码，改为通过 `options.fetch` 注入或条件加载
4. 确认 `parseSseStream` 和 `parseSseStreamEvents` 可在浏览器运行（它们依赖 `TextDecoder` 和 `AsyncIterable`，确认浏览器 `ReadableStream` 兼容）
5. 如果需要，添加浏览器构建入口（如 `browser` 字段或 conditional exports）

## 验收标准

- [ ] `sdk/client` 无 Node 内置模块依赖
- [ ] `pnpm verify` 通过
- [ ] `pnpm test:sdk` 通过
- [ ] 在浏览器环境可导入并使用 `createTheWorldClient`（可通过手动验证或新增 smoke test）

## 升级条件（命中即停）

- `sdk/client` 内部深度依赖 Node 模块，需要大幅重构
- `shared-contracts` 包不可在浏览器运行
- 需要修改 `shared-contracts` 的对外接口
