# Active Exec Plans

本目录用于存放**当前进行中的**执行计划。

## 当前队列

| 编号 | 计划名 | 前置依赖 | 状态 |
|------|-------|---------|------|
| [024](./024_debug_and_introspection_api.md) | Debug & Introspection API | 018、020、021 | ⬜ 待启动 |
| [025](./025_web_console.md) | Web 调试控制台（web-console SPA） | 024 | 📋 已规划 |

**第三层深化（018–023）已全部收口**，归档见 [`../completed/README.md`](../completed/README.md) 中「第三层：Service And Protocol Layer（018–023）」。

新增计划时：

1. 在本目录新增 `NNN_*.md`
2. 在本 README 的「当前队列」表中登记编号、依赖与状态

---

### 历史参考（已归档）

- **第三层（018–023）**：持久化、Session/Message API、鉴权与健康检查、可观测性、Agent CRUD、定时任务 — [`../completed/`](../completed/) 对应文件。
- **第二层（013–017）**：[`../completed/README.md`](../completed/README.md)
- **第一层（007–012）与跨层（004–006）**：同上。

---

每份计划建议只解决一个清晰增量，并包含：目标、修改范围、验收标准、决策记录、允许/禁止修改目录、必跑命令、升级条件。
