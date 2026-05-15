---
skill-id: create-skill
description: |
  Use when: 需要新增或审查 workspace 内 Skill 的目录结构、frontmatter、权限声明或与 list_skills/read_skill/run_script 的协作方式。
  Don't use when: 只是在执行已有 skill 的业务逻辑（应 read_skill 目标目录）；或与 Skill 无关的通用 TypeScript/产品设计问题。
  反例：用户说「帮我写个拉取 GitHub PR 的脚本」——先判断应做成内置工具还是 skill；若已是 skill 仓库，应 read 对应 SKILL 而非读本规范全文。
permissions:
  read: ["."]
  net: []
  write: []
  env: ["SKILL_ARGS", "SKILL_ID"]
---

# create-skill — Workspace Skill 编写规范

本 Skill **不提供可执行脚本**：规范正文即交付物。Agent 应通过 **`read_skill(skillId="create-skill")`** 在需要时加载全文；`list_skills` 仅暴露索引级 `description`（路由用）。

---

## 1. 何为 Skill

- **Skill** = `workspace/skills/<skill-id>/` 下的可发现单元：至少包含 **`SKILL.md`**（人类与模型可读），可选 **`.ts` / `.js` 脚本**，由 **`run_script`** 在 Deno 沙箱中执行。
- **程序性记忆**：流程与约束写在 `SKILL.md` 与脚本里，按需加载，避免一次性塞进 system prompt。

---

## 2. 目录与命名

| 规则 | 说明 |
|------|------|
| 路径 | `workspace/skills/<skill-id>/SKILL.md`（`list_skills` 扫描该树） |
| `skill-id` | 与目录名一致；建议仅 **`[a-z0-9-]+`**，与 `manage-mcp` 等现有 skill 一致 |
| 脚本 | 与 `SKILL.md` 同目录，由 `run_script` 的 `script` 参数指定文件名（如 `weather.ts`） |
| 禁止 | 在 `SKILL.md` 或脚本中硬编码 **密钥、Token、cookie**；用环境变量并由上层注入 |

---

## 3. Frontmatter（必填）

顶格 **`---` YAML** 块，至少包含：

```yaml
---
skill-id: <与目录名一致>
description: |
  多行；必须可被 list_skills 当作路由条件（见 §4）。
permissions:
  read: [...]
  net: [...]
  write: [...]
  env: [...]
---
```

- **`description`**：面向模型的 **短路由说明**，不是教程全文。全文放在正文 Markdown。
- **`permissions`**：Deno 沙箱能力声明（读路径、写路径、网络、环境变量）。与实际脚本行为 **必须一致**；越权会导致执行失败。参见仓库 `pnpm test:sandbox` 行为。

---

## 4. 描述即路由（ACI）

在 `description` 的前几行用固定小标题，便于 `list_skills` 索引与模型路由：

1. **`Use when:`** — 明确触发条件（用户意图、上下文信号）。
2. **`Don't use when:`** — 明确不应调用的情况，减少误选。
3. **`反例:`** — 一句「看起来像但其实不该用本 skill」的场景。

**反模式**：把长篇参数说明、大段 JSON 示例塞进 `description`（应放正文，按需 `read_skill`）。

---

## 5. 正文 Markdown（SKILL.md body）

建议顺序（可按需增删）：

1. **一句话能力**  
2. **调用方式**：`run_script(skillId=..., script=..., args=...)` 或「仅文档、无脚本」。  
3. **参数表**：`args` / 环境变量 / 返回值 JSON 形状。  
4. **权限与边界**：与 `permissions` 对齐；说明是否触网、写盘路径。  
5. **示例**：短 JSON 即可。  
6. **故障与排错**：常见错误码、依赖（如本机服务端口）。

---

## 6. 与内置工具的分工

| 能力 | 工具 |
|------|------|
| 枚举 skill 索引 | `list_skills`（仅 `skillId` + `description`，不含敏感路径细节） |
| 读取某 skill 全文 | `read_skill` |
| 执行 skill 目录下脚本 | `run_script`（沙箱 + `permissions`） |
| 在 workspace 内 **新建** skill 包 | `write_skill`（若产品已暴露）；创建后仍须遵守本规范 |

---

## 7. 自检清单（提交 / PR 前）

- [ ] `skill-id` 与目录名一致  
- [ ] `description` 含 Use when / Don't use when / 反例（或等价清晰路由语句）  
- [ ] `permissions` 覆盖脚本真实读写的路径与 `env`  
- [ ] 无密钥；无依赖「仅在某人笔记本上存在」的绝对路径  
- [ ] 本地可跑：`pnpm test:skills` / `pnpm test:sandbox`（若含脚本且声明了 net/write）

---

## 8. 仓库内延伸阅读

- L1/L2 边界与工具位置：`docs/v2/10-l1-core.md` 附录 C  
- 记忆与 workspace 文件：`docs/v2/11-memory.md`  
- 评测与 harness：`docs/v2/13-agent-evals.md`  
- 入口地图：`AGENTS.md`
