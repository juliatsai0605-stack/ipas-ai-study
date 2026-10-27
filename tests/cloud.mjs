import {chromium} from "playwright";
import assert from "node:assert/strict";

const mockModule = `
const records={
 "test-a":{state:{v:4,localName:"甲帳號",vault:[{title:"甲的私人筆記",body:"only A",date:"2026-10-25"}]},display_name:"甲帳號"},
 "test-b":{state:{v:4,localName:"乙帳號",vault:[{title:"乙的私人筆記",body:"only B",date:"2026-10-25"}]},display_name:"乙帳號"}
};
let listener=null,session=null,readFailure=false;
const storageFiles={};
const canRead=(path)=>!!session?.user?.id&&path.startsWith(session.user.id+"/");
window.__cloudMock={
 records,
 storageFiles,
 canRead,
 failNextRead:()=>{readFailure=true;},
 getSession:()=>session,
 emit:(event,s)=>{session=s;listener?.(event,s);}
};
export function createClient(){
 return {
  auth:{
   onAuthStateChange(cb){listener=cb;return {data:{subscription:{unsubscribe(){}}}};},
   async getSession(){return {data:{session}};},
   async signInWithPassword({email}){
    const id=email.startsWith("a")?"test-a":"test-b";
    session={user:{id,email}};queueMicrotask(()=>listener?.("SIGNED_IN",session));
    return {data:{session},error:null};
   },
   async signOut(){session=null;queueMicrotask(()=>listener?.("SIGNED_OUT",null));return {error:null};},
   async signUp(){return {data:{session:null},error:null};}
  },
  from(table){
   if(table!=="study_profiles")throw Error("unexpected table "+table);
   return {
    select(){return {eq(_col,id){return {async maybeSingle(){
      if(readFailure){readFailure=false;return {data:null,error:{message:"mock database offline"}};}
      return {data:records[id]||null,error:null};
    }}}};},
    async upsert(row){records[row.user_id]={state:row.state,display_name:row.display_name};return {error:null};}
   };
  },
  storage:{from(bucket){
   if(bucket!=="study-files")throw Error("unexpected bucket "+bucket);
   return {
    async list(prefix){
     if(!session?.user||prefix!==session.user.id)return {data:null,error:{message:"RLS: forbidden list"}};
     const files=Object.entries(storageFiles).filter(([path])=>path.startsWith(prefix+"/")).map(([path,f])=>({
       name:path.slice(prefix.length+1),id:path,metadata:{size:f.bytes.length},created_at:"2026-10-25"
     }));
     return {data:files,error:null};
    },
    async upload(path,file){
     if(!canRead(path))return {data:null,error:{message:"RLS: forbidden upload"}};
     storageFiles[path]={bytes:new Uint8Array(await file.arrayBuffer()),type:file.type};
     return {data:{path},error:null};
    },
    async download(path){
     if(!canRead(path))return {data:null,error:{message:"RLS: forbidden download"}};
     const f=storageFiles[path];
     return f?{data:new Blob([f.bytes],{type:f.type}),error:null}:{data:null,error:{message:"not found"}};
    },
    async remove(paths){
     if(paths.some(p=>!canRead(p)))return {data:null,error:{message:"RLS: forbidden delete"}};
     for(const p of paths)delete storageFiles[p];
     return {data:paths,error:null};
    }
   };
  }}
 };
}`;
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
try{
 await page.route("http://127.0.0.1:4173/api/cloud-config",route=>route.fulfill({
  status:200,contentType:"application/json",body:JSON.stringify({configured:true,url:"https://mock.supabase.co",publishableKey:"mock-public-key"})
 }));
 await page.route("https://esm.sh/**",route=>{
  if(route.request().url().includes("@supabase/supabase-js"))return route.fulfill({
   status:200,contentType:"text/javascript",headers:{"access-control-allow-origin":"*"},body:mockModule
  });
  return route.abort();
 });
 await page.goto("http://127.0.0.1:4173/",{waitUntil:"networkidle"});
 await page.locator(".cloud-account-host button").waitFor({timeout:15000});
 assert.match(await page.locator(".cloud-account-host button").innerText(),/登入/);
 const mobileGeometry=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,header:document.querySelector(".top").getBoundingClientRect().height}));
 assert.ok(mobileGeometry.scroll<=mobileGeometry.viewport+2,"cloud account controls overflow mobile viewport: "+JSON.stringify(mobileGeometry));
 assert.ok(mobileGeometry.header<230,"cloud account controls make mobile header too tall: "+JSON.stringify(mobileGeometry));
 // Personal views must be blocked before authentication, including mobile navigation.
 for(const view of ["units","drill","mock","me"]){
   await page.locator('.tabs [data-v="'+view+'"]').click();
   assert.ok(await page.locator("#cloudAnonymous").isVisible(),"guest must be prompted to sign in: "+view);
   assert.equal(await page.locator("#attachmentInput").count(),0,"guest must not access private files");
   await page.locator("#cloudClose").click();
 }
 await page.locator(".cloud-account-host button").click();
 await page.locator("#cloudEmail").fill("a@example.test");
 await page.locator("#cloudPassword").fill("password123");
 await page.locator("#cloudSignUp").click();
 assert.match(await page.locator("#cloudMessage").innerText(),/註冊申請已送出/,"signup confirmation flow");
 await page.locator("#cloudSignIn").click();
 await page.locator("#cloudSignedIn").waitFor({state:"visible",timeout:15000});
 await page.waitForFunction(()=>window.IPAS_BRIDGE?.snapshot().vault?.some(n=>n.title==="甲的私人筆記"),{timeout:15000});
 await page.evaluate(()=>window.IPAS_BRIDGE.updateCloudName("雲端跨裝置續學"));
 await page.waitForFunction(()=>window.__cloudMock.records["test-a"].state.localName==="雲端跨裝置續學",{timeout:15000});
 // Actual upload/list/download/delete UI flow against an RLS-enforcing Supabase mock.
 await page.locator("#cloudUpload").setInputFiles({name:"study-note.txt",mimeType:"text/plain",buffer:Buffer.from("private A study content")});
 await page.locator("#cloudUploadBtn").click();
 await page.locator(".vault-entry").first().waitFor({timeout:15000});
 assert.match(await page.locator("#cloudFiles").innerText(),/study-note\.txt/);
 const aFile=await page.evaluate(()=>Object.keys(window.__cloudMock.storageFiles)[0]);
 assert.ok(aFile.startsWith("test-a/"),"A upload must use A namespace");
 const download=page.waitForEvent("download",{timeout:10000});
 await page.locator(".vault-entry button").first().click();
 const downloaded=await download;
 assert.equal(downloaded.suggestedFilename(),"study-note.txt","cloud attachment filename must survive download");
 await page.locator("#cloudSignOut").click();
 await page.locator("#cloudAnonymous").waitFor({state:"visible",timeout:15000});
 assert.equal(await page.locator(".vault-entry").count(),0,"signed-out users must not see A cloud attachments");
 // Emulate a fresh second device by clearing account-local cache before reading remote profile.
 await page.evaluate(()=>localStorage.removeItem("ipas-ai-study-v4-account-test-a"));
 // Re-login A to check that the private attachment is persisted and deletable.
 await page.locator("#cloudEmail").fill("a@example.test");
 await page.locator("#cloudPassword").fill("password123");
 await page.locator("#cloudSignIn").click();
 await page.locator("#cloudSignedIn").waitFor({state:"visible",timeout:15000});
 await page.waitForFunction(()=>window.IPAS_BRIDGE.snapshot().localName==="雲端跨裝置續學",{timeout:15000});
 await page.locator("#cloudRefreshFiles").click();
 await page.locator(".vault-entry").first().waitFor({timeout:15000});
 page.once("dialog",async dialog=>dialog.accept());
 await page.locator(".vault-entry button").nth(1).click();
 await page.waitForFunction(()=>Object.keys(window.__cloudMock.storageFiles).length===0,{timeout:15000});
 assert.equal(await page.locator(".vault-entry").count(),0,"deleted attachment must disappear from list");
 // Keep one private A attachment to verify account B cannot list or fetch it.
 await page.locator("#cloudUpload").setInputFiles({name:"only-a.txt",mimeType:"text/plain",buffer:Buffer.from("A only")});
 await page.locator("#cloudUploadBtn").click();
 await page.locator(".vault-entry").first().waitFor({timeout:15000});
 await page.waitForFunction(()=>window.IPAS_BRIDGE?.snapshot().vault?.some(n=>n.title==="甲的私人筆記"),{timeout:15000});
 await page.locator("#cloudSignOut").click();
 await page.locator("#cloudAnonymous").waitFor({state:"visible",timeout:15000});
 assert.equal(await page.evaluate(()=>window.IPAS_BRIDGE.snapshot().vault?.some(n=>n.title==="甲的私人筆記")||false),false,"A notes visible after signout");
 await page.locator("#cloudEmail").fill("b@example.test");
 await page.locator("#cloudPassword").fill("password123");
 await page.locator("#cloudSignIn").click();
 await page.waitForFunction(()=>window.IPAS_BRIDGE?.snapshot().vault?.some(n=>n.title==="乙的私人筆記"),{timeout:15000});
 const state=await page.evaluate(()=>window.IPAS_BRIDGE.snapshot());
 assert.equal(state.vault?.some(n=>n.title==="甲的私人筆記")||false,false,"A notes leaked into B account");
 assert.ok(state.vault?.some(n=>n.title==="乙的私人筆記"),"B notes missing");
 await page.locator("#cloudRefreshFiles").click();
 await page.waitForFunction(()=>document.querySelector("#cloudFiles")?.textContent.includes("尚無雲端附件"),{timeout:15000});
 assert.equal(await page.locator(".vault-entry").count(),0,"B must not list A attachments");
 assert.equal(await page.evaluate(()=>window.__cloudMock.canRead(Object.keys(window.__cloudMock.storageFiles)[0])),false,"B must not read A storage path");
 // Browser-side quota and extension checks must prevent unauthorized formats and oversize files.
 await page.locator("#cloudUpload").setInputFiles({name:"malware.exe",mimeType:"application/octet-stream",buffer:Buffer.from("x")});
 await page.locator("#cloudUploadBtn").click();
 assert.match(await page.locator("#cloudMessage").innerText(),/不支援此檔案格式/);
 await page.locator("#cloudUpload").setInputFiles({name:"oversize.pdf",mimeType:"application/pdf",buffer:Buffer.alloc(10485761)});
 await page.locator("#cloudUploadBtn").click();
 assert.match(await page.locator("#cloudMessage").innerText(),/單檔上限 10 MB/);
 await page.screenshot({path:"cloud-mobile.png",fullPage:false});
 await page.locator("#cloudSignOut").click();
 await page.locator("#cloudAnonymous").waitFor({state:"visible",timeout:15000});
 await page.evaluate(()=>window.__cloudMock.failNextRead());
 await page.locator("#cloudEmail").fill("b@example.test");
 await page.locator("#cloudPassword").fill("password123");
 await page.locator("#cloudSignIn").click();
 await page.waitForFunction(()=>document.querySelector("#cloudMessage")?.textContent.includes("暫停自動同步"),{timeout:15000});
 await page.evaluate(()=>window.IPAS_BRIDGE.updateCloudName("不應覆寫遠端"));
 await page.waitForTimeout(1400);
 const record=await page.evaluate(()=>window.__cloudMock.records["test-b"].state.localName);
 assert.notEqual(record,"不應覆寫遠端","failed cloud read must not overwrite remote profile");
 assert.deepEqual(errors,[],"unexpected browser JavaScript errors");
 console.log("PASS cloud-auth-mock: sign-in, sign-out, profile isolation, private upload/download/delete, storage RLS mock, cloud roundtrip after clearing local cache, upload limits, failed-read write gate");
}finally{await browser.close();}
