/* Original text lessons and device-only narration; no model or speech API service. */
(() => {
  let data=null, generation=0, utterance=null;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL=s=>{
    if(s==='legal-checks.html')return s;
    try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:'#';}catch{return '#';}
  };
  function stop(){generation++;utterance=null;if('speechSynthesis' in window){speechSynthesis.cancel();if(speechSynthesis.paused)speechSynthesis.resume();}}
  function localVoices(){return 'speechSynthesis' in window?speechSynthesis.getVoices().filter(v=>v.localService&&/^zh(?:-|_|$)/i.test(v.lang)):[];}
  function html(code){
    const lesson=data?.lessons?.[code];if(!lesson)return '';
    const resources=lesson.sources.map(id=>{
      const s=data.sources[id];if(!s)return '';
      return `<div class="study-source"><a href="${escape(safeURL(s.textUrl))}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><p class="small muted">${escape(s.kind)} · ${escape(s.availability)}<br>${escape(s.readStatus)}</p>${s.videoUrl?`<p><a href="${escape(safeURL(s.videoUrl))}" target="_blank" rel="noopener noreferrer">延伸影片 ↗</a> <span class="small muted">${escape(s.videoNote)}</span></p><p class="small">${escape(s.transcriptStatus)}</p>`:''}</div>`;
    }).join('');
    return `<section class="card reading study-text" id="studyText"><h3>深入理解｜文字先讀</h3>${lesson.explain.map(p=>`<p>${escape(p)}</p>`).join('')}<p><b>換個情境：</b>${escape(lesson.example)}</p><p class="study-memory"><b>記憶一句話：</b>${escape(lesson.memory)}</p><div class="row">${lesson.practiceCount?'<button class="btn soft sm" id="studyPractice">練本單元官方題</button>':'<span class="small muted">目前無對應官方題</span>'}<button class="btn ghost sm" id="studyDownload">下載本節文字與音稿</button></div><p class="small muted">${escape(lesson.mediaPriority)}。本節有 ${lesson.practiceCount} 題配套官方題；下方單元測驗依學習紀錄選題。</p></section>
      <section class="card study-audio" aria-label="通勤複習"><h3>通勤複習｜用講的加深記憶</h3><p class="small">朗讀本站原創導讀文字，不呼叫付費模型。僅使用裝置提供的本機中文語音；手機鎖屏續播依裝置支援，完整文字隨時可讀。</p><div class="row"><button class="btn sm" id="studySpeak">▶ 聽本節</button><button class="btn soft sm" id="studyPause" disabled>暫停</button><button class="btn soft sm" id="studyStop" disabled>停止</button><label class="small">速度 <select id="studyRate" aria-label="朗讀速度"><option value="0.9">0.9倍</option><option value="1" selected>1倍</option><option value="1.2">1.2倍</option></select></label></div><p class="small muted" id="studyAudioStatus" role="status">正在檢查本機中文語音…</p><details><summary>閱讀通勤導讀文字稿</summary>${lesson.dialogue.map(line=>`<p><b>${escape(line.role)}：</b>${escape(line.text)}</p>`).join('')}</details></section>
      <details class="card study-resources"><summary>原站文字教材與延伸影音（${lesson.sources.length}項）</summary><p class="small muted">有文字先看文字；影片僅延伸。沒有確認逐字稿的來源不冒稱已有逐字稿。</p>${resources}</details>`;
  }
  function bind(code){
    stop();const lesson=data?.lessons?.[code];if(!lesson)return;
    const status=document.getElementById('studyAudioStatus'),start=document.getElementById('studySpeak'),pause=document.getElementById('studyPause'),end=document.getElementById('studyStop');
    if(!start)return;
    let paused=false;
    const controls=playing=>{pause.disabled=end.disabled=!playing;start.disabled=playing||!localVoices().length;};
    const check=()=>{if(!status.isConnected)return;const voices=localVoices();if(!utterance){controls(false);status.textContent=voices.length?'本機中文語音已就緒。可先閱讀，再按「聽本節」複習。':'此瀏覽器沒有可用的本機中文語音；請閱讀或下載下方通勤文字稿。';}};
    check();if('speechSynthesis' in window)speechSynthesis.addEventListener('voiceschanged',check,{once:true});
    start.onclick=()=>{
      const voice=localVoices().find(v=>/^zh[-_]TW$/i.test(v.lang))||localVoices()[0];
      if(!voice){check();return;}
      stop();const active=generation;paused=false;pause.textContent='暫停';
      const rate=Number(document.getElementById('studyRate').value);
      const lines=lesson.dialogue.flatMap(x=>(x.role+'。'+x.text).match(/[^。！？]{1,120}[。！？]?/g)||[]);
      let index=0;
      const next=()=>{
        if(active!==generation||!status.isConnected)return;
        if(index>=lines.length){utterance=null;controls(false);status.textContent='本節導讀結束。請用自己的話回想重點，再做配套題。';return;}
        const u=new SpeechSynthesisUtterance(lines[index++]);utterance=u;u.voice=voice;u.lang=voice.lang;u.rate=rate;
        u.onend=next;u.onerror=e=>{if(active===generation){utterance=null;controls(false);status.textContent='朗讀未能完成（'+e.error+'）。文字稿仍可閱讀或下載。';}};
        controls(true);status.textContent='播放中 · '+index+'/'+lines.length+' 段';speechSynthesis.speak(u);
      };next();
    };
    pause.onclick=()=>{paused=!paused;paused?speechSynthesis.pause():speechSynthesis.resume();pause.textContent=paused?'繼續':'暫停';status.textContent=paused?'已暫停，可繼續或停止。':'播放中';};
    end.onclick=()=>{stop();paused=false;pause.textContent='暫停';controls(false);status.textContent='已停止。文字稿仍保留在下方。';};
    const practice=document.getElementById('studyPractice');if(practice)practice.onclick=()=>{const box=document.getElementById('qbox');if(box)box.scrollIntoView({behavior:'smooth',block:'start'});else status.textContent='本節尚無配套官方題，請先完成自我檢查。';};
    document.getElementById('studyDownload').onclick=()=>{
      const text=code+' '+lesson.title+'\n\n'+lesson.explain.join('\n\n')+'\n\n情境：'+lesson.example+'\n\n記憶：'+lesson.memory+'\n\n通勤文字稿（本站原創，非第三方逐字稿）\n'+lesson.dialogue.map(x=>x.role+'：'+x.text).join('\n\n')+'\n\n來源\n'+lesson.sources.map(id=>{const s=data.sources[id];return s.title+'\n'+s.textUrl+(s.videoUrl?'\n影片：'+s.videoUrl:'');}).join('\n\n');
      const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=code+'-文字與通勤稿.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  }
  function sourceHTML(id){
    const ref=data?.questionSources?.[id],exam=ref&&data.exams?.[ref.exam];
    if(!exam)return '';
    return `<a class="small" href="${escape(safeURL(exam.url))}#page=${Number(ref.page)}" target="_blank" rel="noopener noreferrer">官方原卷 · PDF第${Number(ref.page)}頁 ↗</a>`;
  }
  window.IPAS_STUDY={setData:d=>{data=d;},html,bind,stop,sourceHTML};
  window.addEventListener('pagehide',stop);
})();
