---
skill-id: create-task
description: |
  通过 HTTP API 创建定时任务。支持三种触发类型：cron（Cron 表达式）、interval（固定间隔秒数）、once（单次执行）。
permissions:
  read: ["."]
  net: ["127.0.0.1:3333"]
  write: []
  env: ["SKILL_ARGS", "SKILL_ID", "OPENKIN_SERVER_URL", "OPENKIN_API_KEY", "OPENKIN_INTERNAL_PORT"]
---

# Create Task Skill

通过调用 OpenKin 服务器 API，将一条定时任务写入数据库。任务到期后，调度器会自动触发 Agent 执行。

## 参数（通过 SKILL_ARGS 传入）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 任务名称 |
| `agentId` | string | ✅ | 执行任务的 Agent ID（默认用 `"default"`） |
| `input` | string | ✅ | 触发时发送给 Agent 的消息文本 |
| `triggerType` | `"cron"` / `"interval"` / `"once"` | ✅ | 触发类型 |
| `triggerConfig` | object | ✅ | 触发配置（见下方） |
| `enabled` | boolean | ❌ | 是否启用，默认 `true` |

## triggerConfig 格式

### cron
```json
{ "cron": "0 9 * * 1-5" }
```
标准 5 段 Cron 表达式（分 时 日 月 周）。

### interval（固定间隔）
```json
{ "interval_seconds": 300 }
```
单位：秒。每 300 秒执行一次。

### once（单次）
```json
{ "once_at": 1754000000000 }
```
Unix 毫秒时间戳。

## 示例

```json
{
  "name": "每日日报",
  "agentId": "default",
  "input": "请生成今日工作日报",
  "triggerType": "cron",
  "triggerConfig": { "cron": "0 9 * * 1-5" }
}
```

```json
{
  "name": "每5分钟喝水提醒",
  "agentId": "default",
  "input": "请提醒用户喝水",
  "triggerType": "interval",
  "triggerConfig": { "interval_seconds": 300 }
}
```

## 注意事项

- 任务执行结果存储在数据库 `task_runs` 表中，可在 Web Console 的「定时任务」页面查看
- 任务触发后 Agent 的回复只会记录在 session 里，**不会主动推送通知**
- 创建后任务会立即出现在 Web Console 的「定时任务」页面
