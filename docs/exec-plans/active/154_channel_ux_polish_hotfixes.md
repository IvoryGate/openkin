# 154 — 频道 UI/UX 修复与打磨

> 状态：✅ 已实现
> 分支：feat/l5-client-surface
> 关联：153_channel_im_panel_master_plan

---

## 问题描述

用户反馈频道界面四个问题：

1. **发消息无回应** — Agent 不回复任何消息
2. **时间分割线太丑** — 横线穿过时间文字，像把文字切开了
3. **群聊头像默认颜色太深** — 与整体主题不搭配
4. **左侧好友列表头像应为圆角矩形** — 而非圆形

---

## 修复方案

### 154-1: 频道发消息无回应

**根因**：`sendChannelDmMessage` 和 `sendChannelGroupMessage` 中对 SSE `text_delta` 事件的 payload 解析方式错误。

SSE 事件的 `text_delta` payload 格式为 `{ delta: "..." }`，但代码中写了 `typeof ev.payload === "string"`，这永远为 false，导致流式文本不会被追加到 buffer 中，Agent 回复被静默丢弃。

**修复**：
```js
// 修复前
if (ev.type === "text_delta" && typeof ev.payload === "string") {
  streaming.buffer += ev.payload
}

// 修复后
if (ev.type === "text_delta" && ev.payload) {
  const delta = typeof ev.payload === "string" ? ev.payload : ev.payload.delta || ""
  if (delta) {
    streaming.buffer += delta
    renderChannelMessages(convId)
  }
}
```

**附带修复**：`showToast` 参数顺序错误（DM 发送中 3 处调用 message 和 type 反了）：
```js
// 修复前
showToast("无法创建会话：接口不可用", "error")

// 修复后
showToast("error", "无法创建会话：接口不可用")
```

### 154-2: 时间分割线样式

**修复**：移除 `::before` 伪元素的贯穿横线，改为居中圆角标签样式。

```css
/* 修复后 */
.channel-time-divider {
  text-align: center;
  margin: 20px 0 12px;
}

.channel-time-divider span {
  display: inline-block;
  padding: 2px 10px;
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-surface);
  border-radius: 10px;
  border: 1px solid var(--border-light);
}
```

### 154-3: 群聊头像默认颜色

**修复**：将 `AGENT_COLORS` 从深色系调整为柔和色系，与主题更搭。

```js
// 修复前
const AGENT_COLORS = ["#4a6741", "#1565c0", "#7b1fa2", "#e65100", "#c62828", "#00695c", "#4527a0", "#bf360c"]

// 修复后 — 柔和色系
const AGENT_COLORS = ["#6b9e78", "#5b8ec9", "#9b7fb8", "#d4845a", "#c76b6b", "#4da89a", "#7b6bb5", "#c97a5a"]
```

用户消息默认头像色也从 `#5c6bc0` 调整为 `#7986cb`（柔和靛蓝）。
Agent 默认回退色从 `#4a6741` 调整为 `#6b9e78`（柔和绿）。

### 154-4: 好友列表头像改为圆角矩形

**修复**：将 `border-radius: 50%` 改为 `border-radius: 8px`（联系人列表）和 `border-radius: 6px`（消息气泡头像）。

状态点位置从 `bottom: 1px; right: 1px` 调整为 `bottom: -1px; right: -1px`，使圆角矩形时状态点紧贴右下角。

---

## 涉及文件

- `apps/desktop/renderer/app.js` — SSE payload 解析、showToast 参数、AGENT_COLORS、头像默认色
- `apps/desktop/renderer/styles.css` — 时间分割线样式、头像圆角、状态点位置

---

## 验证

- [x] 频道私聊发消息后 Agent 有流式回复
- [x] 频道群聊发消息后相关 Agent 回复，无关 Agent 跳过
- [x] 时间分割线显示为居中圆角标签，不切开文字
- [x] 群聊头像颜色柔和，与主题搭配
- [x] 左侧好友列表头像为圆角矩形
- [x] 消息气泡中头像为小圆角矩形
- [x] 暗色主题下所有修改正常显示
