import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { duelAdvice, DUEL_CLOSE_GAP, siegeOddsNote, SIEGE_EVEN } from '../js/engine.js';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

/* 2026-11-26 390×844 UX 점검에서 나온 문제들 — 다시 생기지 않게 고정한다. */

/* ---------- S8. 일기토 도발 '무력이 비슷합니다' ---------- */
test('일기토 조언: 14 차이는 비슷함이 아니라 밀림으로 본다(조인 86 vs 여포 100)', () => {
  const a = duelAdvice(86 - 100);
  assert.equal(a.tone, 'weak');
  assert.match(a.text, /밀립니다/);
  assert.match(a.text, /무력 -14/);
  assert.doesNotMatch(a.text, /비슷합니다/);
});

test('일기토 조언: ±8 경계 — 8은 앞섬/밀림, 7은 비슷함', () => {
  assert.equal(DUEL_CLOSE_GAP, 8);
  assert.equal(duelAdvice(8).tone, 'strong');
  assert.equal(duelAdvice(7).tone, 'even');
  assert.equal(duelAdvice(-7).tone, 'even');
  assert.equal(duelAdvice(-8).tone, 'weak');
  assert.match(duelAdvice(0).text, /무력 동일/);
  assert.match(duelAdvice(12).text, /무력 \+12/);
});

test('일기토 조언 문구에는 항상 실제 무력 차이가 붙는다', () => {
  for (const gap of [-30, -8, -3, 0, 4, 8, 30]) {
    const { text } = duelAdvice(gap);
    if (gap === 0) assert.match(text, /무력 동일/);
    else assert.ok(text.includes(`무력 ${gap > 0 ? '+' : ''}${gap}`), text);
  }
});

/* ---------- S3. 출진 '예상 전력' ---------- */
const odds = (over = {}) => ({
  myPower: 9286, defPower: 8133, ratio: 1.142, label: '열세',
  needTroops: 11298, atkCap: 15000, capLimited: false, ...over,
});

test('예상 전력: 숫자와 반대로 읽히지 않게 전력비와 기준(×1.15)을 함께 보여 준다', () => {
  const note = siegeOddsNote(odds(), 8600, 8600);
  assert.equal(SIEGE_EVEN, 1.15);
  assert.equal(note.ratioTxt, '전력비 ×1.14');
  assert.equal(note.oddsKo, '열세');
});

test('예상 전력: 필요 병력이 이 성 병력보다 크면 "이 성 병력으로는 부족"이라고 말한다', () => {
  const note = siegeOddsNote(odds(), 8600, 8600);
  assert.equal(note.needStrong, true);
  assert.match(note.needTxt, /이 성 병력 8,600으로는 부족합니다/);
  assert.match(note.needTxt, /권장 병력 11,298/);
  assert.match(note.needTxt, /수송|원군/);
});

test('예상 전력: 지휘 상한에 걸리면 상한을 짚어 준다', () => {
  const note = siegeOddsNote(odds({ capLimited: true, atkCap: 9000, needTroops: 11298 }), 20000, 9000);
  assert.equal(note.needStrong, true);
  assert.match(note.needTxt, /지휘 상한 9,000명/);
});

test('예상 전력: 병력이 충분하면 부족하다고 하지 않는다', () => {
  const note = siegeOddsNote(odds({ needTroops: 11298, capLimited: false }), 20000, 20000);
  assert.equal(note.needTxt, '');
  assert.equal(note.needStrong, false);
});

test('예상 전력: 모자란 만큼만 권장할 때는 승산을 함께 말한다', () => {
  const note = siegeOddsNote(odds({ needTroops: 11298 }), 20000, 9000);
  assert.equal(note.needStrong, false);
  assert.match(note.needTxt, /권장 병력 11,298/);
  assert.match(note.needTxt, /열세/);
});

/* ---------- S1·S4. 토스트 ---------- */
test('토스트는 단어 중간에서 끊기지 않고, 시트 버튼의 탭을 가로채지 않는다', () => {
  const css = read('../css/style.css');
  const rule = css.match(/\.toast \{[^}]*\}/)[0];
  assert.match(rule, /word-break:\s*keep-all/);
  assert.match(rule, /pointer-events:\s*none/);
  assert.match(css, /body\.sheet-open \.toast \{[^}]*top:/, '시트가 열리면 화면 위쪽으로 비켜난다');
});

test('시트를 열고 닫을 때 body.sheet-open 이 따라 움직인다', () => {
  const ui = read('../js/ui.js');
  assert.match(ui, /function openSheet\([\s\S]{0,220}body\.classList\.add\('sheet-open'\)/);
  assert.match(ui, /function closeSheet\(\) \{[\s\S]{0,160}body\.classList\.remove\('sheet-open'\)/);
});

/* ---------- S2. 전투 진입 명령 비활성 ---------- */
test('전투에 들어가면 내 첫 부대를 자동으로 고른다', () => {
  const ui = read('../js/ui.js');
  assert.match(ui, /battleSel = firstReadyUnit\(\)/);
  assert.match(ui, /function firstReadyUnit\(\)/);
});

test('명령이 잠긴 이유를 한 줄로 알려 준다(부대를 눌러 고르세요 등)', () => {
  const ui = read('../js/ui.js');
  assert.match(ui, /function battleHintHTML\(\)/);
  assert.match(ui, /부대를 눌러 고르세요/);
  assert.match(ui, /행동을 마쳤습니다/);
  assert.match(ui, /\$\{battleHintHTML\(\)\}/);
});

/* ---------- S5. 가로 잘림 ---------- */
test('도시 장수 칩은 두 줄로 접히고, 전투 부대 카드는 5장이 폭을 나눠 갖는다', () => {
  const css = read('../css/style.css');
  const gens = css.match(/\.cp-gens \{[^}]*\}/)[0];
  assert.match(gens, /flex-wrap:\s*wrap/);
  const card = css.match(/\.bt-card \{[^}]*\}/)[0];
  assert.match(card, /flex:\s*1 1 0/);
  assert.match(card, /min-width:\s*0/);
});

/* ---------- S6. 오타 ---------- */
test("계략 시트 오타 '씃니다' 가 없다", () => {
  const ui = read('../js/ui.js');
  assert.doesNotMatch(ui, /씃니다/);
  assert.match(ui, /행동력 1을 씁니다/);
});

/* ---------- S7. 명령 vs 행동력 ---------- */
test("턴 종료 버튼은 '행동력 N/M' 으로 남은 행동력을 보여 준다", () => {
  const ui = read('../js/ui.js');
  assert.match(ui, /#turn-hint'\)\.textContent = endTurnConfirm \? '정말 끝낼까요\?' : `행동력 \$\{game\.actionPoints\}\/\$\{game\.maxActionPoints\}`/);
  assert.doesNotMatch(ui, /#turn-hint'\)\.textContent = `명령/);
});

test('행동력이 남은 채 턴을 끝내려 하면 한 번 더 묻는다', () => {
  const ui = read('../js/ui.js');
  assert.match(ui, /if \(game\.actionPoints > 0 && !endTurnConfirm\)/);
  assert.match(ui, /한 번 더 누르면 턴을 끝냅니다/);
  assert.match(ui, /function cancelEndTurnConfirm\(\)/);
  assert.match(read('../css/style.css'), /\.turn-btn\.confirm \{/);
});

/* ---------- S9. 전투 정보 과밀 ---------- */
test('전장 진형 상성표는 기본으로 접혀 있고 ⓘ 로 펼친다', () => {
  const html = read('../index.html');
  assert.match(html, /id="bt-guide" class="bt-guide collapsed"|class="bt-guide collapsed" id="bt-guide"/);
  const ui = read('../js/ui.js');
  assert.match(ui, /bt-guide-toggle/);
  assert.match(ui, /battleGuideOpen/);
  const css = read('../css/style.css');
  assert.match(css, /\.bt-guide\.collapsed \.bg-cols[^{]*\{ display: none; \}/);
});

test('빈 로그 상자는 남는 높이를 다 먹지 않는다(최대 높이 + 여백)', () => {
  const css = read('../css/style.css');
  const rule = css.match(/\.bt-log \{[^}]*\}/)[0];
  assert.match(rule, /max-height:\s*\d+px/);
  assert.match(read('../index.html'), /class="bt-fill"/);
});

/* ---------- S10. 외교 시트 ---------- */
test('외교는 세력을 누르면 그 세력의 액션 선반만 열린다', () => {
  const ui = read('../js/ui.js');
  assert.match(ui, /diploTarget/);
  assert.match(ui, /data-act="diplo-open"/);
  assert.match(ui, /const btns = open \?/);
  assert.match(ui, /case 'diplo-open':/);
});

/* ---------- S11. 군주 카드 ---------- */
test("군주 카드가 '위 / 위' 처럼 같은 글자를 두 번 찍지 않는다", () => {
  const ui = read('../js/ui.js');
  assert.doesNotMatch(ui, /<div class="lc-mark">\$\{f\.mark \|\| f\.name\[0\]\}<\/div>/);
  assert.match(ui, /f\.mark && f\.mark !== f\.name\[0\]/);
});
