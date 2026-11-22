import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATIONS, CORE_FORMATIONS, FORMATION_GROUPS, formationGroup, formationRelation, formationCounterText } from '../js/data.js';
import { FORMATION_DOTS, formationDots, frontTip, rotatePoint } from '../js/formation-art.js';
import * as B from '../js/battle.js';
import { mulberry32 } from '../js/engine.js';

/* ---------- 방향 ---------- */
test('방향 판정: 바라보는 쪽에 따라 정면·측면·배후', () => {
  const t = { x: 5, y: 5, dir: 'E' };
  assert.equal(B.attackSide({ x: 6, y: 5 }, t), 'front', '동쪽에서 오면 정면');
  assert.equal(B.attackSide({ x: 4, y: 5 }, t), 'rear', '서쪽(등 뒤)에서 오면 배후');
  assert.equal(B.attackSide({ x: 5, y: 4 }, t), 'flank', '북쪽에서 오면 측면');
  assert.equal(B.attackSide({ x: 5, y: 6 }, t), 'flank', '남쪽에서 오면 측면');
  // 적이 서쪽을 보고 있으면 반대
  const w = { x: 5, y: 5, dir: 'W' };
  assert.equal(B.attackSide({ x: 4, y: 5 }, w), 'front');
  assert.equal(B.attackSide({ x: 6, y: 5 }, w), 'rear');
  // 북/남
  assert.equal(B.attackSide({ x: 5, y: 4 }, { x: 5, y: 5, dir: 'N' }), 'front');
  assert.equal(B.attackSide({ x: 5, y: 6 }, { x: 5, y: 5, dir: 'N' }), 'rear');
});

test('dirBetween: 이동·공격 방향으로 회전', () => {
  assert.equal(B.dirBetween({ x: 3, y: 3 }, { x: 6, y: 3 }), 'E');
  assert.equal(B.dirBetween({ x: 3, y: 3 }, { x: 1, y: 3 }), 'W');
  assert.equal(B.dirBetween({ x: 3, y: 3 }, { x: 3, y: 6 }), 'S');
  assert.equal(B.dirBetween({ x: 3, y: 3 }, { x: 3, y: 0 }), 'N');
});

function duelField(atkForm = 'eorin', defForm = 'eorin', defDir = 'E') {
  const b = B.createBattle({
    fromCityId: 'xuchang', toCityId: 'chenliu', attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['liu_bei'], defGenerals: ['yu_jin'],
    atkTroops: 4000, defTroops: 4000, defBonus: 40, seed: 9, playerSide: 'atk',
  });
  b.grid.forEach((t) => { t.t = 'plain'; });
  const u = B.unitsOf(b, 'atk')[0];
  const t = B.unitsOf(b, 'def')[0];
  u.formation = atkForm; t.formation = defForm;
  u.x = 4; u.y = 4; u.dir = 'E';
  t.x = 5; t.y = 4; t.dir = defDir;
  return { b, u, t };
}

test('방향 대미지: 정면 < 측면 < 배후 (×1.0 / ×1.25 / ×1.5)', () => {
  const hits = {};
  for (const [side, dir] of [['front', 'W'], ['flank', 'N'], ['rear', 'E']]) {
    const { b, u, t } = duelField('eorin', 'eorin', dir);
    const r = B.resolveAttack(b, u, t, mulberry32(4242));
    assert.equal(r.side, side, side + ' 판정');
    hits[side] = r.damage;
  }
  assert.ok(hits.front < hits.flank, `정면 ${hits.front} < 측면 ${hits.flank}`);
  assert.ok(hits.flank < hits.rear, `측면 ${hits.flank} < 배후 ${hits.rear}`);
  // 배율이 그대로 곱해지는지 (같은 난수 → 같은 굴림)
  const ratioFlank = hits.flank / hits.front;
  const ratioRear = hits.rear / hits.front;
  assert.ok(Math.abs(ratioFlank - 1.25) < 0.03, `측면 배율 ${ratioFlank.toFixed(3)}`);
  assert.ok(Math.abs(ratioRear - 1.5) < 0.03, `배후 배율 ${ratioRear.toFixed(3)}`);
});

test('방향 로그: [측면 공격!] · [배후 기습!] 표시', () => {
  const f = duelField('eorin', 'eorin', 'N');
  const rf = B.resolveAttack(f.b, f.u, f.t, mulberry32(7));
  assert.ok(rf.lines[0].includes('[측면 공격!]'), rf.lines[0]);
  const r2 = duelField('eorin', 'eorin', 'E');
  const rr = B.resolveAttack(r2.b, r2.u, r2.t, mulberry32(7));
  assert.ok(rr.lines[0].includes('[배후 기습!]'), rr.lines[0]);
  const r3 = duelField('eorin', 'eorin', 'W');
  const rn = B.resolveAttack(r3.b, r3.u, r3.t, mulberry32(7));
  assert.ok(!rn.lines[0].includes('[측면') && !rn.lines[0].includes('[배후'), rn.lines[0]);
});

test('공격·이동하면 그 방향으로 돌아선다', () => {
  const { b, u, t } = duelField('eorin', 'eorin', 'W');
  t.y = 3; t.x = 4;              // 북쪽에 선 적
  const r = B.resolveAttack(b, u, t, mulberry32(3));
  assert.equal(u.dir, 'N', r.side);
  const b2 = B.createBattle({
    fromCityId: 'xuchang', toCityId: 'chenliu', attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['liu_bei'], defGenerals: ['yu_jin'], atkTroops: 3000, defTroops: 3000, seed: 2, playerSide: 'atk',
  });
  b2.grid.forEach((t2) => { t2.t = 'plain'; });
  const m = B.unitsOf(b2, 'atk')[0];
  m.x = 3; m.y = 4;
  B.moveUnit(b2, m, 3, 6);
  assert.equal(m.dir, 'S');
});

/* ---------- 진형 상성 ---------- */
test('진형 상성표: 돌격 → 포위 → 방어 → 돌격 순환', () => {
  const cyc = [['charge', 'pincer'], ['pincer', 'guard'], ['guard', 'charge']];
  for (const [a, d] of cyc) {
    for (const af of FORMATION_GROUPS[a].forms) {
      for (const df of FORMATION_GROUPS[d].forms) {
        assert.equal(formationRelation(af, df), 'advantage', `${FORMATIONS[af].ko} → ${FORMATIONS[df].ko}`);
        assert.equal(formationRelation(df, af), 'disadvantage', `${FORMATIONS[df].ko} → ${FORMATIONS[af].ko}`);
      }
    }
  }
  // 같은 무리끼리는 무상성
  assert.equal(formationRelation('eorin', 'bongsi'), 'neutral');
  assert.equal(formationRelation('bangwon', 'hyeongaek'), 'neutral');
  // 9종 모두 상성표에 들어 있다
  for (const id of CORE_FORMATIONS) assert.ok(formationGroup(id), id);
  assert.equal(new Set(CORE_FORMATIONS).size, 9);
  assert.equal(Object.keys(FORMATIONS).length, 11);
});

test('진형 상성 문구: 강한 상대·약한 상대', () => {
  assert.equal(formationCounterText('hakyik'), '방어진에 강함 · 돌격진에 약함');
  assert.equal(formationCounterText('bongsi'), '포위진에 강함 · 방어진에 약함');
  assert.equal(formationCounterText('bangwon'), '돌격진에 강함 · 포위진에 약함');
});

test('진형 배율이 대미지에 반영된다 (유리 ×1.25 · 불리 ×0.85)', () => {
  const neutral = duelField('bongsi', 'eorin', 'W');      // 돌격 vs 돌격 = 무상성
  const adv = duelField('bongsi', 'guhaeng', 'W');        // 돌격 vs 포위 = 유리
  const neutral2 = duelField('bangwon', 'sujin', 'W');    // 방어 vs 방어 = 무상성
  const dis = duelField('bangwon', 'hakyik', 'W');        // 방어 vs 포위 = 불리
  const dn = B.resolveAttack(neutral.b, neutral.u, neutral.t, mulberry32(99)).damage;
  const da = B.resolveAttack(adv.b, adv.u, adv.t, mulberry32(99)).damage;
  const dn2 = B.resolveAttack(neutral2.b, neutral2.u, neutral2.t, mulberry32(99)).damage;
  const dd = B.resolveAttack(dis.b, dis.u, dis.t, mulberry32(99)).damage;
  assert.equal(neutral.b.units.length, 2);
  assert.ok(Math.abs(da / dn - 1.25) < 0.03, `유리 ${da}/${dn}`);
  assert.ok(Math.abs(dd / dn2 - 0.85) < 0.03, `불리 ${dd}/${dn2}`);
  const edge = B.attackEdge(adv.u, adv.t);
  assert.equal(edge.relation, 'advantage');
  assert.equal(edge.formMult, 1.25);
  assert.ok(edge.tags.includes('[진형 유리!]'));
});

/* ---------- 진형 도트 대형 ---------- */
test('진형 도트: 11종 모두 8점 이상 · 사방 경계 안', () => {
  for (const id of Object.keys(FORMATIONS)) {
    const dots = FORMATION_DOTS[id];
    assert.ok(dots && dots.length >= 8, id + ' 점 ' + (dots ? dots.length : 0));
    for (const [x, y] of dots) {
      assert.ok(Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5, `${id} 경계 ${x},${y}`);
    }
    // 같은 점이 겹치지 않는다
    const uniq = new Set(dots.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`));
    assert.equal(uniq.size, dots.length, id + ' 중복 점');
  }
});

test('진형 도트: 방향 회전이 앞점을 그쪽으로 옮긴다', () => {
  const p = rotatePoint(0.4, 0, 'N');
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.y + 0.4) < 1e-9, 'N 회전');
  const tipE = frontTip('bongsi', 'E');
  assert.ok(tipE.x > 0.4 && Math.abs(tipE.y) < 1e-6, '동쪽 창끝');
  const tipN = frontTip('bongsi', 'N');
  assert.ok(tipN.y < -0.4, '북쪽 창끝');
  const tipW = frontTip('bongsi', 'W');
  assert.ok(tipW.x < -0.4, '서쪽 창끝');
  const tipS = frontTip('bongsi', 'S');
  assert.ok(tipS.y > 0.4, '남쪽 창끝');
  // 회전해도 점 개수는 그대로
  for (const d of ['N', 'E', 'S', 'W']) assert.equal(formationDots('hakyik', d).length, FORMATION_DOTS.hakyik.length);
});

test('진형 도트: 학익은 뒤가 비고 언월은 앞이 빈다 (실루엣 구분)', () => {
  const near = (pts, x, y, r = 0.16) => pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < r);
  assert.ok(!near(FORMATION_DOTS.hakyik, -0.30, 0), '학익 뒤 가운데는 빈틈');
  assert.ok(near(FORMATION_DOTS.hakyik, 0.46, 0), '학익 정면 끝');
  assert.ok(!near(FORMATION_DOTS.eonwol, 0.30, 0), '언월 앞 가운데는 빈틈(뿔만)');
  assert.ok(near(FORMATION_DOTS.eonwol, 0.42, 0.38), '언월 오른뿔');
  // 서로 다른 그림
  const key = (id) => FORMATION_DOTS[id].map(([x, y]) => `${x},${y}`).sort().join('|');
  const keys = new Set(Object.keys(FORMATION_DOTS).map(key));
  assert.equal(keys.size, Object.keys(FORMATION_DOTS).length);
});
