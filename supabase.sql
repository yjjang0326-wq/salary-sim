-- 연봉협상관리 — Supabase 초기 설정
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

create table if not exists app_state (
  id int primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;

-- 로그인한 사용자만 읽고 쓸 수 있음. 로그인하지 않은 접근은 정책이 없어 전부 막힘.
create policy "authenticated full access"
  on app_state
  for all
  to authenticated
  using (true)
  with check (true);

-- 앱이 첫 실행 때 빈 행을 찾지 못해도 동작하도록 미리 한 줄 만들어 둠(없어도 앱이 upsert로 만듦)
insert into app_state (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;
