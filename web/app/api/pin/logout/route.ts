import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/cookies';
export async function POST(){ await deleteSession('pin'); return NextResponse.json({ok:true}); }
