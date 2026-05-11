# Archive

本文件是当前探索分支的标准归档入口。

说明：

1. 仓库规则、`docs/index.md` 与文档 lint 都以 `docs/archive/README.md` 作为归档入口
2. 当前历史方案文件的物理存放位置仍是 `docs/architecture-docs-for-human/`
3. 在这一层迁移完成之前，统一通过本 README 导航，不要求立即重排历史目录

## Git 弃用分支（Cron / Heartbeat 探索）

以下分支已从 `feat/*` **重命名为 `archive/deprecated-*`**，仅保留提交指针供考古；**请勿基于其继续开发**。

| 原名 | 现名 | 说明 |
|------|------|------|
| `feat/cron-heartbeat` | `archive/deprecated-feat-cron-heartbeat` | Cron/heartbeat 相关工作流实验 |
| `feat/agent-runtime-cron-heartbeat` | `archive/deprecated-feat-agent-runtime-cron-heartbeat` | Agent Runtime Cron/heartbeat 分支（远端旧名 `feat/agent-runtime-cron-heartbeat` 已删除） |

---

## 当前归档内容

### backend-plan

这是最初的后端导向设计集合，包括：

- [`../architecture-docs-for-human/backend-plan/AI_Agent_Backend_Tech_Plan.md`](../architecture-docs-for-human/backend-plan/AI_Agent_Backend_Tech_Plan.md)
- `../architecture-docs-for-human/backend-plan/extensions/`
- `../architecture-docs-for-human/backend-plan/layer1-design/`

## 推荐使用方式

如果你想了解：

- 当前探索方向：优先看 `../index.md`
- 当前全栈架构：优先看 `../architecture-docs-for-agent/ARCHITECTURE.md`
- 历史后端设计基线：从本目录进入，再跳转到 `architecture-docs-for-human` 中的实际历史文件
