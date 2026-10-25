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
  await page.locator("#dashContinue").click();
  await page.locator(".sec-head h2").waitFor();
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
