import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

const newGame = (seed = 11) => E.createGame('s194', 'jojo', seed);
const firstCity = (s) => E.factionCities(s, s.playerId)[0];

/* 원하는 판정이 나오는 난수 상태를 찾는다(테스트 결정성) */
function forceRoll(s, pred) {
  for (let k = 1; k < 8000; k++) {
    s.rngState = k;
    if (pred(E.rngOf(s)())) return s;
  }
  throw new Error('조건에 맞는 난수를 찾지 못했습니다.');
}

/* 플레이어가 인접한 적 성을 함락시키는 상황 */
function siege(seed = 7) {
  const s = E.createGame('s194', 'jojo', seed);
  const from = E.factionCities(s, 'jojo')[0];
  const to = E.adjacentEnemies(s, from.id)[0];
  const defGens = E.generalsInCity(s, to).map((g) => g.id);
  const res = {
    fromCityId: from.id, toCityId: to, winner: 'attacker',
    atkLoss: 600, defLoss: 2500, atkSurvivors: 4200,
    defeatedGenerals: defGens,
    playerSide: 'atk',
  };
  return { s, to, res, defGens };
}

test('친밀도 초기값: 모든 장수가 25~55, 같은 세이브는 같은 값', () => {
  const s = newGame(3);
  const ids = Object.keys(s.generals);
  assert.ok(ids.length > 100);
  for (const gid of ids) {
    const v = E.affinityOf(s, gid);
    assert.ok(v >= 25 && v <= 55, `${gid} 친밀도 ${v}`);
    assert.equal(typeof s.affinity[gid], 'number');
  }
  const again = newGame(3);
  assert.deepEqual(again.affinity, s.affinity, '같은 시드는 같은 친밀도');
  assert.equal(E.affinityLabel(90), '각별');
  assert.equal(E.affinityLabel(10), '서먹');
});

test('친밀도가 없는 옛 저장(v7)도 열리면 25~55로 채워진다', () => {
  const s = newGame(5);
  const raw = JSON.parse(E.serialize(s));
  raw.version = 7;
  delete raw.affinity;
  const back = E.deserialize(JSON.stringify(raw));
  assert.equal(back.version, E.SAVE_VERSION);
  const vals = Object.keys(back.generals).map((gid) => E.affinityOf(back, gid));
  assert.equal(vals.length > 0, true);
  for (const v of vals) assert.ok(v >= 25 && v <= 55, '기본 친밀도 ' + v);
});

test('대화: 충성도와 함께 친밀도가 6~10 오른다', () => {
  const s = newGame(13);
  const city = firstCity(s);
  const g = E.talkPartners(s, city.id)[0];
  const aff0 = E.affinityOf(s, g.id);
  const r = E.talkToGeneral(s, city.id, g.id);
  assert.ok(r.ok, r.msg);
  assert.ok(r.affGain >= 6 && r.affGain <= 10, '친밀도 상승 ' + r.affGain);
  assert.equal(E.affinityOf(s, g.id), Math.min(100, aff0 + r.affGain));
  assert.match(r.msg, /친밀도/);
});

test('포상: 충성도와 함께 친밀도가 5 오른다', () => {
  const s = newGame(17);
  const city = firstCity(s);
  const officer = E.bestOfficer(s, city.id, 'cha');
  const target = E.generalsInCity(s, city.id).find((g) => g.id !== s.factions[s.playerId].lord && g.id !== officer.id);
  assert.ok(target, '포상할 장수');
  const aff0 = E.affinityOf(s, target.id);
  const r = E.runCommand(s, 'reward', { cityId: city.id, officerId: officer.id, rewardId: target.id });
  assert.ok(r.ok, r.msg);
  assert.equal(E.affinityOf(s, target.id), Math.min(100, aff0 + 5));
  assert.match(r.msg, /친밀도/);
});

test('친교: 금 200·행동력 1로 친밀도가 12~18 오른다', () => {
  const s = newGame(19);
  const city = firstCity(s);
  const free = E.freeGeneralsInCity(s, city.id)[0];
  assert.ok(free, '재야 장수');
  const gold0 = E.factionGold(s, s.playerId);
  const ap0 = s.actionPoints;
  const aff0 = E.affinityOf(s, free.id);
  const r = E.befriend(s, free.id);
  assert.ok(r.ok, r.msg);
  assert.equal(E.factionGold(s, s.playerId), gold0 - E.BEFRIEND.gold);
  assert.equal(s.actionPoints, ap0 - 1);
  assert.ok(r.gain >= 12 && r.gain <= 18, '친밀도 상승 ' + r.gain);
  assert.equal(E.affinityOf(s, free.id), Math.min(100, aff0 + r.gain));
  // 금이 모자라면 실행되지 않는다
  for (const c of E.factionCities(s, s.playerId)) c.gold = 10;
  const again = E.befriend(s, free.id);
  assert.equal(again.ok, false);
  assert.match(again.msg, /금/);
  // 아군 장수에게는 친교를 쓰지 않는다
  const own = E.generalsInCity(s, city.id)[0];
  assert.equal(E.befriendCheck(s, own.id).ok, false);
});

test('재야 등용 성공률: 친밀도가 낮으면 12% 이하, 높으면 크게 오른다', () => {
  const s = newGame(23);
  const city = firstCity(s);
  const free = E.freeGeneralsInCity(s, city.id)[0];
  s.affinity[free.id] = 20;
  const low = E.hireChance(s, city.id, free.id);
  s.affinity[free.id] = 38;
  const lowMid = E.hireChance(s, city.id, free.id);
  s.affinity[free.id] = 60;
  const mid = E.hireChance(s, city.id, free.id);
  s.affinity[free.id] = 85;
  const high = E.hireChance(s, city.id, free.id);
  assert.ok(low <= 0.12, '낮은 친밀도 ' + low);
  assert.ok(lowMid <= 0.12, '친밀 40 미만은 12% 상한 ' + lowMid);
  assert.ok(mid > low + 0.15, `${low} → ${mid}`);
  assert.ok(high > mid, `${mid} → ${high}`);
  assert.ok(high >= 0.6, '높은 친밀도 ' + high);
});

test('재야 낯섦 구간 등용 상한 12%: 인덕 보정이 있어도 넘지 않고, 친교로 40을 넘기면 상승', () => {
  const s = newGame(23);
  const city = firstCity(s);
  const free = E.freeGeneralsInCity(s, city.id)[0];
  // 지도 위 모든 재야 장수를 낯섦으로 두고 12% 상한을 확인
  for (const g of Object.values(s.generals)) {
    if (g.faction || g.dead || g.captive) continue;
    if (!g.city || !s.cities[g.city]) continue;
    s.affinity[g.id] = 35;
    const c = E.hireChance(s, g.city, g.id);
    assert.ok(c <= 0.12, `${g.id} 낯섦 등용 성공률 ${c}`);
  }
  // 군주·대상이 인덕이어도 상한은 그대로
  const lord = E.lordOf(s, s.playerId);
  const lordSkill = lord.skill;
  lord.skill = 'indeok';
  const t = E.generalOf(s, free.id);
  const targetSkill = t.skill;
  t.skill = 'indeok';
  s.affinity[free.id] = 38;
  assert.ok(E.hireChance(s, city.id, free.id) <= 0.12, '인덕 보정 후에도 12% 상한');
  lord.skill = lordSkill;
  t.skill = targetSkill;
  // 친교로 친밀 40을 넘기면 상한이 풀린다
  s.affinity[free.id] = 30;
  const before = E.hireChance(s, city.id, free.id);
  const r = E.befriend(s, free.id);
  assert.ok(r.ok, r.msg);
  assert.ok(r.aff >= 40, '친교 후 친밀 ' + r.aff);
  const after = E.hireChance(s, city.id, free.id);
  assert.ok(after > before, `친교 후 상승 ${before} → ${after}`);
  assert.ok(after > 0.12, '알음 구간은 12% 상한이 없다 ' + after);
});

test('타국 장수: 충성 85 이상에 친밀도 60 미만이면 성공률 5% 이하', () => {
  const s = newGame(29);
  const city = firstCity(s);
  const foe = E.diplomacyView(s)[0];
  const fg = E.factionGenerals(s, foe.id)[0];
  fg.loyalty = 95;
  s.affinity[fg.id] = 30;
  const hard = E.hireChance(s, city.id, fg.id);
  assert.ok(hard <= 0.05, '충성 95·친밀 30 = ' + hard);
  s.affinity[fg.id] = 70;
  const warm = E.hireChance(s, city.id, fg.id);
  assert.ok(warm > hard, `${hard} → ${warm}`);
  fg.loyalty = 40;
  s.affinity[fg.id] = 30;
  const shaken = E.hireChance(s, city.id, fg.id);
  assert.ok(shaken > hard, '충성이 낮으면 쉬워진다 ' + shaken);
});

test('등용 실패: 친밀도가 3 떨어진다', () => {
  const s = newGame(31);
  const city = firstCity(s);
  const officer = E.bestOfficer(s, city.id, 'cha');
  const free = E.freeGeneralsInCity(s, city.id)[0];
  s.affinity[free.id] = 50;
  const chance = E.hireChance(s, city.id, free.id, officer.id);
  forceRoll(s, (v) => v >= chance);
  const r = E.runCommand(s, 'hire', { cityId: city.id, officerId: officer.id, hireId: free.id });
  assert.ok(r.ok, r.msg);
  assert.equal(free.faction || null, null, '여전히 재야');
  assert.equal(E.affinityOf(s, free.id), 47);
});

test('포로 해방: 친밀도가 25 오른다', () => {
  const { s, res } = siege(41);
  E.applyBattleResult(s, res, () => 0);
  const gid = s.pendingPrisoners[0].gid;
  s.affinity[gid] = 30;
  const r = E.releasePrisoner(s, gid);
  assert.ok(r.ok, r.msg);
  assert.equal(E.affinityOf(s, gid), 55);
  assert.match(r.msg, /친밀도/);
});

test('포로 참수: 같은 세력 장수들의 친밀도가 내려간다', () => {
  const { s, res } = siege(43);
  E.applyBattleResult(s, res, () => 0);
  const rec = s.pendingPrisoners[0];
  const same = E.factionGenerals(s, rec.faction).filter((g) => g.id !== rec.gid);
  for (const g of same) s.affinity[g.id] = 50;
  const r = E.executePrisoner(s, rec.gid);
  assert.ok(r.ok, r.msg);
  for (const g of same) {
    assert.ok(E.affinityOf(s, g.id) < 50, `${g.id} 친밀도 ${E.affinityOf(s, g.id)}`);
  }
});

test('포로 등용: 친밀도가 성공률에 반영되고 성공하면 친밀도가 오른다', () => {
  const { s, res } = siege(47);
  E.applyBattleResult(s, res, () => 0);
  const gid = s.pendingPrisoners[0].gid;
  s.affinity[gid] = 20;
  s.generals[gid].loyalty = 80;
  const cold = E.recruitChance(s, gid);
  s.affinity[gid] = 75;
  const warm = E.recruitChance(s, gid);
  assert.ok(warm > cold, `${cold} → ${warm}`);
  const before = E.affinityOf(s, gid);
  const r = E.recruitPrisoner(s, gid, () => 0);
  assert.equal(r.accepted, true, r.msg);
  assert.ok(E.affinityOf(s, gid) > before, '합류 뒤 친밀도 상승');
});
