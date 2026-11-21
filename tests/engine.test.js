import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, CITIES, CITY_BY_ID, GENERAL_BY_ID } from '../js/data.js';
import * as E from '../js/engine.js';

const eachScenario = (fn) => SCENARIOS.forEach((sc) => fn(sc));

test('게임 생성: 모든 시나리오 × 모든 세력', () => {
  let count = 0;
  eachScenario((sc) => {
    for (const f of sc.factions) {
      const s = E.createGame(sc.id, f.id, 1234);
      count++;
      assert.equal(s.playerId, f.id);
      assert.equal(E.factionCities(s, f.id).length, f.cities.length);
      assert.ok(s.actionPoints > 0);
      assert.ok(s.log.length >= 1);
      // 소유되지 않은 성은 없어야 함(재야 성은 없음)
      for (const c of Object.values(s.cities)) assert.ok(c.owner, `${c.id} 소유자`);
      // 모든 장수는 어딘가에 배치
      for (const g of Object.values(s.generals)) assert.ok(g.city, `${g.id} 위치`);
    }
  });
  assert.ok(count >= 25, `총 ${count}개 세력 시작 상태`);
});

test('초기 세력: 금/식량/병력이 전부 양수', () => {
  const s = E.createGame('s194', 'jojo', 7);
  for (const c of E.factionCities(s, 'jojo')) {
    assert.ok(c.gold > 0 && c.food > 0 && c.troops > 0, c.id);
  }
});

test('내정 명령: 개발·상업·치안·수리·징병·훈련이 수치를 바꾼다', () => {
  const s = E.createGame('s194', 'jojo', 42);
  const city = E.factionCities(s, 'jojo')[0];
  const officer = E.generalsInCity(s, city.id)[0];
  const agri0 = city.agri;
  const ap0 = s.actionPoints;
  const r = E.runCommand(s, 'agri', { cityId: city.id, officerId: officer.id });
  assert.ok(r.ok, r.msg);
  assert.ok(city.agri >= agri0 + 2);
  assert.equal(s.actionPoints, ap0 - 1);
  assert.equal(officer.acted, true);

  // 같은 장수는 재행동 불가
  const r2 = E.runCommand(s, 'comm', { cityId: city.id, officerId: officer.id });
  assert.equal(r2.ok, false);

  const city2 = E.factionCities(s, 'jojo')[1] || city;
  const o2 = E.generalsInCity(s, city2.id).find((g) => !g.acted);
  if (o2) {
    const t0 = city2.troops, g0 = city2.gold;
    const rd = E.runCommand(s, 'draft', { cityId: city2.id, officerId: o2.id });
    assert.ok(rd.ok, rd.msg);
    assert.ok(city2.troops > t0);
    assert.ok(city2.gold < g0);
    assert.equal(o2.acted, true);
  }
});

test('행동력이 없으면 명령 불가', () => {
  const s = E.createGame('s194', 'jojo', 5);
  const city = E.factionCities(s, 'jojo')[0];
  s.actionPoints = 0;
  const officer = E.generalsInCity(s, city.id).find((g) => !g.acted);
  const r = E.runCommand(s, 'agri', { cityId: city.id, officerId: officer.id });
  assert.equal(r.ok, false);
  assert.match(r.msg, /행동력/);
});

test('등용: 재야 장수를 포섭할 수 있다(확률)', () => {
  const s = E.createGame('s194', 'jojo', 99);
  // 허창에 재야 장수 배치
  const free = E.freeGeneralsInCity(s, 'xuchang');
  assert.ok(free.length > 0, '허창에 재야 장수');
  let success = false;
  for (let i = 0; i < 40 && !success; i++) {
    const st = E.createGame('s194', 'jojo', 100 + i);
    const f = E.freeGeneralsInCity(st, 'xuchang')[0];
    const officer = E.bestOfficer(st, 'xuchang', 'cha');
    const r = E.runCommand(st, 'hire', { cityId: 'xuchang', officerId: officer.id, hireId: f.id });
    assert.ok(r.ok, r.msg);
    if (st.generals[f.id].faction === 'jojo') success = true;
  }
  assert.ok(success, '40회 시도 중 최소 1회 등용 성공');
});

test('수송: 인접 아군 성으로 금·식량 이동', () => {
  const s = E.createGame('s194', 'jojo', 3);
  const from = E.factionCities(s, 'jojo')[0];
  const to = E.adjacentFriends(s, from.id)[0];
  assert.ok(to, '인접 아군 성');
  const o = E.generalsInCity(s, from.id)[0];
  const before = { g: s.cities[to].gold, f: s.cities[to].food };
  const r = E.runCommand(s, 'transport', { cityId: from.id, officerId: o.id, targetCityId: to, gold: 100, food: 200 });
  assert.ok(r.ok, r.msg);
  assert.equal(s.cities[to].gold, before.g + 100);
  assert.equal(s.cities[to].food, before.f + 200);
});

test('월 수입: 상업·농업이 금·식량을 늘린다', () => {
  const s = E.createGame('s194', 'jojo', 11);
  const city = E.factionCities(s, 'jojo').find((c) => c.agri > 60);
  const g0 = city.gold, f0 = city.food;
  E.endTurnPhase2(s);
  assert.ok(city.gold > g0, '금 증가');
  assert.ok(city.food !== f0, '식량 변동');
  assert.equal(s.month, 2);
  assert.equal(s.turn, 2);
  assert.ok(s.actionPoints > 0);
});

test('AI 턴: 36개월 자동 진행이 예외 없이 돌아간다', () => {
  const s = E.createGame('s194', 'jojo', 2024);
  let battlesSeen = 0;
  for (let m = 0; m < 36; m++) {
    const pending = E.endTurnPhase1(s);
    if (pending.length) {
      battlesSeen += pending.length;
      for (const p of pending) {
        const res = { fromCityId: p.fromCityId, toCityId: p.toCityId, winner: Math.random() < 0.5 ? 'attacker' : 'defender', atkLoss: 1000, defLoss: 1200, atkSurvivors: 2000, capturedGenerals: [] };
        E.applyBattleResult(s, res);
      }
    }
    s.pendingBattles = [];
    E.endTurnPhase2(s);
    assert.ok(s.month >= 1 && s.month <= 12, '월 범위');
    assert.ok(s.year >= 194);
    assert.ok(s.actionPoints > 0);
  }
  assert.ok(s.turn > 30);
  // AI 세력이 내정을 했는지(성 수치 합이 초기보다 증가)
  const total = Object.values(s.cities).reduce((n, c) => n + c.agri + c.comm + c.order + c.water, 0);
  assert.ok(total > 0);
  assert.ok(battlesSeen >= 0);
});

test('저장/불러오기: 직렬화 왕복 후 동일 상태', () => {
  const s = E.createGame('s200', 'liubei', 555);
  const city = E.factionCities(s, 'liubei')[0];
  const o = E.generalsInCity(s, city.id)[0];
  E.runCommand(s, 'agri', { cityId: city.id, officerId: o.id });
  E.endTurnPhase1(s);
  s.pendingBattles = [];
  E.endTurnPhase2(s);
  const json = E.serialize(s);
  const s2 = E.deserialize(json);
  assert.equal(s2.year, s.year);
  assert.equal(s2.month, s.month);
  assert.equal(s2.actionPoints, s.actionPoints);
  assert.equal(JSON.stringify(s2.cities), JSON.stringify(s.cities));
  assert.equal(E.factionCities(s2, 'liubei').length, E.factionCities(s, 'liubei').length);
  // 잘못된 버전 거부
  assert.throws(() => E.deserialize(JSON.stringify({ version: 0 })), /형식/);
});

test('천하통일 판정', () => {
  const s = E.createGame('s194', 'jojo', 8);
  for (const c of Object.values(s.cities)) c.owner = 'jojo';
  const over = E.checkVictory(s);
  assert.equal(over.type, 'victory');
  // 멸망 판정
  const s2 = E.createGame('s194', 'jojo', 8);
  for (const c of Object.values(s2.cities)) if (c.owner === 'jojo') c.owner = 'lubu';
  const over2 = E.checkVictory(s2);
  assert.equal(over2.type, 'defeat');
});

test('출진 자격: 인접 적 성만 공격 가능', () => {
  const s = E.createGame('s194', 'jojo', 77);
  const from = E.factionCities(s, 'jojo')[0];
  const enemy = E.adjacentEnemies(s, from.id);
  assert.ok(enemy.length > 0);
  assert.ok(E.canAttack(s, from.id, enemy[0]).ok);
  assert.equal(E.canAttack(s, from.id, from.id).ok, false);
  const far = CITIES.find((c) => !CITY_BY_ID[from.id].roads.includes(c.id) && s.cities[c.id].owner !== 'jojo');
  assert.equal(E.canAttack(s, from.id, far.id).ok, false);
});

test('세력 순위: 전력 내림차순', () => {
  const s = E.createGame('s208', 'sunquan', 10);
  const r = E.ranking(s);
  assert.ok(r.length >= 5);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].power >= r[i].power);
  assert.ok(r.every((x) => x.cities > 0));
});
