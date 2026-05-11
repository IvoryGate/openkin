# 155-C2 — 群聊流式回复可见 — 每个 Agent 实时打字效果

> **状态**：🚧 进行中
> **前置**：153-B2（已完成）
> **预估**：2d
> **优先级**：P0 — 体验断裂

---

## 目标

群聊发消息后，每个 Agent 的回复过程**实时流式可见**，不再等待所有 Agent 全部完成后一次性渲染。

## 当前问题

`sendChannelGroupMessage` 用 `Promise.allSettled` 等待所有 Agent 的 Run 完成，然后一次性把所有回复加入消息列表。用户在等待期间只看到自己的消息，没有任何反馈，体验很差。

## 实现方案

### 1. 流式状态追踪

```js
channelGroupStreaming = {
  [convId]: {
    [agentId]: { traceId, buffer, status: "streaming" | "done" | "skipped" }
  }
}
```

### 2. 改为逐个 Agent 流式

- 每个 Agent 开始 Run 后，立即在消息列表中添加一个"正在输入"占位气泡
- 随着流式 delta 到达，实时更新该 Agent 的气泡内容
- Agent 完成后，最终渲染为正常消息气泡
- Agent 回复 [SKIP] 后，移除占位气泡

### 3. UI 展示

- 每个"正在输入"的 Agent 显示：头像 + 名字 + ⋯ 动画
- 有 delta 内容后，⋯ 替换为实时文字（逐字出现）
- Agent 完成/跳过后，最终渲染为正常消息气泡或直接移除

### 4. 渲染优化

- 使用 `requestAnimationFrame` 节流渲染
- 多个 Agent 同时流式时，合并渲染更新
- 滚动位置锁定：用户在底部时自动滚动，手动上滚时不强制跳回

## 涉及文件

- `apps/desktop/renderer/app.js` — 重构 `sendChannelGroupMessage` 为流式模式
- `apps/desktop/renderer/styles.css` — 多 Agent 并行输入指示器样式

## 验收标准

1. 群聊发消息后，每个 Agent 立即显示"正在输入"占位
2. Agent 回复内容逐字流式出现
3. 不同 Agent 的流式回复互不干扰
4. Agent 回复 [SKIP] 时占位气泡消失
5. 多 Agent 同时流式时性能流畅
6. 暗色主题下正常显示
