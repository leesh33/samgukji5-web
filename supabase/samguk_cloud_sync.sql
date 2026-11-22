-- ─────────────────────────────────────────────────────────────
-- 「도트삼국」 · ☁️ 구글·카카오 로그인 · 클라우드 저장 동기화 — Supabase 스키마
-- 프로젝트: zdcdvjlssncsawpqsjwe (릴스핀·인생 한 턴과 같은 공용 프로젝트)
-- Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여 넣고 Run.
--
--   · public.samguk_saves   로그인한 사람의 저장 슬롯 한 벌 (사람 1명당 1행)
--       slots = { "auto": {raw, at}, "1": {raw, at}, "2": …, "3": … }
--   · RLS                   자기 행만 읽고 쓰기 — auth.uid() = user_id
--   · 저장은 RPC(security definer) samguk_put_saves 하나로만.
--                           (기기 시계가 뒤로 가도 최신 기록이 되돌아가지 않게)
--   · 앱은 anon(publishable) 키 + 로그인 토큰 + RLS 로만 동작한다. service_role 키는 쓰지 않는다.
--   · 다른 앱 테이블(life_sim_*, pins 등)은 건드리지 않는다.
-- 다시 실행해도 안전(idempotent).
-- ─────────────────────────────────────────────────────────────

-- 1. 테이블 ──────────────────────────────────────────────────
create table if not exists public.samguk_saves (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  slots       jsonb       not null default '{}'::jsonb,
  revised_at  bigint      not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.samguk_saves is '「도트삼국」 클라우드 저장 — 사람 1명당 1행(자동 저장·슬롯 1~3)';
comment on column public.samguk_saves.slots is '{ auto|1|2|3 : { raw: "engine.serialize(state)", at: 저장시각(ms) } }';
comment on column public.samguk_saves.revised_at is '앱이 붙인 논리 시각(ms). 이보다 과거 상태로는 덮어쓰지 않는다';

-- 값 검증 — 앱 버그가 아니라 DB가 마지막으로 막아 준다.
alter table public.samguk_saves drop constraint if exists samguk_saves_slots_obj_chk;
alter table public.samguk_saves add  constraint samguk_saves_slots_obj_chk
  check (jsonb_typeof(slots) = 'object');
alter table public.samguk_saves drop constraint if exists samguk_saves_slots_size_chk;
alter table public.samguk_saves add  constraint samguk_saves_slots_size_chk
  check (pg_column_size(slots) <= 2097152);          -- 2MB (슬롯 4개 × 게임 상태 30~80KB)
alter table public.samguk_saves drop constraint if exists samguk_saves_revised_chk;
alter table public.samguk_saves add  constraint samguk_saves_revised_chk
  check (revised_at >= 0);

-- 2. RLS ──────────────────────────────────────────────────────
alter table public.samguk_saves enable row level security;

drop policy if exists samguk_saves_read on public.samguk_saves;
create policy samguk_saves_read
  on public.samguk_saves for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists samguk_saves_insert on public.samguk_saves;
create policy samguk_saves_insert
  on public.samguk_saves for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists samguk_saves_update on public.samguk_saves;
create policy samguk_saves_update
  on public.samguk_saves for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists samguk_saves_delete on public.samguk_saves;
create policy samguk_saves_delete
  on public.samguk_saves for delete
  to authenticated
  using (auth.uid() = user_id);

-- 3. 테이블 권한 (anon 에게는 아무것도 주지 않는다) ─────────────
revoke all on public.samguk_saves from anon;
grant select, insert, update, delete on public.samguk_saves to authenticated;

-- 4. 저장 함수 — 최신 기록만 남기는 upsert ────────────────────
--    · auth.uid() 가 없으면 거부 (비로그인 저장 불가)
--    · 들어온 revised_at 이 저장된 것보다 과거면 덮어쓰지 않고 지금 상태를 돌려준다
--      → 앱은 돌려받은 값이 자기 것과 다르면 다시 합쳐서 올린다
create or replace function public.samguk_put_saves(p_slots jsonb, p_revised_at bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'object' then
    raise exception 'slots must be a json object' using errcode = '22023';
  end if;
  if p_revised_at is null or p_revised_at < 0 then
    raise exception 'revised_at must be >= 0' using errcode = '22023';
  end if;

  insert into public.samguk_saves (user_id, slots, revised_at, created_at, updated_at)
  values (v_uid, p_slots, p_revised_at, now(), now())
  on conflict (user_id) do update
     set slots      = case when excluded.revised_at >= public.samguk_saves.revised_at then excluded.slots
                           else public.samguk_saves.slots end,
         revised_at = greatest(public.samguk_saves.revised_at, excluded.revised_at),
         updated_at = case when excluded.revised_at >= public.samguk_saves.revised_at then now()
                           else public.samguk_saves.updated_at end
  returning slots into v_out;

  return v_out;
end;
$$;

comment on function public.samguk_put_saves(jsonb, bigint) is '「도트삼국」 동기화 저장 — 본인 행 upsert, 과거 상태는 무시하고 현재 상태를 돌려준다';

revoke all on function public.samguk_put_saves(jsonb, bigint) from public;
revoke all on function public.samguk_put_saves(jsonb, bigint) from anon;
grant execute on function public.samguk_put_saves(jsonb, bigint) to authenticated;

-- 5. PostgREST 스키마 캐시 새로 고침 ──────────────────────────
notify pgrst, 'reload schema';

-- 6. 확인용 ───────────────────────────────────────────────────
-- select relrowsecurity from pg_class where oid = 'public.samguk_saves'::regclass;   -- t
-- select policyname, cmd from pg_policies where tablename = 'samguk_saves';
