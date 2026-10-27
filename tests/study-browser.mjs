import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__speechTest={spoken:[],cancelled:0};
   Object.defineProperty(window,'speechSynthesis',{value:{
    getVoices:()=>[{name:'Local test voice',lang:'zh-TW',localService:true}],
    addEventListener(){},cancel(){window.__speechTest.cancelled++;},
    speak(u){window.__speechTest.spoken.push(u.text);},pause(){},resume(){}
   }});
   window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  });
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.evaluate(()=>window.IPAS_BRIDGE.attachUser('isolated-study-test',{}));
  await page.locator('#studySearch').fill('L11102');await page.locator('#studySearch').press('Enter');
  await page.locator('#studyText').waitFor();
  assert.match(await page.locator('#studyText').innerText(),/治理先問/);
  const before=await page.evaluate(()=>JSON.stringify(window.IPAS_BRIDGE.snapshot()));
  await page.locator('#studySpeak').click();
  assert.match(await page.locator('#studyAudioStatus').innerText(),/播放中/);
  await page.locator('#studyPause').click();assert.match(await page.locator('#studyAudioStatus').innerText(),/已暫停/);
  await page.locator('#studyPause').click();await page.locator('#studyStop').click();
  assert.match(await page.locator('#studyAudioStatus').innerText(),/已停止/);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.IPAS_BRIDGE.snapshot())),before,'narration must not rewrite study records');
  const download=page.waitForEvent('download');await page.locator('#studyDownload').click();
  const file=await download;assert.equal(file.suggestedFilename(),'L11102-文字與通勤稿.txt');
  const stream=await file.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString('utf8');
  assert.match(text,/本站原創/);assert.match(text,/治理先問/);
  await page.locator('.study-resources summary').click();
  assert.ok(await page.locator('.study-source a[href^="https://"]').count()>=3);
  assert.ok(await page.locator('.q .meta a[href*="#page="]').count()>0,'questions must link to official original page');
  await page.locator('#studySpeak').click();const cancelled=await page.evaluate(()=>window.__speechTest.cancelled);
  await page.locator('.tabs [data-v="units"]').click();assert.ok(await page.evaluate(()=>window.__speechTest.cancelled)>cancelled,'navigation stops old lesson narration');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.screenshot({path:'study-'+width+'.png',fullPage:false});
  assert.deepEqual(errors,[]);await page.close();
 }
 // No device voice: text remains useful, no fallback to an unapproved cloud voice.
 const page=await browser.newPage();await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel(){},addEventListener(){}}}));
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await page.evaluate(()=>window.IPAS_BRIDGE.attachUser('no-voice-test',{}));
 await page.locator('#studySearch').fill('L11101');await page.locator('#studySearch').press('Enter');
 assert.ok(await page.locator('#studySpeak').isDisabled());assert.match(await page.locator('#studyAudioStatus').innerText(),/沒有可用的本機中文語音/);
 await page.close();console.log('PASS text study: desktop/mobile text, sources, download, narration controls, no-voice fallback and state preservation (speech simulated)');
}finally{await browser.close();}
