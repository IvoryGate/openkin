# High-Risk Rename Decisions

## 状态

本文件记录 high-risk rename 的最终实施结果，而不是兼容期决策草案。

适用范围：

- HTTP path
- shared contract type / DTO / SSE
- Prometheus metrics
- DB 文件名
- workspace 默认目录与运行时文件名
- 持久化内部键
- 对外 TypeScript symbol

---

## 最终结果总览

| 类别 | 最终结果 | 状态 |
|------|----------|------|
| HTTP routes / `/v1` / `/health` / `/_internal/*` | 保持现状 | `keep` |
| DTO / JSON 字段 / SSE `type` / 错误码 | 保持现状 | `keep` |
| Prometheus 指标 | 已切到 `theworld_*` | `migrated` |
| DB 文件 | 已切到 `theworld.db`，带启动迁移 | `migrated` |
| `workspace/` 默认目录 | 保持 `workspace/` | `keep` |
| `agent-YYYY-MM-DD.log` / `mcp-registry.json` | 保持现状 | `keep` |
| fail streak 持久化键 | 已切到 `_theworld_fail_streak`，带读取升级 | `migrated` |
| TypeScript symbol | 已切到 `TheWorld*` | `migrated` |
| Web Console localStorage | 已切到 `theworld_console_*`，带一次性迁移 | `migrated` |

---

## 细化说明

### 1. HTTP routes 与 wire contract

保留：

- `/health`
- `/v1/...`
- `/_internal/*`
- DTO 字段名
- SSE `StreamEvent` 结构与 `type`
- 错误码 / 状态码字符串

原因：

- 这些命名已经是中性命名
- 再次改动不会增加 rename 收益，只会额外扩大 breaking 面

结论：`keep`

---

### 2. Prometheus 指标

结果：

- 指标名前缀已统一到 `theworld_*`
- 一方测试与文档已同步更新

结论：`migrated`

---

### 3. DB 文件与 workspace 默认目录

结果：

- 运行时数据库文件已统一为 `theworld.db`
- server 启动时会探测旧数据库文件并迁移到新文件名
- 默认 workspace 目录仍为 `workspace/`

结论：

- DB 文件：`migrated`
- workspace 目录：`keep`

---

### 4. 日志与内部状态文件

保留：

- `logs/agent-YYYY-MM-DD.log`
- `mcp-registry.json`

原因：

- 这些文件名已经是中性或低收益命名
- 改动收益明显低于迁移成本

结论：`keep`

---

### 5. 持久化内部键

结果：

- scheduler 已使用 `_theworld_fail_streak`
- 读取旧键时会升级成新键
- 不再继续写出旧键

结论：`migrated`

---

### 6. TypeScript 对外 symbol

结果：

- 一方代码与公开导出统一切到 `TheWorld*`
- 旧命名不再作为一方默认符号使用

结论：`migrated`

---

### 7. 用户配置与前端存储

结果：

- Skills 与脚本已使用 `THEWORLD_*`
- Web Console 首次读取时会把旧 localStorage 键迁移到 `theworld_console_*`
- 之后只继续写入新键

结论：`migrated`

---

## 冻结结论

- wire contract 继续保持中性，不参与 rename
- observability 与 persistence 的最终名称已经切到 TheWorld 技术标识
- 本地数据保护通过一次性迁移逻辑完成，而不是长期双栈兼容
