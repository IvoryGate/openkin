# Active Exec Plans

本目录用于存放**当前进行中的**执行计划。

## 当前队列

| 编号 | 名称 | 依赖 | 状态 |
|------|------|------|------|
| `038` | `Deep Rename Program` | 037 | 规划中 |
| `039` | `Repo Rename Matrix And Compat` | 038 | 可执行工作单 |
| `040` | `Package Scope And Import Migration` | 038 / 039 | 可执行工作单 |
| `041` | `Env Docs Scripts Rename` | 038 / 039 | 可执行工作单 |
| `042` | `High-Risk Contract And Path Rename` | 038 / 039 / 040 / 041 | 升级入口 |

最近已归档：

- `035`–`037` Slash commands、Terminal UX、TheWorld 表层重命名 — [`../completed/`](../completed/) 对应文件。
- `043`–`044` TS symbol alias、Skill / Console compat cleanup — [`../completed/`](../completed/) 对应文件。
- `045` Observability / persistence hard cut — [`../completed/045_observability_and_persistence_rename_strategy.md`](../completed/045_observability_and_persistence_rename_strategy.md)
- `028`–`034` 见 [`../completed/README.md`](../completed/README.md)「CLI shell」。

新增计划时：

1. 在本目录新增 `NNN_*.md`
2. 在本 README 的「当前队列」表中登记编号、依赖与状态

---

### 历史参考（已归档）

- **CLI shell（028–037）**：统一 CLI、operator-client、会话/tasks/inspect、打磨、slash、终端 UX、TheWorld 展示名 — [`../completed/README.md`](../completed/README.md)。
- **第三层与调试补强（018–027）**：[`../completed/README.md`](../completed/README.md)
- **第二层（013–017）**：同上
- **第一层（007–012）与跨层（004–006）**：同上

---

每份计划建议只解决一个清晰增量，并包含：目标、修改范围、验收标准、决策记录、允许/禁止修改目录、必跑命令、升级条件。
