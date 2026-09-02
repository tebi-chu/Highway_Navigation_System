import { NextResponse } from 'next/server';
import { pinStatus } from '@/lib/pin';
import { readSession } from '@/lib/cookies';

export async function GET() {
  const status = await pinStatus();
  return NextResponse.json({ configured:status.configured, authenticated:Boolean(await readSession('pin')) }, { headers:{'Cache-Control':'no-store'} });
}
