/* 📊 접속자 통계·어드민 테스트 — 익명 방문자 id(기기별 저장·재사용) · 화면당 1회 기록 ·
   samguk-han-turn 구분 · 관리자 화면(/admin.html) 막대 계산 · 관리자 이메일 게이트 · DB 확장 SQL
   네트워크는 흉내 낸다(실서버는 라이브 390×844 검증에서 확인). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SamgukVisits } from '../js/visits.js';
import {
  __setBridge, buildBars, shortDay, isAdminEmail, fetchStats, load, state,
  ADMIN_EMAILS, DAY_OPTIONS,
} from '../js/admin.js';

const read = (rel) => readFileSync(fileURLToPath(new URL('../' + rel, import.meta.url)), 'utf8');
const INDEX = read('index.html');
const ADMIN_HTML = read('admin.html');
const ADMIN_JS = read('js/admin.js');
const VISITS = read('js/visits.js');
const MAIN = read('js/main.js');
const UI = read('js/ui.js');
const SQL = read('supabase/app_visits.sql');
const README = read('README.md');

/* ── 브라우저 흉내 (localStorage · fetch) ── */
function fakeStore() {
  const map = new Map();
  return {
    map,
    api: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); }
    }
  };
}
function withBrowser({ storage, fetchImpl } = {}) {
  const store = storage || fakeStore();
  const calls = [];
  const prev = {
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    fetch: globalThis.fetch,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store.api, configurable: true, writable: true });
  globalThis.fetch = (url, init) => {
    calls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null });
    return fetchImpl ? fetchImpl(url, init) : Promise.reject(new Error('예상하지 못한 요청'));
  };
  return {
    store, calls,
    restore() {
      if (prev.localStorage) Object.defineProperty(globalThis, 'localStorage', prev.localStorage);
      else delete globalThis.localStorage;
      globalThis.fetch = prev.fetch;
      SamgukVisits._test.reset();
    }
  };
}
const okRes = (body) => ({
  ok: true, status: 200,
  text: () => Promise.resolve(body == null ? '' : JSON.stringify(body)),
  json: () => Promise.resolve(body),
});

/* ── ① 방문자 id ─────────────────────────────────────── */
test('방문자 id: UUID 모양 · localStorage 저장 · 다시 열어도 같은 사람', () => {
  const env = withBrowser();
  try {
    const id1 = SamgukVisits.visitorId();
    const id2 = SamgukVisits.visitorId();
    assert.match(id1, /^[A-Za-z0-9_-]{8,64}$/);
    assert.equal(env.store.map.get('samguk5.visit.id.v1'), id1, '이 기기 키에 저장');
    assert.equal(id1, id2, '같은 사람');
  } finally { env.restore(); }
});

test('방문자 id: 저장값이 규칙에 안 맞으면 새로 만든다', () => {
  const store = fakeStore();
  store.map.set('samguk5.visit.id.v1', 'x');
  const env = withBrowser({ storage: store });
  try {
    const fixed = SamgukVisits.visitorId();
    assert.notEqual(fixed, 'x');
    assert.match(fixed, /^[A-Za-z0-9_-]{8,64}$/);
  } finally { env.restore(); }
});

test('방문 규칙: app_id 는 samguk-han-turn · 키 이름 samguk5', () => {
  assert.equal(SamgukVisits.config.appId, 'samguk-han-turn');
  assert.equal(SamgukVisits.config.rpc, 'app_visit_track');
  assert.equal(SamgukVisits.config.key, 'samguk5.visit.id.v1');
  assert.match(SamgukVisits.config.anonKey, /^sb_publishable_/);
});

/* ── ② 화면당 1회 기록 ───────────────────────────────── */
test('방문 기록: 한 번만 보내고, app_id·visitor_id 만 담는다', async () => {
  const env = withBrowser({ fetchImpl: () => Promise.resolve(okRes({ ok: true, views: 1 })) });
  try {
    const r1 = await SamgukVisits.track();
    const r2 = await SamgukVisits.track();
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, false);
    assert.equal(r2.reason, 'already-tracked');
    assert.equal(env.calls.length, 1, '요청은 1번');
    assert.ok(env.calls[0].url.endsWith('/rest/v1/rpc/app_visit_track'));
    assert.deepEqual(Object.keys(env.calls[0].body).sort(), ['p_app_id', 'p_visitor_id']);
    assert.equal(env.calls[0].body.p_app_id, 'samguk-han-turn');
    assert.equal(env.calls[0].body.p_visitor_id, env.store.map.get('samguk5.visit.id.v1'));
    assert.match(env.calls[0].init.headers.apikey, /^sb_publishable_/);
    assert.ok(env.calls[0].init.headers.Authorization.startsWith('Bearer sb_publishable_'));
  } finally { env.restore(); }
});

test('방문 기록: 네트워크가 실패해도 조용히 넘어간다', async () => {
  const env = withBrowser({ fetchImpl: () => Promise.reject(new Error('offline')) });
  try {
    const r = await SamgukVisits.track();
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'network');
  } finally { env.restore(); }
});

test('방문 기록: 서버가 400 이면 조용히 실패로 남는다', async () => {
  const env = withBrowser({ fetchImpl: () => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) }) });
  try {
    const r = await SamgukVisits.track();
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'http-400');
  } finally { env.restore(); }
});

/* ── ③ 관리자 이메일 게이트 ───────────────────────────── */
test('어드민: 관리자 이메일 2개 · 대소문자·공백 무시', () => {
  assert.equal(ADMIN_EMAILS.length, 2);
  assert.ok(isAdminEmail(' ANDY.leesh33@gmail.com '));
  assert.ok(isAdminEmail('shhy@kakao.com'));
  assert.ok(!isAdminEmail('someone@example.com'));
  assert.ok(!isAdminEmail(''));
  assert.ok(!isAdminEmail(null));
  assert.deepEqual(SamgukVisits.ADMIN_EMAILS, ADMIN_EMAILS, '방문 기록 쪽 목록과 같다');
  assert.ok(SamgukVisits.isAdmin('andy.leesh33@gmail.com'));
  assert.ok(!SamgukVisits.isAdmin('nope@example.com'));
});

/* ── ④ 막대 계산 ─────────────────────────────────────── */
test('막대: 높이 %·날짜 라벨·0명 처리', () => {
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const day = String(26 - i).padStart(2, '0');
    daily.push({ date: `2026-11-${day}`, visitors: i % 4 === 0 ? 0 : (14 - i) * 2, views: 1 });
  }
  const bars = buildBars(daily, 14);
  assert.equal(bars.length, 14);
  assert.equal(Math.max(...bars.map((b) => b.height)), 100, '가장 큰 값이 100%');
  assert.ok(bars.filter((b) => b.visitors === 0).every((b) => b.height === 0), '0명은 높이 0');
  assert.equal(bars[0].label, '11.13');
  assert.equal(bars[13].label, '11.26');
  assert.equal(bars[13].showLabel, true, '마지막 날은 항상 라벨');
  assert.equal(buildBars(new Array(30).fill(0).map((_, i) => ({ date: '2026-11-01', visitors: i, views: i })), 30).length, 30);
  assert.deepEqual(buildBars(null, 14), [], '기록이 없으면 빈 배열');
  assert.equal(shortDay('2026-11-26'), '11.26');
  assert.equal(shortDay(''), '');
});

/* ── ⑤ 통계 요청 ─────────────────────────────────────── */
test('통계 요청: app_visit_stats · samguk-han-turn · 일수 · 본인 토큰', async () => {
  const env = withBrowser({ fetchImpl: () => Promise.resolve(okRes({ today_visitors: 3, total_visitors: 40, daily: [] })) });
  try {
    const res = await fetchStats(14, 'token-abc');
    assert.ok(env.calls[0].url.endsWith('/rest/v1/rpc/app_visit_stats'));
    assert.equal(env.calls[0].body.p_app_id, 'samguk-han-turn');
    assert.equal(env.calls[0].body.p_days, 14);
    assert.equal(env.calls[0].init.headers.Authorization, 'Bearer token-abc');
    assert.equal(res.ok, true);
    assert.equal(res.body.total_visitors, 40);
  } finally { env.restore(); }
});

test('어드민: 로그인 전에는 통계를 부르지 않고 안내만', async () => {
  __setBridge({ session: () => null, token: () => Promise.reject(new Error('no session')) });
  const env = withBrowser();
  try {
    const out = await load(14);
    assert.equal(out, null);
    assert.equal(env.calls.length, 0);
    assert.equal(state.gate, 'signedOut');
  } finally { env.restore(); __setBridge(null); }
});

test('어드민: 비관리자는 요청 없이 denied', async () => {
  const SESSION = { access_token: 'tok', user: { id: 'u-1', email: 'someone@example.com' } };
  __setBridge({ session: () => SESSION, token: () => Promise.resolve('tok') });
  const env = withBrowser();
  try {
    const out = await load(14);
    assert.equal(out, null);
    assert.equal(env.calls.length, 0);
    assert.equal(state.gate, 'denied');
  } finally { env.restore(); __setBridge(null); }
});

test('어드민: 관리자는 통계를 받아 온다(14일)', async () => {
  const SESSION = { access_token: 'tok', user: { id: 'u-admin', email: 'andy.leesh33@gmail.com' } };
  __setBridge({
    session: () => SESSION,
    token: () => Promise.resolve('tok'),
    signIn: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
    completeRedirect: () => Promise.resolve({ handled: false }),
  });
  const env = withBrowser({
    fetchImpl: () => Promise.resolve(okRes({ today_visitors: 5, total_visitors: 88, today_views: 9, total_views: 200, days: 14, daily: [] })),
  });
  try {
    const out = await load(14);
    const statCalls = env.calls.filter((c) => c.url.endsWith('/rpc/app_visit_stats'));
    assert.ok(statCalls.length >= 1, '통계를 부른다');
    assert.ok(statCalls.every((c) => c.body.p_app_id === 'samguk-han-turn' && c.body.p_days === 14));
    assert.equal(out.total_visitors, 88);
    assert.equal(state.gate, '');
  } finally { env.restore(); __setBridge(null); }
});

test('어드민: 30일로 바꾸면 30일을 부르고, 그 밖의 값은 14일', async () => {
  __setBridge({ session: () => ({ user: { email: 'shhy@kakao.com' } }), token: () => Promise.resolve('tok') });
  const env = withBrowser({ fetchImpl: () => Promise.resolve(okRes({ days: 30, daily: [] })) });
  try {
    await load(30);
    await load(7);
    const days = env.calls.map((c) => c.body.p_days);
    assert.deepEqual(days, [30, 14]);
    assert.deepEqual(DAY_OPTIONS, [14, 30]);
  } finally { env.restore(); __setBridge(null); }
});

test('어드민: 403 이면 권한 없음 안내, 404 면 DB 준비 안내', async () => {
  __setBridge({ session: () => ({ user: { email: 'andy.leesh33@gmail.com' } }), token: () => Promise.resolve('tok') });
  let env = withBrowser({ fetchImpl: () => Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('{"message":"forbidden"}') }) });
  try {
    await load(14);
    assert.equal(state.gate, 'denied');
  } finally { env.restore(); }
  env = withBrowser({ fetchImpl: () => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('{"code":"PGRST202"}') }) });
  try {
    await load(14);
    assert.equal(state.gate, 'error');
    assert.match(state.message, /SQL/);
  } finally { env.restore(); __setBridge(null); }
});

/* ── ⑥ 화면·연결 ─────────────────────────────────────── */
test('첫 화면: main.js 가 visits.js 를 싣는다', () => {
  assert.match(MAIN, /import '\.\/visits\.js'/);
  assert.match(MAIN, /boot/);
  assert.ok(!/src="js\/visits\.js"/.test(INDEX), 'script 태그를 더하지 않는다(네이티브 한 파일 빌드가 깨지지 않게)');
});

test('정보 패널: 관리자일 때만 📊 어드민 링크', () => {
  assert.match(UI, /function adminLinkHTML/);
  assert.match(UI, /window\.SamgukVisits/);
  assert.match(UI, /V\.isAdmin\(email\)/);
  assert.match(UI, /href="admin\.html"/);
  assert.match(UI, /infoTabHTML\(\) \+ adminLinkHTML\(\)/, '정보 패널 맨 아래');
});

test('상단 지도 바 3버튼은 그대로', () => {
  const bar = INDEX.slice(INDEX.indexOf('<div class="mapbar">'), INDEX.indexOf('<div class="mapctrl">'));
  assert.deepEqual([...bar.matchAll(/data-act="(region-menu|jump-region|info)"/g)].map((m) => m[1]), ['region-menu', 'jump-region', 'info']);
});

test('어드민 화면: 필수 요소·스타일·noindex·외부 차트 없음', () => {
  for (const id of ['kpiToday', 'kpiTotal', 'visitChart', 'data-days="14"', 'data-days="30"', 'adminGate', 'adminStats']) {
    assert.ok(ADMIN_HTML.includes(id), id);
  }
  assert.match(ADMIN_HTML, /noindex/);
  assert.ok(ADMIN_HTML.includes('css/style.css') && ADMIN_HTML.includes('css/admin.css'));
  assert.ok(ADMIN_HTML.includes('GmarketSans-Medium.woff2'));
  assert.ok(ADMIN_HTML.includes('js/admin.js'));
  assert.ok(ADMIN_HTML.includes('href="index.html"'), '게임으로 돌아가는 길');
  assert.ok(!/chart\.js|echarts|victory/i.test(ADMIN_JS + ADMIN_HTML), '외부 차트 라이브러리 없음');
});

test('어드민 화면: 게임과 같은 로그인(sync.js) 창구를 쓴다', () => {
  assert.match(ADMIN_JS, /import \{ AdminBridge \} from '\.\/sync\.js'/);
  assert.match(read('js/sync.js'), /export const AdminBridge/);
  assert.match(ADMIN_JS, /bridge\.signIn\('google'\)/);
  assert.match(ADMIN_JS, /bridge\.token\(\)/);
});

/* ── ⑦ DB 확장 SQL ───────────────────────────────────── */
test('DB: app_visits 를 새로 만들지 않고 허용 목록만 넓힌다', () => {
  assert.ok(SQL.includes("'reelpin', 'life-turn', 'samguk-han-turn'"));
  assert.match(SQL, /alter table public\.app_visits drop constraint if exists app_visits_app_id_check/);
  assert.match(SQL, /add\s+constraint app_visits_app_id_check/);
  assert.ok(!/delete from|truncate|drop table/i.test(SQL), '기존 기록을 지우지 않는다');
  assert.ok(SQL.includes('create or replace function public.app_visit_track'));
  assert.ok(SQL.includes('create or replace function public.app_visit_stats'));
  assert.ok(SQL.includes('generate_series') && SQL.includes('left join'), '빈 날짜 0 채움');
  assert.ok(SQL.includes('enable row level security'));
  assert.ok(!SQL.includes('create policy'));
  assert.ok(SQL.includes("raise exception 'forbidden'"));
  assert.ok(/revoke all on function public\.app_visit_stats\(text, integer\) from anon/.test(SQL));
});

test('문서: README 에 접속자 통계 · /admin.html 설명', () => {
  assert.ok(README.includes('접속자 통계'));
  assert.ok(README.includes('admin.html'));
});
