import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ACTION_FX_MS, ACTION_FX_SCENES, ACTION_FX_DEFAULT, ACTION_FX_BG,
  sceneOf, actionFxPlaying, playActionFx, preloadActionFxBackgrounds, actionFxBackgroundReady,
} from '../js/actionfx.js';

/* 행동 연출 — 딱 2.0초, 스킵 없이 자동으로 닫히는 규칙과 HD-2D 배경을 지킨다 */

const KINDS = ['draft', 'train', 'agri', 'comm', 'order', 'water', 'hire', 'reward', 'befriend', 'learn', 'plot', 'promote'];
const root = new URL('..', import.meta.url);
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, root)), 'utf8');

test('연출 길이는 2.0초다 — 사용자 요청(2초)', () => {
  assert.equal(ACTION_FX_MS, 2000);
});

test('주요 행동마다 연출 장면이 있다', () => {
  for (const kind of KINDS) {
    const sc = ACTION_FX_SCENES[kind];
    assert.ok(sc, `${kind} 장면 없음`);
    assert.ok(sc.ko && typeof sc.ko === 'string', `${kind} 한글 이름`);
    assert.match(sc.tone, /^#[0-9a-f]{6}$/i, `${kind} 색`);
    assert.equal(sceneOf(kind), sc);
  }
  assert.equal(sceneOf('없는행동'), ACTION_FX_DEFAULT);
  assert.equal(ACTION_FX_DEFAULT.ko, '명령');
});

test('12종 행동마다 HD-2D 디오라마 webp 배경이 있다', () => {
  assert.deepEqual(Object.keys(ACTION_FX_BG).sort(), [...KINDS].sort());
  for (const kind of KINDS) {
    const rel = ACTION_FX_BG[kind];
    assert.equal(rel, `assets/actionfx/${kind}.webp`);
    const path = fileURLToPath(new URL(rel, root));
    const st = statSync(path);
    // 모바일에서 바로 뜨도록 한 장은 수십 KB — 넉넉히 110KB 아래로 둔다
    assert.ok(st.size > 8 * 1024, `${kind} 배경이 너무 작다 (${st.size}B)`);
    assert.ok(st.size < 110 * 1024, `${kind} 배경이 너무 크다 (${Math.round(st.size / 1024)}KB)`);
    const head = readFileSync(path).subarray(0, 16).toString('latin1');
    assert.equal(head.slice(0, 4), 'RIFF', `${kind} RIFF 아님`);
    assert.equal(head.slice(8, 12), 'WEBP', `${kind} WebP 아님`);
  }
});

test('배경 그림 경로는 index.html 기준 assets/actionfx 이다', () => {
  const html = read('index.html');
  assert.match(html, /<script type="module" src="js\/main.js">/);
  assert.ok(read('js/actionfx.js').includes("assets/actionfx/"));
});

test('미리 받기 — 브라우저 밖에서는 조용히 넘어간다', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(preloadActionFxBackgrounds(['draft']), 1);
  assert.equal(actionFxBackgroundReady('draft'), false);
});

test('브라우저 밖(Node)에서는 연출을 띄우지 않고 바로 끝난다', async () => {
  assert.equal(actionFxPlaying(), false);
  const p = playActionFx({ kind: 'draft', name: '하후돈', line: '병사를 모았습니다!' });
  assert.ok(p instanceof Promise, 'Promise를 돌려준다');
  await p; // DOM 없이도 바로 끝난다
});
