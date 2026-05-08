# 151: Cron / Heartbeat / Agent 联动修复

> **状态**：执行中 🔄
> **层级**：L5 Client Surface
> **前置**：150（UX 驱动功能补全 — 已完成 Wave 1-3）
> **原则**：打通 Cron ↔ Agent ↔ Heartbeat 三者的联动闭环，让定时任务不再是黑箱

---

## 一、问题诊断

### 现有联动断裂点

| # | 断裂点 | 严重度 | 现状 | 影响 |
|---|--------|--------|------|------|
| 1 | **创建任务表单字段缺失** | P0 | 前端只传 `{name, triggerType, cronExpression}`，缺 `agentId`、`input`、`triggerConfig` 结构 | 前端创建的任务大概率 400 或执行时无 agent |
| 2 | **Task SSE 事件流未接入** | P0 | 后端 `GET /v1/tasks/events` 已实现，前端未订阅 | 任务完成/失败无法实时感知 |
| 3 | **任务结果无 Toast 通知** | P0 | 即使 SSE 接入，也没有 Toast 展示 | 用户不知道任务是否成功 |
| 4 | **Task Session 对话不可见** | P1 | task run 创建 `kind:'task'` session，但聊天界面无法查看 | 定时任务是黑箱 |
| 5 | **createdBy 无 UI 区分** | P1 | agent 创建的任务和用户创建的任务看起来一样 | 用户无法区分来源 |
| 6 | **Heartbeat 异常无告警** | P2 | 仅被动展示，无主动提醒 | 运维感知延迟 |
| 7 | **Webhook URL 无法配置** | P2 | 后端支持但前端无 UI | 外部集成断裂 |

### 修复优先级与依赖关系

```
P0-A (创建表单修复) ──→ P0-B (Task SSE 订阅) ──→ P0-C (Toast 通知)
                                                    │
P1-A (Task Session 跳转) ───────────────────────────┘
P1-B (createdBy 区分) ──────────────────────────────┘

P2-A (Heartbeat 告警) ──→ P2-B (Webhook UI)
```

---

## 二、工单拆分

### P0-A：修复创建任务表单

**目标**：让前端创建的任务能被后端正确接收和执行。

**现状问题**：
```javascript
// 当前代码（app.js L3421）
await desktopBridge.task.createTask(activeBaseUrl, {
  name: name.trim(),
  triggerType: "cron",
  cronExpression: cronExpr.trim()  // ❌ 字段名错误
}, apiKey)
```

**后端要求**（`CreateTaskRequest` in shared-contracts）：
```typescript
{
  name: string                     // ✅ 已有
  triggerType: TaskTriggerTypeDto  // ✅ 已有，但只支持 cron
  triggerConfig: Record<string, unknown>  // ❌ 缺失，应为 { cron: "..." }
  agentId: string                  // ❌ 缺失
  input: RunInputDto               // ❌ 缺失，应为 { text: "..." }
  enabled?: boolean                // 可选
  createdBy?: 'user' | 'agent'    // 可选
}
```

**修改方案**：
1. 将 `window.prompt` 创建方式改为**内联表单**（在 cron flyout 内部）
2. 表单字段：
   - 任务名称（text input）
   - 触发类型选择器（cron / interval / once，下拉）
   - 触发配置（根据类型动态切换：cron 表达式 / 间隔秒数 / 一次性时间戳）
   - Agent 选择器（下拉，从已有 agent 列表选择）
   - 任务指令文本（textarea，即 `input.text`）
   - 启用开关（checkbox，默认启用）
3. 修正 `triggerConfig` 结构：`{ cron: "..." }` / `{ interval_seconds: N }` / `{ once_at: T }`

**涉及文件**：
- `apps/desktop/renderer/index.html` — 添加创建表单 DOM
- `apps/desktop/renderer/styles.css` — 表单样式
- `apps/desktop/renderer/app.js` — 表单逻辑 + 提交

---

### P0-B：前端订阅 Task SSE 事件流

**目标**：实时感知任务完成/失败事件。

**后端已实现**：
- `GET /v1/tasks/events` — SSE 端点
- `TaskEventBus` — 进程内事件总线
- `EventPlaneEnvelopeV1` 格式，`domain: 'task'`，`kind: 'task_run_finished'`
- `TaskRunEventDto` 包含：taskId, taskName, runId, sessionId, traceId, status, output, error

**前端需新增**：
1. `http-desktop-bridge.js` — 添加 `subscribeTaskEvents(baseUrl, apiKey, onEvent)` 方法
2. `preload.ts` — 添加 `subscribeTaskEvents` bridge 方法
3. `global.d.ts` — 类型声明
4. `app.js` — 在应用启动时订阅 task events，分发事件

**SSE 解析**：
- 复用已有的 `parseSseStream` 函数
- 需 import `apiPathTaskEvents` from shared-contracts
- 事件格式：`event: task` / `data: { v:1, domain:"task", kind:"task_run_finished", payload:{...} }`

---

### P0-C：Task 完成失败 Toast 通知

**目标**：任务完成/失败时在客户端弹出 Toast 通知。

**修改方案**：
1. 在 `index.html` 添加 Toast 容器（fixed 定位，右上角）
2. `styles.css` 添加 Toast 样式（成功绿色、失败红色、自动消失动画）
3. `app.js`：
   - 接收 P0-B 中的 task event
   - 弹出 Toast：`✅ 定时任务 "XX" 执行完成` 或 `❌ 定时任务 "XX" 执行失败：...`
   - 点击 Toast 可跳转到 cron 面板或 task session
4. 可选：Electron `Notification` API 发系统级通知

---

### P1-A：Task Run → Session 消息历史跳转

**目标**：让用户能查看定时任务执行时 agent 的完整对话过程。

**后端已有**：
- `task_runs` 表记录 `sessionId` 和 `traceId`
- `GET /v1/sessions/:id/messages` 可查询 task session 的消息
- `GET /v1/runs/:traceId` 可查看 trace 详情

**修改方案**：
1. Cron 面板的 task run 历史中，每个 run 条目增加「查看详情」按钮
2. 点击后：
   - 方案 A：在 cron flyout 内展开 run 详情面板，展示 agent 消息历史
   - 方案 B：切换到聊天界面，加载该 task session 的消息（更直观）
3. 选择方案 B（复用已有聊天界面）：
   - 将 task session 也加入会话列表（标记为 `kind: task`，特殊图标）
   - 点击 task run 的「查看详情」→ 切换到对应 session → 加载消息

**涉及文件**：
- `app.js` — task run 跳转逻辑 + task session 渲染
- `http-desktop-bridge.js` / `preload.ts` — 确保getSessionMessages 支持 task session

---

### P1-B：区分 createdBy (user/agent) 的 UI 标识

**目标**：让用户一眼区分 agent 自己创建的定时任务和用户手动创建的。

**修改方案**：
1. Task 列表项增加来源标识：
   - `createdBy: 'agent'` → 显示 🤖 图标 + "Agent 创建"
   - `createdBy: 'user'` → 显示 👤 图标 + "手动创建"
2. 可选：不同来源用不同底色或左边框色区分

---

### P2-A：Heartbeat 异常自动告警

**目标**：当 scheduler stale 或 heartbeat 超时时主动提醒用户。

**修改方案**：
1. 在 `refreshSystemStatus` 中检测异常：
   - scheduler stale → 自动弹出 cron 面板
   - heartbeat 超时 → Toast 告警 `⚠️ 调度器心跳异常`
2. 防抖：30 秒内不重复告警

---

### P2-B：Webhook URL 配置 UI

**目标**：任务创建/编辑时可配置 webhook 回调地址。

**修改方案**：
1. 创建表单增加「Webhook URL」可选输入框
2. 任务列表中显示 webhook 图标标识
3. `createTask` payload 中传入 `webhookUrl`

---

## 三、验收标准

1. **前端创建的任务能成功执行**：填完表单 → 提交 → 任务列表出现 → 等待触发 → agent 执行
2. **任务完成实时通知**：执行完成后 3 秒内 Toast 弹出
3. **Task Session 可查看**：点击 run 历史 → 跳转到 agent 对话
4. **来源可区分**：列表中 agent 创建和用户创建的任务有明显标识
5. **pnpm verify 通过**

---

## 四、与已有工单的关系

| 已有工单 | 与 151 关系 |
|----------|------------|
| 150 (UX 功能补全) | 150 已完成 Wave 1-3，151 专注 Cron/Heartbeat/Agent 联动 |
| 026 (Task Notifications) | 后端已实现，151 补前端 SSE 订阅 + Toast |
| 149 (Contract 收敛) | 149 确保 shared-contracts 就绪，151 消费其 DTO |
