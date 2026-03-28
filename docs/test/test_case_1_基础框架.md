# 测试用例文档 - 迭代一：基础框架搭建

**迭代轮数**：1  
**测试范围**：引导流程、API Key 配置、Agent 创建、Soul.md 系统、基础对话  
**测试框架**：Vitest（单元/集成）+ Playwright（UI E2E）  
**状态**：设计中

---

## 1. 测试范围矩阵

| 测试模块 | 单元测试 | 集成测试 | E2E 测试 |
|---------|---------|---------|---------|
| SoulService（解析/生成） | ✅ | — | — |
| ConfigService（加密/解密） | ✅ | — | — |
| AgentService（CRUD） | ✅ | ✅ | — |
| ChatService（流式对话） | ✅ | ✅ | — |
| 后端 HTTP 接口 | — | ✅ | — |
| 后端 WebSocket 对话 | — | ✅ | — |
| 引导流程（UI） | — | — | ✅ |
| 主界面对话（UI） | — | — | ✅ |

---

## 2. 单元测试用例

### 2.1 SoulService 测试

**测试文件**：`tests/script/test_soul_service.ts`

#### TC-U-001：生成 Soul.md 内容格式正确

```
前置条件：无
输入：
  name: "技术助手"
  role: "技术专家"
  description: "专注于编程和系统设计"
  systemPrompt: "你是一个资深技术专家"
  communicationStyle: "严谨专业"
预期结果：
  - 输出的 Markdown 包含 "## 基本信息" 章节
  - 包含 "名称: 技术助手"
  - 包含 "## 系统提示词" 章节
  - 包含 "你是一个资深技术专家"
```

#### TC-U-002：解析 Soul.md 提取 systemPrompt

```
前置条件：有效的 Soul.md 文本
输入：标准 Soul.md Markdown 文本
预期结果：
  - parseSoul().systemPrompt === 指定的 systemPrompt 内容
  - parseSoul().name === "技术助手"
```

#### TC-U-003：解析不完整 Soul.md 不抛异常

```
前置条件：无
输入：只有标题行的最小 Soul.md（缺少各 section）
预期结果：
  - parseSoul() 不抛出异常
  - systemPrompt 返回空字符串
  - name 返回空字符串
```

#### TC-U-004：Soul.md 往返（生成→解析）一致性

```
前置条件：无
输入：完整参数对象
预期结果：
  generateSoulMd(params) → parseSoul(result).systemPrompt === params.systemPrompt
```

---

### 2.2 ConfigService 测试

**测试文件**：`tests/script/test_config_service.ts`

#### TC-U-010：API Key 加密后不可直读

```
前置条件：无
输入：plaintext = "sk-test123456"
操作：encrypted = configService.encrypt(plaintext)
预期结果：
  - encrypted !== plaintext
  - encrypted 不包含 "sk-test" 子串
```

#### TC-U-011：加密解密往返一致

```
前置条件：无
输入：plaintext = "sk-test123456"
操作：configService.decrypt(configService.encrypt(plaintext))
预期结果：返回值 === "sk-test123456"
```

#### TC-U-012：不同内容加密结果不同

```
前置条件：无
输入：text1 = "key-aaa"，text2 = "key-bbb"
预期结果：encrypt(text1) !== encrypt(text2)
```

#### TC-U-013：空字符串加密不报错

```
前置条件：无
输入：""
预期结果：encrypt("") 不抛出异常，decrypt(encrypt("")) === ""
```

---

### 2.3 AgentService 测试

**测试文件**：`tests/script/test_agent_service.ts`

#### TC-U-020：创建 Agent 返回正确结构

```
前置条件：临时测试目录
输入：{ name: "测试Agent", role: "助手", templateId: "general" }
预期结果：
  - 返回对象包含 id（格式 "agt_xxxxxxxx"）
  - 返回对象包含 createdAt（ISO 8601 格式）
  - ~/{testDir}/agents/{id}/soul.md 文件存在
  - ~/{testDir}/agents/{id}/meta.json 文件存在
```

#### TC-U-021：创建 Agent 名称为空时报错

```
前置条件：无
输入：{ name: "" }
预期结果：抛出包含 "name" 的 ValidationError
```

#### TC-U-022：创建 Agent 名称超长时报错

```
前置条件：无
输入：{ name: "a".repeat(51) }
预期结果：抛出 ValidationError
```

#### TC-U-023：查询不存在的 Agent 返回 null

```
前置条件：无
输入：agentId = "agt_notexist"
预期结果：getAgent("agt_notexist") 返回 null（不抛出异常）
```

#### TC-U-024：列出所有 Agent

```
前置条件：已创建 2 个 Agent
预期结果：listAgents() 返回长度 2 的数组，包含两个 Agent
```

---

## 3. 集成测试用例

### 3.1 后端 HTTP 接口集成测试

**测试文件**：`tests/script/test_api_agents.ts`

测试前启动 Hono 测试服务器（使用 Hono 的 `app.request()` 直接调用，不需要真实 HTTP 端口）。

#### TC-I-001：POST /api/agents - 成功创建

```
请求：POST /api/agents
Body：{ "name": "集成测试Agent", "templateId": "general" }
预期：
  - 状态码 201
  - body.data.id 匹配 /^agt_/
  - body.data.name === "集成测试Agent"
```

#### TC-I-002：POST /api/agents - 参数缺失

```
请求：POST /api/agents
Body：{} （缺少 name）
预期：
  - 状态码 400
  - body.error.code === "VALIDATION_ERROR"
```

#### TC-I-003：GET /api/agents - 列出 Agent

```
前置：已创建 1 个 Agent
请求：GET /api/agents
预期：
  - 状态码 200
  - body.data 为数组，长度 >= 1
  - body.total >= 1
```

#### TC-I-004：GET /api/agents/:id/soul - 获取 Soul.md

```
前置：已创建 Agent（id = agt_xxx）
请求：GET /api/agents/agt_xxx/soul
预期：
  - 状态码 200
  - body.data.content 包含 "# Agent 个性配置"
```

#### TC-I-005：PUT /api/agents/:id/soul - 更新 Soul.md

```
前置：已创建 Agent（id = agt_xxx）
请求：PUT /api/agents/agt_xxx/soul
Body：{ "content": "# Updated\n\n## 基本信息\n- 名称: 更新后" }
预期：
  - 状态码 200
  - body.data.ok === true
  - 文件内容已更新（再次 GET soul 验证）
```

#### TC-I-006：POST /api/config/validate-key - 无效 Key

```
请求：POST /api/config/validate-key
Body：{ "type": "openai", "key": "sk-invalid-key-xxx" }
预期：
  - 状态码 200
  - body.data.ok === false
  - body.data.error 包含错误描述
```

---

### 3.2 WebSocket 对话集成测试

**测试文件**：`tests/script/test_websocket_chat.ts`

> ⚠️ 此测试需要有效的 OpenAI API Key，通过环境变量 `TEST_OPENAI_KEY` 传入。  
> 若未配置，此测试自动跳过（`test.skipIf(!process.env.TEST_OPENAI_KEY)`）。

#### TC-I-010：WebSocket 建立连接

```
操作：new WebSocket("ws://127.0.0.1:{port}/ws/chat")
预期：连接状态在 3 秒内变为 OPEN
```

#### TC-I-011：发送消息并接收流式 token

```
前置：WebSocket 已连接，有效 Agent 已创建
发送：
  {
    "type": "chat",
    "agentId": "agt_xxx",
    "sessionId": "sess_test",
    "message": "用一句话回答：1+1等于几？",
    "history": []
  }
预期：
  - 在 15 秒内收到至少 1 条 type=token 消息
  - 最终收到 1 条 type=done 消息
  - 所有 token 内容拼接后包含数字 "2"
```

#### TC-I-012：无效 agentId 返回错误

```
发送：{ "type": "chat", "agentId": "agt_notexist", ... }
预期：
  - 收到 type=error 消息
  - error.code === "AGENT_NOT_FOUND"
```

---

## 4. E2E 测试用例（Playwright）

**测试文件**：`tests/script/test_ui_onboarding.ts`

> E2E 测试使用 Playwright 驱动 Electron 应用，需要在安装完整依赖后运行。

### 4.1 引导流程测试

#### TC-E-001：首次启动显示引导页面

```
前置：删除 ~/.openkin/config.json（清空初始化状态）
操作：启动应用
预期：
  - 显示 "欢迎使用 OpenKin" 文本
  - 显示进度步骤指示器（Step 1/4）
  - [开始配置] 按钮可见
```

#### TC-E-002：API Key 配置步骤 - 跳过

```
前置：应用在引导 Step 1
操作：
  1. 点击 [开始配置]
  2. 在 Step 2 不输入任何内容，点击 [跳过]
预期：
  - 进入 Step 3（创建 Agent）
  - 显示跳过提示（"API Key 未配置，功能受限"）
```

#### TC-E-003：创建 Agent - 完整流程

```
前置：应用在引导 Step 3
操作：
  1. 在名称输入框输入 "我的测试助手"
  2. 点击 "通用助手" 模板卡片
  3. 点击 [创建并开始]
预期：
  - 进入 Step 4（完成页）
  - 显示 "技术助手已就绪" 或类似文本
  - [开始对话] 按钮可见
```

#### TC-E-004：创建 Agent - 名称为空时不可提交

```
前置：应用在引导 Step 3
操作：不输入名称，直接点击 [创建并开始]
预期：
  - 表单显示错误提示："名称不能为空"
  - 不跳转到下一步
```

#### TC-E-005：完成引导后进入主界面

```
前置：完成引导流程（TC-E-003 后）
操作：点击 [开始对话]
预期：
  - 跳转到 /chat 路由
  - 侧边栏显示刚创建的 Agent 名称 "我的测试助手"
  - 消息输入框可见
```

---

### 4.2 主界面对话测试

**测试文件**：`tests/script/test_ui_chat.ts`

#### TC-E-010：发送消息后显示加载状态

```
前置：已完成引导，在对话主界面（已配置有效 API Key）
操作：在输入框输入 "你好"，按回车
预期：
  - 用户消息气泡出现在消息列表
  - 出现 Agent 思考中动画（三点跳动）
  - 发送按钮变为禁用状态
```

#### TC-E-011：收到 Agent 回复后动画消失

```
前置：TC-E-010 完成，等待回复
操作：等待最多 15 秒
预期：
  - 三点跳动动画消失
  - Agent 消息气泡出现，包含非空文本
  - 发送按钮恢复可用
```

#### TC-E-012：Markdown 渲染正常

```
前置：在对话主界面
操作：发送 "用 markdown 格式列出3个水果，用 - 开头"
预期（等待回复后）：
  - 回复中 "- 苹果"（或其他水果）被渲染为 <li> 元素
  - 不显示原始 Markdown 符号 "- "
```

#### TC-E-013：Soul.md 编辑器可打开

```
前置：在对话主界面
操作：点击右上角设置图标
预期：
  - 跳转到 /settings/{agentId} 页面
  - 显示 Agent 名称
  - 显示 Soul.md 编辑表单，各字段有默认值
```

---

## 5. 测试执行说明

### 5.1 运行单元测试 & 集成测试

```bash
# 安装依赖（首次）
npm install

# 运行所有 Vitest 测试
npm test

# 运行特定测试文件
npx vitest run tests/script/test_soul_service.ts
```

### 5.2 运行 E2E 测试

```bash
# 安装 Playwright 浏览器（首次）
npx playwright install

# 构建应用后运行 E2E（需要有效 API Key）
TEST_OPENAI_KEY=sk-xxx npm run test:e2e
```

### 5.3 测试环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `TEST_OPENAI_KEY` | 否 | 有效 OpenAI Key，用于 WebSocket 对话集成测试和 E2E 对话测试 |
| `TEST_DATA_DIR` | 否 | 测试临时目录，默认 `os.tmpdir()/openkin-test` |

---

## 6. 测试通过标准

迭代一完成的测试验收条件：

- [ ] 所有单元测试（TC-U-*）**100% 通过**
- [ ] 所有集成测试（TC-I-001 ~ TC-I-006）**100% 通过**
- [ ] TC-I-010 ~ TC-I-012 在配置 `TEST_OPENAI_KEY` 时 **100% 通过**
- [ ] 所有 E2E 测试（TC-E-001 ~ TC-E-005）**100% 通过**（不依赖 API Key）
- [ ] TC-E-010 ~ TC-E-013 在配置 `TEST_OPENAI_KEY` 时 **100% 通过**
- [ ] 无任何 `console.error` 未处理异常输出

---

*文档版本：1.0 | 创建日期：2026-03-28*
