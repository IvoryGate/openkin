# 测试用例文档 - 迭代四：核心功能完善

**迭代轮数**：4  
**测试范围**：记忆系统、任务调度、工具库扩展、用户画像系统  
**测试框架**：Vitest（单元/集成）+ Playwright（UI E2E）  
**状态**：设计中

---

## 1. 测试范围矩阵

| 测试模块 | 单元测试 | 集成测试 | E2E 测试 |
|---------|---------|---------|---------|
| MemoryService（增删改查） | ✅ | ✅ | — |
| MemoryRetrieval（检索算法） | ✅ | ✅ | — |
| TaskScheduler（任务调度） | ✅ | ✅ | — |
| TaskDecomposer（任务分解） | ✅ | ✅ | — |
| AgentMatcher（技能匹配） | ✅ | ✅ | — |
| 工具库（文件/命令/网络） | ✅ | ✅ | — |
| UserProfileService（用户画像） | ✅ | ✅ | — |
| 记忆管理界面（UI） | — | — | ✅ |
| 任务管理界面（UI） | — | — | ✅ |
| 用户画像界面（UI） | — | — | ✅ |

---

## 2. 单元测试用例

### 2.1 MemoryService 测试

**测试文件**：`tests/unit/test_memory_service.ts`

#### TC-U-401：创建记忆并保存

```
前置条件：初始化 MemoryService
输入：
  agentId: "agent_test"
  content: "用户偏好使用TypeScript"
  type: "preference"
  importance: 8
  tags: ["技术", "偏好"]
预期结果：
  - 返回的记忆对象包含有效的 id
  - 记忆存储成功
  - createdAt 时间戳在当前时间 ±5秒内
```

#### TC-U-402：获取Agent的所有记忆

```
前置条件：已创建 3 条记忆
输入：agentId: "agent_test"
预期结果：
  - 返回数组长度为 3
  - 按 importance 降序排序
```

#### TC-U-403：删除记忆

```
前置条件：已创建记忆，id = "mem_xxx"
输入：memoryId: "mem_xxx"
预期结果：
  - 删除成功
  - 再次查询该记忆返回 null
```

#### TC-U-404：更新记忆内容

```
前置条件：已创建记忆
输入：
  memoryId: "mem_xxx"
  updates: { content: "更新后的内容", importance: 9 }
预期结果：
  - 记忆内容已更新
  - updatedAt 时间戳已更新
```

#### TC-U-405：记忆重要性校验

```
前置条件：无
输入：
  content: "测试"
  importance: 15  // 超出范围
预期结果：抛出 ValidationError，错误信息包含 "importance"
```

---

### 2.2 MemoryRetrieval 测试

**测试文件**：`tests/unit/test_memory_retrieval.ts`

#### TC-U-420：关键词匹配检索

```
前置条件：已创建记忆包含 "TypeScript" 和 "Python"
输入：
  query: "TypeScript 最佳实践"
  agentId: "agent_test"
  limit: 10
预期结果：
  - 返回包含 "TypeScript" 的记忆
  - 相关度分数 > 0.5
```

#### TC-U-421：时间权重计算

```
前置条件：已创建 2 条记忆（一条旧，一条新）
输入：query: "测试"
预期结果：
  - 新记忆的相关度分数高于旧记忆
```

#### TC-U-422：重要性权重计算

```
前置条件：已创建 2 条记忆（importance 5 和 9）
输入：query: "测试"
预期结果：
  - 高重要性的记忆排名更高
```

#### TC-U-423：标签筛选

```
前置条件：已创建带标签 ["前端"] 和 ["后端"] 的记忆
输入：
  query: "开发"
  filter: { tags: ["前端"] }
预期结果：
  - 只返回包含 "前端" 标签的记忆
```

#### TC-U-424：空查询返回所有记忆

```
前置条件：已创建 5 条记忆
输入：query: ""
预期结果：
  - 返回最多 limit 条记忆
  - 按重要性和时间排序
```

---

### 2.3 TaskScheduler 测试

**测试文件**：`tests/unit/test_task_scheduler.ts`

#### TC-U-440：创建任务

```
前置条件：初始化 TaskScheduler
输入：
  title: "开发API接口"
  description: "实现用户登录API"
  priority: "high"
  expectedAgents: ["backend_dev"]
预期结果：
  - 任务创建成功
  - 任务状态为 "pending"
  - 生成有效的 taskId
```

#### TC-U-441：执行任务并更新状态

```
前置条件：已创建任务
输入：taskId: "task_xxx"
预期结果：
  - 任务状态变为 "running"
  - startTime 时间戳已设置
```

#### TC-U-442：完成任务

```
前置条件：任务状态为 "running"
输入：
  taskId: "task_xxx"
  result: { success: true, output: "任务完成" }
预期结果：
  - 任务状态变为 "completed"
  - result 已存储
  - endTime 时间戳已设置
```

#### TC-U-443：任务失败处理

```
前置条件：任务状态为 "running"
输入：
  taskId: "task_xxx"
  error: "API超时"
预期结果：
  - 任务状态变为 "failed"
  - errorMessage 已存储
```

#### TC-U-444：取消任务

```
前置条件：任务状态为 "pending" 或 "running"
输入：taskId: "task_xxx"
预期结果：
  - 任务状态变为 "cancelled"
```

---

### 2.4 TaskDecomposer 测试

**测试文件**：`tests/unit/test_task_decomposer.ts`

#### TC-U-460：简单任务分解

```
前置条件：初始化 TaskDecomposer
输入：任务描述 = "开发一个简单的博客系统"
预期结果：
  - 返回 3-5 个子任务
  - 子任务包含：需求分析、架构设计、编码实现
```

#### TC-U-462：复杂任务分解层次

```
前置条件：无
输入：任务描述 = "构建一个完整的电商网站"
预期结果：
  - 返回至少 2 层子任务
  - 子任务之间有依赖关系
```

#### TC-U-463：子任务包含预计时间

```
前置条件：无
输入：任务描述 = "开发登录功能"
预期结果：
  - 每个子任务包含 estimatedDuration
  - estimatedDuration 为合理数值（分钟）
```

---

### 2.5 UserProfileService 测试

**测试文件**：`tests/unit/test_user_profile.ts`

#### TC-U-500：初始化默认画像

```
前置条件：清除用户画像数据
操作：new UserProfileService()
预期结果：
  - userId 不为空
  - basicInfo.activityLevel === "medium"
  - communication.language === "zh-CN"
```

#### TC-U-501：记录行为消息

```
前置条件：已初始化服务
输入：
  record: {
    type: "message",
    data: { content: "Hello", length: 5 }
  }
预期结果：
  - behaviorRecords 数组增加
  - totalMessages 计数增加
```

#### TC-U-502：分析活跃度

```
前置条件：已记录 25 条消息（24小时内）
操作：调用 analyzeAndUpdate()
预期结果：
  - activityLevel 变为 "high"
```

#### TC-U-503：更新画像偏好

```
前置条件：已初始化服务
输入：
  updates: {
    communication: { responseLength: "short" },
    skills: ["Python", "TypeScript"]
  }
预期结果：
  - 更新成功
  - 再次获取 profile 包含新值
```

#### TC-U-504：导出Markdown格式正确

```
前置条件：有完整的用户画像
操作：exportToMarkdown()
预期结果：
  - 返回包含 "# 用户画像" 标题
  - 包含所有基本信息、行为特征等章节
```

#### TC-U-505：重置画像

```
前置条件：已有完整的画像和行为记录
操作：resetProfile()
预期结果：
  - behaviorRecords 清空
  - basicInfo.totalMessages === 0
  - skills 和 interests 数组为空
```

---

## 3. 集成测试用例

### 3.1 记忆系统 API 集成测试

**测试文件**：`tests/integration/test_api_memories.ts`

#### TC-I-401：POST /api/memories - 创建记忆

```
请求：POST /api/memories
Body：{
  "agentId": "agent_test",
  "content": "用户偏好使用深色主题",
  "type": "preference",
  "importance": 7,
  "tags": ["UI", "偏好"]
}
预期：
  - 状态码 201
  - body.data.id 存在
  - body.data.content === "用户偏好使用深色主题"
```

#### TC-I-402：GET /api/memories/:agentId - 查询记忆

```
前置：已创建记忆
请求：GET /api/memories/agent_test
预期：
  - 状态码 200
  - body.data 为数组
  - 包含刚才创建的记忆
```

#### TC-I-403：POST /api/memories/search - 搜索记忆

```
请求：POST /api/memories/search
Body：{
  "query": "UI偏好",
  "type": "preference",
  "limit": 10
}
预期：
  - 状态码 200
  - body.data 包含匹配的记忆
  - 按 relevance 排序
```

#### TC-I-404：DELETE /api/memories/:id - 删除记忆

```
前置：已创建记忆，id = "mem_xxx"
请求：DELETE /api/memories/mem_xxx
预期：
  - 状态码 200
  - 再次查询返回 404
```

---

### 3.2 任务调度 API 集成测试

**测试文件**：`tests/integration/test_api_tasks.ts`

#### TC-I-420：POST /api/tasks - 创建任务

```
请求：POST /api/tasks
Body：{
  "title": "实现用户认证",
  "description": "开发登录和注册功能",
  "priority": "high"
}
预期：
  - 状态码 201
  - body.data.id 存在
  - body.data.status === "pending"
```

#### TC-I-421：GET /api/tasks/:id/decompose - 分解任务

```
前置：已创建任务
请求：GET /api/tasks/:id/decompose
预期：
  - 状态码 200
  - body.data.subtasks 为数组
  - 长度 >= 2
```

#### TC-I-422：POST /api/tasks/:id/execute - 执行任务

```
前置：已创建任务
请求：POST /api/tasks/:id/execute
预期：
  - 状态码 200
  - body.data.status === "running"
```

#### TC-I-423：POST /api/tasks/:id/cancel - 取消任务

```
前置：任务正在运行
请求：POST /api/tasks/:id/cancel
预期：
  - 状态码 200
  - body.data.status === "cancelled"
```

#### TC-I-424：GET /api/tasks - 列出任务

```
前置：已创建多个任务
请求：GET /api/tasks?status=running
预期：
  - 状态码 200
  - 只返回 running 状态的任务
```

---

### 3.3 工具库 API 集成测试

**测试文件**：`tests/integration/test_api_tools.ts`

#### TC-I-450：POST /api/tools/read - 读取文件

```
请求：POST /api/tools/read
Body：{
  "path": "/tmp/test.txt"
}
预期：
  - 状态码 200
  - body.data.content 存在
```

#### TC-I-451：POST /api/tools/write - 写入文件

```
请求：POST /api/tools/write
Body：{
  "path": "/tmp/test.txt",
  "content": "Hello World"
}
预期：
  - 状态码 200
  - 文件已创建
```

#### TC-I-452：POST /api/tools/execute - 执行命令

```
请求：POST /api/tools/execute
Body：{
  "command": "echo 'test'",
  "timeout": 5000
}
预期：
  - 状态码 200
  - body.data.output === "test\n"
  - body.data.exitCode === 0
```

#### TC-I-453：POST /api/tools/fetch - 网络请求

```
请求：POST /api/tools/fetch
Body：{
  "url": "https://httpbin.org/get",
  "method": "GET"
}
预期：
  - 状态码 200
  - body.data.status === 200
  - body.data.body 存在
```

---

### 3.4 用户画像 API 集成测试

**测试文件**：`tests/integration/test_api_user.ts`

#### TC-I-480：GET /api/user/profile - 获取画像

```
请求：GET /api/user/profile
预期：
  - 状态码 200
  - body.data.userId 存在
  - body.data.basicInfo 存在
```

#### TC-I-481：PUT /api/user/profile - 更新画像

```
请求：PUT /api/user/profile
Body：{
  "communication": {
    "responseLength": "long",
    "tone": "friendly"
  },
  "skills": ["JavaScript", "React"]
}
预期：
  - 状态码 200
  - 再次获取包含更新值
```

#### TC-I-482：GET /api/user/profile/markdown - 导出

```
请求：GET /api/user/profile/markdown
预期：
  - 状态码 200
  - Content-Type: text/markdown
  - 响应体包含 "# 用户画像"
```

#### TC-I-483：POST /api/user/behavior - 记录行为

```
请求：POST /api/user/behavior
Body：{
  "type": "message",
  "data": {
    "content": "测试消息",
    "length": 4
  }
}
预期：
  - 状态码 200
  - 行为已记录
```

#### TC-I-484：POST /api/user/profile/reset - 重置画像

```
请求：POST /api/user/profile/reset
预期：
  - 状态码 200
  - 画像恢复默认值
```

---

## 4. E2E 测试用例（Playwright）

**测试文件**：`tests/e2e/test_ui_memories.ts`

### 4.1 记忆管理界面测试

#### TC-E-401：打开记忆管理页面

```
前置：已完成应用初始化
操作：导航到 /memories 路由
预期：
  - 显示"记忆管理"标题
  - 显示搜索框和筛选下拉框
  - 显示"添加记忆"按钮
```

#### TC-E-402：添加新记忆

```
前置：在记忆管理页面
操作：
  1. 点击"添加记忆"按钮
  2. 在弹窗中输入类型="偏好"
  3. 输入内容="测试记忆"
  4. 输入重要性="5"
  5. 点击"添加"
预期：
  - 弹窗关闭
  - 记忆列表显示新记忆
  - 显示成功提示
```

#### TC-E-403：搜索记忆

```
前置：已创建多条记忆
操作：
  1. 在搜索框输入关键词
  2. 点击"搜索"按钮
预期：
  - 记忆列表刷新
  - 只显示匹配的记忆
```

#### TC-E-404：删除记忆

```
前置：在记忆管理页面
操作：
  1. 找到一条记忆
  2. 点击"删除"按钮
  3. 确认删除
预期：
  - 记忆从列表中移除
  - 显示删除成功提示
```

---

**测试文件**：`tests/e2e/test_ui_tasks.ts`

### 4.2 任务管理界面测试

#### TC-E-420：打开任务管理页面

```
前置：已完成应用初始化
操作：导航到 /tasks 路由
预期：
  - 显示"任务管理"标题
  - 显示任务列表
  - 显示"创建任务"按钮
```

#### TC-E-421：创建新任务

```
前置：在任务管理页面
操作：
  1. 点击"创建任务"按钮
  2. 输入任务标题
  3. 输入任务描述
  4. 选择优先级
  5. 点击"创建"
预期：
  - 任务出现在列表中
  - 状态为"pending"
```

#### TC-E-422：执行任务

```
前置：有 pending 状态的任务
操作：
  1. 点击任务的"执行"按钮
预期：
  - 任务状态变为"running"
  - 显示执行状态动画
```

#### TC-E-423：查看子任务

```
前置：任务已分解
操作：
  1. 点击任务展开按钮
预期：
  - 显示子任务列表
  - 显示子任务状态和进度
```

---

**测试文件**：`tests/e2e/test_ui_user_profile.ts`

### 4.3 用户画像界面测试

#### TC-E-440：打开用户画像页面

```
前置：已完成应用初始化
操作：导航到 /profile 路由
预期：
  - 显示"用户画像"标题
  - 显示基本信息卡片
  - 显示行为特征卡片
  - 显示沟通偏好卡片
```

#### TC-E-441：编辑用户画像

```
前置：在用户画像页面
操作：
  1. 点击"编辑"按钮
  2. 修改回复长度为"长"
  3. 修改语气为"友好"
  4. 添加技能"React"
  5. 点击"保存"
预期：
  - 退出编辑模式
  - 页面显示更新后的数据
  - 显示保存成功提示
```

#### TC-E-442：导出用户画像

```
前置：在用户画像页面
操作：
  1. 点击"导出Markdown"按钮
预期：
  - 下载 user_profile.md 文件
  - 文件内容包含完整的画像信息
```

#### TC-E-443：重置用户画像

```
前置：在用户画像页面
操作：
  1. 点击"重置"按钮
  2. 确认重置
预期：
  - 显示确认提示"确定要重置..."
  - 确认后画像恢复默认值
  - 显示重置成功提示
```

#### TC-E-444：查看行为统计

```
前置：有完整的用户画像
操作：查看各卡片数据
预期：
  - 活跃度显示正确（高/中/低）
  - 总会话数和总消息数正确
  - 偏好主题以标签形式展示
  - 技能和兴趣以标签形式展示
```

---

## 5. 测试执行说明

### 5.1 运行单元测试

```bash
# 安装依赖（首次）
npm install

# 运行所有单元测试
npm run test:unit

# 运行特定模块测试
npx vitest run tests/unit/test_memory_service.ts
npx vitest run tests/unit/test_memory_retrieval.ts
npx vitest run tests/unit/test_task_scheduler.ts
npx vitest run tests/unit/test_user_profile.ts
```

### 5.2 运行集成测试

```bash
# 运行所有集成测试
npm run test:integration

# 运行特定 API 集成测试
npx vitest run tests/integration/test_api_memories.ts
npx vitest run tests/integration/test_api_tasks.ts
npx vitest run tests/integration/test_api_user.ts
```

### 5.3 运行 E2E 测试

```bash
# 安装 Playwright 浏览器（首次）
npx playwright install

# 构建应用
npm run build

# 运行 E2E 测试
npm run test:e2e

# 运行特定 E2E 测试
npx playwright test tests/e2e/test_ui_memories.ts
npx playwright test tests/e2e/test_ui_tasks.ts
npx playwright test tests/e2e/test_ui_user_profile.ts
```

### 5.4 测试环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `TEST_DATA_DIR` | 否 | 测试临时目录，默认 `os.tmpdir()/openkin-test` |
| `TEST_API_BASE_URL` | 否 | API测试基础URL，默认 `http://localhost:3000` |

---

## 6. 测试通过标准

迭代四完成的测试验收条件：

- [ ] 所有单元测试（TC-U-401 ~ TC-U-505）**100% 通过**
- [ ] 所有集成测试（TC-I-401 ~ TC-I-484）**100% 通过**
- [ ] 所有 E2E 测试（TC-E-401 ~ TC-E-444）**100% 通过**
- [ ] 无任何 `console.error` 未处理异常输出
- [ ] 代码覆盖率 >= 80%

---

## 7. 测试数据准备

### 7.1 记忆测试数据

```json
{
  "agentId": "test_agent_001",
  "memories": [
    {
      "content": "用户偏好使用TypeScript进行前端开发",
      "type": "preference",
      "importance": 8,
      "tags": ["前端", "TypeScript"]
    },
    {
      "content": "Python是后端开发的主要语言",
      "type": "knowledge",
      "importance": 7,
      "tags": ["后端", "Python"]
    }
  ]
}
```

### 7.2 任务测试数据

```json
{
  "tasks": [
    {
      "title": "实现用户登录功能",
      "description": "包括注册、登录、登出",
      "priority": "high",
      "expectedAgents": ["backend_dev"]
    },
    {
      "title": "设计数据库结构",
      "description": "用户表、产品表设计",
      "priority": "medium",
      "expectedAgents": ["backend_dev", "dba"]
    }
  ]
}
```

### 7.3 用户画像测试数据

```json
{
  "userProfile": {
    "basicInfo": {
      "activityLevel": "high",
      "totalSessions": 25,
      "totalMessages": 150
    },
    "behavior": {
      "communicationStyle": "interactive",
      "preferredTopics": ["编程", "设计", "测试"],
      "averageSessionDuration": 15
    },
    "skills": ["TypeScript", "React", "Node.js"],
    "interests": ["AI", "开源", "技术博客"],
    "communication": {
      "responseLength": "medium",
      "likesCodeExamples": true,
      "tone": "friendly"
    }
  }
}
```

---

*文档版本：1.0 | 创建日期：2026-03-28*
