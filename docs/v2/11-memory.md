# v2 记忆系统设计（L1 视角）

> **状态**：探索中（工单 208 落地子集）  
> **范围**：L1 `MemoryPort`、上下文注入、workspace 语义记忆与情景归档；持久化实现可在 L3 或适配器中完成。

---

## 一、四层记忆（与论文 §5 对齐）

| 类型 | 含义 | 本仓库落点 |
|------|------|------------|
| 工作记忆 | 当前对话窗口内的 messages | `SessionRuntime.history` + `SimpleContextManager` 的 recent/history 分块 |
| 程序性记忆 | 可复用流程与约束 | `workspace/skills/*/SKILL.md`，按需经 `read_skill` / 工具链加载 |
| 情景记忆 | 单次会话轨迹 | 会话内 history；跨重启由 L3（JSONL/SQLite 等）持久化，L1 只消费 `MemoryPort` 读到的摘要行 |
| 语义记忆 | 跨会话长期事实 | `workspace/MEMORY.md`（或工作区根下同名文件），**显式读取再注入**，默认不整文件塞进 system |

L1 **只定义** `MemoryPort` 的读写契约与注入顺序；**不绑定**具体数据库实现。

---

## 二、注入顺序（与压缩管线）

1. `buildSnapshot` 组装 `ContextBlock`：`system` → `memory`（`MemoryPort.read`）→ `history`（可压缩）→ `recent`（固定窗口）。  
2. 对 **history** 中的大段 tool 文本可应用 **占位截断**（见 `compactToolOutputsInMessages`）。  
3. `TrimCompressionPolicy` 等在块级别做 token 预算裁剪；记忆块通常视为 pinned，优先保留策略见 `docs/v2/10-l1-core.md` 附录。

---

## 三、整合与回退（archive-first）

`archiveAndConsolidateEpisodic`（`packages/core/src/memory/consolidation.ts`）：

1. 先将待整合消息 **逐行 JSON** 写入 `workspace/memory/archive/<session>-<timestamp>.jsonl`。  
2. 摘要成功后再追加到 `MEMORY.md`；失败则 **不** 标记 `memoryUpdated`，原始仍在 archive 中可审计。

测试：`apps/dev-console/tests/scenarios.ts` 中 `memory_consolidation_archives_on_forced_fail`。

---

## 四、语义记忆读取

`FileSemanticMemoryPort`（`packages/core/src/memory/file-semantic-memory.ts`）对工作区 `MEMORY.md` 做 **有上限** 的读取，供 `MemoryPort.read` 注入为摘要消息，而非隐式塞满 system。

---

## 五、与 L3 的边界

- **L1**：类型、注入点、失败语义、archive 文件布局约定。  
- **L3**：会话消息表、事件流、多租户隔离与备份策略。  
- 若 L3 写入 DB 的会话行与 L1 `importSessionHistory` 对齐，则情景记忆在重启后由 L3 回填，L1 行为不变。
