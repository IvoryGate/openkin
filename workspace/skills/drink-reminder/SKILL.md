---
name: 喝水提醒
description: 每分钟提醒喝水的定时任务
permissions:
  - env
  - write
  - read
  - net
---

# 喝水提醒

这个技能用于创建每分钟提醒喝水的定时任务。

## 使用方法

```bash
# 创建喝水提醒任务
run_script drink-reminder run.ts --args '{"action": "start"}'

# 停止喝水提醒任务
run_script drink-reminder run.ts --args '{"action": "stop"}'
```