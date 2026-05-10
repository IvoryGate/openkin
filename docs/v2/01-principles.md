# v2 设计原则

## 一、为什么需要原则

v1 的问题是"探索太快，收口太慢"。v2 要在开始写第一行代码之前，先冻结工程原则。

## 二、核心原则

### 2.1 Contract-First

> 先冻结接口，再写实现。

每个分层在实现前必须完成：
1. **设计文档**：人类可读的架构说明
2. **接口定义**：TypeScript 类型、DTO、路由常量
3. **验收标准**：测试脚本、断言、通过条件
4. **升级条件**：什么情况下必须停止并升级

### 2.2 Verification-Driven

> 没有自动化验证的代码不应该合并。

每个增量必须伴随：
- 单元测试（覆盖核心路径）
- 集成测试（覆盖跨模块路径）
- 验收脚本（覆盖用户场景）

### 2.3 Layer Isolation

> 下层是上层的基础设施，上层不应反向侵入下层内部实现。

- L1 只暴露 `Agent`、`Session`、`RunEngine`、`ContextManager` 接口
- L2 通过 `ToolProvider` 接口接入
- L3 通过 HTTP API 暴露能力
- L4 通过 SDK 消费 L3
- L5 通过 SDK 消费 L3/L4

### 2.4 Incremental Evolution

> 小步快跑，每次增量都可验证、可回滚。

禁止：
- 一次性重写整个模块
- 在没有测试的情况下重构
- 同时修改多个分层

### 2.5 Documentation as Source of Truth

> 文档是权威知识来源，聊天不是。

所有决策必须沉淀到：
- 架构文档
- 执行计划
- 接口定义
- 测试用例

## 三、v2 与 v1 的关键区别

| 维度 | v1 | v2 |
|------|-----|-----|
| 记忆系统 | `InMemoryMemoryPort`（Map） | 分层记忆 + SQLite 持久化 + 召回策略 |
| 权限系统 | Hook 有 `beforeToolCall` | `PermissionGate` + 自动拦截 + 持久化 |
| Context | `TrimCompressionPolicy` | 可插拔策略：Trim/Summarize/Selective |
| Desktop | 5438 行单体 | 模块化 + 复用 L4 语义 |
| CI/CD | 手动 `pnpm verify` | GitHub Actions + 分层并行测试 |
| 工作方式 | 快速探索，后期收口 | 冻结 contract，逐步验证 |

## 四、决策流程

```
需求/问题
  ↓
是否涉及跨层 contract？
  ├─ 是 → high-capability mode 定方案
  │        ↓
  │        编写设计文档
  │        冻结接口定义
  │        编写验收标准
  │        ↓
  │        budget mode 执行
  │        ↓
  │        CI 验证
  │        ↓
  │        合并
  │
  └─ 否 → budget mode 直接执行
           ↓
           CI 验证
           ↓
           合并
```

## 五、冻结规则

以下 contract 一旦冻结，修改需要 high-capability mode 重新定稿：

1. **L1 Core**：`AgentDefinition`、`RunState`、`ContextBlock`、`MemoryPort`、`PermissionHook`
2. **L3 Service**：REST 路由、DTO、Event Plane schema、数据库表结构
3. **L4 Product**：CLI 命令、TUI 路由、产品语义
4. **L5 Client**：SDK 接口、Desktop 模块接口

## 六、升级条件

任何模型在执行中遇到以下情况，必须停止并汇报：

1. 需要修改已冻结的跨层 contract
2. 需要调整架构边界
3. 连续两轮无法通过 CI 验证
4. 无法明确定位应修改的文件
5. 需要在多个方案之间做设计取舍
