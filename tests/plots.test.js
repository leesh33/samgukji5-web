import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

function forceRoll(s, pred) {
  for (let k = 1; k < 6000; k++) {
    s.rngState = k;
    if (pred(E.rngOf(s)())) return s;
  }
  throw new Error('조건에 맞는 난수를 찾지 못했습니다.');
}

/* 계략을 쓸 수 있는 상황: 내 성 + 인접한 적 성 + 지력 높은 장수 */
function setup(seed = 41) {
  const s = E.createGame('s194', 'jojo', seed);
  for (const c of E.factionCities(s, s.playerId)) {
    const foes = E.neighborFoes(s, c.id);
    if (!foes.length) continue;
    const to = foes[0];
    const gens = E.generalsInCity(s, c.id).sort((a, b) => E.generalOf(s, b.id).int - E.generalOf(s, a.id).int);
    if (!gens.length) continue;
    c.gold = 5000;
    return { s, from: c.id, to, gid: gens[0].id, bestInt: E.generalOf(s, gens[0].id).int };
  }
  throw new Error('계략 상황을 만들지 못했습니다');
}

test('이간계: 적 장수 충성도가 10~20 떨어지고 금·행동력이 소모된다', () => {
  const { s, from, to, gid } = setup();
  const chance = E.plotChance(s, from, to, 'sow', gid);
  forceRoll(s, (v) => v < chance);
  const before = new Map(E.generalsInCity(s, to).map((g) => [g.id, g.loyalty]));
  const gold0 = s.cities[from].gold;
  const ap0 = s.actionPoints;
  const r = E.runPlot(s, from, to, 'sow', gid);
  assert.ok(r.ok, r.msg);
  assert.equal(r.success, true, r.msg);
  assert.equal(s.cities[from].gold, gold0 - 300);
  assert.equal(s.actionPoints, ap0 - 1);
  assert.equal(s.generals[gid].acted, true);
  // 한 명이 10~20 떨어졌다
  let dropped = 0;
  for (const g of E.generalsInCity(s, to)) {
    const d = before.get(g.id) - g.loyalty;
    if (d > 0) dropped = Math.max(dropped, d);
  }
  assert.ok(dropped >= 10 && dropped <= 20, '충성 하락 ' + dropped);
  assert.match(r.msg, /충성도/);
});

test('이간계 효과로 등용 성공률이 올라간다', () => {
  const { s, to, gid } = setup(43);
  const victim = E.generalsInCity(s, to)[0];
  const before = E.recruitChance(s, victim.id);
  victim.loyalty = Math.max(0, victim.loyalty - 20);
  const after = E.recruitChance(s, victim.id);
  assert.ok(after > before, `${before} → ${after}`);
  assert.ok(E.plotChance(s, s.playerId ? E.factionCities(s, s.playerId)[0].id : to, to, 'sow', gid) > 0);
});

test('정탐: 3턴 동안 적 성의 장수·충성·훈련을 볼 수 있고 기한이 지나면 닫힌다', () => {
  const { s, from, to, gid } = setup(47);
  forceRoll(s, (v) => v < E.plotChance(s, from, to, 'scout', gid));
  assert.equal(E.isScouted(s, to), false);
  const r = E.runPlot(s, from, to, 'scout', gid);
  assert.equal(r.success, true, r.msg);
  assert.equal(E.isScouted(s, to), true);
  assert.equal(E.scoutTurnsLeft(s, to), E.SCOUT_TURNS);
  const info = E.scoutedInfo(s, to);
  assert.equal(info.cityId, to);
  assert.ok(info.generals.length >= 1);
  const g0 = info.generals[0];
  assert.ok(typeof g0.loyalty === 'number');
  assert.ok(typeof g0.lead === 'number' && typeof g0.war === 'number');
  assert.ok(g0.formation);
  assert.ok(info.train >= 0 && info.order >= 0);

  s.turn += E.SCOUT_TURNS;
  assert.equal(E.isScouted(s, to), false);
  assert.equal(E.scoutTurnsLeft(s, to), 0);
});

test('유언비어: 적 성의 치안·훈련·금·식량이 모두 줄어든다', () => {
  const { s, from, to, gid } = setup(53);
  const c = s.cities[to];
  const b = { order: c.order, train: c.train, gold: c.gold, food: c.food };
  forceRoll(s, (v) => v < E.plotChance(s, from, to, 'rumor', gid));
  const r = E.runPlot(s, from, to, 'rumor', gid);
  assert.equal(r.success, true, r.msg);
  assert.ok(c.order < b.order);
  assert.ok(c.train < b.train);
  assert.ok(c.gold < b.gold);
  assert.ok(c.food < b.food);
  assert.match(r.msg, /유언비어/);
});

test('계략 실패: 효과 없이 금만 잃는다', () => {
  const { s, from, to, gid } = setup(59);
  const c = s.cities[to];
  const b = { order: c.order, train: c.train, gold: c.gold, food: c.food };
  const loyalties = E.generalsInCity(s, to).map((g) => g.loyalty);
  const gold0 = s.cities[from].gold;
  forceRoll(s, (v) => v >= E.plotChance(s, from, to, 'sow', gid));
  const r = E.runPlot(s, from, to, 'sow', gid);
  assert.equal(r.ok, true);
  assert.equal(r.success, false);
  assert.equal(s.cities[from].gold, gold0 - 300);
  assert.equal(c.order, b.order);
  assert.equal(c.gold, b.gold);
  assert.deepEqual(E.generalsInCity(s, to).map((g) => g.loyalty), loyalties);
  assert.equal(E.isScouted(s, to), false);
});

test('계략 성공률: 지력이 높고 신산이면 오르고, 적 지력이 높으면 내린다', () => {
  const { s, from, to, gid } = setup(61);
  const low = E.plotChance(s, from, to, 'sow', gid);
  const t = E.generalOf(s, gid);
  const copy = { ...t, int: 100, skill: 'sinsan' };
  s.customGenerals = { ...(s.customGenerals || {}), test_plot: copy };
  s.generals.test_plot = { id: 'test_plot', faction: s.playerId, city: from, loyalty: 100, acted: false, captive: false, dead: false };
  const high = E.plotChance(s, from, to, 'sow', 'test_plot');
  assert.ok(high > low, `${low} → ${high}`);
  assert.ok(high <= 0.95 && low >= 0.15);
});

test('계략 조건: 비인접·아군 성·동맹 세력·아군 장수 아님은 모두 막힌다', () => {
  const { s, from, to, gid } = setup(67);
  const notAdjacent = Object.values(s.cities).find((c) => c.owner !== s.playerId && !E.isAdjacent(from, c.id));
  if (notAdjacent) {
    const chk = E.plotCheck(s, from, notAdjacent.id, 'scout', gid);
    assert.equal(chk.ok, false);
    assert.match(chk.why, /인접/);
  }
  const allyCity = E.adjacentFriends(s, from)[0];
  if (allyCity) assert.equal(E.plotCheck(s, from, allyCity, 'scout', gid).ok, false);

  // 동맹을 맺으면 계략도 막힌다
  s.diplomacy.ally[E.pairKey(s.playerId, s.cities[to].owner)] = 12;
  const chk = E.plotCheck(s, from, to, 'sow', gid);
  assert.equal(chk.ok, false);
  assert.match(chk.why, /동맹/);
  s.diplomacy.ally[E.pairKey(s.playerId, s.cities[to].owner)] = 0;

  // 적 성 장수는 파견할 수 없다
  const enemyGen = E.generalsInCity(s, to)[0];
  assert.equal(E.plotCheck(s, from, to, 'sow', enemyGen.id).ok, false);

  // 금이 모자라면 안 된다
  s.cities[from].gold = 10;
  const poor = E.plotCheck(s, from, to, 'sow', gid);
  assert.equal(poor.ok, false);
  assert.match(poor.why, /금/);
});

test('계략 로그 조사: 이름 받침에 맞게 -이/가가 붙는다(하후돈이)', () => {
  const { s, from, to } = setup(79);
  s.customGenerals = { ...(s.customGenerals || {}), josa_gen: { id: 'josa_gen', ko: '하후돈', lead: 82, war: 84, int: 78, pol: 60, cha: 62, arms: '기병', skill: 'dolgyeok', formations: ['eorin'] } };
  s.generals.josa_gen = { id: 'josa_gen', faction: s.playerId, city: from, loyalty: 100, acted: false, captive: false, dead: false };
  const chance = E.plotChance(s, from, to, 'scout', 'josa_gen');

  // 실패 로그: <이름>의 <계략>이
  forceRoll(s, (v) => v >= chance);
  const miss = E.runPlot(s, from, to, 'scout', 'josa_gen');
  assert.equal(miss.success, false, miss.msg);
  assert.match(miss.msg, /하후돈의 정탐이 적에게 들켰습니다/);
  assert.equal(/하후돈가|정탐가/.test(miss.msg), false, miss.msg);

  // 성공 로그: 하후돈이
  s.generals.josa_gen.acted = false;
  s.actionPoints = 5;
  s.cities[from].gold = 5000;
  forceRoll(s, (v) => v < chance);
  const hit = E.runPlot(s, from, to, 'scout', 'josa_gen');
  assert.equal(hit.success, true, hit.msg);
  assert.match(hit.msg, /^하후돈이 /);
  assert.equal(hit.msg.includes('하후돈가'), false, hit.msg);
});

test('계략은 행동력과 장수의 달 행동을 소모한다', () => {
  const { s, from, to, gid } = setup(71);
  s.actionPoints = 1;
  forceRoll(s, (v) => v < E.plotChance(s, from, to, 'scout', gid));
  assert.equal(E.runPlot(s, from, to, 'scout', gid).ok, true);
  assert.equal(s.actionPoints, 0);
  // 같은 장수는 다시 못 쓴다
  const again = E.plotCheck(s, from, to, 'scout', gid);
  assert.equal(again.ok, false);
  assert.equal(E.runPlot(s, from, to, 'scout', gid).ok, false);
});
