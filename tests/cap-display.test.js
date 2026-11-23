import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

/* 100에서 멈추는 수치(충성·훈련)는 "실제로 오른 만큼"만 알린다 —
 * 85 → 100처럼 상한에 걸리면 캡 전 수치(20)가 아니라 15를 보여 준다. */

const newGame = (seed = 71) => E.createGame('s194', 'jojo', seed);
const firstCity = (s) => E.factionCities(s, s.playerId)[0];
const freeOfficer = (s, cityId, skip = []) => E.generalsInCity(s, cityId)
  .find((g) => !g.acted && !skip.includes(g.id));

/* ---------- 포상 ---------- */
test('포상: 충성 85 → 100이면 "20"이 아니라 실제 15가 오른 것으로 알린다', () => {
  const s = newGame(72);
  const c = firstCity(s);
  const lord = s.factions[s.playerId].lord;
  const officer = E.bestOfficer(s, c.id, 'cha');
  const target = E.generalsInCity(s, c.id).find((g) => g.id !== lord && g.id !== officer.id);
  assert.ok(target, '포상할 장수');
  target.loyalty = 85;
  c.gold = 5000;
  s.actionPoints = 4;

  const r = E.runCommand(s, 'reward', { cityId: c.id, officerId: officer.id, rewardId: target.id });
  assert.ok(r.ok, r.msg);
  assert.equal(target.loyalty, 100, '충성은 100에서 멈춘다');
  assert.match(r.msg, /충성도가 15 올랐습니다/, r.msg);
  assert.match(r.msg, /충성 85 → 100/, r.msg);
  assert.equal(r.fx.delta, '충성 +15', '연출 변화량도 실제 상승분');
  assert.equal(s.log[s.log.length - 1].text, r.msg, '군보도 같은 문구');
});

test('포상: 충성 100인 장수에게는 금을 쓰지 않고 최대라고 알린다', () => {
  const s = newGame(73);
  const c = firstCity(s);
  const lord = s.factions[s.playerId].lord;
  const officer = E.bestOfficer(s, c.id, 'cha');
  const target = E.generalsInCity(s, c.id).find((g) => g.id !== lord && g.id !== officer.id);
  c.gold = 5000;
  target.loyalty = 100;
  s.actionPoints = 4;
  const ap0 = s.actionPoints;
  const gold0 = c.gold;

  const r = E.runCommand(s, 'reward', { cityId: c.id, officerId: officer.id, rewardId: target.id });
  assert.equal(r.ok, false);
  assert.match(r.msg, /이미 최대\(100\)/);
  assert.equal(c.gold, gold0, '금을 쓰지 않는다');
  assert.equal(s.actionPoints, ap0, '행동력도 쓰지 않는다');
});

test('포상: 충성이 97이면 실제 3만 오른 것으로 알린다', () => {
  const s = newGame(74);
  const c = firstCity(s);
  const lord = s.factions[s.playerId].lord;
  const officer = E.bestOfficer(s, c.id, 'cha');
  const target = E.generalsInCity(s, c.id).find((g) => g.id !== lord && g.id !== officer.id);
  target.loyalty = 97;
  c.gold = 5000;
  s.actionPoints = 4;

  const r = E.runCommand(s, 'reward', { cityId: c.id, officerId: officer.id, rewardId: target.id });
  assert.ok(r.ok, r.msg);
  assert.match(r.msg, /충성도가 3 올랐습니다/);
  assert.match(r.msg, /충성 97 → 100/);
  assert.equal(r.fx.delta, '충성 +3');
});

/* ---------- 훈련 ---------- */
test('훈련: 98에서 100이면 받은 양이 아니라 실제 2만 오른 것으로 알린다', () => {
  const s = newGame(75);
  const c = firstCity(s);
  c.train = 98;
  s.actionPoints = 4;
  const officer = freeOfficer(s, c.id);
  const r = E.runCommand(s, 'train', { cityId: c.id, officerId: officer.id });
  assert.ok(r.ok, r.msg);
  assert.equal(c.train, 100, '훈련은 100에서 멈춘다');
  assert.equal(r.gain, 2);
  assert.match(r.msg, /\(훈련 100\)/);
  assert.equal(r.fx.delta, '훈련 +2', '연출 변화량도 실제 상승분');
});

test('훈련: 100이면 0이 아니라 더 오르지 않는 것으로 처리한다', () => {
  const s = newGame(76);
  const c = firstCity(s);
  c.train = 100;
  s.actionPoints = 4;
  const officer = freeOfficer(s, c.id);
  const r = E.runCommand(s, 'train', { cityId: c.id, officerId: officer.id });
  assert.ok(r.ok, r.msg);
  assert.equal(r.gain, 0);
  assert.equal(r.fx.delta, '훈련 +0');
  assert.match(r.msg, /\(훈련 100\)/);
});

/* ---------- 장군 임명 ---------- */
test('장군 임명: 충성 98이면 "+5"가 아니라 실제 +2로 알린다', () => {
  const s = newGame(77);
  const gid = 'yue_jin';
  s.generals[gid].merit = 120;
  s.generals[gid].loyalty = 98;
  const res = E.promoteGeneral(s, gid);
  assert.ok(res.ok, res.msg);
  assert.equal(s.generals[gid].loyalty, 100);
  assert.equal(res.loyaltyGain, 2);
  assert.match(res.msg, /충성 \+2/);
  assert.equal(s.log[s.log.length - 1].text, res.msg);
});

/* ---------- 대회 하사 ---------- */
test('대회 금 하사: 충성 95면 +12가 아니라 실제 +5로 알린다', () => {
  const s = newGame(78);
  for (let i = 0; i < 40 && E.factionGenerals(s, s.playerId).length < 32; i++) {
    const free = Object.values(s.generals).find((g) => !g.faction && !g.dead && !g.captive);
    if (!free) break;
    free.faction = s.playerId;
    free.city = firstCity(s).id;
    free.loyalty = 70;
  }
  s.month = 5;
  const tv = E.maybeOpenTournament(s);
  assert.ok(tv, '대회가 열린다');
  const champ = s.generals[tv.championId];
  champ.loyalty = 95;
  const res = E.resolveTournamentReward(s, 'gold');
  assert.ok(res.ok, res.msg);
  assert.equal(champ.loyalty, 100);
  assert.equal(s.lastTournament.loyaltyGain, 5);
  assert.match(res.msg, /충성 \+5/);
  assert.match(res.msg, /충성 95 → 100/);
});

/* ---------- 다른 100 상한 수치도 어긋나지 않는다 ---------- */
test('개발·상업·수리·치안은 상한에 걸리면 실제 오른 만큼만 알린다', () => {
  const KO = { agri: '농업', comm: '상업', order: '치안', water: '수리' };
  for (const [type, key, cap] of [['agri', 'agri', 130], ['comm', 'comm', 130], ['order', 'order', 100], ['water', 'water', 130]]) {
    const s = newGame(79);
    const c = s.cities.xuchang;   // 중형
    c[key] = cap - 1;
    s.actionPoints = 4;
    const officer = freeOfficer(s, 'xuchang');
    const r = E.runCommand(s, type, { cityId: 'xuchang', officerId: officer.id });
    assert.ok(r.ok, `${type} ${r.msg}`);
    assert.equal(c[key], cap, `${key} 상한 ${cap}`);
    assert.equal(r.gain, 1, `${type} 실제 상승분`);
    assert.equal(r.fx.delta, `${KO[key]} +1`, `${type} 연출 변화량`);
    assert.ok(r.msg.includes(`${KO[key]} ${cap}`), r.msg);
  }
});
