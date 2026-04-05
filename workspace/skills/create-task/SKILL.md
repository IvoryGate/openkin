---
skill-id: create-task
description: |
  【定时/周期/未来时间任务】用于创建会在未来反复执行或定时执行的任务，并持久化到调度系统。
  适用场景举例：「每天提醒我喝水」「每隔30分钟执行一次」「每周一早上发日报」「5分钟后提醒我」。
  注意：此 Skill 不会立刻执行任务内容，只是向服务器注册一条调度记录，之后由调度器按时触发。
  调用方式：run_script(skillId="create-task", script="create-task.ts", args={...})。
  支持三种触发类型：
  - cron：标准 cron 表达式，args 示例 {"name":"任务名","agentId":"default","input":"触发文本","triggerType":"cron","triggerConfig":{"cron":"0 9 * * 1-5"}}
  - interval（固定间隔）：args 示例 {"name":"喝水提醒","agentId":"default","input":"提醒用户喝水","triggerType":"interval","triggerConfig":{"interval_seconds":1800}}（interval_seconds 单位：秒，1800=30分钟）
  - once（单次）：args 示例 {"name":"一次性任务","agentId":"default","input":"执行内容","triggerType":"once","triggerConfig":{"once_at":1754000000000}}（once_at 为 Unix 毫秒时间戳）
  注意：script 参数必须传 "create-task.ts"，不能省略。
permissions:
  read: ["."]
  net: ["127.0.0.1:3333"]
  write: []
  env: ["SKILL_ARGS", "SKILL_ID", "OPENKIN_SERVER_URL", "OPENKIN_API_KEY", "OPENKIN_INTERNAL_PORT"]
---

# Create Task Skill

通过调用 OpenKin 服务器 API，将一条定时任务写入数据库。任务到期后，调度器会自动触发 Agent 执行。

## 调用方式

```
run_script(
  skillId = "create-task",
  script  = "create-task.ts",   ← 必须填写这个文件名
  args    = { ... }             ← 见下方参数说明
)
```

## args 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 任务名称 |
| `agentId` | string | ✅ | 执行任务的 Agent ID（默认用 `"default"`） |
| `input` | string | ✅ | 触发时发送给 Agent 的消息文本 |
| `triggerType` | `"cron"` / `"interval"` / `"once"` | ✅ | 触发类型 |
| `triggerConfig` | object | ✅ | 触发配置（见下方） |
| `enabled` | boolean | ❌ | 是否启用，默认 `true` |

## triggerConfig 格式

### cron（按 cron 表达式定时）
```json
{ "cron": "0 9 * * 1-5" }
```
标准 5 段 Cron 表达式（分 时 日 月 周），UTC 时区。

### interval（固定间隔重复）
```json
{ "interval_seconds": 60 }
```
单位：**秒**。每 60 秒执行一次。1分钟=60，5分钟=300，1小时=3600。

### once（单次执行）
```json
{ "once_at": 1754000000000 }
```
Unix 毫秒时间戳。用 `Date.now() + 60000` 算出 1 分钟后。

## 完整示例

### 每分钟喝水提醒
```json
{
  "skillId": "create-task",
  "script": "create-task.ts",
  "args": {
    "name": "喝水提醒",
    "agentId": "default",
    "input": "请提醒用户喝水",
    "triggerType": "interval",
    "triggerConfig": { "interval_seconds": 60 }
  }
}
```

### 每日早报（工作日9点）
```json
{
  "skillId": "create-task",
  "script": "create-task.ts",
  "args": {
    "name": "每日早报",
    "agentId": "default",
    "input": "请生成今日工作日报",
    "triggerType": "cron",
    "triggerConfig": { "cron": "0 9 * * 1-5" }
  }
}
```

## 注意事项

- `script` 参数必须传 `"create-task.ts"`，不可省略
- 任务执行结果存储在数据库 `task_runs` 表中，可在 Web Console 的「定时任务」页面查看
- 任务触发后 Agent 的回复只会记录在 session 里，**不会主动推送通知**
- 创建后任务会立即出现在 Web Console 的「定时任务」页面
