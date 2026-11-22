/* 도트삼국 — 게임 엔진 (DOM 비의존, node 테스트 가능) */
import { CITIES, CITY_BY_ID, GENERALS, GENERAL_BY_ID, SCENARIOS, FORMATIONS, FACTION_COLORS, ARMS, SKILLS, CUSTOM_COLORS } from './data.js';
import { pickTalkLine, talkStyleOf } from './talk.js';

export const SAVE_VERSION = 6;
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

  state.maxActionPoints = calcActionPoints(state, factionId);
  state.actionPoints = state.maxActionPoints;
  const playerFac = state.factions[factionId];
  log(state, `${sc.year}년 ${sc.name} — ${playerFac.name} 세력으로 천하에 나서다.`);
  return state;
}

export const CUSTOM_STAT_MIN = 20;
export const CUSTOM_STAT_MAX = 96;
export const CUSTOM_STAT_BUDGET = 225; // 5능력치 평균 45 — 총합 고정, 분배만 자유
export const CUSTOM_NAME_MIN = 2;
export const CUSTOM_NAME_MAX = 6;
export const CUSTOM_RETINUE_PRESETS = [
  { ko: '한석', skill: 'cheolbyeok', arms: '보병' },
  { ko: '위담', skill: 'dolgyeok', arms: '기병' },
];
const STAT_KEYS = ['lead', 'war', 'int', 'pol', 'cha'];

/* 주사위: 총합 예산을 다섯 능력치에 무작위로 나눈다 */
export function rollCustomStats(rand = Math.random) {
  const stats = {};
  let left = CUSTOM_STAT_BUDGET;
  STAT_KEYS.forEach((k, i) => {
    const rest = STAT_KEYS.length - i - 1;
    if (rest === 0) { stats[k] = clamp(left, CUSTOM_STAT_MIN, CUSTOM_STAT_MAX); return; }
    const avg = left / (rest + 1);
    const hi = Math.min(CUSTOM_STAT_MAX, left - rest * CUSTOM_STAT_MIN);
    const v = clamp(Math.round(avg + (rand() - 0.5) * 30), CUSTOM_STAT_MIN, hi);
    stats[k] = v;
    left -= v;
  });
  const sum = STAT_KEYS.reduce((n, k) => n + stats[k], 0);
  stats.cha = clamp(stats.cha + (CUSTOM_STAT_BUDGET - sum), CUSTOM_STAT_MIN, CUSTOM_STAT_MAX);
  return stats;
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
export function adjacentEnemies(state, cityId) {
  const own = ownerOf(state, cityId);
  return neighbors(cityId).filter((n) => ownerOf(state, n) && ownerOf(state, n) !== own);
}
export function adjacentFriends(state, cityId) {
  const own = ownerOf(state, cityId);
  return neighbors(cityId).filter((n) => ownerOf(state, n) === own);
}
export function calcActionPoints(state, fid) {
  const f = state.factions[fid];
  if (!f) return 0;
  const cs = factionCities(state, fid).length;
  return clamp(4 + Math.floor(f.fame / 22) + Math.min(3, Math.floor(cs / 3)), 4, 10);
}
export function bestOfficer(state, cityId, key, exclude = []) {
  const gens = generalsInCity(state, cityId).filter((g) => !g.acted && !exclude.includes(g.id));
  if (!gens.length) return null;
  gens.sort((a, b) => ((generalOf(state, b.id) || {})[key] || 0) - ((generalOf(state, a.id) || {})[key] || 0));
  return generalOf(state, gens[0].id);
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
  if (from.troops < 1000) return { ok: false, why: '병력이 부족합니다(1000 이상).' };
  if (!generalsInCity(state, fromCityId).length) return { ok: false, why: '출진할 장수가 없습니다.' };
  return { ok: true };
}

export function battleSetup(state, fromCityId, toCityId) {
  const from = state.cities[fromCityId];
  const to = state.cities[toCityId];
  const atkGens = generalsInCity(state, fromCityId);
  const defGens = generalsInCity(state, toCityId);
  return {
    fromCityId, toCityId,
    attackerFaction: from.owner,
    defenderFaction: to.owner,
    atkGenerals: atkGens.map((g) => g.id),
    defGenerals: defGens.map((g) => g.id),
    atkTroops: from.troops,
    defTroops: to.troops,
    defBonus: to.def,
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
  const atkPower = cityPower(state, from, false);
  const defPower = cityPower(state, to, true);
  const roll = atkPower * (0.85 + rng() * 0.4) - defPower * (0.85 + rng() * 0.3);
  const fromC = state.cities[from];
  const toC = state.cities[to];
  const atkFid = fromC.owner;
  const defFid = toC.owner;
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
  }
  if (fid === state.playerId && !f.alive) {
    state.gameOver = { type: 'defeat', text: `${f.name} 세력이 멸망했습니다.` };
  }
}

export function endTurnPhase2(state) {
  // 월 수입·소비
  for (const c of Object.values(state.cities)) {
    if (!c.owner) continue;
    const gold = Math.round(c.comm * 5 + c.order * 0.8);
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
  state.maxActionPoints = calcActionPoints(state, state.playerId);
  state.actionPoints = state.maxActionPoints;

  checkVictory(state);
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
  // 3 = 신군주 이전 양식, 4 = 포로 처분 이전 양식, 5 = 대화·이동 이전 양식. 열어서 새 양식으로 옮긴다.
  if (!s || ![3, 4, 5, SAVE_VERSION].includes(s.version)) throw new Error('저장 파일 형식이 다릅니다.');
  s.version = SAVE_VERSION;
  s.customGenerals = s.customGenerals || {};
  s.pendingBattles = s.pendingBattles || [];
  s.pendingPrisoners = s.pendingPrisoners || [];
  s.talked = s.talked || {};
  s.log = s.log || [];
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
