import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const failures=[];
async function run(label,size){
 const page=await browser.newPage({viewport:size,acceptDownloads:true});
 page.on("pageerror",e=>failures.push(label+": JS "+e.message));
 try{
  await page.goto("http://127.0.0.1:4173/",{waitUntil:"networkidle"});
  await page.locator("#dashContinue").waitFor({timeout:20000});
  assert.match(await page.locator("body").innerText(),/iPAS AI 備考室/);
  assert.ok(await page.locator('img[src^="img/aiya"]').count()>0);
  assert.equal(await page.locator(".dash-hero").count(),1,"research-lab hero missing");
  assert.equal(await page.locator(".dash-stats .dash-stat").count(),4,"four progress cards required");
  assert.equal(await page.locator(".dash-map .dash-node").count(),5,"five-step learning path required");
  assert.equal(await page.locator(".dash-map .dash-route").count(),1,"visual learning route missing");
  assert.equal(await page.locator(".dash-achievements .dash-medal").count(),4,"achievements must be visible");
  assert.equal(await page.getByText("升級 Gold 會員").count(),0,"no paid membership prompts");
  for(const n of await page.locator(".dash-map .dash-node").all())assert.ok(await n.isVisible());
  if(label==="mobile"){
    const viewport=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headerHeight:document.querySelector(".top").getBoundingClientRect().height}));
    assert.ok(viewport.scrollWidth<=viewport.width+2,"mobile horizontal overflow: "+JSON.stringify(viewport));
    assert.ok(viewport.headerHeight<230,"mobile header obscures homepage: "+JSON.stringify(viewport));
    for(const n of await page.locator(".dash-map .dash-node").all()){
      const b=await n.boundingBox();assert.ok(b&&b.x>=-1&&b.x+b.width<=viewport.width+1,"chapter card clipped offscreen");
    }
  }
  await page.screenshot({path:"home-"+label+".png",fullPage:true});
  await page.locator("#dashContinue").click();
  await page.locator(".sec-head h2").waitFor();
  await page.screenshot({path:"lesson-"+label+".png",fullPage:true});
  await page.reload({waitUntil:"networkidle"});
  await page.locator("#dashContinue").waitFor();
  assert.ok((await page.locator("#ayiaReturn").innerText()).includes("繼續上次單元"));
  await page.locator('.tabs [data-v="me"]').click();
  await page.locator("#localName").fill("測試學習者");
  await page.locator("#localPlan").fill("練習十題");
  await page.locator("#savePersonal").click();
  await page.locator("#vaultTitle").fill("E2E筆記");
  await page.locator("#vaultBody").fill("學習重點測試");
  await page.locator("#vaultAdd").click();
  assert.match(await page.locator(".vault-list").first().innerText(),/E2E筆記/);
  await page.locator("#attachmentInput").setInputFiles({name:"practice.txt",mimeType:"text/plain",buffer:Buffer.from("test file")});
  await page.locator("[data-attachment-get]").waitFor({timeout:10000});
  assert.match(await page.locator("body").innerText(),/practice.txt/);
  await page.reload({waitUntil:"networkidle"});
  await page.locator('.tabs [data-v="me"]').click();
  assert.equal(await page.locator("#localName").inputValue(),"測試學習者");
  assert.equal(await page.locator("[data-attachment-get]").count(),1);
  await page.screenshot({path:"test-"+label+".png",fullPage:true});
  console.log("PASS "+label);
 }finally{await page.close();}
}
try{await run("desktop",{width:1440,height:900});await run("mobile",{width:390,height:844});if(failures.length)throw Error(failures.join("\n"));}finally{await browser.close();}
