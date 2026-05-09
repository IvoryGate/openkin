# 157-4 — 讨论总结卡片 + 轮次指示器 UI

## 状态：待办

## 前置依赖

157-2, 157-3

## 目标

为讨论模式添加视觉反馈：轮次指示器、讨论状态、总结卡片。

## 实现内容

### 1. 讨论轮次指示器

在频道聊天区域顶部显示讨论进度：

```html
<div id="channel-discussion-banner" class="channel-discussion-banner is-hidden">
  <span class="discussion-icon">💬</span>
  <span class="discussion-label">讨论进行中</span>
  <span class="discussion-round">第 <strong id="discussion-round-num">1</strong> 轮</span>
  <span class="discussion-topic" id="discussion-topic-text"></span>
  <button id="discussion-stop-btn" class="ghost-btn" type="button">结束讨论</button>
</div>
```

样式：
- 固定在消息列表顶部
- 浅色背景，圆角
- 轮次数高亮
- "结束讨论"按钮允许用户手动终止

### 2. 讨论总结卡片

讨论结束后渲染的特殊消息：

```html
<div class="channel-msg-row is-agent channel-summary-card">
  <div class="channel-msg-avatar" style="background:var(--bg-accent,#4a6741)">
    📋
  </div>
  <div class="channel-msg-body">
    <span class="channel-msg-sender">讨论总结</span>
    <div class="discussion-summary-bubble">
      <h5>📋 讨论总结</h5>
      <div class="summary-section">
        <h6>各方观点</h6>
        <ul>
          <li><strong>绫：</strong>...</li>
          <li><strong>澄：</strong>...</li>
          <li><strong>朔：</strong>...</li>
        </ul>
      </div>
      <div class="summary-section">
        <h6>共识</h6>
        <p>...</p>
      </div>
      <div class="summary-section">
        <h6>分歧</h6>
        <p>...</p>
      </div>
    </div>
    <span class="channel-msg-time">讨论已结束</span>
  </div>
</div>
```

### 3. 轮次分隔线

在讨论模式中，不同轮次之间显示分隔线：

```html
<div class="channel-round-divider">
  <span>第 N 轮讨论</span>
</div>
```

与时间分隔线区分，使用不同颜色/样式。

### 4. CSS 样式

```css
/* 讨论横幅 */
.channel-discussion-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-accent-subtle, rgba(74, 103, 65, 0.08));
  border-bottom: 1px solid var(--border-subtle, #e0dfd8);
  font-size: 12px;
  color: var(--text-secondary);
}
.channel-discussion-banner .discussion-round strong {
  color: var(--text-accent, #4a6741);
}

/* 总结卡片 */
.discussion-summary-bubble {
  background: var(--bg-card, #f5f4ef);
  border: 1px solid var(--border-subtle, #e0dfd8);
  border-radius: 8px;
  padding: 12px 16px;
}
.discussion-summary-bubble h5 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-accent, #4a6741);
}
.discussion-summary-bubble h6 {
  margin: 8px 0 4px;
  font-size: 12px;
  color: var(--text-secondary);
}
.summary-section ul {
  margin: 0;
  padding-left: 16px;
}
.summary-section li {
  font-size: 13px;
  margin-bottom: 4px;
}

/* 轮次分隔线 */
.channel-round-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 11px;
  color: var(--text-accent, #4a6741);
}
.channel-round-divider::before,
.channel-round-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border-subtle, #e0dfd8);
}
```

## 影响文件

- `apps/desktop/renderer/app.js`
- `apps/desktop/renderer/styles.css`
- `apps/desktop/renderer/index.html`

## 验收标准

1. 讨论进行时顶部显示横幅，含轮次和主题
2. 每轮之间显示轮次分隔线
3. 讨论结束显示总结卡片
4. 用户可手动点击"结束讨论"提前终止
5. 横幅和卡片样式与整体主题协调
