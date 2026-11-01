const test=require('node:test');
const assert=require('node:assert/strict');
const {RoadMatcher,coordinateAt,project}=require('../road-matcher.js');
const data=require('../../web/data/regional-expressways.json');
const supplement=require('../../web/data/junction-matching.json');
function fix(link,offset,time,{heading,speed=25,accuracy=8,jitter=0}={}) {
  const point=coordinateAt(link,offset);
  return {timestamp:time,coords:{...point,latitude:point.latitude+jitter/110540,accuracy,speed,heading:heading===undefined?project(link,point).bearing:heading}};
}
const kuki=['e4-north','e4-south','c4-east','c4-west'];
const byID=new Map(data.links.map(link=>[link.id,link]));
const anchor=id=>supplement.junctions.find(j=>j.name==='久喜白岡').anchors.find(a=>a.linkID===id).offset;

test('Kuki-Shiraoka has all four carriageways and actual ramp geometry',()=>{
  const junction=supplement.junctions.find(j=>j.name==='久喜白岡');
  assert.deepEqual(junction.anchors.map(a=>a.linkID).sort(),[...kuki].sort());
  assert.ok(junction.ramps.length>0);
});

test('all four Kuki-Shiraoka mainline directions remain stable through jitter and missing headings',()=>{
  for(const id of kuki) {
    const link=byID.get(id),matcher=new RoadMatcher(data.links,data.points,supplement);
    let time=100000;
    for(let offset=anchor(id)-650;offset<anchor(id)+700;offset+=25) {
      const result=matcher.update(fix(link,offset,time,{jitter:time%2000===0?12:-12,heading:offset>anchor(id)-100&&offset<anchor(id)+150?null:undefined}));
      assert.equal(result?.link.id,id,`${id} at ${offset-anchor(id)}m`);time+=1000;
    }
  }
});

test('all eight E4/C4 transfers settle onto the driven direction',()=>{
  for(const fromID of kuki)for(const toID of kuki.filter(id=>id.startsWith('e4')!==fromID.startsWith('e4'))) {
    const from=byID.get(fromID),to=byID.get(toID),matcher=new RoadMatcher(data.links,data.points,supplement);
    let time=100000;
    for(let offset=anchor(fromID)-300;offset<anchor(fromID);offset+=25) {matcher.update(fix(from,offset,time));time+=1000;}
    const ids=[];
    for(let offset=anchor(toID);offset<anchor(toID)+800;offset+=25) {ids.push(matcher.update(fix(to,offset,time))?.link.id);time+=1000;}
    assert.equal(ids.at(-1),toID,`${fromID} -> ${toID}`);
    const first=ids.indexOf(toID);assert.ok(first>=0&&first<20,`${fromID} -> ${toID}: ${first}`);
    assert.ok(ids.slice(first).every(id=>id===toID),'must not bounce back');
  }
});

test('stationary missing heading never flips a previously confirmed direction',()=>{
  const link=byID.get('e4-north'),matcher=new RoadMatcher(data.links,data.points,supplement);
  matcher.update(fix(link,anchor(link.id)-300,100000));
  for(let i=1;i<20;i++)assert.equal(matcher.update(fix(link,anchor(link.id)-300,100000+i*1000,{speed:0,heading:null,jitter:i%2?10:-10}))?.link.id,link.id);
});

test('a transfer also works when the browser omits both speed and heading',()=>{
  const from=byID.get('c4-east'),to=byID.get('e4-north');
  const matcher=new RoadMatcher(data.links,data.points,supplement);
  let time=100000;
  for(let offset=anchor(from.id)-400;offset<anchor(from.id);offset+=25) {
    matcher.update(fix(from,offset,time,{heading:null,speed:null}));time+=1000;
  }
  let result;
  for(let offset=anchor(to.id);offset<anchor(to.id)+600;offset+=25) {
    result=matcher.update(fix(to,offset,time,{heading:null,speed:null}));time+=1000;
  }
  assert.equal(result.link.id,to.id);assert.ok(result.speed>0);
});

test('startup without heading waits, then derives direction from movement history',()=>{
  const link=byID.get('e4-south'),matcher=new RoadMatcher(data.links,data.points,supplement);
  assert.equal(matcher.update(fix(link,anchor(link.id)-500,100000,{heading:null})),null);
  let result;
  for(let i=1;i<8;i++)result=matcher.update(fix(link,anchor(link.id)-500+i*25,100000+i*1000,{heading:null}));
  assert.equal(result.link.id,link.id);
});

test('stale and duplicate fixes cannot trigger a road change',()=>{
  const link=byID.get('e4-north'),other=byID.get('c4-west'),matcher=new RoadMatcher(data.links,data.points,supplement);
  matcher.update(fix(link,anchor(link.id)-300,100000));
  for(let i=0;i<20;i++) {
    const result=matcher.update(fix(other,anchor(other.id),100000));
    assert.equal(result.link.id,link.id);assert.equal(result.ignoredFix,true);
  }
});

test('a road crossing without a junction cannot produce an immediate transfer',()=>{
  const link=byID.get('e4-north'),other=byID.get('c4-west');
  const matcher=new RoadMatcher(data.links,[],{junctions:[]});
  matcher.update(fix(link,anchor(link.id)-300,100000));
  const result=matcher.update(fix(other,anchor(other.id)+25,101000));
  assert.equal(result.link.id,link.id);
});

test('a ramp far from both mainlines retains the confirmed road and disables precise correction',()=>{
  const from={id:'from',highwayName:'From',lengthMeters:1800,polyline:[{latitude:36,longitude:139},{latitude:36,longitude:139.02}]};
  const to={id:'to',highwayName:'To',lengthMeters:1800,polyline:[{latitude:36.01,longitude:139.02},{latitude:36.01,longitude:139.04}]};
  const ramp=[{latitude:36,longitude:139.01},{latitude:36.005,longitude:139.015},{latitude:36.01,longitude:139.02}];
  const matcher=new RoadMatcher([from,to],[],{junctions:[{name:'Ramp',anchors:[{linkID:'from',offset:900},{linkID:'to',offset:0}],ramps:[ramp]}]});
  matcher.update(fix(from,800,100000));
  const result=matcher.update({timestamp:101000,coords:{...ramp[1],accuracy:8,speed:25,heading:45}});
  assert.equal(result.link.id,'from');assert.equal(result.uncertain,true);
  assert.match(result.statusText,/確認中/);
});
