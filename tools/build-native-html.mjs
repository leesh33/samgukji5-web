#!/usr/bin/env node
/**
 * build-native-html.mjs — iOS 앱(Expo WebView 래퍼)에 넣을 **한 파일짜리 index.html** 을 만든다.
 *
 *   node tools/build-native-html.mjs ../samguk-app/src/generated/html.js
 *
 * 왜 한 파일인가
 *   · 앱은 이 HTML 을 `loadHTMLString:baseURL:` 로 띄운다. baseURL 을 라이브 주소로 주면
 *     페이지의 오리진이 https 가 되어 localStorage(진행 저장·로그인 세션)가 정상 동작한다.
 *   · 그래서 CSS·JS·글꼴(woff2)·행동 연출 그림(webp)을 전부 안에 넣어 **오프라인에서도 그대로 실행**되게 한다.
 *   · 네트워크는 클라우드 동기화(Supabase)와 로그인에만 쓰인다. 없으면 로컬로 논다.
 *
 * 빌드 산출물은 `export default "<html...>"` 인 JS 모듈이다(Metro 가 그대로 번들에 넣는다).
 *
 * JS 는 ES Module 여러 파일이라 그대로 이어 붙일 수 없다 → esbuild 로 한 덩어리(IIFE)로 묶는다.
 * esbuild 경로는 ESBUILD_BIN 환경변수로 바꿀 수 있다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(ROOT, '..', 'samguk-app', 'src', 'generated', 'html.js');
const ESBUILD = process.env.ESBUILD_BIN || '/workspace/tmp_tools/node_modules/.bin/esbuild';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const buf = (p) => fs.readFileSync(path.join(ROOT, p));

/* ① JS — esbuild 로 한 덩어리 번들(IIFE) */
const tmp = path.join(ROOT, '.native-bundle.js');
execFileSync(ESBUILD, [
  path.join(ROOT, 'js', 'main.js'),
  '--bundle', '--format=iife', '--platform=browser', '--target=safari14',
  '--legal-comments=none', `--outfile=${tmp}`,
], { stdio: ['ignore', 'ignore', 'inherit'] });
let js = fs.readFileSync(tmp, 'utf8');
fs.unlinkSync(tmp);

/* ② 행동 연출 그림(webp 12장) — 문자열 경로를 data URI 로 바꾼다 */
const fxDir = path.join(ROOT, 'assets', 'actionfx');
let fxBytes = 0;
for (const f of fs.readdirSync(fxDir)) {
  if (!f.endsWith('.webp')) continue;
  const b = buf(`assets/actionfx/${f}`);
  fxBytes += b.length;
  const uri = 'data:image/webp;base64,' + b.toString('base64');
  js = js.split(`assets/actionfx/${f}`).join(uri);
}

/* ③ CSS — 글꼴은 woff2 만 data URI 로 (woff 예비 소스는 버린다) */
let css = read('css/style.css');
const fontUri = (file) => "data:font/woff2;base64," + buf('assets/fonts/' + file).toString('base64');
// 같은 글꼴 파일을 굵기마다 다섯 번 넣으면 HTML 이 5MB 를 넘는다.
// 원본 @font-face(300·400·500 → Medium / 600·700·800 → Bold)를 400·700 두 벌로 줄인다.
// CSS 글꼴 매칭은 가장 가까운 굵기를 고르므로 화면은 원본과 같다.
css = css.replace(/@font-face\s*\{[^}]*\}/g, '');
css = `@font-face { font-family: 'Gmarket Sans'; font-style: normal; font-weight: 400; font-display: swap; `
  + `src: url('${fontUri('GmarketSans-Medium.woff2')}') format('woff2'); }\n`
  + `@font-face { font-family: 'Gmarket Sans'; font-style: normal; font-weight: 700; font-display: swap; `
  + `src: url('${fontUri('GmarketSans-Bold.woff2')}') format('woff2'); }\n` + css;
if (/url\('\.\.\//.test(css)) throw new Error('CSS 에 남은 상대경로가 있습니다: ' + css.match(/url\('\.\.\/[^']+'\)/)[0]);

/* ④ index.html — 스타일시트·스크립트 태그를 인라인으로 바꾼다 */
let html = read('index.html');
html = html.replace(/<link rel="preload"[^>]*as="font"[^>]*>\s*/g, '');
//  ※ 치환 문자열에 $ 를 그대로 넣으면 $$ → $ 로 바뀌어 코드가 깨진다 → 함수 치환을 쓴다
html = html.replace('<link rel="stylesheet" href="css/style.css" />', () => '<style>\n' + css + '\n</style>');
html = html.replace('<script type="module" src="js/main.js"></script>', () => '<script>\n' + js + '\n</script>');
if (!html.includes(js)) throw new Error('스크립트를 넣는 과정에서 내용이 바뀌었습니다($ 치환 확인)');
if (!html.includes(css)) throw new Error('스타일을 넣는 과정에서 내용이 바뀌었습니다($ 치환 확인)');
if (/<script type="module"/.test(html) || /href="css\//.test(html)) {
  throw new Error('index.html 에 남은 외부 참조가 있습니다');
}
if (/src="js\/|href="assets\//.test(html)) throw new Error('index.html 에 남은 상대 참조가 있습니다');

/* ⑤ JS 모듈로 저장 */
const module = '/* 자동 생성 — samgukji5-web/tools/build-native-html.mjs (오프라인 폴백용 한 파일 HTML) */\n'
  + 'export default ' + JSON.stringify(html) + ';\n';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, module);

const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log(`html ${kb(html.length)} (js ${kb(js.length)} · css ${kb(css.length)} · actionfx ${kb(fxBytes)}) → ${out}`);
