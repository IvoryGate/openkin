# 097 · `pnpm verify` / 集成测试长时间卡住 — 移交工单

## 状态

**已收口（环境侧已验证可恢复整段 `verify`）**：保留本文件为 **design note**，记录曾经的风险点与已落地缓解（`scripts/lib/integration-test-helpers.mjs`、若干烟测的 SSE/stdio 处理）。

## 现象（历史）

- 后台执行 `pnpm verify` 或串联的 HTTP 烟测，曾出现**极长时间不结束**（或输出停在某条 `test:*` 之后）。

## 已做改动（见仓库）

1. `scripts/lib/integration-test-helpers.mjs` — `drainChildStdioForBackpressure`、`fetchRunStreamSseText`（默认 120s，`THEWORLD_TEST_SSE_TIMEOUT_MS` 可配）。
2. 大量 `scripts/test-*.mjs` 在子进程 boot 后 drain；对 Run SSE 使用有界读取。
3. `run-sdk-smoke.ts`、`run-session-message-smoke.ts`、`run-run-cancel-smoke.ts` 等带超时的流式读。

## 若复发

- 分段运行 `verify` 中的子命令定位卡点；`grep '/stream'` / `streamRun` 查遗漏。
- 仍可对整段 `pnpm verify` 使用**进程级** `timeout` 作为 CI 硬底线。

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 与 L3/089 队列的关系

本单为 **harness 稳定性** 记录，不替代功能子单；与 `089` 子单正交。
