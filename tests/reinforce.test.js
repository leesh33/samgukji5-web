import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as B from '../js/battle.js';

/* 조조: 허창·진류 — 두 성이 붙어 있어 서로 원군이 된다 */
function setup(seed = 61) {
  const s = E.createGame('s194', 'jojo', seed);
  const cities = E.factionCities(s, s.playerId);
  const from = cities.find((c) => E.adjacentEnemies(s, c.id).length);
  return { s, from };
}

test('원군 후보: 인접한 아군 성의 병력·장수를 한 부대씩 뽑는다', () => {
  const { s, from } = setup();
  const cands = E.reinforcementCandidates(s, [from.id], s.playerId, [from.id]);
  assert.ok(cands.length >= 1, '아군 성이 붙어 있으면 후보가 있다');
  for (const c of cands) {
    assert.ok(E.isAdjacent(from.id, c.cityId));
    assert.ok(c.troops >= 500);
    assert.ok(c.gid && c.gname);
    assert.equal(c.owner, s.playerId);
    assert.ok(s.generals[c.gid]);
    // 성을 통째로 비우지 않는다
    assert.ok(s.cities[c.cityId].troops - c.troops >= 300);
  }
  // 같은 세력이 아니면 후보가 아니다
  const enemyNear = E.neighborFoes(s, from.id);
  for (const n of enemyNear) {
    assert.equal(E.reinforcementCandidates(s, [from.id], s.playerId, [from.id]).some((c) => c.cityId === n), false);
  }
});

test('플레이어가 고른 원군만 출진하고, 보낸 성의 병력이 줄어든다', () => {
  const { s, from } = setup(63);
  const to = E.adjacentEnemies(s, from.id)[0];
  const cands = E.reinforcementCandidates(s, [from.id], s.playerId, [from.id, to]);
  assert.ok(cands.length >= 1);
  const pick = cands[0];
  const srcTroops = s.cities[pick.cityId].troops;
  const setupObj = E.battleSetup(s, from.id, to, { atkReinforcements: [pick.cityId], atkTroops: 5000 });
  assert.equal(setupObj.reinforcements.atk.length, 1);
  assert.equal(setupObj.reinforcements.atk[0].cityId, pick.cityId);
  assert.equal(s.cities[pick.cityId].troops, srcTroops - pick.troops);
  assert.equal(setupObj.atkTroops, 5000);
  assert.equal(setupObj.attackerFaction, s.playerId);
  assert.ok(setupObj.reinforcements.atk[0].spec.ko);
});

test('원군을 고르지 않으면 공격측 원군이 없다', () => {
  const { s, from } = setup(65);
  const to = E.adjacentEnemies(s, from.id)[0];
  const setupObj = E.battleSetup(s, from.id, to, { atkReinforcements: [] });
  assert.equal(setupObj.reinforcements.atk.length, 0);
});

test('방어측(플레이어)은 자동으로 원군이 합류한다', () => {
  const { s, from } = setup(67);
  // 이웃한 아군 성이 있는 내 성을 방어하는 상황
  const guard = E.factionCities(s, s.playerId).find((c) => E.adjacentFriends(s, c.id).some((n) => E.generalsInCity(s, n).length));
  assert.ok(guard, '원군이 붙을 내 성');
  const attacker = Object.keys(s.factions).find((f) => f !== s.playerId && E.factionCities(s, f).some((c) => E.isAdjacent(c.id, guard.id)));
  assert.ok(attacker, '방어 상황을 만들 상대');
  const enemyFrom = E.factionCities(s, attacker).find((c) => E.isAdjacent(c.id, guard.id)).id;
  const plans = E.planReinforcements(s, enemyFrom, guard.id, { rng: () => 0.99 });
  assert.equal(plans.def.length >= 1, true, '플레이어 방어는 자동 합류');
  assert.ok(plans.def.length <= E.REINFORCE_MAX);
});

test('AI 방어측도 일정 확률로 원군 1부대를 얻는다', () => {
  const s = E.createGame('s194', 'jojo', 69);
  // 아군 성에서 공격할 적 성 + 그 적 성에 인접한 같은 편 성
  let found = null;
  for (const c of E.factionCities(s, s.playerId)) {
    for (const to of E.adjacentEnemies(s, c.id)) {
      const owner = s.cities[to].owner;
      const siblings = Object.values(s.cities).filter((x) => x.owner === owner && x.id !== to && E.isAdjacent(x.id, to));
      if (siblings.length) { found = { from: c.id, to, owner }; break; }
    }
    if (found) break;
  }
  assert.ok(found, 'AI 성이 서로 붙은 전선');
  // rng 0 → 확률 판정 통과
  const yes = E.planReinforcements(s, found.from, found.to, { rng: () => 0 });
  assert.equal(yes.def.length, 1, 'AI 방어 원군 1부대');
  // rng 0.99 → 합류 없음
  const no = E.planReinforcements(s, found.from, found.to, { rng: () => 0.99 });
  assert.equal(no.def.length, 0);
});

test('전투 2라운드에 전장 가장자리로 원군이 도착한다', () => {
  const s = E.createGame('s194', 'jojo', 71);
  const atkGens = E.factionGenerals(s, s.playerId).slice(0, 2).map((g) => g.id);
  const defFid = Object.keys(s.factions).find((f) => f !== s.playerId);
  const defGens = E.factionGenerals(s, defFid).slice(0, 2).map((g) => g.id);
  const spec = E.generalOf(s, defGens[0]);
  const b = B.createBattle({
    fromCityId: 'chenliu', toCityId: 'luoyang',
    attackerFaction: s.playerId, defenderFaction: defFid,
    atkGenerals: atkGens, defGenerals: defGens,
    atkTroops: 9000, defTroops: 9000, defBonus: 50, seed: 3,
    generals: E.generalMap(s),
    reinforcements: {
      atk: [{ cityId: 'xuchang', gid: 'test_re_atk', gname: '원군가', troops: 1800, spec: { ...E.generalOf(s, atkGens[0]), id: 'test_re_atk', ko: '원군가' } }],
      def: [{ cityId: 'luoyang', gid: 'test_re_def', gname: '원군나', troops: 1500, spec: { ...spec, id: 'test_re_def', ko: '원군나' } }],
    },
  });
  const units0 = b.units.length;
  const initAtk = b.initial.atk;
  B.nextPhase(b); // atk → def
  assert.equal(b.round, 1);
  assert.equal(b.units.length, units0, '1라운드에는 아직 원군이 없다');
  B.nextPhase(b); // def → atk, 라운드 2
  assert.equal(b.round, 2);
  assert.equal(b.units.length, units0 + 2, '양쪽 원군 2부대 합류');
  assert.ok(b.log.some((l) => /\[원군 도착!\]/.test(l)), b.log.slice(-4).join(' | '));
  assert.equal(b.initial.atk, initAtk + 1800);
  const reAtk = b.units.find((u) => u.gid === 'test_re_atk');
  const reDef = b.units.find((u) => u.gid === 'test_re_def');
  assert.ok(reAtk && reDef);
  assert.equal(reAtk.side, 'atk');
  assert.equal(reAtk.x, 0, '공격측 원군은 왼쪽 가장자리');
  assert.equal(reDef.x, b.w - 1, '수비측 원군은 오른쪽 가장자리');
  assert.equal(reAtk.troops, 1800);
  assert.equal(reDef.troops, 1500);
  assert.equal(reAtk.alive, true);
  // 도착한 원군도 그 라운드에 움직일 수 있다
  assert.equal(reAtk.acted, false);
  // 원군은 한 번만 온다
  B.nextPhase(b);
  B.nextPhase(b);
  assert.equal(b.units.filter((u) => u.gid === 'test_re_atk').length, 1);
});

test('원군이 없으면 도착 로그도 없다', () => {
  const s = E.createGame('s194', 'jojo', 73);
  const gid = E.factionGenerals(s, s.playerId)[0].id;
  const b = B.createBattle({
    fromCityId: 'chenliu', toCityId: 'luoyang', attackerFaction: s.playerId, defenderFaction: 'lubu',
    atkGenerals: [gid], defGenerals: E.factionGenerals(s, 'lubu').slice(0, 1).map((g) => g.id),
    atkTroops: 6000, defTroops: 6000, defBonus: 40, seed: 5, generals: E.generalMap(s),
  });
  B.nextPhase(b); B.nextPhase(b);
  assert.equal(b.log.some((l) => /원군 도착/.test(l)), false);
});

test('AI끼리 싸울 때도 원군이 전력에 반영되고 로그에 남는다', () => {
  const s = E.createGame('s194', 'jojo', 75);
  // 조조가 아닌 두 세력의 인접 전선
  let pair = null;
  for (const a of Object.keys(s.factions)) {
    if (a === s.playerId) continue;
    for (const c of E.factionCities(s, a)) {
      const en = E.neighbors(c.id).filter((n) => s.cities[n].owner && s.cities[n].owner !== a && s.cities[n].owner !== s.playerId);
      if (en.length) { pair = { from: c.id, to: en[0] }; break; }
    }
    if (pair) break;
  }
  assert.ok(pair, 'AI 대 AI 전선');
  const rng = E.mulberry32(99);
  E.resolveAutoBattle(s, pair.from, pair.to, rng);
  assert.ok(s.log.some((l) => /(함락|격퇴)/.test(l.text)));
});
