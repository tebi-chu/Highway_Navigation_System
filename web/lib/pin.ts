import { database, ensureDatabase } from './database';
import { hashPin, sha256, verifyPin } from './crypto';

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export async function pinStatus() {
  await ensureDatabase();
  const row = await database().prepare('SELECT pin_hash AS hash, pin_revision AS revision FROM app_settings WHERE id = 1').first<{hash:string|null; revision:number}>();
  return { configured: Boolean(row?.hash), revision: row?.revision ?? 0 };
}

export async function checkPin(pin: string, identifier: string) {
  await ensureDatabase();
  const key = await sha256(identifier);
  const now = Date.now();
  const limit = await database().prepare('SELECT failure_count AS failures, window_started_at AS started, locked_until AS lockedUntil FROM pin_limits WHERE identifier_hash = ?')
    .bind(key).first<{failures:number; started:number; lockedUntil:number}>();
  if (limit && limit.lockedUntil > now) return { ok:false as const, lockedUntil:limit.lockedUntil };
  const settings = await database().prepare('SELECT pin_hash AS hash, pin_salt AS salt, pin_iterations AS iterations, pin_revision AS revision FROM app_settings WHERE id = 1')
    .first<{hash:string|null;salt:string|null;iterations:number|null;revision:number}>();
  if (!settings?.hash || !settings.salt || !settings.iterations) return { ok:false as const, unconfigured:true as const };
  if (await verifyPin(pin, settings.hash, settings.salt, settings.iterations)) {
    await database().prepare('DELETE FROM pin_limits WHERE identifier_hash = ?').bind(key).run();
    return { ok:true as const, revision:settings.revision };
  }
  const failures = !limit || now - limit.started > WINDOW_MS ? 1 : limit.failures + 1;
  const started = !limit || now - limit.started > WINDOW_MS ? now : limit.started;
  const lockedUntil = failures >= MAX_FAILURES ? now + LOCK_MS : 0;
  await database().prepare(`INSERT INTO pin_limits (identifier_hash, failure_count, window_started_at, locked_until) VALUES (?, ?, ?, ?)
    ON CONFLICT(identifier_hash) DO UPDATE SET failure_count=excluded.failure_count, window_started_at=excluded.window_started_at, locked_until=excluded.locked_until`)
    .bind(key, failures, started, lockedUntil).run();
  return { ok:false as const, remaining:Math.max(0, MAX_FAILURES - failures), lockedUntil };
}

export async function setPin(pin: string) {
  const encoded = await hashPin(pin);
  await ensureDatabase();
  await database().prepare(`UPDATE app_settings SET pin_hash=?, pin_salt=?, pin_iterations=?, pin_revision=pin_revision+1, updated_at=? WHERE id=1`)
    .bind(encoded.hash, encoded.salt, encoded.iterations, Date.now()).run();
  await database().prepare("DELETE FROM sessions WHERE kind='pin'").run();
  await database().prepare('DELETE FROM pin_limits').run();
}

export async function clearPin() {
  await ensureDatabase();
  await database().prepare('UPDATE app_settings SET pin_hash=NULL, pin_salt=NULL, pin_iterations=NULL, pin_revision=pin_revision+1, updated_at=? WHERE id=1').bind(Date.now()).run();
  await database().prepare("DELETE FROM sessions WHERE kind='pin'").run();
  await database().prepare('DELETE FROM pin_limits').run();
}
