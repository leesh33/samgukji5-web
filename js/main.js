import { boot } from './ui.js';
/* 📊 익명 접속자 기록 — 웹·앱 모두 첫 화면에서 1회. 실패해도 조용히 넘어간다(게임엔 영향 없음). */
import './visits.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
