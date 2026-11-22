import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { TALK_LINES, TALK_STYLES, talkStyleOf, pickTalkLine } from '../js/talk.js';

const newGame = (seed = 42) => E.createGame('s194', 'jojo', seed);
const firstCity = (s) => E.factionCities(s, s.playerId)[0];

/* ---------------- 도시간 장수 이동 ---------------- */

test('이동: 선택한 장수 전원이 도착 성으로 옮겨지고 행동력 1을 쓴다', () => {
  const s = newGame();
  const from = firstCity(s);
  const dest = E.moveDestinations(s, from.id)[0];
  assert.ok(dest, '아군 성이 둘 이상');
  const gens = E.generalsInCity(s, from.id).slice(0, 2);
  const fromCount = E.generalsInCity(s, from.id).length;
  const toCount = E.generalsInCity(s, dest.cityId).length;
  const ap0 = s.actionPoints;

  const r = E.moveGenerals(s, from.id, dest.cityId, gens.map((g) => g.id));
  assert.ok(r.ok, r.msg);
  assert.equal(r.moved.length, 2);
  assert.equal(s.actionPoints, ap0 - E.MOVE_COST);
  for (const g of gens) {
    const st = s.generals[g.id];
    assert.equal(st.city, dest.cityId, '소속 성 변경');
    assert.equal(st.acted, true, '이번 달 행동 완료');
    assert.equal(st.movedThisTurn, true);
    assert.equal(st.faction, s.playerId);
  }
  assert.equal(E.generalsInCity(s, from.id).length, fromCount - 2);
  assert.equal(E.generalsInCity(s, dest.cityId).length, toCount + 2);
  assert.match(s.log[s.log.length - 1].text, /옮겼습니다/);
});

test('이동: 옮긴 장수는 그 달 다른 명령을 받지 못하고, 턴이 지나면 풀린다', () => {
  const s = newGame(7);
  const from = firstCity(s);
  const dest = E.moveDestinations(s, from.id)[0];
  const gid = E.generalsInCity(s, from.id)[0].id;
  assert.ok(E.moveGenerals(s, from.id, dest.cityId, [gid]).ok);
  const blocked = E.runCommand(s, 'agri', { cityId: dest.cityId, officerId: gid });
  assert.equal(blocked.ok, false);
  assert.match(blocked.msg, /움직|이미/);
  E.endTurnPhase2(s);
  assert.equal(s.generals[gid].acted, false);
  assert.equal(s.generals[gid].movedThisTurn, false);
});

test('이동: 아군 성이 아닌 곳·같은 성·이미 움직인 장수·행동력 없음은 거부', () => {
  const s = newGame(11);
  const from = firstCity(s);
  const dest = E.moveDestinations(s, from.id)[0];
  const gid = E.generalsInCity(s, from.id)[0].id;

  assert.equal(E.canMoveGenerals(s, from.id, from.id, [gid]).ok, false);
  const enemy = Object.values(s.cities).find((c) => c.owner && c.owner !== s.playerId).id;
  assert.equal(E.canMoveGenerals(s, from.id, enemy, [gid]).ok, false);
  assert.equal(E.canMoveGenerals(s, from.id, dest.cityId, []).ok, false);

  s.generals[gid].acted = true;
  const acted = E.canMoveGenerals(s, from.id, dest.cityId, [gid]);
  assert.equal(acted.ok, false);
  assert.match(acted.why, /이미/);
  s.generals[gid].acted = false;

  s.actionPoints = 0;
  assert.match(E.canMoveGenerals(s, from.id, dest.cityId, [gid]).why, /행동력/);
  assert.equal(E.moveGenerals(s, from.id, dest.cityId, [gid]).ok, false);
});

test('이동: 목적지 장수 상한(12명)을 넘으면 거부', () => {
  const s = newGame(13);
  const from = firstCity(s);
  const dest = E.moveDestinations(s, from.id)[0].cityId;
  const filler = Object.values(s.generals).filter((g) => !g.faction && !g.dead && !g.captive);
  let added = 0;
  for (const g of filler) {
    if (E.generalsInCity(s, dest).length >= E.MAX_OFFICERS_PER_CITY) break;
    g.faction = s.playerId; g.city = dest; g.loyalty = 50; added++;
  }
  assert.ok(added > 0);
  assert.equal(E.generalsInCity(s, dest).length, E.MAX_OFFICERS_PER_CITY);
  const gid = E.generalsInCity(s, from.id)[0].id;
  const r = E.canMoveGenerals(s, from.id, dest, [gid]);
  assert.equal(r.ok, false);
  assert.match(r.why, /12|넘습니다/);
});

test('이동: 출발 성을 비우면 경고를 돌려준다(이동은 허용, 군주도 이동 가능)', () => {
  const s = E.createGame('s194', 'shixie', 17);
  const lordId = s.factions.shixie.lord;
  const from = E.factionCities(s, 'shixie').find((c) => E.generalsInCity(s, c.id).some((g) => g.id === lordId));
  const dest = E.moveDestinations(s, from.id)[0].cityId;
  const all = E.generalsInCity(s, from.id).map((g) => g.id);
  assert.equal(all.length, 1, '출발 성에 군주 한 명');
  assert.ok(all.includes(lordId), '군주가 출발 성에 있음');
  const r = E.moveGenerals(s, from.id, dest, all);
  assert.ok(r.ok, r.msg);
  assert.match(r.warning, /남지 않습니다/);
  assert.equal(E.generalsInCity(s, from.id).length, 0);
  assert.equal(s.generals[lordId].city, dest, '군주도 이동');
});

test('이동: 저장·불러오기에서도 옮긴 소속과 상태가 유지된다', () => {
  const s = newGame(19);
  const from = firstCity(s);
  const dest = E.moveDestinations(s, from.id)[0].cityId;
  const gid = E.generalsInCity(s, from.id)[0].id;
  assert.ok(E.moveGenerals(s, from.id, dest, [gid]).ok);
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.generals[gid].city, dest);
  assert.equal(back.generals[gid].movedThisTurn, true);
  assert.equal(back.actionPoints, s.actionPoints);
});

/* ---------------- 장수 대화 ---------------- */

test('대화: 충성도가 오르고 행동력만 소모되며 금은 들지 않는다', () => {
  const s = newGame(23);
  const city = firstCity(s);
  const lordId = s.factions[s.playerId].lord;
  const partners = E.talkPartners(s, city.id);
  assert.ok(partners.length > 0, '대화 상대 존재');
  assert.ok(!partners.some((g) => g.id === lordId), '군주는 대화 상대에서 제외');

  const g = partners[0];
  g.loyalty = 60;
  const ap0 = s.actionPoints;
  const gold0 = s.cities[city.id].gold;
  const food0 = s.cities[city.id].food;

  const r = E.talkToGeneral(s, city.id, g.id);
  assert.ok(r.ok, r.msg);
  assert.equal(s.generals[g.id].loyalty, 60 + r.gain);
  assert.equal(r.after, s.generals[g.id].loyalty);
  assert.ok(r.gain >= E.TALK_GAIN_MIN, `gain ${r.gain}`);
  assert.ok(r.gain <= E.TALK_GAIN_MAX + 4, `gain ${r.gain}`); // 매력 +2, 인덕 +2 보정 포함
  assert.equal(s.actionPoints, ap0 - E.TALK_COST);
  assert.equal(s.cities[city.id].gold, gold0);
  assert.equal(s.cities[city.id].food, food0);
  assert.ok(r.line && r.line.g.length > 5, '장수 대사 출력');
  assert.ok(r.line && r.line.l.length > 3, '군주 한마디 출력');
  assert.ok(['warrior', 'strategist', 'loyal', 'ambitious', 'custom', 'neutral'].includes(r.style));
});

test('대화: 장수당 한 달 1회 — 다시 시도하면 거부되고 턴이 지나면 다시 된다', () => {
  const s = newGame(29);
  const city = firstCity(s);
  const g = E.talkPartners(s, city.id)[0];
  g.loyalty = 50;
  assert.ok(E.talkToGeneral(s, city.id, g.id).ok);
  assert.equal(E.talkedThisTurn(s, g.id), true);

  const again = E.talkToGeneral(s, city.id, g.id);
  assert.equal(again.ok, false);
  assert.match(again.msg, /이미/);
  assert.equal(E.canTalk(s, city.id, g.id).ok, false);

  // 같은 턴에 다른 장수와는 대화할 수 있다
  const other = E.talkPartners(s, city.id).find((x) => x.id !== g.id && x.loyalty < 100);
  assert.ok(E.talkToGeneral(s, city.id, other.id).ok);

  const before = s.generals[g.id].loyalty;
  E.endTurnPhase2(s);
  assert.equal(E.talkedThisTurn(s, g.id), false, '턴 종료 시 초기화');
  const r = E.talkToGeneral(s, city.id, g.id);
  assert.ok(r.ok, r.msg);
  assert.ok(s.generals[g.id].loyalty > before);
});

test('대화: 충성도 상한 100 — 최대면 대화 불가', () => {
  const s = newGame(31);
  const city = firstCity(s);
  const g = E.talkPartners(s, city.id).find((x) => x.loyalty < 100);
  g.loyalty = 99;
  const r = E.talkToGeneral(s, city.id, g.id);
  assert.ok(r.ok);
  assert.equal(s.generals[g.id].loyalty, 100, '100을 넘지 않는다');
  assert.equal(r.after, 100);
  assert.equal(r.gain, 1);

  E.endTurnPhase2(s); // 대화 제한 해제
  const g2 = E.talkPartners(s, city.id).find((x) => x.id !== g.id);
  g2.loyalty = 100;
  const blocked = E.talkToGeneral(s, city.id, g2.id);
  assert.equal(blocked.ok, false);
  assert.match(blocked.msg, /최대/);
});

test('대화: 행동력이 없거나 아군 장수가 아니면 거부', () => {
  const s = newGame(37);
  const city = firstCity(s);
  const g = E.talkPartners(s, city.id)[0];
  s.actionPoints = 0;
  assert.match(E.canTalk(s, city.id, g.id).why, /행동력/);
  s.actionPoints = 5;
  assert.equal(E.canTalk(s, city.id, s.factions[s.playerId].lord).ok, false, '군주는 제외');
  const enemyGid = Object.values(s.generals).find((x) => x.faction && x.faction !== s.playerId).id;
  assert.equal(E.canTalk(s, city.id, enemyGid).ok, false);
});

test('대화: 군주 매력·인덕 보정으로 오르는 폭이 커진다', () => {
  const s = newGame(41);
  assert.equal(E.talkLoyaltyGain(s, { cha: 40 }, 4), 4);
  assert.equal(E.talkLoyaltyGain(s, { cha: 80 }, 4), 5);
  assert.equal(E.talkLoyaltyGain(s, { cha: 100 }, 4), 6);
  assert.equal(E.talkLoyaltyGain(s, { cha: 40, skill: 'indeok' }, 4), 6);
  assert.equal(E.talkLoyaltyGain(s, { cha: 100, skill: 'indeok' }, 8), 12);
});

test('대화: 턴이 바뀌면 다른 대사가 나오고 명장은 전용 대사를 쓴다', () => {
  const spec = { ko: '관우', lead: 98, war: 97, int: 75, pol: 64, cha: 92 };
  const a = pickTalkLine('guan_yu', spec, 70, 1);
  const b = pickTalkLine('guan_yu', spec, 70, 2);
  assert.ok(TALK_LINES.guan_yu.includes(a));
  assert.ok(TALK_LINES.guan_yu.includes(b));
  assert.notDeepEqual(a, b, '턴마다 다른 대사');

  const warrior = { ko: '무장', lead: 80, war: 90, int: 40, pol: 40, cha: 50 };
  assert.equal(talkStyleOf(warrior, 70), 'warrior');
  assert.ok(TALK_STYLES.warrior.includes(pickTalkLine('some_id', warrior, 70, 1)));
  assert.equal(talkStyleOf({ ko: '지장', war: 50, int: 92, pol: 80, cha: 70 }, 70), 'strategist');
  assert.equal(talkStyleOf({ ko: '충신', war: 60, int: 60 }, 95), 'loyal');
  assert.equal(talkStyleOf({ ko: '야심', war: 60, int: 60 }, 40), 'ambitious');
  assert.equal(talkStyleOf({ ko: '신무장', custom: true, war: 60, int: 60 }, 70), 'custom');
});

test('대화: 모든 대사가 한글 산문이고 빈 대사가 없다', () => {
  const pools = [...Object.values(TALK_LINES), ...Object.values(TALK_STYLES)];
  const cjk = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  assert.ok(pools.length > 10);
  for (const pool of pools) {
    assert.ok(pool.length >= 2, '유형마다 여러 대사');
    for (const line of pool) {
      assert.ok(line.g.trim().length > 5 && line.l.trim().length > 3);
      assert.equal(cjk.test(line.g + line.l), false, '대사에 한자 없음');
    }
  }
});

/* ---------------- 저장 양식 호환 ---------------- */

test('저장 양식 v5(한자 깃발·대화 이전)도 열리고 새 양식으로 옮겨진다', () => {
  const s = newGame(43);
  const raw = JSON.parse(E.serialize(s));
  raw.version = 5;
  raw.factions.jojo.hanja = 'A'; // 옛 저장의 깃발 글자 자리
  raw.factions.jojo.mark = undefined;
  raw.customGenerals = { cl_lord: { id: 'cl_lord', ko: '한호', hanja: 'B', lead: 70, war: 60, int: 50, pol: 50, cha: 50 } };
  delete raw.talked;
  delete raw.generals[Object.keys(raw.generals)[0]].movedThisTurn;

  const back = E.deserialize(JSON.stringify(raw));
  assert.equal(back.version, E.SAVE_VERSION);
  assert.equal(back.version, 9);
  assert.deepEqual(back.talked, {});
  assert.equal(back.factions.jojo.hanja, undefined);
  assert.equal(back.factions.jojo.mark, '조');
  assert.equal(back.customGenerals.cl_lord.hanja, undefined);
  for (const g of Object.values(back.generals)) assert.equal(typeof g.movedThisTurn, 'boolean');
  assert.equal(E.SAVE_VERSION, 9);
});
