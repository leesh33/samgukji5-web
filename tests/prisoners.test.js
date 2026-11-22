import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { mulberry32 } from '../js/engine.js';

/* 플레이어(조조)가 인접한 적 성을 함락시키는 상황을 만든다 */
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
  return { s, from: from.id, to, res, defGens };
}

test('승전하면 궤멸한 적 장수가 포로로 잡혀 처분 대기', () => {
  const { s, res, defGens } = siege();
  const out = E.applyBattleResult(s, res, () => 0);   // 항상 사로잡힘
  assert.equal(out.playerWon, true);
  assert.ok(out.prisoners.length >= 1, '포로 ' + out.prisoners.length);
  assert.deepEqual(s.pendingPrisoners.map((p) => p.gid), out.prisoners.map((p) => p.gid));
  for (const p of s.pendingPrisoners) {
    const g = s.generals[p.gid];
    assert.equal(g.captive, true);
    assert.equal(g.city, res.toCityId);
    assert.ok(!E.generalsInCity(s, res.toCityId).some((x) => x.id === p.gid), '포로는 성 장수 목록에 없음');
  }
  assert.ok(defGens.length >= 1);
});

test('등용 성공: 아군이 되고 충성도가 붙는다', () => {
  const { s, res } = siege();
  E.applyBattleResult(s, res, () => 0);
  const gid = s.pendingPrisoners[0].gid;
  const before = s.pendingPrisoners.length;
  const r = E.recruitPrisoner(s, gid, () => 0);       // 판정 성공
  assert.equal(r.accepted, true, r.msg);
  const g = s.generals[gid];
  assert.equal(g.faction, 'jojo');
  assert.equal(g.captive, false);
  assert.ok(g.loyalty >= 30 && g.loyalty <= 88, '초기 충성 ' + g.loyalty);
  assert.equal(s.pendingPrisoners.length, before - 1);
  assert.ok(E.generalsInCity(s, res.toCityId).some((x) => x.id === gid), '새 성 장수로 합류');
});

test('등용 거절: 대사와 함께 포로로 남아 해방·참수를 고를 수 있다', () => {
  const { s, res } = siege();
  E.applyBattleResult(s, res, () => 0);
  const gid = s.pendingPrisoners[0].gid;
  const r = E.recruitPrisoner(s, gid, () => 0.999);   // 판정 실패
  assert.equal(r.accepted, false);
  assert.ok(r.msg.includes('섬길 수 없'), r.msg);
  assert.equal(s.generals[gid].captive, true, '여전히 포로');
  assert.ok(s.pendingPrisoners.some((p) => p.gid === gid));
  // 거절 뒤에도 해방할 수 있다
  const rel = E.releasePrisoner(s, gid);
  assert.equal(rel.ok, true);
  assert.equal(s.generals[gid].captive, false);
});

test('해방: 원 소속으로 돌아가고 명성 +5', () => {
  const { s, res } = siege();
  E.applyBattleResult(s, res, () => 0);
  const p = s.pendingPrisoners[0];
  const gid = p.gid;
  const fame0 = s.factions.jojo.fame;
  const r = E.releasePrisoner(s, gid);
  assert.equal(r.ok, true);
  const g = s.generals[gid];
  assert.equal(g.captive, false);
  assert.equal(g.dead, false);
  const home = E.factionCities(s, p.faction);
  if (home.length) assert.equal(g.faction, p.faction, '원 세력으로 복귀');
  else assert.equal(g.faction, null, '세력이 망했으면 재야로');
  assert.ok(Math.abs(s.factions.jojo.fame - Math.min(100, fame0 + 5)) < 1e-9, '명성 +5');
  assert.ok(!s.pendingPrisoners.some((x) => x.gid === gid));
  assert.equal(s.stats.released, 1);
});

test('참수: 영구 사망 처리되어 다시 등장하지 않는다', () => {
  const { s, res, to } = siege();
  E.applyBattleResult(s, res, () => 0);
  const gid = s.pendingPrisoners[0].gid;
  const fame0 = s.factions.jojo.fame;
  const r = E.executePrisoner(s, gid);
  assert.equal(r.ok, true);
  const g = s.generals[gid];
  assert.equal(g.dead, true);
  assert.equal(g.captive, false);
  assert.equal(g.faction, null);
  assert.equal(g.city, null);
  assert.ok(s.factions.jojo.fame < fame0, '명성 소폭 감소');
  assert.equal(s.stats.executed, 1);
  // 어떤 목록에도 나오지 않는다
  for (const fid of Object.keys(s.factions)) {
    assert.ok(!E.factionGenerals(s, fid).some((x) => x.id === gid), fid);
  }
  for (const cid of Object.keys(s.cities)) {
    assert.ok(!E.generalsInCity(s, cid).some((x) => x.id === gid), cid);
    assert.ok(!E.freeGeneralsInCity(s, cid).some((x) => x.id === gid), cid);
  }
  // 저장·불러오기에서도 죽은 상태가 유지된다
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.generals[gid].dead, true);
  assert.ok(!E.generalsInCity(back, to).some((x) => x.id === gid));
});

test('군주는 마지막 성이 아니면 도주하고, 마지막 성이면 사로잡힌다', () => {
  const { s } = siege();
  const defFid = 'lubu';
  const defLord = s.factions[defFid] ? s.factions[defFid].lord : null;
  if (!defLord) return;                                  // 시나리오에 따라 세력이 다름
  const lordGid = defLord;
  // 남은 성이 있는 경우
  const cities = E.factionCities(s, defFid);
  if (cities.length >= 2) {
    const cands = E.captureCandidates(s, [lordGid], defFid, () => 0);
    assert.equal(cands.length, 0, '남은 성이 있으면 군주는 잡히지 않는다');
  }
  // 공격한 성이 함락되어 마지막 성까지 잃은 경우
  for (const c of E.factionCities(s, defFid)) c.owner = 'jojo';
  const cands2 = E.captureCandidates(s, [lordGid], defFid, () => 0.99);
  assert.equal(cands2.length, 1, '마지막 성의 군주는 사로잡힌다');
  assert.equal(cands2[0].isLord, true);
});

test('플레이어가 지면 포로 처분 없이 기존 규칙대로 처리', () => {
  const s = E.createGame('s194', 'jojo', 11);
  const from = E.factionCities(s, 'jojo')[0];
  const to = E.adjacentEnemies(s, from.id)[0];
  const atkGens = E.generalsInCity(s, from.id).map((g) => g.id);
  const res = {
    fromCityId: from.id, toCityId: to, winner: 'defender',
    atkLoss: 2000, defLoss: 400, atkSurvivors: 800, defSurvivors: 3000,
    defeatedGenerals: atkGens, playerSide: 'atk',
  };
  const before = atkGens.map((gid) => s.generals[gid].faction);
  const out = E.applyBattleResult(s, res, () => 0);
  assert.equal(out.playerWon, false);
  assert.equal(s.pendingPrisoners.length, 0, '패배 시 처분 화면 없음');
  // 진 쪽(플레이어) 장수는 소속을 잃지 않는다
  atkGens.forEach((gid, i) => {
    assert.equal(s.generals[gid].captive, false, gid);
    assert.equal(s.generals[gid].faction, before[i], gid + ' 소속 유지');
  });
});

test('수비 승리 시에도 공격측 장수를 포로로 잡는다', () => {
  const s = E.createGame('s194', 'jojo', 13);
  const from = E.factionCities(s, 'jojo')[0];
  const to = E.adjacentEnemies(s, from.id)[0];
  const enemyGens = E.generalsInCity(s, to).map((g) => g.id);
  const res = {
    fromCityId: to, toCityId: from.id, winner: 'defender',     // 적이 우리 성을 공격해 패배
    atkLoss: 2200, defLoss: 500, atkSurvivors: 700, defSurvivors: 3200,
    defeatedGenerals: enemyGens, playerSide: 'def',
  };
  // from/to 소유자가 뒤집혀 있으므로 실제 소유에 맞춰 다시 세운다
  res.fromCityId = from.id; res.toCityId = from.id;
  const own = E.createGame('s194', 'jojo', 14);
  const myCity = E.factionCities(own, 'jojo')[0];
  const enemyCity = E.adjacentEnemies(own, myCity.id)[0];
  const res2 = {
    fromCityId: enemyCity, toCityId: myCity.id, winner: 'defender',
    atkLoss: 2200, defLoss: 500, atkSurvivors: 700, defSurvivors: 3200,
    defeatedGenerals: E.generalsInCity(own, enemyCity).map((g) => g.id),
    playerSide: 'def',
  };
  const out = E.applyBattleResult(own, res2, () => 0);
  assert.equal(out.playerWon, true);
  assert.ok(own.pendingPrisoners.length >= 1, '방어 승리 포로 ' + own.pendingPrisoners.length);
  assert.equal(own.cities[myCity.id].owner, 'jojo', '성은 그대로');
});

test('저장 양식 v4 → v5 이전: 죽음·포로 필드가 채워진다', () => {
  const s = E.createGame('s194', 'jojo', 21);
  const raw = JSON.parse(E.serialize(s));
  raw.version = 4;
  delete raw.pendingPrisoners;
  for (const g of Object.values(raw.generals)) { delete g.dead; delete g.captive; }
  const back = E.deserialize(JSON.stringify(raw));
  assert.equal(back.version, E.SAVE_VERSION);
  assert.ok(Array.isArray(back.pendingPrisoners));
  assert.equal(back.generals.caocao ? back.generals.caocao.dead : false, false);
  assert.equal(E.SAVE_VERSION, 10);
});

test('처분하고 저장한 뒤 다시 불러와도 등용·참수 결과가 남는다', () => {
  const { s, res } = siege(31);
  E.applyBattleResult(s, res, () => 0);
  const [a, b] = s.pendingPrisoners.map((p) => p.gid);
  if (!a) return;
  E.recruitPrisoner(s, a, () => 0);
  if (b) E.executePrisoner(s, b);
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.generals[a].faction, 'jojo');
  if (b) assert.equal(back.generals[b].dead, true);
  assert.equal((back.pendingPrisoners || []).length, s.pendingPrisoners.length);
});
