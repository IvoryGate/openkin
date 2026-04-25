# 031 CLI Session Workflows（会话工作流）

## 目标

在当前基础 CLI 之上，补齐“真实对话连续性”所需的最小会话能力。

本工作单完成后，CLI 应至少支持：

- 用已有 session 继续聊天
- 查看单个 session 基本信息
- 查看某个 session 的消息历史
- 删除一个 session

---

## 当前前置状态

假定以下能力已经存在并可用：

- `packages/cli/` 基础 CLI 包
- `openkin chat`
- `openkin sessions list`
- `openkin inspect health`
- `pnpm test:project-cli`

本工作单依赖现有 `packages/sdk/client` 已实现的：

- `getSession()`
- `getMessages()`
- `deleteSession()`

---

## 本轮范围（冻结）

必须实现以下命令：

1. `openkin chat --session <id>`
   - 使用已有 session 继续对话
   - 若 session 不存在，报明确错误
2. `openkin sessions show <id>`
   - 查看单个 session 元信息
   - 支持文本输出与 `--json`
3. `openkin sessions messages <id>`
   - 查看消息历史
   - 支持 `--limit <n>`
   - 支持文本输出与 `--json`
4. `openkin sessions delete <id>`
   - 删除 session
   - 默认文本确认输出
   - 支持 `--json`

---

## 本轮不做

- 不做自动恢复最近 session
- 不做 session 交互选择器
- 不做 `messages export`
- 不做回滚
- 不做对消息内容的富文本渲染
- 不做多 session 并发聊天

---

## 单一路径实现要求

按以下顺序执行，不自行换路径：

1. 在 `packages/cli/src/` 中补充 `sessions` 命令分发
2. 为 `chat` 增加 `--session <id>` 参数
3. 复用 `@openkin/client-sdk` 的现有方法，不新增 SDK contract
4. 新增或更新 CLI smoke，覆盖：
   - 新 session 聊天
   - `sessions list`
   - `sessions show`
   - `sessions messages`
   - `sessions delete`
   - `chat --session <id>`
5. 更新 CLI help 文案

---

## 允许修改的目录

- `packages/cli/`
- `scripts/`
- 根目录 `package.json`（仅 CLI/test scripts）
- `docs/exec-plans/active/`

## 禁止修改的目录

- `packages/sdk/client/src/`（默认不改）
- `packages/shared/contracts/src/`
- `packages/core/src/`
- `packages/server/src/http-server.ts`
- `apps/web-console/`
- `apps/dev-console/`

---

## 验收标准

1. `openkin chat --session <id>` 可在已有 session 上继续对话
2. `openkin sessions show <id>` 正常返回
3. `openkin sessions messages <id>` 正常返回
4. `openkin sessions delete <id>` 删除成功
5. 新增 smoke 覆盖以上路径
6. `pnpm test:project-cli` 通过
7. `pnpm verify` 通过

---

## 必跑命令

1. `pnpm test:project-cli`
2. `pnpm verify`

---

## 升级条件

命中以下任一情况时立即停止并升级：

- 需要修改 `packages/sdk/client` 的对外边界
- 需要新增 session 相关 endpoint 或 DTO
- 需要引入回滚、打断、自动恢复最近会话等新语义
- 连续两轮无法同时通过 `pnpm test:project-cli` 与 `pnpm verify`

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

当前任务：
实现 CLI 会话工作流：chat --session、sessions show/messages/delete。

任务范围：
- 允许修改的目录：
  - packages/cli/
  - scripts/
  - package.json（仅 CLI/test scripts）
- 不允许修改的目录：
  - packages/sdk/client/src/
  - packages/shared/contracts/src/
  - packages/core/src/
  - packages/server/src/http-server.ts
  - apps/web-console/
  - apps/dev-console/

不做什么：
- 不做自动恢复最近 session
- 不做回滚
- 不做打断
- 不新增 endpoint / DTO

验收标准：
- `pnpm test:project-cli` 通过
- `pnpm verify` 通过

升级条件：
- 需要改 SDK 边界
- 需要改共享 contract
- 连续两轮无法通过验收
```
