/* 전술 전투 — 격자 전장 · 진형 · 계략 (순수 로직, DOM 비의존) */
import { GENERAL_BY_ID, FORMATIONS, CITIES, CITY_BY_ID } from './data.js';
import { mulberry32, randInt, clamp } from './engine.js';

export const BW = 13;
export const BH = 9;

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
  confuse: { ko: '혼란', stat: 'int', desc: '적 부대를 혼란시켜 사기를 꺾는다.' },
  rally: { ko: '고무', stat: 'cha', desc: '아군 부대의 사기를 올린다.' },
  heal: { ko: '치료', stat: 'int', desc: '아군 부대의 병력을 회복한다.' },
};

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
  } = opts;
  const GD = generals || GENERAL_BY_ID;
  const rng = mulberry32(hashStr(fromCityId + toCityId) + seed);
  const battle = {
    w: BW, h: BH,
    fromCityId, toCityId, attackerFaction, defenderFaction,
    grid: [], units: [], phase: 'atk', round: 1, log: [], over: null,
    playerSide, seed, defBonus,
    initial: { atk: atkTroops, def: defTroops },
    terrainName: CITY_BY_ID[toCityId] ? CITY_BY_ID[toCityId].ko : '',
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
      const formId = (g.formations && g.formations[0]) || 'eorin';
      battle.units.push({
        id: `${side}-${gid}`,
        side, gid, name: g.ko,
        spec: { id: g.id, ko: g.ko, hanja: g.hanja || '', lead: g.lead, war: g.war, int: g.int, pol: g.pol, cha: g.cha, arms: g.arms, skill: g.skill, formations: g.formations || ['eorin'] },
        troops: Math.max(400, Math.round(base * (gid === gids[0] ? 1.1 : 1))),
        morale: clamp(58 + Math.round(g.lead / 4) + (isCastleDef ? 6 : 0), 40, 100),
        formation: formId,
        x: clamp(x, 0, BW - 1), y,
        acted: false, moved: false, alive: true,
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

export const sideName = (b, side) => (side === 'atk' ? '공격' : '수비');
export const tileAt = (b, x, y) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? null : b.grid[y * b.w + x]);
export const unitsOf = (b, side) => b.units.filter((u) => u.side === side && u.alive);
export const unitSpec = (u) => u.spec || GENERAL_BY_ID[u.gid];
export const formOf = (u) => FORMATIONS[u.formation] || FORMATIONS.eorin;

export function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

export function movePoints(u) {
  const g = unitSpec(u);
  const f = formOf(u);
  let mp = Math.round(3 * f.move);
  if (g.skill === 'dolgyeok') mp += 1;
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
  const reach = reachable(b, u);
  const k = y * b.w + x;
  if (!reach.has(k)) return { ok: false, msg: '이동할 수 없는 타일입니다.' };
  u.x = x; u.y = y; u.moved = true;
  return { ok: true };
}

export function attackRange(u) {
  const f = formOf(u);
  return f.range;
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
  if (!canAttack(b, u, t)) return { ok: false, msg: '사정거리 밖입니다.' };
  const rng = mulberry32(rngSeed + b.round * 31 + u.troops);
  const res = resolveAttack(b, u, t, rng);
  u.acted = true; u.moved = true;
  return { ok: true, ...res };
}

export function resolveAttack(b, u, t, rng) {
  const ga = unitSpec(u), gd = unitSpec(t);
  const fa = formOf(u), fd = formOf(t);
  const ter = TERRAIN[tileAt(b, t.x, t.y).t];
  let atk = u.troops * 0.16 * (1 + ga.war / 140) * fa.atk * (0.65 + u.morale / 160) * (0.9 + ga.lead / 600);
  if (ga.skill === 'dolgyeok') atk *= 1.2;
  if (ga.skill === 'jeogyeok' && fa.range > 1) atk *= 1.25;
  if (ga.skill === 'sujeon' && tileAt(b, t.x, t.y).t === 'water') atk *= 1.25;
  if (ga.skill === 'pokgyeok') atk *= 1.15;
  if (ga.skill === 'yongmaeng') atk *= 1.08;
  if (ga.skill === 'bigyeok') atk *= 1.1;
  let def = (1 + (gd.lead + gd.war) / 420) * fd.def * ter.def;
  if (gd.skill === 'cheolbyeok') def *= 1.2;
  if (gd.skill === 'gyeonsu') def *= 1.1;
  let dmg = Math.round((atk / def) * (0.85 + rng() * 0.3));
  dmg = Math.max(30, dmg);
  t.troops -= dmg;
  let moraleLoss = 4 + Math.round(dmg / Math.max(400, t.troops + dmg) * 30);
  if (ga.skill === 'wieom') moraleLoss += 2;
  t.morale = clamp(t.morale - moraleLoss, 0, 100);

  const lines = [`${u.name}의 공격! ${t.name}에게 ${dmg.toLocaleString()} 피해.`];
  // 반격(근접, 생존 시)
  if (t.troops > 0 && t.morale > 0 && dist(u, t) === 1) {
    const f2 = formOf(t);
    everyBit: {
      let cAtk = t.troops * 0.1 * (1 + gd.war / 160) * f2.atk * (0.55 + t.morale / 180);
      let cDef = (1 + (ga.lead + ga.war) / 420) * fa.def * TERRAIN[tileAt(b, u.x, u.y).t].def;
      if (ga.skill === 'cheolbyeok') cDef *= 1.2;
      const cDmg = Math.max(20, Math.round((cAtk / cDef) * (0.8 + rng() * 0.3) * 0.6));
      u.troops -= cDmg;
      u.morale = clamp(u.morale - 2, 0, 100);
      lines.push(`${t.name}의 반격 — ${cDmg.toLocaleString()} 피해.`);
    }
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
  return { damage: dmg, dead: dead.map((d) => d.id), lines };
}

/* 계략 */
export function tactic(b, u, t, kind, rngSeed = 1) {
  if (u.acted) return { ok: false, msg: '이미 행동했습니다.' };
  const tc = TACTICS[kind];
  if (!tc) return { ok: false, msg: '없는 계략입니다.' };
  const g = unitSpec(u);
  if (kind === 'rally' || kind === 'heal') {
    if (!t || t.side !== u.side) return { ok: false, msg: '아군 부대를 대상으로 하세요.' };
  } else if (!t || t.side === u.side) {
    return { ok: false, msg: '적 부대를 대상으로 하세요.' };
  }
  if (dist(u, t) > 3) return { ok: false, msg: '계략 사거리(3) 밖입니다.' };
  const rng = mulberry32(rngSeed + b.round * 17 + u.troops + kind.length);
  let rate = 0.35 + g.int / 260;
  if (g.skill === 'sinsan') rate += 0.3;
  if (kind === 'rally' || kind === 'heal') rate += g.cha / 400;
  rate = clamp(rate, 0.15, 0.95);
  const ok = rng() < rate;
  const lines = [];
  if (!ok) {
    lines.push(`${u.name}의 ${tc.ko}가 실패했습니다.`);
    u.acted = true; u.moved = true;
    b.log.push(...lines);
    return { ok: true, success: false, lines };
  }
  let dmg = 0;
  if (kind === 'fire') {
    dmg = Math.round(t.troops * (0.06 + g.int / 1600) * (g.skill === 'sinsan' ? 1.2 : 1) * (0.8 + rng() * 0.4));
    t.troops -= dmg;
    t.morale = clamp(t.morale - 14, 0, 100);
    lines.push(`${u.name}의 화계! ${t.name} 부대에 불길이 번져 ${dmg.toLocaleString()} 피해, 사기 급락.`);
  } else if (kind === 'confuse') {
    dmg = Math.round(t.troops * 0.03);
    t.troops -= dmg;
    t.morale = clamp(t.morale - 20, 0, 100);
    lines.push(`${u.name}의 혼란! ${t.name} 부대가 진형을 흐트러뜨렸습니다. (사기 -20)`);
  } else if (kind === 'rally') {
    t.morale = clamp(t.morale + 22, 0, 100);
    lines.push(`${u.name}의 고무! ${t.name} 부대의 사기가 올랐습니다. (사기 ${t.morale})`);
  } else if (kind === 'heal') {
    const heal = Math.round(t.troops * 0.05 + 200);
    t.troops += heal;
    lines.push(`${u.name}의 치료! ${t.name} 부대가 ${heal.toLocaleString()}명을 되찾았습니다.`);
  }
  for (const unit of [u, t]) {
    if (unit.alive && (unit.troops <= 0 || unit.morale <= 0)) {
      unit.alive = false;
      lines.push(`${unit.name} 부대가 궤멸했습니다!`);
    }
  }
  u.acted = true; u.moved = true;
  b.log.push(...lines);
  return { ok: true, success: true, damage: dmg, lines };
}

export function endUnit(u) { u.acted = true; u.moved = true; }

export function sideDone(b, side) {
  return unitsOf(b, side).every((u) => u.acted);
}

export function nextPhase(b) {
  if (b.over) return b;
  if (b.phase === 'atk') {
    if (unitsOf(b, 'atk').length === 0) { b.over = 'def'; return b; }
    b.phase = 'def';
    for (const u of unitsOf(b, 'def')) { u.acted = false; u.moved = false; }
  } else {
    if (unitsOf(b, 'def').length === 0) { b.over = 'atk'; return b; }
    b.phase = 'atk';
    b.round++;
    for (const u of b.units) { u.acted = false; u.moved = false; }
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

/* AI 부대 행동 */
export function aiUnitAct(b, u, rng) {
  if (u.acted || !u.alive) return;
  const foes = unitsOf(b, u.side === 'atk' ? 'def' : 'atk');
  if (!foes.length) return;
  // 타겟: 가장 약한 적 (병력*거리)
  const g = unitSpec(u);
  const inRange = foes.filter((f) => canAttack(b, u, f));
  if (inRange.length) {
    inRange.sort((a, c) => a.troops - c.troops);
    if (g.int > 75 && rng() < 0.28) {
      const kind = g.skill === 'hwagye' ? 'fire' : g.skill === 'hollan' ? 'confuse' : (g.int > 85 ? 'confuse' : 'fire');
      const r = tactic(b, u, inRange[0], kind, Math.floor(rng() * 9999));
      if (r.ok) return;
    }
    attack(b, u, inRange[0], Math.floor(rng() * 9999));
    return;
  }
  // 접근: 도달 가능 타일 중 적과 가까워지는 곳
  const reach = reachable(b, u);
  let best = null, bestScore = -Infinity;
  const nearest = foes.reduce((m, f) => Math.min(m, dist(u, f)), 99);
  for (const k of reach.keys()) {
    const x = k % b.w, y = Math.floor(k / b.w);
    const d = Math.min(...foes.map((f) => Math.abs(f.x - x) + Math.abs(f.y - y)));
    const score = -d * 10 - reach.get(k) * 0.2 + (d < nearest ? 5 : 0);
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  if (best) moveUnit(b, u, best.x, best.y);
  const again = foes.filter((f) => canAttack(b, u, f));
  if (again.length) { attack(b, u, again[0], Math.floor(rng() * 9999)); return; }
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
  const captured = [];
  const rng = mulberry32(hashStr(b.fromCityId + b.toCityId) + b.round * 7 + 3);
  const losingSide = winner === 'attacker' ? 'def' : 'atk';
  for (const u of b.units.filter((x) => x.side === losingSide && !x.alive)) {
    if (rng() < 0.28) captured.push(u.gid);
  }
  return {
    fromCityId: b.fromCityId, toCityId: b.toCityId,
    winner,
    atkLoss: Math.max(0, b.initial.atk - atkSurvivors),
    defLoss: Math.max(0, b.initial.def - defSurvivors),
    atkSurvivors,
    defSurvivors,
    capturedGenerals: captured,
    rounds: b.round,
    playerSide: b.playerSide,
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
