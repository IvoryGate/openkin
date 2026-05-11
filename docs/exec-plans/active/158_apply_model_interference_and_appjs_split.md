# 158: Apply Model 干扰规避 + app.js 模块拆分

## 问题背景

### 问题一：Apply Model 干扰

**现象**：使用 `string_replace` 工具编辑大文件时，apply model（中间验证/应用层）会对编辑结果进行"模糊重排"，导致：
- 非目标的格式变更（缩进风格统一化、换行合并、注释删减）
- 已写好的代码被意外改写
- 每次 apply 后需要人工检查并修复，造成大量返工

**根因**：apply model 对大文件（>500行）进行 diff 应用时，倾向于"规范化"整个文件而非精确替换。文件越大，干扰范围越广。

**量化影响**：在本轮开发中，discussion-engine.js 的 Prompt 升级编辑被 apply model 改动了约 30+ 处非目标区域，耗费额外 2-3 轮检查修复。

### 问题二：app.js 过大

**现状**：
- `app.js`：5,412 行，205KB
- 单文件包含 60+ 个函数、10+ 个功能域
- 每次编辑需读取整个文件，token 消耗巨大
- apply model 干扰概率与文件大小正相关

## 解决方案

### 一、Apply Model 规避策略

#### 开发规则（写入 AGENTS.md 或工程规范）

1. **优先编辑小文件**：单文件控制在 500 行以内，超出的必须拆分
2. **创建新文件代替编辑大文件**：新功能放入独立文件，通过 import/window 接口接入
3. **批量编辑用 MultiEdit 而非多次 string_replace**：减少 apply 次数
4. **编辑前先读取目标区域**：确保 old_string 精确匹配，减少模糊匹配概率
5. **每次编辑后立即验证**：用 `node -c` 检查语法，用 `read_file` 确认目标区域

#### 技术规避

1. 拆分大文件（根本性解决）
2. 对必须保留的大文件，使用"提取函数到新文件 → 替换为 import"的两步策略
3. 如果 apply model 产生干扰，立即重新读取文件并重做编辑

### 二、app.js 模块拆分计划

#### 当前功能域分析

| 功能域 | 行范围 | 大约行数 | 拆分目标 |
|--------|--------|----------|----------|
| 常量与配置 | 1-330 | 330 | `config.js` |
| 设置持久化 | 333-370 | 40 | `settings-persistence.js` |
| Run Artifacts | 372-497 | 125 | `run-artifacts.js` |
| 工具函数 | 498-690 | 190 | `utils.js` |
| 审批流程 | 721-812 | 90 | `approval-poll.js` |
| Run 流处理 | 773-945 | 170 | `run-stream.js` |
| 设置 UI | 947-1417 | 470 | `settings-ui.js` |
| Composer 工具栏 | 1308-1417 | 110 | `composer-toolbar.js` |
| 面板调整 | 1418-1492 | 75 | `pane-resizer.js` |
| 会话列表渲染 | 1493-2000 | 500+ | `session-list.js` |
| 消息渲染 | 2000-3000 | 1000+ | `message-renderer.js` |
| 系统状态/心跳 | 3700-3942 | 240 | `system-status.js` |
| **频道功能** | **3943-5412** | **1470** | 多个频道子模块 |

#### 拆分优先级

**第一批（最高优先级，收益最大）**：

1. **`channel-core.js`** — 频道核心：会话管理、消息存储、颜色、格式化（约 200 行）
   - `getAgentColor`, `loadChannelConversations`, `persistChannelConversations`
   - `loadChannelMessages`, `persistChannelMessages`, `getChannelMsgId`
   - `formatChatTime`, `shouldShowTimeDivider`, `formatDividerTime`, `formatRelativeTime`

2. **`channel-render.js`** — 频道渲染：联系人列表、消息列表（约 500 行）
   - `renderChannelContactList`, `renderContactItem`
   - `renderChannelMessages`（原始版，被 discussion-engine 覆盖）

3. **`channel-send.js`** — 频道发送：DM 发送、群组发送、@提及（约 400 行）
   - `sendChannelDmMessage`, `sendChannelGroupMessage`, `sendChannelMessage`
   - `scheduleGroupStreamingRender`, `isSkipResponse`
   - `openAtPopup`, `renderAtPopupList`, `parseAtMentions`, 等

4. **`channel-group.js`** — 群组管理：创建群、群信息面板、群设置（约 400 行）
   - `openCreateGroupModal`, `renderCreateGroupAgentPicker`
   - `renderGroupCompositeAvatar`, `renderGroupInfoPanel`
   - `renderGroupSettingsContent`, `bindGroupSettingsActions`

5. **`markdown-renderer.js`** — Markdown 渲染（约 200 行）
   - `renderMarkdown`, `renderBubbleContent`

**第二批（中优先级）**：

6. **`settings-ui.js`** — 设置界面（约 470 行）
7. **`message-renderer.js`** — 主聊天区消息渲染（约 1000 行）
8. **`session-list.js`** — 会话列表（约 500 行）

**第三批（低优先级）**：

9. **`run-stream.js`** — Run 流处理与审批
10. **`system-status.js`** — 系统状态与心跳
11. **`config.js`** — 常量与配置提取

#### 拆分架构

```
renderer/
├── app.js                    ← 入口，~300行，只做初始化和模块组装
├── config.js                 ← 常量、预设
├── utils.js                  ← escapeHtml, truncateText, 等
├── http-desktop-bridge.js    ← 已有，不变
├── discussion-engine.js      ← 已有，不变
├── discussion-engine.css     ← 已有，不变
├── channel/
│   ├── channel-core.js       ← 数据层：存储、格式化
│   ├── channel-render.js     ← UI渲染
│   ├── channel-send.js       ← 发送逻辑
│   ├── channel-group.js      ← 群组管理
│   └── channel-markdown.js   ← Markdown渲染
├── settings-ui.js            ← 设置面板
├── message-renderer.js       ← 主聊天区
└── session-list.js           ← 会话列表
```

#### 拆分原则

1. **渐进式拆分**：每次只拆一个模块，拆完验证再继续
2. **window 接口不变**：app.js 尾部的 `Object.assign(window, {...})` 保持不变，discussion-engine.js 无需修改
3. **ES Module 导入**：拆出的文件用 `export`，app.js 用 `import` 引入
4. **共享状态通过 app.js 中转**：channel-core.js 管理数据，app.js 创建实例并通过 window 暴露
5. **每次拆分后运行 `node -c` 验证语法**

#### 执行步骤

对于每个模块的拆分：

1. 在 app.js 中标记要拆出的函数范围
2. 创建新文件，将函数复制过去并添加 `export`
3. 在 app.js 中 `import` 新模块
4. 将新模块的导出绑定到 app.js 的局部变量（保持其他代码不变）
5. 更新 `Object.assign(window, ...)` 确保接口完整
6. `node -c` 验证
7. 提交

## 执行状态

- [ ] 第一批拆分：channel-core.js
- [ ] 第一批拆分：channel-render.js
- [ ] 第一批拆分：channel-send.js
- [ ] 第一批拆分：channel-group.js
- [ ] 第一批拆分：channel-markdown.js
- [ ] 更新 index.html
- [ ] 端到端验证
