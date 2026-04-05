import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { migrate } from './migrate.js'
import {
  createAgentRepository,
  createMessageRepository,
  createSessionRepository,
  createTaskRepository,
  createTaskRunRepository,
  createTraceRepository,
  type AgentRepository,
  type MessageRepository,
  type SessionRepository,
  type TaskRepository,
  type TaskRunRepository,
  type TraceRepository,
} from './repositories.js'
import type { DbAgentRow, DbMessage, DbSession, DbTrace } from './repositories.js'

export type {
  DbAgentRow,
  DbMessage,
  DbSession,
  DbTrace,
  AgentRepository,
  MessageRepository,
  SessionRepository,
  TaskRepository,
  TaskRunRepository,
  TraceRepository,
}

export interface DbTableInfo {
  name: string
  rowCount: number
  columns: { name: string; type: string }[]
}

export interface Db {
  sessions: SessionRepository
  messages: MessageRepository
  traces: TraceRepository
  agents: AgentRepository
  tasks: TaskRepository
  taskRuns: TaskRunRepository
  /** Raw sqlite handle for health checks / tests (do not expose statements). */
  ping(): void
  close(): void
  /** List all user tables with column metadata and row counts. */
  listTables(): DbTableInfo[]
  /**
   * Execute a read-only SELECT query.
   * Returns columns + rows (as arrays).
   * Throws if the statement is not a SELECT or limit is exceeded.
   */
  rawQuery(sql: string, maxRows?: number): { columns: string[]; rows: unknown[][] }
}

export function createDb(dbPath: string): Db {
  mkdirSync(dirname(dbPath), { recursive: true })
  const raw = new Database(dbPath)
  raw.pragma('journal_mode = WAL')
  migrate(raw)

  return {
    sessions: createSessionRepository(raw),
    messages: createMessageRepository(raw),
    traces: createTraceRepository(raw),
    agents: createAgentRepository(raw),
    tasks: createTaskRepository(raw),
    taskRuns: createTaskRunRepository(raw),
    ping() {
      raw.prepare('SELECT 1').get()
    },
    close() {
      raw.close()
    },
    listTables() {
      const tableNames = (
        raw
          .prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations' ORDER BY name`,
          )
          .all() as { name: string }[]
      ).map((r) => r.name)

      return tableNames.map((name) => {
        const countRow = raw.prepare(`SELECT COUNT(*) AS cnt FROM "${name}"`).get() as { cnt: number }
        const pragmaRows = raw.pragma(`table_info("${name}")`) as {
          name: string
          type: string
        }[]
        return {
          name,
          rowCount: countRow.cnt,
          columns: pragmaRows.map((c) => ({ name: c.name, type: c.type })),
        }
      })
    },
    rawQuery(sql: string, maxRows = 200) {
      // Only allow SELECT statements (basic guard)
      const trimmed = sql.trim().toLowerCase()
      if (!trimmed.startsWith('select') && !trimmed.startsWith('with')) {
        throw new Error('Only SELECT (or WITH) queries are allowed')
      }
      const stmt = raw.prepare(sql)
      const allRows = stmt.all() as Record<string, unknown>[]
      const truncated = allRows.length > maxRows
      const sliced = truncated ? allRows.slice(0, maxRows) : allRows
      const columns = sliced.length > 0 ? Object.keys(sliced[0]) : []
      const rows = sliced.map((r) => columns.map((c) => r[c]))
      return { columns, rows }
    },
  }
}
