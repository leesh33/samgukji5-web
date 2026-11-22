import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

/* rngState를 바꿔 가며 원하는 판정이 나오는 난수를 찾는다(테스트 결정성) */
function forceRoll(s, pred) {
  for (let k = 1; k < 5000; k++) {
    s.rngState = k;
    if (pred(E.rngOf(s)())) return s;
  }
  throw new Error('조건에 맞는 난수를 찾지 못했습니다.');
}

const newGame = (seed = 11) => E.createGame('s194', 'jojo', seed);

/* 조조와 이웃한 다른 세력 하나 */
function neighborFaction(s) {
  for (const c of E.factionCities(s, s.playerId)) {
    const n = E.neighborFoes(s, c.id);
    if (n.length) return s.cities[n[0]].owner;
  }
  return null;
}

test('외교 초기값: 모든 세력 쌍에 우호도 0~100, 동맹·정전 0', () => {
  const s = newGame(3);
  const ids = Object.keys(s.factions);
  assert.ok(ids.length > 3);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const k = E.pairKey(ids[i], ids[j]);
      assert.ok(typeof s.diplomacy.rel[k] === 'number');
      assert.ok(s.diplomacy.rel[k] >= 0 && s.diplomacy.rel[k] <= 100);
      assert.equal(s.diplomacy.ally[k], 0);
      assert.equal(s.diplomacy.truce[k], 0);
    }
  }
  assert.equal(E.isPacified(s, 'jojo', 'liubei'), false);
});

test('친선 사절: 금 300과 행동력 1을 쓰고 우호도가 15~25 오른다', () => {
  const s = newGame(5);
  const target = E.diplomacyView(s)[0].id;
  const gold0 = E.factionGold(s, s.playerId);
  const ap0 = s.actionPoints;
  const rel0 = E.relationOf(s, s.playerId, target);
  const r = E.sendEnvoy(s, target);
  assert.ok(r.ok, r.msg);
  assert.equal(E.factionGold(s, s.playerId), gold0 - 300);
  assert.equal(s.actionPoints, ap0 - 1);
  assert.equal(E.relationOf(s, s.playerId, target), rel0 + r.gain);
  assert.ok(r.gain >= 15 && r.gain <= 25, 'gain ' + r.gain);
  assert.match(r.msg, /우호도/);
});

test('동맹 제의 성공: 12개월 동맹 · 서로 공격 불가 · isPacified', () => {
  const s = newGame(7);
  const foe = neighborFaction(s);
  assert.ok(foe, '이웃 세력이 있어야 한다');
  // 우호도를 올려 성사 가능성을 높인다
  s.diplomacy.rel[E.pairKey(s.playerId, foe)] = 95;
  const chance = E.allianceChance(s, foe);
  forceRoll(s, (v) => v < chance);
  const r = E.proposeAlliance(s, foe);
  assert.ok(r.ok, r.msg);
  assert.equal(r.accepted, true, r.msg);
  assert.equal(E.isAllied(s, s.playerId, foe), true);
  assert.equal(E.allyMonths(s, s.playerId, foe), E.ALLIANCE_MONTHS);
  assert.equal(E.isPacified(s, s.playerId, foe), true);
  assert.equal(E.relationLabel(s, s.playerId, foe), '동맹');
  // 이웃한 동맹 성은 공격 대상에서 빠진다
  for (const c of E.factionCities(s, s.playerId)) {
    for (const n of E.adjacentEnemies(s, c.id)) {
      assert.notEqual(s.cities[n].owner, foe, '동맹 성은 출진 대상이 아니다');
    }
    for (const n of E.neighborFoes(s, c.id)) {
      if (s.cities[n].owner === foe) assert.equal(E.adjacentEnemies(s, c.id).includes(n), false);
    }
  }
});

test('동맹 제의 거절: 금은 들고 동맹은 맺어지지 않는다', () => {
  const s = newGame(9);
  const foe = neighborFaction(s);
  s.diplomacy.rel[E.pairKey(s.playerId, foe)] = 20;
  const gold0 = E.factionGold(s, s.playerId);
  forceRoll(s, (v) => v >= E.allianceChance(s, foe));
  const r = E.proposeAlliance(s, foe);
  assert.ok(r.ok, r.msg);
  assert.equal(r.accepted, false);
  assert.equal(E.isAllied(s, s.playerId, foe), false);
  assert.equal(E.factionGold(s, s.playerId), gold0 - 500);
});

test('정전 협정: 6개월 동안 공격 불가, 기한이 지나면 풀린다', () => {
  const s = newGame(13);
  const foe = neighborFaction(s);
  s.diplomacy.rel[E.pairKey(s.playerId, foe)] = 90;
  forceRoll(s, (v) => v < E.truceChance(s, foe));
  const r = E.proposeTruce(s, foe);
  assert.equal(r.accepted, true, r.msg);
  assert.equal(E.truceMonths(s, s.playerId, foe), E.TRUCE_MONTHS);
  assert.equal(E.relationLabel(s, s.playerId, foe), '정전');

  for (let i = 0; i < E.TRUCE_MONTHS - 1; i++) E.tickDiplomacy(s);
  assert.equal(E.isTruce(s, s.playerId, foe), true);
  E.tickDiplomacy(s);
  assert.equal(E.isTruce(s, s.playerId, foe), false);
  assert.equal(E.isPacified(s, s.playerId, foe), false);
});

test('동맹 파기: 즉시 공격 가능 · 명성 -15 · 타 세력 우호도 하락', () => {
  const s = newGame(17);
  const foe = neighborFaction(s);
  const others = Object.keys(s.factions).filter((f) => f !== s.playerId && f !== foe);
  const other = others[0];
  s.diplomacy.ally[E.pairKey(s.playerId, foe)] = 12;
  s.diplomacy.rel[E.pairKey(s.playerId, foe)] = 80;
  s.diplomacy.rel[E.pairKey(s.playerId, other)] = 60;
  const fame0 = s.factions[s.playerId].fame;
  const r = E.breakAlliance(s, foe);
  assert.ok(r.ok, r.msg);
  assert.equal(E.isAllied(s, s.playerId, foe), false);
  assert.equal(E.isPacified(s, s.playerId, foe), false);
  assert.ok(s.factions[s.playerId].fame <= fame0 - 15 + 0.001, '명성 ' + s.factions[s.playerId].fame);
  assert.ok(E.relationOf(s, s.playerId, other) < 60, '타 세력 우호도 하락');
  // 이제 이웃한 그 세력 성이 출진 대상으로 돌아온다
  const anyAdj = E.factionCities(s, s.playerId).some((c) => E.adjacentEnemies(s, c.id).some((n) => s.cities[n].owner === foe));
  assert.equal(anyAdj, true, '파기 뒤에는 공격 대상');
});

test('AI는 동맹·정전 중인 세력을 공격하지 않는다', () => {
  const s = newGame(21);
  const foes = new Set();
  for (const c of E.factionCities(s, s.playerId)) {
    for (const n of E.neighborFoes(s, c.id)) foes.add(s.cities[n].owner);
  }
  assert.ok(foes.size >= 1);
  for (const fid of foes) {
    s.diplomacy.ally[E.pairKey(s.playerId, fid)] = 60;
  }
  for (let i = 0; i < 24; i++) {
    E.endTurnPhase1(s);
    for (const b of s.pendingBattles) {
      assert.equal(foes.has(b.attackerFaction), false, `${b.attackerFaction}는 동맹인데 공격했다`);
    }
    s.pendingBattles = [];
    E.endTurnPhase2(s);
    s.pendingEvent = null;
    if (s.gameOver) break;
  }
  // 정전도 같은 규칙
  const s2 = newGame(22);
  const foe2 = neighborFaction(s2);
  s2.diplomacy.truce[E.pairKey(s2.playerId, foe2)] = 60;
  for (let i = 0; i < 12; i++) {
    E.endTurnPhase1(s2);
    for (const b of s2.pendingBattles) assert.notEqual(b.attackerFaction, foe2);
    s2.pendingBattles = [];
    E.endTurnPhase2(s2);
    s2.pendingEvent = null;
    if (s2.gameOver) break;
  }
});

test('세력이 멸망하면 외교 기록이 정리된다', () => {
  const s = newGame(25);
  const victim = Object.keys(s.factions).find((f) => f !== s.playerId);
  assert.ok(E.diplomacyView(s).some((d) => d.id === victim));
  for (const c of E.factionCities(s, victim)) c.owner = s.playerId;
  E.checkFactionDeath(s, victim);
  assert.equal(s.factions[victim].alive, false);
  assert.equal(E.diplomacyView(s).some((d) => d.id === victim), false);
  for (const shelf of [s.diplomacy.rel, s.diplomacy.ally, s.diplomacy.truce]) {
    for (const k of Object.keys(shelf)) {
      assert.equal(k.split('|').includes(victim), false, '남은 외교 기록 ' + k);
    }
  }
});

test('외교 조건: 금·행동력이 모자라면 실행되지 않는다', () => {
  const s = newGame(27);
  const target = E.diplomacyView(s)[0].id;
  s.actionPoints = 0;
  assert.equal(E.sendEnvoy(s, target).ok, false);
  s.actionPoints = 5;
  for (const c of E.factionCities(s, s.playerId)) c.gold = 10;
  const r = E.sendEnvoy(s, target);
  assert.equal(r.ok, false);
  assert.match(r.msg, /금/);
});

test('저장 양식 v6(외교·관직 이전)도 열리고 기본값으로 채워진다', () => {
  const s = newGame(29);
  const raw = JSON.parse(E.serialize(s));
  raw.version = 6;
  delete raw.diplomacy;
  delete raw.offices;
  delete raw.scouted;
  delete raw.pendingEvent;
  const back = E.deserialize(JSON.stringify(raw));
  assert.equal(back.version, E.SAVE_VERSION);
  assert.equal(back.version, 7);
  assert.ok(back.diplomacy && back.diplomacy.rel && typeof back.diplomacy.rel === 'object');
  const k = E.pairKey(back.playerId, Object.keys(back.factions).find((f) => f !== back.playerId));
  assert.equal(back.diplomacy.rel[k], 40);
  assert.equal(back.diplomacy.ally[k], 0);
  assert.deepEqual(back.scouted, {});
  assert.equal(back.pendingEvent, null);
  assert.equal(typeof back.offices[back.playerId], 'number');
  // 열어서 외교도 정상 동작
  const r = E.sendEnvoy(back, E.diplomacyView(back)[0].id);
  assert.ok(r.ok, r.msg);
});

test('동맹·정전 중인 성은 출진 자격에서도 막힌다', () => {
  const s = newGame(77);
  const from = E.factionCities(s, s.playerId).find((c) => E.adjacentEnemies(s, c.id).length);
  const to = E.adjacentEnemies(s, from.id)[0];
  const foe = s.cities[to].owner;
  assert.equal(E.canAttack(s, from.id, to).ok, true);
  s.diplomacy.ally[E.pairKey(s.playerId, foe)] = 12;
  const chk = E.canAttack(s, from.id, to);
  assert.equal(chk.ok, false);
  assert.match(chk.why, /동맹/);
  s.diplomacy.ally[E.pairKey(s.playerId, foe)] = 0;
  s.diplomacy.truce[E.pairKey(s.playerId, foe)] = 6;
  const chk2 = E.canAttack(s, from.id, to);
  assert.equal(chk2.ok, false);
  assert.match(chk2.why, /정전/);
});
