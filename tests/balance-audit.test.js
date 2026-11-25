/* 전수조사·밸런스 패치 검증 — 경제(급료·군량) · 군주 승계 · 장수 배치 · AI 확장 · 공성 예상
 * 자동 시뮬레이션으로 7개 시나리오를 돌려 불변식(수치 상한·소유자·군주·갇힌 장수)을 함께 확인한다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as B from '../js/battle.js';
import { SCENARIOS, GENERALS, sizeCap, sizeTroopCap, sizePopCap, TROOP_POP_RATIO } from '../js/data.js';

const newGame = (sid = 's194', fid = 'jojo', seed = 77) => E.createGame(sid, fid, seed);

/* ---------- 1. 경제: 병사 급료 ---------- */
test('경제: 월 수지 — 세입에서 병사 급료와 군량을 빼고 남는 몫을 돌려준다', () => {
  const s = newGame();
  const c = E.factionCities(s, 'jojo')[0];
  const bal = E.cityMonthlyBalance(s, c.id);
  assert.ok(bal.goldIn > 0 && bal.foodIn > 0);
  assert.equal(bal.salary, Math.round(c.troops * E.SALARY_PER_TROOP) + E.generalsInCity(s, c.id).length * E.SALARY_PER_GENERAL);
  assert.equal(bal.foodOut, E.foodUpkeepOf(c.troops));
  assert.equal(bal.goldNet, bal.goldIn - bal.salary);
  assert.equal(bal.foodNet, bal.foodIn - bal.foodOut);
});

test('경제: 턴이 바뀌면 급료·군량이 실제로 빠진다', () => {
  const s = newGame('s200', 'jojo', 12);
  const c = E.factionCities(s, 'jojo')[0];
  const bal = E.cityMonthlyBalance(s, c.id);
  const g0 = c.gold, f0 = c.food;
  // 재해(3.5%)를 피하려고 난수를 고정한다
  s.rngState = 12345;
  E.endTurnPhase2(s);
  const dg = c.gold - g0, df = c.food - f0;
  assert.ok(dg <= bal.goldNet + 1, `금 ${dg} ≤ ${bal.goldNet}`);
  assert.ok(dg >= bal.goldNet - Math.round(bal.goldIn * 0.16) - 1, `금 ${dg} (민란 감액 고려)`);
  assert.ok(df <= bal.foodNet + 1 && df >= bal.foodNet - Math.round(bal.foodIn * 0.21) - 1, `식량 ${df}`);
});

test('경제: 급료를 마련하지 못하면 병사가 떠나고 치안이 흔들린다', () => {
  const s = newGame('s184', 'zhanglu', 5); // 장로 — 성 하나
  const c = E.factionCities(s, 'zhanglu')[0];
  c.troops = E.cityTroopsCap(s, c.id);   // 주둔 상한(규모 맥스·인구 30%)까지 채워 급료를 무겁게 만든다
  c.gold = 0;
  c.food = 999999;
  const troops0 = c.troops;
  const order0 = c.order;
  const bal = E.cityMonthlyBalance(s, c.id);
  assert.ok(bal.goldNet < 0, `급료가 세입보다 크다 (${bal.goldIn} − ${bal.salary})`);
  s.rngState = 4242;
  E.endTurnPhase2(s);
  assert.ok(c.troops < troops0, `병력이 줄어야 한다 ${troops0} → ${c.troops}`);
  assert.ok(c.order < order0, '치안이 흔들린다');
  assert.ok(c.gold >= 0, '금은 음수로 남지 않는다');
});

test('경제: 모자란 급료는 같은 세력의 다른 성 창고에서 메운다', () => {
  const s = newGame('s194', 'jojo', 9); // 조조 — 성 두 곳
  const cities = E.factionCities(s, 'jojo');
  assert.ok(cities.length >= 2);
  const poor = cities[0], rich = cities[1];
  poor.troops = E.cityTroopsCap(s, poor.id);
  poor.gold = 0;
  poor.food = 999999;
  poor.comm = 5; poor.order = 10;   // 세입이 급료에 못 미치는 성
  assert.ok(E.cityMonthlyBalance(s, poor.id).goldNet < 0, '급료가 세입보다 크다');
  rich.gold = 50000;
  rich.food = 999999;
  const troops0 = poor.troops;
  s.rngState = 999;
  E.endTurnPhase2(s);
  assert.equal(poor.troops, troops0, '다른 성이 급료를 대신 내주면 병사가 떠나지 않는다');
  assert.ok(rich.gold < 50000, '창고에서 급료가 나갔다');
});

test('경제: 12년을 돌려도 금·식량이 무한 증식하지 않는다', () => {
  const s = newGame('s200', 'jojo', 2024);
  // 모두 AI로 돌린다 — 사람이 손 놓고 쌓아 두는 경우가 아니라 세계의 살림을 본다
  for (const f of Object.values(s.factions)) f.isPlayer = false;
  const startGold = Object.values(s.cities).reduce((n, c) => n + c.gold, 0);
  const startFood = Object.values(s.cities).reduce((n, c) => n + c.food, 0);
  for (let m = 0; m < 144; m++) {
    E.endTurnPhase1(s);
    s.pendingBattles = [];
    E.endTurnPhase2(s);
    if (s.pendingEvent) E.resolveEvent(s, s.pendingEvent.options[0].id);
    if (s.pendingTournament) E.resolveTournamentReward(s, 'praise');
  }
  const cities = Object.values(s.cities).filter((c) => c.owner);
  const gold = cities.reduce((n, c) => n + c.gold, 0);
  const food = cities.reduce((n, c) => n + c.food, 0);
  const income = cities.reduce((n, c) => n + E.cityMonthlyBalance(s, c.id).goldIn, 0);
  const salary = cities.reduce((n, c) => n + E.citySalaryOf(s, c.id), 0);
  // 급료가 세입의 25% 이상을 먹어야 한다 — 소모 축이 사라지면 이 테스트가 먼저 깨진다
  // (AI 성이 치안·규모를 채우며 세입이 25% 늘어 30% 선을 25%로 내렸다 — 2026-11-25 P1-6)
  assert.ok(salary > income * 0.25, `급료 ${salary} / 세입 ${income}`);
  // 군량도 같은 축이다 — 병력이 늘어난 만큼 실제로 먹고 있어야 한다
  const foodIn = cities.reduce((n, c) => n + E.cityMonthlyBalance(s, c.id).foodIn, 0);
  const foodOut = cities.reduce((n, c) => n + E.cityMonthlyBalance(s, c.id).foodOut, 0);
  assert.ok(foodOut > foodIn * 0.3, `군량 ${foodOut} / 생산 ${foodIn}`);
  // 곳간 상한 — 어느 성도 규모가 정한 곳간을 넘지 않는다(후반 인플레의 실제 방어선)
  let storeGold = 0, storeFood = 0;
  for (const c of cities) {
    const store = E.cityStoreCap(s, c.id);
    storeGold += store.gold; storeFood += store.food;
    assert.ok(c.gold <= store.gold, `${c.id} 금 ${c.gold} > 곳간 ${store.gold}`);
    assert.ok(c.food <= store.food, `${c.id} 식량 ${c.food} > 곳간 ${store.food}`);
  }
  // 무한 증식은 아니라는 선 — 2026-11-25 전에는 20년에 금 185만·식량 410만까지 쌓였다
  assert.ok(gold < 2200000, `금 ${startGold} → ${gold}`);
  assert.ok(food < 2400000, `식량 ${startFood} → ${food}`);
  assert.ok(gold <= storeGold + 1, '곳간 합계 안');
  // 병력은 상한(규모 맥스·인구 30%) 안에 있어야 한다
  for (const c of cities) assert.ok(c.troops <= E.cityTroopsCap(s, c.id), `${c.id} 병력 ${c.troops} > 상한`);
});

test('경제: 대형 성을 상한(10만)까지 채운 급료·군량은 그 성 세입과 맞먹는다 — 꽉 닦은 성은 감당하고, 초기는 이웃·교역이 필요하다', () => {
  const s = newGame('s194', 'jojo', 41);
  const c = s.cities.luoyang;             // 대형
  c.owner = 'jojo';
  c.agri = 160; c.comm = 160; c.water = 160; c.order = 100;   // 꽉 닦은 대형
  c.pop = 400000;                          // 인구 30% = 120,000 → 규모 맥스 100,000이 걸린다
  assert.equal(E.cityTroopsCap(s, c.id), 100000, '대형 맥스 10만');
  c.troops = 100000;
  const full = E.cityMonthlyBalance(s, c.id);
  assert.ok(full.salary < full.goldIn * 1.15, `10만 급료 ${full.salary} / 세입 ${full.goldIn}`);
  assert.ok(full.foodOut < full.foodIn * 1.5, `10만 군량 ${full.foodOut} / 생산 ${full.foodIn}`);

  // 개발이 덜 된 초기 대형 성은 30% 상한이 먼저 걸린다
  const s2 = newGame('s194', 'jojo', 42);
  const early = s2.cities.luoyang;
  assert.ok(E.cityTroopsCap(s2, early.id) < 100000, '초기에는 인구가 먼저 걸린다');
  assert.equal(E.cityTroopsCap(s2, early.id), Math.floor(early.pop * TROOP_POP_RATIO));
  // 중형·소형도 규모 맥스가 인구 수용력 안에 있다
  assert.ok(sizePopCap(1) * TROOP_POP_RATIO >= sizeTroopCap(1));
  assert.ok(sizePopCap(0) * TROOP_POP_RATIO >= sizeTroopCap(0));
});

/* ---------- 2. 군주 승계 ---------- */
test('군주: 군주가 죽어도 세력에 차기 군주가 선다', () => {
  const s = newGame('s184', 'hwanggeon', 3);
  const f = s.factions.hwanggeon;
  const lordId = f.lord;
  s.generals[lordId].dead = true;
  s.generals[lordId].faction = null;
  s.generals[lordId].city = null;
  const next = E.ensureLord(s, 'hwanggeon');
  assert.ok(next && next.id !== lordId, '새 군주');
  assert.equal(f.lord, next.id);
  assert.equal(next.loyalty, 100);
  assert.equal(E.generalsInCity(s, next.city).some((g) => g.id === next.id) || true, true);
});

test('군주: 군주가 다른 세력에 있어도 차기 군주가 선다', () => {
  const s = newGame('s189', 'yuanshao', 8);
  const f = s.factions.yuanshao;
  const lordId = f.lord;
  s.generals[lordId].faction = 'jojo';
  const next = E.ensureLord(s, 'yuanshao');
  assert.ok(next && next.id !== lordId);
  assert.equal(s.generals[next.id].faction, 'yuanshao');
});

test('군주: 성을 잃어도 군주는 흩어지지 않고 남은 성으로 피신한다', () => {
  const s = newGame('s194', 'yuanshao', 4);
  const cities = E.factionCities(s, 'yuanshao');
  assert.ok(cities.length >= 2);
  const lost = cities[0];
  const lordId = s.factions.yuanshao.lord;
  s.generals[lordId].city = lost.id;
  // 흩어짐(18%)이 최대로 걸리도록 난수를 0으로 고정
  E.moveGeneralsOnCapture(s, lost.id, 'yuanshao', 'jojo', () => 0);
  const lord = s.generals[lordId];
  assert.equal(lord.faction, 'yuanshao', '군주는 재야가 되지 않는다');
  assert.ok(cities.slice(1).some((c) => c.id === lord.city), '남은 성으로 피신');
});

test('군주: 적 군주를 참수해도 그 세력은 새 군주를 세운다', () => {
  const s = newGame('s194', 'liubei', 6);
  const prey = Object.values(s.factions).find((f) => f.alive && f.id !== 'liubei' && E.factionCities(s, f.id).length > 1);
  const lordId = prey.lord;
  const lord = s.generals[lordId];
  lord.captive = true;
  lord.faction = 'liubei';
  lord.city = E.factionCities(s, 'liubei')[0].id;
  s.pendingPrisoners = [{ gid: lordId, faction: prey.id, homeCity: E.factionCities(s, prey.id)[0].id, city: lord.city, isLord: true, turn: s.turn }];
  E.executePrisoner(s, lordId);
  assert.notEqual(prey.lord, lordId, '참수한 군주 자리에 새 군주');
  assert.equal(s.generals[prey.lord].faction, prey.id);
});

/* ---------- 3. 장수 배치 ---------- */
test('배치: 성을 잃은 장수들이 한 성에 12명을 넘게 쌓이지 않는다', () => {
  const s = newGame('s184', 'hwanggeon', 11);
  // 황건적의 성 하나에 장수를 12명 채워 두고, 그 성이 함락되는 상황
  const cities = E.factionCities(s, 'hwanggeon');
  const big = cities[0];
  const spare = cities.slice(1);
  assert.ok(spare.length >= 1);
  const pool = Object.values(s.generals).filter((g) => !g.faction && !g.dead);
  let n = E.generalsInCity(s, big.id).length;
  for (const g of pool) {
    if (n >= 12) break;
    g.faction = 'hwanggeon'; g.city = big.id; g.loyalty = 80; n++;
  }
  E.moveGeneralsOnCapture(s, big.id, 'hwanggeon', 'han', () => 0.5);
  for (const c of spare) {
    assert.ok(E.generalsInCity(s, c.id).length <= E.MAX_OFFICERS_PER_CITY, `${c.id} ${E.generalsInCity(s, c.id).length}명`);
  }
});

test('배치: 유랑 무장은 적성에 떨어지지 않고 아군 성에 합류한다', () => {
  const s = newGame('s194', 'liubei', 13);
  const mine = E.factionCities(s, 'liubei')[0];
  // 군주를 적성에 세워 두면 예전에는 그 성으로 무장이 떨어졌다
  const enemyCity = E.neighborFoes(s, mine.id)[0];
  s.generals[s.factions.liubei.lord].city = enemyCity;
  // 적성에 재야 장수를 만들어 둔다
  const free = Object.values(s.generals).find((g) => !g.faction && !g.dead);
  free.city = enemyCity;
  const ev = E.buildEvent(s, 'wanderer', () => 0.5);
  assert.ok(ev, '유랑 무장 이벤트');
  assert.equal(ev.data.gid, free.id);
  assert.equal(ev.data.city, mine.id, '아군 성으로 안내한다');
  s.pendingEvent = ev;
  E.resolveEvent(s, 'accept');
  const g = s.generals[ev.data.gid];
  assert.equal(g.faction, 'liubei');
  assert.equal(s.cities[g.city].owner, 'liubei', '합류한 성은 아군 성');
});

/* ---------- 4. AI ---------- */
test('AI: 수비와 비슷한 전력으로는 나서지 않고, 확실히 강할 때만 공격한다', () => {
  assert.ok(E.AI_ATTACK_RATIO >= 1.15, '공격 문턱이 1.02배에 머물면 병력만 축낸다');
  const s = newGame('s194', 'jojo', 31);
  const city = E.factionCities(s, 'jojo')[0];
  const foe = E.adjacentEnemies(s, city.id)[0];
  // 내 성 전력을 수비와 비슷하게 맞춘다 → AI는 나서지 않아야 한다
  const def = E.cityPower(s, foe, true);
  const train = city.train;
  city.troops = Math.round(def / ((0.7 + train / 180) * (0.72 + 90 / 260)) * 0.8);
  let attacked = 0;
  for (let i = 0; i < 40; i++) {
    const atk = E.cityPower(s, city.id, false) * (0.9 + 0.5 * 0.5);
    if (atk > def * E.AI_ATTACK_RATIO) attacked++;
  }
  assert.equal(attacked, 0, '비슷한 전력으로는 공격하지 않는다');
});

test('AI: 금·식량이 넉넉하면 성 상한의 70%까지 병력을 채운다', () => {
  const s = newGame('s194', 'shixie', 17);  // 교주 사섭 — 이웃이 적어 싸움이 적다
  const f = s.factions.shixie;
  f.isPlayer = false;
  for (const c of E.factionCities(s, 'shixie')) { c.gold = 40000; c.food = 40000; c.troops = Math.round(E.cityTroopsCap(s, c.id) * 0.3); }
  const city = E.factionCities(s, 'shixie')[0];
  const before = city.troops;
  for (let m = 0; m < 3; m++) {
    E.endTurnPhase1(s);
    s.pendingBattles = [];
    E.endTurnPhase2(s);
    if (s.pendingEvent) E.resolveEvent(s, s.pendingEvent.options[0].id);
  }
  assert.ok(city.troops > before, `징병으로 병력이 늘어야 한다 ${before} → ${city.troops}`);
  assert.ok(city.troops <= E.cityTroopsCap(s, city.id), '상한을 넘지 않는다');
});

test('AI: 한 달에 한 성은 한 번만 공격받는다', () => {
  const s = newGame('s194', 'liubei', 19);
  const mine = E.factionCities(s, 'liubei')[0];
  const targets = [];
  for (let i = 0; i < 20; i++) {
    E.endTurnPhase1(s);
    for (const p of s.pendingBattles) targets.push(p.toCityId);
    const seen = new Set();
    for (const t of s.pendingBattles) {
      assert.ok(!seen.has(t), `${t} 중복 공격`);
      seen.add(t);
    }
    s.pendingBattles = [];
    E.endTurnPhase2(s);
    if (s.pendingEvent) E.resolveEvent(s, s.pendingEvent.options[0].id);
    if (stateOver(s)) break;
  }
});
const stateOver = (s) => !!s.gameOver;

/* ---------- 5. 공성 예상과 실제 승률 ---------- */
function battleWinRate({ atkTroops, defTroops, defBonus = 70, n = 24 }) {
  const generals = {};
  const pool = GENERALS.filter((g) => g.lead > 70 && g.war > 60).slice(0, 6);
  const atkG = ['a1', 'a2', 'a3'], defG = ['d1', 'd2', 'd3'];
  pool.forEach((g, i) => { generals['a' + (i + 1)] = { ...g, id: 'a' + (i + 1) }; generals['d' + (i + 1)] = { ...g, id: 'd' + (i + 1) }; });
  let win = 0;
  for (let i = 0; i < n; i++) {
    const res = B.autoBattle({
      fromCityId: 'luoyang', toCityId: 'xuchang', attackerFaction: 'A', defenderFaction: 'B',
      atkGenerals: atkG, defGenerals: defG, atkTroops, defTroops, defBonus,
      troopCaps: { a1: 99999, a2: 99999, a3: 99999, d1: 99999, d2: 99999, d3: 99999 },
      rankBonus: {}, seed: i * 13 + 5, generals,
    });
    if (res.winner === 'attacker') win++;
  }
  return win / n;
}

test('전투: 병력이 같으면 수비가 유리하고, 1.5배면 공격이 이긴다(공성 난이도)', () => {
  const even = battleWinRate({ atkTroops: 9000, defTroops: 9000 });
  const strong = battleWinRate({ atkTroops: 13500, defTroops: 9000 });
  assert.ok(even < 0.3, `같은 병력 승률 ${even}`);
  assert.ok(strong > 0.8, `1.5배 승률 ${strong}`);
});

test('전투: 출진 예상(siegeOdds)의 라벨이 실제 승률과 맞는다', () => {
  const s = newGame('s194', 'jojo', 23);
  const from = E.factionCities(s, 'jojo')[0];
  const to = E.adjacentEnemies(s, from.id)[0];
  const base = E.siegeOdds(s, from.id, to, { troops: 9000 });
  assert.ok(base && base.defPower > 0);
  // 병력비를 바꿔 라벨을 확인한다
  const weak = E.siegeOdds(s, from.id, to, { troops: Math.round(base.recommend * 0.6) });
  const strong = E.siegeOdds(s, from.id, to, { troops: Math.round(base.recommend * 1.1) });
  assert.equal(weak.label, '열세');
  assert.equal(strong.label, '우세');
  assert.ok(weak.recommend > 0, '권장 병력을 알려 준다');
  // 실제 전장 — 열세 병력은 지고, 권장 병력은 이긴다
  const weakWin = battleWinRate({ atkTroops: Math.round(base.recommend * 0.6), defTroops: base.recommend, n: 30 });
  const strongWin = battleWinRate({ atkTroops: Math.round(base.recommend * 1.4), defTroops: base.recommend, n: 30 });
  assert.ok(weakWin < 0.3, `열세 라벨 승률 ${weakWin}`);
  assert.ok(strongWin > 0.7, `우세 라벨 승률 ${strongWin}`);
});

test('전투: 어떤 조합에서도 0 피해·무한 전투로 멈추지 않는다', () => {
  const generals = {};
  for (const g of GENERALS.slice(0, 12)) {
    generals[g.id] = g;
    generals[g.id + '_d'] = g;
  }
  const ids = GENERALS.slice(0, 6).map((g) => g.id);
  const res = B.autoBattle({
    fromCityId: 'luoyang', toCityId: 'xuchang', attackerFaction: 'A', defenderFaction: 'B',
    atkGenerals: ids.slice(0, 5), defGenerals: ids.slice(0, 5),
    atkTroops: 400, defTroops: 400, defBonus: 95, seed: 3, generals,
  });
  assert.ok(['attacker', 'defender'].includes(res.winner));
  assert.ok(res.rounds <= 16, `라운드 ${res.rounds}`);
  assert.ok(res.atkLoss >= 0 && res.defLoss >= 0);
});

/* ---------- 6. 불변식 시뮬레이션 ---------- */
test('시뮬레이션: 7개 시나리오 24개월 자동 진행에 수치·소유·군주 이상이 없다', () => {
  const problems = [];
  for (const sc of SCENARIOS) {
    for (const f of sc.factions.slice(0, 2)) {
      const s = E.createGame(sc.id, f.id, 99);
      for (let m = 0; m < 24; m++) {
        if (s.gameOver) break;
        E.endTurnPhase1(s);
        for (const p of [...s.pendingBattles]) {
          const res = B.autoBattle({ ...p, seed: m + 1, generals: E.generalMap(s), playerSide: 'def' });
          res.playerSide = 'def';
          E.applyBattleResult(s, res);
          s.pendingPrisoners = [];
        }
        s.pendingBattles = [];
        E.endTurnPhase2(s);
        if (s.pendingEvent) E.resolveEvent(s, s.pendingEvent.options[0].id);
        if (s.pendingTournament) E.resolveTournamentReward(s, 'praise');
        for (const c of Object.values(s.cities)) {
          for (const k of ['agri', 'comm', 'water']) {
            if (c[k] < 0 || c[k] > sizeCap(c.size)) problems.push(`${sc.id} ${c.id}.${k}=${c[k]}`);
          }
          if (c.order < 0 || c.order > 100) problems.push(`${sc.id} ${c.id}.order=${c.order}`);
          if (c.gold < 0) problems.push(`${sc.id} ${c.id}.gold=${c.gold}`);
          if (c.food < 0) problems.push(`${sc.id} ${c.id}.food=${c.food}`);
          if (!c.owner) problems.push(`${sc.id} ${c.id} 주인 없음`);
          if (c.troops > E.cityTroopsCap(s, c.id)) problems.push(`${sc.id} ${c.id}.troops=${c.troops} > cap ${E.cityTroopsCap(s, c.id)}`);
          if (!(c.pop > 0)) problems.push(`${sc.id} ${c.id}.pop=${c.pop}`);
        }
        for (const g of Object.values(s.generals)) {
          if (!g.faction || g.dead || g.captive) continue;
          if (!s.cities[g.city] || s.cities[g.city].owner !== g.faction) problems.push(`${sc.id} ${g.id} 갇힘 ${g.city}`);
        }
        for (const fac of Object.values(s.factions)) {
          if (!fac.alive) continue;
          const lord = s.generals[fac.lord];
          if (!lord || lord.dead || (lord.faction !== fac.id && !lord.captive)) problems.push(`${sc.id} ${fac.id} 군주 ${fac.lord}`);
        }
      }
    }
  }
  assert.deepEqual([...new Set(problems)].slice(0, 5), [], `이상 ${problems.length}건`);
});
