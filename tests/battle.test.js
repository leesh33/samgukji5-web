import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERAL_BY_ID, FORMATIONS } from '../js/data.js';
import * as B from '../js/battle.js';
import * as E from '../js/engine.js';
import { createDuel, duelRound, autoDuel } from '../js/duel.js';

function make(opts = {}) {
  return B.createBattle({
    fromCityId: 'xuchang', toCityId: 'chenliu',
    attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['cao_cao', 'xiahou_dun', 'xuzhu_missing'].filter((x) => GENERAL_BY_ID[x]),
    defGenerals: ['lu_bu', 'chen_gong', 'gao_shun'],
    atkTroops: 12000, defTroops: 9000, defBonus: 60, seed: 3, playerSide: 'atk', ...opts,
  });
}

test('전장 생성: 격자·부대·지형', () => {
  const b = make();
  assert.equal(b.grid.length, B.BW * B.BH);
  assert.ok(B.unitsOf(b, 'atk').length >= 2);
  assert.ok(B.unitsOf(b, 'def').length === 3);
  for (const u of b.units) {
    const t = B.tileAt(b, u.x, u.y);
    assert.ok(t, '부대가 격자 안');
    assert.ok(u.troops > 0 && u.morale > 0);
    assert.ok(FORMATIONS[u.formation]);
  }
  const kinds = new Set(b.grid.map((t) => t.t));
  assert.ok(kinds.size >= 2, '지형 다양성');
});

test('이동: 이동력 범위 내 타일만, 점유 타일 불가', () => {
  const b = make();
  const u = B.unitsOf(b, 'atk')[0];
  const reach = B.reachable(b, u);
  assert.ok(reach.size > 0);
  assert.ok(!reach.has(u.y * b.w + u.x), '자기 타일 제외');
  const occupied = b.units.filter((x) => x.alive && x !== u).map((x) => x.y * b.w + x.x);
  for (const k of reach.keys()) assert.ok(!occupied.includes(k), '점유 타일 제외');
  const first = [...reach.keys()][0];
  const r = B.moveUnit(b, u, first % b.w, Math.floor(first / b.w));
  assert.ok(r.ok);
  assert.equal(u.moved, true);
});

test('공격: 피해·반격·사기 감소', () => {
  const b = make();
  const u = B.unitsOf(b, 'atk')[0];
  const t = B.unitsOf(b, 'def')[0];
  t.x = u.x + 1; t.y = u.y;
  const t0 = t.troops, m0 = t.morale;
  const r = B.attack(b, u, t, 12);
  assert.ok(r.ok, r.msg);
  assert.ok(t.troops < t0, '적 병력 감소');
  assert.ok(t.morale <= m0, '사기 감소');
  assert.equal(u.acted, true);
});

test('사거리: 근접 진형은 1칸, 학익·안행은 2칸', () => {
  const b = make();
  const u = B.unitsOf(b, 'atk')[0];
  const t = B.unitsOf(b, 'def')[0];
  t.x = u.x + 2; t.y = u.y;
  u.formation = 'eorin';
  assert.equal(B.canAttack(b, u, t), false);
  u.formation = 'hakyik';
  assert.equal(B.canAttack(b, u, t), true);
});

test('계략: 화계·혼란·고무·치료가 동작', () => {
  const b = make();
  const u = B.unitsOf(b, 'atk')[0];
  const t = B.unitsOf(b, 'def')[0];
  t.x = u.x + 1; t.y = u.y;
  // 화계(지력 높은 조조)
  const r1 = B.tactic(b, u, t, 'fire', 5);
  assert.ok(r1.ok);
  u.acted = false;
  const ally = B.unitsOf(b, 'atk')[1];
  const r2 = B.tactic(b, u, ally, 'rally', 5);
  assert.ok(r2.ok);
  // 사거리 밖
  const far = B.unitsOf(b, 'def')[1];
  far.x = 0; far.y = 0; u.x = 12; u.y = 8;
  const r3 = B.tactic(b, u, far, 'fire', 5);
  assert.equal(r3.ok, false);
});

test('자동 전투: 종료되고 결과가 산출된다', () => {
  for (let i = 0; i < 8; i++) {
    const res = B.autoBattle({
      fromCityId: 'xuchang', toCityId: 'chenliu', attackerFaction: 'jojo', defenderFaction: 'lubu',
      atkGenerals: ['cao_cao', 'xiahou_dun', 'cao_ren'], defGenerals: ['lu_bu', 'chen_gong', 'gao_shun'],
      atkTroops: 15000, defTroops: 12000, defBonus: 55, seed: i + 1,
    });
    assert.ok(['attacker', 'defender'].includes(res.winner));
    assert.ok(res.rounds >= 1 && res.rounds <= 16);
    assert.ok(res.atkLoss >= 0 && res.defLoss >= 0);
  }
});

test('전투 승패가 엔진 도시 상태에 반영된다', () => {
  const s = E.createGame('s194', 'jojo', 31);
  const from = E.factionCities(s, 'jojo')[0];
  const enemy = E.adjacentEnemies(s, from.id)[0];
  const res = B.autoBattle({
    fromCityId: from.id, toCityId: enemy, attackerFaction: from.owner, defenderFaction: s.cities[enemy].owner,
    atkGenerals: E.generalsInCity(s, from.id).map((g) => g.id),
    defGenerals: E.generalsInCity(s, enemy).map((g) => g.id),
    atkTroops: from.troops, defTroops: s.cities[enemy].troops, defBonus: s.cities[enemy].def, seed: 4,
  });
  E.applyBattleResult(s, res);
  if (res.winner === 'attacker') {
    assert.equal(s.cities[enemy].owner, 'jojo');
    assert.ok(s.cities[enemy].troops > 0);
  } else {
    assert.notEqual(s.cities[enemy].owner, 'jojo');
  }
  assert.equal(s.stats.battles, 1);
});

test('일기토: 라운드가 진행되고 승자가 정해진다', () => {
  const g1 = GENERAL_BY_ID.lu_bu;
  const g2 = GENERAL_BY_ID.cao_cao;
  const d = createDuel(g1, g2, 42);
  assert.equal(d.a.war, 100);
  let guard = 0;
  while (!d.over && guard++ < 20) duelRound(d, 'strong', true);
  assert.ok(d.over);
  assert.ok(d.winner === d.a || d.winner === d.b);
  assert.ok(d.log.length > 0);
  // 무력 우위가 승률에 반영되는지
  let luWins = 0;
  for (let i = 0; i < 60; i++) {
    const r = autoDuel(GENERAL_BY_ID.lu_bu, GENERAL_BY_ID.han_song, i + 1);
    if (r.winner.gid === 'lu_bu') luWins++;
  }
  assert.ok(luWins > 30, `여포 승리 ${luWins}/60`);
});

test('일기토 필살: 기백 소모와 큰 피해', () => {
  const d = createDuel(GENERAL_BY_ID.guan_yu, GENERAL_BY_ID.yan_liang, 7);
  const hp0 = d.b.hp;
  duelRound(d, 'finish', true);
  assert.ok(d.a.ki <= 3);
  assert.ok(d.b.hp <= hp0);
});
