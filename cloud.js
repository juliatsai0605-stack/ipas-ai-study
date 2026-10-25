// Optional cloud service. Without configured Supabase envs, the site remains fully usable locally.
// Public publishable/anon key only. Authorization is enforced by Supabase RLS and private storage.
const host=document.createElement("div");
host.className="cloud-account-host";
document.querySelector(".top-in")?.appendChild(host);
host.style.cssText="display:flex;align-items:center;gap:8px";
const notice=document.createElement("span");
notice.style.cssText="font-size:.75rem;color:#60708c;white-space:nowrap";
notice.textContent="本機進度";
host.appendChild(notice);
let cfg;
try{const response=await fetch("/api/cloud-config",{cache:"no-store"});cfg=response.ok?await response.json():null;}catch(e){cfg=null;}
if(cfg?.configured&&cfg.url&&cfg.publishableKey){
  try{
    const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2.57.0");
    const supabase=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    let user=null,syncTimer=null,busy=false,queued=false,filesBusy=false;
    const button=document.createElement("button");
    button.className="iconbtn";
    button.textContent="登入／雲端續學";
    host.appendChild(button);
    notice.textContent="雲端登入可用";
    const dialog=document.createElement("dialog");dialog.className="cloud-dialog";
    dialog.style.cssText="border:1px solid #cad5f3;border-radius:18px;padding:24px;max-width:min(92vw,550px);width:100%;box-shadow:0 20px 70px #29345b40;color:#263154;background:#fff";
    dialog.innerHTML=`<form id="cloudAuthForm"><div class="row" style="justify-content:space-between"><h2>✦ 個人學習帳號</h2><button type="button" class="iconbtn" id="cloudClose" aria-label="關閉">✕</button></div>
    <p class="small muted">完全免費。使用電子郵件與密碼登入，讓不同裝置接續學習。請勿使用公務帳號或上傳機敏資料。</p>
    <div id="cloudAnonymous"><label class="study-field">電子郵件<input type="email" id="cloudEmail" autocomplete="email" required></label>
    <label class="study-field">密碼（至少 8 字）<input id="cloudPassword" type="password" minlength="8" autocomplete="current-password" required></label>
    <div class="row"><button class="btn" id="cloudSignIn" type="submit">登入</button><button class="btn soft" type="button" id="cloudSignUp">免費註冊</button></div></div>
    <div id="cloudSignedIn" hidden><p>已登入：<strong id="cloudUserName"></strong></p><p class="small muted">學習進度將保存於你的帳號。附件只允許本人讀取，單檔不得超過 10 MB。</p>
    <label class="study-field">顯示名稱<input id="cloudDisplayName" maxlength="35" placeholder="你的名稱"></label>
    <div class="row"><button type="button" class="btn soft" id="cloudSaveName">儲存名稱</button><button type="button" class="btn ghost" id="cloudSyncNow">立即同步</button><button type="button" class="btn ghost" id="cloudSignOut">登出</button></div>
    <h3 style="margin-top:20px">私人雲端附件庫</h3><p class="small muted">限 PDF、Word、文字及 PNG/JPG 圖片，最多列出 100 份。</p>
    <label class="study-field">選擇檔案<input id="cloudUpload" type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"></label>
    <div class="row"><button type="button" class="btn" id="cloudUploadBtn">上傳私人檔案</button><button type="button" class="btn soft" id="cloudRefreshFiles">重新整理清單</button></div>
    <div id="cloudFiles" style="margin-top:12px;display:grid;gap:8px"></div></div><p class="note" id="cloudMessage" role="status" aria-live="polite" style="margin-top:12px"></p></form>`;
    document.body.appendChild(dialog);
    const q=id=>dialog.querySelector("#"+id);
    const msg=(s)=>{q("cloudMessage").textContent=String(s||"");};
    button.onclick=()=>{if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");if(user)refreshFiles();};
    q("cloudClose").onclick=()=>dialog.close();
    dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
    function present(){
      q("cloudAnonymous").hidden=!!user;
      q("cloudSignedIn").hidden=!user;
      if(user){button.textContent="☁ 我的帳號";notice.textContent="雲端同步已啟用";q("cloudUserName").textContent=user.email||"已登入帳號";q("cloudDisplayName").value=window.IPAS_BRIDGE?.snapshot().localName||"";}
      else{button.textContent="登入／雲端續學";notice.textContent="本機進度（未登入）";}
    }
    async function push(){
      if(!user||!window.IPAS_BRIDGE)return;
      if(busy){queued=true;return;}
      busy=true;
      try{const state=window.IPAS_BRIDGE.snapshot();
        const {error}=await supabase.from("study_profiles").upsert({user_id:user.id,display_name:state.localName||"",state,updated_at:new Date().toISOString()},{onConflict:"user_id"});
        if(error)throw error;notice.textContent="✓ 雲端已同步";msg("學習進度已安全同步");
      }catch(e){notice.textContent="同步失敗（仍保留本機資料）";msg("同步失敗："+e.message);}
      finally{busy=false;if(queued){queued=false;queueSync();}}
    }
    function queueSync(){if(!user)return;clearTimeout(syncTimer);syncTimer=setTimeout(push,1100);}
    document.addEventListener("ipas:save",queueSync);
    window.addEventListener("online",queueSync);
    async function handleAuth(session){
      const prevId=user?.id;user=session?.user||null;
      if(!user){clearTimeout(syncTimer);if(prevId)window.IPAS_BRIDGE?.signOut();present();return;}
      if(prevId===user.id){present();return;}
      present();notice.textContent="正在載入雲端進度…";
      try{
        const {data,error}=await supabase.from("study_profiles").select("state,display_name").eq("user_id",user.id).maybeSingle();
        if(error)throw error;
        window.IPAS_BRIDGE?.attachUser(user.id,data?.state||{});
        present();queueSync();msg(data?"已載入並合併雲端學習進度":"已建立帳號，正在備份現有學習進度");
      }catch(e){notice.textContent="登入成功，但資料同步失敗";msg("請檢查資料庫政策與連線："+e.message);}
    }
    q("cloudAuthForm").onsubmit=async e=>{
      e.preventDefault();const email=q("cloudEmail").value.trim(),password=q("cloudPassword").value;
      if(password.length<8){msg("密碼至少 8 字");return;}
      msg("登入中…");const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)msg(error.message);
    };
    q("cloudSignUp").onclick=async()=>{
      const email=q("cloudEmail").value.trim(),password=q("cloudPassword").value;
      if(!q("cloudEmail").checkValidity()||password.length<8){msg("請輸入有效電子郵件與至少 8 字密碼");return;}
      msg("註冊中…");const {data,error}=await supabase.auth.signUp({email,password});
      if(error)msg(error.message);
      else msg(data.session?"註冊完成，正在同步進度":"註冊申請已送出。請到電子郵件收信並完成確認，再回來登入。");
    };
    q("cloudSignOut").onclick=async()=>{const {error}=await supabase.auth.signOut();if(error)msg(error.message);else msg("已登出；本機登入資料已清除。");};
    q("cloudSyncNow").onclick=push;
    q("cloudSaveName").onclick=()=>{window.IPAS_BRIDGE?.updateCloudName(q("cloudDisplayName").value.trim());msg("名稱已更新，正在同步。");};
    async function refreshFiles(){
      if(!user||filesBusy)return;filesBusy=true;q("cloudFiles").replaceChildren();
      const spinner=document.createElement("p");spinner.textContent="正在讀取附件…";q("cloudFiles").appendChild(spinner);
      try{
        const {data,error}=await supabase.storage.from("study-files").list(user.id,{limit:100,sortBy:{column:"created_at",order:"desc"}});
        if(error)throw error;q("cloudFiles").replaceChildren();
        const files=(data||[]).filter(x=>x.name!==".emptyFolderPlaceholder"&&x.id);
        if(!files.length){const p=document.createElement("p");p.className="small muted";p.textContent="尚無雲端附件";q("cloudFiles").appendChild(p);}
        for(const f of files){const row=document.createElement("div");row.className="vault-entry";const title=document.createElement("span");title.textContent=f.name.slice(37)||f.name;row.appendChild(title);
          const download=document.createElement("button");download.className="btn soft sm";download.textContent="下載";
          download.onclick=async()=>{const {data,error}=await supabase.storage.from("study-files").download(user.id+"/"+f.name);if(error){msg(error.message);return;}const u=URL.createObjectURL(data),a=document.createElement("a");a.href=u;a.download=f.name.slice(37)||f.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
          const del=document.createElement("button");del.className="btn ghost sm";del.textContent="刪除";
          del.onclick=async()=>{if(!confirm("確定刪除這份雲端附件？"))return;const {error}=await supabase.storage.from("study-files").remove([user.id+"/"+f.name]);if(error)msg(error.message);else refreshFiles();};
          row.append(download,del);q("cloudFiles").appendChild(row);}
      }catch(e){q("cloudFiles").textContent="讀取失敗："+e.message;}finally{filesBusy=false;}
    }
    q("cloudRefreshFiles").onclick=refreshFiles;
    q("cloudUploadBtn").onclick=async()=>{
      if(!user)return;const file=q("cloudUpload").files?.[0];if(!file){msg("請先選擇檔案");return;}
      if(file.size>10485760){msg("單檔上限 10 MB");return;}
      if(!/\.(pdf|docx|txt|md|png|jpe?g)$/i.test(file.name)){msg("不支援此檔案格式");return;}
      const safe=file.name.replace(/[^\p{L}\p{N}._-]/gu,"_").slice(0,90),path=user.id+"/"+crypto.randomUUID()+"-"+safe;
      const ext=(file.name.split(".").pop()||"").toLowerCase();
      const mimeMap={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",txt:"text/plain",md:"text/markdown",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg"};
      const {error}=await supabase.storage.from("study-files").upload(path,file,{cacheControl:"0",upsert:false,contentType:mimeMap[ext]||file.type||"application/octet-stream"});
      if(error)msg("上傳失敗："+error.message);else{msg("附件已存入私人雲端檔案庫");q("cloudUpload").value="";refreshFiles();}
    };
    supabase.auth.onAuthStateChange((_event,session)=>queueMicrotask(()=>handleAuth(session)));
    const {data:{session}}=await supabase.auth.getSession();
    if(session)await handleAuth(session);
    present();
  }catch(e){notice.textContent="雲端元件載入失敗；本機功能仍可用";}
}else{notice.textContent="本機模式｜雲端登入尚未設定";}
