(function(root) {
  const distance=(a,b)=>Math.hypot((b.latitude-a.latitude)*110540,(b.longitude-a.longitude)*111320*Math.cos((a.latitude+b.latitude)*Math.PI/360));
  const angleDifference=(a,b)=>Math.abs(((a-b+540)%360)-180);
  const bearing=(a,b)=>(Math.atan2((b.longitude-a.longitude)*Math.cos((a.latitude+b.latitude)*Math.PI/360),b.latitude-a.latitude)*180/Math.PI+360)%360;
  function project(link,position) {
    let best={distance:Infinity,offset:0,bearing:0},travel=0;
    const lonScale=111320*Math.cos(position.latitude*Math.PI/180);
    for(let i=1;i<link.polyline.length;i++) {
      const a=link.polyline[i-1],b=link.polyline[i];
      const dx=(b.longitude-a.longitude)*lonScale,dy=(b.latitude-a.latitude)*110540;
      const px=(position.longitude-a.longitude)*lonScale,py=(position.latitude-a.latitude)*110540;
      const ratio=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1)));
      const lateral=Math.hypot(px-ratio*dx,py-ratio*dy),length=distance(a,b);
      if(lateral<best.distance)best={distance:lateral,offset:travel+length*ratio,bearing:bearing(a,b)};
      travel+=length;
    }
    return best;
  }
  function coordinateAt(link,offset) {
    let travel=0;
    for(let i=1;i<link.polyline.length;i++) {
      const a=link.polyline[i-1],b=link.polyline[i],length=distance(a,b);
      if(travel+length>=offset) {
        const ratio=Math.max(0,Math.min(1,(offset-travel)/(length||1)));
        return {latitude:a.latitude+(b.latitude-a.latitude)*ratio,longitude:a.longitude+(b.longitude-a.longitude)*ratio};
      }
      travel+=length;
    }
    return link.polyline.at(-1);
  }
  function junctionsFromPoints(links,points) {
    const byID=new Map(links.map(link=>[link.id,link])),names=new Map(),result=[];
    for(const point of points.filter(point=>point.kind==='JCT')) {
      const link=byID.get(point.linkID);if(!link)continue;
      const name=point._sourceName||point.name;
      if(!names.has(name))names.set(name,[]);
      names.get(name).push({linkID:link.id,offset:point._sourceOffsetMeters??point.offsetMeters,coordinate:coordinateAt(link,point._sourceOffsetMeters??point.offsetMeters)});
    }
    for(const [name,anchors] of names) {
      if(new Set(anchors.map(anchor=>byID.get(anchor.linkID).highwayName)).size<2)continue;
      const nearby=anchors.filter(anchor=>anchors.some(other=>byID.get(other.linkID).highwayName!==byID.get(anchor.linkID).highwayName&&distance(anchor.coordinate,other.coordinate)<2500));
      if(nearby.length>1)result.push({name,anchors:nearby,ramps:[]});
    }
    return result;
  }
  class RoadMatcher {
    constructor(links,points,supplement={}) {
      this.links=links;this.current=null;this.history=[];this.pending=null;
      this.junctions=supplement.junctions?.length?supplement.junctions:junctionsFromPoints(links,points);
    }
    update(position) {
      const coords=position.coords,now=position.timestamp||Date.now();
      // Resume/watch callbacks can arrive out of order. Never count a cached
      // fix twice toward a road change or turn it into a backwards movement.
      if(this.lastTimestamp&&now<=this.lastTimestamp)return this.current?{...this.current,ignoredFix:true}:null;
      const elapsed=this.lastTimestamp?(now-this.lastTimestamp)/1000:0;
      const gap=elapsed>20;
      if(gap){this.history=[];this.pending=null;}
      this.lastTimestamp=now;
      const coordinate={latitude:coords.latitude,longitude:coords.longitude};
      const accuracy=Math.max(1,Number.isFinite(coords.accuracy)?coords.accuracy:100);
      let speed=Number.isFinite(coords.speed)&&coords.speed>=0?coords.speed:(this.current?.speed||0);
      this.history=this.history.filter(fix=>now-fix.time<=8000);
      const older=this.history.find(fix=>now-fix.time>=2000&&distance(fix.coordinate,coordinate)>=Math.max(20,accuracy+fix.accuracy));
      if((!Number.isFinite(coords.speed)||coords.speed<0)&&older)speed=Math.min(60,distance(older.coordinate,coordinate)/((now-older.time)/1000));
      const historyHeading=older?bearing(older.coordinate,coordinate):null;
      const heading=historyHeading??(Number.isFinite(coords.heading)&&speed>=2?coords.heading:null);
      this.history.push({coordinate,accuracy,time:now});
      const candidates=this.links.map(link=>{
        const candidate=project(link,coordinate);
        const headingError=heading===null?0:angleDifference(candidate.bearing,heading);
        let score=candidate.distance+(heading===null?0:headingError*4);
        if(this.current?.link.id===link.id&&!gap) {
          const expected=this.current.offset+speed*Math.min(elapsed,5);
          score+=Math.max(0,Math.abs(candidate.offset-expected)-Math.max(100,accuracy*2,speed*elapsed+40))*2;
        }
        return {...candidate,link,speed,score,headingError};
      }).sort((a,b)=>a.score-b.score);
      const best=candidates[0];
      const activeRamp=this.current&&this.junctions.find(junction=>junction.anchors.some(anchor=>anchor.linkID===this.current.link.id&&Math.abs(anchor.offset-this.current.offset)<2500)
        &&junction.ramps?.some(line=>project({polyline:line},coordinate).distance<=Math.max(25,accuracy*1.5)));
      if(!best||best.distance>Math.max(180,accuracy*3)) {
        if(activeRamp) {
          this.current={...this.current,offset:Math.min(this.current.link.lengthMeters,this.current.offset+speed*Math.min(elapsed,3)),speed,uncertain:true};
          return {...this.current,statusText:'JCT・道路切替を確認中'};
        }
        this.pending=null;this.current=null;return null;
      }
      if(!this.current) {
        // At startup, wait for a direction fix rather than choosing an
        // arbitrary carriageway from identical north/south road geometry.
        if(heading===null)return null;
        this.current=best;return {...best};
      }
      const current=candidates.find(candidate=>candidate.link.id===this.current.link.id);
      if(best.link.id===this.current.link.id) {
        this.pending=null;this.current={...best,uncertain:false};return {...this.current};
      }
      const connection=this.junctions.find(junction=>{
        const from=junction.anchors.find(anchor=>anchor.linkID===current.link.id);
        const to=junction.anchors.find(anchor=>anchor.linkID===best.link.id);
        return from&&to&&current.link.highwayName!==best.link.highwayName
          &&Math.abs(from.offset-current.offset)<2500&&Math.abs(to.offset-best.offset)<2500;
      });
      const continuation=(current.link.nextLinkIDs||[]).includes(best.link.id);
      const sameHighway=current.link.highwayName===best.link.highwayName;
      const reversal=sameHighway&&angleDifference(current.bearing,best.bearing)>135;
      const ramp=connection?.ramps?.some(line=>project({polyline:line},coordinate).distance<=Math.max(25,accuracy*1.5));
      const advantage=current.score-best.score;
      const aligned=heading!==null&&best.headingError<50;
      const better=advantage>Math.max(35,accuracy)&&aligned;
      // Reverse direction is never inferred from missing heading at a stop.
      const eligible=better&&(!reversal||speed>=3)&&(!ramp||best.distance<Math.max(25,accuracy));
      if(!eligible) {
        this.pending=null;
      } else if(this.pending?.id===best.link.id) {
        this.pending.count++;this.pending.travel+=speed*Math.min(elapsed,5);
      } else {
        this.pending={id:best.link.id,since:now,count:1,travel:0};
      }
      const required=connection||continuation?3000:reversal?10000:8000;
      const movement=connection||continuation?25:reversal?60:60;
      if(this.pending&&now-this.pending.since>=required&&this.pending.count>=3&&this.pending.travel>=movement) {
        this.pending=null;this.current={...best,uncertain:false};return {...this.current};
      }
      const uncertain=!!this.pending||!!ramp||current.distance>Math.max(50,accuracy*2);
      // During a ramp, retain the confirmed road while advancing only by
      // travelled distance instead of jumping to an unrelated crossing road.
      const offset=uncertain?Math.min(current.link.lengthMeters,this.current.offset+speed*Math.min(elapsed,3)):current.offset;
      this.current={...current,offset,uncertain};
      return {...this.current,statusText:uncertain?'JCT・道路切替を確認中':''};
    }
  }
  const helpers={RoadMatcher,project,coordinateAt,junctionsFromPoints,distance};
  root.HighwayRoadMatcher=helpers;
  if(typeof module!=='undefined')module.exports=helpers;
})(globalThis);
