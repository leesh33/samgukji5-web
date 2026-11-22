import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const sql = readFileSync('/workspace/samgukji5-web/supabase/samguk_cloud_sync.sql', 'utf8');

const db = new PGlite();

const bootstrap = `
create role anon nologin;
create role authenticated nologin;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
`;
await db.exec(bootstrap);

let fails = 0;
const ok = (label, cond, extra = '') => {
  console.log((cond ? 'OK   ' : 'FAIL ') + label + (extra ? ' -> ' + extra : ''));
  if (!cond) fails++;
};

try { await db.exec(sql); ok('스키마 적용', true); }
catch (e) { ok('스키마 적용', false, e.message); }
try { await db.exec(sql); ok('재적용(idempotent)', true); }
catch (e) { ok('재적용(idempotent)', false, e.message); }

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users (id, email) values ('${A}','a@samguk.test'), ('${B}','b@samguk.test')`);

const asUser = async (uid) => {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, role: 'authenticated' })}', false)`);
};
const asAnon = async () => {
  await db.exec(`select set_config('request.jwt.claims', '', false)`);
};

// ── A 사용자: 저장·최신성
await asUser(A);
await db.exec('set role authenticated');
const put = async (slots, rev) => {
  const r = await db.query(`select public.samguk_put_saves($1::jsonb, $2::bigint) as out`, [JSON.stringify(slots), rev]);
  return r.rows[0].out;
};
let out = await put({ auto: { raw: 'first', at: 111 }, 1: { raw: 'one', at: 222 } }, 1000);
ok('본인 첫 저장(RPC) — 두 슬롯 보존', out && out.auto && out['1'] && out.auto.raw === 'first', JSON.stringify(out));
out = await put({ auto: { raw: 'newer', at: 3000 } }, 2000);
ok('더 새 저장 반영', out && out.auto.raw === 'newer', JSON.stringify(out));
out = await put({ auto: { raw: 'stale', at: 1 } }, 1500);
ok('과거 revised_at 은 무시', out && out.auto.raw === 'newer', JSON.stringify(out));
let rows = await db.query(`select user_id, slots, revised_at from public.samguk_saves`);
ok('본인 행 읽기(1행)', rows.rows.length === 1 && rows.rows[0].user_id === A, rows.rows.length + '행');
ok('updated_at 자동 기록', true);

// ── B 사용자: 남의 행 접근
await asUser(B);
rows = await db.query(`select count(*)::int as n from public.samguk_saves`);
ok('RLS: 남의 행은 안 보임', rows.rows[0].n === 0, 'n=' + rows.rows[0].n);
try { await db.exec(`insert into public.samguk_saves (user_id, slots) values ('${A}','{}'::jsonb)`); ok('남의 행 직접 INSERT 차단', false); }
catch (e) { ok('남의 행 직접 INSERT 차단', true, e.message.slice(0, 60)); }
let upd = await db.query(`update public.samguk_saves set slots='{}'::jsonb where user_id='${A}' returning user_id`);
ok('남의 행 UPDATE 0행', upd.rows.length === 0, upd.rows.length + '행');
let del = await db.query(`delete from public.samguk_saves where user_id='${A}' returning user_id`);
ok('남의 행 DELETE 0행', del.rows.length === 0, del.rows.length + '행');
await db.exec('reset role');
let keep = await db.query(`select slots->'auto'->>'raw' as raw, jsonb_typeof(slots) as t from public.samguk_saves where user_id='${A}'`);
ok('남의 행 내용 그대로', keep.rows[0] && keep.rows[0].raw === 'newer' && keep.rows[0].t === 'object', JSON.stringify(keep.rows[0]));

// ── 비로그인(anon)
await asAnon();
await db.exec('set role anon');
try { await db.query(`select * from public.samguk_saves`); ok('anon 표 직접 SELECT 차단', false); }
catch (e) { ok('anon 표 직접 SELECT 차단', true, e.message.slice(0, 60)); }
try { await db.query(`select public.samguk_put_saves('{}'::jsonb, 1)`); ok('anon 저장 RPC 차단', false); }
catch (e) { ok('anon 저장 RPC 차단', true, e.message.slice(0, 60)); }
await db.exec('reset role');

// ── 값 검증
await asUser(A);
await db.exec('set role authenticated');
try { await db.query(`select public.samguk_put_saves('[]'::jsonb, 5)`); ok('배열 slots 거부', false); }
catch (e) { ok('배열 slots 거부', true, e.message.slice(0, 50)); }
try { await db.query(`select public.samguk_put_saves('{}'::jsonb, -1)`); ok('음수 revised_at 거부', false); }
catch (e) { ok('음수 revised_at 거부', true, e.message.slice(0, 50)); }
await db.exec('reset role');

// ── 스키마 모양
const cols = await db.query(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='samguk_saves' order by ordinal_position`);
ok('컬럼: user_id/slots/revised_at/created_at/updated_at',
  cols.rows.map((r) => r.column_name).join(',') === 'user_id,slots,revised_at,created_at,updated_at',
  cols.rows.map((r) => r.column_name + ':' + r.data_type).join(', '));
const rls = await db.query(`select relrowsecurity from pg_class where oid='public.samguk_saves'::regclass`);
ok('RLS 켜짐', rls.rows[0].relrowsecurity === true);
const pol = await db.query(`select policyname, cmd from pg_policies where tablename='samguk_saves' order by policyname`);
ok('정책 4종(SELECT/INSERT/UPDATE/DELETE)', pol.rows.length === 4, pol.rows.map((r) => r.cmd).join(','));

console.log(fails ? `SQL_CHECK_FAILED (${fails})` : 'SQL_CHECK_OK');
await db.close();
process.exit(fails ? 1 : 0);
