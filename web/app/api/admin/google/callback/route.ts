import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/cookies';
import { database, ensureDatabase } from '@/lib/database';
import { sha256 } from '@/lib/crypto';

export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get('code'), state=request.nextUrl.searchParams.get('state');
  if(!code||!state)return NextResponse.redirect(`${env.APP_BASE_URL}/settings?error=oauth`);
  await ensureDatabase();
  const stateHash=await sha256(state);
  const saved=await database().prepare('SELECT verifier, expires_at AS expiresAt FROM oauth_states WHERE state_hash=?').bind(stateHash).first<{verifier:string;expiresAt:number}>();
  await database().prepare('DELETE FROM oauth_states WHERE state_hash=?').bind(stateHash).run();
  if(!saved||saved.expiresAt<Date.now())return NextResponse.redirect(`${env.APP_BASE_URL}/settings?error=state`);
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:`${env.APP_BASE_URL}/api/admin/google/callback`,grant_type:'authorization_code',code_verifier:saved.verifier})});
  if(!tokenResponse.ok)return NextResponse.redirect(`${env.APP_BASE_URL}/settings?error=token`);
  const token=await tokenResponse.json() as {access_token?:string};
  const profileResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${token.access_token}`}});
  const profile=await profileResponse.json() as {email?:string;email_verified?:boolean};
  if(!profile.email||!profile.email_verified||profile.email.toLowerCase()!==env.ADMIN_EMAIL?.trim().toLowerCase())return NextResponse.redirect(`${env.APP_BASE_URL}/settings?error=denied`);
  await createSession('admin',profile.email);
  return NextResponse.redirect(`${env.APP_BASE_URL}/settings`);
}
