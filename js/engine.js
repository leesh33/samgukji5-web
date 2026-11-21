/* 도트삼국 — 게임 엔진 (DOM 비의존, node 테스트 가능) */
import { CITIES, CITY_BY_ID, GENERALS, GENERAL_BY_ID, SCENARIOS, FORMATIONS, FACTION_COLORS, ARMS } from './data.js';

export const SAVE_VERSION = 3;
export const MAX_ARMY = 5;
export const MAX_OFFICERS_PER_CITY = 12;

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
export function createGame(scenarioId, factionId, seed = Date.now() % 100000) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId);
  if (!sc) throw new Error('unknown scenario: ' + scenarioId);
  const fac = sc.factions.find((f) => f.id === factionId);
  if (!fac) throw new Error('unknown faction: ' + factionId);

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
    log: [],
    pendingBattles: [],
    gameOver: null,
    stats: { battles: 0, wins: 0, duels: 0, duelWins: 0, captured: 0, recruited: 0 },
  };

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

  for (const g of GENERALS) {
    state.generals[g.id] = { id: g.id, faction: null, city: null, loyalty: 0, acted: false, captive: false, hidden: false };
  }

  for (const f of sc.factions) {
    state.factions[f.id] = {
      id: f.id,
      name: f.name,
      hanja: f.hanja,
      lord: f.lord,
      color: FACTION_COLORS[f.id] || '#888',
      fame: 45,
      alive: true,
      isPlayer: f.id === factionId,
      gold: 0,
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
  // 어디에도 속하지 않은 장수는 재야로 낙양에
  for (const g of Object.values(state.generals)) {
    if (!g.faction && !g.city) { g.city = 'luoyang'; }
  }

  state.maxActionPoints = calcActionPoints(state, factionId);
  state.actionPoints = state.maxActionPoints;
  log(state, `${sc.year}년 ${sc.name} — ${fac.name}${fac.hanja} 세력으로 천하에 나서다.`);
  return state;
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
  return Object.values(state.generals).filter((g) => g.city === cityId && g.faction && !g.captive);
}
export function freeGeneralsInCity(state, cityId) {
  return Object.values(state.generals).filter((g) => g.city === cityId && !g.faction && !g.captive);
}
export function factionGenerals(state, fid) {
  return Object.values(state.generals).filter((g) => g.faction === fid && !g.captive);
}
export function factionCities(state, fid) {
  return Object.values(state.cities).filter((c) => c.owner === fid);
}
export function neighbors(cityId) { return CITY_BY_ID[cityId].roads; }
export function isAdjacent(a, b) { return CITY_BY_ID[a].roads.includes(b); }

export function lordOf(state, fid) {
  const f = state.factions[fid];
  if (!f || !f.lord) return null;
  return GENERAL_BY_ID[f.lord];
}
export function factionStrength(state, fid) {
  const cs = factionCities(state, fid);
  return cs.reduce((s, c) => s + c.troops, 0) + cs.length * 800;
}
export function cityPower(state, cityId, defensive = true) {
  const c = state.cities[cityId];
  const gens = generalsInCity(state, cityId);
  const best = gens.reduce((m, g) => Math.max(m, (GENERAL_BY_ID[g.id].lead + GENERAL_BY_ID[g.id].war) / 2), 40);
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
  gens.sort((a, b) => (GENERAL_BY_ID[b.id][key] || 0) - (GENERAL_BY_ID[a.id][key] || 0));
  return GENERAL_BY_ID[gens[0].id];
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
  const t = GENERAL_BY_ID[opts.officerId];
  const rng = rngOf(state);
  let msg = '';
  let gain = 0;

  switch (type) {
    case 'agri': {
      gain = 2 + Math.floor(t.pol / 26) + randInt(rng, 0, 2);
      if (t.skill === 'indeok') gain += 1;
      c.agri = clamp(c.agri + gain, 0, 100);
      msg = `${t.ko}이(가) ${cityName(c.id)}의 농업을 ${gain} 올렸습니다. (농업 ${c.agri})`;
      break;
    }
    case 'comm': {
      gain = 2 + Math.floor(t.pol / 26) + randInt(rng, 0, 2);
      c.comm = clamp(c.comm + gain, 0, 100);
      msg = `${t.ko}이(가) ${cityName(c.id)}의 상업을 ${gain} 올렸습니다. (상업 ${c.comm})`;
      break;
    }
    case 'order': {
      gain = 3 + Math.floor(t.pol / 22) + randInt(rng, 0, 2);
      c.order = clamp(c.order + gain, 0, 100);
      c.def = clamp(c.def + 1, 20, 99);
      msg = `${t.ko}이(가) 치안을 ${gain} 올렸습니다. (치안 ${c.order})`;
      break;
    }
    case 'water': {
      gain = 3 + Math.floor(t.int / 22) + randInt(rng, 0, 2);
      c.water = clamp(c.water + gain, 0, 100);
      msg = `${t.ko}이(가) 수리 시설을 정비했습니다. (수리 ${c.water})`;
      break;
    }
    case 'draft': {
      const add = 900 + Math.floor(t.lead * 4);
      c.gold -= 250; c.food -= 400;
      c.troops += add; c.order = clamp(c.order - 3, 0, 100); c.train = clamp(c.train - 6, 10, 100);
      msg = `${t.ko}이(가) 병사 ${add.toLocaleString()}명을 모았습니다. (병력 ${c.troops.toLocaleString()})`;
      break;
    }
    case 'train': {
      gain = 4 + Math.floor(t.lead / 18);
      c.train = clamp(c.train + gain, 0, 100);
      msg = `${t.ko}이(가) 부대를 훈련했습니다. (훈련 ${c.train})`;
      break;
    }
    case 'search': {
      const r = rng();
      if (r < 0.35) {
        const free = freeGeneralsInCity(state, c.id);
        if (free.length) msg = `${t.ko}의 탐색으로 ${cityName(c.id)}에서 인재를 찾았습니다: ${GENERAL_BY_ID[free[0].id].ko}`;
        else { c.gold += 200; msg = `${t.ko}이(가) 숨은 재물 200금을 찾았습니다.`; }
      } else if (r < 0.7) {
        const f = 400 + randInt(rng, 0, 400);
        c.food += f; msg = `${t.ko}이(가) 곡물 ${f}를 확보했습니다.`;
      } else if (r < 0.9) {
        const gg = 150 + randInt(rng, 0, 200);
        c.gold += gg; msg = `${t.ko}이(가) 금 ${gg}을 얻었습니다.`;
      } else {
        msg = `탐색했지만 아무것도 얻지 못했습니다.`;
      }
      break;
    }
    case 'hire': {
      const free = freeGeneralsInCity(state, c.id);
      let target = opts.hireId ? state.generals[opts.hireId] : free[0];
      if (!target || target.faction || target.city !== c.id) return { ok: false, msg: '등용할 수 없는 대상입니다.' };
      const tg = GENERAL_BY_ID[target.id];
      const f = state.factions[state.playerId];
      const chance = clamp(0.34 + t.cha / 320 + f.fame / 320 - tg.war / 900 - tg.int / 900, 0.12, 0.92);
      if (rng() < chance) {
        target.faction = state.playerId;
        target.loyalty = 62 + Math.floor(t.cha / 8);
        state.stats.recruited++;
        f.fame = clamp(f.fame + 2, 0, 100);
        gain = 1;
        msg = `${tg.ko}이(가) ${t.ko}의 설득에 응해 부하가 되었습니다! (충성 ${target.loyalty})`;
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
      msg = `${GENERAL_BY_ID[target.id].ko}의 충성도가 ${inc} 올랐습니다. (충성 ${target.loyalty})`;
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
    gens.sort((a, b) => GENERAL_BY_ID[b.id].pol - GENERAL_BY_ID[a.id].pol);
    const g = gens[0];
    const t = GENERAL_BY_ID[g.id];
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
      const t = GENERAL_BY_ID[gens[0].id];
      const tg = GENERAL_BY_ID[free[0].id];
      if (rng() < clamp(0.2 + t.cha / 400, 0.05, 0.6)) {
        const g = state.generals[free[0].id];
        g.faction = fid; g.loyalty = 70;
        log(state, `${f.name}군이 ${c.ko}에서 ${tg.ko}을(를) 등용했습니다.`);
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
    log(state, `${state.factions[atkFid] ? state.factions[atkFid].name : '?'}군이 ${cityName(to)}을(를) 함락했습니다.`);
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
  const defGens = Object.values(state.generals).filter((g) => g.city === cityId && g.faction === defFid);
  const refuge = defFid ? factionCities(state, defFid).filter((c) => c.id !== cityId) : [];
  for (const g of defGens) {
    const r = rng();
    if (r < 0.18 && atkFid !== state.playerId) {
      // AI가 포로를 거두지 않음 → 재야로
      g.faction = null; g.city = cityId; g.loyalty = 0;
    } else if (r < 0.3 && atkFid === state.playerId) {
      g.faction = state.playerId; g.loyalty = 45; g.city = cityId;
      state.stats.captured++;
      log(state, `${GENERAL_BY_ID[g.id].ko}이(가) 포로가 되어 항복했습니다.`);
    } else if (refuge.length) {
      g.city = refuge[Math.floor(rng() * refuge.length)].id;
    } else {
      g.faction = null; g.city = cityId; g.loyalty = 0;
    }
  }
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
    if (!g.faction || g.captive) continue;
    if (g.faction === state.playerId) continue;
    if (g.loyalty < 40 && rng() < 0.05) {
      g.faction = null; g.loyalty = 0;
    }
  }

  // 턴 증가
  state.turn++;
  state.month++;
  if (state.month > 12) { state.month = 1; state.year++; }
  for (const g of Object.values(state.generals)) g.acted = false;
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
export function applyBattleResult(state, result) {
  // result: {fromCityId, toCityId, winner: 'attacker'|'defender', atkLoss, defLoss, capturedGenerals:[], duelResult}
  const from = state.cities[result.fromCityId];
  const to = state.cities[result.toCityId];
  const atkFid = from.owner;
  const defFid = to.owner;
  from.troops = Math.max(300, from.troops - (result.atkLoss || 0));
  to.troops = Math.max(200, to.troops - (result.defLoss || 0));
  state.stats.battles++;
  if (result.winner === 'attacker') {
    state.stats.wins++;
    to.owner = atkFid;
    to.troops = Math.max(500, Math.round(result.atkSurvivors || from.troops * 0.6));
    to.order = clamp(to.order - 12, 10, 100);
    to.def = clamp(to.def - 8, 20, 99);
    moveGeneralsOnCapture(state, to.id, defFid, atkFid, rngOf(state));
    bumpFame(state, atkFid, 6);
    bumpFame(state, defFid, -4);
    log(state, `${state.factions[atkFid].name}군이 ${cityName(to.id)}을(를) 함락시켰습니다!`);
    for (const gid of result.capturedGenerals || []) {
      const g = state.generals[gid];
      if (!g) continue;
      if (atkFid === state.playerId) {
        g.faction = state.playerId; g.city = to.id; g.loyalty = 50;
        state.stats.captured++;
        log(state, `${GENERAL_BY_ID[gid].ko}을(를) 사로잡아 부하로 삼았습니다.`);
      } else {
        g.faction = null; g.city = to.id; g.loyalty = 0;
      }
    }
  } else {
    bumpFame(state, defFid, 4);
    if (atkFid === state.playerId) bumpFame(state, atkFid, -2);
    log(state, `${cityName(to.id)} 수비군이 공격을 물리쳤습니다.`);
  }
  checkFactionDeath(state, defFid);
  checkFactionDeath(state, atkFid);
  checkVictory(state);
  return result;
}

/* ---------- 저장/불러오기 ---------- */
export function serialize(state) {
  const copy = { ...state };
  delete copy.__rng;
  return JSON.stringify(copy);
}
export function deserialize(json) {
  const s = JSON.parse(json);
  if (!s || s.version !== SAVE_VERSION) throw new Error('저장 파일 형식이 다릅니다.');
  // 누락 필드 보정
  s.pendingBattles = s.pendingBattles || [];
  s.log = s.log || [];
  s.stats = s.stats || { battles: 0, wins: 0, duels: 0, duelWins: 0, captured: 0, recruited: 0 };
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
export function formationOptions(gid) {
  const g = GENERAL_BY_ID[gid];
  return formationOf(g).map((fid) => FORMATIONS[fid]).filter(Boolean);
}
export { CITIES, CITY_BY_ID, GENERALS, GENERAL_BY_ID, SCENARIOS, FORMATIONS, FACTION_COLORS, ARMS };
