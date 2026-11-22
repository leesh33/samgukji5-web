/* 도트삼국 — 게임 엔진 (DOM 비의존, node 테스트 가능) */
import { CITIES, CITY_BY_ID, GENERALS, GENERAL_BY_ID, SCENARIOS, FORMATIONS, FACTION_COLORS, ARMS, SKILLS, CUSTOM_COLORS } from './data.js';
import { pickTalkLine, talkStyleOf } from './talk.js';

export const SAVE_VERSION = 7;
export const MAX_ARMY = 5;
export const MAX_OFFICERS_PER_CITY = 12;

/* ---------- 장수 조회 (정적 + 신군주가 만든 장수) ---------- */
export function generalOf(state, gid) {
  if (!gid) return null;
  if (state && state.customGenerals && state.customGenerals[gid]) return state.customGenerals[gid];
  return GENERAL_BY_ID[gid] || null;
}
export function generalMap(state) {
  const map = { ...GENERAL_BY_ID };
  if (state && state.customGenerals) Object.assign(map, state.customGenerals);
  return map;
}
export function allGeneralsOf(state) {
  return [...GENERALS, ...Object.values((state && state.customGenerals) || {})];
}

/* ---------- 난수 ---------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 게임 생성 ---------- */
export function createGame(scenarioId, factionId, seed = Date.now() % 100000, options = {}) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId);
  if (!sc) throw new Error('unknown scenario: ' + scenarioId);
  const custom = options.custom || null;
  const fac = custom ? null : sc.factions.find((f) => f.id === factionId);
  if (!custom && !fac) throw new Error('unknown faction: ' + factionId);

  const state = {
    version: SAVE_VERSION,
    seed,
    rngState: seed,
    scenarioId,
    scenarioName: sc.name,
    year: sc.year,
    month: 1,
    turn: 1,
    playerId: factionId,
    actionPoints: 0,
    maxActionPoints: 0,
    factions: {},
    cities: {},
    generals: {},
    customGenerals: {},
    log: [],
    pendingBattles: [],
    pendingPrisoners: [],
    talked: {},
    diplomacy: { rel: {}, ally: {}, truce: {} },
    offices: {},
    scouted: {},
    pendingEvent: null,
    lastPromotions: [],
    gameOver: null,
    stats: { battles: 0, wins: 0, duels: 0, duelWins: 0, captured: 0, recruited: 0, executed: 0, released: 0 },
  };

  // 신군주가 만든 장수는 상태 안에 함께 보관한다(저장·복원·이어하기에 그대로 따라간다)
  if (custom) {
    for (const g of [custom.lord, ...(custom.retinue || [])]) {
      if (!g || !g.id) continue;
      state.customGenerals[g.id] = normalizeGeneral(g);
    }
  }

  for (const c of CITIES) {
    state.cities[c.id] = {
      id: c.id,
      owner: null,
      agri: c.agri, comm: c.comm, order: c.order, water: c.water,
      troops: c.troops, train: 55,
      gold: c.gold, food: c.food,
      def: clamp(Math.round(c.order * 0.6 + Math.min(40, c.troops / 300)), 25, 95),
    };
  }

  for (const g of allGeneralsOf(state)) {
    state.generals[g.id] = { id: g.id, faction: null, city: null, loyalty: 0, acted: false, captive: false, dead: false, hidden: false };
  }

  // 신군주는 기존 소세력의 성 하나를 떼어내 시작한다
  let defs = sc.factions.map((f) => ({ ...f }));
  let takenCity = null;
  if (custom) {
    takenCity = custom.cityId;
    if (!CITY_BY_ID[takenCity]) throw new Error('unknown city: ' + takenCity);
    defs = defs.map((f) => (f.cities.includes(takenCity) ? { ...f, cities: f.cities.filter((c) => c !== takenCity) } : f))
      .filter((f) => f.cities.length > 0);
    defs.push({
      id: factionId,
      name: custom.faction.name || '신군주',
      mark: custom.faction.mark || String(custom.faction.name || '신군주')[0],
      lord: custom.lord.id,
      cities: [takenCity],
      generals: [custom.lord.id, ...(custom.retinue || []).map((g) => g.id)],
      color: custom.faction.color,
      custom: true,
    });
  }

  for (const f of defs) {
    state.factions[f.id] = {
      id: f.id,
      name: f.name,
      mark: f.mark || String(f.name || '')[0] || '',
      lord: f.lord,
      color: f.color || FACTION_COLORS[f.id] || '#888',
      fame: 45,
      alive: true,
      isPlayer: f.id === factionId,
      gold: 0,
      custom: !!f.custom,
    };
    for (const cid of f.cities) {
      const city = state.cities[cid];
      if (city.owner) throw new Error('city already owned: ' + cid);
      city.owner = f.id;
    }
    const gens = f.generals.slice();
    // 군주는 첫 성에 배치
    gens.sort((a, b) => (a === f.lord ? -1 : b === f.lord ? 1 : 0));
    gens.forEach((gid, i) => {
      if (!state.generals[gid]) throw new Error('unknown general: ' + gid);
      const g = state.generals[gid];
      if (g.faction) throw new Error('general already assigned: ' + gid);
      g.faction = f.id;
      g.city = f.cities[i % f.cities.length];
      g.loyalty = gid === f.lord ? 100 : clamp(randInt(mulberry32(seed + i * 37), 70, 95), 55, 100);
    });
  }

  // 신군주 휘하 장수는 군주 성에 모아 두고 충성을 높게
  if (custom) {
    for (const g of custom.retinue || []) {
      const st = state.generals[g.id];
      if (st) { st.city = custom.cityId; st.loyalty = 88; }
    }
  }

  // 재야 장수
  const freeMap = sc.free || {};
  for (const [cid, list] of Object.entries(freeMap)) {
    for (const gid of list) {
      const g = state.generals[gid];
      if (!g) continue;
      if (g.faction) continue;
      g.faction = null;
      g.city = cid;
      g.loyalty = 0;
    }
  }
  // 어디에도 속하지 않은 장수는 재야로 낙양에 (죽은 장수 제외)
  for (const g of Object.values(state.generals)) {
    if (!g.dead && !g.faction && !g.city) { g.city = 'luoyang'; }
  }

  initDiplomacy(state);
  syncOffices(state);
  state.maxActionPoints = calcActionPoints(state, factionId);
  state.actionPoints = state.maxActionPoints;
  const playerFac = state.factions[factionId];
  log(state, `${sc.year}년 ${sc.name} — ${playerFac.name} 세력으로 천하에 나서다.`);
  return state;
}

export const CUSTOM_STAT_MIN = 20;
export const CUSTOM_STAT_MAX = 96;
export const CUSTOM_STAT_BUDGET = 255; // 능력치 총합 상한 — 주사위도 이 안에서 나오고 수동 배분도 여기까지
export const CUSTOM_STAT_DICE_MIN = 165; // 주사위 최소 총합 — 이 아래로는 안 나온다
export const CUSTOM_NAME_MIN = 2;
export const CUSTOM_NAME_MAX = 6;
export const CUSTOM_RETINUE_PRESETS = [
  { ko: '한석', skill: 'cheolbyeok', arms: '보병' },
  { ko: '위담', skill: 'dolgyeok', arms: '기병' },
];
const STAT_KEYS = ['lead', 'war', 'int', 'pol', 'cha'];

/* 주사위: 먼저 이번 굴림의 총합을 뽑는다 — 최소 165부터 최대 255까지, 위쪽이 조금 더 잘 나오고
   가끔 만점(255)이 뜬다 */
export function rollCustomTotal(rand = Math.random) {
  const r = clamp(rand(), 0, 1);
  if (r < 0.06) return CUSTOM_STAT_BUDGET; // 가끔 만점(255)
  const span = CUSTOM_STAT_BUDGET - CUSTOM_STAT_DICE_MIN;
  const t = Math.pow((r - 0.06) / 0.94, 0.8); // 위쪽으로 살짝 기운 분포
  return Math.min(CUSTOM_STAT_BUDGET, CUSTOM_STAT_DICE_MIN + Math.round(span * t));
}

/* 주사위: 뽑힌 총합을 다섯 능력치에 무작위로 나눈다 — 한 항목이 확 치솟는 굴림도 나오게 */
export function rollCustomStats(rand = Math.random) {
  const target = rollCustomTotal(rand);
  const cap = CUSTOM_STAT_MAX - CUSTOM_STAT_MIN;
  let extra = target - STAT_KEYS.length * CUSTOM_STAT_MIN; // 최소치 위로 더 얹을 몫
  const add = STAT_KEYS.map(() => 0);
  // 굴림마다 성격이 달라지도록 가중치를 크게 흔린다
  const w = STAT_KEYS.map(() => 0.2 + rand() * rand() * 3);
  const wsum = w.reduce((a, b) => a + b, 0);
  STAT_KEYS.forEach((k, i) => {
    if (extra <= 0) return;
    const want = Math.min(cap, extra, Math.round((target - STAT_KEYS.length * CUSTOM_STAT_MIN) * w[i] / wsum));
    add[i] = Math.max(0, want);
    extra -= add[i];
  });
  // 반올림·상한에 걸려 남은 몫은 여유가 있는 항목에 무작위로 하나씩
  while (extra > 0) {
    const open = STAT_KEYS.map((_, i) => i).filter((i) => add[i] < cap);
    if (!open.length) break;
    const pick = open[Math.floor(clamp(rand(), 0, 0.999999) * open.length)];
    add[pick] += 1;
    extra -= 1;
  }
  const stats = {};
  STAT_KEYS.forEach((k, i) => { stats[k] = CUSTOM_STAT_MIN + add[i]; });
  return stats;
}

/* 수동 ＋/－: 항목 범위와 총합 상한(255)을 지키며 한 칸 조정한다 */
export function adjustCustomStat(stats, k, delta) {
  const next = {};
  for (const key of STAT_KEYS) next[key] = clamp(Math.round(Number(stats[key]) || 0), CUSTOM_STAT_MIN, CUSTOM_STAT_MAX);
  if (!STAT_KEYS.includes(k)) return { stats: next, ok: false, reason: 'key' };
  const cur = next[k];
  const want = clamp(cur + delta, CUSTOM_STAT_MIN, CUSTOM_STAT_MAX);
  if (want === cur) return { stats: next, ok: false, reason: 'limit' };
  const sum = STAT_KEYS.reduce((n, key) => n + next[key], 0);
  if (want > cur && sum + (want - cur) > CUSTOM_STAT_BUDGET) return { stats: next, ok: false, reason: 'budget' };
  next[k] = want;
  return { stats: next, ok: true, reason: null };
}

/* 입력을 실제 지휘 가능한 장수 정의로 다듬는다 */
export function normalizeGeneral(g) {
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = clamp(Math.round(Number(g[k]) || 40), 1, 100);
  const forms = (Array.isArray(g.formations) ? g.formations : []).filter((f) => FORMATIONS[f]);
  return {
    id: g.id,
    ko: String(g.ko || '무명').slice(0, 8),
    lead: stats.lead, war: stats.war, int: stats.int, pol: stats.pol, cha: stats.cha,
    arms: ARMS.includes(g.arms) ? g.arms : '보병',
    skill: SKILLS[g.skill] ? g.skill : 'tongsol',
    formations: forms.length ? forms.slice(0, 5) : ['eorin'],
    style: g.style || null,
    custom: true,
  };
}

/* 신군주 생성 입력을 게임 생성 옵션으로 바꾼다 */
export function buildCustomLord(opts) {
  const name = String(opts.name || '').trim();
  if (name.length < CUSTOM_NAME_MIN || name.length > CUSTOM_NAME_MAX) throw new Error('군주 이름은 2~6자로 지어 주세요.');
  const mark = customMark(opts.mark, name);
  const palette = CUSTOM_COLORS.find((c) => c.hex === opts.color) || CUSTOM_COLORS[0];
  const retinueN = clamp(Number(opts.retinue) || 0, 0, 2);
  const formations = [opts.formation || 'eorin', 'bangwon', 'hakyik'].filter((f, i, a) => FORMATIONS[f] && a.indexOf(f) === i);
  const lord = normalizeGeneral({
    ...opts.stats,
    id: 'cl_lord',
    ko: name,
    arms: opts.arms,
    skill: opts.skill,
    formations,
    style: opts.style,
  });
  const retinue = [];
  for (let i = 0; i < retinueN; i++) {
    const p = CUSTOM_RETINUE_PRESETS[i];
    retinue.push(normalizeGeneral({
      id: `cl_mate${i + 1}`,
      ko: p.ko,
      lead: lord.lead - 8, war: lord.war - 6, int: lord.int - 10, pol: lord.pol - 8, cha: lord.cha - 6,
      arms: p.arms,
      skill: p.skill,
      formations: ['eorin', 'bangwon'],
      style: { hat: (i + 2) % 5, beard: (i + 1) % 4, skin: (i + 1) % 4 },
    }));
  }
  return {
    faction: { id: opts.factionId || 'custom', name, mark, color: palette.hex },
    lord,
    retinue,
    cityId: opts.cityId,
  };
}

/* 깃발 글자 — 한글 1자. 비어 있거나 한글이 아니면 군주 이름의 첫 글자를 쓴다 */
export function customMark(value, name) {
  const picked = String(value || '').match(/[가-힣]/);
  if (picked) return picked[0];
  const fallback = String(name || '').match(/[가-힣]/);
  return fallback ? fallback[0] : '신';
}

/* 신군주가 깃발을 꽂을 수 있는 성 — 성이 둘 이상인 세력에서 하나를 떼어낸다(원 세력이 멸망하지 않게) */
export function customStartCities(scenarioId) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId);
  if (!sc) return [];
  const rows = [];
  for (const f of sc.factions) {
    if (f.cities.length < 2) continue;
    for (const cid of f.cities) {
      const c = CITY_BY_ID[cid];
      rows.push({ cityId: cid, ko: c.ko, region: c.region, from: f.id, fromName: f.name, fromCities: f.cities.length, troops: c.troops });
    }
  }
  return rows.sort((a, b) => a.fromCities - b.fromCities || b.troops - a.troops);
}

export function rngOf(state) {
  const rng = mulberry32(state.rngState || state.seed || 1);
  return rng;
}
export function bumpRng(state, n = 1) {
  state.rngState = ((state.rngState || 1) + n * 7919) >>> 0;
}

export function log(state, text) {
  state.log.push({ turn: state.turn, year: state.year, month: state.month, text });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

/* ---------- 조회 ---------- */
export const ownerOf = (state, cityId) => state.cities[cityId].owner;
export const factionOf = (state, id) => state.factions[id];
export const cityName = (id) => (CITY_BY_ID[id] ? CITY_BY_ID[id].ko : id);

export function generalsInCity(state, cityId) {
  return Object.values(state.generals).filter((g) => g.city === cityId && g.faction && !g.captive && !g.dead);
}
export function freeGeneralsInCity(state, cityId) {
  return Object.values(state.generals).filter((g) => g.city === cityId && !g.faction && !g.captive && !g.dead);
}
export function factionGenerals(state, fid) {
  return Object.values(state.generals).filter((g) => g.faction === fid && !g.captive && !g.dead);
}
export function factionCities(state, fid) {
  return Object.values(state.cities).filter((c) => c.owner === fid);
}
export function neighbors(cityId) { return CITY_BY_ID[cityId].roads; }
export function isAdjacent(a, b) { return CITY_BY_ID[a].roads.includes(b); }

export function lordOf(state, fid) {
  const f = state.factions[fid];
  if (!f || !f.lord) return null;
  return generalOf(state, f.lord);
}
export function factionStrength(state, fid) {
  const cs = factionCities(state, fid);
  return cs.reduce((s, c) => s + c.troops, 0) + cs.length * 800;
}
export function cityPower(state, cityId, defensive = true) {
  const c = state.cities[cityId];
  const gens = generalsInCity(state, cityId);
  const best = gens.reduce((m, g) => { const t = generalOf(state, g.id); return Math.max(m, (t.lead + t.war) / 2); }, 40);
  let p = c.troops * (0.7 + c.train / 180) * (0.72 + best / 260);
  if (defensive) p *= 1 + c.def / 420 + c.order / 700;
  return Math.round(p);
}
/* 적 성 — 동맹·정전 중인 세력의 성은 공격 대상에서 빠진다 */
export function adjacentEnemies(state, cityId) {
  const own = ownerOf(state, cityId);
  return neighbors(cityId).filter((n) => {
    const o = ownerOf(state, n);
    if (!o || o === own) return false;
    return !isPacified(state, own, o);
  });
}
/* 외교와 상관없이 이웃한 다른 세력의 성 (외교·계략 화면에서 쓴다) */
export function neighborFoes(state, cityId) {
  const own = ownerOf(state, cityId);
  return neighbors(cityId).filter((n) => { const o = ownerOf(state, n); return !!o && o !== own; });
}
export function adjacentFriends(state, cityId) {
  const own = ownerOf(state, cityId);
  return neighbors(cityId).filter((n) => ownerOf(state, n) === own);
}

/* ---------- 관직 ---------- */
/* 성 수 + 명성으로 오르는 관직 — 행동력과 세금 보너스를 준다 */
export const OFFICES = [
  { ko: '현령', cities: 1, fame: 0, ap: 0, tax: 0 },
  { ko: '자사', cities: 2, fame: 50, ap: 1, tax: 0.03 },
  { ko: '주목', cities: 4, fame: 57, ap: 1, tax: 0.05 },
  { ko: '대장군', cities: 7, fame: 64, ap: 2, tax: 0.07 },
  { ko: '승상', cities: 11, fame: 72, ap: 2, tax: 0.10 },
  { ko: '왕', cities: 16, fame: 80, ap: 3, tax: 0.13 },
  { ko: '황제', cities: 24, fame: 90, ap: 3, tax: 0.16 },
];
export const MAX_OFFICE = OFFICES.length - 1;

export function officeLevel(state, fid) {
  const f = state.factions[fid];
  if (!f) return 0;
  const cs = factionCities(state, fid).length;
  let lv = 0;
  for (let i = 0; i < OFFICES.length; i++) {
    if (cs >= OFFICES[i].cities && f.fame >= OFFICES[i].fame) lv = i;
  }
  return lv;
}
export function officeOf(state, fid) {
  return OFFICES[officeLevel(state, fid)] || OFFICES[0];
}
/* 다음 관직과 그 조건 — 화면에 남은 조건을 보여 준다 */
export function nextOffice(state, fid) {
  const lv = officeLevel(state, fid);
  const nx = OFFICES[lv + 1];
  if (!nx) return null;
  const cs = factionCities(state, fid).length;
  const fame = state.factions[fid] ? state.factions[fid].fame : 0;
  return { ko: nx.ko, cities: nx.cities, fame: nx.fame, needCities: Math.max(0, nx.cities - cs), needFame: Math.max(0, Math.ceil(nx.fame - fame)), ap: nx.ap, tax: nx.tax };
}

/* 관직을 다시 계산하고, 오른 세력은 알림 목록에 쌓는다 */
export function syncOffices(state) {
  state.offices = state.offices || {};
  state.lastPromotions = state.lastPromotions || [];
  for (const fid of Object.keys(state.factions || {})) {
    const f = state.factions[fid];
    if (!f || !f.alive) continue;
    const lv = officeLevel(state, fid);
    const prev = typeof state.offices[fid] === 'number' ? state.offices[fid] : lv;
    state.offices[fid] = lv;
    if (lv > prev) {
      const rec = { factionId: fid, level: lv, from: OFFICES[prev].ko, to: OFFICES[lv].ko, ap: OFFICES[lv].ap, tax: OFFICES[lv].tax };
      state.lastPromotions.push(rec);
      if (fid === state.playerId) {
        log(state, `관직이 ${OFFICES[prev].ko}에서 ${withJosa(OFFICES[lv].ko, '로')} 올랐습니다. 행동력 +${OFFICES[lv].ap} · 세금 +${Math.round(OFFICES[lv].tax * 100)}%`);
      }
    }
  }
  return state.lastPromotions.filter((p) => p.factionId === state.playerId);
}
export function clearPromotions(state) { state.lastPromotions = []; }

export function calcActionPoints(state, fid) {
  const f = state.factions[fid];
  if (!f) return 0;
  const cs = factionCities(state, fid).length;
  const office = OFFICES[officeLevel(state, fid)] || OFFICES[0];
  return clamp(4 + Math.floor(f.fame / 22) + Math.min(3, Math.floor(cs / 3)) + office.ap, 4, 13);
}
export function bestOfficer(state, cityId, key, exclude = []) {
  const gens = generalsInCity(state, cityId).filter((g) => !g.acted && !exclude.includes(g.id));
  if (!gens.length) return null;
  gens.sort((a, b) => ((generalOf(state, b.id) || {})[key] || 0) - ((generalOf(state, a.id) || {})[key] || 0));
  return generalOf(state, gens[0].id);
}

/* ---------- 외교 ---------- */
export const ALLIANCE_MONTHS = 12;
export const TRUCE_MONTHS = 6;
export const DIPLO = {
  envoy: { ko: '친선 사절', gold: 300, ap: 1, desc: '사신을 보내 우호도를 올립니다(+15~25).' },
  alliance: { ko: '동맹 제의', gold: 500, ap: 1, desc: '12개월 동맹 — 서로 공격하지 않고 원군을 받습니다.' },
  truce: { ko: '정전 협정', gold: 400, ap: 1, desc: '6개월 정전 — 공격을 유예합니다.' },
  break: { ko: '동맹 파기', gold: 0, ap: 0, desc: '즉시 공격할 수 있게 되지만 명성 -15, 타 세력 우호도 하락.' },
};

export function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

/* 옛 저장에 외교 칸이 없어도 안전하게 채운다 */
export function ensureDiplomacy(state) {
  state.diplomacy = state.diplomacy || {};
  const d = state.diplomacy;
  d.rel = d.rel || {}; d.ally = d.ally || {}; d.truce = d.truce || {};
  const ids = Object.keys(state.factions || {}).filter((id) => state.factions[id] && state.factions[id].alive !== false);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      if (typeof d.rel[k] !== 'number') d.rel[k] = 40;
      if (typeof d.ally[k] !== 'number') d.ally[k] = 0;
      if (typeof d.truce[k] !== 'number') d.truce[k] = 0;
    }
  }
  return d;
}

export function initDiplomacy(state) {
  state.diplomacy = { rel: {}, ally: {}, truce: {} };
  const ids = Object.keys(state.factions);
  const rng = mulberry32((state.seed || 1) + 271);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      state.diplomacy.rel[k] = 32 + Math.floor(rng() * 26);
      state.diplomacy.ally[k] = 0;
      state.diplomacy.truce[k] = 0;
    }
  }
  return state.diplomacy;
}

export function relationOf(state, a, b) {
  const d = ensureDiplomacy(state);
  const v = d.rel[pairKey(a, b)];
  return typeof v === 'number' ? v : 40;
}
export function allyMonths(state, a, b) {
  const d = ensureDiplomacy(state);
  return d.ally[pairKey(a, b)] || 0;
}
export function truceMonths(state, a, b) {
  const d = ensureDiplomacy(state);
  return d.truce[pairKey(a, b)] || 0;
}
export const isAllied = (state, a, b) => !!a && !!b && a !== b && allyMonths(state, a, b) > 0;
export const isTruce = (state, a, b) => !!a && !!b && a !== b && truceMonths(state, a, b) > 0;
/* 서로 칠 수 없는 사이 — 동맹 또는 정전 */
export const isPacified = (state, a, b) => isAllied(state, a, b) || isTruce(state, a, b);

export function relationLabel(state, a, b) {
  if (isAllied(state, a, b)) return '동맹';
  if (isTruce(state, a, b)) return '정전';
  const rel = relationOf(state, a, b);
  if (rel >= 60) return '우호';
  if (rel < 30) return '적대';
  return '중립';
}

/* 매달 동맹·정전 잔여 개월을 줄이고, 끝난 관계는 문구를 남긴다 */
export function tickDiplomacy(state) {
  const d = ensureDiplomacy(state);
  for (const k of Object.keys(d.ally)) {
    if (d.ally[k] <= 0) continue;
    d.ally[k] -= 1;
    if (d.ally[k] === 0) {
      d.rel[k] = clamp((d.rel[k] || 40) - 10, 0, 100);
      const [a, b] = k.split('|');
      if (a === state.playerId || b === state.playerId) {
        const other = a === state.playerId ? b : a;
        if (state.factions[other]) log(state, `${state.factions[other].name}군과의 동맹이 기한이 다해 끝났습니다.`);
      }
    }
  }
  for (const k of Object.keys(d.truce)) {
    if (d.truce[k] <= 0) continue;
    d.truce[k] -= 1;
    if (d.truce[k] === 0) {
      const [a, b] = k.split('|');
      if (a === state.playerId || b === state.playerId) {
        const other = a === state.playerId ? b : a;
        if (state.factions[other]) log(state, `${state.factions[other].name}군과의 정전이 끝났습니다.`);
      }
    }
  }
}

/* 멸망한 세력의 외교 기록 정리 */
export function cleanDiplomacy(state) {
  const d = ensureDiplomacy(state);
  for (const shelf of [d.rel, d.ally, d.truce]) {
    for (const k of Object.keys(shelf)) {
      const [a, b] = k.split('|');
      if (!state.factions[a] || !state.factions[b] || !state.factions[a].alive || !state.factions[b].alive) delete shelf[k];
    }
  }
  ensureDiplomacy(state);
}

export function factionGold(state, fid) {
  return factionCities(state, fid).reduce((s, c) => s + c.gold, 0);
}
/* 세력 전체 금에서 꺼낸다 — 금이 많은 성부터 */
export function spendFactionGold(state, fid, amount) {
  let left = amount;
  const cs = factionCities(state, fid).sort((a, b) => b.gold - a.gold);
  for (const c of cs) {
    const take = Math.min(c.gold, left);
    c.gold -= take; left -= take;
    if (left <= 0) break;
  }
  return amount - left;
}

/* 외교 화면에 세울 다른 세력 목록 */
export function diplomacyView(state) {
  const me = state.playerId;
  return Object.keys(state.factions)
    .filter((fid) => fid !== me && state.factions[fid].alive && factionCities(state, fid).length)
    .map((fid) => {
      const f = state.factions[fid];
      const lord = lordOf(state, fid);
      const cs = factionCities(state, fid);
      return {
        id: fid, name: f.name, color: f.color, mark: f.mark,
        lordId: f.lord, lordName: lord ? lord.ko : f.name, lordCha: lord ? lord.cha : 60,
        cities: cs.length, troops: cs.reduce((s, c) => s + c.troops, 0), fame: Math.round(f.fame),
        rel: relationOf(state, me, fid), label: relationLabel(state, me, fid),
        allied: isAllied(state, me, fid), truce: isTruce(state, me, fid),
        allyMonths: allyMonths(state, me, fid), truceMonths: truceMonths(state, me, fid),
      };
    })
    .sort((a, b) => b.cities - a.cities);
}

export function diplomacyCheck(state, kind, targetFid) {
  const me = state.playerId;
  const f = state.factions[me];
  const t = state.factions[targetFid];
  const cost = DIPLO[kind];
  if (!cost) return { ok: false, why: '알 수 없는 외교입니다.' };
  if (!f || !f.alive) return { ok: false, why: '아군 세력이 없습니다.' };
  if (!t || !t.alive || targetFid === me) return { ok: false, why: '대상 세력이 없습니다.' };
  if (isAllied(state, me, targetFid) && (kind === 'envoy' || kind === 'alliance')) return { ok: false, why: '이미 동맹 중입니다.' };
  if (kind === 'truce' && isTruce(state, me, targetFid)) return { ok: false, why: '이미 정전 중입니다.' };
  if (kind === 'break' && !isAllied(state, me, targetFid)) return { ok: false, why: '동맹 중인 세력이 아닙니다.' };
  if (state.actionPoints < cost.ap) return { ok: false, why: '행동력이 부족합니다.' };
  if (factionGold(state, me) < cost.gold) return { ok: false, why: `금이 부족합니다(${cost.gold} 필요).` };
  return { ok: true };
}

/* 친선 사절 — 금 300 · 행동력 1 → 우호도 +15~25 */
export function sendEnvoy(state, targetFid) {
  const c = diplomacyCheck(state, 'envoy', targetFid);
  if (!c.ok) return { ok: false, msg: c.why };
  spendFactionGold(state, state.playerId, DIPLO.envoy.gold);
  state.actionPoints -= DIPLO.envoy.ap;
  const d = ensureDiplomacy(state);
  const k = pairKey(state.playerId, targetFid);
  const before = d.rel[k] || 40;
  const gain = randInt(rngOf(state), 15, 25);
  d.rel[k] = clamp(before + gain, 0, 100);
  bumpRng(state, 2);
  const msg = `${state.factions[targetFid].name}군에 사신을 보냈습니다. 우호도 ${before} → ${d.rel[k]} (+${d.rel[k] - before})`;
  log(state, msg);
  return { ok: true, msg, rel: d.rel[k], gain: d.rel[k] - before, label: relationLabel(state, state.playerId, targetFid) };
}

export function allianceChance(state, targetFid) {
  const rel = relationOf(state, state.playerId, targetFid);
  const me = state.factions[state.playerId];
  const t = state.factions[targetFid];
  const lord = lordOf(state, state.playerId);
  let c = 0.12 + rel / 240 + (lord ? lord.cha : 60) / 520 + (me ? me.fame : 45) / 520 - (t ? t.fame : 45) / 700;
  if (isTruce(state, state.playerId, targetFid)) c += 0.1;
  return clamp(c, 0.05, 0.9);
}
export function truceChance(state, targetFid) {
  const rel = relationOf(state, state.playerId, targetFid);
  const lord = lordOf(state, state.playerId);
  const t = state.factions[targetFid];
  return clamp(0.32 + rel / 210 + (lord ? lord.cha : 60) / 620 - (t ? t.fame : 45) / 900, 0.1, 0.95);
}

/* 동맹 제의 — 금 500 · 행동력 1 */
export function proposeAlliance(state, targetFid) {
  const c = diplomacyCheck(state, 'alliance', targetFid);
  if (!c.ok) return { ok: false, msg: c.why };
  const chance = allianceChance(state, targetFid);
  spendFactionGold(state, state.playerId, DIPLO.alliance.gold);
  state.actionPoints -= DIPLO.alliance.ap;
  const d = ensureDiplomacy(state);
  const k = pairKey(state.playerId, targetFid);
  const before = d.rel[k] || 40;
  const ok = rngOf(state)() < chance;
  bumpRng(state, 3);
  if (ok) {
    d.ally[k] = ALLIANCE_MONTHS;
    d.truce[k] = 0;
    d.rel[k] = Math.max(before, 70);
    const msg = `${state.factions[targetFid].name}군과 ${ALLIANCE_MONTHS}개월 동맹을 맺었습니다! 서로 치지 않고, 원군도 함께합니다.`;
    log(state, msg);
    return { ok: true, accepted: true, chance, msg, rel: d.rel[k], months: ALLIANCE_MONTHS };
  }
  d.rel[k] = clamp(before - 5, 0, 100);
  const msg = `${state.factions[targetFid].name}군이 동맹을 사양했습니다. 우호도 ${before} → ${d.rel[k]}`;
  log(state, msg);
  return { ok: true, accepted: false, chance, msg, rel: d.rel[k] };
}

/* 정전 협정 — 금 400 · 행동력 1 */
export function proposeTruce(state, targetFid) {
  const c = diplomacyCheck(state, 'truce', targetFid);
  if (!c.ok) return { ok: false, msg: c.why };
  const chance = truceChance(state, targetFid);
  spendFactionGold(state, state.playerId, DIPLO.truce.gold);
  state.actionPoints -= DIPLO.truce.ap;
  const d = ensureDiplomacy(state);
  const k = pairKey(state.playerId, targetFid);
  const ok = rngOf(state)() < chance;
  bumpRng(state, 4);
  if (ok) {
    d.truce[k] = TRUCE_MONTHS;
    const msg = `${state.factions[targetFid].name}군과 ${TRUCE_MONTHS}개월 정전에 합의했습니다.`;
    log(state, msg);
    return { ok: true, accepted: true, chance, msg, months: TRUCE_MONTHS };
  }
  const msg = `${state.factions[targetFid].name}군이 정전을 받아들이지 않았습니다.`;
  log(state, msg);
  return { ok: true, accepted: false, chance, msg };
}

/* 동맹 파기 — 즉시 공격 가능, 명성 -15, 타 세력 우호도 -6 */
export function breakAlliance(state, targetFid) {
  const c = diplomacyCheck(state, 'break', targetFid);
  if (!c.ok) return { ok: false, msg: c.why };
  const d = ensureDiplomacy(state);
  const me = state.playerId;
  const k = pairKey(me, targetFid);
  d.ally[k] = 0;
  d.truce[k] = 0;
  d.rel[k] = clamp((d.rel[k] || 70) - 30, 0, 100);
  bumpFame(state, me, -15);
  for (const other of Object.keys(state.factions)) {
    if (other === me || other === targetFid || !state.factions[other].alive) continue;
    const kk = pairKey(me, other);
    d.rel[kk] = clamp((d.rel[kk] || 40) - 6, 0, 100);
  }
  const msg = `${state.factions[targetFid].name}군과의 동맹을 깨뜨렸습니다. 명성 -15, 천하가 그대를 의심합니다.`;
  log(state, msg);
  return { ok: true, msg, fame: state.factions[me].fame };
}

/* ---------- 전략 계략 (이간·정탐·유언비어) ---------- */
export const PLOTS = {
  sow: { ko: '이간계', gold: 300, desc: '적 장수 한 명의 충성을 떨어뜨립니다(-10~20).' },
  scout: { ko: '정탐', gold: 200, desc: '적 성의 장수·충성·훈련을 3턴 동안 들여다봅니다.' },
  rumor: { ko: '유언비어', gold: 250, desc: '적 성의 치안·훈련·금·식량을 흔듭니다.' },
};
export const SCOUT_TURNS = 3;

export function isScouted(state, cityId) {
  const s = (state.scouted || {})[cityId];
  return !!s && s.until > state.turn;
}
export function scoutTurnsLeft(state, cityId) {
  const s = (state.scouted || {})[cityId];
  return s && s.until > state.turn ? s.until - state.turn : 0;
}
/* 정탐한 성의 속내 — 장수 능력치·충성도·진형까지 */
export function scoutedInfo(state, cityId) {
  const c = state.cities[cityId];
  if (!c) return null;
  return {
    cityId, ko: cityName(cityId), owner: c.owner, ownerName: c.owner && state.factions[c.owner] ? state.factions[c.owner].name : '재야',
    troops: c.troops, train: c.train, order: c.order, water: c.water, def: c.def,
    gold: Math.round(c.gold), food: Math.round(c.food), agri: c.agri, comm: c.comm,
    generals: generalsInCity(state, cityId).map((g) => {
      const t = generalOf(state, g.id);
      return {
        gid: g.id, ko: t.ko, lead: t.lead, war: t.war, int: t.int, pol: t.pol, cha: t.cha,
        loyalty: Math.round(g.loyalty || 0), arms: t.arms, skill: t.skill, skillKo: (SKILLS[t.skill] || {}).ko || t.skill,
        formation: (t.formations && t.formations[0]) || 'eorin',
      };
    }),
  };
}

export function cityBestInt(state, cityId) {
  return generalsInCity(state, cityId).reduce((m, g) => Math.max(m, generalOf(state, g.id).int || 0), 40);
}

/* 성공률 — 파견 장수 지력 vs 적 성 최고 지력 (+신산) */
export function plotChance(state, fromCityId, toCityId, kind, gid) {
  const t = generalOf(state, gid);
  const myInt = t ? t.int : 50;
  const theirs = cityBestInt(state, toCityId);
  let c = 0.42 + (myInt - theirs) / 190;
  if (t && t.skill === 'sinsan') c += 0.12;
  if (kind === 'scout') c += 0.1;
  if (kind === 'rumor') c += 0.04;
  const best = generalsInCity(state, toCityId).map((g) => generalOf(state, g.id)).find((x) => x && x.skill === 'sinsan');
  if (best) c -= 0.08;
  return clamp(c, 0.15, 0.95);
}

export function plotCheck(state, fromCityId, toCityId, kind, gid) {
  const me = state.playerId;
  const plot = PLOTS[kind];
  if (!plot) return { ok: false, why: '알 수 없는 계략입니다.' };
  const from = state.cities[fromCityId];
  const to = state.cities[toCityId];
  if (!from || from.owner !== me) return { ok: false, why: '아군 성이 아닙니다.' };
  if (!to || !to.owner || to.owner === me) return { ok: false, why: '적 성이 아닙니다.' };
  if (!isAdjacent(fromCityId, toCityId)) return { ok: false, why: '인접한 성에만 계략을 쓸 수 있습니다.' };
  if (isPacified(state, me, to.owner)) return { ok: false, why: '동맹·정전 중인 세력에는 계략을 쓸 수 없습니다.' };
  const g = state.generals[gid];
  if (!g || g.city !== fromCityId || g.faction !== me || g.captive || g.dead) return { ok: false, why: '이 성에 있는 아군 장수가 아닙니다.' };
  if (g.acted) return { ok: false, why: '이번 달에 이미 움직였습니다.' };
  if (state.actionPoints < 1) return { ok: false, why: '행동력이 부족합니다.' };
  if (from.gold < plot.gold) return { ok: false, why: `이 성의 금이 부족합니다(${plot.gold} 필요).` };
  if (kind === 'sow' && !generalsInCity(state, toCityId).length) return { ok: false, why: '적 성에 이간할 장수가 없습니다.' };
  return { ok: true };
}

/* 계략 실행 — 행동력 1 · 성의 금 · 지력 높은 장수 파견 */
export function runPlot(state, fromCityId, toCityId, kind, gid) {
  const check = plotCheck(state, fromCityId, toCityId, kind, gid);
  if (!check.ok) return { ok: false, msg: check.why };
  const from = state.cities[fromCityId];
  const to = state.cities[toCityId];
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  const plot = PLOTS[kind];
  const chance = plotChance(state, fromCityId, toCityId, kind, gid);
  const rng = rngOf(state);
  const success = rng() < chance;
  from.gold -= plot.gold;
  state.actionPoints -= 1;
  g.acted = true;
  let msg = '';
  const out = { ok: true, success, chance, kind, msg: '' };
  if (!success) {
    msg = `${t.ko}의 ${plot.ko}가 적에게 들켰습니다. (금 ${plot.gold}만 잃었습니다)`;
  } else if (kind === 'scout') {
    state.scouted = state.scouted || {};
    state.scouted[toCityId] = { until: state.turn + SCOUT_TURNS, by: gid, turn: state.turn };
    msg = `${t.ko}가 ${cityName(toCityId)}의 속내를 살피고 돌아왔습니다. ${SCOUT_TURNS}턴 동안 장수·충성·훈련을 볼 수 있습니다.`;
  } else if (kind === 'sow') {
    const gens = generalsInCity(state, toCityId);
    gens.sort((a, b) => (a.loyalty || 0) - (b.loyalty || 0));
    const victim = gens[0];
    const vt = generalOf(state, victim.id);
    const before = victim.loyalty || 0;
    const dec = randInt(rngOf(state), 10, 20);
    victim.loyalty = clamp(before - dec, 0, 100);
    out.victim = { gid: victim.id, ko: vt.ko, before, after: victim.loyalty };
    msg = `이간계가 통해 ${cityName(toCityId)}의 ${vt.ko} 충성도가 ${before} → ${victim.loyalty}로 떨어졌습니다.`;
  } else if (kind === 'rumor') {
    const rr = rngOf(state);
    const order = randInt(rr, 8, 14);
    const train = randInt(rr, 6, 12);
    to.order = clamp(to.order - order, 0, 100);
    to.train = clamp(to.train - train, 10, 100);
    to.gold = Math.round(to.gold * 0.85);
    to.food = Math.round(to.food * 0.9);
    out.effect = { order, train };
    msg = `${cityName(toCityId)}에 유언비어가 퍼졌습니다. 치안 -${order} · 훈련 -${train} · 금·식량이 흔들렸습니다.`;
  }
  out.msg = msg;
  log(state, msg);
  bumpRng(state, 5);
  return out;
}

/* ---------- 월간 이벤트 ---------- */
export const EVENT_CHANCE = 0.3;
const seasonOf = (m) => (m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn');
const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };

export function wandererCandidate(state) {
  const mine = factionCities(state, state.playerId).map((c) => c.id);
  return Object.values(state.generals).find((g) => !g.faction && !g.captive && !g.dead && g.city && !mine.includes(g.city)) || null;
}

export function monthlyEventPool(state) {
  const season = seasonOf(state.month);
  return ['harvest', 'bandits', 'wanderer', 'plague', 'drought', 'doctor'].filter((id) => {
    if (id === 'harvest') return season === 'spring' || season === 'autumn';
    if (id === 'plague' || id === 'drought') return season === 'summer';
    if (id === 'doctor') return season === 'winter';
    if (id === 'wanderer') return !!wandererCandidate(state);
    return true;
  });
}

export function buildEvent(state, id, rng = Math.random) {
  const fid = state.playerId;
  const f = state.factions[fid];
  const cs = factionCities(state, fid);
  const lordG = f && state.generals[f.lord] ? state.generals[f.lord] : null;
  const lordCity = lordG && lordG.city ? lordG.city : (cs[0] ? cs[0].id : null);
  const season = SEASON_KO[seasonOf(state.month)];
  const ev = { id, title: '', text: '', options: [], data: {} };
  if (id === 'harvest') {
    const total = cs.reduce((s, c) => s + Math.round(c.agri * 14 + 120), 0);
    ev.title = '풍작';
    ev.text = `${season} 날씨가 곱게 들어 곡창이 가득 찼습니다. 곳간마다 식량이 ${fmtOr(total)} 더 쌓였습니다.`;
    ev.options = [{ id: 'rejoice', ko: '기뻐한다' }];
    ev.data = { total };
    return ev;
  }
  if (id === 'wanderer') {
    const cand = wandererCandidate(state);
    const t = cand ? generalOf(state, cand.id) : null;
    if (!cand || !t) return null;
    ev.title = '유랑 무장';
    ev.text = `떠돌던 무장 ${withJosa(t.ko, '이')} 성문을 두드리며 휘하에 들기를 청합니다. (통 ${t.lead}·무 ${t.war}·지 ${t.int})`;
    ev.options = [{ id: 'accept', ko: '받아들인다', hint: `충성 62로 합류 · 명성 +2` }, { id: 'refuse', ko: '돌려보낸다', hint: '명성 변화 없음' }];
    ev.data = { gid: cand.id, ko: t.ko, city: lordCity };
    return ev;
  }
  if (id === 'bandits') {
    const gold = 400 + Math.round(rng() * 200);
    ev.title = '도적 소탕';
    ev.text = `산길에 도적이 들끓어 상로가 막혔습니다. 토벌에 나서면 병사 몇을 잃는 대신 금과 이름을 얻습니다.`;
    ev.options = [
      { id: 'sweep', ko: '토벌한다', hint: `병력 -400 · 금 +${fmtOr(gold)} · 명성 +3` },
      { id: 'ignore', ko: '그냥 둔다', hint: '모든 성 치안 -6' },
    ];
    ev.data = { gold, city: lordCity };
    return ev;
  }
  if (id === 'plague') {
    ev.title = '역병';
    ev.text = `더위 속에 역병이 돌았습니다. 의원을 불러 막을 수 있지만 약값이 듭니다.`;
    ev.options = [
      { id: 'treat', ko: '의원을 부른다', hint: '금 300 · 피해 절반' },
      { id: 'endure', ko: '견딘다', hint: '모든 성 치안 -8 · 병력 -5% · 식량 -12%' },
    ];
    ev.data = {};
    return ev;
  }
  if (id === 'drought') {
    ev.title = '가뭄';
    ev.text = `비가 오지 않아 논바닥이 갈라졌습니다. 수리 시설을 손보면 피해를 줄일 수 있습니다.`;
    ev.options = [
      { id: 'irrigate', ko: '수리를 손본다', hint: '금 250 · 수리 +4 · 식량 -6%' },
      { id: 'endure', ko: '견딘다', hint: '수리 -6 · 농업 -3 · 식량 -15%' },
    ];
    ev.data = {};
    return ev;
  }
  if (id === 'doctor') {
    ev.title = '명의 방문';
    ev.text = `이름난 의원이 찾아와 군중의 상처를 돌봐 주겠다고 합니다. 병력이 회복됩니다.`;
    ev.options = [{ id: 'welcome', ko: '맞이한다', hint: '모든 성 병력 +7% · 명성 +1' }];
    ev.data = {};
    return ev;
  }
  return null;
}

/* 달이 바뀔 때 30% 확률로 이벤트 */
export function rollMonthlyEvent(state, rng = Math.random) {
  if (state.pendingEvent) return state.pendingEvent;
  if (rng() >= EVENT_CHANCE) return null;
  const pool = monthlyEventPool(state);
  if (!pool.length) return null;
  const pickId = pool[Math.floor(rng() * pool.length)];
  const ev = buildEvent(state, pickId, rng);
  if (!ev) return null;
  ev.turn = state.turn;
  ev.year = state.year;
  ev.month = state.month;
  state.pendingEvent = ev;
  log(state, `${ev.title} — ${ev.text}`);
  return ev;
}

export function resolveEvent(state, choiceId = null) {
  const ev = state.pendingEvent;
  if (!ev) return { ok: false, msg: '진행 중인 이벤트가 없습니다.' };
  const opts = ev.options || [];
  const opt = opts.find((o) => o.id === choiceId) || opts[0];
  const fid = state.playerId;
  const cs = factionCities(state, fid);
  let msg = '';
  if (ev.id === 'harvest') {
    let total = 0;
    for (const c of cs) { const add = Math.round(c.agri * 14 + 120); c.food += add; total += add; }
    msg = `풍작으로 식량 ${fmtOr(total)}을 거두었습니다.`;
  } else if (ev.id === 'wanderer') {
    if (opt.id === 'accept') {
      const g = state.generals[ev.data.gid];
      const t = generalOf(state, ev.data.gid);
      if (g) {
        g.faction = fid; g.city = ev.data.city; g.loyalty = 62; g.acted = true;
        bumpFame(state, fid, 2);
        msg = `${t ? t.ko : '무장'}이 아군이 되었습니다. (충성 62 · 명성 +2)`;
      }
    } else {
      msg = `${withJosa(ev.data.ko, '을')} 돌려보냈습니다.`;
    }
  } else if (ev.id === 'bandits') {
    if (opt.id === 'sweep') {
      const c = state.cities[ev.data.city] || cs[0];
      if (c) { c.troops = Math.max(500, c.troops - 400); c.gold += ev.data.gold; }
      bumpFame(state, fid, 3);
      msg = `도적을 소탕해 금 ${fmtOr(ev.data.gold)}을 얻고 명성 +3을 쌓았습니다.`;
    } else {
      for (const c of cs) c.order = clamp(c.order - 6, 0, 100);
      msg = `도적을 그냥 두어 모든 성의 치안이 6씩 떨어졌습니다.`;
    }
  } else if (ev.id === 'plague') {
    const treat = opt.id === 'treat' && factionGold(state, fid) >= 300;
    if (treat) spendFactionGold(state, fid, 300);
    for (const c of cs) {
      if (treat) { c.order = clamp(c.order - 3, 0, 100); c.food = Math.round(c.food * 0.95); }
      else { c.order = clamp(c.order - 8, 0, 100); c.troops = Math.max(300, Math.round(c.troops * 0.95)); c.food = Math.round(c.food * 0.88); }
    }
    msg = treat ? '의원을 불러 역병을 수습했습니다. (금 300)' : '역병이 돌아 병력과 식량을 잃었습니다.';
  } else if (ev.id === 'drought') {
    const irrigate = opt.id === 'irrigate' && factionGold(state, fid) >= 250;
    if (irrigate) spendFactionGold(state, fid, 250);
    for (const c of cs) {
      if (irrigate) { c.water = clamp(c.water + 4, 0, 100); c.food = Math.round(c.food * 0.94); }
      else { c.water = clamp(c.water - 6, 0, 100); c.agri = clamp(c.agri - 3, 0, 100); c.food = Math.round(c.food * 0.85); }
    }
    msg = irrigate ? '수리 시설을 손보아 가뭄 피해를 줄였습니다. (금 250)' : '가뭄으로 수리와 농업이 메말랐습니다.';
  } else if (ev.id === 'doctor') {
    let add = 0;
    for (const c of cs) { const inc = Math.round(c.troops * 0.07); c.troops += inc; add += inc; }
    bumpFame(state, fid, 1);
    msg = `명의가 병사 ${fmtOr(add)}명을 되살렸습니다. 명성 +1`;
  }
  state.pendingEvent = null;
  log(state, msg);
  syncOffices(state);
  bumpRng(state, 6);
  return { ok: true, msg, event: ev, choice: opt.id };
}

const fmtOr = (n) => Math.round(n).toLocaleString('ko-KR');

/* ---------- 전투 원군 ---------- */
export const REINFORCE_MAX = 2;
export const REINFORCE_RATIO = 0.35;

/* 원군 후보 — 기준 성에 인접한 아군·동맹 성 중 병력과 장수가 남은 곳 */
export function reinforcementCandidates(state, baseCityIds, fid, exclude = []) {
  const seen = new Set();
  const out = [];
  for (const base of baseCityIds) {
    if (!CITY_BY_ID[base]) continue;
    for (const n of neighbors(base)) {
      if (seen.has(n) || exclude.includes(n)) continue;
      const c = state.cities[n];
      if (!c || !c.owner) continue;
      const ally = c.owner !== fid;
      if (ally && !isAllied(state, c.owner, fid)) continue;
      if (isPacified(state, fid, c.owner)) continue;
      if (c.troops < 1600) continue;
      const ownLord = state.factions[c.owner] ? state.factions[c.owner].lord : null;
      const gens = generalsInCity(state, n).filter((g) => !g.acted && g.id !== ownLord);
      if (!gens.length) continue;
      gens.sort((a, b) => {
        const ta = generalOf(state, a.id), tb = generalOf(state, b.id);
        return (tb.lead + tb.war) - (ta.lead + ta.war);
      });
      const g = gens[0];
      const t = generalOf(state, g.id);
      const troops = Math.min(Math.round(c.troops * REINFORCE_RATIO), 4200, c.troops - 800);
      if (troops < 500) continue;
      seen.add(n);
      out.push({
        cityId: n, city: cityName(n), owner: c.owner,
        ownerName: state.factions[c.owner] ? state.factions[c.owner].name : '',
        ally, gid: g.id, gname: t.ko, troops,
        spec: { id: t.id, ko: t.ko, lead: t.lead, war: t.war, int: t.int, pol: t.pol, cha: t.cha, arms: t.arms, skill: t.skill, formations: t.formations || ['eorin'] },
      });
    }
  }
  return out.sort((a, b) => b.troops - a.troops);
}

/* 원군으로 빠져나가는 병력을 출발 성에서 덜어 낸다 */
export function takeReinforcements(state, list) {
  for (const r of list || []) {
    const c = state.cities[r.cityId];
    if (!c) continue;
    c.troops = Math.max(300, c.troops - r.troops);
  }
}

/* 어느 쪽에 원군이 붙는가 — 방어측은 자동, 공격측은 플레이어가 고른 성 */
export function planReinforcements(state, fromCityId, toCityId, opts = {}) {
  const rng = opts.rng || rngOf(state);
  const atkFid = ownerOf(state, fromCityId);
  const defFid = ownerOf(state, toCityId);
  const me = state.playerId;
  const plan = { atk: [], def: [] };

  const defCands = reinforcementCandidates(state, [toCityId], defFid, [fromCityId, toCityId]);
  if (defFid === me) plan.def = defCands.slice(0, REINFORCE_MAX);
  else plan.def = defCands.filter(() => rng() < 0.65).slice(0, 1);

  if (atkFid === me) {
    const want = (opts.atkReinforcements || []).slice(0, REINFORCE_MAX);
    if (want.length) {
      const cands = reinforcementCandidates(state, [fromCityId], atkFid, [fromCityId, toCityId]);
      plan.atk = cands.filter((c) => want.includes(c.cityId));
    }
  } else if (opts.aiReinforce !== false) {
    const cands = reinforcementCandidates(state, [fromCityId], atkFid, [fromCityId, toCityId]);
    plan.atk = cands.filter(() => rng() < 0.5).slice(0, 1);
  }
  // 동맹 원군은 우호도가 받쳐야 온다
  plan.atk = plan.atk.filter((r) => !r.ally || relationOf(state, atkFid, r.owner) >= 55);
  plan.def = plan.def.filter((r) => !r.ally || relationOf(state, defFid, r.owner) >= 55);
  return plan;
}

/* ---------- 내정 명령 ---------- */
export const COMMANDS = {
  agri: { ko: '개발', stat: 'pol', desc: '농업을 올려 식량 생산을 늘린다.' },
  comm: { ko: '상업', stat: 'pol', desc: '상업을 올려 금 수입을 늘린다.' },
  order: { ko: '치안', stat: 'pol', desc: '치안을 올려 성 방어와 민심을 높인다.' },
  water: { ko: '수리', stat: 'int', desc: '수리 시설을 정비해 수확과 재해 대비를 높인다.' },
  draft: { ko: '징병', stat: 'lead', desc: '금·식량을 써서 병력을 모은다.' },
  train: { ko: '훈련', stat: 'lead', desc: '훈련도를 올려 전투력을 높인다.' },
  search: { ko: '탐색', stat: 'int', desc: '인재와 물자를 찾는다.' },
  hire: { ko: '등용', stat: 'cha', desc: '재야 장수를 불러들인다.' },
  reward: { ko: '포상', stat: 'cha', desc: '금을 써서 장수 충성도를 올린다.' },
  transport: { ko: '수송', stat: 'pol', desc: '인접한 아군 성으로 금·식량을 보낸다.' },
};

export function commandCost(type) {
  return type === 'draft' ? 2 : 1;
}

export function canCommand(state, type, cityId, officerId) {
  const c = state.cities[cityId];
  const fid = state.playerId;
  if (!c || c.owner !== fid) return { ok: false, why: '아군 성이 아닙니다.' };
  const g = officerId ? state.generals[officerId] : null;
  if (!g || g.city !== cityId || g.faction !== fid) return { ok: false, why: '이 성에 있는 장수가 아닙니다.' };
  if (g.acted || g.captive) return { ok: false, why: '이번 달에 이미 움직였습니다.' };
  if (state.actionPoints < commandCost(type)) return { ok: false, why: '행동력이 부족합니다.' };
  if (type === 'draft') {
    if (c.gold < 250) return { ok: false, why: '금이 부족합니다(250 필요).' };
    if (c.food < 400) return { ok: false, why: '식량이 부족합니다(400 필요).' };
  }
  if (type === 'reward' && c.gold < 120) return { ok: false, why: '금이 부족합니다(120 필요).' };
  if (type === 'hire' && freeGeneralsInCity(state, cityId).length === 0) return { ok: false, why: '이 성에 재야 장수가 없습니다.' };
  if (type === 'transport' && adjacentFriends(state, cityId).length === 0) return { ok: false, why: '인접한 아군 성이 없습니다.' };
  if (type === 'agri' && c.agri >= 100) return { ok: false, why: '농업이 이미 최대입니다.' };
  if (type === 'comm' && c.comm >= 100) return { ok: false, why: '상업이 이미 최대입니다.' };
  if (type === 'order' && c.order >= 100) return { ok: false, why: '치안이 이미 최대입니다.' };
  if (type === 'water' && c.water >= 100) return { ok: false, why: '수리가 이미 최대입니다.' };
  return { ok: true };
}

/* 명령 실행. opts: {cityId, officerId, targetCityId, gold, food, hireId, rewardId} */
export function runCommand(state, type, opts) {
  const check = canCommand(state, type, opts.cityId, opts.officerId);
  if (!check.ok) return { ok: false, msg: check.why };
  const c = state.cities[opts.cityId];
  const g = state.generals[opts.officerId];
  const t = generalOf(state, opts.officerId);
  const rng = rngOf(state);
  let msg = '';
  let gain = 0;

  switch (type) {
    case 'agri': {
      gain = 2 + Math.floor(t.pol / 26) + randInt(rng, 0, 2);
      if (t.skill === 'indeok') gain += 1;
      c.agri = clamp(c.agri + gain, 0, 100);
      msg = `${withJosa(t.ko, '이')} ${cityName(c.id)}의 농업을 ${gain} 올렸습니다. (농업 ${c.agri})`;
      break;
    }
    case 'comm': {
      gain = 2 + Math.floor(t.pol / 26) + randInt(rng, 0, 2);
      c.comm = clamp(c.comm + gain, 0, 100);
      msg = `${withJosa(t.ko, '이')} ${cityName(c.id)}의 상업을 ${gain} 올렸습니다. (상업 ${c.comm})`;
      break;
    }
    case 'order': {
      gain = 3 + Math.floor(t.pol / 22) + randInt(rng, 0, 2);
      c.order = clamp(c.order + gain, 0, 100);
      c.def = clamp(c.def + 1, 20, 99);
      msg = `${withJosa(t.ko, '이')} 치안을 ${gain} 올렸습니다. (치안 ${c.order})`;
      break;
    }
    case 'water': {
      gain = 3 + Math.floor(t.int / 22) + randInt(rng, 0, 2);
      c.water = clamp(c.water + gain, 0, 100);
      msg = `${withJosa(t.ko, '이')} 수리 시설을 정비했습니다. (수리 ${c.water})`;
      break;
    }
    case 'draft': {
      const add = 900 + Math.floor(t.lead * 4);
      c.gold -= 250; c.food -= 400;
      c.troops += add; c.order = clamp(c.order - 3, 0, 100); c.train = clamp(c.train - 6, 10, 100);
      msg = `${withJosa(t.ko, '이')} 병사 ${add.toLocaleString()}명을 모았습니다. (병력 ${c.troops.toLocaleString()})`;
      break;
    }
    case 'train': {
      gain = 4 + Math.floor(t.lead / 18);
      c.train = clamp(c.train + gain, 0, 100);
      msg = `${withJosa(t.ko, '이')} 부대를 훈련했습니다. (훈련 ${c.train})`;
      break;
    }
    case 'search': {
      const r = rng();
      if (r < 0.35) {
        const free = freeGeneralsInCity(state, c.id);
        if (free.length) msg = `${t.ko}의 탐색으로 ${cityName(c.id)}에서 인재를 찾았습니다: ${generalOf(state, free[0].id).ko}`;
        else { c.gold += 200; msg = `${withJosa(t.ko, '이')} 숨은 재물 200금을 찾았습니다.`; }
      } else if (r < 0.7) {
        const f = 400 + randInt(rng, 0, 400);
        c.food += f; msg = `${withJosa(t.ko, '이')} 곡물 ${f}를 확보했습니다.`;
      } else if (r < 0.9) {
        const gg = 150 + randInt(rng, 0, 200);
        c.gold += gg; msg = `${withJosa(t.ko, '이')} 금 ${gg}을 얻었습니다.`;
      } else {
        msg = `탐색했지만 아무것도 얻지 못했습니다.`;
      }
      break;
    }
    case 'hire': {
      const free = freeGeneralsInCity(state, c.id);
      let target = opts.hireId ? state.generals[opts.hireId] : free[0];
      if (!target || target.faction || target.city !== c.id) return { ok: false, msg: '등용할 수 없는 대상입니다.' };
      const tg = generalOf(state, target.id);
      const f = state.factions[state.playerId];
      const chance = clamp(0.34 + t.cha / 320 + f.fame / 320 - tg.war / 900 - tg.int / 900, 0.12, 0.92);
      if (rng() < chance) {
        target.faction = state.playerId;
        target.loyalty = 62 + Math.floor(t.cha / 8);
        state.stats.recruited++;
        f.fame = clamp(f.fame + 2, 0, 100);
        gain = 1;
        msg = `${withJosa(tg.ko, '이')} ${t.ko}의 설득에 응해 부하가 되었습니다! (충성 ${target.loyalty})`;
      } else {
        msg = `${tg.ko}은(는) 고개를 저었습니다. (등용 실패)`;
        target.loyalty = 0;
      }
      break;
    }
    case 'reward': {
      const gens = generalsInCity(state, c.id).filter((x) => x.id !== state.factions[state.playerId].lord);
      const target = opts.rewardId ? state.generals[opts.rewardId] : gens.sort((a, b) => a.loyalty - b.loyalty)[0];
      if (!target) return { ok: false, msg: '포상할 장수가 없습니다.' };
      c.gold -= 120;
      const inc = 8 + Math.floor(t.cha / 10) + randInt(rng, 0, 5);
      target.loyalty = clamp(target.loyalty + inc, 0, 100);
      msg = `${generalOf(state, target.id).ko}의 충성도가 ${inc} 올랐습니다. (충성 ${target.loyalty})`;
      break;
    }
    case 'transport': {
      const to = opts.targetCityId;
      if (!to || !adjacentFriends(state, c.id).includes(to)) return { ok: false, msg: '수송할 인접 아군 성을 고르세요.' };
      const gold = Math.max(0, Math.min(opts.gold || 0, c.gold));
      const food = Math.max(0, Math.min(opts.food || 0, c.food));
      if (gold + food <= 0) return { ok: false, msg: '보낼 물자가 없습니다.' };
      c.gold -= gold; c.food -= food;
      state.cities[to].gold += gold; state.cities[to].food += food;
      msg = `${cityName(c.id)}에서 ${cityName(to)}(으)로 금 ${gold}, 식량 ${food}을 보냈습니다.`;
      break;
    }
    default:
      return { ok: false, msg: '알 수 없는 명령입니다.' };
  }

  g.acted = true;
  state.actionPoints -= commandCost(type);
  if (gain && (type === 'agri' || type === 'comm' || type === 'order' || type === 'water')) {
    state.factions[state.playerId].fame = clamp(state.factions[state.playerId].fame + 1, 0, 100);
  }
  log(state, msg);
  bumpRng(state);
  return { ok: true, msg };
}

/* ---------- 도시간 장수 이동 ---------- */
export const MOVE_COST = 1;

/* 이동 후보 성 — 아군이 소유한 다른 성 */
export function moveDestinations(state, fromCityId) {
  const fid = state.playerId;
  return Object.values(state.cities)
    .filter((c) => c.owner === fid && c.id !== fromCityId)
    .map((c) => ({
      cityId: c.id, ko: cityName(c.id), troops: c.troops,
      generals: generalsInCity(state, c.id).length,
      full: generalsInCity(state, c.id).length >= MAX_OFFICERS_PER_CITY,
    }));
}

export function canMoveGenerals(state, fromCityId, toCityId, gids = []) {
  const from = state.cities[fromCityId];
  const to = state.cities[toCityId];
  const fid = state.playerId;
  if (!from || from.owner !== fid) return { ok: false, why: '아군 성이 아닙니다.' };
  if (!to || to.owner !== fid) return { ok: false, why: '목적지가 아군 성이 아닙니다.' };
  if (fromCityId === toCityId) return { ok: false, why: '출발 성과 목적지가 같습니다.' };
  const ids = [...new Set(gids)];
  if (!ids.length) return { ok: false, why: '옮길 장수를 고르세요.' };
  if (state.actionPoints < MOVE_COST) return { ok: false, why: '행동력이 부족합니다.' };
  for (const gid of ids) {
    const g = state.generals[gid];
    const t = generalOf(state, gid);
    const who = t ? t.ko : '장수';
    if (!g || g.city !== fromCityId || g.faction !== fid || g.captive || g.dead) {
      return { ok: false, why: `${who}은(는) 이 성에 있는 아군 장수가 아닙니다.` };
    }
    if (g.acted) return { ok: false, why: `${who}은(는) 이번 달에 이미 움직였습니다.` };
  }
  const here = generalsInCity(state, fromCityId).length;
  const there = generalsInCity(state, toCityId).length;
  if (there + ids.length > MAX_OFFICERS_PER_CITY) {
    return { ok: false, why: `목적지 성의 장수가 ${MAX_OFFICERS_PER_CITY}명을 넘습니다.` };
  }
  const left = here - ids.length;
  const lordMoving = ids.includes(state.factions[fid].lord);
  let warning = '';
  if (left <= 0) warning = '출발 성에 장수가 한 명도 남지 않습니다. 빈 성은 적의 공격에 그대로 노출됩니다.';
  else if (lordMoving && left <= 1) warning = '군주가 성을 떠나 장수 한 명만 남습니다.';
  return { ok: true, warning, left };
}

/* 선택한 장수들을 다른 아군 성으로 옮긴다 — 행동력 1, 옮긴 장수는 이번 달 행동 완료 */
export function moveGenerals(state, fromCityId, toCityId, gids = []) {
  const check = canMoveGenerals(state, fromCityId, toCityId, gids);
  if (!check.ok) return { ok: false, msg: check.why };
  const ids = [...new Set(gids)];
  for (const gid of ids) {
    const g = state.generals[gid];
    g.city = toCityId;
    g.acted = true;
    g.movedThisTurn = true;
  }
  state.actionPoints -= MOVE_COST;
  const names = ids.map((gid) => generalOf(state, gid).ko);
  const msg = `${cityName(fromCityId)}에서 ${withJosa(cityName(toCityId), '로')} 장수 ${ids.length}명(${names.join(', ')})을 옮겼습니다.`;
  log(state, msg);
  bumpRng(state);
  return { ok: true, msg, moved: ids, warning: check.warning || '' };
}

/* ---------- 장수 대화 (충성도 상승) ---------- */
export const TALK_COST = 1;
export const TALK_GAIN_MIN = 4;
export const TALK_GAIN_MAX = 8;

export function talkedThisTurn(state, gid) {
  return !!state.talked && state.talked[gid] === state.turn;
}

/* 대화 상대 — 이 성의 아군 장수 중 군주를 뺀 모두 */
export function talkPartners(state, cityId) {
  const lord = state.factions[state.playerId] ? state.factions[state.playerId].lord : null;
  return generalsInCity(state, cityId).filter((g) => g.id !== lord);
}

export function canTalk(state, cityId, gid) {
  const c = state.cities[cityId];
  const fid = state.playerId;
  if (!c || c.owner !== fid) return { ok: false, why: '아군 성이 아닙니다.' };
  const g = state.generals[gid];
  if (!g || g.city !== cityId || g.faction !== fid || g.captive || g.dead) {
    return { ok: false, why: '이 성에 있는 아군 장수가 아닙니다.' };
  }
  if (state.factions[fid] && state.factions[fid].lord === gid) return { ok: false, why: '군주와는 대화할 상대가 아닙니다.' };
  if (talkedThisTurn(state, gid)) return { ok: false, why: '이번 달에는 이미 이야기를 나눴습니다.' };
  if ((g.loyalty || 0) >= 100) return { ok: false, why: '충성도가 이미 최대입니다.' };
  if (state.actionPoints < TALK_COST) return { ok: false, why: '행동력이 부족합니다.' };
  return { ok: true };
}

/* 대화로 오르는 충성도 — 기본 4~8 + 군주 매력·인덕 보정, 최대 100 */
export function talkLoyaltyGain(state, lordSpec, roll) {
  let gain = clamp(roll, TALK_GAIN_MIN, TALK_GAIN_MAX);
  if (lordSpec) {
    gain += clamp(Math.floor(((lordSpec.cha || 0) - 60) / 20), 0, 2);
    if (lordSpec.skill === 'indeok') gain += 2;
  }
  return gain;
}

export function talkToGeneral(state, cityId, gid) {
  const check = canTalk(state, cityId, gid);
  if (!check.ok) return { ok: false, msg: check.why };
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  const lordSpec = lordOf(state, state.playerId);
  const rng = rngOf(state);
  const gain = talkLoyaltyGain(state, lordSpec, randInt(rng, TALK_GAIN_MIN, TALK_GAIN_MAX));
  const before = g.loyalty || 0;
  const after = clamp(before + gain, 0, 100);
  g.loyalty = after;
  state.talked = state.talked || {};
  state.talked[gid] = state.turn;
  state.actionPoints -= TALK_COST;
  const line = pickTalkLine(gid, t, before, state.turn);
  const msg = `${withJosa(t.ko, '과')} 이야기를 나눴습니다. 충성도 ${before} → ${after} (+${after - before})`;
  log(state, msg);
  bumpRng(state);
  return { ok: true, msg, line, before, after, gain: after - before, style: talkStyleOf(t, before) };
}

/* ---------- 출진 ---------- */
export function canAttack(state, fromCityId, toCityId) {
  const from = state.cities[fromCityId];
  if (!from || from.owner !== state.playerId) return { ok: false, why: '아군 성이 아닙니다.' };
  if (!isAdjacent(fromCityId, toCityId)) return { ok: false, why: '인접한 성이 아닙니다.' };
  const to = state.cities[toCityId];
  if (to.owner === state.playerId) return { ok: false, why: '아군 성입니다.' };
  if (to.owner && isPacified(state, state.playerId, to.owner)) {
    return { ok: false, why: `${isAllied(state, state.playerId, to.owner) ? '동맹' : '정전'} 중인 세력입니다.` };
  }
  if (from.troops < 1000) return { ok: false, why: '병력이 부족합니다(1000 이상).' };
  if (!generalsInCity(state, fromCityId).length) return { ok: false, why: '출진할 장수가 없습니다.' };
  return { ok: true };
}

export function battleSetup(state, fromCityId, toCityId, opts = {}) {
  const from = state.cities[fromCityId];
  const to = state.cities[toCityId];
  const atkGens = generalsInCity(state, fromCityId);
  const defGens = generalsInCity(state, toCityId);
  const plan = planReinforcements(state, fromCityId, toCityId, opts);
  takeReinforcements(state, [...plan.atk, ...plan.def]);
  return {
    fromCityId, toCityId,
    attackerFaction: from.owner,
    defenderFaction: to.owner,
    atkGenerals: (opts.atkGenerals || atkGens.map((g) => g.id)).slice(0, MAX_ARMY),
    defGenerals: defGens.map((g) => g.id),
    atkTroops: typeof opts.atkTroops === 'number' ? opts.atkTroops : from.troops,
    defTroops: to.troops,
    defBonus: to.def,
    reinforcements: plan,
  };
}

/* ---------- 턴 진행 ---------- */
export function endTurnPhase1(state) {
  const rng = rngOf(state);
  state.pendingBattles = [];

  for (const fid of Object.keys(state.factions)) {
    const f = state.factions[fid];
    if (!f.alive || f.isPlayer) continue;
    if (!factionCities(state, fid).length) { f.alive = false; continue; }
    aiEconomy(state, fid, rng);
  }

  // AI 공격 결정
  const attacks = [];
  for (const fid of Object.keys(state.factions)) {
    const f = state.factions[fid];
    if (!f.alive || f.isPlayer) continue;
    const cands = [];
    for (const c of factionCities(state, fid)) {
      for (const en of adjacentEnemies(state, c.id)) {
        const atk = cityPower(state, c.id, false) * (0.9 + rng() * 0.5);
        const def = cityPower(state, en, true);
        if (atk > def * 1.02 && c.troops > 2500) cands.push({ from: c.id, to: en, score: atk / def, fid });
      }
    }
    if (!cands.length) continue;
    cands.sort((a, b) => b.score - a.score);
    const chosen = cands[0];
    const appetite = 0.42 + f.fame / 260;
    if (rng() < appetite) attacks.push(chosen);
  }

  for (const a of attacks) {
    const targetOwner = state.cities[a.to].owner;
    if (targetOwner === state.playerId) {
      state.pendingBattles.push({ ...battleSetup(state, a.from, a.to), aiAttack: true });
    } else {
      resolveAutoBattle(state, a.from, a.to, rng);
    }
  }
  bumpRng(state, 3);
  return state.pendingBattles;
}

function aiEconomy(state, fid, rng) {
  const f = state.factions[fid];
  let ap = calcActionPoints(state, fid);
  const cities = factionCities(state, fid).filter((c) => generalsInCity(state, c.id).length > 0);
  if (!cities.length) return;
  cities.sort(() => rng() - 0.5);
  let guard = 0;
  while (ap > 0 && guard++ < 40) {
    const c = cities[Math.floor(rng() * cities.length)];
    const gens = generalsInCity(state, c.id).filter((g) => !g.acted);
    if (!gens.length) {
      // 새 성으로 이동 (인접 아군 성에 장수가 없으면)
      break;
    }
    gens.sort((a, b) => generalOf(state, b.id).pol - generalOf(state, a.id).pol);
    const g = gens[0];
    const t = generalOf(state, g.id);
    const needFood = c.food < c.troops / 12;
    const stat = needFood ? 'agri' : (c.agri < c.comm ? 'agri' : 'comm');
    if (c.troops < 9000 && c.gold > 1600 && c.food > 2500) {
      c.gold -= 250; c.food -= 400;
      c.troops += 900 + Math.floor(t.lead * 4);
      c.order = clamp(c.order - 3, 0, 100);
    } else if (c.troops < 3000 && c.gold > 600 && c.food > 1200) {
      c.gold -= 250; c.food -= 400;
      c.troops += 900 + Math.floor(t.lead * 4);
      c.order = clamp(c.order - 3, 0, 100);
    } else if (c.order < 45) {
      c.order = clamp(c.order + 3 + Math.floor(t.pol / 22), 0, 100);
    } else if (stat === 'agri' && c.agri < 92) {
      c.agri = clamp(c.agri + 2 + Math.floor(t.pol / 26), 0, 100);
    } else if (c.comm < 92) {
      c.comm = clamp(c.comm + 2 + Math.floor(t.pol / 26), 0, 100);
    } else {
      c.train = clamp(c.train + 4, 0, 100);
    }
    g.acted = true;
    ap--;
  }
  // 재야 장수 등용 시도
  if (rng() < 0.5) {
    for (const c of factionCities(state, fid)) {
      const free = freeGeneralsInCity(state, c.id);
      if (!free.length) continue;
      const gens = generalsInCity(state, c.id);
      if (!gens.length) continue;
      const t = generalOf(state, gens[0].id);
      const tg = generalOf(state, free[0].id);
      if (rng() < clamp(0.2 + t.cha / 400, 0.05, 0.6)) {
        const g = state.generals[free[0].id];
        g.faction = fid; g.loyalty = 70;
        log(state, `${f.name}군이 ${c.ko}에서 ${withJosa(tg.ko, '을')} 등용했습니다.`);
        break;
      }
    }
  }
}

export function resolveAutoBattle(state, from, to, rng = rngOf(state)) {
  const atkBase = cityPower(state, from, false);
  const defBase = cityPower(state, to, true);
  const plan = planReinforcements(state, from, to, { rng });
  takeReinforcements(state, [...plan.atk, ...plan.def]);
  const atkRe = plan.atk.reduce((s, r) => s + r.troops, 0);
  const defRe = plan.def.reduce((s, r) => s + r.troops, 0);
  const atkPower = atkBase + atkRe * 0.75;
  const defPower = defBase + defRe * 0.85;
  const roll = atkPower * (0.85 + rng() * 0.4) - defPower * (0.85 + rng() * 0.3);
  const fromC = state.cities[from];
  const toC = state.cities[to];
  const atkFid = fromC.owner;
  const defFid = toC.owner;
  if (defRe) log(state, `[원군 도착!] ${cityName(to)} 수비에 ${plan.def.map((r) => r.gname).join(', ')} 부대가 합류했습니다.`);
  if (atkRe) log(state, `[원군 도착!] 공격측에도 ${plan.atk.map((r) => r.gname).join(', ')} 부대가 붙었습니다.`);
  const attackerWins = roll > 0;
  if (attackerWins) {
    toC.owner = atkFid;
    toC.troops = Math.max(600, Math.round(fromC.troops * (0.35 + rng() * 0.2)));
    toC.train = Math.max(30, Math.round(fromC.train * 0.8));
    toC.order = clamp(toC.order - 15, 10, 100);
    fromC.troops = Math.max(500, Math.round(fromC.troops * 0.45));
    moveGeneralsOnCapture(state, to, defFid, atkFid, rng);
    log(state, `${state.factions[atkFid] ? state.factions[atkFid].name : '?'}군이 ${withJosa(cityName(to), '을')} 함락했습니다.`);
    if (defFid) bumpFame(state, defFid, -3);
    bumpFame(state, atkFid, 5);
  } else {
    fromC.troops = Math.max(500, Math.round(fromC.troops * (0.5 + rng() * 0.2)));
    toC.troops = Math.max(600, Math.round(toC.troops * (0.7 + rng() * 0.2)));
    toC.order = clamp(toC.order - 5, 10, 100);
    log(state, `${state.factions[atkFid] ? state.factions[atkFid].name : '?'}군의 ${cityName(to)} 공격이 격퇴되었습니다.`);
    bumpFame(state, atkFid, -2);
    if (defFid) bumpFame(state, defFid, 3);
  }
  checkFactionDeath(state, defFid);
  checkFactionDeath(state, atkFid);
  cleanDiplomacy(state);
  bumpRng(state, 5);
  return attackerWins;
}

export function moveGeneralsOnCapture(state, cityId, defFid, atkFid, rng) {
  // 포로로 잡혀 있는 장수는 그 자리에 묶인다
  const defGens = Object.values(state.generals).filter((g) => g.city === cityId && g.faction === defFid && !g.captive && !g.dead);
  const refuge = defFid ? factionCities(state, defFid).filter((c) => c.id !== cityId) : [];
  for (const g of defGens) {
    const r = rng();
    if (r < 0.18 && atkFid !== state.playerId) {
      // AI가 포로를 거두지 않음 → 재야로
      g.faction = null; g.city = cityId; g.loyalty = 0;
    } else if (refuge.length) {
      g.city = refuge[Math.floor(rng() * refuge.length)].id;
    } else {
      g.faction = null; g.city = cityId; g.loyalty = 0;
    }
  }
}


/* 한국어 조사 붙이기 — 유비를 / 조운을 */
export function withJosa(name, kind = '을') {
  const n = String(name || '');
  const code = n.charCodeAt(n.length - 1);
  const hasFinal = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 > 0 : false;
  const map = {
    '을': hasFinal ? '을' : '를', '를': hasFinal ? '을' : '를',
    '이': hasFinal ? '이' : '가', '가': hasFinal ? '이' : '가',
    '은': hasFinal ? '은' : '는', '는': hasFinal ? '은' : '는',
    '과': hasFinal ? '과' : '와', '와': hasFinal ? '과' : '와',
    '로': hasFinal ? '으로' : '로', '으로': hasFinal ? '으로' : '로',
  };
  return n + (map[kind] || kind);
}

/* ---------- 승전 후 포로 처분 (등용·해방·참수) ---------- */

/* 패배측 궤멸 부대 장수 중 누가 사로잡히는가 */
export function captureCandidates(state, gids, losingFid, rng) {
  const refuge = factionCities(state, losingFid);
  const out = [];
  for (const gid of gids || []) {
    const g = state.generals[gid];
    if (!g || g.dead || g.captive) continue;
    const isLord = !!state.factions[losingFid] && state.factions[losingFid].lord === gid;
    if (isLord && refuge.length) continue;   // 마지막 성이 아니면 군주는 도주한다
    const chance = isLord ? 1 : clamp(0.62 - (g.loyalty || 0) / 400, 0.18, 0.74);
    if (isLord || rng() < chance) out.push({ gid, isLord });
  }
  return out;
}

/* 포로를 붙잡아 둔다. 플레이어가 이겼으면 처분 대기, AI가 이겼으면 기존처럼 자동 처리 */
export function holdPrisoners(state, { gids, losingFid, homeCityId, holdCityId, playerWon }) {
  const held = [];
  for (const { gid, isLord } of gids) {
    const g = state.generals[gid];
    if (!g) continue;
    const t = generalOf(state, gid);
    if (playerWon) {
      g.captive = true;
      g.city = holdCityId;
      const rec = { gid, faction: losingFid, homeCity: homeCityId, city: holdCityId, isLord: !!isLord, turn: state.turn };
      state.pendingPrisoners.push(rec);
      state.stats.captured++;
      held.push(rec);
      log(state, `${withJosa(t ? t.ko : gid, '을')} 사로잡았습니다.`);
    }
    // 플레이어가 진 쪽의 장수는 붙잡히지 않고 소속을 지킨 채 물러난다(기존 규칙)
  }
  return held;
}

/* 등용 성공률 — 군주 매력·명성 vs 대상 충성도·무력 */
export function recruitChance(state, gid) {
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  if (!g || !t) return 0;
  const f = state.factions[state.playerId];
  const lord = lordOf(state, state.playerId);
  const isLord = Object.values(state.factions).some((x) => x.lord === gid);
  let c = 0.28 + (lord ? lord.cha : 60) / 300 + (f ? f.fame : 45) / 320 - (g.loyalty || 0) / 260 - (t.war || 0) / 1100;
  if (isLord) c -= 0.22;
  if (lord && lord.skill === 'indeok') c += 0.06;
  if (t.skill === 'indeok') c += 0.03;
  return clamp(c, 0.05, 0.92);
}

function dropPrisoner(state, gid) {
  state.pendingPrisoners = (state.pendingPrisoners || []).filter((p) => p.gid !== gid);
}

/* 등용 — 거절당하면 다시 해방·참수를 고를 수 있다 */
export function recruitPrisoner(state, gid, rng = Math.random) {
  const rec = (state.pendingPrisoners || []).find((p) => p.gid === gid);
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  if (!rec || !g) return { ok: false, msg: '포로가 아닙니다.' };
  const chance = recruitChance(state, gid);
  if (rng() >= chance) {
    rec.tried = true;
    return { ok: true, accepted: false, chance, msg: `${t.ko}: "두 임금을 섬길 수 없습니다." — 등용에 응하지 않았습니다.` };
  }
  const lord = lordOf(state, state.playerId);
  g.captive = false;
  g.dead = false;
  g.faction = state.playerId;
  g.city = rec.city;
  g.loyalty = clamp(46 + Math.round((lord ? lord.cha : 60) / 6) - (rec.isLord ? 12 : 0), 30, 88);
  state.stats.recruited++;
  dropPrisoner(state, gid);
  log(state, `${withJosa(t.ko, '이')} ${state.factions[state.playerId].name}군에 합류했습니다. (충성 ${g.loyalty})`);
  return { ok: true, accepted: true, chance, loyalty: g.loyalty, msg: `${withJosa(t.ko, '이')} 고개를 숙였습니다! 충성 ${g.loyalty}로 아군이 되었습니다.` };
}

/* 해방 — 명성 +5, 원 소속(없으면 재야)으로 돌려보낸다 */
export function releasePrisoner(state, gid) {
  const rec = (state.pendingPrisoners || []).find((p) => p.gid === gid);
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  if (!rec || !g) return { ok: false, msg: '포로가 아닙니다.' };
  const home = factionCities(state, rec.faction);
  const alive = home.length > 0 && state.factions[rec.faction] && state.factions[rec.faction].alive;
  g.captive = false;
  g.faction = alive ? rec.faction : null;
  g.city = alive ? (home.some((c) => c.id === rec.homeCity) ? rec.homeCity : home[0].id) : rec.city;
  g.loyalty = alive ? Math.max(g.loyalty || 0, 55) : 0;
  state.stats.released = (state.stats.released || 0) + 1;
  bumpFame(state, state.playerId, 5);
  dropPrisoner(state, gid);
  log(state, `${withJosa(t.ko, '을')} 풀어 주었습니다. 의를 베푼 이름이 퍼집니다. (명성 +5)`);
  return { ok: true, msg: `${withJosa(t.ko, '을')} 풀어 주었습니다. 명성 +5`, fame: state.factions[state.playerId].fame };
}

/* 참수 — 영구 퇴장(다시 등장하지 않음), 명성 소폭 하락과 원한 */
export function executePrisoner(state, gid) {
  const rec = (state.pendingPrisoners || []).find((p) => p.gid === gid);
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  if (!rec || !g) return { ok: false, msg: '포로가 아닙니다.' };
  g.captive = false;
  g.dead = true;
  g.faction = null;
  g.city = null;
  g.loyalty = 0;
  state.stats.executed = (state.stats.executed || 0) + 1;
  for (const o of Object.values(state.generals)) {
    if (o.id === gid || o.dead || o.captive) continue;
    if (o.faction === rec.faction) o.loyalty = clamp((o.loyalty || 0) + 4, 0, 100);
  }
  bumpFame(state, state.playerId, rec.isLord ? -4 : -2);
  dropPrisoner(state, gid);
  checkFactionDeath(state, rec.faction);
  log(state, `${withJosa(t.ko, '의')} 목을 베었습니다. 그 이름은 이제 기록에만 남습니다.`);
  return { ok: true, msg: `${withJosa(t.ko, '을')} 참수했습니다. 다시는 나타나지 않습니다.` };
}

export function bumpFame(state, fid, n) {
  const f = state.factions[fid];
  if (!f) return;
  f.fame = clamp(f.fame + n, 0, 100);
}

export function checkFactionDeath(state, fid) {
  if (!fid) return;
  const f = state.factions[fid];
  if (!f) return;
  if (!factionCities(state, fid).length) {
    f.alive = false;
    log(state, `${f.name} 세력이 멸망했습니다.`);
    cleanDiplomacy(state);
  }
  if (fid === state.playerId && !f.alive) {
    state.gameOver = { type: 'defeat', text: `${f.name} 세력이 멸망했습니다.` };
  }
}

export function endTurnPhase2(state) {
  // 월 수입·소비
  for (const c of Object.values(state.cities)) {
    if (!c.owner) continue;
    const office = OFFICES[officeLevel(state, c.owner)] || OFFICES[0];
    const tax = 1 + office.tax;
    const gold = Math.round((c.comm * 5 + c.order * 0.8) * tax);
    const food = Math.round(c.agri * 7 + c.water * 1.5);
    c.gold += gold;
    c.food += food - Math.ceil(c.troops / 18);
    if (c.food < 0) {
      const deficit = -c.food;
      c.food = 0;
      c.troops = Math.max(300, c.troops - Math.round(deficit * 8));
      if (c.owner === state.playerId) log(state, `${cityName(c.id)}의 식량이 바닥나 병사가 이탈했습니다.`);
    }
  }
  // 재해·풍작
  const rng = rngOf(state);
  for (const c of Object.values(state.cities)) {
    if (!c.owner) continue;
    if (rng() < 0.035) {
      if (c.water < 35) {
        const dmg = Math.round(c.food * 0.2);
        c.food -= dmg; c.order = clamp(c.order - 6, 0, 100);
        if (c.owner === state.playerId) log(state, `${cityName(c.id)}에 수해가 나 식량 ${dmg}을 잃었습니다.`);
      } else if (c.order < 40) {
        c.gold = Math.round(c.gold * 0.85);
        if (c.owner === state.playerId) log(state, `${cityName(c.id)}에서 민란이 일어 금을 잃었습니다.`);
      }
    }
    if (rng() < 0.03) {
      const bonus = Math.round(c.food * 0.15) + 100;
      c.food += bonus;
      if (c.owner === state.playerId) log(state, `${cityName(c.id)}에 풍작이 들어 식량 ${bonus}을 얻었습니다.`);
    }
  }
  // 충성도 이탈
  for (const g of Object.values(state.generals)) {
    if (!g.faction || g.captive || g.dead) continue;
    if (g.faction === state.playerId) continue;
    if (g.loyalty < 40 && rng() < 0.05) {
      g.faction = null; g.loyalty = 0;
    }
  }

  // 턴 증가
  state.turn++;
  state.month++;
  if (state.month > 12) { state.month = 1; state.year++; }
  for (const g of Object.values(state.generals)) { g.acted = false; g.movedThisTurn = false; }
  state.talked = {};
  // 외교 기한 · 정탐 기한 · 관직
  tickDiplomacy(state);
  state.scouted = state.scouted || {};
  for (const cid of Object.keys(state.scouted)) {
    if (!(state.scouted[cid].until > state.turn)) delete state.scouted[cid];
  }
  for (const fid of Object.keys(state.factions)) if (state.factions[fid].alive) checkFactionDeath(state, fid);
  cleanDiplomacy(state);
  syncOffices(state);
  state.maxActionPoints = calcActionPoints(state, state.playerId);
  state.actionPoints = state.maxActionPoints;

  checkVictory(state);
  if (!state.gameOver) rollMonthlyEvent(state, rngOf(state));
  bumpRng(state, 11);
  return state;
}

export function checkVictory(state) {
  if (state.gameOver) return state.gameOver;
  const mine = factionCities(state, state.playerId).length;
  const total = Object.values(state.cities).filter((c) => c.owner).length;
  if (mine === 0) state.gameOver = { type: 'defeat', text: '세력이 멸망하고 천하는 다른 이의 것이 되었다.' };
  else if (mine === total) state.gameOver = { type: 'victory', text: '천하통일! 모든 성이 그대의 깃발 아래에 있다.' };
  return state.gameOver;
}

/* ---------- 전투 결과 반영 ---------- */
/* result: {fromCityId, toCityId, winner, atkLoss, defLoss, defeatedGenerals, playerSide, duelResult}
   플레이어가 이겼으면 잡힌 장수를 state.pendingPrisoners 에 쌓아 처분 화면으로 넘긴다. */
export function applyBattleResult(state, result, rng = null) {
  const R = rng || rngOf(state);
  const from = state.cities[result.fromCityId];
  const to = state.cities[result.toCityId];
  const atkFid = from.owner;
  const defFid = to.owner;
  const playerSide = result.playerSide || null;
  const playerWon = !!playerSide && (
    (result.winner === 'attacker' && playerSide === 'atk') ||
    (result.winner === 'defender' && playerSide === 'def')
  );
  state.stats.battles++;
  state.pendingPrisoners = state.pendingPrisoners || [];
  const out = { prisoners: [], cityCaptured: false, playerWon, winner: result.winner };
  // 패배측 궤멸 부대의 장수
  const beaten = result.defeatedGenerals || result.capturedGenerals || [];

  if (result.winner === 'attacker') {
    state.stats.wins++;
    const losingFid = defFid;
    to.owner = atkFid;
    to.troops = Math.max(500, Math.round(result.atkSurvivors || from.troops * 0.6));
    to.order = clamp(to.order - 12, 10, 100);
    to.def = clamp(to.def - 8, 20, 99);
    from.troops = Math.max(300, from.troops - (result.atkLoss || 0));
    // 포로를 먼저 붙잡아 두고, 남은 장수를 피난시킨다
    const cands = captureCandidates(state, beaten, losingFid, R);
    out.prisoners = holdPrisoners(state, {
      gids: cands, losingFid, homeCityId: to.id, holdCityId: to.id, playerWon,
    });
    moveGeneralsOnCapture(state, to.id, losingFid, atkFid, R);
    bumpFame(state, atkFid, 6);
    bumpFame(state, defFid, -4);
    log(state, `${state.factions[atkFid].name}군이 ${withJosa(cityName(to.id), '을')} 함락시켰습니다!`);
    out.cityCaptured = true;
  } else {
    from.troops = Math.max(300, from.troops - (result.atkLoss || 0));
    to.troops = Math.max(200, to.troops - (result.defLoss || 0));
    const losingFid = atkFid;
    const cands = captureCandidates(state, beaten, losingFid, R);
    out.prisoners = holdPrisoners(state, {
      gids: cands, losingFid, homeCityId: from.id, holdCityId: to.id, playerWon,
    });
    bumpFame(state, defFid, 4);
    if (atkFid === state.playerId) bumpFame(state, atkFid, -2);
    log(state, `${cityName(to.id)} 수비군이 공격을 물리쳤습니다.`);
  }
  result.capturedGenerals = out.prisoners.map((p) => p.gid);
  checkFactionDeath(state, defFid);
  checkFactionDeath(state, atkFid);
  cleanDiplomacy(state);
  syncOffices(state);
  checkVictory(state);
  return out;
}

/* ---------- 저장/불러오기 ---------- */
export function serialize(state) {
  const copy = { ...state };
  delete copy.__rng;
  return JSON.stringify(copy);
}
export function deserialize(json) {
  const s = JSON.parse(json);
  // 3 = 신군주 이전, 4 = 포로 처분 이전, 5 = 대화·이동 이전, 6 = 외교·관직 이전. 열어서 새 양식으로 옮긴다.
  if (!s || ![3, 4, 5, 6, SAVE_VERSION].includes(s.version)) throw new Error('저장 파일 형식이 다릅니다.');
  s.version = SAVE_VERSION;
  s.customGenerals = s.customGenerals || {};
  s.pendingBattles = s.pendingBattles || [];
  s.pendingPrisoners = s.pendingPrisoners || [];
  s.talked = s.talked || {};
  s.log = s.log || [];
  s.scouted = s.scouted || {};
  s.offices = s.offices || {};
  s.pendingEvent = s.pendingEvent || null;
  s.lastPromotions = [];
  s.stats = { battles: 0, wins: 0, duelWins: 0, duels: 0, captured: 0, recruited: 0, executed: 0, released: 0, ...(s.stats || {}) };
  // 옛 저장의 깃발 글자(한자)는 버리고 한글 한 글자로 바꿔 둔다
  for (const f of Object.values(s.factions || {})) {
    if (!f.mark) f.mark = String(f.name || '')[0] || '';
    delete f.hanja;
  }
  for (const g of Object.values(s.customGenerals)) delete g.hanja;
  for (const g of Object.values(s.generals || {})) {
    if (g.dead === undefined) g.dead = false;
    if (g.captive === undefined) g.captive = false;
    if (g.movedThisTurn === undefined) g.movedThisTurn = false;
  }
  ensureDiplomacy(s);
  syncOffices(s);
  s.lastPromotions = [];
  return s;
}

/* ---------- 요약 ---------- */
export function factionSummary(state, fid) {
  const cs = factionCities(state, fid);
  const gens = factionGenerals(state, fid);
  return {
    id: fid, cities: cs.length, generals: gens.length,
    troops: cs.reduce((s, c) => s + c.troops, 0),
    gold: cs.reduce((s, c) => s + c.gold, 0),
    food: cs.reduce((s, c) => s + c.food, 0),
    power: factionStrength(state, fid),
  };
}
export function ranking(state) {
  return Object.keys(state.factions)
    .filter((fid) => state.factions[fid].alive)
    .map((fid) => ({ ...factionSummary(state, fid), name: state.factions[fid].name, color: state.factions[fid].color }))
    .sort((a, b) => b.power - a.power);
}
export function formationOf(general) {
  return general.formations && general.formations.length ? general.formations : ['eorin'];
}
export function formationOptions(gid, state = null) {
  const g = generalOf(state, gid);
  return formationOf(g || {}).map((fid) => FORMATIONS[fid]).filter(Boolean);
}
export { CITIES, CITY_BY_ID, GENERALS, GENERAL_BY_ID, SCENARIOS, FORMATIONS, FACTION_COLORS, ARMS, SKILLS, CUSTOM_COLORS };
