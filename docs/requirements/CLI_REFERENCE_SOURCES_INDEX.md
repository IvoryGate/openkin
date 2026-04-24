# CLI 参考源摘要目录

本目录收录对 **本机** 两棵参考工程树的 CLI/TUI/交互相关**阅读型**摘要，供 TheWorld 继续设计 `packages/cli` 时对照理念与模式（**不**构成直接复制或子模块依赖；开放仓库以外路径仅作“理念参考”记录）。

| 文档 | 说明 |
|------|------|
| [CLI_REFERENCE_OPENCODE_AND_DESKTOP_SRC_ANALYSIS.md](./CLI_REFERENCE_OPENCODE_AND_DESKTOP_SRC_ANALYSIS.md) | 对 **OpenCode** 与 **Desktop `src`** 的详细分析：**功能与信息架构** + **终端 UI 视觉语言**（字标/色板/语义 token/shimmer/降载/主题变体等）及与 TheWorld 的对照 |
| [THEWORLD_CLI_SHELL_DESIGN.md](./THEWORLD_CLI_SHELL_DESIGN.md) | 基于参考报告沉淀出的 TheWorld CLI shell 冻结设计：吸收什么、不吸收什么，以及 `059`、`060` 与新 TUI 序列的关系 |
| [THEWORLD_TUI_PRODUCT_DESIGN.md](./THEWORLD_TUI_PRODUCT_DESIGN.md) | 新的 TheWorld 全屏 TUI 产品级冻结设计：定义 transcript、shell layout、session identity、status、token 与降载策略，并作为 `063`–`066` 的上游依据 |
| [THEWORLD_CLI_SHELL_PARITY_DESIGN.md](./THEWORLD_CLI_SHELL_PARITY_DESIGN.md) | 新的 TheWorld shell 级产品冻结设计：定义 home shell、conversation shell、session/thread、help/command surface、design system、Wave 1 / Wave 2 边界，并作为 `067`–`072` 的上游依据 |
| [../architecture-docs-for-agent/second-layer/CLI_SHELL_CONTRACT_GAPS.md](../architecture-docs-for-agent/second-layer/CLI_SHELL_CONTRACT_GAPS.md) | 把 shell parity 中不能继续靠 CLI 壳层解决的差距分类为 contract roadmap，避免弱模型在 shell 工单里自行扩张 API |

## 参考源路径（分析当时）

| 代号 | 路径（本机） | 性质（摘要） |
|------|----------------|----------------|
| **OpenCode** | `~/Desktop/opencode` | 开源 monorepo（`anomalyco/opencode` 类布局）：Bun、主包 `packages/opencode` 提供 `opencode` 二进制、yargs 入口、CLI `UI` 层、TUI 子命令等 |
| **Desktop `src`** | `~/Desktop/src` | 大型应用侧 `src` 树：自定义 Ink 包装、设计系统 ThemeProvider、命令注册表、成本/上下文/多传输层等 |

若路径迁移，可只更新上表与分析报告开头的「元数据」段，不强制与仓库版本绑定。

## 与仓库正式需求的关系

- 权威需求仍以 [`PROJECT_CLI.md`](./PROJECT_CLI.md) 等为准；本摘要为**增量启发**，落地需走 `docs/exec-plans` 与 contract 边界。
- 与 exec-plan 056/058 的 Ink TUI 方向正交：这里强调**产品级 CLI 习惯**与**可观测/模式切换**，而非单点实现。
- 参考报告如果已经完成吸收，应继续以下游设计与工单为准，而不是让弱模型直接从参考报告自行二次抽象。
