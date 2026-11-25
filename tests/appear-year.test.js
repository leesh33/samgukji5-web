import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERALS, GENERAL_BY_ID, SCENARIOS } from '../js/data.js';
import * as E from '../js/engine.js';

const freeNames = (s, cityId) => E.freeGeneralsInCity(s, cityId).map((g) => GENERAL_BY_ID[g.id].ko);

/* ---------- 데이터 ---------- */
test('등장연도: 모든 장수가 184~300 사이 정수를 갖는다', () => {
  for (const g of GENERALS) {
    assert.ok(Number.isInteger(g.appearYear), `${g.ko} appearYear`);
    assert.ok(g.appearYear >= 184 && g.appearYear <= 300, `${g.ko} appearYear=${g.appearYear}`);
  }
});

test('등장연도: 주요 후기 장수의 역사적 출사 연도', () => {
  const want = {
    sima_yi: 201, zhuge_liang: 207, lu_xun: 203, jiang_wei: 225, cao_pi: 204,
    cao_zhi: 208, deng_ai: 235, zhong_hui: 245, lu_kang: 219, wen_yang: 255,
    sun_jun: 245, wang_jing: 240,
  };
  for (const [id, year] of Object.entries(want)) {
    assert.ok(GENERAL_BY_ID[id], `${id} 존재`);
    assert.equal(GENERAL_BY_ID[id].appearYear, year, `${GENERAL_BY_ID[id].ko} appearYear`);
  }
});

test('등장연도: 시나리오에 처음부터 소속된 장수는 그 시나리오 시작 연도 이하다', () => {
  for (const sc of SCENARIOS) {
    if (sc.ignoreAppearYear) continue;
    for (const f of sc.factions) {
      for (const gid of f.generals) {
        assert.ok(GENERAL_BY_ID[gid].appearYear <= sc.year, `${sc.id} ${GENERAL_BY_ID[gid].ko}: ${GENERAL_BY_ID[gid].appearYear} > ${sc.year}`);
      }
    }
  }
});

/* ---------- 재야 풀 ---------- */
test('194년 진류 등용 목록에 사마의가 없다 — 201년에야 나온다', () => {
  const s = E.createGame('s194', 'jojo', 7);
  const names = freeNames(s, 'chenliu');
  assert.ok(names.length > 0, '진류에 다른 재야 장수는 있다');
  assert.ok(!names.includes('사마의'), '194년 진류 재야에 사마의 없음');
  // 성에 잠복해 있을 뿐, 등용 대상은 아니다
  assert.equal(s.generals.sima_yi.city, 'chenliu');
  assert.equal(s.generals.sima_yi.faction, null);
  assert.equal(E.hasAppeared(s, 'sima_yi'), false);

  s.year = 201;
  assert.ok(freeNames(s, 'chenliu').includes('사마의'), '201년 진류 재야에 사마의');
  assert.equal(E.hasAppeared(s, 'sima_yi'), true);
});

test('재야 풀은 등장연도 전에는 어떤 경로로도 잡히지 않는다(등용·탐색·천거·유랑)', () => {
  const s = E.createGame('s194', 'jojo', 11);
  const hidden = Object.keys(s.generals).filter((id) => !s.generals[id].faction && !E.hasAppeared(s, id));
  assert.ok(hidden.length > 0, '194년에 아직 나오지 않은 장수 존재');
  for (const cid of Object.keys(s.cities)) {
    for (const g of E.freeGeneralsInCity(s, cid)) assert.ok(E.hasAppeared(s, g.id), `${cid} ${g.id}`);
  }
  const cand = E.sageCandidate(s);
  assert.ok(cand && E.hasAppeared(s, cand.id), '천거 후보도 등장 장수');
  const wand = E.wandererCandidate(s);
  assert.ok(wand && E.hasAppeared(s, wand.id), '유랑 무장도 등장 장수');
  // 등용 명령도 대상이 없으면 거부된다
  const city = E.factionCities(s, 'jojo')[0];
  for (const g of E.freeGeneralsInCity(s, city.id)) assert.ok(E.hasAppeared(s, g.id));
});

test('이미 등용된 장수는 해가 지나도 군단에 남는다 — 미등용 재야만 열린다', () => {
  const s = E.createGame('s194', 'jojo', 7);
  s.year = 196;
  const g = s.generals.guo_jia;
  assert.equal(g.faction, null);
  E.placeGeneral(s, 'guo_jia', 'jojo', 'xuchang');
  const before = freeNames(s, 'xuchang').length;
  s.year = 190; // 뒤로 돌려도 군단 장수는 재야 목록에 없다
  assert.ok(!freeNames(s, 'xuchang').includes('곽가'));
  assert.equal(s.generals.guo_jia.faction, 'jojo');
  s.year = 260;
  assert.equal(s.generals.guo_jia.faction, 'jojo');
  assert.ok(before > 0);
});

test('등장연도 정보창: 아직 나오지 않은 재야 장수는 장수 목록에 없다', () => {
  const s = E.createGame('s194', 'jojo', 7);
  const ids = E.infoGenerals(s, 'all').map((r) => r.gid);
  assert.ok(!ids.includes('deng_ai'), '등애(235) 미노출');
  assert.ok(ids.includes('cao_cao'), '조조 노출');
  s.year = 235;
  assert.ok(E.infoGenerals(s, 'all').map((r) => r.gid).includes('deng_ai'), '235년 등애 노출');
});

/* ---------- 새 해 소식 ---------- */
test('새 해 1월: 그 해 출사하는 재야 명장을 한 줄로 알린다', () => {
  const s = E.createGame('s194', 'jojo', 7);
  s.year = 200;
  s.month = 12;
  s.actionPoints = 3;
  E.endTurnPhase2(s);
  assert.equal(s.year, 201);
  const line = s.log.filter((l) => String(l.text).includes('재야 인재가 세상에 나섰습니다')).pop();
  assert.ok(line, '새 해 소식 있음');
  assert.match(line.text, /사마의/);
  assert.match(line.text, /201년/);
});

test('새 해 소식: 영웅집결(등장연도 무시)에서는 울리지 않는다', () => {
  const s = E.createGame('s251', 'jojo', 7);
  s.month = 12;
  s.actionPoints = 3;
  E.endTurnPhase2(s);
  assert.equal(s.ignoreAppearYear, true);
  assert.equal(s.log.filter((l) => String(l.text).includes('재야 인재가 세상에 나섰습니다')).length, 0);
});

/* ---------- 251 영웅집결 ---------- */
test('251 영웅집결: 등장연도 제한 없이 전 시대 장수가 처음부터 보인다', () => {
  const s = E.createGame('s251', 'jojo', 9);
  assert.equal(s.ignoreAppearYear, true);
  const freeIds = Object.keys(s.generals).filter((id) => !s.generals[id].faction && !s.generals[id].dead);
  const shown = freeIds.filter((id) => E.hasAppeared(s, id));
  assert.equal(shown.length, freeIds.length, '재야 전원 노출');
  // 등애·종회처럼 235·245년 장수도 즉시 등용 목록에 있다
  const all = Object.keys(s.cities).flatMap((cid) => E.freeGeneralsInCity(s, cid).map((g) => g.id));
  assert.ok(all.length > 100, `251 재야 ${all.length}명`);
  // 여포·동탁·사마의가 모두 군주로 살아 있다
  const lords = Object.values(s.factions).map((f) => f.lord);
  for (const l of ['lu_bu', 'dong_zhuo', 'sima_yi']) assert.ok(lords.includes(l), `${l} 군주`);
});

test('같은 194년이라도 영웅집결이 아닌 시나리오는 등장연도를 따른다', () => {
  const a = E.createGame('s207', 'jojo', 7);
  assert.equal(E.hasAppeared(a, 'deng_ai'), false);
  const b = E.createGame('s251', 'jojo', 7);
  assert.equal(E.hasAppeared(b, 'deng_ai'), true);
});

/* ---------- 세이브 호환 ---------- */
test('옛 저장(플래그 없음): 등장연도 규칙으로 복원되고 한 달이 정상 진행된다', () => {
  const s = E.createGame('s194', 'jojo', 7);
  const json = JSON.parse(E.serialize(s));
  delete json.ignoreAppearYear;
  const back = E.deserialize(JSON.stringify(json));
  assert.equal(back.ignoreAppearYear, false);
  assert.ok(!E.freeGeneralsInCity(back, 'chenliu').some((g) => g.id === 'sima_yi'));
  back.actionPoints = 3;
  const t = back.turn;
  E.endTurnPhase2(back);
  assert.ok(back.turn > t);
});

test('저장 → 복원: 251의 등장연도 무시 플래그가 유지된다', () => {
  const s = E.createGame('s251', 'liubei', 3);
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.ignoreAppearYear, true);
  assert.equal(E.hasAppeared(back, 'deng_ai'), true);
});
