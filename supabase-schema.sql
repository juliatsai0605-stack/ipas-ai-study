-- iPAS AI 備考室：Supabase 免費版初始化（由專案擁有者在 SQL Editor 執行）
-- Auth identities are managed by Supabase Auth, not by a display name.
create table if not exists public.study_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.study_profiles enable row level security;
drop policy if exists "read own study profile" on public.study_profiles;
drop policy if exists "insert own study profile" on public.study_profiles;
drop policy if exists "update own study profile" on public.study_profiles;
create policy "read own study profile" on public.study_profiles for select to authenticated using (auth.uid()=user_id);
create policy "insert own study profile" on public.study_profiles for insert to authenticated with check (auth.uid()=user_id);
create policy "update own study profile" on public.study_profiles for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
grant select,insert,update on public.study_profiles to authenticated;
-- Private storage namespace; only the logged-in owner can see their own folder.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('study-files','study-files',false,10485760,array['application/pdf','text/plain','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg'])
on conflict (id) do nothing;
drop policy if exists "study files own select" on storage.objects;
drop policy if exists "study files own insert" on storage.objects;
drop policy if exists "study files own delete" on storage.objects;
create policy "study files own select" on storage.objects for select to authenticated using(bucket_id='study-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "study files own insert" on storage.objects for insert to authenticated with check(bucket_id='study-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "study files own delete" on storage.objects for delete to authenticated using(bucket_id='study-files' and (storage.foldername(name))[1]=auth.uid()::text);
