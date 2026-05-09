# 157-1 — 消息分类器 + 温度路由基础

## 状态：进行中

## 目标

实现消息分类和 Agent 个性路由基础设施，替代当前"无 @ 就 SKIP"的二元逻辑。

## 实现内容

### 1. 消息分类器 `classifyMessage(text, mentionedAgentIds)`

```js
const DISCUSS_PATTERNS = [
  /大家.{0,4}讨论/, /你们.{0,4}讨论/, /讨论一下/,
  /谁来说说/, /你们觉得/, /各位觉得/, /都来说说/, /一起聊聊/,
  /大家.{0,4}看/, /各抒己见/, /说说.{0,4}看法/, /怎么看/,
]

const QUESTION_PATTERNS = [
  /？$/, /\?$/,  // 以问号结尾
  /怎么/, /如何/, /为什么/, /是不是/, /能不能/,
  /帮我/, /请问/, /我想知道/,
]

function classifyMessage(text, mentionedAgentIds) {
  if (mentionedAgentIds.length > 0) return "direct"
  if (DISCUSS_PATTERNS.some(p => p.test(text))) return "discuss"
  if (QUESTION_PATTERNS.some(p => p.test(text))) return "question"
  return "broadcast"
}
```

分类结果：
- `"direct"` — 有 @，仅目标 Agent 回复
- `"discuss"` — 讨论触发，进入讨论模式（157-2 实现）
- `"question"` — 提问，温度路由决定谁回复
- `"broadcast"` — 广播，低概率回复

### 2. Agent 个性配置 `agentPersonality`

```js
const AGENT_PERSONALITY = {
  // 默认模板（未配置的 Agent 使用）
  _default: {
    talkativeness: 0.4,
    topicWeights: { empathy: 0.5, logic: 0.5, controversy: 0.3, creative: 0.4 },
  },
  "soul-ling": {
    talkativeness: 0.55,
    topicWeights: { empathy: 0.95, logic: 0.25, controversy: 0.15, creative: 0.6 },
    traits: ["温柔", "共情", "倾听", "不善技术"],
  },
  "soul-cheng": {
    talkativeness: 0.45,
    topicWeights: { empathy: 0.2, logic: 0.95, controversy: 0.7, creative: 0.3 },
    traits: ["理性", "结构化", "直接", "不善情感"],
  },
  "soul-shuo": {
    talkativeness: 0.4,
    topicWeights: { empathy: 0.6, logic: 0.7, controversy: 0.5, creative: 0.5 },
    traits: ["中立", "平衡", "长期视角", "不急躁"],
  },
}
```

### 3. 话题检测器 `detectTopics(text)`

```js
const TOPIC_KEYWORDS = {
  empathy: ["心情", "感觉", "难过", "开心", "焦虑", "压力", "烦", "累", "委屈",
            "伤心", "郁闷", "沮丧", "害怕", "担心", "开心", "高兴", "幸福",
            "孤独", "失望", "纠结", "受不了", "崩溃", "emo", "心痛"],
  logic: ["分析", "比较", "选择", "方案", "利弊", "怎么选", "建议", "计划",
          "策略", "步骤", "逻辑", "数据", "优化", "评估", "决策", "排序",
          "优先", "效率", "成本", "收益", "风险"],
  controversy: ["该不该", "对不对", "好不好", "应不应该", "到底", "还是",
                "辩论", "争", "反对", "支持", "立场", "公平", "正义"],
  creative: ["创意", "想法", "脑洞", "灵感", "设计", "有趣", "新", "没见过",
             "试试", "如果", "假设", "想象"],
}

function detectTopics(text) {
  const scores = {}
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const hits = keywords.filter(kw => text.includes(kw)).length
    scores[topic] = Math.min(1, hits * 0.4)  // 每个关键词 0.4，最高 1
  }
  return scores
}
```

### 4. 响应决策 `shouldAgentReply(agentId, text, messageType, isMentioned)`

```js
function shouldAgentReply(agentId, text, messageType, isMentioned) {
  // 被提及必须回复
  if (isMentioned) return { shouldReply: true, reason: "mentioned" }

  const personality = AGENT_PERSONALITY[agentId] || AGENT_PERSONALITY._default

  // direct 类型（@了别人但没 @自己）→ 不回复
  if (messageType === "direct") return { shouldReply: false, reason: "not_mentioned" }

  // discuss 类型 → 由讨论模式控制（157-2）
  if (messageType === "discuss") return { shouldReply: true, reason: "discuss_mode" }

  // question / broadcast → 温度路由
  const topics = detectTopics(text)
  const weights = personality.topicWeights
  const topicScore = Object.entries(topics).reduce((sum, [t, s]) => {
    return sum + s * (weights[t] || 0.3)
  }, 0) / Object.keys(topics).length

  const finalScore = topicScore * personality.talkativeness + 0.15  // 基础概率 0.15

  // 阈值
  const threshold = messageType === "question" ? 0.25 : 0.35
  if (finalScore >= threshold) {
    return { shouldReply: true, reason: "topic_relevant", score: finalScore }
  }

  return { shouldReply: false, reason: "low_relevance", score: finalScore }
}
```

### 5. 集成到 `sendChannelGroupMessage`

修改群消息发送逻辑：

```js
// 旧逻辑：所有 Agent 都发送，靠 [SKIP] 决定
// 新逻辑：先用 shouldAgentReply 预判，减少不必要的 API 调用

const messageType = classifyMessage(text, mentionedAgentIds)

for (const agentId of agentIds) {
  const isMentioned = mentionedAgentIds.includes(agentId)
  const decision = shouldAgentReply(agentId, text, messageType, isMentioned)

  if (!decision.shouldReply) {
    // 直接标记为 skipped，不调用 API
    channelGroupStreaming[convId][agentId].status = "skipped"
    continue
  }

  // 根据 messageType 调整 prompt
  // ...
  agentPromises.push(sendToAgent(agentId, messageType, ...))
}
```

## 影响文件

- `apps/desktop/renderer/app.js`

## 验收标准

1. 用户 @绫 → 只有绫回复
2. 用户说"帮我分析一下利弊" → 澄大概率回复（逻辑话题），绫可能 SKIP
3. 用户说"我最近好烦" → 绫大概率回复（情感话题），澄可能 SKIP
4. 用户说"大家讨论一下" → 所有 Agent 回复（进入 discuss 模式）
5. 用户说"嗯嗯" → 广播类型，所有 Agent 大概率 SKIP
