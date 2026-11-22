import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_COLORS } from '../js/data.js';
import * as E from '../js/engine.js';

const KEYS = ['lead', 'war', 'int', 'pol', 'cha'];
const sumOf = (st) => KEYS.reduce((n, k) => n + st[k], 0);

/* 첫 난수만 전설 구간(<0.01)으로 고정하고 나머지는 진짜 난수를 쓰는 주사위 */
function legendRand(first = 0.005) {
  let n = 0;
  return () => (n++ === 0 ? first : Math.random());
}

test('전설 주사위: 1% 확률로 450~480 총합이 나온다', () => {
  assert.equal(E.CUSTOM_STAT_LEGEND_CHANCE, 0.01);
  assert.equal(E.CUSTOM_STAT_LEGEND_TOTAL_MIN, 450);
  assert.equal(E.CUSTOM_STAT_LEGEND_TOTAL_MAX, 480);
  const N = 20000;
  let legend = 0;
  for (let i = 0; i < N; i++) {
    const dice = E.rollCustomDice();
    if (dice.legend) {
      legend++;
      assert.ok(dice.total >= 450 && dice.total <= 480, `전설 총합 ${dice.total}`);
      assert.equal(sumOf(dice.stats), dice.total, '총합과 배분 합이 같다');
      for (const k of KEYS) {
        assert.ok(dice.stats[k] >= 60 && dice.stats[k] <= 100, `전설 ${k}=${dice.stats[k]}`);
      }
    } else {
      assert.ok(dice.total >= E.CUSTOM_STAT_DICE_MIN && dice.total <= E.CUSTOM_STAT_BUDGET, `일반 총합 ${dice.total}`);
      assert.equal(sumOf(dice.stats), dice.total, '총합과 배분 합이 같다');
      for (const k of KEYS) {
        assert.ok(dice.stats[k] >= E.CUSTOM_STAT_MIN && dice.stats[k] <= E.CUSTOM_STAT_MAX, `일반 ${k}=${dice.stats[k]}`);
      }
    }
  }
  // 1% 언저리(표본 오차 안) — 20000번이면 120~300번
  assert.ok(legend >= 120 && legend <= 300, `전설 ${legend}회 / ${N}`);
});

test('전설 주사위: 경계값 — 450(최소)과 480(만점)', () => {
  const low = E.rollCustomDice(() => 0);
  assert.equal(low.legend, true);
  assert.equal(low.total, 450);
  assert.equal(sumOf(low.stats), 450);
  // 0.005(전설) 뒤 모든 난수가 0.9999면 총합 480, 항목마다 96
  const seq = (first) => { let n = 0; return () => (n++ === 0 ? first : 0.999999); };
  const high = E.rollCustomDice(seq(0.005));
  assert.equal(high.legend, true);
  assert.equal(high.total, 480);
  assert.equal(sumOf(high.stats), 480);
  for (const k of KEYS) assert.equal(high.stats[k], 96, `${k}`);
  // 전설 경계는 0.01 미만 — 0.01은 이미 일반
  assert.equal(E.rollCustomDice(seq(0.01)).legend, false);
  assert.equal(E.rollCustomDice(seq(0.009999)).legend, true);
  // 총합 뽑기도 전설/일반을 가른다
  assert.equal(E.rollCustomTotal(() => 0), 450);
  assert.equal(E.rollCustomTotal(seq(0.005)), 480);
});

test('전설 주사위: 여러 번 굴러도 항목이 100을 넘지 않고 60 아래로 안 떨어진다', () => {
  for (let i = 0; i < 400; i++) {
    const dice = E.rollCustomDice(legendRand(0.0001 + Math.random() * 0.0098));
    assert.equal(dice.legend, true);
    assert.ok(dice.total >= 450 && dice.total <= 480, `총합 ${dice.total}`);
    assert.equal(sumOf(dice.stats), dice.total);
    for (const k of KEYS) assert.ok(dice.stats[k] >= 60 && dice.stats[k] <= 100, `${k}=${dice.stats[k]}`);
    // 전설은 항상 평균 90 이상 — 대박의 손맛
    assert.ok(dice.total / 5 >= 90);
  }
});

test('전설 예산: 수동 ＋/－가 뽑힌 총합을 유지한 채 재배분된다', () => {
  const st = { lead: 90, war: 90, int: 90, pol: 90, cha: 90 }; // 450
  const budget = E.customStatBudget(450);
  const cap = E.customStatCap(budget);
  assert.equal(budget, 450);
  assert.equal(cap, 100);
  // 예산을 다 쓴 상태에서는 더 못 올린다
  const blocked = E.adjustCustomStat(st, 'lead', 1, budget, cap);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'budget');
  // 한 항목을 줄이면 그만큼 다른 항목에 넣을 수 있다(100까지)
  const lowered = E.adjustCustomStat(st, 'lead', -10, budget, cap);
  assert.ok(lowered.ok);
  assert.equal(sumOf(lowered.stats), 440);
  let cur = lowered.stats;
  for (let i = 0; i < 10; i++) {
    const r = E.adjustCustomStat(cur, 'war', 1, budget, cap);
    assert.ok(r.ok, r.reason);
    cur = r.stats;
  }
  assert.equal(cur.war, 100);
  assert.equal(sumOf(cur), 450);
  assert.equal(E.adjustCustomStat(cur, 'war', 1, budget, cap).reason, 'limit');
  // 만점 예산(480)도 그대로 쓸 수 있다
  const maxBudget = E.customStatBudget(480);
  assert.equal(maxBudget, 480);
  assert.equal(E.customStatCap(maxBudget), 100);
  // 일반 굴림은 예전처럼 255 예산·96 상한
  assert.equal(E.customStatBudget(0), 255);
  assert.equal(E.customStatBudget(210), 255);
  assert.equal(E.customStatCap(255), 96);
  assert.equal(E.adjustCustomStat({ lead: 96, war: 40, int: 40, pol: 40, cha: 39 }, 'lead', 1, 255, 96).ok, false);
});

test('전설 군주: 만점 능력치가 게임 상태·저장 파일까지 그대로 간다', () => {
  const stats = { lead: 100, war: 98, int: 96, pol: 94, cha: 92 }; // 480
  const custom = E.buildCustomLord({
    name: '천하', mark: '천', color: CUSTOM_COLORS[2].hex,
    cityId: E.customStartCities('s194')[0].cityId,
    stats, skill: 'tongsol', arms: '기병', retinue: 0,
    style: { hat: 1, beard: 1, skin: 1 },
  });
  const s = E.createGame('s194', custom.faction.id, 626, { custom });
  const lord = E.generalOf(s, 'cl_lord');
  assert.deepEqual({ lead: lord.lead, war: lord.war, int: lord.int, pol: lord.pol, cha: lord.cha }, stats);
  const back = E.deserialize(E.serialize(s));
  const lord2 = E.generalOf(back, 'cl_lord');
  assert.equal(lord2.lead, 100);
  assert.equal(lord2.cha, 92);
  assert.equal(sumOf(lord2), 480);
});

test('전설 주사위만 1% — 굴림 대부분은 예전 일반 분포를 지킨다', () => {
  let legend = 0;
  const sums = [];
  for (let i = 0; i < 2000; i++) {
    const dice = E.rollCustomDice();
    if (dice.legend) legend++;
    else sums.push(dice.total);
  }
  assert.equal(legend + sums.length, 2000);
  assert.ok(legend <= 40, `전설 ${legend}회`);
  const avg = sums.reduce((a, b) => a + b, 0) / sums.length;
  assert.ok(avg > 200 && avg < 250, `일반 평균 ${avg.toFixed(1)}`);
  assert.ok(Math.max(...sums) === 255, '만점 255는 여전히 나온다');
});
