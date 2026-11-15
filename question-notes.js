// Per-question personal notes (text / Markdown / compressed images).
// Notes live in the study state (S.qnotes) so they follow the existing private, RLS-protected
// Supabase sync after login, plus local JSON export/import. Nothing is sent to any other service.
// Notes are rendered only inside the explanation block (expHTML), which never appears during a mock exam.
(function(){
  const MAX_TEXT=50000,MAX_IMGS=3,MAX_DIM=1200,JPEG_Q=0.75,SOFT_TOTAL=6*1024*1024;
  const IMG_RE=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const B=()=>window.IPAS_BRIDGE;
  const get=id=>{const n=B()?.getNote(id);return n&&!n.deleted&&(n.text||(n.imgs||[]).length)?n:null;};
  const drafts={};
  const timers={};

  // ---- minimal, escape-first Markdown renderer (no raw HTML allowed) ----
  function inline(s){
    const codes=[];
    s=s.replace(/`([^`\n]+)`/g,(_,c)=>{codes.push(c);return "\u0000"+(codes.length-1)+"\u0000";});
    s=esc(s)
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,t,u)=>`<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)
      .replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_\n]+)__/g,"<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g,"$1<em>$2</em>").replace(/~~([^~\n]+)~~/g,"<del>$1</del>");
    return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>`<code>${esc(codes[+i])}</code>`);
  }
  function md(src){
    const lines=String(src||"").replace(/\r\n?/g,"\n").split("\n");
    let out="",i=0;
    const isTableSep=l=>/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
    const cells=l=>l.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(c=>inline(c.trim()));
    while(i<lines.length){
      const l=lines[i];
      if(/^\s*```/.test(l)){let code=[];i++;while(i<lines.length&&!/^\s*```/.test(lines[i]))code.push(lines[i++]);i++;out+=`<pre><code>${esc(code.join("\n"))}</code></pre>`;continue;}
      if(/^\s*$/.test(l)){i++;continue;}
      let m;
      if((m=l.match(/^\s*(#{1,6})\s+(.*)$/))){const lv=Math.min(6,m[1].length+3);out+=`<h${lv}>${inline(m[2])}</h${lv}>`;i++;continue;}
      if(/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(l)){out+="<hr>";i++;continue;}
      if(l.includes("|")&&i+1<lines.length&&isTableSep(lines[i+1])){
        const head=cells(l);i+=2;let body="";
        while(i<lines.length&&lines[i].includes("|")&&!/^\s*$/.test(lines[i])){body+="<tr>"+cells(lines[i]).map(c=>`<td>${c}</td>`).join("")+"</tr>";i++;}
        out+=`<div class="qnote-tbl"><table><thead><tr>${head.map(c=>`<th>${c}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;continue;
      }
      if(/^\s*>/.test(l)){let q=[];while(i<lines.length&&/^\s*>/.test(lines[i]))q.push(lines[i++].replace(/^\s*>\s?/,""));out+=`<blockquote>${md(q.join("\n"))}</blockquote>`;continue;}
      if(/^\s*([-*+]|\d+[.)])\s+/.test(l)){
        const ordered=/^\s*\d+[.)]\s+/.test(l),tag=ordered?"ol":"ul";let items=[];
        while(i<lines.length&&(/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])||(/^\s{2,}\S/.test(lines[i])&&items.length))){
          const x=lines[i];
          if(/^\s{2,}([-*+]|\d+[.)])\s+/.test(x)&&items.length)items[items.length-1]+=`<br>‧ ${inline(x.replace(/^\s*([-*+]|\d+[.)])\s+/,""))}`;
          else if(/^\s*([-*+]|\d+[.)])\s+/.test(x))items.push(inline(x.replace(/^\s*([-*+]|\d+[.)])\s+/,"")));
          else items[items.length-1]+="<br>"+inline(x.trim());
          i++;
        }
        out+=`<${tag}>${items.map(t=>`<li>${t}</li>`).join("")}</${tag}>`;continue;
      }
      let p=[];
      while(i<lines.length&&!/^\s*$/.test(lines[i])&&!/^\s*(#{1,6}\s|```|>|([-*+]|\d+[.)])\s+)/.test(lines[i])&&!(lines[i].includes("|")&&i+1<lines.length&&isTableSep(lines[i+1])))p.push(inline(lines[i++]));
      out+=`<p>${p.join("<br>")}</p>`;
    }
    return out;
  }

  function viewHTML(n){
    const imgs=(n.imgs||[]).filter(u=>IMG_RE.test(u)).map((u,k)=>`<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="註解圖片 ${k+1}" loading="lazy"></a>`).join("");
    const when=n.updatedAt?new Date(n.updatedAt).toLocaleString("zh-TW",{hour12:false}):"";
    return `<div class="qnote-md">${md(n.text)}</div>${imgs?`<div class="qnote-imgs">${imgs}</div>`:""}<div class="qnote-foot"><span class="small muted">最後編輯 ${esc(when)}</span><span class="row"><button type="button" class="btn soft sm" data-qnote-act="edit">編輯</button><button type="button" class="btn ghost sm" data-qnote-act="del">刪除</button></span></div>`;
  }
  function editHTML(id){
    const d=drafts[id];
    const thumbs=d.imgs.map((u,k)=>`<span class="qnote-thumb"><img src="${u}" alt="待存圖片 ${k+1}"><button type="button" aria-label="移除圖片 ${k+1}" data-qnote-rmimg="${k}">✕</button></span>`).join("");
    return `<label class="small muted" for="qn-${esc(id)}">可直接貼上 Gemini／其他 AI 的解釋（支援 Markdown：# 標題、**粗體**、- 清單、表格）；也可貼上截圖（Ctrl+V）。邊打字邊自動儲存。</label>
    <textarea id="qn-${esc(id)}" class="qnote-text" maxlength="${MAX_TEXT}" placeholder="在這裡貼上或輸入你的註解…">${esc(d.text)}</textarea>
    <div class="qnote-imgrow">${thumbs}${d.imgs.length<MAX_IMGS?`<label class="btn soft sm qnote-addimg">＋ 加入圖片<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-qnote-file></label>`:""}<span class="small muted">最多 ${MAX_IMGS} 張，自動壓縮</span></div>
    <div class="qnote-status small muted" aria-live="polite"></div>
    <details class="qnote-prev" open><summary class="small">預覽</summary><div class="qnote-md">${md(d.text)}</div></details>
    <div class="row"><button type="button" class="btn sm" data-qnote-act="done">完成</button><button type="button" class="btn ghost sm" data-qnote-act="cancel">${get(id)?"關閉":"取消"}</button></div>`;
  }
  function html(id){
    const n=get(id);
    const label=n?`<span aria-hidden="true">📝</span> 我的註解<span class="qnote-badge">有註解</span>`:`＋ 新增註解`;
    return `<div class="qnote${n?" has":""}" data-qnote="${esc(id)}"><button type="button" class="qnote-toggle" aria-expanded="false" data-qnote-act="toggle">${label}</button><div class="qnote-panel" hidden></div></div>`;
  }

  function persist(id,box){
    const d=drafts[id];if(!d)return;
    const text=String(d.text||"").slice(0,MAX_TEXT),imgs=d.imgs.filter(u=>IMG_RE.test(u)).slice(0,MAX_IMGS);
    const note=text.trim()||imgs.length?{text,imgs,updatedAt:Date.now()}:{text:"",imgs:[],deleted:true,updatedAt:Date.now()};
    try{B().setNote(id,note);if(box)status(box,"已自動儲存 "+new Date().toLocaleTimeString("zh-TW",{hour12:false}));}
    catch(e){if(box)status(box,"儲存失敗："+e.message);}
  }
  const status=(box,t)=>{const s=box.querySelector(".qnote-status");if(s)s.textContent=t;};
  function refreshHead(box,id){
    const n=get(id),t=box.querySelector(".qnote-toggle");box.classList.toggle("has",!!n);
    t.innerHTML=n?`<span aria-hidden="true">📝</span> 我的註解<span class="qnote-badge">有註解</span>`:`＋ 新增註解`;
  }
  function openView(box,id){const p=box.querySelector(".qnote-panel"),n=get(id);if(!n)return openEdit(box,id);p.innerHTML=viewHTML(n);p.hidden=false;box.querySelector(".qnote-toggle").setAttribute("aria-expanded","true");}
  function openEdit(box,id){
    const n=get(id);drafts[id]={text:n?.text||"",imgs:[...(n?.imgs||[])]};
    const p=box.querySelector(".qnote-panel");p.innerHTML=editHTML(id);p.hidden=false;box.querySelector(".qnote-toggle").setAttribute("aria-expanded","true");
    const ta=p.querySelector("textarea");ta.focus();
  }
  function close(box,id){delete drafts[id];const p=box.querySelector(".qnote-panel");p.hidden=true;p.innerHTML="";box.querySelector(".qnote-toggle").setAttribute("aria-expanded","false");refreshHead(box,id);}
  function rerenderEdit(box,id){const p=box.querySelector(".qnote-panel"),pos=p.querySelector("textarea")?.selectionStart;p.innerHTML=editHTML(id);const ta=p.querySelector("textarea");ta.focus();if(pos!=null)ta.setSelectionRange(pos,pos);}

  function totalSize(){try{return JSON.stringify(B()?.allNotes()||{}).length;}catch(e){return 0;}}
  function compress(file){
    return new Promise((resolve,reject)=>{
      if(!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type))return reject(Error("只支援 PNG／JPEG／WebP 圖片"));
      if(file.size>15*1024*1024)return reject(Error("圖片超過 15 MB"));
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{try{const r=Math.min(1,MAX_DIM/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.naturalWidth*r));c.height=Math.max(1,Math.round(img.naturalHeight*r));const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL("image/jpeg",JPEG_Q));}catch(e){reject(e);}};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("無法讀取這張圖片"));};img.src=url;
    });
  }
  async function addImages(box,id,files){
    const d=drafts[id];if(!d)return;
    for(const f of files){
      if(d.imgs.length>=MAX_IMGS){status(box,`每則註解最多 ${MAX_IMGS} 張圖片`);break;}
      if(totalSize()>SOFT_TOTAL){status(box,"註解圖片總量已接近免費同步容量上限，請先刪除部分圖片");break;}
      try{status(box,"壓縮圖片中…");d.imgs.push(await compress(f));}catch(e){status(box,e.message);return;}
    }
    persist(id,null);rerenderEdit(box,id);status(box,"圖片已加入並自動儲存");
  }

  // ---- event delegation (works for any rendered question) ----
  document.addEventListener("click",e=>{
    const rm=e.target.closest("[data-qnote-rmimg]");const act=e.target.closest("[data-qnote-act]");
    const box=e.target.closest(".qnote");if(!box||(!rm&&!act))return;
    const id=box.dataset.qnote;
    if(rm){drafts[id]?.imgs.splice(+rm.dataset.qnoteRmimg,1);persist(id,null);rerenderEdit(box,id);status(box,"已移除圖片");return;}
    const a=act.dataset.qnoteAct;
    if(a==="toggle"){const p=box.querySelector(".qnote-panel");if(!p.hidden&&!drafts[id])close(box,id);else if(!p.hidden&&drafts[id]){persist(id,null);close(box,id);}else openView(box,id);}
    else if(a==="edit")openEdit(box,id);
    else if(a==="done"){persist(id,null);delete drafts[id];if(get(id))openView(box,id);else close(box,id);refreshHead(box,id);}
    else if(a==="cancel"){if(drafts[id])persist(id,null);if(get(id)){delete drafts[id];openView(box,id);refreshHead(box,id);}else close(box,id);}
    else if(a==="del"){if(!confirm("確定刪除這題的註解？"))return;drafts[id]={text:"",imgs:[]};persist(id,null);close(box,id);}
  });
  document.addEventListener("input",e=>{
    const ta=e.target.closest(".qnote-text");if(!ta)return;const box=ta.closest(".qnote"),id=box.dataset.qnote;if(!drafts[id])return;
    drafts[id].text=ta.value;const pv=box.querySelector(".qnote-prev .qnote-md");if(pv)pv.innerHTML=md(ta.value);
    status(box,"編輯中…");clearTimeout(timers[id]);timers[id]=setTimeout(()=>persist(id,box),600);
  });
  document.addEventListener("change",e=>{
    const f=e.target.closest("[data-qnote-file]");if(!f)return;const box=f.closest(".qnote");addImages(box,box.dataset.qnote,[...(f.files||[])]);
  });
  document.addEventListener("paste",e=>{
    const ta=e.target.closest?.(".qnote-text");if(!ta)return;
    const files=[...(e.clipboardData?.items||[])].filter(x=>x.kind==="file"&&x.type.startsWith("image/")).map(x=>x.getAsFile()).filter(Boolean);
    if(!files.length)return;e.preventDefault();const box=ta.closest(".qnote");addImages(box,box.dataset.qnote,files);
  });
  // Flush pending typing before identity changes or leaving the page.
  const flush=()=>{for(const id of Object.keys(timers)){clearTimeout(timers[id]);delete timers[id];if(drafts[id])persist(id,null);}};
  addEventListener("pagehide",flush);document.addEventListener("ipas:identity-changing",()=>{flush();for(const k of Object.keys(drafts))delete drafts[k];});

  // ---- export / import / merge ----
  function valid(n){return n&&typeof n==="object"&&typeof (n.text??"")==="string"&&Number.isFinite(Number(n.updatedAt));}
  function clean(n){return n.deleted?{text:"",imgs:[],deleted:true,updatedAt:Number(n.updatedAt)}:{text:String(n.text||"").slice(0,MAX_TEXT),imgs:(Array.isArray(n.imgs)?n.imgs:[]).filter(u=>typeof u==="string"&&IMG_RE.test(u)).slice(0,MAX_IMGS),updatedAt:Number(n.updatedAt)};}
  function merge(local,incoming){
    const out={...(local||{})};let added=0,updated=0,skipped=0;
    for(const [id,n] of Object.entries(incoming||{})){
      if(!valid(n)){skipped++;continue;}const c=clean(n),old=out[id];
      if(!old){out[id]=c;if(!c.deleted)added++;}else if(c.updatedAt>Number(old.updatedAt||0)){out[id]=c;updated++;}else skipped++;
    }
    return {notes:out,added,updated,skipped};
  }
  function exportJSON(){
    const all=B().allNotes(),notes={},questions={};
    for(const [id,n] of Object.entries(all)){if(n.deleted)continue;notes[id]=n;const q=B().question?.(id);if(q)questions[id]={exam:q.x,no:q.n,subject:q.sub,stem:String(q.q||"").slice(0,60)};}
    return {type:"ipas-question-notes",version:1,exportedAt:new Date().toISOString(),count:Object.keys(notes).length,questions,notes};
  }
  function importJSON(obj){
    const incoming=obj?.type==="ipas-question-notes"?obj.notes:(obj&&typeof obj.qnotes==="object"?obj.qnotes:null);
    if(!incoming||typeof incoming!=="object")throw Error("不是題目註解備份檔");
    const r=merge(B().allNotes(),incoming);B().replaceNotes(r.notes);return r;
  }
  function list(){return Object.entries(B()?.allNotes()||{}).filter(([,n])=>!n.deleted&&(n.text||(n.imgs||[]).length)).sort((a,b)=>b[1].updatedAt-a[1].updatedAt);}
  function manageHTML(){
    const rows=list();
    const items=rows.slice(0,50).map(([id,n])=>{const q=B().question?.(id);const head=q?`${esc(q.sub)}・${esc(String(q.x))} 第 ${q.n} 題`:esc(id);const first=esc(String(n.text||"").split("\n").find(x=>x.trim())||"（圖片）").slice(0,80);return `<li><b>${head}</b>${(n.imgs||[]).length?` <span class="small muted">🖼${n.imgs.length}</span>`:""}<br><span class="small muted">${first}</span></li>`;}).join("");
    return `<div class="card" id="qnoteManage"><h3>📝 我的題目註解（${rows.length} 題）</h3><p class="small muted">作答或交卷看解析時，可在每題解析下方新增註解；考試作答中不會顯示。登入後與進度一起同步到你的私人帳號，並可匯出 JSON 備份、到其他裝置匯入（同一題以較新的版本為準）。</p>
    ${rows.length?`<details><summary class="small">查看最近編輯的註解</summary><ul class="qnote-list">${items}</ul></details>`:""}
    <div class="row" style="margin-top:10px"><button class="btn" type="button" id="qnoteExport" ${rows.length?"":"disabled"}>匯出註解 JSON</button><label class="btn soft" for="qnoteImport" style="cursor:pointer">匯入註解 JSON</label><input type="file" id="qnoteImport" accept="application/json,.json" hidden></div><p class="small muted" id="qnoteMsg" aria-live="polite"></p></div>`;
  }
  document.addEventListener("click",e=>{
    if(!e.target.closest("#qnoteExport"))return;
    const data=exportJSON(),blob=new Blob([JSON.stringify(data,null,1)],{type:"application/json"}),a=document.createElement("a");
    const d=new Date(),p=x=>String(x).padStart(2,"0");
    a.href=URL.createObjectURL(blob);a.download=`ipas-question-notes-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}.json`;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
    const m=document.getElementById("qnoteMsg");if(m)m.textContent=`已匯出 ${data.count} 題註解。`;
  });
  document.addEventListener("change",e=>{
    const inp=e.target.closest("#qnoteImport");if(!inp)return;const f=inp.files?.[0];if(!f)return;const m=document.getElementById("qnoteMsg");
    const r=new FileReader();r.onload=()=>{try{const res=importJSON(JSON.parse(r.result));const box=document.getElementById("qnoteManage");if(box){box.outerHTML=manageHTML();}const m2=document.getElementById("qnoteMsg");if(m2)m2.textContent=`匯入完成：新增 ${res.added}、更新 ${res.updated}、略過 ${res.skipped}（較舊或重複）。`;}catch(err){if(m)m.textContent="匯入失敗："+err.message;}inp.value="";};r.readAsText(f);
  });

  window.IPAS_NOTES={html,has:id=>!!get(id),md,merge:(a,b)=>merge(a,b).notes,manageHTML,exportJSON,importJSON};
})();
