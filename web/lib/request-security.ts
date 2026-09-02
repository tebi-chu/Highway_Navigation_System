import { env } from 'cloudflare:workers';
import { NextRequest } from 'next/server';
export function isSameOrigin(request:NextRequest){const origin=request.headers.get('origin');if(!origin)return false;try{const expected=env.APP_BASE_URL?new URL(env.APP_BASE_URL).origin:request.nextUrl.origin;return new URL(origin).origin===expected}catch{return false}}
