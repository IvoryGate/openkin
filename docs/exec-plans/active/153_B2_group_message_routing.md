# 153-B2 — 群聊消息路由（多 Agent 串行回复）

> **状态**：待执行
> **前置**：153-B1
> **预估**：1.5d

---

## 目标

群聊中用户发一条消息，群内所有 Agent 依次回复，每条回复带有 Agent 身份标识。

---

## 核心设计

### 串行回复策略

1. 用户发消息 → 写入 Session（createSessionMessage user）
2. 按 `agentIds` 顺序，依次为每个 Agent 创建 Run：
   - `createRun(sessionId, text, apiKey, { agentId })`
   - 等待前一个 Agent 回复完成后再发起下一个
   - Agent 间间隔 300ms，避免后端过载
3. 每个 Agent 的回复作为 assistant message 出现在同一 Session
4. 客户端根据消息顺序和 Agent 选择参数，标注每条回复的 Agent 身份

### 消息来源标识

由于现有 `MessageDto.role` 只有 `user | assistant | tool | system`，无法区分是哪个 Agent 回复的。

**首期方案**：客户端通过 Run 记录追踪：
- 创建 Run 时记录 `{ traceId, agentId }`
- Run 完成后，该 Session 最后一条 assistant message 归属于该 agentId
- 客户端维护 `traceId → agentId` 映射

**后续优化**：后端在 MessageDto 增加 `agentId` 字段（需改 shared-contracts）

---

## 验收标准

1. ✅ 群聊中用户发一条消息，群内所有 Agent 依次回复
2. ✅ 每条 Agent 回复带有该 Agent 的头像和名称
3. ✅ 前一个 Agent 回复完成后再发起下一个（串行）
4. ✅ 回复中显示"Agent A 正在回复..."指示器
5. ✅ 任一 Agent 回复失败不影响其他 Agent（跳过失败的继续）
