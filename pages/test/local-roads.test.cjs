const test=require('node:test');
const assert=require('node:assert/strict');
const local=require('../../web/data/local-roads.json');
const regional=require('../../web/data/regional-expressways.json');
const supplement=require('../../web/data/junction-matching.json');
const {RoadMatcher,project,coordinateAt}=require('../road-matcher.js');

test('the five requested roads and both directions are in the navigation catalogue',()=>{
  for(const name of ['伊豆縦貫自動車道','箱根新道','箱根ターンパイク','保土ヶ谷バイパス','横浜新道']) {
    const links=local.links.filter(link=>link.highwayName===name);
    assert.ok(links.some(link=>link.directionName==='上り'),name);
    assert.ok(links.some(link=>link.directionName==='下り'),name);
    for(const link of links)assert.ok(regional.links.some(item=>item.id===link.id));
  }
  assert.equal(local.links.length,22);
});

test('new point ids, romanizations, road offsets and next-link references are valid',()=>{
  assert.equal(new Set(regional.points.map(point=>point.id)).size,regional.points.length);
  const links=new Map(local.links.map(link=>[link.id,link]));
  for(const point of local.points) {
    assert.ok(point.romanizedName,point.name);
    assert.ok(point.offsetMeters>=0&&point.offsetMeters<=links.get(point.linkID).lengthMeters+.1,point.id);
  }
  for(const link of local.links)for(const next of link.nextLinkIDs)assert.ok(links.has(next));
});

test('unopened Izu stretches and ordinary-road gaps are never linked together',()=>{
  for(const id of ['e70-izu-amagi-down','e70-izu-kawazu-up','e70-izu-kawazu-down','turnpike-main-down','turnpike-izu-up'])assert.deepEqual(local.links.find(link=>link.id===id).nextLinkIDs,[],id);
  assert.deepEqual(local.links.find(link=>link.id==='e70-izu-main-down').nextLinkIDs,['izu-chuo-down']);
});

test('Totsuka has a separate PA for each direction, with confirmed shop data',()=>{
  const down=local.points.find(point=>point.linkID==='e83-yokohama-down'&&point.kind==='PA');
  const up=local.points.find(point=>point.linkID==='e83-yokohama-up'&&point.kind==='PA');
  assert.equal(down.name,'戸塚');assert.equal(up.name,'戸塚');assert.notEqual(down.id,up.id);
  assert.deepEqual(down.brands,['familyMart']);assert.deepEqual(up.brands,[]);
});

test('all 22 local directional links can be selected using their real geometry',()=>{
  for(const link of local.links)for(const fraction of [.2,.5,.8]) {
    const matcher=new RoadMatcher(regional.links,regional.points,supplement);
    for(let i=0;i<5;i++) {
      const coordinate=coordinateAt(link,link.lengthMeters*fraction+i*15);
      const result=matcher.update({timestamp:100000+i*1000,coords:{...coordinate,heading:project(link,coordinate).bearing,speed:15,accuracy:5}});
      assert.equal(result?.link.id,link.id,`${link.id} at ${fraction}`);
    }
  }
});

test('existing/new expressway transfers are represented as shared junctions',()=>{
  for(const name of ['横浜町田','沼津','長泉沼津','新保土ヶ谷']) {
    const junction=supplement.junctions.find(junction=>junction.name===name);
    assert.ok(junction&&junction.anchors.length>=4,name);
  }
});
