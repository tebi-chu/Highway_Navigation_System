const config = window.HIGHWAY_ASSIST_CONFIG || {};
const facilityIcons = {restaurant:'食',restroom:'WC',fuel:'給油',convenienceStore:'店',cafe:'☕',evCharging:'EV',shower:'浴',lodging:'宿',dogRun:'犬',accessibility:'♿'};
const brandLabels = {starbucks:'STARBUCKS',familyMart:'FamilyMart',apollostation:'apollostation',sevenEleven:'7-ELEVEN',eneos:'ENEOS'};
let links = [], points = [], watchId = null;

const $ = (id) => document.getElementById(id);
const meters = (a,b) => {const lat=(a.latitude+b.latitude)*Math.PI/360; return Math.hypot((b.longitude-a.longitude)*111320*Math.cos(lat),(b.latitude-a.latitude)*110540)};
const linkBase = (id) => {const i=links.findIndex(link=>link.id===id); return links.slice(0,i).reduce((sum,link)=>sum+link.lengthMeters,0)};
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
  for(let i=0;i<link.polyline.length;i++) {
    if(i) travel+=meters(link.polyline[i-1],link.polyline[i]);
    const distance=meters(position,link.polyline[i]);
    if(distance<best.distance) best={distance,offset:travel};
  }
  return best;
}

function matchPosition(position) {
  const coordinate={latitude:position.coords.latitude,longitude:position.coords.longitude};
  const candidates=links.map(link=>({link,...nearest(link,coordinate)})).sort((a,b)=>a.distance-b.distance);
  if(!candidates[0] || candidates[0].distance>1500) return null;
  return {...candidates[0],speed:Math.max(0,position.coords.speed||0)};
}

function render(match, accuracy) {
  const current=linkBase(match.link.id)+match.offset;
  const upcoming=points.map(point=>({...point,global:linkBase(point.linkID)+point.offsetMeters}))
    .filter(point=>point.global>current+100).sort((a,b)=>a.global-b.global).slice(0,6)
    .map(point=>({...point,remaining:point.global-current}));
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

async function startNavigation() {
  try {
    const response=await fetch('highway.json');
    const data=await response.json(); links=data.links; points=data.points;
  } catch {
    $('status-message').textContent='道路データを読み込めません。'; return;
  }
  if(!navigator.geolocation) {$('status-message').textContent='このブラウザは位置情報に対応していません。';return;}
  watchId=navigator.geolocation.watchPosition(
    position=>{const match=matchPosition(position);if(match)render(match,position.coords.accuracy);else $('status-message').textContent='対応ルート付近の高速道路を判定できません。';},
    error=>$('status-message').textContent=error.code===1?'Chromeの位置情報を許可してください。':'位置情報を取得できません。',
    {enableHighAccuracy:true,maximumAge:2000,timeout:15000},
  );
}

if(authenticated()) showNavigation();
