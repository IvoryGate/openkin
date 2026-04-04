# 第一层能力覆盖说明

目标：说清楚 **Mock 审计**、**真实 API 审计** 与 **scenarios** 各自验什么，以及为何不能「全部用真实 API」默认跑在 CI 里。

**代码位置**（均在 `apps/dev-console/tests/`）：

- `scenarios.ts` — 宽回归场景  
- `first-layer-audit.ts` — Mock 审计  
- `first-layer-real-audit.ts` — 真实 API 审计  

与 `src/` 下 demo 入口的说明见 [`apps/dev-console/tests/README.md`](../../apps/dev-console/tests/README.md)。

## 三条验证线

| 入口 | 是否调用外网 | 典型用途 |
|------|----------------|----------|
| `pnpm test:first-layer-audit` | 否（Mock LLM） | CI / `pnpm verify`：确定性、零费用、可断言 hook **顺序** |
| `pnpm test:first-layer-real-audit` | **是**（`.env` 中 OPENAI_*） | 本机/预发：真实 HTTP、真实模型行为、供应商兼容性 |
| `pnpm demo:first-layer:scenarios` | 否 | 宽回归：预算、超时、限流码、工具缺失等 JSON 场景 |

## 生命周期 Hook（`AgentLifecycleHook`）

| Hook | Mock 审计 | 真实审计 | 说明 |
|------|-----------|----------|------|
| `onRunStart` | ✓（顺序） | ✓（工具用例中带 recording） | 每轮 `run` 一次 |
| `onRunEnd` | ✓ | ✓ | 正常/失败/中止路径都会走到 `finish` |
| `onRunError` | ✓（LLM 抛 `RunError`） | 不默认测 | 真实 API 下制造稳定失败成本高；由 Mock 保证路径 |
| `onBeforeLLMCall` / `onAfterLLMCall` | ✓（顺序） | ✓（多轮/记忆/压缩用例中记录） | |
| `onBeforeToolCall` / `onAfterToolCall` | ✓（工具路径） | ✓（工具路径） | |
| `onBeforeToolCall` → `abort` | ✓（Mock） | ✓（真实） | 中止工具执行，状态 `aborted` |

## 其它运行时语义

| 能力 | Mock 审计 | 真实审计 | scenarios |
|------|-----------|----------|-----------|
| `AbortSignal` 取消 | ✓ | 未单独测（与 Mock 重复） | ✓ `cancelled` |
| `timeoutMs` | 否 | 否（避免 flaky） | ✓ `failed_timeout` |
| `maxSteps` / `maxToolCalls` | 部分 | 否 | ✓ `budget_exhausted` 等 |
| LLM 返回 `RunError`（如限流） | ✓ | 否 | ✓ `llm_rate_limit_surfaces_as_failed` |
| `MemoryPort.read` 注入 prompt | ✓（快照含标记） | ✓（标记或语义） | ✓ `memory_port_injects_summary…` |
| `maxPromptTokens` + `TrimCompressionPolicy` | ✓（`SimpleContextManager`） | ✓（多轮长文后收紧预算） | ✓ `context_budget_trim…` |

## 为何不「全部真实、全部进 verify」

1. **费用与配额**：每次 `verify` 都调真实 API 会放大成本且受供应商限流影响。  
2. **确定性**：hook **精确顺序**、LLM **抛错**、**工具中止** 等用 Mock 才能稳定复现；真实模型可能偶尔不按指令调工具。  
3. **真实审计已单独提供**：配置好 `.env` 后执行 `pnpm test:first-layer-real-audit`，用与你本机相同的 key/端点做端到端核对。

## 推荐用法

- 日常提交：`pnpm verify`（含 Mock `test:first-layer-audit`）。  
- 联调/发版前：配置 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 后运行 `pnpm test:first-layer-real-audit`。  
- 若真实审计里「工具用例」因模型未调用工具而失败：可更换更强/更听话的模型，或检查 base URL 是否含正确 `/v1` 前缀（见 `DEMO_FIRST_LAYER.md`）。
