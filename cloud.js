// Personal learning requires authentication; unavailable auth fails closed.
// Public publishable/anon key only. Authorization is enforced by Supabase RLS and private storage.
const host=document.createElement("div");
host.className="cloud-account-host";
document.querySelector(".top-in")?.appendChild(host);
host.style.cssText="display:flex;align-items:center;gap:8px";
const notice=document.createElement("span");
notice.style.cssText="font-size:.75rem;color:#60708c;white-space:nowrap";
notice.textContent="正在確認登入狀態…";
host.appendChild(notice);
let cfg;
try{const response=await fetch("/api/cloud-config",{cache:"no-store"});cfg=response.ok?await response.json():null;}catch(e){cfg=null;}
if(cfg?.configured&&cfg.url&&cfg.publishableKey){
  try{
    const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2.57.0");
    const supabase=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
    let user=null,syncTimer=null,busy=false,queued=false,filesBusy=false,syncReady=false;
    const button=document.createElement("button");
    button.className="iconbtn";
    button.textContent="登入／雲端續學";
    host.appendChild(button);
    notice.textContent="雲端登入可用";
    const dialog=document.createElement("dialog");dialog.className="cloud-dialog";
    dialog.style.cssText="border:1px solid #cad5f3;border-radius:18px;padding:24px;max-width:min(92vw,550px);width:100%;box-shadow:0 20px 70px #29345b40;color:#263154;background:#fff";
    dialog.innerHTML=`<form id="cloudAuthForm"><div class="row" style="justify-content:space-between"><h2>✦ 個人學習帳號</h2><button type="button" class="iconbtn" id="cloudClose" aria-label="關閉">✕</button></div>
    <p class="small muted">完全免費。使用 Google 帳號登入，讓不同裝置接續學習；亦可使用電子郵件帳號。請勿使用公務帳號或上傳機敏資料。</p>
    <div id="cloudAnonymous"><button class="btn" type="button" id="cloudGoogle">使用 Google 帳號登入</button><p class="small muted">授權與帳號選擇由你本人完成。</p><label class="study-field">電子郵件<input type="email" id="cloudEmail" autocomplete="email" required></label>
    <label class="study-field">密碼（至少 8 字）<input id="cloudPassword" type="password" minlength="8" autocomplete="current-password" required></label>
    <div class="row"><button class="btn" id="cloudSignIn" type="submit">登入</button><button class="btn soft" type="button" id="cloudSignUp">免費註冊</button><button class="btn ghost" type="button" id="cloudResend">重寄驗證信</button></div></div>
    <div id="cloudSignedIn" hidden><p>已登入：<strong id="cloudUserName"></strong></p><p class="small muted">學習進度將保存於你的帳號。附件只允許本人讀取，單檔不得超過 10 MB。</p>
    <label class="study-field">顯示名稱<input id="cloudDisplayName" maxlength="35" placeholder="你的名稱"></label>
    <div class="row"><button type="button" class="btn soft" id="cloudSaveName">儲存名稱</button><button type="button" class="btn ghost" id="cloudSyncNow">立即同步</button><button type="button" class="btn ghost" id="cloudSignOut">登出</button></div>
    <h3 style="margin-top:20px">私人雲端附件庫</h3><p class="small muted">限 PDF、Word、文字及 PNG/JPG 圖片，上傳前檢查每帳號最多 100 份、合計 100 MB。</p>
    <label class="study-field">選擇檔案<input id="cloudUpload" type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"></label>
    <div class="row"><button type="button" class="btn" id="cloudUploadBtn">上傳私人檔案</button><button type="button" class="btn soft" id="cloudRefreshFiles">重新整理清單</button></div>
    <div id="cloudFiles" style="margin-top:12px;display:grid;gap:8px"></div></div><p class="note" id="cloudMessage" role="status" aria-live="polite" style="margin-top:12px"></p></form>`;
    document.body.appendChild(dialog);
    const q=id=>dialog.querySelector("#"+id);
    const msg=(s)=>{q("cloudMessage").textContent=String(s||"");};
    button.onclick=()=>{if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");if(user)refreshFiles();};
    document.addEventListener("ipas:login-required",()=>{button.click();msg("請先登入，再使用個人學習功能。");});
    q("cloudClose").onclick=()=>dialog.close();
    dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
    function present(){
      q("cloudAnonymous").hidden=!!user;
      q("cloudSignedIn").hidden=!user;
      if(user){button.textContent="☁ 我的帳號";notice.textContent=syncReady?"雲端同步已啟用":"雲端進度尚未同步";q("cloudUserName").textContent=user.email||"已登入帳號";q("cloudDisplayName").value=window.IPAS_BRIDGE?.snapshot().localName||"";}
      else{button.textContent="登入／雲端續學";notice.textContent="請登入以使用個人學習功能";}
    }
    async function push(){
      if(!user||!syncReady||!window.IPAS_BRIDGE)return;
      const syncOwner=user.id;
      if(busy){queued=true;return;}
      busy=true;
      try{const state=window.IPAS_BRIDGE.snapshot();
        const {error}=await supabase.from("study_profiles").upsert({user_id:user.id,display_name:state.localName||"",state,updated_at:new Date().toISOString()},{onConflict:"user_id"});
        if(error)throw error;if(user?.id!==syncOwner)return;notice.textContent="✓ 雲端已同步";msg("學習進度已安全同步");
      }catch(e){if(user?.id===syncOwner){notice.textContent="同步失敗（仍保留本機資料）";msg("同步失敗："+e.message);}}
      finally{busy=false;if(queued){queued=false;queueSync();}}
    }
    function queueSync(){if(!user||!syncReady)return;clearTimeout(syncTimer);syncTimer=setTimeout(push,1100);}
    document.addEventListener("ipas:save",queueSync);
    window.addEventListener("online",queueSync);
    async function handleAuth(session){
      const nextUser=session?.user||null,prevId=user?.id;
      if(!nextUser){
        user=null;syncReady=false;clearTimeout(syncTimer);queued=false;window.IPAS_BRIDGE?.setAuthState(false);
        if(prevId)window.IPAS_BRIDGE?.signOut();
        q("cloudFiles").replaceChildren();present();return;
      }
      if(prevId===nextUser.id){present();return;}
      // Never display or upload the previous account's state while the new identity loads.
      clearTimeout(syncTimer);queued=false;syncReady=false;
      if(prevId)window.IPAS_BRIDGE?.signOut();
      user=nextUser;q("cloudFiles").replaceChildren();
      present();notice.textContent="正在載入雲端進度…";
      try{
        const {data,error}=await supabase.from("study_profiles").select("state,display_name").eq("user_id",nextUser.id).maybeSingle();
        if(user?.id!==nextUser.id)return; // stale response from an earlier session
        if(error)throw error;
        window.IPAS_BRIDGE?.attachUser(nextUser.id,data?.state||{});
        syncReady=true;window.IPAS_BRIDGE?.setAuthState(true);present();queueSync();msg(data?"已載入並合併雲端學習進度":"已建立帳號，正在備份現有學習進度");
      }catch(e){
        if(user?.id!==nextUser.id)return;
        notice.textContent="登入成功，但資料同步失敗";
        msg("雲端進度未載入；為避免覆蓋其他裝置的資料，暫停自動同步。"+e.message);
      }
    }
    q("cloudGoogle").onclick=async()=>{
      q("cloudGoogle").disabled=true;msg("正在前往 Google 帳號授權…");
      try{
        const settingsResponse=await fetch(cfg.url+"/auth/v1/settings",{headers:{apikey:cfg.publishableKey},cache:"no-store"});
        if(!settingsResponse.ok)throw Error("無法確認登入服務狀態，請稍後重試");
        const settings=await settingsResponse.json();
        if(!settings.external?.google)throw Error("Google 登入尚未啟用，請待網站管理者完成設定");
        const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/",queryParams:{prompt:"select_account"}}});if(error)throw error;}
      catch(e){msg("Google 登入失敗："+e.message);q("cloudGoogle").disabled=false;}
    };
    window.addEventListener("pageshow",()=>{q("cloudGoogle").disabled=false;});
    const oauthError=new URLSearchParams(location.search).get("error_description")||new URLSearchParams(location.hash.slice(1)).get("error_description");
    if(oauthError){button.click();msg("Google 授權未完成："+oauthError);history.replaceState(null,"",location.pathname);}
    let authBusy=false,resendUntil=0;
    function authMessage(error){
      const code=error?.code||"",text=error?.message||"";
      if(code==="email_not_confirmed"||/Email not confirmed/i.test(text))return "帳號已建立，但信箱尚未驗證。請開啟註冊確認信並點選驗證連結；找不到信件可按「重寄驗證信」，不必再註冊。";
      if(code==="invalid_credentials"||/Invalid login credentials/i.test(text))return "電子郵件或密碼不正確，請確認後再登入。";
      if(error?.status===429||/after \\d+ seconds|rate limit/i.test(text)){const n=Number(text.match(/after (\\d+) seconds/i)?.[1]||60);resendUntil=Date.now()+n*1000;return "寄信次數受到限制，請等 "+n+" 秒後再試；不要重複按註冊。";}
      return "操作未完成："+text;
    }
    q("cloudResend").onclick=async()=>{
      if(authBusy)return;
      const email=q("cloudEmail").value.trim();
      if(!email||!q("cloudEmail").checkValidity()){msg("請先輸入有效電子郵件，不必填密碼。");return;}
      const wait=Math.ceil((resendUntil-Date.now())/1000);if(wait>0){msg("請再等 "+wait+" 秒後重寄。");return;}
      authBusy=true;q("cloudResend").disabled=true;msg("正在寄送驗證信…");
      try{const {error}=await supabase.auth.resend({type:"signup",email,options:{emailRedirectTo:location.origin+"/"}});if(error)throw error;resendUntil=Date.now()+60000;msg("驗證信已送出。請檢查收件匣及垃圾郵件，點選最新確認信的連結，再回來按「登入」。");}
      catch(error){msg(authMessage(error));}finally{authBusy=false;q("cloudResend").disabled=false;}
    };
    q("cloudAuthForm").onsubmit=async e=>{
      e.preventDefault();const email=q("cloudEmail").value.trim(),password=q("cloudPassword").value;
      if(password.length<8){msg("密碼至少 8 字");return;}
      msg("登入中…");const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)msg(authMessage(error));
    };
    q("cloudSignUp").onclick=async()=>{
      const email=q("cloudEmail").value.trim(),password=q("cloudPassword").value;
      if(!q("cloudEmail").checkValidity()||password.length<8){msg("請輸入有效電子郵件與至少 8 字密碼");return;}
      msg("註冊中…");const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin+"/"}});
      if(error)msg(authMessage(error));
      else msg(data.session?"註冊完成，正在同步進度":"註冊申請已送出。請到電子郵件收信並完成確認，再回來登入。");
    };
    q("cloudSignOut").onclick=async()=>{const {error}=await supabase.auth.signOut();if(error)msg(error.message);else msg("已登出；本機登入資料已清除。");};
    q("cloudSyncNow").onclick=()=>{if(!syncReady){msg("尚未成功讀取雲端進度，為避免覆蓋既有資料，請重新登入後再同步。");return;}push();};
    q("cloudSaveName").onclick=()=>{window.IPAS_BRIDGE?.updateCloudName(q("cloudDisplayName").value.trim());msg("名稱已更新，正在同步。");};
    async function refreshFiles(){
      if(!user||filesBusy)return;const fileOwner=user.id;filesBusy=true;q("cloudFiles").replaceChildren();
      const spinner=document.createElement("p");spinner.textContent="正在讀取附件…";q("cloudFiles").appendChild(spinner);
      try{
        const {data,error}=await supabase.storage.from("study-files").list(fileOwner,{limit:100,sortBy:{column:"created_at",order:"desc"}});
        if(user?.id!==fileOwner)return;
        if(error)throw error;q("cloudFiles").replaceChildren();
        const files=(data||[]).filter(x=>x.name!==".emptyFolderPlaceholder"&&x.id);
        if(!files.length){const p=document.createElement("p");p.className="small muted";p.textContent="尚無雲端附件";q("cloudFiles").appendChild(p);}
        for(const f of files){const row=document.createElement("div");row.className="vault-entry";const title=document.createElement("span");title.textContent=f.name.slice(37)||f.name;row.appendChild(title);
          const download=document.createElement("button");download.type="button";download.className="btn soft sm";download.textContent="下載";
          download.onclick=async()=>{if(user?.id!==fileOwner)return;const {data,error}=await supabase.storage.from("study-files").download(fileOwner+"/"+f.name);if(user?.id!==fileOwner)return;if(error){msg(error.message);return;}const u=URL.createObjectURL(data),a=document.createElement("a");a.href=u;a.download=f.name.slice(37)||f.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
          const del=document.createElement("button");del.type="button";del.className="btn ghost sm";del.textContent="刪除";
          del.onclick=async()=>{if(user?.id!==fileOwner||!confirm("確定刪除這份雲端附件？"))return;const {error}=await supabase.storage.from("study-files").remove([fileOwner+"/"+f.name]);if(user?.id!==fileOwner)return;if(error)msg(error.message);else refreshFiles();};
          row.append(download,del);q("cloudFiles").appendChild(row);}
      }catch(e){q("cloudFiles").textContent="讀取失敗："+e.message;}finally{filesBusy=false;}
    }
    q("cloudRefreshFiles").onclick=refreshFiles;
    q("cloudUploadBtn").onclick=async()=>{
      if(!user)return;const file=q("cloudUpload").files?.[0];if(!file){msg("請先選擇檔案");return;}
      if(file.size>10485760){msg("單檔上限 10 MB");return;}
      if(!/\.(pdf|docx|txt|md|png|jpe?g)$/i.test(file.name)){msg("不支援此檔案格式");return;}
      const uploadOwner=user.id;
      const {data:existing,error:quotaError}=await supabase.storage.from("study-files").list(uploadOwner,{limit:100});
      if(user?.id!==uploadOwner)return;
      if(quotaError){msg("無法檢查雲端容量，暫停上傳："+quotaError.message);return;}
      const stored=(existing||[]).filter(x=>x.id),total=stored.reduce((n,x)=>n+Number(x.metadata?.size||0),0);
      if(stored.length>=100||total+file.size>100*1024*1024){msg("每帳號最多 100 份附件、合計 100 MB，請先刪除舊檔案。");return;}
      const safe=file.name.replace(/[^\p{L}\p{N}._-]/gu,"_").slice(0,90),path=uploadOwner+"/"+crypto.randomUUID()+"-"+safe;
      const ext=(file.name.split(".").pop()||"").toLowerCase();
      const mimeMap={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",txt:"text/plain",md:"text/markdown",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg"};
      const {error}=await supabase.storage.from("study-files").upload(path,file,{cacheControl:"0",upsert:false,contentType:mimeMap[ext]||file.type||"application/octet-stream"});
      if(user?.id!==uploadOwner)return;if(error)msg("上傳失敗："+error.message);else{msg("附件已存入私人雲端檔案庫");q("cloudUpload").value="";refreshFiles();}
    };
    supabase.auth.onAuthStateChange((_event,session)=>queueMicrotask(()=>handleAuth(session)));
    const {data:{session}}=await supabase.auth.getSession();
    await handleAuth(session);
    present();
  }catch(e){notice.textContent="登入服務載入失敗，請重新整理";window.IPAS_BRIDGE?.setAuthState(false);}
}else{notice.textContent="登入服務尚未設定，個人功能暫停使用";window.IPAS_BRIDGE?.setAuthState(false);}
