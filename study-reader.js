/* Original text lessons with pre-generated selected-voice MP3; no generation service at playback. */
(() => {
  let data=null, currentAudio=null;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL=s=>{
    if(s==='legal-checks.html')return s;
    try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:'#';}catch{return '#';}
  };
  function stop(){if(currentAudio){currentAudio.pause();try{currentAudio.currentTime=0;}catch{}currentAudio=null;}}
  const audioURL=lesson=>/^audio\/podcast-mf\/L[12]\d{4}\.mp3$/.test(lesson?.audio?.file||'')?lesson.audio.file:'';
  function html(code){
    const lesson=data?.lessons?.[code];if(!lesson)return '';
    const resources=lesson.sources.map(id=>{
      const s=data.sources[id];if(!s)return '';
      return `<div class="study-source"><a href="${escape(safeURL(s.textUrl))}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><p class="small muted">${escape(s.kind)} · ${escape(s.availability)}<br>${escape(s.readStatus)}</p>${s.videoUrl?`<p><a href="${escape(safeURL(s.videoUrl))}" target="_blank" rel="noopener noreferrer">延伸影片 ↗</a> <span class="small muted">${escape(s.videoNote)}</span></p><p class="small">${escape(s.transcriptStatus)}</p>`:''}</div>`;
    }).join('');
    return `<section class="card reading study-text" id="studyText"><h3>深入理解｜文字先讀</h3>${lesson.explain.map(p=>`<p>${escape(p)}</p>`).join('')}<p><b>換個情境：</b>${escape(lesson.example)}</p><p class="study-memory"><b>記憶一句話：</b>${escape(lesson.memory)}</p><div class="row">${lesson.practiceCount?'<button class="btn soft sm" id="studyPractice">練本單元官方題</button>':'<span class="small muted">目前無對應官方題</span>'}<button class="btn ghost sm" id="studyDownload">下載本節文字與音稿</button></div><p class="small muted">${escape(lesson.mediaPriority)}。本節有 ${lesson.practiceCount} 題配套官方題；下方單元測驗依學習紀錄選題。</p></section>
      <section class="card study-audio" aria-label="通勤複習"><h3>通勤對談｜女聲導讀與男聲學習者聊 AI</h3><p class="small">從日常疑問聊起，有追問、有反例。導讀是曉臻女聲，學習者是雲希男聲，均由AI聲音演繹，原創對談文字稿就在下方；也可下載後離線聽。</p><audio id="studyAudio" controls preload="none" src="${escape(audioURL(lesson))}" aria-label="${escape(lesson.title)}Podcast對談"></audio><div class="row"><button class="btn sm" id="studySpeak">▶ 聽本節</button><button class="btn soft sm" id="studyPause" disabled>暫停</button><button class="btn soft sm" id="studyStop">停止</button><label class="small">速度 <select id="studyRate" aria-label="播放速度"><option value="0.9">0.9倍</option><option value="1" selected>1倍</option><option value="1.2">1.2倍</option></select></label></div><p class="small muted" id="studyAudioStatus" role="status">對談已備妥，按播放開始。</p><p><a href="${escape(audioURL(lesson))}" download="${escape(code)}.mp3">下載本節MP3</a> · <a href="commute.html">通勤連播與整包下載</a></p><details><summary>閱讀通勤導讀文字稿</summary>${lesson.dialogue.map(line=>`<p><b>${escape(line.role)}：</b>${escape(line.text)}</p>`).join('')}</details></section>
      <details class="card study-resources"><summary>原站文字教材與延伸影音（${lesson.sources.length}項）</summary><p class="small muted">有文字先看文字；影片僅延伸。沒有確認逐字稿的來源不冒稱已有逐字稿。</p>${resources}</details>`;
  }
  function bind(code){
    stop();const lesson=data?.lessons?.[code];if(!lesson)return;
    const status=document.getElementById('studyAudioStatus'),start=document.getElementById('studySpeak'),pause=document.getElementById('studyPause'),audio=document.getElementById('studyAudio');
    if(audio){
      currentAudio=audio;
      const show=message=>{if(status?.isConnected)status.textContent=message;};
      const controls=()=>{if(start){start.disabled=!audio.paused;pause.disabled=audio.paused;pause.textContent='暫停';}};
      audio.onplay=()=>{controls();show('男女對談播放中');};
      audio.onpause=()=>{controls();if(audio.error){show('音檔暫時無法播放。可重試、下載MP3，或閱讀下方文字稿。');return;}show(audio.currentTime>0?'已暫停，可繼續或停止。':'已停止。文字稿仍保留在下方。');};
      audio.onended=()=>{controls();show('這段聊完了。也可以到通勤連播，接著聽下一段。');};
      audio.onerror=()=>{controls();show('音檔暫時無法播放。可重試、下載MP3，或閱讀下方文字稿。');};
      start.onclick=()=>{currentAudio=audio;audio.play().catch(()=>{if(currentAudio===audio)show('未能開始播放。請重試或下載MP3。');});};
      pause.onclick=()=>audio.pause();
      document.getElementById('studyStop').onclick=()=>{audio.pause();audio.currentTime=0;controls();show('已停止。文字稿仍保留在下方。');};
      document.getElementById('studyRate').onchange=e=>{audio.playbackRate=Number(e.target.value);};
    }
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
