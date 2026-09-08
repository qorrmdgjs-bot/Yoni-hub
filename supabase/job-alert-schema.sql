-- 채용공고 알림 기능용 테이블. cgv_screenings와 같은 Supabase 프로젝트
-- (jejomunoscgnozdgojcj)에 Supabase 대시보드 SQL Editor에서 직접 실행할 것.
-- 코드 배포와 별개로 운영 DB에 먼저 적용해야 한다(AGENTS.md 관행과 동일).
--
-- 이미 job_postings가 있는 환경(운영 DB)에는 아래 한 줄만 추가로 실행하면 된다:
--   alter table job_postings add column if not exists starred boolean not null default false;

create table job_postings (
  id bigint generated always as identity primary key,
  source_site text not null,            -- 'saramin' | 'wanted' | 'jobkorea' | 'remember'
  external_id text not null,            -- 사이트 자체 공고 id
  title text not null,
  company text not null,
  location text,
  employment_type text,
  career_text text,
  perk_tags text[],
  jobplanet_rating numeric,
  recommend_tier text,                  -- 'strong' | 'normal' | 'excluded' | null(평점없음)
  reason text,
  url text not null,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  notified boolean not null default false,
  starred boolean not null default false,
  raw jsonb
);
create unique index job_postings_source_external_uidx on job_postings (source_site, external_id);
alter table job_postings enable row level security;
create policy "anon_all" on job_postings for all to anon using (true) with check (true);

create table jobplanet_ratings_cache (
  company_normalized text primary key,
  rating numeric,
  jobplanet_url text,
  fetched_at timestamptz not null default now()
);
alter table jobplanet_ratings_cache enable row level security;
create policy "anon_all" on jobplanet_ratings_cache for all to anon using (true) with check (true);

create table job_adapter_health (
  source_site text primary key,
  last_success_at timestamptz,
  last_error text,
  alerted_at timestamptz
);
alter table job_adapter_health enable row level security;
create policy "anon_all" on job_adapter_health for all to anon using (true) with check (true);
