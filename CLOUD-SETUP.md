# iPAS AI 備考室：零付費額度雲端登入部署指南

> 目前 Vercel Preview 可正常運作本機版。**只有完成下列設定，雲端登入、跨裝置進度與私人雲端附件才會啟用。** 此文件不會自動創立付費訂閱或提交任何帳單。

## 一次性設定

1. 在 Supabase 建立新專案，選擇 **Free** 方案並核對現行免費額度、儲存空間與休眠限制。切勿把公務敏感資料、受限偵查資料或個資存於本網站。
2. Supabase → SQL Editor：完整執行儲存庫根目錄的 `supabase-schema.sql`。確認 public.study_profiles RLS 已啟用，storage bucket `study-files` 為 **private**，政策中的 `auth.uid()` 正確限制使用者目錄。
3. Supabase → Authentication → Providers：啟用 Email。依專案需求啟用 **Confirm email**，設定 Email redirect/site URL（包含正式網站 `https://ipas-ai-study.vercel.app` 和 Vercel Preview 網域）。如果驗證信郵寄受供應商免費額度限制，須先確認郵件可正常送達。
4. Supabase → Project Settings / API：取得 **Project URL** 及 **publishable key 或 anon key**。**嚴禁使用 service_role、secret key 或資料庫密碼**。
5. Vercel → 專案 `ipas-ai-study` → Settings → Environment Variables：
   - `SUPABASE_URL`：Project URL
   - `SUPABASE_PUBLISHABLE_KEY`：publishable key（或改設 `SUPABASE_ANON_KEY`）
   - 先只勾 **Preview**，完成測試前不要啟用 Production。
6. 重新部署 Preview，開啟 `/api/cloud-config`。應回傳 `configured: true` 和 public URL/key。登入按鈕才會出現。

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
- 使用者登入後：文字進度存於 PostgreSQL RLS 保護的個人資料列；私人上傳檔案存於 Supabase private storage bucket。
- 目前同步是頁面使用時的事件驅動自動同步，**不是背景同步服務**；遇到同一筆筆記在兩台裝置同時修改，仍需人工核對。
- 未做實際瀏覽器端到端測試前，**禁止合併 PR 或宣稱正式上線**。
- 不提供付費會員制，也不把 API 使用成本轉嫁給使用者。免費雲端額度如不足，須先告知並停用高成本功能。


## 實際免費部署狀態（2026-10-25）
Supabase Free 新專案報價已核實為 US$0/月，已建立 iPAS 專案（東京區），完成私人資料表 RLS、private storage bucket 與 Vercel 預覽分支公開環境變數。正式站尚未啟用，須完成雙帳號、跨裝置與視覺驗收。