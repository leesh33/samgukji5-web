import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_FX_MS, ACTION_FX_SCENES, ACTION_FX_DEFAULT, sceneOf, actionFxPlaying, playActionFx } from '../js/actionfx.js';

/* 행동 연출 — 딱 2.0초, 스킵 없이 자동으로 닫히는 규칙을 지킨다 */

test('연출 길이는 2.0초다 — 사용자 요청(2초)', () => {
  assert.equal(ACTION_FX_MS, 2000);
});

test('주요 행동마다 연출 장면이 있다', () => {
  const need = ['draft', 'train', 'agri', 'comm', 'order', 'water', 'hire', 'reward', 'befriend', 'learn', 'plot', 'promote'];
  for (const kind of need) {
    const sc = ACTION_FX_SCENES[kind];
    assert.ok(sc, `${kind} 장면 없음`);
    assert.ok(sc.ko && typeof sc.ko === 'string', `${kind} 한글 이름`);
    assert.match(sc.tone, /^#[0-9a-f]{6}$/i, `${kind} 색`);
    assert.equal(sceneOf(kind), sc);
  }
  assert.equal(sceneOf('없는행동'), ACTION_FX_DEFAULT);
  assert.equal(ACTION_FX_DEFAULT.ko, '명령');
});

test('브라우저 밖(Node)에서는 연출을 띄우지 않고 바로 끝난다', async () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(actionFxPlaying(), false);
  const p = playActionFx({ kind: 'draft', name: '하후돈', line: '병사를 모았습니다!' });
  assert.ok(p instanceof Promise, 'Promise를 돌려준다');
  await p; // DOM 없이도 바로 끝난다
});
