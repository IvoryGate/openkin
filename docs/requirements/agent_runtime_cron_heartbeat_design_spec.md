# Agent Runtime 设计方案：Cron（定时任务调度）与 Heartbeat（心跳保活）

## 1. 项目目标

为 Agent Runtime 构建两个核心基础设施模块：

1. **Cron Scheduler（定时任务调度器）**
   - 支持基于时间规则执行任务
   - 支持一次性任务与周期性任务
   - 支持分布式环境下的任务抢占与幂等执行

2. **Heartbeat Service（心跳保活服务）**
   - 维持 Agent 活跃状态
   - 提供实例健康检测
   - 支持失联检测与自动恢复

该设计方案面向工程实现，可直接作为 Cursor 的开发输入文档。

---

# 2. 总体架构

```text
+---------------------------+
|      Agent Runtime        |
|                           |
|  +---------------------+  |
|  |  Cron Scheduler     |  |
|  +---------------------+  |
|            |              |
|            v              |
|  +---------------------+  |
|  |  Task Executor      |  |
|  +---------------------+  |
|            ^              |
|            |              |
|  +---------------------+  |
|  | Heartbeat Service   |  |
|  +---------------------+  |
|                           |
+---------------------------+
            |
            v
+---------------------------+
| Persistent Store / Cache |
| (Redis / Postgres / MQ)  |
+---------------------------+
```

---

# 3. 模块设计原则

## 3.1 核心原则

- **高可用**：支持实例宕机恢复
- **幂等性**：避免重复执行任务
- **可扩展**：支持多实例部署
- **可观测**：具备日志、指标、告警能力
- **低耦合**：Cron 与 Heartbeat 可独立演进

---

# 4. Cron Scheduler 设计

---

## 4.1 功能需求

### 必须支持

- cron 表达式任务
- interval 间隔任务
- delay 延迟任务
- one-shot 一次性任务
- 任务暂停 / 恢复 / 删除
- 最大重试次数
- 执行超时控制
- 任务执行历史记录

---

## 4.2 数据模型

```ts
interface ScheduledTask {
  id: string;
  name: string;
  type: 'cron' | 'interval' | 'delay' | 'once';
  schedule: string;
  payload: Record<string, any>;
  enabled: boolean;
  nextRunAt: number;
  lastRunAt?: number;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  lockOwner?: string;
  lockExpireAt?: number;
  createdAt: number;
  updatedAt: number;
}
```

---

## 4.3 核心组件

### Scheduler Engine

负责扫描即将到期任务。

### Dispatcher

将任务投递到执行器。

### Lock Manager

确保分布式环境下单任务只执行一次。

### Retry Manager

失败重试与退避策略。

---

## 4.4 执行流程

```text
[轮询扫描任务]
      ↓
[获取分布式锁]
      ↓
[投递执行]
      ↓
[更新执行结果]
      ↓
[计算下一次执行时间]
```

---

## 4.5 推荐实现策略

### 轮询模式

- 每 1 秒扫描一次
- 查询 nextRunAt <= now 的任务

### 锁机制

推荐 Redis SET NX EX：

```text
lock:task:{taskId}
```

TTL = timeoutMs + buffer

---

## 4.6 API 设计

```ts
interface CronService {
  register(task: ScheduledTask): Promise<void>;
  remove(taskId: string): Promise<void>;
  pause(taskId: string): Promise<void>;
  resume(taskId: string): Promise<void>;
  trigger(taskId: string): Promise<void>;
}
```

---

# 5. Heartbeat Service 设计

---

## 5.1 功能需求

- 周期性上报 Agent 状态
- 监控实例存活
- 记录资源占用
- 检测失联实例
- 支持自动摘除 / 重启

---

## 5.2 数据模型

```ts
interface HeartbeatRecord {
  agentId: string;
  status: 'healthy' | 'degraded' | 'offline';
  cpuUsage?: number;
  memoryUsage?: number;
  activeTasks: number;
  lastSeenAt: number;
  metadata?: Record<string, any>;
}
```

---

## 5.3 心跳机制

### 上报频率

建议每 5 秒一次。

### 失联阈值

超过 15 秒未更新 → 判定离线。

---

## 5.4 状态机

```text
healthy -> degraded -> offline
       ^         |
       |_________|
```

---

## 5.5 API 设计

```ts
interface HeartbeatService {
  start(): Promise<void>;
  stop(): Promise<void>;
  report(): Promise<void>;
  checkHealth(agentId: string): Promise<HeartbeatRecord>;
}
```

---

# 6. Cron 与 Heartbeat 协同机制

---

## 6.1 任务执行前检查实例健康

若 Heartbeat 状态非 healthy：

- 不接收新任务
- 当前任务允许完成

---

## 6.2 宕机恢复

若实例离线：

- 清理锁
- 重新分配待执行任务

---

## 6.3 防止僵尸任务

Heartbeat 可附带当前执行任务列表。

若任务执行超时且实例失联：

- 标记为 failed
- 进入重试队列

---

# 7. 技术选型建议

| 模块 | 推荐技术 |
|---|---|
| 缓存 / 锁 | Redis |
| 持久化 | PostgreSQL |
| 队列 | Kafka / RabbitMQ / BullMQ |
| Runtime | Node.js / Go |
| 监控 | Prometheus + Grafana |

---

# 8. 非功能性要求

---

## 性能目标

- 支持 10k+ 定时任务
- 调度延迟 < 500ms
- 心跳误判率 < 0.1%

---

## 安全要求

- API 需鉴权
- 任务 payload 校验
- 防止恶意高频调度

---

# 9. 开发里程碑

---

## Phase 1：单机版本

- 基础 Cron 调度
- 本地内存心跳

## Phase 2：分布式版本

- Redis 锁
- 数据持久化

## Phase 3：生产级增强

- 监控告警
- 自动恢复
- Dashboard

---

# 10. Cursor 实现提示词（直接输入）

```text
请基于该设计文档，实现一个生产级 Agent Runtime 核心模块，包含：
1. Cron Scheduler
2. Heartbeat Service

要求：
- TypeScript 编写
- 模块化架构
- 支持 Redis 锁
- 支持 PostgreSQL 持久化
- 提供单元测试
- 提供接口定义与示例
- 保证高可用与幂等
```

---

# 11. 最终目标

形成一个可复用的 Agent Runtime 基础设施层，使任意 Agent 实例具备：

- 稳定调度能力
- 健康感知能力
- 故障恢复能力
- 分布式扩展能力

为上层智能体业务提供长期可靠支撑。

