// No API keys or automatic uploads. Explicit copy/import shares only selected text.
export const TRACKS=['公務AI','iPAS初級','iPAS中級'];
export function validateQuestions(input){
  if(!Array.isArray(input)||!input.length||input.length>50)throw Error('每批須為1至50題的JSON陣列');
  const str=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
  const ids=new Set();
  return input.map(q=>{
    if(!q||!str(q.id,100)||ids.has(q.id))throw Error('題目ID不可空白或重複');ids.add(q.id);
    if(!str(q.topic,100)||!str(q.stem,5000)||!str(q.explanation,8000))throw Error('缺少主題、題幹或解析');
    if(!Array.isArray(q.tracks)||!q.tracks.length||q.tracks.some(t=>!TRACKS.includes(t)))throw Error('考試標籤不符');
    if(!Array.isArray(q.options)||q.options.length<2||q.options.length>6||q.options.some(x=>!str(x,1500)))throw Error('選項須為2至6個非空文字');
    if(!Array.isArray(q.answer)||!q.answer.length||new Set(q.answer).size!==q.answer.length||q.answer.some(x=>!Number.isInteger(x)||x<0||x>=q.options.length))throw Error('答案須為有效且不重複的選項索引（從0起算）');
    if(!Array.isArray(q.sources)||!q.sources.length||q.sources.length>10)throw Error('每題須附1至10筆來源');
    const sources=q.sources.map(x=>{let u;try{u=new URL(x.url);}catch{throw Error('來源網址無效');}
      if(u.protocol!=='https:'||!str(x.title,300)||!str(x.locator,500)||!str(x.version,100))throw Error('來源須有HTTPS網址、文件名稱、頁碼／章節及版本日期');
      return {title:x.title,url:u.href,locator:x.locator,version:x.version};});
    // Whitelist fields. Imported material can never mark itself verified.
    return {id:q.id,topic:q.topic,tracks:[...new Set(q.tracks)],stem:q.stem,options:q.options,answer:q.answer,explanation:q.explanation,sources,verified:false,updatedAt:Date.now()};
  });
}
export function buildPrompt(track,topic){return `你是我的公務AI與iPAS共用導師。使用臺灣繁體中文。這次範圍：${track}；主題：${topic||'依我提供的弱點挑選一個概念'}。
只使用我本次選取的官方教材、考綱及勘誤表；先列文件名稱、版本與涵蓋章節。未收到教材或無法核對時，先說缺少哪份，不可自行編造來源、考綱代碼或認證名稱。公務AI認證全名尚未確認時，僅標「公務AI應用練習」，不得稱已完整涵蓋考試。
一次教一個概念：先給生活或去識別化公務例子，再用一句話解釋原理，接著出1題。等待我作答才公布答案、逐項解析與錯誤原因；計算題須列公式、代入與單位。遇來源矛盾，列待核對並停止該題計分。
共用概念只教一次，分別標公務AI、iPAS初級／中級；不得因答對共用題就宣稱兩張認證都通過。中級程式題重視程式閱讀與輸出推理。不要讀取或要求私人案件、案號、個資或帳密，不發通知、不設行事曆。
需要帶回網站時，僅輸出JSON陣列，不加Markdown圍欄。每題格式：
[{"id":"唯一ID","topic":"概念","tracks":["${track==='共用概念'?'公務AI':track}"],"stem":"自編情境題（不可冒稱官方原題）","options":["選項A","選項B"],"answer":[0],"explanation":"正解理由、各錯誤選項理由與必要計算","sources":[{"title":"實際使用的官方文件名稱","url":"https://實際官方來源","locator":"頁碼或章節","version":"文件版本日期"}]}]
answer從0起算，複選列出所有索引。資料不足時不要輸出虛構題目。`;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bridge=()=>window.IPAS_BRIDGE;
const state=()=>bridge()?.snapshot()||{};
const host=document.querySelector('.top-in');
if(host){
const btn=document.createElement('button');btn.type='button';btn.className='iconbtn';btn.textContent='Gemini共學';btn.id='geminiStudyOpen';host.append(btn);
const d=document.createElement('dialog');d.id='geminiStudyDialog';d.style.cssText='width:min(94vw,760px);max-height:90vh;overflow:auto;border:1px solid #ccd6e8;border-radius:18px;padding:22px;color:#263451;background:#fff';
d.innerHTML=`<div class="row" style="justify-content:space-between"><h2>公務AI × iPAS 共學</h2><button class="iconbtn" id="gsClose" aria-label="關閉共學">✕</button></div>
<p>在這裡保留題目與練習紀錄。Gemini負責教學；官方教材與勘誤表是答案依據。本站不會自動讀取Google帳號或將資料送給Gemini。</p>
<p><a href="https://gemini.google.com/" target="_blank" rel="noopener">開啟Gemini</a> · <a href="https://notebooklm.google.com/" target="_blank" rel="noopener">開啟NotebookLM教材庫</a> · <a href="roadmap.html" target="_blank" rel="noopener">既有官方教材</a></p>
<label>練習範圍 <select id="gsTrack"><option>共用概念</option>${TRACKS.map(t=>`<option>${t}</option>`).join('')}</select></label>
<label style="display:block">主題 <input id="gsTopic" maxlength="100" placeholder="例如RAG、資料治理、統計或Python"></label>
<button class="btn" id="gsPrompt">產生導師指令</button><textarea id="gsPromptText" aria-label="導師指令" readonly style="width:100%;min-height:150px;margin:12px 0"></textarea><button class="btn soft" id="gsCopy">複製指令</button>
<details style="margin:18px 0"><summary>帶回Gemini產生的題目</summary><p>貼入JSON後按匯入。每題附來源，核對後再開始練習；自編題與官方模擬考分開計分。</p><textarea id="gsImport" aria-label="題目JSON" style="width:100%;min-height:120px" maxlength="1000000"></textarea><button class="btn" id="gsImportBtn">匯入共用題庫</button></details>
<p id="gsMessage" role="status" aria-live="polite"></p><div id="gsList"></div>`;
document.body.append(d);const $=id=>d.querySelector('#'+id);const message=t=>$('gsMessage').textContent=t;
const requireAuth=()=>{if(bridge()?.isAuthenticated())return true;message('請先在原網站登入，再使用個人題庫。');return false;};
btn.onclick=()=>{d.showModal();draw();};$('gsClose').onclick=()=>d.close();
$('gsPrompt').onclick=()=>{$('gsPromptText').value=buildPrompt($('gsTrack').value,$('gsTopic').value);};
$('gsCopy').onclick=async()=>{try{if(!$('gsPromptText').value)$('gsPrompt').click();await navigator.clipboard.writeText($('gsPromptText').value);message('已複製，請貼到Gemini的Gem指令或本次對話。');}catch{message('請選取上方指令後複製。');}};
$('gsTrack').onchange=draw;
$('gsImportBtn').onclick=()=>{if(!requireAuth())return;try{const raw=$('gsImport').value;if(raw.length>1000000)throw Error('資料過大，請分批');const added=validateQuestions(JSON.parse(raw));const existing=state().studyQuestions||[];const ids=new Set(existing.map(q=>q.id));const fresh=added.filter(q=>!ids.has(q.id));if(existing.length+fresh.length>500)throw Error('共用題庫上限500題，請保留小批重點題');bridge().saveStudyQuestions([...existing,...fresh]);$('gsImport').value='';message(`已匯入${fresh.length}題，略過${added.length-fresh.length}筆重複ID；新題待來源核對。`);draw();}catch(e){message('未匯入：'+e.message);}};
function draw(){
 const area=$('gsList');area.replaceChildren();if(!bridge()?.isAuthenticated()){area.textContent='登入後可讀取私人題庫及跨裝置保存的練習紀錄。';return;}
 const s=state(),track=$('gsTrack').value;const qs=(s.studyQuestions||[]).filter(q=>track==='共用概念'||q.tracks.includes(track));
 const allAttempts=s.studyAttempts||[];const p=document.createElement('p');p.textContent=`本範圍${qs.length}題｜練習紀錄${allAttempts.filter(a=>qs.some(q=>q.id===a.questionId)).length}次；不是認證通過率。`;area.append(p);
 for(const q of qs){
  const attempts=allAttempts.filter(a=>a.questionId===q.id).sort((a,b)=>b.updatedAt-a.updatedAt);const last=attempts[0];
  const card=document.createElement('section');card.style.cssText='border:1px solid #ccd6e8;padding:16px;border-radius:12px;margin:12px 0';
  card.innerHTML=`<h3>${esc(q.topic)} <small>自編題 · ${esc(q.tracks.join('／'))}</small></h3><p>${esc(q.stem)}</p><div class="gsOptions">${q.options.map((o,i)=>`<label style="display:block"><input type="checkbox" value="${i}"> ${esc(o)}</label>`).join('')}</div><p class="gsLast">${last?esc((last.correct?'上次答對':'上次答錯')+'；'+new Date(last.updatedAt).toLocaleDateString('zh-TW')+(last.reason?'；原因：'+last.reason:'')):'尚未作答'}</p><details><summary>核對出題來源</summary>${q.sources.map(x=>`<p><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a> · ${esc(x.locator)} · ${esc(x.version)}</p>`).join('')}<p>網址與引文須逐筆比對，格式合格不等於內容正確。公務AI全名與考綱未核對前，僅作應用練習。</p></details><label><input class="gsVerified" type="checkbox" ${q.verified?'checked':''}> 我已核對來源及答案</label><div><button class="btn gsAnswer">作答並看解析</button></div><div class="gsResult" role="status"></div>`;
  const verified=card.querySelector('.gsVerified'),answer=card.querySelector('.gsAnswer');answer.disabled=!q.verified;
  verified.onchange=()=>{if(!requireAuth())return;const rows=state().studyQuestions||[];bridge().saveStudyQuestions(rows.map(x=>x.id===q.id?{...x,verified:verified.checked,updatedAt:Date.now()}:x));answer.disabled=!verified.checked;};
  answer.onclick=()=>{if(!requireAuth())return;const chosen=[...card.querySelectorAll('.gsOptions input:checked')].map(x=>Number(x.value));if(!chosen.length){message('請先選答案。');return;}
   const correct=chosen.length===q.answer.length&&chosen.every(x=>q.answer.includes(x));const r=card.querySelector('.gsResult');r.replaceChildren();const p=document.createElement('p');p.textContent=(correct?'答對。':'這題需要訂正。')+' 正解：'+q.answer.map(i=>String.fromCharCode(65+i)).join('、')+'。'+q.explanation;r.append(p);
   const row={id:crypto.randomUUID(),questionId:q.id,correct,chosen,updatedAt:Date.now(),reason:''};bridge().addStudyAttempt(row);
   card.querySelector('.gsLast').textContent='本次'+(correct?'答對':'答錯')+'；紀錄已儲存，雲端同步狀態請看原網站。';
   if(!correct){const note=document.createElement('input');note.placeholder='錯誤原因（選填）';note.maxLength=300;const save=document.createElement('button');save.className='btn soft';save.textContent='保存訂正原因';save.onclick=()=>{if(!requireAuth())return;bridge().addStudyAttempt({...row,reason:note.value,updatedAt:Date.now()});save.disabled=true;message('訂正原因已保存。');};r.append(note,save);}
  };area.append(card);
 }
}
document.addEventListener('ipas:identity-changing',()=>{d.close();$('gsImport').value='';$('gsList').replaceChildren();message('');});
document.addEventListener('ipas:save',()=>{if(d.open&&!bridge()?.isAuthenticated())draw();});
}
