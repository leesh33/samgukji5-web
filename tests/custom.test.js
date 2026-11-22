import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, CITY_BY_ID, CUSTOM_COLORS, CITIES } from '../js/data.js';
import * as E from '../js/engine.js';
import * as B from '../js/battle.js';

const draft = (over = {}) => ({
  name: '한호',
  mark: '한',
  color: CUSTOM_COLORS[3].hex,
  cityId: E.customStartCities('s194')[0].cityId,
  stats: { lead: 72, war: 66, int: 58, pol: 54, cha: 60 },
  skill: 'dolgyeok',
  arms: '기병',
  retinue: 2,
  style: { hat: 2, beard: 3, skin: 2 },
  ...over,
});

test('신군주 생성: 세력·군주·휘하 장수가 게임 상태에 들어간다', () => {
  const custom = E.buildCustomLord(draft());
  const s = E.createGame('s194', custom.faction.id, 4242, { custom });
  assert.equal(s.version, E.SAVE_VERSION);
  const f = s.factions[s.playerId];
  assert.ok(f, '신세력 존재');
  assert.equal(f.name, '한호');
  assert.equal(f.mark, '한');
  assert.equal(f.color, CUSTOM_COLORS[3].hex);
  assert.equal(f.lord, 'cl_lord');
  assert.equal(f.custom, true);
  assert.equal(E.factionCities(s, s.playerId).length, 1);
  assert.equal(s.cities[custom.cityId].owner, s.playerId);
  // 군주·휘하 장수가 자기 성에 배치
  const gens = E.generalsInCity(s, custom.cityId);
  assert.deepEqual(gens.map((g) => g.id).sort(), ['cl_lord', 'cl_mate1', 'cl_mate2']);
  // 능력치/특기/병과가 그대로 살아 있다
  const lord = E.generalOf(s, 'cl_lord');
  assert.equal(lord.ko, '한호');
  assert.equal(lord.lead, 72);
  assert.equal(lord.skill, 'dolgyeok');
  assert.equal(lord.arms, '기병');
  assert.deepEqual(lord.style, { hat: 2, beard: 3, skin: 2 });
  // 군주는 충성 100
  assert.equal(s.generals.cl_lord.loyalty, 100);
  // 원래 성 주인이 세력은 남아 있고, 성 하나만 잃는다
  const fromId = SCENARIOS.find((x) => x.id === 's194').factions.find((x) => x.cities.includes(custom.cityId)).id;
  const fromCities = E.factionCities(s, fromId).length;
  assert.ok(fromCities >= 1, `${fromId} 세력 유지`);
  assert.equal(s.factions[fromId].alive, true);
});

test('신군주: 모든 시나리오 × 시작 성 후보에서 게임이 만들어진다', () => {
  let count = 0;
  for (const sc of SCENARIOS) {
    const cities = E.customStartCities(sc.id);
    assert.ok(cities.length > 0, `${sc.id} 시작 성 후보`);
    for (const c of cities) {
      const custom = E.buildCustomLord(draft({ cityId: c.cityId, name: `군주${count % 9}`, retinue: count % 3 }));
      const s = E.createGame(sc.id, custom.faction.id, 1000 + count, { custom });
      count++;
      // 성 42곳 모두 소유자가 있어야 한다
      for (const city of Object.values(s.cities)) assert.ok(city.owner, `${city.id} 소유자`);
      assert.equal(s.cities[c.cityId].owner, s.playerId);
      // 원 세력이 성을 하나도 잃고 멸망하지 않는다
      for (const f of Object.values(s.factions)) {
        if (f.id === s.playerId) continue;
        assert.ok(E.factionCities(s, f.id).length >= 1, `${sc.id} ${f.name} 성 유지`);
      }
      // 시작 성 후보는 모두 성이 둘 이상인 세력에서 나온다
      assert.ok(c.fromCities >= 2);
    }
  }
  assert.ok(count > 80, `조합 ${count}건`);
});

test('신군주: 이름·색 검증과 기본값', () => {
  assert.throws(() => E.buildCustomLord(draft({ name: '가' })), /2~6자/);
  assert.throws(() => E.buildCustomLord(draft({ name: '' })), /2~6자/);
  const c = E.buildCustomLord(draft({ name: '여섯글자군주' }));
  assert.equal(c.lord.ko.slice(0, 6), '여섯글자군주');
  // 팔레트에 없는 색은 첫 색으로
  const c2 = E.buildCustomLord(draft({ color: '#123456' }));
  assert.equal(c2.faction.color, CUSTOM_COLORS[0].hex);
  // 깃발 글자 미입력 시 이름 첫 글자
  const c3 = E.buildCustomLord(draft({ mark: '' }));
  assert.equal(c3.faction.mark, '한');
  // 한글이 아닌 글자는 이름 첫 글자로 대체
  const c5 = E.buildCustomLord(draft({ mark: 'A' }));
  assert.equal(c5.faction.mark, '한');
  // 휘하 0명
  const c4 = E.buildCustomLord(draft({ retinue: 0 }));
  assert.equal(c4.retinue.length, 0);
});

test('신군주: 주사위 능력치 총합·범위', () => {
  const keys = ['lead', 'war', 'int', 'pol', 'cha'];
  const sumOf = (st) => keys.reduce((n, k) => n + st[k], 0);
  assert.equal(E.CUSTOM_STAT_BUDGET, 255);
  const sums = new Set();
  let high = 0;
  let full = 0;
  for (let i = 0; i < 600; i++) {
    const st = E.rollCustomStats();
    const sum = sumOf(st);
    assert.ok(sum >= E.CUSTOM_STAT_DICE_MIN && sum <= E.CUSTOM_STAT_BUDGET, `총합 ${sum}`);
    assert.ok(sum <= 255, `총합 상한 ${sum}`);
    for (const k of keys) {
      assert.ok(st[k] >= E.CUSTOM_STAT_MIN && st[k] <= E.CUSTOM_STAT_MAX, `${k}=${st[k]}`);
    }
    sums.add(sum);
    if (sum >= 240) high++;
    if (sum === E.CUSTOM_STAT_BUDGET) full++;
  }
  // 여러 번 굴리면 총합이 매번 같지 않고 넓게 퍼진다(낮은 쪽·높은 쪽 모두)
  assert.ok(sums.size >= 20, `총합 종류 ${sums.size}가지`);
  assert.ok(Math.min(...sums) <= E.CUSTOM_STAT_DICE_MIN + 15, `낮은 총합 ${Math.min(...sums)}`);
  assert.ok(high >= 20, `240 이상 ${high}회`);
  // 가끔 만점(255)이 뜬다
  assert.ok(full >= 1, `만점 ${full}회`);
  // 주사위 총합 자체의 경계
  assert.equal(E.rollCustomTotal(() => 0), E.CUSTOM_STAT_BUDGET); // 낮은 난수는 만점
  const lowest = E.rollCustomTotal(() => 0.06);
  assert.equal(lowest, E.CUSTOM_STAT_DICE_MIN);
  const top = E.rollCustomTotal(() => 0.999999);
  assert.equal(top, E.CUSTOM_STAT_BUDGET);
  // 수동 보정: 210이 나왔다면 남은 45점을 직접 더해 255까지 채울 수 있다
  let st = { lead: 60, war: 50, int: 40, pol: 30, cha: 30 }; // 210
  assert.equal(sumOf(st), 210);
  while (sumOf(st) < 255) {
    const k = keys.find((key) => st[key] < 96);
    const r = E.adjustCustomStat(st, k, 1);
    assert.ok(r.ok, r.reason);
    st = r.stats;
  }
  assert.equal(sumOf(st), 255);
  assert.equal(st.lead, 96);
  // 255를 채운 뒤에는 더 못 늘리고, 줄인 만큼만 다시 넣을 수 있다
  const blocked = E.adjustCustomStat(st, 'war', 1);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'budget');
  assert.equal(sumOf(blocked.stats), 255);
  const lowered = E.adjustCustomStat(st, 'lead', -5);
  assert.equal(sumOf(lowered.stats), 250);
  const refill = E.adjustCustomStat(lowered.stats, 'war', 5);
  assert.ok(refill.ok, refill.reason);
  assert.equal(sumOf(refill.stats), 255);
  // 항목 상한·하한은 총합과 별개로 지켜진다
  assert.equal(E.adjustCustomStat({ lead: 96, war: 40, int: 40, pol: 40, cha: 39 }, 'lead', 1).ok, false);
  assert.equal(E.adjustCustomStat({ lead: 20, war: 40, int: 40, pol: 40, cha: 39 }, 'lead', -1).ok, false);
});

test('신군주: 저장 → 불러오기 → 이어하기에 신세력이 그대로 살아난다', () => {
  const custom = E.buildCustomLord(draft({ name: '구천', mark: '구', retinue: 1 }));
  const s = E.createGame('s200', custom.faction.id, 777, { custom });
  const city = E.factionCities(s, s.playerId)[0];
  const officer = E.generalsInCity(s, city.id).find((g) => g.id === 'cl_lord');
  const r = E.runCommand(s, 'agri', { cityId: city.id, officerId: officer.id });
  assert.ok(r.ok, r.msg);
  E.endTurnPhase1(s);
  s.pendingBattles = [];
  E.endTurnPhase2(s);

  const json = E.serialize(s);
  const s2 = E.deserialize(json);
  assert.equal(s2.playerId, s.playerId);
  assert.equal(s2.factions[s2.playerId].name, '구천');
  assert.equal(s2.factions[s2.playerId].color, custom.faction.color);
  const lord = E.generalOf(s2, 'cl_lord');
  assert.ok(lord, '신군주 데이터 복원');
  assert.equal(lord.ko, '구천');
  assert.equal(lord.lead, 72);
  assert.equal(lord.arms, '기병');
  assert.deepEqual(lord.formations, E.generalOf(s, 'cl_lord').formations);
  assert.ok(E.generalOf(s2, 'cl_mate1'), '휘하 장수 복원');
  assert.equal(E.factionCities(s2, s2.playerId).length, E.factionCities(s, s.playerId).length);
  // 이후 진행도 계속 돈다
  for (let i = 0; i < 6; i++) {
    E.endTurnPhase1(s2);
    s2.pendingBattles = [];
    E.endTurnPhase2(s2);
  }
  assert.ok(s2.turn > 5);
});

test('신군주: 예전(3) 저장 파일도 열린다', () => {
  const s = E.createGame('s194', 'jojo', 9);
  const old = JSON.parse(E.serialize(s));
  old.version = 3;
  delete old.customGenerals;
  const back = E.deserialize(JSON.stringify(old));
  assert.equal(back.version, E.SAVE_VERSION);
  assert.deepEqual(back.customGenerals, {});
  assert.equal(E.factionCities(back, 'jojo').length, 2);
});

test('신군주: 전투에 신군주 부대가 실제로 편성된다', () => {
  const custom = E.buildCustomLord(draft({ name: '백호', retinue: 2 }));
  const s = E.createGame('s194', custom.faction.id, 31, { custom });
  const from = E.factionCities(s, s.playerId)[0];
  const enemies = E.adjacentEnemies(s, from.id);
  assert.ok(enemies.length > 0, '인접 적 성');
  const defGens = E.generalsInCity(s, enemies[0]).map((g) => g.id);
  const b = B.createBattle({
    fromCityId: from.id, toCityId: enemies[0],
    attackerFaction: s.playerId, defenderFaction: s.cities[enemies[0]].owner,
    atkGenerals: ['cl_lord', 'cl_mate1', 'cl_mate2'],
    defGenerals: defGens,
    atkTroops: from.troops, defTroops: s.cities[enemies[0]].troops,
    defBonus: s.cities[enemies[0]].def,
    seed: 5, playerSide: 'atk', generals: E.generalMap(s),
  });
  const lordUnit = b.units.find((u) => u.gid === 'cl_lord');
  assert.ok(lordUnit, '신군주 부대');
  assert.equal(lordUnit.name, '백호');
  assert.equal(B.unitSpec(lordUnit).war, custom.lord.war);
  assert.equal(B.unitSpec(lordUnit).arms, '기병');
  assert.equal(B.unitSpec(lordUnit).formations[0], 'eorin');
  assert.ok(B.movePoints(lordUnit) >= 2);
  // 부대를 움직여 전투가 진행된다
  const reach = B.reachable(b, lordUnit);
  assert.ok(reach.size > 1, '이동 가능 타일');
});
