import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/lib/cookies';
import { database, ensureDatabase } from '@/lib/database';
import { sha256 } from '@/lib/crypto';
import { isSameOrigin } from '@/lib/request-security';
import highway from '@/data/highway.json';

type RequestBody={latitude?:number;longitude?:number;pointIDs?:string[]};
type MatrixElement={originIndex?:number;destinationIndex?:number;distanceMeters?:number;duration?:string;staticDuration?:string;condition?:string;status?:{code?:number;message?:string}};
const pointLookup=new Map(highway.points.map(point=>[point.id,point]));
const MIN_INTERVAL_MS=45_000;

function seconds(value?:string){if(!value)return null;const parsed=Number(value.replace(/s$/,''));return Number.isFinite(parsed)?parsed:null}
function congestion(duration:number,staticDuration:number|null){if(!staticDuration||staticDuration<=0)return'unknown';const ratio=duration/staticDuration;return ratio>=1.5?'heavy':ratio>=1.2?'moderate':'normal'}

export async function POST(request:NextRequest){
  if(!isSameOrigin(request))return NextResponse.json({error:'無効なリクエストです。'},{status:403});
  if(!await readSession('pin'))return NextResponse.json({error:'PIN認証が必要です。'},{status:401});
  if(!env.GOOGLE_MAPS_API_KEY)return NextResponse.json({error:'渋滞情報APIが設定されていません。'},{status:503});
  const body=await request.json().catch(()=>({})) as RequestBody;
  if(typeof body.latitude!=='number'||typeof body.longitude!=='number'||body.latitude<30||body.latitude>46||body.longitude<128||body.longitude>146)return NextResponse.json({error:'現在位置が正しくありません。'},{status:400});
  const ids=Array.isArray(body.pointIDs)?[...new Set(body.pointIDs)].slice(0,6):[];
  const destinations=ids.map(id=>pointLookup.get(id)).filter((point):point is NonNullable<typeof point>=>Boolean(point));
  if(!destinations.length)return NextResponse.json({error:'照会地点がありません。'},{status:400});

  await ensureDatabase();
  const ip=request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]??'local';
  const identifier=await sha256(`traffic:${ip}`),now=Date.now();
  const limit=await database().prepare('SELECT last_request_at AS lastRequestAt FROM traffic_limits WHERE identifier_hash=?').bind(identifier).first<{lastRequestAt:number}>();
  if(limit&&now-limit.lastRequestAt<MIN_INTERVAL_MS){const retry=Math.ceil((MIN_INTERVAL_MS-(now-limit.lastRequestAt))/1000);return NextResponse.json({error:`渋滞情報は${retry}秒後に更新できます。`,retryAfter:retry},{status:429,headers:{'Retry-After':String(retry)}})}
  await database().prepare('INSERT INTO traffic_limits (identifier_hash,last_request_at) VALUES (?,?) ON CONFLICT(identifier_hash) DO UPDATE SET last_request_at=excluded.last_request_at').bind(identifier,now).run();

  const apiResponse=await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'originIndex,destinationIndex,status,condition,distanceMeters,duration,staticDuration'},body:JSON.stringify({origins:[{waypoint:{location:{latLng:{latitude:body.latitude,longitude:body.longitude}}}}],destinations:destinations.map(point=>({waypoint:{location:{latLng:point.coordinate}}})),travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE',languageCode:'ja',regionCode:'JP'})});
  if(!apiResponse.ok){const detail=await apiResponse.text();console.error('Routes API error',apiResponse.status,detail.slice(0,500));return NextResponse.json({error:'リアルタイム渋滞情報を取得できませんでした。'},{status:502})}
  const matrix=await apiResponse.json() as MatrixElement[];
  const items=matrix.map(element=>{const duration=seconds(element.duration),staticDuration=seconds(element.staticDuration);if(element.destinationIndex===undefined||duration===null||element.condition==='ROUTE_NOT_FOUND'||element.status?.code)return null;return{pointID:destinations[element.destinationIndex]?.id,durationSeconds:duration,staticDurationSeconds:staticDuration,distanceMeters:element.distanceMeters??null,congestion:congestion(duration,staticDuration)}}).filter(Boolean);
  return NextResponse.json({updatedAt:now,source:'Google Routes API',items},{headers:{'Cache-Control':'private, no-store'}});
}
