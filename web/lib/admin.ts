import { env } from 'cloudflare:workers';
import { readSession } from './cookies';

export async function requireAdmin() {
  const session = await readSession('admin');
  const allowed = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!session?.email || !allowed || session.email.toLowerCase() !== allowed) return null;
  return { email:session.email };
}
