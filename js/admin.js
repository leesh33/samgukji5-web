/* ─────────────────────────────────────────────
   admin.js — 📊 삼국 한 턴 어드민 (/admin.html)
   ─────────────────────────────────────────────
   · 접속자 통계만 보여 주는 작은 관리자 화면입니다.
   · 로그인(구글·카카오)과 세션은 js/sync.js 의 것을 그대로 씁니다 —
     게임(index.html)에서 로그인했으면 그 세션이 그대로 살아 있습니다.
   · 통계는 Supabase RPC `app_visit_stats('samguk-han-turn', days)` 로만 받습니다.
     DB 함수가 `auth.jwt() ->> 'email'` 로 **관리자인지 다시 확인**하므로,
     화면의 이메일 목록은 버튼·안내를 보여 줄지 정하는 데만 씁니다.
   · 14일 / 30일 추이는 외부 차트 라이브러리 없이 div 막대로 그립니다.
   ───────────────────────────────────────────── */
import { AdminBridge } from './sync.js';
import { displayEmail } from './sync-core.js';

const SUPABASE_URL = 'https://zdcdvjlssncsawpqsjwe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pLkbspw3eIAOO41uVSr-tA_9Asecqzq';
const RPC_STATS = 'app_visit_stats';
const APP_ID = 'samguk-han-turn';
const ADMIN_EMAILS = ['andy.leesh33@gmail.com', 'shhy@kakao.com'];
const DAY_OPTIONS = [14, 30];
export { ADMIN_EMAILS, DAY_OPTIONS };

/* 로그인·세션 창구 — 테스트에서 바꿔 끼울 수 있게 한 겹 둔다 */
let bridge = AdminBridge;
export function __setBridge(next) { bridge = next || AdminBridge; }

export const state = { days: 14, data: null, loading: false, gate: '', message: '', who: '' };

const $ = (id) => (globalThis.document ? globalThis.document.getElementById(id) : null);
function el(tag, cls, text) {
  const node = globalThis.document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = String(text);
  return node;
}
function session() {
  try { return bridge && typeof bridge.session === 'function' ? bridge.session() : null; } catch (e) { return null; }
}
function email() {
  const s = session();
  return displayEmail(s && s.user);
}
export function isAdminEmail(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  return !!v && ADMIN_EMAILS.indexOf(v) >= 0;
}
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);
export function shortDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return m ? m[2] + '.' + m[3] : '';
}
const comma = (v) => String(Math.round(num(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 막대 높이(%)·라벨 — daily 배열을 그대로 그릴 수 있게 다듬는다 */
export function buildBars(daily, days) {
  const list = Array.isArray(daily) ? daily : [];
  let max = 1;
  for (let i = 0; i < list.length; i++) max = Math.max(max, num(list[i] && list[i].visitors));
  const every = days > 20 ? 5 : 3;
  return list.map((row, index) => {
    const visitors = num(row && row.visitors);
    const views = num(row && row.views);
    const height = Math.round((visitors / max) * 100);
    return {
      date: String((row && row.date) || ''),
      label: shortDay(row && row.date),
      visitors,
      views,
      height: visitors > 0 ? Math.max(4, height) : 0,
      // 마지막 라벨과 붙는 주기 라벨은 건너뛰어 겹쳐 보이지 않게 한다
      showLabel: index === list.length - 1 || (index % every === 0 && index < list.length - 2)
    };
  });
}

export function fetchStats(days, token) {
  const doFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch : null;
  if (!doFetch) return Promise.reject(new Error('네트워크를 쓸 수 없어요'));
  return doFetch(SUPABASE_URL + '/rest/v1/rpc/' + RPC_STATS, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_app_id: APP_ID, p_days: days })
  }).then((res) => res.text().then((raw) => {
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
    return { ok: !!res.ok, status: res.status, body };
  }));
}

/* ── 화면 ── */
function showGate(kind, message) {
  state.gate = kind;
  state.message = message || '';
  const gate = $('adminGate');
  const stats = $('adminStats');
  if (stats) stats.hidden = kind !== '';
  if (!gate) return;
  gate.hidden = kind === '';
  gate.innerHTML = '';
  if (kind === 'signedOut') {
    gate.appendChild(el('p', 'gate-lead', '관리자 계정으로 로그인해 주세요'));
    gate.appendChild(el('p', 'gate-sub', '삼국 한 턴을 플레이할 때 쓰는 계정으로 로그인하면 통계를 볼 수 있어요.'));
    const row = el('div', 'gate-btns');
    const google = el('button', 'gate-btn', '구글로 로그인');
    google.type = 'button';
    google.addEventListener('click', () => {
      if (!bridge || typeof bridge.signIn !== 'function') return toast('로그인을 시작할 수 없어요');
      Promise.resolve(bridge.signIn('google')).catch(() => toast('로그인을 시작하지 못했어요'));
    });
    const kakao = el('button', 'gate-btn kakao', '카카오로 로그인');
    kakao.type = 'button';
    kakao.addEventListener('click', () => {
      if (!bridge || typeof bridge.signIn !== 'function') return toast('로그인을 시작할 수 없어요');
      Promise.resolve(bridge.signIn('kakao')).catch(() => toast('로그인을 시작하지 못했어요'));
    });
    row.appendChild(google);
    row.appendChild(kakao);
    gate.appendChild(row);
  } else if (kind === 'denied') {
    gate.appendChild(el('p', 'gate-lead', '이 계정에는 어드민 권한이 없어요'));
    gate.appendChild(el('p', 'gate-sub', '로그인한 계정: ' + (email() || '알 수 없음')));
    const out = el('button', 'gate-btn ghost', '다른 계정으로 로그인');
    out.type = 'button';
    out.addEventListener('click', () => {
      if (bridge && typeof bridge.signOut === 'function') bridge.signOut();
      setTimeout(() => location.reload(), 200);
    });
    gate.appendChild(out);
  } else if (kind === 'error') {
    gate.appendChild(el('p', 'gate-lead', '통계를 불러오지 못했어요'));
    gate.appendChild(el('p', 'gate-sub', message || '잠시 뒤 다시 시도해 주세요.'));
    const retry = el('button', 'gate-btn', '다시 시도');
    retry.type = 'button';
    retry.addEventListener('click', () => { load(state.days); });
    gate.appendChild(retry);
  }
}

function renderChart(daily, days) {
  const box = $('visitChart');
  if (!box) return;
  const bars = buildBars(daily, days);
  box.innerHTML = '';
  if (!bars.length) {
    box.appendChild(el('p', 'chart-empty', '아직 기록이 없어요.'));
    return;
  }
  bars.forEach((bar) => {
    const col = el('div', 'bar-col');
    col.setAttribute('role', 'img');
    col.setAttribute('aria-label', bar.label + ' 접속자 ' + bar.visitors + '명 · 조회 ' + bar.views + '회');
    col.appendChild(el('span', 'bar-value', bar.visitors > 0 ? bar.visitors : ''));
    const track = el('span', 'bar-track');
    const fill = el('span', 'bar-fill' + (bar.visitors > 0 ? '' : ' zero'));
    fill.style.height = (bar.visitors > 0 ? bar.height : 2) + '%';
    track.appendChild(fill);
    col.appendChild(track);
    col.appendChild(el('span', 'bar-day', bar.showLabel ? bar.label : ''));
    box.appendChild(col);
  });
  const hint = $('chartHint');
  if (hint) hint.textContent = '막대 = 그날 접속한 사람 수(순 방문자) · 최근 ' + days + '일 · 한국 시간 기준';
}

function render() {
  const data = state.data || {};
  const today = $('kpiToday');
  const total = $('kpiTotal');
  const who = $('adminWho');
  if (today) today.textContent = data.today_visitors != null ? comma(data.today_visitors) : '—';
  if (total) total.textContent = data.total_visitors != null ? comma(data.total_visitors) : '—';
  if (who) who.textContent = email() ? email() + ' · 관리자' : '';
  const sub = $('adminSub');
  if (sub && data.today_views != null) {
    sub.textContent = '오늘 조회 ' + comma(data.today_views) + '회 · 누적 조회 ' + comma(data.total_views) + '회';
  }
  const buttons = globalThis.document ? globalThis.document.querySelectorAll('.range-btn') : [];
  for (let i = 0; i < buttons.length; i++) {
    const on = num(buttons[i].getAttribute('data-days')) === num(state.days);
    buttons[i].classList.toggle('active', on);
    buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  if (state.gate === '') {
    renderChart(data.daily, num(data.days) || state.days);
    showGate('');
  }
}

function toast(message) {
  const node = $('adminToast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  globalThis.setTimeout(() => { node.hidden = true; }, 2600);
}

export function load(days) {
  state.days = DAY_OPTIONS.indexOf(num(days)) >= 0 ? num(days) : 14;
  state.loading = true;
  if (!session()) {
    showGate('signedOut');
    return Promise.resolve(null);
  }
  if (!isAdminEmail(email())) {
    showGate('denied');
    return Promise.resolve(null);
  }
  if (!bridge || typeof bridge.token !== 'function') {
    showGate('error', '로그인 정보를 읽을 수 없어요.');
    return Promise.resolve(null);
  }
  return Promise.resolve()
    .then(() => bridge.token())
    .then((token) => fetchStats(state.days, token))
    .then((res) => {
      if (res.ok) {
        state.data = res.body || {};
        showGate('');
        render();
        return state.data;
      }
      const body = res.body || {};
      const message = String(body.message || body.error_description || '');
      if (res.status === 404 || body.code === 'PGRST202' || /does not exist|schema cache/i.test(message)) {
        showGate('error', '통계 DB 가 아직 준비되지 않았어요. Supabase SQL Editor 에서 supabase/app_visits.sql 을 실행해 주세요.');
      } else if (res.status === 401 || res.status === 403) {
        showGate('denied');
      } else {
        showGate('error', message || '잠시 뒤 다시 시도해 주세요.');
      }
      return null;
    }).catch(() => {
      showGate('error', '네트워크에 연결하지 못했어요.');
      return null;
    }).then((out) => {
      state.loading = false;
      return out;
    });
}

function wire() {
  const buttons = globalThis.document ? globalThis.document.querySelectorAll('.range-btn') : [];
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', (e) => {
      const days = num(e.currentTarget.getAttribute('data-days'));
      if (days === state.days) return;
      load(days);
    });
  }
  const refresh = $('adminRefresh');
  if (refresh) refresh.addEventListener('click', () => { load(state.days); });
  const out = $('adminSignOut');
  if (out) {
    out.addEventListener('click', () => {
      if (bridge && typeof bridge.signOut === 'function') bridge.signOut();
      state.data = null;
      globalThis.setTimeout(() => showGate('signedOut'), 150);
    });
  }
}

export function start() {
  if (!globalThis.document) return;
  wire();
  // OAuth 리다이렉트로 돌아온 경우(?code=…) — sync.js 가 세션을 마무리하게 한다
  if (/[?&](code|error_description)=/.test(String(globalThis.location ? globalThis.location.search : ''))) {
    if (bridge && typeof bridge.completeRedirect === 'function') {
      return Promise.resolve(bridge.completeRedirect()).then(() => load(state.days)).catch(() => load(state.days));
    }
  }
  return load(state.days);
}

if (typeof globalThis.document !== 'undefined' && globalThis.document) {
  if (globalThis.document.readyState === 'loading') {
    globalThis.document.addEventListener('DOMContentLoaded', () => { start(); });
  } else {
    start();
  }
}
