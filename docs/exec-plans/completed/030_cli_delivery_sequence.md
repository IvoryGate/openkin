# 030 CLI Delivery Sequence（基础可用 CLI 交付序列）

## 目标

把当前已经落地的基础 CLI 起点，拆成一组可连续交给弱模型执行的工作单，最终交付一个**基础但可真实使用**的 OpenKin CLI。

这里的“真实使用”定义为：

- 能连接真实运行中的 OpenKin Server
- 能开始或继续一段真实对话
- 能查看和管理已有会话
- 能查看系统健康和基础运行状态
- 能查看和管理定时任务
- 有明确文档、帮助、配置优先级和 smoke 测试

---

## 当前基线

当前工作区已经有：

- `packages/cli/` 基础包
- `openkin help`
- `openkin chat`
- `openkin sessions list`
- `openkin inspect health`
- `pnpm test:project-cli`

这意味着后续不再从零开始，而是在此基础上继续交付。

---

## 交付顺序（冻结）

### 031 · Session Workflows

目标：

- 让 CLI 真正支持“继续使用同一会话”
- 补齐最核心的会话查看与删除能力

产出：

- `chat --session <id>`
- `sessions show <id>`
- `sessions messages <id>`
- `sessions delete <id>`

### 032 · Operator Client Foundation

目标：

- 在不污染 `packages/sdk/client` 的前提下，新增独立 operator 调用层
- 为 `inspect` 与 `tasks` 命令提供稳定调用基础

产出：

- `packages/sdk/operator-client/`
- 最小 typed methods
- 对应 smoke / typecheck

### 033 · Tasks And Inspect

目标：

- 让 CLI 具备最基本的运维/值班使用能力

产出：

- `inspect status`
- `inspect logs`
- `inspect tools`
- `inspect skills`
- `tasks list/show/create/trigger/enable/disable/runs`

### 034 · Real-Use Hardening

目标：

- 把 CLI 从“能跑”提升到“日常可用”

产出：

- 帮助文案补齐
- 配置优先级文档补齐
- Bash / PowerShell 示例
- 手工 smoke 指南
- CLI 文档入口
- 补充测试与错误提示

### 035 · Slash Commands

目标：

- 让 `chat` 交互态具备内部控制命令
- 修复“slash 输入被当成普通消息”的当前缺口

产出：

- `/help`
- `/exit`
- `/session ...`
- `/inspect ...`
- `/tasks ...`（最小只读集）

### 036 · Terminal UX

目标：

- 提升终端层次感与可读性
- 增加字符分隔、标题、事件区分

产出：

- banner / divider / section 标题
- 更清晰的 session header
- 更适合交互态的 `/help`
- 保持无色环境可读

### 037 · TheWorld Surface Rename

目标：

- 把用户可见层从 `OpenKin` 收口到 `TheWorld`
- 保持兼容入口，避免一次性深层改名

产出：

- `theworld` 入口
- `TheWorld CLI` / `TheWorld Chat` 文案
- 文档与 smoke 同步
- 保留 `openkin` 兼容入口

---

## 当前不纳入本序列

以下能力明确**不属于这组弱模型工作单**：

- 多 Agent 编排
- plan mode
- 多模态输入
- 回滚
- Run cancel / 打断
- 复杂 TUI
- WebSocket / Hybrid transport
- heartbeat / event subscription 共享抽象
- Agent CRUD 命令
- 深层仓库级 rename（package scope / env 前缀 / HTTP path）

如果实现过程中撞到这些能力，必须停止并升级。

---

## 完成态定义

当 `031`–`037` 全部完成后，CLI 下一阶段至少应满足：

1. 可以开始新会话，也可以继续旧会话
2. 可以查看会话详情和消息历史
3. 可以查看健康状态和系统基础信息
4. 可以列出和管理定时任务
5. `chat` 内存在最小 slash commands
6. 终端交互态具备更清晰的视觉层次
7. 用户可见产品名切到 `TheWorld`
8. `pnpm verify` 持续通过

---

## 执行要求

弱模型执行每一份工作单时都必须：

1. 先读 `AGENTS.md`
2. 先读 `docs/index.md`
3. 先读对应 exec-plan
4. 每次修改后运行工作单要求的验收命令
5. 命中升级条件时立即停止
