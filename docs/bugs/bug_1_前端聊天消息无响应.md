# Bug #1：前端聊天页发送消息无响应

- **发现时间**：2026-03-28  
- **严重程度**：P0（核心功能不可用）  
- **影响范围**：浏览器开发模式下聊天页全部发送操作  
- **修复时间**：2026-03-28  
- **修复提交**：`45e7a3d fix: dev mock WS chat + message update logic`

---

## 一、现象描述

在浏览器开发模式（`http://localhost:5173`）下，进入聊天页 `/chat/:agentId`：

1. 输入框可以填写内容
2. 点击"发送消息"按钮后，用户消息气泡出现
3. 助手消息区域出现空气泡（streaming 占位）
4. **等待超过 30 秒，没有任何 token 流入，AI 不回复**
5. 无任何错误提示

后端 WebSocket 服务完全正常（通过 Node.js 脚本和浏览器原生 WS 直连均验证通过）。

---

## 二、排查过程

### 2.1 确认后端正常

```bash
node tests/script/ws_chat_test.mjs agt_fnp7k4Bh
# 输出：收到完整流式回复，11 个 token，done
```

### 2.2 浏览器内直连 WS 验证

在浏览器控制台直接创建 WebSocket 连接并发送消息，收到了完整的 token 流：

```js
var ws = new WebSocket('ws://127.0.0.1:7788/ws/chat')
ws.onopen = () => ws.send(JSON.stringify({...}))
ws.onmessage = (e) => console.log(JSON.parse(e.data))
// 正常收到 token:Hello, token:!, ..., done
```

→ **确认：WS 后端和浏览器 WS API 均正常。**

### 2.3 手动调用 `window.electronAPI.chat.send`

```js
window.electronAPI.chat.onToken(d => console.log('token', d.content))
window.electronAPI.chat.onDone(d => console.log('done'))
window.electronAPI.chat.send({agentId:'agt_fnp7k4Bh', message:'hi', sessionId:'test', history:[]})
// 正常收到 token 流
```

→ **Mock 本身（修复后）可以工作。**

### 2.4 发现 Bug 1：Mock 中 `chat.send` 是空实现

定位到 `src/renderer/main.tsx` 中的浏览器开发 mock：

```ts
// 修复前：
chat: {
  send: () => Promise.resolve(),   // ← 什么都不做！
  onToken: () => () => {},          // ← 永远不触发
  onDone: () => () => {},
  onError: () => () => {},
},
```

`send` 只是 `Promise.resolve()`，没有建立任何 WebSocket 连接，消息根本没有发出去。

### 2.5 发现 Bug 2：`ChatPage.tsx` 中 messageId 不匹配

即使修复了 Bug 1，`ChatPage.tsx` 里 `onToken` 回调的 token 更新逻辑还有问题：

```ts
// 修复前：
const msg = currentMessages.find((m) => m.id === data.messageId)
// data.messageId 是后端返回的 "msg_xxxxxxxx" 格式
// 而 store 里的消息 id 是前端生成的 "timestamp-random" 格式
// → 永远找不到，UI 永远不更新
```

---

## 三、根本原因

| # | 位置 | 原因 |
|---|------|------|
| 1 | `src/renderer/main.tsx` | 浏览器开发 mock 中 `chat.send` 是空操作，没有建立 WebSocket 连接 |
| 2 | `src/renderer/pages/Chat/ChatPage.tsx` | `onToken` 回调用后端分配的 `messageId`（`msg_xxx`）去查找消息，而前端消息 ID 是本地生成的 `timestamp-random`，两者永远不匹配 |

---

## 四、修复方案

### Fix 1：重写 `main.tsx` 中的 chat mock

`chat.send` 建立真实 WebSocket 连接，通过全局监听器数组分发事件：

```ts
// src/renderer/main.tsx
const tokenListeners: TokenCb[] = []
const doneListeners: DoneCb[] = []
const errorListeners: ErrorCb[] = []

chat: {
  send: (params) => new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:7788/ws/chat`)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'chat', ...params }))
      resolve()
    }
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'token') tokenListeners.forEach(cb => cb({...}))
      else if (msg.type === 'done') { doneListeners.forEach(cb => cb({...})); ws.close() }
      else if (msg.type === 'error') { errorListeners.forEach(cb => cb({...})); ws.close() }
    }
    ws.onerror = () => reject(new Error('WebSocket connection failed'))
  }),
  onToken: (cb) => { tokenListeners.push(cb); return () => { /* remove */ } },
  onDone:  (cb) => { doneListeners.push(cb);  return () => { /* remove */ } },
  onError: (cb) => { errorListeners.push(cb); return () => { /* remove */ } },
}
```

### Fix 2：修改 `ChatPage.tsx` token 更新逻辑

不依赖 `messageId` 匹配，降级为找最后一条 `streaming` 状态的 assistant 消息：

```ts
// src/renderer/pages/Chat/ChatPage.tsx
const msg = currentMessages.find((m) => m.id === data.messageId)
  ?? [...currentMessages].reverse().find((m) => m.role === 'assistant' && m.status === 'streaming')
if (msg) {
  updateMessage(msg.id, { content: msg.content + (data.content || '') })
}
```

`onDone` 和 `onError` 也同步应用相同的降级策略。

### 顺带修复

- `chatStore.sendMessage`：携带历史消息传给后端（之前硬编码 `history: []`）
- `src/main/index.ts`：IPC `chat:send` handler 透传 `history` 参数
- `src/preload/index.ts` + `electronAPI.d.ts`：类型定义同步加上 `history?` 字段

---

## 五、验证

修复后通过浏览器操作验证：

1. 引导流程全程走通（配置 API Key → 创建 Agent → 进入聊天页）
2. 在聊天页发送"你好，用一句话介绍你自己"
3. 收到流式回复："你好！我是一个全能型AI助手，友好高效，能帮你解答问题、处理任务，让生活更轻松～"
4. 连续发送多轮对话，均正常响应

---

## 六、经验教训

1. **Mock 需要真实模拟行为**，不能用空函数糊弄。尤其是异步 IO（WS、IPC）相关的 mock，空实现会导致沉默失败，极难排查。
2. **前后端 ID 命名空间要统一**。前端本地生成的 ID 和后端分配的 ID 混用，必然导致匹配失败。应在设计阶段约定好 `messageId` 的归属方（前端生成并随请求传给后端，后端回显同一 ID）。
3. **排查策略**：遇到前端无响应时，先用原生 API 逐层验证（后端 → WS 直连 → mock 手动调用 → React 组件），快速缩小范围。
