/* 🍎 iOS 앱(Apple 로그인 · 딥링크 복귀 · 계정 삭제) — 코드와 문서의 약속을 지킨다
   실제 동작은 tests/verify_native.py (Playwright) 가 브라우저에서 확인한다.
   여기서는 ① 웹 사파리 동작을 건드리지 않았는지 ② 앱 다리 이름·주소가 맞는지
   ③ 개인정보처리방침·이용약관에 Apple 로그인과 계정 삭제가 들어갔는지 본다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL_DOCS, legalDocHTML } from '../js/legal.js';

const read = (rel) => readFileSync(fileURLToPath(new URL('../' + rel, import.meta.url)), 'utf8');
const sync = read('js/sync.js');
const ui = read('js/ui.js');
const css = read('css/style.css');

const docText = (doc) => [doc.lead, doc.foot, ...doc.sections.flatMap((s) => [
  s.h, ...(s.p || []), ...(s.items || []), ...(s.rows || []).flatMap((r) => [r.k, r.v]),
])].join('\n');

test('앱 다리: window.__SAMGUK_NATIVE__ · SamgukNative · samguk://auth-callback', () => {
  assert.match(sync, /__SAMGUK_NATIVE__/, '앱이 심는 전역');
  assert.match(sync, /const NATIVE_REDIRECT = 'samguk:\/\/auth-callback'/, '커스텀 스킴 복귀 주소');
  assert.match(sync, /globalThis\.SamgukNative\s*=/, '앱이 부르는 다리');
  assert.match(sync, /oauthCallback\(url\)/, 'Google·카카오 복귀');
  assert.match(sync, /appleSignIn\(idToken, nonce\)/, 'Apple id_token 전달');
  assert.match(sync, /type: 'apple-signin'/, '앱에 Apple 창을 열라고 보내는 메시지');
  assert.match(sync, /grant_type=id_token/, 'Supabase id_token 교환');
  assert.match(sync, /provider: 'apple'/, 'Apple provider');
  assert.match(sync, /ReactNativeWebView/, 'WebView postMessage 다리');
});

test('웹(사파리) 동작은 그대로 — 앱이 아니면 페이지 이동 방식', () => {
  // 앱 다리가 없으면 기존처럼 location.assign 으로 Supabase authorize 로 간다
  assert.match(sync, /const base = native \? NATIVE_REDIRECT : location\.origin \+ location\.pathname/);
  assert.match(sync, /location\.assign\(url\)/);
  // Apple 칩은 앱 안(네이티브 appleAuth)에서만 그린다
  assert.match(sync, /if \(name === 'apple'\) return !!\(nativeInfo\(\) && nativeInfo\(\)\.appleAuth\)/);
  assert.match(sync, /data-cloud="in-apple"/);
  assert.match(css, /\.acc-pill\.apple \.acc-badge/);
});

test('계정 · 클라우드 기록 삭제 — 로그인 상태에서 메뉴에 버튼, 2단계 확인', () => {
  assert.match(sync, /data-cloud="delete"/, '삭제 버튼');
  assert.match(sync, /samguk_delete_my_account/, 'Supabase RPC');
  assert.match(sync, /method: 'DELETE'/, 'RPC 가 없을 때 RLS 로 본인 행 삭제');
  assert.match(sync, /function purgeLocal\(\)/, '이 기기 저장도 함께 지운다');
  assert.match(ui, /function openDeleteAccount\(\)/, '확인 시트');
  assert.match(ui, /id="del-ack"/, '동의 체크');
  assert.match(ui, /data-act="account-delete-go"/, '실행 버튼');
  assert.match(ui, /case 'account-delete-go'/, '동작 연결');
  assert.match(ui, /onDeleteRequest/, 'sync → ui 연결');
  // 타이틀(compact)에는 버튼을 두지 않는다 — 좁은 화면에서 실수 방지
  assert.match(sync, /\(compact \? ''\s*\n?\s*: '<button type="button" class="acc-out danger"/);
});

test('개인정보처리방침에 Apple 로그인·Apple Inc.·계정 삭제가 들어갔다', () => {
  const p = docText(LEGAL_DOCS.privacy);
  assert.match(p, /Apple 로그인/);
  assert.match(p, /Apple Inc\. \(미국\)/);
  assert.match(p, /계정 · 클라우드 기록 삭제/);
  assert.match(p, /Google·카카오·Apple/);
  const t = docText(LEGAL_DOCS.terms);
  assert.match(t, /Apple/);
  assert.match(t, /계정 · 클라우드 기록 삭제/);
});

test('약관 웹 페이지(privacy.html·terms.html)가 같은 문구를 그린다', () => {
  const privacy = read('privacy.html');
  const terms = read('terms.html');
  for (const [page, kind] of [[privacy, 'privacy'], [terms, 'terms']]) {
    assert.match(page, /js\/legal\.js/, 'legal.js 를 그대로 쓴다');
    assert.match(page, /legalDocHTML\('/);
    assert.match(page, /css\/legal\.css/);
    assert.match(page, /<html lang="ko">/);
  }
  const out = legalDocHTML('privacy');
  assert.equal(out.title, '개인정보처리방침');
  assert.match(out.html, /Apple/);
  assert.match(out.meta, /시행일 2026년/);
  assert.equal(legalDocHTML('terms').title, '이용약관');
});

test('한자를 쓰지 않는다 (새 문구 포함)', () => {
  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  for (const doc of Object.values(LEGAL_DOCS)) {
    assert.ok(!CJK.test(docText(doc)), `${doc.title} 에 한자`);
  }
  for (const f of ['js/sync.js', 'js/ui.js', 'privacy.html', 'terms.html']) {
    assert.ok(!CJK.test(read(f)), `${f} 에 한자`);
  }
});
