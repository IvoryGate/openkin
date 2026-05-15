# theworld

Agent-Driven CI/CD 全栈 Agent 平台（v2 重构）。

## 分支

- **v2 开发**：`explore/v2-from-scratch`
- **v1 参考**：`feat/l5-client-surface`

## 快速开始

```bash
pnpm install
pnpm verify
```

## 仓库结构

```
packages/     # L1–L5 共享库（core, server, cli, sdk, channel-core）
apps/         # dev-console, web-console, desktop
scripts/      # lint、verify、ci
docs/v2/      # v2 架构与执行计划
```

详见 [AGENTS.md](./AGENTS.md) 与 [docs/index.md](./docs/index.md)。
