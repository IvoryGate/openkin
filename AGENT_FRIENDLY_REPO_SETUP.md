# Agent 友好仓库搭建指南

## 为什么需要这份指南

普通仓库对 agent 来说只有一个问题：**没有边界**。agent 不知道能改什么、不能改什么、改完怎么自证、什么时候该停下来。

`openkin` 仓库通过一组相互配合的机制解决了这个问题。本文从 `openkin` 的实际做法中提炼出一套**可复用的模式**，让你在新项目中也能快速建立一个 agent 能安全、高效工作的仓库。

核心目标只有一个：**让 agent 在不需要人类反复纠正的情况下，独立完成大部分工作**。

---

## 整体架构：四层约束体系

agent 友好仓库不是一个文件或一条规则，而是四层约束的叠加：

```text
┌─────────────────────────────────────────────┐
│  1. 入口文件层 — AGENTS.md + docs/index.md  │  ← agent 第一次看到的东西
├─────────────────────────────────────────────┤
│  2. 文档治理层 — docs/ 分类文档体系          │  ← agent 的知识库
├─────────────────────────────────────────────┤
│  3. 自动化闸门层 — lint-* 脚本 + verify     │  ← agent 的自证工具
├─────────────────────────────────────────────┤
│  4. 执行计划层 — exec-plans 工作单          │  ← agent 的任务边界
└─────────────────────────────────────────────┘
```

每一层都独立发挥作用，但叠在一起时效果远大于各部分之和。下面逐层说明。

---

## 第一层：入口文件层

### 1.1 AGENTS.md（仓库根目录）

这是 agent 在项目上下文中自动读到的第一个文件。它必须解决一个核心问题：**agent 需要知道什么才能不犯蠢**。

`openkin` 的 AGENTS.md 包含以下必要段落：

| 段落 | 作用 | 必要性 |
|------|------|--------|
| 优先级最高的文档 | 告诉 agent 先读什么，避免它自己乱找 | 必须 |
| 当前工程原则 | 几条不随时间变化的约束，agent 每次都要遵守 | 必须 |
| 当前分层理解 | 告诉 agent 代码的职责边界，避免它跨层乱改 | 视项目 |
| 当前不应该做的事 | 正面禁止列表，比「应该做的事」更有效 | 必须 |
| 质量与约束入口 | 指向治理文档的位置 | 必须 |
| 文档维护要求 | 哪些变更必须更新哪些文档 | 建议 |

**关键原则：AGENTS.md 不是完整手册，而是入口地图。** 它应该短到可以快速扫完，长到足以让 agent 知道去哪里找细节。

**模板框架：**

```markdown
# <项目名>

本文件是 agent 的入口地图，不是完整手册。

## 优先级最高的文档

1. `docs/index.md`
2. `docs/architecture-docs-for-agent/ARCHITECTURE.md`
3. `docs/governance/` 下的约束文档

## 当前工程原则

1. （你的核心原则 1，如「文档是记录系统，聊天不是」）
2. （你的核心原则 2，如「先冻结 contract，再实现功能」）
3. ...

## 当前不应该做的事

- （明确禁止的事情 1）
- （明确禁止的事情 2）
- ...

## 质量与约束

- `docs/governance/QUALITY_SCORE.md`
- `docs/governance/RELIABILITY.md`
- ...

## 文档维护要求

- 任何架构变更都应更新 `docs/architecture-docs-for-agent/ARCHITECTURE.md`
- ...

## 每次修改后的必做动作

- `pnpm verify`（或等价的验证命令）
```

### 1.2 docs/index.md（文档入口）

AGENTS.md 告诉 agent 文档在哪里，docs/index.md 告诉 agent 文档里有什么。每个条目必须附带一句话说明：

```markdown
### 架构与分层设计

- `architecture/ARCHITECTURE.md` — 总体架构：分层职责与优先实施顺序
- `architecture/SDK.md` — 客户端 SDK：职责边界与依赖关系

### 治理与约束

- `governance/QUALITY_SCORE.md` — 工程成熟度：各维度当前状态
- `governance/RELIABILITY.md` — 可靠性边界：各层必须保持的要求
```

**不要只列文件名。** agent 看到文件名不知道该不该点进去；一行说明能让它快速判断。

---

## 第二层：文档治理层

### 2.1 docs/ 目录分类

`openkin` 的分类方式：

```text
docs/
  index.md              ← 入口（保留在根）
  architecture/         ← 架构设计：描述「系统应该长什么样」
  governance/           ← 治理约束：描述「必须遵守什么规则」
  exec-plans/           ← 执行计划：描述「当前正在做什么、下一步做什么」
    active/
    completed/
  archive/              ← 历史归档：不再指导当前工作，但保留决策上下文
```

这个分类的关键区别在于：**architecture 说「是什么」，governance 说「不能做什么」，exec-plans 说「正在做什么」，archive 说「曾经考虑过什么」**。agent 在不同模式下需要关注不同部分。

### 2.2 治理文档的标准结构

每个治理文档应该回答一个核心问题。`openkin` 的做法：

| 文档 | 核心问题 | 标准结构 |
|------|---------|---------|
| QUALITY_SCORE | 「我们做到了什么程度？」 | 按维度列状态（未开始/已启动/已收口） |
| RELIABILITY | 「哪些边界不能退？」 | 按层列要求 + 机械化对照表 |
| SECURITY | 「哪些默认是关的？」 | 按领域列约束 + 后续待落实清单 |
| GIT_WORKFLOW | 「提交应该满足什么？」 | 原则 + 节点 + 必跑命令 |
| MODEL_OPERATING_MODES | 「agent 能做什么？」 | 按模式列允许/禁止 + 升级条件 |

**共性规律：每个治理文档都是「声明 → 机制化 → 验证」的三段式。** 先用自然语言声明边界，再逐步转化为 lint/test/runtime guard，最后通过 verify 确认边界有效。

### 2.3 文档即约束的关键设计

**1. 用「不做」列表代替「做」列表**

`openkin` 的执行计划里有一个特别有效的段落：「本轮不做」。它比「本轮要做」更重要——agent 需要知道边界在哪里，而不仅仅是目标在哪里。

```markdown
## 本轮不做

- 不实现 WebSocket、chunked JSON lines 或其他可替代流式协议
- 不实现鉴权、多租户、限流
- 不接 channel
```

**2. 用「升级条件」代替自我判断**

```markdown
## 升级条件

命中以下任一情况时，立即停止并汇报：
- 需要改架构边界
- 需要改计划外的共享 contract
- 连续两轮无法通过 `pnpm verify`
```

**不要让 agent 自己判断「我能不能做」**，而要让它根据写好的条件来判断「我是否被允许继续做」。

---

## 第三层：自动化闸门层

### 3.1 为什么需要 lint 脚本

agent 会撒谎（或者更准确地说是产生幻觉）。它可能说「改完了」，但实际引用断链了，或者它在不该依赖的层之间加了 import。lint 脚本是 agent 的**客观自证工具**——它不需要理解为什么，只需要跑过就行。

### 3.2 三类 lint 的分工

`openkin` 的做法：

| lint 脚本 | 检查什么 | 为什么必须 |
|-----------|---------|-----------|
| `lint-docs` | 文档完整性（必要文件存在）+ 引用合法性（不指向旧路径） | 防止文档体系退化为碎片 |
| `lint-architecture` | 架构约束（依赖方向、关键 contract 存在、状态机 guard） | 防止代码退化回分层混乱 |
| `lint-workspace` | 仓库骨架完整性（必要文件、workspace 配置、scripts 存在） | 防止基础设施被意外删除 |

### 3.3 lint-architecture 的核心模式

这是最复杂也最有价值的一类。它把架构决策变成机器可检查的规则：

```javascript
// 依赖方向检查：shared/contracts 不能依赖 core 或 server
const sharedContracts = read('packages/shared/contracts/src/index.ts')
if (sharedContracts.includes('@openkin/core')) {
  errors.push('shared/contracts must not depend on core or server.')
}

// contract 存在性检查：关键语义必须存在
const runEngine = read('packages/core/src/run-engine.ts')
if (!runEngine.includes('assertRunNotYetFinished')) {
  errors.push('RunEngine must call assertRunNotYetFinished.')
}

// 状态完整性检查：枚举值不能被悄悄删除
for (const status of ['completed', 'aborted', 'cancelled', 'budget_exhausted', 'failed']) {
  if (!sharedContracts.includes(`'${status}'`)) {
    errors.push(`Missing final status: ${status}`)
  }
}
```

**lint-architecture 的设计原则：**
- 检查**依赖方向**（哪层不能依赖哪层）
- 检查**关键 contract 存在性**（不能被悄悄删除）
- 检查**状态完整性**（枚举值不能被悄悄缩减）
- 不要过度检查实现细节（那交给测试）

### 3.4 统一验证入口

`pnpm verify` 是一切的总开关。它的设计原则：

1. **包含所有 lint**：docs + architecture + workspace
2. **包含核心测试**：scenarios + 审计
3. **包含跨层冒烟**：server + sdk + channel
4. **不包含依赖外部服务的测试**：真实 LLM 调用不应在默认 verify 里

```json
{
  "scripts": {
    "lint:docs": "node scripts/lint-docs.mjs",
    "lint:architecture": "node scripts/lint-architecture.mjs",
    "lint:workspace": "node scripts/lint-workspace.mjs",
    "verify": "pnpm lint:docs && pnpm lint:architecture && pnpm lint:workspace && pnpm check && pnpm test:scenarios && pnpm test:first-layer-audit && pnpm test:server && pnpm test:sdk && pnpm test:channels"
  }
}
```

---

## 第四层：执行计划层

### 4.1 执行计划是什么

执行计划是 agent 的**工作单**。它比 issue 精确得多——issue 说「做什么」，执行计划说「怎么做、做到什么程度算完、碰壁了怎么办」。

### 4.2 执行计划的标准模板

`openkin` 的每份执行计划都包含：

```markdown
# <编号> <标题>

## 目标
（一句话说清楚这轮要收口什么）

## 已冻结决策
（由高能力模式做出的关键选择，弱模型不能推翻）

## 影响范围
| 层级 | 影响 |
|------|------|
| ... | ... |

## 允许修改的目录
- ...

## 禁止修改的目录
- ...

## 本轮不做
（比「本轮要做」更重要）

## 验收标准
（明确的、可机器检查的条件）

## 必跑命令
1. `pnpm verify`
2. <本计划额外的验收命令>

## 升级条件
（命中时立即停止，不能继续尝试）

## 依赖与顺序
- 前置：<编号>
- 解锁：<编号>

## 验收结果
（完成后由 agent 填写）
```

### 4.3 两阶段执行模型

`openkin` 对跨层任务使用「强模型定方向、弱模型执行」的两阶段模型：

1. **high-capability mode**（强模型）：冻结决策——协议选择、允许/禁止目录、验收命令、升级条件
2. **budget mode**（弱模型）：按冻结后的工作单执行实现

**如果第一阶段没有完成，弱模型不得进入实现。** 这一条是整个体系生效的前提。

### 4.4 三种工作模式

| 模式 | 适用场景 | 权限 |
|------|---------|------|
| high-capability | 架构设计、contract 收口、多方案权衡 | 可以定义新规则、规划大阶段 |
| budget | 按计划执行、修复 verify 失败、补测试 | 只能在现有规则内执行，碰壁必须停 |
| maintenance | 文档整理、链接修复、归档 | 只改文档和脚本，不碰 contract |

---

## 初始化清单

用这份清单来初始化一个新项目。每一步都是在前一步基础上叠加的。

### Phase 1：骨架（必须）

- [ ] 创建 `AGENTS.md`，按上面的模板填写项目特定内容
- [ ] 创建 `docs/index.md`，列出所有文档并附带一句话说明
- [ ] 创建 `docs/` 子目录结构（`architecture/`、`governance/`、`exec-plans/active/`、`exec-plans/completed/`、`archive/`）
- [ ] 在 `AGENTS.md` 中写明「当前不应该做的事」

### Phase 2：验证（建议）

- [ ] 创建 `scripts/lint-docs.mjs`：检查必要文档文件存在、检查引用合法性
- [ ] 创建 `scripts/lint-workspace.mjs`：检查仓库骨架完整性
- [ ] 在 `package.json` 中添加 `lint:docs`、`lint:workspace`、`verify` 脚本
- [ ] 确认 `pnpm verify` 能跑通

### Phase 3：治理（按需）

- [ ] 创建 `docs/governance/QUALITY_SCORE.md`：列出各工程维度的当前状态
- [ ] 创建 `docs/governance/RELIABILITY.md`：声明可靠性边界
- [ ] 创建 `docs/governance/SECURITY.md`：声明安全边界
- [ ] 创建 `docs/governance/GIT_WORKFLOW.md`：声明提交原则和 agent 产出原则
- [ ] 创建 `docs/governance/MODEL_OPERATING_MODES.md`：定义三种工作模式和升级条件

### Phase 4：约束机械化（按需）

- [ ] 创建 `scripts/lint-architecture.mjs`：把关键架构约束转为机器检查
  - 依赖方向检查
  - 关键 contract 存在性检查
  - 状态完整性检查
- [ ] 把 `lint:architecture` 并入 `verify`

### Phase 5：执行计划（需要时）

- [ ] 用标准模板写第一份执行计划
- [ ] 放入 `docs/exec-plans/active/`
- [ ] 按两阶段模型执行：先冻结决策，再执行实现

---

## 常见陷阱

### 1. AGENTS.md 写太长

AGENTS.md 是入口地图，不是百科全书。超过 200 行就应该考虑把内容下沉到 `docs/` 下的具体文档中。

### 2. 没有明确「不做」

只说「做什么」但不说「不做」，agent 会自行发挥。每份执行计划里的「本轮不做」比「本轮要做」更能防止 agent 越界。

### 3. 没有升级条件

agent 遇到困难时默认会继续尝试，而不是停下汇报。没有明确的升级条件，agent 可能花几轮时间在一个需要人工决策的问题上反复碰壁。

### 4. verify 里有外部依赖

如果 `pnpm verify` 依赖外部 API 或服务，agent 在网络不稳定时无法自证，也无法区分「代码坏了」和「外部服务挂了」。默认 verify 应该完全自包含。

### 5. 文档和代码不同步

架构文档写的是一套，代码里的是另一套。解决方案是 `lint-architecture`——让机器检查代码是否遵守文档声明的约束。

---

## 检验标准

一个仓库是否 agent 友好，可以用以下问题快速检验：

1. 新接手的 agent 是否能在 5 分钟内知道**从哪里开始读**？（→ AGENTS.md + index.md）
2. agent 是否能在不问人类的情况下知道**能改什么、不能改什么**？（→ 执行计划 + 升级条件）
3. agent 是否能在不问人类的情况下知道**改完怎么自证**？（→ verify 命令）
4. agent 是否知道**什么时候该停下来求助**？（→ 升级条件）
5. 如果 agent 做了错误的事，是否有**自动化手段检测到**？（→ lint 脚本）

如果这五个问题都能回答「是」，那这个仓库对 agent 来说就是友好的。
