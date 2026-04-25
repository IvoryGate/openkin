# 044 Skill And Console Compat Cleanup

## 目标

清理 rename 兼容窗口里最容易造成行为裂缝的用户配置面：

- workspace skills 环境变量读取
- SKILL.md 中的 env 列表
- Web Console branding / localStorage 历史键
- 相关用户帮助与示例

---

## 当前前置状态

假定以下已完成：

- `041` Env Docs Scripts Rename
- `042` 高风险 rename 决策已完成

---

## 本轮范围（冻结）

必须完成：

1. Skill 脚本与 SKILL.md 支持 `THEWORLD_*`，并兼容 `OPENKIN_*`
2. Web Console 用户可见 branding 收口到 `TheWorld`
3. 本地存储或用户配置键若含旧名，提供兼容读取

---

## 本轮不做

- 不改 shared contract
- 不改 HTTP path
- 不改 DB / metrics 命名

---

## 验收标准

1. Skills 在仅设置 `THEWORLD_*` 时可继续工作
2. Web Console 文案不再默认展示旧产品名
3. `pnpm check` 通过
4. 如波及较广，再跑 `pnpm verify`

---

## 升级条件

- 需要改 service API
- 需要改 persisted data schema
