# Layer 6 Design：App And Orchestration

## 一句话定位

第六层负责在第四层本地产品与第五层外部入口都成立之后，继续向上长出：

- multi-agent
- workflow
- business / scenario apps
- higher-level orchestration

它不再承担“先把一个 agent 做成完整产品”的职责。

---

## 为什么要把单 agent 完整能力前移

如果单 agent 完整能力还没成立，就直接做第六层，会出现这些问题：

1. 多 agent demo 看起来很强，但基础产品仍不可恢复、不可审批、不可解释
2. workflow 依赖的 session / background / approval 语义本身都还没冻结
3. 最终只是把不完整的一层能力堆成更复杂的外观

因此：

- 单 agent 完整能力属于第四层
- 外部入口属于第五层
- 第六层才是更高阶编排

---

## 第六层的设计目标

1. **多 agent 合理生长**：只组合现有 contract，不重写底层 loop
2. **workflow 合理生长**：计划、评审、执行、恢复成为正式高层流程
3. **业务应用合理生长**：不同场景应用不需要反向改写底层分层
4. **高层审计合理生长**：团队状态、流程状态、产物状态可观察

---

## 第六层对象

### 1. Subagent

建议最小能力：

- 独立 session
- 独立 context budget
- 明确 parent / child 关系
- 明确 result handoff

### 2. Team

建议最小能力：

- lead / coordinator
- members
- shared goal
- task board
- member state
- aggregated result

### 3. Workflow Run

建议最小能力：

- workflow identity
- phases
- artifacts
- approvals
- retries / recovery
- observability

### 4. Product App

建议最小能力：

- 场景化入口
- 面向业务的流程壳
- 多入口通知与协作

---

## Plan / Review / Execute 在第六层的含义

这里的 `plan / review / execute` 不再只是单 agent 的工作手势，而是更高层的产品流程对象。

它应当能够：

- 组合多个 runs
- 组合多个 agents
- 组合多个 work items
- 接受 approval / revise / retry

因此它与第四层的区别是：

- 第四层：单 agent 的本地工程工作流
- 第六层：编排态的正式产品流程

---

## 第六层与第五层的关系

第五层解决“同一个产品如何去到更多入口”；

第六层解决“这些入口之上还能长出什么更高阶能力”。

例如：

- 第五层可以让 Desktop / Web / channel 都能看到 background session
- 第六层才决定多个 background sessions 如何组成 team / workflow / app

---

## 编排态 Background / Goal Loop

第六层后续需要承接：

- background orchestration registry
- goal loop
- cross-agent recovery
- approvals across workflow phases
- long-running coordination state

这些能力与第四层的单 session background 不同，它们是更高阶编排对象。

---

## Worktree / Artifact / Handoff

如果未来 TheWorld 要承接 coding-agent 或 operator-agent 的复杂工作，第六层还需要冻结：

- worktree / branch ownership
- artifact lifecycle
- review boundary
- merge / PR / handoff boundary
- audit responsibility

这些对象不应该回压到底层 runtime 或 service model。

---

## 推荐执行波次

### Wave 1：Plan / Review / Execute

- 编排态计划对象
- 评审 / 修订 / 批准 / 执行流

### Wave 2：Team / Subagent / Router

- lead / teammate / coordinator
- task board
- aggregated observability

### Wave 3：Workflow / Product Apps

- goal loop
- business / scenario apps
- high-level notifications and collaboration

---

## 当前结论

第六层现在应该被理解为：

- 高层编排层
- multi-agent 层
- workflow 层
- 业务应用层

而不是“单 agent 产品完整性”的主责层。
