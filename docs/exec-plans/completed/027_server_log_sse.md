# 027 — 服务端日志 SSE 实时流 + 日志规范化

## 目标

1. **日志规范化**：统一 `logger.ts` 输出格式，加 `level` 字段，stderr 输出加 ANSI 颜色，左括号标识符统一。
2. **server log SSE**：新增 `GET /v1/logs/stream` 接口，服务端向客户端推送 stderr/agent 日志的实时 SSE 流。
3. **Web 实时日志面板**：新建 `ServerLogsView.vue`，展示实时滚动的服务端输出，支持级别过滤与颜色标识。

## 修改范围

| 文件 | 操作 |
|------|------|
| `packages/server/src/logger.ts` | 规范 `formatStderr`，加 `level` 字段，加 ANSI 颜色 |
| `packages/server/src/cli.ts` | 所有 `console.error` 改用 `serverLog()` 统一格式 |
| `packages/server/src/http-server.ts` | 新增 `GET /v1/logs/stream` SSE 路由；暴露 `ServerLogBus` |
| `packages/shared/contracts/src/index.ts` | 新增 `apiPathLogStream()` 路径函数 |
| `apps/web-console/src/views/ServerLogsView.vue` | 新建实时日志面板 |
| `apps/web-console/src/router.ts` | 注册 `/server-logs` 路由 |
| `apps/web-console/src/components/NavBar.vue` | 加导航 tab |

## 验收标准

- [ ] `pnpm verify` 通过（build + lint）
- [ ] logger.ts 每条日志含 `level`（INFO/WARN/ERROR/DEBUG）字段
- [ ] stderr 输出同一行包含：`[时间戳] [LEVEL] [来源] 内容`
- [ ] `GET /v1/logs/stream` 返回 SSE，每条 event 为一行日志 JSON
- [ ] Web 面板实时显示最新日志，支持 INFO/WARN/ERROR/DEBUG 过滤，不同级别不同颜色
- [ ] 面板支持暂停/继续滚动，最多缓存 500 条

## 决策记录

- SSE 推送的内容与文件日志保持相同结构（JSON Lines），前端直接解析
- 不做历史日志回放（历史由现有 `/v1/logs` 接口负责），SSE 仅推实时
- `serverLog()` 封装 `console.error`，保持向后兼容（非 breaking change）
- ANSI 颜色仅在 TTY 环境下生效（`process.stderr.isTTY` 判断）

## 允许修改

- `packages/server/src/`
- `apps/web-console/src/`
- `packages/shared/contracts/src/`

## 禁止修改

- 数据库 schema（不需要新表）
- 现有 `/v1/logs` 接口行为

## 必跑命令

```bash
pnpm --filter @openkin/shared-contracts build
pnpm --filter @openkin/server build
pnpm --filter web-console build
```
