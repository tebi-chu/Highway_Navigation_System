const config = window.HIGHWAY_ASSIST_CONFIG || {};
const facilityIcons = {restaurant:'食',restroom:'WC',fuel:'給油',convenienceStore:'店',cafe:'☕',evCharging:'EV',shower:'浴',lodging:'宿',dogRun:'犬',accessibility:'♿'};
const brandLabels = {starbucks:'STARBUCKS',familyMart:'FamilyMart',apollostation:'apollostation',sevenEleven:'7-ELEVEN',eneos:'ENEOS'};
let links = [], points = [], watchId = null, manifest = null, loadedRegion = null;

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
  startNavigation();
}

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

$('logout').addEventListener('click', () => {
  localStorage.removeItem('highway-assist-login');
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  location.reload();
});

function nearest(link, position) {
  let best={distance:Infinity,offset:0}, travel=0;
  const latScale=110540,lonScale=111320*Math.cos(position.latitude*Math.PI/180);
  for(let i=1;i<link.polyline.length;i++) {
    const a=link.polyline[i-1],b=link.polyline[i],dx=(b.longitude-a.longitude)*lonScale,dy=(b.latitude-a.latitude)*latScale;
    const px=(position.longitude-a.longitude)*lonScale,py=(position.latitude-a.latitude)*latScale;
    const ratio=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1)));
    const distance=Math.hypot(px-ratio*dx,py-ratio*dy),length=meters(a,b);
    if(distance<best.distance) best={distance,offset:travel+length*ratio};
    travel+=length;
  }
  return best;
}

function matchPosition(position) {
  const coordinate={latitude:position.coords.latitude,longitude:position.coords.longitude};
  const candidates=links.map(link=>({link,...nearest(link,coordinate)})).sort((a,b)=>a.distance-b.distance);
  if(!candidates[0] || candidates[0].distance>1500) return null;
  return {...candidates[0],speed:Math.max(0,position.coords.speed||0)};
}

function findUpcoming(match) {
  const byID=new Map(links.map(link=>[link.id,link])),results=[];
  for(const point of points) if(point.linkID===match.link.id && point.offsetMeters>match.offset+100) results.push({...point,remaining:point.offsetMeters-match.offset});
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
  return results.sort((a,b)=>a.remaining-b.remaining).slice(0,6);
}

function render(match, accuracy) {
  const upcoming=findUpcoming(match);
  const slots=[...Array(6-upcoming.length).fill(null),...upcoming.reverse()];
  const speedKph=match.speed*3.6>=20?match.speed*3.6:match.link.standardSpeedKPH;

  $('route-number').textContent=match.link.id==='e4-down'?'E4':'C4';
  $('highway-name').textContent=match.link.highwayName;
  $('direction').textContent=`${match.link.directionName}・${match.link.destinationName}`;
  $('status-message').textContent=`GPS精度 ±${Math.round(accuracy)}m`;
  $('gps-dot').classList.add('active');
  $('speed').textContent=`${Math.round(match.speed*3.6)} km/h`;
  $('point-list').replaceChildren(...slots.map((item) => {
    if(!item) {const empty=document.createElement('div');empty.className='empty-slot';return empty;}
    const article=document.createElement('article');article.className=`live-card kind-${item.kind.toLowerCase()}`;
    const facilities=[...item.brands.map(brand=>`<b class="brand-badge brand-${brand}">${brandLabels[brand]||brand}</b>`),...item.facilities.map(facility=>`<span>${facilityIcons[facility]||'●'}</span>`)].join('');
    article.innerHTML=`<div class="live-title"><span>${item.kind}</span><strong>${item.name}</strong></div>${facilities?`<div class="facility-row">${facilities}</div>`:''}<div class="live-metrics"><b>${(item.remaining/1000).toFixed(1)}<small>km</small></b><b>${eta(item.remaining/(speedKph*1000/3600))}<small>通過</small></b></div>`;
    return article;
  }));
}

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

async function startNavigation() {
  try {
    const response=await fetch('data/manifest.json');
    manifest=await response.json();
  } catch {
    $('status-message').textContent='道路データを読み込めません。'; return;
  }
  if(!navigator.geolocation) {$('status-message').textContent='このブラウザは位置情報に対応していません。';return;}
  watchId=navigator.geolocation.watchPosition(
    async position=>{try{if(!await ensureRegion(position))return;const match=matchPosition(position);if(match)render(match,position.coords.accuracy);else $('status-message').textContent='対応ルート付近の高速道路を判定できません。';}catch{$('status-message').textContent='地域の道路データを読み込めません。';}},
    error=>$('status-message').textContent=error.code===1?'Chromeの位置情報を許可してください。':'位置情報を取得できません。',
    {enableHighAccuracy:true,maximumAge:2000,timeout:15000},
  );
}

if(authenticated()) showNavigation();
