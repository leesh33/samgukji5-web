import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CITIES, CITY_BY_ID, GENERALS, SCENARIOS, FORMATIONS, FORMATION_GROUPS, SKILLS, REGIONS, CUSTOM_MARKS, CUSTOM_COLORS, PORTRAIT_HATS, PORTRAIT_BEARDS, PORTRAIT_SKINS, TREASURES, TREASURE_OWNERS } from '../js/data.js';
import { TALK_LINES, TALK_STYLES } from '../js/talk.js';
import * as E from '../js/engine.js';

/* 한자(한문) 금지 — CJK 통합 한자·확장 A·호환 한자 영역 */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const root = new URL('..', import.meta.url);
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, root)), 'utf8');

function sourceFiles() {
  const list = ['index.html'];
  for (const f of readdirSync(fileURLToPath(new URL('js/', root)))) if (f.endsWith('.js')) list.push('js/' + f);
  for (const f of readdirSync(fileURLToPath(new URL('css/', root)))) if (f.endsWith('.css')) list.push('css/' + f);
  return list;
}

test('소스(index.html·js·css)에 한자가 한 자도 없다', () => {
  for (const f of sourceFiles()) {
    const s = read(f);
    const hit = s.match(CJK);
    assert.equal(hit, null, `${f} → ${hit && hit[0]}`);
  }
});

test('정적 데이터(성·장수·시나리오·진형·특기·권역·보물·신군주 프리셋)에 한자가 없다', () => {
  const blob = JSON.stringify({
    CITIES, GENERALS, SCENARIOS, FORMATIONS, FORMATION_GROUPS, SKILLS, REGIONS,
    CUSTOM_MARKS, CUSTOM_COLORS, PORTRAIT_HATS, PORTRAIT_BEARDS, PORTRAIT_SKINS,
    TREASURES, TREASURE_OWNERS,
  });
  assert.equal(CJK.test(blob), false, (blob.match(CJK) || [])[0] || '');
});

test('이름·설명에 쓸 수 있는 표기는 모두 한글이다', () => {
  const names = [...CITIES.map((c) => c.ko), ...GENERALS.map((g) => g.ko), ...SCENARIOS.map((s) => s.name)];
  for (const n of names) assert.equal(CJK.test(n), false, n);
  for (const s of SCENARIOS) {
    assert.equal(s.hanja, undefined, '시나리오 한자 부제 제거');
    for (const f of s.factions) assert.equal(f.hanja, undefined, '세력 한자 제거');
  }
  for (const g of GENERALS) assert.equal(g.hanja, undefined, `${g.ko} 한자 제거`);
  for (const c of CITIES) assert.equal(c.hanja, undefined, `${c.ko} 한자 제거`);
  for (const f of Object.values(FORMATIONS)) assert.equal(f.hanja, undefined, `${f.ko} 한자 제거`);
});

test('깃발 글자는 한글 1자다 — 세력·신군주 프리셋 모두', () => {
  for (const sc of SCENARIOS) {
    const s = E.createGame(sc.id, sc.factions[0].id, 3);
    for (const f of Object.values(s.factions)) {
      assert.equal(typeof f.mark, 'string');
      assert.equal(f.mark, f.name[0], `${f.name} 깃발 글자`);
      assert.match(f.mark, /^[가-힣]$/);
    }
  }
  for (const m of CUSTOM_MARKS) assert.match(m, /^[가-힣]$/);
});

test('신군주 깃발 글자: 한글만 받고 그 외는 이름 첫 글자', () => {
  assert.equal(E.customMark('한', '구천'), '한');
  assert.equal(E.customMark('A', '구천'), '구');
  assert.equal(E.customMark('', '구천'), '구');
  assert.equal(E.customMark('9', ''), '신');
});

test('게임 상태와 대화 대사에 한자가 스며들지 않는다', () => {
  const s = E.createGame('s194', 'jojo', 5);
  const city = E.factionCities(s, 'jojo')[0];
  const gid = E.talkPartners(s, city.id)[0].id;
  E.talkToGeneral(s, city.id, gid);
  assert.equal(CJK.test(E.serialize(s)), false, '저장 문자열에 한자 없음');
  const pools = [...Object.values(TALK_LINES), ...Object.values(TALK_STYLES)].flat();
  for (const line of pools) assert.equal(CJK.test(line.g + line.l), false);
  assert.equal(CITIES.length, 42);
  assert.ok(CITY_BY_ID.xiangping.ko);
});
