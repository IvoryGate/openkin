# dev-console 测试目录

本目录存放 **第一层 harness 的可执行测试**，与 `src/` 中的 **demo / 交互入口**分离：

| 文件 | 说明 |
|------|------|
| `scenarios.ts` | 宽回归场景（Mock LLM），`pnpm test:scenarios` / `pnpm verify` |
| `first-layer-audit.ts` | Mock 审计：hook 顺序、中止、取消、记忆、压缩 |
| `first-layer-real-audit.ts` | 真实 API 审计（需 `OPENAI_*`），`pnpm test:first-layer-real-audit` |

共享逻辑（天气工具、`createDemoToolRuntime` 等）在 `../src/demo-shared.ts`，由 demo 与测试共同引用。
