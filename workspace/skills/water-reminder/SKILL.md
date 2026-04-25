---
name: 喝水提醒
description: 提醒用户定时喝水，保持身体健康。脚本：run.ts（用法：run_script water-reminder run.ts）
permissions:
  - env
---

# 喝水提醒技能

这个技能用于提醒用户定时喝水，帮助养成良好的饮水习惯。

## 功能
- 设置提醒间隔时间
- 显示喝水提醒消息
- 记录喝水次数
- 提供健康饮水建议

## 使用方法

```bash
# 基本使用（默认30分钟提醒一次）
run_script water-reminder run.ts

# 自定义提醒间隔（单位：分钟）
run_script water-reminder run.ts '{"interval": 45}'

# 设置提醒次数限制
run_script water-reminder run.ts '{"interval": 30, "maxReminders": 5}'
```

## 参数
- `interval`: 提醒间隔时间（分钟），默认30分钟
- `maxReminders`: 最大提醒次数，默认无限制
- `message`: 自定义提醒消息

## 健康建议
- 成年人每天建议饮水量：1500-2000ml
- 少量多次饮水，不要等到口渴才喝水
- 运动后、起床后、睡前都要适量补水
