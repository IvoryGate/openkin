# openkin

`openkin` 当前处于探索分支上的架构搭建阶段。

本仓库的目标不是只实现一个后端 Agent 服务，而是逐步演进成一套可持续扩展的全栈智能体系统，包括：

- 核心 Agent 运行时
- 服务化与协议层
- 客户端 SDK
- 即时通讯适配框架
- 面向未来的多 Agent 与场景扩展

## 从哪里开始读

建议按下面顺序阅读：

1. `AGENTS.md`
2. `docs/index.md`
3. `docs/ARCHITECTURE.md`
4. `docs/SDK.md`
5. `docs/CHANNELS.md`
6. `docs/archive/README.md`

## 当前状态

当前主线工作不是直接堆实现代码，而是先把仓库建设成一套可供人和智能体共同消费的记录系统：

- 文档是权威知识来源
- 执行计划是工作入口
- 约束和质量基线会逐步机械化
- 后续代码实现将按分层 contract 逐步落地