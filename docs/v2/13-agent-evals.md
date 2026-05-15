# L1/L2 Agent 评测与 Harness

> **状态**：探索中  
> **目的**：把「先修评测再改 Agent」落到可重复命令与 CI 可选入口（论文 §8–9）。

---

## 一、本仓库分层

| 层级 | 评测方式 | 命令 / 入口 |
|------|-----------|-------------|
| L1 Core | 代码 grader：场景脚本 + 第一层审计 | `pnpm eval:l1`（JSON 报告）、`scripts/verify/l1-core.mjs` |
| L2 Tools / Skills / MCP | 脚本化冒烟 | `pnpm test:tools`、`pnpm test:skills`、`pnpm test:mcp`、`pnpm test:sandbox` |
| L3+ | 集成测试（部分仍为 pending） | `scripts/verify/l3-service.mjs` 等 |

**不推荐**用在线 LLM 做 L1 回归 gate；L1 默认 **MockLLM** 与确定性脚本。

---

## 二、Pass@k 与 Pass^k（选用场景）

- **Pass@k**：同一任务独立采样 k 次，任一成功即计通过；适合 **带随机性** 的模型或工具链探索。  
- **Pass^k**：同一任务连续 k 步或 k 轮必须全成功；适合 **强契约** 的工具编排与状态机。

本仓库 L1 harness 当前等价于 **Pass^1**：单次确定性跑完 `scenarios` + `first-layer-audit`。扩展多 seed 时，可对 `MockLLMProvider` 或场景输入做笛卡尔积，再在报告中输出 `passRate@k`。

---

## 三、CI

- 主路径：`test-l1-core` job 调用 `scripts/verify/l1-core.mjs`（内部走 `scripts/evals/l1-run.mjs`）。  
- 可选：`eval-l1` job 单独跑 `pnpm eval:l1`，失败日志含 Node 版本与 `CI` 标志，便于区分环境噪声。

---

## 四、扩展评测

新增 L1 断言时优先：

1. `apps/dev-console/tests/scenarios.ts` 或 `first-layer-audit.ts`；  
2. 保持 **无 API Key** 可运行；  
3. 不在 `packages/core/src` 的 `run-engine` 中直接引入 `node:fs`（见 `lint:architecture`）。
