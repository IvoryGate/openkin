# 产品文档 - 迭代四：核心功能完善

**迭代轮数**：4  
**迭代主题**：核心功能完善  
**所属阶段**：第二阶段  
**预估周期**：2-3 周  
**状态**：开发中

---

## 1. 迭代目标

在第1-3轮迭代完成基础框架搭建和项目重构的基础上，完善OpenKin的核心功能，实现记忆系统、任务调度、用户画像和扩展工具库，为多Agent协作奠定基础。

**主要目标**：
1. ✅ 完善记忆系统（短期/长期存储、检索机制）
2. ✅ 实现任务调度系统（统筹Agent、任务分解、能力匹配）
3. ✅ 扩展工具库（文件、命令、网络工具）
4. ✅ 实现用户画像系统（行为学习、偏好分析）

---

## 2. 用户故事

### US-04-01 记忆系统

**角色**：Agent开发用户  
**期望**：Agent能够记住之前的对话内容和用户偏好，在后续对话中表现出连贯性和个性化  
**价值**：提升对话质量，减少重复说明，增强用户体验

**验收条件**：
- [ ] 短期记忆自动存储最近的对话记录（默认20条）
- [ ] 长期记忆能够归档重要的对话片段
- [ ] 记忆检索能够快速找到相关内容
- [ ] 用户可以查看和管理自己的记忆
- [ ] Agent在对话时能够自动调用记忆

---

### US-04-02 任务调度系统

**角色**：复杂任务用户  
**期望**：能够给系统下达复杂任务，系统自动分解为子任务并分配给合适的Agent完成  
**价值**：提高任务完成效率，实现多Agent协作

**验收条件**：
- [ ] 系统能够自动分解复杂任务为子任务
- [ ] 统筹Agent能够根据子任务类型匹配专业Agent
- [ ] 任务状态实时跟踪和反馈
- [ ] 支持任务优先级管理
- [ ] 失败任务能够自动重试或通知用户

---

### US-04-03 扩展工具库

**角色**：开发者用户  
**期望**：Agent能够使用工具执行文件操作、命令运行、网络搜索等任务  
**价值**：扩展Agent能力，使其能够执行实际操作

**验收条件**：
- [ ] 文件读写工具：读取/写入本地文件
- [ ] 命令执行工具：执行系统命令并返回结果
- [ ] 网络搜索工具：搜索网络信息并返回结果
- [ ] 工具使用权限管理（安全考虑）
- [ ] 工具执行日志记录

---

### US-04-04 用户画像系统

**角色**：个性化用户  
**期望**：系统能够学习我的使用习惯和偏好，提供更个性化的服务  
**价值**：提升用户体验，减少配置操作

**验收条件**：
- [ ] 自动记录用户行为（如常用Agent、对话主题）
- [ ] 分析用户偏好（如沟通风格、常用功能）
- [ ] 生成用户Soul.md档案
- [ ] Agent能够根据用户画像调整回复风格
- [ ] 用户可以查看和编辑自己的画像

---

## 3. 功能范围

### 3.1 本迭代包含（In Scope）

| 功能模块 | 功能描述 |
|---------|---------|
| 记忆系统 | 短期记忆存储、长期记忆归档、记忆检索 |
| 任务调度 | 统筹Agent、任务分解、能力匹配、状态跟踪 |
| 工具库 | 文件工具、命令工具、网络工具 |
| 用户画像 | 行为学习、偏好分析、用户Soul.md |

### 3.2 本迭代不包含（Out of Scope）

- 多Agent群聊协作（迭代五）
- 定时任务和心跳巡检（迭代五）
- 平台桥接（迭代六）
- 绘图工具集成（迭代五）
- 社区技能兼容（迭代七）

---

## 4. 功能详细设计

### 4.1 记忆系统

#### 4.1.1 短期记忆

**存储位置**：`~/.openkin/memories/{agentId}/{sessionId}.json`

**数据结构**：
```json
{
  "sessionId": "sess_abc123",
  "agentId": "agt_xyz",
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "content": "你好",
      "timestamp": 1711597200000,
      "memoryId": "mem_001"
    },
    {
      "id": "msg_002",
      "role": "assistant",
      "content": "你好！有什么可以帮助你的吗？",
      "timestamp": 1711597201000,
      "memoryId": "mem_002"
    }
  ],
  "createdAt": 1711597200000,
  "updatedAt": 1711597201000
}
```

**存储策略**：
- 保留最近20条对话（可配置）
- 超过限制时，最旧的消息会被移除
- 重要消息可以被标记为"需归档"

#### 4.1.2 长期记忆

**存储位置**：`~/.openkin/memories/{agentId}/longterm.json`

**数据结构**：
```json
{
  "memories": [
    {
      "id": "mem_long_001",
      "type": "preference",
      "content": "用户喜欢简洁的回答",
      "importance": 8,
      "tags": ["preference", "style"],
      "createdAt": 1711597200000,
      "accessCount": 5,
      "lastAccessedAt": 1711700000000,
      "agentId": "agt_xyz"
    },
    {
      "id": "mem_long_002",
      "type": "knowledge",
      "content": "用户是Python开发者",
      "importance": 7,
      "tags": ["skill", "python"],
      "createdAt": 1711600000000,
      "accessCount": 3,
      "lastAccessedAt": 1711700000000,
      "agentId": "agt_xyz"
    }
  ]
}
```

**归档触发条件**：
- 用户明确标记重要对话
- 系统识别到关键信息（如用户偏好、技能等）
- 对话被引用次数超过阈值

#### 4.1.3 记忆检索

**检索策略**：
- 关键词匹配
- 语义相似度（使用嵌入向量）
- 时间权重（最近访问的记忆优先）
- 重要性权重（重要性高的记忆优先）

**API接口**：
```typescript
interface MemorySearchRequest {
  agentId: string;
  query: string;
  type?: 'preference' | 'knowledge' | 'all';
  limit?: number;
}

interface MemorySearchResponse {
  memories: Memory[];
  total: number;
}
```

---

### 4.2 任务调度系统

#### 4.2.1 统筹Agent

**职责**：
- 接收用户复杂任务
- 分析任务类型和难度
- 分解任务为子任务
- 分配子任务给专业Agent
- 协调子任务执行顺序
- 汇总最终结果

**数据结构**：
```typescript
interface Task {
  id: string;
  parentTaskId?: string;
  type: 'development' | 'writing' | 'research' | 'general';
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 1 | 2 | 3 | 4 | 5;
  assignedAgentId?: string;
  createdAt: number;
  updatedAt: number;
  dependencies: string[]; // 依赖的子任务ID
  result?: any;
}

interface TaskDecomposition {
  subTasks: Task[];
  executionOrder: string[][]; // 按层级排列的任务ID数组
}
```

#### 4.2.2 任务分解算法

**分解策略**：
1. 分析任务描述，识别关键动词和名词
2. 匹配预定义的任务模板
3. 根据任务类型生成子任务
4. 确定子任务之间的依赖关系
5. 设置任务优先级

**示例**：
```
用户任务："开发一个待办事项应用"

分解结果：
1. 需求分析 - 技术专家Agent
2. 架构设计 - 技术专家Agent
3. 前端开发 - 技术专家Agent
4. 后端开发 - 技术专家Agent
5. 测试 - 技术专家Agent
6. 文档编写 - 写作助手Agent
```

#### 4.2.3 Agent能力匹配

**Agent能力定义**：
```typescript
interface AgentCapabilities {
  agentId: string;
  skills: string[]; // ['coding', 'debugging', 'writing', 'research']
  proficiency: Record<string, number>; // { 'coding': 8, 'writing': 5 }
  availability: boolean;
  currentLoad: number; // 当前任务数
}

interface TaskRequirement {
  requiredSkills: string[];
  minProficiency: number;
}
```

**匹配算法**：
1. 提取任务所需的技能
2. 查找具备这些技能的Agent
3. 评估Agent的熟练度和可用性
4. 选择最合适的Agent
5. 如果没有合适的Agent，通知用户创建新Agent

---

### 4.3 扩展工具库

#### 4.3.1 文件工具

**功能**：
- `readFile(path: string): Promise<string>` - 读取文件内容
- `writeFile(path: string, content: string): Promise<void>` - 写入文件
- `listFiles(dir: string): Promise<string[]>` - 列出目录文件
- `deleteFile(path: string): Promise<void>` - 删除文件

**安全限制**：
- 只能访问用户主目录下的文件
- 不能访问系统关键文件
- 文件大小限制（10MB）
- 操作日志记录

#### 4.3.2 命令工具

**功能**：
- `executeCommand(command: string): Promise<{ stdout: string; stderr: string; code: number }>` - 执行命令

**安全限制**：
- 命令白名单（禁止执行危险命令）
- 执行超时（30秒）
- 输出大小限制（1MB）
- 操作日志记录

**允许的命令**：
- `ls`, `dir`
- `cat`, `type`
- `echo`
- `git`（部分命令）
- `npm`, `yarn`, `pnpm`（部分命令）

#### 4.3.3 网络工具

**功能**：
- `webSearch(query: string): Promise<SearchResult[]>` - 网络搜索
- `fetchUrl(url: string): Promise<string>` - 获取网页内容

**安全限制**：
- URL白名单/黑名单
- 内容大小限制（5MB）
- 超时限制（10秒）
- 请求频率限制

**搜索结果格式**：
```typescript
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}
```

---

### 4.4 用户画像系统

#### 4.4.1 用户Soul.md

**存储位置**：`~/.openkin/user/soul.md`

**文件格式**：
```markdown
# 用户画像

## 基本信息
- 用户ID: user_abc123
- 创建时间: 2026-03-28
- 活跃度: 高

## 行为特征
- 对话风格: 简洁直接
- 偏好主题: 技术、编程、AI
- 常用Agent: 技术专家
- 平均对话时长: 15分钟

## 技能与兴趣
- 技能: Python, JavaScript, React
- 兴趣: AI, 开源项目, 技术博客

## 沟通偏好
- 回复长度: 短
- 代码示例: 喜欢
- 语气: 专业
- 语言: 中文

## 使用习惯
- 活跃时间段: 上午9-11点, 下午2-5点
- 使用频率: 每天5次以上
- 常用功能: 代码生成, 调试帮助
```

#### 4.4.2 行为学习

**学习内容**：
- 常用Agent
- 对话主题分布
- 消息长度偏好
- 活跃时间段
- 功能使用频率

**学习算法**：
- 统计分析
- 聚类分析
- 时间序列分析

**更新频率**：
- 实时更新（对话行为）
- 每日汇总（整体画像）

#### 4.4.3 偏好分析

**分析维度**：
- 沟通风格（简洁/详细/互动）
- 内容偏好（技术/创意/生活）
- 语气偏好（专业/友好/幽默）
- 语言偏好（中文/英文）

**应用场景**：
- Agent回复风格调整
- 功能推荐
- 个性化设置

---

## 5. 界面与交互设计

### 5.1 记忆管理界面

**入口**：设置页面 → 记忆管理

**功能**：
- 查看所有记忆（分短期/长期）
- 搜索记忆
- 删除记忆
- 编辑记忆内容
- 导出记忆

### 5.2 任务管理界面

**入口**：设置页面 → 任务管理

**功能**：
- 查看所有任务（进行中/已完成/失败）
- 查看任务详情
- 取消任务
- 重试失败任务
- 查看任务日志

### 5.3 工具权限管理

**入口**：设置页面 → 工具权限

**功能**：
- 查看工具使用记录
- 配置工具权限
- 禁用/启用工具
- 查看工具日志

### 5.4 用户画像界面

**入口**：设置页面 → 我的画像

**功能**：
- 查看用户画像
- 编辑画像信息
- 重置画像
- 导出画像

---

## 6. 数据存储设计

### 6.1 本地目录结构

```
~/.openkin/
├── memories/              # 记忆存储
│   ├── {agentId}/
│   │   ├── {sessionId}.json       # 短期记忆
│   │   └── longterm.json           # 长期记忆
├── tasks/                 # 任务存储
│   ├── coordinator_tasks.json     # 统筹Agent任务
│   └── agent_tasks.json           # Agent任务
├── user/                  # 用户画像
│   ├── soul.md             # 用户画像
│   └── behaviors.json      # 行为记录
└── tools/                 # 工具日志
    └── usage_log.json     # 工具使用日志
```

### 6.2 任务数据结构

**coordinator_tasks.json**：
```json
{
  "tasks": [
    {
      "id": "task_001",
      "title": "开发待办事项应用",
      "status": "in_progress",
      "subTasks": ["subtask_001", "subtask_002"],
      "createdAt": 1711597200000
    }
  ]
}
```

---

## 7. 非功能性需求

| 指标 | 要求 |
|------|------|
| 记忆存储响应时间 | < 100ms |
| 记忆检索响应时间 | < 500ms |
| 任务分解时间 | < 2s |
| 工具执行时间 | < 30s |
| 用户画像更新延迟 | < 1s |
| 内存占用（空闲） | < 500MB |

---

## 8. 里程碑与交付物

| 里程碑 | 交付物 | 完成标志 |
|--------|--------|---------|
| M4.1 记忆系统 | 短期/长期记忆存储、检索功能 | 所有US-04-01验收条件通过 |
| M4.2 任务调度系统 | 统筹Agent、任务分解、能力匹配 | 所有US-04-02验收条件通过 |
| M4.3 工具库 | 文件、命令、网络工具 | 所有US-04-03验收条件通过 |
| M4.4 用户画像系统 | 行为学习、偏好分析、用户Soul.md | 所有US-04-04验收条件通过 |
| M4.5 集成测试 | 完整功能测试 | 所有测试通过 |

---

## 9. 与之前迭代的关联

### 9.1 基于迭代1-3的基础

- **迭代1**：建立了基础Agent引擎和引导流程
- **迭代2**：完成了项目架构重构，实现Agent CRUD和基础聊天
- **迭代3**：UI界面优化（如果已完成）
- **迭代4（本次）**：在基础上扩展记忆、任务调度、工具和画像功能

### 9.2 数据层扩展

- 继续使用`~/.openkin/`目录结构
- 扩展`memories/`、`tasks/`、`user/`子目录
- 兼容已有的`agents/`、`config.json`

### 9.3 API层扩展

- 在现有`/api/*`路由基础上添加新的端点
- 兼容现有的Agent和Chat API
- 新增记忆、任务、工具相关API

---

**文档版本**：1.0  
**创建日期**：2026-03-28  
**作者**：产品设计团队
