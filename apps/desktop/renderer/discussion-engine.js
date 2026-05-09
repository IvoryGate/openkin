/**
 * discussion-engine.js — Intelligent Group Chat Routing & Discussion State Machine
 *
 * Enhances channel group chat with:
 * 1. Message classification (discuss / question / direct / broadcast)
 * 2. Agent personality-based temperature routing
 * 3. Multi-round discussion state machine with convergence detection
 * 4. Prompt template factory for different message types
 * 5. Discussion summary generation
 *
 * This is a plain script (not module). It reads globals exposed by app.js via window.
 */

// ── Window proxy helpers (variables from app.js) ────────────────────────
// These are set by Object.assign(window, {...}) at the end of app.js.

// We define accessors that read from window, so they pick up the latest values.

// ── Message Classifier ──────────────────────────────────────────────────

const DISCUSS_PATTERNS = [
  /大家.{0,4}讨论/, /你们.{0,4}讨论/, /讨论一下/, /讨论讨论/,
  /谁来说说/, /你们觉得/, /各位觉得/, /都来说说/, /一起聊聊/,
  /大家.{0,4}看/, /各抒己见/, /说说.{0,4}看法/, /怎么看/,
  /聊聊/, /谈谈/, /辩一辩/, /议一议/,
]

const QUESTION_PATTERNS = [
  /？$/, /\?$/, /怎么/, /如何/, /为什么/, /是不是/, /能不能/, /会不会/,
  /帮我/, /请问/, /我想知道/, /有没有/, /啥是/, /什么是/,
]

function classifyMessage(text, mentionedAgentIds) {
  if (mentionedAgentIds.length > 0) return "direct"
  if (DISCUSS_PATTERNS.some(p => p.test(text))) return "discuss"
  if (QUESTION_PATTERNS.some(p => p.test(text))) return "question"
  return "broadcast"
}

// ── Agent Personality Profiles ──────────────────────────────────────────

const AGENT_PERSONALITY = {
  _default: {
    talkativeness: 0.4,
    topicWeights: { empathy: 0.5, logic: 0.5, controversy: 0.3, creative: 0.4 },
    traits: [],
    discussStyle: "你是一个均衡的讨论者，根据话题自由发表观点。",
    strengthAreas: [],
    weakAreas: [],
    interactionStyle: "neutral"
  },
  "soul-ling": {
    talkativeness: 0.55,
    topicWeights: { empathy: 0.95, logic: 0.25, controversy: 0.15, creative: 0.6 },
    traits: ["温柔", "共情", "倾听", "不善技术"],
    discussStyle: "你是讨论中的情感锚点。你首先关注人的感受，擅长将冷冰冰的分析拉回到人的层面。你的回复往往从共情开始，再给出温暖但务实的建议。你不擅长纯技术或纯逻辑的辩论，遇到这类话题时更倾向于从人的角度补充。",
    strengthAreas: ["情感与人际关系", "心理与感受", "生活与成长", "沟通与表达"],
    weakAreas: ["技术与代码", "纯逻辑推理", "数据与效率"],
    interactionStyle: "empathetic"
  },
  "soul-cheng": {
    talkativeness: 0.45,
    topicWeights: { empathy: 0.2, logic: 0.95, controversy: 0.7, creative: 0.3 },
    traits: ["理性", "结构化", "直接", "不善情感"],
    discussStyle: "你是讨论中的理性引擎。你擅长拆解问题、构建分析框架、指出逻辑漏洞。你的回复往往有清晰的结构（分点、递进），喜欢用数据和事实支撑观点。当别人只用感受说话时，你会追问'为什么'。你不擅长处理纯情感话题，遇到这类话题时更倾向于提供客观的分析视角。",
    strengthAreas: ["逻辑与推理", "技术与代码", "数据与效率", "策略与规划"],
    weakAreas: ["情感与心理", "人际与关系", "共情与安慰"],
    interactionStyle: "analytical"
  },
  "soul-shuo": {
    talkativeness: 0.4,
    topicWeights: { empathy: 0.6, logic: 0.7, controversy: 0.5, creative: 0.5 },
    traits: ["中立", "平衡", "长期视角", "不急躁"],
    discussStyle: "你是讨论中的调停者和综合者。你倾向于在各方观点之间寻找平衡，擅长发现不同立场的合理之处，并提出折中或更长期的视角。当讨论陷入对立时，你会尝试找到共同点或重新框定问题。你的观点通常不极端，但往往有深度。",
    strengthAreas: ["综合与平衡", "长期视角", "调停与共识", "策略与权衡"],
    weakAreas: ["强烈立场表达", "快速决策", "技术深度"],
    interactionStyle: "mediator"
  },
}

// ── Topic Detection ─────────────────────────────────────────────────────

const TOPIC_KEYWORDS = {
  empathy: ["心情","感觉","难过","开心","焦虑","压力","烦","累","委屈","伤心","郁闷","沮丧","害怕","担心","高兴","幸福","孤独","失望","纠结","崩溃","emo","情绪","安慰","理解","关系","朋友","家人","爱情","分手","吵架"],
  logic: ["分析","比较","选择","方案","利弊","建议","计划","策略","步骤","逻辑","数据","优化","评估","决策","效率","成本","收益","风险","目标","方法","工具","技术","代码","实现","架构","流程","规范","测试","部署","预算"],
  controversy: ["该不该","对不对","好不好","应不应该","到底","还是","辩论","反对","支持","立场","公平","对错","值得","合理","要不要"],
  creative: ["创意","想法","脑洞","灵感","设计","有趣","试试","如果","假设","想象","创新","突破","可能性","也许"],
}

function detectTopics(text) {
  const scores = {}
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const hits = keywords.filter(kw => text.includes(kw)).length
    scores[topic] = Math.min(1, hits * 0.35)
  }
  return scores
}

// ── Temperature Routing ─────────────────────────────────────────────────

function shouldAgentReply(agentId, text, messageType, isMentioned) {
  if (isMentioned) return { shouldReply: true, reason: "mentioned" }
  const personality = AGENT_PERSONALITY[agentId] || AGENT_PERSONALITY._default
  if (messageType === "direct") return { shouldReply: false, reason: "not_mentioned" }
  if (messageType === "discuss") return { shouldReply: true, reason: "discuss_mode" }
  const topics = detectTopics(text)
  const weights = personality.topicWeights
  let totalWeight = 0, weightedSum = 0
  for (const [t, s] of Object.entries(topics)) { const w = weights[t] || 0.3; weightedSum += s * w; totalWeight += w }
  const topicScore = totalWeight > 0 ? weightedSum / totalWeight : 0
  const finalScore = topicScore * personality.talkativeness + 0.15
  const threshold = messageType === "question" ? 0.25 : 0.35
  return finalScore >= threshold
    ? { shouldReply: true, reason: "topic_relevant", score: finalScore }
    : { shouldReply: false, reason: "low_relevance", score: finalScore }
}

function getAdjustedTalkativeness(base, round) { return Math.max(0.1, base - (round - 1) * 0.15) }

// ── Discussion State Machine ────────────────────────────────────────────

const discussionState = { active: false, round: 0, maxRounds: 3, conversationId: null, topic: "", participantIds: [], participantNames: [], participantColors: [], roundHistory: [], summary: null }

function resetDiscussionState() {
  discussionState.active = false; discussionState.round = 0; discussionState.conversationId = null
  discussionState.topic = ""; discussionState.participantIds = []; discussionState.participantNames = []; discussionState.participantColors = []
  discussionState.roundHistory = []; discussionState.summary = null
}

function extractDiscussionTopic(text) {
  return text.replace(/大家.{0,4}讨论(一下)?/,"").replace(/你们.{0,4}讨论(一下)?/,"").replace(/讨论(一下|讨论)?/,"").replace(/谁来说说/,"").replace(/你们觉得/,"").replace(/各位觉得/,"").replace(/都来说说/,"").replace(/一起聊聊/,"").replace(/聊聊/,"").replace(/谈谈/,"").replace(/各抒己见/,"").replace(/说说.{0,4}看法/,"").replace(/怎么看/,"").replace(/大家.{0,4}看/,"").trim()
}

function buildRoundText(roundResponses) {
  return roundResponses.filter(r => !window.isSkipResponse(r.content)).map(r => `${r.agentName}: ${r.content}`).join("\n")
}

function buildAllRoundsText() {
  return discussionState.roundHistory.map((rh, idx) => `--- 第 ${idx + 1} 轮 ---\n${buildRoundText(rh.responses)}`).join("\n\n")
}

function checkDiscussionConvergence() {
  if (discussionState.round >= discussionState.maxRounds) return "max_rounds"
  const currentRound = discussionState.roundHistory[discussionState.roundHistory.length - 1]
  if (!currentRound) return "continue"
  const activeCount = currentRound.responses.filter(r => !window.isSkipResponse(r.content)).length
  if (activeCount === 0) return "all_skipped"
  if (discussionState.roundHistory.length >= 2) {
    const prevActive = discussionState.roundHistory[discussionState.roundHistory.length - 2].responses.filter(r => !window.isSkipResponse(r.content)).length
    if (activeCount < prevActive && activeCount <= 1) return "converging"
  }
  return "continue"
}

// ── Prompt Template Factory ─────────────────────────────────────────────

function buildGroupPrompt({ agentId, agentName, convName, memberNames, text, messageType, isMentioned, round, previousRoundText, allRoundTexts }) {
  const base = `[群聊上下文]\n你在群聊「${convName || "未命名群组"}」中，你的名字是「${agentName}」。\n群成员：${memberNames.join("、")}`
  if (messageType === "discuss") return buildDiscussPrompt(base, { agentName, agentId, text, round, previousRoundText, allRoundTexts })
  if (messageType === "direct") return buildDirectPrompt(base, { agentId, text, isMentioned })
  return buildNormalPrompt(base, { agentId, agentName, text, isMentioned })
}

function buildDirectPrompt(base, { agentId, text, isMentioned }) {
  const personality = AGENT_PERSONALITY[agentId] || AGENT_PERSONALITY._default

  let styleSection = ""
  if (personality.discussStyle) {
    styleSection = `\n[你的角色]\n${personality.discussStyle}`
  } else if ((personality.traits || []).length > 0) {
    styleSection = `\n[你的性格特点]\n${personality.traits.join("、")}`
  }

  let areaSection = ""
  if (personality.strengthAreas?.length > 0) {
    areaSection = `\n[你擅长]\n${personality.strengthAreas.join("、")}`
  }

  return `${base}${styleSection}${areaSection}\n\n${isMentioned ? "用户@了你，你必须回复。\n\n" : ""}[回复规则]\n- 直接回答，不要寒暄\n- 用你擅长领域的视角回答，如果问题超出你的擅长范围，坦诚说明并给出你的角度\n- 不要提及其他成员，除非你需要建议用户去问他们\n- 不要说"我来回答"之类的话，直接给出观点`
}

function buildAgentOwnHistory(agentId) {
  const lines = []
  for (const rh of discussionState.roundHistory) {
    for (const r of rh.responses) {
      if (r.agentId === agentId && !window.isSkipResponse(r.content)) {
        lines.push(`(第${rh.round}轮) 你说：${r.content}`)
      }
    }
  }
  return lines.length > 0 ? lines.join("\n") : null
}

function buildInteractionGuide(personality, round) {
  const style = personality.interactionStyle || "neutral"
  const guides = {
    empathetic: [
      "你倾向于先认同对方的感受，再表达自己的看法",
      "当有人表达了痛苦或困惑，你会优先给予情感支持",
      "遇到冷冰冰的分析时，你会补充人的角度",
      "你很少直接反驳，而是用'我理解你的意思，不过...'的方式提出不同看法"
    ],
    analytical: [
      "你倾向于直接指出对方观点中的逻辑问题",
      "当有人只用感受说话时，你会追问'具体为什么？'",
      "你喜欢用'从逻辑上看...'、'数据表明...'的方式引入观点",
      "你不会为了照顾情绪而模糊自己的立场"
    ],
    mediator: [
      "你倾向于找到不同观点的共同点",
      "当讨论陷入对立时，你会尝试重新框定问题",
      "你经常说'其实大家的共识是...'、'换个角度看...'",
      "你不会急于站队，而是等各方充分表达后再综合"
    ],
    neutral: [
      "你根据话题自由选择回应方式",
      "可以直接表达观点，也可以补充或延伸"
    ]
  }
  const pool = guides[style] || guides.neutral
  // Later rounds: shorter guidance
  return round <= 2 ? pool.slice(0, 3).join("；") : pool.slice(0, 2).join("；")
}

function buildDiscussPrompt(base, { agentName, agentId, text, round, previousRoundText, allRoundTexts }) {
  const personality = AGENT_PERSONALITY[agentId] || AGENT_PERSONALITY._default

  // ── 性格与风格描述 ──
  let styleSection = ""
  if (personality.discussStyle) {
    styleSection = `\n[你的讨论角色]\n${personality.discussStyle}`
  } else if ((personality.traits || []).length > 0) {
    styleSection = `\n[你的性格特点]\n${personality.traits.join("、")}`
  }

  // ── 擅长与不擅长领域 ──
  let areaSection = ""
  if (personality.strengthAreas?.length > 0 || personality.weakAreas?.length > 0) {
    areaSection = "\n[擅长与不擅长]\n"
    if (personality.strengthAreas?.length > 0) areaSection += `你擅长：${personality.strengthAreas.join("、")}\n`
    if (personality.weakAreas?.length > 0) areaSection += `你不擅长：${personality.weakAreas.join("、")}（遇到这些话题时，可以简短补充你的角度，或回复 [SKIP]）\n`
  }

  // ── 互动风格指南 ──
  const interactionGuide = buildInteractionGuide(personality, round)

  // ── 自己的历史发言 ──
  let ownHistorySection = ""
  const ownHistory = buildAgentOwnHistory(agentId)
  if (ownHistory) {
    ownHistorySection = `\n[你之前说过的话]\n${ownHistory}\n（不要重复这些观点，只在有新补充时发言）`
  }

  // ── 其他人的讨论内容 ──
  let ctx = ""
  if (round > 1 && previousRoundText) ctx = `\n[上一轮讨论]\n${previousRoundText}\n`
  if (round > 2 && allRoundTexts) ctx += `\n[完整讨论记录]\n${allRoundTexts}\n`

  // ── 收敛信号（轮次越后越强）──
  let convergenceHint = ""
  if (round === 2) convergenceHint = "\n- 如果你的观点已经充分表达且没有新补充，考虑回复 [SKIP] 让讨论收敛"
  if (round >= 3) convergenceHint = "\n- 这是最后一轮，只有当你有重要的新观点或必须反驳某个误解时才发言，否则回复 [SKIP]"

  // ── 组装 Prompt ──
  return `${base}${styleSection}${areaSection}\n\n[讨论模式 · 第 ${round} 轮]\n这是一个多轮讨论，你需要和其他成员交流观点。\n${round === 1 ? `讨论主题：${text}` : ""}${ctx}${ownHistorySection}\n\n[互动方式]\n${interactionGuide}\n\n[回复规则]\n- 直接回应其他成员的观点——用「@名字」来引用你要回应的人\n- 如果同意某人并想补充，直接补充你的新内容\n- 如果不同意，明确表达不同看法并说明理由\n- 如果你已经说过了且没有新观点，回复 [SKIP]\n- 不要重复自己或其他人已经说过的话\n- 请尽量简洁，聚焦核心观点\n- 不要说"我来回答"、"我觉得"之类的话，直接给出观点${convergenceHint}`
}

function buildNormalPrompt(base, { agentId, agentName, text, isMentioned }) {
  const personality = AGENT_PERSONALITY[agentId] || AGENT_PERSONALITY._default

  let styleSection = ""
  if (personality.discussStyle) {
    styleSection = `\n[你的角色]\n${personality.discussStyle}`
  } else if ((personality.traits || []).length > 0) {
    styleSection = `\n[你的性格特点]\n${personality.traits.join("、")}`
  }

  let areaSection = ""
  if (personality.strengthAreas?.length > 0 || personality.weakAreas?.length > 0) {
    areaSection = "\n[擅长与不擅长]\n"
    if (personality.strengthAreas?.length > 0) areaSection += `你擅长：${personality.strengthAreas.join("、")}\n`
    if (personality.weakAreas?.length > 0) areaSection += `你不擅长：${personality.weakAreas.join("、")}\n`
  }

  return `${base}${styleSection}${areaSection}\n\n${isMentioned ? "用户@了你，你必须回复。\n\n" : ""}[回复规则]\n- 根据话题与你的擅长领域判断是否需要回复\n- 如果话题不在你的擅长领域或你没什么独特见解，回复 [SKIP]\n- 如果你只有"我也觉得"之类没有新信息的回复，回复 [SKIP]\n- 不要为了说话而说话\n- 如果决定回复，直接给出观点，不要寒暄\n- 用你的擅长领域的视角来回答，不要试图扮演你不擅长的角色`
}

function buildSummaryPrompt(convName, memberNames, allRoundTexts, topic, summarizerName) {
  return `[讨论总结任务]\n你是群聊「${convName}」中的「${summarizerName}」，讨论已经结束。\n讨论主题：${topic}\n\n以下是完整讨论记录：\n${allRoundTexts}\n\n请用简洁的方式总结讨论结果，格式如下：\n\n**各方观点**\n- 用 1-2 句话概括每位参与者的核心观点\n\n**共识**\n- 列出大家一致认同的要点\n\n**分歧**\n- 列出仍然存在不同看法的要点\n\n**建议方向**\n- 给出 1-2 条行动建议\n\n要求客观中立，不要添加讨论中没有的观点。`
}

// ── Discussion Core Logic ───────────────────────────────────────────────

async function startDiscussion(convId, text) {
  const channelConversations = window.channelConversations
  const channelMessages = window.channelMessages
  const conv = channelConversations.find(c => c.id === convId)
  if (!conv || conv.type !== "group") return

  const topic = extractDiscussionTopic(text)
  const agentIds = conv.agentIds || []

  // Resolve participant info for UI
  const participantNames = agentIds.map(aid => { const dm = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid); return dm?.name || aid })
  const participantColors = agentIds.map(aid => { const dm = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid); return dm?.avatarColor || window.getAgentColor(aid) })

  discussionState.active = true; discussionState.round = 0; discussionState.maxRounds = 3
  discussionState.conversationId = convId; discussionState.topic = topic || text
  discussionState.participantIds = [...agentIds]; discussionState.participantNames = participantNames; discussionState.participantColors = participantColors
  discussionState.roundHistory = []; discussionState.summary = null

  if (!channelMessages[convId]) channelMessages[convId] = []
  channelMessages[convId].push({ id: window.getChannelMsgId(), role: "system", systemType: "discussion-start", content: topic || "讨论开始", timestamp: Date.now(), participantIds: [...agentIds], participantNames, participantColors, maxRounds: 3 })
  window.persistChannelMessages()
  window.renderChannelMessages(convId)

  try {
    while (discussionState.active) {
      discussionState.round++
      channelMessages[convId].push({ id: window.getChannelMsgId(), role: "system", systemType: "discussion-round", content: `第 ${discussionState.round} 轮`, timestamp: Date.now(), round: discussionState.round, maxRounds: discussionState.maxRounds })
      window.persistChannelMessages()
      window.renderChannelMessages(convId)

      const roundResponses = await executeDiscussionRound(convId, text)
      discussionState.roundHistory.push({ round: discussionState.round, responses: roundResponses })

      const convergence = checkDiscussionConvergence()
      if (convergence !== "continue") { await generateDiscussionSummary(convId); break }
      await new Promise(r => setTimeout(r, 800))
    }
  } catch (e) {
    console.error("Discussion error:", e)
  } finally {
    resetDiscussionState()
    window.persistChannelMessages()
    window.persistChannelConversations()
    window.renderChannelMessages(convId)
    window.renderChannelContactList()
  }
}

async function executeDiscussionRound(convId, originalText) {
  const channelConversations = window.channelConversations
  const channelMessages = window.channelMessages
  const conv = channelConversations.find(c => c.id === convId)
  if (!conv) return []

  const agentIds = discussionState.participantIds
  const round = discussionState.round
  const isRound1 = round === 1

  const memberNames = agentIds.map(aid => {
    const dm = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid)
    return dm?.name || aid
  })

  let previousRoundText = "", allRoundTexts = ""
  if (round > 1 && discussionState.roundHistory.length > 0) {
    previousRoundText = buildRoundText(discussionState.roundHistory[discussionState.roundHistory.length - 1].responses)
    allRoundTexts = buildAllRoundsText()
  }

  const respondingAgents = []
  for (const agentId of agentIds) {
    const personality = AGENT_PERSONALITY[agentId] || AGENT_PERSONALITY._default
    if (isRound1) { respondingAgents.push(agentId) }
    else { if (Math.random() < getAdjustedTalkativeness(personality.talkativeness, round)) respondingAgents.push(agentId) }
  }
  if (respondingAgents.length === 0 && agentIds.length > 0) respondingAgents.push(agentIds[0])

  window.channelGroupStreaming[convId] = {}
  for (const agentId of respondingAgents) { window.channelGroupStreaming[convId][agentId] = { traceId: null, buffer: "", status: "streaming" } }
  window.renderChannelMessages(convId)

  const agentPromises = respondingAgents.map(async (agentId) => {
    const agentConv = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === agentId)
    const agentName = agentConv?.name || agentId

    let sessionId = agentConv?.sessionId
    if (!sessionId) {
      try {
        const created = await window.desktopBridge.session.createSession(window.activeBaseUrl, window.apiKey)
        sessionId = created.id
        if (agentConv) { agentConv.sessionId = sessionId; window.persistChannelConversations() }
      } catch (e) {
        console.error(`Failed to create session for agent ${agentId}:`, e)
        if (window.channelGroupStreaming[convId]?.[agentId]) window.channelGroupStreaming[convId][agentId].status = "skipped"
        window.scheduleGroupStreamingRender(convId)
        return { agentId, agentName, content: "[SKIP]" }
      }
    }

    const prompt = buildGroupPrompt({ agentId, agentName, convName: conv.name, memberNames: ["用户(我)", ...memberNames], text: discussionState.topic, messageType: "discuss", isMentioned: false, round, previousRoundText, allRoundTexts })

    try {
      const { traceId } = await window.desktopBridge.session.createRun(window.activeBaseUrl, sessionId, prompt, window.apiKey, { agentId })
      if (window.channelGroupStreaming[convId]?.[agentId]) window.channelGroupStreaming[convId][agentId].traceId = traceId

      await window.desktopBridge.session.streamRunUntilTerminal(window.activeBaseUrl, traceId, window.apiKey, (ev) => {
        if (ev.type === "text_delta" && ev.payload) {
          const delta = typeof ev.payload === "string" ? ev.payload : ev.payload.delta || ""
          if (delta && window.channelGroupStreaming[convId]?.[agentId]) { window.channelGroupStreaming[convId][agentId].buffer += delta; window.scheduleGroupStreamingRender(convId) }
        }
      })

      const agentState = window.channelGroupStreaming[convId]?.[agentId]
      if (!agentState) return { agentId, agentName, content: "[SKIP]" }
      const content = agentState.buffer || ""

      if (window.isSkipResponse(content)) { agentState.status = "skipped" }
      else {
        agentState.status = "done"
        channelMessages[convId].push({ id: window.getChannelMsgId(), role: "assistant", senderId: agentId, senderName: agentName, content, timestamp: Date.now(), avatarColor: agentConv?.avatarColor || window.getAgentColor(agentId), avatarUrl: agentConv?.avatarUrl || null })
      }

      delete window.channelGroupStreaming[convId]?.[agentId]
      if (window.channelGroupStreaming[convId] && Object.keys(window.channelGroupStreaming[convId]).length === 0) delete window.channelGroupStreaming[convId]
      window.persistChannelMessages()
      window.renderChannelMessages(convId)
      return { agentId, agentName, content }
    } catch (e) {
      console.error(`Agent ${agentId} run failed:`, e)
      if (window.channelGroupStreaming[convId]?.[agentId]) { window.channelGroupStreaming[convId][agentId].status = "skipped"; delete window.channelGroupStreaming[convId][agentId] }
      if (window.channelGroupStreaming[convId] && Object.keys(window.channelGroupStreaming[convId]).length === 0) delete window.channelGroupStreaming[convId]
      window.scheduleGroupStreamingRender(convId)
      return { agentId, agentName, content: "[SKIP]" }
    }
  })

  const results = await Promise.allSettled(agentPromises)
  const responses = results.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean)
  delete window.channelGroupStreaming[convId]
  conv.lastMessage = { content: "讨论进行中", timestamp: Date.now() }; conv.updatedAt = Date.now()
  window.persistChannelMessages(); window.persistChannelConversations()
  window.renderChannelMessages(convId); window.renderChannelContactList()
  return responses
}

async function generateDiscussionSummary(convId) {
  const channelConversations = window.channelConversations
  const channelMessages = window.channelMessages
  const conv = channelConversations.find(c => c.id === convId)
  if (!conv) return
  const allRoundTexts = buildAllRoundsText()
  if (!allRoundTexts.trim()) return

  let summarizerId = discussionState.participantIds.find(id => id === "soul-shuo") || discussionState.participantIds[0]
  if (!summarizerId) return
  const summarizerConv = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === summarizerId)
  const summarizerName = summarizerConv?.name || summarizerId
  const memberNames = discussionState.participantIds.map(aid => { const dm = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid); return dm?.name || aid })

  const summaryPrompt = buildSummaryPrompt(conv.name || "未命名群组", memberNames, allRoundTexts, discussionState.topic, summarizerName)
  let sessionId = summarizerConv?.sessionId
  if (!sessionId) {
    try { const created = await window.desktopBridge.session.createSession(window.activeBaseUrl, window.apiKey); sessionId = created.id; if (summarizerConv) { summarizerConv.sessionId = sessionId; window.persistChannelConversations() } }
    catch (e) { console.error("Failed to create session for summarizer:", e); return }
  }

  try {
    channelMessages[convId].push({ id: window.getChannelMsgId(), role: "system", systemType: "discussion-summarizing", content: "正在生成讨论总结...", timestamp: Date.now() })
    window.renderChannelMessages(convId)
    const { traceId } = await window.desktopBridge.session.createRun(window.activeBaseUrl, sessionId, summaryPrompt, window.apiKey, { agentId: summarizerId })

    let summaryBuffer = ""
    window.channelStreaming[convId] = { traceId, agentId: summarizerId, buffer: "" }
    window.renderChannelMessages(convId)

    await window.desktopBridge.session.streamRunUntilTerminal(window.activeBaseUrl, traceId, window.apiKey, (ev) => {
      if (ev.type === "text_delta" && ev.payload) {
        const delta = typeof ev.payload === "string" ? ev.payload : ev.payload.delta || ""
        if (delta) { summaryBuffer += delta; window.channelStreaming[convId].buffer = summaryBuffer; window.renderChannelMessages(convId) }
      }
    })

    delete window.channelStreaming[convId]
    const msgs = channelMessages[convId] || []
    const summarizingIdx = msgs.findIndex(m => m.systemType === "discussion-summarizing")
    if (summarizingIdx !== -1) msgs.splice(summarizingIdx, 1)

    if (summaryBuffer.trim()) {
      channelMessages[convId].push({ id: window.getChannelMsgId(), role: "system", systemType: "discussion-summary", content: summaryBuffer.trim(), timestamp: Date.now(), summarizerName, topic: discussionState.topic, totalRounds: discussionState.round })
      discussionState.summary = summaryBuffer.trim()
    }
    channelMessages[convId].push({ id: window.getChannelMsgId(), role: "system", systemType: "discussion-end", content: "讨论已结束", timestamp: Date.now() })
    conv.lastMessage = { content: "讨论已结束", timestamp: Date.now() }; conv.updatedAt = Date.now()
    window.persistChannelMessages(); window.persistChannelConversations()
    window.renderChannelMessages(convId); window.renderChannelContactList()
  } catch (e) {
    console.error("Summary generation failed:", e)
    const msgs = channelMessages[convId] || []
    const summarizingIdx = msgs.findIndex(m => m.systemType === "discussion-summarizing")
    if (summarizingIdx !== -1) msgs.splice(summarizingIdx, 1)
    channelMessages[convId].push({ id: window.getChannelMsgId(), role: "system", systemType: "discussion-end", content: "讨论已结束", timestamp: Date.now() })
    delete window.channelStreaming[convId]
    window.persistChannelMessages(); window.renderChannelMessages(convId)
  }
}

// ── Enhanced sendChannelGroupMessage ────────────────────────────────────

async function sendChannelGroupMessageEnhanced(convId, text) {
  const channelConversations = window.channelConversations
  const channelMessages = window.channelMessages
  const conv = channelConversations.find(c => c.id === convId)
  if (!conv || conv.type !== "group") return

  if (!channelMessages[convId]) channelMessages[convId] = []
  const userMsg = { id: window.getChannelMsgId(), role: "user", senderId: "user", senderName: "我", content: text, timestamp: Date.now(), avatarColor: "#7986cb" }
  channelMessages[convId].push(userMsg)
  conv.lastMessage = { content: text, timestamp: userMsg.timestamp }; conv.updatedAt = userMsg.timestamp
  window.persistChannelMessages(); window.persistChannelConversations()
  window.renderChannelMessages(convId); window.renderChannelContactList()

  const agentIds = conv.agentIds || []
  if (agentIds.length === 0) { window.showToast("warn", "群聊中没有 Agent"); return }

  const mentionedAgentIds = window.parseAtMentions(text, convId)
  const messageType = classifyMessage(text, mentionedAgentIds)

  // If "discuss" → start discussion state machine
  if (messageType === "discuss") { await startDiscussion(convId, text); return }

  // Normal path: temperature routing
  const memberNames = agentIds.map(aid => { const dm = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === aid); return dm?.name || aid })

  window.channelGroupStreaming[convId] = {}
  for (const agentId of agentIds) {
    const isMentioned = mentionedAgentIds.includes(agentId)
    const decision = shouldAgentReply(agentId, text, messageType, isMentioned)
    window.channelGroupStreaming[convId][agentId] = { traceId: null, buffer: "", status: decision.shouldReply ? "streaming" : "skipped" }
  }
  window.renderChannelMessages(convId)

  const activeAgentIds = agentIds.filter(aid => window.channelGroupStreaming[convId]?.[aid]?.status === "streaming")

  const agentPromises = activeAgentIds.map(async (agentId) => {
    const agentConv = channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === agentId)
    const agentName = agentConv?.name || agentId
    const isMentioned = mentionedAgentIds.includes(agentId)

    let sessionId = agentConv?.sessionId
    if (!sessionId) {
      try { const created = await window.desktopBridge.session.createSession(window.activeBaseUrl, window.apiKey); sessionId = created.id; if (agentConv) { agentConv.sessionId = sessionId; window.persistChannelConversations() } }
      catch (e) { console.error(`Failed to create session for agent ${agentId}:`, e); if (window.channelGroupStreaming[convId]?.[agentId]) { window.channelGroupStreaming[convId][agentId].status = "skipped"; window.scheduleGroupStreamingRender(convId) }; return }
    }

    const prompt = buildGroupPrompt({ agentId, agentName, convName: conv.name, memberNames: ["用户(我)", ...memberNames], text, messageType, isMentioned, round: 0, previousRoundText: "", allRoundTexts: "" })

    try {
      const { traceId } = await window.desktopBridge.session.createRun(window.activeBaseUrl, sessionId, prompt, window.apiKey, { agentId })
      if (window.channelGroupStreaming[convId]?.[agentId]) window.channelGroupStreaming[convId][agentId].traceId = traceId

      await window.desktopBridge.session.streamRunUntilTerminal(window.activeBaseUrl, traceId, window.apiKey, (ev) => {
        if (ev.type === "text_delta" && ev.payload) {
          const delta = typeof ev.payload === "string" ? ev.payload : ev.payload.delta || ""
          if (delta && window.channelGroupStreaming[convId]?.[agentId]) { window.channelGroupStreaming[convId][agentId].buffer += delta; window.scheduleGroupStreamingRender(convId) }
        }
      })

      const agentState = window.channelGroupStreaming[convId]?.[agentId]
      if (!agentState) return
      if (window.isSkipResponse(agentState.buffer)) { agentState.status = "skipped" }
      else {
        agentState.status = "done"
        channelMessages[convId].push({ id: window.getChannelMsgId(), role: "assistant", senderId: agentId, senderName: agentName, content: agentState.buffer, timestamp: Date.now(), avatarColor: agentConv?.avatarColor || window.getAgentColor(agentId), avatarUrl: agentConv?.avatarUrl || null })
      }

      delete window.channelGroupStreaming[convId]?.[agentId]
      if (window.channelGroupStreaming[convId] && Object.keys(window.channelGroupStreaming[convId]).length === 0) delete window.channelGroupStreaming[convId]
      const hasMessages = channelMessages[convId]?.some(m => m.role === "assistant")
      if (hasMessages) { conv.lastMessage = { content: "多条回复", timestamp: Date.now() }; conv.updatedAt = Date.now() }
      window.persistChannelMessages(); window.persistChannelConversations()
      window.renderChannelMessages(convId); window.renderChannelContactList()
    } catch (e) {
      console.error(`Agent ${agentId} run failed:`, e)
      if (window.channelGroupStreaming[convId]?.[agentId]) { window.channelGroupStreaming[convId][agentId].status = "skipped"; delete window.channelGroupStreaming[convId][agentId] }
      if (window.channelGroupStreaming[convId] && Object.keys(window.channelGroupStreaming[convId]).length === 0) delete window.channelGroupStreaming[convId]
      window.scheduleGroupStreamingRender(convId)
    }
  })

  await Promise.allSettled(agentPromises)
  delete window.channelGroupStreaming[convId]
  window.persistChannelMessages(); window.persistChannelConversations()
  window.renderChannelMessages(convId); window.renderChannelContactList()
}

// ── Install: override and patch ─────────────────────────────────────────

function buildDiscussionStartHtml(msg) {
  const names = msg.participantNames || []
  const colors = msg.participantColors || []
  const topic = msg.content || "讨论开始"
  let avatarHtml = ""
  for (let i = 0; i < names.length; i++) {
    const color = colors[i] || "#888"
    const label = names[i]?.charAt(0) || "?"
    avatarHtml += `<span class="disc-avatar" style="background:${color}">${window.escapeHtml(label)}</span>`
  }
  return `<div class="channel-system-msg discussion-start"><div class="discussion-start-top"><span class="discussion-icon">💬</span><span>讨论开始</span></div>${topic ? `<div class="discussion-start-topic">${window.escapeHtml(topic)}</div>` : ""}${avatarHtml ? `<div class="discussion-start-participants">${avatarHtml}</div>` : ""}</div>`
}

function buildDiscussionRoundHtml(msg) {
  const round = msg.round || 1
  const maxRounds = msg.maxRounds || 3
  let dotsHtml = ""
  for (let r = 1; r <= maxRounds; r++) {
    const cls = r < round ? "is-done" : r === round ? "is-active" : ""
    dotsHtml += `<span class="round-progress-dot ${cls}"></span>`
  }
  return `<div class="channel-system-msg discussion-round-indicator"><div class="round-progress-bar">${dotsHtml}</div><span class="round-progress-label">第 ${round} / ${maxRounds} 轮</span></div>`
}

function buildDiscussionSummaryHtml(msg) {
  const topic = msg.topic || ""
  const summarizer = msg.summarizerName || ""
  const totalRounds = msg.totalRounds || ""
  const summaryId = `summary-${msg.id || Date.now()}`
  return `<div class="channel-system-msg discussion-summary-card"><div class="summary-header" data-summary-toggle="${summaryId}"><span class="summary-icon">📋</span><span class="summary-title">讨论总结</span>${topic ? `<span class="summary-topic-tag">${window.escapeHtml(topic)}</span>` : ""}<span class="summary-meta">${window.escapeHtml(summarizer)} · ${totalRounds}轮</span><span class="summary-toggle">▼</span></div><div class="summary-body" id="${summaryId}">${window.renderMarkdown(msg.content)}</div></div>`
}

function installDiscussionEngine() {
  // Override sendChannelGroupMessage
  window.sendChannelGroupMessage = sendChannelGroupMessageEnhanced

  // Patch renderChannelMessages to support system messages
  const _origRender = window.renderChannelMessages

  window.renderChannelMessages = function(convId) {
    const listEl = document.getElementById("channel-message-list")
    if (!listEl) return

    const msgs = window.channelMessages[convId] || []
    const conv = window.channelConversations.find(c => c.id === convId)

    if (msgs.length === 0) { listEl.innerHTML = '<div class="channel-empty-state"><h3>开始对话</h3><p>发送第一条消息吧</p></div>'; return }

    // Track which summary cards are collapsed
    const collapsedSummaryIds = new Set()
    listEl.querySelectorAll('.summary-body.is-collapsed').forEach(el => collapsedSummaryIds.add(el.id))

    let html = ""
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i]

      // System messages — discussion indicators
      if (msg.role === "system") {
        if (msg.systemType === "discussion-start") {
          html += buildDiscussionStartHtml(msg)
        } else if (msg.systemType === "discussion-round") {
          html += buildDiscussionRoundHtml(msg)
        } else if (msg.systemType === "discussion-summarizing") {
          html += `<div class="channel-system-msg discussion-summarizing"><div class="summarizing-dots"><span></span><span></span><span></span></div><span>${window.escapeHtml(msg.content)}</span></div>`
        } else if (msg.systemType === "discussion-summary") {
          html += buildDiscussionSummaryHtml(msg)
        } else if (msg.systemType === "discussion-end") {
          html += `<div class="channel-system-msg discussion-end-indicator"><span class="discussion-end-line"></span><span>讨论已结束</span><span class="discussion-end-line"></span></div>`
        }
        continue
      }

      // Normal messages
      const isUser = msg.role === "user"
      const isAgent = msg.role === "assistant"
      if (window.shouldShowTimeDivider(msgs, i)) { html += `<div class="channel-time-divider"><span>${window.formatDividerTime(msg.timestamp)}</span></div>` }

      const avatarBg = msg.avatarColor || (isUser ? "#7986cb" : "#6b9e78")
      const avatarLabel = isUser ? "我" : (msg.senderName?.charAt(0) || "?")
      const avatarImg = msg.avatarUrl ? `<img src="${window.escapeHtml(msg.avatarUrl)}" alt="" />` : window.escapeHtml(avatarLabel)
      const isGroup = conv?.type === "group"
      const agentColorStyle = isGroup && isAgent ? `--agent-color:${avatarBg}` : ""
      const hasAgentColorClass = isGroup && isAgent ? " has-agent-color" : ""

      html += `<div class="channel-msg-row ${isUser ? 'is-user' : 'is-agent'}" ${agentColorStyle ? `style="${agentColorStyle}"` : ""}><div class="channel-msg-avatar" style="background:${avatarBg}">${avatarImg}</div><div class="channel-msg-body"><span class="channel-msg-sender${hasAgentColorClass}" ${agentColorStyle ? `style="--agent-color:${avatarBg}"` : ""}>${window.escapeHtml(isUser ? "我" : (msg.senderName || "Agent"))}</span><div class="channel-msg-bubble${hasAgentColorClass}" ${agentColorStyle ? `style="--agent-color:${avatarBg}"` : ""}>${window.renderBubbleContent(msg.content, convId)}</div><span class="channel-msg-time">${window.formatChatTime(msg.timestamp)}</span></div></div>`
    }

    // Streaming indicator — DM
    const streaming = window.channelStreaming[convId]
    if (streaming) {
      const conv2 = window.channelConversations.find(c => c.id === convId)
      const agentInfo = conv2?.type === "dm" ? conv2 : window.channelConversations.find(c => c.type === "dm" && c.agentIds?.[0] === streaming.agentId)
      const avatarBg = agentInfo?.avatarColor || "#6b9e78"
      html += `<div class="channel-msg-row is-agent channel-msg-streaming"><div class="channel-msg-avatar" style="background:${avatarBg}">${window.escapeHtml(agentInfo?.name?.charAt(0) || "?")}</div><div class="channel-msg-body"><span class="channel-msg-sender">${window.escapeHtml(agentInfo?.name || "Agent")}</span><div class="channel-msg-bubble">${streaming.buffer ? window.renderBubbleContent(streaming.buffer, convId) : '<div class="channel-typing-indicator"><span></span><span></span><span></span></div>'}</div></div></div>`
    }

    // Streaming — Group
    const groupStreaming = window.channelGroupStreaming[convId]
    if (groupStreaming && conv?.type === "group") {
      for (const agentId of Object.keys(groupStreaming)) {
        const agentState = groupStreaming[agentId]
        if (agentState.status === 'skipped') continue
        const agentConv = window.channelConversations.find(c => c.type === 'dm' && c.agentIds?.[0] === agentId)
        const avatarBg = agentConv?.avatarColor || window.getAgentColor(agentId)
        const agentName = agentConv?.name || agentId
        const agentColorStyle = `--agent-color:${avatarBg}`
        html += `<div class="channel-msg-row is-agent channel-msg-streaming" style="${agentColorStyle}"><div class="channel-msg-avatar" style="background:${avatarBg}">${window.escapeHtml(agentConv?.name?.charAt(0) || "?")}</div><div class="channel-msg-body"><span class="channel-msg-sender has-agent-color" style="${agentColorStyle}">${window.escapeHtml(agentName)}</span><div class="channel-msg-bubble has-agent-color" style="${agentColorStyle}">${agentState.buffer ? window.renderBubbleContent(agentState.buffer, convId) : '<div class="channel-typing-indicator"><span></span><span></span><span></span></div>'}</div></div></div>`
      }
    }

    listEl.innerHTML = html

    // Restore collapsed state for summary cards
    collapsedSummaryIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) {
        el.classList.add("is-collapsed")
        const toggle = document.querySelector(`[data-summary-toggle="${id}"] .summary-toggle`)
        if (toggle) toggle.classList.add("is-collapsed")
      }
    })

    // Bind summary card toggle
    listEl.querySelectorAll("[data-summary-toggle]").forEach(header => {
      header.addEventListener("click", () => {
        const targetId = header.getAttribute("data-summary-toggle")
        const body = document.getElementById(targetId)
        const toggle = header.querySelector(".summary-toggle")
        if (body) body.classList.toggle("is-collapsed")
        if (toggle) toggle.classList.toggle("is-collapsed")
      })
    })

    requestAnimationFrame(() => { listEl.scrollTop = listEl.scrollHeight })
  }
}

// Auto-install after app.js has loaded and set up window globals
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(installDiscussionEngine, 200))
} else {
  setTimeout(installDiscussionEngine, 200)
}
