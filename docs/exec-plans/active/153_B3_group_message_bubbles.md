# 153-B3 — 群聊消息气泡（区分不同 Agent + 头像+名称标识）

> **状态**：待执行
> **前置**：153-B2
> **预估**：1d

---

## 目标

群聊消息气泡能清晰区分不同 Agent 的回复，通过颜色、头像、名称标识。

---

## 核心设计

### Agent 颜色标识

每个 Agent 分配一个固定的主题色，用于消息气泡左侧竖条和名称着色：

```js
const AGENT_COLORS = [
  "#4a6741", "#1565c0", "#7b1fa2", "#e65100",
  "#c62828", "#00695c", "#4527a0", "#bf360c",
]

function getAgentColor(agentId) {
  let hash = 0
  for (const ch of agentId) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]
}
```

### 消息气泡增强

群聊中 Agent 消息气泡增加：
- 左侧 3px 竖条（Agent 主题色）
- 名称文字使用 Agent 主题色
- 不同 Agent 的消息之间有视觉间隔

---

## 验收标准

1. ✅ 群聊中不同 Agent 的回复有不同颜色标识
2. ✅ 每个 Agent 消息左侧有主题色竖条
3. ✅ Agent 名称着色为主题色
4. ✅ 同一 Agent 连续多条消息紧凑显示
5. ✅ 亮色/暗色主题下颜色均协调
