/* ─────────────────────────────────────────────
   sync-core.js — ☁️ 클라우드 동기화의 순수 로직 (DOM·네트워크 없음)
   ─────────────────────────────────────────────
   node 테스트에서 그대로 import 해서 검증한다.
     · 저장 슬롯 모양   { auto|1|2|3 : { raw, at } }
         raw = engine.serialize(state) 문자열 그대로
         at  = 그 슬롯을 마지막으로 저장한 시각(ms)
     · 합치기(merge)는 잃지 않는 쪽으로
         - 한쪽에만 있는 슬롯은 그대로 살린다(지우지 않는다)
         - 둘 다 있으면 at 이 최신인 쪽, at 이 같으면 더 많이 진행된 쪽,
           그래도 같으면 raw 문자열 순서로 정해 두 기기가 같은 결과에 모이게 한다
         - 깨진 저장(JSON 아님·형식 다름)은 멀쩡한 쪽이 이긴다
     · 로그인 리다이렉트(?code=... / #access_token=...) 해석과 세션 만료 판정도 여기서.
   ───────────────────────────────────────────── */

export const CLOUD_VERSION = 1;
export const SLOT_KEYS = ['auto', '1', '2', '3'];
export const SLOT_LABEL = { auto: '자동 저장', 1: '슬롯 1', 2: '슬롯 2', 3: '슬롯 3' };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

/** 서버(jsonb)가 키 순서를 바꿔 돌려줘도 "같다"고 보기 위한 정규화 */
export function canon(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canon);
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
  return out;
}

export function same(a, b) {
  try { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); } catch (e) { return false; }
}

/** 저장 문자열 → 게임 상태 (형식이 다르면 null) */
export function parseSave(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!isObj(s) || !isObj(s.cities) || !isObj(s.factions) || !s.playerId) return null;
    return s;
  } catch (e) { return null; }
}

/** 저장 한 줄 요약 — 불러오기 목록·로그인 안내에 쓴다 */
export function slotInfo(raw) {
  const s = parseSave(raw);
  if (!s) return null;
  const mine = s.factions[s.playerId] || {};
  let cities = 0;
  for (const c of Object.values(s.cities)) if (c && c.owner === s.playerId) cities++;
  return {
    year: num(s.year),
    month: num(s.month),
    turn: num(s.turn) || (num(s.year) * 12 + num(s.month)),
    faction: String(mine.name || s.playerId || ''),
    cities,
    scenario: String(s.scenarioName || ''),
    over: s.gameOver ? String(s.gameOver.type || 'over') : '',
  };
}

/** 진행도 — 턴(달)이 1순위, 성 수가 2순위, 명성이 3순위 */
export function progressOf(entry) {
  const s = parseSave(entry && entry.raw);
  if (!s) return -1;
  const info = slotInfo(entry.raw);
  const fame = num((s.factions[s.playerId] || {}).fame);
  return info.turn * 1e6 + info.cities * 1e3 + Math.max(0, Math.min(999, Math.round(fame)));
}

/** 슬롯 하나 정규화 — 문자열만 와도 받아 준다 */
export function makeEntry(raw, at) {
  if (typeof raw !== 'string' || !raw) return null;
  return { raw, at: Math.max(0, Math.round(num(at))) };
}

export function normalizeSlots(input) {
  const out = {};
  if (!isObj(input)) return out;
  for (const key of SLOT_KEYS) {
    const v = input[key];
    if (v == null) continue;
    const entry = (typeof v === 'string') ? makeEntry(v, 0) : makeEntry(v.raw, v.at);
    if (entry) out[key] = entry;
  }
  return out;
}

/** 둘 중 살릴 슬롯 하나 — { entry, from: 'local' | 'cloud' } */
export function pickEntry(local, cloud) {
  if (!local) return cloud ? { entry: cloud, from: 'cloud' } : null;
  if (!cloud) return { entry: local, from: 'local' };
  if (local.raw === cloud.raw) return { entry: local, from: 'local' };

  const okLocal = !!parseSave(local.raw);
  const okCloud = !!parseSave(cloud.raw);
  if (okLocal && !okCloud) return { entry: local, from: 'local' };
  if (!okLocal && okCloud) return { entry: cloud, from: 'cloud' };

  const atLocal = num(local.at);
  const atCloud = num(cloud.at);
  if (atLocal !== atCloud) {
    return atLocal > atCloud ? { entry: local, from: 'local' } : { entry: cloud, from: 'cloud' };
  }
  const pLocal = progressOf(local);
  const pCloud = progressOf(cloud);
  if (pLocal !== pCloud) {
    return pLocal > pCloud ? { entry: local, from: 'local' } : { entry: cloud, from: 'cloud' };
  }
  // 완전히 같지 않으면 raw 순서로 — 두 기기가 같은 결과로 모인다
  return local.raw > cloud.raw ? { entry: local, from: 'local' } : { entry: cloud, from: 'cloud' };
}

/** 슬롯 묶음 합치기 — 한쪽에만 있는 슬롯도 살린다 */
export function mergeSlots(localSlots, cloudSlots) {
  const local = normalizeSlots(localSlots);
  const cloud = normalizeSlots(cloudSlots);
  const slots = {};
  const took = {};
  for (const key of SLOT_KEYS) {
    const picked = pickEntry(local[key], cloud[key]);
    if (!picked) continue;
    slots[key] = picked.entry;
    took[key] = picked.from;
  }
  return { slots, took };
}

export function isEmptySlots(slots) {
  return Object.keys(normalizeSlots(slots)).length === 0;
}

/** 사람이 읽을 요약 — "194년 1월 · 조조 · 성 5곳" */
export function describeEntry(entry) {
  const info = slotInfo(entry && entry.raw);
  if (!info) return '손상된 기록';
  return `${info.year}년 ${info.month}월 · ${info.faction} · 성 ${info.cities}곳`;
}

/* ---------- 로그인 리다이렉트 ---------- */
export function parseQuery(qs) {
  const out = {};
  String(qs || '').replace(/^[?#]/, '').split('&').forEach((pair) => {
    if (!pair) return;
    const i = pair.indexOf('=');
    const k = i < 0 ? pair : pair.slice(0, i);
    const v = i < 0 ? '' : pair.slice(i + 1);
    try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
    catch (e) { out[k] = v; }
  });
  return out;
}

/** Supabase 가 돌려준 주소 해석 — 코드(PKCE)·토큰(implicit)·오류를 한 번에 */
export function parseAuthParams(search, hash) {
  const q = parseQuery(search);
  const h = parseQuery(hash);
  const error = [q.error, h.error].filter(Boolean)[0] || '';
  const description = [q.error_description, h.error_description].filter(Boolean)[0] || '';
  return {
    code: q.code || '',
    accessToken: h.access_token || '',
    refreshToken: h.refresh_token || '',
    expiresIn: Number(h.expires_in) || 0,
    error,
    description,
    hasAuth: !!(q.code || h.access_token || error || description),
  };
}

/** 토큰 응답 → 저장할 세션 (만료 시각은 ms) */
export function normalizeSession(tok, prev, nowMs) {
  tok = tok || {};
  prev = prev || {};
  const t = num(nowMs) || Date.now();
  const expiresAt = tok.expires_at
    ? num(tok.expires_at) * 1000
    : t + (num(tok.expires_in) || 3600) * 1000;
  return {
    access_token: String(tok.access_token || ''),
    refresh_token: String(tok.refresh_token || prev.refresh_token || ''),
    expires_at: expiresAt,
    user: tok.user || prev.user || null,
  };
}

export function sessionUsable(session, nowMs, skewMs = 60000) {
  if (!session || !session.access_token) return false;
  return num(session.expires_at) - (skewMs || 0) > (num(nowMs) || Date.now());
}

/** 리프레시 토큰이 거절됐는가 — Supabase GoTrue 는 이 경우 400 으로도 답한다 */
export function isRefreshDead(status) {
  return status === 400 || status === 401;
}

export function displayName(user) {
  const u = user || {};
  const m = u.user_metadata || {};
  let name = String(m.full_name || m.name || m.nickname || m.user_name || m.preferred_username || '').trim();
  if (!name && u.email) name = String(u.email).split('@')[0];
  return name || '내 계정';
}

export function displayEmail(user) {
  const u = user || {};
  return String(u.email || (u.user_metadata || {}).email || '');
}
