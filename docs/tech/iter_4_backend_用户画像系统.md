# 技术文档 - 迭代四：用户画像系统

**迭代轮数**：4  
**迭代主题**：用户画像系统  
**模块类型**：后端（Hono）  
**状态**：开发中

---

## 1. 概述

用户画像系统自动学习用户的行为习惯和偏好，生成个性化的用户档案（User Soul.md），使Agent能够提供更个性化的服务。

---

## 2. 模块结构

```
core/user_profile/
├── UserProfileService.ts  # 用户画像服务
├── BehaviorAnalyzer.ts   # 行为分析器
├── PreferenceAnalyzer.ts  # 偏好分析器
├── types/                 # 类型定义
│   └── profile.ts
└── storage/               # 存储适配器
    └── FileStorage.ts     # 文件存储（复用）
```

---

## 3. 核心功能

### 3.1 行为学习
- 记录用户行为（常用Agent、对话主题、活跃时间等）
- 统计分析
- 时间序列分析

### 3.2 偏好分析
- 沟通风格分析
- 内容偏好分析
- 语气偏好分析

### 3.3 用户Soul.md
- 生成用户画像文件
- 支持查看和编辑
- 导出功能

---

## 4. API端点

- `GET /api/user/profile` - 获取用户画像
- `PUT /api/user/profile` - 更新用户画像
- `GET /api/user/behaviors` - 获取行为记录

---

**文档版本**：1.0  
**最后更新**：2026-03-28
