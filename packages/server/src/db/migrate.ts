import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const migrationsDir = join(fileURLToPath(new URL('.', import.meta.url)), 'migrations')

type SqliteDatabase = InstanceType<typeof Database>

export function migrate(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]
  const appliedSet = new Set(appliedRows.map((r) => r.version))

  for (const file of files) {
    const version = file.replace(/\.sql$/i, '')
    if (appliedSet.has(version)) continue

    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    const run = db.transaction(() => {
      try {
        db.exec(sql)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        // e.g. DB restored or column added out-of-band; still mark migration applied.
        if (!msg.includes('duplicate column name')) {
          throw e
        }
      }
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, Date.now())
    })
    run()
  }
}
