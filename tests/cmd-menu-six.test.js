/* 하단 성 시트 명령 줄 — 내정·인사·군사·외교·계략·특수 6×1 한 줄 배치
 *
 * 특수는 원래 지도 위 상단 바에 있었으나 성 시트 하단 명령 줄로 내려왔다.
 * 이 테스트는 상단 바에 특수가 남아 있지 않은지, 하단 명령 줄이 6칸 그리드이며
 * 특수 버튼이 마지막 칸에 붙는지, 특수 시트·도움말 안내가 실제 위치를 가리키는지 지킨다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const html = read('../index.html');
const ui = read('../js/ui.js');
const css = read('../css/style.css');

test('상단 지도 바에는 권역·내 성·정보 3개만 남고 특수는 없다', () => {
  const bar = html.match(/<div class="mapbar">[\s\S]*?<\/div>/);
  assert.ok(bar, '상단 지도 바');
  const labels = [...bar[0].matchAll(/class="mapbtn"[^>]*>([^<]*)/g)].map((m) => m[1].trim());
  assert.deepEqual(labels, ['권역', '내 성', '정보'], '상단 바 버튼 3개');
  assert.doesNotMatch(bar[0], /special-menu/, '상단 바에서 특수 제거');
});

test('하단 명령 줄은 6칸 그리드이고 특수가 마지막 칸에 붙는다', () => {
  const bar = ui.match(/cmdHTML = `<div class="cp-cmds">[\s\S]*?<\/div>`/);
  assert.ok(bar, '하단 명령 바 코드');
  const order = ['${tabs}', '${diploTab}', '>계략', '${specialTab}'];
  let at = -1;
  for (const token of order) {
    const i = bar[0].indexOf(token);
    assert.ok(i > at, `${token} 순서`);
    at = i;
  }
  assert.match(bar[0], /<\/button>\$\{specialTab\}<\/div>/, '특수가 마지막 칸');
  const sp = ui.match(/const specialTab = `[^`]*`/);
  assert.ok(sp, 'specialTab 정의');
  assert.match(sp[0], /data-act="special-menu"/);
  assert.match(sp[0], /data-city="\$\{selectedCity\}"/, '특수는 고른 성으로 열린다');
  assert.match(sp[0], />특수<small>[^<]*<\/small>/, '특수 부제목');
  assert.match(css, /\.cp-cmds \{[^}]*repeat\(6, 1fr\)/, '6×1 그리드');
  assert.match(css, /\.cp-cmds\.foe \{[^}]*repeat\(2, 1fr\)/, '적 성은 공격·계략 2칸');
});

test('1차 묶음 순서는 내정·인사·군사다', () => {
  const groups = ui.match(/const CITY_CMD_GROUPS = \[[\s\S]*?\n\];/);
  assert.ok(groups, 'CITY_CMD_GROUPS');
  const ids = [...groups[0].matchAll(/id: '(\w+)', ko: '([^']+)'/g)].map((m) => m[2]);
  assert.deepEqual(ids, ['내정', '인사', '군사']);
});

test('특수 버튼은 누른 성을 그대로 특수 시트로 넘긴다', () => {
  assert.match(ui, /case 'special-menu': openSpecialSheet\(el\.dataset\.city \|\| null\); break;/);
  const fn = ui.match(/function openSpecialSheet\(cityId = null\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'openSpecialSheet');
  assert.match(fn[0], /owner === game\.playerId \? selectedCity : mine\[0\]\.id/, '내 성이면 그 성, 아니면 첫 성');
  assert.match(fn[0], /renderSpecialSheet\(\)/, '특수 시트 렌더');
});

test('도움말 17번 특수 안내가 성 시트 하단을 가리킨다', () => {
  assert.match(ui, /17\. 특수<\/b> — 성 시트 하단 명령 줄의 특수에서/);
  assert.doesNotMatch(ui, /17\. 특수<\/b> — 지도 위 특수/, '옛 위치 문구 제거');
});
