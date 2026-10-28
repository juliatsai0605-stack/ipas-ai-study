import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.STUDY_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(()=>window.IPAS_BRIDGE.attachUser('isolated-study-test',{}));
  await page.locator('#studySearch').fill('L11102');await page.locator('#studySearch').press('Enter');
  await page.locator('#studyText').waitFor();assert.match(await page.locator('#studyText').innerText(),/治理先問/);
  const before=await page.evaluate(()=>JSON.stringify(window.IPAS_BRIDGE.snapshot()));
  assert.equal(await page.locator('audio').count(),0,'audio narration was removed');
  const download=page.waitForEvent('download');await page.locator('#studyDownload').click();
  const file=await download;
  const stream=await file.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString('utf8');assert.match(text,/本站原創/);assert.match(text,/治理先問/);
  await page.locator('.study-resources summary').click();assert.ok(await page.locator('.study-source a[href^="https://"]').count()>=3);assert.ok(await page.locator('.q .meta a[href*="#page="]').count()>0);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.IPAS_BRIDGE.snapshot())),before,'reading and downloads must not rewrite study records');
  await page.locator('#studyText').scrollIntoViewIfNeeded();await page.screenshot({path:'study-lesson-'+width+'.png',fullPage:false});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);
  await page.goto(new URL('roadmap.html',base).href,{waitUntil:'networkidle'});
  assert.ok(await page.locator('#sources a[href^="https://www.ipas.org.tw/"]').count()>=20);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.close();
 }
 console.log('PASS text lessons: no audio, text download, sources, roadmap page, desktop/mobile, unchanged study state');
}finally{await browser.close();}
