# Quality Score

## 目标

这个文档用来跟踪 `openkin` 在探索分支上的工程成熟度。

目的不是打漂亮分，而是让人和智能体都知道：

- 当前哪些部分已经有稳定 contract
- 哪些部分还只是方向
- 哪些部分已经具备可验证闭环

## 当前评分维度

### 1. 文档地图

- 状态：已启动
- 要求：入口、架构、执行计划、质量基线文档齐备

### 2. Core Runtime Contract

- 状态：已形成首期可运行 contract
- 要求：第一层类型、错误模型、工具运行时、上下文模型形成代码 contract
- 当前说明：已具备最小 ReAct loop、错误与取消语义、工具运行时视图、`ContextBlock` 与初始预算裁剪策略，并新增最小 `MemoryPort` 边界与注入扩展点

### 3. Service API Contract

- 状态：已形成首期 v1 REST + SSE 共享 DTO 与路由常量（见 `packages/shared/contracts` 与 `packages/server`）
- 要求：会话、run、stream、trace 形成共享 schema

### 4. Client SDK Contract

- 状态：已形成 Node 首期实现（`packages/sdk/client`，`pnpm test:sdk`）
- 要求：SDK surface 与 service contract 对齐

### 5. Channel Adapter Framework

- 状态：已形成首期 framework 契约与 mock 穿 service 闭环（`packages/channel-core`，`pnpm test:channels`）
- 要求：adapter、account lifecycle、inbound/outbound schema 形成统一 contract

### 6. 自动化约束

- 状态：已启动
- 要求：至少具备架构依赖检查、文档一致性检查、关键状态机约束
- 当前说明：已具备 docs / architecture / workspace 三类检查，并开始校验第一层上下文 contract 是否存在

### 7. 反馈回路

- 状态：已启动
- 要求：至少具备 core test、scenario test、trace、demo runner、adapter smoke test
- 当前说明：已具备 demo runner、场景回路、统一 `pnpm verify` 入口，并新增上下文裁剪场景与 memory 注入场景

## 使用方式

后续每推进一个阶段，都应更新本文件：

- 哪一项从“未开始”变为“已启动”
- 哪一项已经形成稳定 contract
- 哪一项已经具备自动化验证
