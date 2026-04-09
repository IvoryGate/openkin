# 043 TS Symbol Alias Migration

## 目标

为仍带有 `OpenKin*` 命名的公开 TypeScript symbol 增加 `TheWorld*` 命名或更中性的兼容出口，同时保留旧 symbol 作为 deprecated alias。

---

## 当前前置状态

假定以下已完成：

- `040` package scope 已迁移到 `@theworld/*`
- `042` 高风险 rename 决策已完成

---

## 本轮范围（冻结）

必须完成：

1. 盘点 SDK / server / core 中仍为 `OpenKin*` 的导出 symbol
2. 新增兼容 alias
3. 为旧命名添加 deprecation 说明
4. 不破坏现有 imports

---

## 本轮不做

- 不改 wire contract
- 不删旧 symbol
- 不改 HTTP path
- 不改 DB / workspace 命名

---

## 验收标准

1. 新旧 symbol 都可用
2. 现有编译与 smoke 不回退
3. `pnpm check` 通过
4. 如触及较多导出面，再跑 `pnpm verify`

---

## 升级条件

- 需要 breaking rename
- 需要同时改外部文档与示例超出当前范围
