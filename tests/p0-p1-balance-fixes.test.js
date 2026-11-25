/* 2026-11-25 점검(P0·P1·밸런스) 회귀 테스트 — 고친 것이 되돌아가지 않게 지킨다.
 *
 * P0  전투 결과 창을 ✕/배경으로 닫아도 전장에 갇히지 않는다
 * P1-1 성 방어 수치가 전장 피해에 걸린다
 * P1-2 출진 예상이 수비 참전 장수(≤5명)·성 방어·원군을 반영한다
 * P1-3 달의 소식·대회를 ✕로 닫아도 다음 달·다음 대회가 잠기지 않는다
 * P1-4 퇴각은 확인 절차를 거친다
 * P1-5 첫 달에 AI가 곧바로 덮치지 않는다
 * P1-6 AI 성의 치안·규모 승격, 후반 곳간 상한
 * P2   격퇴 후 주둔 상한 초과, 군사 위임 징병 상한
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as E from '../js/engine.js';
import * as B from '../js/battle.js';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const ui = read('../js/ui.js');
const index = read('../index.html');
const newGame = (sc, fid, seed) => E.createGame(sc, fid, seed);
const GM = (s) => E.generalMap(s);

/* ---------- P0 · 전투 결과 창에서 빠져나온다 ---------- */
test('P0: 결과 시트를 ✕·배경으로 닫으면 전장을 빠져나온다(closeBattle 경유)', () => {
  // sheet-close 분기에서 결과 대기 중이면 closeBattle()을 부른다
  const start = ui.indexOf("case 'sheet-close':");
  assert.ok(start > 0, 'sheet-close 분기');
  const branch = ui.slice(start, ui.indexOf("case 'menu':", start));
  assert.match(branch, /if \(battle && lastBattleResult\) \{ closeBattle\(\); break; \}/,
    '결과 창 ✕ → closeBattle');
  // closeBattle은 결과 표시를 지우고 전장 상태를 비운다
  const fn = ui.match(/function closeBattle\(\) \{([\s\S]*?)\n\}/);
  assert.ok(fn, 'closeBattle');
  assert.match(fn[1], /lastBattleResult = null;/, '결과 표시 해제');
  assert.match(fn[1], /battle = null;/, '전장 비우기');
  assert.match(fn[1], /continueAfterBattle\(\);/, '전투 뒤 흐름으로 복귀');
});

/* ---------- P1-1 · 성 방어 수치 ---------- */
function wallBattle(defBonus, seed) {
  const s = newGame('s194', 'jojo', 3);
  const atk = E.generalsInCity(s, 'xuchang').slice(0, 5).map((g) => g.id);
  const def = E.generalsInCity(s, 'luoyang').slice(0, 5).map((g) => g.id);
  return B.autoBattle({
    fromCityId: 'xuchang', toCityId: 'luoyang', attackerFaction: 'jojo', defenderFaction: 'li_jue',
    atkGenerals: atk, defGenerals: def, atkTroops: 9000, defTroops: 9000,
    defBonus, seed, generals: GM(s),
  });
}

test('P1-1: 성 방어 수치가 높으면 수비 손실이 줄고, 낮으면 늘어난다', () => {
  let low = 0, high = 0, lowDefWins = 0, highDefWins = 0;
  for (let i = 0; i < 24; i++) {
    const a = wallBattle(20, 100 + i);
    const b = wallBattle(95, 100 + i);
    low += a.defLoss; high += b.defLoss;
    if (a.winner === 'defender') lowDefWins++;
    if (b.winner === 'defender') highDefWins++;
  }
  assert.ok(high < low * 0.85, `수비 손실 방20 ${low} vs 방95 ${high}`);
  assert.ok(highDefWins >= lowDefWins, `수비 승 ${lowDefWins} → ${highDefWins}`);
});

test('P1-1: 방어 수치는 수비측에만 걸린다(공격측이 맞을 때는 그대로)', () => {
  const s = newGame('s194', 'jojo', 3);
  const b = B.createBattle({
    fromCityId: 'xuchang', toCityId: 'luoyang', attackerFaction: 'jojo', defenderFaction: 'li_jue',
    atkGenerals: E.generalsInCity(s, 'xuchang').slice(0, 2).map((g) => g.id),
    defGenerals: E.generalsInCity(s, 'luoyang').slice(0, 2).map((g) => g.id),
    atkTroops: 6000, defTroops: 6000, defBonus: 95, seed: 7, generals: GM(s),
  });
  const atk = b.units.find((u) => u.side === 'atk');
  const dfn = b.units.find((u) => u.side === 'def');
  assert.equal(B.wallGuard(b, atk), 1, '공격측은 성벽 보정 없음');
  assert.ok(B.wallGuard(b, dfn) > 1.2, '수비측은 성벽 보정');
});

/* ---------- P1-2 · 출진 예상 ---------- */
test('P1-2: 수비는 성에 있는 장수(최대 5명)의 지휘 상한까지만 나선다', () => {
  const s = newGame('s194', 'jojo', 17);
  const to = 'luoyang';
  const gens = E.generalsInCity(s, to);
  assert.equal(gens.length, 1, '낙양 수비 장수 1명');
  s.cities[to].troops = 30000;                     // 성에는 3만이 있어도
  const def = E.siegeDefense(s, to);
  assert.equal(def.fielded, E.maxTroopsOf(s, gens[0].id), '장수 지휘 상한까지만');
  assert.ok(def.fielded < 30000);
  const odds = E.siegeOdds(s, 'xuchang', to, {});
  assert.equal(odds.defFielded, def.fielded);
  assert.equal(odds.defGens, 1);
});

test('P1-2: 장수 5명인 성은 그만큼 많이 내고, 출진 예상도 그만큼 무거워진다', () => {
  const s = newGame('s200', 'jojo', 8);
  const solo = 'luoyang';
  const many = 'xuchang';
  for (const cid of [solo, many]) s.cities[cid].troops = 30000;
  const dSolo = E.siegeDefense(s, solo);
  const dMany = E.siegeDefense(s, many);
  assert.ok(E.generalsInCity(s, many).length >= 3, '여러 장수');
  assert.ok(dMany.fielded > dSolo.fielded, `수비 병력 ${dSolo.fielded} vs ${dMany.fielded}`);
});

test('P1-2: 권장 병력으로 출진하면 실제로 이기고, 그 60%로는 대개 진다', () => {
  const cases = [['s194', 'jojo', 'chenliu', 'puyang'], ['s200', 'jojo', 'runan', 'pengcheng']];
  for (const [sc, fid, from, to] of cases) {
    const s = newGame(sc, fid, 17);
    const odds = E.siegeOdds(s, from, to, {});
    assert.ok(odds && odds.recommend > 0, '권장 병력');
    const rate = (troops) => {
      let w = 0;
      const N = 12;
      for (let i = 0; i < N; i++) {
        const g = newGame(sc, fid, 17);
        const setup = E.battleSetup(g, from, to, { atkTroops: troops });
        if (B.autoBattle({ ...setup, seed: 700 + i * 5, generals: GM(g) }).winner === 'attacker') w++;
      }
      return w / N;
    };
    assert.ok(rate(odds.recommend) >= 0.66, `${sc} ${from}→${to} 권장 승률`);
    assert.ok(rate(Math.round(odds.recommend * 0.6)) < 0.5, `${sc} ${from}→${to} 60% 승률`);
  }
});

test('P1-2: 지휘 상한이 모자라면 권장 병력을 상한으로 자르고 그 사실을 알린다', () => {
  const s = newGame('s194', 'jojo', 17);
  const from = 'xuchang';
  const to = E.adjacentEnemies(s, from)[0];
  for (const g of E.generalsInCity(s, from)) g.rank = 0;   // 모두 일반(7,500)
  const gid = E.generalsInCity(s, from)[0].id;
  s.cities[to].troops = 60000;
  for (const g of E.generalsInCity(s, to)) g.rank = 6;
  s.cities[to].order = 100; s.cities[to].def = 95;
  const odds = E.siegeOdds(s, from, to, { generals: [gid], troops: 60000 });
  assert.ok(odds.capLimited, '상한 부족 표시');
  assert.equal(odds.recommend, odds.atkCap, '권장은 상한까지만');
  assert.ok(odds.needTroops > odds.atkCap, '필요 병력은 상한보다 크다');
});

/* ---------- P1-3 · 달의 소식/대회 잠김 ---------- */
test('P1-3: ✕로 닫아 둔 달의 소식은 다음 달에 정리되고 새 소식이 다시 굴러간다', () => {
  const s = newGame('s200', 'jojo', 31);
  E.endTurnPhase2(s);
  // 이번 달 이벤트를 하나 띄워 두고 ✕로 닫은 상태를 만든다
  if (!s.pendingEvent) {
    const ev = E.rollMonthlyEvent(s, () => 0);
    if (!ev) { s.pendingEvent = { id: 'harvest', title: '풍작', text: 't', options: [{ id: 'reap', ko: '거둔다' }] }; }
  }
  s.pendingEvent.shown = true;
  const staleTurn = s.turn;
  // 40개월을 굴려도 새 이벤트가 한 번도 안 뜨면 잠긴 것이다
  let events = 0;
  for (let m = 0; m < 40; m++) {
    E.endTurnPhase1(s); s.pendingBattles = [];
    E.endTurnPhase2(s);
    if (s.pendingEvent) { events++; E.resolveEvent(s, s.pendingEvent.options[0].id); }
  }
  assert.ok(s.turn > staleTurn + 30);
  assert.ok(events > 3, `새 달의 소식 ${events}회`);
});

test('P1-3: 닫아 둔 대회는 다음 대회를 막지 않는다', () => {
  const s = newGame('s208', 'jojo', 44);
  assert.ok(E.canHoldTournament(s), '대회 조건(장수 30명)');
  s.month = 5;
  E.maybeOpenTournament(s, () => 0.5);
  const first = s.pendingTournament;
  assert.ok(first, '5월 대회');
  first.shown = true;                 // ✕로 닫은 상태
  for (let m = 0; m < 12; m++) {
    E.endTurnPhase1(s); s.pendingBattles = [];
    E.endTurnPhase2(s);
    if (s.pendingEvent) E.resolveEvent(s, s.pendingEvent.options[0].id);
  }
  // 1년을 돌면 5월·10월 대회가 다시 열린다(잠기지 않는다)
  const held = (s.log || []).filter((l) => /무예 대회|설전 대회/.test(l.text)).length;
  assert.ok(held >= 1, `대회 개최 기록 ${held}`);
  // 닫아 둔 첫 대회는 정리됐다(마지막 달에 새로 열린 대회는 이번 달 것으로 남는다)
  assert.ok(!s.pendingTournament || s.pendingTournament.turn === s.turn, '닫아 둔 대회는 정리됐다');
});

/* ---------- P1-4 · 퇴각 확인 ---------- */
test('P1-4: 퇴각은 한 번 더 눌러야 실행된다', () => {
  const fn = ui.match(/function retreat\(\) \{([\s\S]*?)\n\}/);
  assert.ok(fn, 'retreat');
  assert.match(fn[1], /if \(!retreatConfirm\)/, '첫 탭은 확인만');
  assert.match(fn[1], /retreatConfirm = true/);
  assert.match(fn[1], /한 번 더 누르면 퇴각합니다/, '안내 문구');
  assert.match(fn[1], /battle\.over = battle\.playerSide === 'atk' \? 'def' : 'atk'/, '두 번째 탭에 퇴각');
  // 버튼 라벨도 확인 상태를 보여 준다 — 버튼에는 id가 없고 data-act로 찾는다
  assert.match(ui, /const rb = \$\('\[data-act="bt-retreat"\]'\)/, '퇴각 버튼 선택');
  assert.match(ui, /rb\.textContent = retreatConfirm \? '정말 퇴각\?' : '퇴각'/, '버튼 라벨');
  assert.match(index, /data-act="bt-retreat"/);
});

/* ---------- P1-5 · 첫 달 즉사 완화 ---------- */
test('P1-5: 첫 달에는 AI가 플레이어의 성을 치지 않는다', () => {
  for (const [sc, fid] of [['s208', 'liubei'], ['s194', 'lubu'], ['s194', 'liubei'], ['s200', 'gongsundu']]) {
    for (let seed = 1; seed <= 12; seed++) {
      const s = newGame(sc, fid, seed);
      const pend = E.endTurnPhase1(s).filter((p) => p.defenderFaction === fid);
      assert.equal(pend.length, 0, `${sc}/${fid} seed${seed} 첫 달 공격`);
    }
  }
});

/* ---------- P1-6 · AI 성장 + 곳간 상한 ---------- */
test('P1-6: AI 성도 치안을 채워 규모가 승격한다', () => {
  const s = newGame('s208', 'jojo', 3);
  for (const f of Object.values(s.factions)) f.isPlayer = false;
  const before = Object.fromEntries(Object.values(s.cities).map((c) => [c.id, c.size]));
  for (let m = 0; m < 96; m++) {
    E.endTurnPhase1(s); s.pendingBattles = [];
    E.endTurnPhase2(s);
    if (s.pendingEvent) E.resolveEvent(s, s.pendingEvent.options[0].id);
    if (s.pendingTournament) E.resolveTournamentReward(s, 'praise');
  }
  const cities = Object.values(s.cities).filter((c) => c.owner);
  const ups = cities.filter((c) => c.size > before[c.id]).length;
  const avgOrder = cities.reduce((n, c) => n + c.order, 0) / cities.length;
  assert.ok(ups > 0, `규모 승격 ${ups}곳`);
  assert.ok(avgOrder > 55, `평균 치안 ${Math.round(avgOrder)}`);
});

test('P1-6: 어느 성도 곳간 상한을 넘지 않고, 성 시트에 상한이 보인다', () => {
  const s = newGame('s200', 'jojo', 7);
  for (const f of Object.values(s.factions)) f.isPlayer = false;
  for (let m = 0; m < 60; m++) {
    E.endTurnPhase1(s); s.pendingBattles = [];
    E.endTurnPhase2(s);
    if (s.pendingEvent) E.resolveEvent(s, s.pendingEvent.options[0].id);
    if (s.pendingTournament) E.resolveTournamentReward(s, 'praise');
  }
  for (const c of Object.values(s.cities)) {
    if (!c.owner) continue;
    const store = E.cityStoreCap(s, c.id);
    assert.ok(store.gold > 0 && store.food > 0, '상한 값');
    assert.ok(c.gold <= store.gold, `${c.id} 금 ${c.gold} > ${store.gold}`);
    assert.ok(c.food <= store.food, `${c.id} 식량 ${c.food} > ${store.food}`);
  }
  assert.match(ui, /E\.cityStoreCap\(game, selectedCity\)/, '성 시트가 상한을 읽는다');
  assert.match(ui, /곳간 상한/, '상한 안내');
});

/* ---------- P2 ---------- */
test('P2: 자동전에서 격퇴된 성의 주둔 병력이 인구 상한을 넘지 않는다', () => {
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = newGame('s194', 'liubei', seed);
    const weak = E.factionCities(s, 'liubei')[0].id;
    const c = s.cities[weak];
    c.pop = 900; c.troops = 5000;     // 인구 900 → 상한 270 (병력이 상한을 넘은 상태)
    const foes = E.adjacentEnemies(s, weak);
    if (!foes.length) continue;
    const from = foes[0];
    s.cities[from].troops = 3000;      // 수비가 이길 만큼 약한 공격
    E.resolveAutoBattle(s, from, weak, E.mulberry32(seed * 31));
    if (c.owner === 'liubei') {
      checked++;
      assert.ok(c.troops <= E.cityTroopsCap(s, weak), `${weak} 병 ${c.troops} > 상한 ${E.cityTroopsCap(s, weak)}`);
    }
  }
  assert.ok(checked > 0, '격퇴 사례');
});

test('P2: 군사 위임 징병은 8,000에서 멈추지 않고 성 상한의 70%까지 채운다', () => {
  const s = newGame('s200', 'jojo', 12);
  const c = E.factionCities(s, 'jojo').find((x) => E.cityTroopsCap(s, x.id) > 20000);
  assert.ok(c, '큰 성');
  c.troops = 1000;
  s.delegation = { [c.id]: 'military' };
  for (let m = 0; m < 14; m++) {
    c.gold = 6000; c.food = 12000;   // 곳간을 채워 두고 위임만 돌린다
    E.runDelegations(s, E.mulberry32(m + 5));
  }
  const cap = E.cityTroopsCap(s, c.id);
  assert.ok(c.troops > 8000, `위임 징병 ${c.troops} (상한 ${cap})`);
  assert.ok(c.troops <= Math.round(cap * 0.7) + 2000, `위임이 상한 가까이에서 멈춘다 ${c.troops}/${cap}`);
});
