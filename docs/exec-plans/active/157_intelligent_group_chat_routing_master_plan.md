# 157 — 智能群聊路由体系（Master Plan）

## 状态：进行中

## 背景

当前群聊的路由逻辑存在三大缺陷：

1. **只响应用户消息**：Agent 只在用户发消息时被触发，无法自发的与其他 Agent 讨论
2. **@提及 = 强制回复，无 @ = 几乎不回复**：二元的 SKIP/非 SKIP 机制，缺少"温度"灰度
3. **无终止机制**：如果真的让 Agent 互相对话，没有收敛逻辑，讨论会无限进行

用户期望：说"大家讨论一下"后，Agent 能自发对话几个回合再自然收束；未被 @ 的 Agent 应根据性格/话题相关性决定是否发言；整体像一个真实的群聊，而非每个人都只对着用户说话。

## 设计目标

| 目标 | 说明 |
|------|------|
| Agent 自发讨论 | 用户触发讨论后，Agent 可以互相回应，不限于只回答用户 |
| 温度/性格路由 | 未被 @ 的 Agent 根据自身性格、话题相关性、活跃度灰度决定是否回复 |
| 自然收束 | 讨论最多 N 轮，且有收敛检测，避免无限对话 |
| 保持简洁 | 客户端侧实现（不改后端），基于 prompt 工程 + 状态机控制 |

## 架构设计

### 核心概念

```
用户发消息
  ↓
路由层判定消息类型
  ├── 直接提问（@某人 或 针对性问）→ 仅目标 Agent 回复
  ├── 讨论触发（"大家讨论" "你们觉得呢" 等）→ 进入讨论模式
  └── 闲聊/广播 → 温度路由：按性格灰度决定谁回复
         ↓
讨论模式
  ├── Round 1: 所有 Agent 并行回复（含讨论指令）
  ├── Round 2+: Agent 可选择对前一轮其他 Agent 的发言回应
  ├── 每轮结束检测收敛条件
  └── 收敛或达到 maxRounds → 讨论结束
```

### 1. 消息分类器（Message Classifier）

客户端侧的轻量分类，不依赖 LLM：

```js
function classifyMessage(text, mentionedAgentIds) {
  if (mentionedAgentIds.length > 0) return "direct"     // 有 @ = 直接提问
  if (DISCUSS_PATTERNS.some(p => p.test(text))) return "discuss"  // 讨论触发
  if (QUESTION_PATTERNS.some(p => p.test(text))) return "question"  // 提问
  return "broadcast"  // 广播
}
```

讨论触发模式：
- "大家讨论"、"你们讨论"、"讨论一下"
- "谁来说说"、"你们觉得"、"各位觉得"
- "都来说说"、"一起聊聊"
- "大家怎么看"、"各抒己见"

### 2. 温度路由（Temperature Router）

每个 Agent 有一个"响应倾向"参数，决定它在什么情况下愿意发言：

```js
const agentPersonality = {
  "soul-ling": {
    talkativeness: 0.6,      // 活跃度 0-1，越高越爱说话
    empathyWeight: 0.9,       // 情感话题权重
    logicWeight: 0.3,         // 逻辑话题权重
    controversyWeight: 0.2,   // 争议话题权重
  },
  "soul-cheng": {
    talkativeness: 0.5,
    empathyWeight: 0.2,
    logicWeight: 0.95,
    controversyWeight: 0.7,
  },
  "soul-shuo": {
    talkativeness: 0.4,
    empathyWeight: 0.6,
    logicWeight: 0.7,
    controversyWeight: 0.5,
  },
}
```

响应决策流程：
1. 检查是否被 @ → 必须回复
2. 计算话题相关分：`topicScore = empathyW * empathyRelevance + logicW * logicRelevance + ...`
3. 最终得分：`finalScore = topicScore * talkativeness + baseProbability`
4. 如果 `finalScore > threshold` → 回复，否则 [SKIP]

话题检测（关键词 + 模式）：
- 情感话题：心情、感觉、难过、开心、焦虑、压力、烦、累...
- 逻辑话题：分析、比较、选择、方案、利弊、怎么选、建议...
- 争议话题：该不该、对不对、好不好、应不应该、到底...

### 3. 讨论模式状态机（Discussion State Machine）

```js
const discussionState = {
  active: false,
  round: 0,
  maxRounds: 3,           // 默认最多 3 轮讨论
  conversationId: null,
  topic: "",               // 讨论主题
  participants: [],        // 参与者
  roundResponses: [],      // 当前轮次的回复
}
```

**讨论流程：**

**Round 1** — 用户提供主题，所有 Agent 并行回复：
- Prompt 包含"讨论模式"指令 + 其他 Agent 信息
- 每个 Agent 知道这是一个讨论，不是只回答用户

**Round 2+** — Agent 可以选择对前一轮的发言回应：
- 将前一轮所有 Agent 的发言作为上下文注入
- Agent 判断是否需要对其他 Agent 的观点补充/反驳/同意
- 温度路由决定是否发言：已被提及或话题高度相关才回复

**收敛检测** — 每轮结束后检查：
- 连续两轮回复的 Agent 数量递减 → 收敛
- 所有 Agent 都 [SKIP] → 自然结束
- 达到 maxRounds → 强制结束
- 发送总结指令给"主持人"Agent → 生成讨论总结

### 4. 讨论总结（Discussion Summary）

讨论结束后，选择一个 Agent 作为"主持人"生成总结：
- 默认选择朔（中性视角）
- 总结格式：各观点概要 + 共识点 + 分歧点

### 5. Prompt 模板升级

当前：
```
[回复规则]
- 如果这条消息不是在问你 → [SKIP]
```

升级后：
```
[回复规则 — 智能路由]
1. 如果被 @，必须回复
2. 如果是讨论模式：
   - 你可以对其他成员的发言回应、补充、反驳
   - 但如果前几轮你已经说过了，且没有新观点，请回复 [SKIP]
   - 不要重复自己和其他人说过的内容
3. 如果是普通消息：
   - 根据你的性格和话题相关性判断是否需要回复
   - 如果话题不在你的擅长领域，回复 [SKIP]
   - 如果你只有"我也觉得"这类没有新信息的回复，回复 [SKIP]
4. 永远不要说"我来回答"之类的话，直接给出观点
```

## 工单拆分

| 编号 | 工单 | 说明 |
|------|------|------|
| 157-1 | 消息分类器 + 温度路由基础 | 实现 classifyMessage、agentPersonality 配置、shouldAgentReply 判定 |
| 157-2 | 讨论模式状态机 | 实现 discussionState、讨论流程、轮次管理、收敛检测 |
| 157-3 | 讨论模式 Prompt 升级 | 重写 groupContextSuffix，支持讨论指令、Agent 间对话、总结 |
| 157-4 | 讨论总结 + UI 反馈 | 讨论结束后的总结卡片、轮次指示器、收敛动画 |

## 影响文件

- `apps/desktop/renderer/app.js` — 核心路由逻辑
- `apps/desktop/renderer/styles.css` — 讨论模式 UI 样式
- `apps/desktop/renderer/index.html` — 轮次指示器 DOM

## 验收标准

1. 用户说"大家讨论一下XXX" → Agent 们自发讨论 2-3 轮后自然收束
2. 用户 @某人 → 只有被 @ 的人回复
3. 普通消息 → Agent 按性格/话题灰度决定是否回复，不是全员回复
4. 讨论结束后有总结卡片
5. 不出现无限循环的对话
6. 客户端无 JS 错误
