import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { database, ensureDatabase } from './database';
import { randomToken, sha256 } from './crypto';

export const PIN_COOKIE = 'highway_pin_session';
export const ADMIN_COOKIE = 'highway_admin_session';
const PIN_TTL = 60 * 60 * 24 * 7;
const ADMIN_TTL = 60 * 60 * 8;

function secureCookie() { return env.COOKIE_SECURE !== 'false'; }

export async function createSession(kind: 'pin' | 'admin', email?: string, pinRevision?: number) {
  await ensureDatabase();
  const token = randomToken();
  const maxAge = kind === 'pin' ? PIN_TTL : ADMIN_TTL;
  const now = Date.now();
  await database().prepare('INSERT INTO sessions (token_hash, kind, email, pin_revision, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await sha256(token), kind, email ?? null, pinRevision ?? null, now + maxAge * 1000, now).run();
  (await cookies()).set(kind === 'pin' ? PIN_COOKIE : ADMIN_COOKIE, token, {
    httpOnly: true, secure: secureCookie(), sameSite: 'lax', path: '/', maxAge,
  });
}

export async function readSession(kind: 'pin' | 'admin') {
  await ensureDatabase();
  const token = (await cookies()).get(kind === 'pin' ? PIN_COOKIE : ADMIN_COOKIE)?.value;
  if (!token) return null;
  const row = await database().prepare('SELECT email, pin_revision AS pinRevision, expires_at AS expiresAt FROM sessions WHERE token_hash = ? AND kind = ?')
    .bind(await sha256(token), kind).first<{ email: string | null; pinRevision: number | null; expiresAt: number }>();
  if (!row || row.expiresAt <= Date.now()) return null;
  if (kind === 'pin') {
    const settings = await database().prepare('SELECT pin_revision AS revision, pin_hash AS hash FROM app_settings WHERE id = 1').first<{ revision:number; hash:string|null }>();
    if (!settings?.hash || row.pinRevision !== settings.revision) return null;
  }
  return row;
}

export async function deleteSession(kind: 'pin' | 'admin') {
  const store = await cookies();
  const name = kind === 'pin' ? PIN_COOKIE : ADMIN_COOKIE;
  const token = store.get(name)?.value;
  if (token) { await ensureDatabase(); await database().prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run(); }
  store.set(name, '', { httpOnly:true, secure:secureCookie(), sameSite:'lax', path:'/', maxAge:0 });
}
