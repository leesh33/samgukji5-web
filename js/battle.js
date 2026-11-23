/* 전술 전투 — 격자 전장 · 진형 · 방향 · 계략 (순수 로직, DOM 비의존) */
import { GENERAL_BY_ID, FORMATIONS, CITIES, CITY_BY_ID, formationRelation } from './data.js';
import { mulberry32, randInt, clamp } from './engine.js';

/* ---------- 방향(정면·측면·배후) ---------- */
export const DIRS = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };
export const DIR_ANGLE = { E: 0, S: 90, W: 180, N: 270 };
export const OPPOSITE_DIR = { E: 'W', W: 'E', N: 'S', S: 'N' };
/* 정면 < 측면 < 배후 */
export const SIDE_MULT = { front: 1.0, flank: 1.25, rear: 1.5 };
export const SIDE_KO = { front: '정면', flank: '측면', rear: '배후' };
/* 진형 상성 배율 */
export const FORM_MULT = { advantage: 1.25, disadvantage: 0.85, neutral: 1.0 };
export const FORM_KO = { advantage: '진형 유리!', disadvantage: '진형 불리', neutral: '' };

/* ---------- 병종 상성 (기병 > 궁병 > 보병 > 기병 · 수군은 중립) ---------- */
export const ARM_BEATS = { 기병: '궁병', 궁병: '보병', 보병: '기병' };
export const ARM_MULT = { advantage: 1.2, disadvantage: 0.85, neutral: 1.0 };
export const ARM_REL_KO = { advantage: '상성 우위', disadvantage: '상성 열세', neutral: '' };
export const ARM_GUARD = 0.85;   // 보병 전열 방어 · 수군 물길 방어 — 받는 피해 -15%
export const ARM_WATER = 0.15;   // 수군이 물길에서 공격할 때 피해 +15%
export const ARM_TRAIT = {
  기병: '기동 +1',
  궁병: '사거리 2',
  보병: '받는 피해 -15%',
  수군: '물길 +15%',
};
export const ARM_CYCLE_KO = '기병 > 궁병 > 보병 > 기병';
export const ARM_WEAK_KO = { 기병: '보병', 궁병: '기병', 보병: '궁병', 수군: '' };   // 이 병종에게 약하다

/* a → b 로 향하는 주된 방향 (격자 기준) */
export function dirBetween(a, b) {
  const dx = (b.x || 0) - (a.x || 0);
  const dy = (b.y || 0) - (a.y || 0);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'E' : 'W';
  return dy >= 0 ? 'S' : 'N';
}

/* 피격자(t)가 바라보는 방향 기준으로 공격자(u)가 서 있는 쪽 */
export function attackSide(u, t) {
  const ang = DIR_ANGLE[t.dir] ?? 0;
  const bearing = ((Math.atan2((u.y || 0) - t.y, (u.x || 0) - t.x) * 180) / Math.PI + 360) % 360;
  const diff = Math.abs(((bearing - ang + 540) % 360) - 180);
  if (diff <= 45) return 'front';
  if (diff <= 135) return 'flank';
  return 'rear';
}

/* 공격 한 번의 배율과 표시 문구 */
export function attackEdge(u, t) {
  const side = attackSide(u, t);
  const relation = formationRelation(u.formation, t.formation);
  return {
    side,
    relation,
    sideMult: SIDE_MULT[side],
    formMult: FORM_MULT[relation],
    mult: SIDE_MULT[side] * FORM_MULT[relation],
    tags: [
      side === 'flank' ? '[측면 공격!]' : side === 'rear' ? '[배후 기습!]' : '',
      relation === 'advantage' ? '[진형 유리!]' : relation === 'disadvantage' ? '[진형 불리]' : '',
    ].filter(Boolean),
  };
}

export const BW = 11;
export const BH = 8;

export const TERRAIN = {
  plain: { ko: '평지', cost: 1, def: 1.0, color: '#3a4a33' },
  road: { ko: '도로', cost: 1, def: 0.95, color: '#5a4a33' },
  forest: { ko: '숲', cost: 2, def: 1.15, color: '#25401f' },
  hill: { ko: '산', cost: 3, def: 1.3, color: '#4a4030' },
  water: { ko: '강', cost: 99, def: 1.0, color: '#1d3550' },
  castle: { ko: '성', cost: 1, def: 1.5, color: '#5c5340' },
};

export const TACTICS = {
  fire: { ko: '화계', stat: 'int', desc: '불을 질러 병력과 사기를 태운다.' },
  confuse: { ko: '혼란', stat: 'int', desc: '적 부대를 혼란시켜 한 턴 움직이지 못하게 하고 방어를 흔든다.' },
  rally: { ko: '고무', stat: 'cha', desc: '아군 부대의 사기를 크게 올린다(+15~20).' },
  heal: { ko: '치료', stat: 'int', desc: '아군 부대의 병력을 회복한다.' },
  flood: { ko: '수계', stat: 'int', desc: '강물을 끌어들여 적을 쓸어버린다. 물에 닿은 적에게만 쓴다.' },
  rock: { ko: '낙석', stat: 'int', desc: '산에서 돌을 굴려 적을 깔아뭉갠다. 산에 닿은 적에게만 쓴다.' },
};

/* 지형을 타는 계략 — 수계는 물, 낙석은 산이 대상 부대 근처에 있어야 한다 */
export const TACTIC_TERRAIN = { flood: 'water', rock: 'hill' };
export const TACTIC_RANGE = 3;
/* 계략마다의 기본 성공률 — 지력으로 보정한다 */
export function tacticRate(b, u, kind) {
  const g = unitSpec(u);
  const tc = TACTICS[kind];
  if (!tc) return 0;
  let rate = 0.35 + g.int / 260;
  if (g.skill === 'sinsan') rate += 0.3;
  if (kind === 'rally') rate += g.cha / 400;
  if (kind === 'heal') rate += g.cha / 500;
  if (kind === 'flood' || kind === 'rock') rate -= 0.12; // 큰 피해를 주는 만큼 어렵다
  return clamp(rate, 0.12, 0.95);
}
/* 대상 부대가 계략 지형에 닿아 있는가 — 발밑과 상하좌우를 본다 */
export function terrainOpenFor(b, t, kind) {
  const want = TACTIC_TERRAIN[kind];
  if (!want) return true;
  if (!t) return false;
  const spots = [[t.x, t.y], [t.x + 1, t.y], [t.x - 1, t.y], [t.x, t.y + 1], [t.x, t.y - 1]];
  for (const [x, y] of spots) {
    const tile = tileAt(b, x, y);
    if (tile && tile.t === want) return true;
  }
  return false;
}
/* 이 부대가 지금 쓸 수 있는 계략 목록 — 성공률까지 */
export function tacticOptions(b, u, target = null) {
  if (!u || !u.alive) return [];
  return Object.keys(TACTICS).map((kind) => {
    const ally = kind === 'rally' || kind === 'heal';
    const t = target && (ally ? target.side === u.side : target.side !== u.side) ? target : null;
    let why = '';
    if (TACTIC_TERRAIN[kind] && t && !terrainOpenFor(b, t, kind)) {
      why = TACTIC_TERRAIN[kind] === 'water' ? '물에 닿은 적에게만' : '산에 닿은 적에게만';
    }
    return { kind, ko: TACTICS[kind].ko, desc: TACTICS[kind].desc, rate: tacticRate(b, u, kind), ally, terrain: TACTIC_TERRAIN[kind] || null, blocked: why };
  });
}

const WATER_CITIES = new Set(['jianye', 'wu', 'kuaiji', 'yuzhang', 'jiangxia', 'jiangling', 'shouchun', 'lujiang', 'guangling', 'changsha', 'nanhai', 'jiaozhi', 'jiangzhou', 'xiangyang']);

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function createBattle(opts) {
  const {
    fromCityId, toCityId, attackerFaction, defenderFaction,
    atkGenerals = [], defGenerals = [], atkTroops = 5000, defTroops = 5000,
    defBonus = 40, seed = 1, playerSide = null, generals = null,
    troopCaps = null, rankBonus = null, troopsByGeneral = null, march = null,
  } = opts;
  const GD = generals || GENERAL_BY_ID;
  const rng = mulberry32(hashStr(fromCityId + toCityId) + seed);
  const battle = {
    w: BW, h: BH,
    fromCityId, toCityId, attackerFaction, defenderFaction,
    grid: [], units: [], phase: 'atk', round: 1, log: [], over: null,
    playerSide, seed, defBonus,
    initial: { atk: atkTroops, def: defTroops },
    // 부대 편성으로 나선 병력과 그 합계 — 전투 뒤 성으로 돌려보낼 때 쓴다
    troopsByGeneral: troopsByGeneral || null,
    march: march || null,
    terrainName: CITY_BY_ID[toCityId] ? CITY_BY_ID[toCityId].ko : '',
    // R2에 합류할 원군 — 엔진이 미리 뽑아 둔다
    reinforcements: opts.reinforcements ? { atk: [...(opts.reinforcements.atk || [])], def: [...(opts.reinforcements.def || [])] } : { atk: [], def: [] },
  };

  // 지형 생성
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) battle.grid.push({ x, y, t: 'plain' });
  }
  const at = (x, y) => battle.grid[y * BW + x];
  for (let i = 0; i < 3; i++) {
    const x = randInt(rng, 0, BW - 1), y = randInt(rng, 0, BH - 1);
    at(x, y).t = 'road';
  }
  for (let i = 0; i < 9; i++) {
    const x = randInt(rng, 1, BW - 3), y = randInt(rng, 0, BH - 1);
    at(x, y).t = 'forest';
  }
  for (let i = 0; i < 6; i++) {
    const x = randInt(rng, 1, BW - 3), y = randInt(rng, 0, BH - 1);
    at(x, y).t = 'hill';
  }
  if (WATER_CITIES.has(toCityId) || WATER_CITIES.has(fromCityId)) {
    const riverX = randInt(rng, 5, 7);
    for (let y = 0; y < BH; y++) {
      if (rng() < 0.75) at(clamp(riverX + randInt(rng, -1, 1), 0, BW - 1), y).t = 'water';
    }
  }
  // 성곽 (수비 진영)
  for (let y = BH - 3; y <= BH - 2; y++) {
    for (let x = BW - 2; x <= BW - 1; x++) at(x, y).t = 'castle';
  }

  // 부대 편성
  const mkUnits = (gids, side, troops) => {
    const gens = gids.slice(0, 5);
    if (!gens.length) return;
    const n = gens.length;
    const base = Math.floor(troops / n);
    gens.forEach((gid, i) => {
      const g = GD[gid] || GENERAL_BY_ID[gid];
      if (!g) return;
      const isCastleDef = side === 'def';
      const x = side === 'atk' ? 1 + (i % 2) : BW - 2 - (i % 2);
      const y = isCastleDef ? clamp(Math.floor(BH / 2) - 2 + i, 0, BH - 1) : clamp(Math.floor(BH / 2) - 2 + i, 0, BH - 1);
      const own = (g.formations && g.formations) || ['eorin'];
      const asked = opts.formations && opts.formations[gid];
      const formId = (asked && own.includes(asked) ? asked : own[0]) || 'eorin';
      // 장군 직위의 지휘 상한을 넘기지 않는다
      const cap = troopCaps && troopCaps[gid] ? troopCaps[gid] : Infinity;
      // 부대 편성으로 정해진 병력이 있으면 그대로 쓴다
      const planned = side === 'atk' && battle.troopsByGeneral && battle.troopsByGeneral[gid] != null
        ? battle.troopsByGeneral[gid] : null;
      const troops = planned != null
        ? Math.min(cap, Math.max(1, Math.round(planned)))
        : Math.min(cap, Math.max(400, Math.round(base * (gid === gids[0] ? 1.1 : 1))));
      battle.units.push({
        id: `${side}-${gid}`,
        side, gid, name: g.ko,
        rankBonus: (rankBonus && rankBonus[gid]) || 0,
        spec: { id: g.id, ko: g.ko, lead: g.lead, war: g.war, int: g.int, pol: g.pol, cha: g.cha, arms: g.arms, skill: g.skill, formations: g.formations || ['eorin'] },
        troops,
        morale: clamp(58 + Math.round(g.lead / 4) + (isCastleDef ? 6 : 0), 40, 100),
        formation: formId,
        x: clamp(x, 0, BW - 1), y,
        // 아군은 적 쪽을, 적은 아군 쪽을 바라보고 전장에 선다
        dir: side === 'atk' ? 'E' : 'W',
        acted: false, moved: false, alive: true, confused: 0, defDown: 0,
      });
    });
  };
  mkUnits(atkGenerals, 'atk', atkTroops);
  mkUnits(defGenerals, 'def', defTroops);
  // 타일 중복 회피
  const used = new Set();
  for (const u of battle.units) {
    while (used.has(`${u.x},${u.y}`)) u.y = (u.y + 1) % BH;
    used.add(`${u.x},${u.y}`);
  }

  battle.log.push(`${battle.terrainName} 전장 — ${sideName(battle, 'atk')}군의 공격이 시작되었다.`);
  return battle;
}

/* ---------- 원군 ---------- */
const SIDE_KO_LONG = { atk: '공격측', def: '수비측' };

/* 원군 한 부대를 전장 가장자리에 세운다 */
export function addReinforcement(b, side, r) {
  const spec = r.spec || GENERAL_BY_ID[r.gid];
  if (!spec || !(r.troops > 0)) return null;
  const edge = side === 'atk' ? 0 : b.w - 1;
  let pos = null;
  for (let dx = 0; dx < 3 && !pos; dx++) {
    const x = side === 'atk' ? Math.min(b.w - 1, edge + dx) : Math.max(0, edge - dx);
    for (let y = 0; y < b.h; y++) {
      if (!b.units.some((o) => o.alive && o.x === x && o.y === y)) { pos = { x, y }; break; }
    }
  }
  if (!pos) return null;
  const unit = {
    id: `${side}-${r.gid}-re`,
    side, gid: r.gid, name: spec.ko,
    spec: { id: spec.id || r.gid, ko: spec.ko, lead: spec.lead, war: spec.war, int: spec.int, pol: spec.pol, cha: spec.cha, arms: spec.arms, skill: spec.skill, formations: spec.formations || ['eorin'] },
    rankBonus: r.rankBonus || 0,
    troops: Math.max(300, Math.round(r.troops)),
    morale: clamp(62 + Math.round((spec.lead || 50) / 5), 45, 100),
    formation: (spec.formations && spec.formations[0]) || 'eorin',
    x: pos.x, y: pos.y,
    dir: side === 'atk' ? 'E' : 'W',
    acted: false, moved: false, alive: true, confused: 0, defDown: 0, reinforcement: true,
  };
  b.units.push(unit);
  b.initial[side] += unit.troops;
  return unit;
}

/* 라운드가 바뀔 때 예약된 원군이 도착한다 */
export function arriveReinforcements(b) {
  const plan = b.reinforcements;
  if (!plan) return [];
  const out = [];
  for (const side of ['atk', 'def']) {
    const list = plan[side] || [];
    if (!list.length) continue;
    const names = [];
    for (const r of list) {
      const u = addReinforcement(b, side, r);
      if (u) { out.push(u); names.push(`${u.name} ${u.troops.toLocaleString()}`); }
    }
    plan[side] = [];
    if (names.length) b.log.push(`[원군 도착!] ${SIDE_KO_LONG[side]} 가장자리에 원군 ${names.join(', ')} 부대가 합류했습니다!`);
  }
  return out;
}

export const sideName = (b, side) => (side === 'atk' ? '공격' : '수비');
export const tileAt = (b, x, y) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? null : b.grid[y * b.w + x]);
export const unitsOf = (b, side) => b.units.filter((u) => u.side === side && u.alive);
export const unitSpec = (u) => u.spec || GENERAL_BY_ID[u.gid];
export const formOf = (u) => FORMATIONS[u.formation] || FORMATIONS.eorin;

export function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

/* 부대의 병종 — 부대 편성에서 바꾼 병종이 그대로 넘어온다 */
export function armOf(u) {
  const g = unitSpec(u);
  return (g && g.arms) || '보병';
}

/* 병종 상성 — 공격 병종이 수비 병종에 유리 / 불리 / 무상성 */
export function armRelation(atkArm, defArm) {
  if (!atkArm || !defArm || atkArm === defArm) return 'neutral';
  if (ARM_BEATS[atkArm] === defArm) return 'advantage';
  if (ARM_BEATS[defArm] === atkArm) return 'disadvantage';
  return 'neutral';
}

const isWaterTile = (b, x, y) => {
  const t = tileAt(b, x, y);
  return !!t && t.t === 'water';
};

/* 병종 상성 한 번의 배율 — 상성 배율 · 수군 물길 공격 보정 · 받는 피해 경감 */
export function armEdge(b, u, t) {
  const atkArm = armOf(u);
  const defArm = armOf(t);
  const relation = armRelation(atkArm, defArm);
  const waterAtk = atkArm === '수군' && isWaterTile(b, u.x, u.y);
  const waterDef = defArm === '수군' && isWaterTile(b, t.x, t.y);
  let mult = ARM_MULT[relation];
  if (waterAtk) mult *= 1 + ARM_WATER;
  let guard = 1;
  if (defArm === '보병') guard *= ARM_GUARD;   // 전열 방어
  if (waterDef) guard *= ARM_GUARD;            // 물 위의 수군
  return {
    relation, atkArm, defArm, mult, guard, waterAtk, waterDef,
    tags: [relation === 'advantage' ? '[상성 우위]' : relation === 'disadvantage' ? '[상성 열세]' : ''].filter(Boolean),
  };
}

/* 병종별 특징을 한 줄로 — 안내 문구 */
export function armTraitText(arm) {
  if (arm === '수군') return '기본 상성 중립 · 물길에서 공격·방어 +15%';
  const beats = ARM_BEATS[arm];
  const weak = ARM_WEAK_KO[arm];
  return `${beats}에 강함 · ${weak}에 약함 · ${ARM_TRAIT[arm] || ''}`.trim();
}

export function movePoints(u) {
  const g = unitSpec(u);
  const f = formOf(u);
  let mp = Math.round(3 * f.move);
  if (g.skill === 'dolgyeok') mp += 1;
  if (armOf(u) === '기병') mp += 1;            // 기병 기동력
  return clamp(mp, 2, 6);
}

export function isWater(u) {
  const g = unitSpec(u);
  return g.arms === '수군' || u.formation === 'sujin';
}

export function reachable(b, u) {
  const mp = movePoints(u);
  const best = new Map();
  const key = (x, y) => y * b.w + x;
  const start = key(u.x, u.y);
  best.set(start, 0);
  const queue = [{ x: u.x, y: u.y, cost: 0 }];
  const waterOk = isWater(u);
  while (queue.length) {
    const cur = queue.shift();
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const t = tileAt(b, nx, ny);
      if (!t) continue;
      const ter = TERRAIN[t.t];
      let cost = ter.cost;
      if (t.t === 'water') {
        if (!waterOk) continue;
        cost = 2;
      }
      const occ = b.units.find((o) => o.alive && o.x === nx && o.y === ny);
      if (occ) continue;
      const nc = cur.cost + cost;
      if (nc > mp) continue;
      const k = key(nx, ny);
      if (best.has(k) && best.get(k) <= nc) continue;
      best.set(k, nc);
      queue.push({ x: nx, y: ny, cost: nc });
    }
  }
  best.delete(start);
  return best;
}

export function moveUnit(b, u, x, y) {
  if (u.acted || !u.alive) return { ok: false, msg: '이미 행동을 마쳤습니다.' };
  if (u.confused > 0) return { ok: false, msg: '혼란에 빠져 움직이지 못합니다.' };
  const reach = reachable(b, u);
  const k = y * b.w + x;
  if (!reach.has(k)) return { ok: false, msg: '이동할 수 없는 타일입니다.' };
  const moved = (x !== u.x || y !== u.y);
  if (moved) u.dir = dirBetween(u, { x, y });
  u.x = x; u.y = y; u.moved = true;
  return { ok: true, dir: u.dir };
}

export function attackRange(u) {
  const f = formOf(u);
  const base = f.range;
  // 궁병은 진형과 무관하게 2칸 원거리 사격이 가능하다
  return armOf(u) === '궁병' ? Math.max(2, base) : base;
}

export function canAttack(b, u, t) {
  if (!u.alive || !t.alive || u.side === t.side) return false;
  return dist(u, t) <= attackRange(u);
}

export function targetsFor(b, u) {
  return b.units.filter((t) => t.alive && t.side !== u.side && canAttack(b, u, t));
}

export function attack(b, u, t, rngSeed = 1) {
  if (u.acted) return { ok: false, msg: '이미 행동했습니다.' };
  if (u.confused > 0) return { ok: false, msg: '혼란에 빠져 공격하지 못합니다.' };
  if (!canAttack(b, u, t)) return { ok: false, msg: '사정거리 밖입니다.' };
  const rng = mulberry32(rngSeed + b.round * 31 + u.troops);
  const res = resolveAttack(b, u, t, rng);
  u.acted = true; u.moved = true;
  return { ok: true, ...res };
}

export function resolveAttack(b, u, t, rng) {
  // 공격자는 대상을 향해 돌아선다(피격자의 방향은 그대로 — 등 뒤를 노리는 맛)
  u.dir = dirBetween(u, t);
  const f = hitFactors(b, u, t);
  const edge = f.edge;
  const ga = unitSpec(u);
  let dmg = Math.round((f.atk / f.def) * (0.85 + rng() * 0.3) * f.guard);
  dmg = Math.max(30, dmg);
  t.troops -= dmg;
  let moraleLoss = 4 + Math.round(dmg / Math.max(400, t.troops + dmg) * 30);
  if (edge.side === 'rear') moraleLoss += 3;   // 배후 기습은 사기도 크게 꺾는다
  if (ga.skill === 'wieom') moraleLoss += 2;
  t.morale = clamp(t.morale - moraleLoss, 0, 100);

  const tags = [...edge.tags, ...f.arm.tags];
  const mult = edge.mult * f.arm.mult;
  const tag = tags.length ? ' ' + tags.join(' ') : '';
  const multKo = mult !== 1 ? ` (×${mult.toFixed(2)})` : '';
  const lines = [`${u.name}의 공격!${tag} ${t.name}에게 ${dmg.toLocaleString()} 피해.${multKo}`];
  // 반격(근접, 생존 시) — 반격에도 방향·진형·병종 상성이 걸린다. 원거리 사격에는 반격이 없다.
  if (t.troops > 0 && t.morale > 0 && dist(u, t) === 1) {
    const c = counterFactors(b, u, t);
    const cDmg = Math.max(20, Math.round((c.atk / c.def) * (0.8 + rng() * 0.3) * 0.6 * c.guard));
    u.troops -= cDmg;
    u.morale = clamp(u.morale - 2, 0, 100);
    const cTags = [...c.edge.tags, ...c.arm.tags];
    lines.push(`${t.name}의 반격${cTags.length ? ' ' + cTags.join(' ') : ''} — ${cDmg.toLocaleString()} 피해.`);
  }
  const dead = [];
  for (const unit of [u, t]) {
    if (unit.troops <= 0 || unit.morale <= 0) {
      unit.alive = false;
      unit.troops = Math.max(0, unit.troops);
      dead.push(unit);
      lines.push(`${unit.name} 부대가 궤멸했습니다!`);
    }
  }
  b.log.push(...lines);
  return {
    damage: dmg, dead: dead.map((d) => d.id), lines,
    side: edge.side, relation: edge.relation, sideMult: edge.sideMult, formMult: edge.formMult,
    mult, arm: f.arm.relation, armMult: f.arm.mult, guard: f.guard,
    atkArm: f.arm.atkArm, defArm: f.arm.defArm, distance: dist(u, t), tags,
  };
}

/* 한 번의 공격에 걸리는 배율 — 미리보기와 실제 피해가 같은 식을 쓴다 */
export function hitFactors(b, u, t) {
  const ga = unitSpec(u), gd = unitSpec(t);
  const fa = formOf(u), fd = formOf(t);
  const ter = TERRAIN[tileAt(b, t.x, t.y).t];
  const edge = attackEdge(u, t);
  const arm = armEdge(b, u, t);
  let atk = u.troops * 0.16 * (1 + ga.war / 140) * fa.atk * (0.65 + u.morale / 160) * (0.9 + ga.lead / 600);
  atk *= 1 + (u.rankBonus || 0);            // 장군 직위 보정 — 공격
  if (ga.skill === 'dolgyeok') atk *= 1.2;
  if (ga.skill === 'jeogyeok' && attackRange(u) > 1) atk *= 1.25;
  if (ga.skill === 'sujeon' && tileAt(b, t.x, t.y).t === 'water') atk *= 1.25;
  if (ga.skill === 'pokgyeok') atk *= 1.15;
  if (ga.skill === 'yongmaeng') atk *= 1.08;
  if (ga.skill === 'bigyeok') atk *= 1.1;
  atk *= edge.mult;                       // 정면 1.0 · 측면 1.25 · 배후 1.5 × 진형 상성
  atk *= arm.mult;                        // 병종 상성 × 수군 물길 보정
  let def = (1 + (gd.lead + gd.war) / 420) * fd.def * ter.def * (1 + (t.rankBonus || 0));
  if (gd.skill === 'cheolbyeok') def *= 1.2;
  if (gd.skill === 'gyeonsu') def *= 1.1;
  if (t.defDown > 0) def *= 0.85;   // 혼란·낙석으로 방어진이 흐트러진 상태
  return { atk, def, edge, arm, guard: arm.guard };
}

/* 반격 배율 — t가 u를 친다 */
export function counterFactors(b, u, t) {
  const ga = unitSpec(u), gd = unitSpec(t);
  const fa = formOf(u), fd = formOf(t);
  const edge = attackEdge(t, u);
  const arm = armEdge(b, t, u);
  let atk = t.troops * 0.1 * (1 + gd.war / 160) * fd.atk * (0.55 + t.morale / 180) * (edge.mult > 1 ? 1 + (edge.mult - 1) * 0.5 : edge.mult);
  let def = (1 + (ga.lead + ga.war) / 420) * fa.def * TERRAIN[tileAt(b, u.x, u.y).t].def;
  if (ga.skill === 'cheolbyeok') def *= 1.2;
  atk *= 1 + (t.rankBonus || 0);     // 직위 보정 — 반격
  atk *= arm.mult;                   // 병종 상성 — 반격에도 적용
  def *= 1 + (u.rankBonus || 0);
  return { atk, def, edge, arm, guard: arm.guard };
}

/* 공격 미리보기 — 실제 피해와 같은 식에 난수만 기대값(1.0)으로 넣는다 */
export function previewAttack(b, u, t) {
  if (!u || !t) return null;
  const f = hitFactors(b, u, t);
  const damage = Math.max(30, Math.round((f.atk / f.def) * f.guard));
  let counter = 0;
  if (dist(u, t) === 1 && t.troops - damage > 0 && t.morale > 0) {
    const c = counterFactors(b, u, t);
    counter = Math.max(20, Math.round((c.atk / c.def) * 0.95 * 0.6 * c.guard));
  }
  return {
    damage, counter,
    edge: f.edge, arm: f.arm, guard: f.guard,
    mult: f.edge.mult * f.arm.mult,
    relation: f.edge.relation, armRelation: f.arm.relation,
    distance: dist(u, t), ranged: dist(u, t) > 1,
    tags: [...f.edge.tags, ...f.arm.tags],
  };
}

/* 계략 */
export function tactic(b, u, t, kind, rngSeed = 1) {
  if (u.acted) return { ok: false, msg: '이미 행동했습니다.' };
  if (u.confused > 0) return { ok: false, msg: '혼란에 빠져 계략을 쓸 수 없습니다.' };
  const tc = TACTICS[kind];
  if (!tc) return { ok: false, msg: '없는 계략입니다.' };
  const g = unitSpec(u);
  if (kind === 'rally' || kind === 'heal') {
    if (!t || t.side !== u.side) return { ok: false, msg: '아군 부대를 대상으로 하세요.' };
  } else if (!t || t.side === u.side) {
    return { ok: false, msg: '적 부대를 대상으로 하세요.' };
  }
  if (dist(u, t) > TACTIC_RANGE) return { ok: false, msg: `계략 사거리(${TACTIC_RANGE}) 밖입니다.` };
  if (TACTIC_TERRAIN[kind] && !terrainOpenFor(b, t, kind)) {
    return { ok: false, msg: `${tc.ko}는 ${TACTIC_TERRAIN[kind] === 'water' ? '물' : '산'}에 닿은 적에게만 쓸 수 있습니다.` };
  }
  const rng = mulberry32(rngSeed + b.round * 17 + u.troops + kind.length);
  const rate = tacticRate(b, u, kind);
  const ok = rng() < rate;
  const lines = [];
  const chance = Math.round(rate * 100);
  if (!ok) {
    lines.push(`${u.name}의 ${tc.ko}가 실패했습니다. (성공률 ${chance}%)`);
    u.acted = true; u.moved = true;
    b.log.push(...lines);
    return { ok: true, success: false, chance, lines };
  }
  let dmg = 0;
  if (kind === 'fire') {
    const woody = tileAt(b, t.x, t.y).t === 'forest' ? 1.25 : 1; // 숲에서는 불이 크게 번진다
    dmg = Math.round(t.troops * (0.06 + g.int / 1600) * (g.skill === 'sinsan' ? 1.2 : 1) * woody * (0.8 + rng() * 0.4));
    t.troops -= dmg;
    t.morale = clamp(t.morale - 14, 0, 100);
    lines.push(`${u.name}의 화계! ${t.name} 부대에 불길이 번져 ${dmg.toLocaleString()} 피해, 사기 급락. (성공률 ${chance}%)`);
  } else if (kind === 'confuse') {
    dmg = Math.round(t.troops * 0.03);
    t.troops -= dmg;
    t.morale = clamp(t.morale - 12, 0, 100);
    t.confused = Math.max(t.confused || 0, 1);   // 다음 자기 차례를 거른다
    t.defDown = Math.max(t.defDown || 0, 2);     // 방어가 흐트러진다
    lines.push(`${u.name}의 혼란! ${t.name} 부대가 진형을 잃었습니다. 다음 차례에 움직이지 못하고 방어가 흔들립니다. (성공률 ${chance}%)`);
  } else if (kind === 'rally') {
    const up = 15 + Math.round(rng() * 5);       // +15~20
    t.morale = clamp(t.morale + up, 0, 100);
    t.confused = 0;
    lines.push(`${u.name}의 고무! ${t.name} 부대의 사기가 ${up} 올랐습니다. (사기 ${Math.round(t.morale)})`);
  } else if (kind === 'heal') {
    const heal = Math.round(t.troops * 0.05 + 200);
    t.troops += heal;
    lines.push(`${u.name}의 치료! ${t.name} 부대가 ${heal.toLocaleString()}명을 되찾았습니다.`);
  } else if (kind === 'flood') {
    dmg = Math.round(t.troops * (0.12 + g.int / 1400) * (g.skill === 'sinsan' ? 1.2 : 1) * (0.9 + rng() * 0.3));
    t.troops -= dmg;
    t.morale = clamp(t.morale - 16, 0, 100);
    lines.push(`${u.name}의 수계! 강물이 ${t.name} 부대를 덮쳤습니다. ${dmg.toLocaleString()} 피해, 사기 급락. (성공률 ${chance}%)`);
  } else if (kind === 'rock') {
    dmg = Math.round(t.troops * (0.14 + g.int / 1400) * (0.9 + rng() * 0.3));
    t.troops -= dmg;
    t.morale = clamp(t.morale - 14, 0, 100);
    t.defDown = Math.max(t.defDown || 0, 1);
    lines.push(`${u.name}의 낙석! 산에서 돌이 쏟아져 ${t.name} 부대에 ${dmg.toLocaleString()} 피해. (성공률 ${chance}%)`);
  }
  for (const unit of [u, t]) {
    if (unit.alive && (unit.troops <= 0 || unit.morale <= 0)) {
      unit.alive = false;
      lines.push(`${unit.name} 부대가 궤멸했습니다!`);
    }
  }
  u.acted = true; u.moved = true;
  b.log.push(...lines);
  return { ok: true, success: true, chance, damage: dmg, lines };
}

export function endUnit(u) { u.acted = true; u.moved = true; }

export function sideDone(b, side) {
  return unitsOf(b, side).every((u) => u.acted);
}

/* 한 쪽의 차례를 열어 준다 — 혼란에 빠진 부대는 이번 차례를 거른다 */
function startSide(b, side) {
  for (const u of unitsOf(b, side)) {
    u.acted = false;
    u.moved = false;
    if (u.confused > 0) {
      u.confused -= 1;
      u.acted = true;
      u.moved = true;
      b.log.push(`${u.name} 부대가 혼란에 빠져 움직이지 못했습니다.`);
    }
    if (u.defDown > 0) u.defDown -= 1;
  }
}

export function nextPhase(b) {
  if (b.over) return b;
  if (b.phase === 'atk') {
    if (unitsOf(b, 'atk').length === 0) { b.over = 'def'; return b; }
    b.phase = 'def';
    startSide(b, 'def');
  } else {
    if (unitsOf(b, 'def').length === 0) { b.over = 'atk'; return b; }
    b.phase = 'atk';
    b.round++;
    startSide(b, 'atk');
    // 2라운드부터 예약된 원군이 들어온다
    arriveReinforcements(b);
  }
  checkEnd(b);
  return b;
}

export function checkEnd(b) {
  if (b.over) return b.over;
  if (!unitsOf(b, 'def').length) { b.over = 'atk'; return b.over; }
  if (!unitsOf(b, 'atk').length) { b.over = 'def'; return b.over; }
  if (b.round > 15) { b.over = 'def'; return b.over; }
  return null;
}

/* AI 부대 행동 — 측면·배후·진형 상성과 병종 상성을 노린다 */
export function aiUnitAct(b, u, rng) {
  if (u.acted || !u.alive) return;
  const foes = unitsOf(b, u.side === 'atk' ? 'def' : 'atk');
  if (!foes.length) return;
  const g = unitSpec(u);

  // 한 번 칠 때의 기대값: 약한 부대 · 측면/배후 · 진형 상성 · 병종 상성
  const hitScore = (t, from = u) => {
    const e = attackEdge(from, t);
    const a = armEdge(b, from, t);
    return e.mult * a.mult * a.guard * (9000 / Math.max(600, t.troops));
  };
  const inRange = foes.filter((f) => canAttack(b, u, f));
  if (inRange.length) {
    inRange.sort((a, c) => hitScore(c) - hitScore(a));
    if (g.int > 75 && rng() < 0.28) {
      let kind = g.skill === 'hwagye' ? 'fire' : g.skill === 'hollan' ? 'confuse' : (g.int > 85 ? 'confuse' : 'fire');
      const first = inRange[0];
      if (g.int >= 70 && terrainOpenFor(b, first, 'flood') && rng() < 0.5) kind = 'flood';
      else if (g.int >= 70 && terrainOpenFor(b, first, 'rock') && rng() < 0.45) kind = 'rock';
      const r = tactic(b, u, first, kind, Math.floor(rng() * 9999));
      if (r.ok) return;
    }
    attack(b, u, inRange[0], Math.floor(rng() * 9999));
    return;
  }
  // 접근: 도달 가능 타일 중 '적의 옆·뒤에서 칠 수 있는 곳'을 우선
  const reach = reachable(b, u);
  const range = attackRange(u);
  const nearest = foes.reduce((m, f) => Math.min(m, dist(u, f)), 99);
  const nearFoe = foes.reduce((m, f) => (dist(u, f) < dist(u, m) ? f : m), foes[0]);
  let best = null, bestScore = -Infinity;
  for (const k of reach.keys()) {
    const x = k % b.w, y = Math.floor(k / b.w);
    const d = Math.min(...foes.map((f) => Math.abs(f.x - x) + Math.abs(f.y - y)));
    let score = -d * 10 - reach.get(k) * 0.2 + (d < nearest ? 5 : 0);
    for (const f of foes) {
      const dd = Math.abs(f.x - x) + Math.abs(f.y - y);
      if (dd <= range) {
        const e = attackEdge({ x, y }, f);
        const a = armEdge(b, { ...u, x, y }, f);
        score += 30 + (e.mult - 1) * 80 + (e.relation === 'advantage' ? 12 : e.relation === 'disadvantage' ? -10 : 0);
        score += (a.mult - 1) * 70 + (a.relation === 'advantage' ? 14 : a.relation === 'disadvantage' ? -12 : 0);
        if (dd > 1) score += 8;   // 원거리 사격 — 반격을 받지 않는다
      }
    }
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  if (best) moveUnit(b, u, best.x, best.y);
  const again = foes.filter((f) => canAttack(b, u, f));
  if (again.length) {
    again.sort((a, c) => hitScore(c) - hitScore(a));
    attack(b, u, again[0], Math.floor(rng() * 9999));
    return;
  }
  // 측면·배후 방어: 사기가 낮은 아군을 고무
  if (g.int > 70 && rng() < 0.15) {
    const allies = unitsOf(b, u.side).filter((a) => a.morale < 70);
    if (allies.length) { tactic(b, u, allies[0], 'rally', Math.floor(rng() * 9999)); return; }
  }
  endUnit(u);
}

export function runAiPhase(b, seed = 1) {
  const rng = mulberry32(seed + b.round * 13);
  const side = b.phase;
  for (const u of unitsOf(b, side)) {
    if (b.over) break;
    aiUnitAct(b, u, rng);
  }
  checkEnd(b);
  if (!b.over) nextPhase(b);
  return b;
}

/* 일기토 요청 가능 여부 */
export function duelOptions(b, u) {
  return unitsOf(b, u.side === 'atk' ? 'def' : 'atk').filter((t) => dist(u, t) <= 1);
}

export function battleResult(b) {
  const atkAlive = unitsOf(b, 'atk');
  const defAlive = unitsOf(b, 'def');
  const atkSurvivors = atkAlive.reduce((s, u) => s + u.troops, 0);
  const defSurvivors = defAlive.reduce((s, u) => s + u.troops, 0);
  const winner = b.over === 'atk' ? 'attacker' : 'defender';
  const losingSide = winner === 'attacker' ? 'def' : 'atk';
  // 전장에서 궤멸한 패배측 부대의 장수 — 실제 사로잡힘은 엔진이 판정한다
  const defeatedGenerals = b.units.filter((x) => x.side === losingSide && !x.alive).map((x) => x.gid);
  return {
    fromCityId: b.fromCityId, toCityId: b.toCityId,
    atkGenerals: b.units.filter((x) => x.side === 'atk').map((x) => x.gid),
    defGenerals: b.units.filter((x) => x.side === 'def').map((x) => x.gid),
    winner,
    atkLoss: Math.max(0, b.initial.atk - atkSurvivors),
    defLoss: Math.max(0, b.initial.def - defSurvivors),
    atkSurvivors,
    defSurvivors,
    defeatedGenerals,
    capturedGenerals: [],
    rounds: b.round,
    playerSide: b.playerSide,
    // 부대 편성으로 나선 병력 — 엔진이 생존 병력을 성으로 돌려보낼 때 쓴다
    march: b.march || null,
  };
}

export function autoBattle(opts) {
  const b = createBattle({ ...opts, playerSide: null });
  const rng = mulberry32((opts.seed || 1) + 5);
  let guard = 0;
  while (!b.over && guard++ < 40) {
    runAiPhase(b, Math.floor(rng() * 99999));
  }
  if (!b.over) b.over = 'def';
  return battleResult(b);
}
