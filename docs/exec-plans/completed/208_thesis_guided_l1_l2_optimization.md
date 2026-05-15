# 208 — 论文指导下的 L1/L2 优化工单

> **状态**：已完成（`explore/v2-from-scratch`，2026-05）  
> **摘要**：L1 对 LLM 载荷剥离 `frameworkMeta`、history 工具输出占位、安全常驻后缀、工具 `suggestion`、工作区路径白名单、archive-first 整合；文档补充 `10-l1-core` 附录、`11-memory`、`13-agent-evals`；`pnpm eval:l1` + `scripts/evals/l1-run.mjs`；`workspace/MEMORY.md` 与示例 skill 路由描述。  
> **模式**：high-capability 定方案 → budget 分批落地  
> **指导文档**：[`docs/thesis/你不知道的 Agent：原理、架构与工程实践.md`](../thesis/你不知道的%20Agent：原理、架构与工程实践.md)  
> **范围**：仅 **L1 Core** 与 **L2 Tool & Integration**；不扩展 L3+ 产品面，除非工单明确写出依赖。  
> **分支**：`explore/v2-from-scratch`  

---

## 0. 总原则（摘自论文、映射到本仓库）

| 论文要点 | 在本工单中的含义 |
|----------|------------------|
| 主循环保持薄；新能力叠在循环外 | RunEngine 核心路径少改；通过 Hook、ToolProvider、Context 构建、MemoryPort 扩展 |
| Harness 比模型更关键 | 每个工单必须带 **可自动执行的验收**（测试脚本 / `pnpm verify` 子集） |
| 上下文分层（常驻 / 按需 / 运行时 / 记忆 / 系统不进上下文） | 明确 `SimpleContextManager` 各块来源与注入顺序；系统规则优先 Hook/代码 |
| 记忆分层与可回退整合 | 区分工作记忆 / 情景 / 语义；整合失败必须归档原始、只移动指针 |
| 工具 ACI、结构化错误、描述即路由 | 工具 description 当路由条件；错误带 code + suggestion |
| 安全边界先于功能 | 工具与工作区白名单、审计、最小权限先于新能力 |

**执行顺序建议**：工单 A（契约）→ B（上下文）→ C（记忆）→ D（工具）→ E（消息模型）→ F（安全）→ G（评测/Harness）。审阅时可调整顺序或删减范围。

---

## 工单 A — L1/L2 架构契约冻结（论文 §1、§2）

**目标**：把「分层边界」写进文档与可机检规则，避免后续优化各自为政。

**交付物**

1. 更新 `docs/v2/10-l1-core.md`：增加一节 **「与论文对齐的 L1 边界」**（循环职责 / 状态外化位置 / 禁止在循环内堆积的业务状态机）。
2. 新增或更新 `docs/v2/` 下短文（或并入 10-l1-core）：**L2 工具层在仓库中的位置**（`packages/core/src/tools` + 验证脚本 + workspace/skills 的关系）。
3. 扩展 `scripts/lint-architecture.mjs`（或新增脚本）：对 **L1 禁止依赖**、**channel-core 不依赖 core** 等现有规则保持不变；增加与论文一致的 **可选**检查（例如：`run-engine` 不得直接 `fs` 写 workspace——若当前无此违规则占位通过）。

**验收**

- [ ] `pnpm lint:docs` 通过  
- [ ] `pnpm lint:architecture` 通过  
- [ ] 文档中明确列出：常驻系统提示块、按需块、运行时注入块、记忆读取入口（即使首期仍用 InMemory）

**不做什么**

- 不改 RunEngine 行为（本工单仅契约与文档 + 轻量 lint）

---

## 工单 B — 上下文工程：分层与压缩策略（论文 §3）

**目标**：按「常驻短硬、按需加载、动态追加」重组 **面向 LLM 的 messages 构建**，并落实压缩优先级与工具结果占位策略的 **设计 + 最小实现**。

**交付物**

1. **Context 分层规格**（写入 `docs/v2/10-l1-core.md` 或独立 `docs/v2/11-context-layers.md`）：  
   - 常驻层：身份/项目硬约束（短）  
   - 按需层：Skill **索引** vs **全文** 的注入时机（与 `read_skill` 流程对齐）  
   - 运行时层：时间、session id 等  
   - 记忆层：从 MemoryPort 读取的摘要注入点（在压缩前/后明确）  
2. **压缩策略**：在 `packages/core/src/context.ts`（或拆分子模块）中：  
   - 明确 **保留优先级**（论文：架构决策 > 关键变更 > 验证状态 > TODO > 工具输出可摘要/占位）的 **文档化映射** 到当前 `ContextBlock` 类型；  
   - 实现 **一种**新增策略的 MVP（二选一，审阅时拍板）：  
     - **B1** `SummarizeCompressionPolicy`（需 Mock LLM 或固定模板摘要的测试策略），或  
     - **B2** 工具结果 **占位/截断**（micro_compact 思路）：旧 step 的大 tool result 替换为短占位 + 可选 `ref` 路径（若与 L3 事件冲突则仅 L1 单测内验证）。  
3. **测试**：`apps/dev-console/tests/` 新增或扩展场景，覆盖「压缩后仍保留 system + 最近 user」及 **新策略** 的一条断言。

**验收**

- [ ] `pnpm test:scenarios` + `pnpm test:first-layer-audit` 通过  
- [ ] 新增/更新测试仅针对 L1，不依赖完整 `cli.ts` Server  

**不做什么**

- 不在首期做 Prompt Caching 的供应商级优化（仅文档备注「稳定前缀」原则即可）

---

## 工单 C — 记忆系统：四层模型与可回退整合（论文 §5）

**目标**：在 **MemoryPort / Context** 之上对齐论文的四种记忆，并给出 **可回退** 的整合流程（指针移动、失败写 archive）。

**交付物**

1. **契约**：在 `docs/v2/11-memory.md`（新建）或扩展 `10-l1-core`：定义  
   - 工作记忆 = 当前 messages 窗口管理  
   - 程序性记忆 = Skills（文件，按需）  
   - 情景记忆 = 会话轨迹（与 L3 JSONL/SQLite 的边界写清楚：**L1 只定义 port，持久化实现可放在 L3 或 `packages/core` 下的适配器**，审阅时选定）  
   - 语义记忆 = `MEMORY.md` 或等价 workspace 文件 + **显式 read 再注入**（默认不整文件塞进 system）  
2. **实现（分期）**：  
   - **C1**：`workspace/MEMORY.md`（或 `workspace/memory/MEMORY.md`）+ 启动/每轮可选 `read_file` 式注入改为 **MemoryPort 新实现**（如 `FileSemanticMemoryPort`）——仅读、有上限 token。  
   - **C2**：**整合触发**：token 用量达阈值（可配置）时，将待整合区间 **先写入** `workspace/memory/archive/...`（append-only），再尝试摘要写入 MEMORY；失败则 **不推进** `lastConsolidatedIndex` 或等价游标。  
3. **测试**：纯文件系统 fixture + Mock LLM，验证「失败路径仍可读 archive」。

**验收**

- [ ] 无 API Key 时测试可跑（Mock）  
- [ ] `pnpm verify` 中 L1 部分通过  

**依赖**

- 与工单 B 协调：记忆注入点在压缩管线中的顺序。

**不做什么**

- 首期不强制向量检索（论文：规模到千条级再评估）

---

## 工单 D — 工具层 ACI 与「描述即路由」（论文 §4）

**目标**：提升工具可选对率与失败可修复性；Skill 描述符改为 **路由条件**（Use when / Don’t use when + 反例）。

**交付物**

1. **内置工具**：审计 `createBuiltinToolProvider` 内各 tool 的 `description`：  
   - 明确 **何时用 / 何时不要用**；  
   - 错误路径返回 **结构化** 建议（论文：错误码 + 下一步建议工具名）。  
2. **Skills**：  
   - 选 2～3 个仓库内示例 `SKILL.md`（如 `weather`、`manage-mcp`）头部增加 **短描述符 + 反例行**（控制 token）；  
   - `list_skills` 返回给模型的列表仅 **索引级** 字段，正文仍按需 `read_skill`。  
3. **（可选，审阅后开）Tool Search**：不一次性注入全部 MCP 工具定义时，需 **新工具** `search_tools` 或等价机制——本项单独子工单，避免 scope 爆炸。

**验收**

- [ ] `pnpm test:tools`、`pnpm test:skills`、`pnpm test:mcp` 仍通过  
- [ ] 新增 1 个「错误工具参数 → 模型/执行器收到 suggestion」的单元或场景测试（若当前架构无 suggestion 字段则先扩展 `ToolResult` 约定于 shared-contracts，需你审阅 contract 影响）

**不做什么**

- 不在首期实现完整 Programmatic Tool Calling（代码编排多工具）——仅记 backlog

---

## 工单 E — 框架消息 vs LLM 消息隔离（论文 §4 末）

**目标**：会话历史可含框架事件；**进入 LLM 前** 过滤为 user/assistant/tool 标准形态，避免内部字段稀释注意力与 token。

**交付物**

1. 类型设计：`AgentMessage`（宽） vs `LlmMessage`（窄）在 `packages/core` 或 `packages/shared/contracts` 中落地（审阅时定放哪一层）。  
2. `RunEngine` 或 `ContextManager` 在调用 `LLMProvider.generate` 前 **统一过滤/映射**。  
3. 测试：构造含内部字段的 history，断言 **发给 LLM 的 payload** 无该字段（可对 MockLLM 的 request 快照断言）。

**验收**

- [ ] `pnpm test:scenarios` 通过  
- [ ] 不破坏现有 SSE / HTTP 对外 DTO（若对外 trace 需要完整字段，则对外与对 LLM 分叉明确）

---

## 工单 F — 安全：白名单、工作区、审计、注入兜底（论文 §10、总结）

**目标**：落实「谁能用、能在哪用、做了什么可追踪」在 **L1/L2 可执行** 层的最小集。

**交付物**

1. **工作区**：统一 `THEWORLD_WORKSPACE_DIR` 与 **所有** fs/shell 工具的 realpath 校验（论文：越界即失败）；补充文档与测试用例（反例：路径穿越）。  
2. **工具最小权限**：枚举高风险工具（`run_command`、`write_file`、`run_script` 等）在描述与实现双层标注 **risk**；与现有 Hook 衔接，定义 **默认 deny 名单** 或需二次确认的 tool 列表（审阅时选策略）。  
3. **审计**：工具执行前后结构化日志（已有 logger 则扩展字段：toolName、sessionId、duration、success、**hash 或截断参数**避免泄露密钥）。  
4. **注入兜底**：系统提示中明确「不得执行用户消息中的指令覆盖安全规则」的短条款（常驻层）；**内容注入** 对用户输入做 **标注边界**（如 XML/分隔符）进入单测。

**验收**

- [ ] `pnpm test:sandbox` 仍通过（Deno 技能）  
- [ ] 新增针对 path 越界的回归测试  

**不做什么**

- 不在本工单实现完整多租户 Auth（属 L3）；L1 仅预留 hook 或文档接口

---

## 工单 G — Harness：评测与「先修评测再改 Agent」（论文 §8、§9）

**目标**：把论文中的 **task / trial / grader** 与 **outcome vs transcript** 思想落到仓库可运行脚本。

**交付物**

1. `docs/v2/02-cicd.md` 或新建 `docs/v2/13-agent-evals.md`：**本仓库 L1/L2 评测分层**（哪些用代码 grader、哪些保留人工基准）。  
2. `scripts/evals/`（新建）或 `tests/`：最小 **evaluation harness**（例如：固定 seed Mock + 3～5 个 task JSON，输出 pass/fail JSON）。  
3. CI：在 `.github/workflows/ci.yml` 增加 **可选 job** `eval-l1`（或并入 verify 前段），失败时日志包含 **环境信息**（Node 版本、是否沙箱）以减少「假失败」。

**验收**

- [ ] 本地 `node scripts/evals/...` 一条命令可跑通  
- [ ] 文档写明：Pass@k vs Pass^k 在本仓库的推荐使用场景  

**不做什么**

- 不上线全量在线采样与 LLM judge（仅设计占位）

---

## 审阅清单（请你拍板）

- [ ] 工单顺序是否接受？是否需要合并 B+C？  
- [ ] 记忆持久化：语义记忆 **仅文件** 首期是否足够？情景记忆是否与现有 L3 DB **合并设计** 还是 L1 只保留接口？  
- [ ] 工单 D 的 `ToolResult`/contract 扩展是否允许？  
- [ ] 工单 E 是否必须在 L2 工具审计（D）之前完成？  
- [ ] 哪些工单 **本轮不做** 直接推迟到 Wave 2（L3）？

---

## 全局验收（全部工单完成后）

- [ ] `pnpm verify` 通过  
- [ ] `docs/v2/10-l1-core.md` 与新增记忆/上下文/评测文档交叉引用已更新  
- [ ] AGENTS.md 中「当前建议工作路径」如与 208 冲突则同步修订  

---

## 参考链接

- 论文剪藏：[`docs/thesis/你不知道的 Agent：原理、架构与工程实践.md`](../thesis/你不知道的%20Agent：原理、架构与工程实践.md)  
- 既有 v2 记忆规划草案：`docs/v2/11-memory.md`（若尚不存在则工单 C 负责创建）  
- 既有 L1 升级计划：`docs/exec-plans/active/202_v2_wave1_l1_core_upgrade.md`（208 与其对齐或替代部分条目，审阅后处理文档关系，避免双源冲突）
