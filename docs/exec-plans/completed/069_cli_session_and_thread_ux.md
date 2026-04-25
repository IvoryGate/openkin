# 069 CLI Session 与 Thread UX

## 目标

把 TheWorld CLI 的 session / thread 体验从“知道 id 的人可用”升级为产品级 attach / switch / resume 路径。

本单只解决：

1. recent thread / picker / resume / continue 的统一叙事
2. `displayName -> alias -> shortId` 在 shell 全面的统一投射
3. shell 中 session / thread 入口的位置与文案

---

## 背景

- 当前 CLI 已经具备 `displayName`、alias、`--resume`、`--continue`、`--pick`，但仍缺少完整 thread UX。
- `THEWORLD_CLI_SHELL_PARITY_DESIGN.md` 已将 session / thread surface 提升为 shell 核心产品面。
- 参考项目的差距不只在“是否能继续会话”，而在“进入 thread 的路径是否像产品”。

---

## 修改范围（冻结）

**允许修改：**

- `packages/cli/src/chat-session-resolve.ts`
- `packages/cli/src/cmd-chat.ts`
- `packages/cli/src/cmd-sessions.ts`
- `packages/cli/src/chat-status.ts`
- `packages/cli/src/session-alias.ts`
- `packages/cli/src/help.ts`
- `packages/cli/src/tui/**`（仅限 session/thread surface 所需信息投射）
- `scripts/test-project-cli.mjs`
- `docs/requirements/PROJECT_CLI.md`
- `docs/requirements/THEWORLD_CLI_SHELL_PARITY_DESIGN.md`
- 本工单与 `active/README.md`

**禁止修改：**

- `packages/shared/contracts/**`
- `packages/sdk/**`
- `packages/server/**`
- `packages/core/**`
- `apps/web-console/**`
- richer thread metadata contract（留给 Wave 2）

---

## 单一路径设计（冻结）

1. session identity 统一为：
   - `displayName`
   - `alias`
   - `shortId`
2. 以下 surface 必须叙事一致：
   - home shell
   - picker
   - header
   - footer / status rail
   - `sessions list`
   - `--resume` / `--continue` / error hints
3. `--pick` 继续是 TTY-only，但其体验必须是产品入口，而不是临时技术分支。
4. 本单不要求新增 thread preview contract；若现有 `listSessions` 数据不足以支撑更深 thread UX，应显式停止并升级。

---

## 验收标准

1. `pnpm test:project-cli` 通过。
2. `pnpm verify` 通过。
3. `displayName -> alias -> shortId` 在 list / picker / header / footer / resume 叙事上不再冲突。
4. `--resume` / `--continue` / `--pick` 行为不回退。

---

## 升级条件

命中任一即停止并升级：

- 需要 richer thread metadata 才能继续推进目标
- 需要新增搜索/排序 API
- 需要做完整 sidebar thread list 但现有返回数据不足
- `pnpm verify` 连续两轮不通过

---

## 必跑命令

```bash
pnpm test:project-cli
pnpm verify
```

---

## 不做什么

- 不新增 session/thread DTO
- 不实现完整 thread preview contract
- 不把本地 alias 提升为服务端 contract
