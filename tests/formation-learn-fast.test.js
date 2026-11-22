import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

/* 뛰어난 제자·스승은 3번, 보통은 4번에 익힌다 — 25~36% 누적의 실제 결과 */
test('뛰어난 제자·스승은 3번 훈련으로 익히고, 크게 4번을 넘지 않는다', () => {
  const turns = [];
  for (let seed = 1; seed <= 12; seed++) {
    const s = E.createGame('s194', 'jojo', seed);
    let n = 0;
    while (!E.knowsFormation(s, 'xun_yu', 'eonwol') && n < 10) {
      s.generals.xun_yu.acted = false;
      s.actionPoints = 6;
      const res = E.trainFormation(s, 'xuchang', 'xun_yu', 'eonwol', 'cao_cao');
      assert.ok(res.ok, res.msg);
      n++;
    }
    turns.push(n);
  }
  assert.ok(turns.includes(3), `3번 케이스 없음: ${turns.join(',')}`);
  assert.ok(Math.max(...turns) <= 4, `4번 초과: ${turns.join(',')}`);
});
