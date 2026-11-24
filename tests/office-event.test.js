import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

const newGame = (seed = 31) => E.createGame('s194', 'jojo', seed);

/* 다른 세력의 성을 플레이어에게 넘겨 성 수를 맞춘다 */
function giveCities(s, n) {
  const mine = new Set(E.factionCities(s, s.playerId).map((c) => c.id));
  for (const f of Object.keys(s.factions)) {
    if (f === s.playerId) continue;
    for (const c of E.factionCities(s, f)) {
      if (mine.size >= n) break;
      c.owner = s.playerId;
      mine.add(c.id);
    }
    if (mine.size >= n) break;
  }
  return mine.size;
}

test('관직 7단계: 현령 → 자사 → 주목 → 대장군 → 승상 → 왕 → 황제', () => {
  assert.deepEqual(E.OFFICES.map((o) => o.ko), ['현령', '자사', '주목', '대장군', '승상', '왕', '황제']);
  // 행동력 보너스는 단계마다 오르기만 한다
  for (let i = 1; i < E.OFFICES.length; i++) {
    assert.ok(E.OFFICES[i].ap >= E.OFFICES[i - 1].ap);
    assert.ok(E.OFFICES[i].tax >= E.OFFICES[i - 1].tax);
    assert.ok(E.OFFICES[i].cities > E.OFFICES[i - 1].cities);
    assert.ok(E.OFFICES[i].fame > E.OFFICES[i - 1].fame);
  }
  assert.equal(E.OFFICES[0].ap, 0);
  assert.ok(E.OFFICES[E.MAX_OFFICE].ap >= 1 && E.OFFICES[E.MAX_OFFICE].ap <= 3);
});

test('관직은 성 수와 명성 조건을 모두 채워야 오른다', () => {
  const s = newGame(33);
  s.factions[s.playerId].fame = 45;
  assert.equal(E.officeLevel(s, s.playerId), 0);
  s.factions[s.playerId].fame = 80; // 성은 2곳뿐
  assert.equal(E.officeOf(s, s.playerId).ko, '자사');

  const n = giveCities(s, 11);
  assert.ok(n >= 11);
  s.factions[s.playerId].fame = 72;
  assert.equal(E.officeOf(s, s.playerId).ko, '승상');
  s.factions[s.playerId].fame = 90;
  assert.equal(E.officeOf(s, s.playerId).ko, '승상', '성 11곳·명성 90 — 왕은 성 16곳이 필요하다');
  const next = E.nextOffice(s, s.playerId);
  assert.equal(next.ko, '왕');
  assert.ok(next.needCities > 0);
});

test('승급하면 알림 목록에 쌓이고 최대 행동력이 는다', () => {
  const s = newGame(35);
  const ap0 = s.maxActionPoints;
  s.factions[s.playerId].fame = 60;
  giveCities(s, 4);
  assert.equal(s.lastPromotions.length, 0);
  const promoted = E.syncOffices(s);
  assert.equal(promoted.length, 1, JSON.stringify(promoted));
  assert.equal(promoted[0].to, '주목');
  assert.equal(promoted[0].ap, E.OFFICES[2].ap);
  s.maxActionPoints = E.calcActionPoints(s, s.playerId);
  assert.ok(s.maxActionPoints > ap0, `${ap0} → ${s.maxActionPoints}`);
  assert.ok(s.log.some((l) => /관직/.test(l.text)));
  // 한 번 보고 나면 비운다
  E.clearPromotions(s);
  assert.equal(s.lastPromotions.length, 0);
  assert.equal(E.syncOffices(s).length, 0, '같은 단계에서 또 오르지 않는다');
});

test('행동력은 관직 보너스를 더해도 13을 넘지 않는다', () => {
  const s = newGame(37);
  s.factions[s.playerId].fame = 100;
  giveCities(s, 24);
  assert.equal(E.officeOf(s, s.playerId).ko, '황제');
  const ap = E.calcActionPoints(s, s.playerId);
  assert.ok(ap <= 13, 'AP ' + ap);
  assert.ok(ap >= 8, '황제 보정이 반영돼야 한다 ' + ap);
});

test('관직이 높으면 같은 성의 세금 수입이 는다', () => {
  const base = newGame(39);
  const rich = newGame(39);
  const cityId = E.factionCities(base, base.playerId)[0].id;
  // 같은 성을 가진 두 게임 — 한쪽만 관직을 올린다
  rich.factions[rich.playerId].fame = 60;
  giveCities(rich, 4);
  assert.equal(E.officeOf(base, base.playerId).ko, '현령');
  assert.equal(E.officeOf(rich, rich.playerId).ko, '주목');

  const b0 = base.cities[cityId].gold;
  const r0 = rich.cities[cityId].gold;
  E.endTurnPhase2(base);
  E.endTurnPhase2(rich);
  const gainBase = base.cities[cityId].gold - b0;
  const gainRich = rich.cities[cityId].gold - r0;
  assert.ok(gainRich > gainBase, `${gainBase} → ${gainRich}`);
  // 세입·급료는 cityMonthlyBalance 한 곳에서 계산한다 — 화면과 턴 진행이 같은 식을 쓴다
  const cb = E.cityMonthlyBalance(base, cityId);
  const cr = E.cityMonthlyBalance(rich, cityId);
  assert.ok(cr.goldIn > cb.goldIn, `세입 ${cb.goldIn} → ${cr.goldIn}`);
  assert.equal(cr.goldIn, Math.round((rich.cities[cityId].comm * 5 + rich.cities[cityId].order * 0.8) * (1 + E.OFFICES[2].tax) * E.sizeIncomeOf(rich, cityId)));
  assert.ok(cr.salary > 0, '병사 급료가 붙는다');
  assert.equal(gainRich, cr.goldNet);
});

test('월간 이벤트: 30% 확률로만 열리고, 한 번에 하나만 대기한다', () => {
  const s = newGame(41);
  s.month = 1; // 겨울
  assert.equal(E.EVENT_CHANCE, 0.3);
  assert.equal(E.rollMonthlyEvent(s, () => 0.99), null);
  assert.equal(s.pendingEvent, null);
  const ev = E.rollMonthlyEvent(s, () => 0);
  assert.ok(ev, '확률 0이면 반드시 발생');
  assert.ok(['harvest', 'bandits', 'wanderer', 'plague', 'drought', 'doctor'].includes(ev.id));
  assert.ok(ev.title && ev.text && ev.options.length);
  // 이미 대기 중이면 새로 만들지 않는다
  const again = E.rollMonthlyEvent(s, () => 0);
  assert.equal(again, s.pendingEvent);
  assert.equal(s.pendingEvent.id, ev.id);
});

test('계절에 맞는 이벤트만 나온다', () => {
  const s = newGame(43);
  s.month = 7; // 여름
  const summer = E.monthlyEventPool(s);
  assert.ok(summer.includes('plague') && summer.includes('drought'));
  assert.equal(summer.includes('harvest'), false);
  assert.equal(summer.includes('doctor'), false);
  s.month = 4; // 봄
  const spring = E.monthlyEventPool(s);
  assert.ok(spring.includes('harvest'));
  assert.equal(spring.includes('plague'), false);
  s.month = 1; // 겨울
  assert.ok(E.monthlyEventPool(s).includes('doctor'));
});

test('풍작: 모든 성의 식량이 늘어난다', () => {
  const s = newGame(45);
  s.month = 4;
  const food0 = E.factionCities(s, s.playerId).map((c) => c.food);
  s.pendingEvent = E.buildEvent(s, 'harvest');
  const r = E.resolveEvent(s, 'rejoice');
  assert.ok(r.ok, r.msg);
  E.factionCities(s, s.playerId).forEach((c, i) => assert.ok(c.food > food0[i]));
  assert.equal(s.pendingEvent, null);
});

test('유랑 무장: 수락하면 아군이 되고 거절하면 그대로다', () => {
  const s = newGame(47);
  const cand = E.wandererCandidate(s);
  assert.ok(cand, '재야 장수가 있어야 한다');
  s.pendingEvent = E.buildEvent(s, 'wanderer');
  assert.equal(E.buildEvent(s, 'wanderer').options.length, 2);
  const r = E.resolveEvent(s, 'refuse');
  assert.ok(r.ok);
  assert.equal(s.generals[cand.id].faction, null);

  s.pendingEvent = E.buildEvent(s, 'wanderer');
  const target = s.pendingEvent.data.gid;
  const fame0 = s.factions[s.playerId].fame;
  const r2 = E.resolveEvent(s, 'accept');
  assert.ok(r2.ok, r2.msg);
  assert.equal(s.generals[target].faction, s.playerId);
  assert.equal(s.generals[target].loyalty, 62);
  assert.ok(s.factions[s.playerId].fame > fame0);
  assert.ok(E.factionGenerals(s, s.playerId).some((g) => g.id === target));
});

test('도적 소탕: 토벌하면 금·명성이 오르고, 두면 치안이 떨어진다', () => {
  const s = newGame(49);
  const fame0 = s.factions[s.playerId].fame;
  const gold0 = E.factionGold(s, s.playerId);
  s.pendingEvent = E.buildEvent(s, 'bandits');
  const r = E.resolveEvent(s, 'sweep');
  assert.ok(r.ok, r.msg);
  assert.ok(E.factionGold(s, s.playerId) > gold0);
  assert.ok(s.factions[s.playerId].fame > fame0);

  const s2 = newGame(49);
  const order0 = E.factionCities(s2, s2.playerId).map((c) => c.order);
  s2.pendingEvent = E.buildEvent(s2, 'bandits');
  E.resolveEvent(s2, 'ignore');
  E.factionCities(s2, s2.playerId).forEach((c, i) => assert.equal(c.order, Math.max(0, order0[i] - 6)));
});

test('역병·가뭄: 의원·수리를 쓰면 피해가 줄고, 견디면 크게 잃는다', () => {
  const soft = newGame(51);
  const hard = newGame(51);
  soft.pendingEvent = E.buildEvent(soft, 'plague');
  hard.pendingEvent = E.buildEvent(hard, 'plague');
  const s0 = E.factionCities(soft, soft.playerId).map((c) => c.food);
  E.resolveEvent(soft, 'treat');
  E.resolveEvent(hard, 'endure');
  E.factionCities(hard, hard.playerId).forEach((c, i) => {
    assert.ok(s0[i] - c.food > s0[i] * 0.1, '견디면 식량 12% 손실');
  });
  assert.ok(E.factionCities(soft, soft.playerId)[0].food > E.factionCities(hard, hard.playerId)[0].food);

  const irr = newGame(53);
  const dry = newGame(53);
  irr.pendingEvent = E.buildEvent(irr, 'drought');
  dry.pendingEvent = E.buildEvent(dry, 'drought');
  const water0 = E.factionCities(irr, irr.playerId).map((c) => c.water);
  E.resolveEvent(irr, 'irrigate');
  E.resolveEvent(dry, 'endure');
  E.factionCities(irr, irr.playerId).forEach((c, i) => assert.ok(c.water > water0[i]));
  E.factionCities(dry, dry.playerId).forEach((c, i) => assert.equal(c.water, Math.max(0, water0[i] - 6)));
});

test('명의 방문: 모든 성의 병력이 회복한다', () => {
  const s = newGame(55);
  const t0 = E.factionCities(s, s.playerId).map((c) => c.troops);
  s.pendingEvent = E.buildEvent(s, 'doctor');
  const r = E.resolveEvent(s, 'welcome');
  assert.ok(r.ok, r.msg);
  E.factionCities(s, s.playerId).forEach((c, i) => assert.ok(c.troops > t0[i]));
  assert.match(r.msg, /명의/);
});

test('새 달이 바뀌면 이벤트가 실제로 붙는다(30%)', () => {
  const s = newGame(57);
  let found = null;
  for (let i = 0; i < 30 && !found; i++) {
    E.endTurnPhase2(s);
    if (s.pendingEvent) found = s.pendingEvent;
    if (s.gameOver) break;
  }
  assert.ok(found, '30개월 안에 한 번은 이벤트가 나온다');
  // 이벤트는 저장·복원에도 남는다
  const back = E.deserialize(E.serialize(s));
  assert.ok(back.pendingEvent && back.pendingEvent.title);
  assert.equal(E.resolveEvent(back, back.pendingEvent.options[0].id).ok, true);
  assert.equal(back.pendingEvent, null);
});
