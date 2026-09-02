import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/cookies';
export async function GET(){await deleteSession('admin');return NextResponse.redirect(`${env.APP_BASE_URL}/settings`)}
