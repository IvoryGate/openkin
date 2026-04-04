import Database from 'better-sqlite3'

type SqliteDatabase = InstanceType<typeof Database>

export interface SessionRepository {
  insert(session: { id: string; kind: string; agentId: string; createdAt: number }): void
  findById(id: string): DbSession | undefined
  listAll(): DbSession[]
  /** Returns whether a row was removed. Cascades to messages/traces via FK. */
  deleteById(id: string): boolean
}

export interface MessageRepository {
  insert(msg: DbMessage): void
  listBySession(sessionId: string, limit?: number): DbMessage[]
}

export interface TraceRepository {
  upsert(trace: DbTrace): void
  findByTraceId(traceId: string): DbTrace | undefined
  listBySession(sessionId: string, limit?: number): DbTrace[]
}

export interface DbSession {
  id: string
  kind: string
  agentId: string
  createdAt: number
}

export interface DbMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  createdAt: number
}

export interface DbTrace {
  traceId: string
  sessionId: string
  agentId: string
  status: string
  steps: string
  durationMs: number | null
  createdAt: number
}

export function createSessionRepository(db: SqliteDatabase): SessionRepository {
  const insertStmt = db.prepare(
    `INSERT INTO sessions (id, kind, agent_id, created_at) VALUES (@id, @kind, @agentId, @createdAt)`,
  )
  const findStmt = db.prepare(`SELECT id, kind, agent_id AS agentId, created_at AS createdAt FROM sessions WHERE id = ?`)
  const listStmt = db.prepare(`SELECT id, kind, agent_id AS agentId, created_at AS createdAt FROM sessions ORDER BY created_at DESC`)
  const deleteStmt = db.prepare(`DELETE FROM sessions WHERE id = ?`)

  return {
    insert(session) {
      insertStmt.run(session)
    },
    findById(id) {
      const row = findStmt.get(id) as DbSession | undefined
      return row
    },
    listAll() {
      return listStmt.all() as DbSession[]
    },
    deleteById(id) {
      const r = deleteStmt.run(id)
      return r.changes > 0
    },
  }
}

export function createMessageRepository(db: SqliteDatabase): MessageRepository {
  const insertStmt = db.prepare(
    `INSERT INTO messages (id, session_id, role, content, created_at)
     VALUES (@id, @sessionId, @role, @content, @createdAt)`,
  )
  const listStmt = db.prepare(
    `SELECT id, session_id AS sessionId, role, content, created_at AS createdAt
     FROM messages WHERE session_id = ?
     ORDER BY created_at ASC`,
  )
  const listLimitStmt = db.prepare(
    `SELECT id, session_id AS sessionId, role, content, created_at AS createdAt
     FROM messages WHERE session_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
  )

  return {
    insert(msg: DbMessage) {
      insertStmt.run(msg)
    },
    listBySession(sessionId, limit) {
      if (limit !== undefined) {
        return listLimitStmt.all(sessionId, limit) as DbMessage[]
      }
      return listStmt.all(sessionId) as DbMessage[]
    },
  }
}

export function createTraceRepository(db: SqliteDatabase): TraceRepository {
  const upsertStmt = db.prepare(
    `INSERT OR REPLACE INTO agent_run_traces (trace_id, session_id, agent_id, status, steps, duration_ms, created_at)
     VALUES (@traceId, @sessionId, @agentId, @status, @steps, @durationMs, @createdAt)`,
  )
  const findStmt = db.prepare(
    `SELECT trace_id AS traceId, session_id AS sessionId, agent_id AS agentId, status, steps,
            duration_ms AS durationMs, created_at AS createdAt
     FROM agent_run_traces WHERE trace_id = ?`,
  )
  const listStmt = db.prepare(
    `SELECT trace_id AS traceId, session_id AS sessionId, agent_id AS agentId, status, steps,
            duration_ms AS durationMs, created_at AS createdAt
     FROM agent_run_traces WHERE session_id = ?
     ORDER BY created_at DESC`,
  )
  const listLimitStmt = db.prepare(
    `SELECT trace_id AS traceId, session_id AS sessionId, agent_id AS agentId, status, steps,
            duration_ms AS durationMs, created_at AS createdAt
     FROM agent_run_traces WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
  )

  return {
    upsert(trace: DbTrace) {
      upsertStmt.run({
        traceId: trace.traceId,
        sessionId: trace.sessionId,
        agentId: trace.agentId,
        status: trace.status,
        steps: trace.steps,
        durationMs: trace.durationMs,
        createdAt: trace.createdAt,
      })
    },
    findByTraceId(traceId) {
      return findStmt.get(traceId) as DbTrace | undefined
    },
    listBySession(sessionId, limit) {
      if (limit !== undefined) {
        return listLimitStmt.all(sessionId, limit) as DbTrace[]
      }
      return listStmt.all(sessionId) as DbTrace[]
    },
  }
}

export interface DbAgentRow {
  id: string
  name: string
  description: string | null
  systemPrompt: string
  model: string | null
  enabled: boolean
  isBuiltin: boolean
  createdAt: number
  updatedAt: number
}

export interface AgentRepository {
  insert(row: DbAgentRow): void
  findById(id: string): DbAgentRow | undefined
  listAll(): DbAgentRow[]
  update(id: string, patch: Partial<Pick<DbAgentRow, 'name' | 'description' | 'systemPrompt' | 'model' | 'enabled' | 'updatedAt'>>): boolean
  deleteById(id: string): 'ok' | 'not_found' | 'forbidden_builtin'
  setEnabled(id: string, enabled: boolean, updatedAt: number): boolean
}

function rowToAgent(r: Record<string, unknown>): DbAgentRow {
  return {
    id: String(r.id),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    systemPrompt: String(r.systemPrompt),
    model: r.model != null ? String(r.model) : null,
    enabled: Boolean(r.enabled),
    isBuiltin: Boolean(r.isBuiltin),
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  }
}

export function createAgentRepository(db: SqliteDatabase): AgentRepository {
  const insertStmt = db.prepare(
    `INSERT INTO agents (id, name, description, system_prompt, model, enabled, is_builtin, created_at, updated_at)
     VALUES (@id, @name, @description, @systemPrompt, @model, @enabled, @isBuiltin, @createdAt, @updatedAt)`,
  )
  const findStmt = db.prepare(
    `SELECT id, name, description, system_prompt AS systemPrompt, model,
            enabled, is_builtin AS isBuiltin, created_at AS createdAt, updated_at AS updatedAt
     FROM agents WHERE id = ?`,
  )
  const listStmt = db.prepare(
    `SELECT id, name, description, system_prompt AS systemPrompt, model,
            enabled, is_builtin AS isBuiltin, created_at AS createdAt, updated_at AS updatedAt
     FROM agents ORDER BY created_at ASC`,
  )
  const deleteStmt = db.prepare(`DELETE FROM agents WHERE id = ? AND is_builtin = 0`)
  const enableStmt = db.prepare(`UPDATE agents SET enabled = ?, updated_at = ? WHERE id = ?`)

  return {
    insert(row) {
      insertStmt.run({
        id: row.id,
        name: row.name,
        description: row.description,
        systemPrompt: row.systemPrompt,
        model: row.model,
        enabled: row.enabled ? 1 : 0,
        isBuiltin: row.isBuiltin ? 1 : 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
    },
    findById(id) {
      const r = findStmt.get(id) as Record<string, unknown> | undefined
      return r ? rowToAgent(r) : undefined
    },
    listAll() {
      return (listStmt.all() as Record<string, unknown>[]).map(rowToAgent)
    },
    update(id, patch) {
      const cur = findStmt.get(id) as Record<string, unknown> | undefined
      if (!cur) return false
      const next = rowToAgent(cur)
      const name = patch.name ?? next.name
      const description = patch.description !== undefined ? patch.description : next.description
      const systemPrompt = patch.systemPrompt ?? next.systemPrompt
      const model = patch.model !== undefined ? patch.model : next.model
      const enabled = patch.enabled !== undefined ? patch.enabled : next.enabled
      const updatedAt = patch.updatedAt ?? next.updatedAt
      db.prepare(
        `UPDATE agents SET name = ?, description = ?, system_prompt = ?, model = ?, enabled = ?, updated_at = ? WHERE id = ?`,
      ).run(
        name,
        description,
        systemPrompt,
        model,
        enabled ? 1 : 0,
        updatedAt,
        id,
      )
      return true
    },
    deleteById(id) {
      const cur = findStmt.get(id) as Record<string, unknown> | undefined
      if (!cur) return 'not_found'
      if (Boolean(cur.isBuiltin)) return 'forbidden_builtin'
      const r = deleteStmt.run(id)
      return r.changes > 0 ? 'ok' : 'not_found'
    },
    setEnabled(id, enabled, updatedAt) {
      const r = enableStmt.run(enabled ? 1 : 0, updatedAt, id)
      return r.changes > 0
    },
  }
}

export type TaskTriggerType = 'cron' | 'once' | 'interval'

export interface DbScheduledTask {
  id: string
  name: string
  triggerType: TaskTriggerType
  triggerConfig: string
  agentId: string
  input: string
  enabled: boolean
  createdBy: string
  createdAt: number
  nextRunAt: number | null
}

export interface DbTaskRun {
  id: string
  taskId: string
  status: 'running' | 'completed' | 'failed'
  progress: number | null
  progressMsg: string | null
  output: string | null
  error: string | null
  traceId: string | null
  sessionId: string | null
  retryCount: number
  startedAt: number
  completedAt: number | null
}

export interface TaskRepository {
  insert(row: DbScheduledTask): void
  findById(id: string): DbScheduledTask | undefined
  listAll(): DbScheduledTask[]
  update(id: string, patch: Partial<Pick<DbScheduledTask, 'name' | 'triggerType' | 'triggerConfig' | 'agentId' | 'input' | 'enabled' | 'nextRunAt'>>): boolean
  deleteById(id: string): boolean
  listDue(beforeMs: number): DbScheduledTask[]
}

export interface TaskRunRepository {
  insert(row: DbTaskRun): void
  update(
    id: string,
    patch: Partial<Pick<DbTaskRun, 'status' | 'progress' | 'progressMsg' | 'output' | 'error' | 'traceId' | 'completedAt' | 'retryCount'>>,
  ): boolean
  findById(id: string): DbTaskRun | undefined
  listByTaskId(taskId: string): DbTaskRun[]
}

function mapTask(r: Record<string, unknown>): DbScheduledTask {
  return {
    id: String(r.id),
    name: String(r.name),
    triggerType: r.triggerType as TaskTriggerType,
    triggerConfig: String(r.triggerConfig),
    agentId: String(r.agentId),
    input: String(r.input),
    enabled: Boolean(r.enabled),
    createdBy: String(r.createdBy),
    createdAt: Number(r.createdAt),
    nextRunAt: r.nextRunAt != null ? Number(r.nextRunAt) : null,
  }
}

function mapTaskRun(r: Record<string, unknown>): DbTaskRun {
  return {
    id: String(r.id),
    taskId: String(r.taskId),
    status: r.status as DbTaskRun['status'],
    progress: r.progress != null ? Number(r.progress) : null,
    progressMsg: r.progressMsg != null ? String(r.progressMsg) : null,
    output: r.output != null ? String(r.output) : null,
    error: r.error != null ? String(r.error) : null,
    traceId: r.traceId != null ? String(r.traceId) : null,
    sessionId: r.sessionId != null ? String(r.sessionId) : null,
    retryCount: Number(r.retryCount),
    startedAt: Number(r.startedAt),
    completedAt: r.completedAt != null ? Number(r.completedAt) : null,
  }
}

export function createTaskRepository(db: SqliteDatabase): TaskRepository {
  const insertStmt = db.prepare(
    `INSERT INTO scheduled_tasks (id, name, trigger_type, trigger_config, agent_id, input, enabled, created_by, created_at, next_run_at)
     VALUES (@id, @name, @triggerType, @triggerConfig, @agentId, @input, @enabled, @createdBy, @createdAt, @nextRunAt)`,
  )
  const findStmt = db.prepare(
    `SELECT id, name, trigger_type AS triggerType, trigger_config AS triggerConfig, agent_id AS agentId, input,
            enabled, created_by AS createdBy, created_at AS createdAt, next_run_at AS nextRunAt
     FROM scheduled_tasks WHERE id = ?`,
  )
  const listStmt = db.prepare(
    `SELECT id, name, trigger_type AS triggerType, trigger_config AS triggerConfig, agent_id AS agentId, input,
            enabled, created_by AS createdBy, created_at AS createdAt, next_run_at AS nextRunAt
     FROM scheduled_tasks ORDER BY created_at DESC`,
  )
  const dueStmt = db.prepare(
    `SELECT id, name, trigger_type AS triggerType, trigger_config AS triggerConfig, agent_id AS agentId, input,
            enabled, created_by AS createdBy, created_at AS createdAt, next_run_at AS nextRunAt
     FROM scheduled_tasks
     WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
     ORDER BY next_run_at ASC`,
  )
  const deleteStmt = db.prepare(`DELETE FROM scheduled_tasks WHERE id = ?`)

  return {
    insert(row) {
      insertStmt.run({
        id: row.id,
        name: row.name,
        triggerType: row.triggerType,
        triggerConfig: row.triggerConfig,
        agentId: row.agentId,
        input: row.input,
        enabled: row.enabled ? 1 : 0,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        nextRunAt: row.nextRunAt,
      })
    },
    findById(id) {
      const r = findStmt.get(id) as Record<string, unknown> | undefined
      return r ? mapTask(r) : undefined
    },
    listAll() {
      return (listStmt.all() as Record<string, unknown>[]).map(mapTask)
    },
    update(id, patch) {
      const cur = findStmt.get(id) as Record<string, unknown> | undefined
      if (!cur) return false
      const n = mapTask(cur)
      db.prepare(
        `UPDATE scheduled_tasks SET name = ?, trigger_type = ?, trigger_config = ?, agent_id = ?, input = ?, enabled = ?, next_run_at = ?
         WHERE id = ?`,
      ).run(
        patch.name ?? n.name,
        patch.triggerType ?? n.triggerType,
        patch.triggerConfig ?? n.triggerConfig,
        patch.agentId ?? n.agentId,
        patch.input ?? n.input,
        (patch.enabled ?? n.enabled) ? 1 : 0,
        patch.nextRunAt !== undefined ? patch.nextRunAt : n.nextRunAt,
        id,
      )
      return true
    },
    deleteById(id) {
      return deleteStmt.run(id).changes > 0
    },
    listDue(beforeMs) {
      return (dueStmt.all(beforeMs) as Record<string, unknown>[]).map(mapTask)
    },
  }
}

export function createTaskRunRepository(db: SqliteDatabase): TaskRunRepository {
  const insertStmt = db.prepare(
    `INSERT INTO task_runs (id, task_id, status, progress, progress_msg, output, error, trace_id, session_id, retry_count, started_at, completed_at)
     VALUES (@id, @taskId, @status, @progress, @progressMsg, @output, @error, @traceId, @sessionId, @retryCount, @startedAt, @completedAt)`,
  )
  const findStmt = db.prepare(
    `SELECT id, task_id AS taskId, status, progress, progress_msg AS progressMsg, output, error,
            trace_id AS traceId, session_id AS sessionId, retry_count AS retryCount, started_at AS startedAt, completed_at AS completedAt
     FROM task_runs WHERE id = ?`,
  )
  const listStmt = db.prepare(
    `SELECT id, task_id AS taskId, status, progress, progress_msg AS progressMsg, output, error,
            trace_id AS traceId, session_id AS sessionId, retry_count AS retryCount, started_at AS startedAt, completed_at AS completedAt
     FROM task_runs WHERE task_id = ? ORDER BY started_at DESC`,
  )

  return {
    insert(row) {
      insertStmt.run({
        id: row.id,
        taskId: row.taskId,
        status: row.status,
        progress: row.progress,
        progressMsg: row.progressMsg,
        output: row.output,
        error: row.error,
        traceId: row.traceId,
        sessionId: row.sessionId,
        retryCount: row.retryCount,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
      })
    },
    update(id, patch) {
      const cur = findStmt.get(id) as Record<string, unknown> | undefined
      if (!cur) return false
      const n = mapTaskRun(cur)
      const next = { ...n, ...patch }
      db.prepare(
        `UPDATE task_runs SET status = ?, progress = ?, progress_msg = ?, output = ?, error = ?, trace_id = ?, session_id = ?, retry_count = ?, completed_at = ?
         WHERE id = ?`,
      ).run(
        next.status,
        next.progress,
        next.progressMsg,
        next.output,
        next.error,
        next.traceId,
        next.sessionId,
        next.retryCount,
        next.completedAt,
        id,
      )
      return true
    },
    findById(id) {
      const r = findStmt.get(id) as Record<string, unknown> | undefined
      return r ? mapTaskRun(r) : undefined
    },
    listByTaskId(taskId) {
      return (listStmt.all(taskId) as Record<string, unknown>[]).map(mapTaskRun)
    },
  }
}
