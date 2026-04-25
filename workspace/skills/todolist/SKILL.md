---
name: Todo List Manager
description: 一个简单的待办事项管理技能，可以添加、查看、删除和标记完成任务
permissions:
  - read
  - write
  - env
---

# Todo List Manager

这是一个简单的待办事项管理技能，允许用户：
- 添加新的待办事项
- 查看所有待办事项
- 标记任务为已完成
- 删除任务

## 使用方法

```
# 添加任务
run_script todolist run.ts --args '{"action":"add","task":"学习 TypeScript"}'

# 查看所有任务
run_script todolist run.ts --args '{"action":"list"}'

# 标记任务完成
run_script todolist run.ts --args '{"action":"complete","id":1}'

# 删除任务
run_script todolist run.ts --args '{"action":"delete","id":1}'
```

## 参数说明

- `action`: 操作类型 (add, list, complete, delete)
- `task`: 任务内容 (仅在 action=add 时使用)
- `id`: 任务ID (仅在 action=complete 或 delete 时使用)
