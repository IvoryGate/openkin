# 036 CLI Terminal UX（终端体验增强）

## 目标

在不引入 TUI 框架的前提下，把当前 CLI 从“能用”提升到“更像日常终端工具”。

核心方向：

- 增加清晰的标题、分隔、阶段提示
- 保留当前简单命令模型
- 继续坚持 Node-first、server-first CLI 壳层

---

## 当前前置状态

假定以下已完成：

- `034` CLI real-use hardening
- `035` CLI slash commands

当前已知缺口：

- `chat` 输出结构还比较平
- 不同事件类型的视觉区分度有限
- 缺少会话头部、帮助区、分隔线、结束提示等终端体验细节

---

## 本轮范围（冻结）

必须增强以下内容：

1. 启动头部
2. 会话头部
3. 输出分隔线
4. slash help 展示样式
5. tool call / tool result / note / answer 的视觉区分
6. 失败信息与下一步提示
7. 颜色关闭兼容（至少允许无色环境正常显示）

推荐方向：

- 使用 ASCII 分隔符
- 继续保留 ANSI 颜色，但不要把可读性建立在颜色上
- 聊天输出避免过度噪音

---

## 本轮不做

- 不引入 Ink / Blessed / Neo-blessed / 全屏 TUI
- 不做光标重绘型复杂界面
- 不做历史面板
- 不做键盘快捷键体系
- 不做自动补全
- 不做进度面板或多列布局

---

## 单一路径实现要求

1. 抽出 CLI 统一展示 helper，例如 banner、divider、section 标题
2. 为 `chat` 增加更明确的 session header
3. 为 agent 输出块增加开始/结束视觉边界
4. 为 tool call / tool result / errors 统一格式
5. `/help` 在交互态内输出紧凑的命令参考块
6. 为无色环境保留纯文本可读性
7. 更新 smoke，至少验证关键文案锚点

---

## 允许修改的目录

- `packages/cli/`
- `scripts/`
- 根目录 `package.json`（仅 CLI/test scripts）
- `docs/requirements/PROJECT_CLI.md`
- `docs/exec-plans/active/`

## 禁止修改的目录

- `packages/server/`
- `packages/sdk/client/`
- `packages/sdk/operator-client/`
- `packages/shared/contracts/`
- `apps/web-console/`

---

## 验收标准

1. `openkin chat` 启动时存在清晰头部与 session 信息
2. `tool_call`、`tool_result`、`message`、`run_failed` 视觉上可区分
3. `/help` 的展示比当前 root help 更适合交互态
4. 无色环境下输出仍可读
5. `pnpm test:project-cli` 通过
6. `pnpm verify` 通过

---

## 必跑命令

1. `pnpm test:project-cli`
2. `pnpm verify`

---

## 升级条件

命中以下任一情况时立即停止并升级：

- 需要引入 TUI 框架
- 需要做复杂终端状态管理
- 需要多行输入编辑能力
- 需要快捷键/自动补全/历史检索
- 连续两轮无法通过 `pnpm verify`

---

## 给弱模型的任务提示

```text
你当前处于 budget mode。

当前任务：
增强 CLI 终端体验，但不能把它做成 TUI。

任务范围：
- 允许修改：packages/cli/、scripts/、PROJECT_CLI.md、相关计划文档
- 禁止修改：server / shared contracts / sdk / web-console

必须做到：
- 增加 banner / divider / section 标题
- 提升 chat 交互态的层次感
- 保持无色环境可读
- 不改变现有 server/client contract

验收标准：
- `pnpm test:project-cli` 通过
- `pnpm verify` 通过

升级条件：
- 需要引入 TUI
- 需要复杂终端状态机
- 连续两轮无法通过验收
```
