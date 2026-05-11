# 157-3 — 讨论模式 Prompt 升级 + Agent 间对话支持

## 状态：待办

## 前置依赖

157-1, 157-2

## 目标

重写群聊 prompt 模板，支持 Agent 间自发对话、讨论指令、智能回复规则。

## 实现内容

### 1. Prompt 模板工厂

根据消息类型生成不同的 prompt：

```js
function buildGroupPrompt({ agentId, agentName, convName, memberNames, text,
  messageType, isMentioned, round, previousRoundText, allRoundTexts }) {

  const baseContext = `
[群聊上下文]
你在群聊「${convName}」中，你的名字是「${agentName}」。
群成员：${memberNames.join("、")}
  `.trim()

  if (messageType === "direct") {
    return buildDirectPrompt(baseContext, { agentName, text, isMentioned })
  }

  if (messageType === "discuss") {
    return buildDiscussPrompt(baseContext, { agentName, text, round, previousRoundText, allRoundTexts })
  }

  // question / broadcast
  return buildNormalPrompt(baseContext, { agentName, text, isMentioned })
}
```

### 2. 直接提问 Prompt

```js
function buildDirectPrompt(base, { agentName, text, isMentioned }) {
  return `${base}

用户@了你，请直接回复。

[回复规则]
- 直接回答，不要寒暄
- 不要提及其他成员，除非你需要建议用户去问他们`
}
```

### 3. 讨论模式 Prompt

```js
function buildDiscussPrompt(base, { agentName, text, round, previousRoundText, allRoundTexts }) {
  let prompt = `${base}

[讨论模式 · 第 ${round} 轮]
这是一个讨论。${round === 1 ? `讨论主题：${text}` : ''}

${round > 1 && previousRoundText ? `[上一轮讨论]\n${previousRoundText}\n` : ''}
${allRoundTexts && round > 2 ? `[完整讨论记录]\n${allRoundTexts}\n` : ''}

[回复规则]
- 这是讨论，你可以直接回应其他成员的观点，不需要等待用户提问
- 如果同意某人的观点并想补充，直接补充
- 如果不同意，直接表达你的不同看法
- 如果你已经说过了且没有新观点，回复 [SKIP]
- 不要重复自己或其他人已经说过的话
- 第 ${round} 轮，请尽量简洁，聚焦核心观点`

  return prompt
}
```

### 4. 普通消息 Prompt

```js
function buildNormalPrompt(base, { agentName, text, isMentioned }) {
  const personality = AGENT_PERSONALITY[agentId] || AGENT_PERSONALITY._default
  const traits = personality.traits || []
  const traitsStr = traits.length > 0 ? `你的性格特点：${traits.join("、")}` : ""

  return `${base}

${traitsStr}

[回复规则]
- 根据话题与你的性格和擅长领域判断是否需要回复
- 如果话题不在你的擅长领域或你没什么独特见解，回复 [SKIP]
- 如果你只有"我也觉得"之类没有新信息的回复，回复 [SKIP]
- 不要为了说话而说话
- 如果决定回复，直接给出观点，不要寒暄`
}
```

### 5. 讨论总结 Prompt

```js
function buildSummaryPrompt(base, { allRoundTexts, topic }) {
  return `${base}

[讨论总结任务]
以下是关于「${topic}」的完整讨论记录：
${allRoundTexts}

请用简洁的方式总结讨论结果：
1. 各方核心观点（每人 1-2 句）
2. 共识点
3. 分歧点
4. 建议方向

总结要客观中立，不要添加讨论中没有的观点。`
}
```

### 6. 上下文构建增强

改进 `historyLines` 的构建，区分用户和 Agent：

```js
function buildHistoryLines(messages, maxCount = 20) {
  return messages.slice(-maxCount).map(m => {
    const speaker = m.role === 'user' ? '用户' : (m.senderName || 'Agent')
    const content = m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content
    return `${speaker}: ${content}`
  }).join("\n")
}
```

### 7. 前一轮讨论文本构建

```js
function buildPreviousRoundText(roundResponses) {
  return roundResponses
    .filter(r => !isSkipResponse(r.content))
    .map(r => `${r.agentName}: ${r.content}`)
    .join("\n")
}
```

## 影响文件

- `apps/desktop/renderer/app.js`

## 验收标准

1. 不同消息类型使用不同的 prompt 模板
2. 讨论模式下 Agent 能看到前一轮其他 Agent 的发言
3. 讨论模式下 Agent 可以直接对其他 Agent 的观点回应
4. 普通消息 prompt 包含性格特点
5. 总结 prompt 生成结构化的讨论总结
