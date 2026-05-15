---
skill-id: fibonacci-calculator
name: 斐波那契数列计算器
description: 计算斐波那契数列前n项的skill
permissions:
  read: ["."]
  net: []
  write: []
  env: ["SKILL_ARGS", "SKILL_ID"]
---

# 斐波那契数列计算器

这是一个计算斐波那契数列前n项的skill。

## 使用方法

调用此skill时，可以传入一个参数：
- `n`: 要计算的斐波那契数列项数（默认为10）

## 示例

```json
{
  "n": 20
}
```

## 功能说明

- 计算斐波那契数列的前n项
- 支持自定义项数
- 输入验证（只接受非负整数）
- 额外输出前1项的结果