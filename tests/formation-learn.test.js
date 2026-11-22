import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { FORMATIONS, GENERAL_BY_ID } from '../js/data.js';
import * as B from '../js/battle.js';

/* 진형 전수 — 같은 성의 스승 장수에게 배우고 숙련도를 쌓아 100%에 익힌다 */

function cityOf(s, fid) {
  return E.generalsInCity(s, E.factionCities(s, fid)[0].id)[0];
}

test('전수 후보: 같은 성 스승이 아는 진형만 · 제자가 모르는 것만', () => {
  const s = E.createGame('s194', 'jojo', 42);
  const rows = E.learnableFormations(s, 'chenliu', 'yue_jin');
  const ids = rows.map((r) => r.id);
  assert.ok(ids.includes('hakyik'), ids.join(','));
  assert.ok(!ids.includes('eorin'), '이미 아는 어린은 후보가 아니다');
  const hakyik = rows.find((r) => r.id === 'hakyik');
  assert.ok(hakyik.teachers.some((t) => t.id === 'cao_ren'), '학익 스승에 이전');
  assert.ok(!hakyik.teachers.some((t) => t.id === 'yue_jin'), '제자 자신은 스승이 아니다');
  // 스승이 없는 진형은 후보에 없다
  for (const r of rows) assert.ok(E.formationTeachers(s, 'chenliu', r.id).length > 0, r.ko);
});

test('스승 부재 시 전수 차단 — 같은 성에 그 진형을 아는 아군이 없으면 안 된다', () => {
  const s = E.createGame('s194', 'jojo', 42);
  // 수진(수군 진형)은 조조군 진류 장수 중 아무도 모른다
  const teachers = E.formationTeachers(s, 'chenliu', 'sujin');
  assert.equal(teachers.length, 0);
  const check = E.canLearnFormation(s, 'chenliu', 'yue_jin', 'sujin');
  assert.equal(check.ok, false);
  assert.match(check.why, /스승/);
  const res = E.trainFormation(s, 'chenliu', 'yue_jin', 'sujin');
  assert.equal(res.ok, false);
  assert.equal(s.generals.yue_jin.acted, false, '막힌 전수는 행동을 쓰지 않는다');
});

test('다른 성의 스승은 전수해 줄 수 없다 — 같은 성만', () => {
  const s = E.createGame('s194', 'jojo', 42);
  // 조인은 진류에 있고 학익을 안다
  assert.ok(E.formationTeachers(s, 'chenliu', 'hakyik').some((t) => t.id === 'cao_ren'));
  // 진류 장수를 허창으로 옮겨 진류에는 악진만 남긴다
  for (const g of E.generalsInCity(s, 'chenliu')) if (g.id !== 'yue_jin') g.city = 'xuchang';
  assert.equal(E.generalsInCity(s, 'chenliu').length, 1);
  const none = E.canLearnFormation(s, 'chenliu', 'yue_jin', 'hakyik');
  assert.equal(none.ok, false, '같은 성에 스승이 없으면 차단');
  assert.match(none.why, /스승/);
  assert.ok(E.formationTeachers(s, 'xuchang', 'hakyik').length > 0, '다른 성에는 스승이 있어도 소용없다');
});

test('1회 전수로는 100%에 못 미친다 — 3~4번 쌓아야 익힌다', () => {
  const s = E.createGame('s194', 'jojo', 7);
  const student = 'yue_jin';
  const teacher = 'cao_ren';
  const formId = 'hakyik';
  assert.ok(!E.formationOf(GENERAL_BY_ID[student]).includes(formId));

  const marks = [];
  let trains = 0;
  while (!E.knowsFormation(s, student, formId) && trains < 10) {
    s.generals[student].acted = false;      // 매달 다시 훈련
    s.actionPoints = 6;
    const res = E.trainFormation(s, 'chenliu', student, formId, teacher);
    assert.ok(res.ok, res.msg);
    trains++;
    marks.push(res.after);
    assert.equal(res.gain >= E.FORMATION_TRAIN.min && res.gain <= E.FORMATION_TRAIN.max, true, `상승폭 ${res.gain}`);
    if (trains === 1) {
      assert.ok(res.after < 100, '한 번에 100%가 되면 안 된다');
      assert.equal(res.known, false);
    }
  }
  assert.equal(E.knowsFormation(s, student, formId), true);
  assert.ok(trains >= 3 && trains <= 4, `훈련 횟수 ${trains} (${marks.join(' → ')})`);
  assert.equal(marks[marks.length - 1], 100);
  // 익힌 진형은 주력 진형 목록·전투 사본에 바로 붙는다
  assert.ok(E.formationsOf(s, student).includes(formId));
  assert.ok(E.learnedFormationsOf(s, student).includes(formId));
  assert.ok(E.generalMap(s)[student].formations.includes(formId));
  assert.equal(E.formationMasteryOf(s, student, formId), 100);
  // 군보에 기록
  assert.ok(s.log.some((l) => l.text.includes('학익') && l.text.includes('익혔습니다')), '전수 완료가 군보에 남는다');
});

test('전수는 제자만 행동력 1과 행동 완료를 쓴다 — 스승은 그대로', () => {
  const s = E.createGame('s194', 'jojo', 11);
  const student = 'yue_jin';
  const teacher = 'cao_ren';
  const ap0 = s.actionPoints;
  const res = E.trainFormation(s, 'chenliu', student, 'hakyik', teacher);
  assert.ok(res.ok, res.msg);
  assert.equal(s.actionPoints, ap0 - E.FORMATION_TRAIN.ap);
  assert.equal(s.generals[student].acted, true);
  assert.equal(s.generals[teacher].acted, false, '스승은 행동을 쓰지 않는다');
  // 같은 달에 다시 훈련할 수 없다
  const again = E.canLearnFormation(s, 'chenliu', student, 'hakyik');
  assert.equal(again.ok, false);
  assert.match(again.why, /이번 달/);
});

test('숙련도는 25~36% 범위에서 통솔·지력에 따라 달라진다', () => {
  const s = E.createGame('s194', 'jojo', 3);
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const rng = E.mulberry32(seed);
    const g = E.formationTrainGain(s, 'yue_jin', 'xun_yu', rng);
    assert.ok(g >= 25 && g <= 36, `상승폭 ${g}`);
    seen.add(g);
  }
  assert.ok(seen.size >= 3, '난수에 따라 조금씩 달라진다');
  // 뛰어난 제자·스승이 보통보다 크게 오른다(같은 난수)
  const poor = E.formationTrainGain(s, 'yue_jin', 'yue_jin', E.mulberry32(5));
  const strong = E.formationTrainGain(s, 'cao_cao', 'xun_yu', E.mulberry32(5));
  assert.ok(strong > poor, `${poor} → ${strong}`);
});

test('진행 중 숙련도가 저장·불러오기에 그대로 남는다', () => {
  const s = E.createGame('s194', 'jojo', 5);
  s.actionPoints = 6;
  const first = E.trainFormation(s, 'chenliu', 'yue_jin', 'hakyik');
  assert.ok(first.ok, first.msg);
  const mid = E.formationMasteryOf(s, 'yue_jin', 'hakyik');
  assert.ok(mid > 0 && mid < 100);
  const back = E.deserialize(E.serialize(s));
  assert.equal(E.formationMasteryOf(back, 'yue_jin', 'hakyik'), mid);
  assert.deepEqual(back.learnedFormations, s.learnedFormations);
  // 이어서 훈련하면 이어서 쌓인다
  back.generals.yue_jin.acted = false;
  back.actionPoints = 6;
  const next = E.trainFormation(back, 'chenliu', 'yue_jin', 'hakyik');
  assert.ok(next.ok, next.msg);
  assert.equal(next.before, mid);
});

test('옛 저장(v3~v9) 호환 — 전수 기록이 없어도 열리고 빈 기록으로 채워진다', () => {
  const s = E.createGame('s194', 'jojo', 5);
  const raw = JSON.parse(E.serialize(s));
  for (const v of [3, 5, 7, 8, 9]) {
    const old = { ...raw, version: v };
    delete old.learnedFormations;
    delete old.formationMastery;
    const back = E.deserialize(JSON.stringify(old));
    assert.equal(back.version, E.SAVE_VERSION);
    assert.deepEqual(back.learnedFormations, {});
    assert.deepEqual(back.formationMastery, {});
    // 원래 주력 진형은 그대로다
    assert.deepEqual(E.formationsOf(back, 'yue_jin'), ['eorin']);
  }
  // 깨진 기록은 걷어 내고 범위를 넘는 값은 다듬는다
  const broken = { ...raw, version: 9, learnedFormations: { yue_jin: ['hakyik', '없는진형'] }, formationMastery: { yue_jin: { hakyik: 180, 이상한키: 30 } } };
  const fixed = E.deserialize(JSON.stringify(broken));
  assert.deepEqual(fixed.learnedFormations.yue_jin, ['hakyik']);
  assert.equal(fixed.formationMastery.yue_jin.hakyik, 100);
  assert.equal(fixed.formationMastery.yue_jin['이상한키'], undefined);
});

test('익힌 진형으로 출진 전투를 시작할 수 있다', () => {
  const s = E.createGame('s194', 'jojo', 9);
  // 학익을 익힌 것으로 기록하고 전투 사본을 만든다
  s.learnedFormations.yue_jin = ['hakyik'];
  const b = B.createBattle({
    fromCityId: 'xuchang', toCityId: 'chenliu', attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['yue_jin'], defGenerals: ['yu_jin'], atkTroops: 3000, defTroops: 3000,
    defBonus: 40, seed: 3, playerSide: 'atk', generals: E.generalMap(s),
    formations: { yue_jin: 'hakyik' },
  });
  const u = B.unitsOf(b, 'atk')[0];
  assert.equal(u.formation, 'hakyik', '익힌 진형이 전장에 적용된다');
  assert.equal(FORMATIONS[u.formation].ko, '학익');
});
