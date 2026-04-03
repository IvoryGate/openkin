# First-Layer Demo（dev-console）

## 目标

在探索阶段用 **单进程** 方式演示第一层 `OpenKinAgent` + 工具运行时，不启动 HTTP server。

**目录约定**：可执行 demo 与 `demo-shared` 在 `apps/dev-console/src/`；**回归场景与第一层审计**在 `apps/dev-console/tests/`（见该目录 [`README.md`](../apps/dev-console/tests/README.md)）。

## 入口一览

| 命令 | 说明 |
|------|------|
| `pnpm dev:first-layer` | **真实 LLM · 中文交互**：同一终端多轮对话，`OPENAI_MODEL` 写入系统提示，可问「你是什么模型」；stderr 可见每轮工具轨迹 |
| `pnpm demo:first-layer:interactive` | 与上一行相同（直接跑 `demo:interactive`） |
| `pnpm --filter @openkin/dev-console demo:live` | **单次**跑通：英文对比任务 + JSON 输出（便于脚本 / `test:first-layer-real`） |
| `pnpm test:first-layer-real` | **真实 LLM 验收**：等价于 `demo:live` 单次 run，**先检查 env**；不并入默认 `pnpm verify` |
| `pnpm demo:first-layer:mock` | **Mock LLM**：完全本地、可复现，不访问外网 |
| `pnpm demo:first-layer:scenarios` | **回归场景**：与 `pnpm verify` 中的 `test:scenarios` 一致，仍为 mock |
| `pnpm test:first-layer-audit` | **第一层审计（Mock）**：hook 顺序、中止、取消、LLM 失败、`MemoryPort`、压缩（**并入 `pnpm verify`**） |
| `pnpm test:first-layer-real-audit` | **第一层真实 API 审计**：需 `.env` 中 OPENAI_*，走真实 HTTP；覆盖工具+hook、记忆、多轮、压缩、`beforeTool` 中止（**不并入 verify**） |

真实入口与 mock 入口已分离；默认 `pnpm verify` **不会**调用真实 API。

**单次多步展示**：`demo:live` 使用多城市天气对比任务，stderr 打印「调用模型 → 工具 → 结果」链；stdout 为完整 `AgentResult` JSON。

## 真实 provider 运行方式

必填环境变量（名称固定）：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`：OpenAI 兼容根 URL，**须**包含路径前缀，使 `{OPENAI_BASE_URL}/chat/completions` 为真实接口（官方示例：`https://api.openai.com/v1`）
- `OPENAI_MODEL`（例如 `gpt-4o-mini`）

推荐：复制仓库根目录 `.env.example` 为 `.env` 并填写（`.env` 已被 gitignore，不会进版本库）。`demo-interactive` / `demo-live` 会自动加载仓库根或 `apps/dev-console` 下的 `.env`。

### LongCat（OpenAI 兼容）

- Base：`https://api.longcat.chat/openai/v1`（注意 **`/v1`**；若只写到 `/openai`，会拼错 `chat/completions` 路径）
- 模型示例：`LongCat-Flash-Chat`（以平台文档为准）

示例：

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_MODEL=gpt-4o-mini
pnpm dev:first-layer
```

若缺少任一变量，进程会打印错误说明并以非零退出码结束。

## Mock 演示

```bash
pnpm demo:first-layer:mock
```

## 覆盖矩阵

各脚本分工（Mock vs 真实、CI 是否默认跑）见 [`FIRST_LAYER_COVERAGE.md`](./FIRST_LAYER_COVERAGE.md)。

## 与仓库其它入口的关系

- **不是** `packages/server` 的 HTTP 服务，也不是 SDK / channel 集成演示。
- 服务层、SDK、通道的冒烟测试仍使用各自脚本（如 `pnpm test:server`）。
