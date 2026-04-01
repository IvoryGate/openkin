# AGENTS.md

本文件是 `openkin` 仓库的入口地图，不是完整手册。

目标：

- 帮助人和智能体快速定位权威文档
- 说明当前探索分支的工作方式
- 减少把大段背景塞进 prompt 的需要

## 当前分支定位

当前仓库处于探索分支模式：

- `main` 保持稳定参考线
- 探索分支用于试验新的工程模式、目录结构与文档组织
- 探索分支中的方案不要求回合并到 `main`

## 优先级最高的文档

先读这些：

1. `docs/index.md`
2. `docs/ARCHITECTURE.md`
3. `docs/SDK.md`
4. `docs/CHANNELS.md`
5. `docs/QUALITY_SCORE.md`
6. `docs/archive/README.md`

## 当前工程原则

1. 先建设仓库级 harness，再扩展实现代码。
2. 文档是记录系统，聊天不是记录系统。
3. 优先冻结跨层 contract，再实现具体功能。
4. 优先做可验证的小闭环，不做难以验收的大跃进。
5. 所有新增能力都应有明确层级归属。

## 当前分层理解

当前探索方向已经不再局限于后端第一层，而是面向全栈演进：

- 核心运行时层：Agent、Session、Context、Tool Runtime、Error Model
- 服务与协议层：API、流式协议、网关、鉴权、可观测边界
- 客户端 SDK 层：对前端或其他客户端暴露稳定调用接口
- 通道适配层：即时通讯平台接入、账号生命周期、消息适配
- 上层应用与协作层：具体客户端应用、多 Agent、场景扩展

## 当前不应该做的事

- 不要直接跳到多个 IM 平台适配实现
- 不要先做完整客户端 UI，再倒推 SDK
- 不要在没有共享 contract 的前提下各层各自建模
- 不要把临时讨论当作最终规则

## 当前建议的工作路径

1. 完善文档地图与执行计划目录
2. 明确共享 contract 与 monorepo 目标结构
3. 落第一层最小运行时闭环
4. 落服务协议与客户端 SDK contract
5. 落通道适配框架
6. 再接具体平台或具体客户端

## 执行计划目录

- 进行中的计划：`docs/exec-plans/active/`
- 已完成的计划：`docs/exec-plans/completed/`

## 质量与约束

跨层约束与质量入口：

- `docs/QUALITY_SCORE.md`
- `docs/RELIABILITY.md`
- `docs/SECURITY.md`
- `docs/GIT_WORKFLOW.md`

## 文档维护要求

- 任何重大架构变更都应更新 `docs/ARCHITECTURE.md`
- 任何 SDK 边界变化都应更新 `docs/SDK.md`
- 任何通道接入边界变化都应更新 `docs/CHANNELS.md`
- 任何新增执行计划都应放入 `docs/exec-plans/active/`
- 历史方案文档统一放在 `docs/archive/`
- 默认在提交前运行 `pnpm verify`
