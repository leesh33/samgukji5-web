import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL_META, LEGAL_DOCS, legalDoc, openLegal, closeLegal, legalOpen } from '../js/legal.js';

/* 개인정보처리방침 · 이용약관 — ☰ 메뉴에서 읽는 문서의 형식과 문구를 지킨다 */

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const read = (rel) => readFileSync(fileURLToPath(new URL('../' + rel, import.meta.url)), 'utf8');
const blob = JSON.stringify(LEGAL_DOCS);
const text = (doc) => [doc.lead, doc.foot, ...doc.sections.flatMap((s) => [
  s.h, ...(s.p || []), ...(s.items || []), ...(s.rows || []).flatMap((r) => [r.k, r.v]),
])].join('\n');

test('두 문서가 있고 제목·시행일·서비스 이름이 맞다', () => {
  assert.deepEqual(Object.keys(LEGAL_DOCS).sort(), ['privacy', 'terms']);
  assert.equal(LEGAL_DOCS.privacy.title, '개인정보처리방침');
  assert.equal(LEGAL_DOCS.terms.title, '이용약관');
  assert.equal(LEGAL_META.service, '삼국 한 턴');
  assert.match(LEGAL_META.effective, /^2026년 \d{1,2}월 \d{1,2}일$/);
  assert.equal(legalDoc('privacy'), LEGAL_DOCS.privacy);
  assert.equal(legalDoc('없는문서').key, 'privacy');
});

test('모든 조항에 제목이 있고, 읽을 만큼 충분히 나뉘어 있다', () => {
  for (const doc of Object.values(LEGAL_DOCS)) {
    assert.ok(doc.sections.length >= 8, `${doc.title} 조항 ${doc.sections.length}개`);
    for (const s of doc.sections) {
      assert.match(s.h, /^\d+\. /, `${doc.title} — ${s.h}`);
      assert.ok((s.p || []).length + (s.items || []).length + (s.rows || []).length > 0, `${s.h} 내용 없음`);
    }
  }
});

test('구글·카카오 로그인과 클라우드 저장, 문의처를 담는다', () => {
  const p = text(LEGAL_DOCS.privacy);
  const t = text(LEGAL_DOCS.terms);
  for (const s of [p, t]) {
    assert.ok(s.includes('Google'), 'Google 언급');
    assert.ok(s.includes('카카오'), '카카오 언급');
    assert.ok(s.includes('클라우드'), '클라우드 저장 언급');
    assert.ok(s.includes('삼국 한 턴'), '서비스 이름');
    assert.ok(s.includes('andy.leesh33@gmail.com'), '문의 메일');
  }
  assert.ok(p.includes('Supabase'), '처리 위탁');
  assert.ok(p.includes('로컬 저장소'), '브라우저 저장');
  assert.ok(p.includes('14세'), '아동 조항');
});

test('문서에 한자가 한 자도 없다', () => {
  const hit = blob.match(CJK);
  assert.equal(hit, null, hit && hit[0]);
});

test('☰ 메뉴에 두 항목이 있고, 누르면 모달로 열린다', () => {
  const ui = read('js/ui.js');
  assert.ok(ui.includes("data-act=\"legal-privacy\""), '메뉴 — 개인정보처리방침');
  assert.ok(ui.includes("data-act=\"legal-terms\""), '메뉴 — 이용약관');
  assert.ok(ui.includes("case 'legal-privacy': openLegal('privacy');"), '열기 배선');
  assert.ok(ui.includes("case 'legal-terms': openLegal('terms');"), '열기 배선');
});

test('브라우저 밖에서는 모달을 만들지 않는다', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(openLegal('privacy'), null);
  assert.equal(legalOpen(), false);
  closeLegal();
});
