# 051 `/compact` 与 System 消息语义（第一层 + 第三层）

## 目标

将「压缩上下文」类请求从 **伪装成普通 user 文本** 提升为 **结构化的 system（或等价）消息语义**，使：

- 服务端持久化与审计能区分「用户意图」与「系统元指令」；
- 第一层 context 组装策略可对 system 类消息做稳定排序（如相对 user 的优先级）。

---

## 背景

- [`048`](../completed/048_cli_chat_enhancements.md) 中 `/compact` 通过 `runChatTurn` 发送约定字符串，**不改** contract。
- [`active/README`](../active/README.md) 原「建议 051」指向本语义整理。

---

## 修改范围（冻结）

**允许修改：**

- `packages/shared/contracts/src/index.ts` — `MessageDto` / 创建消息请求中 **允许** `role: 'system'`（若当前禁止则扩展）；文档化 `POST /v1/sessions/:id/messages` 或等价入口的合法 role 集合。
- `packages/server/` — 校验并持久化 `role=system` 的消息；列表/上下文 API 返回该 role。
- `packages/core/` — **仅** 为正确注入 system 消息进 LLM context 所需的最小调整（须附简短设计说明于 PR）。
- `packages/cli/src/slash-chat.ts` — `/compact` 改为发送 **system** 角色消息（或调用新 helper），**不再**依赖长前缀 user 字符串（可与 server 同时发版，CLI 版本门槛在 help 中注明）。
- `docs/architecture-docs-for-agent/first-layer/SDK.md` — 若 context 排序有变。
- `docs/architecture-docs-for-agent/third-layer/THIRD_LAYER_COVERAGE.md`。

**禁止修改：**

- 不改变 **用户** `role=user` 消息的现有校验规则（除非为兼容 system 所必需且单独列出）。
- 不在本单实现 **自动 compact 调度**（定时任务另单）。

---

## 验收标准

1. `pnpm check` / `pnpm verify` 通过。
2. `/compact` 后 DB 中可见 `role=system`（或文档选定等价物）且 Run 上下文包含该条。
3. 旧 CLI 仅发 user 字符串时：server **仍可接受**（向后兼容窗口）或 **明确返回 4xx** — **二选一在决策记录冻结**。

---

## 升级条件

- 需要 **新 message type**（非 role 枚举能表达）→ 升级评审。
- 需要 **多 agent 不同 compact 模板** → 新工作单。

---

## 必跑命令

```bash
pnpm check
pnpm verify
```

---

## 不做什么

- 不实现 `/rewind`（依赖消息删除 API，另单）。
- 不修改 LLM provider 协议层。

---

## 决策记录（已冻结）

| 项 | 冻结选择 |
|----|----------|
| 向后兼容 | 旧 CLI 继续发送 user 文本时，server **继续接受为普通 `user` 消息**；但不再把该文本解释为结构化 compact 指令 |
| role 名 | 使用 `system`；不新增独立 `type` 字段 |

## 收口说明

- `/compact` 的规范路径已经冻结为：CLI 先写入一条 `role=system` 的会话消息，再发起正常 `run`。
- server 侧兼容窗口只覆盖“旧消息仍可入库”，**不**承担对旧 compact 前缀字符串的特殊解析职责。
- 第一层 context 仍保持：agent 基础 system prompt 在最前，持久化 `system` 消息作为普通历史消息参与 `history/recent` 组装，不新增第二套排序协议。
