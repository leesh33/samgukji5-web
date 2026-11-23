import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, CITY_BY_ID, CITY_SIZES, CITY_SIZE_MAX, CITY_SIZE_SEED, ORDER_CAP, sizeCap, statCap, sizeDraftMul, sizeIncomeMul, sizeTroopCap } from '../js/data.js';
import * as E from '../js/engine.js';

const newGame = (seed = 11) => E.createGame('s194', 'jojo', seed);
const firstCity = (s) => E.factionCities(s, s.playerId)[0];
const anOfficer = (s, cityId) => E.generalsInCity(s, cityId).find((g) => !g.acted);

/* ---------- 데이터 ---------- */
test('42성 모두 소형·중형·대형·특대형 규모를 가진다', () => {
  assert.equal(CITIES.length, 42);
  for (const c of CITIES) {
    assert.ok(Number.isInteger(c.size), `${c.ko} 규모`);
    assert.ok(c.size >= 0 && c.size <= CITY_SIZE_MAX, `${c.ko} 규모 범위`);
  }
  const count = [0, 0, 0, 0];
  for (const c of CITIES) count[c.size]++;
  assert.equal(count[0], 23, '소 23성');
  assert.equal(count[1], 14, '중 14성');
  assert.equal(count[2], 5, '대 5성');
  assert.equal(count[3], 0, '특대형은 처음엔 없다');
});

test('역사적 거대 도시는 대형, 변방 소도시는 소형', () => {
  for (const id of ['luoyang', 'changan', 'ye', 'chengdu', 'jianye']) assert.equal(CITY_BY_ID[id].size, 2, id);
  for (const id of ['xuchang', 'shouchun', 'jiangling', 'xiangyang']) assert.equal(CITY_BY_ID[id].size, 1, id);
  for (const id of ['xiaopei', 'xinye', 'guiyang', 'beiping']) assert.equal(CITY_BY_ID[id].size, 0, id);
});

test('규모별 상한·징병·세입·주둔 상한 수치', () => {
  assert.deepEqual(CITY_SIZES.map((s) => s.ko), ['소형', '중형', '대형', '특대형']);
  assert.deepEqual(CITY_SIZES.map((s) => s.cap), [100, 130, 160, 200]);
  assert.deepEqual(CITY_SIZES.map((s) => s.draft), [1.0, 1.25, 1.5, 1.8]);
  assert.deepEqual(CITY_SIZES.map((s) => s.income), [1.0, 1.08, 1.16, 1.25]);
  assert.deepEqual(CITY_SIZES.map((s) => s.troopCap), [14000, 18000, 24000, 30000]);
  for (const [i, s] of CITY_SIZES.entries()) {
    assert.equal(sizeCap(i), s.cap);
    assert.equal(sizeDraftMul(i), s.draft);
    assert.equal(sizeIncomeMul(i), s.income);
    assert.equal(sizeTroopCap(i), s.troopCap);
  }
  // 범위를 벗어난 값도 안전하게 다뤄진다
  assert.equal(sizeCap(-3), 100);
  assert.equal(sizeCap(9), 200);
});

test('치안 상한은 성 규모와 무관하게 항상 100 — 농업·상업·수리만 규모 상한을 따른다', () => {
  assert.equal(ORDER_CAP, 100);
  for (let i = 0; i <= CITY_SIZE_MAX; i++) {
    assert.equal(statCap(i, 'order'), 100, `규모 ${CITY_SIZES[i].ko} 치안 상한`);
    assert.equal(statCap(i, 'agri'), CITY_SIZES[i].cap);
    assert.equal(statCap(i, 'comm'), CITY_SIZES[i].cap);
    assert.equal(statCap(i, 'water'), CITY_SIZES[i].cap);
  }
  assert.equal(statCap(9, 'order'), 100, '범위를 벗어난 규모도 치안은 100');
});

test('게임 상태의 성마다 규모가 들어간다', () => {
  const s = newGame();
  assert.equal(s.cities.xuchang.size, 1);
  assert.equal(s.cities.luoyang.size, 2);
  assert.equal(s.cities.xiaopei.size, 0);
  assert.equal(E.citySizeKoOf(s, 'xuchang'), '중형');
  assert.equal(E.cityStatCap(s, 'xuchang'), 130);
  assert.equal(E.cityStatCap(s, 'xiaopei'), 100);
  // 수치를 지정하면 그 수치의 상한 — 치안은 성 규모와 상관없이 100
  assert.equal(E.cityStatCap(s, 'xuchang', 'agri'), 130);
  assert.equal(E.cityStatCap(s, 'xuchang', 'order'), 100);
  assert.equal(E.cityStatCap(s, 'luoyang', 'water'), 160);
  assert.equal(E.cityStatCap(s, 'luoyang', 'order'), 100);
});

/* ---------- 승격 ---------- */
test('소형 성의 내정 네 수치를 모두 채우면 중형으로 승격한다 — 수치는 유지, 상한만 확장', () => {
  const s = newGame(21);
  const c = firstCity(s);
  c.size = 0;
  c.agri = 99; c.comm = 100; c.order = 100; c.water = 100;
  s.actionPoints = 4;
  const g = anOfficer(s, c.id);
  const r = E.runCommand(s, 'agri', { cityId: c.id, officerId: g.id });
  assert.ok(r.ok, r.msg);
  assert.equal(c.size, 1, '중형으로 승격');
  assert.equal(c.agri, 100, '채운 수치는 그대로');
  assert.equal(E.cityStatCap(s, c.id), 130, '상한이 130으로 넓어짐');
  assert.ok(r.sizeUp, '결과에 승격 정보');
  assert.equal(r.sizeUp.fromKo, '소형');
  assert.equal(r.sizeUp.toKo, '중형');
  assert.match(r.fx.line, /승격/);
  const log = s.log[s.log.length - 1].text;
  assert.match(log, /규모 승격/);
  assert.match(log, /상한 100 → 130/);
  // 남은 내정 합계도 새 상한 기준으로 다시 계산된다 — 치안은 100에서 멈추므로 농업·상업·수리 30씩만 남는다
  assert.equal(E.citySizeUpRemain(s, c.id), 30 * 3);
});

test('승격 뒤 상한까지 다시 채우면 소형 → 중형 → 대형 → 특대형으로 이어 오른다', () => {
  const s = newGame(22);
  const c = firstCity(s);
  c.size = 0;
  for (let step = 0; step < 3; step++) {
    const cap = sizeCap(c.size);
    c.agri = cap; c.comm = cap; c.order = ORDER_CAP; c.water = cap;
    const up = E.checkCitySizeUp(s, c.id);
    assert.ok(up, `${step}단계 승격`);
    assert.equal(c.size, step + 1);
    assert.equal(c.order, ORDER_CAP, '치안은 승격해도 100 그대로');
  }
  assert.equal(c.size, 3);
  assert.equal(E.cityStatCap(s, c.id), 200);
  assert.equal(E.cityStatCap(s, c.id, 'order'), 100);
  assert.equal(E.checkCitySizeUp(s, c.id), null, '특대형은 더 오르지 않는다');
});

test('중형 성이라도 치안은 100에서 더 오르지 않고 명령을 받지 않는다', () => {
  const s = newGame(27);
  const c = s.cities.xuchang;   // 규모 중형(상한 130)
  assert.equal(c.size, 1);
  s.actionPoints = 4;
  c.order = 100;
  const g = anOfficer(s, 'xuchang');
  const blocked = E.runCommand(s, 'order', { cityId: 'xuchang', officerId: g.id });
  assert.equal(blocked.ok, false);
  assert.match(blocked.msg, /치안이 이미 최대/);
  assert.match(blocked.msg, /100/);
  // 100에 못 미치면 100까지만 오르고, 올린 만큼만 알린다
  c.order = 98;
  c.comm = 130; c.agri = 130; c.water = 130;
  const g2 = E.generalsInCity(s, 'xuchang').find((x) => !x.acted);
  const r = E.runCommand(s, 'order', { cityId: 'xuchang', officerId: g2.id });
  assert.ok(r.ok, r.msg);
  assert.equal(c.order, 100, '치안 상한 100에서 멈춘다');
  assert.equal(r.gain, 2, '실제 오른 만큼만 보고');
  assert.match(r.msg, /치안을 2 올렸습니다/);
});

test('순찰·구휼도 치안 100에서 멈추고 최대라고 알린다', () => {
  const s = newGame(28);
  const c = firstCity(s);
  c.size = 2;   // 규모 대형
  c.order = 100;
  s.actionPoints = 6;
  c.gold = 5000; c.food = 9000;
  const chk = E.specialCheck(s, 'patrol', c.id);
  assert.equal(chk.ok, false);
  assert.match(chk.why, /100/);
  const chk2 = E.specialCheck(s, 'relief', c.id);
  assert.equal(chk2.ok, false);
  // 99에서 순찰하면 100을 넘지 않는다
  c.order = 99;
  const r = E.runSpecial(s, 'patrol', c.id);
  assert.ok(r.ok, r.msg);
  assert.equal(c.order, 100);
});

test('규모 대형·특대형 성의 치안이 옛 저장에 100을 넘어 있으면 100으로 다듬는다', () => {
  const s = newGame(29);
  const raw = JSON.parse(E.serialize(s));
  raw.cities.luoyang.size = 3;
  raw.cities.luoyang.order = 180;
  raw.cities.luoyang.agri = 180;
  const back = E.deserialize(JSON.stringify(raw));
  assert.equal(back.cities.luoyang.order, 100, '치안은 100으로');
  assert.equal(back.cities.luoyang.agri, 180, '농업은 규모 상한까지 그대로');
  assert.equal(E.cityStatCap(back, 'luoyang', 'order'), 100);
});


test('내정 상한에 닿으면 명령을 받지 않고, 상한을 알려 준다', () => {
  const s = newGame(23);
  const c = firstCity(s);
  c.size = 1;
  c.agri = 130;
  s.actionPoints = 4;
  const g = anOfficer(s, c.id);
  const r = E.runCommand(s, 'agri', { cityId: c.id, officerId: g.id });
  assert.equal(r.ok, false);
  assert.match(r.msg, /최대/);
  assert.match(r.msg, /130/);
});

test('승격 조건을 못 채우면(하나만 모자라면) 오르지 않는다', () => {
  const s = newGame(24);
  const c = firstCity(s);
  c.size = 0;
  c.agri = 100; c.comm = 100; c.order = 99; c.water = 100;
  assert.equal(E.citySizeUpReady(s, c.id), false);
  assert.equal(E.checkCitySizeUp(s, c.id), null);
  assert.equal(c.size, 0);
  // 치안만 100이고 농업이 모자라도 오르지 않는다
  c.order = 100; c.agri = 99;
  assert.equal(E.citySizeUpReady(s, c.id), false);
});

test('위임한 성이 스스로 내정을 채워도 규모가 오른다', () => {
  const s = newGame(25);
  const c = firstCity(s);
  c.size = 0;
  c.agri = 100; c.comm = 100; c.order = 100; c.water = 99;
  s.delegation[c.id] = 'domestic';
  const before = s.log.length;
  E.runDelegations(s, () => 0.5);
  assert.equal(c.size, 1, '위임 내정으로 승격');
  assert.ok(s.log.slice(before).some((l) => /규모 승격/.test(l.text)));
});

test('턴이 바뀌면 다른 경로로 채워진 성도 한 번에 살핀다', () => {
  const s = newGame(26);
  const c = firstCity(s);
  c.size = 0;
  c.agri = 100; c.comm = 100; c.order = 100; c.water = 100;
  E.endTurnPhase2(s);
  assert.equal(c.size, 1);
});

/* ---------- 징병·세입 ---------- */
test('규모가 크면 같은 장수로 징병해도 병사가 훨씬 많이 모인다', () => {
  const pickCity = 'xuchang';
  const runDraft = (size) => {
    const s = newGame(31);
    const c = s.cities[pickCity];
    c.size = size;
    c.troops = 3000;
    c.gold = 5000; c.food = 9000;
    s.actionPoints = 4;
    const g = anOfficer(s, pickCity);
    const before = c.troops;
    const r = E.runCommand(s, 'draft', { cityId: pickCity, officerId: g.id });
    assert.ok(r.ok, r.msg);
    return c.troops - before;
  };
  const small = runDraft(0), mid = runDraft(1), big = runDraft(2), huge = runDraft(3);
  assert.ok(small > 0);
  assert.equal(mid, Math.round(small * 1.25));
  assert.equal(big, Math.round(small * 1.5));
  assert.equal(huge, Math.round(small * 1.8));
});

test('징병은 성의 주둔 병력 상한을 넘지 않는다', () => {
  const s = newGame(32);
  const c = s.cities.xuchang;
  c.size = 0; // 상한 14,000
  c.troops = 13900;
  c.gold = 5000; c.food = 9000;
  s.actionPoints = 4;
  const g = anOfficer(s, 'xuchang');
  const r = E.runCommand(s, 'draft', { cityId: 'xuchang', officerId: g.id });
  assert.ok(r.ok, r.msg);
  assert.equal(c.troops, 14000, '상한에서 멈춘다');
  const g2 = E.generalsInCity(s, 'xuchang').find((x) => !x.acted);
  if (g2) {
    s.actionPoints = 4;
    const r2 = E.runCommand(s, 'draft', { cityId: 'xuchang', officerId: g2.id });
    assert.equal(r2.ok, false);
    assert.match(r2.msg, /상한/);
  }
});

test('규모가 크면 같은 수치라도 금·식량 세입이 많다', () => {
  assert.equal(E.sizeIncomeOf(newGame(33), 'xiaopei'), 1.0);
  const s = newGame(33);
  assert.equal(E.sizeIncomeOf(s, 'luoyang'), 1.16);
  assert.equal(E.sizeDraftOf(s, 'luoyang'), 1.5);
  assert.equal(E.cityTroopsCap(s, 'luoyang'), 24000);
  // 같은 성·같은 수치로 규모만 바꿔 월 수입을 비교한다
  const income = (size) => {
    const st = newGame(34);
    const c = st.cities.guiyang;
    c.size = size;
    c.owner = st.playerId;
    c.agri = 60; c.comm = 60; c.order = 60; c.water = 60;
    c.gold = 0; c.food = 100000; c.troops = 1000;
    E.endTurnPhase2(st);
    return c.gold;
  };
  assert.ok(income(3) > income(1));
  assert.ok(income(1) > income(0));
});

/* ---------- 저장 호환 ---------- */
test('v10 저장(규모 이전)은 도시별 기본 규모를 채워 열린다', () => {
  const s = newGame(35);
  const raw = JSON.parse(E.serialize(s));
  raw.version = 10;
  for (const c of Object.values(raw.cities)) delete c.size;
  const back = E.deserialize(JSON.stringify(raw));
  assert.equal(back.version, E.SAVE_VERSION);
  assert.equal(back.version, 12);
  assert.equal(back.cities.xuchang.size, 1);
  assert.equal(back.cities.luoyang.size, 2);
  assert.equal(back.cities.xiaopei.size, 0);
  assert.equal(back.cities.xuchang.agri, s.cities.xuchang.agri, '수치는 그대로');
});

test('저장·불러오기에서 승격한 규모와 수치가 그대로 남는다', () => {
  const s = newGame(36);
  const c = firstCity(s);
  c.size = 2;
  c.agri = 155; c.comm = 150; c.order = 140; c.water = 132;
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.cities[c.id].size, 2);
  assert.equal(back.cities[c.id].agri, 155);
  assert.equal(E.cityStatCap(back, c.id), 160);
});

test('규모 이름과 승격 문구에 한자가 없다', () => {
  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  for (const s of CITY_SIZES) assert.equal(CJK.test(s.ko), false);
  const s = newGame(37);
  const c = firstCity(s);
  c.size = 0;
  c.agri = 100; c.comm = 100; c.order = 100; c.water = 100;
  const up = E.checkCitySizeUp(s, c.id);
  assert.equal(CJK.test(JSON.stringify(up)), false);
  assert.equal(CJK.test(E.serialize(s)), false);
});
