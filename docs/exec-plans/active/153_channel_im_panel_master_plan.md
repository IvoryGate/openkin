# 153 — 频道版块：仿即时通讯界面与功能实现（总规划）

> **状态**：规划中
> **层级**：L5 Client Surface → L6 Orchestration
> **前置**：152（UX 打磨已完成）
> **原则**：小步迭代，每个工单可独立验收，逐步逼近完整 IM 体验

---

## 一、愿景与核心定位

### 目标

在 Desktop 客户端内实现一个**仿微信/QQ 的即时通讯版块**，其核心特征是：

1. **只有 1 个人类用户**，其余所有"联系人"都是设定好的 Agent
2. 用户可以和某个 Agent **单独聊天**（私聊）
3. 用户可以**自由拉群**，群内包含多个 Agent（群聊）
4. 界面布局、交互模式、视觉风格对标主流 IM 应用
5. 配色贴合现有主题（亮色/暗色）

### 不是什么

- 不是真正的多人即时通讯系统——没有多人类用户、没有注册登录、没有好友系统
- 不是 Channel Adapter——那是 L5 接入外部 IM 平台的框架，这里是**内置的 IM 界面**
- 不是替代现有聊天 Tab——现有聊天 Tab 继续作为"纯对话"入口，频道版块提供 IM 化的交互体验

---

## 二、现有基础与约束

### 可复用

| 能力 | 来源 | 说明 |
|------|------|------|
| Session CRUD | `sdk/client` + Desktop bridge | 创建/查询/删除/重命名会话 |
| Message 收发 | `sdk/client` + Desktop bridge | 发送消息、流式接收回复 |
| Run 流式 | Desktop bridge `streamRunUntilTerminal` | Agent 推理过程实时展示 |
| Agent 管理 | Desktop bridge `agent.*` | 列出/创建 Agent |
| Session kind | `shared-contracts` | 已支持 `'chat' \| 'task' \| 'channel'` |
| `channel-core` | `packages/channel-core` | 最小 ChannelAdapter/ChannelManager 框架 |
| 主题系统 | CSS 变量 | 亮色/暗色主题已有 |
| Toast/SVG 图标 | 152 已实现 | 通知系统与图标体系就绪 |

### 需新建

| 能力 | 原因 |
|------|------|
| **联系人/会话列表**（IM 式） | 现有左侧栏是"历史会话"列表，不是 IM 联系人列表 |
| **群组数据模型** | 现有 `SessionDto` 是 1:1 会话，群聊需要 1:N 映射 |
| **群组创建/管理 UI** | 拉群、添加/移除成员、群名/群头像 |
| **频道主视图** | 顶部 Tab "频道" 需要落地为完整视图 |
| **消息气泡样式**（IM 式） | 现有消息是左对齐气泡，需改为左右分列式 |
| **在线状态** | Agent 的"在线/离线"展示（基于 enabled 状态） |
| **未读消息数** | 会话列表中的未读红点/数字 |
| **@提及** | 群聊中 @某个 Agent |
| **输入提示** | 群聊中指定回复某个 Agent |

### 约束

1. **后端 API 不改**——所有功能必须基于现有 REST + SSE API 实现，不新增后端 endpoint
2. **群聊实现策略**：群聊在客户端侧映射为一个 Session + 多个 Agent 的 run 调度。群内消息路由在客户端完成（收到消息后决定由哪个/哪些 Agent 回复），不需要服务端理解"群"概念
3. **频道版块全部在 renderer 进程内实现**，不涉及 preload/bridge 新增

---

## 三、数据模型设计

### 3.1 联系人（Agent 作为联系人）

Agent 本身就是联系人，不需要新建数据结构。直接使用 `TheworldDesktopAgent`：

```
Agent → 联系人
  id       → 联系人 ID
  name     → 显示名称
  avatarUrl → 头像
  enabled  → 在线状态（enabled=在线，disabled=离线）
  description → 个性签名
```

### 3.2 会话类型

```
ChannelConversation {
  id: string                    // 唯一标识
  type: 'dm' | 'group'         // 私聊 or 群聊
  name: string                  // 群名（群聊）/ Agent名（私聊，自动取）
  avatarUrl?: string            // 群头像/Agent头像
  agentIds: string[]            // 参与的 Agent ID 列表
  sessionId: string             // 对应后端 Session ID
  lastMessage?: {               // 最近一条消息
    content: string
    senderRole: 'user' | 'agent'
    senderId: string            // Agent ID（如果是 agent 发的）
    timestamp: number
  }
  unreadCount: number           // 未读数
  pinnedAt?: number             // 置顶时间
  muted: boolean                // 免打扰
  createdAt: number
  updatedAt: number
}
```

### 3.3 群聊消息路由策略

群聊中用户发一条消息，如何决定哪些 Agent 回复？

**已实现方案（Agent Self-Judge）**：
- 用户在群内发消息 → **并行**为每个 Agent 创建独立的 Run
- 每个 Agent 的 Run 中注入群聊上下文（群名、成员列表、最近历史、回复规则）
- Agent 自主判断是否需要回复：
  - 相关 → 正常回复
  - 不相关 → 回复 `[SKIP]`，客户端过滤掉
- 每个 Agent 有独立的 Session，确保上下文隔离
- **不会消息爆炸**——只有真正相关的 Agent 才会回复

**上下文注入方式**：
- 当前：将群聊上下文拼入 user message（`enrichedText`）
- TODO：当服务端 `CreateRunRequest` 增加 `systemSuffix` 字段后，改为通过 `systemSuffix` 注入

**后续可扩展**：@指定 Agent、Router Agent 分发、投票模式等

### 3.4 持久化

- `ChannelConversation` 列表存储在 `localStorage`，key: `theworld_channel_conversations_v1`
- 映射关系：`conversation.sessionId` ↔ 后端 Session
- 重启后通过 sessionId 重新加载消息历史

---

## 四、界面设计

### 4.1 整体布局

切换到"频道" Tab 后，主区域变为三栏 IM 布局：

```
┌─────────────────────────────────────────────────────────┐
│  theworld Desktop    [聊天] [频道] [工作台] ...         │
├────────┬───────────────────────┬────────────────────────┤
│        │                       │                        │
│ 联系人 │    消息区域             │   聊天信息面板          │
│ 列表   │                       │   (群成员/Agent详情)    │
│        │                       │                        │
│ ┌────┐ │  ┌──┐                 │   ┌──────────────┐     │
│ │搜索│ │  │用│                 │   │ 群成员列表    │     │
│ └────┘ │  │户│  你好！         │   │  - Agent A   │     │
│        │  └──┘                 │   │  - Agent B   │     │
│ [Agent │                       │   └──────────────┘     │
│  A   ] │       ┌──────┐        │                        │
│ [Agent │       │Agent │        │                        │
│  B   ] │       │ A    │ 你好！ │                        │
│ [群组1] │       └──────┘        │                        │
│ [群组2] │                       │                        │
│        │  ┌──────────────────┐  │                        │
│        │  │ 输入消息...        │  │                        │
│        │  └──────────────────┘  │                        │
├────────┴───────────────────────┴────────────────────────┤
```

### 4.2 左栏 — 联系人列表

- 顶部：搜索框（过滤联系人和群组）
- 分区：
  - "在线" — enabled 的 Agent
  - "群组" — 已创建的群聊
  - "离线" — disabled 的 Agent
- 每个联系人项：
  - 圆形头像（Agent 头像 / 群头像首字）
  - 名称
  - 最近消息预览（单行截断）
  - 时间
  - 未读红点/数字
- 底部："+ 新建群聊"按钮

### 4.3 中栏 — 消息区域

- 顶部：会话标题栏（名称 + 在线人数/群成员数 + 设置按钮）
- 消息列表：
  - 用户消息靠右，Agent 消息靠左
  - 每条 Agent 消息左上角显示 Agent 头像+名称
  - 群聊中不同 Agent 用不同颜色标识
  - 时间戳分组（5分钟内连续消息合并时间）
  - 消息状态（已发送 ✓ / 回复中 ⋯）
- 底部：输入区域
  - 文本输入框
  - @按钮（群聊中弹出 Agent 列表）
  - 发送按钮

### 4.4 右栏 — 信息面板

- 私聊：Agent 详情（名称、描述、系统提示、模型）
- 群聊：群成员列表 + 群设置
  - 成员列表（可点击查看 Agent 详情）
  - 修改群名
  - 添加/移除成员
  - 解散群聊

### 4.5 配色方案

延续现有主题变量，IM 场景增加以下变量：

```css
/* 频道专用变量 */
--channel-bg: var(--bg-surface);                          /* 联系人列表背景 */
--channel-item-hover: var(--bg-muted);                    /* 联系人项悬停 */
--channel-item-active: var(--bg-accent-opacity-12);       /* 选中联系人 */
--channel-msg-user-bg: var(--bg-accent, #4a6741);         /* 用户消息气泡 */
--channel-msg-user-text: #fff;                             /* 用户消息文字 */
--channel-msg-agent-bg: var(--bg-input, #fff);            /* Agent 消息气泡 */
--channel-msg-agent-text: var(--text-primary);            /* Agent 消息文字 */
--channel-unread-bg: #e04040;                              /* 未读红点 */
--channel-online-dot: #4caf50;                             /* 在线状态点 */
--channel-offline-dot: var(--text-tertiary);              /* 离线状态点 */
```

暗色模式自动通过 CSS 变量 fallback 适配。

---

## 五、功能实现路线

### Wave A：频道视图骨架 + 私聊（5 个工单）

| 工单 | 内容 | 预估 |
|------|------|------|
| 153-A1 | 频道 Tab 切换 + 三栏布局骨架 | 0.5d |
| 153-A2 | 联系人列表渲染（Agent 列表 + 搜索） | 1d |
| 153-A3 | 私聊消息气泡样式（左右分列 IM 风格） | 1d |
| 153-A4 | 私聊消息收发（复用现有 Session/Run API） | 1d |
| 153-A5 | 未读消息数 + 最近消息预览 + 持久化 | 1d |

**Wave A 完成后验收**：可以切换到频道 Tab，看到所有 Agent 作为联系人，点击某个 Agent 进入私聊界面，发送消息并收到 IM 风格的回复。

### Wave B：群聊（4 个工单）

| 工单 | 内容 | 预估 | 状态 |
|------|------|------|------|
| 153-B1 | 群组数据模型 + 创建群聊 UI | 1d | ✅ 已实现 |
| 153-B2 | 群聊消息路由（Agent Self-Judge 自主判断回复） | 1.5d | ✅ 已实现 |
| 153-B3 | 群聊消息气泡（区分不同 Agent + 头像+名称标识 + 颜色条） | 1d | ✅ 已实现 |
| 153-B4 | 群成员管理面板（添加/移除/解散） | 1d | ✅ 已实现 |

**Wave B 完成后验收**：可以新建群聊，选择多个 Agent，发消息后只有相关的 Agent 回复（不是每条消息都让所有人回复），每个 Agent 的回复都有清晰的来源标识（头像+名字+颜色条）。

### Wave C：体验增强（4 个工单）

| 工单 | 内容 | 预估 |
|------|------|------|
| 153-C1 | @提及功能（群聊中 @指定 Agent） | 1d |
| 153-C2 | 置顶 / 免打扰 / 消息通知 | 0.5d |
| 153-C3 | Agent 在线状态展示 + 状态变化动画 | 0.5d |
| 153-C4 | 消息操作菜单（复制/重发/删除） | 1d |

### Wave D：高级功能（3 个工单）

| 工单 | 内容 | 预估 |
|------|------|------|
| 153-D1 | 消息类型扩展（图片/文件/代码块渲染增强） | 1.5d |
| 153-D2 | 群聊 Router Agent 模式（指定一个 Agent 作为路由器，由它决定分发） | 2d |
| 153-D3 | 会话导出 + 消息搜索 | 1d |

---

## 六、关键设计决策

### 决策 1：群聊是否需要后端支持？

**结论：首期不需要，已实现客户端侧路由。**

群聊中每个 Agent 有独立的 Session。用户发消息时，客户端**并行**为每个 Agent 创建 Run（各自独立的 Session），并在 user message 中注入群聊上下文（群名、成员列表、最近历史）。Agent 自主判断是否回复，回复 `[SKIP]` 则客户端过滤掉。

优点：
- 不需要新增后端 API
- 并行回复，延迟低
- Agent 上下文隔离，不会互相污染
- Agent 自主判断，不会消息爆炸

缺点：
- 群聊上下文通过 user message 注入（非理想方式），等 `systemSuffix` 支持后改进
- 无真正的"群组"持久化在后端
- 每个Agent的session是独立的，Agent之间看不到彼此的回复（但客户端在上下文注入中提供了最近历史）

### 决策 2：频道视图与聊天 Tab 的关系

**结论：双入口，共享数据，不同呈现。**

- 聊天 Tab：保持现有纯对话界面，面向"工具型"使用
- 频道 Tab：IM 化界面，面向"社交型"使用
- 两者共享底层 Session/Message 数据，但呈现方式不同
- 频道私聊创建的 Session（kind=channel）在聊天 Tab 中不显示（过滤 kind=chat）
- 反之，聊天 Tab 的 Session（kind=chat）在频道中不显示

### 决策 3：消息气泡样式切换

**结论：频道版块使用 IM 风格气泡，聊天 Tab 保持现有样式。**

两套样式共存：
- `.message-list`（聊天 Tab）— 现有左对齐气泡
- `.channel-message-list`（频道 Tab）— IM 左右分列气泡

---

## 七、风险与应对

| 风险 | 应对 |
|------|------|
| 群聊多 Agent 串行回复延迟高 | 首期限制群内 Agent 数量 ≤ 5，后续改并行 |
| 共享 Session 导致 token 溢出 | 群聊用 kind=channel 独立 Session，不影响主聊天 |
| localStorage 持久化群组信息可能丢失 | 群组数据轻量，丢失后可重新拉群（非关键数据） |
| 现有 bridge 不支持 kind 参数创建 Session | 需补全 createSession 的 kind 参数传递 |
| @提及需要前端解析消息文本 | 首期用简单正则匹配 `@AgentName`，后续改结构化 |

---

## 八、与已有工单的关系

| 已有工单 | 关系 |
|----------|------|
| 150 (UX 补全) | 150 已完成 Wave 1-2，频道版块在 150 基础上继续 |
| 151 (Cron/Heartbeat) | 151 已完成，频道版块复用其 Toast 系统 |
| 152 (UX 打磨) | 152 已完成 emoji→SVG、频率预设等，频道版块直接复用 |
| 149 (Contract 收敛) | 已完成，频道版块依赖其统一的 bridge API |

---

## 九、工单执行顺序

```
153-A1 ── 153-A2 ── 153-A3 ── 153-A4 ── 153-A5
                                            │
                              153-B1 ── 153-B2 ── 153-B3 ── 153-B4
                                                                │
                                            153-C1 ── 153-C2 ── 153-C3 ── 153-C4
                                                                              │
                                                        153-D1 ── 153-D2 ── 153-D3
```

每个工单独立提交、独立验收、可随时暂停。

---

## 十、总预估

| Wave | 工单数 | 预估 |
|------|--------|------|
| A（骨架+私聊） | 5 | 4.5d |
| B（群聊） | 4 | 4.5d |
| C（体验增强） | 4 | 3d |
| D（高级功能） | 3 | 4.5d |
| **合计** | **16** | **16.5d** |
