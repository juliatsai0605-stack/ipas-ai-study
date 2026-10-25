import {chromium} from "playwright";
import assert from "node:assert/strict";

const mockModule = `
const records={
 "test-a":{state:{v:4,localName:"甲帳號",vault:[{title:"甲的私人筆記",body:"only A",date:"2026-10-25"}]},display_name:"甲帳號"},
 "test-b":{state:{v:4,localName:"乙帳號",vault:[{title:"乙的私人筆記",body:"only B",date:"2026-10-25"}]},display_name:"乙帳號"}
};
let listener=null,session=null,readFailure=false;
window.__cloudMock={
 records,
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
  storage:{from(){return {async list(){return {data:[],error:null};}}}}
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
 await page.locator(".cloud-account-host button").click();
 await page.locator("#cloudEmail").fill("a@example.test");
 await page.locator("#cloudPassword").fill("password123");
 await page.locator("#cloudSignIn").click();
 await page.locator("#cloudSignedIn").waitFor({state:"visible",timeout:15000});
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
 console.log("PASS cloud-auth-mock: sign-in, sign-out, account isolation, failed-read write gate");
}finally{await browser.close();}
