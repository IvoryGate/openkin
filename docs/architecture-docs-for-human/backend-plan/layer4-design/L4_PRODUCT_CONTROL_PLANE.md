# L4 · Product control plane（本地）

## 与 L5 的区分

- **L4 product control plane**：本地、terminal-first、由 CLI/TUI 展示的「当前工作区 + 服务 + 能力」聚合态。典型入口：`theworld inspect status`、TUI/行模式中的状态行。
- **L5 control plane**（如 remote account / 多 surface 连续）**不在**本概念内；L4 文档与代码不得将二者混名。

## 状态来源

聚合态只 **读取** 第三层已有能力，不重新定义 schema。来源类别与权威表见：

- [L4 Product Shell Map（agent 向）](../../../architecture-docs-for-agent/fourth-layer/L4_PRODUCT_SHELL_MAP.md) 第 2 节
- 实现内枚举：`packages/cli/src/l4-product-map.ts` 中的 `L4_CONTROL_PLANE_STATE_SOURCES`

## 进一步阅读

- [LAYER4_DESIGN.md](./LAYER4_DESIGN.md) — 第四层总述
- [099 执行计划（归档后路径）](../../../exec-plans/completed/099_l4_product_control_plane_and_shell_map.md) — 本抽象冻结工单
