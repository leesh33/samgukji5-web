/* ─────────────────────────────────────────────
   legion.js — 비동기 유저 군단의 서버 통신 (Supabase RPC · 선택)
   ─────────────────────────────────────────────
   · 로그인 없이 **기기 UUID + 닉네임**으로만 참여한다.
       - 기기 UUID 는 localStorage 에 한 번 만들어 계속 쓴다(계정이 아니라 이 기기의 이름표).
       - 저장·계정 삭제와 무관하다. 브라우저 저장을 지우면 새 기기로 본다.
   · 서버가 없거나 느리면 **프리셋 군단**으로 그대로 논다(오프라인 연습 상대).
       - 이때는 전적이 서버에 쌓이지 않고, 화면에도 '연습 상대'로 표시된다.
   · 부르는 RPC 는 셋뿐이다(anon publishable 키 · RLS 로 직접 접근 불가):
       samguk_legion_register · samguk_legion_match · samguk_battle_report
   ───────────────────────────────────────────── */
import { LEGION, sanitizeLegion, normalizeRow, matchOpponents, PRESET_LEGIONS } from './legion-core.js';

const BASE = 'https://zdcdvjlssncsawpqsjwe.supabase.co';
const ANON = 'sb_publishable_pLkbspw3eIAOO41uVSr-tA_9Asecqzq';
const RPC = {
  register: 'samguk_legion_register',
  match: 'samguk_legion_match',
  report: 'samguk_battle_report',
};
const KEYS = {
  device: 'samguk5.legion.device.v1',
  nickname: 'samguk5.legion.nickname.v1',
};
const TIMEOUT = 7000;

let online = null;          // null = 아직 모름 · true = 서버 응답 있음 · false = 실패
let lastError = '';

const store = () => {
  try { return globalThis.localStorage || null; } catch (e) { return null; }
};

export function isOnline() { return online; }
export function lastErrorText() { return lastError; }

/** 이 기기의 이름표 — UUID v4 한 번만 만들어 계속 쓴다 */
export function deviceId() {
  const s = store();
  if (!s) return 'web-session-device';
  try {
    const cur = s.getItem(KEYS.device);
    if (cur && /^[0-9a-zA-Z-]{8,64}$/.test(cur)) return cur;
  } catch (e) { /* 무시 */ }
  let id = '';
  try {
    if (globalThis.crypto && crypto.randomUUID) id = crypto.randomUUID();
  } catch (e) { /* 무시 */ }
  if (!id) {
    const rnd = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
    id = `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-a${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
  }
  try { s.setItem(KEYS.device, id); } catch (e) { /* 사파리 프라이빗 모드 등 */ }
  return id;
}

export function savedNickname() {
  const s = store();
  if (!s) return '';
  try { return String(s.getItem(KEYS.nickname) || '').slice(0, LEGION.NICK_MAX); } catch (e) { return ''; }
}
export function saveNickname(name) {
  const s = store();
  if (!s) return;
  try { s.setItem(KEYS.nickname, String(name || '').slice(0, LEGION.NICK_MAX)); } catch (e) { /* 무시 */ }
}

async function rpc(name, body, timeout = TIMEOUT) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  try {
    const res = await fetch(`${BASE}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
      signal: ctrl ? ctrl.signal : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      lastError = (data && (data.message || data.hint)) || `HTTP ${res.status}`;
      online = false;
      throw new Error(lastError);
    }
    online = true;
    lastError = '';
    return data;
  } catch (e) {
    if (!lastError) lastError = String((e && e.message) || e || 'network');
    online = false;
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 오프라인 연습 상대 — 프리셋에서 내 전력 구간에 맞춰 고른다 */
export function offlineOpponents(mine, limit = LEGION.LIST_MAX) {
  const pool = PRESET_LEGIONS.map(normalizeRow);
  return matchOpponents(mine || { power: 0 }, pool, limit);
}

/**
 * 원정 상대 목록. 서버가 없으면 프리셋으로 대신한다.
 *   → { ok, offline, list, mine, band, error }
 */
export async function fetchOpponents(mine, limit = LEGION.LIST_MAX) {
  const device = deviceId();
  const power = Math.max(100, Math.round((mine && mine.power) || 1200));
  try {
    const data = await rpc(RPC.match, { p_device: device, p_power: power, p_limit: limit });
    const raw = (data && data.list) || [];
    const list = matchOpponents(mine || { power }, raw, limit);
    const serverMine = data && data.mine ? normalizeRow(data.mine) : null;
    return {
      ok: true, offline: false, list,
      mine: serverMine,
      band: (data && data.band) || null,
      error: '',
      // 서버에 내 군단이 남아 있으면 그 id 를 계속 쓴다(기기를 바꾸지 않는 한 같다)
    };
  } catch (e) {
    return {
      ok: false, offline: true,
      list: offlineOpponents(mine, limit),
      mine: null, band: null,
      error: lastError || String((e && e.message) || e),
    };
  }
}

/**
 * 군단 등록·갱신. 서버가 막히면 로컬 스냅샷만 남기고 오프라인으로 표시한다.
 *   → { ok, offline, row, legion, error }
 */
export async function registerLegion(input) {
  const cleaned = sanitizeLegion(input);
  if (!cleaned.ok) return { ok: false, offline: online === false, legion: null, row: null, error: cleaned.error };
  const legion = cleaned.legion;
  const device = deviceId();
  try {
    const row = await rpc(RPC.register, {
      p_device: device,
      p_nickname: legion.nickname,
      p_lord: legion.lordName,
      p_faction: legion.factionName,
      p_city_id: legion.cityId,
      p_city_name: legion.cityName,
      p_formation: legion.formation,
      p_generals: legion.generals,
    });
    const norm = row ? normalizeRow(row) : null;
    return { ok: true, offline: false, row: norm, legion: norm || legion, error: '' };
  } catch (e) {
    return { ok: false, offline: true, row: null, legion, error: lastError || String((e && e.message) || e) };
  }
}

/** 전적 보고 — 같은 battleKey 는 서버가 한 번만 센다 */
export async function reportBattle(payload) {
  const p = payload || {};
  try {
    const data = await rpc(RPC.report, {
      p_device: deviceId(),
      p_key: String(p.key || '').slice(0, 64),
      p_kind: p.kind === 'invasion' ? 'invasion' : 'expedition',
      p_enemy: p.enemyId,
      p_winner: p.winner === 'atk' ? 'atk' : 'def',
      p_atk: Math.max(0, Math.round(p.atkTroops || 0)),
      p_def: Math.max(0, Math.round(p.defTroops || 0)),
      p_atk_loss: Math.max(0, Math.round(p.atkLoss || 0)),
      p_def_loss: Math.max(0, Math.round(p.defLoss || 0)),
      p_rounds: Math.max(0, Math.round(p.rounds || 0)),
    });
    return {
      ok: !!(data && data.ok),
      applied: !!(data && data.applied),
      mine: data && data.mine ? normalizeRow(data.mine) : null,
      error: (data && data.error) || '',
    };
  } catch (e) {
    return { ok: false, applied: false, mine: null, error: lastError || String((e && e.message) || e) };
  }
}

/** 이 판의 중복 보고를 막는 열쇠 — 기기 + 시각 + 난수 */
export function newBattleKey(kind) {
  const d = deviceId().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return `${kind === 'invasion' ? 'i' : 'e'}-${d}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`.slice(0, 64);
}
