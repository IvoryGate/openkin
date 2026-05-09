# 157-2 — 讨论模式状态机

## 状态：待办

## 前置依赖

157-1（消息分类器 + 温度路由）

## 目标

实现讨论模式的状态机，让 Agent 可以自发地多轮讨论，并自然收束。

## 实现内容

### 1. 讨论状态数据结构

```js
const discussionState = {
  active: false,
  round: 0,
  maxRounds: 3,
  conversationId: null,
  topic: "",
  participantIds: [],
  roundHistory: [],      // [{ round, responses: [{ agentId, content }] }]
  summary: null,
}
```

### 2. 启动讨论 `startDiscussion(convId, text)`

当 `classifyMessage` 返回 `"discuss"` 时触发：

1. 设置 `discussionState.active = true`
2. 提取讨论主题（去除"大家讨论一下"等触发词，保留实质内容）
3. Round 1: 所有 Agent 并行回复，prompt 包含讨论指令

### 3. 讨论轮次执行 `executeDiscussionRound(convId)`

每一轮的核心逻辑：

**Round 1：**
- Prompt: "这是一个讨论，主题是 XXX。请给出你的观点。"
- 所有 Agent 并行回复

**Round 2+：**
- 将前一轮所有 Agent 的发言注入上下文
- Prompt: "以下是上一轮讨论内容：\n{previousRound}\n\n你是否有补充、反驳或新观点？如果已经说完了，回复 [SKIP]"
- 温度路由 + 活跃度衰减：每轮 talkativeness 降低 0.15

### 4. 收敛检测 `checkDiscussionConvergence()`

每轮结束后检查：

```js
function checkDiscussionConvergence() {
  if (discussionState.round >= discussionState.maxRounds) return "max_rounds"

  const currentRound = discussionState.roundHistory[discussionState.roundHistory.length - 1]
  const skipCount = currentRound.responses.filter(r => isSkipResponse(r.content)).length
  const activeCount = currentRound.responses.length - skipCount

  // 所有 Agent 都 SKIP → 自然结束
  if (activeCount === 0) return "all_skipped"

  // 连续两轮活跃人数递减 → 收敛
  if (discussionState.roundHistory.length >= 2) {
    const prevRound = discussionState.roundHistory[discussionState.roundHistory.length - 2]
    const prevActive = prevRound.responses.filter(r => !isSkipResponse(r.content)).length
    if (activeCount < prevActive && activeCount <= 1) return "converging"
  }

  return "continue"
}
```

### 5. 讨论总结 `generateDiscussionSummary(convId)`

讨论结束后：
- 选择一个 Agent（默认朔，中性视角）生成总结
- 总结 prompt: "以下是完整讨论记录：\n{allRounds}\n\n请用 3-5 句话总结各方观点、共识和分歧。"
- 总结消息以特殊样式（summary card）渲染

### 6. 活跃度衰减

```js
function getAdjustedTalkativeness(baseTalkativeness, round) {
  return Math.max(0.1, baseTalkativeness - (round - 1) * 0.15)
}
```

确保每轮越来越少 Agent 想说话，自然收敛。

### 7. 讨论过程中的 UI 状态

- 显示"讨论进行中 · 第 N 轮"指示器
- 轮次之间有短暂的"等待"状态
- 讨论结束后显示总结卡片

## 轮次执行时序

```
用户: "大家讨论一下要不要辞职创业"
  ↓
startDiscussion(convId, "要不要辞职创业")
  ↓ Round 1 (并行)
  绫: "辞职创业压力很大，你现在的情绪准备好了吗..."
  澄: "从理性角度看，需要先算清楚三件事..."
  朔: "我同意两边说的，关键看时间维度..."
  ↓
checkDiscussionConvergence() → "continue"
  ↓ Round 2 (并行，活跃度衰减)
  澄: "补充一点，绫说的情绪准备其实可以量化..."
  朔: "澄说的量化思路不错，但别忘了..."
  绫: [SKIP]  (情感角度已经说过了)
  ↓
checkDiscussionConvergence() → "converging" (activeCount=2 < 3)
  ↓ Round 3 (如果 maxRounds=3)
  澄: [SKIP]
  朔: "总结一下我的看法..."
  ↓
checkDiscussionConvergence() → "max_rounds"
  ↓
generateDiscussionSummary()
  朔: "📋 讨论总结：绫关注情绪准备，澄建议量化评估..."
  ↓
讨论结束，恢复正常群聊模式
```

## 影响文件

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css` — 轮次指示器 + 总结卡片样式
- `apps/desktop/renderer/index.html` — 轮次指示器 DOM

## 验收标准

1. 用户说"大家讨论一下" → Agent 自动讨论 2-3 轮
2. 每轮发言的 Agent 数量递减
3. 所有 Agent 都 SKIP 时讨论自动结束
4. 达到 maxRounds 时讨论强制结束
5. 讨论结束后有总结卡片
6. 讨论过程中不会出现无限循环
