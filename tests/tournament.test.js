import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

const newGame = (seed = 41) => E.createGame('s194', 'jojo', seed);

/* 재야 장수를 아군으로 끌어와 세력 장수 수를 맞춘다 */
function giveGenerals(s, n) {
  const city = E.factionCities(s, s.playerId)[0].id;
  const pool = Object.values(s.generals).filter((g) => !g.faction && !g.dead && !g.captive);
  let added = 0;
  for (const g of pool) {
    if (added >= n) break;
    g.faction = s.playerId; g.city = city; g.loyalty = 70; g.acted = false;
    added++;
  }
  return E.factionGenerals(s, s.playerId).length;
}

const topBy = (s, key, n = 8) => E.factionGenerals(s, s.playerId)
  .map((g) => {
    const t = E.effectiveGeneral(s, g.id);
    return { gid: g.id, v: t[key], lead: t.lead };
  })
  .sort((a, b) => b.v - a.v || b.lead - a.lead || (a.gid < b.gid ? -1 : 1))
  .slice(0, n)
  .map((x) => x.gid);

test('대회 조건: 5월은 무예, 10월은 설전 — 장수 30명 이상일 때만', () => {
  assert.equal(E.TOURNAMENT.minGenerals, 30);
  assert.equal(E.tournamentKindOf(5), 'martial');
  assert.equal(E.tournamentKindOf(10), 'debate');
  assert.equal(E.tournamentKindOf(4), null);
  assert.equal(E.tournamentKindOf(6), null);

  const s = newGame();
  giveGenerals(s, 10); // 30명 미만
  s.month = 5;
  assert.ok(E.factionGenerals(s, s.playerId).length < 30);
  assert.equal(E.canHoldTournament(s), false);
  assert.equal(E.maybeOpenTournament(s), null);
  assert.equal(s.pendingTournament, null);

  giveGenerals(s, 30);
  assert.ok(E.factionGenerals(s, s.playerId).length >= 30);
  assert.equal(E.canHoldTournament(s), true);
  const tv = E.maybeOpenTournament(s);
  assert.ok(tv, '대회가 열린다');
  assert.equal(tv.kind, 'martial');
  assert.equal(tv.month, 5);
  assert.equal(s.pendingTournament, tv);
});

test('5월 무예 대회: 무력 상위 8명이 8강→4강→결승으로 겨루고 우승자를 낸다', () => {
  const s = newGame(43);
  giveGenerals(s, 34);
  s.month = 5;
  const tv = E.maybeOpenTournament(s);
  assert.equal(tv.entrants, 8);
  assert.equal(tv.rounds.length, 3);
  assert.deepEqual(tv.rounds.map((r) => r.length), [4, 2, 1]);

  const top = topBy(s, 'war');
  const seeds = [0, 7, 3, 4, 2, 5, 1, 6];
  const order = seeds.map((i) => top[i]);
  assert.deepEqual(tv.rounds[0].map((m) => m.a.gid), order.filter((_, i) => i % 2 === 0));
  assert.deepEqual(tv.rounds[0].map((m) => m.b.gid), order.filter((_, i) => i % 2 === 1));

  // 참가자 전원의 무력이 대회 밖 장수보다 높다
  const outside = E.factionGenerals(s, s.playerId).filter((g) => !order.includes(g.id));
  const minStat = Math.min(...order.map((gid) => E.effectiveGeneral(s, gid).war));
  for (const g of outside) assert.ok(E.effectiveGeneral(s, g.id).war <= minStat);

  // 4강 진출자는 8강 승자, 결승 진출자는 4강 승자, 우승자는 결승 승자
  const qfWinners = tv.rounds[0].map((m) => (m.winner === 'a' ? m.a.gid : m.b.gid));
  assert.deepEqual(tv.rounds[1].map((m) => m.a.gid), [qfWinners[0], qfWinners[2]]);
  assert.deepEqual(tv.rounds[1].map((m) => m.b.gid), [qfWinners[1], qfWinners[3]]);
  const sfWinners = tv.rounds[1].map((m) => (m.winner === 'a' ? m.a.gid : m.b.gid));
  assert.deepEqual(tv.rounds[2][0].a.gid, sfWinners[0]);
  assert.deepEqual(tv.rounds[2][0].b.gid, sfWinners[1]);
  const finalWinner = tv.rounds[2][0].winner === 'a' ? tv.rounds[2][0].a.gid : tv.rounds[2][0].b.gid;
  assert.equal(tv.championId, finalWinner);
  assert.ok(qfWinners.includes(tv.championId));
});

test('10월 설전 대회: 지력 상위 8명으로 겨룬다', () => {
  const s = newGame(47);
  giveGenerals(s, 34);
  s.month = 10;
  const tv = E.maybeOpenTournament(s);
  assert.equal(tv.kind, 'debate');
  assert.equal(tv.statKo, '지력');
  const top = topBy(s, 'int');
  const seeds = [0, 7, 3, 4, 2, 5, 1, 6];
  assert.deepEqual(tv.rounds[0].map((m) => m.a.gid), seeds.filter((_, i) => i % 2 === 0).map((i) => top[i]));
  assert.ok(top.includes(tv.championId));
});

test('시드는 능력치가 높은 장수와 낮은 장수가 8강에서 만난다 (1:8 · 2:7)', () => {
  const s = newGame(51);
  giveGenerals(s, 34);
  s.month = 5;
  const tv = E.maybeOpenTournament(s);
  const top = topBy(s, 'war');
  assert.equal(tv.rounds[0][0].a.gid, top[0]);
  assert.equal(tv.rounds[0][0].b.gid, top[7]);
  assert.equal(tv.rounds[0][3].a.gid, top[1]);
  assert.equal(tv.rounds[0][3].b.gid, top[6]);
});

test('금 하사: 세력 금 300을 써서 충성 +12 · 친밀 +10 · 명성 +4', () => {
  const s = newGame(53);
  giveGenerals(s, 34);
  s.month = 5;
  const tv = E.maybeOpenTournament(s);
  const champ = s.generals[tv.championId];
  champ.loyalty = 60;
  const affBefore = E.affinityOf(s, champ.id);
  const fameBefore = s.factions[s.playerId].fame;
  const goldBefore = E.factionGold(s, s.playerId);
  assert.ok(goldBefore >= 300);

  const res = E.resolveTournamentReward(s, 'gold');
  assert.equal(res.ok, true);
  assert.equal(E.factionGold(s, s.playerId), goldBefore - 300);
  assert.equal(champ.loyalty, 72);
  assert.equal(E.affinityOf(s, champ.id), Math.min(100, affBefore + 10));
  assert.equal(s.factions[s.playerId].fame, Math.min(100, fameBefore + 4));
  assert.equal(s.pendingTournament, null);
  assert.equal(s.lastTournament.reward, 'gold');
  assert.ok(s.log.some((l) => l.text.includes('무예 대회')));
});

test('금 하사: 세력 금이 300 미만이면 거절한다', () => {
  const s = newGame(57);
  giveGenerals(s, 34);
  s.month = 5;
  const tv = E.maybeOpenTournament(s);
  for (const c of E.factionCities(s, s.playerId)) c.gold = 0;
  const res = E.resolveTournamentReward(s, 'gold');
  assert.equal(res.ok, false);
  assert.match(res.msg, /금이 부족/);
  assert.ok(s.pendingTournament);
  assert.equal(s.pendingTournament.championId, tv.championId);
});

test('치하만 하기: 비용 없이 충성 +5 · 친밀 +5 · 명성 +2', () => {
  const s = newGame(59);
  giveGenerals(s, 34);
  s.month = 10;
  const tv = E.maybeOpenTournament(s);
  const champ = s.generals[tv.championId];
  champ.loyalty = 50;
  const affBefore = E.affinityOf(s, champ.id);
  const fameBefore = s.factions[s.playerId].fame;
  const goldBefore = E.factionGold(s, s.playerId);

  const res = E.resolveTournamentReward(s, 'praise');
  assert.equal(res.ok, true);
  assert.equal(E.factionGold(s, s.playerId), goldBefore);
  assert.equal(champ.loyalty, 55);
  assert.equal(E.affinityOf(s, champ.id), Math.min(100, affBefore + 5));
  assert.equal(s.factions[s.playerId].fame, Math.min(100, fameBefore + 2));
});

test('보물 하사: 창고 보물을 우승 장수에게 준다', () => {
  const s = newGame(61);
  giveGenerals(s, 34);
  const tr = E.TREASURES[0];
  E.gainTreasure(s, tr.id, { holder: null }); // 창고에 넣는다
  s.month = 5;
  const tv = E.maybeOpenTournament(s);
  assert.ok(E.tournamentPrizes(s).some((p) => p.id === tr.id));
  const res = E.resolveTournamentReward(s, 'treasure', { treasureId: tr.id });
  assert.equal(res.ok, true);
  assert.equal(E.treasureHolder(s, tr.id), tv.championId);
  assert.ok(s.treasures.owned.includes(tr.id));
  assert.equal(s.lastTournament.treasure, tr.ko);
});

test('보물이 하나도 없으면 대회 포상으로 임자 없는 보물 하나를 내건다', () => {
  const s = newGame(67);
  giveGenerals(s, 34);
  s.treasures = { where: {}, owned: [] };
  s.month = 5;
  E.maybeOpenTournament(s);
  const prizes = E.tournamentPrizes(s);
  assert.equal(prizes.length, 1);
  assert.equal(prizes[0].from, 'prize');
  const res = E.resolveTournamentReward(s, 'treasure', { treasureId: prizes[0].id });
  assert.equal(res.ok, true);
  assert.ok(s.treasures.owned.includes(prizes[0].id));
});

test('저장·불러오기: 진행 중 대회와 지난 대회 기록이 그대로 남는다', () => {
  const s = newGame(71);
  giveGenerals(s, 34);
  s.month = 5;
  E.maybeOpenTournament(s);
  const champion = s.pendingTournament.championId;
  const back = E.deserialize(E.serialize(s));
  assert.ok(back.pendingTournament);
  assert.equal(back.pendingTournament.championId, champion);
  assert.deepEqual(back.pendingTournament.rounds.map((r) => r.length), [4, 2, 1]);

  E.resolveTournamentReward(back, 'praise');
  const back2 = E.deserialize(E.serialize(back));
  assert.equal(back2.pendingTournament, null);
  assert.equal(back2.lastTournament.championId, champion);
  assert.equal(back2.lastTournament.reward, 'praise');
});

test('턴이 5월로 넘어가면 대회가 열리고 이벤트와 함께 대기한다', () => {
  const s = newGame(73);
  giveGenerals(s, 34);
  s.month = 4;
  s.turn = 8;
  E.endTurnPhase2(s);
  assert.equal(s.month, 5);
  assert.ok(s.pendingTournament, '5월 대회가 열린다');
  assert.equal(s.pendingTournament.kind, 'martial');
  assert.equal(s.pendingTournament.year, s.year);

  // 30명 미만이면 열리지 않는다
  const s2 = newGame(79);
  s2.month = 4;
  E.endTurnPhase2(s2);
  assert.equal(s2.month, 5);
  assert.equal(s2.pendingTournament, null);
});
