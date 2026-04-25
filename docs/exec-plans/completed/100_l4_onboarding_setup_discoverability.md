# 100 · L4 Onboarding Setup Discoverability

## 目标

让本地 CLI/TUI 在首次使用、空态、配置缺失、工具/Skill 发现和失败恢复时具备清晰引导。

本单解决“用户不翻文档也知道下一步该做什么”，不解决后续 context / memory / approval 的完整产品流。

## 背景

第四层要成为 terminal-first 工程产品，不能只暴露命令。用户需要看到：

- provider / model 配置状态
- workspace / profile 初始化状态
- 权限与危险操作说明
- tool / skill discoverability
- 示例任务和常用命令
- 失败后的修复引导

## 已冻结决策

1. onboarding 是 L4 本地产品能力，不是 Web / Desktop / channel 入口。
2. 首期优先做 CLI/TUI 可见空态、help 与配置提示，不引入复杂账号系统。
3. 配置引导只说明本地 `THEWORLD_*` 与已有配置入口，不新增 provider 管理平台。
4. 失败引导应指向可执行命令或 inspect surface，而不是长篇文档。

## 允许修改

- `packages/cli/src/`
- `scripts/`
- `docs/architecture-docs-for-agent/fourth-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer4-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- `packages/server/src/`（除非仅为读取已有 status 做极小适配，并先确认不需新增 contract）
- `packages/sdk/client/`
- `packages/channel-core/`
- `apps/web-console/`
- L5 account / pairing / remote onboarding
- 大规模 TUI 视觉重写

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `098_l4_engineering_product_shell_parent.md`
- `../completed/099_l4_product_control_plane_and_shell_map.md`
- CLI help、TUI home shell、settings/config 相关文件

## 本轮范围

1. 定义首次启动与空态检查项。
2. 在 CLI/TUI 中呈现 provider/model/workspace/profile 基础状态。
3. 增强 help / command discoverability，展示下一步动作。
4. 展示工具/Skill 发现入口与权限说明。
5. 为常见失败（server 不可用、配置缺失、无 session）提供修复提示。

## 本轮不做

- 不做远程账号登录。
- 不做 channel pairing。
- 不做完整 settings UI。
- 不做 memory / approval / background 的深层 UX。
- 不做真实 LLM 网络验证。

## 验收标准

1. 新用户在本地 CLI/TUI 空态中能看到可执行下一步。
2. 配置缺失或 server 不可用时，错误提示包含修复路径。
3. 工具和 Skill 能被发现，并能引导到 inspect/help 入口。
4. 至少一条自动化验证覆盖 onboarding/help/error hint。
5. `pnpm check` 通过。
6. `pnpm verify` 通过。

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要设计跨 surface 账号或远程配置系统。
2. 需要新增 L5 onboarding / pairing contract。
3. 需要大幅重写 TUI 架构才能表达空态。
4. `pnpm verify` 连续两轮不通过。

## 关账与交付

- 登记表：`docs/architecture-docs-for-agent/fourth-layer/L4_ONBOARDING.md`；人类向：`docs/architecture-docs-for-human/backend-plan/layer4-design/L4_ONBOARDING.md`
- 实现：`packages/cli/src/l4-onboarding.ts`（profile 行 + `errorRecoveryExtraLines`）、`errors.ts` 的 `exitWithCliError`；`help` `First run` 段；`chat-banner` 行模式 L4 块；TUI `ChatTuiHomeShell` 本地 profile；`sessions list` 空表提示；`index`/`cmd-chat`/TUI 会话入口统一恢复行
- 自动化：`pnpm test:l4-onboarding`（已并入 `verify`）

**下一子单：[`104`](./104_l4_background_resume_recover.md).**（`101`–`103` 已归档：见同目录 101/102/103。）
