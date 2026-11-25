import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as B from '../js/battle.js';
import * as LG from '../js/legion-core.js';
import { GENERAL_BY_ID } from '../js/data.js';

/* ⚔️ 영웅전 — 비동기 유저 군단 (원정 도전장 · 유저 군단 습격)
   · 전력 식·검증·매칭·습격 판정은 순수 로직(legion-core.js)
   · 군단 등록·보상·약탈은 엔진(engine.js)
   · 전장은 기존 battle.js 를 그대로 쓰되 내 세이브를 건드리지 않는다 */

const newGame = (seed = 21) => E.createGame('s194', 'jojo', seed);
const sampleLegion = (power = 2000) => {
  const gens = [
    { id: 'lx1', ko: '가', lead: 70, war: 70, int: 70, troops: 3000, arm: '기병', formation: 'hakyik' },
    { id: 'lx2', ko: '나', lead: 60, war: 60, int: 60, troops: 2400, arm: '보병', formation: 'bangwon' },
  ];
  const troops = gens.reduce((s, g) => s + g.troops, 0);
  return { id: 'legion-a', nickname: '시험 군단', cityId: 'xuchang', cityName: '허창', generals: gens, troopsTotal: troops, power, wins: 2, losses: 1 };
};

/* ---------- 전력 · 검증 ---------- */
test('전력 — 앱과 서버가 같은 식(정수 내림)', () => {
  const g = [
    { lead: 80, war: 90, int: 60, troops: 5000 },
    { lead: 70, war: 75, int: 88, troops: 3000 },
  ];
  // (80*12 + 90*15 + 60*8 + 70*12 + 75*15 + 88*8) = 960+1350+480+840+1125+704 = 5459 → /10 = 545
  // 병력 8000 / 12 = 666
  assert.equal(LG.powerOf(g, 8000), 545 + 666);
  assert.equal(LG.powerOf(g, 8000), E.legionPowerOf(g, 8000), '엔진과 같은 값');
  assert.equal(LG.powerOf([], 0), 0);
  // 능력치 상한(100)·병력 상한(30000)을 넘겨도 그 위로는 오르지 않는다
  const cheat = [{ lead: 999, war: 999, int: 999, troops: 999999 }];
  assert.equal(LG.powerOf(cheat, 999999), LG.powerOf([{ lead: 100, war: 100, int: 100, troops: 30000 }], 60000));
});

test('검증 — 장수 5명·능력치 1~100·부대 30,000·총 60,000', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: `g${i}`, ko: `장${i}`, lead: 50, war: 50, int: 50, troops: 1000 }));
  const ok = LG.sanitizeLegion({ nickname: '  군단  ', cityId: 'xuchang', generals: many });
  assert.equal(ok.ok, true);
  assert.equal(ok.legion.generals.length, 5, '5명까지만');
  assert.equal(ok.legion.nickname, '군단');

  const bad = LG.sanitizeLegion({ nickname: '', cityId: 'xuchang', generals: many });
  assert.equal(bad.ok, false);
  const badCity = LG.sanitizeLegion({ nickname: '군단', cityId: 'atlantis', generals: many });
  assert.equal(badCity.ok, false);
  const noGen = LG.sanitizeLegion({ nickname: '군단', cityId: 'xuchang', generals: [] });
  assert.equal(noGen.ok, false);

  const clamped = LG.sanitizeLegion({
    nickname: '군단', cityId: 'xuchang',
    generals: [{ id: 'x', ko: '장수', lead: 250, war: -5, int: 33, troops: 999999, arm: '코끼리', formation: '없는진형' }],
  });
  assert.equal(clamped.ok, true);
  const g = clamped.legion.generals[0];
  assert.equal(g.lead, 100);
  assert.equal(g.war, 1);
  assert.equal(g.troops, LG.LEGION.TROOPS_PER_GENERAL_MAX);
  assert.equal(g.arm, '보병');
  assert.equal(g.formation, 'eorin');

  const over = LG.sanitizeLegion({
    nickname: '군단', cityId: 'xuchang',
    generals: Array.from({ length: 5 }, (_, i) => ({ id: `o${i}`, ko: '장', lead: 60, war: 60, int: 60, troops: 30000 })),
  });
  assert.equal(over.ok, true);
  assert.ok(over.legion.troopsTotal <= LG.LEGION.TROOPS_TOTAL_MAX, '총 병력 상한');
});

test('DB 줄 정규화 — snake_case·camel 모두 받는다', () => {
  const a = LG.normalizeRow({ id: 'u1', nickname: ' 군단 ', power: 2100, troop_total: 9000, wins: 3, losses: 1, generals: [] });
  assert.equal(a.nickname, '군단');
  assert.equal(a.troopsTotal, 9000);
  assert.equal(a.wins, 3);
  const b = LG.normalizeRow({ id: 'u2', nickname: '군단2', power: 0, troopTotal: 4000, generals: [{ id: 'g', ko: '장', lead: 60, war: 60, int: 60, troops: 4000 }] });
  assert.ok(b.power > 0, '전력이 비면 장수·병력으로 다시 센다');
  assert.equal(LG.recordLabel(3, 0), '3승 0패');
});

/* ---------- 매칭 ---------- */
test('매칭 — 전력 구간 안에서 가까운 순, 모자라면 바깥에서 채운다', () => {
  const mine = { id: 'me', power: 2000 };
  const pool = [
    { id: 'a', nickname: 'A', power: 2100, generals: [{ id: 'a1', ko: '장', troops: 1000 }] },
    { id: 'b', nickname: 'B', power: 4000, generals: [{ id: 'b1', ko: '장', troops: 1000 }] },
    { id: 'c', nickname: 'C', power: 1900, generals: [{ id: 'c1', ko: '장', troops: 1000 }] },
    { id: 'me', nickname: '나', power: 2000, generals: [{ id: 'm1', ko: '장', troops: 1000 }] },
    { id: 'd', nickname: 'D', power: 900, generals: [{ id: 'd1', ko: '장', troops: 1000 }] },
  ];
  const list = LG.matchOpponents(mine, pool, 3);
  assert.equal(list.length, 3);
  assert.ok(!list.some((r) => r.id === 'me'), '내 군단은 빼고');
  assert.deepEqual(list.slice(0, 2).map((r) => r.id), ['a', 'c'], '구간 안에서 가까운 순');
  assert.equal(list[2].id, 'b', '구간 밖은 전력이 가까운 쪽');

  const byDevice = LG.matchOpponents({ id: 'x', deviceId: 'dev-1', power: 2000 }, [
    { id: 'p', device_id: 'dev-1', nickname: 'P', power: 2000, generals: [{ id: 'p1', ko: '장', troops: 1 }] },
    { id: 'q', nickname: 'Q', power: 2000, generals: [{ id: 'q1', ko: '장', troops: 1 }] },
  ], 2);
  assert.deepEqual(byDevice.map((r) => r.id), ['q'], '같은 기기는 빼고');
});

test('프리셋 — 6~8개, 전력이 고르게 퍼져 있고 모두 검증을 통과한다', () => {
  assert.ok(LG.PRESET_LEGIONS.length >= 6 && LG.PRESET_LEGIONS.length <= 8);
  const powers = LG.PRESET_LEGIONS.map((p) => LG.powerOf(p.generals, LG.troopsOf(p.generals)));
  assert.ok(Math.min(...powers) < 1300, '초반에도 겨룰 하위 구간');
  assert.ok(Math.max(...powers) > 4000, '중반 이후 상위 구간');
  for (const p of LG.PRESET_LEGIONS) {
    const check = LG.sanitizeLegion(p);
    assert.equal(check.ok, true, `${p.nickname} 검증`);
    assert.ok(check.legion.generals.length >= 2 && check.legion.generals.length <= 5);
    assert.ok(LG.recordLabel(0, 0).length > 0);
  }
});

/* ---------- 습격 판정 ---------- */
test('습격 판정 — 12개월 이전·전력 미달·쿨다운에는 오지 않는다', () => {
  const yes = { rng: () => 0.01 };
  assert.equal(LG.invasionRoll({ turn: 5, power: 3000, lastTurn: 0, ...yes }).invade, false);
  assert.equal(LG.invasionRoll({ turn: 20, power: 100, lastTurn: 0, ...yes }).invade, false);
  assert.equal(LG.invasionRoll({ turn: 20, power: 3000, lastTurn: 19, ...yes }).invade, false, '쿨다운 3개월');
  assert.equal(LG.invasionRoll({ turn: 20, power: 3000, lastTurn: 17, ...yes }).invade, true);
  assert.equal(LG.invasionRoll({ turn: 20, power: 3000, lastTurn: 0, rng: () => 0.99 }).invade, false, '확률 밖');
  assert.equal(LG.invasionRoll({ turn: 20, power: 3000, lastTurn: 0, hasOpponent: false }).invade, false);
  // 12개월 이후 16% — 1000번 중 대략 그 정도
  let n = 0;
  const seq = (() => { let i = 0; return () => ((i++ * 0.001) % 1); })();
  for (let i = 0; i < 1000; i++) if (LG.invasionRoll({ turn: 30, power: 3000, lastTurn: 0, rng: seq }).invade) n++;
  assert.ok(n > 120 && n < 200, `습격 확률 ≈16% (실제 ${n}/1000)`);
});

test('보상·약탈 — 범위가 게임 경제에 맞는다', () => {
  const r = LG.expeditionReward(2500, () => 0.5);
  assert.ok(r.gold >= 100 && r.gold <= 400, `금 ${r.gold}`);
  assert.ok(r.food >= 150 && r.food <= 600, `군량 ${r.food}`);
  assert.ok(r.fame >= 2 && r.fame <= 4);
  assert.ok(r.merit >= 30 && r.merit <= 50);
  const d = LG.defenseReward(2500, () => 0.5);
  assert.ok(d.gold > 0 && d.food > 0 && d.fame >= 3);
  const l = LG.invasionLoss(2500, () => 0.5);
  assert.ok(l.goldPct > 0 && l.goldPct < 0.2 && l.foodPct > 0 && l.troopPct > 0 && l.troopPct < 0.15);
  const h = LG.siegeHold(2500, () => 0.5);
  assert.ok(h.goldPct < l.goldPct && h.foodPct < l.foodPct && h.troopPct === 0, '성문을 닫으면 병력은 잃지 않는다');
});

/* ---------- 전장 준비물 ---------- */
test('원정 전장 — 내가 공격측, 상대 장수는 내 세이브와 겹치지 않는 id', () => {
  const state = newGame(33);
  const cid = E.bestLegionCity(state);
  const mine = E.legionSnapshot(state, cid);
  const foe = LG.normalizeRow(LG.PRESET_LEGIONS[2]);
  const setup = LG.legionBattleSetup({ kind: 'expedition', mine, enemy: foe });
  assert.equal(setup.fromCityId, cid);
  assert.equal(setup.toCityId, foe.cityId);
  assert.equal(setup.defBonus, LG.LEGION.FIELD_DEF_BONUS, '야전');
  assert.deepEqual(setup.atkGenerals, mine.generals.map((g) => g.id));
  assert.equal(setup.atkTroops, mine.troopsTotal);
  const sum = Object.values(setup.troopsByGeneral).reduce((s, v) => s + v, 0);
  assert.equal(sum, mine.troopsTotal, '장수별 병력 합 = 군단 병력');
  for (const gid of setup.defGenerals) {
    assert.ok(!GENERAL_BY_ID[gid], `${gid} 는 실제 장수 id 가 아니다`);
    assert.ok(gid.startsWith('lx'), '접두사 lx');
  }
  // 상대 장수 spec 이 전장에 그대로 넘어간다
  const specs = LG.enemySpecsOf(foe);
  const battle = B.createBattle({ ...setup, seed: 5, playerSide: 'atk', generals: { ...E.generalMap(state), ...specs.map } });
  assert.equal(B.unitsOf(battle, 'atk').length, mine.generals.length);
  assert.ok(B.unitsOf(battle, 'def').length >= 1);
  assert.equal(B.unitSpec(B.unitsOf(battle, 'def')[0]).ko, foe.generals[0].ko);
});

test('습격 전장 — 상대로부터 내 성을 지킨다(수비측)', () => {
  const mine = sampleLegion();
  const foe = LG.normalizeRow(LG.PRESET_LEGIONS[4]);
  const setup = LG.legionBattleSetup({ kind: 'invasion', mine, enemy: foe, cityTroops: 8400, cityDef: 62 });
  assert.equal(setup.toCityId, 'xuchang');
  assert.equal(setup.fromCityId, foe.cityId);
  assert.deepEqual(setup.defGenerals, mine.generals.map((g) => g.id));
  assert.equal(setup.defTroops, 8400, '성의 수비 병력');
  assert.equal(setup.defBonus, 62, '성 방어 보정');
  const specs = LG.enemySpecsOf(foe);
  const battle = B.createBattle({ ...setup, seed: 7, playerSide: 'def', generals: { ...specs.map } });
  assert.equal(battle.playerSide, 'def');
  assert.ok(B.unitsOf(battle, 'atk').length >= 1);
  const res = B.autoBattle({ ...setup, seed: 7, generals: { ...specs.map } });
  assert.ok(res.winner === 'attacker' || res.winner === 'defender');
});

test('원정 한 판 — 내 세이브(성·장수)는 그대로다', () => {
  const state = newGame(31);
  const before = E.serialize(state);
  const cid = E.bestLegionCity(state);
  const mine = E.legionSnapshot(state, cid);
  const foe = LG.normalizeRow(LG.PRESET_LEGIONS[1]);
  const caps = {};
  for (const g of mine.generals) caps[g.id] = E.maxTroopsOf(state, g.id);
  const setup = LG.legionBattleSetup({ kind: 'expedition', mine, enemy: foe, caps });
  const specs = LG.enemySpecsOf(foe);
  const res = B.autoBattle({ ...setup, seed: 11, generals: { ...E.generalMap(state), ...specs.map } });
  assert.ok(res.atkLoss >= 0 && res.defLoss >= 0);
  assert.equal(E.serialize(state), before, '전장을 돌려도 세이브가 바뀌지 않는다');
});

/* ---------- 엔진 ---------- */
test('군단 스냅샷 — 최정예 5명, 병력은 성 총병력을 넘지 않고 성은 그대로', () => {
  const s = newGame(41);
  const cid = E.bestLegionCity(s);
  assert.ok(cid);
  const troopsBefore = s.cities[cid].troops;
  const genBefore = E.generalsInCity(s, cid).map((g) => g.id).sort();
  const snap = E.legionSnapshot(s, cid);
  assert.ok(snap.generals.length >= 1 && snap.generals.length <= 5);
  assert.equal(snap.troopsTotal, snap.generals.reduce((n, g) => n + g.troops, 0));
  assert.ok(snap.troopsTotal <= Math.round(troopsBefore));
  assert.ok(snap.power > 0);
  assert.equal(snap.cityName, E.cityName(cid));
  assert.equal(s.cities[cid].troops, troopsBefore, '성 병력은 줄지 않는다');
  assert.deepEqual(E.generalsInCity(s, cid).map((g) => g.id).sort(), genBefore);
  // 남의 성·없는 성은 안 된다
  assert.equal(E.legionSnapshot(s, 'wu'), null);
  assert.equal(E.legionSnapshot(s, 'nope'), null);
});

test('군단 스냅샷 — 부대 편성이 있으면 그 병력대로 뜬다', () => {
  const s = newGame(42);
  const cid = 'xuchang';
  const gens = E.generalsInCity(s, cid).slice(0 	, 5);
  assert.ok(gens.length >= 1);
  s.generals[gens[0].id].assignedTroops = 1500;
  const snap = E.legionSnapshot(s, cid);
  assert.ok(snap.troopsTotal <= Math.round(s.cities[cid].troops));
  assert.ok(snap.generals.some((g) => g.troops > 0));
});

test('세이브 호환 — legion 이 없던 저장도 열리고, 등록본은 그대로 남는다', () => {
  const s = newGame(51);
  delete s.legion;
  const back = E.deserialize(E.serialize(s));
  assert.ok(back.legion, '열 때 기본값이 채워진다');
  assert.equal(back.legion.registered, null);
  assert.deepEqual(back.legion.records, { wins: 0, losses: 0, defenseWins: 0, defenseLosses: 0 });

  const cid = E.bestLegionCity(back);
  const snap = E.legionSnapshot(back, cid);
  E.setRegisteredLegion(back, snap, { id: 'row-1', server: true });
  const again = E.deserialize(E.serialize(back));
  assert.equal(again.legion.registered.id, 'row-1');
  assert.equal(again.legion.registered.nickname, snap.nickname);
  assert.equal(again.legion.registered.generals.length, snap.generals.length);
  assert.equal(again.legion.registered.power, snap.power);
  assert.equal(again.version, E.SAVE_VERSION);
});

test('보상 — 금·군량은 곳간 상한까지만, 공적은 성의 장수에게', () => {
  const s = newGame(61);
  const cid = E.bestLegionCity(s);
  const cap = E.cityStoreCap(s, cid);
  s.cities[cid].gold = cap.gold - 10;
  s.cities[cid].food = cap.food - 20;
  const meritBefore = E.generalsInCity(s, cid)[0].merit || 0;
  const got = E.legionReward(s, cid, { gold: 5000, food: 5000, fame: 3, merit: 30 });
  assert.equal(s.cities[cid].gold, cap.gold, '곳간 상한에서 멈춘다');
  assert.equal(s.cities[cid].food, cap.food);
  assert.equal(got.gold, 10);
  assert.ok(got.merit > 0);
  assert.ok((E.generalsInCity(s, cid)[0].merit || 0) > meritBefore);
});

test('약탈 — 성은 그대로, 금·군량·병사만 줄고 치안이 내려간다', () => {
  const s = newGame(62);
  const cid = E.bestLegionCity(s);
  const gold = s.cities[cid].gold;
  const food = s.cities[cid].food;
  const troops = s.cities[cid].troops;
  const order = s.cities[cid].order;
  const owner = s.cities[cid].owner;
  const lost = E.legionRaidLoss(s, cid, { goldPct: 0.06, foodPct: 0.08, troopPct: 0.05, fame: -2 });
  assert.equal(s.cities[cid].owner, owner, '성을 빼앗기지 않는다');
  assert.equal(lost.gold, Math.round(gold * 0.06));
  assert.ok(lost.food > 0 && lost.troops > 0);
  assert.ok(s.cities[cid].troops < troops);
  assert.ok(s.cities[cid].order < order);
  assert.ok(E.factionCities(s, s.playerId).length >= 1);
});

test('등록본 — 전적·서버 여부가 저장에 남는다', () => {
  const s = newGame(63);
  const L = E.ensureLegion(s);
  const cid = E.bestLegionCity(s);
  const snap = E.legionSnapshot(s, cid);
  const reg = E.setRegisteredLegion(s, { ...snap, wins: 4, losses: 2 }, { server: true, id: 'abc' });
  assert.equal(reg.wins, 4);
  assert.equal(reg.losses, 2);
  assert.equal(reg.server, true);
  assert.equal(L.registered, reg);
});

test('원정 보상 — 가끔 임자 없는 보물을 거둔다', () => {
  const s = newGame(71);
  const owned = () => E.infoTreasures(s).filter((t) => t.owned).length;
  const before = owned();
  const got = E.legionTreasureFind(s, 1, () => 0);
  assert.ok(got && got.ko, '보물 하나');
  assert.equal(owned(), before + 1, '도감에 들어온다');
  assert.ok(E.infoTreasures(s).some((t) => t.owned && t.ko === got.ko));
  // 확률 밖이면 아무것도 가져오지 않는다
  const gate = E.legionTreasureFind(s, 0.18, () => 0.99);
  assert.equal(gate, null);
  // 이미 다 모았으면 null
  const full = newGame(72);
  for (const t of E.infoTreasures(full)) E.gainTreasure(full, t.id, { holder: null });
  assert.equal(E.legionTreasureFind(full, 1, () => 0), null);
});
