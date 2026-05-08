# 153-B2 — 群聊消息路由（Agent 自主判断回复）

> **状态**：已实现（客户端侧）
> **前置**：153-B1
> **预估**：1.5d

---

## 目标

群聊中用户发一条消息，不是让每个 Agent 依次回复（消息爆炸），而是让每个 Agent 自己判断是否需要回复。

---

## 核心设计

### Agent Self-Judge 路由策略

核心思想：每条群消息并行发给所有 Agent，但在消息中注入群聊上下文和回复规则，Agent 自己决定是否回复。

1. 用户发消息 → 本地添加 user message
2. **并行**为每个 Agent 创建 Run：
   - `createRun(sessionId, enrichedText, apiKey, { agentId })`
   - 每个Agent有独立的session（确保上下文隔离）
   - `enrichedText` = 群聊上下文前缀 + 原始用户消息
3. Agent 读取上下文，基于自己的角色和身份判断：
   - 如果消息与自己无关 → 回复 `[SKIP]`
   - 如果消息与自己相关 → 正常回复
4. 客户端过滤掉 `[SKIP]` 响应，只显示有效回复

### 群聊上下文注入

由于 `CreateRunRequest` 目前不支持 `systemSuffix`，临时方案是将群聊上下文拼入 user message：

```
[群聊上下文]
你在群聊「XXX」中，你的名字是「YYY」。
群成员：用户(我)、AgentA、AgentB
最近聊天记录：
用户: 之前说了什么
AgentA: 之前的回复
用户最新消息：当前消息

[回复规则]
- 如果这条消息不是在问你，或者你没有什么有用的信息可以补充，请只回复：[SKIP]
- 如果这条消息与你相关、或在问你、或你有必要补充信息，请正常回复
- 不要打招呼、不要寒暄、直接回答内容
```

**TODO**: 当服务端 `CreateRunRequest` 增加 `systemSuffix` 字段后，改为通过 `systemSuffix` 注入群聊上下文，避免污染 user message。

### SKIP 信号过滤

客户端过滤规则：
- 精确匹配 `[SKIP]`、`[skip]`、`[不回复]`、`[无需回复]`
- 以 `[SKIP]` 开头的响应也跳过
- 带句号/点号的变体也跳过

---

## 已实现位置

- 客户端路由逻辑：`apps/desktop/renderer/app.js` → `sendChannelGroupMessage()`
- 消息渲染：`renderChannelMessages()` — 群聊消息带头像、名字、Agent颜色条

---

## 验收标准

1. ✅ 群聊中用户发一条消息，所有 Agent 并行接收
2. ✅ Agent 根据上下文自主判断是否回复（回复 `[SKIP]` 则不显示）
3. ✅ 只有相关的 Agent 回复会出现在聊天界面
4. ✅ 每条 Agent 回复带有该 Agent 的头像、名字和颜色条
5. ✅ 任一 Agent 回复失败不影响其他 Agent
6. ✅ 群聊上下文（历史消息、成员列表）正确注入
