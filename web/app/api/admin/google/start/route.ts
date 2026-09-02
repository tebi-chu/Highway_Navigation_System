import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { database, ensureDatabase } from '@/lib/database';
import { randomToken, sha256 } from '@/lib/crypto';

export async function GET() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.APP_BASE_URL) return NextResponse.json({error:'Google OAuthの環境変数が設定されていません。'}, {status:503});
  await ensureDatabase();
  const state=randomToken(), verifier=randomToken(48), challenge=await sha256(verifier);
  await database().prepare('INSERT INTO oauth_states (state_hash, verifier, expires_at) VALUES (?, ?, ?)').bind(await sha256(state),verifier,Date.now()+10*60*1000).run();
  const parameters=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:`${env.APP_BASE_URL}/api/admin/google/callback`,response_type:'code',scope:'openid email',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${parameters}`);
}
