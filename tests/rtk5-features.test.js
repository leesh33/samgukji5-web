import test from 'node:test';
import assert from 'node:assert/strict';
import { TREASURES, TREASURE_BY_ID, GENERAL_BY_ID } from '../js/data.js';
import * as E from '../js/engine.js';
import * as B from '../js/battle.js';

const newGame = (seed = 11) => E.createGame('s194', 'jojo', seed);
const firstCity = (s) => E.factionCities(s, s.playerId)[0];

/* 원하는 판정이 나오는 난수 상태를 찾는다 */
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
    defeatedGenerals: defGens, playerSide: 'atk',
  };
  return { s, to, res, defGens };
}

/* ---------- 쌀 시세 · 교역 ---------- */
test('쌀 시세: 금 100당 식량 300~600에서 시작하고 달마다 그 안에서 흔들린다', () => {
  const s = newGame(21);
  const p0 = E.ricePriceOf(s);
  assert.ok(p0 >= E.RICE_MIN && p0 <= E.RICE_MAX, '초기 시세 ' + p0);
  const seen = new Set();
  for (let i = 0; i < 24; i++) {
    E.endTurnPhase2(s);
    const p = E.ricePriceOf(s);
    assert.ok(p >= E.RICE_MIN && p <= E.RICE_MAX, '월 시세 ' + p);
    seen.add(p);
  }
  assert.ok(seen.size > 1, '시세가 달마다 움직인다');
  assert.ok(['풍년 — 쌀이 싸다', '흉년 — 쌀이 비싸다', '평년'].includes(E.riceLabel(s)));
});

test('쌀 시세: 풍작이면 싸지고 가뭄이면 비싸진다', () => {
  const good = newGame(31);
  const bad = newGame(31);
  good.ricePrice = 450; bad.ricePrice = 450;
  good.rngState = 1234; bad.rngState = 1234;
  const pg = E.rollRicePrice(good, { trend: 'good' });
  const pb = E.rollRicePrice(bad, { trend: 'bad' });
  assert.ok(pg > pb + 100, `풍작 ${pg} vs 가뭄 ${pb}`);

  // 풍작 이벤트를 고르면 시세가 오르고(쌀이 싸지고), 가뭄을 견디면 내린다
  const s = newGame(33);
  E.buildEvent(s, 'harvest', () => 0.5);
  s.pendingEvent = E.buildEvent(s, 'harvest', () => 0.5);
  const before = s.ricePrice;
  E.resolveEvent(s, 'rejoice');
  assert.ok(E.ricePriceOf(s) > before, `풍작 뒤 시세 ${before} → ${s.ricePrice}`);
});

test('교역: 금으로 식량을 사고, 식량을 팔아 금을 얻는다(행동력 1)', () => {
  const s = newGame(41);
  const c = firstCity(s);
  c.gold = 5000; c.food = 8000;
  s.actionPoints = 5;
  const price = E.ricePriceOf(s);

  const buyQuote = E.tradeQuote(s, 'buy', 600);
  assert.equal(buyQuote.gold, 600);
  assert.equal(buyQuote.food, Math.round((600 / 100) * price));
  const g0 = c.gold, f0 = c.food, ap0 = s.actionPoints;
  const r = E.trade(s, c.id, 'buy', 600);
  assert.ok(r.ok, r.msg);
  assert.equal(c.gold, g0 - buyQuote.gold);
  assert.equal(c.food, f0 + buyQuote.food);
  assert.equal(s.actionPoints, ap0 - 1);
  assert.match(r.msg, /샀습니다/);

  const sellQuote = E.tradeQuote(s, 'sell', 1000);
  assert.equal(sellQuote.food, 1000);
  assert.equal(sellQuote.gold, Math.round((1000 / price) * 100));
  const g1 = c.gold, f1 = c.food;
  const r2 = E.trade(s, c.id, 'sell', 1000);
  assert.ok(r2.ok, r2.msg);
  assert.equal(c.gold, g1 + sellQuote.gold);
  assert.equal(c.food, f1 - sellQuote.food);
  assert.match(r2.msg, /팔아/);

  // 금이 모자라면 살 수 없다
  c.gold = 100;
  const poor = E.tradeCheck(s, c.id, 'buy', 1000);
  assert.equal(poor.ok, false);
  assert.match(poor.why, /금/);
  // 행동력이 없으면 안 된다
  c.gold = 5000;
  s.actionPoints = 0;
  assert.equal(E.tradeCheck(s, c.id, 'buy', 300).ok, false);
});

/* ---------- 특수 ---------- */
test('특수 순찰: 치안·명성이 오르고 금 100과 행동력 1을 쓴다', () => {
  const s = newGame(51);
  const c = firstCity(s);
  c.gold = 2000; c.order = 40;
  const fam0 = s.factions[s.playerId].fame;
  const ap0 = s.actionPoints;
  const r = E.runSpecial(s, 'patrol', c.id);
  assert.ok(r.ok, r.msg);
  assert.ok(c.order >= 44 && c.order <= 47, '치안 ' + c.order);
  assert.equal(s.factions[s.playerId].fame, Math.min(100, fam0 + 2));
  assert.equal(c.gold, 1900);
  assert.equal(s.actionPoints, ap0 - 1);
  assert.match(r.msg, /순찰/);

  const poor = newGame(52);
  const pc = firstCity(poor);
  pc.gold = 30;
  const bad = E.runSpecial(poor, 'patrol', pc.id);
  assert.equal(bad.ok, false);
  assert.match(bad.msg, /금/);
});

test('특수 연회: 이 성의 모든 장수 충성도와 친밀도가 오른다(금 400)', () => {
  const s = newGame(53);
  const c = firstCity(s);
  c.gold = 3000;
  const gens = E.generalsInCity(s, c.id);
  assert.ok(gens.length >= 2);
  for (const g of gens) g.loyalty = 60;
  const aff0 = gens.map((g) => E.affinityOf(s, g.id));
  const r = E.runSpecial(s, 'banquet', c.id);
  assert.ok(r.ok, r.msg);
  for (const g of gens) assert.ok(g.loyalty >= 64 && g.loyalty <= 67, `${g.id} 충성 ${g.loyalty}`);
  gens.forEach((g, i) => assert.ok(E.affinityOf(s, g.id) >= aff0[i] + 4));
  assert.equal(c.gold, 2600);
  assert.match(r.msg, /연회/);
});

test('특수 징세: 금 600~1,000이 들어오고 치안과 명성이 깎인다', () => {
  const s = newGame(57);
  const c = firstCity(s);
  c.gold = 0; c.order = 70;
  const fam0 = s.factions[s.playerId].fame;
  const ap0 = s.actionPoints;
  const r = E.runSpecial(s, 'levy', c.id);
  assert.ok(r.ok, r.msg);
  assert.ok(c.gold >= 600 && c.gold <= 1000, '금 ' + c.gold);
  assert.ok(c.order >= 55 && c.order <= 60, '치안 ' + c.order);
  assert.equal(s.factions[s.playerId].fame, fam0 - 3);
  assert.equal(s.actionPoints, ap0 - 1);
  assert.match(r.msg, /징수/);
});

test('특수 구휼: 식량 800을 풀어 치안 +8~14, 명성 +4', () => {
  const s = newGame(59);
  const c = firstCity(s);
  c.food = 3000; c.order = 50;
  const fam0 = s.factions[s.playerId].fame;
  const r = E.runSpecial(s, 'relief', c.id);
  assert.ok(r.ok, r.msg);
  assert.ok(c.order >= 58 && c.order <= 64, '치안 ' + c.order);
  assert.equal(c.food, 2200);
  assert.equal(s.factions[s.playerId].fame, Math.min(100, fam0 + 4));
  assert.match(r.msg, /구휼/);

  const poor = newGame(60);
  const pc = firstCity(poor);
  pc.food = 100;
  assert.equal(E.runSpecial(poor, 'relief', pc.id).ok, false);
});

test('특수 순찰: 가끔 보물을 찾는다', () => {
  const s = newGame(61);
  const c = firstCity(s);
  c.gold = 2000;
  let found = null;
  for (let i = 0; i < 40 && !found; i++) {
    c.gold = 2000;
    s.actionPoints = 3;
    const r = E.runSpecial(s, 'patrol', c.id);
    if (r.found) found = r.found;
  }
  assert.ok(found, '순찰로 보물을 찾는다');
  assert.ok(s.treasures.owned.includes(found.id));
});

/* ---------- 보물 ---------- */
test('보물: 이름난 장수가 처음부터 지니고, 능력치가 보정된다', () => {
  const s = newGame(71);
  assert.equal(TREASURES.length, 14);
  const cao = E.generalOf(s, 'cao_cao');
  const tr = E.treasureOf(s, 'cao_cao');
  assert.ok(tr, '조조가 보물을 지님');
  assert.equal(tr.id, 'uicheon');
  const eff = E.effectiveGeneral(s, 'cao_cao');
  assert.equal(eff.war, cao.war + TREASURE_BY_ID.uicheon.bonus.war);
  assert.equal(eff.cha, cao.cha + TREASURE_BY_ID.uicheon.bonus.cha);
  // 이름난 장수가 없는 시나리오면 그 보물은 행방을 찾아야 한다
  const late = E.createGame('s219', 'jojo', 72);
  const lost = E.infoTreasures(late).filter((t) => t.lost).map((t) => t.id);
  assert.ok(lost.includes('jeoktoma') || lost.includes('bangcheon'), '여포가 없는 시대의 보물은 임자 없음');
});

test('보물: 수여·회수로 장수 능력치가 오르고 내린다', () => {
  const s = newGame(73);
  const held = E.treasureOf(s, 'cao_cao');
  assert.equal(held.id, 'uicheon');
  const caoBase = GENERAL_BY_ID.cao_cao;
  const dunBase = GENERAL_BY_ID.xiahou_dun;

  // 회수하면 조조의 보정이 사라진다
  const rv = E.revokeTreasure(s, 'uicheon');
  assert.ok(rv.ok, rv.msg);
  assert.equal(E.treasureOf(s, 'cao_cao'), null);
  assert.equal(E.effectiveGeneral(s, 'cao_cao').war, caoBase.war);
  assert.ok(s.treasures.owned.includes('uicheon'), '회수해도 우리 보물로 남는다');

  // 수여하면 그 장수의 능력치가 오른다
  const aw = E.awardTreasure(s, 'uicheon', 'xiahou_dun');
  assert.ok(aw.ok, aw.msg);
  assert.equal(E.treasureOf(s, 'xiahou_dun').id, 'uicheon');
  assert.equal(E.effectiveGeneral(s, 'xiahou_dun').war, dunBase.war + TREASURE_BY_ID.uicheon.bonus.war);
  assert.match(aw.msg, /수여/);

  // 다른 종류의 보물을 주면 앞의 보물과 함께 지닌다(종류별 1개씩)
  s.treasures.owned.push('okse');
  const aw2 = E.awardTreasure(s, 'okse', 'xiahou_dun');
  assert.ok(aw2.ok, aw2.msg);
  assert.deepEqual(E.treasuresOf(s, 'xiahou_dun').map((x) => x.id).sort(), ['okse', 'uicheon']);
  assert.equal(E.treasureHolder(s, 'uicheon'), 'xiahou_dun', '다른 종류는 그대로');
  assert.equal(E.effectiveGeneral(s, 'xiahou_dun').war,
    dunBase.war + TREASURE_BY_ID.uicheon.bonus.war + (TREASURE_BY_ID.okse.bonus.war || 0));

  // 같은 종류의 보물을 주면 앞의 그 보물만 창고로 돌아간다
  delete s.treasures.where.chilseong;
  s.treasures.owned.push('chilseong');
  const aw3 = E.awardTreasure(s, 'chilseong', 'xiahou_dun');
  assert.ok(aw3.ok, aw3.msg);
  assert.deepEqual(E.treasuresOf(s, 'xiahou_dun').map((x) => x.id).sort(), ['chilseong', 'okse']);
  assert.equal(E.treasureHolder(s, 'uicheon'), null, '같은 종류(무기) 의천검은 창고로');
  assert.ok(s.treasures.owned.includes('uicheon'));

  // 아군 장수에게만 수여한다
  const foe = E.diplomacyView(s)[0];
  const foeGen = E.factionGenerals(s, foe.id)[0];
  assert.equal(E.awardTreasure(s, 'uicheon', foeGen.id).ok, false);
});

test('보물: 참수하면 그 장수가 지닌 보물을 거둔다', () => {
  const { s, defGens } = siege(75);
  const victim = defGens[0];
  s.treasures.where.cheongnang = victim;
  const r = E.applyBattleResult(s, {
    fromCityId: E.factionCities(s, 'jojo')[0].id,
    toCityId: E.adjacentEnemies(s, E.factionCities(s, 'jojo')[0].id)[0],
    winner: 'attacker', atkLoss: 500, defLoss: 3000, atkSurvivors: 4000,
    defeatedGenerals: [victim], playerSide: 'atk',
  });
  const rec = s.pendingPrisoners.find((p) => p.gid === victim);
  assert.ok(rec, '포로로 잡힘');
  const ex = E.executePrisoner(s, victim);
  assert.ok(ex.ok, ex.msg);
  assert.ok(s.treasures.owned.includes('cheongnang'), '보물을 거둔다');
  assert.equal(s.treasures.where.cheongnang, undefined);
});

test('보물: 세력이 멸망하면 그 장수들의 보물을 거둔다', () => {
  const s = newGame(77);
  const foe = Object.keys(s.factions).find((fid) => fid !== s.playerId && s.factions[fid].alive);
  const gens = E.factionGenerals(s, foe);
  const gid = gens[0].id;
  s.treasures.where.yongrin = gid;
  for (const c of E.factionCities(s, foe)) c.owner = s.playerId;
  E.checkFactionDeath(s, foe, s.playerId);
  assert.equal(s.factions[foe].alive, false);
  assert.ok(s.treasures.owned.includes('yongrin'), '멸망한 세력의 보물을 거둔다');
});

/* ---------- 참모 ---------- */
test('참모: 지력 최고 장수가 앉고, 지력에 따라 2~8% 보정이 붙는다', () => {
  const s = newGame(81);
  const best = E.recommendAdvisor(s);
  assert.equal(s.advisorId, best);
  const bonus = E.advisorBonus(s);
  assert.ok(bonus >= 0.02 && bonus <= 0.08, '보너스 ' + bonus);

  const a = E.advisorOf(s);
  assert.ok(a && a.int >= 70);

  // 낮은 지력의 장수를 앉히면 보정이 줄어든다
  const weak = E.factionGenerals(s, s.playerId).map((g) => g.id).find((gid) => E.generalOf(s, gid).int < 60);
  if (weak) {
    E.appointAdvisor(s, weak);
    assert.ok(E.advisorBonus(s) <= bonus);
  }

  // 참모가 없으면 보정도 없다
  s.advisorId = null;
  assert.equal(E.advisorBonus(s), 0);
  assert.match(E.advisorAdvice(s), /참모/);
});

test('참모: 계략·등용 성공률이 참모의 보정만큼 오른다', () => {
  const s = newGame(83);
  const c = firstCity(s);
  const foes = E.neighborFoes(s, c.id);
  const gens = E.generalsInCity(s, c.id).sort((a, b) => E.generalOf(s, b.id).int - E.generalOf(s, a.id).int);
  assert.ok(foes.length && gens.length);
  const gid = gens[0].id;
  const withAdvisor = E.plotChance(s, c.id, foes[0], 'sow', gid);
  s.advisorId = null;
  const without = E.plotChance(s, c.id, foes[0], 'sow', gid);
  assert.ok(withAdvisor > without, `${withAdvisor} > ${without}`);

  const free = E.freeGeneralsInCity(s, 'xuchang')[0];
  s.affinity[free.id] = 60; // 낯섦 상한(12%)에 걸리지 않는 알음 구간에서 참모 보정 확인
  const hired0 = E.hireChance(s, 'xuchang', free.id);
  s.advisorId = E.recommendAdvisor(s);
  const hired1 = E.hireChance(s, 'xuchang', free.id);
  assert.ok(hired1 >= hired0);
});

/* ---------- 담당(도시 위임) ---------- */
test('담당: 위임한 성은 턴이 바뀔 때 행동력 없이 내정을 올린다', () => {
  const s = newGame(91);
  const cs = E.factionCities(s, s.playerId);
  const target = cs[cs.length - 1];
  target.agri = 30; target.comm = 30; target.order = 30; target.water = 30;
  const before = { ...target };
  const set = E.setDelegation(s, target.id, 'domestic');
  assert.ok(set.ok, set.msg);
  assert.equal(E.delegationOf(s, target.id), 'domestic');
  const actedBefore = Object.values(s.generals).filter((g) => g.acted).length;
  E.endTurnPhase2(s);
  const gained = ['agri', 'comm', 'order', 'water'].some((k) => target[k] > before[k]);
  assert.ok(gained, '위임 내정으로 수치가 올랐다');
  assert.equal(Object.values(s.generals).filter((g) => g.acted).length, actedBefore, '장수 행동을 쓰지 않는다');
  assert.ok((s.delegationLog || []).length >= 1);
});

test('담당: 군사 위임은 징병하거나 훈련한다', () => {
  const s = newGame(93);
  const c = E.factionCities(s, s.playerId)[0];
  c.troops = 2000; c.gold = 2000; c.food = 4000; c.train = 50;
  E.setDelegation(s, c.id, 'military');
  const t0 = c.troops;
  E.endTurnPhase2(s);
  assert.ok(c.troops > t0 || c.train > 50, '군사 위임이 일했다');

  // 직할로 돌리면 더 이상 자동으로 일하지 않는다
  E.setDelegation(s, c.id, 'none');
  assert.equal(E.delegationOf(s, c.id), 'none');
});

/* ---------- 정보 일람 ---------- */
test('정보: 세력 순위·아군 도시·무장·보물 도감이 만들어진다', () => {
  const s = newGame(101);
  const rank = E.infoFactions(s);
  assert.ok(rank.length >= 5);
  for (let i = 1; i < rank.length; i++) assert.ok(rank[i - 1].power >= rank[i].power);
  const mine = rank.find((r) => r.mine);
  assert.equal(mine.relation, '아군');
  assert.ok(rank.some((r) => ['동맹', '정전', '우호', '중립', '적대'].includes(r.relation)));

  const cities = E.infoCities(s);
  assert.equal(cities.length, E.factionCities(s, s.playerId).length);
  assert.ok(cities.every((c) => c.delegationKo && c.cityId));

  const myGens = E.infoGenerals(s, 'mine');
  assert.ok(myGens.length > 0);
  assert.ok(myGens.every((g) => g.faction === s.playerId));
  const allGens = E.infoGenerals(s, 'all');
  assert.ok(allGens.length > myGens.length);
  assert.ok(allGens[0].factionName);

  const tr = E.infoTreasures(s);
  assert.equal(tr.length, TREASURES.length);
  const held = tr.filter((t) => t.holder);
  assert.ok(held.length > 0);
  assert.ok(held.every((t) => t.holderName));
  assert.ok(tr.every((t) => typeof t.owned === 'boolean'));
});

/* ---------- 전술 계략 확장 ---------- */
function makeBattle(seed = 3) {
  return B.createBattle({
    fromCityId: 'xuchang', toCityId: 'chenliu',
    attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['cao_cao', 'xiahou_dun', 'xun_yu'],
    defGenerals: ['lu_bu', 'chen_gong', 'gao_shun'],
    atkTroops: 12000, defTroops: 9000, defBonus: 60, seed, playerSide: 'atk',
  });
}
/* 성공하는 난수 씨앗을 찾아 계략을 쓴다 */
function fireTactic(b, u, t, kind) {
  for (let seed = 1; seed < 400; seed++) {
    const copy = JSON.parse(JSON.stringify(b));
    const cu = copy.units.find((x) => x.id === u.id);
    const ct = copy.units.find((x) => x.id === t.id);
    const r = B.tactic(copy, cu, ct, kind, seed);
    if (r.ok && r.success) return { b: copy, r, cu, ct };
  }
  return null;
}

test('전투 계략 화계: 피해와 사기 저하, 성공률 표시', () => {
  const b = makeBattle();
  const u = B.unitsOf(b, 'atk')[0];
  const t = B.unitsOf(b, 'def')[0];
  t.x = u.x + 1; t.y = u.y;
  const out = fireTactic(b, u, t, 'fire');
  assert.ok(out, '화계 성공');
  assert.ok(out.ct.troops < t.troops, '적 병력 감소');
  assert.ok(out.ct.morale < t.morale, '사기 저하');
  assert.ok(out.r.chance >= 12 && out.r.chance <= 95, '성공률 ' + out.r.chance);
  assert.equal(out.cu.acted, true);
});

test('전투 계략 혼란: 한 차례 행동 불능과 방어 저하', () => {
  const b = makeBattle(5);
  const u = B.unitsOf(b, 'atk')[0];
  const t = B.unitsOf(b, 'def')[0];
  t.x = u.x + 1; t.y = u.y;
  const out = fireTactic(b, u, t, 'confuse');
  assert.ok(out, '혼란 성공');
  assert.equal(out.ct.confused, 1);
  assert.ok(out.ct.defDown > 0);
  // 상대 차례로 넘어가면 혼란에 빠진 부대는 아무것도 못 한다
  const b2 = out.b;
  b2.phase = 'atk';
  b2.over = null;
  B.nextPhase(b2);                      // 수비 차례
  const skip = b2.units.find((x) => x.id === out.ct.id);
  assert.equal(skip.acted, true, '혼란으로 차례를 거른다');
  assert.ok(b2.log.some((l) => l.includes('혼란에 빠져')), '기록에 혼란 표시');
  // 방어 저하가 걸린 적은 더 아프게 맞는다
  const b3 = makeBattle(17);
  const a3 = B.unitsOf(b3, 'atk')[0];
  const d3 = B.unitsOf(b3, 'def')[0];
  d3.x = a3.x + 1; d3.y = a3.y;
  d3.defDown = 0;
  const plainHit = B.attack(b3, a3, d3, 21);
  const b4 = makeBattle(17);
  const a4 = B.unitsOf(b4, 'atk')[0];
  const d4 = B.unitsOf(b4, 'def')[0];
  d4.x = a4.x + 1; d4.y = a4.y;
  d4.defDown = 2;
  const softHit = B.attack(b4, a4, d4, 21);
  assert.ok(softHit.damage > plainHit.damage, `방어 저하 ${plainHit.damage} → ${softHit.damage}`);
});

test('전투 계략 고무: 아군 사기가 15~20 오른다', () => {
  const b = makeBattle(7);
  const u = B.unitsOf(b, 'atk')[0];
  const ally = B.unitsOf(b, 'atk')[1];
  ally.morale = 40;
  const out = fireTactic(b, u, ally, 'rally');
  assert.ok(out, '고무 성공');
  const diff = out.ct.morale - 40;
  assert.ok(diff >= 15 && diff <= 20, '사기 상승 ' + diff);
});

test('전투 계략 수계·낙석: 물·산에 닿은 적에게만 통한다', () => {
  const b = makeBattle(11);
  const u = B.unitsOf(b, 'atk')[0];
  const t = B.unitsOf(b, 'def')[0];
  t.x = u.x + 1; t.y = u.y;

  // 지형을 지운 뒤에는 수계·낙석이 막힌다
  for (const tile of b.grid) if (tile.t === 'water' || tile.t === 'hill') tile.t = 'plain';
  assert.equal(B.tactic(b, u, t, 'flood', 5).ok, false);
  assert.equal(B.tactic(b, u, t, 'rock', 5).ok, false);

  // 발밑을 물로 바꾸면 수계가, 산으로 바꾸면 낙석이 통한다
  B.tileAt(b, t.x, t.y).t = 'water';
  const opts = B.tacticOptions(b, u, t);
  assert.equal(opts.find((o) => o.kind === 'flood').blocked, '');
  const flood = fireTactic(b, u, t, 'flood');
  assert.ok(flood, '수계 성공');
  assert.ok(t.troops - flood.ct.troops > 500, '수계는 큰 피해');

  const b2 = makeBattle(13);
  const u2 = B.unitsOf(b2, 'atk')[0];
  const t2 = B.unitsOf(b2, 'def')[0];
  t2.x = u2.x + 1; t2.y = u2.y;
  for (const tile of b2.grid) if (tile.t === 'water') tile.t = 'plain';
  B.tileAt(b2, t2.x, t2.y).t = 'hill';
  const rock = fireTactic(b2, u2, t2, 'rock');
  assert.ok(rock, '낙석 성공');
  assert.ok(t2.troops - rock.ct.troops > 400, '낙석은 큰 피해');
});

test('전투: 보물을 지닌 장수는 부대 편성 때 보정된 능력치로 싸운다', () => {
  const s = newGame(105);
  const map = E.effectiveGeneralMap(s);
  assert.ok(map.cao_cao);
  assert.equal(map.cao_cao.treasure, '의천검');
  assert.ok(map.cao_cao.war > GENERAL_BY_ID.cao_cao.war);
});
