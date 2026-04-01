# 008 OpenAI-Compatible LLM Provider

## 目标

在 **Core Runtime Layer** 内增加首个真实 `LLMProvider` 实现，使 `openkin` 第一层可以对接 OpenAI-compatible endpoint，并保持现有 mock 路径不变。

本计划只处理 core 内部的 provider 适配，不把目标扩大成 service API 兼容层。

## 已冻结决策

### 协议形态

- 首期只支持 `chat/completions` 风格的同步 `generate()` 路径
- 不新增 token streaming 接口
- 不把 `LLMProvider` 扩展成新的双模式接口

### 配置边界

- provider 接收显式配置对象
- `apiKey`、`baseURL`、`model` 的读取责任属于 app/demo 层，不属于 core
- 不在 core 内直接读取环境变量

### 响应映射

- 现有 `Message[]` 映射到 OpenAI-compatible request messages
- 现有 `ToolDefinition[]` 映射到 tools
- provider 输出只能落到当前 `LLMGenerateResponse`
- 网络错误、429、5xx、无效响应统一映射到 `RunError`

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/core` | 增加真实 provider、请求/响应映射与错误映射 |
| 文档 | 必要时更新 `docs/ARCHITECTURE.md` 与 `docs/QUALITY_SCORE.md` |

## 允许修改的目录

- `packages/core/`
- `docs/ARCHITECTURE.md`
- `docs/QUALITY_SCORE.md`
- `docs/exec-plans/active/`

## 禁止修改的目录

- `packages/server/`
- `packages/sdk/`
- `packages/channel-core/`
- `apps/dev-console/`
- `packages/shared/contracts/`

## 本轮范围

- 新增 OpenAI-compatible `LLMProvider`
- 冻结 request / response 映射规则
- 把 provider 错误映射到现有 `RunError`
- 保持 `MockLLMProvider` 继续可用

## 本轮不做

- 不做 streaming token 输出
- 不做多供应商 provider 矩阵
- 不做 service 层 `/v1/chat/completions` 兼容 API
- 不做浏览器端 fetch 兼容性保证

## 验收标准

1. Core 中存在可实例化的 OpenAI-compatible provider。
2. 该 provider 能把兼容 API 响应映射到现有 `LLMGenerateResponse`。
3. 现有 mock 路径不被破坏。
4. `pnpm verify` 通过。

## 必跑命令

1. `pnpm verify`

## 升级条件

- 需要把目标扩大成 service API 兼容层
- 需要为 provider 新增 streaming interface
- 需要同时支持多个供应商并抽象统一矩阵
- 连续两轮无法让 `pnpm verify` 通过

## 依赖与顺序

- **前置**：[`007`](./007_memory_ports_and_history_boundaries.md)
- **解锁**：[`009`](./009_first_layer_config_and_demo_runner.md)

## 验收结果

- **日期**：2026-04-02
- **实现**：`packages/core/src/openai-chat-provider.ts`（`OpenAiCompatibleChatProvider`）；`tool` 角色消息首行编码 `tool_call_id` 以便 OpenAI 映射（`context.ts` `toolResultToMessage`）；从 `llm.ts` 导出。
- **说明**：未改 `shared/contracts`；密钥与 base URL 仅通过构造函数注入。
