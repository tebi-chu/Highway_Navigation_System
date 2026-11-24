// Optional local browser check after build-pages.mjs. Uses an installed Edge.
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../pages-dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!filename.startsWith(root+path.sep))throw new Error();
    let body=await fs.readFile(filename);
    if(filename.endsWith('.css'))body=body.toString().replace(/env\(safe-area-inset-(?:left|right),0px\)/g,'var(--test-safe-inline,0px)')+'\n@media(orientation:landscape){:root{--test-safe-inline:50px}}';
    res.writeHead(200,{'content-type':types[path.extname(filename)]||'application/octet-stream'});res.end(body);
  } catch {res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    for(const angle of [90,270]) {
      const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
      await context.addInitScript(angle=>{
        Object.defineProperty(screen.orientation,'angle',{get:()=>angle});
        localStorage.setItem('highway-assist-login',JSON.stringify({hash:'6aad2a32fb03b897090626ee6843917154f3dc21cdb740f62a15b91b62aaab29',expiry:Date.now()+60000,mode:'viewer'}));
      },angle);
      const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/?preview=1`);
      await page.locator('.primary-column .live-card').first().waitFor();
      await page.waitForTimeout(1000);
      const newRoads=await page.evaluate(()=>{
        populateEditorRoads();
        return ['東名阪自動車道','伊豆縦貫自動車道','伊豆中央道','修善寺道路','箱根新道','箱根ターンパイク','保土ヶ谷バイパス','横浜新道'].map(name=>({name,directions:[...editorRoadGroups.values()].filter(group=>group.highwayName===name).map(group=>group.directionName)}));
      });
      for(const road of newRoads)assert.deepEqual(road.directions.sort(),['上り','下り'],road.name);
      const layout=await page.evaluate(()=>{
        const nav=document.getElementById('navigation'),rect=nav.getBoundingClientRect(),css=getComputedStyle(nav);
        return {top:rect.top,bottom:rect.bottom,width:rect.width,left:css.paddingLeft,right:css.paddingRight,primary:document.querySelectorAll('.primary-column .live-card').length,compact:document.querySelectorAll('.compact-column .live-card').length,romanPrimary:document.querySelectorAll('.primary-column .point-name>small').length,romanCompact:document.querySelectorAll('.compact-column .point-name>small').length};
      });
      assert.equal(layout.top,0);assert.equal(layout.bottom,390);assert.equal(layout.width,844);
      assert.equal(layout[angle===90?'left':'right'],'50px');assert.equal(layout[angle===90?'right':'left'],'0px');
      assert.equal(layout.primary,2);assert.equal(layout.compact,3);assert.equal(layout.romanPrimary,2);assert.equal(layout.romanCompact,0);
      await page.evaluate(()=>{
        const link=links.find(link=>link.id==='e1a-shintomei-west');
        const area=points.find(point=>point.linkID===link.id&&point.name==='遠州森町'&&point.kind==='PA');
        render({link,offset:area.offsetMeters-500,speed:27.8},5);
      });
      const card=page.locator('.primary-column .live-card').filter({hasText:'遠州森町'});
      assert.equal(await card.count(),1);assert.deepEqual(await card.locator('.point-kinds span').allTextContents(),['PA','IC']);
      assert.equal((await card.locator('.next-distance').innerText()).replace(/\s/g,''),'0.5km');
      const roads=await page.evaluate(()=>{
        const link=links.find(link=>link.id==='e4-north');
        const junction=points.find(point=>point.linkID===link.id&&point.name==='久喜白岡'&&point.kind==='JCT');
        const ids=[];
        for(let i=0;i<20;i++) {
          const coordinate=HighwayRoadMatcher.coordinateAt(link,junction.offsetMeters-200+i*25);
          ids.push(matchPosition({timestamp:Date.now()+i*1000,coords:{...coordinate,heading:HighwayRoadMatcher.project(link,coordinate).bearing,speed:25,accuracy:8}})?.link.id);
        }
        return ids;
      });
      assert.ok(roads.every(id=>id==='e4-north'),'live app road-matcher integration');
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(200);
      assert.equal(await page.locator('#point-list>.live-card').count(),5);
      assert.equal(await page.locator('#navigation').evaluate(nav=>getComputedStyle(nav).position),'static');
      // Reproduce the user's Ebina example using a local-only fixture.
      await page.evaluate(()=>{
        const link=links.find(link=>link.id==='e1-tomei-east');
        const area=points.find(point=>point.linkID===link.id&&point.name==='海老名'&&point.kind==='SA');
        area.brands=['starbucks'];area.facilities=['restaurant','fuel'];area.note='柿安・成城石井・くくる';
        render({link,offset:area.offsetMeters-100,speed:10},5);
      });
      for(const size of [{width:390,height:844},{width:440,height:956}]) {
        await page.setViewportSize(size);await page.waitForTimeout(150);
        const ebina=page.locator('#point-list .live-card').filter({hasText:'Ebina'});
        const layout=await ebina.evaluate(card=>{
          const note=card.querySelector('.facility-note'),row=card.querySelector('.facility-row'),metrics=card.querySelector('.live-metrics');
          const n=note.getBoundingClientRect(),r=row.getBoundingClientRect(),m=metrics.getBoundingClientRect(),c=card.getBoundingClientRect();
          return {note:note.textContent,font:parseFloat(getComputedStyle(note).fontSize),outside:!row.contains(note),fullWidth:Math.abs(n.width-c.width)<2,side:card.querySelector('.live-details').classList.contains('note-side'),noOverlap:n.top>=r.bottom-1&&(n.top>=m.bottom-1||n.right<=m.left+1),bottom:n.bottom<=c.bottom+1,metricHeight:m.height,metricChildren:[...metrics.children].map(item=>item.getBoundingClientRect().height),metricsFit:[...metrics.children].every(item=>{const b=item.getBoundingClientRect();return b.top>=m.top-1&&b.bottom<=m.bottom+1&&b.right<=m.right+1;}),iconsFit:[...row.children].every(item=>item.scrollWidth<=item.clientWidth+1)};
        });
        assert.equal(layout.note,'★ 柿安・成城石井・くくる');assert.ok(layout.font>=20);
        assert.ok(layout.outside&&(layout.fullWidth||layout.side)&&layout.noOverlap&&layout.bottom&&layout.metricsFit&&layout.iconsFit,JSON.stringify({size,layout}));
        if(size.width===440)assert.equal(layout.fullWidth,true);
      }
      // Long text remains one line and moves automatically without shrinking.
      await page.evaluate(()=>{
        const area=points.find(point=>point.name==='海老名'&&point.kind==='SA'&&point.linkID===lastRenderArgs.match.link.id);
        area.note='柿安・成城石井・くくる／お弁当がおいしい。休憩におすすめ。';
        render(...[lastRenderArgs.match,lastRenderArgs.accuracy]);
      });
      const noteMotion=await page.locator('#point-list .facility-note').first().evaluate(async note=>{
        const animation=note._memoAnimation,text=note.querySelector('.facility-note-text');
        const duration=animation.effect.getTiming().duration;
        animation.currentTime=1500+(duration-3000)/4;
        window.oldMemoAnimation=animation;
        await new Promise(resolve=>requestAnimationFrame(resolve));
        return {time:animation.currentTime,scrolling:note.classList.contains('is-scrolling'),nowrap:getComputedStyle(text).whiteSpace==='nowrap',font:parseFloat(getComputedStyle(note).fontSize),oneLine:note.clientHeight<=parseFloat(getComputedStyle(note).lineHeight)+1,x:new DOMMatrixReadOnly(getComputedStyle(text).transform).m41};
      });
      assert.ok(noteMotion.scrolling&&noteMotion.nowrap&&noteMotion.oneLine&&noteMotion.x<0);assert.ok(noteMotion.font>=20);
      await page.evaluate(()=>render(lastRenderArgs.match,lastRenderArgs.accuracy));
      const resumed=await page.locator('#point-list .facility-note').first().evaluate(note=>({time:note._memoAnimation.currentTime,oldState:window.oldMemoAnimation.playState}));
      assert.ok(Math.abs(resumed.time-noteMotion.time)<300,'GPS update preserves memo animation phase');
      assert.equal(resumed.oldState,'idle','detached animations are cancelled');
      await page.evaluate(()=>{
        const area=points.find(point=>point.name==='海老名'&&point.kind==='SA'&&point.linkID===lastRenderArgs.match.link.id);
        area.note='おすすめ';render(lastRenderArgs.match,lastRenderArgs.accuracy);
      });
      assert.equal(await page.locator('#point-list .facility-note').first().evaluate(note=>!!note._memoAnimation),false,'short note stays still');
      await page.evaluate(()=>{
        const area=points.find(point=>point.name==='海老名'&&point.kind==='SA'&&point.linkID===lastRenderArgs.match.link.id);
        area.note='柿安・成城石井・くくる／お弁当がおいしい。休憩におすすめ。';
        render(lastRenderArgs.match,lastRenderArgs.accuracy);
      });
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
      const safeArea=await page.addStyleTag({content:'.navigation-screen{padding-top:59px!important;padding-bottom:34px!important}'});
      await page.evaluate(()=>render(lastRenderArgs.match,lastRenderArgs.accuracy));
      const safeMetrics=await page.locator('#point-list .live-card').filter({hasText:'Ebina'}).locator('.live-metrics').evaluate(metrics=>{
        const m=metrics.getBoundingClientRect();
        return [...metrics.children].every(child=>{const r=child.getBoundingClientRect();return r.top>=m.top-1&&r.bottom<=m.bottom+1;});
      });
      assert.equal(safeMetrics,true,'portrait memo respects iPhone safe areas');
      await safeArea.evaluate(style=>style.remove());
      await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);
      const landscapeCard=page.locator('.primary-column .live-card').filter({hasText:'Ebina'});
      const landscapeRow=landscapeCard.locator('.facility-row');
      assert.equal(await landscapeRow.evaluate(row=>row.classList.contains('facility-wrapped')),false);
      assert.ok(await landscapeCard.locator('.facility-note').evaluate(note=>parseFloat(getComputedStyle(note).fontSize)>=25));
      assert.ok(await landscapeCard.locator('.facility-note').evaluate(note=>!!note._memoAnimation),'landscape long note scrolls');
      assert.equal(await page.locator('.compact-column .facility-note,.compact-column .facility-row').count(),0);
      // A note with no registered equipment still has its own bottom band.
      await page.evaluate(()=>{
        const area=points.find(point=>point.name==='海老名'&&point.kind==='SA'&&point.linkID===lastRenderArgs.match.link.id);
        area.facilities=[];area.brands=[];
        render(lastRenderArgs.match,lastRenderArgs.accuracy);
      });
      assert.equal(await landscapeCard.locator('.facility-note').count(),1);
      assert.equal(await landscapeCard.locator('.facility-row').count(),0);
      await page.evaluate(()=>{
        const link=links.find(link=>link.id==='e23-tomeihan-down');
        const area=points.find(point=>point.linkID===link.id&&point.name==='御在所'&&point.kind==='SA');
        render({link,offset:area.offsetMeters-500,speed:20},5);
      });
      assert.equal(await page.locator('#route-number').innerText(),'E23');
      assert.equal(await page.locator('#highway-name').innerText(),'東名阪自動車道');
      assert.equal(await page.locator('.primary-column .live-card').filter({hasText:'御在所'}).count(),1);
      const hasNoExit=await page.evaluate(()=>{
        const link=links.find(link=>link.id==='e1a-isewangan-west');
        const ic=points.find(p=>p.linkID===link.id&&p.name==='みえ朝日'&&p.kind==='IC');
        render({link,offset:ic.offsetMeters-100,speed:20},5);
        return [...document.querySelectorAll('.live-card')].some(card=>card.textContent.includes('みえ朝日'));
      });
      assert.equal(hasNoExit,false);
      assert.deepEqual(errors,[]);
      console.log(`PASS landscape startup ${angle}: full height, opposite edge, 2/3 columns, romanization, merged PA/IC, portrait rotation`);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
