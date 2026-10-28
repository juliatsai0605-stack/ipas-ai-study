/* Original text lessons; audio narration removed at the user's request (2026-10-28). */
(() => {
  let data=null;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL=s=>{
    if(s==='legal-checks.html')return s;
    try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:'#';}catch{return '#';}
  };
  function stop(){}
  function html(code){
    const lesson=data?.lessons?.[code];if(!lesson)return '';
    const resources=lesson.sources.map(id=>{
      const s=data.sources[id];if(!s)return '';
      return `<div class="study-source"><a href="${escape(safeURL(s.textUrl))}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><p class="small muted">${escape(s.kind)} · ${escape(s.availability)}<br>${escape(s.readStatus)}</p>${s.videoUrl?`<p><a href="${escape(safeURL(s.videoUrl))}" target="_blank" rel="noopener noreferrer">延伸影片 ↗</a> <span class="small muted">${escape(s.videoNote)}</span></p><p class="small">${escape(s.transcriptStatus)}</p>`:''}</div>`;
    }).join('');
    return `<section class="card reading study-text" id="studyText"><h3>深入理解｜文字先讀</h3>${lesson.explain.map(p=>`<p>${escape(p)}</p>`).join('')}<p><b>換個情境：</b>${escape(lesson.example)}</p><p class="study-memory"><b>記憶一句話：</b>${escape(lesson.memory)}</p><div class="row">${lesson.practiceCount?'<button class="btn soft sm" id="studyPractice">練本單元官方題</button>':'<span class="small muted">目前無對應官方題</span>'}<button class="btn ghost sm" id="studyDownload">下載本節文字</button></div><p class="small muted">${escape(lesson.mediaPriority)}。本節有 ${lesson.practiceCount} 題配套官方題；下方單元測驗依學習紀錄選題。</p></section>
      <details class="card study-resources"><summary>原站文字教材與延伸影音（${lesson.sources.length}項）</summary><p class="small muted">有文字先看文字；影片僅延伸。沒有確認逐字稿的來源不冒稱已有逐字稿。</p>${resources}</details>`;
  }
  function bind(code){
    const lesson=data?.lessons?.[code];if(!lesson)return;
    const practice=document.getElementById('studyPractice');if(practice)practice.onclick=()=>{const box=document.getElementById('qbox');if(box)box.scrollIntoView({behavior:'smooth',block:'start'});};
    document.getElementById('studyDownload').onclick=()=>{
      const text=code+' '+lesson.title+'\n\n'+lesson.explain.join('\n\n')+'\n\n情境：'+lesson.example+'\n\n記憶：'+lesson.memory+'\n\n本站原創教學整理'+'\n\n來源\n'+lesson.sources.map(id=>{const s=data.sources[id];return s.title+'\n'+s.textUrl+(s.videoUrl?'\n影片：'+s.videoUrl:'');}).join('\n\n');
      const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=code+'-文字教材.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
