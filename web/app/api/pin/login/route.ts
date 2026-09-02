import { NextRequest, NextResponse } from 'next/server';
import { checkPin } from '@/lib/pin';
import { createSession } from '@/lib/cookies';
import { isSameOrigin } from '@/lib/request-security';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({error:'無効なリクエストです。'}, {status:403});
  const body = await request.json().catch(() => ({})) as { pin?:string };
  if (!/^\d{4}$/.test(body.pin ?? '')) return NextResponse.json({error:'PINコードは4桁の数字で入力してください。'}, {status:400});
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
  const result = await checkPin(body.pin!, `pin:${ip}`);
  if (result.ok) { await createSession('pin', undefined, result.revision); return NextResponse.json({ok:true}); }
  if ('unconfigured' in result) return NextResponse.json({error:'現在PINコードが設定されていません。管理者が設定画面からPINコードを設定してください。', unconfigured:true}, {status:503});
  if (result.lockedUntil) return NextResponse.json({error:'入力回数が上限に達しました。15分後にもう一度お試しください。', lockedUntil:result.lockedUntil}, {status:429, headers:{'Retry-After':String(Math.ceil((result.lockedUntil-Date.now())/1000))}});
  return NextResponse.json({error:`PINコードが正しくありません。あと${result.remaining}回入力できます。`}, {status:401});
}
