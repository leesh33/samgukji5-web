/* ─────────────────────────────────────────────
   legion-core.js — 비동기 유저 군단(원정 도전장 · 본편 습격)의 순수 로직
   ─────────────────────────────────────────────
   DOM 도 없고 네트워크도 없다. node 테스트에서 그대로 import 해서 검증한다.
     · 전력(power) 계산 — 앱과 Supabase RPC 가 **같은 식**을 쓴다(치트 방지).
         power = ⌊Σ(통솔×12 + 무력×15 + 지력×8) / 10⌋ + ⌊총병력 / 12⌋
     · 군단 스냅샷 검증   — 장수 5명까지, 능력치 1~100, 부대 30,000·총 60,000 까지
     · 매칭              — 내 전력의 0.55~1.85배 안에서 가까운 순, 모자라면 바깥에서 채운다
     · 습격 판정         — 12개월 이후 · 3개월 쿨다운 · 전력 500 이상 · 월 16%
     · 전투 준비물       — 기존 battle.js 전장에 그대로 넘길 setup 을 만든다
   ───────────────────────────────────────────── */
import { ARMS, FORMATIONS, CITY_BY_ID } from './data.js';

export const LEGION = {
  MAX_GENERALS: 5,
  NICK_MAX: 12,
  NAME_MAX: 16,
  STAT_MIN: 1,
  STAT_MAX: 100,
  TROOPS_PER_GENERAL_MAX: 30000,
  TROOPS_TOTAL_MAX: 60000,
  MIN_TURN: 12,             // 캠페인 12개월(1년) 이후부터 유저 군단이 국경을 넘는다
  INVASION_CHANCE: 0.16,    // 달마다
  INVASION_COOLDOWN: 3,     // 한 번 습격을 받으면 3개월은 쉰다
  MIN_POWER: 500,           // 이보다 약한 세력은 습격 대상이 되지 않는다
  BAND_LOW: 0.55,
  BAND_HIGH: 1.85,
  LIST_MAX: 5,
  FIELD_DEF_BONUS: 30,      // 야전 — 성벽이 없으니 방어 보정이 낮다
};

export const LEGION_KIND_KO = { expedition: '원정', invasion: '습격' };

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(num(v))));
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>&"']/g, '').trim().slice(0, max);

/** 앱과 Supabase RPC 가 같은 식 — 전력 */
export function powerOf(generals, troopsTotal) {
  const list = Array.isArray(generals) ? generals : [];
  let sum = 0;
  let troops = 0;
  for (const g of list) {
    sum += clampInt(g && g.lead, LEGION.STAT_MIN, LEGION.STAT_MAX) * 12;
    sum += clampInt(g && g.war, LEGION.STAT_MIN, LEGION.STAT_MAX) * 15;
    sum += clampInt(g && g.int, LEGION.STAT_MIN, LEGION.STAT_MAX) * 8;
    troops += clampInt(g && g.troops, 0, LEGION.TROOPS_PER_GENERAL_MAX);
  }
  const total = Number.isFinite(Number(troopsTotal)) ? Math.max(0, Math.round(Number(troopsTotal))) : troops;
  return Math.floor(sum / 10) + Math.floor(Math.min(total, LEGION.TROOPS_TOTAL_MAX) / 12);
}

export function troopsOf(generals) {
  return (Array.isArray(generals) ? generals : []).reduce((s, g) => s + clampInt(g && g.troops, 0, LEGION.TROOPS_PER_GENERAL_MAX), 0);
}

const armOf = (v) => (ARMS.includes(v) ? v : '보병');
const formOf = (v) => (FORMATIONS[v] ? v : 'eorin');

/** 장수 한 줄 — 서버·앱이 함께 쓰는 모양으로 다듬는다 */
export function sanitizeGeneral(g) {
  if (!g || typeof g !== 'object') return null;
  const id = str(g.id, 24);
  const ko = str(g.ko, LEGION.NAME_MAX) || id;
  if (!id) return null;
  return {
    id,
    ko,
    lead: clampInt(g.lead, LEGION.STAT_MIN, LEGION.STAT_MAX),
    war: clampInt(g.war, LEGION.STAT_MIN, LEGION.STAT_MAX),
    int: clampInt(g.int, LEGION.STAT_MIN, LEGION.STAT_MAX),
    troops: clampInt(g.troops, 0, LEGION.TROOPS_PER_GENERAL_MAX),
    arm: armOf(g.arm),
    formation: formOf(g.formation),
  };
}

/** 군단 하나 — 통과하면 { ok, legion }, 아니면 { ok:false, error } */
export function sanitizeLegion(input) {
  const src = input || {};
  const nickname = str(src.nickname, LEGION.NICK_MAX);
  if (!nickname) return { ok: false, error: '군단 이름을 적어 주세요.' };
  const cityId = str(src.cityId, 16);
  if (!CITY_BY_ID[cityId]) return { ok: false, error: '근거지 성을 고를 수 없습니다.' };
  const list = (Array.isArray(src.generals) ? src.generals : [])
    .map(sanitizeGeneral)
    .filter(Boolean)
    .slice(0, LEGION.MAX_GENERALS);
  if (!list.length) return { ok: false, error: '군단에 세울 장수가 없습니다.' };
  let troopsTotal = troopsOf(list);
  if (troopsTotal > LEGION.TROOPS_TOTAL_MAX) {
    // 넘치면 앞 장수부터 상한까지 채워 자른다 — 서버도 같은 상한을 쓴다
    let left = LEGION.TROOPS_TOTAL_MAX;
    for (const g of list) {
      g.troops = Math.min(g.troops, left);
      left -= g.troops;
      if (left <= 0) { left = 0; }
    }
    troopsTotal = troopsOf(list);
  }
  const formation = formOf(src.formation || (list[0] && list[0].formation));
  return {
    ok: true,
    legion: {
      nickname,
      lordName: str(src.lordName, LEGION.NICK_MAX),
      factionName: str(src.factionName, LEGION.NICK_MAX),
      cityId,
      cityName: str(src.cityName, 16) || CITY_BY_ID[cityId].ko,
      formation,
      generals: list,
      troopsTotal,
      power: powerOf(list, troopsTotal),
    },
  };
}

/** DB 한 줄(snake_case) → 앱이 쓰는 모양 */
export function normalizeRow(row) {
  const r = row || {};
  const generals = (Array.isArray(r.generals) ? r.generals : []).map(sanitizeGeneral).filter(Boolean);
  const troopsTotal = num(r.troopsTotal != null ? r.troopsTotal : r.troop_total);
  return {
    id: String(r.id || ''),
    deviceId: String(r.deviceId || r.device_id || ''),
    nickname: str(r.nickname, LEGION.NICK_MAX) || '이름 없는 군단',
    lordName: str(r.lordName || r.lord_name, LEGION.NICK_MAX),
    factionName: str(r.factionName || r.faction_name, LEGION.NICK_MAX),
    cityId: str(r.cityId || r.city_id, 16),
    cityName: str(r.cityName || r.city_name, 16),
    formation: formOf(r.formation),
    generals,
    troopsTotal: troopsTotal || troopsOf(generals),
    power: num(r.power) || powerOf(generals, troopsTotal),
    wins: clampInt(r.wins, 0, 99999),
    losses: clampInt(r.losses, 0, 99999),
    isPreset: !!(r.isPreset || r.is_preset),
  };
}

/** 전적 표기 — "3승 2패" */
export function recordLabel(wins, losses) {
  return `${clampInt(wins, 0, 99999)}승 ${clampInt(losses, 0, 99999)}패`;
}

/** 내 전력 구간 안에서 가까운 순으로 고른다. 모자라면 바깥에서 가까운 순으로 채운다 */
export function matchOpponents(mine, pool, limit = LEGION.LIST_MAX) {
  const myPower = Math.max(1, num(mine && mine.power));
  const myId = mine && mine.id ? String(mine.id) : '';
  const myDevice = mine && (mine.deviceId || mine.device_id) ? String(mine.deviceId || mine.device_id) : '';
  const rows = (Array.isArray(pool) ? pool : [])
    .map(normalizeRow)
    .filter((r) => r.id && r.generals.length)
    .filter((r) => r.id !== myId)
    .filter((r) => !myDevice || r.deviceId !== myDevice);
  const dist = (a, b) => (Math.abs(num(a.power) - num(b.power)) || (a.id < b.id ? -1 : 1));
  const band = (r) => num(r.power) >= myPower * LEGION.BAND_LOW && num(r.power) <= myPower * LEGION.BAND_HIGH;
  const inside = rows.filter(band).sort(dist);
  const outside = rows.filter((r) => !band(r)).sort(dist);
  const out = inside.slice(0, limit);
  if (out.length < limit) out.push(...outside.slice(0, limit - out.length));
  return out;
}

/** 습격이 올 달인가 — 엔진·UI 가 같은 판정을 쓴다 */
export function invasionRoll(opts) {
  const o = opts || {};
  const turn = num(o.turn);
  const power = num(o.power);
  const lastTurn = num(o.lastTurn);
  const rng = typeof o.rng === 'function' ? o.rng : Math.random;
  const chance = Number.isFinite(o.chance) ? o.chance : LEGION.INVASION_CHANCE;
  if (o.hasOpponent === false) return { invade: false, why: 'no-opponent', roll: -1 };
  if (turn < LEGION.MIN_TURN) return { invade: false, why: 'early', roll: -1 };
  if (power < LEGION.MIN_POWER) return { invade: false, why: 'weak', roll: -1 };
  if (lastTurn > 0 && turn - lastTurn < LEGION.INVASION_COOLDOWN) return { invade: false, why: 'cooldown', roll: -1 };
  const roll = rng();
  return roll < chance ? { invade: true, why: 'roll', roll } : { invade: false, why: 'chance', roll };
}

/** 원정 승리 보상 — 상대 전력이 클수록 두둑하다 */
export function expeditionReward(power, rng = Math.random) {
  const p = Math.max(300, num(power));
  const jitter = () => 0.85 + rng() * 0.3;
  return {
    gold: Math.round(((90 + p * 0.06) * jitter()) / 10) * 10,
    food: Math.round(((170 + p * 0.1) * jitter()) / 10) * 10,
    fame: 2 + Math.floor(rng() * 3),
    merit: 30 + Math.floor(rng() * 21),
  };
}

/** 습격을 막아낸 보상 */
export function defenseReward(power, rng = Math.random) {
  const p = Math.max(300, num(power));
  const jitter = () => 0.85 + rng() * 0.3;
  return {
    gold: Math.round(((70 + p * 0.05) * jitter()) / 10) * 10,
    food: Math.round(((120 + p * 0.07) * jitter()) / 10) * 10,
    fame: 3 + Math.floor(rng() * 3),
    merit: 25 + Math.floor(rng() * 21),
  };
}

/** 습격을 막지 못했을 때 털리는 몫 (비율) */
export function invasionLoss(power, rng = Math.random) {
  const p = Math.max(300, num(power));
  return {
    goldPct: 0.06 + rng() * 0.04,
    foodPct: 0.08 + rng() * 0.05,
    troopPct: p >= 2500 ? 0.05 + rng() * 0.03 : 0.03 + rng() * 0.03,
    fame: -2,
  };
}

/** 성문을 닫고 버텼을 때 — 싸우지 않지만 약탈은 당한다 */
export function siegeHold(power, rng = Math.random) {
  const p = Math.max(300, num(power));
  return {
    goldPct: 0.03 + rng() * 0.02,
    foodPct: 0.04 + rng() * 0.03,
    troopPct: 0,
    fame: -1,
  };
}

/* ---------- 전장 준비물 ----------
   상대 군단의 장수는 내 게임 장수와 id 가 겹치지 않도록 접두사를 붙인 새 spec 으로 만든다.
   (같은 이름의 장수라도 내 세이브의 장수를 건드리지 않는다) */
export function enemySpecsOf(row) {
  const r = normalizeRow(row);
  const map = {};
  const ids = [];
  r.generals.forEach((g, i) => {
    const gid = `lx${String(r.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6)}${i}`;
    map[gid] = {
      id: gid, ko: g.ko, lead: g.lead, war: g.war, int: g.int, pol: 50, cha: 55,
      arms: g.arm, formations: [g.formation],
    };
    ids.push(gid);
  });
  return { ids, map, formation: r.formation, troops: r.troopsTotal || troopsOf(r.generals) };
}

/**
 * 기존 battle.js 전장에 넘길 setup.
 *   kind='expedition' — 내 군단이 상대 군단의 땅으로 쳐들어간다(내가 공격측)
 *   kind='invasion'   — 상대 군단이 내 성으로 쳐들어온다(내가 수비측)
 */
export function legionBattleSetup(opts) {
  const o = opts || {};
  const mine = o.mine || {};
  const enemyRow = normalizeRow(o.enemy);
  const enemy = enemySpecsOf(enemyRow);
  const kind = o.kind === 'invasion' ? 'invasion' : 'expedition';
  const myCityId = CITY_BY_ID[mine.cityId] ? mine.cityId : 'luoyang';
  const foeCityId = CITY_BY_ID[enemyRow.cityId] ? enemyRow.cityId : (kind === 'invasion' ? 'beiping' : 'xiaopei');
  const myGens = (mine.generals || []).map((g) => g.id).filter(Boolean).slice(0, LEGION.MAX_GENERALS);
  const myTroops = mine.troopsTotal || troopsOf(mine.generals);
  const caps = o.caps || {};
  const formations = {};
  for (const g of mine.generals || []) if (g && g.id) formations[g.id] = formOf(g.formation);

  const enemyCaps = {};
  for (const gid of enemy.ids) {
    const src = enemy.map[gid];
    enemyCaps[gid] = LEGION.TROOPS_PER_GENERAL_MAX;
    formations[gid] = src.formations[0];
  }
  const enemyTroops = Math.max(400, enemy.troops);

  if (kind === 'expedition') {
    const byGeneral = {};
    let left = myTroops;
    for (const g of mine.generals || []) {
      const take = Math.max(0, Math.min(left, Math.round(g.troops || 0)));
      byGeneral[g.id] = take;
      left -= take;
    }
    return {
      fromCityId: myCityId,
      toCityId: foeCityId,
      attackerFaction: '__mine',
      defenderFaction: `legion:${enemyRow.id}`,
      atkGenerals: myGens,
      defGenerals: enemy.ids,
      atkTroops: myTroops,
      defTroops: enemyTroops,
      defBonus: LEGION.FIELD_DEF_BONUS,
      troopCaps: { ...caps, ...enemyCaps },
      rankBonus: {},
      troopsByGeneral: byGeneral,
      march: null,
      formations,
      reinforcements: { atk: [], def: [] },
    };
  }
  return {
    fromCityId: foeCityId,
    toCityId: myCityId,
    attackerFaction: `legion:${enemyRow.id}`,
    defenderFaction: '__mine',
    atkGenerals: enemy.ids,
    defGenerals: myGens,
    atkTroops: enemyTroops,
    defTroops: Math.max(300, o.cityTroops || myTroops),
    defBonus: Math.max(0, Math.min(99, num(o.cityDef) || 40)),
    troopCaps: { ...caps, ...enemyCaps },
    rankBonus: {},
    troopsByGeneral: null,
    march: null,
    formations,
    reinforcements: { atk: [], def: [] },
  };
}

/* ---------- 프리셋 군단 ----------
   등록한 사람이 아직 적을 때도 바로 겨룰 수 있게 DB 에 함께 심어 두는 기본 군단.
   전력 1,100 ~ 6,600 으로 고르게 퍼뜨려 초반·중반 모두 상대가 있게 한다. */
const P = (id, ko, lead, war, int, troops, arm, formation) => ({ id, ko, lead, war, int, troops, arm, formation });

export const PRESET_LEGIONS = [
  {
    id: 'preset-1', nickname: '하북의 서량군', lordName: '한수', factionName: '서량', cityId: 'tianshui', cityName: '천수',
    formation: 'hakyik', isPreset: true,
    generals: [
      P('lxpre1a', '한수', 62, 54, 51, 1800, '기병', 'hakyik'),
      P('lxpre1b', '마등', 74, 82, 46, 2200, '기병', 'hakyik'),
      P('lxpre1c', '방덕', 71, 78, 44, 1500, '기병', 'hakyik'),
    ],
  },
  {
    id: 'preset-2', nickname: '강동의 소패왕', lordName: '손책', factionName: '오', cityId: 'jianye', cityName: '건업',
    formation: 'bongsi', isPreset: true,
    generals: [
      P('lxpre2a', '손책', 78, 84, 62, 3800, '기병', 'bongsi'),
      P('lxpre2b', '주유', 72, 58, 91, 2600, '궁병', 'bangwon'),
      P('lxpre2c', '정보', 66, 70, 48, 2200, '보병', 'bangwon'),
      P('lxpre2d', '한당', 64, 72, 42, 1900, '보병', 'bangwon'),
    ],
  },
  {
    id: 'preset-3', nickname: '서촉의 백이병', lordName: '유비', factionName: '촉', cityId: 'chengdu', cityName: '성도',
    formation: 'eonwol', isPreset: true,
    generals: [
      P('lxpre3a', '관우', 84, 92, 68, 4200, '기병', 'eonwol'),
      P('lxpre3b', '장비', 78, 88, 40, 4000, '기병', 'eonwol'),
      P('lxpre3c', '조운', 82, 86, 60, 3600, '기병', 'eonwol'),
      P('lxpre3d', '법정', 58, 40, 88, 1800, '궁병', 'bangwon'),
    ],
  },
  {
    id: 'preset-4', nickname: '중원의 청주병', lordName: '조조', factionName: '위', cityId: 'xuchang', cityName: '허창',
    formation: 'jangsa', isPreset: true,
    generals: [
      P('lxpre4a', '하후돈', 80, 86, 56, 4400, '보병', 'jangsa'),
      P('lxpre4b', '장료', 84, 88, 66, 4200, '기병', 'jangsa'),
      P('lxpre4c', '서황', 79, 84, 58, 3900, '보병', 'jangsa'),
      P('lxpre4d', '순욱', 62, 38, 92, 2000, '궁병', 'bangwon'),
      P('lxpre4e', '전위', 70, 90, 32, 3200, '보병', 'jangsa'),
    ],
  },
  {
    id: 'preset-5', nickname: '형주의 수군', lordName: '유표', factionName: '형주', cityId: 'xiangyang', cityName: '양양',
    formation: 'sujin', isPreset: true,
    generals: [
      P('lxpre5a', '황충', 78, 86, 60, 4000, '궁병', 'anhaeng'),
      P('lxpre5b', '위연', 72, 82, 48, 3800, '보병', 'sujin'),
      P('lxpre5c', '감녕', 70, 80, 54, 3600, '수군', 'sujin'),
      P('lxpre5d', '채모', 60, 62, 70, 2400, '수군', 'sujin'),
      P('lxpre5e', '문빙', 58, 64, 44, 2200, '보병', 'bangwon'),
    ],
  },
  {
    id: 'preset-6', nickname: '병주의 철기', lordName: '여포', factionName: '여포군', cityId: 'jinyang', cityName: '진양',
    formation: 'chuhaeng', isPreset: true,
    generals: [
      P('lxpre6a', '여포', 76, 98, 34, 6400, '기병', 'chuhaeng'),
      P('lxpre6b', '장료', 84, 88, 66, 5600, '기병', 'chuhaeng'),
      P('lxpre6c', '고순', 70, 84, 40, 5200, '기병', 'chuhaeng'),
      P('lxpre6d', '진궁', 64, 42, 90, 3000, '궁병', 'bangwon'),
      P('lxpre6e', '후성', 60, 76, 38, 4200, '보병', 'jangsa'),
    ],
  },
  {
    id: 'preset-7', nickname: '유주 백마의종', lordName: '공손찬', factionName: '유주', cityId: 'beiping', cityName: '북평',
    formation: 'hyeongaek', isPreset: true,
    generals: [
      P('lxpre7a', '공손찬', 74, 80, 52, 9800, '기병', 'hyeongaek'),
      P('lxpre7b', '조운', 82, 86, 60, 9400, '기병', 'hyeongaek'),
      P('lxpre7c', '엄강', 62, 72, 44, 7800, '보병', 'jangsa'),
      P('lxpre7d', '전예', 58, 60, 62, 6600, '궁병', 'bangwon'),
      P('lxpre7e', '선우보', 56, 58, 40, 6000, '기병', 'hyeongaek'),
    ],
  },
];
