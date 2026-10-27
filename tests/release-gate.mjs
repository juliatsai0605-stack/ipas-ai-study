// Browser-only release gate. No external service credentials or deployments required.
import assert from "node:assert/strict";
import {readdirSync} from "node:fs";
import {chromium} from "playwright";

const BASE="http://127.0.0.1:4173/";
const assets=readdirSync("img",{withFileTypes:true})
 .filter(x=>x.isFile()&&/\.(?:png|jpe?g|webp|svg)$/i.test(x.name))
 .map(x=>"img/"+x.name);
assert.ok(assets.length>=25,"image inventory unexpectedly small");

const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const failures=[];
async function inspect(page,label){
 const report=await page.evaluate(()=>{
   const vw=innerWidth;
   const doc=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);
   const badImages=[...document.images].filter(x=>x.getClientRects().length&&(!x.complete||x.naturalWidth<1)).map(x=>x.getAttribute("src"));
   const root=document.querySelector("#main")?.getBoundingClientRect();
   const top=document.querySelector(".top-in")?.getBoundingClientRect();
   return {vw,doc,badImages,root:{left:root?.left,right:root?.right,width:root?.width},top:{left:top?.left,right:top?.right,width:top?.width}};
 });
 assert.ok(report.doc<=report.vw+2,label+" page horizontal overflow "+JSON.stringify(report));
 assert.deepEqual(report.badImages,[],label+" broken displayed images");
 assert.ok(report.root.width>0&&report.root.left>=-2&&report.root.right<=report.vw+2,label+" main content outside viewport "+JSON.stringify(report));
 assert.ok(report.top.width>0&&report.top.left>=-2&&report.top.right<=report.vw+2,label+" header outside viewport "+JSON.stringify(report));
}

try{
 // Decode every committed image, not merely those initially visible in the DOM.
 const assetPage=await browser.newPage();
 try{
  await assetPage.goto(BASE,{waitUntil:"networkidle"});
  for(const asset of assets){
   const response=await assetPage.request.get(BASE+asset);
   assert.equal(response.status(),200,"missing asset: "+asset);
   assert.match(response.headers()["content-type"]||"",/^image\//,"invalid MIME: "+asset);
   const result=await assetPage.evaluate(async src=>{
     const img=new Image();
     img.src="/"+src;
     try{await img.decode();return {ok:img.naturalWidth>0&&img.naturalHeight>0,w:img.naturalWidth,h:img.naturalHeight};}
     catch(e){return {ok:false,error:String(e)};}
   },asset);
   assert.ok(result.ok,"undecodable image "+asset+" "+JSON.stringify(result));
  }
  console.log("PASS assets: "+assets.length+" files fetched and decoded in Chromium");
 }finally{await assetPage.close();}

 const sizes=[["desktop",{width:1440,height:900}],["mobile-390",{width:390,height:844}],["tablet-768",{width:768,height:1024}]];
 for(const [label,viewport] of sizes){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  page.on("pageerror",e=>failures.push(label+": "+e.message));
  try{
   await page.goto(BASE,{waitUntil:"networkidle"});
  // Isolated frontend fixture only; real Auth/RLS E2E is a separate release gate.
  await page.evaluate(()=>window.IPAS_BRIDGE.attachUser("ui-test-account",{}));
   await page.locator("#dashContinue").waitFor({timeout:20000});
   await inspect(page,label+" home");
   const tabs=["home","units","drill","mock","me"];
   for(const tab of tabs){
    const button=page.locator('.tabs button[data-v="'+tab+'"]');
    await button.click();
    await page.locator("#main").waitFor({state:"visible"});
    assert.ok((await page.locator("#main").innerText()).trim().length>20,label+" "+tab+" rendered empty");
    await inspect(page,label+" tab "+tab);
   }
   // Exercise the full eight-item sidebar, including review, badges and mentor.
   const destinations=["home","units","drill","mock","review","me","badges","mentor"];
   for(const dest of destinations){
    if(viewport.width<=900){
      await page.locator("#tocBtn").click();
      await page.locator("#toc.studio-nav, #toc.open").first().waitFor({state:"visible"});
    }
    const button=page.locator('.studio-nav button[data-go="'+dest+'"]');
    await button.click();
    assert.ok((await page.locator("#main").innerText()).trim().length>15,label+" "+dest+" rendered empty");
    await inspect(page,label+" sidebar "+dest);
   }
   // Return to home and test keyboard navigation on the actual visible tab.
   await page.locator('.tabs button[data-v="home"]').focus();
   await page.keyboard.press("Enter");
   await page.locator("#dashContinue").waitFor();
   await inspect(page,label+" keyboard home");
   await page.screenshot({path:"navigation-"+label+".png",fullPage:false,animations:"disabled"});
   console.log("PASS navigation "+label+": five tabs, eight sidebar actions, keyboard and overflow");
  }finally{await context.close();}
 }
 assert.deepEqual(failures,[],"unexpected JavaScript exceptions");
}finally{await browser.close();}
