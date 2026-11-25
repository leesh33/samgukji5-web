/* 전술 전투 — 격자 전장 · 진형 · 방향 · 계략 (순수 로직, DOM 비의존) */
import { GENERAL_BY_ID, FORMATIONS, CITIES, CITY_BY_ID, formationRelation } from './data.js';
import { mulberry32, randInt, clamp, withJosa } from './engine.js';

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

  battle.log.push(`${battle.terrainName} 전장 — ${sideName(battle, 'atk')}군의 공격이 시작되었다. (성 방어 ${Math.round(battle.defBonus)})`);
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

/* ---------- 성 방어 (성의 방어 수치) ----------
 * 성 시트의 '방'과 치안 명령의 '방어 +1'이 실제 전장의 피해에 걸린다.
 * 55를 기준으로 1당 1/150 — 방 95면 받는 피해 27% 감소, 방 25면 20% 증가.
 * 성 안(수비측) 부대가 맞을 때만 걸린다 — 공격측이 수비 성벽에 몸을 부딪는 셈이다. */
export const WALL_BASE = 55;
export const WALL_SCALE = 150;
export function wallGuard(b, unit) {
  if (!b || !unit || unit.side !== 'def') return 1;
  const d = Number(b.defBonus);
  if (!Number.isFinite(d)) return 1;
  return clamp(1 + (d - WALL_BASE) / WALL_SCALE, 0.7, 1.45);
}

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
  def *= wallGuard(b, t);           // 성 방어 수치 — 수비측이 성벽에 기대어 받는다
  return { atk, def, edge, arm, guard: arm.guard, wall: wallGuard(b, t) };
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
  def *= wallGuard(b, u);            // 성 방어 수치 — 반격을 받는 수비측에도 걸린다
  return { atk, def, edge, arm, guard: arm.guard, wall: wallGuard(b, u) };
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

/* ---------- 적 장수의 일기토 도발 ----------
 * 적의 차례가 열릴 때, 맞닿아 선 호전적인 적 장수가 먼저 일기토를 청해 온다.
 * 전투당 한 번만 — 도배를 막고, 수락하면 기존 일기토 화면으로 이어진다. */
export const PROVOKE_LIMIT = 1;
export const PROVOKE_MIN_WAR = 74;                              // 이만큼 무력이 세거나
export const PROVOKE_HOT_SKILLS = ['dolgyeok', 'yongmaeng', 'pokgyeok', 'bigyeok'];   // 호전적인 특기
export const PROVOKE_MORALE_LOSS_MIN = 8;                       // 거절했을 때 아군 사기 하락

export function isHotBlooded(spec) {
  if (!spec) return false;
  return (spec.war || 0) >= PROVOKE_MIN_WAR || PROVOKE_HOT_SKILLS.includes(spec.skill);
}

/* 도발할 수 있는 적 장수와 그 맞은편 아군 — 서로 붙어 있어야 한다 */
export function provokeCandidates(b) {
  if (!b || !b.playerSide) return [];
  const mine = b.playerSide;
  const foe = mine === 'atk' ? 'def' : 'atk';
  const out = [];
  for (const e of unitsOf(b, foe)) {
    if (!e.alive || e.morale < 30) continue;
    const spec = unitSpec(e);
    if (!isHotBlooded(spec)) continue;
    const near = unitsOf(b, mine).filter((m) => m.alive && dist(e, m) <= 1);
    if (!near.length) continue;
    // 가장 센 아군과 겨루려 든다
    near.sort((a, c) => (unitSpec(c).war || 0) - (unitSpec(a).war || 0));
    out.push({ challenger: e, target: near[0] });
  }
  return out.sort((a, c) => (unitSpec(c.challenger).war || 0) - (unitSpec(a.challenger).war || 0));
}

/* 도발이 걸려 오는가 — 걸리면 { id, challenger, target, chance } 를 돌려준다 */
export function duelProvokeRoll(b, rng = Math.random) {
  if (!b || b.over || !b.playerSide) return null;
  if ((b.duelProvokes || 0) >= PROVOKE_LIMIT) return null;
  const cands = provokeCandidates(b);
  if (!cands.length) return null;
  const pick = cands[0];
  const war = unitSpec(pick.challenger).war || 60;
  const chance = clamp(0.34 + war / 320 + (b.round >= 3 ? 0.1 : 0) + (pick.challenger.morale >= 70 ? 0.06 : 0), 0.2, 0.8);
  if (rng() >= chance) return null;
  b.duelProvokes = (b.duelProvokes || 0) + 1;
  const ev = {
    id: 'duelProvoke',
    challenger: pick.challenger, target: pick.target,
    chance,
    title: '일기토 도발',
    text: `${withJosa(pick.challenger.name, '이')} 창을 치켜들며 ${withJosa(pick.target.name, '에게')} 일기토를 청합니다.`,
  };
  b.log.push(`[일기토 도발] ${withJosa(pick.challenger.name, '이')} ${withJosa(pick.target.name, '에게')} 일기토를 청했습니다.`);
  return ev;
}

/* 수락 — 일기토 화면으로 넘긴다(전투 결과는 일기토가 끝날 때 붙는다) */
export function acceptDuelProvoke(b, ev) {
  if (!b || !ev) return { ok: false, lines: [] };
  const lines = [`[일기토 승낙] ${withJosa(ev.target.name, '이')} 도발을 받아들여 말을 달렸습니다.`];
  b.log.push(...lines);
  return { ok: true, lines };
}

/* 거절 — 아군 부대 사기가 소폭 떨어지고 적은 기세를 올린다 */
export function declineDuelProvoke(b, ev) {
  if (!b || !ev) return { ok: false, lines: [], loss: 0 };
  const target = ev.target, challenger = ev.challenger;
  const loss = PROVOKE_MORALE_LOSS_MIN + Math.round((100 - target.morale) / 30);   // 8~11
  target.morale = clamp(target.morale - loss, 0, 100);
  challenger.morale = clamp(challenger.morale + 4, 0, 100);
  const lines = [`[도발 거절] ${withJosa(target.name, '이')} 도발을 물리쳤습니다. 아군 사기 -${loss} · ${challenger.name} 부대 사기 +4.`];
  if (target.morale <= 0) {
    target.alive = false;
    lines.push(`${target.name} 부대가 궤멸했습니다!`);
  }
  b.log.push(...lines);
  return { ok: true, lines, loss };
}

/* ---------- 전투 중 돌발 이벤트 ----------
 * 라운드가 열릴 때 전황·지형을 보고 한 번씩 굴린다. 전투당 최대 두 번.
 *  · 아군 원군 도착  — 수성 중이거나 병력이 밀릴 때 지원 병력·부대가 합류
 *  · 적 부대 내응·동요 — 사기가 낮은 적 부대가 흔들린다(병력 이탈 / 사기 급락)
 *  · 야습·화공       — 어두운 밤, 숲에 선 적을 노려 기습한다(선택) */
export const BATTLE_EVENT_MAX = 2;
export const BATTLE_EVENT_CHANCE = 0.45;
export const REINFORCE_CAP_MULT = 1.35;      // 원군으로 늘어날 수 있는 병력 상한(처음 병력 ×1.35)

/* 원군으로 불어날 수 있는 상한 — 처음 병력 기준으로 한 번만 잡는다 */
function reinforceCapOf(b, side) {
  b.reinforceCap = b.reinforceCap || { atk: Math.round((b.initial.atk || 0) * REINFORCE_CAP_MULT), def: Math.round((b.initial.def || 0) * REINFORCE_CAP_MULT) };
  return b.reinforceCap[side] || 0;
}
const sideTroopsOf = (b, side) => unitsOf(b, side).reduce((s, u) => s + u.troops, 0);

/* 지금 열릴 수 있는 돌발 이벤트 */
export function battleEventCandidates(b) {
  if (!b || b.over || !b.playerSide) return [];
  const mine = b.playerSide;
  const foe = mine === 'atk' ? 'def' : 'atk';
  const myUnits = unitsOf(b, mine), foeUnits = unitsOf(b, foe);
  if (!myUnits.length || !foeUnits.length) return [];
  const out = [];
  const room = reinforceCapOf(b, mine) - sideTroopsOf(b, mine);
  const planned = ((b.reinforcements && b.reinforcements[mine]) || []).length > 0;
  if ((planned || room > 400) && (mine === 'def' || sideTroopsOf(b, mine) < sideTroopsOf(b, foe) * 0.95 || planned)) out.push('reinforce');
  if (foeUnits.some((u) => u.morale <= 58)) out.push('waver');
  if (b.round >= 3) out.push('raid');
  return out;
}

/* 돌발 이벤트를 만든다 — 열 수 없는 상황이면 null */
export function buildBattleEvent(b, id) {
  if (!b || !b.playerSide) return null;
  const mine = b.playerSide;
  const foe = mine === 'atk' ? 'def' : 'atk';
  const myUnits = unitsOf(b, mine), foeUnits = unitsOf(b, foe);
  if (id === 'reinforce') {
    const planned = ((b.reinforcements && b.reinforcements[mine]) || []).length > 0;
    const add = Math.max(0, Math.min(Math.round(sideTroopsOf(b, mine) * 0.08), reinforceCapOf(b, mine) - sideTroopsOf(b, mine)));
    if (!planned && add < 300) return null;
    return {
      id: 'reinforce', tone: 'good', title: '아군 원군 도착',
      text: planned
        ? '지평선 너머로 아군 깃발이 보입니다. 예약된 원군이 전장 가장자리에 닿았습니다.'
        : `${mine === 'def' ? '성을 지키던 예비대가' : '후방의 지원대가'} 뒤늦게 전장에 닿았습니다. 아군이 숨을 고릅니다.`,
      options: [{ id: 'join', ko: '원군을 맞아들인다', hint: planned ? '원군 부대가 합류합니다 · 아군 사기 +4' : `아군 병력 +${(add || 0).toLocaleString()} · 사기 +5` }],
      data: { add, planned },
    };
  }
  if (id === 'waver') {
    const low = foeUnits.slice().sort((a, c) => a.morale - c.morale)[0];
    if (!low) return null;
    const desert = Math.max(60, Math.round(low.troops * 0.09));
    return {
      id: 'waver', tone: 'good', title: '적 부대 동요',
      text: `${withJosa(low.name, '이')} 이끄는 적 부대가 술렁입니다. 오래 싸운 탓인지 진영 안에서 불만이 새어 나옵니다.`,
      options: [
        { id: 'desert', ko: '병력 이탈을 부추긴다', hint: `${low.name} 부대 병력 -${desert.toLocaleString()} · 사기 -8` },
        { id: 'break', ko: '사기를 꺾는다', hint: `${low.name} 부대 사기 -20` },
      ],
      data: { gid: low.gid, desert },
    };
  }
  if (id === 'raid') {
    const woody = foeUnits.filter((u) => { const t = tileAt(b, u.x, u.y); return !!t && t.t === 'forest'; });
    const opts = [{ id: 'night', ko: '야습을 감행한다', hint: '성공하면 적 부대에 큰 타격 · 실패하면 아군 손실' }];
    if (woody.length) opts.push({ id: 'fire', ko: '화공을 놓는다', hint: `숲에 선 적 ${woody.length}부대에 불을 지른다` });
    opts.push({ id: 'back', ko: '물러난다', hint: '기회를 놓치지만 손실은 없다' });
    return {
      id: 'raid', tone: '', title: '밤이 깊었다 — 기습의 기회',
      text: '어둠이 내려 적의 눈이 어두워졌습니다. 지형을 살려 기습할 수 있습니다.',
      options: opts, data: { woody: woody.map((u) => u.gid) },
    };
  }
  return null;
}

/* 라운드가 열릴 때 돌발 이벤트를 굴린다 — 걸리면 이벤트, 아니면 null */
export function battleEventRoll(b, rng = Math.random) {
  if (!b || b.over || !b.playerSide) return null;
  if (b.round < 2) return null;
  if ((b.eventCount || 0) >= BATTLE_EVENT_MAX) return null;
  if (b.lastEventRound === b.round) return null;      // 한 라운드에 한 번만 굴린다
  const pool = battleEventCandidates(b);
  if (!pool.length) return null;
  b.lastEventRound = b.round;
  if (rng() >= BATTLE_EVENT_CHANCE) return null;
  const id = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const ev = buildBattleEvent(b, id);
  if (!ev) return null;
  b.eventCount = (b.eventCount || 0) + 1;
  return ev;
}

/* 선택을 적용한다 — 모든 수치는 사기 0~100 · 병력 0 안쪽으로만 움직인다 */
export function resolveBattleEvent(b, ev, choiceId, rng = Math.random) {
  const lines = [];
  if (!b || !ev || b.over) return { ok: false, lines };
  const mine = b.playerSide;
  const foe = mine === 'atk' ? 'def' : 'atk';
  const opts = ev.options || [];
  const opt = opts.find((o) => o.id === choiceId) || opts[0];
  if (!opt) return { ok: false, lines };
  let success = null;

  if (ev.id === 'reinforce') {
    const plan = b.reinforcements && b.reinforcements[mine];
    let joined = null;
    if (plan && plan.length) joined = addReinforcement(b, mine, plan.shift());
    let add = 0;
    if (!joined) {
      const cur = sideTroopsOf(b, mine);
      const want = Math.max(0, Math.min(ev.data && ev.data.add ? ev.data.add : 0, reinforceCapOf(b, mine) - cur));
      const alive = unitsOf(b, mine);
      if (alive.length && want > 0) {
        const each = Math.floor(want / alive.length);
        let rest = want - each * alive.length;
        for (const u of alive) {
          const give = each + (rest-- > 0 ? 1 : 0);
          u.troops += give; add += give;
          u.morale = clamp(u.morale + 5, 0, 100);
        }
        b.initial[mine] += add;      // 원군 병력은 손실 계산에서 빼 둔다
      }
    }
    if (joined) {
      for (const u of unitsOf(b, mine)) u.morale = clamp(u.morale + 4, 0, 100);
      lines.push(`[원군 도착!] ${withJosa(joined.name, '이')} 이끄는 원군 ${joined.troops.toLocaleString()}명이 합류했습니다. 아군 사기 +4.`);
    } else if (add > 0) {
      lines.push(`[원군 도착!] 아군 원군 ${add.toLocaleString()}명이 합류해 사기가 올랐습니다.`);
    } else {
      lines.push('원군이 길을 잃어 전장에 닿지 못했습니다.');
    }
  } else if (ev.id === 'waver') {
    const victim = b.units.find((u) => u.side === foe && u.alive && u.gid === ev.data.gid)
      || unitsOf(b, foe).slice().sort((a, c) => a.morale - c.morale)[0];
    if (victim && opt.id === 'desert') {
      const lose = Math.max(50, Math.round(victim.troops * 0.09));
      victim.troops = Math.max(0, victim.troops - lose);
      victim.morale = clamp(victim.morale - 8, 0, 100);
      lines.push(`[내응] ${victim.name} 부대에서 병사 ${lose.toLocaleString()}명이 진영을 떠났습니다. (사기 ${Math.round(victim.morale)})`);
      success = true;
    } else if (victim) {
      victim.morale = clamp(victim.morale - 20, 0, 100);
      lines.push(`[동요] ${withJosa(victim.name, '이')} 이끄는 부대의 사기가 20 떨어졌습니다. (사기 ${Math.round(victim.morale)})`);
      success = true;
    }
    if (victim && victim.alive && (victim.troops <= 0 || victim.morale <= 0)) {
      victim.alive = false;
      victim.troops = Math.max(0, victim.troops);
      lines.push(`${victim.name} 부대가 궤멸했습니다!`);
    }
  } else if (ev.id === 'raid') {
    const brainy = unitsOf(b, mine).slice().sort((a, c) => (unitSpec(c).int || 0) - (unitSpec(a).int || 0))[0];
    const intel = brainy ? (unitSpec(brainy).int || 50) : 50;
    const chance = clamp(0.45 + intel / 320, 0.4, 0.85);
    const chanceKo = Math.round(chance * 100);
    if (opt.id === 'back') {
      lines.push('기습을 접고 진영을 지켰습니다.');
      success = false;
    } else if (opt.id === 'fire') {
      const woody = unitsOf(b, foe).filter((u) => { const t = tileAt(b, u.x, u.y); return !!t && t.t === 'forest'; });
      if (!woody.length) {
        lines.push('불을 놓을 숲이 없어 화공을 접었습니다.');
      } else if (rng() < chance) {
        let dmgAll = 0;
        for (const v of woody) {
          const dmg = Math.max(100, Math.round(v.troops * (0.08 + rng() * 0.04)));
          v.troops = Math.max(0, v.troops - dmg);
          v.morale = clamp(v.morale - 14, 0, 100);
          dmgAll += dmg;
          if (v.troops <= 0 || v.morale <= 0) { v.alive = false; lines.push(`${v.name} 부대가 궤멸했습니다!`); }
        }
        lines.push(`[화공 성공] 숲이 불길에 휩싸여 적 ${woody.length}부대가 ${dmgAll.toLocaleString()} 피해를 입고 사기가 꺾였습니다. (성공률 ${chanceKo}%)`);
        success = true;
      } else {
        const v = unitsOf(b, mine).slice().sort((a, c) => a.troops - c.troops)[0];
        const dmg = v ? Math.max(80, Math.round(v.troops * 0.04)) : 0;
        if (v) { v.troops = Math.max(0, v.troops - dmg); v.morale = clamp(v.morale - 6, 0, 100); }
        lines.push(`[화공 실패] 불이 번지지 않고 역풍에 아군이 ${dmg.toLocaleString()} 피해를 입었습니다. (성공률 ${chanceKo}%)`);
        if (v && (v.troops <= 0 || v.morale <= 0)) { v.alive = false; lines.push(`${v.name} 부대가 궤멸했습니다!`); }
        success = false;
      }
    } else {
      if (rng() < chance) {
        const v = unitsOf(b, foe).slice().sort((a, c) => a.troops - c.troops)[0];
        if (v) {
          const dmg = Math.max(120, Math.round(v.troops * (0.12 + rng() * 0.04)));
          v.troops = Math.max(0, v.troops - dmg);
          v.morale = clamp(v.morale - 12, 0, 100);
          lines.push(`[야습 성공] 어둠을 타고 들어가 ${v.name} 부대에 ${dmg.toLocaleString()} 피해를 입혔습니다. (성공률 ${chanceKo}%)`);
          if (v.troops <= 0 || v.morale <= 0) { v.alive = false; lines.push(`${v.name} 부대가 궤멸했습니다!`); }
          success = true;
        }
      } else {
        const v = unitsOf(b, mine).slice().sort((a, c) => a.troops - c.troops)[0];
        const dmg = v ? Math.max(80, Math.round(v.troops * 0.05)) : 0;
        if (v) { v.troops = Math.max(0, v.troops - dmg); v.morale = clamp(v.morale - 6, 0, 100); }
        lines.push(`[야습 실패] 적의 순찰에 발각되어 아군이 ${dmg.toLocaleString()} 피해를 입었습니다. (성공률 ${chanceKo}%)`);
        if (v && (v.troops <= 0 || v.morale <= 0)) { v.alive = false; lines.push(`${v.name} 부대가 궤멸했습니다!`); }
        success = false;
      }
    }
  }
  b.log.push(...lines);
  return { ok: true, id: ev.id, choice: opt.id, lines, success };
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
