---
skill-id: delete-task
description: 删除指定的定时任务
permissions:
  read: ["."]
  net: ["127.0.0.1:3333"]
  write: []
  env: ["SKILL_ARGS", "SKILL_ID", "THEWORLD_SERVER_URL", "THEWORLD_API_KEY", "THEWORLD_INTERNAL_PORT"]
---

# Delete Task Skill

通过调用 TheWorld 服务器 API，删除指定的定时任务。

## 调用方式

```
run_script(
  skillId = "delete-task",
  script  = "delete-task.ts",
  args    = { taskId: "任务ID" }
)
```

## args 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | ✅ | 要删除的任务ID |

## 示例

```json
{
  "skillId": "delete-task",
  "script": "delete-task.ts",
  "args": {
    "taskId": "f1586f52-ab84-4d80-b953-047485348e5b"
  }
}
```