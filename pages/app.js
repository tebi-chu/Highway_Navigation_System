const config = window.HIGHWAY_ASSIST_CONFIG || {};
const facilityLabels = {restaurant:'食事',fuel:'ガソリンスタンド',convenienceStore:'コンビニ',cafe:'カフェ',hotSpring:'温泉',shower:'シャワー',viewArea:'ビューエリア'};
const facilityIcons = {
  restaurant:'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 3h3v11h2V3h3v11h2V3h3v12c0 3-2 6-5 7v15H9V22c-3-1-4-4-4-7V3Zm25 0c-6 6-8 14-7 23h4v11h5V3h-2Z"/></svg>',
  convenienceStore:'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 5h32l-3 10H7L4 5Zm3 13h26v19H7V18Zm5 5v14h7V23h-7Zm11 0v7h6v-7h-6Z"/></svg>',
  cafe:'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 14h24v10c0 7-5 11-12 11S7 31 7 24V14Zm24 3v5h2c3 0 3-5 0-5h-2ZM10 38h23v-3H10v3ZM13 3c-4 4 3 5 0 9h3c4-4-3-5 0-9h-3Zm8 0c-4 4 3 5 0 9h3c4-4-3-5 0-9h-3Z"/></svg>',
  fuel:'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 3h22v34H4V3Zm5 5v10h12V8H9Zm20 5 5 4v14c0 2 3 2 3 0V13l-4-5 2-2 5 6v19c0 7-10 7-10 0V20h-4v-4h3v-3Z"/></svg>',
  hotSpring:'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 3c-6 6 5 8 0 15h5c6-7-5-9 0-15H8Zm10 0c-6 6 5 8 0 15h5c6-7-5-9 0-15h-5Zm10 0c-6 6 5 8 0 15h5c6-7-5-9 0-15h-5ZM3 23c5 0 6 3 11 3s6-3 11-3 7 3 12 3v11H3V23Z"/></svg>',
  shower:'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 17C4 9 10 3 18 3c6 0 11 3 13 8l-4 2c-2-4-5-6-9-6-6 0-10 4-10 10H4Zm23-5 9 9-17 3 8-12Zm-5 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7-1a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-10 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/></svg>',
  viewArea:'<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 8h8l3 7h8l3-7h8l4 25H25v-7H15v7H1L5 8Zm5 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm20 0a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/></svg>',
};
const displayedFacilities = new Set(['restaurant','convenienceStore','cafe','fuel','hotSpring','shower','viewArea']);
const displayedBrands = new Set(['starbucks','tullys','doutor','sevenEleven','lawson','familyMart','gooz','ministop','yoshinoya','matsuya','sukiya']);
const brandLabels = {starbucks:'STARBUCKS',tullys:"TULLY'S",doutor:'DOUTOR',sevenEleven:'7-ELEVEN',lawson:'LAWSON',familyMart:'FamilyMart',gooz:'gooz!',ministop:'ミニストップ',yoshinoya:'吉野家',matsuya:'松屋',sukiya:'すき家'};
let links = [], points = [], watchId = null, manifest = null, loadedRegion = null;
let wakeLock = null, navigationActive = false, estimateTimer = null;
let wakeLockRetryTimer = null, wakeLockMonitorTimer = null, wakeLockRequestPending = false;
let estimatedMatch = null, lastGoodGpsAt = 0, estimateTickAt = 0, lastAccuracy = 0, lastReliableSpeed = 0;
let lastGoodCoordinate = null, lastGoodCoordinateAt = 0;
let lastRenderArgs = null;
const GPS_ACCURACY_LIMIT_METERS = 100;
const GPS_SILENCE_BEFORE_ESTIMATE_MS = 3000;
const MAX_ESTIMATE_DURATION_MS = 15*60*1000;

const $ = (id) => document.getElementById(id);
const meters = (a,b) => {const lat=(a.latitude+b.latitude)*Math.PI/360; return Math.hypot((b.longitude-a.longitude)*111320*Math.cos(lat),(b.latitude-a.latitude)*110540)};
const eta = (seconds) => new Date(Date.now()+seconds*1000).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function authenticated() {
  const [hash, expiry] = (localStorage.getItem('highway-assist-login') || '').split(':');
  return hash === config.pinHash && Number(expiry) > Date.now();
}

function showNavigation() {
  $('login').hidden = true;
  $('navigation').hidden = false;
  navigationActive = true;
  requestWakeLock();
  startNavigation();
}

async function requestWakeLock() {
  if(!navigationActive || document.visibilityState!=='visible' || !('wakeLock' in navigator) || wakeLockRequestPending || (wakeLock && !wakeLock.released)) return;
  wakeLockRequestPending=true;
  try {
    wakeLock=await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release',()=>{wakeLock=null;scheduleWakeLockRetry(500);},{once:true});
  } catch {
    wakeLock=null;
    scheduleWakeLockRetry(5000);
  } finally {
    wakeLockRequestPending=false;
  }
}

function scheduleWakeLockRetry(delay=5000) {
  if(wakeLockRetryTimer!==null || !navigationActive || document.visibilityState!=='visible')return;
  wakeLockRetryTimer=setTimeout(()=>{wakeLockRetryTimer=null;requestWakeLock();},delay);
}

async function releaseWakeLock() {
  const held=wakeLock;
  wakeLock=null;
  if(held && !held.released) await held.release().catch(()=>{});
}

document.addEventListener('visibilitychange',()=>{
  estimateTickAt=Date.now();
  if(document.visibilityState==='visible') {
    requestWakeLock();
    refreshLocationAfterResume();
  }
});
document.addEventListener('pointerdown',()=>requestWakeLock(),{passive:true});
document.addEventListener('touchstart',()=>requestWakeLock(),{passive:true});

$('pin-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const pin = $('pin').value;
  if (!/^\d{4}$/.test(pin)) {
    $('pin-error').textContent = '4桁の数字を入力してください。';
    return;
  }
  if (await sha256(pin) !== config.pinHash) {
    $('pin-error').textContent = 'PINコードが正しくありません。';
    $('pin').select();
    return;
  }
  localStorage.setItem('highway-assist-login', `${config.pinHash}:${Date.now()+7*24*60*60*1000}`);
  showNavigation();
});

function nearest(link, position) {
  let best={distance:Infinity,offset:0,bearing:0}, travel=0;
  const latScale=110540,lonScale=111320*Math.cos(position.latitude*Math.PI/180);
  for(let i=1;i<link.polyline.length;i++) {
    const a=link.polyline[i-1],b=link.polyline[i],dx=(b.longitude-a.longitude)*lonScale,dy=(b.latitude-a.latitude)*latScale;
    const px=(position.longitude-a.longitude)*lonScale,py=(position.latitude-a.latitude)*latScale;
    const ratio=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1)));
    const distance=Math.hypot(px-ratio*dx,py-ratio*dy),length=meters(a,b);
    if(distance<best.distance) {
      const bearing=(Math.atan2(dx,dy)*180/Math.PI+360)%360;
      best={distance,offset:travel+length*ratio,bearing};
    }
    travel+=length;
  }
  return best;
}

function matchPosition(position) {
  const coordinate={latitude:position.coords.latitude,longitude:position.coords.longitude};
  const heading=position.coords.heading;
  const moving=Number.isFinite(heading) && (position.coords.speed||0)>=2;
  const candidates=links.map(link=>{
    const candidate=nearest(link,coordinate);
    const angle=Math.abs(((candidate.bearing-heading+540)%360)-180);
    return {link,...candidate,score:candidate.distance+(moving?angle*12:0)};
  }).sort((a,b)=>a.score-b.score);
  if(!candidates[0] || candidates[0].distance>1500) return null;
  return {...candidates[0],speed:Math.max(0,position.coords.speed||0)};
}

function findUpcoming(match) {
  const byID=new Map(links.map(link=>[link.id,link])),results=[];
  for(const point of points) if(point.linkID===match.link.id && point.offsetMeters>=match.offset-200) results.push({...point,remaining:point.offsetMeters-match.offset});
  const queue=(match.link.nextLinkIDs||[]).map(id=>({id,distance:match.link.lengthMeters-match.offset}));
  const visited=new Map();
  while(queue.length && results.length<24) {
    queue.sort((a,b)=>a.distance-b.distance);
    const current=queue.shift(),link=byID.get(current.id);
    if(!link || current.distance>=visited.get(link.id))continue;
    visited.set(link.id,current.distance);
    for(const point of points)if(point.linkID===link.id)results.push({...point,remaining:current.distance+point.offsetMeters});
    for(const nextID of link.nextLinkIDs||[])queue.push({id:nextID,distance:current.distance+link.lengthMeters});
  }
  const unique=[];
  for(const item of results.sort((a,b)=>a.remaining-b.remaining)) {
    if(!unique.some(existing=>existing.name===item.name && existing.kind===item.kind && Math.abs(existing.remaining-item.remaining)<500))unique.push(item);
  }
  const merged=[];
  const baseName=name=>name.replace(/(?:PA|SA)?スマート$/,'').replace(/(?:PA|SA)$/,'');
  for(const item of unique) {
    const kinds=new Set([item.kind]);
    const partner=merged.find(existing=>{
      const combined=new Set([...(existing.kinds||[existing.kind]),...kinds]);
      return existing.linkID===item.linkID && baseName(existing.name)===baseName(item.name)
        && Math.abs(existing.remaining-item.remaining)<600
        && combined.has('IC') && (combined.has('PA')||combined.has('SA'));
    });
    if(!partner) {
      merged.push({...item,kinds:[item.kind]});
      continue;
    }
    partner.kinds=[...new Set([...partner.kinds,item.kind])];
    partner.facilities=[...new Set([...(partner.facilities||[]),...(item.facilities||[])])];
    partner.brands=[...new Set([...(partner.brands||[]),...(item.brands||[])])];
    const area=[partner,item].find(point=>point.kind==='PA'||point.kind==='SA');
    if(area) {
      partner.kind=area.kind;
      partner.name=baseName(area.name);
      partner.romanizedName=area.romanizedName||partner.romanizedName;
    }
    partner.remaining=Math.min(partner.remaining,item.remaining);
  }
  return merged.slice(0,7);
}

function advanceMatch(match, distanceMeters) {
  const byID=new Map(links.map(link=>[link.id,link]));
  let link=match.link,offset=match.offset+Math.max(0,distanceMeters);
  while(offset>link.lengthMeters && link.nextLinkIDs?.length) {
    offset-=link.lengthMeters;
    const next=byID.get(link.nextLinkIDs[0]);
    if(!next)break;
    link=next;
  }
  return {...match,link,offset:Math.min(offset,link.lengthMeters),speed:lastReliableSpeed};
}

function updateEstimatedPosition(message='GPS受信不安定・直前速度で推定中') {
  if(!estimatedMatch)return false;
  const now=Date.now(),lostFor=now-lastGoodGpsAt;
  if(lostFor<GPS_SILENCE_BEFORE_ESTIMATE_MS)return false;
  if(lostFor>MAX_ESTIMATE_DURATION_MS) {
    $('status-message').textContent='GPSを長時間取得できないため推定を停止しました。';
    return false;
  }
  const elapsed=Math.max(0,Math.min(3,(now-estimateTickAt)/1000));
  estimateTickAt=now;
  estimatedMatch=advanceMatch(estimatedMatch,lastReliableSpeed*elapsed);
  render(estimatedMatch,lastAccuracy,message);
  return true;
}

function render(match, accuracy, statusText='') {
  lastRenderArgs={match,accuracy,statusText};
  const upcoming=findUpcoming(match);
  const landscape=window.matchMedia('(orientation: landscape)').matches;
  const portraitPoints=upcoming.slice(0,5);
  const slots=[...Array(5-portraitPoints.length).fill(null),...portraitPoints.reverse()];
  const speedKph=match.speed*3.6>=20?match.speed*3.6:match.link.standardSpeedKPH;

  $('route-number').textContent=match.link.id.startsWith('e4a-')?'E4A':match.link.id.startsWith('e4-')?'E4':'C4';
  $('highway-name').textContent=match.link.highwayName;
  $('direction').textContent=`${match.link.directionName}・${match.link.destinationName}`;
  $('status-message').textContent=statusText||`GPS精度 ±${Math.round(accuracy)}m`;
  $('gps-dot').classList.add('active');
  $('speed').textContent=`${Math.round(match.speed*3.6)} km/h`;
  const createCard=(item, compact=false) => {
    if(!item) {const empty=document.createElement('div');empty.className='empty-slot';return empty;}
    const displayKinds=[...(item.kinds||[item.kind])].sort((a,b)=>(a==='SA'||a==='PA'?-1:0)-(b==='SA'||b==='PA'?-1:0));
    const article=document.createElement('article');article.className=`live-card kind-${item.kind.toLowerCase()}${compact?' compact-card':''}`;
    if(compact) {
      article.innerHTML=`<div class="live-title"><div class="point-kinds">${displayKinds.map(kind=>`<span>${kind}</span>`).join('')}</div><strong class="point-name"><span>${item.name}</span></strong></div><div class="compact-metrics"><b>${(Math.max(0,item.remaining)/1000).toFixed(1)}<small>km</small></b><b>${eta(item.remaining/(speedKph*1000/3600))}<small>通過</small></b></div>`;
      return article;
    }
    const visibleBrands=item.brands.filter(brand=>displayedBrands.has(brand));
    const branded=new Set(visibleBrands.flatMap(brand=>['starbucks','tullys','doutor'].includes(brand)?['cafe']:['sevenEleven','lawson','familyMart','gooz','ministop'].includes(brand)?['convenienceStore']:['yoshinoya','matsuya','sukiya'].includes(brand)?['restaurant']:[]));
    const brands=visibleBrands.map(brand=>`<b class="brand-badge brand-${brand}">${brandLabels[brand]}</b>`);
    const icons=item.facilities.filter(facility=>displayedFacilities.has(facility)&&!branded.has(facility)).map(facility=>`<span class="facility-icon" title="${facilityLabels[facility]||''}">${facilityIcons[facility]||''}</span>`);
    const facilities=[...brands,...icons].join('');
    article.innerHTML=`<div class="live-title"><div class="point-kinds">${displayKinds.map(kind=>`<span>${kind}</span>`).join('')}</div><strong class="point-name"><span>${item.name}</span>${item.romanizedName?`<small>${item.romanizedName}</small>`:''}</strong></div><div class="live-details${facilities?'':' no-facilities'}">${facilities?`<div class="facility-row">${facilities}</div>`:''}<div class="live-metrics"><b class="arrival-time">${eta(item.remaining/(speedKph*1000/3600))}<small>通過</small></b><b class="next-distance">${(Math.max(0,item.remaining)/1000).toFixed(1)}<small>km</small></b></div></div>`;
    return article;
  };
  if(landscape) {
    const primary=upcoming.slice(0,3).reverse();
    const compact=upcoming.slice(3,7).reverse();
    const compactColumn=document.createElement('div');compactColumn.className='landscape-column compact-column';compactColumn.replaceChildren(...compact.map(item=>createCard(item,true)));
    const primaryColumn=document.createElement('div');primaryColumn.className='landscape-column primary-column';primaryColumn.replaceChildren(...primary.map(item=>createCard(item)));
    $('point-list').replaceChildren(compactColumn,primaryColumn);
  } else {
    $('point-list').replaceChildren(...slots.map(item=>createCard(item)));
  }
}

window.addEventListener('resize',()=>{
  if(lastRenderArgs) render(lastRenderArgs.match,lastRenderArgs.accuracy,lastRenderArgs.statusText);
});

function regionFor(latitude, longitude) {
  return manifest?.regions.find(({bounds}) => latitude>=bounds.south && latitude<=bounds.north && longitude>=bounds.west && longitude<=bounds.east) || null;
}

async function ensureRegion(position) {
  const region=regionFor(position.coords.latitude,position.coords.longitude);
  if(!region) {
    links=[];points=[];loadedRegion=null;
    $('status-message').textContent='この地域の高速道路データは現在準備中です。';
    return false;
  }
  if(loadedRegion===region.id) return true;
  $('status-message').textContent=`${region.name}の道路データを読み込んでいます…`;
  const response=await fetch(region.file);
  if(!response.ok) throw new Error('region data unavailable');
  const data=await response.json();
  links=data.links;points=data.points;loadedRegion=region.id;
  return true;
}

async function handlePosition(position) {
  try {
      const accuracy=position.coords.accuracy;
      if((!Number.isFinite(accuracy) || accuracy>GPS_ACCURACY_LIMIT_METERS) && estimatedMatch) {
        lastAccuracy=Number.isFinite(accuracy)?accuracy:lastAccuracy;
        if(!updateEstimatedPosition(`GPS精度低下 ±${Math.round(lastAccuracy)}m・直前速度で推定中`)) $('status-message').textContent=`GPS精度が低下しています（±${Math.round(lastAccuracy)}m）`;
        return;
      }
      if(!await ensureRegion(position))return;
      if(!Number.isFinite(accuracy) || accuracy>GPS_ACCURACY_LIMIT_METERS) {
        lastAccuracy=Number.isFinite(accuracy)?accuracy:lastAccuracy;
        if(!updateEstimatedPosition(`GPS精度低下 ±${Math.round(lastAccuracy)}m・直前速度で推定中`)) $('status-message').textContent=`GPS精度が低下しています（±${Math.round(lastAccuracy)}m）`;
        return;
      }
      const match=matchPosition(position);
      if(match) {
        const now=Date.now();
        if(Number.isFinite(position.coords.speed) && position.coords.speed>=0) {
          lastReliableSpeed=position.coords.speed;
        } else if(lastGoodCoordinate && now>lastGoodCoordinateAt) {
          const derivedSpeed=meters(lastGoodCoordinate,{latitude:position.coords.latitude,longitude:position.coords.longitude})/((now-lastGoodCoordinateAt)/1000);
          if(derivedSpeed>=0 && derivedSpeed<=60)lastReliableSpeed=derivedSpeed;
        }
        match.speed=lastReliableSpeed;
        estimatedMatch=match;
        lastGoodGpsAt=now;estimateTickAt=now;lastAccuracy=accuracy;
        lastGoodCoordinate={latitude:position.coords.latitude,longitude:position.coords.longitude};lastGoodCoordinateAt=now;
        render(match,accuracy);
      } else {
        estimatedMatch=null;
        $('status-message').textContent='対応ルート付近の高速道路を判定できません。';
      }
  } catch {$('status-message').textContent='地域の道路データを読み込めません。';}
}

function handlePositionError(error) {
  if(error.code===1) {$('status-message').textContent='Chromeの位置情報を許可してください。';return;}
  if(!updateEstimatedPosition()) $('status-message').textContent='位置情報を取得できません。';
}

function startLocationWatch(maximumAge=2000) {
  if(watchId!==null) navigator.geolocation.clearWatch(watchId);
  watchId=navigator.geolocation.watchPosition(handlePosition,handlePositionError,{enableHighAccuracy:true,maximumAge,timeout:15000});
}

function refreshLocationAfterResume() {
  if(!navigationActive || !manifest || !navigator.geolocation)return;
  $('status-message').textContent='現在位置を再確認しています…';
  startLocationWatch(0);
  navigator.geolocation.getCurrentPosition(
    handlePosition,
    handlePositionError,
    {enableHighAccuracy:true,maximumAge:0,timeout:15000},
  );
}

async function startNavigation() {
  try {
    const response=await fetch('data/manifest.json');
    manifest=await response.json();
  } catch {
    $('status-message').textContent='道路データを読み込めません。'; return;
  }
  if((location.hostname==='127.0.0.1'||location.hostname==='localhost') && new URLSearchParams(location.search).has('preview')) {
    const region=manifest.regions[0];
    const response=await fetch(region.file);
    const data=await response.json();
    links=data.links;points=data.points;loadedRegion=region.id;
    const link=links.find(item=>item.id==='e4-north');
    const sanbongi=points.find(item=>item.linkID==='e4-north'&&item.name==='三本木'&&item.kind==='PA');
    render({link,offset:sanbongi.offsetMeters-1500,speed:27.8},8,'サンプル表示');
    return;
  }
  if(!navigator.geolocation) {$('status-message').textContent='このブラウザは位置情報に対応していません。';return;}
  wakeLockMonitorTimer=setInterval(()=>requestWakeLock(),15000);
  estimateTimer=setInterval(()=>updateEstimatedPosition(),1000);
  startLocationWatch();
}

if(authenticated()) showNavigation();
