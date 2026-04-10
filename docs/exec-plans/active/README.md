# Active Exec Plans

本目录用于存放**当前进行中的**执行计划。

## 当前队列

当前无进行中计划。下一批增量建议参见「下一步方向」。

---

## 下一步方向参考

从 high-capability mode 评估（2026-04-10），当前仓库状态已完成：

- 第一层 Core Runtime（001–012）✅
- 第二层 Tools & Integration（013–017）✅
- 第三层 Service API（018–027）✅
- CLI shell（028–037）✅
- Deep rename（038–045）✅
- Session Runs API / world alias / CLI chat 增强（046–048）✅

**建议下一批优先级（可顺序拆成单一增量工作单）：**

| 建议编号 | 方向 | 层级归属 | 理由 |
|----------|------|----------|------|
| `049` | `GET /v1/sessions` 过滤增强（按 `kind`、`agentId`、时间游标） | 第三层 Service API | `listSessions` 目前客户端缺少 `kind` 过滤，`--continue` 逻辑只能拿 limit=1 + 遍历 |
| `050` | Session 重命名 API（`PATCH /v1/sessions/:id`，`name` 字段）| 第三层 Service API | 补 `/rename` CLI 命令的持久化路径；operator surface |
| `051` | `/compact` 专属 system prompt 消息类型（`role: system`）| 第一层 / 第三层 | 当前 compact 是普通 user message，语义不准 |
| `052` | Run 取消 API（`DELETE /v1/runs/:traceId` 或 `POST cancel`）| 第三层 Service API | 补 `/rewind` 前置能力 |
| `053` | Web Console 会话增强（显示 runs 历史、session name）| 第三层 UI | 利用 046 的 `GET /v1/sessions/:id/runs` 补充界面 |

新增计划时：

1. 在本目录新增 `NNN_*.md`
2. 在本 README 的「当前队列」表中登记编号、依赖与状态

---

### 历史参考（已归档）

- **CLI 增强（046–048）**：Session Runs API、`world` 别名、`chat -c/--continue`/初始提示/slash 增强 — [`../completed/`](../completed/) 对应文件。
- **CLI shell（028–037）**：统一 CLI、operator-client、会话/tasks/inspect、打磨、slash、终端 UX、TheWorld 展示名 — [`../completed/README.md`](../completed/README.md)。
- **第三层与调试补强（018–027）**：[`../completed/README.md`](../completed/README.md)
- **第二层（013–017）**：同上
- **第一层（007–012）与跨层（004–006）**：同上

---

每份计划建议只解决一个清晰增量，并包含：目标、修改范围、验收标准、决策记录、允许/禁止修改目录、必跑命令、升级条件。
