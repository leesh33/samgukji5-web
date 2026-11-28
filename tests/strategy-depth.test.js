import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { GENERAL_BY_ID } from '../js/data.js';

/* rngState를 바꿔 가며 원하는 판정이 나오는 난수를 찾는다(테스트 결정성) */
function forceRoll(s, pred) {
  for (let k = 1; k < 8000; k++) {
    s.rngState = k;
    if (pred(E.rngOf(s)())) return s;
  }
  throw new Error('조건에 맞는 난수를 찾지 못했습니다.');
}

const newGame = (seed = 11, scenario = 's194', faction = 'jojo') => E.createGame(scenario, faction, seed);

/* 아군 성 하나 — 장수가 있고 금이 넉넉한 곳 */
function homeCity(s) {
  const cs = E.factionCities(s, s.playerId).filter((c) => E.generalsInCity(s, c.id).length);
  cs.sort((a, b) => b.gold - a.gold);
  return cs[0].id;
}

/* ---------- 집중 탐색 ---------- */

test('집중 탐색 후보: 재야 장수만, 이 성은 빼고, 아직 나오지 않은 인물은 뺀다', () => {
  const s = newGame(3);
  const cid = homeCity(s);
  const list = E.focusSearchCandidates(s, cid);
  assert.ok(list.length > 0, '재야 후보가 있어야 한다');
  for (const g of list) {
    const st = s.generals[g.id];
    assert.ok(!st.faction, '재야만');
    assert.notEqual(st.city, cid, '이미 이 성에 있는 장수는 후보가 아니다');
    assert.ok(E.hasAppeared(s, g.id), '등장연도 전 인물은 나오지 않는다');
    assert.ok(g.chance > 0 && g.chance <= 0.8);
  }
  // 194년에 아직 나오지 않은 후기 장수(등애 235)는 목록에 없다
  assert.equal(list.some((g) => g.id === 'dengai'), false);
});

test('집중 탐색 확률: 이름난 명장일수록 사자를 사양한다', () => {
  const s = newGame(5);
  const cid = homeCity(s);
  const list = E.focusSearchCandidates(s, cid);
  const strong = list[0];               // 능력치 합계 1위
  const weak = list[list.length - 1];   // 가장 약한 인물
  assert.ok(strong.total > weak.total);
  assert.ok(strong.chance < weak.chance, `${strong.ko} ${strong.chance} vs ${weak.ko} ${weak.chance}`);
});

test('집중 탐색 성공: 금 500·행동력 1을 쓰고 그 장수가 이 성으로 온다', () => {
  const s = newGame(7);
  const cid = homeCity(s);
  const officer = E.bestOfficer(s, cid, 'int');
  assert.ok(officer);
  const target = E.focusSearchCandidates(s, cid)[0];
  const gold0 = s.cities[cid].gold;
  const ap0 = s.actionPoints;
  const chance = E.focusSearchChance(s, cid, target.id, officer.id);
  forceRoll(s, (v) => v < chance);
  const r = E.focusSearch(s, cid, officer.id, target.id);
  assert.ok(r.ok, r.msg);
  assert.equal(r.hit, true, r.msg);
  assert.equal(s.cities[cid].gold, gold0 - E.FOCUS_SEARCH.gold);
  assert.equal(s.actionPoints, ap0 - 1);
  assert.equal(s.generals[officer.id].acted, true);
  assert.equal(s.generals[target.id].city, cid, '초빙에 응해 이 성으로 와야 한다');
  assert.equal(s.generals[target.id].faction, null, '아직 재야 — 등용은 따로 한다');
  assert.ok(r.merit > 0, '사자로 나선 장수는 공적을 쌓는다');
  assert.equal(E.meritOf(s, officer.id), r.merit);
  assert.match(r.msg, /왔습니다/);
  // 온 장수는 이 성의 재야 목록에 잡혀 등용할 수 있다
  assert.ok(E.freeGeneralsInCity(s, cid).some((g) => g.id === target.id));
  assert.ok(E.hireChance(s, cid, target.id, null) > 0);
});

test('집중 탐색 실패: 금은 나가고 친밀도만 조금 오르며 장수는 그대로 있다', () => {
  const s = newGame(9);
  const cid = homeCity(s);
  const officer = E.bestOfficer(s, cid, 'int');
  const target = E.focusSearchCandidates(s, cid)[0];
  const before = { city: s.generals[target.id].city, aff: E.affinityOf(s, target.id), gold: s.cities[cid].gold };
  const chance = E.focusSearchChance(s, cid, target.id, officer.id);
  forceRoll(s, (v) => v >= chance);
  const r = E.focusSearch(s, cid, officer.id, target.id);
  assert.ok(r.ok, r.msg);
  assert.equal(r.hit, false, r.msg);
  assert.equal(s.cities[cid].gold, before.gold - E.FOCUS_SEARCH.gold);
  assert.equal(s.generals[target.id].city, before.city, '사양하면 원래 성에 남는다');
  assert.equal(E.affinityOf(s, target.id), Math.min(100, before.aff + 3));
  assert.equal(r.merit, 0);
});

test('집중 탐색 거절: 금·행동력·이미 이 성·군주 아닌 성·재야 아님', () => {
  const s = newGame(13);
  const cid = homeCity(s);
  const target = E.focusSearchCandidates(s, cid)[0];
  const officer = E.bestOfficer(s, cid, 'int');

  assert.equal(E.focusSearchCheck(s, cid, officer.id, target.id).ok, true);

  s.cities[cid].gold = 10;
  assert.match(E.focusSearchCheck(s, cid, officer.id, target.id).why, /금이 부족/);
  s.cities[cid].gold = 5000;

  s.actionPoints = 0;
  assert.match(E.focusSearchCheck(s, cid, officer.id, target.id).why, /행동력/);
  s.actionPoints = 6;

  // 아군 장수는 초빙 대상이 아니다
  assert.match(E.focusSearchCheck(s, cid, officer.id, officer.id).why, /재야 장수가 아닙니다/);

  // 초빙을 마친 사자는 이번 달에 다시 나서지 못한다
  forceRoll(s, () => true);
  E.focusSearch(s, cid, officer.id, target.id);
  assert.match(E.focusSearchCheck(s, cid, officer.id, target.id).why, /이미 움직였습니다/);

  // 재야가 아닌 성(적 성)에서는 청할 수 없다
  const foeCity = Object.values(s.cities).find((c) => c.owner && c.owner !== s.playerId);
  assert.match(E.focusSearchCheck(s, foeCity.id, null, target.id).why, /아군 성/);
});

test('집중 탐색: 성 장수가 12명을 넘으면 더 받지 않는다', () => {
  const s = newGame(17);
  const cid = homeCity(s);
  const target = E.focusSearchCandidates(s, cid)[0];
  const officer = E.bestOfficer(s, cid, 'int');
  // 이 성 장수를 12명으로 채운다(다른 성의 아군 장수를 옮겨 온다)
  const others = Object.values(s.generals).filter((g) => g.faction === s.playerId && g.city !== cid && !g.captive && !g.dead);
  for (const g of others) {
    if (E.generalsInCity(s, cid).length >= E.MAX_OFFICERS_PER_CITY) break;
    g.city = cid;
  }
  if (E.generalsInCity(s, cid).length >= 12) {
    assert.match(E.focusSearchCheck(s, cid, officer ? officer.id : null, target.id).why, /12명/);
  }
});

test('집중 탐색: 저장·복원해도 초빙한 장수와 외교 약속이 유지된다', () => {
  const s = newGame(19);
  const cid = homeCity(s);
  const officer = E.bestOfficer(s, cid, 'int');
  const target = E.focusSearchCandidates(s, cid)[0];
  const chance = E.focusSearchChance(s, cid, target.id, officer.id);
  forceRoll(s, (v) => v < chance);
  E.focusSearch(s, cid, officer.id, target.id);
  assert.equal(s.generals[target.id].city, cid);
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.generals[target.id].city, cid);
  assert.ok(back.diplomacy.joint && typeof back.diplomacy.joint === 'object');
});

/* ---------- 공동 공격 ---------- */

/* 플레이어와 맞닿은 세력 하나 */
function neighborFaction(s) {
  for (const c of E.factionCities(s, s.playerId)) {
    const n = E.neighborFoes(s, c.id);
    if (n.length) return s.cities[n[0]].owner;
  }
  return null;
}

/* 그 세력이 함께 칠 수 있는 성이 있는 세력 — 없으면 그 성을 만들어 준다 */
function allyWithTarget(s) {
  for (const fid of Object.keys(s.factions)) {
    if (fid === s.playerId || !s.factions[fid].alive) continue;
    const targets = E.jointTargets(s, fid);
    if (targets.length) return { fid, target: targets[0] };
  }
  return null;
}

test('공동 공격: 동맹이 아니고 우호도가 65 미만이면 청할 수 없다', () => {
  const s = newGame(21);
  const pick = allyWithTarget(s) || { fid: neighborFaction(s) };
  assert.ok(pick.fid);
  s.diplomacy.rel[E.pairKey(s.playerId, pick.fid)] = 40;
  s.diplomacy.ally[E.pairKey(s.playerId, pick.fid)] = 0;
  const chk = E.diplomacyCheck(s, 'joint', pick.fid);
  assert.equal(chk.ok, false);
  assert.match(chk.why, /동맹|우호도 65/);
});

test('공동 공격 대상: 그 세력의 성과 맞닿은 남의 성만, 우리·동맹 성과 휴전 상대는 빠진다', () => {
  const s = newGame(23);
  let found = null;
  for (const fid of Object.keys(s.factions)) {
    if (fid === s.playerId || !s.factions[fid].alive) continue;
    if (E.factionCities(s, fid).length < 2) continue;
    const t = E.jointTargets(s, fid);
    if (t.length) { found = { fid, t }; break; }
  }
  assert.ok(found, '공동 공격 후보가 있는 세력이 있어야 한다');
  for (const t of found.t) {
    const tc = s.cities[t.id];
    assert.notEqual(tc.owner, s.playerId);
    assert.notEqual(tc.owner, found.fid);
    assert.equal(E.isPacified(s, found.fid, tc.owner), false);
    assert.equal(E.isPacified(s, s.playerId, tc.owner), false);
  }
});

test('공동 공격 승낙: 금 400·행동력 1을 쓰고 그 달에 약속이 잡힌다', () => {
  const s = newGame(25);
  const pick = allyWithTarget(s);
  assert.ok(pick, '대상이 있어야 한다');
  s.diplomacy.ally[E.pairKey(s.playerId, pick.fid)] = 6;   // 동맹 중
  s.diplomacy.rel[E.pairKey(s.playerId, pick.fid)] = 80;
  s.actionPoints = 6;
  const gold0 = E.factionGold(s, s.playerId);
  const rel0 = E.relationOf(s, s.playerId, pick.fid);
  const chance = E.jointChance(s, pick.fid, pick.target.id);
  assert.ok(chance > 0.05);
  forceRoll(s, (v) => v < chance);
  const r = E.requestJointAttack(s, pick.fid, pick.target.id);
  assert.ok(r.ok, r.msg);
  assert.equal(r.accepted, true, r.msg);
  assert.equal(E.factionGold(s, s.playerId), gold0 - E.DIPLO.joint.gold);
  assert.equal(s.actionPoints, 5);
  assert.equal(E.relationOf(s, s.playerId, pick.fid), Math.min(100, rel0 + 4));
  const p = E.jointPromiseOf(s, pick.fid);
  assert.ok(p, '약속이 저장돼야 한다');
  assert.equal(p.city, pick.target.id);
  assert.equal(p.months, E.JOINT_MONTHS);
  assert.match(r.msg, /함께 칩니다/);
});

test('공동 공격 거절: 금은 나가고 우호도가 6 내려가며 약속은 없다', () => {
  const s = newGame(27);
  const pick = allyWithTarget(s);
  assert.ok(pick);
  s.diplomacy.ally[E.pairKey(s.playerId, pick.fid)] = 6;
  s.diplomacy.rel[E.pairKey(s.playerId, pick.fid)] = 80;
  s.actionPoints = 6;
  const rel0 = E.relationOf(s, s.playerId, pick.fid);
  const chance = E.jointChance(s, pick.fid, pick.target.id);
  forceRoll(s, (v) => v >= chance);
  const r = E.requestJointAttack(s, pick.fid, pick.target.id);
  assert.ok(r.ok, r.msg);
  assert.equal(r.accepted, false, r.msg);
  assert.equal(E.relationOf(s, s.playerId, pick.fid), rel0 - 6);
  assert.equal(E.jointPromiseOf(s, pick.fid), null);
});

test('공동 공격: 맞닿지 않은 성을 지정하면 거절된다', () => {
  const s = newGame(29);
  const pick = allyWithTarget(s);
  assert.ok(pick);
  s.diplomacy.ally[E.pairKey(s.playerId, pick.fid)] = 6;
  const far = Object.values(s.cities).find((c) => c.owner === s.playerId);
  const r = E.requestJointAttack(s, pick.fid, far.id);
  assert.equal(r.ok, false);
});

test('공동 공격 약속: 턴이 끝나면 그 세력이 실제로 그 성을 치고 약속은 풀린다', () => {
  const s = newGame(31);
  const pick = allyWithTarget(s);
  assert.ok(pick);
  const target = pick.target.id;
  s.diplomacy.ally[E.pairKey(s.playerId, pick.fid)] = 6;
  s.diplomacy.rel[E.pairKey(s.playerId, pick.fid)] = 80;
  s.actionPoints = 6;
  forceRoll(s, () => true);
  const r = E.requestJointAttack(s, pick.fid, target);
  assert.ok(r.ok && r.accepted, r.msg);
  // 그 세력이 그 성을 이길 만한 힘을 준다(수비의 0.95배 문턱 — 약속은 미루지 않는다)
  for (const c of E.factionCities(s, pick.fid)) {
    if (!E.isAdjacent(c.id, target)) continue;
    c.troops = Math.max(c.troops, Math.round(E.cityPower(s, target, true) * 1.4));
    c.train = 100;
  }
  const before = s.log.length;
  s.turn += 1;
  E.endTurnPhase1(s);
  const logs = s.log.slice(before).map((l) => l.text);
  assert.ok(logs.some((t) => t.includes('[공동 공격]')), logs.join(' | '));
  assert.equal(E.jointPromiseOf(s, pick.fid), null, '약속은 한 달만 산다');
});

test('공동 공격 약속: 힘이 모자라면 지키지 못하고 약속은 풀린다', () => {
  const s = newGame(33);
  const pick = allyWithTarget(s);
  assert.ok(pick);
  s.diplomacy.ally[E.pairKey(s.playerId, pick.fid)] = 6;
  s.diplomacy.rel[E.pairKey(s.playerId, pick.fid)] = 80;
  s.actionPoints = 6;
  forceRoll(s, () => true);
  const r = E.requestJointAttack(s, pick.fid, pick.target.id);
  assert.ok(r.ok && r.accepted, r.msg);
  for (const c of E.factionCities(s, pick.fid)) {
    if (!E.isAdjacent(c.id, pick.target.id)) continue;
    c.troops = 1600;
    c.train = 10;
  }
  const before = s.log.length;
  s.turn += 1;
  E.endTurnPhase1(s);
  const logs = s.log.slice(before).map((l) => l.text);
  assert.ok(logs.some((t) => t.includes('지키지 못했습니다')), logs.join(' | '));
  assert.equal(E.jointPromiseOf(s, pick.fid), null);
});

test('공동 공격: 멸망한 세력의 약속은 외교 정리에서 지워진다', () => {
  const s = newGame(35);
  const pick = allyWithTarget(s);
  assert.ok(pick);
  s.diplomacy.joint[pick.fid] = { city: pick.target.id, months: 1 };
  s.factions[pick.fid].alive = false;
  E.cleanDiplomacy(s);
  assert.equal(s.diplomacy.joint[pick.fid], undefined);
});

test('문서: 도움말과 README 에 집중 탐색·공동 공격이 있다', async () => {
  const { readFileSync } = await import('node:fs');
  const ui = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(ui, /집중 탐색/);
  assert.match(ui, /공동 공격/);
  assert.match(readme, /집중 탐색/);
  assert.match(readme, /공동 공격/);
});
