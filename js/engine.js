/* 삼국 한 턴 — 게임 엔진 (DOM 비의존, node 테스트 가능) */
import { CITIES, CITY_BY_ID, GENERALS, GENERAL_BY_ID, SCENARIOS, FORMATIONS, FACTION_COLORS, ARMS, SKILLS, CUSTOM_COLORS, TREASURES, TREASURE_BY_ID, TREASURE_OWNERS, TREASURE_STAT_KO } from './data.js';
import { pickTalkLine, talkStyleOf } from './talk.js';

export const SAVE_VERSION = 10;
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
  // 전수로 익힌 진형까지 합친 사본 — 전투가 익힌 진형을 그대로 쓸 수 있게 한다
  for (const gid of Object.keys((state && state.learnedFormations) || {})) {
    const base = map[gid];
    const extra = (state.learnedFormations[gid] || []).filter((f) => FORMATIONS[f]);
    if (!base || !extra.length) continue;
    map[gid] = { ...base, formations: [...new Set([...(base.formations || []), ...extra])] };
  }
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
    affinity: {},
    offices: {},
    scouted: {},
    // 진형 전수 — 스승 장수에게 배운 진형과 숙련도(0~100)
    learnedFormations: {},
    formationMastery: {},
    pendingEvent: null,
    pendingTournament: null,
    lastTournament: null,
    lastPromotions: [],
    gameOver: null,
    // 9: 보물 · 참모 · 도시 위임 · 쌀 시세
    treasures: { where: {}, owned: [] },
    advisorId: null,
    delegation: {},
    delegationLog: [],
    ricePrice: RICE_BASE,
    stats: { battles: 0, wins: 0, duels: 0, duelWins: 0, captured: 0, recruited: 0, executed: 0, released: 0, trades: 0, treasureFound: 0 },
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
    state.generals[g.id] = { id: g.id, faction: null, city: null, loyalty: 0, acted: false, captive: false, dead: false, hidden: false, merit: 0, rank: 0 };
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
  // 어디에도 속하지 않은 장수는 재야로 — 고향 성(데이터의 home)이 있으면 그곳에, 없으면 낙양에
  for (const g of Object.values(state.generals)) {
    if (!g.dead && !g.faction && !g.city) {
      const home = (GENERAL_BY_ID[g.id] || {}).home;
      g.city = home && CITY_BY_ID[home] ? home : 'luoyang';
    }
  }

  initDiplomacy(state);
  ensureRanks(state);
  ensureAffinity(state);
  ensureTreasures(state);
  seedTreasures(state);
  autoAdvisor(state);
  rollRicePrice(state, { trend: 'start' });
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
/* 1% 전설 주사위 — 100번 중 1번, 총합 450~480에 항목마다 60~100으로 깔린다 */
export const CUSTOM_STAT_LEGEND_CHANCE = 0.01;
export const CUSTOM_STAT_LEGEND_TOTAL_MIN = 450;
export const CUSTOM_STAT_LEGEND_TOTAL_MAX = 480;
export const CUSTOM_STAT_LEGEND_FLOOR = 60;
export const CUSTOM_STAT_HARD_MAX = 100; // 전설 굴림의 항목 상한(게임 절대 상한)
export const CUSTOM_NAME_MIN = 2;
export const CUSTOM_NAME_MAX = 6;
export const CUSTOM_RETINUE_PRESETS = [
  { ko: '한석', skill: 'cheolbyeok', arms: '보병' },
  { ko: '위담', skill: 'dolgyeok', arms: '기병' },
];
const STAT_KEYS = ['lead', 'war', 'int', 'pol', 'cha'];

/* 전설(1%) 총합 — 450~480 */
function rollLegendTotal(rand) {
  const span = CUSTOM_STAT_LEGEND_TOTAL_MAX - CUSTOM_STAT_LEGEND_TOTAL_MIN + 1;
  return CUSTOM_STAT_LEGEND_TOTAL_MIN + Math.floor(clamp(rand(), 0, 1 - 1e-9) * span);
}

/* 일반(99%) 총합 — 165~255, 위쪽이 조금 더 잘 나오고 가끔 만점(255)이 뜬다
   q는 일반 구간 안에서의 위치(0~1) */
function rollNormalTotal(q) {
  const pos = clamp(q, 0, 1 - 1e-9);
  if (pos < 0.06) return CUSTOM_STAT_BUDGET; // 가끔 만점(255)
  const span = CUSTOM_STAT_BUDGET - CUSTOM_STAT_DICE_MIN;
  const t = Math.pow((pos - 0.06) / 0.94, 0.8); // 위쪽으로 살짝 기운 분포
  return Math.min(CUSTOM_STAT_BUDGET, CUSTOM_STAT_DICE_MIN + Math.round(span * t));
}

/* 주사위: 먼저 이번 굴림의 총합을 뽑는다 — 1%는 전설(450~480), 나머지는 165~255 */
export function rollCustomTotal(rand = Math.random) {
  const r = clamp(rand(), 0, 1);
  if (r < CUSTOM_STAT_LEGEND_CHANCE) return rollLegendTotal(rand);
  // 전설 구간을 뺀 나머지 99%를 0~1로 다시 펴서 일반 분포를 그대로 쓴다
  return rollNormalTotal((r - CUSTOM_STAT_LEGEND_CHANCE) / (1 - CUSTOM_STAT_LEGEND_CHANCE));
}

/* 뽑힌 총합을 다섯 능력치에 무작위로 나눈다 — 한 항목이 확 치솟는 굴림도 나오게 */
function splitCustomStats(target, rand, floor, cap) {
  const roomEach = cap - floor;
  const pot = Math.max(0, target - STAT_KEYS.length * floor); // 최소치 위로 더 얹을 몫
  let extra = pot;
  const add = STAT_KEYS.map(() => 0);
  // 굴림마다 성격이 달라지도록 가중치를 크게 흔린다
  const w = STAT_KEYS.map(() => 0.2 + rand() * rand() * 3);
  const wsum = w.reduce((a, b) => a + b, 0) || 1;
  STAT_KEYS.forEach((k, i) => {
    if (extra <= 0) return;
    const want = Math.min(roomEach, extra, Math.round(pot * w[i] / wsum));
    add[i] = Math.max(0, want);
    extra -= add[i];
  });
  // 반올림·상한에 걸려 남은 몫은 여유가 있는 항목에 무작위로 하나씩
  while (extra > 0) {
    const open = STAT_KEYS.map((_, i) => i).filter((i) => add[i] < roomEach);
    if (!open.length) break;
    const pick = open[Math.floor(clamp(rand(), 0, 0.999999) * open.length)];
    add[pick] += 1;
    extra -= 1;
  }
  const stats = {};
  STAT_KEYS.forEach((k, i) => { stats[k] = floor + add[i]; });
  return stats;
}

/* 주사위 한 번 — 능력치와 함께 전설 여부·총합을 돌려준다(연출·예산 표시에 쓴다) */
export function rollCustomDice(rand = Math.random) {
  const legend = clamp(rand(), 0, 1) < CUSTOM_STAT_LEGEND_CHANCE;
  if (legend) {
    const total = rollLegendTotal(rand);
    return {
      stats: splitCustomStats(total, rand, CUSTOM_STAT_LEGEND_FLOOR, CUSTOM_STAT_HARD_MAX),
      total,
      legend: true,
    };
  }
  const total = rollNormalTotal(clamp(rand(), 0, 1));
  return { stats: splitCustomStats(total, rand, CUSTOM_STAT_MIN, CUSTOM_STAT_MAX), total, legend: false };
}

/* 주사위: 능력치만 필요한 곳을 위한 얇은 껍질 */
export function rollCustomStats(rand = Math.random) {
  return rollCustomDice(rand).stats;
}

/* 이번 굴림에서 쓸 수 있는 총합 예산 — 일반은 255까지, 전설은 뽑힌 총합(450~480)을 그대로 */
export function customStatBudget(total) {
  return Math.max(CUSTOM_STAT_BUDGET, clamp(Math.round(Number(total) || 0), CUSTOM_STAT_BUDGET, CUSTOM_STAT_LEGEND_TOTAL_MAX));
}

/* 예산에 맞는 항목 상한 — 일반은 96, 전설 예산이면 100 */
export function customStatCap(budget) {
  return Number(budget) > CUSTOM_STAT_BUDGET ? CUSTOM_STAT_HARD_MAX : CUSTOM_STAT_MAX;
}

/* 수동 ＋/－: 항목 범위와 총합 상한을 지키며 한 칸 조정한다
   (전설 주사위로 뽑힌 총합은 budget으로 넘겨 그 예산 안에서 다시 배분한다) */
export function adjustCustomStat(stats, k, delta, budget = CUSTOM_STAT_BUDGET, cap = CUSTOM_STAT_MAX) {
  const hi = clamp(Math.round(Number(cap) || 0) || CUSTOM_STAT_MAX, CUSTOM_STAT_MAX, CUSTOM_STAT_HARD_MAX);
  const limit = Math.max(CUSTOM_STAT_BUDGET, Math.round(Number(budget) || 0));
  const next = {};
  for (const key of STAT_KEYS) next[key] = clamp(Math.round(Number(stats[key]) || 0), CUSTOM_STAT_MIN, hi);
  if (!STAT_KEYS.includes(k)) return { stats: next, ok: false, reason: 'key' };
  const cur = next[k];
  const want = clamp(cur + delta, CUSTOM_STAT_MIN, hi);
  if (want === cur) return { stats: next, ok: false, reason: 'limit' };
  const sum = STAT_KEYS.reduce((n, key) => n + next[key], 0);
  if (want > cur && sum + (want - cur) > limit) return { stats: next, ok: false, reason: 'budget' };
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

/* ---------- 장수 친밀도 (0~100) ---------- */
/* 장수마다 플레이어와의 개인 친밀도 — 등용·대화·포상·친교로 오르고 무시·참수로 내린다 */
function defaultAffinity(state, gid) {
  const g = state.generals[gid];
  if (!g) return 30;
  const t = generalOf(state, gid) || {};
  let h = 0;
  for (const ch of String(gid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const spread = h % 15; // 0~14, 같은 장수는 늘 같은 값
  const warm = Math.round((((t.cha || 60) - 60) / 6));
  if (g.faction === state.playerId) {
    return clamp(Math.round((g.loyalty || 50) * 0.44) + 10 + spread % 8 + warm, 25, 55);
  }
  return clamp(28 + spread + warm, 25, 55);
}

export function ensureAffinity(state) {
  state.affinity = state.affinity || {};
  for (const gid of Object.keys(state.generals || {})) {
    if (typeof state.affinity[gid] !== 'number') state.affinity[gid] = defaultAffinity(state, gid);
  }
  return state.affinity;
}

export function affinityOf(state, gid) {
  if (state.affinity && typeof state.affinity[gid] === 'number') return state.affinity[gid];
  state.affinity = state.affinity || {};
  const v = defaultAffinity(state, gid);
  state.affinity[gid] = v;
  return v;
}
export function bumpAffinity(state, gid, n) {
  state.affinity = state.affinity || {};
  const v = clamp(affinityOf(state, gid) + n, 0, 100);
  state.affinity[gid] = v;
  return v;
}
export function affinityLabel(v) {
  if (v >= 80) return '각별';
  if (v >= 60) return '친함';
  if (v >= 40) return '알음';
  if (v >= 25) return '낯섦';
  return '서먹';
}
/* ---------- 보물 (14종) ---------- */
/* state.treasures = { where: { [보물id]: 장수id | null }, owned: [보물id] }
   where = 지금 누가 지니고 있는가(세력 불문) · owned = 우리 세력이 손에 넣은 보물 */
export function ensureTreasures(state) {
  state.treasures = state.treasures && typeof state.treasures === 'object' ? state.treasures : {};
  const t = state.treasures;
  t.where = t.where && typeof t.where === 'object' ? t.where : {};
  t.owned = Array.isArray(t.owned) ? t.owned.filter((id) => TREASURE_BY_ID[id]) : [];
  for (const tid of Object.keys(t.where)) {
    const gid = t.where[tid];
    if (!TREASURE_BY_ID[tid] || !gid || !state.generals[gid]) { delete t.where[tid]; continue; }
    const g = state.generals[gid];
    if (g.dead) { delete t.where[tid]; t.owned = t.owned.filter((x) => x !== tid); }
  }
  // 우리 장수가 아닌 장수가 지닌 보물은 우리 것이 아니다
  t.owned = [...new Set(t.owned)].filter((tid) => {
    if (!TREASURE_BY_ID[tid]) return false;
    const gid = t.where[tid];
    if (!gid) return true;
    return state.generals[gid] && state.generals[gid].faction === state.playerId;
  });
  return t;
}

/* 처음 이름난 장수에게 보물을 쥐여 준다 — 그 장수가 없는 시나리오면 행방을 찾아야 한다 */
export function seedTreasures(state) {
  const t = ensureTreasures(state);
  for (const [tid, gid] of Object.entries(TREASURE_OWNERS)) {
    const g = state.generals[gid];
    if (!g || g.dead || !g.faction) continue;
    if (t.where[tid]) continue;
    t.where[tid] = gid;
    if (g.faction === state.playerId && !t.owned.includes(tid)) t.owned.push(tid);
  }
  return t;
}

export function treasureHolder(state, tid) {
  const t = ensureTreasures(state);
  return t.where[tid] || null;
}
/* 이 장수가 지닌 보물 */
export function treasureOf(state, gid) {
  const t = ensureTreasures(state);
  const tid = Object.keys(t.where).find((k) => t.where[k] === gid);
  return tid ? TREASURE_BY_ID[tid] : null;
}
export function treasureBonusOf(state, gid) {
  const tr = treasureOf(state, gid);
  return tr ? { ...tr.bonus } : {};
}
/* 보물을 반영한 장수 능력치 — 전투·내정 표시가 모두 이 값을 쓴다 */
export function effectiveGeneral(state, gid) {
  const g = generalOf(state, gid);
  if (!g) return null;
  const b = treasureBonusOf(state, gid);
  const tr = treasureOf(state, gid);
  const out = { ...g };
  for (const k of STAT_KEYS) out[k] = clamp((g[k] || 0) + (b[k] || 0), 1, 200);
  out.treasure = tr ? tr.ko : null;
  return out;
}
export function effectiveGeneralMap(state) {
  const map = {};
  for (const gid of Object.keys(state.generals || {})) {
    const e = effectiveGeneral(state, gid);
    if (e) map[gid] = e;
  }
  return map;
}
/* 보물 한 가지의 값 — '무력 +7' 처럼 */
export function treasureBonusText(tr) {
  if (!tr) return '';
  const parts = STAT_KEYS.filter((k) => tr.bonus && tr.bonus[k]).map((k) => `${TREASURE_STAT_KO[k]} +${tr.bonus[k]}`);
  if (tr.loyal) parts.push(`충성 +${tr.loyal}`);
  return parts.join(' · ');
}
/* 아직 아무도 지니지 않은 보물 */
export function lostTreasures(state) {
  const t = ensureTreasures(state);
  return TREASURES.filter((tr) => !t.where[tr.id]);
}
/* 보물을 얻는다 — 이미 우리 것이면 그대로 둔다. 어디에 있는지는 where 로 관리 */
export function gainTreasure(state, tid, opts = {}) {
  const tr = TREASURE_BY_ID[tid];
  if (!tr) return { ok: false, msg: '없는 보물입니다.' };
  const t = ensureTreasures(state);
  const from = t.where[tid] || null;
  t.where[tid] = opts.holder || null;
  if (!t.owned.includes(tid)) t.owned.push(tid);
  state.stats.treasureFound = (state.stats.treasureFound || 0) + 1;
  if (from && opts.holder && from !== opts.holder) {
    const prev = state.generals[from];
    if (prev) prev.loyalty = clamp((prev.loyalty || 0) - 3, 0, 100);
  }
  return { ok: true, treasure: tr, holder: t.where[tid] || null };
}
/* 탐색·순찰에서 행방을 찾는다 — 아직 임자 없는 보물 중 하나 */
export function findTreasure(state, cityId, chance = 0.18, rng = null) {
  const r = rng || rngOf(state);
  const lost = lostTreasures(state);
  if (!lost.length) return null;
  if (r() >= chance) return null;
  const tr = lost[Math.floor(r() * lost.length)];
  const res = gainTreasure(state, tr.id, { holder: null });
  return res.ok ? { ...res, cityId } : null;
}
/* 보유 보물을 아군 장수에게 수여(장착) — 그 장수가 이미 다른 보물을 지녔으면 그것은 창고로 돌아간다 */
export function awardTreasure(state, tid, gid) {
  const tr = TREASURE_BY_ID[tid];
  const t = ensureTreasures(state);
  const g = state.generals[gid];
  if (!tr) return { ok: false, msg: '없는 보물입니다.' };
  if (!t.owned.includes(tid)) return { ok: false, msg: '아직 우리가 손에 넣지 못한 보물입니다.' };
  if (!g || g.dead || g.captive) return { ok: false, msg: '수여할 수 없는 장수입니다.' };
  if (g.faction !== state.playerId) return { ok: false, msg: '아군 장수에게만 수여할 수 있습니다.' };
  const holder = t.where[tid];
  if (holder === gid) return { ok: false, msg: '이미 그 장수가 지니고 있습니다.' };
  const prev = treasureOf(state, gid);
  if (prev) delete t.where[prev.id];
  t.where[tid] = gid;
  if (tr.loyal) g.loyalty = clamp((g.loyalty || 0) + tr.loyal, 0, 100);
  const t2 = generalOf(state, gid);
  const back = prev ? ` (${prev.ko}은(는) 창고로 돌아갔습니다)` : '';
  const msg = `${withJosa(t2.ko, '에게')} ${withJosa(tr.ko, '을')} 수여했습니다. (${treasureBonusText(tr)})${back}`;
  log(state, msg);
  return { ok: true, msg, treasure: tr, holder: gid };
}
/* 보물을 회수해 창고에 둔다 */
export function revokeTreasure(state, tid) {
  const t = ensureTreasures(state);
  const tr = TREASURE_BY_ID[tid];
  if (!tr || !t.where[tid]) return { ok: false, msg: '지니고 있는 보물이 아닙니다.' };
  const gid = t.where[tid];
  delete t.where[tid];
  const g = state.generals[gid];
  if (tr.loyal && g) g.loyalty = clamp((g.loyalty || 0) - Math.ceil(tr.loyal / 2), 0, 100);
  const msg = `${withJosa(tr.ko, '을')} 창고로 회수했습니다.`;
  log(state, msg);
  return { ok: true, msg };
}
/* 장수가 죽거나 흩어질 때 그가 지닌 보물은 임자 없는 보물이 된다 */
function dropTreasuresOf(state, gid) {
  const t = ensureTreasures(state);
  for (const tid of Object.keys(t.where)) if (t.where[tid] === gid) delete t.where[tid];
}
/* 이길 때 적 장수의 보물을 거둔다 — 처분하면 우리 것이 된다 */
export function takeTreasuresOf(state, gid, reason = '') {
  const tr = treasureOf(state, gid);
  if (!tr) return null;
  const res = gainTreasure(state, tr.id, { holder: null });
  log(state, `${withJosa(tr.ko, '을')} 거두었습니다.${reason ? ' (' + reason + ')' : ''} — 특수에서 수여할 수 있습니다.`);
  return res;
}

/* ---------- 참모 ---------- */
/* 지력 최고의 아군 장수가 참모로 앉으면 계략·등용·외교 성공률이 2~8% 오른다 */
export const ADVISOR_MIN = 2;
export const ADVISOR_MAX = 8;
/* 군주는 자기 세력의 참모가 될 수 없다 — 참모 후보에서 언제나 뺀다 */
function lordIdOf(state, fid) {
  const f = state.factions && state.factions[fid];
  return f && f.lord ? f.lord : null;
}
export function advisorCandidates(state) {
  const lord = lordIdOf(state, state.playerId);
  return factionGenerals(state, state.playerId).filter((g) => g.id !== lord);
}
export function advisorOf(state) {
  const gid = state.advisorId;
  if (!gid) return null;
  if (gid === lordIdOf(state, state.playerId)) return null;
  const g = state.generals[gid];
  if (!g || g.dead || g.captive || g.faction !== state.playerId) return null;
  return generalOf(state, gid);
}
export function advisorBonus(state) {
  const a = advisorOf(state);
  if (!a) return 0;
  return clamp(Math.round((a.int - 55) / 6), ADVISOR_MIN, ADVISOR_MAX) / 100;
}
export function recommendAdvisor(state) {
  const gens = advisorCandidates(state);
  if (!gens.length) return null;
  gens.sort((a, b) => (generalOf(state, b.id).int || 0) - (generalOf(state, a.id).int || 0));
  return gens[0].id;
}
/* 참모가 없거나 잃으면 지력 최고의 부하 장수를 다시 앉힌다. 군주는 앉히지 않는다 */
export function autoAdvisor(state) {
  if (advisorOf(state)) return state.advisorId;
  const gid = recommendAdvisor(state);
  state.advisorId = gid || null;
  return state.advisorId;
}
export function appointAdvisor(state, gid) {
  if (gid === lordIdOf(state, state.playerId)) return { ok: false, msg: '군주는 참모로 임명할 수 없습니다.' };
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  if (!g || g.dead || g.captive) return { ok: false, msg: '임명할 수 없는 장수입니다.' };
  if (g.faction !== state.playerId) return { ok: false, msg: '아군 장수만 참모로 앉힐 수 있습니다.' };
  state.advisorId = gid;
  const msg = `${withJosa(t.ko, '을')} 참모로 앉혔습니다. (지력 ${t.int} · 계략·등용·외교 +${Math.round(advisorBonus(state) * 100)}%)`;
  log(state, msg);
  return { ok: true, msg, advisor: t };
}
/* 참모의 한마디 — 지금 형편에서 가장 급한 곳을 짚어 준다 */
export function advisorAdvice(state) {
  const a = advisorOf(state);
  if (!a) {
    return advisorCandidates(state).length
      ? '참모가 없습니다. 정보에서 지력 높은 장수를 참모로 앉히세요.'
      : '참모로 앉힐 부하 장수가 없습니다. 먼저 등용으로 사람을 들이십시오.';
  }
  const me = state.playerId;
  const cs = factionCities(state, me);
  if (!cs.length) return '성이 없습니다. 한 곳이라도 되찾아야 합니다.';
  const gold = factionGold(state, me);
  const food = factionFood(state, me);
  const troops = cs.reduce((s, c) => s + c.troops, 0);
  const needFood = cs.some((c) => c.food < c.troops / 8);
  const weak = cs.slice().sort((x, y) => cityPower(state, x.id, true) - cityPower(state, y.id, true))[0];
  const foes = E_adjacentFoeCount(state);
  if (needFood) return `어느 성인가 곳간이 비고 있습니다. 교역으로 식량을 사 두거나 구휼·개발로 달래야 합니다.`;
  if (gold < 400) return '곳간의 금이 얇습니다. 특수의 징세도 약이 되지만 치안을 보십시오.';
  if (foes > 1) return `사방에 적이 ${foes}곳이나 닿아 있습니다. 외교로 한쪽을 달래는 편이 좋습니다.`;
  if (weak && weak.order < 55) return `${cityName(weak.id)}의 치안이 낮습니다. 순찰로 다스리십시오.`;
  if (state.actionPoints >= 2 && lostTreasures(state).length) return '세상에 임자 없는 보물이 남아 있습니다. 탐색이나 순찰로 찾아보십시오.';
  if (state.actionPoints >= 2) return '행동력이 남아 있습니다. 개발과 상업을 올려 두면 다음 달이 편합니다.';
  return `${a.ko}이(가) 지혜를 모으고 있습니다. 내일의 한 수를 세우십시오.`;
}
function E_adjacentFoeCount(state) {
  const me = state.playerId;
  const set = new Set();
  for (const c of factionCities(state, me)) {
    for (const n of neighbors(c.id)) {
      const o = ownerOf(state, n);
      if (o && o !== me && !isPacified(state, me, o)) set.add(n);
    }
  }
  return set.size;
}

/* ---------- 공적 · 장군 직위 ----------
   장수는 개발·상업·치안·수리·징병·훈련·등용·친교·계략·전투 승리로 개인 공적(merit)을 쌓는다.
   군주가 직위를 내리면 최대 지휘 병력과 전투 보정이 오르고, 임명받은 장수는 충성이 오른다.
   군주는 따로 임명받지 않고 '군주' 직위로 10,000명을 지휘한다. */
export const RANKS = [
  { ko: '일반', merit: 0, cap: 3000, bonus: 0 },
  { ko: '비장군', merit: 80, cap: 4000, bonus: 0.03 },
  { ko: '편장군', merit: 200, cap: 5000, bonus: 0.06 },
  { ko: '아장군', merit: 400, cap: 6500, bonus: 0.09 },
  { ko: '진북장군', merit: 700, cap: 8000, bonus: 0.12 },
  { ko: '정북장군', merit: 1100, cap: 9000, bonus: 0.15 },
  { ko: '대장군', merit: 1600, cap: 10000, bonus: 0.18 },
];
export const RANK_MAX = RANKS.length - 1;
export const LORD_RANK = { ko: '군주', cap: 10000, bonus: 0.18 };
export const PROMOTE_LOYALTY = 5;
/* 행동별 공적 — [최소, 최대] */
export const MERIT_GAIN = {
  agri: [15, 25], comm: [15, 25], order: [15, 25], water: [15, 25],
  draft: [18, 24], train: [18, 24],
  search: [8, 14], hire: [22, 30], reward: [8, 14],
  learn: [18, 24], befriend: [22, 30], plot: [22, 28], win: [50, 80],
};

export function isLordId(state, gid) {
  for (const f of Object.values(state.factions || {})) if (f && f.lord === gid) return true;
  return false;
}

/* 옛 저장(v3~v9)에는 공적·직위가 없다 — 0으로 채운다 */
export function ensureRanks(state) {
  if (!state || !state.generals) return state;
  for (const g of Object.values(state.generals)) {
    const m = Number(g.merit);
    g.merit = Number.isFinite(m) ? Math.max(0, Math.round(m)) : 0;
    const r = Number(g.rank);
    g.rank = Number.isFinite(r) ? clamp(Math.round(r), 0, RANK_MAX) : 0;
  }
  return state;
}

export function meritOf(state, gid) {
  const g = state.generals ? state.generals[gid] : null;
  const m = g ? Number(g.merit) : 0;
  return Number.isFinite(m) ? Math.max(0, Math.round(m)) : 0;
}

export function addMerit(state, gid, n) {
  const g = state.generals ? state.generals[gid] : null;
  if (!g || !n) return 0;
  g.merit = Math.max(0, Math.round((Number.isFinite(Number(g.merit)) ? Number(g.merit) : 0) + n));
  return Math.round(n);
}

/* 행동 종류로 공적을 굴린다 */
export function meritRoll(state, kind, rng = null) {
  const range = MERIT_GAIN[kind];
  if (!range) return 0;
  return randInt(rng || rngOf(state), range[0], range[1]);
}

/* 직위 정보 — 현재 직위·공적·다음 직위까지의 진행도·지휘 상한·전투 보정 */
export function rankInfoOf(state, gid) {
  const lord = isLordId(state, gid);
  const g = (state.generals && state.generals[gid]) || {};
  const merit = meritOf(state, gid);
  const raw = Number(g.rank);
  const index = lord ? RANK_MAX : clamp(Number.isFinite(raw) ? Math.round(raw) : 0, 0, RANK_MAX);
  const cur = RANKS[index];
  const next = index < RANK_MAX ? RANKS[index + 1] : null;
  const span = next ? Math.max(1, next.merit - cur.merit) : 1;
  return {
    merit, index, isLord: lord,
    ko: lord ? LORD_RANK.ko : cur.ko,
    cap: lord ? LORD_RANK.cap : cur.cap,
    bonus: lord ? LORD_RANK.bonus : cur.bonus,
    next: next ? { ko: next.ko, merit: next.merit, cap: next.cap, bonus: next.bonus } : null,
    toNext: next ? Math.max(0, next.merit - merit) : 0,
    progress: next ? clamp((merit - cur.merit) / span, 0, 1) : 1,
    canPromote: !lord && !!next && merit >= next.merit,
  };
}

export function maxTroopsOf(state, gid) { return rankInfoOf(state, gid).cap; }
export function battleBonusOf(state, gid) { return rankInfoOf(state, gid).bonus; }

export function canPromote(state, gid) {
  const g = state.generals ? state.generals[gid] : null;
  if (!g || g.dead || g.captive) return { ok: false, why: '임명할 수 없는 장수입니다.' };
  if (g.faction !== state.playerId) return { ok: false, why: '아군 장수만 임명할 수 있습니다.' };
  if (isLordId(state, gid)) return { ok: false, why: '군주는 이미 군주 직위입니다.' };
  const r = rankInfoOf(state, gid);
  if (!r.next) return { ok: false, why: '이미 대장군입니다.' };
  if (r.merit < r.next.merit) return { ok: false, why: `공적이 모자랍니다 (${r.merit}/${r.next.merit}).` };
  return { ok: true, next: r.next };
}

/* 승급 가능한 아군 장수 — 인사 메뉴 배지에 쓴다 */
export function promotableGenerals(state) {
  return factionGenerals(state, state.playerId).filter((g) => canPromote(state, g.id).ok).map((g) => g.id);
}

/* 장군 임명 — 행동력을 쓰지 않는다(군주가 직접 내리는 직위). 한 단계씩 오르고 충성 +5 */
export function promoteGeneral(state, gid) {
  const chk = canPromote(state, gid);
  if (!chk.ok) return { ok: false, msg: chk.why };
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  const from = RANKS[clamp(g.rank | 0, 0, RANK_MAX)];
  g.rank = clamp((g.rank | 0) + 1, 0, RANK_MAX);
  const to = RANKS[g.rank];
  g.loyalty = clamp((g.loyalty || 0) + PROMOTE_LOYALTY, 0, 100);
  const msg = `${withJosa(t.ko, '을')} ${withJosa(to.ko, '로')} 임명했습니다! 최대 지휘 ${to.cap.toLocaleString()}명 · 전투 보정 +${Math.round(to.bonus * 100)}% · 충성 +${PROMOTE_LOYALTY}`;
  log(state, msg);
  return { ok: true, msg, gid, ko: t.ko, from: from.ko, to: to.ko, rank: g.rank, cap: to.cap, bonus: to.bonus, loyalty: g.loyalty, merit: meritOf(state, gid) };
}

/* ---------- 쌀 시세 · 교역 ---------- */
/* ricePrice = 금 100으로 살 수 있는 식량. 풍작이면 오르고(쌀이 싸다) 흉년·가뭄이면 내린다 */
export const RICE_MIN = 300;
export const RICE_MAX = 600;
export const RICE_BASE = 450;
export function ricePriceOf(state) {
  const p = Number(state.ricePrice);
  if (!Number.isFinite(p) || p < RICE_MIN || p > RICE_MAX) state.ricePrice = RICE_BASE;
  return state.ricePrice;
}
/* 달마다 시세가 흔들린다 — trend: good(풍작) / bad(흉년·가뭄) */
export function rollRicePrice(state, opts = {}) {
  const rng = opts.rng || rngOf(state);
  let p = ricePriceOf(state) + randInt(rng, -80, 80);
  if (opts.trend === 'good') p += randInt(rng, 70, 130);
  if (opts.trend === 'bad') p -= randInt(rng, 70, 130);
  if (opts.trend === 'start') p = RICE_BASE + randInt(rng, -60, 60);
  state.ricePrice = clamp(Math.round(p), RICE_MIN, RICE_MAX);
  bumpRng(state, 3);
  return state.ricePrice;
}
export function riceLabel(state) {
  const p = ricePriceOf(state);
  if (p >= 540) return '풍년 — 쌀이 싸다';
  if (p <= 360) return '흉년 — 쌀이 비싸다';
  return '평년'; 
}
/* 교역: 이 성의 금으로 식량을 사거나, 식량을 팔아 금을 얻는다 (행동력 1) */
export const TRADE_AP = 1;
export const TRADE_UNIT = 100;
export function tradeQuote(state, kind, amount) {
  const p = ricePriceOf(state);
  const n = Math.max(TRADE_UNIT, Math.floor(Number(amount) / TRADE_UNIT) * TRADE_UNIT);
  if (kind === 'buy') return { gold: n, food: Math.round((n / 100) * p) };
  return { gold: Math.round((n / p) * 100), food: n };
}
export function tradeCheck(state, cityId, kind, amount) {
  const c = state.cities[cityId];
  if (!c || c.owner !== state.playerId) return { ok: false, why: '아군 성이 아닙니다.' };
  if (kind !== 'buy' && kind !== 'sell') return { ok: false, why: '알 수 없는 교역입니다.' };
  if (state.actionPoints < TRADE_AP) return { ok: false, why: '행동력이 부족합니다.' };
  const q = tradeQuote(state, kind, amount);
  if (q.gold <= 0 || q.food <= 0) return { ok: false, why: '너무 적은 양입니다.' };
  if (kind === 'buy' && c.gold < q.gold) return { ok: false, why: `이 성의 금이 부족합니다(${q.gold} 필요).` };
  if (kind === 'sell' && c.food < q.food) return { ok: false, why: `이 성의 식량이 부족합니다(${q.food} 필요).` };
  return { ok: true, quote: q };
}
export function trade(state, cityId, kind, amount) {
  const chk = tradeCheck(state, cityId, kind, amount);
  if (!chk.ok) return { ok: false, msg: chk.why };
  const c = state.cities[cityId];
  const q = chk.quote;
  if (kind === 'buy') {
    c.gold -= q.gold; c.food += q.food;
  } else {
    c.food -= q.food; c.gold += q.gold;
  }
  state.actionPoints -= TRADE_AP;
  state.stats.trades = (state.stats.trades || 0) + 1;
  const msg = kind === 'buy'
    ? `${cityName(cityId)}에서 금 ${fmtOr(q.gold)}으로 식량 ${fmtOr(q.food)}을 샀습니다. (시세 ${ricePriceOf(state)})`
    : `${cityName(cityId)}에서 식량 ${fmtOr(q.food)}을 팔아 금 ${fmtOr(q.gold)}을 얻었습니다. (시세 ${ricePriceOf(state)})`;
  log(state, msg);
  bumpRng(state, 2);
  return { ok: true, msg, quote: q, cityId, gold: c.gold, food: c.food };
}

/* ---------- 특수 명령 (순찰 · 연회 · 징세 · 구휼) ---------- */
export const SPECIALS = {
  patrol: { ko: '순찰', ap: 1, gold: 100, food: 0, desc: '성 안팎을 돌며 치안을 세우고 이름을 얻는다. 가끔 재야 장수 소문이나 보물을 찾는다.' },
  banquet: { ko: '연회', ap: 1, gold: 400, food: 0, desc: '이 성의 모든 장수를 불러 충성도와 친밀도를 올린다.' },
  levy: { ko: '징세', ap: 1, gold: 0, food: 0, desc: '지금 금을 거둬들이지만 치안과 명성이 상한다.' },
  relief: { ko: '구휼', ap: 1, gold: 0, food: 800, desc: '굶주린 백성을 먹여 치안을 크게 올리고 이름을 얻는다.' },
};
export function specialCheck(state, kind, cityId) {
  const sp = SPECIALS[kind];
  const c = state.cities[cityId];
  if (!sp) return { ok: false, why: '알 수 없는 특수 명령입니다.' };
  if (!c || c.owner !== state.playerId) return { ok: false, why: '아군 성이 아닙니다.' };
  if (state.actionPoints < sp.ap) return { ok: false, why: '행동력이 부족합니다.' };
  if (sp.gold && c.gold < sp.gold) return { ok: false, why: `이 성의 금이 부족합니다(${sp.gold} 필요).` };
  if (sp.food && c.food < sp.food) return { ok: false, why: `이 성의 식량이 부족합니다(${sp.food} 필요).` };
  if (kind === 'patrol' && c.order >= 100) return { ok: false, why: '치안이 이미 최대입니다.' };
  if (kind === 'banquet' && !generalsInCity(state, cityId).length) return { ok: false, why: '이 성에 장수가 없습니다.' };
  if (kind === 'relief' && c.order >= 100) return { ok: false, why: '치안이 이미 최대입니다.' };
  return { ok: true };
}
export function runSpecial(state, kind, cityId) {
  const chk = specialCheck(state, kind, cityId);
  if (!chk.ok) return { ok: false, msg: chk.why };
  const sp = SPECIALS[kind];
  const c = state.cities[cityId];
  const rng = rngOf(state);
  const me = state.playerId;
  const out = { ok: true, kind, msg: '', found: null, rumor: null };
  if (sp.gold) c.gold -= sp.gold;
  if (sp.food) c.food -= sp.food;
  state.actionPoints -= sp.ap;

  if (kind === 'patrol') {
    const up = randInt(rng, 4, 7);
    c.order = clamp(c.order + up, 0, 100);
    c.def = clamp(c.def + 1, 20, 99);
    bumpFame(state, me, 2);
    let msg = `${cityName(cityId)}을 순찰해 치안 +${up}, 명성 +2를 얻었습니다. (치안 ${c.order})`;
    const tr = findTreasure(state, cityId, 0.14, rngOf(state));
    if (tr) { out.found = tr.treasure; msg += ` 그리고 ${withJosa(tr.treasure.ko, '을')} 찾았습니다!`; }
    else if (rng() < 0.16) {
      const free = Object.values(state.generals).find((g) => !g.faction && !g.dead && !g.captive && g.city && g.city !== cityId);
      if (free) { out.rumor = generalOf(state, free.id); msg += ` 떠돌던 ${withJosa(out.rumor.ko, '의')} 소문을 들었습니다. (${cityName(free.city)})`; }
    }
    out.msg = msg;
  } else if (kind === 'banquet') {
    const gens = generalsInCity(state, cityId);
    let loy = 0, aff = 0;
    for (const g of gens) {
      const inc = randInt(rng, 4, 7);
      const before = g.loyalty || 0;
      g.loyalty = clamp(before + inc, 0, 100);
      loy += g.loyalty - before;
      aff += bumpAffinity(state, g.id, randInt(rng, 4, 7));
    }
    out.msg = `${cityName(cityId)}에서 연회를 열었습니다. 장수 ${gens.length}명의 충성이 오르고 마음이 가까워졌습니다. (금 ${sp.gold})`;
    if (loy) out.msg += ` 충성 합 +${loy}`;
    out.generals = gens.length;
  } else if (kind === 'levy') {
    const gold = randInt(rng, 600, 1000);
    const order = randInt(rng, 10, 15);
    c.gold += gold;
    c.order = clamp(c.order - order, 0, 100);
    bumpFame(state, me, -3);
    out.msg = `${cityName(cityId)}에서 금 ${fmtOr(gold)}을 징수했습니다. 대신 치안 -${order}, 명성 -3.`;
    out.gold = gold;
  } else if (kind === 'relief') {
    const up = randInt(rng, 8, 14);
    c.order = clamp(c.order + up, 0, 100);
    bumpFame(state, me, 4);
    out.msg = `${cityName(cityId)}에 식량 ${fmtOr(sp.food)}을 풀어 백성을 구휼했습니다. 치안 +${up}, 명성 +4.`;
  }
  log(state, out.msg);
  bumpRng(state, 2);
  if (kind === 'patrol' || kind === 'levy' || kind === 'relief') syncOffices(state);
  return out;
}

/* ---------- 담당(도시 위임) ---------- */
/* 위임한 성은 턴이 바뀔 때 행동력을 쓰지 않고 스스로 내정이나 군사를 돌본다 */
export const DELEGATIONS = {
  none: { ko: '직할', desc: '직접 명령합니다.' },
  domestic: { ko: '내정 위임', desc: '매달 스스로 개발·상업·치안·수리를 조금씩 올립니다.' },
  military: { ko: '군사 위임', desc: '매달 스스로 징병하거나 훈련합니다.' },
};
export function ensureDelegation(state) {
  state.delegation = state.delegation && typeof state.delegation === 'object' ? state.delegation : {};
  for (const cid of Object.keys(state.delegation)) {
    const c = state.cities[cid];
    if (!c || !DELEGATIONS[state.delegation[cid]]) delete state.delegation[cid];
  }
  return state.delegation;
}
export function delegationOf(state, cityId) {
  const d = ensureDelegation(state);
  return DELEGATIONS[d[cityId]] ? d[cityId] : 'none';
}
export function setDelegation(state, cityId, mode) {
  const c = state.cities[cityId];
  if (!c || c.owner !== state.playerId) return { ok: false, msg: '아군 성이 아닙니다.' };
  if (!DELEGATIONS[mode]) return { ok: false, msg: '알 수 없는 담당입니다.' };
  const d = ensureDelegation(state);
  if (mode === 'none') delete d[cityId];
  else d[cityId] = mode;
  const msg = `${cityName(cityId)}의 담당을 ${withJosa(DELEGATIONS[mode].ko, '로')} 정했습니다.`;
  log(state, msg);
  return { ok: true, msg, mode };
}
/* 턴이 바뀔 때 위임한 성들이 스스로 일한다 — 행동력을 쓰지 않는다 */
export function runDelegations(state, rng = rngOf(state)) {
  const me = state.playerId;
  const notes = [];
  for (const c of factionCities(state, me)) {
    const mode = delegationOf(state, c.id);
    if (mode === 'none') continue;
    const gens = generalsInCity(state, c.id);
    if (!gens.length) continue;
    const best = gens.reduce((m, g) => ((generalOf(state, g.id).pol + generalOf(state, g.id).lead) > (generalOf(state, m.id).pol + generalOf(state, m.id).lead) ? g : m), gens[0]);
    const t = generalOf(state, best.id);
    if (mode === 'domestic') {
      const stats = [
        ['agri', c.agri, '농업'], ['comm', c.comm, '상업'],
        ['order', c.order, '치안'], ['water', c.water, '수리'],
      ];
      stats.sort((a, b) => a[1] - b[1]);
      const [key, , ko] = stats[0];
      if (c[key] >= 100) { c.train = clamp(c.train + 2, 0, 100); notes.push(`${cityName(c.id)} 훈련 +2`); continue; }
      const gain = 2 + Math.floor(t.pol / 30) + randInt(rng, 0, 2);
      c[key] = clamp(c[key] + gain, 0, 100);
      if (key === 'order') c.def = clamp(c.def + 1, 20, 99);
      notes.push(`${cityName(c.id)} ${ko} +${gain}`);
    } else {
      const wantDraft = c.troops < 8000 && c.gold >= 250 && c.food >= 400;
      if (wantDraft) {
        const add = 600 + Math.floor(t.lead * 3);
        c.gold -= 250; c.food -= 400; c.troops += add;
        c.order = clamp(c.order - 2, 0, 100);
        notes.push(`${cityName(c.id)} 징병 +${fmtOr(add)}`);
      } else {
        const gain = 3 + Math.floor(t.lead / 24);
        c.train = clamp(c.train + gain, 0, 100);
        notes.push(`${cityName(c.id)} 훈련 +${gain}`);
      }
    }
  }
  if (notes.length) {
    const text = `위임 — ${notes.slice(0, 4).join(' · ')}${notes.length > 4 ? ` 외 ${notes.length - 4}성` : ''}`;
    log(state, text);
    state.delegationLog = [text, ...(state.delegationLog || [])].slice(0, 12);
  }
  bumpRng(state, 2);
  return notes;
}

/* ---------- 정보 일람 ---------- */
/* 세력 순위 — 성·병력·금·식량·우리와의 관계 */
export function infoFactions(state) {
  const me = state.playerId;
  return Object.keys(state.factions)
    .filter((fid) => state.factions[fid].alive && factionCities(state, fid).length)
    .map((fid) => {
      const f = state.factions[fid];
      const cs = factionCities(state, fid);
      return {
        id: fid, name: f.name, color: f.color, mark: f.mark, mine: fid === me,
        lordId: f.lord, lordName: (generalOf(state, f.lord) || {}).ko || f.name,
        cities: cs.length, troops: cs.reduce((s, c) => s + c.troops, 0),
        gold: Math.round(cs.reduce((s, c) => s + c.gold, 0)),
        food: Math.round(cs.reduce((s, c) => s + c.food, 0)),
        fame: Math.round(f.fame), power: factionStrength(state, fid),
        relation: fid === me ? '아군' : relationLabel(state, me, fid),
        allyMonths: fid === me ? 0 : allyMonths(state, me, fid),
        truceMonths: fid === me ? 0 : truceMonths(state, me, fid),
      };
    })
    .sort((a, b) => b.power - a.power);
}
/* 아군 도시 — 내정 수치와 위임 상태를 한눈에 */
export function infoCities(state) {
  return factionCities(state, state.playerId).map((c) => ({
    cityId: c.id, ko: cityName(c.id), region: CITY_BY_ID[c.id].region,
    agri: c.agri, comm: c.comm, order: c.order, water: c.water,
    troops: c.troops, train: c.train, def: c.def,
    gold: Math.round(c.gold), food: Math.round(c.food),
    generals: generalsInCity(state, c.id).length,
    delegation: delegationOf(state, c.id),
    delegationKo: DELEGATIONS[delegationOf(state, c.id)].ko,
  })).sort((a, b) => b.troops - a.troops);
}
/* 무장 일람 — scope: 'mine' | 'all' */
export function infoGenerals(state, scope = 'mine') {
  const rows = [];
  for (const g of Object.values(state.generals)) {
    if (g.dead) continue;
    if (scope === 'mine' && g.faction !== state.playerId) continue;
    const t = effectiveGeneral(state, g.id);
    if (!t) continue;
    rows.push({
      gid: g.id, ko: t.ko, portraitId: g.id,
      lead: t.lead, war: t.war, int: t.int, pol: t.pol, cha: t.cha,
      loyalty: Math.round(g.loyalty || 0), affinity: affinityOf(state, g.id),
      faction: g.faction, factionName: g.faction ? (state.factions[g.faction] || {}).name || '' : '재야',
      city: g.city ? cityName(g.city) : '',
      captive: !!g.captive, treasure: t.treasure || '',
      isAdvisor: state.advisorId === g.id && g.id !== lordIdOf(state, state.playerId), arms: t.arms, skill: t.skill,
      total: t.lead + t.war + t.int + t.pol + t.cha,
    });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows;
}
/* 보물 도감 — 지금 누가 지니고 있는지까지 */
export function infoTreasures(state) {
  const t = ensureTreasures(state);
  return TREASURES.map((tr) => {
    const holder = t.where[tr.id] || null;
    const g = holder ? state.generals[holder] : null;
    return {
      id: tr.id, ko: tr.ko, kind: tr.kind, bonus: tr.bonus,
      bonusText: treasureBonusText(tr), desc: tr.desc,
      owned: t.owned.includes(tr.id), holder,
      holderName: g ? generalOf(state, holder).ko : '',
      holderFaction: g && g.faction ? ((state.factions[g.faction] || {}).name || '') : (g ? '재야' : ''),
      holderMine: !!(g && g.faction === state.playerId),
      lost: !holder,
    };
  });
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
  giftGold: { ko: '증정', res: 'gold', gold: 300, food: 0, ap: 1, desc: '금 300을 선물해 우호도를 크게 올립니다(+15~25).' },
  giftFood: { ko: '증정', res: 'food', gold: 0, food: 1200, ap: 1, desc: '식량 1200을 선물해 우호도를 올립니다(+12~22).' },
  alliance: { ko: '동맹 제의', gold: 500, food: 0, ap: 1, desc: '12개월 동맹 — 서로 공격하지 않고 원군을 받습니다.' },
  truce: { ko: '정전 협정', gold: 400, food: 0, ap: 1, desc: '6개월 정전 — 공격을 유예합니다.' },
  surrender: { ko: '항복 권고', gold: 0, food: 0, ap: 1, desc: '압도적으로 열세인 세력에 항복을 권고합니다. 성공하면 그 성·장수·자원을 모두 거두고, 실패하면 우호도 -25.' },
  break: { ko: '동맹 파기', gold: 0, food: 0, ap: 0, desc: '즉시 공격할 수 있게 되지만 명성 -15, 타 세력 우호도 하락.' },
};
/* 옛 이름(친선 사절) — 금 증정과 같은 행동 */
DIPLO.envoy = DIPLO.giftGold;

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

export function factionFood(state, fid) {
  return factionCities(state, fid).reduce((s, c) => s + c.food, 0);
}
/* 세력 전체 식량에서 꺼낸다 — 식량이 많은 성부터 */
export function spendFactionFood(state, fid, amount) {
  let left = amount;
  const cs = factionCities(state, fid).sort((a, b) => b.food - a.food);
  for (const c of cs) {
    const take = Math.min(c.food, left);
    c.food -= take; left -= take;
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
        surrender: Math.round(surrenderChance(state, fid) * 100),
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
  if (isAllied(state, me, targetFid) && (kind === 'envoy' || kind === 'giftGold' || kind === 'giftFood' || kind === 'alliance')) return { ok: false, why: '이미 동맹 중입니다.' };
  if (kind === 'truce' && isTruce(state, me, targetFid)) return { ok: false, why: '이미 정전 중입니다.' };
  if (kind === 'break' && !isAllied(state, me, targetFid)) return { ok: false, why: '동맹 중인 세력이 아닙니다.' };
  if (kind === 'surrender' && isAllied(state, me, targetFid)) return { ok: false, why: '동맹 중인 세력에는 권고를 보낼 수 없습니다. 먼저 동맹을 파기하세요.' };
  if (state.actionPoints < cost.ap) return { ok: false, why: '행동력이 부족합니다.' };
  if (cost.gold && factionGold(state, me) < cost.gold) return { ok: false, why: `금이 부족합니다(${cost.gold} 필요).` };
  if (cost.food && factionFood(state, me) < cost.food) return { ok: false, why: `식량이 부족합니다(${cost.food} 필요).` };
  return { ok: true };
}

/* 증정 — 금 300(+15~25) 또는 식량 1200(+12~22) · 행동력 1 */
export function giveGift(state, targetFid, res = 'gold') {
  const kind = res === 'food' ? 'giftFood' : 'giftGold';
  const c = diplomacyCheck(state, kind, targetFid);
  if (!c.ok) return { ok: false, msg: c.why };
  const cost = DIPLO[kind];
  if (res === 'food') spendFactionFood(state, state.playerId, cost.food);
  else spendFactionGold(state, state.playerId, cost.gold);
  state.actionPoints -= cost.ap;
  const d = ensureDiplomacy(state);
  const k = pairKey(state.playerId, targetFid);
  const before = d.rel[k] || 40;
  const gain = res === 'food' ? randInt(rngOf(state), 12, 22) : randInt(rngOf(state), 15, 25);
  d.rel[k] = clamp(before + gain, 0, 100);
  bumpRng(state, 2);
  const name = state.factions[targetFid].name;
  const msg = res === 'food'
    ? `${name}군에 식량 ${cost.food}을 보냈습니다. 우호도 ${before} → ${d.rel[k]} (+${d.rel[k] - before})`
    : `${name}군에 금 ${cost.gold}을 보냈습니다. 우호도 ${before} → ${d.rel[k]} (+${d.rel[k] - before})`;
  log(state, msg);
  return { ok: true, msg, res, rel: d.rel[k], gain: d.rel[k] - before, label: relationLabel(state, state.playerId, targetFid) };
}
/* 옛 이름 — 금 증정 */
export function sendEnvoy(state, targetFid) { return giveGift(state, targetFid, 'gold'); }

export function allianceChance(state, targetFid) {
  const rel = relationOf(state, state.playerId, targetFid);
  const me = state.factions[state.playerId];
  const t = state.factions[targetFid];
  const lord = lordOf(state, state.playerId);
  let c = 0.12 + rel / 240 + (lord ? lord.cha : 60) / 520 + (me ? me.fame : 45) / 520 - (t ? t.fame : 45) / 700;
  if (isTruce(state, state.playerId, targetFid)) c += 0.1;
  c += advisorBonus(state); // 참모의 조언
  return clamp(c, 0.05, 0.9);
}
export function truceChance(state, targetFid) {
  const rel = relationOf(state, state.playerId, targetFid);
  const lord = lordOf(state, state.playerId);
  const t = state.factions[targetFid];
  return clamp(0.32 + rel / 210 + (lord ? lord.cha : 60) / 620 - (t ? t.fame : 45) / 900 + advisorBonus(state), 0.1, 0.95);
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

/* ---------- 항복 권고 ---------- */
/* 압도적으로 열세인 세력일수록 권고가 통한다 — 대등하거나 강하면 0에 가납다 */
export function surrenderChance(state, targetFid) {
  const me = state.playerId;
  if (!targetFid || targetFid === me) return 0;
  const t = state.factions[targetFid];
  if (!t || !t.alive) return 0;
  const mine = factionCities(state, me);
  const theirs = factionCities(state, targetFid);
  if (!mine.length || !theirs.length) return 0;
  const myTroops = mine.reduce((s, c) => s + c.troops, 0);
  const theirTroops = theirs.reduce((s, c) => s + c.troops, 0);
  const cityEdge = mine.length - theirs.length;
  const troopEdge = theirTroops > 0 ? myTroops / theirTroops : 4;
  // 상대가 버틸 만하거나 성 차이가 없으면 권고는 통하지 않는다
  if (troopEdge < 2 || cityEdge < 1) return 0;
  // 성 우세가 클수록 권고의 무게가 실린다
  let c = Math.max(0, (troopEdge - 2.5) * 0.11) * Math.min(1, cityEdge / 2);
  c += Math.min(0.16, Math.max(0, cityEdge - 1) * 0.02);
  if (theirs.length <= 2) c += 0.08;
  if (theirs.length <= 1) c += 0.06;
  const myFame = state.factions[me] ? state.factions[me].fame : 45;
  c += clamp((myFame - t.fame) / 600, -0.03, 0.1);
  if (isPacified(state, me, targetFid)) c += 0.05;
  return clamp(c, 0, 0.7);
}

/* 항복 권고 — 행동력 1. 성공하면 상대 세력의 성·장수·자원을 거둔다 */
export function demandSurrender(state, targetFid) {
  const c = diplomacyCheck(state, 'surrender', targetFid);
  if (!c.ok) return { ok: false, msg: c.why };
  const me = state.playerId;
  const target = state.factions[targetFid];
  const chance = surrenderChance(state, targetFid);
  if (chance <= 0) return { ok: false, msg: '힘의 차이가 모자라 권고가 통하지 않습니다. 더 압도적으로 밀어붙이세요.' };
  state.actionPoints -= DIPLO.surrender.ap;
  const d = ensureDiplomacy(state);
  const k = pairKey(me, targetFid);
  const before = d.rel[k] || 40;
  const accepted = rngOf(state)() < chance;
  bumpRng(state, 5);
  if (!accepted) {
    d.rel[k] = clamp(before - 25, 0, 100);
    const msg = `${target.name}군이 항복 권고를 모욕으로 여겼습니다. 우호도 ${before} → ${d.rel[k]}`;
    log(state, msg);
    return { ok: true, accepted: false, chance, rel: d.rel[k], msg };
  }
  const cities = factionCities(state, targetFid);
  const cityNames = cities.map((c) => cityName(c.id));
  const goldGain = cities.reduce((s, c) => s + Math.round(c.gold), 0);
  const foodGain = cities.reduce((s, c) => s + Math.round(c.food), 0);
  for (const c of cities) c.owner = me;
  const home = cities[0].id;
  let genCount = 0;
  const rng = rngOf(state);
  for (const g of Object.values(state.generals)) {
    if (g.faction !== targetFid || g.captive || g.dead) continue;
    g.faction = me;
    if (!g.city || !state.cities[g.city] || state.cities[g.city].owner !== me) g.city = home;
    g.loyalty = clamp(38 + randInt(rng, 0, 14), 0, 100);
    g.acted = true; // 이번 달에는 새 깃발 아래에서 쉰다
    genCount++;
  }
  bumpRng(state, 2);
  target.alive = false;
  d.ally[k] = 0; d.truce[k] = 0;
  bumpFame(state, me, 10);
  for (const other of Object.keys(state.factions)) {
    if (other === me || other === targetFid || !state.factions[other].alive) continue;
    const kk = pairKey(me, other);
    d.rel[kk] = clamp((d.rel[kk] || 40) - 8, 0, 100);
  }
  cleanDiplomacy(state);
  const msg = `${target.name}군이 항복 권고를 받아들였습니다! ${cityNames.join('·')} ${cityNames.length}성과 장수 ${genCount}명, 금 ${goldGain.toLocaleString()} · 식량 ${foodGain.toLocaleString()}이 그대의 깃발 아래로 들어왔습니다. 명성 +10`;
  log(state, msg);
  syncOffices(state);
  checkVictory(state);
  return { ok: true, accepted: true, chance, msg, rel: 100, cities: cityNames, generals: genCount, gold: goldGain, food: foodGain, fame: state.factions[me].fame };
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
        affinity: affinityOf(state, g.id),
        loyalty: Math.round(g.loyalty || 0), arms: t.arms, skill: t.skill, skillKo: (SKILLS[t.skill] || {}).ko || t.skill,
        formation: formationsOf(state, g.id)[0] || 'eorin',
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
  c += advisorBonus(state); // 참모의 조언
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
    msg = `${t.ko}의 ${withJosa(plot.ko, '이')} 적에게 들켰습니다. (금 ${plot.gold}만 잃었습니다)`;
  } else if (kind === 'scout') {
    state.scouted = state.scouted || {};
    state.scouted[toCityId] = { until: state.turn + SCOUT_TURNS, by: gid, turn: state.turn };
    msg = `${withJosa(t.ko, '이')} ${cityName(toCityId)}의 속내를 살피고 돌아왔습니다. ${SCOUT_TURNS}턴 동안 장수·충성·훈련을 볼 수 있습니다.`;
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
  const merit = meritRoll(state, 'plot') * (success ? 1 : 0.3) | 0;
  if (merit) addMerit(state, gid, merit);
  out.merit = merit;
  out.fx = { kind: 'plot', gid, name: t.ko, line: msg, delta: success ? `${plot.ko} 성공` : `${plot.ko} 실패`, merit, tone: success ? 'good' : 'bad' };
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
    rollRicePrice(state, { trend: 'good' });
    msg = `풍작으로 식량 ${fmtOr(total)}을 거두었습니다. 쌀이 싸졌습니다(금 100으로 식량 ${ricePriceOf(state)}).`;
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
    if (!irrigate) rollRicePrice(state, { trend: 'bad' });
    msg = irrigate ? '수리 시설을 손보아 가뭄 피해를 줄였습니다. (금 250)' : `가뭄으로 수리와 농업이 메말랐습니다. 쌀이 비싸졌습니다(금 100으로 식량 ${ricePriceOf(state)}).`;
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
      // 직위가 낮은 장수는 많이 데려갈 수 없다 — 병력 상한까지만
      const troops = Math.min(Math.round(c.troops * REINFORCE_RATIO), 4200, c.troops - 800, maxTroopsOf(state, g.id));
      if (troops < 500) continue;
      seen.add(n);
      out.push({
        cityId: n, city: cityName(n), owner: c.owner,
        ownerName: state.factions[c.owner] ? state.factions[c.owner].name : '',
        ally, gid: g.id, gname: t.ko, troops, rankBonus: battleBonusOf(state, g.id),
        spec: { id: t.id, ko: t.ko, lead: t.lead, war: t.war, int: t.int, pol: t.pol, cha: t.cha, arms: t.arms, skill: t.skill, formations: formationsOf(state, g.id) },
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

/* ---------- 등용·친교 ---------- */
/* 등용 성공률 — 친밀도가 바탕, 충성도·매력·명성을 가감한다 */
export function hireChance(state, cityId, gid, officerGid) {
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  if (!g || !t) return 0;
  const officer = officerGid ? generalOf(state, officerGid) : bestOfficer(state, cityId, 'cha');
  const lord = lordOf(state, state.playerId);
  const f = state.factions[state.playerId];
  const aff = affinityOf(state, gid);
  const charm = officer ? officer.cha : (lord ? lord.cha : 60);
  const fame = f ? f.fame : 45;
  const isFree = !g.faction;
  const isLord = Object.values(state.factions).some((x) => x.lord === gid);
  let c;
  if (isFree) {
    // 재야 — 친밀도가 낯설면 좀처럼 고개를 숙이지 않는다
    c = aff / 240 + charm / 500 + fame / 700 - ((t.war || 0) + (t.int || 0)) / 2400;
    c += advisorBonus(state); // 참모의 조언
    if (aff < 40) c = Math.min(c, 0.12);
    if (aff >= 60) c += 0.12;
    if (aff >= 80) c += 0.12;
  } else {
    // 타국 — 충성도가 높으면 이간으로 흔들기 전에는 거의 불가능
    c = 0.06 + aff / 220 + charm / 400 + fame / 500 - (g.loyalty || 0) / 220 - ((t.war || 0) + (t.int || 0)) / 2400;
    c += advisorBonus(state); // 참모의 조언
    if ((g.loyalty || 0) >= 85 && aff < 60) c = Math.min(c, 0.05);
    if (aff >= 60) c += 0.06;
    if (aff >= 80) c += 0.06;
    if (isLord) c -= 0.12;
  }
  if (lord && lord.skill === 'indeok') c += 0.05;
  if (t.skill === 'indeok') c += 0.02;
  // 인덕 보정까지 더해도 재야 낯섦(친밀 40 미만) 구간은 12%를 넘지 않는다
  if (isFree && aff < 40) c = Math.min(c, 0.12);
  return clamp(c, 0.01, isFree ? 0.9 : 0.6);
}

export const BEFRIEND = { gold: 200, ap: 1, min: 12, max: 18, desc: '금 200으로 그 장수와 친교를 맺어 친밀도를 올립니다(+12~18).' };

export function befriendCheck(state, gid) {
  const g = state.generals[gid];
  if (!g) return { ok: false, why: '장수가 없습니다.' };
  if (g.dead || g.captive) return { ok: false, why: '만날 수 없는 장수입니다.' };
  if (g.faction === state.playerId) return { ok: false, why: '이미 아군 장수입니다.' };
  if (!g.city || !state.cities[g.city]) return { ok: false, why: '성에 있는 장수가 아닙니다.' };
  const owner = state.cities[g.city].owner;
  if (owner !== state.playerId) {
    if (!adjacentFriends(state, g.city).length) return { ok: false, why: '그 장수의 성과 인접한 아군 성이 있어야 만날 수 있습니다.' };
    if (owner && isPacified(state, state.playerId, owner)) return { ok: false, why: '동맹·정전 중인 세력의 장수와는 친교를 맺지 않습니다.' };
  }
  if (state.actionPoints < BEFRIEND.ap) return { ok: false, why: '행동력이 부족합니다.' };
  if (factionGold(state, state.playerId) < BEFRIEND.gold) return { ok: false, why: `금이 부족합니다(${BEFRIEND.gold} 필요).` };
  return { ok: true };
}

/* 친교 — 금 200 · 행동력 1 → 친밀도 +12~18. 사절로 나선 아군 장수가 공적을 쌓는다 */
export function befriend(state, gid, officerId = null) {
  const c = befriendCheck(state, gid);
  if (!c.ok) return { ok: false, msg: c.why };
  spendFactionGold(state, state.playerId, BEFRIEND.gold);
  state.actionPoints -= BEFRIEND.ap;
  const before = affinityOf(state, gid);
  const gain = randInt(rngOf(state), BEFRIEND.min, BEFRIEND.max);
  const after = bumpAffinity(state, gid, gain);
  bumpRng(state, 2);
  const t = generalOf(state, gid);
  // 사절 — 지정한 장수, 없으면 그 성(또는 인접한 아군 성)의 매력 최고 장수
  let agent = officerId && state.generals[officerId] && state.generals[officerId].faction === state.playerId ? officerId : null;
  if (!agent) {
    const targetCity = state.generals[gid].city;
    const here = targetCity && state.cities[targetCity] && state.cities[targetCity].owner === state.playerId ? targetCity : null;
    const src = here || (targetCity ? adjacentFriends(state, targetCity)[0] : null);
    const best = src ? bestOfficer(state, src, 'cha') : null;
    agent = best ? best.id : null;
  }
  const merit = agent ? meritRoll(state, 'befriend') : 0;
  if (merit) addMerit(state, agent, merit);
  const msg = `${withJosa(t.ko, '과')} 친교를 맺었습니다. 친밀도 ${before} → ${after} (+${after - before})`;
  log(state, msg);
  return {
    ok: true, msg, aff: after, gain: after - before, label: affinityLabel(after), merit,
    fx: { kind: 'befriend', gid: agent || gid, name: agent ? generalOf(state, agent).ko : '사절', line: `${withJosa(t.ko, '과')} 친교를 맺었습니다!`, delta: `친밀도 +${after - before}`, merit, tone: 'good' },
  };
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
  let fxLine = '';
  let fxDelta = '';
  let fxTone = 'good';
  let hireSuccess = true;

  switch (type) {
    case 'agri': {
      gain = 2 + Math.floor(t.pol / 26) + randInt(rng, 0, 2);
      if (t.skill === 'indeok') gain += 1;
      c.agri = clamp(c.agri + gain, 0, 100);
      msg = `${withJosa(t.ko, '이')} ${cityName(c.id)}의 농업을 ${gain} 올렸습니다. (농업 ${c.agri})`;
      fxLine = `${withJosa(t.ko, '이')} ${cityName(c.id)}의 논밭을 일궜습니다!`;
      fxDelta = `농업 +${gain}`;
      break;
    }
    case 'comm': {
      gain = 2 + Math.floor(t.pol / 26) + randInt(rng, 0, 2);
      c.comm = clamp(c.comm + gain, 0, 100);
      msg = `${withJosa(t.ko, '이')} ${cityName(c.id)}의 상업을 ${gain} 올렸습니다. (상업 ${c.comm})`;
      fxLine = `${withJosa(t.ko, '이')} ${cityName(c.id)}의 저잣거리를 열었습니다!`;
      fxDelta = `상업 +${gain}`;
      break;
    }
    case 'order': {
      gain = 3 + Math.floor(t.pol / 22) + randInt(rng, 0, 2);
      c.order = clamp(c.order + gain, 0, 100);
      c.def = clamp(c.def + 1, 20, 99);
      msg = `${withJosa(t.ko, '이')} 치안을 ${gain} 올렸습니다. (치안 ${c.order})`;
      fxLine = `${withJosa(t.ko, '이')} 성 안팎을 순찰해 민심을 다독였습니다.`;
      fxDelta = `치안 +${gain}`;
      break;
    }
    case 'water': {
      gain = 3 + Math.floor(t.int / 22) + randInt(rng, 0, 2);
      c.water = clamp(c.water + gain, 0, 100);
      msg = `${withJosa(t.ko, '이')} 수리 시설을 정비했습니다. (수리 ${c.water})`;
      fxLine = `${withJosa(t.ko, '이')} 물길과 둑을 손봤습니다!`;
      fxDelta = `수리 +${gain}`;
      break;
    }
    case 'draft': {
      const add = 900 + Math.floor(t.lead * 4);
      c.gold -= 250; c.food -= 400;
      c.troops += add; c.order = clamp(c.order - 3, 0, 100); c.train = clamp(c.train - 6, 10, 100);
      msg = `${withJosa(t.ko, '이')} 병사 ${add.toLocaleString()}명을 모았습니다. (병력 ${c.troops.toLocaleString()})`;
      fxLine = `${withJosa(t.ko, '이')} 병사 ${add.toLocaleString()}명을 모았습니다!`;
      fxDelta = `병력 +${add.toLocaleString()}`;
      break;
    }
    case 'train': {
      gain = 4 + Math.floor(t.lead / 18);
      c.train = clamp(c.train + gain, 0, 100);
      msg = `${withJosa(t.ko, '이')} 부대를 훈련했습니다. (훈련 ${c.train})`;
      fxLine = `${withJosa(t.ko, '이')} 병사를 조련했습니다!`;
      fxDelta = `훈련 +${gain}`;
      break;
    }
    case 'search': {
      const tr = findTreasure(state, c.id, 0.12, rng);
      const r = rng();
      if (tr) {
        msg = `${t.ko}의 탐색으로 ${withJosa(tr.treasure.ko, '을')} 찾았습니다! (${treasureBonusText(tr.treasure)}) — 특수에서 수여할 수 있습니다.`;
      } else if (r < 0.35) {
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
      const chance = hireChance(state, c.id, target.id, opts.officerId);
      if (rng() < chance) {
        target.faction = state.playerId;
        target.loyalty = 58 + Math.floor(t.cha / 9) + Math.floor(affinityOf(state, target.id) / 12);
        const aff = bumpAffinity(state, target.id, 8);
        state.stats.recruited++;
        f.fame = clamp(f.fame + 2, 0, 100);
        gain = 1;
        msg = `${withJosa(tg.ko, '이')} ${t.ko}의 설득에 응해 부하가 되었습니다! (충성 ${target.loyalty} · 친밀도 ${aff})`;
        fxLine = `${withJosa(tg.ko, '이')} ${t.ko}의 설득에 응해 부하가 되었습니다!`;
        fxDelta = `충성 ${target.loyalty} · 친밀 ${aff}`;
      } else {
        const aff = bumpAffinity(state, target.id, -3);
        msg = `${tg.ko}은(는) 고개를 저었습니다. (등용 실패 · 친밀도 ${aff})`;
        target.loyalty = 0;
        hireSuccess = false;
        fxTone = 'bad';
        fxLine = `${withJosa(tg.ko, '이')} 고개를 저었습니다.`;
        fxDelta = `친밀도 ${aff}`;
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
      const aff = bumpAffinity(state, target.id, 5);
      msg = `${generalOf(state, target.id).ko}의 충성도가 ${inc} 올랐습니다. (충성 ${target.loyalty} · 친밀도 ${aff})`;
      fxLine = `${withJosa(generalOf(state, target.id).ko, '을')} 포상했습니다!`;
      fxDelta = `충성 +${inc}`;
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
  // 공적 — 개발·상업·치안·수리·징병·훈련·탐색·등용(성공)·포상
  let merit = 0;
  if (type === 'hire') {
    if (hireSuccess) merit = meritRoll(state, 'hire', rng);
  } else if (MERIT_GAIN[type]) {
    merit = meritRoll(state, type, rng);
  }
  if (merit) addMerit(state, opts.officerId, merit);
  log(state, msg);
  bumpRng(state);
  return {
    ok: true, msg, merit,
    fx: { kind: type, name: t.ko, line: fxLine || msg, delta: fxDelta, merit, tone: fxTone },
  };
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
  const affBefore = affinityOf(state, gid);
  const affGain = randInt(rng, 6, 10);
  const affAfter = bumpAffinity(state, gid, affGain);
  state.talked = state.talked || {};
  state.talked[gid] = state.turn;
  state.actionPoints -= TALK_COST;
  const line = pickTalkLine(gid, t, before, state.turn);
  const msg = `${withJosa(t.ko, '과')} 이야기를 나눴습니다. 충성도 ${before} → ${after} (+${after - before}) · 친밀도 ${affBefore} → ${affAfter}`;
  log(state, msg);
  bumpRng(state);
  return { ok: true, msg, line, before, after, gain: after - before, aff: affAfter, affGain: affAfter - affBefore, style: talkStyleOf(t, before) };
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
  const atkIds = (opts.atkGenerals || atkGens.map((g) => g.id)).slice(0, MAX_ARMY);
  const defIds = defGens.map((g) => g.id).slice(0, MAX_ARMY);
  // 장군 직위별 지휘 상한 — 상한을 넘는 병력은 성에 남는다
  const troopCaps = {};
  const rankBonus = {};
  for (const gid of [...new Set([...atkIds, ...defIds])]) {
    troopCaps[gid] = maxTroopsOf(state, gid);
    rankBonus[gid] = battleBonusOf(state, gid);
  }
  const atkCap = atkIds.reduce((s, gid) => s + (troopCaps[gid] || 0), 0);
  const defCap = defIds.reduce((s, gid) => s + (troopCaps[gid] || 0), 0);
  const wantAtk = typeof opts.atkTroops === 'number' ? opts.atkTroops : from.troops;
  return {
    fromCityId, toCityId,
    attackerFaction: from.owner,
    defenderFaction: to.owner,
    atkGenerals: atkIds,
    defGenerals: defGens.map((g) => g.id),
    atkTroops: Math.min(wantAtk, atkCap),
    defTroops: Math.min(to.troops, defCap || to.troops),
    defBonus: to.def,
    troopCaps,
    rankBonus,
    reinforcements: plan,
  };
}

/* ---------- 5월 무예 대회 · 10월 설전 대회 ---------- */
/* 세력 장수가 30명을 넘으면 5월에 무예 대회, 10월에 설전 대회를 연다.
   상위 8명 토너먼트(8강→4강→결승)로 우승자를 가리고, 하사로 충성·친밀·명성을 올린다. */
export const TOURNAMENT = {
  minGenerals: 30,
  size: 8,
  months: { 5: 'martial', 10: 'debate' },
  kind: {
    martial: { ko: '무예 대회', statKey: 'war', statKo: '무력' },
    debate: { ko: '설전 대회', statKey: 'int', statKo: '지력' },
  },
  reward: {
    gold: { ko: '금 하사', done: '금을 하사했습니다', gold: 300, loyalty: 12, affinity: 10, fame: 4 },
    treasure: { ko: '보물 하사', done: '보물을 하사했습니다', gold: 0, loyalty: 10, affinity: 8, fame: 3 },
    praise: { ko: '치하만 하기', done: '치하였습니다', gold: 0, loyalty: 5, affinity: 5, fame: 2 },
  },
  rounds: ['8강', '4강', '결승'],
};

export function tournamentKindOf(month) { return TOURNAMENT.months[month] || null; }
export function canHoldTournament(state) {
  return factionGenerals(state, state.playerId).length >= TOURNAMENT.minGenerals;
}

/* 무력·지력 상위 8명 — 보물 보정을 반영한 값으로 겨룬다 */
function tournamentEntrants(state, kind) {
  const key = TOURNAMENT.kind[kind].statKey;
  return factionGenerals(state, state.playerId)
    .map((g) => {
      const t = effectiveGeneral(state, g.id) || generalOf(state, g.id) || {};
      return { gid: g.id, ko: t.ko || g.id, stat: t[key] || 0, lead: t.lead || 0 };
    })
    .sort((a, b) => b.stat - a.stat || b.lead - a.lead || (a.gid < b.gid ? -1 : 1))
    .slice(0, TOURNAMENT.size);
}

/* 한 판 — 능력치에 소폭의 운(0~12)을 더해 겨룬다 */
function playTournamentMatch(a, b, rng) {
  const sa = a.stat + Math.floor(rng() * 13);
  const sb = b.stat + Math.floor(rng() * 13);
  const aWins = sa > sb || (sa === sb && a.stat >= b.stat);
  return {
    a: { gid: a.gid, ko: a.ko, stat: a.stat, score: sa },
    b: { gid: b.gid, ko: b.ko, stat: b.stat, score: sb },
    winner: aWins ? 'a' : 'b',
    winGid: aWins ? a.gid : b.gid,
  };
}

const winnerOf = (m) => (m.winner === 'a' ? m.a : m.b);
const loserOf = (m) => (m.winner === 'a' ? m.b : m.a);

/* 대진표를 짜고 끝까지 겨룬다 — 1:8 · 4:5 · 3:6 · 2:7 씨드 */
export function buildTournament(state, kind, rng = Math.random) {
  const meta = TOURNAMENT.kind[kind];
  if (!meta) return null;
  const pool = tournamentEntrants(state, kind);
  if (pool.length < TOURNAMENT.size) return null;
  const seeds = [[0, 7], [3, 4], [2, 5], [1, 6]];
  const quarter = seeds.map(([i, j]) => playTournamentMatch(pool[i], pool[j], rng));
  const qw = quarter.map(winnerOf);
  const semi = [[0, 1], [2, 3]].map(([i, j]) => playTournamentMatch(qw[i], qw[j], rng));
  const sw = semi.map(winnerOf);
  const final = playTournamentMatch(sw[0], sw[1], rng);
  const champ = winnerOf(final);
  const runner = loserOf(final);
  return {
    kind,
    statKey: meta.statKey,
    statKo: meta.statKo,
    title: meta.ko,
    entrants: pool.length,
    totalGenerals: factionGenerals(state, state.playerId).length,
    rounds: [quarter, semi, [final]],
    championId: champ.gid,
    championKo: champ.ko,
    championStat: champ.stat,
    runnerUpKo: runner.ko,
    reward: null,
    shown: false,
  };
}

/* 달이 바뀔 때 조건(장수 30명 이상·5월/10월)을 채우면 대회를 연다 */
export function maybeOpenTournament(state, rng = null) {
  if (!state || state.gameOver) return null;
  if (state.pendingTournament) return state.pendingTournament;
  const kind = tournamentKindOf(state.month);
  if (!kind) return null;
  if (!canHoldTournament(state)) return null;
  const r = rng || rngOf(state);
  const tv = buildTournament(state, kind, r);
  if (!tv) return null;
  tv.year = state.year;
  tv.month = state.month;
  tv.turn = state.turn;
  tv.head = `${state.month}월 ${tv.title}`;
  state.pendingTournament = tv;
  log(state, `${state.month}월 ${tv.title} — ${withJosa(tv.championKo, '이')} 우승했습니다. (${tv.statKo} ${tv.championStat})`);
  bumpRng(state, 7);
  return tv;
}

/* 하사할 수 있는 보물 — 창고에 있는 보유 보물, 없으면 임자 없는 보물 하나를 대회 포상으로 내건다 */
export function tournamentPrizes(state) {
  const t = ensureTreasures(state);
  const warehouse = t.owned.filter((tid) => !t.where[tid] && TREASURE_BY_ID[tid]);
  const list = warehouse.map((tid) => {
    const tr = TREASURE_BY_ID[tid];
    return { id: tid, ko: tr.ko, bonusText: treasureBonusText(tr), from: 'warehouse' };
  });
  if (list.length) return list;
  const lost = lostTreasures(state);
  if (!lost.length) return [];
  const tr = lost[0];
  return [{ id: tr.id, ko: tr.ko, bonusText: treasureBonusText(tr), from: 'prize' }];
}

/* 하사 선택 — gold(금 300) · treasure(보물) · praise(치하만) */
export function resolveTournamentReward(state, choice, opts = {}) {
  const tv = state.pendingTournament;
  if (!tv) return { ok: false, msg: '진행 중인 대회가 없습니다.' };
  const R = TOURNAMENT.reward[choice];
  if (!R) return { ok: false, msg: '없는 선택입니다.' };
  const champ = state.generals[tv.championId];
  if (!champ || champ.dead || champ.captive || champ.faction !== state.playerId) {
    return { ok: false, msg: '우승 장수가 아군에 없습니다.' };
  }
  let gained = '';
  if (choice === 'gold') {
    if (factionGold(state, state.playerId) < R.gold) return { ok: false, msg: `세력 금이 부족합니다(${R.gold} 필요).` };
    spendFactionGold(state, state.playerId, R.gold);
  } else if (choice === 'treasure') {
    const prizes = tournamentPrizes(state);
    const prize = prizes.find((p) => p.id === opts.treasureId) || prizes[0];
    if (!prize) return { ok: false, msg: '하사할 보물이 없습니다.' };
    if (prize.from === 'prize') {
      const res = gainTreasure(state, prize.id, { holder: champ.id });
      if (!res.ok) return { ok: false, msg: res.msg };
    } else {
      const res = awardTreasure(state, prize.id, champ.id);
      if (!res.ok) return { ok: false, msg: res.msg };
    }
    gained = prize.ko;
  }
  champ.loyalty = clamp((champ.loyalty || 0) + R.loyalty, 0, 100);
  const aff = bumpAffinity(state, champ.id, R.affinity);
  bumpFame(state, state.playerId, R.fame);
  const costText = R.gold ? `금 ${R.gold} · ` : '';
  const trText = gained ? `${gained} · ` : '';
  const msg = `${tv.title} 우승자 ${champ ? generalOf(state, champ.id).ko : tv.championKo}에게 ${costText}${trText}충성 +${R.loyalty} · 친밀 +${R.affinity} · 명성 +${R.fame} — ${R.done}. (충성 ${champ.loyalty} · 친밀 ${aff})`;
  const record = { ...tv, reward: choice, rewardKo: R.ko, treasure: gained || null, affinityAfter: aff, loyaltyAfter: champ.loyalty, resolvedTurn: state.turn };
  state.lastTournament = record;
  state.pendingTournament = null;
  log(state, msg);
  return { ok: true, msg, tournament: record };
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
  checkFactionDeath(state, defFid, attackerWins ? atkFid : defFid);
  checkFactionDeath(state, atkFid, attackerWins ? atkFid : defFid);
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

/* 등용 성공률 — 군주 매력·명성 vs 대상 충성도·무력, 바탕은 친밀도 */
export function recruitChance(state, gid) {
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  if (!g || !t) return 0;
  const f = state.factions[state.playerId];
  const lord = lordOf(state, state.playerId);
  const isLord = Object.values(state.factions).some((x) => x.lord === gid);
  const aff = affinityOf(state, gid);
  let c = 0.04 + aff / 240 + (lord ? lord.cha : 60) / 360 + (f ? f.fame : 45) / 420 - (g.loyalty || 0) / 150 - (t.war || 0) / 1200;
  c += advisorBonus(state); // 참모의 조언
  if (aff < 40) c = Math.min(c, 0.3);
  if ((g.loyalty || 0) >= 85 && aff < 60) c = Math.min(c, 0.05);
  if (aff >= 60) c += 0.08;
  if (isLord) c -= 0.18;
  if (lord && lord.skill === 'indeok') c += 0.05;
  if (t.skill === 'indeok') c += 0.02;
  return clamp(c, 0.01, 0.9);
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
    bumpAffinity(state, gid, -3);
    return { ok: true, accepted: false, chance, aff: affinityOf(state, gid), msg: `${t.ko}: "두 임금을 섬길 수 없습니다." — 등용에 응하지 않았습니다.` };
  }
  const lord = lordOf(state, state.playerId);
  const held = treasureOf(state, gid);
  g.captive = false;
  g.dead = false;
  g.faction = state.playerId;
  g.city = rec.city;
  g.loyalty = clamp(46 + Math.round((lord ? lord.cha : 60) / 6) - (rec.isLord ? 12 : 0), 30, 88);
  const aff = bumpAffinity(state, gid, 12);
  state.stats.recruited++;
  if (held) gainTreasure(state, held.id, { holder: gid });
  dropPrisoner(state, gid);
  log(state, `${withJosa(t.ko, '이')} ${state.factions[state.playerId].name}군에 합류했습니다. (충성 ${g.loyalty} · 친밀도 ${aff})`);
  return { ok: true, accepted: true, chance, loyalty: g.loyalty, aff, msg: `${withJosa(t.ko, '이')} 고개를 숙였습니다! 충성 ${g.loyalty}로 아군이 되었습니다.` };
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
  const aff = bumpAffinity(state, gid, 25);
  dropPrisoner(state, gid);
  log(state, `${withJosa(t.ko, '을')} 풀어 주었습니다. 의를 베푼 이름이 퍼집니다. (명성 +5 · 친밀도 ${aff})`);
  return { ok: true, msg: `${withJosa(t.ko, '을')} 풀어 주었습니다. 명성 +5 · 친밀도 ${aff}`, fame: state.factions[state.playerId].fame, aff };
}

/* 참수 — 영구 퇴장(다시 등장하지 않음), 명성 소폭 하락과 원한 */
export function executePrisoner(state, gid) {
  const rec = (state.pendingPrisoners || []).find((p) => p.gid === gid);
  const g = state.generals[gid];
  const t = generalOf(state, gid);
  if (!rec || !g) return { ok: false, msg: '포로가 아닙니다.' };
  const spoils = takeTreasuresOf(state, gid, '참수');
  g.captive = false;
  g.dead = true;
  g.faction = null;
  g.city = null;
  g.loyalty = 0;
  state.stats.executed = (state.stats.executed || 0) + 1;
  for (const o of Object.values(state.generals)) {
    if (o.id === gid || o.dead || o.captive) continue;
    if (o.faction === rec.faction) {
      o.loyalty = clamp((o.loyalty || 0) + 4, 0, 100);
      bumpAffinity(state, o.id, rec.isLord ? -12 : -8); // 같은 세력은 원한을 품는다
    }
  }
  bumpFame(state, state.playerId, rec.isLord ? -4 : -2);
  dropPrisoner(state, gid);
  checkFactionDeath(state, rec.faction);
  log(state, `${withJosa(t.ko, '의')} 목을 베었습니다. 그 이름은 이제 기록에만 남습니다.`);
  return { ok: true, msg: `${withJosa(t.ko, '을')} 참수했습니다. 다시는 나타나지 않습니다.`, treasure: spoils ? spoils.treasure : null };
}

export function bumpFame(state, fid, n) {
  const f = state.factions[fid];
  if (!f) return;
  f.fame = clamp(f.fame + n, 0, 100);
}

export function checkFactionDeath(state, fid, victorFid = null) {
  if (!fid) return;
  const f = state.factions[fid];
  if (!f) return;
  if (!factionCities(state, fid).length) {
    f.alive = false;
    log(state, `${f.name} 세력이 멸망했습니다.`);
    // 마지막 성을 빼앗은 이가 플레이어면, 그 세력 장수들이 지닌 보물을 거둔다
    if (victorFid && victorFid === state.playerId) {
      const took = [];
      for (const g of Object.values(state.generals)) {
        if (g.dead || g.faction !== fid) continue;
        const tr = treasureOf(state, g.id);
        if (!tr) continue;
        gainTreasure(state, tr.id, { holder: null });
        took.push(tr.ko);
      }
      if (took.length) log(state, `${f.name} 세력이 무너지며 ${took.join('·')}을(를) 거두었습니다.`);
    }
    cleanDiplomacy(state);
  }
  if (fid === state.playerId && !f.alive) {
    state.gameOver = { type: 'defeat', text: `${f.name} 세력이 멸망했습니다.` };
  }
}

export function endTurnPhase2(state) {
  // 위임한 성이 스스로 일한다(행동력을 쓰지 않는다)
  runDelegations(state, rngOf(state));
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
  // 참모가 없으면 다시 앉히고, 쌀 시세를 새로 정한다
  autoAdvisor(state);
  rollRicePrice(state, { rng });
  syncOffices(state);
  state.maxActionPoints = calcActionPoints(state, state.playerId);
  state.actionPoints = state.maxActionPoints;

  checkVictory(state);
  if (!state.gameOver) maybeOpenTournament(state, rngOf(state));
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
  const victorFid = result.winner === 'attacker' ? atkFid : defFid;
  // 전투 승리 공적 — 이긴 쪽에 나선 장수마다 +50~80
  const winGids = result.winner === 'attacker' ? (result.atkGenerals || []) : (result.defGenerals || []);
  let meritTotal = 0;
  for (const gid of winGids) {
    const g = state.generals[gid];
    if (!g || g.dead || g.captive || g.faction !== victorFid) continue;
    const m = randInt(R, MERIT_GAIN.win[0], MERIT_GAIN.win[1]);
    addMerit(state, gid, m);
    meritTotal += m;
  }
  out.merit = meritTotal;
  checkFactionDeath(state, defFid, victorFid);
  checkFactionDeath(state, atkFid, victorFid);
  cleanDiplomacy(state);
  syncOffices(state);
  checkVictory(state);
  return out;
}

/* ---------- 저장/불러오기 ---------- */
/* 옛 저장(v3~v9)에 없던 새 장수를 재야로 채워 넣는다 — 이어하기에서도 보강분을 만날 수 있다 */
function ensureStaticGenerals(s) {
  if (!s.generals) s.generals = {};
  for (const g of GENERALS) {
    if (s.generals[g.id]) continue;
    s.generals[g.id] = {
      id: g.id, faction: null, city: g.home && CITY_BY_ID[g.home] ? g.home : 'luoyang',
      loyalty: 0, acted: false, captive: false, dead: false, hidden: false, movedThisTurn: false,
    };
  }
}

/* 진형 전수 기록 — 옛 저장(v3~v9)에는 없으니 빈 기록으로 채워 넣는다 */
function ensureFormationLearning(s) {
  s.learnedFormations = s.learnedFormations && typeof s.learnedFormations === 'object' && !Array.isArray(s.learnedFormations)
    ? s.learnedFormations : {};
  s.formationMastery = s.formationMastery && typeof s.formationMastery === 'object' && !Array.isArray(s.formationMastery)
    ? s.formationMastery : {};
  for (const gid of Object.keys(s.learnedFormations)) {
    const list = (Array.isArray(s.learnedFormations[gid]) ? s.learnedFormations[gid] : []).filter((f) => FORMATIONS[f]);
    s.learnedFormations[gid] = [...new Set(list)];
  }
  for (const gid of Object.keys(s.formationMastery)) {
    const row = s.formationMastery[gid] && typeof s.formationMastery[gid] === 'object' ? s.formationMastery[gid] : {};
    for (const f of Object.keys(row)) {
      if (!FORMATIONS[f]) { delete row[f]; continue; }
      row[f] = clamp(Math.round(Number(row[f]) || 0), 0, FORMATION_TRAIN.target);
    }
    s.formationMastery[gid] = row;
  }
}

export function serialize(state) {
  const copy = { ...state };
  delete copy.__rng;
  return JSON.stringify(copy);
}
export function deserialize(json) {
  const s = JSON.parse(json);
  // 3 = 신군주 이전, 4 = 포로 처분 이전, 5 = 대화·이동 이전, 6 = 외교·관직 이전, 7 = 항복 권고·친밀도 이전, 8 = 보물·참모·위임 이전, 9 = 공적·장군 직위 이전. 열어서 새 양식으로 옮긴다.
  if (!s || ![3, 4, 5, 6, 7, 8, 9, SAVE_VERSION].includes(s.version)) throw new Error('저장 파일 형식이 다릅니다.');
  s.version = SAVE_VERSION;
  s.customGenerals = s.customGenerals || {};
  s.pendingBattles = s.pendingBattles || [];
  s.pendingPrisoners = s.pendingPrisoners || [];
  s.talked = s.talked || {};
  s.log = s.log || [];
  s.scouted = s.scouted || {};
  s.offices = s.offices || {};
  s.pendingEvent = s.pendingEvent || null;
  s.pendingTournament = s.pendingTournament || null;
  s.lastTournament = s.lastTournament || null;
  s.lastPromotions = [];
  s.stats = { battles: 0, wins: 0, duelWins: 0, duels: 0, captured: 0, recruited: 0, executed: 0, released: 0, trades: 0, treasureFound: 0, ...(s.stats || {}) };
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
  ensureStaticGenerals(s);
  ensureRanks(s);
  ensureDiplomacy(s);
  ensureAffinity(s);
  ensureTreasures(s);
  ensureDelegation(s);
  ensureFormationLearning(s);
  s.delegationLog = Array.isArray(s.delegationLog) ? s.delegationLog : [];
  ricePriceOf(s);
  autoAdvisor(s);
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

/* ---------- 진형 전수 (같은 성의 스승 장수에게 배우기) ----------
   · 제자만 행동력 1과 이번 달 행동을 쓴다(스승은 성에 있기만 하면 된다).
   · 한 번에 25~36%만 오르므로 3~4번 훈련해야 100%가 된다.
   · 100%가 되면 그 진형이 장수의 주력 진형에 영구히 붙는다. */
export const FORMATION_TRAIN = { ap: 1, min: 25, max: 36, target: 100 };

/* 이 장수가 전수로 익힌 진형(100% 달성분) */
export function learnedFormationsOf(state, gid) {
  const list = state && state.learnedFormations ? state.learnedFormations[gid] : null;
  return (Array.isArray(list) ? list : []).filter((f) => FORMATIONS[f]);
}

/* 지금 쓸 수 있는 진형 — 원래 주력 + 전수로 익힌 진형 */
export function formationsOf(state, gid) {
  const g = generalOf(state, gid);
  return [...new Set([...formationOf(g || {}), ...learnedFormationsOf(state, gid)])].filter((f) => FORMATIONS[f]);
}

export function knowsFormation(state, gid, formId) {
  return formationsOf(state, gid).includes(formId);
}

/* 숙련도 0~100 — 이미 익힌 진형은 100 */
export function formationMasteryOf(state, gid, formId) {
  if (knowsFormation(state, gid, formId)) return FORMATION_TRAIN.target;
  const row = state && state.formationMastery ? state.formationMastery[gid] : null;
  const v = row ? Number(row[formId]) : 0;
  return clamp(Math.round(v || 0), 0, FORMATION_TRAIN.target - 1);
}

/* 이 성에서 그 진형을 아는 아군 스승 장수 */
export function formationTeachers(state, cityId, formId, exclude = []) {
  const fid = state.playerId;
  return generalsInCity(state, cityId)
    .filter((g) => g.faction === fid && !exclude.includes(g.id) && knowsFormation(state, g.id, formId))
    .map((g) => generalOf(state, g.id))
    .filter(Boolean);
}

/* 이 성의 장수들이 아는 진형 — 스승 이름과 함께 */
export function cityFormationTeachers(state, cityId) {
  const fid = state.playerId;
  const rows = new Map();
  for (const g of generalsInCity(state, cityId)) {
    if (g.faction !== fid) continue;
    const t = generalOf(state, g.id);
    if (!t) continue;
    for (const formId of formationsOf(state, g.id)) {
      if (!rows.has(formId)) rows.set(formId, []);
      rows.get(formId).push({ id: g.id, ko: t.ko });
    }
  }
  return [...rows.entries()].map(([formId, teachers]) => ({
    id: formId, ...FORMATIONS[formId], teachers,
  })).sort((a, b) => {
    // 기본 진형(어린)은 뒤로 — 배울 만한 진형부터 보이게
    const rank = (id) => (id === 'eorin' ? 99 : Object.keys(FORMATIONS).indexOf(id));
    return rank(a.id) - rank(b.id);
  });
}

/* 제자가 이 성에서 배울 수 있는 진형 — 스승이 있고 제자가 아직 모르는 것 */
export function learnableFormations(state, cityId, studentGid = null) {
  const list = cityFormationTeachers(state, cityId).filter((row) => row.teachers.some((x) => x.id !== studentGid));
  if (!studentGid) return list;
  return list.filter((row) => !knowsFormation(state, studentGid, row.id));
}

/* 이 성에서 전수할 수 있는 진형 — 스승이 있고, 아직 배울 수 있는 제자(행동 전)가 있는 것 */
export function cityLearnableFormations(state, cityId) {
  const gens = generalsInCity(state, cityId).filter((g) => g.faction === state.playerId);
  return cityFormationTeachers(state, cityId).filter((row) =>
    gens.some((g) => !g.acted && !knowsFormation(state, g.id, row.id)));
}

/* 1회 전수 상승폭 — 제자의 통솔·지력과 스승의 통솔·지력이 좋을수록 크다(25~36%) */
export function formationTrainGain(state, studentGid, teacherGid, rng = rngOf(state)) {
  const s = generalOf(state, studentGid) || {};
  const m = generalOf(state, teacherGid) || {};
  const apt = ((s.lead || 0) + (s.int || 0)) / 2;
  const mast = (m.lead || 0) * 0.6 + (m.int || 0) * 0.4;
  const bonus = clamp(Math.round(((apt + mast) / 2 - 55) / 5), 0, 8);
  return clamp(FORMATION_TRAIN.min + bonus + randInt(rng, 0, 3), FORMATION_TRAIN.min, FORMATION_TRAIN.max);
}

export function canLearnFormation(state, cityId, studentGid, formId) {
  const c = state.cities[cityId];
  if (!c || c.owner !== state.playerId) return { ok: false, why: '아군 성이 아닙니다.' };
  const g = state.generals[studentGid];
  const t = generalOf(state, studentGid);
  if (!g || !t) return { ok: false, why: '장수를 찾을 수 없습니다.' };
  if (g.city !== cityId || g.faction !== state.playerId || g.captive || g.dead) return { ok: false, why: '이 성에 있는 아군 장수가 아닙니다.' };
  const form = FORMATIONS[formId];
  if (!form) return { ok: false, why: '알 수 없는 진형입니다.' };
  if (knowsFormation(state, studentGid, formId)) return { ok: false, why: `${t.ko}은(는) 이미 ${form.ko} 진형을 익혔습니다.` };
  if (g.acted) return { ok: false, why: `${t.ko}은(는) 이번 달에 이미 움직였습니다.` };
  if (state.actionPoints < FORMATION_TRAIN.ap) return { ok: false, why: '행동력이 부족합니다.' };
  const teachers = formationTeachers(state, cityId, formId, [studentGid]);
  if (!teachers.length) return { ok: false, why: `이 성에 ${form.ko} 진형을 아는 스승 장수가 없습니다.` };
  return { ok: true, teachers };
}

/* 전수 훈련 실행 — 제자 행동력 1 · 행동 완료, 스승은 그대로 */
export function trainFormation(state, cityId, studentGid, formId, teacherGid = null) {
  const check = canLearnFormation(state, cityId, studentGid, formId);
  if (!check.ok) return { ok: false, msg: check.why };
  const teacher = check.teachers.find((x) => x.id === teacherGid) || check.teachers[0];
  const student = generalOf(state, studentGid);
  const form = FORMATIONS[formId];
  const before = formationMasteryOf(state, studentGid, formId);
  const gain = formationTrainGain(state, studentGid, teacher.id);
  const after = clamp(before + gain, 0, FORMATION_TRAIN.target);
  state.formationMastery[studentGid] = state.formationMastery[studentGid] || {};
  state.formationMastery[studentGid][formId] = after;
  const known = after >= FORMATION_TRAIN.target;
  if (known) {
    state.learnedFormations[studentGid] = [...new Set([...learnedFormationsOf(state, studentGid), formId])];
  }
  state.generals[studentGid].acted = true;
  state.actionPoints -= FORMATION_TRAIN.ap;
  const merit = meritRoll(state, 'learn');
  addMerit(state, studentGid, merit);
  const msg = known
    ? `${teacher.ko}에게 ${withJosa(form.ko, '을')} 전수받아 ${withJosa(student.ko, '이')} ${form.ko} 진형을 익혔습니다! (숙련 ${before}% → 100%)`
    : `${teacher.ko}에게 ${withJosa(form.ko, '을')} 전수받았습니다. ${student.ko}의 ${form.ko} 숙련 ${before}% → ${after}%`;
  log(state, msg);
  bumpRng(state);
  return {
    ok: true, msg, gain, before, after, known, studentKo: student.ko, formKo: form.ko, formId, teacherKo: teacher.ko, merit,
    fx: { kind: 'learn', gid: studentGid, name: student.ko, line: known ? `${form.ko} 진형을 익혔습니다!` : `${teacher.ko}에게 ${form.ko}을 전수받았습니다.`, delta: `숙련 ${after}%`, merit, tone: 'good' },
  };
}

export function formationOptions(gid, state = null) {
  return formationsOf(state, gid).map((fid) => FORMATIONS[fid]).filter(Boolean);
}
export { CITIES, CITY_BY_ID, GENERALS, GENERAL_BY_ID, SCENARIOS, FORMATIONS, FACTION_COLORS, ARMS, SKILLS, CUSTOM_COLORS, TREASURES, TREASURE_BY_ID, TREASURE_STAT_KO };
