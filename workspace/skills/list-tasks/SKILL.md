---
skill-id: list-tasks
description: 列出当前所有的定时任务
permissions:
  read: ["."]
  net: ["127.0.0.1:3333"]
  write: []
  env: ["SKILL_ARGS", "SKILL_ID", "THEWORLD_SERVER_URL", "THEWORLD_API_KEY", "THEWORLD_INTERNAL_PORT"]
---

# List Tasks Skill

通过调用 TheWorld 服务器 API，获取当前所有的定时任务列表。

## 调用方式

```
run_script(
  skillId = "list-tasks",
  script  = "list-tasks.ts"
)
```

## 输出格式

返回 JSON 格式的定时任务列表，包含任务 ID、名称、触发类型、下次执行时间等信息。