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
const PROVIDER_LABEL = { google: 'Google', kakao: '카카오', apple: 'Apple' };

/* ---------- iOS 앱(Expo WebView 래퍼) 다리 ----------
   앱은 페이지 스크립트보다 먼저 아래를 심는다.
     window.__SAMGUK_NATIVE__ = { shell: 'ios', appleAuth: true, appVersion: '1.0.0' }
   앱 안에서는 페이지가 외부 주소로 이동하지 않는다(로그인 창은 앱이 띄운다).
     · Apple  : 앱의 네이티브 Sign in with Apple → id_token → Supabase id_token grant
     · Google·카카오 : 앱이 ASWebAuthenticationSession 으로 열고 `samguk://auth-callback` 으로 돌아옴
   돌아온 주소는 앱이 window.SamgukNative.oauthCallback(url) 로 넘겨 준다(PKCE verifier 는 이 페이지에 있음).
   웹에서는 지금처럼 페이지 이동(OAuth 리다이렉트) 방식 그대로 — 앱 밖 동작은 달라지지 않는다. */
const NATIVE_REDIRECT = 'samguk://auth-callback';

function nativeInfo() {
  const n = globalThis.__SAMGUK_NATIVE__;
  return (n && typeof n === 'object') ? n : null;
}
function nativeApp() { return !!(nativeInfo() && nativeInfo().shell); }
function nativePost(msg) {
  try {
    const rn = globalThis.ReactNativeWebView;
    if (rn && typeof rn.postMessage === 'function') {
      rn.postMessage(JSON.stringify(msg));
      return true;
    }
  } catch (e) { /* 다리가 없으면 웹 방식으로 */ }
  return false;
}

// Apple 은 앱 안(네이티브 로그인)에서만 내보낸다 — 웹은 Google·카카오 그대로.
function providerOn(name) {
  if (name === 'apple') return !!(nativeInfo() && nativeInfo().appleAuth);
  return true;
}

function signIn(provider) {
  const p = provider === 'kakao' ? 'kakao' : provider === 'apple' ? 'apple' : 'google';
  if (!providerOn(p)) {
    return Promise.reject(new Error(PROVIDER_LABEL[p] + ' 로그인은 앱에서만 쓸 수 있습니다'));
  }
  const native = nativeApp() ? nativeInfo() : null;

  // 앱 · Apple — 네이티브 창을 띄우고 id_token 을 돌려받는다(PKCE 불필요)
  if (native && p === 'apple') {
    setStatus('syncing');
    if (nativePost({ type: 'apple-signin' })) return Promise.resolve('samguk:apple-native');
    setStatus('off');
    return Promise.reject(new Error('Apple 로그인 창을 열지 못했습니다'));
  }

  const verifier = randomString(56);
  writeJson(KEYS.pkce, { verifier, at: now() });
  setStatus('syncing');
  return challengeFor(verifier).then((challenge) => {
    // 앱은 페이지 이동 대신 커스텀 스킴으로 돌아온다(앱이 창을 닫고 주소를 넘겨 줌)
    const base = native ? NATIVE_REDIRECT : location.origin + location.pathname;
    const url = SUPABASE_URL + '/auth/v1/authorize?provider=' + p +
      '&redirect_to=' + encodeURIComponent(base) +
      (challenge ? '&code_challenge=' + encodeURIComponent(challenge) + '&code_challenge_method=s256' : '');
    if (native) {
      if (nativePost({ type: 'oauth', url })) return url;
      setStatus('off');
      throw new Error('로그인 창을 열지 못했습니다');
    }
    location.assign(url);
    return url;
  }).catch((e) => {
    if (status.state !== 'off') setStatus('error', friendly(e));
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

/* ---------- 앱에서 돌아온 로그인 응답 마무리 ---------- */
// Google·카카오: samguk://auth-callback?code=… → PKCE verifier 로 세션 교환
function completeOAuthCallback(url) {
  let raw = String(url || '');
  let hash = '';
  const hashAt = raw.indexOf('#');
  if (hashAt >= 0) { hash = raw.slice(hashAt); raw = raw.slice(0, hashAt); }
  const qAt = raw.indexOf('?');
  const parsed = parseAuthParams(qAt >= 0 ? raw.slice(qAt) : '', hash);

  if (parsed.error) {
    const reason = /access_denied|cancel/i.test(parsed.error + ' ' + parsed.description)
      ? '로그인을 취소했습니다'
      : (parsed.description || parsed.error);
    setStatus('error', reason);
    return Promise.reject(new Error(reason));
  }

  let done;
  if (parsed.accessToken) {
    done = Promise.resolve(sessionSave({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
      expires_in: parsed.expiresIn || 3600,
    }));
  } else if (parsed.code) {
    const pkce = readJson(KEYS.pkce, {}) || {};
    done = api('/auth/v1/token?grant_type=pkce', {
      method: 'POST',
      body: { auth_code: parsed.code, code_verifier: pkce.verifier || '' },
    }).then((tok) => sessionSave(tok));
  } else {
    return Promise.reject(new Error('로그인 응답에 코드가 없습니다'));
  }

  return done.then(() => {
    removeRaw(KEYS.pkce);
    setStatus('syncing');
    notifySignedIn();
    return syncNow().then((res) => ({ ok: true, res }), () => ({ ok: true }));
  }).catch((e) => {
    const msg = friendly(e);
    setStatus('error', msg);
    throw new Error(msg);
  });
}

// Apple 네이티브 로그인: identity token 을 Supabase 세션으로 바꾼다
//   (Supabase Apple provider Client IDs 에 앱 번들 ID com.odol.dotsamguk 이 들어 있어야 통과)
function completeAppleSignIn(idToken, nonce) {
  const tok = String(idToken || '');
  if (!tok) return Promise.reject(new Error('Apple 로그인 응답이 비어 있습니다'));
  setStatus('syncing');
  return api('/auth/v1/token?grant_type=id_token', {
    method: 'POST',
    body: { provider: 'apple', id_token: tok, nonce: nonce ? String(nonce) : '' },
  }).then((res) => sessionSave(res)).then(() => {
    setStatus('syncing');
    notifySignedIn();
    return syncNow().then((res) => ({ ok: true, res }), () => ({ ok: true }));
  }).catch((e) => {
    const msg = friendly(e);
    setStatus('error', msg);
    throw new Error(msg);
  });
}

function notifySignedIn() {
  try {
    if (typeof globalThis.CustomEvent === 'function' && globalThis.dispatchEvent) {
      globalThis.dispatchEvent(new globalThis.CustomEvent('samguk-sync-signed-in', {
        detail: { name: displayName(user()) },
      }));
    }
  } catch (e) { /* 무시 */ }
}

/* ---------- 계정 · 클라우드 기록 삭제 (App Store 5.1.1(v)) ----------
   · Supabase RPC samguk_delete_my_account() — 본인 samguk_saves 행을 지우고,
     같은 계정으로 다른 앱(릴스핀·인생 한 턴)에 남긴 기록이 없을 때만 auth 계정까지 지운다.
   · RPC 가 아직 없으면(404·400 schema cache) RLS 로 본인 행을 직접 지운다 — 그래도 기록은 모두 사라진다.
   · 이 기기의 저장(자동·슬롯 1~3)도 함께 지우고 로그아웃한다. */
function purgeLocal() {
  removeRaw('samguk5.auto');
  for (let i = 1; i <= 3; i++) removeRaw('samguk5.slot' + i);
  removeRaw(KEYS.meta);
}

function deleteAccount() {
  const s = session();
  if (!s || !s.user || !s.user.id) return Promise.reject(new Error('로그인한 뒤에 시도해 주세요'));
  const uid = s.user.id;
  setStatus('syncing');
  return withToken((t) => api('/rest/v1/rpc/samguk_delete_my_account', {
    method: 'POST', token: t, body: {},
  }).catch((e) => {
    if (e && e.status === 401) throw e;
    const msg = String((e && e.message) || '');
    const missing = e && (e.status === 404 || e.status === 400) &&
      /does not exist|schema cache|Could not find|not find/i.test(msg);
    if (!missing) throw e;
    return api('/rest/v1/' + TABLE + '?user_id=eq.' + encodeURIComponent(uid), {
      method: 'DELETE', token: t, prefer: 'return=minimal',
    }).then(() => ({ ok: true, accountDeleted: false, dataWiped: true }));
  })).then((out) => {
    purgeLocal();
    removeRaw(KEYS.session);
    removeRaw(KEYS.pkce);
    setStatus('off');
    renderAll();
    return out || { ok: true };
  }).catch((e) => {
    const msg = friendly(e);
    setStatus(session() ? 'error' : 'off', msg);
    throw new Error(msg);
  });
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
    const apple = !!(nativeInfo() && nativeInfo().appleAuth);
    html =
      '<div class="acc-row">' +
        '<button type="button" class="acc-pill google" data-cloud="in-google">' +
          '<span class="acc-badge">G</span><span>구글로 로그인</span></button>' +
        '<button type="button" class="acc-pill kakao" data-cloud="in-kakao">' +
          '<span class="acc-badge">K</span><span>카카오로 로그인</span></button>' +
      '</div>' +
      (apple
        ? '<div class="acc-row">' +
            '<button type="button" class="acc-pill apple" data-cloud="in-apple">' +
              '<span class="acc-badge">A</span><span>Apple로 로그인</span></button>' +
          '</div>'
        : '') +
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
        ? '<div class="acc-note warn">' + esc(shortError(status.error)) + '</div>' : '') +
      (compact ? ''
        : '<button type="button" class="acc-out danger" data-cloud="delete">계정 · 클라우드 기록 삭제</button>');
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
      else if (act === 'in-apple') signIn('apple').catch(() => { /* 상태에 표시됨 */ });
      else if (act === 'out') signOut();
      else if (act === 'delete') {
        if (typeof hooks.onDeleteRequest === 'function') {
          try { hooks.onDeleteRequest(); } catch (e) { /* 무시 */ }
        }
      }
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

/* ---------- 어드민(/admin.html) 창구 ----------
   어드민 화면은 **로그인·세션·토큰**만 빌려 쓰고 저장소(samguk_saves)는 건드리지 않는다.
   (그래서 start() 대신 completeRedirect() 를 쓴다 — 로그인 응답만 마무리한다) */
export const AdminBridge = {
  session,
  user,
  signIn,
  signOut: () => signOut(),
  token,
  completeRedirect,
};

export function signOutNow() { return signOut(); }

/* App Store 5.1.1(v) — 계정 삭제. ui 가 2단계 확인을 거쳐 부른다. */
export function deleteAccountAndData() { return deleteAccount(); }

/* 앱(Expo WebView)이 부르는 다리 — 웹에서는 그대로 무해하다. */
try {
  globalThis.SamgukNative = {
    oauthCallback(url) {
      return completeOAuthCallback(url).then(() => true, () => false);
    },
    appleSignIn(idToken, nonce) {
      return completeAppleSignIn(idToken, nonce).then(() => true, () => false);
    },
    native: nativeApp,
    appleReady() { return !!(nativeInfo() && nativeInfo().appleAuth); },
    deleteAccount: deleteAccountAndData,
    state,
    signOut: signOutNow,
  };
} catch (e) { /* 무시 */ }
