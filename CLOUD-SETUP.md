# iPAS AI 備考室：零付費額度雲端登入部署指南

> 此文件是安全驗收操作說明，不代表已通過正式上線驗收。**目前不得自動建立 Preview 或 production 部署。** 不會自動創立付費訂閱或提交任何帳單。

## 一次性設定

1. 在 Supabase 建立新專案，選擇 **Free** 方案並核對現行免費額度、儲存空間與休眠限制。切勿把公務敏感資料、受限偵查資料或個資存於本網站。
2. Supabase → SQL Editor：完整執行儲存庫根目錄的 `supabase-schema.sql`。確認 public.study_profiles RLS 已啟用，storage bucket `study-files` 為 **private**，政策中的 `auth.uid()` 正確限制使用者目錄。
3. Supabase → Authentication → Providers：啟用 Email。依專案需求啟用 **Confirm email**，設定 Email redirect/site URL（包含正式網站 `https://ipas-ai-study.vercel.app` 和 Vercel Preview 網域）。如果驗證信郵寄受供應商免費額度限制，須先確認郵件可正常送達。
4. Supabase → Project Settings / API：取得 **Project URL** 及 **publishable key 或 anon key**。**嚴禁使用 service_role、secret key 或資料庫密碼**。
5. Vercel → 專案 `ipas-ai-study` → Settings → Environment Variables：
   - `SUPABASE_URL`：Project URL
   - `SUPABASE_PUBLISHABLE_KEY`：publishable key（或改設 `SUPABASE_ANON_KEY`）
   - 若從零開始，應先只設定 **Preview**。既有專案已在先前作業中設定 Production 公開金鑰；此事不代表本 PR 可覆蓋正式站，後續須維持正式部署不變。
6. **僅在所有離線測試及視覺驗收通過後**，建立一次 Preview，開啟 `/api/cloud-config`。應回傳 `configured: true` 和 public URL/key。登入按鈕才會出現；未經使用者明確同意不得部署 production。

## 驗收步驟（必須實際執行）

- A 裝置註冊帳號、確認郵件、登入後作答並建立筆記。
- B 裝置用同帳號登入，確認完成度、錯題、間隔複習日期、筆記、最後單元能出現，且刷新仍保留。
- 登出 A 裝置，確認不會顯示前一帳號的雲端資料；用第二個帳號登入，確認無法列出第一個帳號的資料與附件。
- 在 A 裝置上傳 PDF，B 裝置以同帳號下載，再測試刪除，確認其他帳號不可讀。
- 模擬網路中斷作答；重新連線後比對資料；檢查多裝置同時編輯同一筆文字的衝突（此版本採合併策略，並非即時協作編輯器）。
- 驗證原本 `ipas-ai-study-v4` 的本機資料不會在首次登入時被空資料覆蓋。
- 檢視 Vercel/ Supabase 流量與儲存成本，確認在免費額度內。

## 限制與資料安全

- **未配置 Supabase 時：** 只有本機模式；本機附件使用 IndexedDB，進度與文字筆記使用 localStorage。JSON 進度備份不包含附件的二進位內容。
- 使用者登入後：文字進度存於 PostgreSQL RLS 保護的個人資料列；私人上傳檔案存於 Supabase private storage bucket。**100 份／100MB 為前端提醒與檢查，不是資料庫強制總額配額；伺服器端只強制單檔 10MB 與 MIME 白名單。**
- 目前同步是頁面使用時的事件驅動自動同步，**不是背景同步服務**；遇到同一筆筆記在兩台裝置同時修改，仍需人工核對。
- 未做實際瀏覽器端到端測試前，**禁止合併 PR 或宣稱正式上線**。
- 不提供付費會員制，也不把 API 使用成本轉嫁給使用者。免費雲端額度如不足，須先告知並停用高成本功能。


## 實際免費部署狀態（2026-10-25）
Supabase Free 專案已建立，已設定私人資料表 RLS、private storage bucket 與 Vercel 預覽分支公開環境變數。**先前作業已為既有 production 設定公開金鑰並部署舊版**，但最新開發分支仍未完成雙帳號、跨裝置、Storage API 刪除與視覺驗收。禁止自動再次部署正式站；GitHub PR #2 保持 Draft。
## 真實驗收與模擬測試的界線

- GitHub Actions 的 `tests/cloud.mjs` 使用隔離的 Supabase 模擬物件，能驗證前端流程、上傳／下載／刪除與身分切換，**不能證明真實 Email 服務、Storage API 或跨裝置後端可用**。
- SQL 只確認 storage.objects 的 DELETE 政策存在；Supabase Storage 會阻止直接 SQL DELETE，因此必須由可收信的兩個測試帳號，透過正式 Storage API 驗證本人刪除成功、他人刪除失敗。
- 未完成兩帳號的註冊／Email 驗證／登入／登出與不同瀏覽器裝置同步前，不得將 Auth/RLS 項目標示為通過。
