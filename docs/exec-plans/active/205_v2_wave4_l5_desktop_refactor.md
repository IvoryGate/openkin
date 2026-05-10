# 205 — Wave 4: L5 Desktop Client 重构

> **状态**：📋 待执行
> **模式**：high-capability mode 定方案 → budget mode 执行
> **父单**：200
> **前置**：204（L4 Product Shell）
> **分支**：`explore/v2-agent-driven-cicd`
> **目的**：彻底重构 Desktop 客户端，从单体到模块化，复用 L4 产品语义

---

## 一、目标

1. **删除 app.js**：从 5438 行单体迁移到模块化架构
2. **复用 L4 语义**：Desktop 不再自建 context/memory/approval/background 产品面
3. **统一 HTTP 客户端**：收敛到 `sdk/client` 和 `sdk/operator-client`
4. **事件总线**：模块间通过事件总线通信，替代 `window.*` 全局

---

## 二、架构设计

### 2.1 目录结构

```
apps/desktop/renderer/
├── index.html                  # 精简入口
├── main.js                     # 应用入口（≤ 300 行）
├── styles/
│   ├── variables.css           # CSS 变量
│   ├── layout.css              # 壳布局
│   ├── chat.css                # 聊天模块样式
│   ├── channel.css             # 频道模块样式
│   ├── settings.css            # 设置模块样式
│   └── components.css          # 通用组件样式
├── infra/                      # 基础设施层
│   ├── bridge.js               # desktopBridge 统一封装
│   ├── api-client.js           # HTTP/SSE 客户端（复用 sdk/client）
│   ├── event-bus.js            # 模块间通信
│   ├── storage.js              # localStorage 封装
│   ├── toast.js                # Toast 系统
│   ├── markdown.js             # Markdown 渲染器
│   └── utils.js                # 工具函数
├── modules/                    # 领域模块层
│   ├── chat/
│   │   ├── index.js            # 模块入口
│   │   ├── state.js            # 状态管理
│   │   ├── ui.js               # DOM 渲染
│   │   ├── composer.js         # 输入框/工具栏
│   │   ├── message-list.js     # 消息列表
│   │   └── session-list.js     # 会话列表
│   ├── channel/
│   │   ├── index.js
│   │   ├── state.js
│   │   ├── ui.js
│   │   ├── dm.js
│   │   ├── group.js
│   │   └── composer.js
│   ├── settings/
│   │   ├── index.js
│   │   ├── state.js
│   │   ├── ui.js
│   │   └── agent-editor.js
│   ├── right-panel/            # 右侧面板（保留已有实现）
│   │   ├── index.js
│   │   ├── CandidateCard.js
│   │   ├── CaptureBox.js
│   │   ├── FrozenSection.js
│   │   └── RightPanel.js
│   └── product/                # NEW: 复用 L4 产品语义
│       ├── context-panel.js    # 上下文工程面板
│       ├── memory-panel.js     # 记忆面板
│       ├── approval-panel.js   # 审批面板
│       └── background-panel.js # 后台运行面板
└── components/                 # 纯组件层
    ├── avatar.js
    ├── badge.js
    ├── button.js
    ├── modal.js
    └── empty-state.js
```

### 2.2 模块接口

```javascript
// 每个模块统一接口
export function init(options) { /* 初始化 */ }
export function mount(container) { /* 挂载到 DOM */ }
export function unmount() { /* 卸载 */ }
export function activate() { /* 激活 */ }
export function deactivate() { /* 失活 */ }
export function getState() { /* 获取状态快照 */ }
```

### 2.3 事件总线

```javascript
// infra/event-bus.js
class EventBus {
  constructor() {
    this.listeners = new Map()
  }
  
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(callback)
    return () => this.off(event, callback)
  }
  
  off(event, callback) {
    this.listeners.get(event)?.delete(callback)
  }
  
  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => cb(data))
  }
}

export const eventBus = new EventBus()

// 事件类型
const Events = {
  SESSION_CHANGED: 'session:changed',
  MESSAGE_RECEIVED: 'message:received',
  RUN_STARTED: 'run:started',
  RUN_COMPLETED: 'run:completed',
  APPROVAL_PENDING: 'approval:pending',
  APPROVAL_RESOLVED: 'approval:resolved',
  BACKGROUND_RUN_UPDATED: 'background:run_updated',
  SETTINGS_CHANGED: 'settings:changed',
}
```

### 2.4 API 客户端统一

```javascript
// infra/api-client.js
import { createTheWorldClient } from '@theworld/sdk/client'
import { createOperatorClient } from '@theworld/sdk/operator-client'

const baseUrl = await resolveDesktopBridge()
const apiKey = localStorage.getItem('apiKey')

export const client = createTheWorldClient({ baseUrl, apiKey })
export const operatorClient = createOperatorClient({ baseUrl, apiKey })

// 所有模块统一使用这两个客户端
// 不再直接 fetch，不再硬编码路由
```

---

## 三、产品面板设计

### 3.1 Context Panel

```
┌─────────────────────────┐
│ Context Engineering     │
├─────────────────────────┤
│ Tokens: 2.3k / 4k       │
│ Blocks: 4               │
│                         │
│ [system] immutable      │
│ [memory] pinned (3 msg) │
│ [history] compressible  │
│ [recent] pinned (6 msg) │
│                         │
│ Compact: -1.2k tokens   │
│ Dropped: [history]      │
│                         │
│ [Compact Now]           │
└─────────────────────────┘
```

### 3.2 Memory Panel

```
┌─────────────────────────┐
│ Memory Layers           │
├─────────────────────────┤
│ Working: 12 messages    │
│ Summary: 3 memories     │
│ Long-term: 0 memories   │
│                         │
│ Recent Memories:        │
│ • Project setup (skill) │
│ • API design (session)  │
│ • User preferences      │
│                         │
│ [Summarize] [Pin]       │
└─────────────────────────┘
```

### 3.3 Approval Panel

```
┌─────────────────────────┐
│ Pending Approvals (2)   │
├─────────────────────────┤
│ run_command             │
│ Risk: shell_command     │
│ [Approve] [Deny]        │
│                         │
│ write_file              │
│ Risk: file_mutation     │
│ [Approve] [Deny]        │
│                         │
│ Mode: confirm           │
│ [Change Mode]           │
└─────────────────────────┘
```

### 3.4 Background Panel

```
┌─────────────────────────┐
│ Background Runs (1)     │
├─────────────────────────┤
│ Run: trace-xxx          │
│ Status: running         │
│ Step: 3/6               │
│                         │
│ [Attach] [Interrupt]    │
│                         │
│ Session Runs:           │
│ • trace-aaa (completed) │
│ • trace-bbb (failed)    │
└─────────────────────────┘
```

---

## 四、迁移策略

### 4.1 增量迁移（同 166 方案）

```
Phase A: 基础设施（并行存在）
  - 创建 infra/ 层
  - 创建 modules/ 骨架
  - 创建 styles/ 拆分
  - 旧 app.js 保持不变

Phase B: 逐个模块迁移
  - right-panel（已模块化，调整导入）
  - settings（相对独立）
  - chat（核心功能）
  - channel（最复杂）
  - product panels（新增）

Phase C: 入口切换
  - index.html 切换到 main.js
  - 删除 app.js
```

### 4.2 与 166 的区别

| 维度 | 166（v1 内重构） | 205（v2 重构） |
|------|-----------------|---------------|
| 范围 | 仅 Desktop renderer | Desktop + 复用 L4 语义 |
| 产品语义 | Desktop 自建 | 消费 L4 product/ 接口 |
| API 客户端 | 新建 api-client.js | 统一使用 sdk/client |
| 产品面板 | 无 | 新增 context/memory/approval/background |
| 后端依赖 | 不动 packages/ | 依赖 L1/L3 升级后的新 API |

---

## 五、验收标准

- [ ] `app.js` 已删除
- [ ] `main.js` ≤ 300 行
- [ ] 每个模块 `index.js` ≤ 300 行
- [ ] 无 `window.*` 全局通信
- [ ] 统一使用 `sdk/client` 和 `sdk/operator-client`
- [ ] Context Panel 显示真实上下文数据
- [ ] Memory Panel 显示真实记忆分层
- [ ] Approval Panel 可查看/操作审批
- [ ] Background Panel 显示后台 run 状态
- [ ] 聊天功能完整（会话/消息/流式/审批/取消）
- [ ] 频道功能完整（DM/群聊/发送/接收/设置）
- [ ] `pnpm verify` 通过

---

## 六、不做什么

1. 不改 L1 Core 代码
2. 不改 L3 Service 代码
3. 不改 L4 CLI 代码（只复用产品语义）
4. 不引入前端框架（保持 Vanilla JS）
5. 不改 preload.ts 的 IPC 接口

---

## 七、升级条件

- 需要修改 L1/L3/L4 的已有接口
- sdk/client 不满足 Desktop 需求
- 连续两轮 `pnpm verify` 失败
