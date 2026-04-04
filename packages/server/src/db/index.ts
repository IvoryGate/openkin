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
  }
}
