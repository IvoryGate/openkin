# 034 CLI Real-Use Hardening（真实使用打磨）

## 目标

在功能已经基本可用的基础上，把 CLI 打磨到“你自己愿意日常使用”的程度。

这份工作单的重点不是再扩大量新命令，而是把已有能力变得：

- 更清楚
- 更稳定
- 更好学
- 更容易排错

---

## 当前前置状态

假定以下已完成：

- `029` 基础 CLI Foundation
- `031` 会话工作流
- `032` operator-client 基础
- `033` tasks 与 inspect

---

## 本轮范围（冻结）

必须完成：

1. 完善 CLI help
   - 根 help
   - `sessions` help
   - `inspect` help
   - `tasks` help
2. 明确配置优先级
   - `--server-url`
   - `OPENKIN_SERVER_URL`
   - `--api-key`
   - `OPENKIN_API_KEY`
3. 补 CLI 使用文档
   - 本地开发
   - 连接远程 server
   - Bash 示例
   - PowerShell 示例
4. 改善错误提示
   - server 不可达
   - 参数缺失
   - JSON 文件读取失败
   - 资源不存在
5. 扩充 smoke / 手工验收说明

---

## 本轮不做

- 不新增大块功能
- 不做 TUI 改造
- 不做多模态
- 不做回滚
- 不做多 Agent
- 不做 plan mode
- 不做事件订阅抽象
- 不做 install/publish 体系重构

---

## 单一路径实现要求

1. 先补帮助系统
2. 再补配置与错误提示
3. 再补 CLI 文档
4. 最后补 smoke 与手工验收说明

禁止在本阶段顺手扩 scope。

---

## 允许修改的目录

- `packages/cli/`
- `scripts/`
- `docs/requirements/PROJECT_CLI.md`
- `docs/architecture-docs-for-agent/second-layer/CLI_CHAT.md`
- `docs/exec-plans/active/`
- 根目录 `package.json`（仅 CLI/test scripts）

## 禁止修改的目录

- `packages/sdk/client/src/`
- `packages/sdk/operator-client/`（除非极小导出修正；默认不改）
- `packages/shared/contracts/src/`
- `packages/server/src/http-server.ts`
- `packages/core/src/`

---

## 验收标准

1. CLI 帮助系统完整可用
2. CLI 文档足以指导真实使用
3. Bash / PowerShell 示例都存在
4. 常见错误场景有清晰提示
5. `pnpm test:project-cli` 通过
6. `pnpm verify` 通过

---

## 必跑命令

1. `pnpm lint:docs`
2. `pnpm test:project-cli`
3. `pnpm verify`

---

## 升级条件

命中以下任一情况时立即停止并升级：

- 需要新增命令族才能完成目标
- 需要调整共享 contract 或 SDK 边界
- 需要引入新的交互模式（如 TUI、订阅、回滚）
- 连续两轮无法同时通过 `pnpm test:project-cli` 与 `pnpm verify`

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

当前任务：
打磨 CLI 到真实可用状态，重点是 help、文档、配置优先级、错误提示和验收说明。

任务范围：
- 允许修改的目录：
  - packages/cli/
  - scripts/
  - docs/requirements/PROJECT_CLI.md
  - docs/architecture-docs-for-agent/second-layer/CLI_CHAT.md
  - package.json（仅 CLI/test scripts）
- 不允许修改的目录：
  - packages/sdk/client/src/
  - packages/shared/contracts/src/
  - packages/server/src/http-server.ts
  - packages/core/src/

不做什么：
- 不扩新命令族
- 不做多 Agent / plan mode
- 不做 TUI
- 不做订阅抽象

验收标准：
- `pnpm lint:docs` 通过
- `pnpm test:project-cli` 通过
- `pnpm verify` 通过

升级条件：
- 需要扩 scope
- 需要改 contract / SDK 边界
- 连续两轮无法通过验收
```
