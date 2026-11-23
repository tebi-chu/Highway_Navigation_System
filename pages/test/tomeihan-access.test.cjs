const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const data=require('../../web/data/regional-expressways.json');
const catalogue=require('../../web/data/tomeihan.json');
const helpers=require('../navigation-data.js');
const {RoadMatcher,coordinateAt,project}=require('../road-matcher.js');
const supplement=require('../../web/data/junction-matching.json');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const context={links:data.links,points:data.points,HighwayNavigationData:helpers};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function findUpcoming('),source.indexOf('function advanceMatch(')),context);

test('Tomeihan covers both complete directional mainlines and all three service areas',()=>{
  assert.equal(catalogue.links.length,2);
  for(const link of catalogue.links) {
    assert.ok(link.lengthMeters>54000&&link.lengthMeters<57000);
    const areas=catalogue.points.filter(p=>p.linkID===link.id&&['SA','PA'].includes(p.kind));
    assert.deepEqual(areas.map(p=>p.name).sort(),['亀山','大山田','御在所']);
    for(const fraction of [.03,.2,.5,.8,.97]) {
      const matcher=new RoadMatcher(data.links,data.points,supplement);
      for(let i=0;i<5;i++) {
        const coordinate=coordinateAt(link,link.lengthMeters*fraction+i*20);
        const result=matcher.update({timestamp:100000+i*1000,coords:{...coordinate,heading:project(link,coordinate).bearing,speed:20,accuracy:5}});
        assert.equal(result?.link.id,link.id,`${link.id} at ${fraction}`);
      }
    }
  }
  assert.deepEqual(data.links.find(l=>l.id==='e23-ise-north').nextLinkIDs,['e23-tomeihan-up']);
});

test('Isewangan half-IC cards are only shown where an exit exists, also on continuations',()=>{
  const allowed={'みえ朝日':'上り','弥富木曽岬':'上り','湾岸弥富':'下り'};
  for(const link of data.links.filter(l=>l.highwayName==='伊勢湾岸自動車道')) {
    for(const [name,direction] of Object.entries(allowed)) {
      const point=data.points.find(p=>p.linkID===link.id&&p.kind==='IC'&&p.name===name);
      assert.equal(point.exitAvailable,link.directionName===direction,name);
      const cards=context.findUpcoming({link,offset:point.offsetMeters-50});
      assert.equal(cards.some(p=>p.id===point.id),link.directionName===direction,`${link.id} ${name}`);
    }
    assert.equal(helpers.groupedPoints(data.points,{forNavigation:true}).some(p=>p.linkID===link.id&&p.name==='豊田東'&&p.kind==='IC'),true,'Toyota-higashi is a full interchange');
  }
  const denied=data.points.filter(p=>p.exitAvailable===false).map(p=>p.id);
  const next=context.findUpcoming({link:data.links.find(l=>l.id==='e1a-shintomei-west'),offset:data.links.find(l=>l.id==='e1a-shintomei-west').lengthMeters-10});
  assert.ok(next.every(p=>!denied.includes(p.id)));
  assert.equal(data.points.find(p=>p.name==='名古屋南'&&p.kind==='IC').linkID,'e1a-isewangan-east');
});

test('PA smart ICs combine while the separate Kameyama IC remains its own card',()=>{
  for(const id of ['e23-tomeihan-down','e23-tomeihan-up','e1a-isewangan-west','e1a-isewangan-east']) {
    const name=id.startsWith('e23')?'亀山':'刈谷';
    const points=data.points.filter(p=>p.linkID===id);
    const cards=helpers.groupedPoints(points,{forNavigation:true});
    const area=cards.find(p=>p.name===name&&p.kind==='PA');
    assert.deepEqual(area.kinds,['PA','IC']);
    assert.equal(area.correctionPoints.length,2);
    if(id==='e23-tomeihan-down')assert.ok(cards.some(p=>p.name==='亀山'&&p.kind==='IC'));
  }
});

test('source branch offsets and all point IDs remain valid',()=>{
  assert.equal(new Set(data.points.map(p=>p.id)).size,data.points.length);
  for(const point of catalogue.points) {
    const link=catalogue.links.find(l=>l.id===point.linkID);
    assert.ok(point.offsetMeters>=0&&point.offsetMeters<=link.lengthMeters+.1);
    assert.ok(helpers.romanizedName(point));
  }
  for(const exit of catalogue.isewanganExits) {
    const point=data.points.find(p=>p.linkID===exit.linkID&&p.name===exit.name&&p.kind==='IC');
    if(point?.exitAvailable!==false&&point)assert.equal(point.offsetMeters,exit.offsetMeters);
  }
});
