# v2 CI/CD 设计

## 流水线

GitHub Actions 工作流：`.github/workflows/ci.yml`

| Job | 内容 |
|-----|------|
| lint | 文档、架构边界、工作区结构 |
| build | `pnpm check` + `pnpm build` |
| test-l1 … test-l5 | 分层验证脚本 `scripts/verify/` |
| verify | 完整 `pnpm verify` |

## 本地验证

```bash
pnpm install
pnpm verify
```

## 分层脚本

```
scripts/verify/
├── index.mjs           # 汇总
├── l1-core.mjs         # L1 + dev-console 场景
├── l2-tools.mjs        # L2 工具（骨架阶段为 pending）
├── l3-service.mjs      # L3 服务
├── l4-product.mjs      # L4 产品面
└── l5-sdk-channels.mjs # L5 SDK / Channel
```

骨架阶段：L2–L5 集成测试以 `scripts/lib/pending.mjs` 占位，Wave 1+ 逐步替换为真实测试。
