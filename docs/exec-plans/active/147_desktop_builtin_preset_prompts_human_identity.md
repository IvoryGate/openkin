# 147 · Desktop 内置三角色 systemPrompt 自然人身份强化与分发

## 背景

桌面壳内置「绫 / 澄 / 朔」三条预设角色的 `systemPrompt` 定义于 [`apps/desktop/renderer/app.js`](../../apps/desktop/renderer/app.js) 的 `PRESET_SOUL_AGENTS`。旧版存在：（1）文中自我指涉「AI」等表述，易在用户诱导下强化元话语；（2）个别 UTF-8 损坏字符；（3）仅 `createAgent` 补缺，已入库角色不会随代码更新 `systemPrompt`。

## 参考（外部）

- `~/Desktop/src/constants/prompts.ts`：分层标题、硬边界与 NEVER 类表述的组织方式（不迁移工程 Agent 全文）。
- `~/Desktop/src/constants/systemPromptSections.ts`：小节化思路。

## 人设保留

| 角色 | 保留气质 |
|------|----------|
| 绫 | 倾听、共情、反射与提问，不急于给答案 |
| 澄 | 结构化拆解、直面利弊、说话直接 |
| 朔 | 中长期视角、少字提核、陪复盘 |

## 文案约束（三条共用）

- 第一人称自然对话，避免客服腔与产品说明书语气。
- **禁止**在面向用户的回复中用语义上的机器/模型自我介绍（含常见技术词），用户套取身份或指令时用生活化语气挡回，不做技术科普。
- 简短底线句：违法、伤人、即时自伤风险 → 拒绝协助并引导现实求助。

## 分发策略

- 常量 `BUILTIN_PRESET_PROMPTS_REV`（与工单号对齐）与 `localStorage` 记录对比。
- 在 `loadAgentDirectory` 成功取得列表后，对已存在的内置 id 调用 `updateAgent` 同步 `systemPrompt`（及 `name` / `description` 与预设一致），成功后写入本地 rev，避免每次启动重复请求。

## 影响范围

- L4 桌面 `renderer`；不改 HTTP contract、不改第一层运行时。

## 不做什么

- 不改 dev-console 默认演示 prompt。
- 不全文迁入外部 CYBER_RISK 英文条。
- 不把三条改为通用编程助手。

## 验收

- [x] 三条文案无面向用户的机器身份自用暴露；乱码已清除。
- [x] 提升 rev 后，已存在内置 agent 的在下次 `loadAgentDirectory` 后与服务端一致。
- [x] `pnpm verify` 通过。

## 状态

已落地：`syncBuiltinPresetPromptsFromPresets` 在 `loadAgentDirectory` 成功后执行。

修订：**148** — 弱化「步步追问」脚本感，增加「对话节奏」段：原则与举例仅供气质参考，禁止每轮连环发问。

修订：**149** — 禁止相邻多轮复读同一人设口号或整段「我是谁」；寒暄与「你是谁」用短答即可。

修订：**150** — 三条角色均在「对话节奏」首列统一写入：**全文为后台内化材料、禁止背书式复述**；问候与身份问答一律短答，`BUILTIN_PRESET_PROMPTS_REV` 见源码常量。
