# 029 Basic CLI Foundation（基础 CLI 工作单）

## 目标

当前阶段的目标不是处理多 Agent 编排、plan mode 或统一实时订阅抽象，而是参考 `Desktop/src` 的 CLI 组织方式，在 `openkin` 中落一个**基础 CLI**。

这个基础 CLI 的定位是：

- 基于现有 OpenKin Server 能力
- 以 Node/TypeScript 为运行时
- 提供统一命令入口
- 先收敛最小可用命令集
- 为后续扩展保留结构，但**不提前实现未来能力**

一句话冻结：

> 先做一个可用、可验证、可扩展的基础 CLI 壳层，而不是一次性做完整终端代理产品。

---

## 问题边界

### 参考对象

参考 `Desktop/src` 的主要不是它的全部高级能力，而是这些基础组织思想：

- 单一 CLI 入口
- 命令/子命令组织
- 交互命令与非交互命令并存
- 输出层与命令处理层分离
- 为后续扩展预留目录结构

### 当前明确不参考的部分

本阶段**不**对标这些能力：

- structured IO host 协议
- permission prompt / hook callback
- WebSocket / Hybrid transport
- 插件命令系统
- 本地 query loop
- 复杂 TUI
- 多 Agent 编排
- plan mode
- heartbeat/event subscription 的共享抽象

---

## 当前范围

本工作单只做 **CLI Foundation**，范围冻结为：

1. 建立统一命令入口
2. 保留并接入现有 `chat` 能力
3. 新增最小非交互命令
4. 提供基础帮助与 `--json`
5. 新增基础 smoke test

### 首期命令集（冻结）

1. `openkin chat`
   - 基于现有 `packages/server/src/cli-chat.ts` 收敛
   - 仍连接已运行的 Server
2. `openkin sessions list`
   - 列出会话
   - 支持文本输出和 `--json`
3. `openkin inspect health`
   - 调用 `GET /health`
   - 支持文本输出和 `--json`
4. `openkin help`
   - 显示基础命令说明

### 本阶段明确不做

- 不做 `tasks`
- 不做 `agents`
- 不做 `logs/tools/skills/status`
- 不做 session attach / messages / delete
- 不做 server start/stop/status
- 不做多模态
- 不做回滚
- 不做打断 / cancel
- 不做多 Agent
- 不做 plan mode

---

## 设计决策

### 1. 命令模型

首期采用最简单的命令模型：

- 一个统一入口文件
- 手写或轻量参数解析
- 每个子命令对应独立模块

不引入复杂命令插件系统。

### 2. 与现有 `pnpm chat` 的关系

- `pnpm chat` 现有能力应被复用，而不是重写
- 首期可以保留旧脚本兼容，同时让统一 CLI 调用同一实现
- 后续再决定是否完全收敛为唯一入口

### 3. 输出策略

首期统一两类输出：

- 默认文本输出
- `--json` 机器可读输出

交互命令 `chat` 仍保留人类可读终端渲染，不要求 `--json`

### 4. SDK 边界

本阶段只消费现有 `packages/sdk/client` 已有能力：

- `createSession`
- `streamRun`
- `listSessions`
- `getHealth`

不得因为基础 CLI 去扩张 operator surface。

### 5. 目录方向

首期建议新增独立 CLI 包，而不是继续把所有逻辑塞进 `packages/server/src/`：

- 候选：`packages/cli/`

这样后续 CLI 作为 shell 可以独立演进，但当前仍复用 `packages/server/src/cli-chat.ts` 的既有实现片段或迁移其逻辑。

---

## 影响范围

| 层级 | 影响 |
|------|------|
| `packages/cli/` | 新增：CLI 入口、命令分发、输出层、帮助系统 |
| `packages/server/src/cli-chat.ts` | 可复用或迁移 `chat` 实现 |
| `package.json` | 新增 CLI 入口脚本与测试脚本 |
| `scripts/` | 新增基础 CLI smoke 脚本 |
| `docs/exec-plans/active/` | 本工作单 |

---

## 允许修改的目录

- `packages/cli/`
- `packages/server/src/cli-chat.ts`
- `scripts/`
- 根目录 `package.json`（仅 CLI 相关 scripts）
- `docs/exec-plans/active/`

## 禁止修改的目录

- `packages/core/src/`
- `packages/channel-core/`
- `apps/dev-console/`
- `apps/web-console/`
- `packages/shared/contracts/src/`
- `packages/sdk/client/src/`（除非仅做极小的类型导出修正；默认不改）
- `workspace/skills/`

---

## 实施步骤

1. 新建 `packages/cli/` 基础结构
2. 建立统一入口 `openkin`
3. 接入 `chat` 子命令
4. 实现 `sessions list`
5. 实现 `inspect health`
6. 实现 `help`
7. 新增 `test:project-cli`
8. 将基础 CLI 纳入 `pnpm verify`

---

## 验收标准

1. 可以通过统一入口执行 `openkin help`
2. 可以通过统一入口执行 `openkin chat`
3. 可以执行 `openkin sessions list`
4. 可以执行 `openkin inspect health`
5. `sessions list` 与 `inspect health` 支持 `--json`
6. 新增 `pnpm test:project-cli`
7. `pnpm verify` 通过

---

## 必跑命令

1. `pnpm test:project-cli`
2. `pnpm verify`

---

## 升级条件

命中以下任一情况时，立即停止并升级：

- 需要为了基础 CLI 修改 `packages/sdk/client` 的已冻结边界
- 需要新增 operator API 才能完成首期命令集
- 需要在 `packages/shared/contracts` 中新增 DTO/endpoint
- 需要引入 WebSocket / Hybrid transport 才能继续
- 需要实现多 Agent、plan mode、多模态、回滚、打断
- 连续两轮无法同时通过 `pnpm test:project-cli` 与 `pnpm verify`

---

## 依赖

- 依赖 `028` 的总方向冻结
- 复用现有 `packages/server/src/cli-chat.ts`
- 复用现有 `packages/sdk/client`

---

## 决策记录

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 当前目标 | 基础 CLI | 用户当前目标是先落一个可用 CLI，而不是处理未来编排 |
| 对标方式 | 参考结构，不复制高级能力 | `Desktop/src` 的高级 runtime 超出当前阶段范围 |
| 首期命令集 | `chat` + `sessions list` + `inspect health` + `help` | 能形成最小闭环且不扩张 contract |
| 包结构 | 新增 `packages/cli/` | 让 CLI shell 独立于 server 入口演进 |
