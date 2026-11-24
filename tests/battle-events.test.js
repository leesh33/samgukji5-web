import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERAL_BY_ID, ORDER_CAP } from '../js/data.js';
import * as B from '../js/battle.js';
import * as E from '../js/engine.js';

/* 전장 하나 — 아군 세 부대 vs 적 세 부대(여포가 선두) */
function make(opts = {}) {
  return B.createBattle({
    fromCityId: 'xuchang', toCityId: 'chenliu',
    attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['cao_cao', 'xiahou_dun', 'cao_ren'],
    defGenerals: ['lu_bu', 'chen_gong', 'gao_shun'],
    atkTroops: 9000, defTroops: 12000, defBonus: 50, seed: 5, playerSide: 'atk', ...opts,
  });
}

/* 적 장수와 아군 부대를 맞붙여 놓는다 */
function faceToFace(b) {
  const ally = B.unitsOf(b, 'atk')[0];
  const foe = b.units.find((u) => u.gid === 'lu_bu');
  ally.x = 3; ally.y = 3;
  foe.x = 4; foe.y = 3;
  return { ally, foe };
}

/* ---------- 적 장수의 일기토 도발 ---------- */

test('일기토 도발: 맞닿은 호전적인 적장이 걸어오고, 전투당 한 번만 온다', () => {
  const b = make();
  const { ally, foe } = faceToFace(b);
  assert.equal(B.isHotBlooded(GENERAL_BY_ID.lu_bu), true);
  assert.equal(B.isHotBlooded(GENERAL_BY_ID.chen_gong), false);

  const cands = B.provokeCandidates(b);
  assert.equal(cands.length, 1, '여포만 호전적이다');
  assert.equal(cands[0].challenger.gid, 'lu_bu');
  assert.equal(cands[0].target.side, 'atk');

  const ev = B.duelProvokeRoll(b, () => 0);
  assert.ok(ev, '낮은 난수면 반드시 걸려 온다');
  assert.equal(ev.id, 'duelProvoke');
  assert.equal(ev.challenger, foe);
  assert.equal(ev.target, ally);
  assert.ok(ev.text.includes('일기토'));
  assert.equal(b.duelProvokes, 1);
  assert.ok(b.log.some((l) => /\[일기토 도발\]/.test(l)));

  // 같은 전투에서 두 번은 오지 않는다
  assert.equal(B.duelProvokeRoll(b, () => 0), null);
});

test('일기토 도발: 붙어 있지 않거나 자동 전투(플레이어 없음)면 오지 않는다', () => {
  const far = make();
  const foe = far.units.find((u) => u.gid === 'lu_bu');
  foe.x = 10; foe.y = 7;                       // 아군과 멀리 떨어짐
  assert.equal(B.provokeCandidates(far).length, 0);
  assert.equal(B.duelProvokeRoll(far, () => 0), null);

  const auto = make({ playerSide: null });
  const a2 = B.unitsOf(auto, 'atk')[0];
  const f2 = auto.units.find((u) => u.gid === 'lu_bu');
  a2.x = 3; a2.y = 3; f2.x = 4; f2.y = 3;
  assert.equal(B.duelProvokeRoll(auto, () => 0), null, '자동 전투에는 도발이 없다');
});

test('일기토 도발 거절: 아군 사기가 떨어지고 적은 기세를 올린다', () => {
  const b = make();
  const { ally, foe } = faceToFace(b);
  const ev = B.duelProvokeRoll(b, () => 0);
  const m0 = ally.morale, fm0 = foe.morale;
  const r = B.declineDuelProvoke(b, ev);
  assert.ok(r.ok);
  assert.ok(ally.morale < m0, '아군 사기 하락');
  assert.ok(m0 - ally.morale >= B.PROVOKE_MORALE_LOSS_MIN);
  assert.equal(foe.morale, Math.min(100, fm0 + 4));
  assert.ok(b.log.some((l) => /\[도발 거절\]/.test(l)));
});

test('일기토 도발 수락: 전투 기록에 남고 일기토는 기존 화면으로 이어진다', () => {
  const b = make();
  faceToFace(b);
  const ev = B.duelProvokeRoll(b, () => 0);
  const r = B.acceptDuelProvoke(b, ev);
  assert.ok(r.ok);
  assert.ok(b.log.some((l) => /\[일기토 승낙\]/.test(l)));
  // 수락해도 두 부대의 병력은 일기토가 끝날 때까지 그대로다
  assert.ok(ev.target.alive && ev.challenger.alive);
});

/* ---------- 전투 중 돌발 이벤트 ---------- */

test('돌발 이벤트: 라운드·전황 조건이 맞을 때만 후보가 선다', () => {
  const b = make();
  b.round = 1;
  assert.equal(B.battleEventRoll(b, () => 0), null, '1라운드에는 열리지 않는다');

  b.round = 2;
  const foe = b.units.find((u) => u.gid === 'lu_bu');
  foe.morale = 40;                                  // 사기가 낮은 적 부대
  const cands = B.battleEventCandidates(b);
  assert.ok(cands.includes('waver'));
  assert.ok(cands.includes('reinforce'), '아군 병력이 밀려 원군 후보');
  assert.equal(cands.includes('raid'), false, '야습은 3라운드부터');

  b.round = 3;
  assert.ok(B.battleEventCandidates(b).includes('raid'));
});

test('돌발 이벤트: 확률에 걸리지 않으면 그 라운드는 다시 굴리지 않는다', () => {
  const b = make();
  b.round = 3;
  assert.equal(B.battleEventRoll(b, () => 0.99), null);
  assert.equal(b.lastEventRound, 3);
  assert.equal(B.battleEventRoll(b, () => 0), null, '같은 라운드에 두 번 굴리지 않는다');
  b.round = 4;
  assert.ok(B.battleEventRoll(b, () => 0), '다음 라운드에는 다시 굴린다');
});

test('돌발 이벤트: 전투당 두 번까지만', () => {
  const b = make();
  const foe = b.units.find((u) => u.gid === 'lu_bu');
  foe.morale = 40;
  let n = 0;
  for (let r = 2; r < 12; r++) {
    b.round = r;
    if (B.battleEventRoll(b, () => 0)) n++;
  }
  assert.equal(n, B.BATTLE_EVENT_MAX);
  assert.equal(b.eventCount, B.BATTLE_EVENT_MAX);
});

test('아군 원군 도착: 병력이 늘고 사기가 오르되 상한을 넘지 않는다', () => {
  const b = make({ atkTroops: 4000, defTroops: 16000 });
  b.round = 4;
  const cap = Math.round(b.initial.atk * B.REINFORCE_CAP_MULT);
  let t0 = B.unitsOf(b, 'atk').reduce((s, u) => s + u.troops, 0);

  const ev = B.buildBattleEvent(b, 'reinforce');
  assert.ok(ev, '병력이 밀리면 원군 이벤트가 만들어진다');
  assert.equal(ev.options[0].id, 'join');
  const r = B.resolveBattleEvent(b, ev, 'join', () => 0);
  assert.ok(r.ok);
  const t1 = B.unitsOf(b, 'atk').reduce((s, u) => s + u.troops, 0);
  assert.ok(t1 > t0, '병력이 합류한다');
  assert.ok(b.log.some((l) => /\[원군 도착!\]/.test(l)));

  // 계속 원군이 와도 처음 병력의 1.35배를 넘지 않는다
  for (let i = 0; i < 30; i++) {
    const again = B.buildBattleEvent(b, 'reinforce');
    if (!again) break;
    B.resolveBattleEvent(b, again, 'join', () => 0);
  }
  const t2 = B.unitsOf(b, 'atk').reduce((s, u) => s + u.troops, 0);
  assert.ok(t2 <= cap, `${t2} ≤ ${cap}`);
  for (const u of B.unitsOf(b, 'atk')) assert.ok(u.morale <= 100);
});

test('적 부대 내응·동요: 병력 이탈과 사기 급락을 골라 건다', () => {
  const b = make();
  const foe = b.units.find((u) => u.gid === 'lu_bu');
  foe.morale = 38;
  const ev = B.buildBattleEvent(b, 'waver');
  assert.equal(ev.options.length, 2);
  const troops0 = foe.troops;
  const r1 = B.resolveBattleEvent(b, ev, 'desert', () => 0);
  assert.ok(r1.ok && r1.success);
  assert.ok(foe.troops < troops0, '병력이 빠져나간다');
  assert.ok(b.log.some((l) => /\[내응\]/.test(l)));

  const ev2 = B.buildBattleEvent(b, 'waver');
  const m0 = foe.morale;
  B.resolveBattleEvent(b, ev2, 'break', () => 0);
  assert.equal(foe.morale, Math.max(0, m0 - 20));
  assert.ok(b.log.some((l) => /\[동요\]/.test(l)));
});

test('야습·화공: 숲에 선 적에게만 화공, 성패에 따라 피해가 갈린다', () => {
  const b = make();
  b.round = 3;
  const foe = b.units.find((u) => u.gid === 'lu_bu');
  foe.x = 5; foe.y = 2;
  B.tileAt(b, 5, 2).t = 'forest';

  const ev = B.buildBattleEvent(b, 'raid');
  const ids = ev.options.map((o) => o.id);
  assert.deepEqual(ids, ['night', 'fire', 'back'], '숲에 적이 있으면 화공 선택지가 붙는다');

  const foeTotal = () => B.unitsOf(b, 'def').reduce((s, u) => s + u.troops, 0);
  const t0 = foeTotal();
  const ok = B.resolveBattleEvent(b, ev, 'night', () => 0);   // 난수 0 — 반드시 성공
  assert.equal(ok.success, true);
  assert.ok(foeTotal() < t0, '적 부대 병력이 줄어든다');
  assert.ok(b.log.some((l) => /\[야습 성공\]/.test(l)));

  const b2 = make();
  b2.round = 3;
  const f2 = b2.units.find((u) => u.gid === 'lu_bu');
  f2.x = 5; f2.y = 2; B.tileAt(b2, 5, 2).t = 'forest';
  const ev2 = B.buildBattleEvent(b2, 'raid');
  const mine0 = B.unitsOf(b2, 'atk').reduce((s, u) => s + u.troops, 0);
  const bad = B.resolveBattleEvent(b2, ev2, 'night', () => 0.99);   // 난수 0.99 — 실패
  assert.equal(bad.success, false);
  assert.ok(B.unitsOf(b2, 'atk').reduce((s, u) => s + u.troops, 0) < mine0);
  assert.ok(b2.log.some((l) => /\[야습 실패\]/.test(l)));

  // 숲에 적이 없으면 화공 선택지가 없고, 화공을 밀어 넣어도 숲을 찾지 못한다
  const b3 = make();
  b3.round = 3;
  for (const t of b3.grid) if (t.t === 'forest') t.t = 'plain';
  const ev3 = B.buildBattleEvent(b3, 'raid');
  assert.deepEqual(ev3.options.map((o) => o.id), ['night', 'back']);
  const r3 = B.resolveBattleEvent(b3, ev3, 'fire', () => 0);
  assert.ok(r3.lines.length > 0);
});

test('돌발 이벤트는 자동 전투 결과를 흔들지 않는다', () => {
  for (let i = 0; i < 6; i++) {
    const res = B.autoBattle({
      fromCityId: 'xuchang', toCityId: 'chenliu', attackerFaction: 'jojo', defenderFaction: 'lubu',
      atkGenerals: ['cao_cao', 'xiahou_dun', 'cao_ren'], defGenerals: ['lu_bu', 'chen_gong', 'gao_shun'],
      atkTroops: 15000, defTroops: 12000, defBonus: 55, seed: i + 1,
    });
    assert.ok(['attacker', 'defender'].includes(res.winner));
    assert.ok(res.atkLoss >= 0 && res.defLoss >= 0);
  }
});

test('수락한 일기토가 끝나면 전투 결과에 그대로 반영된다', () => {
  const b = make();
  const { ally, foe } = faceToFace(b);
  const ev = B.duelProvokeRoll(b, () => 0);
  B.acceptDuelProvoke(b, ev);
  // 일기토 UI가 하는 일과 같은 마무리 — 진 쪽 사기 -35, 병력 -18%
  foe.morale = Math.max(0, foe.morale - 35);
  const loss = Math.round(foe.troops * 0.18);
  foe.troops = Math.max(0, foe.troops - loss);
  assert.ok(ally.alive);
  assert.ok(foe.morale < 65);
});

/* ---------- 월간 이벤트 ---------- */

const newGame = (seed = 61) => E.createGame('s194', 'jojo', seed);

test('달의 소식: 보물 상인·도적 잔당·재야 명장이 후보에 들어간다', () => {
  const s = newGame(63);
  const pool = E.monthlyEventPool(s);
  assert.ok(pool.includes('treasureMerchant'));
  assert.ok(pool.includes('remnant'));
  assert.ok(pool.includes('sage'));
  // 보물을 모두 누군가 지니고 있으면 상인은 오지 않는다
  for (const tid of Object.keys(s.treasures.where)) s.treasures.where[tid] = 'cao_cao';
  for (const tr of E.lostTreasures(s)) s.treasures.where[tr.id] = 'cao_cao';
  assert.equal(E.monthlyEventPool(s).includes('treasureMerchant'), false);
});

test('보물 상인: 금을 내면 보물이 우리 것이 되고, 거절하면 그대로다', () => {
  const s = newGame(65);
  const ev = E.buildEvent(s, 'treasureMerchant', () => 0);
  assert.ok(ev, '임자 없는 보물이 있어야 한다');
  assert.equal(ev.options.length, 2);
  const price = ev.data.price;
  assert.equal(ev.options[0].gold, price);
  const gold0 = E.factionGold(s, s.playerId);
  s.pendingEvent = ev;
  const r = E.resolveEvent(s, 'buy');
  assert.ok(r.ok, r.msg);
  assert.equal(E.factionGold(s, s.playerId), gold0 - price);
  assert.ok(s.treasures.owned.includes(ev.data.tid));
  assert.equal(s.pendingEvent, null);

  const s2 = newGame(65);
  const ev2 = E.buildEvent(s2, 'treasureMerchant', () => 0);
  s2.pendingEvent = ev2;
  const g2 = E.factionGold(s2, s2.playerId);
  E.resolveEvent(s2, 'pass');
  assert.equal(E.factionGold(s2, s2.playerId), g2);
  assert.equal(s2.treasures.owned.includes(ev2.data.tid), false);
});

test('보물 상인: 금이 모자라면 사지 못한다', () => {
  const s = newGame(67);
  for (const c of E.factionCities(s, s.playerId)) c.gold = 0;
  const ev = E.buildEvent(s, 'treasureMerchant', () => 0);
  s.pendingEvent = ev;
  const r = E.resolveEvent(s, 'buy');
  assert.ok(r.ok);
  assert.match(r.msg, /금이 모자라/);
  assert.equal(s.treasures.owned.includes(ev.data.tid), false);
});

test('도적 잔당: 출동하면 치안·명성·금이 오르고, 방치하면 치안이 떨어진다', () => {
  const s = newGame(69);
  for (const c of E.factionCities(s, s.playerId)) c.order = 96;
  const s2 = newGame(69);

  const ev = E.buildEvent(s, 'remnant', () => 0);
  assert.equal(ev.options.length, 3);
  const fame0 = s.factions[s.playerId].fame;
  const gold0 = E.factionGold(s, s.playerId);
  s.pendingEvent = ev;
  const r = E.resolveEvent(s, 'sweep');
  assert.ok(r.ok, r.msg);
  assert.ok(s.factions[s.playerId].fame > fame0);
  assert.ok(E.factionGold(s, s.playerId) > gold0 - 1000, '금을 얻는다');
  for (const c of E.factionCities(s, s.playerId)) assert.ok(c.order <= ORDER_CAP, '치안 상한 100을 넘지 않는다');

  const ev2 = E.buildEvent(s2, 'remnant', () => 0);
  for (const c of E.factionCities(s2, s2.playerId)) c.order = 50;
  s2.pendingEvent = ev2;
  E.resolveEvent(s2, 'ignore');
  for (const c of E.factionCities(s2, s2.playerId)) assert.equal(c.order, 45);
});

test('도적 잔당: 회유하면 금을 쓰고 모든 성 치안이 오른다', () => {
  const s = newGame(71);
  for (const c of E.factionCities(s, s.playerId)) c.order = 40;
  const gold0 = E.factionGold(s, s.playerId);
  const ev = E.buildEvent(s, 'remnant', () => 0);
  s.pendingEvent = ev;
  const r = E.resolveEvent(s, 'parley');
  assert.ok(r.ok);
  assert.equal(E.factionGold(s, s.playerId), gold0 - 200);
  for (const c of E.factionCities(s, s.playerId)) assert.equal(c.order, 43);
});

test('재야 명장 천거: 예우하면 등용을 시도하고, 사양하면 아무 일도 없다', () => {
  const s = newGame(73);
  const cand = E.sageCandidate(s);
  assert.ok(cand, '재야 장수가 있어야 한다');
  const ev = E.buildEvent(s, 'sage');
  assert.ok(ev, ev && ev.title);
  assert.equal(ev.options.length, 2);
  assert.equal(ev.data.gid, cand.id);
  assert.ok(ev.text.includes('천거'));

  // 사양 — 아무 일도 없다
  const s0 = newGame(73);
  s0.pendingEvent = E.buildEvent(s0, 'sage');
  const g0 = E.factionGold(s0, s0.playerId);
  const r0 = E.resolveEvent(s0, 'decline');
  assert.ok(r0.ok);
  assert.equal(E.factionGold(s0, s0.playerId), g0);
  assert.equal(s0.generals[cand.id].faction, null);

  // 예우 — 금을 쓰고, 성공하면 충성 70으로 합류한다(난수 상태를 바꿔 가며 성공을 찾는다)
  let joined = null;
  for (let k = 1; k <= 40 && !joined; k++) {
    const t = newGame(73);
    t.factions[t.playerId].fame = 100;                 // 성공률을 끌어올린다
    t.rngState = k;
    t.pendingEvent = E.buildEvent(t, 'sage');
    const gold = E.factionGold(t, t.playerId);
    const before = E.factionGenerals(t, t.playerId).length;
    const res = E.resolveEvent(t, 'honor');
    assert.ok(res.ok, res.msg);
    assert.ok(E.factionGold(t, t.playerId) <= gold - E.SAGE_PRICE, '금 400을 쓴다');
    if (t.generals[cand.id].faction === t.playerId) {
      joined = { t, res, before };
      assert.equal(t.generals[cand.id].loyalty, 70);
      assert.ok(E.factionGenerals(t, t.playerId).length > before);
      assert.match(res.msg, /등용/);
    } else {
      assert.match(res.msg, /사양/);
    }
  }
  assert.ok(joined, '40번 안에 한 번은 등용에 성공한다');
});

test('금이 모자라면 명장 천거도 예우하지 못한다', () => {
  const s = newGame(75);
  for (const c of E.factionCities(s, s.playerId)) c.gold = 0;
  s.pendingEvent = E.buildEvent(s, 'sage');
  const cand = E.sageCandidate(s);
  const r = E.resolveEvent(s, 'honor');
  assert.ok(r.ok);
  assert.match(r.msg, /금이 모자라/);
  assert.equal(s.generals[cand.id].faction, null);
});

test('새 달의 소식도 저장·복원을 지나간다', () => {
  const s = newGame(77);
  s.pendingEvent = E.buildEvent(s, 'sage');
  const back = E.deserialize(E.serialize(s));
  assert.ok(back.pendingEvent && back.pendingEvent.id === 'sage');
  assert.ok(back.pendingEvent.data.gid);
  assert.equal(E.resolveEvent(back, back.pendingEvent.options[0].id).ok, true);
});
