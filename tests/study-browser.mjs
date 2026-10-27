import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.STUDY_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel(){throw new Error('Do not fall back to rejected device voice');}}}));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(()=>window.IPAS_BRIDGE.attachUser('isolated-study-test',{}));
  await page.locator('#studySearch').fill('L11102');await page.locator('#studySearch').press('Enter');
  await page.locator('#studyText').waitFor();assert.match(await page.locator('#studyText').innerText(),/治理先問/);
  const before=await page.evaluate(()=>JSON.stringify(window.IPAS_BRIDGE.snapshot()));
  const audio=page.locator('#studyAudio');assert.match(await audio.getAttribute('src'),/audio\/podcast\/L11102\.mp3$/);
  await page.locator('#studySpeak').click();await page.waitForFunction(()=>document.querySelector('#studyAudio').currentTime>0.15);
  assert.match(await page.locator('#studyAudioStatus').innerText(),/播放中/);
  await page.locator('#studyPause').click();assert.equal(await audio.evaluate(a=>a.paused),true);
  await page.locator('#studyStop').click();assert.equal(await audio.evaluate(a=>a.currentTime),0);
  await page.locator('#studySpeak').click();await page.waitForFunction(()=>document.querySelector('#studyAudio').currentTime>0.15);
  await page.locator('#studyRate').selectOption('1.2');assert.equal(await audio.evaluate(a=>a.playbackRate),1.2);
  await page.locator('#studyStop').click();
  const download=page.waitForEvent('download');await page.locator('#studyDownload').click();
  const file=await download;assert.equal(file.suggestedFilename(),'L11102-文字與通勤稿.txt');
  const stream=await file.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString('utf8');assert.match(text,/本站原創/);assert.match(text,/治理先問/);
  const mp3Event=page.waitForEvent('download');await page.locator('a[download="L11102.mp3"]').click();assert.equal((await mp3Event).suggestedFilename(),'L11102.mp3');
  await page.locator('.study-resources summary').click();assert.ok(await page.locator('.study-source a[href^="https://"]').count()>=3);assert.ok(await page.locator('.q .meta a[href*="#page="]').count()>0);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.IPAS_BRIDGE.snapshot())),before,'audio and downloads must not rewrite study records');
  await page.locator('#studyText').scrollIntoViewIfNeeded();await page.screenshot({path:'study-lesson-'+width+'.png',fullPage:false});
  await page.locator('#studySpeak').click();await page.waitForFunction(()=>!document.querySelector('#studyAudio').paused);
  const old=await audio.elementHandle();await page.locator('.tabs [data-v="units"]').click();assert.equal(await old.evaluate(a=>a.paused),true);assert.equal(await old.evaluate(a=>a.currentTime),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);
  await page.goto(new URL('commute.html',base).href,{waitUntil:'networkidle'});assert.equal(await page.locator('#list button').count(),50);
  await page.locator('#player').evaluate(a=>a.play());await page.waitForFunction(()=>document.querySelector('#player').currentTime>0.15);
  await page.locator('#next').click();assert.equal(await page.locator('#player').evaluate(a=>a.paused),true);
  await page.waitForFunction(()=>Number.isFinite(document.querySelector('#player').duration));
  await page.locator('#auto').check();await page.locator('#player').evaluate(a=>{a.currentTime=a.duration-0.1;return a.play();});
  await page.waitForFunction(()=>document.querySelector('#title').textContent.includes('L11201')&&!document.querySelector('#player').paused);
  await page.locator('#commuteStop').click();assert.equal(await page.locator('#player').evaluate(a=>a.currentTime),0);assert.equal(await page.locator('#player').evaluate(a=>a.paused),true);
  await page.locator('#player').evaluate(a=>a.play());await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));assert.equal(await page.locator('#player').evaluate(a=>a.paused),true);assert.equal(await page.locator('#player').evaluate(a=>a.currentTime),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  const packEvent=page.waitForEvent('download');await page.locator('a[href="commute-audio.zip"]').click();assert.equal((await packEvent).suggestedFilename(),'commute-audio.zip');
  await page.close();
 }
 const page=await browser.newPage();await page.route('**/audio/podcast/*.mp3',r=>r.fulfill({status:404,body:'Missing'}));
 await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>window.IPAS_BRIDGE.attachUser('missing-audio-test',{}));await page.locator('#studySearch').fill('L11101');await page.locator('#studySearch').press('Enter');
 await page.locator('#studySpeak').click();await page.waitForFunction(()=>/無法播放|未能開始/.test(document.querySelector('#studyAudioStatus').textContent));assert.ok(await page.locator('#studyDownload').isEnabled());assert.ok(await page.locator('#studyText').isVisible());
 await page.close();console.log('PASS selected MP3: actual playback without device voices, pause/stop/replay/speed, downloads, navigation stop, optional autoplay, missing-file fallback, desktop/mobile, unchanged study state');
}finally{await browser.close();}
