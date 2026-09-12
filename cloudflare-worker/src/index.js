const FACILITIES=new Set(['restaurant','convenienceStore','cafe','fuel','hotSpring','shower','viewArea']);
const BRANDS=new Set(['starbucks','tullys','doutor','sevenEleven','lawson','familyMart','gooz','ministop','yoshinoya','matsuya','sukiya']);
const EDIT_LIMIT=5;
const EDIT_WINDOW_SECONDS=60*60;

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
const base64url=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),char=>char.charCodeAt(0));

export function normalizeUpdate(body) {
  if(!body || typeof body!=='object')throw new Error('invalid body');
  if(!/^[a-zA-Z0-9_.:-]{1,160}$/.test(body.pointId||''))throw new Error('invalid point');
  if(!/^[a-zA-Z0-9_.:-]{1,80}$/.test(body.roadId||''))throw new Error('invalid road');
  if(!Array.isArray(body.facilities)||!Array.isArray(body.brands))throw new Error('invalid selections');
  const facilities=[...new Set(body.facilities)].filter(value=>FACILITIES.has(value));
  const brands=[...new Set(body.brands)].filter(value=>BRANDS.has(value));
  if(facilities.length!==body.facilities.length||brands.length!==body.brands.length)throw new Error('unknown selection');
  return {pointId:body.pointId,roadId:body.roadId,facilities,brands};
}

function cors(request,env) {
  const origin=request.headers.get('origin')||'';
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean);
  return allowed.includes(origin)?{
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'authorization,content-type,x-highway-device-id',
    'access-control-max-age':'86400',
    'vary':'Origin',
  }:null;
}

async function verifyGoogleToken(token,env) {
  if(!token||!env.GOOGLE_CLIENT_ID)return null;
  const parts=token.split('.');
  if(parts.length!==3)return null;
  let header,payload;
  try {
    header=JSON.parse(new TextDecoder().decode(base64url(parts[0])));
    payload=JSON.parse(new TextDecoder().decode(base64url(parts[1])));
  } catch {return null;}
  if(!header.kid||payload.aud!==env.GOOGLE_CLIENT_ID||!['https://accounts.google.com','accounts.google.com'].includes(payload.iss)||payload.exp*1000<=Date.now()||payload.email_verified!==true)return null;
  const jwks=await fetch('https://www.googleapis.com/oauth2/v3/certs',{cf:{cacheTtl:3600,cacheEverything:true}}).then(response=>response.json());
  const jwk=jwks.keys?.find(key=>key.kid===header.kid);
  if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64url(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if(!valid)return null;
  const allowed=(env.EDITOR_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(String(payload.email).toLowerCase())?{email:payload.email}:null;
}

async function editorFromRequest(request,env) {
  const authorization=request.headers.get('authorization')||'';
  return authorization.startsWith('Bearer ')?verifyGoogleToken(authorization.slice(7),env):null;
}

async function anonymousFingerprint(request,env) {
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const agent=(request.headers.get('user-agent')||'').slice(0,200);
  const device=(request.headers.get('x-highway-device-id')||'unknown').slice(0,100);
  const input=new TextEncoder().encode(`${ip}|${agent}|${device}|${env.RATE_LIMIT_SALT||'configure-this-secret'}`);
  const digest=await crypto.subtle.digest('SHA-256',input);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

async function consumeAnonymousLimit(request,env) {
  const now=Math.floor(Date.now()/1000),windowStart=Math.floor(now/EDIT_WINDOW_SECONDS)*EDIT_WINDOW_SECONDS;
  const fingerprint=await anonymousFingerprint(request,env);
  const row=await env.DB.prepare('SELECT edit_count FROM anonymous_edit_limits WHERE fingerprint=?1 AND window_start=?2').bind(fingerprint,windowStart).first();
  if((row?.edit_count||0)>=EDIT_LIMIT)return false;
  await env.DB.prepare(`INSERT INTO anonymous_edit_limits(fingerprint,window_start,edit_count) VALUES(?1,?2,1)
    ON CONFLICT(fingerprint,window_start) DO UPDATE SET edit_count=edit_count+1`).bind(fingerprint,windowStart).run();
  return true;
}

async function listOverrides(env,url) {
  const roadId=url.searchParams.get('roadId');
  const statement=roadId
    ? env.DB.prepare('SELECT point_id,road_id,facilities_json,brands_json,updated_at FROM facility_overrides WHERE road_id=?1').bind(roadId)
    : env.DB.prepare('SELECT point_id,road_id,facilities_json,brands_json,updated_at FROM facility_overrides');
  const {results=[]}=await statement.all();
  return results.map(row=>({pointId:row.point_id,roadId:row.road_id,facilities:JSON.parse(row.facilities_json),brands:JSON.parse(row.brands_json),updatedAt:row.updated_at}));
}

async function saveOverride(request,env) {
  const body=normalizeUpdate(await request.json());
  const editor=await editorFromRequest(request,env);
  if(!editor && !await consumeAnonymousLimit(request,env))return json({error:'短時間の編集回数が上限に達しました。1時間後にもう一度お試しください。'},429);
  const updatedAt=Date.now();
  await env.DB.prepare(`INSERT INTO facility_overrides(point_id,road_id,facilities_json,brands_json,updated_at) VALUES(?1,?2,?3,?4,?5)
    ON CONFLICT(point_id) DO UPDATE SET road_id=excluded.road_id,facilities_json=excluded.facilities_json,brands_json=excluded.brands_json,updated_at=excluded.updated_at`)
    .bind(body.pointId,body.roadId,JSON.stringify(body.facilities),JSON.stringify(body.brands),updatedAt).run();
  return json({...body,updatedAt,editor:!!editor});
}

export default {
  async fetch(request,env) {
    const headers=cors(request,env);
    if(!headers)return json({error:'許可されていないアクセス元です。'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    const url=new URL(request.url);
    try {
      if(request.method==='GET'&&url.pathname==='/v1/overrides')return json({overrides:await listOverrides(env,url)},200,{...headers,'cache-control':'public, max-age=60'});
      if(request.method==='GET'&&url.pathname==='/v1/editor/status') {
        const editor=await editorFromRequest(request,env);
        return editor?json({editor:true,email:editor.email},200,headers):json({editor:false},401,headers);
      }
      if(request.method==='POST'&&url.pathname==='/v1/overrides') {
        const response=await saveOverride(request,env);
        Object.entries(headers).forEach(([key,value])=>response.headers.set(key,value));
        return response;
      }
      return json({error:'not found'},404,headers);
    } catch(error) {
      return json({error:error instanceof Error&&error.message.startsWith('invalid')?'入力内容を確認してください。':'保存処理に失敗しました。'},400,headers);
    }
  },
  async scheduled(_event,env) {
    const cutoff=Math.floor(Date.now()/1000)-2*24*60*60;
    await env.DB.prepare('DELETE FROM anonymous_edit_limits WHERE window_start<?1').bind(cutoff).run();
  },
};
