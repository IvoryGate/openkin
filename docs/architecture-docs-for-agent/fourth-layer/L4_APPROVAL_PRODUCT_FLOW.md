# L4 Permission & Approval Product Flow（103）

## 目标

在 **不** 改 L3 审批 DTO 的前提下，让 `RiskClass`、待审批、批准/拒绝/取消与 **与 `GET /v1/tools` 的 risk 元数据对齐** 的提示，在本地 CLI / TUI 中可读、可执行、可恢复。

## 与 L3 的契约

- 队列与路由：`GET/POST /v1/approvals`、`GET /v1/approvals/:id`、`POST .../approve|deny|cancel`、`GET /v1/approvals/events`（见 093、THIRD_LAYER）。
- **`GET /v1/approvals`** 返回进程序列内全部记录（**较新 `requestedAt` 在前**），供 `theworld inspect approvals` 列表。

## 用户入口

| 入口 | 行为 |
|------|------|
| `theworld inspect approvals [--json]` | 人读表格 + 各终态 **recovery 一行** |
| `theworld inspect approval <id>` | 单条展示 + recovery |
| `theworld inspect approval <id> approve\|deny\|cancel` | 本地操作 L3 已有路由 |
| `theworld inspect tools` | 行内展示 **risk=** 与 **cat=**（096 metadata） |
| `theworld inspect status` | 提示 `inspect approvals` |
| 行模式 `chat` 每轮后 | 在 context/memory 后增加 `inspect approvals` 灰字 |
| TUI 输入上方 rail | 在 ctx/mem 后追加 `appr·N pending`（本会话 + pending） |
| `/approvals` | 本会话过滤后的列表（同 human 表） |

## 实现索引

- `packages/cli/src/l4-approval-surface.ts` — 表格式与 recovery 文案
- `packages/sdk/operator-client` — `listApprovals`、`getApproval`、`createApproval`、resolve 族
- `packages/server` — `ApprovalPlane.listAll` + `GET /v1/approvals`
- `pnpm test:l4-approval`

## 升级条件

见工单 `103`（若需强制 gate 所有危险工具、或改 L3 DTO、或远程审批，则停单升级）。
