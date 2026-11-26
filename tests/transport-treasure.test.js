import test from 'node:test';
import assert from 'node:assert/strict';
import { TREASURES, TREASURE_BY_ID, TREASURE_STAT_KO } from '../js/data.js';
import * as E from '../js/engine.js';

/* 194년 조조 시나리오 — 진류 ↔ 허창이 인접한 아군 성이다 */
const newGame = (seed = 11) => E.createGame('s194', 'jojo', seed);
const SRC = 'chenliu';
const DST = 'xuchang';

/* 창고에 넣는다 — 다른 세력 장수가 지니고 있던 보물은 먼저 임자를 비운다 */
function stock(s, ...tids) {
  for (const tid of tids) {
    delete s.treasures.where[tid];
    if (!s.treasures.owned.includes(tid)) s.treasures.owned.push(tid);
  }
}

function officerOf(s, cityId) {
  const g = E.generalsInCity(s, cityId).find((x) => !x.acted && !x.captive);
  assert.ok(g, '이 성에 움직일 수 있는 장수가 있다');
  return g.id;
}

/* ---------- 병력 수송 ---------- */

test('수송: 금·식량·병력을 함께 보내면 양쪽 수치가 즉시 바뀐다', () => {
  const s = newGame(101);
  const gid = officerOf(s, SRC);
  const from = s.cities[SRC];
  const to = s.cities[DST];
  from.troops = 5000; from.train = 80; from.gold = 4000; from.food = 9000;
  to.troops = 1000; to.train = 40; to.gold = 500; to.food = 1000;

  const res = E.runCommand(s, 'transport', {
    cityId: SRC, officerId: gid, targetCityId: DST, gold: 1000, food: 2000, troops: 1000,
  });
  assert.ok(res.ok, res.msg);
  assert.equal(from.gold, 3000);
  assert.equal(to.gold, 1500);
  assert.equal(from.food, 7000);
  assert.equal(to.food, 3000);
  assert.equal(from.troops, 4000);
  assert.equal(to.troops, 2000);
  // 훈련도는 병력 수로 가중 평균한다 — (40×1000 + 80×1000) / 2000 = 60
  assert.equal(to.train, 60);
  assert.match(res.msg, /병력 1,000명/);
  assert.equal(s.actionPoints, s.maxActionPoints - E.commandCost('transport'));
});

test('수송: 병력만 단독으로 보낼 수 있다', () => {
  const s = newGame(103);
  const gid = officerOf(s, SRC);
  const from = s.cities[SRC];
  const to = s.cities[DST];
  from.troops = 3000; from.gold = 5000; from.food = 5000;
  to.troops = 800; to.gold = 700; to.food = 700;

  const res = E.runCommand(s, 'transport', {
    cityId: SRC, officerId: gid, targetCityId: DST, gold: 0, food: 0, troops: 600,
  });
  assert.ok(res.ok, res.msg);
  assert.equal(from.gold, 5000);
  assert.equal(to.gold, 700);
  assert.equal(from.food, 5000);
  assert.equal(to.food, 700);
  assert.equal(from.troops, 2400);
  assert.equal(to.troops, 1400);
  assert.match(res.msg, /^진류에서 허창으로 병력 600명을 보냈습니다\.$/);
});

test('수송: 출발 성 보유 병력보다 많이 보내도 보유분까지만 나간다', () => {
  const s = newGame(105);
  const gid = officerOf(s, SRC);
  const from = s.cities[SRC];
  const to = s.cities[DST];
  from.troops = 1200;
  to.troops = 500;

  const res = E.runCommand(s, 'transport', {
    cityId: SRC, officerId: gid, targetCityId: DST, gold: 0, food: 0, troops: 999999,
  });
  assert.ok(res.ok, res.msg);
  assert.equal(from.troops, 0);
  assert.equal(to.troops, 1700);
  assert.ok(from.troops >= 0);
});

test('수송: 도착 성 주둔 상한을 넘는 병력은 상한까지만 들어가고 나머지는 출발 성에 남는다', () => {
  const s = newGame(107);
  const gid = officerOf(s, SRC);
  const from = s.cities[SRC];
  const to = s.cities[DST];
  const cap = E.cityTroopsCap(s, DST);
  from.troops = 6000;
  to.troops = cap - 300;

  const res = E.runCommand(s, 'transport', {
    cityId: SRC, officerId: gid, targetCityId: DST, gold: 0, food: 0, troops: 4000,
  });
  assert.ok(res.ok, res.msg);
  assert.equal(to.troops, cap, '도착 성은 주둔 상한에서 멈춘다');
  assert.equal(from.troops, 6000 - 300, '들어가지 못한 병력은 출발 성에 남는다');
  assert.match(res.msg, /주둔 상한까지만/);
});

test('수송: 도착 성 빈자리가 없으면 병력 수송을 거절한다', () => {
  const s = newGame(109);
  const gid = officerOf(s, SRC);
  const from = s.cities[SRC];
  const to = s.cities[DST];
  from.troops = 6000;
  to.troops = E.cityTroopsCap(s, DST);

  const res = E.runCommand(s, 'transport', {
    cityId: SRC, officerId: gid, targetCityId: DST, gold: 0, food: 0, troops: 500,
  });
  assert.equal(res.ok, false);
  assert.match(res.msg, /주둔 병력이 상한/);
  assert.equal(from.troops, 6000, '거절되면 병력이 줄지 않는다');
});

test('수송: 보낼 것이 아무것도 없으면 실행되지 않는다', () => {
  const s = newGame(111);
  const gid = officerOf(s, SRC);
  const res = E.runCommand(s, 'transport', {
    cityId: SRC, officerId: gid, targetCityId: DST, gold: 0, food: 0, troops: 0,
  });
  assert.equal(res.ok, false);
  assert.match(res.msg, /보낼 물자나 병력이 없습니다/);
});

/* ---------- 보물 종류별 장착 ---------- */

test('보물: 여포처럼 처음부터 여러 종류를 지닌 장수는 둘 다 장착된 것으로 친다', () => {
  const s = newGame(121);
  const held = E.treasuresOf(s, 'lu_bu');
  assert.deepEqual(held.map((t) => t.id).sort(), ['bangcheon', 'jeoktoma']);
  assert.equal(E.treasureOf(s, 'lu_bu').id, held[0].id, '한 개만 볼 때는 첫 보물');

  const bonus = E.treasureBonusOf(s, 'lu_bu');
  assert.equal(bonus.lead, TREASURE_BY_ID.jeoktoma.bonus.lead);
  assert.equal(bonus.cha, TREASURE_BY_ID.jeoktoma.bonus.cha);
  assert.equal(bonus.war, TREASURE_BY_ID.bangcheon.bonus.war);

  const base = E.generalOf(s, 'lu_bu');
  const eff = E.effectiveGeneral(s, 'lu_bu');
  assert.equal(eff.war, base.war + TREASURE_BY_ID.bangcheon.bonus.war);
  assert.equal(eff.lead, base.lead + TREASURE_BY_ID.jeoktoma.bonus.lead);
  assert.equal(eff.treasure, '적토마·방천화극');
});

test('보물: 종류가 다르면 함께 지니고, 능력치·충성 보너스가 모두 합산된다', () => {
  const s = newGame(123);
  const gid = 'xiahou_dun';
  const base = E.generalOf(s, gid);
  const picks = ['jeokro', 'chilseong', 'yongrin', 'sonja', 'okse']; // 말·무기·갑옷·서적·보물
  stock(s, ...picks);

  for (const tid of picks) {
    const res = E.awardTreasure(s, tid, gid);
    assert.ok(res.ok, res.msg);
  }
  assert.equal(E.treasuresOf(s, gid).length, 5, '종류별 1개씩 최대 5개');
  assert.equal(new Set(E.treasuresOf(s, gid).map((t) => t.kind)).size, 5);

  const want = {};
  for (const tid of picks) for (const [k, v] of Object.entries(TREASURE_BY_ID[tid].bonus)) want[k] = (want[k] || 0) + v;
  const bonus = E.treasureBonusOf(s, gid);
  for (const k of Object.keys(TREASURE_STAT_KO)) assert.equal(bonus[k] || 0, want[k] || 0, `${TREASURE_STAT_KO[k]} 합산`);

  const eff = E.effectiveGeneral(s, gid);
  for (const k of Object.keys(TREASURE_STAT_KO)) assert.equal(eff[k], Math.max(1, Math.min(200, base[k] + (want[k] || 0))));
  // 충성 보너스(옥새 +4)도 합산 대상이다
  assert.equal(bonus.loyal, TREASURE_BY_ID.okse.loyal);
});

test('보물: 같은 종류를 주면 그 종류만 창고로 돌아가고 다른 종류는 유지된다', () => {
  const s = newGame(125);
  const gid = 'xiahou_dun';
  stock(s, 'uicheon', 'okse', 'chilseong');

  assert.ok(E.awardTreasure(s, 'uicheon', gid).ok);
  assert.ok(E.awardTreasure(s, 'okse', gid).ok);
  assert.deepEqual(E.treasuresOf(s, gid).map((t) => t.id).sort(), ['okse', 'uicheon']);

  const res = E.awardTreasure(s, 'chilseong', gid);   // 무기 교체
  assert.ok(res.ok, res.msg);
  assert.deepEqual(E.treasuresOf(s, gid).map((t) => t.id).sort(), ['chilseong', 'okse']);
  assert.equal(E.treasureHolder(s, 'uicheon'), null, '같은 종류(무기)였던 의천검만 창고로');
  assert.equal(E.treasureHolder(s, 'okse'), gid, '다른 종류(보물)는 그대로');
  assert.match(res.msg, /창고로 돌아갔습니다/);
  assert.deepEqual(res.replaced, ['uicheon']);
});

test('보물: 아군 장수가 여러 개를 지녀도 정복·참수 시 전부 거둬진다', () => {
  const s = newGame(127);
  const foe = Object.keys(s.factions).find((fid) => fid !== s.playerId && s.factions[fid].alive);
  const gid = E.factionGenerals(s, foe)[0].id;
  s.treasures.where.jeoktoma = gid;
  s.treasures.where.cheongryong = gid;
  for (const c of E.factionCities(s, foe)) c.owner = s.playerId;
  E.checkFactionDeath(s, foe, s.playerId);
  assert.ok(s.treasures.owned.includes('jeoktoma'));
  assert.ok(s.treasures.owned.includes('cheongryong'));
  assert.equal(E.treasureHolder(s, 'jeoktoma'), null);
  assert.equal(E.treasureHolder(s, 'cheongryong'), null);
});

test('보물: TREASURES 는 다섯 종류로 나뉜다', () => {
  assert.deepEqual([...new Set(TREASURES.map((t) => t.kind))].sort(), ['갑옷', '무기', '말', '보물', '서적'].sort());
});
