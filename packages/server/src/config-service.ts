/**
 * ConfigService — runtime configuration centre (exec plan 027)
 *
 * Responsibilities:
 *  - Defines canonical defaults (mirrors env-variable fallbacks in cli.ts)
 *  - Reads persisted overrides from DB at startup
 *  - Applies PATCH updates with snapshot-before-write for rollback
 *  - Exposes a redacted DTO (no secret plain text) for the API layer
 *
 * Key design rules:
 *  - Secrets (API keys) are stored as-is in DB but NEVER appear in DTO output
 *  - All values are stored as individual JSON-encoded KV pairs in server_config
 *  - History entries store the full redacted snapshot (no secrets in history either)
 */

import { randomUUID } from 'node:crypto'
import { readCompatEnv } from '@theworld/core'
import type { Db } from './db/index.js'
import type { ServerConfigDto, PatchServerConfigRequest, ConfigHistoryEntryDto } from '@theworld/shared-contracts'

// ── Config keys ───────────────────────────────────────────────────────────────

const KEYS = {
  llmApiKey:              'llm.apiKey',
  llmBaseUrl:             'llm.baseUrl',
  llmModel:               'llm.model',
  llmMaxSteps:            'llm.maxSteps',
  serverApiKey:           'server.apiKey',
  serverMaxBodyBytes:     'server.maxBodyBytes',
  schedulerMaxConcurrent: 'scheduler.maxConcurrent',
  schedulerMaxRetries:    'scheduler.maxRetries',
  schedulerSlowThreshold: 'scheduler.slowRunThresholdMs',
  sandboxEnabled:         'sandbox.enabled',
  sandboxScriptTimeout:   'sandbox.scriptTimeoutMs',
  sandboxMaxOutput:       'sandbox.maxOutputBytes',
  runtimeCmdTimeout:      'runtime.commandTimeoutMs',
} as const

// ── Canonical defaults ────────────────────────────────────────────────────────
// These mirror the env-variable fallbacks in cli.ts / run-script.ts / etc.
// When no DB override exists and no env var is set, these values are used.

function defaultConfig(): InternalConfig {
  return {
    llmApiKey:              readCompatEnv('THEWORLD_LLM_API_KEY', 'OPENKIN_LLM_API_KEY') ?? process.env.OPENAI_API_KEY ?? '',
    llmBaseUrl:             readCompatEnv('THEWORLD_LLM_BASE_URL', 'OPENKIN_LLM_BASE_URL') ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    llmModel:               readCompatEnv('THEWORLD_LLM_MODEL', 'OPENKIN_LLM_MODEL') ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    llmMaxSteps:            12,
    serverApiKey:           readCompatEnv('THEWORLD_API_KEY', 'OPENKIN_API_KEY') ?? '',
    serverMaxBodyBytes:     Number(readCompatEnv('THEWORLD_MAX_BODY_BYTES', 'OPENKIN_MAX_BODY_BYTES') ?? 1_048_576),
    schedulerMaxConcurrent: Number(readCompatEnv('THEWORLD_TASK_MAX_CONCURRENT', 'OPENKIN_TASK_MAX_CONCURRENT') ?? 3),
    schedulerMaxRetries:    Number(readCompatEnv('THEWORLD_TASK_MAX_RETRIES', 'OPENKIN_TASK_MAX_RETRIES') ?? 2),
    schedulerSlowThreshold: Number(readCompatEnv('THEWORLD_SLOW_RUN_THRESHOLD_MS', 'OPENKIN_SLOW_RUN_THRESHOLD_MS') ?? 30_000),
    sandboxEnabled:         true,   // Deno detection happens in run-script.ts
    sandboxScriptTimeout:   30_000,
    sandboxMaxOutput:       65_536,
    runtimeCmdTimeout:      30_000,
  }
}

// Internal full config (includes secrets as plain strings)
interface InternalConfig {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  llmMaxSteps: number
  serverApiKey: string
  serverMaxBodyBytes: number
  schedulerMaxConcurrent: number
  schedulerMaxRetries: number
  schedulerSlowThreshold: number
  sandboxEnabled: boolean
  sandboxScriptTimeout: number
  sandboxMaxOutput: number
  runtimeCmdTimeout: number
}

function readJson<T>(db: Db, key: string, fallback: T): T {
  const raw = db.config.get(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function loadFromDb(db: Db): InternalConfig {
  const d = defaultConfig()
  return {
    llmApiKey:              readJson(db, KEYS.llmApiKey, d.llmApiKey),
    llmBaseUrl:             readJson(db, KEYS.llmBaseUrl, d.llmBaseUrl),
    llmModel:               readJson(db, KEYS.llmModel, d.llmModel),
    llmMaxSteps:            readJson(db, KEYS.llmMaxSteps, d.llmMaxSteps),
    serverApiKey:           readJson(db, KEYS.serverApiKey, d.serverApiKey),
    serverMaxBodyBytes:     readJson(db, KEYS.serverMaxBodyBytes, d.serverMaxBodyBytes),
    schedulerMaxConcurrent: readJson(db, KEYS.schedulerMaxConcurrent, d.schedulerMaxConcurrent),
    schedulerMaxRetries:    readJson(db, KEYS.schedulerMaxRetries, d.schedulerMaxRetries),
    schedulerSlowThreshold: readJson(db, KEYS.schedulerSlowThreshold, d.schedulerSlowThreshold),
    sandboxEnabled:         readJson(db, KEYS.sandboxEnabled, d.sandboxEnabled),
    sandboxScriptTimeout:   readJson(db, KEYS.sandboxScriptTimeout, d.sandboxScriptTimeout),
    sandboxMaxOutput:       readJson(db, KEYS.sandboxMaxOutput, d.sandboxMaxOutput),
    runtimeCmdTimeout:      readJson(db, KEYS.runtimeCmdTimeout, d.runtimeCmdTimeout),
  }
}

function toDto(c: InternalConfig): ServerConfigDto {
  return {
    llm: {
      hasApiKey: Boolean(c.llmApiKey),
      baseUrl: c.llmBaseUrl,
      model: c.llmModel,
      maxSteps: c.llmMaxSteps,
    },
    server: {
      hasApiKey: Boolean(c.serverApiKey),
      maxBodyBytes: c.serverMaxBodyBytes,
    },
    scheduler: {
      maxConcurrent: c.schedulerMaxConcurrent,
      maxRetries: c.schedulerMaxRetries,
      slowRunThresholdMs: c.schedulerSlowThreshold,
    },
    sandbox: {
      enabled: c.sandboxEnabled,
      scriptTimeoutMs: c.sandboxScriptTimeout,
      maxOutputBytes: c.sandboxMaxOutput,
    },
    runtime: {
      commandTimeoutMs: c.runtimeCmdTimeout,
    },
  }
}

// ── ConfigService ─────────────────────────────────────────────────────────────

export class ConfigService {
  private current: InternalConfig
  private readonly llmChangedCallbacks: Array<() => void> = []

  constructor(private readonly db: Db) {
    this.current = loadFromDb(db)
  }

  /**
   * Register a callback that fires whenever LLM-related settings change
   * (apiKey, baseUrl, model). Used by cli.ts to hot-swap the LLM provider.
   */
  onLlmConfigChanged(cb: () => void): void {
    this.llmChangedCallbacks.push(cb)
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  getDto(): ServerConfigDto {
    return toDto(this.current)
  }

  /** Resolved LLM API key (plain text, for internal use only). */
  getLlmApiKey(): string { return this.current.llmApiKey }
  getLlmBaseUrl(): string { return this.current.llmBaseUrl }
  getLlmModel(): string { return this.current.llmModel }
  getLlmMaxSteps(): number { return this.current.llmMaxSteps }

  getServerApiKey(): string { return this.current.serverApiKey }
  getServerMaxBodyBytes(): number { return this.current.serverMaxBodyBytes }

  getSchedulerMaxConcurrent(): number { return this.current.schedulerMaxConcurrent }
  getSchedulerMaxRetries(): number { return this.current.schedulerMaxRetries }
  getSchedulerSlowThreshold(): number { return this.current.schedulerSlowThreshold }

  isSandboxEnabled(): boolean { return this.current.sandboxEnabled }
  getSandboxScriptTimeout(): number { return this.current.sandboxScriptTimeout }
  getSandboxMaxOutput(): number { return this.current.sandboxMaxOutput }

  getRuntimeCmdTimeout(): number { return this.current.runtimeCmdTimeout }

  // ── Write ─────────────────────────────────────────────────────────────────

  /**
   * Apply a partial config patch.
   * Saves a snapshot of the current config to history before writing.
   * Returns the new redacted DTO.
   */
  patch(req: PatchServerConfigRequest): ServerConfigDto {
    const now = Date.now()
    const historyId = randomUUID()

    // Save snapshot BEFORE the change (redacted — no secrets in history)
    this.db.configHistory.insert({
      id: historyId,
      snapshot: JSON.stringify(toDto(this.current)),
      changedBy: req._changedBy ?? 'user',
      note: req._note ?? null,
      createdAt: now,
    })

    // Build updated config
    const next = { ...this.current }

    if (req.llm !== undefined) {
      const l = req.llm
      if (l.apiKey !== undefined) next.llmApiKey = l.apiKey ?? ''
      if (l.baseUrl !== undefined) next.llmBaseUrl = l.baseUrl
      if (l.model !== undefined) next.llmModel = l.model
      if (l.maxSteps !== undefined) next.llmMaxSteps = l.maxSteps
    }
    if (req.server !== undefined) {
      const s = req.server
      if (s.apiKey !== undefined) next.serverApiKey = s.apiKey ?? ''
      if (s.maxBodyBytes !== undefined) next.serverMaxBodyBytes = s.maxBodyBytes
    }
    if (req.scheduler !== undefined) {
      const sc = req.scheduler
      if (sc.maxConcurrent !== undefined) next.schedulerMaxConcurrent = sc.maxConcurrent
      if (sc.maxRetries !== undefined) next.schedulerMaxRetries = sc.maxRetries
      if (sc.slowRunThresholdMs !== undefined) next.schedulerSlowThreshold = sc.slowRunThresholdMs
    }
    if (req.sandbox !== undefined) {
      const sb = req.sandbox
      if (sb.enabled !== undefined) next.sandboxEnabled = sb.enabled
      if (sb.scriptTimeoutMs !== undefined) next.sandboxScriptTimeout = sb.scriptTimeoutMs
      if (sb.maxOutputBytes !== undefined) next.sandboxMaxOutput = sb.maxOutputBytes
    }
    if (req.runtime !== undefined) {
      const rt = req.runtime
      if (rt.commandTimeoutMs !== undefined) next.runtimeCmdTimeout = rt.commandTimeoutMs
    }

    // Detect if LLM-related config changed (to trigger hot-swap callback)
    const llmChanged =
      next.llmApiKey !== this.current.llmApiKey ||
      next.llmBaseUrl !== this.current.llmBaseUrl ||
      next.llmModel !== this.current.llmModel

    // Persist all changed keys
    const entries: { key: string; valueJson: string }[] = [
      { key: KEYS.llmApiKey,              valueJson: JSON.stringify(next.llmApiKey) },
      { key: KEYS.llmBaseUrl,             valueJson: JSON.stringify(next.llmBaseUrl) },
      { key: KEYS.llmModel,               valueJson: JSON.stringify(next.llmModel) },
      { key: KEYS.llmMaxSteps,            valueJson: JSON.stringify(next.llmMaxSteps) },
      { key: KEYS.serverApiKey,           valueJson: JSON.stringify(next.serverApiKey) },
      { key: KEYS.serverMaxBodyBytes,     valueJson: JSON.stringify(next.serverMaxBodyBytes) },
      { key: KEYS.schedulerMaxConcurrent, valueJson: JSON.stringify(next.schedulerMaxConcurrent) },
      { key: KEYS.schedulerMaxRetries,    valueJson: JSON.stringify(next.schedulerMaxRetries) },
      { key: KEYS.schedulerSlowThreshold, valueJson: JSON.stringify(next.schedulerSlowThreshold) },
      { key: KEYS.sandboxEnabled,         valueJson: JSON.stringify(next.sandboxEnabled) },
      { key: KEYS.sandboxScriptTimeout,   valueJson: JSON.stringify(next.sandboxScriptTimeout) },
      { key: KEYS.sandboxMaxOutput,       valueJson: JSON.stringify(next.sandboxMaxOutput) },
      { key: KEYS.runtimeCmdTimeout,      valueJson: JSON.stringify(next.runtimeCmdTimeout) },
    ]
    this.db.config.setMany(entries, now)

    this.current = next

    // Notify LLM hot-swap listeners after config is committed
    if (llmChanged) {
      for (const cb of this.llmChangedCallbacks) {
        try { cb() } catch { /* ignore */ }
      }
    }

    return toDto(next)
  }

  // ── History ───────────────────────────────────────────────────────────────

  listHistory(limit = 20): ConfigHistoryEntryDto[] {
    return this.db.configHistory.list(limit).map((row) => ({
      id: row.id,
      snapshot: JSON.parse(row.snapshot) as ServerConfigDto,
      changedBy: row.changedBy,
      note: row.note,
      createdAt: row.createdAt,
    }))
  }

  /**
   * Restore config to a previous snapshot.
   * This itself writes a new history entry (so the restore is also undoable).
   * Secrets are NOT stored in history snapshots, so restored config will have
   * `hasApiKey` info but blank actual keys — the user must re-enter API keys
   * if they were set after the snapshot was taken.
   */
  restore(historyId: string): { dto: ServerConfigDto; found: boolean } {
    const row = this.db.configHistory.findById(historyId)
    if (!row) return { dto: toDto(this.current), found: false }

    let snapshot: ServerConfigDto
    try {
      snapshot = JSON.parse(row.snapshot) as ServerConfigDto
    } catch {
      return { dto: toDto(this.current), found: false }
    }

    // Build a patch from the snapshot (secrets will be cleared since they aren't in history)
    const restorePatch: PatchServerConfigRequest = {
      llm: {
        baseUrl: snapshot.llm.baseUrl,
        model: snapshot.llm.model,
        maxSteps: snapshot.llm.maxSteps,
      },
      server: {
        maxBodyBytes: snapshot.server.maxBodyBytes,
      },
      scheduler: {
        maxConcurrent: snapshot.scheduler.maxConcurrent,
        maxRetries: snapshot.scheduler.maxRetries,
        slowRunThresholdMs: snapshot.scheduler.slowRunThresholdMs,
      },
      sandbox: {
        enabled: snapshot.sandbox.enabled,
        scriptTimeoutMs: snapshot.sandbox.scriptTimeoutMs,
        maxOutputBytes: snapshot.sandbox.maxOutputBytes,
      },
      runtime: {
        commandTimeoutMs: snapshot.runtime.commandTimeoutMs,
      },
      _changedBy: 'user',
      _note: `Restored from history entry ${historyId} (${new Date(row.createdAt).toISOString()})`,
    }

    const dto = this.patch(restorePatch)
    return { dto, found: true }
  }
}
