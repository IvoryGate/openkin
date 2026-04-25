# 057 CLI Chat TUI 视觉身份与动效（Ink）

> **状态：已完成（2026-04-15）。** 本文仍位于 `active/` 仅因归档迁移尚未执行；`active/README.md` 已不再将其视为进行中工单。

## 背景

056 完成 **streamRun → sink → Ink 状态** 与 TTY 门禁；首版 UI 以文本块为主，缺少可感知的「壳层身份」与等待态动效。本单在 **不改** Service API / contracts / server 的前提下，只做 **CLI `packages/cli` 内 TUI 呈现**。

## 目标

1. **艺术字 / Logo 区**：终端内可识别的 `TheWorld` chat 横幅（ASCII / 框线字符），窄列自动裁剪或缩短内文，不崩。
2. **字符级动效**（Ink 内，禁止写裸 stdout）：
   - 首次绘制：**逐行或逐段**入场（短时序动画，总时长不超过约 1.5s）。
   - 等待模型 / 工具间隙：**Braille 或点阵** spinner（与行模式 `chat-spinner` 不同路径，仅用 React state 驱动 Ink）。
   - 流式输出中：**闪烁块光标** 附于 `streamBuf` 尾部（可选 `NO_COLOR` 下减弱为静态 `|`）。
3. **布局层次**：转录区与输入区分隔清晰（如 `Box` `borderStyle` / `padding`），与 `style.ts` 的 `NO_COLOR`、`TERM=dumb` 行为一致（无颜色时仍排版正确）。

## 允许修改

| 区域 | 说明 |
|------|------|
| `packages/cli/src/tui/**` | 横幅组件、纯函数 `build*Banner*`、`use*` 动效 hook |
| `packages/cli/src/tui/run-chat-tui.tsx` | 组合横幅、spinner、光标、边框 |
| `scripts/test-project-cli.mjs` | 仅当需更新与 help 无关的锚点时（本单默认不动） |

## 禁止

- 不改 `packages/shared/contracts`、`packages/server`、`packages/sdk/*` 对外形状。
- **禁止** TUI 动效通过 `process.stdout.write` 绕过 Ink（保持 056 stdout 契约）。
- **禁止** `test:project-cli` 依赖 TTY / Ink。

## 验收

```bash
pnpm --filter @theworld/cli check
pnpm test:project-cli
pnpm verify
```

手工（TTY + `--tui`）：见横幅、入场、spinner、流式光标；`NO_COLOR=1` 仍可用。

## 升级条件

- 动效导致 Ink 重绘 CPU 过高或闪烁不可接受 → 降帧率或减动画范围，仍失败则拆 058 专项。
- 需改 stream 事件语义才能完成展示 → 停，另开单。

## 本单已落地（代码索引）

- 横幅 ASCII + 随列宽内宽：[`chat-tui-art.ts`](../../packages/cli/src/tui/chat-tui-art.ts)
- 入场逐行：`ChatTuiBanner` in [`chat-tui-banner.tsx`](../../packages/cli/src/tui/chat-tui-banner.tsx)
- Braille `working…`、流式尾部闪烁光标、转录圆角框：[`run-chat-tui.tsx`](../../packages/cli/src/tui/run-chat-tui.tsx)

## 决策记录

| 日期 | 决策 |
|------|------|
| 2026-04-09 | 创建 057；与 056 接线解耦，视觉与动效独立验收。 |
| 2026-04-09 | 首版：`buildFramedBannerLines` + 52ms 逐行入场；`streamRun` 的 `thinking.begin/end` 驱动 Braille spinner；`streamBuf` 活跃时 ▌/空格闪烁；`NO_COLOR` 时横幅边线不着色。 |

## 依赖

- [056](./056_cli_chat_fullscreen_tui.md)：TUI 入口与 `runChatStreamWithSink`。
