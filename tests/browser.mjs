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
  const art=await page.locator('.dash-character img').evaluate(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0}));
  assert.equal(art.src,'img/aiya-reference.png',"hero must use original Aiya illustration");
  assert.ok(art.loaded,"reference Aiya illustration must load");
  for(const asset of ['img/lab-scene.png','img/map-skyline.png','img/aiya-pose-1.png','img/aiya-pose-2.png','img/aiya-pose-3.png','img/aiya-pose-4.png','img/aiya-pose-5.png','img/aiya-pose-6.png','img/badge-1.svg','img/badge-2.svg','img/badge-3.svg','img/badge-4.svg','img/stat-1.svg','img/stat-2.svg','img/stat-3.svg','img/stat-4.svg','img/ipas-planet-logo.svg']){
    const res=await page.request.get('http://127.0.0.1:4173/'+asset);
    assert.equal(res.status(),200,'missing original illustration '+asset);
    assert.match(res.headers()['content-type']||'',/image/,'invalid image MIME '+asset);
  }
  assert.equal(await page.locator(".dash-hero").count(),1,"research-lab hero missing");
  assert.equal(await page.locator(".studio-nav-icon").count(),8,"all eight navigation icons required");
  assert.equal(await page.locator(".brand .seal img").count(),1,"planetary iPAS brand mark required");
  assert.equal(await page.locator(".dash-stats .dash-stat").count(),4,"four progress cards required");
  assert.equal(await page.locator(".dash-stats img[src^='img/stat-']").count(),4,"all stat illustrations required");
  assert.equal(await page.locator(".dash-map .dash-node").count(),5,"five-step learning path required");
  assert.equal(await page.locator(".dash-map .dash-route").count(),1,"visual learning route missing");
  assert.equal(await page.locator(".dash-achievements .dash-medal").count(),4,"achievements must be visible");
  assert.equal(await page.locator(".dash-achievements img[src^='img/badge-']").count(),4,"illustrated achievement badges must render");
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
  await page.screenshot({path:"home-fold-"+label+".png",fullPage:false});
  const broken=await page.locator("img").evaluateAll(images=>images.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute("src")));
  assert.deepEqual(broken,[],"broken site illustrations");
  if(label==="mobile"){
    const brand=await page.locator(".brand h1").evaluate(el=>({visible:el.getBoundingClientRect().width,needed:el.scrollWidth,text:el.textContent}));
    assert.match(brand.text,/iPAS AI 備考室/);
    assert.ok(brand.needed<=brand.visible+2,"mobile brand name truncated");
  }
  const heroRect=await page.locator(".dash-hero").boundingBox();
  assert.ok(heroRect&&heroRect.width>0&&heroRect.height>0,"hero must be visible");
  const characterRect=await page.locator(".dash-character img").boundingBox();
  assert.ok(characterRect&&characterRect.height>=100,"Aiya character must not collapse");
  const clipped=await page.evaluate(()=>{
    const vw=innerWidth;
    return [...document.querySelectorAll(".dash-stat,.dash-medal,.dash-node,.dash-last")].filter(e=>{
      const r=e.getBoundingClientRect();return r.width>0&&(r.left<-2||r.right>vw+2);
    }).map(e=>e.className);
  });
  assert.deepEqual(clipped,[],"dashboard card clipped outside viewport");
  // The learning map must be actionable, not just visually complete.
  await page.locator('.dash-node[data-dash-sec]').first().click();
  await page.locator('.sec-head h2').waitFor();
  await page.locator('.tabs [data-v="home"]').click();
  await page.locator("#dashContinue").waitFor();
  // All five chapter nodes remain available after returning from a lesson.
  assert.equal(await page.locator(".dash-node[data-dash-sec]").count(),5);
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

async function runAccountIsolation(){
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage();
 try{
  await page.goto("http://127.0.0.1:4173/",{waitUntil:"networkidle"});
  await page.locator("#dashContinue").waitFor();
  await page.locator('.tabs [data-v="me"]').click();
  await page.locator("#attachmentInput").setInputFiles({name:"anonymous-note.txt",mimeType:"text/plain",buffer:Buffer.from("anonymous attachment")});
  await page.locator('[data-attachment-get]').waitFor();
  const initial=await page.evaluate(()=>{
    const b=window.IPAS_BRIDGE;
    b.attachUser("test-account-a",{vault:[{title:"A-private-note",body:"private A",date:"2026-10-25"}]});
    const a=b.snapshot();
    b.signOut();
    b.attachUser("test-account-b",{localName:"B-private-name",vault:[{title:"B-private-note",body:"private B",date:"2026-10-25"}]});
    const bState=b.snapshot();
    return {aHasNote:a.vault?.some(n=>n.title==="A-private-note"),aHasFile:JSON.parse(localStorage.getItem("ipas-ai-study-v4-account-test-account-a")||"{}").attachments?.some(f=>f.name==="anonymous-note.txt"),bHasA:bState.vault?.some(n=>n.title==="A-private-note"),bHasFile:(JSON.parse(localStorage.getItem("ipas-ai-study-v4-account-test-account-b")||"{}").attachments||[]).length,bName:bState.localName};
  });
  assert.ok(initial.aHasNote&&initial.aHasFile,"first login must migrate anonymous attachment and preserve notes: "+JSON.stringify(initial));
  assert.equal(initial.bHasA,false,"second account must not see first account notes");
  assert.equal(initial.bHasFile,0,"second account must not see first account attachments");
  assert.equal(initial.bName,"B-private-name","second account should retain own cloud profile");
  await page.locator('.tabs [data-v="me"]').click();
  await page.locator("#attachmentInput").setInputFiles({name:"account-b.txt",mimeType:"text/plain",buffer:Buffer.from("B attachment")});
  await page.locator('[data-attachment-get]').waitFor();
  await page.locator("#rstB").click();
  await page.locator("#ry").click();
  const restored=await page.evaluate(()=>{
    const b=window.IPAS_BRIDGE;
    b.signOut();b.attachUser("test-account-a",{});
    return {state:b.snapshot(),attachments:JSON.parse(localStorage.getItem("ipas-ai-study-v4-account-test-account-a")||"{}").attachments||[]};
  });
  assert.ok(restored.state.vault?.some(n=>n.title==="A-private-note"),"account A notes must survive account B reset");
  assert.ok(restored.attachments.some(f=>f.name==="anonymous-note.txt"),"account A attachment must survive account B reset");
  await page.locator('.tabs [data-v="me"]').click();
  const storedBlob=await page.evaluate(async()=>{
    const record=JSON.parse(localStorage.getItem("ipas-ai-study-v4-account-test-account-a")||"{}").attachments?.[0];
    if(!record)return {record:false};
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open("ipas-ai-study-attachments",1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const data=await new Promise((resolve,reject)=>{const req=db.transaction("files","readonly").objectStore("files").get(record.id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    db.close();
    return {record:true,stored:!!data,blob:!!data?.blob,size:data?.blob?.size||0};
  });
  assert.ok(storedBlob.stored&&storedBlob.blob,"account A binary file lost during B reset: "+JSON.stringify(storedBlob));
  const dialogs=[];
  page.on("dialog",async d=>{dialogs.push(d.message());await d.dismiss();});
  const download=page.waitForEvent("download",{timeout:10000});
  await page.locator('[data-attachment-get]').first().click();
  const file=await download.catch(e=>{throw Error("A download did not start; dialogs="+JSON.stringify(dialogs)+" stored="+JSON.stringify(storedBlob)+" "+e.message);});
  assert.equal(file.suggestedFilename(),"anonymous-note.txt","A file must remain retrievable after B reset");
  console.log("PASS account-isolation");
 }finally{await context.close();}
}
try{await run("desktop",{width:1440,height:900});await run("mobile",{width:390,height:844});await run("tablet",{width:768,height:1024});await runAccountIsolation();if(failures.length)throw Error(failures.join("\n"));}finally{await browser.close();}
