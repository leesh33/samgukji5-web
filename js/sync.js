/* ─────────────────────────────────────────────
   sync.js — ☁️ 구글·카카오 로그인 & 클라우드 저장 동기화 (선택)
   ─────────────────────────────────────────────
   · 로그인 없이도 그대로 논다. 로그인은 "기기를 바꿔도 이어서" 쓸 때만.
   · 로그인하면 자동 저장 · 슬롯 1~3 을 Supabase(public.samguk_saves)에 합쳐 올리고 내려받는다.
       - 자동 저장(samguk5.auto) / 수동 슬롯(samguk5.slot1~3)
       - 슬롯마다 마지막 저장 시각(at)이 최신인 쪽을 남긴다. 한쪽에만 있는 슬롯은 지우지 않는다.
   · 저장은 RPC samguk_put_saves 하나로만. revised_at 이 더 과거면 서버가 무시하고
     지금 상태를 돌려주므로, 앱은 돌려받은 값이 다르면 한 번 더 합쳐 올린다.
   · 인증은 Supabase GoTrue 의 OAuth(PKCE) 를 fetch 로 직접 부른다(외부 스크립트 없음).
   ───────────────────────────────────────────── */
import {
  SLOT_KEYS, SLOT_LABEL, normalizeSlots, mergeSlots, same, makeEntry, num,
  parseAuthParams, normalizeSession, sessionUsable, isRefreshDead,
  displayName, displayEmail, describeEntry,
} from './sync-core.js';

const SUPABASE_URL = 'https://zdcdvjlssncsawpqsjwe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pLkbspw3eIAOO41uVSr-tA_9Asecqzq';

const TABLE = 'samguk_saves';
const RPC_PUT = 'samguk_put_saves';

const KEYS = {
  auto: 'samguk5.auto',
  slot: (i) => `samguk5.slot${i}`,
  muted: 'samguk5.muted',
  session: 'samguk5.auth.session.v1',
  pkce: 'samguk5.auth.pkce.v1',
  meta: 'samguk5.sync.meta.v1',
  device: 'samguk5.sync.device.v1',
};

const PUSH_DELAY = 1400;          // 저장 뒤 서버로 올리기까지 (연속 명령을 묶어서)
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const EXPIRED_TEXT = '로그인이 만료됐습니다 · 다시 로그인해 주세요';

const status = { state: 'off', error: '', at: 0 };   // off | syncing | synced | error | expired
let targets = [];
let pushTimer = null;
let inflight = null;
let refreshInflight = null;
let dirty = false;
let hooks = {};
let started = false;

/* ---------- 잡동사니 ---------- */
const now = () => Date.now();
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function store() {
  try { return globalThis.localStorage || null; } catch (e) { return null; }
}
function readRaw(key) {
  const s = store();
  if (!s) return null;
  try { return s.getItem(key); } catch (e) { return null; }
}
function writeRaw(key, value) {
  const s = store();
  if (!s) return;
  try { s.setItem(key, value); } catch (e) { /* 사파리 프라이빗 모드 등 */ }
}
function removeRaw(key) {
  const s = store();
  if (!s) return;
  try { s.removeItem(key); } catch (e) { /* 무시 */ }
}
function readJson(key, fallback) {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try { const v = JSON.parse(raw); return v == null ? fallback : v; } catch (e) { return fallback; }
}
function writeJson(key, value) {
  try { writeRaw(key, JSON.stringify(value)); } catch (e) { /* 무시 */ }
}

/* ---------- 세션 ---------- */
function session() {
  const s = readJson(KEYS.session, null);
  if (!s || !s.access_token || !s.user || !s.user.id) return null;
  return s;
}
function sessionSave(tok) {
  const prev = session();
  const s = normalizeSession(tok, prev, now());
  writeJson(KEYS.session, s);
  return s;
}
function user() { const s = session(); return s ? s.user : null; }

function expireSession() {
  removeRaw(KEYS.session);
  removeRaw(KEYS.pkce);
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  dirty = false;
  setStatus('expired', EXPIRED_TEXT);
}

/* ---------- PKCE ---------- */
function randomString(len) {
  let out = '';
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    const bytes = new Uint8Array(len);
    c.getRandomValues(bytes);
    for (let i = 0; i < len; i++) out += B64URL.charAt(bytes[i] % 64);
    return out;
  }
  for (let i = 0; i < len; i++) out += B64URL.charAt(Math.floor(Math.random() * 64));
  return out;
}
function toB64Url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return globalThis.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function challengeFor(verifier) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) return Promise.resolve('');
  const enc = new globalThis.TextEncoder().encode(verifier);
  return subtle.digest('SHA-256', enc).then(toB64Url);
}

/* ---------- HTTP ---------- */
function api(path, opts = {}) {
  const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
  if (opts.prefer) headers.Prefer = opts.prefer;
  return fetch(SUPABASE_URL + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
    cache: 'no-store',
    credentials: 'omit',
  }).then((res) => res.text().then((text) => {
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + res.status);
      const err = new Error(String(msg));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }));
}

function tokenRefresh() {
  if (refreshInflight) return refreshInflight;
  const s = session();
  if (!s || !s.refresh_token) return Promise.reject(new Error(EXPIRED_TEXT));
  const used = s.refresh_token;
  refreshInflight = api('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: used },
  }).then((tok) => {
    refreshInflight = null;
    return sessionSave(tok).access_token;
  }, (e) => {
    refreshInflight = null;
    const fresh = session();
    // 다른 탭이 먼저 갱신해 리프레시 토큰이 바뀌었으면 그 세션으로 이어 간다
    if (fresh && fresh.refresh_token && fresh.refresh_token !== used && sessionUsable(fresh, now())) {
      return fresh.access_token;
    }
    if (isRefreshDead(e && e.status)) expireSession();
    throw e;
  });
  return refreshInflight;
}

function token() {
  const s = session();
  if (!s) return Promise.reject(new Error(EXPIRED_TEXT));
  if (sessionUsable(s, now())) return Promise.resolve(s.access_token);
  return tokenRefresh();
}

function withToken(fn, retried) {
  let used = '';
  return token().then((t) => { used = t; return fn(t); }).catch((e) => {
    if (!e || e.status !== 401 || retried) throw e;
    const s = session();
    if (!s) throw e;
    let next;
    if (s.access_token && s.access_token !== used && sessionUsable(s, now())) {
      next = Promise.resolve(s.access_token);
    } else if (!s.refresh_token) {
      expireSession();
      throw e;
    } else {
      next = tokenRefresh();
    }
    return next.then(() => withToken(fn, true));
  });
}

function pull() {
  const uid = (user() || {}).id;
  if (!uid) return Promise.resolve(null);
  const path = '/rest/v1/' + TABLE + '?select=slots,revised_at&user_id=eq.' + encodeURIComponent(uid);
  return withToken((t) => api(path, { token: t })).then((rows) => {
    if (!Array.isArray(rows) || !rows.length) return null;
    return { slots: rows[0].slots || {}, revised_at: num(rows[0].revised_at) };
  });
}

function put(slots, at) {
  return withToken((t) => api('/rest/v1/rpc/' + RPC_PUT, {
    method: 'POST',
    token: t,
    body: { p_slots: slots, p_revised_at: num(at) },
  }));
}

/* ---------- 로그인 / 로그아웃 ---------- */
const PROVIDER_LABEL = { google: 'Google', kakao: '카카오' };

function signIn(provider) {
  const p = provider === 'kakao' ? 'kakao' : 'google';
  const base = location.origin + location.pathname;
  const verifier = randomString(56);
  writeJson(KEYS.pkce, { verifier, at: now() });
  setStatus('syncing');
  return challengeFor(verifier).then((challenge) => {
    const url = SUPABASE_URL + '/auth/v1/authorize?provider=' + p +
      '&redirect_to=' + encodeURIComponent(base) +
      (challenge ? '&code_challenge=' + encodeURIComponent(challenge) + '&code_challenge_method=s256' : '');
    location.assign(url);
    return url;
  }).catch((e) => {
    setStatus('error', friendly(e));
    throw e;
  });
}

function signOut() {
  const s = session();
  setStatus('off');
  removeRaw(KEYS.session);
  removeRaw(KEYS.pkce);
  renderAll();
  if (!s) return Promise.resolve();
  return api('/auth/v1/logout', { method: 'POST', token: s.access_token }).catch(() => { /* 토큰 만료 등 */ });
}

function cleanUrl() {
  try { history.replaceState({}, '', location.origin + location.pathname); } catch (e) { /* 무시 */ }
}

/** 구글·카카오에서 돌아온 주소(?code=…)를 세션으로 바꾼다 */
function completeRedirect() {
  const parsed = parseAuthParams(location.search, location.hash);
  if (!parsed.hasAuth) return Promise.resolve({ handled: false, signedIn: false });

  cleanUrl();
  if (parsed.error) {
    const reason = /access_denied|cancel/i.test(parsed.error + ' ' + parsed.description)
      ? '로그인을 취소했습니다'
      : (parsed.description || parsed.error);
    setStatus('error', reason);
    return Promise.resolve({ handled: true, signedIn: false, error: reason });
  }

  let done;
  if (parsed.accessToken) {
    done = Promise.resolve(sessionSave({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
      expires_in: parsed.expiresIn || 3600,
    }));
  } else {
    const pkce = readJson(KEYS.pkce, {}) || {};
    done = api('/auth/v1/token?grant_type=pkce', {
      method: 'POST',
      body: { auth_code: parsed.code, code_verifier: pkce.verifier || '' },
    }).then((tok) => sessionSave(tok));
  }

  return done.then(() => {
    removeRaw(KEYS.pkce);
    setStatus('syncing');
    return { handled: true, signedIn: true };
  }).catch((e) => {
    const msg = friendly(e);
    setStatus('error', msg);
    return { handled: true, signedIn: false, error: msg };
  });
}

/* ---------- 로컬 저장 ↔ 클라우드 ---------- */
function deviceId() {
  let d = readRaw(KEYS.device);
  if (d) return d;
  d = 'd' + now().toString(36) + '-' + randomString(8);
  writeRaw(KEYS.device, d);
  return d;
}

function readLocalSlots() {
  const meta = readJson(KEYS.meta, {}) || {};
  const times = meta.slotAt || {};
  const out = {};
  const autoRaw = readRaw(KEYS.auto);
  if (autoRaw) out.auto = makeEntry(autoRaw, times.auto || 0);
  for (const key of ['1', '2', '3']) {
    const raw = readRaw(KEYS.slot(key));
    if (raw) out[key] = makeEntry(raw, times[key] || 0);
  }
  return out;
}

function slotKeyOf(key) {
  return key === 'auto' ? KEYS.auto : KEYS.slot(key);
}

function applySlots(slots) {
  const meta = readJson(KEYS.meta, {}) || {};
  meta.slotAt = meta.slotAt || {};
  let written = false;
  for (const key of SLOT_KEYS) {
    const entry = slots[key];
    if (!entry) continue;
    const k = slotKeyOf(key);
    if (readRaw(k) !== entry.raw) { writeRaw(k, entry.raw); written = true; }
    meta.slotAt[key] = Math.max(num(meta.slotAt[key]), num(entry.at));
  }
  writeJson(KEYS.meta, meta);
  return written;
}

function localSummary() {
  const slots = readLocalSlots();
  return SLOT_KEYS.filter((k) => slots[k]).map((k) => `${SLOT_LABEL[k]}: ${describeEntry(slots[k])}`);
}

/* 자동 저장·수동 저장이 끝날 때마다 ui 가 부른다 */
export function noteSaved(key = 'auto') {
  const meta = readJson(KEYS.meta, {}) || {};
  meta.slotAt = meta.slotAt || {};
  meta.slotAt[key] = Math.max(num(meta.slotAt[key]), now());
  meta.at = Math.max(num(meta.at), meta.slotAt[key]);
  writeJson(KEYS.meta, meta);
  queuePush();
}

function queuePush() {
  if (!session()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; syncNow(); }, PUSH_DELAY);
}

/* ---------- 동기화 ---------- */
function setStatus(state, error) {
  status.state = state;
  status.error = error || '';
  status.at = now();
  renderAll();
  if (typeof hooks.onStatus === 'function') {
    try { hooks.onStatus({ state, error: status.error, name: session() ? displayName(user()) : '' }); } catch (e) { /* 무시 */ }
  }
}

function notifyApplied() {
  if (typeof hooks.onApplied === 'function') {
    try { hooks.onApplied({ signedIn: !!session(), summary: localSummary() }); } catch (e) { /* 무시 */ }
  }
}

function doSync() {
  const meta = readJson(KEYS.meta, {}) || {};
  const local = readLocalSlots();
  return pull().then((row) => {
    const cloud = row ? normalizeSlots(row.slots) : {};
    const merged = mergeSlots(local, cloud);
    const wrote = applySlots(merged.slots);

    const m = readJson(KEYS.meta, {}) || {};
    let at = Math.max(now(), num(m.at), num(meta.at), row ? num(row.revised_at) : 0) + 1;

    return put(merged.slots, at).then((stored) => {
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        const back = normalizeSlots(stored);
        if (!same(back, merged.slots)) {
          // 서버가 더 새 기록을 갖고 있었다 → 한 번 더 합쳐 올린다
          const again = mergeSlots(merged.slots, back);
          applySlots(again.slots);
          at = Math.max(at, num((readJson(KEYS.meta, {}) || {}).at)) + 1;
          return put(again.slots, at);
        }
      }
      return null;
    }).then(() => {
      const mm = readJson(KEYS.meta, {}) || {};
      mm.at = Math.max(num(mm.at), at);
      writeJson(KEYS.meta, mm);
      setStatus('synced');
      notifyApplied();
      return { wrote, at };
    });
  });
}

export function syncNow() {
  if (!session()) {
    if (status.state !== 'expired') setStatus('off');
    return Promise.resolve(null);
  }
  if (inflight) { dirty = true; return inflight; }
  setStatus('syncing');
  inflight = doSync().then((res) => {
    inflight = null;
    if (!session()) return null;
    if (dirty) { dirty = false; return syncNow(); }
    return res;
  }).catch((e) => {
    inflight = null;
    dirty = false;
    if (!session()) {
      if (status.state !== 'expired') setStatus('expired', EXPIRED_TEXT);
      return null;
    }
    setStatus('error', friendly(e));
    return null;
  });
  return inflight;
}

function friendly(e) {
  const msg = String((e && e.message) || '');
  if (!msg || /Failed to fetch|NetworkError|Load failed|fetch/i.test(msg)) return '네트워크에 연결하지 못했습니다';
  if (isRefreshDead(e && e.status)) return EXPIRED_TEXT;
  if (e && e.status === 401) return '로그인 확인이 필요합니다 · 다시 시도해 주세요';
  if (/redirect_uri_mismatch/i.test(msg)) return '로그인 주소 설정이 맞지 않습니다(redirect_uri_mismatch)';
  if (/provider is not enabled/i.test(msg)) return '이 로그인 방식이 아직 준비되지 않았습니다';
  return msg.slice(0, 60);
}

function shortError(msg) {
  let v = String(msg || '').replace(/\s+/g, ' ').trim();
  if (v.length > 42) v = v.slice(0, 41).trim() + '…';
  return v;
}

/* ---------- 화면(로그인 칩) ---------- */
function render(el) {
  if (!el) return;
  const s = session();
  const compact = el.getAttribute('data-cloud-compact') === '1';
  let html;

  if (!s) {
    const expired = status.state === 'expired';
    const err = status.state === 'error' && status.error;
    html =
      '<div class="acc-row">' +
        '<button type="button" class="acc-pill google" data-cloud="in-google">' +
          '<span class="acc-badge">G</span><span>구글로 로그인</span></button>' +
        '<button type="button" class="acc-pill kakao" data-cloud="in-kakao">' +
          '<span class="acc-badge">K</span><span>카카오로 로그인</span></button>' +
      '</div>' +
      (expired || err
        ? '<div class="acc-note warn">' + esc(status.error || EXPIRED_TEXT) + '</div>'
        : '<div class="acc-note">' + (compact
            ? '로그인하면 저장이 기기 사이로 이어집니다 (선택)'
            : '로그인하면 자동 저장·슬롯 1~3이 기기 사이로 이어집니다 (선택)') + '</div>');
  } else {
    const label = status.state === 'syncing' ? '동기화 중…'
      : status.state === 'error' ? '동기화 실패 · 다시 시도' : '동기화됨';
    const who = displayName(user());
    const mail = displayEmail(user());
    html =
      '<div class="acc-row">' +
        '<button type="button" class="acc-pill on' + (status.state === 'error' ? ' err' : '') +
          '" data-cloud="' + (status.state === 'error' ? 'retry' : 'sync') + '">' +
          '<span class="acc-badge cloud">☁</span><span>' + esc(label) + '</span></button>' +
        '<button type="button" class="acc-out" data-cloud="out">로그아웃</button>' +
      '</div>' +
      '<div class="acc-note">' + esc(who) + (mail ? ' · ' + esc(mail) : '') + '</div>' +
      (status.state === 'error' && status.error
        ? '<div class="acc-note warn">' + esc(shortError(status.error)) + '</div>' : '');
  }

  if (el.innerHTML !== html) el.innerHTML = html;
  el.setAttribute('data-state', status.state);
}

function renderAll() {
  targets = targets.filter((el) => el && el.isConnected !== false);
  targets.forEach(render);
}

export function mount(el) {
  if (!el) return;
  if (targets.indexOf(el) < 0) targets.push(el);
  if (!el.__cloudBound) {
    el.__cloudBound = true;
    el.addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('[data-cloud]') : null;
      if (!btn) return;
      e.preventDefault();
      const act = btn.getAttribute('data-cloud');
      if (act === 'in-google') signIn('google').catch(() => { /* 상태에 표시됨 */ });
      else if (act === 'in-kakao') signIn('kakao').catch(() => { /* 상태에 표시됨 */ });
      else if (act === 'out') signOut();
      else if (act === 'sync') syncNow();
      else if (act === 'retry') syncNow();
    });
  }
  render(el);
}

/* ---------- 부트 ---------- */
export function start(opts = {}) {
  hooks = opts || {};
  if (started) { renderAll(); return Promise.resolve(null); }
  started = true;

  if (typeof hooks.onStatus === 'function' && status.state !== 'off') {
    try { hooks.onStatus({ state: status.state, error: status.error, name: session() ? displayName(user()) : '' }); } catch (e) { /* 무시 */ }
  }

  return completeRedirect().then((redirect) => {
    if (redirect.signedIn) {
      setStatus('syncing');
      if (typeof hooks.onSignedIn === 'function') {
        try { hooks.onSignedIn({ name: displayName(user()) }); } catch (e) { /* 무시 */ }
      }
      return syncNow();
    }
    if (session()) return syncNow();
    return null;
  });
}

export function state() {
  return { ...status, signedIn: !!session(), name: session() ? displayName(user()) : '' };
}

export function currentUser() { return user(); }
