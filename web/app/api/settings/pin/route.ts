import { NextRequest,NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { clearPin,pinStatus,setPin } from '@/lib/pin';
import { isSameOrigin } from '@/lib/request-security';
export async function GET(){const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'管理者認証が必要です。'},{status:401});return NextResponse.json({...await pinStatus(),email:admin.email})}
export async function PUT(request:NextRequest){if(!isSameOrigin(request))return NextResponse.json({error:'無効なリクエストです。'},{status:403});if(!await requireAdmin())return NextResponse.json({error:'管理者認証が必要です。'},{status:401});const body=await request.json().catch(()=>({})) as {pin?:string;confirmation?:string};if(!/^\d{4}$/.test(body.pin??''))return NextResponse.json({error:'PINコードは4桁の数字で入力してください。'},{status:400});if(body.pin!==body.confirmation)return NextResponse.json({error:'確認用PINコードが一致しません。'},{status:400});await setPin(body.pin!);return NextResponse.json({ok:true,configured:true})}
export async function DELETE(request:NextRequest){if(!isSameOrigin(request))return NextResponse.json({error:'無効なリクエストです。'},{status:403});if(!await requireAdmin())return NextResponse.json({error:'管理者認証が必要です。'},{status:401});await clearPin();return NextResponse.json({ok:true,configured:false})}
