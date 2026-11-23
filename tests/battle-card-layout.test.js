import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

/* 전장 부대 카드([보병]·[기병] 칩)가 아래 방향·병종 안내 줄과 세로로 겹치지 않아야 한다.
   카드 줄은 #bt-info 안에 담기고, #bt-info·#bt-legend 는 flex 로 줄어들지 않는다 —
   줄어들면 카드 내용이 상자 밖으로 흘러 아래 안내 줄을 덮는다(390x844 큰 글꼴에서 재현). */
test('전장 카드 줄은 전용 상자(.bt-card-row)로 렌더된다', () => {
  const ui = read('../js/ui.js');
  assert.match(ui, /class="bt-card-row"/, '카드 줄 클래스');
  assert.doesNotMatch(ui, /<div style="display:flex;gap:4px;overflow-x:auto;margin-top:4px">/,
    '카드 줄 인라인 레이아웃 제거');
});

test('카드 줄·안내 줄 상자는 줄어들지 않는다(flex: 0 0 auto)', () => {
  const css = read('../css/style.css');
  const rule = (sel) => {
    const m = css.match(new RegExp(sel.replace('.', '\\.') + ' \\{[^}]*\\}'));
    assert.ok(m, sel + ' 규칙');
    return m[0];
  };
  assert.match(rule('.bt-info'), /flex:\s*0 0 auto/, 'bt-info 는 고정 높이');
  assert.match(rule('.bt-legend'), /flex:\s*0 0 auto/, 'bt-legend 는 고정 높이');
  assert.match(rule('.bt-card-row'), /display:\s*flex/, '카드 줄은 가로 배치');
  assert.match(rule('.bt-card-row'), /overflow-x:\s*auto/, '카드가 넘치면 가로 스크롤');
  assert.match(rule('.bt-card-row'), /margin-top:\s*[3-9]px/, '안내 줄과 간격');
  assert.match(rule('.bt-guide'), /flex:\s*0 0 auto/, '진형 안내도 고정 높이');
  assert.match(rule('.bt-log'), /flex:\s*1 1 auto/, '남는 높이는 로그가 차지');
});

test('짧은 화면·큰 글꼴에서도 한 화면에 들어가도록 보정 규칙이 있다', () => {
  const css = read('../css/style.css');
  assert.match(css, /#scr-battle \{[^}]*overflow-y:\s*auto/, '넘치면 전장 화면 자체가 스크롤');
  assert.match(css, /@media \(max-height: 820px\) \{[^}]*\.bt-guide \.bg-cols \{ display: none; \}/,
    '짧은 화면에선 진형 상성표를 접는다');
  assert.match(css, /@media \(max-height: 760px\) \{[\s\S]*?\.bt-log \{ min-height: 40px/, '로그 최소 높이 축소');
});
