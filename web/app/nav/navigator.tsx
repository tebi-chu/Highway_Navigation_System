'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import roadData from '@/data/highway.json';

type Coordinate={latitude:number;longitude:number};
type Link={id:string;highwayName:string;directionName:string;destinationName:string;lengthMeters:number;standardSpeedKPH:number;polyline:Coordinate[]};
type Point={id:string;name:string;kind:string;linkID:string;offsetMeters:number;facilities:string[];brands:string[]};
type Match={link:Link;offset:number;lateral:number;speed:number;latitude:number;longitude:number};
type Upcoming=Point&{global:number;remaining:number};
type TrafficItem={pointID:string;durationSeconds:number;staticDurationSeconds:number|null;distanceMeters:number|null;congestion:'normal'|'moderate'|'heavy'|'unknown'};
type TrafficResponse={updatedAt:number;source:string;items:TrafficItem[];error?:string;retryAfter?:number};

const links=roadData.links as Link[],points=roadData.points as Point[];
const facilityIcons:Record<string,string>={restaurant:'食',restroom:'WC',fuel:'給油',convenienceStore:'店',cafe:'☕',evCharging:'EV',shower:'浴',lodging:'宿',dogRun:'犬',accessibility:'♿'};
const brandLabels:Record<string,string>={starbucks:'STARBUCKS',familyMart:'FamilyMart',apollostation:'apollo',sevenEleven:'7-ELEVEN',eneos:'ENEOS'};
const congestionLabels={normal:'順調',moderate:'混雑',heavy:'渋滞',unknown:'交通情報'};

function meters(a:Coordinate,b:Coordinate){const lat=(a.latitude+b.latitude)*Math.PI/360;const x=(b.longitude-a.longitude)*111320*Math.cos(lat),y=(b.latitude-a.latitude)*110540;return Math.hypot(x,y)}
function nearest(link:Link,position:Coordinate){let best={distance:Infinity,offset:0},travel=0;for(let i=0;i<link.polyline.length;i++){if(i)travel+=meters(link.polyline[i-1],link.polyline[i]);const d=meters(position,link.polyline[i]);if(d<best.distance)best={distance:d,offset:travel}}return best}
function matchPosition(position:GeolocationPosition):Match|null{const coordinate={latitude:position.coords.latitude,longitude:position.coords.longitude};const candidates=links.map(link=>({link,...nearest(link,coordinate)})).sort((a,b)=>a.distance-b.distance);if(!candidates[0]||candidates[0].distance>1500)return null;return{link:candidates[0].link,offset:candidates[0].offset,lateral:candidates[0].distance,speed:Math.max(0,position.coords.speed??0),...coordinate}}
function linkBase(id:string){const index=links.findIndex(link=>link.id===id);return links.slice(0,index).reduce((sum,link)=>sum+link.lengthMeters,0)}
function fallbackSeconds(distance:number,speed:number,link:Link){const kph=speed*3.6>=20?speed*3.6:link.standardSpeedKPH;return distance/(kph*1000/3600)}
function eta(seconds:number){return new Date(Date.now()+seconds*1000).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}

export default function Navigator(){
 const[match,setMatch]=useState<Match|null>(null),[message,setMessage]=useState('現在位置を確認しています…'),[tracking,setTracking]=useState(false);
 const[traffic,setTraffic]=useState<Record<string,TrafficItem>>({}),[trafficUpdatedAt,setTrafficUpdatedAt]=useState<number|null>(null),[trafficState,setTrafficState]=useState<'waiting'|'loading'|'live'|'fallback'>('waiting');
 const lastTrafficRequest=useRef(0);
 useEffect(()=>{const watch=navigator.geolocation.watchPosition(position=>{const value=matchPosition(position);setMatch(value);setTracking(true);setMessage(value?`GPS精度 ±${Math.round(position.coords.accuracy)}m`:'対応ルート付近の高速道路を判定できません。')},error=>setMessage(error.code===1?'Chromeの位置情報を許可してください。':'位置情報を取得できません。'),{enableHighAccuracy:true,maximumAge:2000,timeout:15000});return()=>navigator.geolocation.clearWatch(watch)},[]);
 const upcoming=useMemo<Array<Upcoming>>(()=>{if(!match)return[];const current=linkBase(match.link.id)+match.offset;return points.map(point=>({...point,global:linkBase(point.linkID)+point.offsetMeters})).filter(point=>point.global>current+100).sort((a,b)=>a.global-b.global).slice(0,6).map(point=>({...point,remaining:point.global-current}))},[match]);
 const pointIDs=upcoming.map(point=>point.id).join(',');
 useEffect(()=>{if(!match||!pointIDs||Date.now()-lastTrafficRequest.current<45_000)return;lastTrafficRequest.current=Date.now();setTrafficState('loading');fetch('/api/traffic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({latitude:match.latitude,longitude:match.longitude,pointIDs:pointIDs.split(',')})}).then(async response=>({response,data:await response.json() as TrafficResponse})).then(({response,data})=>{if(!response.ok){if(response.status!==429)setTrafficState('fallback');return}setTraffic(Object.fromEntries(data.items.map(item=>[item.pointID,item])));setTrafficUpdatedAt(data.updatedAt);setTrafficState('live')}).catch(()=>setTrafficState('fallback'))},[match,pointIDs]);
 const slots:Array<Upcoming|null>=[...Array.from({length:6-upcoming.length},()=>null),...upcoming.slice().reverse()];
 async function logout(){await fetch('/api/pin/logout',{method:'POST'});location.href='/'}
 return <main className="navigation-screen">
  <header className="live-route"><div><span>{match?.link.id==='e4-down'?'E4':'C4'}</span><strong>{match?.link.highwayName??'高速道路アシスト'}</strong></div><b>{match?`${match.link.directionName}・${match.link.destinationName}`:'GPS待機中'}</b><button onClick={logout}>終了</button></header>
  <section className="live-status"><span className={tracking?'pulse':''}/>{message}<b className={`traffic-state ${trafficState}`}>{trafficState==='live'?`渋滞反映 ${new Date(trafficUpdatedAt!).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`:trafficState==='loading'?'渋滞取得中':trafficState==='fallback'?'標準時間':'渋滞待機'}</b></section>
  <section className="live-list">{slots.map((item,index)=>{if(!item)return <div className="empty-slot" key={`empty-${index}`}/>;const trafficItem=traffic[item.id],distance=trafficItem?.distanceMeters??item.remaining,duration=trafficItem?.durationSeconds??fallbackSeconds(item.remaining,match?.speed??0,match?.link??links[0]);return <article className={`live-card kind-${item.kind.toLowerCase()}`} key={item.id}><div className="live-title"><span>{item.kind}</span><strong>{item.name}</strong>{trafficItem&&<em className={`congestion ${trafficItem.congestion}`}>{congestionLabels[trafficItem.congestion]}</em>}</div>{(item.facilities.length>0||item.brands.length>0)&&<div className="facility-row">{item.brands.map(brand=><b className="brand-badge" key={brand}>{brandLabels[brand]??brand}</b>)}{item.facilities.map(facility=><span title={facility} key={facility}>{facilityIcons[facility]??'●'}</span>)}</div>}<div className="live-metrics"><b>{(distance/1000).toFixed(1)}<small>km</small></b><b>{eta(duration)}<small>通過</small></b></div></article>})}</section>
  <footer className="vehicle-position"><i/><b>現在地</b><span>{match?`${Math.round(match.speed*3.6)} km/h`:''}</span></footer>
 </main>
}
