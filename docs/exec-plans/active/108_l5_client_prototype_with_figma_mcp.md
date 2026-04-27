# 108 · L5 客户端原型（先接 Figma MCP）

> 状态：superseded（2026-04-27）。  
> 后续主路径：`110_l5_client_componentized_design_and_dev_workorders.md`。

## 任务边界

本单用于冻结 L5 客户端原型阶段的单一路径：**先完成 Figma MCP 接入，再进行原型设计与交互验证**。

## 影响范围

- **L5 Client and Control Plane**
  - 客户端原型设计输入从纯文档切换为 Figma 文件上下文
  - 客户端需求讨论可直接引用 Figma MCP 工具输出
- **L3/L4（不改）**
  - 不新增服务端 API
  - 不调整运行时/调度/审批等协议

## 不做什么

- 不在本单实现正式客户端 UI 代码
- 不引入多设计平台并行（仅 Figma）
- 不在本单改动 SDK 对外 contract

## 单一路径实施

1. 在 `workspace/mcp-registry.json` 注册 `figma` MCP server（stdio）
2. 在启动 server 的环境中注入 `FIGMA_API_KEY`
3. 重启 `packages/server/src/cli.ts` 使 MCP registry 生效（或走热注册）
4. 通过 `GET /_internal/mcp/status` / `GET /v1/tools` 确认 `figma` provider 可见
5. 再开始 L5 原型设计文档与交互稿评审

## 验收标准

- `workspace/mcp-registry.json` 存在 `figma` MCP 配置
- 服务启动后 `/_internal/mcp/status` 可见 `figma` provider
- `GET /v1/tools` 出现来自 `figma` provider 的 MCP 工具

## 升级条件

- 无法获得 `FIGMA_API_KEY`
- MCP server 启动失败且两轮重试仍不可用
- 需要新增/修改跨层 API contract 才能继续原型阶段
