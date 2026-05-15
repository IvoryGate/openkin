# v2 CI/CD 设计

## 流水线

GitHub Actions 工作流：`.github/workflows/ci.yml`

| Job | 内容 |
|-----|------|
| lint | 文档、架构边界、工作区结构 |
| build | `pnpm check` + `pnpm build` |
| test-l1 … test-l5 | 分层验证脚本 `scripts/verify/`（L1 与本地 `pnpm eval:l1` 同源：`scripts/evals/l1-run.mjs`） |
| verify | 完整 `pnpm verify` |

## 本地验证

```bash
pnpm install
pnpm verify
```

L1 快速评测（与 `scripts/verify/l1-core.mjs` 同源）：

```bash
pnpm eval:l1
```

说明见 `docs/v2/13-agent-evals.md`。

## 分层脚本

```
scripts/verify/
├── index.mjs           # 汇总
├── l1-core.mjs         # L1（委托 scripts/evals/l1-run.mjs）
├── l2-tools.mjs        # L2 工具（骨架阶段为 pending）
├── l3-service.mjs      # L3 服务
├── l4-product.mjs      # L4 产品面
└── l5-sdk-channels.mjs # L5 SDK / Channel

scripts/evals/
└── l1-run.mjs          # L1 harness：scenarios + first-layer-audit，JSON 报告
```

**L1/L2 已落地**：`test:scenarios`、`test:first-layer-audit`、`test:tools`、`test:mcp`、`test:skills`、`test:self-management`、`test:sandbox` 为真实测试。

L3–L5 集成测试仍以 `scripts/lib/pending.mjs` 占位，Wave 2+ 逐步替换。
