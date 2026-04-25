---
skill-id: weather
description: |
  查询城市天气预报（模拟数据）。
  输入 city（城市名，支持中文或英文），返回天气预报字符串。
permissions:
  read: ["."]
  net: []
  write: []
  env: ["SKILL_ARGS", "SKILL_ID"]
---

# Weather Skill

## 能力说明

查询指定城市的模拟天气预报，返回天气状况和温度信息。

## 参数

- `city`（string，必填）：城市名，支持中文（如 北京）或英文（如 Beijing）

## 调用方式

通过执行本目录下的 `weather.ts` 脚本：

```bash
SKILL_ARGS='{"city":"Beijing"}' SKILL_ID="weather" tsx weather.ts
```

`SKILL_ARGS` 为 JSON 字符串，包含以下字段：
- `city`（string）：目标城市名称

## 返回格式

脚本将以下 JSON 输出到 stdout，exitCode 为 0：

```json
{ "city": "Beijing", "forecast": "晴，25°C" }
```

## 错误处理

- 城市名未知时返回 `{ "city": "Unknown", "forecast": "未知城市" }`
- `SKILL_ARGS` 格式错误时退出 exitCode 为 1，stderr 中有错误信息
