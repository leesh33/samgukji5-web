import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from '../js/data.js';
import * as E from '../js/engine.js';

const newGame = (seed = 11) => E.createGame('s194', 'jojo', seed);
const lordOfPlayer = (s) => s.factions[s.playerId].lord;

/* ---------- 군주는 참모 후보가 아니다 ---------- */
test('참모: 군주는 어느 시나리오·세력에서도 참모 후보에 오르지 않는다', () => {
  let checked = 0;
  for (const sc of SCENARIOS) {
    for (const f of sc.factions) {
      const s = E.createGame(sc.id, f.id, 4321);
      const lord = s.factions[s.playerId].lord;
      const ids = E.advisorCandidates(s).map((g) => g.id);
      assert.ok(!ids.includes(lord), `${sc.id}/${f.id}: 군주 ${lord}가 후보에 있음`);
      assert.notEqual(E.recommendAdvisor(s), lord, `${sc.id}/${f.id}: 군주 추천`);
      assert.notEqual(s.advisorId, lord, `${sc.id}/${f.id}: 군주가 참모로 앉음`);
      checked++;
    }
  }
  assert.ok(checked >= 5, '검사한 세력 수 ' + checked);
});

test('참모: 부하 장수 중 지력 최고가 앉는다', () => {
  const s = newGame(11);
  const lord = lordOfPlayer(s);
  const best = E.advisorCandidates(s).sort((a, b) => E.generalOf(s, b.id).int - E.generalOf(s, a.id).int)[0];
  assert.equal(E.recommendAdvisor(s), best.id);
  assert.equal(s.advisorId, best.id);
  assert.notEqual(s.advisorId, lord);
  assert.ok(E.advisorOf(s) && E.advisorOf(s).id === best.id);
});

/* ---------- 임명 거절 ---------- */
test('참모: appointAdvisor(군주)는 거절하고 상태를 바꾸지 않는다', () => {
  const s = newGame(12);
  const lord = lordOfPlayer(s);
  const before = s.advisorId;
  const res = E.appointAdvisor(s, lord);
  assert.equal(res.ok, false);
  assert.equal(res.msg, '군주는 참모로 임명할 수 없습니다.');
  assert.equal(s.advisorId, before, '거절 뒤 참모가 그대로');
  assert.notEqual(E.advisorOf(s).id, lord);
});

/* ---------- 기존 세이브 보정 ---------- */
test('참모: 군주가 참모로 저장된 옛 세이브는 부하 지력 최고로 보정된다', () => {
  const s = newGame(13);
  const lord = lordOfPlayer(s);
  const expect = E.advisorCandidates(s).sort((a, b) => E.generalOf(s, b.id).int - E.generalOf(s, a.id).int)[0].id;
  s.advisorId = lord;                       // 옛 저장: 군주가 참모
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.factions[back.playerId].lord, lord);
  assert.equal(back.advisorId, expect, '부하 지력 최고로 교체');
  assert.equal(E.advisorOf(back).id, expect);
});

test('참모: 군주 말고 부하가 없으면 참모는 미임명(null)이 된다', () => {
  const s = newGame(14);
  const lord = lordOfPlayer(s);
  for (const g of E.factionGenerals(s, s.playerId)) {
    if (g.id === lord) continue;
    g.faction = null;                        // 부하 장수 전원이 떠남
    g.city = 'luoyang';
  }
  s.advisorId = lord;
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.advisorId, null, '부하가 없으면 참모 없음');
  assert.equal(E.advisorOf(back), null);
  assert.equal(E.advisorBonus(back), 0);
  assert.equal(E.recommendAdvisor(back), null);
  assert.deepEqual(E.advisorCandidates(back), []);
  assert.match(E.advisorAdvice(back), /참모로 앉힐 부하 장수가 없습니다/);
});

test('참모: 군주를 참모로 둔 채로는 보정이 붙지 않고, 턴이 바뀌면 부하로 다시 앉는다', () => {
  const s = newGame(15);
  const lord = lordOfPlayer(s);
  s.advisorId = lord;
  assert.equal(E.advisorOf(s), null, '군주는 참모로 조회되지 않는다');
  assert.equal(E.advisorBonus(s), 0, '군주 참모 보정 0');
  E.endTurnPhase2(s);
  assert.notEqual(s.advisorId, lord);
  assert.ok(E.advisorOf(s), '턴이 바뀌면 부하 장수가 앉는다');
});

/* ---------- 신군주(커스텀 세력) ---------- */
const customDraft = (over = {}) => ({
  name: '오돌', mark: '오', color: '#c8a15a',
  cityId: E.customStartCities('s194')[0].cityId,
  stats: { lead: 70, war: 60, int: 100, pol: 90, cha: 80 },
  skill: 'sinan', arms: '보병', retinue: 2,
  style: { hat: 2, beard: 3, skin: 2 },
  ...over,
});

test('참모: 신군주(지력 100 오돌)도 참모에 오르지 않고 휘하 장수가 앉는다', () => {
  const custom = E.buildCustomLord(customDraft());
  const s = E.createGame('s194', custom.faction.id, 999, { custom });
  const lord = s.factions[s.playerId].lord;
  assert.equal(E.generalOf(s, lord).ko, '오돌');
  const ids = E.advisorCandidates(s).map((g) => g.id);
  assert.ok(!ids.includes(lord), '신군주가 후보에 없음');
  assert.ok(ids.length >= 1, '휘하 장수가 후보');
  assert.notEqual(s.advisorId, lord);
  assert.ok(E.advisorOf(s));
  const r = E.appointAdvisor(s, lord);
  assert.equal(r.ok, false);
  assert.equal(r.msg, '군주는 참모로 임명할 수 없습니다.');
});

test('참모: 휘하가 없는 신군주는 군주 말고 사람이 없어 참모도 없다', () => {
  const custom = E.buildCustomLord(customDraft({ retinue: 0 }));
  const s = E.createGame('s194', custom.faction.id, 777, { custom });
  assert.deepEqual(E.advisorCandidates(s), []);
  assert.equal(s.advisorId, null);
  assert.equal(E.advisorBonus(s), 0);
  assert.match(E.advisorAdvice(s), /참모로 앉힐 부하 장수가 없습니다/);
});
