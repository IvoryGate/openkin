# 152 — UX 打磨：Emoji 移除、间隔选择器、主题适配、启用交互优化

> 状态：**已完成**
> 创建：2026-05-08
> 分支：`feat/l5-client-surface`

---

## 一、问题诊断

| # | 问题 | 影响 |
|---|------|------|
| 1 | 无心跳间隔设置项 | 用户无法自定义系统状态轮询频率，默认固定 5s |
| 2 | Cron 表达式输入不用户友好 | 普通用户不会写 cron 表达式，应提供频率预设选择器 |
| 3 | Toast / 通知颜色与暗色主题不搭 | 硬编码浅色背景色值，暗色模式下对比度差 |
| 4 | "启用"勾选框语义不明 | 新建时勾不勾不清楚含义，应默认启用 |
| 5 | 全局使用 emoji 做图标 | emoji 跨平台渲染不一致、无法适配主题色 |

---

## 二、工单拆分与实施

### T1：设置中增加系统状态轮询间隔

- **位置**：`index.html` — 通用设置 → 新增 `settings-status-poll-interval` select
- **选项**：3s / 5s(default) / 10s / 30s / 关闭轮询
- **JS 绑定**：
  - `defaultSettings.general.statusPollInterval = "5000"`
  - `syncSettingsView` → `bindValue`
  - `bindSettingsView` → `bindSelect` + `applyStatusPollInterval()`
- **`applyStatusPollInterval(value)`**：清除旧 timer，按新间隔重建

### T2：创建任务频率预设选择器

- **位置**：`index.html` — 创建任务表单
- **改动**：
  - 触发类型默认改为 `interval`（定期执行），Cron 降级为"高级"选项
  - `interval` 类型下增加预设下拉：每分钟 / 每5分钟 / 每10分钟 / 每30分钟 / 每小时 / 每天 / 自定义
  - 选"自定义"时展开秒数输入框
  - `once` 类型保持 `datetime-local`
  - `cron` 类型移到最后，placeholder 说明含义
- **JS 逻辑**：`ctfIntervalPresetEl` change 事件 → 控制 custom field 显隐与值同步

### T3：Toast 颜色适配主题

- **CSS 变量化**：将 `.toast-item.toast-success/error/warn/info` 的 `background`/`color`/`border` 全部改为 CSS 变量（带 fallback）
- **暗色覆盖**：`html[data-theme="dark"]` 下覆盖变量值
- 同步对 `.task-source-badge` 做 dark 主题适配

### T4：移除启用勾选框

- 移除 `ctf-enabled` checkbox 和 `settings-field-inline` label
- 按钮文案改为"创建并启用"（`enabled: true` 硬编码）
- 后续如需"创建但不启用"，可追加"仅保存"按钮

### T5：全局移除 emoji，替换为 IconPark 风格 SVG

- **`svgIcon(name)` 函数**：提供 `success` / `error` / `warn` / `info` / `robot` / `user` 六个图标
- 每个图标为 48×48 viewBox 线条风格 SVG，`stroke="currentColor"` 保证主题适配
- **CSS**：`.svg-icon` — `width:1em; height:1em; fill:currentColor; vertical-align:-0.125em`
- **替换点**：
  - Toast 图标：`iconMap[type]` → `svgIcon(type)`
  - 任务来源 badge：`🤖 Agent` → `${svgIcon("robot")} Agent`，`👤 手动` → `${svgIcon("user")} 手动`
  - 心跳告警 toast：移除 `⚠️` 前缀

---

## 三、验收标准

1. ✅ 设置 → 通用 → 系统状态轮询间隔：选择后立即生效
2. ✅ 新建任务 → 默认"定期执行"，频率预设可点选
3. ✅ Toast / badge 在浅色 / 暗色主题下颜色协调
4. ✅ 新建任务表单无"启用"勾选框，按钮显示"创建并启用"
5. ✅ 全局无 emoji，所有图标为 SVG 线条图标且跟随主题色

---

## 四、涉及文件

| 文件 | 改动摘要 |
|------|---------|
| `apps/desktop/renderer/index.html` | 新增轮询间隔 select、频率预设 select、移除启用 checkbox |
| `apps/desktop/renderer/styles.css` | Toast/Badge CSS 变量化 + dark 主题覆盖 + `.svg-icon` 样式 |
| `apps/desktop/renderer/app.js` | `svgIcon()` 函数、`applyStatusPollInterval()`、表单逻辑更新、emoji → SVG 替换 |
