import { env } from 'cloudflare:workers';

let initialized: Promise<void> | undefined;

export function database() { return env.DB; }

export function ensureDatabase() {
  initialized ??= initialize();
  return initialized;
}

async function initialize() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS app_settings (id INTEGER PRIMARY KEY CHECK (id = 1), pin_hash TEXT, pin_salt TEXT, pin_iterations INTEGER, pin_revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('pin','admin')), email TEXT, pin_revision INTEGER, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pin_limits (identifier_hash TEXT PRIMARY KEY, failure_count INTEGER NOT NULL, window_started_at INTEGER NOT NULL, locked_until INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (state_hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS traffic_limits (identifier_hash TEXT PRIMARY KEY, last_request_at INTEGER NOT NULL)`),
  ]);
  await db.prepare('INSERT OR IGNORE INTO app_settings (id, pin_revision, updated_at) VALUES (1, 0, ?)').bind(Date.now()).run();
}
