# 060 CLI Session Identity 与 TTY Attach

## 目标

在不改 Service / SDK contract 的前提下，把 TheWorld CLI 的“继续某次对话”体验收口为更像产品能力的单一路径：

1. 统一 session identity 展示：`displayName`、本地 alias、短 id 的展示顺序
2. 增加 **TTY-only** 的最近会话 attach / pick 入口
3. 让 `chat --continue`、`--resume`、banner、status、session list 的叙事更一致

---

## 背景

- 现有能力已经有：服务端 `displayName`、CLI 本地 alias、`--continue` / `--resume`、`sessions list`。
- 但当前继续对话仍偏“知道 id 的人用得顺”，不够像成熟 CLI 的“先选，再进入”体验。
- 本单吸收参考项目的重点不是多标签模式，而是**入口前置的人类可读身份信息**。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/chat-args.ts`
- `packages/cli/src/chat-session-resolve.ts`
- `packages/cli/src/cmd-chat.ts`
- `packages/cli/src/cmd-sessions.ts`
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/session-alias.ts`
- `packages/cli/src/help.ts`
- `scripts/test-project-cli.mjs`
- `docs/requirements/PROJECT_CLI.md`
- `docs/requirements/THEWORLD_CLI_SHELL_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `packages/cli/src/tui/**`（更高层 shell parity 路线留给 `067`–`072`）

---

## 单一路径设计（冻结）

1. 新增 **TTY-only** 入口：`theworld chat --pick`
   - 调用现有 `listSessions({ kind: 'chat' })`
   - 列出最近若干 chat session
   - 用户输入编号后进入该 session
   - 非 TTY 直接报错并提示改用 `--resume <id>`
2. session 展示优先级冻结为：
   - 主标题：`displayName`
   - 次级提示：本地 alias（若与 displayName 不同）
   - 保底标识：短 id
3. `--resume <alias>` 与 `--resume <id>` 语义不变；`--pick` 只是更顺手的 TTY 入口。
4. 不新增 `sessions pick`、不新增 fuzzy search、不过早做全屏选择器。

---

## 验收标准

1. `pnpm test:project-cli` 覆盖：
   - `chat --pick` 的 TTY-only 报错路径
   - `displayName` / alias / id 的展示顺序不冲突
   - `--resume` / `--continue` 现有行为不回退
2. `pnpm verify` 通过。

---

## 升级条件

- 需要改 Session API 返回结构
- 需要新增服务端搜索/排序接口
- 需要把 picker 做成全屏 TUI
- `pnpm verify` 连续两轮不通过

---

## 必跑命令

```bash
pnpm test:project-cli
pnpm verify
```

---

## 不做什么

- 不新增 Session 搜索 API
- 不把本地 alias 提升为服务端 contract
- 不做 GUI 风 session chooser
- 不做 message 预览 / rewind / rollback
