import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERAL_BY_ID } from '../js/data.js';
import * as B from '../js/battle.js';

/* ---------- 도우미 ---------- */
/* 같은 지형·같은 진형·같은 능력치로 두 부대를 마주 세운다. 병종만 바꿔 비교한다. */
function pair(atkArms, defArms, opts = {}) {
  const b = B.createBattle({
    fromCityId: 'xuchang', toCityId: 'chenliu',
    attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['cao_cao'], defGenerals: ['lu_bu'],
    atkTroops: 8000, defTroops: 8000, defBonus: 40, seed: 5,
  });
  const u = b.units.find((x) => x.side === 'atk');
  const t = b.units.find((x) => x.side === 'def');
  b.grid.forEach((g) => { g.t = 'plain'; });               // 지형 보정을 고정
  u.spec = { ...u.spec, arms: atkArms, war: 70, lead: 70, int: 40, skill: null };
  t.spec = { ...t.spec, arms: defArms, war: 70, lead: 70, int: 40, skill: null };
  u.formation = 'eorin'; t.formation = 'eorin';
  u.troops = 4000; t.troops = 4000;
  u.morale = 70; t.morale = 70;
  u.rankBonus = 0; t.rankBonus = 0;
  u.acted = false; t.acted = false;
  u.x = 2; u.y = 3; t.x = 3; t.y = 3;
  u.dir = 'E'; t.dir = 'W';                                 // 서로 정면
  if (opts.gap === 2) t.x = 4;
  return { b, u, t };
}

/* ---------- 병종 상성 3각 ---------- */
test('병종 상성: 기병 > 궁병 > 보병 > 기병', () => {
  assert.equal(B.armRelation('기병', '궁병'), 'advantage');
  assert.equal(B.armRelation('궁병', '보병'), 'advantage');
  assert.equal(B.armRelation('보병', '기병'), 'advantage');
  assert.equal(B.armRelation('궁병', '기병'), 'disadvantage');
  assert.equal(B.armRelation('보병', '궁병'), 'disadvantage');
  assert.equal(B.armRelation('기병', '보병'), 'disadvantage');
  for (const arm of ['기병', '궁병', '보병']) assert.equal(B.armRelation(arm, arm), 'neutral');
});

test('수군은 기본 상성이 중립 — 어느 병종과도 유불리가 없다', () => {
  for (const arm of ['기병', '궁병', '보병', '수군']) {
    assert.equal(B.armRelation('수군', arm), 'neutral');
    assert.equal(B.armRelation(arm, '수군'), 'neutral');
  }
  const { b, u, t } = pair('수군', '기병');
  const e = B.armEdge(b, u, t);
  assert.equal(e.relation, 'neutral');
  assert.equal(e.mult, 1);
  assert.equal(e.guard, 1);
});

test('상성 배율: 유리 +20% · 불리 -15%', () => {
  assert.equal(B.ARM_MULT.advantage, 1.2);
  assert.equal(B.ARM_MULT.disadvantage, 0.85);
  const adv = pair('기병', '궁병');
  const neu = pair('기병', '기병');
  const dis = pair('기병', '보병');
  assert.equal(B.armEdge(adv.b, adv.u, adv.t).mult, 1.2);
  assert.equal(B.armEdge(neu.b, neu.u, neu.t).mult, 1);
  assert.equal(B.armEdge(dis.b, dis.u, dis.t).mult, 0.85);
  // 같은 조건에서 유리 쪽이 중립 쪽보다 정확히 1.2배 아프게 친다
  const a = B.previewAttack(adv.b, adv.u, adv.t).damage;
  const n = B.previewAttack(neu.b, neu.u, neu.t).damage;
  assert.ok(Math.abs(a / n - 1.2) < 0.02, `유리/중립 피해비 ${(a / n).toFixed(3)}`);
});

/* ---------- 병종별 특징 ---------- */
test('기병: 기본 이동력이 같은 조건의 보병보다 1 높다', () => {
  const cav = pair('기병', '보병');
  const inf = pair('보병', '보병');
  assert.equal(B.movePoints(inf.u), 3);
  assert.equal(B.movePoints(cav.u), 4);
  // 기동이 좋아 실제로 더 멀리 간다
  const a = B.reachable(cav.b, cav.u);
  const c = B.reachable(inf.b, inf.u);
  assert.ok(a.size > c.size, `기병 ${a.size}칸 / 보병 ${c.size}칸`);
});

test('기병 기동 +1은 상한(6)을 넘지 않는다', () => {
  const { u } = pair('기병', '보병');
  u.formation = 'jangsa';                     // 기동 1.15 → 3
  assert.equal(B.movePoints(u), 4);
  u.spec = { ...u.spec, skill: 'dolgyeok' };  // 특기 +1 → 5
  assert.equal(B.movePoints(u), 5);
  u.formation = 'guhaeng';                    // 기동 1.25 → 4 + 특기 1 + 기병 1 = 6
  assert.equal(B.movePoints(u), 6);
});

test('궁병: 진형과 무관하게 사거리 2 — 원거리 사격에는 반격이 없다', () => {
  const { b, u, t } = pair('궁병', '보병', { gap: 2 });
  assert.equal(B.attackRange(u), 2);
  assert.equal(B.canAttack(b, u, t), true);
  const mine = u.troops, foe = t.troops;
  const r = B.attack(b, u, t, 9);
  assert.ok(r.ok, r.msg);
  assert.ok(t.troops < foe, '적에게 피해');
  assert.equal(u.troops, mine, '원거리 사격에는 반격이 없다');
  assert.equal(r.distance, 2);
  assert.ok(!r.lines.some((l) => l.includes('반격')), r.lines.join(' / '));
});

test('궁병도 붙으면 근접전 — 반격을 받는다', () => {
  const { b, u, t } = pair('궁병', '보병');
  const mine = u.troops;
  const r = B.attack(b, u, t, 9);
  assert.ok(r.ok, r.msg);
  assert.equal(r.distance, 1);
  assert.ok(u.troops < mine, '근접 공격에는 반격이 있다');
  assert.ok(r.lines.some((l) => l.includes('반격')), r.lines.join(' / '));
});

test('보병: 받는 피해 -15% (전열 방어)', () => {
  const vsInf = pair('수군', '보병');   // 수군은 중립 — 보병의 방어 특성만 남는다
  const vsCav = pair('수군', '기병');
  const e = B.armEdge(vsInf.b, vsInf.u, vsInf.t);
  assert.equal(e.guard, 0.85);
  assert.equal(B.armEdge(vsCav.b, vsCav.u, vsCav.t).guard, 1);
  const a = B.previewAttack(vsInf.b, vsInf.u, vsInf.t).damage;
  const n = B.previewAttack(vsCav.b, vsCav.u, vsCav.t).damage;
  assert.ok(Math.abs(a / n - 0.85) < 0.02, `보병 피해비 ${(a / n).toFixed(3)}`);
});

test('수군: 물길 위에서 공격 +15% · 방어 -15%', () => {
  const { b, u, t } = pair('수군', '보병');
  const dry = B.armEdge(b, u, t);
  assert.equal(dry.mult, 1);
  B.tileAt(b, u.x, u.y).t = 'water';         // 공격자가 물 위
  const wet = B.armEdge(b, u, t);
  assert.equal(wet.waterAtk, true);
  assert.ok(Math.abs(wet.mult - 1.15) < 1e-9);
  // 물 위의 수군은 받는 피해도 15% 줄어든다
  const sea = pair('기병', '수군');
  B.tileAt(sea.b, sea.t.x, sea.t.y).t = 'water';
  const eg = B.armEdge(sea.b, sea.u, sea.t);
  assert.equal(eg.waterDef, true);
  assert.equal(eg.guard, 0.85);
});

/* ---------- 기존 전투 규칙과의 통합 ---------- */
test('방향·진형 배율과 병종 상성은 곱해진다', () => {
  const { b, u, t } = pair('기병', '궁병');
  const p = B.previewAttack(b, u, t);
  assert.equal(p.edge.side, 'front');
  assert.equal(p.edge.mult, 1);
  assert.equal(p.arm.mult, 1.2);
  assert.ok(Math.abs(p.mult - 1.2) < 1e-9);
  // 배후 기습 × 진형 유리 × 병종 유리
  t.dir = 'E';   // 등을 보인다
  const back = B.previewAttack(b, u, t);
  assert.equal(back.edge.side, 'rear');
  assert.equal(back.edge.mult, 1.5);
  assert.ok(Math.abs(back.mult - 1.5 * 1.2) < 1e-9);
});

test('공격 예상 피해가 실제 피해와 맞는다', () => {
  let sum = 0, n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const { b, u, t } = pair('기병', '보병');
    const expect = B.previewAttack(b, u, t).damage;
    const foe = t.troops;
    const r = B.attack(b, u, t, seed);
    assert.ok(r.ok);
    sum += expect; n += (foe - t.troops);
  }
  const actual = n / 12, estimate = sum / 12;
  assert.ok(Math.abs(actual / estimate - 1) < 0.12, `예상 ${Math.round(estimate)} / 실제 ${Math.round(actual)}`);
});

test('전투 로그에 상성 문구가 붙는다', () => {
  const adv = pair('기병', '궁병');
  B.attack(adv.b, adv.u, adv.t, 4);
  const line = adv.b.log[adv.b.log.length - 1];
  assert.ok(adv.b.log.some((l) => l.includes('[상성 우위]')), line);
  const dis = pair('기병', '보병');
  B.attack(dis.b, dis.u, dis.t, 4);
  assert.ok(dis.b.log.some((l) => l.includes('[상성 열세]')), dis.b.log.join(' / '));
});

/* ---------- AI ---------- */
test('AI는 상성에서 이기는 대상을 고른다 (기병 → 궁병)', () => {
  const b = B.createBattle({
    fromCityId: 'xuchang', toCityId: 'chenliu',
    attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['cao_cao'], defGenerals: ['lu_bu', 'chen_gong'],
    atkTroops: 8000, defTroops: 8000, defBonus: 40, seed: 2,
  });
  b.grid.forEach((g) => { g.t = 'plain'; });
  const u = b.units.find((x) => x.side === 'atk');
  const defs = b.units.filter((x) => x.side === 'def');
  const [archer, inf] = defs;
  u.spec = { ...u.spec, arms: '기병', war: 80, lead: 70, int: 30, skill: null };
  archer.spec = { ...archer.spec, arms: '궁병', war: 60, lead: 60, int: 30, skill: null };
  inf.spec = { ...inf.spec, arms: '보병', war: 60, lead: 60, int: 30, skill: null };
  for (const d of defs) { d.troops = 3000; d.morale = 70; d.rankBonus = 0; d.formation = 'eorin'; }
  u.troops = 4000; u.morale = 70; u.rankBonus = 0; u.formation = 'eorin'; u.acted = false;
  u.x = 3; u.y = 3; u.dir = 'E';
  archer.x = 4; archer.y = 3; archer.dir = 'W';    // 정면
  inf.x = 3; inf.y = 4; inf.dir = 'N';             // 정면
  const arcBefore = archer.troops, infBefore = inf.troops;
  let k = 0;
  B.aiUnitAct(b, u, () => (k++ % 5) / 6);
  assert.ok(archer.troops < arcBefore, '기병은 궁병을 친다');
  assert.equal(inf.troops, infBefore, '상성에서 지는 보병은 뒤로 미룬다');
});

test('AI 궁병은 붙지 않고 사거리 2에서 쏜다', () => {
  const b = B.createBattle({
    fromCityId: 'xuchang', toCityId: 'chenliu',
    attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['cao_cao'], defGenerals: ['lu_bu'],
    atkTroops: 8000, defTroops: 8000, defBonus: 40, seed: 3,
  });
  b.grid.forEach((g) => { g.t = 'plain'; });
  const u = b.units.find((x) => x.side === 'atk');
  const t = b.units.find((x) => x.side === 'def');
  u.spec = { ...u.spec, arms: '궁병', war: 70, lead: 70, int: 30, skill: null };
  t.spec = { ...t.spec, arms: '보병', war: 70, lead: 70, int: 30, skill: null };
  u.formation = 'eorin'; t.formation = 'eorin';
  u.troops = 4000; t.troops = 4000; u.morale = 70; t.morale = 70;
  u.rankBonus = 0; t.rankBonus = 0; u.acted = false; u.dir = 'E';
  u.x = 1; u.y = 3; t.x = 6; t.y = 3; t.dir = 'W';
  const mine = u.troops;
  B.aiUnitAct(b, u, (() => { let i = 0; return () => (i++ % 7) / 9; })());
  assert.ok(t.troops < 4000, '적을 쐈다');
  assert.equal(u.troops, mine, '원거리라 반격을 받지 않았다');
  assert.ok(B.dist(u, t) >= 2, `거리 ${B.dist(u, t)}`);
});

test('자동 전투가 병종 상성 도입 뒤에도 정상 종료된다', () => {
  for (let i = 0; i < 10; i++) {
    const res = B.autoBattle({
      fromCityId: 'xuchang', toCityId: 'chenliu', attackerFaction: 'jojo', defenderFaction: 'lubu',
      atkGenerals: ['cao_cao', 'xiahou_dun', 'cao_ren'], defGenerals: ['lu_bu', 'chen_gong', 'gao_shun'],
      atkTroops: 15000, defTroops: 12000, defBonus: 55, seed: i + 1,
    });
    assert.ok(['attacker', 'defender'].includes(res.winner));
    assert.ok(res.rounds >= 1 && res.rounds <= 16);
  }
});

test('부대 병종은 부대 편성에서 바꾼 병종을 그대로 쓴다', () => {
  const { u } = pair('궁병', '보병');
  assert.equal(B.armOf(u), '궁병');
  const g = GENERAL_BY_ID.cao_cao;
  assert.ok(B.armTraitText(g.arms).length > 0);
  assert.equal(B.armTraitText('기병').includes('기동 +1'), true);
  assert.equal(B.armTraitText('궁병').includes('사거리 2'), true);
  assert.equal(B.armTraitText('보병').includes('-15%'), true);
  assert.equal(B.armTraitText('수군').includes('물길'), true);
});
