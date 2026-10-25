const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const helpers=require('../navigation-data.js');
const data=require('../../web/data/regional-expressways.json');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');

test('every registered point has a place-only romanized label',()=>{
  for(const point of data.points) {
    const name=helpers.romanizedName(point);
    assert.ok(name,`${point.id}: ${point.name}`);
    assert.doesNotMatch(name,/\b(?:Smart|JCT|Junction|Parking|IC|SA|PA)\b/i);
  }
});

test('Enshu-Morimachi is one PA/IC card in both directions, using the PA position',()=>{
  const groups=helpers.groupedPoints(data.points);
  for(const linkID of ['e1a-shintomei-west','e1a-shintomei-east']) {
    const cards=groups.filter(p=>p.linkID===linkID&&p.name==='遠州森町');
    const area=data.points.find(p=>p.linkID===linkID&&p.name==='遠州森町'&&p.kind==='PA');
    assert.equal(cards.length,1);
    assert.deepEqual(cards[0].kinds,['PA','IC']);
    assert.equal(cards[0].offsetMeters,area.offsetMeters);
    assert.equal(cards[0].correctionPoints.length,2);
    assert.deepEqual(cards[0].facilities,area.facilities);
  }
});

test('grouping preserves facilities/notes and does not merge same-named separate interchanges',()=>{
  const before=JSON.stringify(data.points);
  const groups=helpers.groupedPoints(data.points);
  assert.equal(JSON.stringify(data.points),before);
  for(const name of ['羽生','泉','紫波','談合坂']) {
    const area=groups.find(p=>p.name===name&&['SA','PA'].includes(p.kind));
    assert.deepEqual(area.kinds,[area.kind],name);
  }
  const area={...data.points.find(p=>p.name==='遠州森町'&&p.kind==='PA'),note:'好きなお店',brands:['sevenEleven']};
  const ic=data.points.find(p=>p.name==='遠州森町'&&p.kind==='IC'&&p.linkID===area.linkID);
  const card=helpers.groupedPoints([area,ic])[0];
  assert.equal(card.note,area.note);assert.deepEqual(card.brands,area.brands);
});

test('combined card remains until 200m beyond PA, even after IC ramp was passed',()=>{
  const block=source.slice(source.indexOf('function findUpcoming('),source.indexOf('function advanceMatch('));
  const context={links:data.links,points:data.points,HighwayNavigationData:helpers};
  vm.createContext(context);vm.runInContext(block,context);
  const link=data.links.find(p=>p.id==='e1a-shintomei-west');
  const area=data.points.find(p=>p.linkID===link.id&&p.name==='遠州森町'&&p.kind==='PA');
  for(const difference of [-500,0,199]) {
    const cards=context.findUpcoming({link,offset:area.offsetMeters+difference});
    const card=cards.find(p=>p.id===area.id);
    assert.ok(card);assert.ok(card.kinds.includes('IC'));
    assert.equal(card.remaining,difference===0?0:-difference);
  }
  assert.ok(!context.findUpcoming({link,offset:area.offsetMeters+201}).some(p=>p.id===area.id));
});

test('viewport initializes in landscape and swaps the notch side after rotation',()=>{
  const block=source.slice(source.indexOf('let viewportFrame='),source.indexOf('function regionFor('));
  const properties={};let frames=[];let landscape=true;
  const context={document:{documentElement:{dataset:{},style:{setProperty:(k,v)=>properties[k]=v}}},screen:{orientation:{angle:90,addEventListener(){}}},window:{matchMedia:()=>({matches:landscape}),visualViewport:{width:844,height:390,scale:1,addEventListener(){}},scrollTo(){},addEventListener(){}},navigationActive:true,lastRenderArgs:null,requestAnimationFrame:cb=>{frames.push(cb);return frames.length;},cancelAnimationFrame(){},setTimeout(){}};
  vm.createContext(context);vm.runInContext(block,context);frames.pop()();
  assert.equal(properties['--navigation-height'],'390px');
  assert.equal(properties['--navigation-width'],'844px');
  assert.equal(context.document.documentElement.dataset.notchSide,'left');
  context.screen.orientation.angle=270;context.updateNavigationViewport();frames.pop()();
  assert.equal(context.document.documentElement.dataset.notchSide,'right');
  landscape=false;context.updateNavigationViewport();frames.pop()();
  assert.equal(context.document.documentElement.dataset.notchSide,'auto');
});
