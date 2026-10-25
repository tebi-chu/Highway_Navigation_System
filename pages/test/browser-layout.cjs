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
    if(filename.endsWith('.css'))body=body.toString().replace(/env\(safe-area-inset-(?:left|right),0px\)/g,'50px');
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
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(200);
      assert.equal(await page.locator('#point-list>.live-card').count(),5);
      assert.equal(await page.locator('#navigation').evaluate(nav=>getComputedStyle(nav).position),'static');
      assert.deepEqual(errors,[]);
      console.log(`PASS landscape startup ${angle}: full height, opposite edge, 2/3 columns, romanization, merged PA/IC, portrait rotation`);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
