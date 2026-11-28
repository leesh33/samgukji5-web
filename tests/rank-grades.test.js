import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as E from '../js/engine.js';

/* 9품관~1품관 제도 — 엔진 값과 화면 표시가 함께 맞는지 */

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const ui = read('../js/ui.js');
const css = read('../css/style.css');
const newGame = (seed = 3) => E.createGame('s194', 'jojo', seed);

test('품관 표시는 품관과 직위를 함께 쓴다 — 9품관만 직위가 없다', () => {
  const s = newGame(51);
  const gid = 'yue_jin';
  s.generals[gid].merit = 5000;
  const seen = [];
  for (let i = 0; i <= E.RANK_MAX; i++) {
    const rk = E.rankInfoOf(s, gid);
    seen.push({ ko: rk.ko, grade: rk.grade, title: rk.title, hasTitle: rk.hasTitle, cap: rk.cap });
    if (i < E.RANK_MAX) assert.ok(E.promoteGeneral(s, gid).ok);
  }
  assert.deepEqual(seen.map((x) => x.ko), [
    '9품관', '8품관 · 비장군', '7품관 · 편장군', '6품관 · 아장군', '5품관 · 중랑장',
    '4품관 · 진북장군', '3품관 · 정북장군', '2품관 · 거기장군', '1품관 · 대장군',
  ]);
  assert.equal(seen[0].title, '');
  assert.equal(seen[0].hasTitle, false, '9품관은 장군 직위가 없다');
  assert.equal(seen[1].title, '비장군', '8품관이 첫 장군 직위');
  assert.equal(seen[1].hasTitle, true);
  assert.equal(seen[seen.length - 1].cap, 25000);
  assert.equal(seen[seen.length - 1].grade, '1품관');
});

test('군주는 품관이 아니라 군주 자리다', () => {
  const s = newGame(52);
  const lord = s.factions[s.playerId].lord;
  const rk = E.rankInfoOf(s, lord);
  assert.equal(rk.ko, '군주');
  assert.equal(rk.grade, '');
  assert.equal(rk.hasTitle, true);
  assert.equal(rk.cap, 25000);
});

test('장수 상세 카드는 품관 줄과 9품관 안내를 그린다', () => {
  assert.match(ui, /<span>품관<\/span><b>\$\{rk\.ko\}/);
  assert.match(ui, /gd-notitle">장군 직위 없음/);
  assert.match(ui, /9품관은 장군 직위가 없습니다/);
  assert.match(ui, /8품관 · 비장군<\/b>으로 임명되면 첫 장군 직위/);
});

test('인사 → 품관 임명 화면이 9품관~1품관 흐름을 안내한다', () => {
  assert.match(ui, /openSheet\('품관 임명'/);
  assert.match(ui, /9품관<\/b>으로 시작해/);
  assert.match(ui, /8품관 · 비장군<\/b>부터 <b>1품관 · 대장군<\/b>까지/);
  assert.match(ui, /8품관 비장군이 첫 장군 직위/);
  assert.match(ui, /1품관 · 대장군 — 더 오를 품관이 없습니다/);
  assert.match(ui, /\['promote', '품관 임명'\]/);
});

test('승진 연출·전투 화면도 품관 이름을 쓴다', () => {
  assert.match(ui, /line: `\$\{E\.withJosa\(res\.to, '로'\)\} 임명되었습니다!/);
  assert.match(ui, /class="bu-rank">품관 <b>\$\{rk\.ko\}<\/b>/);
  assert.match(ui, /class="mc-rank[^"]*">\$\{rk\.ko\}<\/i>/);
  assert.match(css, /\.gd-row b \.gd-notitle/);
  assert.match(css, /\.bu-rank b/);
});

test('옛 7단계 저장은 품관 9단계로 옮겨도 지휘 상한이 줄지 않는다', () => {
  const s = newGame(53);
  const lord = s.factions[s.playerId].lord;
  const gids = Object.keys(s.generals).filter((gid) => gid !== lord).slice(0, 7);
  const pairs = [[0, 7500], [1, 10000], [2, 12500], [3, 16000], [4, 20000], [5, 22500], [6, 25000]];
  pairs.forEach(([oldIdx], i) => {
    s.generals[gids[i]].rank = oldIdx;
    s.generals[gids[i]].merit = 5000;
  });
  const raw = JSON.parse(E.serialize(s));
  raw.version = 13;
  delete raw.rankSchema;
  const back = E.deserialize(JSON.stringify(raw));
  pairs.forEach(([, cap], i) => {
    assert.equal(E.maxTroopsOf(back, gids[i]), cap, `${gids[i]} 옛 지휘 ${cap}`);
  });
});
