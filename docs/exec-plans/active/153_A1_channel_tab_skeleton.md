# 153-A1 — 频道 Tab 切换 + 三栏布局骨架

> **状态**：待执行
> **前置**：152（UX 打磨已完成）
> **预估**：0.5d

---

## 目标

让顶栏"频道"Tab 可点击切换，显示一个三栏 IM 布局骨架。此工单只做布局和切换逻辑，不做具体功能。

---

## 具体工作

### 1. HTML — 新增频道视图容器

在 `index.html` 的 `#app` 内、`desktop-shell` 之后，新增：

```html
<section id="channel-view" class="channel-view is-hidden" aria-hidden="true">
  <div class="channel-layout">
    <!-- 左栏：联系人列表 -->
    <aside class="channel-sidebar">
      <div class="channel-sidebar-header">
        <h3>频道</h3>
        <button id="channel-new-group-btn" class="ghost-btn" type="button">新建群聊</button>
      </div>
      <div class="channel-search">
        <input id="channel-search-input" type="text" placeholder="搜索联系人或群组..." />
      </div>
      <div id="channel-contact-list" class="channel-contact-list">
        <!-- 渲染联系人 -->
      </div>
    </aside>
    <!-- 中栏：消息区域 -->
    <main class="channel-main">
      <div id="channel-chat-header" class="channel-chat-header">
        <h4 id="channel-chat-title">选择一个联系人开始聊天</h4>
      </div>
      <div id="channel-message-list" class="channel-message-list">
        <!-- 渲染消息 -->
      </div>
      <div id="channel-composer" class="channel-composer is-hidden">
        <textarea id="channel-composer-input" placeholder="输入消息..."></textarea>
        <button id="channel-send-btn" type="button">发送</button>
      </div>
    </main>
    <!-- 右栏：信息面板 -->
    <aside id="channel-info-panel" class="channel-info-panel is-hidden">
      <div class="channel-info-header">
        <h4 id="channel-info-title">详情</h4>
      </div>
      <div id="channel-info-content" class="channel-info-content">
        <!-- Agent 详情 / 群成员 -->
      </div>
    </aside>
  </div>
</section>
```

### 2. CSS — 三栏布局样式

```css
/* ── Channel View (IM Layout) ──────────────────────────────────── */

.channel-view {
  position: fixed;
  inset: 0;
  top: var(--top-nav-height, 48px);
  z-index: 10;
  background: var(--bg-base);
}

.channel-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.channel-sidebar {
  width: 280px;
  min-width: 240px;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-default, #d8d5cd);
  background: var(--channel-bg, var(--bg-surface, #f3f2ee));
}

.channel-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light, #e2e0d8);
}

.channel-search {
  padding: 8px 12px;
}

.channel-search input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-default, #d8d5cd);
  border-radius: 6px;
  background: var(--bg-input, #fff);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.channel-search input:focus {
  border-color: var(--bg-accent, #4a6741);
}

.channel-contact-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.channel-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-base);
}

.channel-chat-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light, #e2e0d8);
  min-height: 48px;
}

.channel-message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.channel-composer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-light, #e2e0d8);
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.channel-composer textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--border-default, #d8d5cd);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.5;
  background: var(--bg-input, #fff);
  color: var(--text-primary);
  outline: none;
  min-height: 40px;
  max-height: 120px;
}

.channel-composer textarea:focus {
  border-color: var(--bg-accent, #4a6741);
}

.channel-info-panel {
  width: 260px;
  min-width: 200px;
  max-width: 320px;
  border-left: 1px solid var(--border-default, #d8d5cd);
  background: var(--channel-bg, var(--bg-surface, #f3f2ee));
  display: flex;
  flex-direction: column;
}

.channel-info-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light, #e2e0d8);
}

.channel-info-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

/* 空态 */
.channel-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  gap: 8px;
}

.channel-empty-state h3 {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
}
```

### 3. JS — Tab 切换逻辑

在 `switchTopTab` 中处理 `channel` tab：

```js
function switchTopTab(tabId) {
  activeTopTab = tabId
  // ... 现有 tab 切换逻辑 ...

  // 频道视图
  const channelViewEl = document.getElementById("channel-view")
  if (channelViewEl) {
    channelViewEl.classList.toggle("is-hidden", tabId !== "channel")
    channelViewEl.setAttribute("aria-hidden", tabId !== "channel")
  }

  // 切换到频道时隐藏 desktop-shell
  if (desktopShellEl) {
    desktopShellEl.classList.toggle("is-hidden", tabId === "channel")
  }

  // 初始化频道数据
  if (tabId === "channel") {
    initChannelView()
  }
}
```

### 4. JS — 频道数据初始化骨架

```js
// ── Channel View ────────────────────────────────────────────────

let channelInitialized = false
let channelConversations = []  // ChannelConversation[]

const CHANNEL_STORAGE_KEY = "theworld_channel_conversations_v1"

function loadChannelConversations() {
  try {
    const raw = localStorage.getItem(CHANNEL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function persistChannelConversations() {
  localStorage.setItem(CHANNEL_STORAGE_KEY, JSON.stringify(channelConversations))
}

async function initChannelView() {
  if (channelInitialized) return
  channelInitialized = true
  channelConversations = loadChannelConversations()
  await refreshChannelContacts()
  renderChannelContactList()
}
```

---

## 验收标准

1. ✅ 点击顶栏"频道"Tab，切换到频道视图
2. ✅ 频道视图显示三栏布局：左（联系人列表）、中（消息区域）、右（信息面板）
3. ✅ 中栏默认显示空态提示："选择一个联系人开始聊天"
4. ✅ 点击"聊天"Tab 可切回原视图
5. ✅ 刷新页面后频道 Tab 切换仍然正常
6. ✅ 亮色/暗色主题下布局均正常

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `apps/desktop/renderer/index.html` | 新增 `#channel-view` 容器 |
| `apps/desktop/renderer/styles.css` | 新增频道布局 CSS |
| `apps/desktop/renderer/app.js` | 新增频道 Tab 切换 + 初始化骨架 |
