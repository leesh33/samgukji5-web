-- ─────────────────────────────────────────────────────────────
-- 「삼국 한 턴」 · ⚔️ 비동기 유저 군단 — 원정 도전장 · 유저 군단 습격
-- 프로젝트: zdcdvjlssncsawpqsjwe (릴스핀·인생 한 턴과 같은 공용 프로젝트)
-- Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여 넣고 Run. 다시 실행해도 안전(idempotent).
--
--   · public.samguk_legions   등록된 군단 한 벌 (기기 1대 = 1군단). 로그인 없이
--                             기기 UUID(localStorage) + 닉네임으로만 참여한다.
--                             프리셋 군단은 device_id 가 null 이다.
--   · public.samguk_battles   원정·습격 한 판의 기록 (battle_key 로 중복 보고를 막는다)
--   · public.samguk_legion_register(...)  군단 등록·갱신 — 서버가 능력치·병력 상한을 다시
--                                          자르고 전력을 **직접 계산**한다(치트 방지).
--   · public.samguk_legion_match(...)     내 전력 구간(0.55~1.85배)의 상대 목록
--   · public.samguk_battle_report(...)    전적 반영 — 같은 battle_key 는 한 번만 센다
--
--   · RLS — 테이블은 RLS 를 켜고 정책을 두지 않는다(직접 select/insert 불가).
--           앱은 anon(publishable) 키로 RPC 만 부른다. service_role 키는 쓰지 않는다.
--   · 다른 앱 테이블(life_sim_*, pins, samguk_saves …)은 건드리지 않는다.
--   · device_id 는 밖으로 내보내지 않는다(samguk_legion_public 이 걸러 낸다).
-- ─────────────────────────────────────────────────────────────

-- 1. 테이블 ──────────────────────────────────────────────────
create table if not exists public.samguk_legions (
  id            uuid        primary key default gen_random_uuid(),
  device_id     text,
  nickname      text        not null,
  lord_name     text        not null default '',
  faction_name  text        not null default '',
  power         int         not null default 0,
  wins          int         not null default 0,
  losses        int         not null default 0,
  troop_total   int         not null default 0,
  city_id       text        not null default 'luoyang',
  city_name     text        not null default '',
  formation     text        not null default 'eorin',
  generals      jsonb       not null default '[]'::jsonb,
  is_preset     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.samguk_legions is '「삼국 한 턴」 비동기 유저 군단 — 기기 1대당 1행, 프리셋은 device_id null';
comment on column public.samguk_legions.power is '서버가 계산한 전력 = ⌊Σ(통솔×12+무력×15+지력×8)/10⌋ + ⌊총병력/12⌋';
comment on column public.samguk_legions.generals is '[{id, ko, lead, war, int, troops, arm, formation}] — 최대 5명';

create unique index if not exists samguk_legions_device_uidx on public.samguk_legions (device_id);

alter table public.samguk_legions drop constraint if exists samguk_legions_shape_chk;
alter table public.samguk_legions add  constraint samguk_legions_shape_chk
  check (jsonb_typeof(generals) = 'array' and power >= 0 and wins >= 0 and losses >= 0 and troop_total between 0 and 60000);

create table if not exists public.samguk_battles (
  id          uuid        primary key default gen_random_uuid(),
  battle_key  text        not null unique,
  kind        text        not null,
  atk_legion  uuid,
  def_legion  uuid,
  winner      text        not null,
  reporter    text        not null default '',
  atk_troops  int         not null default 0,
  def_troops  int         not null default 0,
  atk_loss    int         not null default 0,
  def_loss    int         not null default 0,
  rounds      int         not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.samguk_battles is '「삼국 한 턴」 원정·습격 한 판의 기록 — battle_key 로 중복 보고를 막는다';

alter table public.samguk_battles drop constraint if exists samguk_battles_shape_chk;
alter table public.samguk_battles add  constraint samguk_battles_shape_chk
  check (kind in ('expedition', 'invasion') and winner in ('atk', 'def'));

create index if not exists samguk_battles_atk_idx on public.samguk_battles (atk_legion);
create index if not exists samguk_battles_def_idx on public.samguk_battles (def_legion);

-- 2. RLS — 정책 없음 = 직접 접근 불가, RPC 로만 ─────────────────
alter table public.samguk_legions enable row level security;
alter table public.samguk_battles enable row level security;
revoke all on public.samguk_legions from anon, authenticated;
revoke all on public.samguk_battles from anon, authenticated;

-- 3. 밖으로 내보내는 모양 — device_id 는 빠진다 ────────────────
create or replace function public.samguk_legion_public(l public.samguk_legions)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', l.id,
    'nickname', l.nickname,
    'lordName', l.lord_name,
    'factionName', l.faction_name,
    'power', l.power,
    'wins', l.wins,
    'losses', l.losses,
    'troopTotal', l.troop_total,
    'cityId', l.city_id,
    'cityName', l.city_name,
    'formation', l.formation,
    'generals', l.generals,
    'isPreset', l.is_preset
  );
$$;

-- 4. 군단 등록·갱신 ─────────────────────────────────────────
create or replace function public.samguk_legion_register(
  p_device     text,
  p_nickname   text,
  p_lord       text default '',
  p_faction    text default '',
  p_city_id    text default 'luoyang',
  p_city_name  text default '',
  p_formation  text default 'eorin',
  p_generals   jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nick   text;
  v_gen    jsonb;
  v_n      int;
  v_troops int;
  v_power  int;
  v_row    public.samguk_legions;
begin
  if p_device is null or length(btrim(p_device)) < 8 or length(p_device) > 64 then
    raise exception '기기 식별자가 올바르지 않습니다' using errcode = '22023';
  end if;

  v_nick := left(btrim(regexp_replace(coalesce(p_nickname, ''), '[[:cntrl:]<>"&'']', '', 'g')), 12);
  if v_nick = '' then
    raise exception '군단 이름이 비었습니다' using errcode = '22023';
  end if;

  if jsonb_typeof(p_generals) is distinct from 'array' then
    raise exception '장수 목록 형식이 다릅니다' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_generals);
  if v_n < 1 or v_n > 5 then
    raise exception '군단 장수는 1~5명입니다' using errcode = '22023';
  end if;

  -- 능력치·병력 상한을 서버가 다시 자른다 (앱이 보낸 값을 그대로 믿지 않는다)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',   left(coalesce(e ->> 'id', ''), 24),
           'ko',   left(coalesce(nullif(e ->> 'ko', ''), e ->> 'id', '장수'), 16),
           'lead', least(100, greatest(1, case when (e ->> 'lead') ~ '^[0-9]{1,6}$' then (e ->> 'lead')::int else 1 end)),
           'war',  least(100, greatest(1, case when (e ->> 'war')  ~ '^[0-9]{1,6}$' then (e ->> 'war')::int  else 1 end)),
           'int',  least(100, greatest(1, case when (e ->> 'int')  ~ '^[0-9]{1,6}$' then (e ->> 'int')::int  else 1 end)),
           'troops', least(30000, greatest(0, case when (e ->> 'troops') ~ '^[0-9]{1,9}$' then (e ->> 'troops')::int else 0 end)),
           'arm',  case when e ->> 'arm' in ('보병', '궁병', '기병', '수군') then e ->> 'arm' else '보병' end,
           'formation', left(coalesce(e ->> 'formation', 'eorin'), 16)
         )), '[]'::jsonb)
    into v_gen
    from jsonb_array_elements(p_generals) e;

  if exists (select 1 from jsonb_array_elements(v_gen) g where coalesce(g ->> 'id', '') = '') then
    raise exception '장수 식별자가 비었습니다' using errcode = '22023';
  end if;

  select coalesce(sum((g ->> 'troops')::int), 0) into v_troops from jsonb_array_elements(v_gen) g;
  if v_troops > 60000 then
    raise exception '군단 병력이 너무 많습니다' using errcode = '22023';
  end if;

  -- 전력은 서버가 계산한다 — 앱과 같은 식(js/legion-core.js powerOf)
  select (coalesce(sum((g ->> 'lead')::int * 12 + (g ->> 'war')::int * 15 + (g ->> 'int')::int * 8), 0) / 10)
       + (coalesce(sum((g ->> 'troops')::int), 0) / 12)
    into v_power
    from jsonb_array_elements(v_gen) g;

  insert into public.samguk_legions as L
    (device_id, nickname, lord_name, faction_name, power, troop_total, city_id, city_name, formation, generals, updated_at)
  values
    (btrim(p_device), v_nick, left(coalesce(p_lord, ''), 12), left(coalesce(p_faction, ''), 12), v_power,
     v_troops, left(coalesce(p_city_id, 'luoyang'), 16), left(coalesce(p_city_name, ''), 16),
     left(coalesce(p_formation, 'eorin'), 16), v_gen, now())
  on conflict (device_id) do update
    set nickname     = excluded.nickname,
        lord_name    = excluded.lord_name,
        faction_name = excluded.faction_name,
        power        = excluded.power,
        troop_total  = excluded.troop_total,
        city_id      = excluded.city_id,
        city_name    = excluded.city_name,
        formation    = excluded.formation,
        generals     = excluded.generals,
        is_preset    = false,
        updated_at   = now()
  returning * into v_row;

  return public.samguk_legion_public(v_row);
end;
$$;

-- 5. 원정 상대 목록 — 내 전력 구간에서 가까운 순 ───────────────
create or replace function public.samguk_legion_match(
  p_device text,
  p_power  int default 1200,
  p_limit  int default 5
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mine public.samguk_legions;
  v_lim  int := least(greatest(coalesce(p_limit, 5), 1), 10);
  v_pow  int := greatest(coalesce(p_power, 1200), 100);
  v_lo   int := greatest(200, (greatest(coalesce(p_power, 1200), 100) * 55) / 100);
  v_hi   int := (greatest(coalesce(p_power, 1200), 100) * 185) / 100;
  v_list jsonb;
begin
  select * into v_mine from public.samguk_legions where device_id = btrim(coalesce(p_device, '')) limit 1;

  select coalesce(jsonb_agg(public.samguk_legion_public(x)), '[]'::jsonb)
    into v_list
    from (
      select l.*
        from (
          select l.*,
                 row_number() over (order by (abs(l.power - v_pow) * (0.7 + random() * 0.6))) as rn,
                 (l.power between v_lo and v_hi) as inband
            from public.samguk_legions l
           where (v_mine.id is null or l.id <> v_mine.id)
             and (v_mine.device_id is null or l.device_id is distinct from v_mine.device_id)
        ) l
       order by l.inband desc, abs(l.power - v_pow), l.rn
       limit v_lim
    ) x;

  return jsonb_build_object(
    'mine', case when v_mine.id is null then null else public.samguk_legion_public(v_mine) end,
    'band', jsonb_build_array(v_lo, v_hi),
    'list', v_list
  );
end;
$$;

-- 6. 전적 반영 — 같은 battle_key 는 한 번만 ────────────────────
create or replace function public.samguk_battle_report(
  p_device   text,
  p_key      text,
  p_kind     text,
  p_enemy    uuid,
  p_winner   text,
  p_atk      int default 0,
  p_def      int default 0,
  p_atk_loss int default 0,
  p_def_loss int default 0,
  p_rounds   int default 0
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mine  public.samguk_legions;
  v_foe   public.samguk_legions;
  v_key   text;
  v_new   uuid;
  v_win   boolean;
  v_kind  text;
begin
  select * into v_mine from public.samguk_legions where device_id = btrim(coalesce(p_device, '')) limit 1;
  if v_mine.id is null then
    return jsonb_build_object('ok', false, 'error', 'legion-not-found');
  end if;
  select * into v_foe from public.samguk_legions where id = p_enemy limit 1;
  if v_foe.id is null then
    return jsonb_build_object('ok', false, 'error', 'opponent-not-found');
  end if;
  if p_winner not in ('atk', 'def') then
    return jsonb_build_object('ok', false, 'error', 'bad-winner');
  end if;
  v_kind := case when p_kind = 'invasion' then 'invasion' else 'expedition' end;
  v_win  := (v_kind = 'invasion' and p_winner = 'def') or (v_kind = 'expedition' and p_winner = 'atk');
  v_key  := left(coalesce(nullif(btrim(p_key), ''), ''), 64);
  if length(v_key) < 6 then
    v_key := left('auto:' || v_mine.id::text || ':' || extract(epoch from now())::bigint || ':' || floor(random() * 100000)::text, 64);
  end if;

  insert into public.samguk_battles
    (battle_key, kind, atk_legion, def_legion, winner, reporter, atk_troops, def_troops, atk_loss, def_loss, rounds)
  values
    (v_key, v_kind,
     case when v_kind = 'invasion' then v_foe.id else v_mine.id end,
     case when v_kind = 'invasion' then v_mine.id else v_foe.id end,
     p_winner, btrim(coalesce(p_device, '')),
     least(60000, greatest(0, coalesce(p_atk, 0))), least(60000, greatest(0, coalesce(p_def, 0))),
     least(60000, greatest(0, coalesce(p_atk_loss, 0))), least(60000, greatest(0, coalesce(p_def_loss, 0))),
     least(99, greatest(0, coalesce(p_rounds, 0))))
  on conflict (battle_key) do nothing
  returning id into v_new;

  if v_new is not null then
    if v_win then
      update public.samguk_legions set wins = wins + 1, updated_at = now() where id = v_mine.id returning * into v_mine;
      update public.samguk_legions set losses = losses + 1, updated_at = now() where id = v_foe.id returning * into v_foe;
    else
      update public.samguk_legions set losses = losses + 1, updated_at = now() where id = v_mine.id returning * into v_mine;
      update public.samguk_legions set wins = wins + 1, updated_at = now() where id = v_foe.id returning * into v_foe;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'applied', v_new is not null,
    'mine', public.samguk_legion_public(v_mine),
    'opponent', public.samguk_legion_public(v_foe)
  );
end;
$$;

-- 7. 권한 — anon(publishable) 키로 RPC 만 ─────────────────────
grant execute on function public.samguk_legion_public(public.samguk_legions) to anon, authenticated;
grant execute on function public.samguk_legion_register(text, text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.samguk_legion_match(text, int, int) to anon, authenticated;
grant execute on function public.samguk_battle_report(text, text, text, uuid, text, int, int, int, int, int) to anon, authenticated;

-- 8. 프리셋 군단 — 처음 온 사람도 바로 겨룰 수 있게 ─────────────
--    device_id 를 비워 두어 매칭에서 '다른 사람'으로 잡히고, 여러 사람의 전적이 함께 쌓인다.
insert into public.samguk_legions
  (id, nickname, lord_name, faction_name, power, troop_total, city_id, city_name, formation, generals, is_preset)
values
  ('a0000000-0000-4000-8000-000000000001', '하북의 서량군', '한수', '서량', 1140, 5500, 'tianshui', '천수', 'hakyik', '[{"id":"lxpre1a","ko":"한수","lead":62,"war":54,"int":51,"troops":1800,"arm":"기병","formation":"hakyik"},{"id":"lxpre1b","ko":"마등","lead":74,"war":82,"int":46,"troops":2200,"arm":"기병","formation":"hakyik"},{"id":"lxpre1c","ko":"방덕","lead":71,"war":78,"int":44,"troops":1500,"arm":"기병","formation":"hakyik"}]', true),
  ('a0000000-0000-4000-8000-000000000002', '강동의 소패왕', '손책', '오', 1831, 10500, 'jianye', '건업', 'bongsi', '[{"id":"lxpre2a","ko":"손책","lead":78,"war":84,"int":62,"troops":3800,"arm":"기병","formation":"bongsi"},{"id":"lxpre2b","ko":"주유","lead":72,"war":58,"int":91,"troops":2600,"arm":"궁병","formation":"bangwon"},{"id":"lxpre2c","ko":"정보","lead":66,"war":70,"int":48,"troops":2200,"arm":"보병","formation":"bangwon"},{"id":"lxpre2d","ko":"한당","lead":64,"war":72,"int":42,"troops":1900,"arm":"보병","formation":"bangwon"}]', true),
  ('a0000000-0000-4000-8000-000000000003', '서촉의 백이병', '유비', '촉', 2159, 13600, 'chengdu', '성도', 'eonwol', '[{"id":"lxpre3a","ko":"관우","lead":84,"war":92,"int":68,"troops":4200,"arm":"기병","formation":"eonwol"},{"id":"lxpre3b","ko":"장비","lead":78,"war":88,"int":40,"troops":4000,"arm":"기병","formation":"eonwol"},{"id":"lxpre3c","ko":"조운","lead":82,"war":86,"int":60,"troops":3600,"arm":"기병","formation":"eonwol"},{"id":"lxpre3d","ko":"법정","lead":58,"war":40,"int":88,"troops":1800,"arm":"궁병","formation":"bangwon"}]', true),
  ('a0000000-0000-4000-8000-000000000004', '중원의 청주병', '조조', '위', 2747, 17700, 'xuchang', '허창', 'jangsa', '[{"id":"lxpre4a","ko":"하후돈","lead":80,"war":86,"int":56,"troops":4400,"arm":"보병","formation":"jangsa"},{"id":"lxpre4b","ko":"장료","lead":84,"war":88,"int":66,"troops":4200,"arm":"기병","formation":"jangsa"},{"id":"lxpre4c","ko":"서황","lead":79,"war":84,"int":58,"troops":3900,"arm":"보병","formation":"jangsa"},{"id":"lxpre4d","ko":"순욱","lead":62,"war":38,"int":92,"troops":2000,"arm":"궁병","formation":"bangwon"},{"id":"lxpre4e","ko":"전위","lead":70,"war":90,"int":32,"troops":3200,"arm":"보병","formation":"jangsa"}]', true),
  ('a0000000-0000-4000-8000-000000000005', '형주의 수군', '유표', '형주', 2520, 16000, 'xiangyang', '양양', 'sujin', '[{"id":"lxpre5a","ko":"황충","lead":78,"war":86,"int":60,"troops":4000,"arm":"궁병","formation":"anhaeng"},{"id":"lxpre5b","ko":"위연","lead":72,"war":82,"int":48,"troops":3800,"arm":"보병","formation":"sujin"},{"id":"lxpre5c","ko":"감녕","lead":70,"war":80,"int":54,"troops":3600,"arm":"수군","formation":"sujin"},{"id":"lxpre5d","ko":"채모","lead":60,"war":62,"int":70,"troops":2400,"arm":"수군","formation":"sujin"},{"id":"lxpre5e","ko":"문빙","lead":58,"war":64,"int":44,"troops":2200,"arm":"보병","formation":"bangwon"}]', true),
  ('a0000000-0000-4000-8000-000000000006', '병주의 철기', '여포', '여포군', 3254, 24400, 'jinyang', '진양', 'chuhaeng', '[{"id":"lxpre6a","ko":"여포","lead":76,"war":98,"int":34,"troops":6400,"arm":"기병","formation":"chuhaeng"},{"id":"lxpre6b","ko":"장료","lead":84,"war":88,"int":66,"troops":5600,"arm":"기병","formation":"chuhaeng"},{"id":"lxpre6c","ko":"고순","lead":70,"war":84,"int":40,"troops":5200,"arm":"기병","formation":"chuhaeng"},{"id":"lxpre6d","ko":"진궁","lead":64,"war":42,"int":90,"troops":3000,"arm":"궁병","formation":"bangwon"},{"id":"lxpre6e","ko":"후성","lead":60,"war":76,"int":38,"troops":4200,"arm":"보병","formation":"jangsa"}]', true),
  ('a0000000-0000-4000-8000-000000000007', '유주 백마의종', '공손찬', '유주', 4438, 39600, 'beiping', '북평', 'hyeongaek', '[{"id":"lxpre7a","ko":"공손찬","lead":74,"war":80,"int":52,"troops":9800,"arm":"기병","formation":"hyeongaek"},{"id":"lxpre7b","ko":"조운","lead":82,"war":86,"int":60,"troops":9400,"arm":"기병","formation":"hyeongaek"},{"id":"lxpre7c","ko":"엄강","lead":62,"war":72,"int":44,"troops":7800,"arm":"보병","formation":"jangsa"},{"id":"lxpre7d","ko":"전예","lead":58,"war":60,"int":62,"troops":6600,"arm":"궁병","formation":"bangwon"},{"id":"lxpre7e","ko":"선우보","lead":56,"war":58,"int":40,"troops":6000,"arm":"기병","formation":"hyeongaek"}]', true)
on conflict (id) do update
  set nickname = excluded.nickname, lord_name = excluded.lord_name, faction_name = excluded.faction_name,
      power = excluded.power, troop_total = excluded.troop_total, city_id = excluded.city_id,
      city_name = excluded.city_name, formation = excluded.formation, generals = excluded.generals,
      is_preset = true;
