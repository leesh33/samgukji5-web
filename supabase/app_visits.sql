-- ─────────────────────────────────────────────────────────────
-- 삼국 한 턴(Samguk Han Turn) · 📊 접속자 통계 (공용 프로젝트 확장)
-- 프로젝트: zdcdvjlssncsawpqsjwe (릴스핀 · 인생 한 턴과 같은 Supabase)
-- ─────────────────────────────────────────────────────────────
-- Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여 넣고 Run 하면 됩니다.
-- (다시 실행해도 안전합니다 — `create ... if not exists` · `create or replace`)
--
--  · 이 파일은 **기존 것 위에 얹는 확장**입니다. 테이블·함수는 life-sim-web/supabase/app_visits.sql
--    이 만든 그대로 두고, 앱 구분(app_id) 허용 목록에 'samguk-han-turn' 만 더합니다.
--    → 이미 쌓인 'reelpin' · 'life-turn' 기록은 한 줄도 건드리지 않습니다(제약을 넓히기만 함).
--
--  · public.app_visits — 앱별·한국 시간(KST) 날짜별 익명 방문 기록 한 줄.
--      앱이 만든 **임의의 visitor_id**(UUID 모양 문자열)만 저장합니다.
--      이메일·이름·IP·기기 정보·위치는 저장하지 않습니다.
--      같은 사람이 같은 날 여러 번 열면 한 줄에 views 만 늘어납니다.
--  · app_visit_track(p_app_id, p_visitor_id) — 로그인하지 않은 사람도 부를 수 있습니다.
--  · app_visit_stats(p_app_id, p_days default 14) — 관리자만.
--
--  · 앱 구분: 'reelpin' | 'life-turn' | 'samguk-han-turn'
-- ─────────────────────────────────────────────────────────────

-- 1. 관리자 판별 (통계 RPC 전용 · 릴스핀·인생 한 턴과 같은 이메일 목록) ──
create or replace function public.app_visit_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'andy.leesh33@gmail.com',
    'shhy@kakao.com'
  );
$$;

comment on function public.app_visit_is_admin() is '📊 접속자 통계 관리자 판별 — reelpin_is_admin() 과 같은 이메일 목록(DB 측 최종 확인)';

revoke all on function public.app_visit_is_admin() from public;
revoke all on function public.app_visit_is_admin() from anon;
grant execute on function public.app_visit_is_admin() to authenticated;

-- 2. 테이블 — 처음 만드는 경우에만(이미 있으면 손대지 않는다) ──
create table if not exists public.app_visits (
  app_id     text        not null,                          -- 'reelpin' | 'life-turn' | 'samguk-han-turn'
  visit_date date        not null default ((now() at time zone 'Asia/Seoul')::date),
  visitor_id text        not null,                          -- 앱이 만든 임의 UUID (개인정보 없음)
  views      integer     not null default 1,                -- 그날 그 사람이 연 횟수
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  constraint app_visits_pkey primary key (app_id, visit_date, visitor_id),
  constraint app_visits_app_id_check check (app_id in ('reelpin', 'life-turn', 'samguk-han-turn')),
  constraint app_visits_visitor_id_check check (visitor_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  constraint app_visits_views_check check (views > 0)
);

comment on table  public.app_visits is '📊 앱별 익명 접속 기록 — visitor_id 는 기기가 만든 임의 UUID(이메일·IP 없음), 날짜는 KST';
comment on column public.app_visits.app_id     is '앱 구분 — reelpin | life-turn | samguk-han-turn';
comment on column public.app_visits.visit_date is '한국 시간(KST) 기준 날짜 — 같은 사람·같은 날은 한 줄';
comment on column public.app_visits.visitor_id is '기기가 만든 임의 UUID(8~64자 영문·숫자·-·_) — 개인 식별 정보 아님';
comment on column public.app_visits.views      is '그날 그 방문자가 앱을 연 횟수(조회수)';

create index if not exists app_visits_app_date_idx    on public.app_visits (app_id, visit_date);
create index if not exists app_visits_app_visitor_idx on public.app_visits (app_id, visitor_id);

-- 3. 앱 구분 허용 목록에 'samguk-han-turn' 추가 ──
--    제약을 **넓히기만** 하므로 기존 reelpin·life-turn 행은 그대로 통과합니다(데이터 변경 없음).
alter table public.app_visits drop constraint if exists app_visits_app_id_check;
alter table public.app_visits add  constraint app_visits_app_id_check
  check (app_id in ('reelpin', 'life-turn', 'samguk-han-turn'));

-- 직접 읽고 쓰지 못하게 한다 — 아래 RPC 로만.
alter table public.app_visits enable row level security;
revoke all on table public.app_visits from public;
revoke all on table public.app_visits from anon;
revoke all on table public.app_visits from authenticated;

-- 4. 방문 1회 기록 — 비로그인 포함 누구나 ────────────────────
create or replace function public.app_visit_track(p_app_id text, p_visitor_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app     text    := lower(btrim(coalesce(p_app_id, '')));
  v_visitor text    := btrim(coalesce(p_visitor_id, ''));
  v_day     date    := (now() at time zone 'Asia/Seoul')::date;
  v_views   integer := 0;
begin
  if v_app not in ('reelpin', 'life-turn', 'samguk-han-turn') then
    raise exception 'unknown app_id' using errcode = '22023';
  end if;
  if v_visitor !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'invalid visitor_id' using errcode = '22023';
  end if;

  insert into public.app_visits as v (app_id, visit_date, visitor_id, views, first_seen, last_seen)
  values (v_app, v_day, v_visitor, 1, now(), now())
  on conflict (app_id, visit_date, visitor_id)
  do update set views = v.views + 1,
                last_seen = now()
  returning v.views into v_views;

  return jsonb_build_object(
    'ok', true,
    'app_id', v_app,
    'date', v_day,
    'views', v_views
  );
end;
$$;

comment on function public.app_visit_track(text, text) is '📊 방문 1회 기록 — 앱+KST 날짜+방문자 한 줄에 views +1 (비로그인 포함)';

revoke all on function public.app_visit_track(text, text) from public;
grant execute on function public.app_visit_track(text, text) to anon, authenticated;

-- 5. 통계 — 관리자만 ─────────────────────────────────────────
create or replace function public.app_visit_stats(p_app_id text, p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app            text    := lower(btrim(coalesce(p_app_id, '')));
  v_days           integer := greatest(1, least(coalesce(p_days, 14), 90));
  v_today          date    := (now() at time zone 'Asia/Seoul')::date;
  v_today_visitors integer := 0;
  v_today_views    integer := 0;
  v_total_visitors integer := 0;
  v_total_views    integer := 0;
  v_daily          jsonb   := '[]'::jsonb;
begin
  if not public.app_visit_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_app not in ('reelpin', 'life-turn', 'samguk-han-turn') then
    raise exception 'unknown app_id' using errcode = '22023';
  end if;

  -- 오늘(KST) 고유 접속자 · 조회수
  select count(*)::int, coalesce(sum(views), 0)::int
    into v_today_visitors, v_today_views
  from public.app_visits
  where app_id = v_app
    and visit_date = v_today;

  -- 누적 고유 접속자 · 조회수 (서로 다른 visitor_id 수)
  select count(distinct visitor_id)::int, coalesce(sum(views), 0)::int
    into v_total_visitors, v_total_views
  from public.app_visits
  where app_id = v_app;

  -- 최근 p_days 일 — 기록이 없는 날짜도 0 으로 채운다
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'date',     d.day,
               'visitors', coalesce(a.visitors, 0),
               'views',    coalesce(a.views, 0)
             ) order by d.day
           ),
           '[]'::jsonb
         )
    into v_daily
  from (
    select generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date as day
  ) d
  left join (
    select visit_date,
           count(*)::int               as visitors,
           coalesce(sum(views), 0)::int as views
    from public.app_visits
    where app_id = v_app
      and visit_date between v_today - (v_days - 1) and v_today
    group by visit_date
  ) a on a.visit_date = d.day;

  return jsonb_build_object(
    'app_id',         v_app,
    'today_visitors', v_today_visitors,
    'today_views',    v_today_views,
    'total_visitors', v_total_visitors,
    'total_views',    v_total_views,
    'days',           v_days,
    'daily',          v_daily,
    'generated_at',   now()
  );
end;
$$;

comment on function public.app_visit_stats(text, integer) is '📊 접속자 통계(관리자) — 오늘/누적 고유 접속자 + 최근 p_days 일 일별 추이(빈 날 0 포함)';

revoke all on function public.app_visit_stats(text, integer) from public;
revoke all on function public.app_visit_stats(text, integer) from anon;
grant execute on function public.app_visit_stats(text, integer) to authenticated;

-- 6. PostgREST 스키마 캐시 새로 고침 ──────────────────────────
notify pgrst, 'reload schema';
