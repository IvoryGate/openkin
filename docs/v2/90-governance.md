# v2 仓库治理

## 一、分支策略

```
main                          # 稳定参考线
  └── explore/v2-from-scratch # v2 探索分支（当前）
        └── feature/*         # v2 功能分支
```

- `main`：保持稳定，只接受已验证的 PR
- `explore/v2-from-scratch`：v2 主开发分支
- `feature/*`：从 `explore/v2-from-scratch` 分出的功能分支

## 二、提交规范

```
<type>(<scope>): <subject>

<body>

<footer>
```

type：
- `feat`：新功能
- `fix`：修复
- `docs`：文档
- `style`：格式（不影响代码运行）
- `refactor`：重构
- `test`：测试
- `chore`：构建/工具

scope：
- `core`：L1 Core
- `service`：L3 Service
- `cli`：L4 CLI
- `desktop`：L5 Desktop
- `sdk`：SDK
- `docs`：文档
- `ci`：CI/CD

## 三、PR 流程

1. 从 `explore/v2-from-scratch` 创建功能分支
2. 开发并本地验证
3. 提交 PR 到 `explore/v2-from-scratch`
4. CI 自动验证
5. 代码审查
6. 合并

## 四、文档维护

- 任何架构变更更新 `docs/v2/`
- 任何 API 变更更新 SDK 类型定义
- 任何新增能力更新执行计划
- 任何 bug 修复更新测试用例

## 五、质量基线

- 所有代码必须通过 TypeScript 类型检查
- 所有新增代码必须有单元测试
- 所有 PR 必须通过 CI 验证
- 所有文档变更必须通过 `lint:docs`
