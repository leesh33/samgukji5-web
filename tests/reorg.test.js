import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as B from '../js/battle.js';

/* 부대 편성 — 병사 재편(배분·회수) · 병종 변경 · 출진 연동 · 세이브 호환 */

const newGame = (seed = 11) => E.createGame('s194', 'jojo', seed);
const sumAssigned = (s, cityId) =>
  E.generalsInCity(s, cityId).reduce((n, g) => n + E.assignedOf(s, g.id), 0);

/* ---------- 기본값 ---------- */
test('새 게임: 모든 장수의 편성 병력은 0, 병종은 원래 병과', () => {
  const s = newGame(3);
  for (const g of Object.values(s.generals)) {
    assert.equal(g.assignedTroops, 0, `${g.id} 편성`);
    assert.equal(g.arm, null, `${g.id} 병종 변경 없음`);
  }
  const b = E.armyBreakdown(s, 'chenliu');
  assert.equal(b.total, s.cities.chenliu.troops);
  assert.equal(b.assigned, 0);
  assert.equal(b.reserve, b.total, '처음에는 모두 예비병');
  const row = b.rows.find((r) => r.gid === 'xiahou_dun');
  assert.equal(row.arm, '기병');
  assert.equal(row.baseArm, '기병');
  assert.equal(row.changed, false);
  assert.equal(row.cap, 7500);
});

/* ---------- 병사 재편 ---------- */
test('병사 재편: 장수마다 나눠 맡기면 배분 합계와 예비병이 갈린다', () => {
  const s = newGame(5);
  const c = s.cities.chenliu;
  c.troops = 11000;                       // 하후돈 8,000 · 조인 3,000 예시
  const res = E.applyReorg(s, 'chenliu', { xiahou_dun: 8000, cao_ren: 3000 });
  assert.equal(res.ok, true, res.msg);
  assert.equal(E.assignedOf(s, 'xiahou_dun'), 7500, '일반 직위 지휘 상한 7,500까지만');
  assert.equal(E.assignedOf(s, 'cao_ren'), 3000);
  const b = E.armyBreakdown(s, 'chenliu');
  assert.equal(b.total, 11000, '성 총병력은 그대로');
  assert.equal(b.assigned, 10500);
  assert.equal(b.reserve, 500);
  assert.equal(b.reserve, b.total - b.assigned);
  assert.equal(sumAssigned(s, 'chenliu'), b.assigned);
});

test('병사 재편: 지휘 상한을 올리면 더 맡길 수 있다', () => {
  const s = newGame(6);
  s.cities.chenliu.troops = 20000;
  s.generals.xiahou_dun.rank = 6;         // 대장군 · 10,000
  const res = E.applyReorg(s, 'chenliu', { xiahou_dun: 8000 });
  assert.equal(res.ok, true);
  assert.equal(E.assignedOf(s, 'xiahou_dun'), 8000);
  assert.equal(E.armyBreakdown(s, 'chenliu').reserve, 12000);
});

test('병사 재편: 배분 합계가 성 총병력을 넘으면 거부한다', () => {
  const s = newGame(7);
  s.cities.chenliu.troops = 4000;
  const res = E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 3000 });
  assert.equal(res.ok, false);
  assert.match(res.msg, /넘습니다/);
  assert.equal(E.assignedOf(s, 'xiahou_dun'), 0, '거부되면 아무것도 바뀌지 않는다');
  assert.equal(E.assignedOf(s, 'cao_ren'), 0);
});

test('병사 재편: 0으로 되돌리면 그 병력은 예비병이 된다', () => {
  const s = newGame(8);
  s.cities.chenliu.troops = 9000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 2000 });
  E.applyReorg(s, 'chenliu', { xiahou_dun: 0, cao_ren: 0 });
  assert.equal(sumAssigned(s, 'chenliu'), 0);
  assert.equal(E.armyBreakdown(s, 'chenliu').reserve, 9000);
});

/* ---------- 균등 · 상한 · 모두 해제 ---------- */
test('균등 편성: 성 총병력을 장수들에게 고르게 나누고 예비병을 남기지 않는다', () => {
  const s = newGame(9);
  s.cities.chenliu.troops = 9000;
  const plan = E.reorgPlan(s, 'chenliu', 'even');
  const gens = E.generalsInCity(s, 'chenliu');
  assert.equal(Object.keys(plan).length, gens.length);
  const vals = Object.values(plan);
  assert.equal(vals.reduce((a, b) => a + b, 0), 9000, '합계는 성 총병력');
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 1, '차이는 1명 이하');
  for (const g of gens) assert.ok(plan[g.id] <= E.maxTroopsOf(s, g.id), '상한 안');
});

test('균등 편성: 상한이 모자라면 상한까지 채우고 남는 병력은 예비병으로 둔다', () => {
  const s = newGame(10);
  s.cities.chenliu.troops = 90000;        // 9명 × 일반 7,500 = 67,500까지만 맡길 수 있다
  const plan = E.reorgPlan(s, 'chenliu', 'even');
  const vals = Object.values(plan);
  assert.equal(vals.reduce((a, b) => a + b, 0), 67500);
  for (const v of vals) assert.equal(v, 7500);
});

test('상한 채우기: 장수마다 지휘 상한까지 채운다', () => {
  const s = newGame(11);
  s.cities.chenliu.troops = 12000;
  s.generals.xiahou_dun.rank = 1;         // 비장군 10,000
  const plan = E.reorgPlan(s, 'chenliu', 'max');
  assert.equal(plan.xiahou_dun, 10000);
  const rest = Object.values(plan).reduce((a, b) => a + b, 0);
  assert.equal(rest, 12000, '병력이 모자라면 총병력까지만');
});

test('모두 해제: 편성을 모두 비운다', () => {
  const s = newGame(12);
  s.cities.chenliu.troops = 12000;
  E.applyReorg(s, 'chenliu', E.reorgPlan(s, 'chenliu', 'even'));
  assert.ok(E.armyBreakdown(s, 'chenliu').assigned > 0);
  const plan = E.reorgPlan(s, 'chenliu', 'none');
  for (const v of Object.values(plan)) assert.equal(v, 0);
  E.applyReorg(s, 'chenliu', plan);
  assert.equal(E.armyBreakdown(s, 'chenliu').assigned, 0);
});

/* ---------- 병종 변경 ---------- */
test('병종 변경: 금 100을 쓰고 행동력은 쓰지 않는다', () => {
  const s = newGame(13);
  const c = s.cities.chenliu;
  const gold = c.gold;
  const ap = s.actionPoints;
  const res = E.changeArm(s, 'chenliu', 'cao_ren', '기병');
  assert.equal(res.ok, true, res.msg);
  assert.equal(res.before, '보병');
  assert.equal(res.after, '기병');
  assert.equal(c.gold, gold - E.ARM_CHANGE_GOLD);
  assert.equal(s.actionPoints, ap, '행동력 0');
  assert.equal(E.armOf(s, 'cao_ren'), '기병');
  assert.equal(E.armIsChanged(s, 'cao_ren'), true);
  assert.equal(s.generals.cao_ren.acted, false, '이번 달 행동도 쓰지 않는다');
});

test('병종 변경: 보병 · 기병 · 궁병 셋을 오가고 원래 병과로 돌아오면 변경 없음이 된다', () => {
  const s = newGame(14);
  s.cities.chenliu.gold = 2000;
  for (const arm of ['기병', '궁병', '보병']) {
    const res = E.changeArm(s, 'chenliu', 'cao_ren', arm);
    assert.equal(res.ok, true, `${arm} ${res.msg}`);
    assert.equal(E.armOf(s, 'cao_ren'), arm);
  }
  assert.equal(s.generals.cao_ren.arm, null, '원래 병과로 돌아오면 저장값도 비운다');
  assert.equal(E.armIsChanged(s, 'cao_ren'), false);
  assert.deepEqual(E.REORG_ARMS, ['보병', '기병', '궁병']);
});

test('병종 변경: 같은 병종·금 부족·아군 장수 아님은 거부한다', () => {
  const s = newGame(15);
  const same = E.changeArm(s, 'chenliu', 'cao_ren', '보병');
  assert.equal(same.ok, false);
  assert.match(same.msg, /이미/);

  s.cities.chenliu.gold = 50;
  const poor = E.changeArm(s, 'chenliu', 'cao_ren', '기병');
  assert.equal(poor.ok, false);
  assert.match(poor.msg, /금/);
  assert.equal(E.armOf(s, 'cao_ren'), '보병');

  s.cities.chenliu.gold = 2000;
  const far = E.changeArm(s, 'chenliu', 'lv_bu', '기병');
  assert.equal(far.ok, false);
  assert.match(far.msg, /아군 장수가 아닙니다/);
});

test('병종 변경은 전투에 넘어가는 장수 정보에도 반영된다', () => {
  const s = newGame(16);
  s.cities.chenliu.gold = 2000;
  assert.equal(E.generalMap(s).cao_ren.arms, '보병');
  E.changeArm(s, 'chenliu', 'cao_ren', '궁병');
  assert.equal(E.generalMap(s).cao_ren.arms, '궁병');
  assert.equal(E.GENERAL_BY_ID.cao_ren.arms, '보병', '원본 데이터는 건드리지 않는다');
});

/* ---------- 출진 연동 ---------- */
test('출진: 편성 병력이 있으면 그 병력으로 나서고 성 총병력에서 빠진다', () => {
  const s = newGame(17);
  const c = s.cities.chenliu;
  c.troops = 9000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 2000 });
  assert.equal(E.armyBreakdown(s, 'chenliu').reserve, 4000);

  const setup = E.battleSetup(s, 'chenliu', 'puyang', {
    atkGenerals: ['xiahou_dun', 'cao_ren'], useAssignments: true,
  });
  assert.equal(setup.atkTroops, 5000, '편성 합계가 출진 병력');
  assert.deepEqual(setup.troopsByGeneral, { xiahou_dun: 3000, cao_ren: 2000 });
  assert.equal(c.troops, 4000, '성 총병력에서 차감');
  assert.equal(E.assignedOf(s, 'xiahou_dun'), 0, '떠난 장수의 편성은 비운다');
  assert.equal(E.armyBreakdown(s, 'chenliu').reserve, 4000, '남은 병력은 예비병');

  const battle = B.createBattle({ ...setup, seed: 3, generals: E.generalMap(s) });
  const units = B.unitsOf(battle, 'atk');
  const byGid = Object.fromEntries(units.map((u) => [u.gid, u.troops]));
  assert.equal(byGid.xiahou_dun, 3000);
  assert.equal(byGid.cao_ren, 2000);
  assert.equal(units.reduce((n, u) => n + u.troops, 0), 5000);
});

test('출진: 편성이 하나도 없으면 기존 자동 배분을 그대로 쓴다', () => {
  const s = newGame(18);
  const c = s.cities.chenliu;
  c.troops = 20000;
  const before = c.troops;
  const setup = E.battleSetup(s, 'chenliu', 'puyang', {
    atkGenerals: ['xiahou_dun', 'cao_ren'], useAssignments: true,
  });
  assert.equal(setup.march, null);
  assert.equal(setup.atkTroops, 15000, '지휘 상한 2 × 7,500');
  assert.equal(c.troops, before, '자동 배분은 전투 결과에서 깎인다');
});

test('출진: 패배하면 살아 돌아온 병력이 성의 예비병으로 복귀한다', () => {
  const s = newGame(19);
  const c = s.cities.chenliu;
  c.troops = 9000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 2000 });
  const setup = E.battleSetup(s, 'chenliu', 'puyang', {
    atkGenerals: ['xiahou_dun', 'cao_ren'], useAssignments: true,
  });
  assert.equal(c.troops, 4000);
  const out = E.applyBattleResult(s, {
    fromCityId: 'chenliu', toCityId: 'puyang',
    atkGenerals: ['xiahou_dun', 'cao_ren'], defGenerals: ['lv_bu'],
    winner: 'defender', atkLoss: 2000, defLoss: 500,
    atkSurvivors: 3000, defSurvivors: 2500,
    defeatedGenerals: [], capturedGenerals: [],
    march: setup.march,
  });
  assert.equal(out.returned, 3000, '5,000 중 2,000을 잃고 3,000이 돌아온다');
  assert.equal(c.troops, 7000, '예비 4,000 + 복귀 3,000');
  assert.equal(s.cities.puyang.owner, 'lubu', '성은 그대로');
});

test('출진: 이기면 생존 병력이 함락한 성에 들어가고 본성은 예비병만 남는다', () => {
  const s = newGame(20);
  const c = s.cities.chenliu;
  c.troops = 9000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 2000 });
  const setup = E.battleSetup(s, 'chenliu', 'puyang', {
    atkGenerals: ['xiahou_dun', 'cao_ren'], useAssignments: true,
  });
  E.applyBattleResult(s, {
    fromCityId: 'chenliu', toCityId: 'puyang',
    atkGenerals: ['xiahou_dun', 'cao_ren'], defGenerals: ['lv_bu'],
    winner: 'attacker', atkLoss: 1500, defLoss: 5000,
    atkSurvivors: 3500, defSurvivors: 0,
    defeatedGenerals: [], capturedGenerals: [],
    march: setup.march,
  }, () => 0.9);
  assert.equal(s.cities.puyang.owner, 'jojo');
  assert.equal(s.cities.puyang.troops, 3500, '생존 병력이 함락한 성에');
  assert.equal(c.troops, 4000, '본성은 예비병 4,000');
  assert.equal(E.assignedOf(s, 'xiahou_dun'), 0);
});

test('출진: 편성이 없는 장수에게는 남는 병력이 자동으로 붙는다', () => {
  const s = newGame(21);
  const c = s.cities.chenliu;
  c.troops = 9000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000 });
  const plan = E.marchPlan(s, 'chenliu', ['xiahou_dun', 'cao_ren']);
  assert.equal(plan.hasAssigned, true);
  assert.equal(plan.byGeneral.xiahou_dun, 3000);
  assert.equal(plan.byGeneral.cao_ren, 6000, '남는 6,000 전부');
  assert.equal(plan.total, 9000);
});

test('출진: 한 부대가 못 되는 편성 병력은 예비병에서 채워 400명으로 세운다', () => {
  const s = newGame(22);
  const c = s.cities.chenliu;
  c.troops = 3500;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 300 });
  const plan = E.marchPlan(s, 'chenliu', ['xiahou_dun', 'cao_ren']);
  assert.equal(plan.byGeneral.xiahou_dun, 3000);
  assert.equal(plan.byGeneral.cao_ren, 400, '모자란 100명은 예비병에서');
  assert.equal(plan.total, 3400);
});

test('출진: 병력도 예비병도 없는 장수는 전장에 세우지 않는다', () => {
  const s = newGame(29);
  const c = s.cities.chenliu;
  c.troops = 30;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 30 });
  assert.equal(E.assignedOf(s, 'xiahou_dun'), 30, '성 병력까지만 맡길 수 있다');
  const plan = E.marchPlan(s, 'chenliu', ['cao_ren']);
  assert.equal(plan.hasAssigned, false);
  assert.deepEqual(plan.byGeneral, {});
  assert.equal(plan.total, 0);
});

/* ---------- 이동 · 포로 ---------- */
test('장수가 다른 성으로 이동하면 편성 병력은 원래 성의 예비병으로 돌아간다', () => {
  const s = newGame(23);
  const c = s.cities.chenliu;
  c.troops = 9000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000 });
  s.actionPoints = 5;
  s.generals.xiahou_dun.acted = false;
  const dest = E.factionCities(s, 'jojo').find((x) => x.id !== 'chenliu').id;
  const res = E.moveGenerals(s, 'chenliu', dest, ['xiahou_dun']);
  assert.equal(res.ok, true, res.msg);
  assert.equal(E.assignedOf(s, 'xiahou_dun'), 0);
  assert.equal(c.troops, 9000, '성 총병력은 그대로');
  assert.equal(E.armyBreakdown(s, 'chenliu').reserve, 9000);
});

test('포로가 되거나 전사한 장수의 편성은 예비병으로 돌아간다', () => {
  const s = newGame(24);
  const c = s.cities.chenliu;
  c.troops = 9000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 2000 });
  s.generals.xiahou_dun.captive = true;
  s.generals.cao_ren.dead = true;
  E.reconcileAllAssignments(s);
  assert.equal(E.assignedOf(s, 'xiahou_dun'), 0);
  assert.equal(E.assignedOf(s, 'cao_ren'), 0);
  assert.equal(E.armyBreakdown(s, 'chenliu').reserve, 9000);
});

/* ---------- 성 병력이 줄면 편성이 함께 줄어든다 ---------- */
test('성 병력이 줄면 편성이 성 총병력을 넘지 않게 함께 줄어든다', () => {
  const s = newGame(25);
  const c = s.cities.chenliu;
  c.troops = 9000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 3000 });
  c.troops = 2500;                        // 기근·전투 손실
  E.reconcileAssignments(s, 'chenliu');
  const total = sumAssigned(s, 'chenliu');
  assert.ok(total <= 2500, `편성 ${total} ≤ 2500`);
  assert.equal(total, 2500, '남은 병력은 모두 편성에 남는다');
  assert.equal(E.armyBreakdown(s, 'chenliu').reserve, 0);
});

test('편성은 저장·복원해도 그대로 남는다', () => {
  const s = newGame(26);
  s.cities.chenliu.gold = 2000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 1500 });
  E.changeArm(s, 'chenliu', 'cao_ren', '궁병');
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.version, E.SAVE_VERSION);
  assert.equal(E.assignedOf(back, 'xiahou_dun'), 3000);
  assert.equal(E.assignedOf(back, 'cao_ren'), 1500);
  assert.equal(E.armOf(back, 'cao_ren'), '궁병');
  assert.equal(E.armyBreakdown(back, 'chenliu').assigned, 4500);
});

test('옛 저장(v11, 부대 편성 이전)은 편성 0 · 원래 병과로 열린다', () => {
  const s = newGame(27);
  s.cities.chenliu.troops = 9000;
  const raw = JSON.parse(E.serialize(s));
  raw.version = 11;
  for (const g of Object.values(raw.generals)) { delete g.assignedTroops; delete g.arm; }
  const back = E.deserialize(JSON.stringify(raw));
  assert.equal(back.version, E.SAVE_VERSION);
  for (const g of Object.values(back.generals)) {
    assert.equal(g.assignedTroops, 0);
    assert.equal(g.arm, null);
  }
  assert.equal(E.armyBreakdown(back, 'chenliu').reserve, 9000);
  assert.equal(E.armOf(back, 'xiahou_dun'), '기병', '원래 병과가 그대로 나온다');
});

/* ---------- 턴이 지나도 편성이 어긋나지 않는다 ---------- */
test('여러 달을 넘겨도 편성 합계 + 예비병 = 성 총병력이 유지된다', () => {
  const s = newGame(28);
  const c = s.cities.chenliu;
  c.troops = 12000;
  E.applyReorg(s, 'chenliu', { xiahou_dun: 3000, cao_ren: 2000, yue_jin: 1000 });
  for (let i = 0; i < 6; i++) {
    s.actionPoints = s.maxActionPoints;
    E.endTurnPhase1(s);
    E.endTurnPhase2(s);
    const b = E.armyBreakdown(s, 'chenliu');
    assert.equal(b.assigned + b.reserve, b.total, `${s.year}년 ${s.month}월 균형`);
    assert.ok(b.assigned <= b.total);
  }
});
