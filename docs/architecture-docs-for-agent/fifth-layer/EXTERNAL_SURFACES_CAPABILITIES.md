# L5 External Surfaces And Channel Access Capabilities

## 目标

本文件用于记录 `L5 External Surfaces And Channel Access` 必须显式设计、但尚未拆成具体工单的能力清单。

它的作用与第四层的 `ENGINEERING_PRODUCT_CAPABILITIES.md` 一样：

- 先把能力登记下来
- 再拆实现工单
- 避免这些能力只停留在聊天或零散路线图描述里

## L5 的职责边界

第五层不再负责定义单 agent 的本地完整产品体验。

第五层负责：

- 把第四层已经成立的 terminal-first 产品能力外扩到更多入口
- 处理 Web / Desktop / SDK / channel / remote operator 的接入
- 处理 multi-surface continuity
- 处理 remote control plane

也就是说，第五层的核心不是“再做一个产品壳”，而是：

> 让同一个产品能够被多个外部入口一致消费。

## 为什么需要单独登记

如果没有这一层的显式能力登记，系统很容易退化成：

1. Web / Desktop / channel 各自拼一套 session / approval / background 语义
2. channel 接入反向定义产品能力
3. remote surfaces 与本地产品越来越像三个独立系统
4. SDK 只是“调用 API 的包装”，而不是共享能力外扩层

## A. Remote Surface Capabilities

这些能力处理的是：L4 产品如何被外部入口消费。

### A1. Multi-Surface Session Continuity

必须明确：

- 本地 session 与 remote session 的映射关系
- attach / detach / resume 的跨 surface 语义
- foreground / background 状态如何被多个入口观察
- 同一 session 在不同入口的身份叙事是否一致

### A2. Multi-Surface Approval Continuity

必须支持：

- 某个入口发起的危险操作，在另一个入口审批
- pending approval 的跨 surface 可见性
- approved / denied / expired 的统一事件语义
- approval 审计记录的跨入口一致性

### A3. Multi-Surface Event Continuity

必须支持：

- run event continuity
- task event continuity
- log event continuity
- heartbeat continuity
- background session continuity
- reconnect / replay / resume-from 的一致策略

### A4. Remote Inspect / Observe

必须支持：

- remote inspect session
- remote inspect run
- remote inspect logs
- remote inspect tasks
- remote inspect status / health
- remote inspect approval / background state

## B. SDK And Remote Control Plane

### B1. External Client Surface

需要继续完善：

- `sdk/client`
- `sdk/operator-client`
- future remote subscription client
- future control-plane client

关键不是再加多少方法，而是保证：

- 它们复用的是第四层产品语义
- 而不是绕过产品语义重新拼 service contract

### B2. Remote Control Plane

必须显式设计：

- remote status plane
- remote logs / tasks / runs plane
- remote approval plane
- remote background session plane
- remote account / channel plane

### B3. Subscription Interface

必须形成共享订阅接口，而不只是每个 surface 各自处理 SSE：

- subscribe runs
- subscribe tasks
- subscribe logs
- subscribe approvals
- subscribe control-plane state
- replay / reconnect / backfill strategy

## C. Channel Access Capabilities

这是第五层中“外部渠道”这一支。

### C1. Account Graph

必须正式设计：

- platform
- accountId
- workspace / tenant association
- auth material state
- current health / degraded reason
- capability matrix

### C2. Pairing / Allowlist / Invitation

必须正式设计：

- open / pairing_required / allowlist_only
- pairing code
- invitation flow
- operator override
- channel / account / peer 级别的 allow / deny

### C3. Presence / Delivery / Health

必须正式设计：

- heartbeat
- last seen
- transport health
- delivery receipts
- retry / backoff / dead-letter
- paused / muted / maintenance

### C4. Channel Routing

必须正式设计：

- 如何把 channel inbound 映射为第四层产品中的 session / thread / background work
- 如何让渠道消息消费第四层的 approval / background / memory / inspect 语义
- 如何避免 channel 接入变成“另一套产品”

### C5. Representative Real Platform

后续必须选择至少一个代表性平台打透，验证：

- auth
- pairing
- routing
- delivery
- presence
- approval continuity
- background continuity

## D. External Onboarding

除了本地 onboarding，第五层还要处理外部入口自己的上手路径：

- remote login / auth
- desktop / web first-use setup
- channel account bootstrap
- pairing guidance
- remote permission explanation

## E. Multimodal Across Surfaces

多模态不能只在本地壳里成立。

第五层后续必须支持：

- 附件跨 surface 引用
- remote file / image presentation
- multimodal event continuity
- channel attachment handling
- desktop / web multimodal affordance

## F. 当前优先级判断

建议顺序：

1. 先做 multi-surface continuity
2. 再做 remote control plane
3. 再做 channel access 深化
4. 再做真实代表性平台接入

## 当前结论

第五层后续不应再被模糊地理解为“客户端 SDK 那一层”。

它需要被明确记录为一组待实现能力簇：

- remote surfaces
- multi-surface continuity
- SDK / subscription / control plane
- channel access
- external onboarding
- multimodal across surfaces

这些能力后续都应先拆成工单，再推进实现。
