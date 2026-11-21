/* 일기토(무장 1:1 대결) — 순수 로직 */
import { mulberry32, randInt, clamp } from './engine.js';

export const DUEL_ACTIONS = [
  { id: 'strong', ko: '강공', desc: '빠른 일격. 안정적인 피해.' },
  { id: 'finish', ko: '필살', desc: '큰 피해. 기백 2 소모.' },
  { id: 'guard', ko: '방어', desc: '받는 피해를 크게 줄인다.' },
  { id: 'dodge', ko: '회피', desc: '공격을 흘리고 반격한다.' },
];

export function createDuel(gA, gB, seed = 1, labels = {}) {
  const mk = (g) => ({
    gid: g.id, name: g.ko, war: g.war, hp: 100 + Math.round(g.war * 0.55), maxHp: 100 + Math.round(g.war * 0.55),
    ki: 3, guard: false,
  });
  return {
    a: mk(gA), b: mk(gB),
    labelA: labels.a || '공격측', labelB: labels.b || '수비측',
    round: 1, log: [], over: null, winner: null, rngState: seed >>> 0,
  };
}

function rngOf(d) { return mulberry32(d.rngState); }
function bump(d) { d.rngState = (d.rngState + 7919) >>> 0; }

function enemyChoice(d, unit, rng) {
  const r = rng();
  if (unit.hp < unit.maxHp * 0.3 && r < 0.45) return 'guard';
  if (unit.ki >= 2 && r > 0.62) return 'finish';
  if (r < 0.2) return 'dodge';
  if (r < 0.5) return 'guard';
  return 'strong';
}

function dmg(d, attacker, defender, action, rng) {
  const ratio = attacker.war / Math.max(30, defender.war);
  let base = 9 + attacker.war * 0.09;
  let mul = 1;
  let acc = 0.9;
  if (action === 'finish') { mul = 1.75; acc = 0.62; }
  else if (action === 'strong') { mul = 1.15; acc = 0.86; }
  else if (action === 'guard') { mul = 0.45; acc = 0.8; }
  else if (action === 'dodge') { mul = 0.55; acc = 0.7; }
  let value = base * mul * (0.6 + ratio * 0.5) * (0.85 + rng() * 0.3);
  if (defender.guard) value *= 0.45;
  if (rng() > acc) return { hit: false, value: 0 };
  return { hit: true, value: Math.max(2, Math.round(value)) };
}

/* 한 라운드 진행. playerAction이 null이면 AI 대 AI */
export function duelRound(d, playerAction, playerIsA = true) {
  if (d.over) return d;
  const rng = rngOf(d);
  const me = playerIsA ? d.a : d.b;
  const foe = playerIsA ? d.b : d.a;
  const myAct = playerAction || enemyChoice(d, me, rng);
  const foeAct = enemyChoice(d, foe, rng);

  // 기백
  if (myAct === 'finish') { if (me.ki < 2) { myAct = 'strong'; } else me.ki -= 2; }
  if (foeAct === 'finish') { if (foe.ki < 2) { foeAct = 'strong'; } else foe.ki -= 2; }

  const meGuard = myAct === 'guard';
  const foeGuard = foeAct === 'guard';
  d.a.guard = playerIsA ? meGuard : foeGuard;
  d.b.guard = playerIsA ? foeGuard : meGuard;
  me.guard = meGuard; foe.guard = foeGuard;

  const nameOf = (u) => u.name;
  const actKo = { strong: '강공', finish: '필살', guard: '방어', dodge: '회피' };

  // 회피 판정
  const dodgedBy = (defender, attacker) => {
    // defender가 회피를 골랐다면 확률적으로 회피
    if (defender === d.a ? d.a : d.b) { /* noop */ }
    return false;
  };

  let logLines = [];
  // A(me 기준 아님, 고정 A→B 순서로 데미지 계산)
  const first = d.a, second = d.b;
  const actFor = (u) => (u === d.a ? (playerIsA ? myAct : foeAct) : (playerIsA ? foeAct : myAct));

  const aAct = actFor(d.a);
  const bAct = actFor(d.b);
  const order = d.a.war >= d.b.war ? [[d.a, bAct], [d.b, aAct]] : [[d.b, aAct], [d.a, bAct]];
  // order: [attacker, defenderAction]

  for (const [att, defAction] of order) {
    if (d.over) break;
    const def = att === d.a ? d.b : d.a;
    const atkAction = actFor(att);
    if (att.hp <= 0 || def.hp <= 0) continue;
    if (defAction === 'dodge' && rng() < clamp(0.25 + def.war / 500, 0.2, 0.55)) {
      logLines.push(`${nameOf(def)}이(가) ${nameOf(att)}의 공격을 흘렸습니다.`);
      // 반격
      const c = dmg(d, def, att, 'strong', rng);
      if (c.hit) { att.hp -= c.value; logLines.push(`${nameOf(def)}의 반격! ${c.value} 피해.`); }
      continue;
    }
    const r = dmg(d, att, def, atkAction, rng);
    if (!r.hit) { logLines.push(`${nameOf(att)}의 ${actKo[atkAction]}이(가) 빗나갔습니다.`); continue; }
    def.hp -= r.value;
    logLines.push(`${nameOf(att)}의 ${actKo[atkAction]}! ${nameOf(def)}에게 ${r.value} 피해.`);
  }

  d.a.ki = Math.min(5, d.a.ki + (d.round % 2 === 0 ? 1 : 0));
  d.b.ki = Math.min(5, d.b.ki + (d.round % 2 === 0 ? 1 : 0));
  d.round++;
  d.log.push(...logLines);
  if (d.log.length > 60) d.log.splice(0, d.log.length - 60);
  bump(d);

  if (d.a.hp <= 0 || d.b.hp <= 0) {
    d.over = true;
    d.winner = d.a.hp <= 0 ? d.b : d.a;
    d.log.push(`${d.winner.name}의 승리! ${(d.winner === d.a ? d.b : d.a).name}이(가) 쓰러졌습니다.`);
  } else if (d.round > 12) {
    d.over = true;
    d.winner = d.a.hp >= d.b.hp ? d.a : d.b;
    d.log.push(`장기전 끝에 ${d.winner.name}이(가) 우세를 점했습니다.`);
  }
  d.a.hp = Math.max(0, d.a.hp); d.b.hp = Math.max(0, d.b.hp);
  return d;
}

export function autoDuel(gA, gB, seed = 1) {
  const d = createDuel(gA, gB, seed);
  let guard = 0;
  while (!d.over && guard++ < 20) duelRound(d, null, true);
  return d;
}
