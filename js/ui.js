/* UI — 화면 전환 · 지도 · 내정 · 전술전투 · 일기토 */
import { CITIES, CITY_BY_ID, GENERAL_BY_ID, SCENARIOS, FORMATIONS, REGIONS, FACTION_COLORS, CUSTOM_COLORS, CUSTOM_MARKS, PORTRAIT_HATS, PORTRAIT_BEARDS, PORTRAIT_SKINS, SKILLS, FORMATION_GROUPS, CORE_FORMATIONS, formationGroup, formationRelation, formationCounterText } from './data.js';
import { formationSVG, drawFormation, DIR_KO } from './formation-art.js';
import * as E from './engine.js';
import * as B from './battle.js';
import { createDuel, duelRound, DUEL_ACTIONS } from './duel.js';
import { portraitURL } from './portrait.js';
import { createMapView } from './mapview.js';
import { sfx } from './audio.js';
import * as Cloud from './sync.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const FALLBACK_SPEC = { ko: '무명', lead: 50, war: 50, int: 50, pol: 50, cha: 50, arms: '보병', skill: 'tongsol', formations: ['eorin'] };
/* 신군주가 만든 장수까지 포함해 장수 데이터를 찾는다 */
const gd = (id) => E.generalOf(game, id) || GENERAL_BY_ID[id] || FALLBACK_SPEC;

const KEYS = { auto: 'samguk5.auto', slot: (i) => `samguk5.slot${i}`, muted: 'samguk5.muted' };

let game = null;
let mapView = null;
let selectedCity = null;
let cityPanelOpen = true; // 성을 고르면 기본으로 펼친 상태
let pendingSetup = null; // 출진 준비
let battle = null;
let battleSel = null;
let battleMode = null;
let battleBusy = false;
let lastBattleResult = null;
let duelCtx = null;
let tickTimer = null;
let turnPending = false;
let currentScenario = null;
let battleSeedCounter = 1;

/* ---------- 화면 ---------- */
function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
  if (id === 'scr-game') {
    setTimeout(() => mapView && mapView.resize(), 30);
    if (!tickTimer) tickTimer = setInterval(() => { if (game && !$('#scr-game').classList.contains('hidden') && !battle) mapView && mapView.render(); }, 800);
  } else {
    cityCmdGroup = null;
    syncCmdPopover();
  }
}
function toast(msg, ms = 2200) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function colorOf(fid) { return (game && game.factions[fid] && game.factions[fid].color) || '#777'; }
function fname(fid) { return (game && game.factions[fid] && game.factions[fid].name) || '재야'; }

/* ---------- 타이틀 ---------- */
function titleRand(i, salt = 1) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function ridge(ctx, w, baseY, amp, color, step, seed, litColor) {
  const pts = [];
  for (let x = -20; x <= w + 20; x += step) {
    const t = x / w;
    const y = baseY
      - Math.abs(Math.sin(t * 5.2 + seed) ) * amp
      - Math.sin(t * 13.7 + seed * 2.1) * amp * 0.35
      - Math.abs(Math.sin(t * 27.3 + seed * 3.7)) * amp * 0.16;
    pts.push([x, y]);
  }
  ctx.beginPath();
  ctx.moveTo(-20, baseY + amp * 2);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(w + 20, baseY + amp * 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (litColor) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = litColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawTitleArt() {
  const c = $('#title-canvas');
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth || window.innerWidth;
  const h = c.clientHeight || window.innerHeight;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* --- 하늘: 해 질 녘 --- */
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.72);
  sky.addColorStop(0, '#1a1209');
  sky.addColorStop(0.28, '#422812');
  sky.addColorStop(0.56, '#7d4a1f');
  sky.addColorStop(0.78, '#b87333');
  sky.addColorStop(1, '#d99a52');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.74);

  // 해 — 왼쪽 위의 큰 빛덩이
  const sunX = w * 0.28, sunY = h * 0.2;
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, w * 0.9);
  sun.addColorStop(0, 'rgba(255, 232, 178, 0.95)');
  sun.addColorStop(0.06, 'rgba(255, 210, 140, 0.75)');
  sun.addColorStop(0.22, 'rgba(255, 168, 90, 0.32)');
  sun.addColorStop(0.5, 'rgba(220, 120, 50, 0.12)');
  sun.addColorStop(1, 'rgba(160, 70, 20, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h * 0.8);

  // 구름 띠
  for (let i = 0; i < 7; i++) {
    const cy = h * (0.1 + i * 0.052) + titleRand(i, 3) * h * 0.02;
    const cw = w * (0.5 + titleRand(i, 5) * 0.8);
    const cx = (titleRand(i, 7) * 1.2 - 0.1) * w;
    const g = ctx.createLinearGradient(cx - cw / 2, cy, cx + cw / 2, cy);
    g.addColorStop(0, 'rgba(255, 214, 160, 0)');
    g.addColorStop(0.4, `rgba(255, 222, 176, ${0.12 + titleRand(i, 9) * 0.1})`);
    g.addColorStop(0.7, `rgba(255, 198, 140, ${0.08 + titleRand(i, 11) * 0.08})`);
    g.addColorStop(1, 'rgba(255, 190, 130, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, h * (0.008 + titleRand(i, 13) * 0.012), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* --- 먼 산맥 4겹 --- */
  const layers = [
    { y: 0.3, amp: 0.07, col: '#7d5230', lit: 'rgba(255, 210, 156, 0.34)', step: 38, seed: 1.2 },
    { y: 0.36, amp: 0.1, col: '#57381f', lit: 'rgba(255, 200, 140, 0.26)', step: 30, seed: 2.7 },
    { y: 0.45, amp: 0.13, col: '#352214', lit: 'rgba(255, 190, 126, 0.2)', step: 22, seed: 4.1 },
    { y: 0.56, amp: 0.17, col: '#1c120b', lit: 'rgba(255, 178, 112, 0.12)', step: 16, seed: 5.6 },
  ];
  for (const L of layers) ridge(ctx, w, h * L.y, h * L.amp, L.col, L.step, L.seed, L.lit);

  // 안개 띠 — 층 사이로 흐르는 빛
  for (const mist of [{ y: 0.34, a: 0.12 }, { y: 0.46, a: 0.16 }, { y: 0.58, a: 0.2 }]) {
    const g = ctx.createLinearGradient(0, h * (mist.y - 0.05), 0, h * (mist.y + 0.08));
    g.addColorStop(0, 'rgba(255, 206, 150, 0)');
    g.addColorStop(0.45, `rgba(255, 196, 140, ${mist.a})`);
    g.addColorStop(1, 'rgba(255, 180, 120, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * (mist.y - 0.05), w, h * 0.13);
  }

  /* --- 먼 언덕 위의 요새 --- */
  const fx = w * 0.52, fy = h * 0.215;
  const S = w * 0.17;
  // 절벽
  ctx.beginPath();
  ctx.moveTo(fx - S * 1.35, fy - S * 0.02);
  ctx.lineTo(fx - S * 1.2, fy + S * 0.42);
  ctx.lineTo(fx - S * 0.6, fy + S * 0.7);
  ctx.lineTo(fx + S * 0.7, fy + S * 0.72);
  ctx.lineTo(fx + S * 1.24, fy + S * 0.4);
  ctx.lineTo(fx + S * 1.34, fy - S * 0.04);
  ctx.closePath();
  const cliff = ctx.createLinearGradient(fx - S, fy, fx + S, fy + S * 0.7);
  cliff.addColorStop(0, '#6a4c2c');
  cliff.addColorStop(0.5, '#3c2a19');
  cliff.addColorStop(1, 'rgba(26, 17, 10, 0)');
  ctx.fillStyle = cliff;
  ctx.fill();
  // 절벽 위 바위 이끼
  ctx.beginPath();
  ctx.moveTo(fx - S * 1.34, fy - S * 0.01);
  ctx.lineTo(fx - S * 0.1, fy - S * 0.07);
  ctx.lineTo(fx + S * 1.33, fy - S * 0.03);
  ctx.lineTo(fx + S * 1.3, fy + S * 0.04);
  ctx.lineTo(fx - S * 1.3, fy + S * 0.06);
  ctx.closePath();
  ctx.fillStyle = '#4a4a2c';
  ctx.fill();
  // 바위 결
  ctx.strokeStyle = 'rgba(255, 200, 140, 0.13)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(fx - S * (0.9 - i * 0.16), fy + S * (0.12 + i * 0.1));
    ctx.lineTo(fx + S * (0.8 - i * 0.12), fy + S * (0.14 + i * 0.1));
    ctx.stroke();
  }

  // 성벽
  const wallTop = fy - S * 0.05, wallBot = fy + S * 0.16;
  const wHalf = S * 0.8;
  const wallFace = ctx.createLinearGradient(fx - wHalf, wallTop, fx + wHalf, wallBot);
  wallFace.addColorStop(0, '#c9b189');
  wallFace.addColorStop(0.42, '#95805d');
  wallFace.addColorStop(1, '#463623');
  ctx.fillStyle = wallFace;
  ctx.fillRect(fx - wHalf, wallTop, wHalf * 2, wallBot - wallTop);
  // 성가퀴
  for (let i = 0; i < 9; i += 2) {
    const mw = (wHalf * 2) / 9;
    ctx.fillStyle = '#c0a87e';
    ctx.fillRect(fx - wHalf + i * mw + mw * 0.1, wallTop - S * 0.06, mw * 0.7, S * 0.06);
    ctx.fillStyle = 'rgba(20, 14, 8, 0.32)';
    ctx.fillRect(fx - wHalf + i * mw + mw * 0.1, wallTop - S * 0.015, mw * 0.7, S * 0.015);
  }
  // 성문
  const gw = S * 0.26, gh = S * 0.16;
  ctx.beginPath();
  ctx.moveTo(fx - gw / 2, wallBot);
  ctx.lineTo(fx - gw / 2, wallBot - gh * 0.45);
  ctx.quadraticCurveTo(fx, wallBot - gh * 1.3, fx + gw / 2, wallBot - gh * 0.45);
  ctx.lineTo(fx + gw / 2, wallBot);
  ctx.closePath();
  ctx.fillStyle = 'rgba(14, 9, 5, 0.96)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 208, 140, 0.65)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  const gateGlow = ctx.createRadialGradient(fx, wallBot - gh * 0.35, 0, fx, wallBot - gh * 0.35, S * 0.28);
  gateGlow.addColorStop(0, 'rgba(255, 170, 80, 0.34)');
  gateGlow.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = gateGlow;
  ctx.beginPath(); ctx.arc(fx, wallBot - gh * 0.35, S * 0.28, 0, Math.PI * 2); ctx.fill();

  // 누각
  const keepW = S * 0.48, keepTop = wallTop - S * 0.34;
  const keepG = ctx.createLinearGradient(fx - keepW / 2, keepTop, fx + keepW / 2, wallTop);
  keepG.addColorStop(0, '#d8c199');
  keepG.addColorStop(0.5, '#9d8761');
  keepG.addColorStop(1, '#4a3a26');
  ctx.fillStyle = keepG;
  ctx.fillRect(fx - keepW / 2, keepTop, keepW, wallTop - keepTop + S * 0.03);
  ctx.fillStyle = 'rgba(255, 198, 112, 0.95)';
  for (let i = -1; i <= 1; i++) ctx.fillRect(fx + i * keepW * 0.28 - keepW * 0.05, keepTop + (wallTop - keepTop) * 0.45, keepW * 0.1, keepW * 0.11);
  const roof = (ccx, yy, half, peak, hi, mid, lo) => {
    ctx.beginPath();
    ctx.moveTo(ccx - half, yy);
    ctx.quadraticCurveTo(ccx - half * 0.5, yy - peak * 0.55, ccx - half * 0.05, yy - peak);
    ctx.lineTo(ccx + half * 0.05, yy - peak);
    ctx.quadraticCurveTo(ccx + half * 0.5, yy - peak * 0.55, ccx + half, yy);
    ctx.quadraticCurveTo(ccx + half * 0.4, yy + peak * 0.3, ccx, yy + peak * 0.34);
    ctx.quadraticCurveTo(ccx - half * 0.4, yy + peak * 0.3, ccx - half, yy);
    ctx.closePath();
    const g = ctx.createLinearGradient(ccx - half, yy - peak, ccx + half, yy + peak * 0.3);
    g.addColorStop(0, hi); g.addColorStop(0.5, mid); g.addColorStop(1, lo);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ccx - half, yy);
    ctx.quadraticCurveTo(ccx - half * 0.5, yy - peak * 0.55, ccx - half * 0.05, yy - peak);
    ctx.lineTo(ccx + half * 0.05, yy - peak);
    ctx.quadraticCurveTo(ccx + half * 0.5, yy - peak * 0.55, ccx + half, yy);
    ctx.strokeStyle = 'rgba(255, 214, 150, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };
  roof(fx, keepTop + S * 0.02, keepW * 0.86, S * 0.2, '#53707c', '#25373f', '#0d1519');
  roof(fx, keepTop - S * 0.13, keepW * 0.5, S * 0.13, '#53707c', '#25373f', '#0d1519');
  // 망루 둘
  for (const tx of [fx - wHalf + S * 0.13, fx + wHalf - S * 0.13]) {
    const tw = S * 0.22, tt = wallTop - S * 0.17;
    const tg = ctx.createLinearGradient(tx - tw / 2, tt, tx + tw / 2, wallBot);
    tg.addColorStop(0, '#cdb68e');
    tg.addColorStop(1, '#4a3a26');
    ctx.fillStyle = tg;
    ctx.fillRect(tx - tw / 2, tt, tw, wallBot - tt - S * 0.02);
    roof(tx, tt + S * 0.01, tw * 0.86, S * 0.12, '#53707c', '#25373f', '#0d1519');
  }
  // 깃발
  for (const [bx, by, col] of [[fx + wHalf * 0.45, wallTop - S * 0.52, '#c04c33'], [fx - wHalf * 0.6, wallTop - S * 0.44, '#3568a8']]) {
    ctx.strokeStyle = 'rgba(20, 12, 6, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx, by + S * 0.3);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + S * 0.2, by + S * 0.03, bx + S * 0.38, by + S * 0.07);
    ctx.lineTo(bx + S * 0.34, by + S * 0.17);
    ctx.quadraticCurveTo(bx + S * 0.18, by + S * 0.13, bx, by + S * 0.16);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  }

  /* --- 절벽 아래 물안개 --- */
  const mist2 = ctx.createRadialGradient(fx, fy + S * 0.6, 0, fx, fy + S * 0.6, S * 1.6);
  mist2.addColorStop(0, 'rgba(255, 214, 160, 0.22)');
  mist2.addColorStop(0.6, 'rgba(255, 200, 150, 0.08)');
  mist2.addColorStop(1, 'rgba(255, 190, 140, 0)');
  ctx.fillStyle = mist2;
  ctx.beginPath();
  ctx.ellipse(fx, fy + S * 0.6, S * 1.6, S * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  /* --- 앞쪽 능선과 소나무 --- */
  // 아래쪽 빛무리 — 숲 실루엣 뒤로 따뜻한 기운
  const bottomGlow = ctx.createRadialGradient(w * 0.5, h * 1.02, 0, w * 0.5, h * 1.02, h * 0.45);
  bottomGlow.addColorStop(0, 'rgba(255, 150, 70, 0.22)');
  bottomGlow.addColorStop(0.6, 'rgba(200, 100, 40, 0.07)');
  bottomGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ridge(ctx, w, h * 0.86, h * 0.055, '#150e08', 20, 7.3, 'rgba(255, 170, 100, 0.16)');
  // 앞 능선의 소나무
  for (let i = 0; i < 22; i++) {
    const tx = titleRand(i, 41) * w;
    const ty = h * (0.9 + titleRand(i, 43) * 0.1);
    const th = h * (0.03 + titleRand(i, 45) * 0.035);
    ctx.fillStyle = '#0a0705';
    ctx.fillRect(tx - 0.8, ty - th * 0.2, 1.6, th * 0.25);
    for (let k = 0; k < 3; k++) {
      const yy = ty - th * (0.18 + k * 0.26);
      const ww = th * (0.34 - k * 0.08);
      ctx.beginPath();
      ctx.moveTo(tx, yy - th * 0.42);
      ctx.lineTo(tx + ww, yy);
      ctx.lineTo(tx - ww, yy);
      ctx.closePath();
      ctx.fill();
    }
  }
  for (let i = 0; i < 14; i++) {
    const tx = titleRand(i, 21) * w;
    const ty = h * (0.79 + titleRand(i, 23) * 0.05);
    const th = h * (0.03 + titleRand(i, 25) * 0.03);
    ctx.fillStyle = '#0b0805';
    for (let k = 0; k < 3; k++) {
      const yy = ty - th * (0.1 + k * 0.28);
      const ww = th * (0.32 - k * 0.07);
      ctx.beginPath();
      ctx.moveTo(tx, yy - th * 0.45);
      ctx.lineTo(tx + ww, yy);
      ctx.lineTo(tx - ww, yy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* --- 불티 --- */
  for (let i = 0; i < 40; i++) {
    const ex = titleRand(i, 31) * w;
    const ey = h * (0.2 + titleRand(i, 33) * 0.6);
    const er = 0.6 + titleRand(i, 35) * 1.6;
    const a = 0.2 + titleRand(i, 37) * 0.5;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 206, 140, ${a})`;
    ctx.fill();
  }

  /* --- 가독성: 아래로 짙어지는 그늘 --- */
  const shade = ctx.createLinearGradient(0, h * 0.34, 0, h);
  shade.addColorStop(0, 'rgba(8, 6, 4, 0)');
  shade.addColorStop(0.5, 'rgba(8, 6, 4, 0.16)');
  shade.addColorStop(1, 'rgba(8, 6, 4, 0.42)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
}

/* ---------- 시나리오 / 군주 ---------- */
function renderScenarios() {
  const entry = `<button class="sc-card sc-custom" data-act="open-custom" data-sc="${SCENARIOS[0].id}">
      <div class="sc-year">신세력</div>
      <div class="sc-name">★ 신군주 생성</div>
      <div class="sc-meta"><span>이름·깃발·색·초상화·능력을 정해 새 세력으로 시작</span></div>
    </button>`;
  $('#scenario-list').innerHTML = entry + SCENARIOS.map((s) => {
    const facs = s.factions.length;
    const gens = new Set();
    s.factions.forEach((f) => f.generals.forEach((g) => gens.add(g)));
    return `<button class="sc-card" data-act="pick-scenario" data-id="${s.id}">
      <div class="sc-year">${s.year}년</div>
      <div class="sc-name">${s.name}</div>
      <div class="sc-meta"><span>세력 <b>${facs}</b></span><span>성 <b>${s.factions.reduce((n, f) => n + f.cities.length, 0)}</b></span><span>등장 장수 <b>${gens.size}</b></span></div>
    </button>`;
  }).join('');
}

function renderLords(scenarioId) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId);
  currentScenario = sc;
  $('#lord-title').textContent = `${sc.year}년 ${sc.name} — 군주 선택`;
  $('#lord-list').innerHTML = sc.factions.map((f) => {
    const lord = gd(f.lord);
    const color = (game && game.factions[f.id]) ? game.factions[f.id].color : (FACTION_COLORS[f.id] || SCENARIO_COLORS[f.id] || '#888');
    return `<button class="lord-card" data-act="pick-lord" data-id="${f.id}" data-sc="${sc.id}">
      <img src="${portraitURL(lord.id, lord, 56, color)}" alt="${lord.ko}" />
      <div class="lc-name">${f.name}</div>
      <div class="lc-mark">${f.mark || f.name[0]}</div>
      <div class="lc-meta"><span>성 <b>${f.cities.length}</b></span><span>장수 <b>${f.generals.length}</b></span></div>
      <div class="lc-meta lc-stats"><span>통 <b>${lord.lead}</b></span><span>무 <b>${lord.war}</b></span><span>지 <b>${lord.int}</b></span></div>
    </button>`;
  }).join('') + `<button class="btn big cst-lord-entry" data-act="open-custom" data-sc="${sc.id}" style="grid-column:1/-1;margin-top:4px">★ 이 시나리오에서 신군주로 시작</button>`;
}
const SCENARIO_COLORS = {
  jojo: '#3f6fb5', liubei: '#3f9b6b', sunquan: '#c2453f', lubu: '#8a5cc4', yuanshao: '#c08a3e',
  liubiao: '#4a9a9a', liuzhang: '#a8a04a', mateng: '#b06a3a', gongsunzan: '#6a7fb0', sunce: '#c2453f',
  liuyao: '#6a8ab0', yuan_shu: '#b04a8a', zhanglu: '#9a7a5a', taoqian: '#c0a05a', hansui: '#a06a30',
  gongsundu: '#5a8f9a', shixie: '#5a9a6a', free: '#6b6b6b',
};

/* ---------- 신군주(신세력) 생성 ---------- */
let customDraft = null;
const STAT_LABELS = [['lead', '통솔'], ['war', '무력'], ['int', '지력'], ['pol', '정치'], ['cha', '매력']];
const CUSTOM_SKILLS = ['tongsol', 'yongmaeng', 'cheolbyeok', 'dolgyeok', 'sinsan', 'indeok', 'wieom', 'gyeonsu'];
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function openCustomScreen(scenarioId) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  const cities = E.customStartCities(sc.id);
  customDraft = {
    scenarioId: sc.id,
    name: '',
    mark: CUSTOM_MARKS[0],
    color: CUSTOM_COLORS[0].hex,
    style: { hat: 0, beard: 1, skin: 1 },
    ...customDiceFields(E.rollCustomDice()),
    skill: 'tongsol',
    arms: '보병',
    retinue: 0,
    cityId: cities.length ? cities[0].cityId : null,
  };
  renderCustomBody();
  show('scr-custom');
  sfx.click();
}

const customSum = () => STAT_LABELS.reduce((n, [k]) => n + (customDraft.stats[k] || 0), 0);
/* 주사위 결과를 초안에 붙인다 — 전설이면 예산이 뽑힌 총합(450~480)으로 올라간다 */
function customDiceFields(dice) {
  return {
    stats: dice.stats,
    diceTotal: dice.total,
    legend: !!dice.legend,
    budget: E.customStatBudget(dice.legend ? dice.total : 0),
    flash: !!dice.legend,
  };
}

function renderCustomBody() {
  const d = customDraft;
  const sc = SCENARIOS.find((s) => s.id === d.scenarioId);
  const cities = E.customStartCities(d.scenarioId);
  if (!cities.some((c) => c.cityId === d.cityId)) d.cityId = cities.length ? cities[0].cityId : null;
  const owner = cities.find((c) => c.cityId === d.cityId);
  const preview = { ...d.stats, style: d.style };
  const budget = d.budget || E.CUSTOM_STAT_BUDGET;
  const cap = E.customStatCap(budget);
  const flash = !!d.flash;
  d.flash = false;
  const left = budget - customSum();
  const leftHTML = left > 0 ? `<b style="color:#8ed18e">+${left}</b>` : left < 0 ? `<b style="color:#e08a7a">${left}</b>` : '<b>0</b>';
  const groups = {};
  for (const c of cities) (groups[c.region] = groups[c.region] || []).push(c);

  $('#custom-body').innerHTML = `
    <div class="cst-preview" style="--fac:${d.color}">
      <img class="cst-face" src="${portraitURL('cl_lord', preview, 104, d.color, d.style)}" alt="신군주 초상화" />
      <div class="cst-who">
        <div class="cst-flag" style="background:${d.color}">${esc(d.mark)}</div>
        <div class="cst-name" data-live="name">${esc(d.name || '새 군주')}</div>
        <div class="cst-sub">${sc.year}년 ${sc.name}${owner ? ` · ${owner.ko}에서 기상` : ''}</div>
      </div>
    </div>

    <div class="cst-sec">
      <label>시나리오</label>
      <div class="chip-row">${SCENARIOS.map((s) => `<button class="pick-chip ${s.id === d.scenarioId ? 'on' : ''}" data-act="cst-scenario" data-v="${s.id}">${s.year} ${s.name}</button>`).join('')}</div>
    </div>

    <div class="cst-sec">
      <label>군주 이름 <small>2~6자</small></label>
      <input id="cst-name" class="cst-input" maxlength="6" value="${esc(d.name)}" placeholder="예: 한호" autocomplete="off" />
    </div>

    <div class="cst-sec">
      <label>깃발 글자 <small>한글 1자</small></label>
      <div class="chip-row">${CUSTOM_MARKS.map((h) => `<button class="pick-chip ${h === d.mark ? 'on' : ''}" data-act="cst-mark" data-v="${h}" style="min-width:44px;font-size:15px">${h}</button>`).join('')}</div>
      <input id="cst-mark" class="cst-input" maxlength="1" value="${esc(d.mark)}" placeholder="한글 1자 직접 입력" autocomplete="off" />
    </div>

    <div class="cst-sec">
      <label>세력 색</label>
      <div class="cst-colors">${CUSTOM_COLORS.map((c) => `<button class="cst-color ${c.hex === d.color ? 'on' : ''}" data-act="cst-color" data-v="${c.hex}" style="background:${c.hex}" aria-label="${c.ko}" title="${c.ko}"></button>`).join('')}</div>
    </div>

    <div class="cst-sec">
      <label>초상화</label>
      <div class="cst-row"><span class="cst-key">머리</span><div class="chip-row">${PORTRAIT_HATS.map((h) => `<button class="pick-chip ${d.style.hat === h.id ? 'on' : ''}" data-act="cst-style" data-k="hat" data-v="${h.id}">${h.ko}</button>`).join('')}</div></div>
      <div class="cst-row"><span class="cst-key">수염</span><div class="chip-row">${PORTRAIT_BEARDS.map((b) => `<button class="pick-chip ${d.style.beard === b.id ? 'on' : ''}" data-act="cst-style" data-k="beard" data-v="${b.id}">${b.ko}</button>`).join('')}</div></div>
      <div class="cst-row"><span class="cst-key">피부</span><div class="chip-row">${PORTRAIT_SKINS.map((s) => `<button class="pick-chip ${d.style.skin === s.id ? 'on' : ''}" data-act="cst-style" data-k="skin" data-v="${s.id}">${s.ko}</button>`).join('')}</div></div>
    </div>

    <div class="cst-sec">
      <label>능력치 <small>최대 ${budget} · 합계 <span id="cst-sum">${customSum()}</span> · 남은 <span id="cst-left">${leftHTML}</span></small></label>
      ${d.legend ? `<div class="cst-legend${flash ? ' pop' : ''}" id="cst-legend"><span class="cst-legend-tag">✨ 전설 탄생!</span><span class="cst-legend-sub">100번 중 1번 · 총합 ${d.diceTotal}</span></div>` : ''}
      <div class="cst-stats${d.legend ? ' legend' : ''}">
        ${STAT_LABELS.map(([k, ko]) => `<div class="cst-stat"><span>${ko}</span>
          <button data-act="cst-stat" data-k="${k}" data-d="-1" aria-label="${ko} 줄이기">－</button>
          <b data-stat="${k}">${d.stats[k]}</b>
          <button data-act="cst-stat" data-k="${k}" data-d="1" aria-label="${ko} 늘리기">＋</button></div>`).join('')}
      </div>
      <button class="btn ghost cst-dice${d.legend ? ' legend' : ''}" data-act="cst-dice">🎲 주사위로 다시 굴리기</button>
      <p class="note">${d.legend
        ? `전설 주사위입니다. 뽑힌 총합 ${d.diceTotal}을 항목 최대 ${cap}까지 그대로 나눠 씁니다. 남은 점수는 ＋로 넣습니다.`
        : `주사위는 ${E.CUSTOM_STAT_DICE_MIN}~${E.CUSTOM_STAT_BUDGET} 사이 총합으로 나옵니다. 100번 중 1번, 총합 450~480 전설이 터집니다.`}</p>
    </div>

    <div class="cst-sec">
      <label>특기</label>
      <div class="chip-row">${CUSTOM_SKILLS.map((k) => `<button class="pick-chip ${d.skill === k ? 'on' : ''}" data-act="cst-skill" data-v="${k}">${SKILLS[k].ko}</button>`).join('')}</div>
    </div>

    <div class="cst-sec">
      <label>주력 병과</label>
      <div class="chip-row">${['보병', '궁병', '기병', '수군'].map((a) => `<button class="pick-chip ${d.arms === a ? 'on' : ''}" data-act="cst-arms" data-v="${a}">${a}</button>`).join('')}</div>
    </div>

    <div class="cst-sec">
      <label>시작 성 <small>소세력의 성 하나를 받습니다</small></label>
      <select id="cst-city" class="cst-input">
        ${Object.entries(groups).map(([r, list]) => `<optgroup label="${r}">${list.map((c) => `<option value="${c.cityId}" ${c.cityId === d.cityId ? 'selected' : ''}>${c.ko} · ${c.fromName}군 (성 ${c.fromCities}곳·병 ${fmt(c.troops)})</option>`).join('')}</optgroup>`).join('')}
      </select>
      ${owner ? `<p class="note">${owner.ko}은(는) ${owner.fromName}군에서 떨어져 나옵니다. ${owner.fromName}군은 나머지 ${owner.fromCities - 1}성을 지킵니다.</p>` : ''}
    </div>

    <div class="cst-sec">
      <label>휘하 장수 <small>함께 시작하는 신무장</small></label>
      <div class="chip-row">${[0, 1, 2].map((n) => `<button class="pick-chip ${d.retinue === n ? 'on' : ''}" data-act="cst-retinue" data-v="${n}">${n === 0 ? '혼자' : `${n}명 동반`}</button>`).join('')}</div>
    </div>

    <button class="btn big" data-act="cst-start" style="margin:6px 0 20px">「${esc(d.name || '새 군주')}」 세력으로 시작</button>
  `;
  if (mapView) requestAnimationFrame(() => mapView.resize());
}

function adjustCustomStat(k, delta) {
  const budget = customDraft.budget || E.CUSTOM_STAT_BUDGET;
  const r = E.adjustCustomStat(customDraft.stats, k, delta, budget, E.customStatCap(budget));
  if (!r.ok) {
    if (r.reason === 'limit') return;
    if (r.reason === 'budget') toast('배분할 수 있는 능력치를 모두 썼습니다. 다른 항목을 줄이세요.');
    sfx.fail();
    return;
  }
  customDraft.stats = r.stats;
  const cell = $(`[data-stat="${k}"]`);
  if (cell) cell.textContent = customDraft.stats[k];
  const left = budget - customSum();
  const lab = $('#cst-left');
  if (lab) lab.innerHTML = left > 0 ? `<b style="color:#8ed18e">+${left}</b>` : left < 0 ? `<b style="color:#e08a7a">${left}</b>` : '<b>0</b>';
  const sumEl = $('#cst-sum');
  if (sumEl) sumEl.textContent = customSum();
  sfx.click();
}

function startCustomGame() {
  const d = customDraft;
  const name = String($('#cst-name') ? $('#cst-name').value : d.name).trim();
  d.name = name;
  if (name.length < E.CUSTOM_NAME_MIN || name.length > E.CUSTOM_NAME_MAX) {
    toast('군주 이름은 2~6자로 지어 주세요.');
    sfx.fail();
    const inp = $('#cst-name');
    if (inp) inp.focus();
    return;
  }
  const mark = E.customMark(String($('#cst-mark') ? $('#cst-mark').value : d.mark).trim(), name);
  d.mark = mark;
  const cities = E.customStartCities(d.scenarioId);
  const cityId = d.cityId || (cities[0] && cities[0].cityId);
  if (!cityId) { toast('시작 성을 골라 주세요.'); sfx.fail(); return; }
  let custom;
  try {
    custom = E.buildCustomLord({
      name, mark: d.mark, color: d.color, cityId,
      stats: d.stats, skill: d.skill, arms: d.arms,
      retinue: d.retinue, style: d.style,
    });
  } catch (err) {
    toast(err.message);
    sfx.fail();
    return;
  }
  game = E.createGame(d.scenarioId, custom.faction.id, 1 + (Date.now() % 99991), { custom });
  currentScenario = SCENARIOS.find((s) => s.id === d.scenarioId);
  sfx.ok();
  afterGameInit();
  toast(`${custom.faction.name} 세력이 ${CITY_BY_ID[cityId].ko}에서 불기를 올렸습니다!`, 2600);
}

function onCustomInput(e) {
  if (!customDraft) return;
  const t = e.target;
  if (t.id === 'cst-name') {
    customDraft.name = t.value;
    const live = $('[data-live="name"]');
    if (live) live.textContent = t.value || '새 군주';
  } else if (t.id === 'cst-mark') {
    customDraft.mark = (t.value.match(/[가-힣]/) || [''])[0];
    if (t.value !== customDraft.mark) t.value = customDraft.mark;
    const flag = $('.cst-flag');
    if (flag) flag.textContent = customDraft.mark || (customDraft.name || '신')[0];
  } else if (t.id === 'cst-city' && e.type === 'change') {
    customDraft.cityId = t.value;
    renderCustomBody();
  }
}

/* ---------- 게임 시작 ---------- */
function startGame(scenarioId, factionId) {
  game = E.createGame(scenarioId, factionId, 1 + (Date.now() % 99991));
  afterGameInit();
}

function afterGameInit() {
  show('scr-game');
  if (!mapView) {
    mapView = createMapView($('#map'), {
      onSelectCity: (id) => selectCity(id),
      onTapEmpty: () => { selectedCity = null; cityPanelOpen = false; mapView.setSelected(null); renderCityPanel(); },
    });
  }
  mapView.setState(game);
  const playerCities = E.factionCities(game, game.playerId);
  selectedCity = playerCities.length ? playerCities[0].id : null;
  cityPanelOpen = true;
  mapView.setSelected(selectedCity);
  mapView.resetView();
  mapView.resize();
  renderGame();
  autoSave();
  if ((game.pendingPrisoners || []).length) setTimeout(openPrisonerSheet, 500);
}

function autoSave() {
  if (!game) return;
  try { localStorage.setItem(KEYS.auto, E.serialize(game)); } catch (e) { /* 저장 공간 부족 */ }
  Cloud.noteSaved('auto');
  refreshContinue();
}

/* 이어하기 버튼은 자동 저장 유무로 켜고 끈다 */
function refreshContinue() {
  const b = $('#btn-continue');
  if (b) b.disabled = !localStorage.getItem(KEYS.auto);
}

/* ---------- HUD ---------- */
// 자원 수치가 칸 폭을 넘으면 글자를 줄여 한 줄에 담는다(자릿수가 커지는 후반부 대비)
function fitResValues() {
  const sizes = ['', '12px', '11px', '10px'];
  document.querySelectorAll('.resbar .res b').forEach((b) => {
    const cell = b.parentElement;
    for (const size of sizes) {
      b.style.fontSize = size;
      if (cell.scrollWidth <= cell.clientWidth) break;
    }
  });
}

function renderGame() {
  if (!game) return;
  if (!game.gameOver) E.checkVictory(game);
  const f = game.factions[game.playerId];
  const sum = E.factionSummary(game, game.playerId);
  const lord = gd(f.lord);
  $('#hud-crest').textContent = f.mark || f.name[0];
  $('#hud-crest').style.background = '#161b21';
  $('#hud-crest').style.color = f.color;
  $('#hud-crest').style.borderColor = f.color;
  $('#hud-faction').textContent = `${f.name}군${lord && lord.ko !== f.name ? ' · ' + lord.ko : ''}`;
  $('#hud-date').textContent = `${game.year}년 ${game.month}월 · 제${game.turn}턴`;
  const office = E.officeOf(game, game.playerId);
  const officeEl = $('#hud-office');
  if (officeEl) {
    officeEl.textContent = office.ko;
    const nx = E.nextOffice(game, game.playerId);
    officeEl.title = nx ? `다음 관직 ${nx.ko} — 성 ${nx.cities}곳·명성 ${nx.fame}` : '황제의 자리';
  }
  $('#res-gold').textContent = fmt(sum.gold);
  $('#res-food').textContent = fmt(sum.food);
  $('#res-troops').textContent = fmt(sum.troops);
  $('#res-fame').textContent = Math.round(f.fame);
  $('#res-ap').textContent = `${game.actionPoints}/${game.maxActionPoints}`;
  fitResValues();
  $('#turn-hint').textContent = `명령 ${game.actionPoints}`;
  $('#btn-endturn').disabled = !!game.gameOver;


  renderCityPanel();
  if (mapView) {
    mapView.setState(game);
    mapView.setSelected(selectedCity);
  }
  if (game.gameOver) setTimeout(showEnding, 350);
  queueGameNotice();
}

/* 관직 승급·월간 이벤트는 시트가 비어 있을 때 한 번씩 띄운다 */
function queueGameNotice() {
  if (!game || game.gameOver) return;
  E.syncOffices(game);
  clearTimeout(queueGameNotice._t);
  queueGameNotice._t = setTimeout(() => {
    if (!game || !$('#sheet').classList.contains('hidden')) return;
    if ((game.lastPromotions || []).some((p) => p.factionId === game.playerId)) { openPromotionSheet(); return; }
    if (game.pendingTournament && !game.pendingTournament.shown) { game.pendingTournament.shown = true; openTournamentSheet(); return; }
    if (game.pendingEvent && !game.pendingEvent.shown) { game.pendingEvent.shown = true; openEventSheet(); }
  }, 280);
}

function openRegionMenu() {
  const regions = [...new Set(CITIES.map((c) => c.region))];
  const chips = regions.map((r) => {
    const mine = CITIES.filter((c) => c.region === r && game.cities[c.id].owner === game.playerId).length;
    return `<button class="pick-chip ${mine ? 'on' : ''}" data-act="jump-region" data-region="${r}" style="min-width:76px">${r}${mine ? ` <b style="color:#e8c96a">${mine}</b>` : ''}</button>`;
  }).join('');
  openSheet('권역 이동', `<div class="chip-row">${chips}</div>`);
}

function openReports() {
  const rows = game.log.slice(-40).reverse()
    .map((l) => `<div class="report-row"><b>${l.year}.${String(l.month).padStart(2, '0')}</b>${l.text}</div>`).join('');
  openSheet('군보', rows || '<p class="note">아직 기록이 없습니다.</p>');
}

/* ---------- 도시 패널 ---------- */
function selectCity(id) {
  if (id !== selectedCity) { cityPanelOpen = true; cityCmdGroup = null; } // 새 성을 탭하면 다시 펼침
  selectedCity = id;
  sfx.select();
  if (mapView) { mapView.setSelected(id); }
  renderCityPanel();
}

/* 내 성을 지도 순서(북→남)대로 돌려보기 */
function ownCityIds() {
  if (!game) return [];
  const order = new Map(CITIES.map((c, i) => [c.id, i]));
  return E.factionCities(game, game.playerId).map((c) => c.id)
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

function stepCity(dir) {
  if (!game || !selectedCity) return false;
  cityCmdGroup = null;
  const ids = ownCityIds();
  if (!ids.length) { toast('내 성이 없습니다.'); sfx.fail(); return false; }
  const cur = ids.indexOf(selectedCity);
  const next = cur < 0
    ? (dir > 0 ? ids[0] : ids[ids.length - 1])
    : ids[(cur + dir + ids.length) % ids.length];
  if (next === selectedCity) {
    if (mapView) mapView.focusCity(next);
    return false;
  }
  selectedCity = next;
  sfx.select();
  if (mapView) { mapView.setSelected(next); mapView.focusCity(next); }
  renderCityPanel(dir);
  return true;
}

/* 하단 도시 패널 좌우 스와이프 → 내 성 전환 (장수 줄·입력칸은 양보) */
let suppressClickUntil = 0;
let swipeState = null;

function bindCityPanelSwipe() {
  const panel = $('#citypanel');
  if (!panel || panel.dataset.swipeBound) return;
  panel.dataset.swipeBound = '1';

  const usable = (target) => !target.closest('.cp-gens') && !target.closest('input, select, textarea');

  const begin = (x, y) => {
    if (!selectedCity) return;
    swipeState = { x, y, t: Date.now(), dx: 0, dy: 0, axis: null };
  };
  const move = (x, y, ev) => {
    const s = swipeState;
    if (!s) return false;
    s.dx = x - s.x;
    s.dy = y - s.y;
    if (!s.axis && (Math.abs(s.dx) > 9 || Math.abs(s.dy) > 9)) {
      s.axis = Math.abs(s.dx) > Math.abs(s.dy) * 1.35 ? 'x' : 'y';
    }
    if (s.axis === 'x') {
      if (ev && ev.cancelable) ev.preventDefault();
      panel.style.transform = `translateX(${Math.max(-18, Math.min(18, s.dx * 0.22))}px)`;
    }
    return s.axis === 'x';
  };
  const finish = () => {
    const s = swipeState;
    swipeState = null;
    panel.style.transform = '';
    if (!s || s.axis !== 'x') return;
    const dt = Date.now() - s.t;
    const dist = Math.abs(s.dx);
    if (!(dist > 52 || (dist > 30 && dt < 500))) return;
    suppressClickUntil = Date.now() + 350;
    stepCity(s.dx < 0 ? 1 : -1);
  };

  // 터치: 브라우저 스크롤과 경합하지 않게 touch 이벤트로 처리
  panel.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || !usable(e.target)) return;
    begin(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    move(e.touches[0].clientX, e.touches[0].clientY, e);
  }, { passive: false });
  panel.addEventListener('touchend', finish);
  panel.addEventListener('touchcancel', () => { swipeState = null; panel.style.transform = ''; });

  // 마우스: 넓은 화면에서 드래그로도 넘김
  panel.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !usable(e.target)) return;
    begin(e.clientX, e.clientY);
  });
  panel.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    move(e.clientX, e.clientY, null);
  });
  panel.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') finish(); });
  panel.addEventListener('pointercancel', (e) => { if (e.pointerType === 'mouse') { swipeState = null; panel.style.transform = ''; } });
}

/* ---------- 성 명령 카테고리 (내정 · 인사 · 군사) ---------- */
/* 세부 명령은 시트 안에 펼치지 않고 버튼 위에 뜨는 팝오버로 보여 준다(시트 높이 고정) */
const CITY_CMD_GROUPS = [
  { id: 'civil', ko: '내정', hint: '개발·교역', subs: [
    ['agri', '개발'], ['comm', '상업'], ['order', '치안'], ['water', '수리'], ['trade', '교역'], ['transport', '수송'],
  ] },
  { id: 'people', ko: '인사', hint: '등용·이동', subs: [
    ['search', '탐색'], ['hire', '등용'], ['move', '이동'], ['talk', '대화'], ['reward', '포상'], ['advisor', '참모'],
  ] },
  { id: 'army', ko: '군사', hint: '징병·출진', subs: [
    ['draft', '징병', '2령'], ['train', '훈련'], ['march', '출진'],
  ] },
];
let cityCmdGroup = null;
let cmdCtx = null;       // 팝오버가 쓰는 현재 성의 조건(행동력·친밀도 등)
let cmdPopEl = null;

function cmdPopoverEl() {
  if (!cmdPopEl) {
    cmdPopEl = document.createElement('div');
    cmdPopEl.id = 'cmdp';
    cmdPopEl.className = 'cmdp hidden';
    cmdPopEl.setAttribute('role', 'menu');
    document.body.appendChild(cmdPopEl);
  }
  return cmdPopEl;
}

function hideCmdPopover() {
  const pop = cmdPopoverEl();
  pop.classList.add('hidden');
  pop.innerHTML = '';
  pop.dataset.group = '';
}

/* 팝오버 안의 세부 명령 버튼 — 예전 2차 줄과 같은 실행 경로(data-act)를 쓴다 */
function cmdSubHTML(group, ctx) {
  return group.subs.map(([k, ko, hint]) => {
    const city = `data-city="${ctx.cityId}"`;
    if (k === 'march') {
      return ctx.enemies.length
        ? `<button class="btn march" role="menuitem" data-act="march" ${city}>${ko}<small>${ctx.enemies.length}곳</small></button>`
        : `<button class="btn" role="menuitem" disabled>${ko}<small>적 성 없음</small></button>`;
    }
    if (k === 'advisor') {
      const adv = E.advisorOf(game);
      return `<button class="btn" role="menuitem" data-act="advisor">${ko}<small>${adv ? adv.ko : '지력 최고'}</small></button>`;
    }
    const off = k === 'move' ? !ctx.moveReady
      : k === 'talk' ? (!ctx.partners.length || !ctx.talkLeft || game.actionPoints < 1)
      : k === 'trade' ? game.actionPoints < 1
      : false;
    const note = k === 'move' ? ctx.moveSub : k === 'talk' ? ctx.talkSub : k === 'trade' ? `쌀 ${E.ricePriceOf(game)}` : hint;
    return `<button class="btn ${k === 'move' || k === 'talk' ? k : ''}" role="menuitem" data-act="cmd" data-cmd="${k}" ${city} ${off ? 'disabled' : ''}>${ko}${note ? `<small>${note}</small>` : ''}</button>`;
  }).join('');
}

/* 열린 묶음의 팝오버를 그린다. 시트 안이 아니라 body에 fixed로 붙어 높이를 밀지 않는다 */
function syncCmdPopover() {
  const pop = cmdPopoverEl();
  $$('#citypanel .cmd-tab').forEach((b) => {
    const on = !!cityCmdGroup && b.dataset.group === cityCmdGroup;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const panel = $('#citypanel');
  const group = CITY_CMD_GROUPS.find((g) => g.id === cityCmdGroup);
  if (!group || !cmdCtx || !panel || panel.classList.contains('hidden') || !panel.classList.contains('open')) {
    hideCmdPopover();
    return;
  }
  pop.setAttribute('aria-label', `${group.ko} 명령`);
  pop.dataset.group = group.id;
  pop.innerHTML = cmdSubHTML(group, cmdCtx);
  pop.classList.remove('hidden');
  placeCmdPopover();
}

/* 누른 1차 버튼 바로 위에 붙이고, 꼬리가 버튼 가운데를 가리키게 한다 */
function placeCmdPopover() {
  if (!cmdPopEl || cmdPopEl.classList.contains('hidden') || !cityCmdGroup) return;
  const anchor = document.querySelector(`#citypanel [data-act="cmd-group"][data-group="${cityCmdGroup}"]`);
  if (!anchor) { hideCmdPopover(); return; }
  const r = anchor.getBoundingClientRect();
  if (!r.width) { hideCmdPopover(); return; }
  const n = Math.max(1, cmdPopEl.children.length);
  const vw = window.innerWidth;
  const w = Math.min(vw - 16, n * 62 + (n - 1) * 5 + 12);
  const left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2));
  cmdPopEl.style.width = `${w}px`;
  cmdPopEl.style.left = `${left}px`;
  cmdPopEl.style.top = 'auto';
  cmdPopEl.style.bottom = `${Math.max(8, window.innerHeight - r.top + 9)}px`;
  const tail = Math.max(15, Math.min(w - 15, r.left + r.width / 2 - left));
  cmdPopEl.style.setProperty('--tail', `${tail}px`);
}

/* 팝오버 바깥(지도·다른 버튼)을 누르면 닫힌다 */
function onDocPointerDown(e) {
  if (!cityCmdGroup) return;
  if (cmdPopEl && cmdPopEl.contains(e.target)) return;
  if (e.target.closest && e.target.closest('[data-act="cmd-group"]')) return;
  cityCmdGroup = null;
  syncCmdPopover();
}

function renderCityPanel(dir = 0) {
  const panel = $('#citypanel');
  if (!selectedCity) { panel.classList.add('hidden'); cmdCtx = null; syncCmdPopover(); return; }
  const c = game.cities[selectedCity];
  const base = CITY_BY_ID[selectedCity];
  const mine = c.owner === game.playerId;
  const ownerName = c.owner ? fname(c.owner) : '재야';
  const gens = mine ? E.generalsInCity(game, selectedCity) : Object.values(game.generals).filter((g) => g.city === selectedCity && g.faction === c.owner && !g.captive && !g.dead);
  const genHTML = gens.slice(0, 12).map((g) => {
    const t = gd(g.id);
    return `<button class="gen-chip ${g.acted ? 'done' : ''}" data-act="gen-detail" data-gid="${g.id}" title="${t.ko} 능력치" aria-label="${t.ko} 능력치 보기">
      <img src="${portraitURL(g.id, t, 32, colorOf(g.faction))}" alt="${t.ko}" />
      <span>${t.ko}</span></button>`;
  }).join('');

  let cmdHTML = '';
  if (mine) {
    const ownCount = E.factionCities(game, game.playerId).length;
    const partners = E.talkPartners(game, selectedCity);
    const talkLeft = partners.filter((g) => !E.talkedThisTurn(game, g.id) && g.loyalty < 100).length;
    const moveReady = ownCount > 1 && E.generalsInCity(game, selectedCity).some((g) => !g.acted);
    const moveSub = ownCount > 1 ? (moveReady ? '행동력 1' : '움직일 장수 없음') : '성 2곳부터';
    const talkSub = !partners.length ? '대상 없음' : (talkLeft ? '행동력 1' : '이번 달 완료');
    const plotFoes = E.neighborFoes(game, selectedCity).filter((n) => !E.isPacified(game, game.playerId, game.cities[n].owner));
    const plotReady = plotFoes.length > 0 && E.generalsInCity(game, selectedCity).some((g) => !g.acted) && game.actionPoints >= 1;
    const plotSub = !plotFoes.length ? '적 성 없음' : (game.actionPoints >= 1 ? '행동력 1' : '행동력 부족');
    const enemies = E.adjacentEnemies(game, selectedCity);
    // 1차 메뉴: 내정 · 인사 · 군사 · 외교 · 계략 (외교·계략은 세부 명령 없이 바로 실행)
    const tabs = CITY_CMD_GROUPS.map((g) => {
      const on = cityCmdGroup === g.id;
      return `<button class="btn cmd-tab ${on ? 'on' : ''}" data-act="cmd-group" data-group="${g.id}" data-city="${selectedCity}" aria-pressed="${on}">${g.ko}<small>${g.hint}</small></button>`;
    }).join('');
    const diploSub = game.actionPoints >= 1 ? '증정·동맹' : '행동력 부족';
    const diploTab = `<button class="btn diplo" data-act="diplomacy" data-city="${selectedCity}">외교<small>${diploSub}</small></button>`;
    cmdHTML = `<div class="cp-cmds">${tabs}${diploTab}<button class="btn ${plotReady ? 'plot' : ''}" data-act="cmd" data-cmd="plot" data-city="${selectedCity}" ${plotReady ? '' : 'disabled'}>계략<small>${plotSub}</small></button></div>`;
    cmdCtx = { cityId: selectedCity, moveReady, moveSub, talkSub, partners, talkLeft, enemies };
  } else {
    cmdCtx = null;
    const pacified = !!c.owner && E.isPacified(game, game.playerId, c.owner);
    const src = pacified ? [] : E.adjacentFriends(game, selectedCity).filter((id) => E.generalsInCity(game, id).length);
    const plotSrc = E.adjacentFriends(game, selectedCity).filter((id) => E.generalsInCity(game, id).length);
    if (c.owner) {
      cmdHTML = src.length
        ? `<button class="btn march" data-act="attack-enemy" data-city="${selectedCity}" style="grid-column:span 2">공격</button>`
        : `<button class="btn" disabled style="grid-column:span 2">${pacified ? (E.isAllied(game, game.playerId, c.owner) ? '동맹 중' : '정전 중') : '공격 불가'}</button>`;
      cmdHTML += plotSrc.length && !pacified
        ? `<button class="btn plot" data-act="plot-city" data-city="${selectedCity}" style="grid-column:span 2">계략</button>`
        : `<button class="btn" disabled style="grid-column:span 2">${pacified ? '계략 불가' : '계략 불가'}</button>`;
    } else {
      cmdHTML = '<button class="btn" disabled style="grid-column:span 2">공격 불가</button>';
    }
    cmdHTML = `<div class="cp-cmds">${cmdHTML}</div>`;
  }

  const own = ownCityIds();
  const ownIdx = own.indexOf(selectedCity);
  let scoutHTML = '';
  if (!mine && c.owner) {
    if (E.isScouted(game, selectedCity)) {
      const si = E.scoutedInfo(game, selectedCity);
      scoutHTML = `<div class="sc-box">
        <div class="sc-head">정탐 정보 <span>${E.scoutTurnsLeft(game, selectedCity)}턴 남음</span></div>
        <div class="sc-meta">훈련 ${si.train} · 치안 ${si.order} · 방어 ${si.def} · 금 ${fmt(si.gold)} · 량 ${fmt(si.food)}</div>
        <div class="sc-gens">${si.generals.map((g) => `<div class="sc-gen"><b>${g.ko}</b><span>통${g.lead} 무${g.war} 지${g.int} 충${g.loyalty}</span></div>`).join('') || '<span class="none">주둔 장수 없음</span>'}</div>
      </div>`;
    } else {
      scoutHTML = '<div class="sc-hint">정탐을 보내면 적 성의 장수·충성·훈련을 3턴 동안 살필 수 있습니다.</div>';
    }
  }
  const showNav = own.length > 1 || (own.length === 1 && ownIdx === -1);
  const navHTML = showNav
    ? `<div class="cs-nav" role="group" aria-label="내 성 이동">
        <button class="cs-navbtn" data-act="city-prev" aria-label="이전 내 성">‹</button>
        <span class="cs-navidx">${ownIdx >= 0 ? `${ownIdx + 1}/${own.length}` : `내 성 ${own.length}`}</span>
        <button class="cs-navbtn" data-act="city-next" aria-label="다음 내 성">›</button>
      </div>`
    : '';

  panel.classList.remove('hidden', 'swipe-next', 'swipe-prev');
  panel.classList.toggle('open', cityPanelOpen);
  panel.dataset.city = selectedCity;
  panel.style.transform = '';
  const deleg = mine ? E.delegationOf(game, selectedCity) : 'none';
  const delegHTML = mine
    ? `<div class="cs-deleg" role="group" aria-label="담당">
        <span class="dlg-label">담당</span>
        ${Object.entries(E.DELEGATIONS).map(([k, d]) => `<button class="dlg-chip ${deleg === k ? 'on' : ''}" data-act="deleg" data-mode="${k}" aria-pressed="${deleg === k}">${d.ko}</button>`).join('')}
        <small>위임하면 턴이 바뀔 때 스스로 일합니다</small>
      </div>`
    : '';
  panel.innerHTML = `
    <div class="cs-head">
      <div class="cs-row">
        <div class="cs-id"><span class="region-tag">${base.region}</span><b class="cs-name">${base.ko}</b></div>
        <span class="cs-owner" style="color:${colorOf(c.owner)}">${ownerName}</span>
        ${navHTML}
        <div class="cs-actions">
          <button class="cs-toggle" data-act="city-toggle">${cityPanelOpen ? '접기 ▾' : '명령 ▴'}</button>
          <button class="cs-close" data-act="close-city" aria-label="닫기">✕</button>
        </div>
      </div>
      <div class="cs-brief">
        <div class="cs-brief-main">
          <span>병 <b>${fmt(c.troops)}</b></span><span>금 <b>${fmt(c.gold)}</b></span><span>량 <b>${fmt(c.food)}</b></span><span>방 <b>${c.def}</b></span>
        </div>
      </div>
    </div>
    <div class="cs-body">
      <div class="cs-stats">
        <div class="stat"><i>농업</i><b>${c.agri}</b></div>
        <div class="stat"><i>상업</i><b>${c.comm}</b></div>
        <div class="stat"><i>치안</i><b>${c.order}</b></div>
        <div class="stat"><i>수리</i><b>${c.water}</b></div>
        <div class="stat"><i>병력</i><b>${fmt(c.troops)}</b></div>
        <div class="stat"><i>훈련</i><b>${c.train}</b></div>
        <div class="stat"><i>금</i><b>${fmt(c.gold)}</b></div>
        <div class="stat"><i>식량</i><b>${fmt(c.food)}</b></div>
      </div>
      ${gens.length ? `<div class="cp-gens">${genHTML}</div>` : '<div class="cp-gens"><span class="none">주둔 장수 없음</span></div>'}
      ${delegHTML}
      ${scoutHTML}
      <div class="cp-cmds-wrap">${cmdHTML}</div>
    </div>
    ${cityPanelOpen ? '' : `<button class="cs-handle" data-act="city-toggle" aria-label="성 메뉴 펼치기"><span>▲</span>성 메뉴</button>`}
  `;
  const bodyEl = panel.querySelector('.cs-body');
  if (bodyEl) bodyEl.addEventListener('scroll', placeCmdPopover, { passive: true });
  syncCmdPopover();
  if (dir) {
    void panel.offsetWidth; // 애니메이션 재시작
    panel.classList.add(dir > 0 ? 'swipe-next' : 'swipe-prev');
  }
  if (mapView) requestAnimationFrame(() => mapView.resize());
}

/* ---------- 시트 ---------- */
function openSheet(title, html) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.remove('hidden');
}
function closeSheet() { $('#sheet').classList.add('hidden'); }

function officerRowHTML(g, actionAct, extra = '', disabledHint = '') {
  const t = gd(g.id);
  const done = g.acted || g.captive;
  return `<button class="officer-row ${done ? 'done' : ''}" data-act="${actionAct}" data-officer="${g.id}" ${done ? 'disabled' : ''}>
    <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
    <div class="or-main">
      <div class="or-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
      <div class="or-stats"><span>통<b>${t.lead}</b></span><span>무<b>${t.war}</b></span><span>지<b>${t.int}</b></span><span>정<b>${t.pol}</b></span><span>매<b>${t.cha}</b></span><span>충<b>${g.loyalty}</b></span><span>친<b>${E.affinityOf(game, g.id)}</b></span></div>
    </div>
    <div class="or-go">${done ? '완료' : extra || '선택'}</div>
  </button>`;
}
function skillName(id) {
  const map = { hwagye: '화계', hollan: '혼란', gomu: '고무', chiryo: '치료', jeogyeok: '저격', dolgyeok: '돌격', cheolbyeok: '철벽', sujeon: '수전', sinsan: '신산', tongsol: '통솔', yongmaeng: '용맹', wieom: '위엄', indeok: '인덕', gyeonsu: '견수', hogwi: '호위', bigyeok: '비장', pokgyeok: '폭격' };
  return map[id] || id;
}

let sheetCommandType = null;
let sheetCityId = null;

function openCommandSheet(type, cityId) {
  sheetCommandType = type;
  sheetCityId = cityId;
  const c = game.cities[cityId];
  const label = E.COMMANDS[type] ? E.COMMANDS[type].ko : type;
  const gens = E.generalsInCity(game, cityId);
  if (!gens.length) { toast('이 성에는 명령을 내릴 장수가 없습니다.'); sfx.fail(); return; }
  if (type === 'hire') {
    const free = E.freeGeneralsInCity(game, cityId);
    if (!free.length) { toast('이 성에 재야 장수가 없습니다.'); sfx.fail(); return; }
    const officer = E.bestOfficer(game, cityId, 'cha');
    const need = E.commandCost('hire');
    const ap = game.actionPoints;
    const block = !officer
      ? '이번 달에 명령할 수 있는 장수가 없습니다. 이 성 장수가 모두 명령을 마쳤으니 다음 달에 다시 시도하세요.'
      : ap < need ? `행동력이 부족합니다. (필요 ${need} · 남은 ${ap})` : null;
    if (block) toast(block, 2800);
    const rows = free.map((g) => {
      const t = gd(g.id);
      const aff = E.affinityOf(game, g.id);
      const chance = Math.round(E.hireChance(game, cityId, g.id, officer ? officer.id : null) * 100);
      const bef = E.befriendCheck(game, g.id).ok;
      return `<div class="officer-row hire">
        <img src="${portraitURL(g.id, t, 40, '#444')}" alt="${t.ko}" />
        <div class="or-main"><div class="or-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
        <div class="or-stats"><span>통<b>${t.lead}</b></span><span>무<b>${t.war}</b></span><span>지<b>${t.int}</b></span><span>매<b>${t.cha}</b></span></div>
        <div class="or-stats"><span>친밀 <b>${aff}</b> ${E.affinityLabel(aff)}</span><span>등용 성공률 <b>${chance}%</b></span></div></div>
        <div class="pw-btns">
          <button class="pw-btn rel" data-act="befriend" data-gid="${g.id}" data-city="${cityId}" ${bef ? '' : 'disabled'}>친교 200</button>
          <button class="pw-btn rec" data-act="do-hire" data-officer="${g.id}" data-city="${cityId}" ${block ? 'disabled' : ''}>등용</button>
        </div>
      </div>`;
    }).join('');
    const warn = block ? `<div class="warn-box">${block}</div>` : '';
    openSheet(`${cityId ? CITY_BY_ID[cityId].ko : ''} 등용`, `${warn}<p class="note">친밀도가 낮으면 고개를 숙이지 않습니다. 친교(금 200 · 행동력 1)로 친밀도를 쌓은 뒤 등용하세요. 등용은 군주 매력과 명성으로 겨룹니다.</p>${rows}`);
    return;
  }
  if (type === 'transport') {
    openTransportSheet(cityId);
    return;
  }
  if (type === 'reward') {
    const targets = gens.filter((g) => g.id !== game.factions[game.playerId].lord);
    const rows = targets.sort((a, b) => a.loyalty - b.loyalty).map((g) => {
      const t = gd(g.id);
      return `<button class="officer-row" data-act="do-reward" data-officer="${g.id}" data-city="${cityId}">
        <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
        <div class="or-main"><div class="or-name">${t.ko}</div>
        <div class="or-stats"><span>충성 <b>${g.loyalty}</b></span><span>친밀 <b>${E.affinityOf(game, g.id)}</b></span><span>매력 <b>${t.cha}</b></span></div></div>
        <div class="or-go">포상</div></button>`;
    }).join('');
    openSheet('포상 — 금 120', `<p class="note">포상할 장수를 고르면 충성이 오르고 친밀도도 조금 오릅니다.</p>${rows || '<p class="note">포상할 장수가 없습니다.</p>'}`);
    return;
  }
  const rows = gens.map((g) => officerRowHTML(g, 'do-command')).join('');
  const extra = type === 'draft' ? '<p class="note">징병: 금 250 · 식량 400 · 행동력 2. 징병한 장수의 통솔이 많을수록 병력이 많이 모입니다.</p>'
    : type === 'search' ? '<p class="note">탐색: 숨은 인재·금·식량을 찾습니다. 지력이 높을수록 유리합니다.</p>'
    : `<p class="note">${E.COMMANDS[type] ? E.COMMANDS[type].desc : ''} 행동력 1을 사용합니다.</p>`;
  openSheet(`${CITY_BY_ID[cityId].ko} — ${label}`, extra + rows);
}

function openTransportSheet(cityId) {
  const targets = E.adjacentFriends(game, cityId);
  const c = game.cities[cityId];
  const gens = E.generalsInCity(game, cityId);
  openSheet(`${CITY_BY_ID[cityId].ko} 수송`,
    `<p class="note">인접한 아군 성으로 금·식량을 보냅니다. 보낼 장수와 대상을 고르세요.</p>
     <div class="chip-row" id="tr-targets">${targets.map((t, i) => `<button class="pick-chip ${i === 0 ? 'on' : ''}" data-act="tr-target" data-city="${t}">${CITY_BY_ID[t].ko}</button>`).join('')}</div>
     <div class="field-row"><label>금 (보유 ${fmt(c.gold)})</label><div class="stepper"><button data-act="tr-gold-" data-city="${cityId}">－</button><input id="tr-gold" type="number" value="0" min="0" max="${c.gold}" inputmode="numeric" /><button data-act="tr-gold+" data-city="${cityId}">＋</button></div></div>
     <div class="field-row"><label>식량 (보유 ${fmt(c.food)})</label><div class="stepper"><button data-act="tr-food-" data-city="${cityId}">－</button><input id="tr-food" type="number" value="0" min="0" max="${c.food}" inputmode="numeric" /><button data-act="tr-food+" data-city="${cityId}">＋</button></div></div>
     <div id="tr-officers">${gens.map((g) => officerRowHTML(g, 'do-transport')).join('')}</div>
     <p class="note" id="tr-note">보낼 장수를 고르면 실행됩니다.</p>`);
  uiState.trTarget = targets[0];
  uiState.trGold = 0; uiState.trFood = 0;
}
const uiState = { trTarget: null, trGold: 0, trFood: 0 };

/* ---------- 명령 실행 ---------- */
function doCommand(type, officerId, cityId) {
  const res = E.runCommand(game, type, { cityId, officerId });
  closeSheet();
  if (res.ok) { sfx.ok(); toast(res.msg); }
  else { sfx.fail(); toast(res.msg); }
  renderGame();
  autoSave();
}

function doHire(cityId, gid) {
  const officer = E.bestOfficer(game, cityId, 'cha');
  const need = E.commandCost('hire');
  if (!officer) {
    toast('등용에 나설 장수가 없습니다 — 이 성 장수가 모두 이번 달 명령을 마쳤습니다.', 2800);
    sfx.fail();
    openCommandSheet('hire', cityId);
    return;
  }
  if (game.actionPoints < need) {
    toast(`행동력이 부족합니다. (필요 ${need} · 남은 ${game.actionPoints})`, 2800);
    sfx.fail();
    openCommandSheet('hire', cityId);
    return;
  }
  const res = E.runCommand(game, 'hire', { cityId, officerId: officer.id, hireId: gid });
  closeSheet();
  if (res.ok) { sfx.ok(); toast(res.msg); } else { sfx.fail(); toast(res.msg, 2600); }
  renderGame(); autoSave();
}

/* 친교 — 금 200 · 행동력 1 → 친밀도 +12~18 */
function doBefriend(gid) {
  const res = E.befriend(game, gid);
  if (!res.ok) { sfx.fail(); toast(res.msg, 2400); return; }
  sfx.coin(); toast(res.msg, 2400);
  renderGame(); autoSave();
  // 열어 둔 모달의 친밀도·성공률을 바로 갱신
  if (!$('#sheet').classList.contains('hidden')) {
    const title = $('#sheet-title') ? $('#sheet-title').textContent : '';
    if (title.includes('등용') && sheetCityId) openCommandSheet('hire', sheetCityId);
    else if (title.includes('계략') && plotDraft) renderPlotSheet();
  }
}

function doReward(cityId, gid) {
  const officer = E.bestOfficer(game, cityId, 'cha');
  if (!officer) return;
  const res = E.runCommand(game, 'reward', { cityId, officerId: officer.id, rewardId: gid });
  closeSheet();
  if (res.ok) { sfx.coin(); toast(res.msg); } else { sfx.fail(); toast(res.msg); }
  renderGame(); autoSave();
}

/* ---------- 도시간 장수 이동 ---------- */
let moveDraft = null;

function openMoveSheet(cityId) {
  const dests = E.moveDestinations(game, cityId);
  if (!dests.length) { toast('옮겨 갈 다른 내 성이 없습니다.'); sfx.fail(); return; }
  const ready = E.generalsInCity(game, cityId).filter((g) => !g.acted);
  if (!ready.length) { toast('이번 달에 움직일 수 있는 장수가 없습니다.'); sfx.fail(); return; }
  moveDraft = { fromCityId: cityId, toCityId: dests[0].cityId, gids: [] };
  renderMoveSheet();
  sfx.click();
}

function toggleMoveGeneral(gid) {
  if (!moveDraft) return;
  const i = moveDraft.gids.indexOf(gid);
  if (i >= 0) moveDraft.gids.splice(i, 1); else moveDraft.gids.push(gid);
  renderMoveSheet();
  sfx.click();
}

function renderMoveSheet() {
  const d = moveDraft;
  if (!d) return;
  const fromName = CITY_BY_ID[d.fromCityId].ko;
  const gens = E.generalsInCity(game, d.fromCityId);
  const lordId = game.factions[game.playerId].lord;
  const rows = gens.map((g) => {
    const t = gd(g.id);
    const on = d.gids.includes(g.id);
    const done = !!g.acted;
    return `<button class="officer-row ${done ? 'done' : ''} ${on ? 'picked' : ''}" data-act="mv-gen" data-officer="${g.id}" ${done ? 'disabled' : ''}>
      <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
      <div class="or-main">
        <div class="or-name">${t.ko}${g.id === lordId ? ' <i class="mv-lord">군주</i>' : ''} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
        <div class="or-stats"><span>통<b>${t.lead}</b></span><span>무<b>${t.war}</b></span><span>지<b>${t.int}</b></span><span>충<b>${g.loyalty}</b></span></div>
      </div>
      <div class="or-go">${done ? '완료' : on ? '선택됨' : '선택'}</div>
    </button>`;
  }).join('');
  const dests = E.moveDestinations(game, d.fromCityId).map((x) => {
    const on = x.cityId === d.toCityId;
    return `<button class="mv-dest ${on ? 'on' : ''}" data-act="mv-dest" data-city="${x.cityId}">
      <b>${x.ko}</b>
      <span>장수 ${x.generals}명 · 병력 ${fmt(x.troops)}</span>
      <span class="mv-go-tag">${on ? '도착' : '고르기'}</span>
    </button>`;
  }).join('');
  const dest = E.moveDestinations(game, d.fromCityId).find((x) => x.cityId === d.toCityId);
  const check = E.canMoveGenerals(game, d.fromCityId, d.toCityId, d.gids);
  const room = dest ? E.MAX_OFFICERS_PER_CITY - dest.generals : 0;
  const over = !!dest && d.gids.length > room;
  let warn = '';
  if (d.gids.length && check.ok && check.warning) warn = `<p class="note warn">${check.warning}</p>`;
  else if (over) warn = `<p class="note warn">${dest.ko}의 장수 자리가 ${room}명 남았습니다. 선택을 줄여 주세요.</p>`;
  else if (d.gids.length && !check.ok) warn = `<p class="note warn">${check.why}</p>`;
  openSheet(`${fromName} — 장수 이동`,
    `<p class="note">옮길 장수를 고르고 도착할 성을 정하세요. 행동력 1을 쓰고, 옮긴 장수는 이번 달 행동을 마칩니다.</p>
     <p class="note" style="margin-top:8px">도착 성</p>
     <div class="mv-dest-row">${dests}</div>
     <p class="note">옮길 장수 — ${fromName} 주둔 ${gens.length}명</p>
     ${rows}
     <p class="note" style="margin-top:8px">아군 성끼리는 어디든 옮길 수 있습니다. 성을 완전히 비우면 적에게 그대로 노출됩니다.</p>
     <div class="sheet-foot">
       ${warn}
       <button class="btn big" data-act="mv-go" ${d.gids.length && check.ok && !over ? '' : 'disabled'}>
         ${E.withJosa(CITY_BY_ID[d.toCityId].ko, '로')} 이동 · ${d.gids.length}명 (행동력 1)
       </button>
     </div>`);
}

function doMoveGenerals() {
  const d = moveDraft;
  if (!d) return;
  const res = E.moveGenerals(game, d.fromCityId, d.toCityId, d.gids);
  closeSheet();
  moveDraft = null;
  if (res.ok) { sfx.ok(); toast(res.msg + (res.warning ? ' ' + res.warning : ''), 2800); }
  else { sfx.fail(); toast(res.msg); }
  renderGame();
  autoSave();
}

/* ---------- 장수 대화 ---------- */
function openTalkSheet(cityId) {
  const partners = E.talkPartners(game, cityId);
  if (!partners.length) { toast('이 성에는 이야기할 장수가 없습니다.'); sfx.fail(); return; }
  sheetCityId = cityId;
  renderTalkSheet();
  sfx.click();
}

function renderTalkSheet() {
  const cityId = sheetCityId;
  const partners = E.talkPartners(game, cityId);
  const rows = partners.map((g) => {
    const t = gd(g.id);
    const talked = E.talkedThisTurn(game, g.id);
    const maxed = g.loyalty >= 100;
    const off = talked || maxed || game.actionPoints < 1;
    const tag = talked ? '이번 달 완료' : maxed ? '충성 최대' : '대화';
    return `<button class="officer-row ${off ? 'done' : ''}" data-act="talk-go" data-officer="${g.id}" ${off ? 'disabled' : ''}>
      <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
      <div class="or-main">
        <div class="or-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
        <div class="or-stats"><span>매력 <b>${t.cha}</b></span><span>충성 <b>${g.loyalty}</b></span></div>
        <div class="or-loy"><div class="loy-bar"><i style="width:${g.loyalty}%"></i></div><span>${g.loyalty}/100</span></div>
      </div>
      <div class="or-go">${tag}</div>
    </button>`;
  }).join('');
  openSheet(`${CITY_BY_ID[cityId].ko} — 대화`,
    `<p class="note">장수와 이야기를 나누면 충성도가 오릅니다(기본 4~8, 군주 매력·인덕 보정, 최대 100). 금은 들지 않고 행동력 1을 쓰며, 장수마다 한 달에 한 번입니다.</p>
     ${rows}`);
}

function doTalk(gid) {
  const res = E.talkToGeneral(game, sheetCityId, gid);
  if (!res.ok) { sfx.fail(); toast(res.msg); return; }
  sfx.ok();
  renderTalkScene(gid, res);
  renderGame();
  autoSave();
}

function renderTalkScene(gid, res) {
  const t = gd(gid);
  const lord = gd(game.factions[game.playerId].lord);
  openSheet(`${E.withJosa(t.ko, '과')}의 대화`,
    `<div class="talk-scene">
      <div class="talk-who">
        <img src="${portraitURL(gid, t, 64, colorOf(game.playerId))}" alt="${t.ko}" />
        <div style="flex:1">
          <div class="talk-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
          <div class="talk-loy">충성 <b>${res.before}</b> → <b class="up">${res.after}</b><em>+${res.gain}</em></div>
          <div class="loy-bar"><i style="width:${res.after}%"></i></div>
        </div>
      </div>
      <p class="talk-line"><b>${t.ko}</b>“${res.line.g}”</p>
      <p class="talk-line lord"><b>${lord.ko}</b>“${res.line.l}”</p>
    </div>
    <button class="btn big" data-act="talk-more" style="margin-top:12px">다른 장수와 대화</button>
    <button class="btn big ghost" data-act="sheet-close" style="margin-top:6px">닫기</button>`);
}

/* ---------- 출진 ---------- */
function openMarchSheet(cityId, targetId = null) {
  const enemies = E.adjacentEnemies(game, cityId);
  if (!enemies.length) { toast('인접한 적 성이 없습니다.'); sfx.fail(); return; }
  const c = game.cities[cityId];
  const gens = E.generalsInCity(game, cityId);
  const targets = targetId ? enemies.filter((e) => e === targetId) : enemies;
  pendingSetup = {
    cityId, targetId: targets[0], generals: gens.slice(0, 5).map((g) => g.id),
    ratio: 1,
    forms: {},
    focus: gens.length ? gens[0].id : null,
    reinforce: [],
  };
  openSheet(`${CITY_BY_ID[cityId].ko} 출진`, marchSheetHTML());
}

function marchSheetHTML() {
  const p = pendingSetup;
  const c = game.cities[p.cityId];
  const gens = E.generalsInCity(game, p.cityId);
  const enemies = E.adjacentEnemies(game, p.cityId);
  const target = game.cities[p.targetId];
  const tname = fname(target.owner);
  const defPower = E.cityPower(game, p.targetId, true);
  const myPower = Math.round(c.troops * (0.7 + c.train / 180) * 0.95);
  return `
    <div class="field-row"><label>공격 대상</label><div class="chip-row" style="margin:0">
      ${enemies.map((e) => `<button class="pick-chip ${e === p.targetId ? 'on' : ''}" data-act="march-target" data-city="${e}">${CITY_BY_ID[e].ko}</button>`).join('')}
    </div></div>
    <p class="note">${CITY_BY_ID[p.targetId].ko}: ${tname}군 · 병력 ${fmt(target.troops)} · 성 방어 ${target.def}<br>
    예상 전력 — 아군 ${fmt(myPower * p.ratio)} vs 수비 ${fmt(defPower)}${myPower * p.ratio > defPower ? ' <span style="color:#8ed18e">(우세)</span>' : ' <span style="color:#e08a7a">(열세)</span>'}</p>
    <div class="field-row"><label>출진 병력 ${fmt(Math.round(c.troops * p.ratio))} / ${fmt(c.troops)}</label>
      <div class="stepper"><button data-act="march-ratio-" >－</button><input id="march-ratio" type="number" value="${Math.round(p.ratio * 100)}" min="20" max="100" />%<button data-act="march-ratio+">＋</button></div></div>
    <p class="note">출진 장수 (최대 5명)</p>
    <div class="chip-row">${gens.map((g) => {
      const t = gd(g.id);
      const on = p.generals.includes(g.id);
      return `<button class="pick-chip ${on ? 'on' : ''}" data-act="march-gen" data-officer="${g.id}">${t.ko} <b style="color:#9c9270">무${t.war}</b></button>`;
    }).join('')}</div>
    ${formationPickerHTML()}
    ${reinforcePickerHTML()}
    <button class="btn big" data-act="march-go" style="margin-top:12px" ${p.generals.length ? '' : 'disabled'}>${CITY_BY_ID[p.targetId].ko}으로 출진 (${p.generals.length}부대)</button>
    <p class="note">전투에서는 부대별 이동·공격·계략과 일기토를 지휘합니다. 정면보다 측면(×1.25)·배후(×1.5)를 노리세요.</p>`;
}

/* 원군 — 인접한 아군·동맹 성에서 최대 2부대 동행 */
function reinforcePickerHTML() {
  const p = pendingSetup;
  const cands = E.reinforcementCandidates(game, [p.cityId], game.playerId, [p.cityId, p.targetId]);
  if (!cands.length) {
    return `<p class="note" style="margin-top:10px">원군 — 인접한 아군·동맹 성에 보낼 여유 병력이 없습니다.</p>`;
  }
  const chips = cands.map((c) => {
    const on = p.reinforce.includes(c.cityId);
    return `<button class="pick-chip ${on ? 'on' : ''}" data-act="march-reinforce" data-city="${c.cityId}">
      ${c.city} ${c.gname} <b style="color:${c.ally ? '#8fc0e8' : '#9c9270'}">${fmt(c.troops)}</b>${c.ally ? ' <i class="mr-ally">동맹</i>' : ''}
    </button>`;
  }).join('');
  return `<p class="note" style="margin-top:12px">원군 — 인접한 아군·동맹 성에서 최대 ${E.REINFORCE_MAX}부대 (<b>${p.reinforce.length}/${E.REINFORCE_MAX}</b>)</p>
    <div class="chip-row">${chips}</div>
    <p class="note">원군은 2라운드에 전장 가장자리로 들어옵니다. 보낸 성의 병력은 그만큼 줄어듭니다.</p>`;
}

/* 출진 전 진형 고르기 — 장수별 대형 미리보기 + 상성 */
function formOfPick(gid) {
  const t = gd(gid);
  const own = (t.formations && t.formations.length ? t.formations : ['eorin']).filter((f) => FORMATIONS[f]);
  const picked = pendingSetup.forms[gid];
  return picked && own.includes(picked) ? picked : own[0];
}

function formationPickerHTML() {
  const p = pendingSetup;
  if (!p.generals.length) return '';
  const rows = p.generals.map((gid) => {
    const t = gd(gid);
    const own = (t.formations || ['eorin']).filter((f) => FORMATIONS[f]);
    const cur = formOfPick(gid);
    return `<div class="fp-row">
      <span class="fp-name">${t.ko}</span>
      <div class="fp-chips">${own.map((fid) => {
        const f = FORMATIONS[fid];
        return `<button class="fp-chip ${fid === cur ? 'on' : ''}" data-act="march-form" data-officer="${gid}" data-form="${fid}" aria-label="${t.ko} ${f.ko}">
          ${formationSVG(fid, 'E', 22)}<span>${f.ko}</span></button>`;
      }).join('')}</div>
    </div>`;
  }).join('');
  const focus = p.focus && p.generals.includes(p.focus) ? p.focus : p.generals[0];
  const cur = FORMATIONS[formOfPick(focus)] || FORMATIONS.eorin;
  const grp = formationGroup(cur.id);
  const cols = Object.values(FORMATION_GROUPS).map((g) => `<div class="fl-col">
      <b class="fg-${g.id}">${g.ko}진</b>
      ${g.forms.filter((f) => FORMATIONS[f]).map((f) => `<span class="fl-item">${formationSVG(f, 'E', 16)}${FORMATIONS[f].ko}</span>`).join('')}
    </div>`).join('');
  return `<div class="form-pick-box">
    <p class="note" style="margin:12px 0 4px">진형 — 장수마다 대형과 상성이 다릅니다</p>
    ${rows}
    <div class="fp-detail">
      <b>${cur.ko}</b>
      ${grp ? `<em class="fg-${grp.id}">${grp.ko}진</em>` : ''}
      <span>${cur.desc}</span>
      <span class="fp-ct">${formationCounterText(cur.id)}</span>
    </div>
    <div class="form-legend">${cols}</div>
    <p class="note" style="margin-top:6px">돌격 → 포위 → 방어 → 돌격 순환 · 유리 ×1.25 · 불리 ×0.85</p>
  </div>`;
}

function openAttackEnemySheet(enemyCityId) {
  const sources = E.adjacentFriends(game, enemyCityId).filter((id) => E.generalsInCity(game, id).length && game.cities[id].troops >= 1000);
  if (!sources.length) { toast('공격할 수 있는 인접 아군 성이 없습니다.'); sfx.fail(); return; }
  openSheet(`${CITY_BY_ID[enemyCityId].ko} 공격`, `<p class="note">어느 성에서 출진할지 고르세요.</p>
    ${sources.map((s) => `<button class="officer-row" data-act="march-from" data-city="${s}" data-to="${enemyCityId}">
      <img src="${portraitURL(Object.values(game.generals).find((g) => g.city === s && g.faction === game.playerId)?.id || game.factions[game.playerId].lord, gd(game.factions[game.playerId].lord), 40, colorOf(game.playerId))}" alt="" />
      <div class="or-main"><div class="or-name">${CITY_BY_ID[s].ko}</div><div class="or-stats"><span>병력 <b>${fmt(game.cities[s].troops)}</b></span><span>장수 <b>${E.generalsInCity(game, s).length}</b></span></div></div>
      <div class="or-go">출진</div></button>`).join('')}`);
}

function startPlayerBattle() {
  const p = pendingSetup;
  const c = game.cities[p.cityId];
  const troops = Math.round(c.troops * p.ratio);
  // 원군 병력은 battleSetup이 미리 빼 두고, 전장에는 R2에 합류한다
  const setup = E.battleSetup(game, p.cityId, p.targetId, {
    atkGenerals: p.generals,
    atkTroops: troops,
    atkReinforcements: p.reinforce || [],
  });
  setup.formations = Object.fromEntries(p.generals.map((gid) => [gid, formOfPick(gid)]));
  closeSheet();
  beginBattle(setup, 'atk');
}

/* ---------- 전투 ---------- */
function beginBattle(setup, playerSide) {
  battle = B.createBattle({ ...setup, seed: (battleSeedCounter++), playerSide, generals: E.generalMap(game) });
  battleSel = null; battleMode = null; battleBusy = false;
  lastBattleResult = null;
  show('scr-battle');
  setTimeout(resizeBattleCanvas, 20);
  renderBattle();
  sfx.battle();
  if (battle.phase !== battle.playerSide) enemyPhase();
}

/* 전장 바닥 톤 — 따뜻한 흙바닥 · 돌 · 물빛 */
const BATTLE_TILE = {
  plain: ['#3c3823', '#2a2817'], road: ['#4c4230', '#332c1f'],
  forest: ['#26361f', '#1a2617'], hill: ['#453a26', '#2c2618'],
  water: ['#1b4b57', '#0d2b34'], castle: ['#4a4030', '#2c2618'],
};

function resizeBattleCanvas() {
  const c = $('#battle-canvas');
  if (!c) return;
  const wrap = c.parentElement;
  const cssW = Math.max(200, wrap.clientWidth - 2);
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const tile = Math.floor(cssW / B.BW);
  c.style.width = (tile * B.BW) + 'px';
  c.style.height = (tile * B.BH) + 'px';
  c.width = Math.round(tile * B.BW * dpr);
  c.height = Math.round(tile * B.BH * dpr);
  c._tile = tile; c._dpr = dpr;
  renderBattle();
}

function drawBattle() {
  const c = $('#battle-canvas');
  if (!c || !battle) return;
  const tile = c._tile || 28;
  const dpr = c._dpr || 1;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const vw = tile * B.BW, vh = tile * B.BH;
  ctx.fillStyle = '#0c0a07';
  ctx.fillRect(0, 0, vw, vh);

  const reach = battleSel && battleMode === 'move' && battleSel.side === battle.playerSide ? B.reachable(battle, battleSel) : null;
  const atkTargets = battleSel && battleMode === 'attack' ? B.targetsFor(battle, battleSel) : [];
  const tacTargets = battleSel && battleMode && battleMode.startsWith('tactic:') ? battle.units.filter((u) => u.alive && (battleMode.endsWith('rally') || battleMode.endsWith('heal') ? u.side === battleSel.side : u.side !== battleSel.side) && B.dist(battleSel, u) <= 3) : [];

  for (const t of battle.grid) {
    const x = t.x * tile, y = t.y * tile;
    const tone = BATTLE_TILE[t.t] || BATTLE_TILE.plain;
    const g = ctx.createLinearGradient(0, y, 0, y + tile);
    g.addColorStop(0, tone[0]);
    g.addColorStop(0.55, tone[0]);
    g.addColorStop(1, tone[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, tile, tile);
    // 흙 알갱이 — 타일마다 같은 자리에
    for (let i = 0; i < 5; i++) {
      const hx = Math.abs(Math.sin((t.x * 7 + i * 13.3) * 12.9898)) % 1;
      const hy = Math.abs(Math.sin((t.y * 5 + i * 7.7) * 78.233)) % 1;
      ctx.fillStyle = i % 2 ? 'rgba(255, 230, 180, 0.06)' : 'rgba(10, 8, 4, 0.12)';
      ctx.fillRect(x + hx * tile * 0.9, y + hy * tile * 0.9, 1.2, 1.2);
    }

    if (t.t === 'forest') {
      for (let i = 0; i < 3; i++) {
        const px = x + tile * (0.24 + i * 0.26) + (i % 2 ? tile * 0.04 : 0);
        const py = y + tile * (0.72 + (i % 2) * 0.06);
        const ph = tile * (0.3 + (i % 2) * 0.05);
        ctx.beginPath();
        ctx.ellipse(px + tile * 0.04, py + tile * 0.02, tile * 0.11, tile * 0.04, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8, 10, 5, 0.4)';
        ctx.fill();
        for (let k = 0; k < 2; k++) {
          const yy = py - ph * (0.15 + k * 0.4);
          ctx.beginPath();
          ctx.moveTo(px, yy - ph * 0.5);
          ctx.lineTo(px + tile * 0.11, yy);
          ctx.lineTo(px - tile * 0.11, yy);
          ctx.closePath();
          ctx.fillStyle = k ? '#3c5c30' : '#2c4526';
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(px, yy - ph * 0.5);
          ctx.lineTo(px - tile * 0.1, yy);
          ctx.lineTo(px - tile * 0.02, yy);
          ctx.closePath();
          ctx.fillStyle = 'rgba(180, 220, 140, 0.16)';
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(40, 28, 14, 0.9)';
        ctx.fillRect(px - 0.8, py - ph * 0.1, 1.6, ph * 0.16);
      }
    } else if (t.t === 'hill') {
      const cx = x + tile * 0.5, cy = y + tile * 0.68;
      const rg = ctx.createLinearGradient(cx - tile * 0.4, cy - tile * 0.4, cx + tile * 0.4, cy);
      rg.addColorStop(0, '#6b5c3c');
      rg.addColorStop(0.55, '#4a3f28');
      rg.addColorStop(1, '#262012');
      ctx.beginPath();
      ctx.moveTo(x + tile * 0.14, cy);
      ctx.quadraticCurveTo(cx - tile * 0.1, y + tile * 0.26, cx + tile * 0.04, y + tile * 0.3);
      ctx.quadraticCurveTo(x + tile * 0.62, y + tile * 0.38, x + tile * 0.9, cy);
      ctx.closePath();
      ctx.fillStyle = rg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 226, 170, 0.2)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x + tile * 0.22, cy - tile * 0.02);
      ctx.quadraticCurveTo(cx - tile * 0.06, y + tile * 0.32, cx + tile * 0.06, y + tile * 0.34);
      ctx.stroke();
    } else if (t.t === 'water') {
      ctx.strokeStyle = 'rgba(140, 210, 220, 0.24)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const wy = y + tile * (0.36 + i * 0.26);
        ctx.beginPath();
        ctx.moveTo(x + tile * 0.12, wy);
        ctx.quadraticCurveTo(x + tile * 0.36, wy - tile * 0.06, x + tile * 0.58, wy);
        ctx.quadraticCurveTo(x + tile * 0.76, wy + tile * 0.04, x + tile * 0.9, wy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(180, 235, 240, 0.1)';
      ctx.fillRect(x, y, tile, 1);
    } else if (t.t === 'castle') {
      // 성벽 — 위에서 본 두꺼운 돌담
      ctx.fillStyle = 'rgba(20, 16, 10, 0.35)';
      ctx.fillRect(x, y + tile * 0.08, tile, tile * 0.9);
      ctx.fillStyle = '#6a5c42';
      ctx.fillRect(x, y + tile * 0.1, tile, tile * 0.74);
      ctx.fillStyle = 'rgba(255, 232, 180, 0.18)';
      ctx.fillRect(x, y + tile * 0.1, tile, 1.4);
      ctx.strokeStyle = 'rgba(24, 18, 10, 0.4)';
      ctx.lineWidth = 0.8;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + tile * (0.1 + i * 0.18));
        ctx.lineTo(x + tile, y + tile * (0.1 + i * 0.18));
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(255, 226, 176, 0.28)';
        ctx.fillRect(x + tile * (0.12 + i * 0.3), y + tile * 0.02, tile * 0.14, tile * 0.1);
        ctx.fillStyle = 'rgba(10, 8, 4, 0.4)';
        ctx.fillRect(x + tile * (0.12 + i * 0.3), y + tile * 0.12, tile * 0.14, tile * 0.04);
      }
    } else if (t.t === 'road') {
      ctx.strokeStyle = 'rgba(232, 200, 140, 0.14)';
      ctx.lineWidth = Math.max(1, tile * 0.06);
      ctx.beginPath();
      ctx.moveTo(x + tile * 0.32, y);
      ctx.lineTo(x + tile * 0.32, y + tile);
      ctx.moveTo(x + tile * 0.68, y);
      ctx.lineTo(x + tile * 0.68, y + tile);
      ctx.stroke();
    } else {
      // 평지 풀섶
      if ((t.x * 3 + t.y * 5) % 7 === 0) {
        ctx.strokeStyle = 'rgba(140, 170, 96, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const gx = x + tile * (0.3 + i * 0.18), gy = y + tile * 0.78;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx - 1.2, gy - tile * 0.1);
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + 1.4, gy - tile * 0.12);
          ctx.stroke();
        }
      }
    }

    if (reach && reach.has(t.y * battle.w + t.x)) {
      ctx.fillStyle = 'rgba(110, 170, 230, 0.16)';
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      ctx.strokeStyle = 'rgba(160, 215, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
    }
    if (atkTargets.some((u) => u.x === t.x && u.y === t.y) || tacTargets.some((u) => u.x === t.x && u.y === t.y)) {
      ctx.strokeStyle = 'rgba(240, 110, 80, 0.92)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
    }
    ctx.strokeStyle = 'rgba(240, 206, 150, 0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, tile, tile);
  }

  // 햇빛 — 좌상단에서 따뜻하게, 아래로 비네트
  const lg = ctx.createLinearGradient(0, 0, vw * 0.6, vh);
  lg.addColorStop(0, 'rgba(255, 200, 130, 0.12)');
  lg.addColorStop(0.5, 'rgba(255, 180, 100, 0.03)');
  lg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, vw, vh);
  const vg = ctx.createRadialGradient(vw / 2, vh * 0.45, Math.min(vw, vh) * 0.3, vw / 2, vh * 0.45, Math.max(vw, vh) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, vw, vh);

  for (const u of battle.units) {
    if (!u.alive) continue;
    drawBattleUnit(ctx, u, tile, u === battleSel);
  }
  // 공격 예상(정면/측면/배후 · 진형 상성) 힌트
  if (battleSel && battleMode === 'attack') {
    for (const t of atkTargets) drawAttackHint(ctx, t, tile);
  }
}

/* 진영 색 — 아군은 청, 적은 홍 */
function sidePalette(side) {
  const isPlayer = battle && side === battle.playerSide;
  return isPlayer
    ? { plate: 'rgba(24, 46, 68, 0.62)', edge: 'rgba(136, 190, 240, 0.7)', dot: '#a8cdf2', shade: '#0b1420', tip: '#ffd79a', text: '#d8ebff', metal: '#7fa8d0' }
    : { plate: 'rgba(62, 26, 22, 0.6)', edge: 'rgba(232, 148, 128, 0.66)', dot: '#eab0a0', shade: '#1e0f0c', tip: '#ffd79a', text: '#ffd2c6', metal: '#c98a76' };
}

function pixelText(ctx, text, x, y, size, fill, align = 'center') {
  ctx.font = `600 ${size}px "Gmarket Sans", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(6, 5, 3, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

/* 부대 토큰 — 2.5D 판금 판 위에 진형 대형 · 정면 창벽 */
function drawBattleUnit(ctx, u, tile, selected) {
  const x = u.x * tile, y = u.y * tile;
  const pal = sidePalette(u.side);
  const dir = u.dir || 'E';
  const pad = Math.max(1.5, tile * 0.05);
  const r = Math.max(2, tile * 0.11);

  // 바닥 그림자
  ctx.beginPath();
  ctx.ellipse(x + tile / 2 + tile * 0.05, y + tile * 0.9, tile * 0.36, tile * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(6, 5, 3, 0.45)';
  ctx.fill();

  // 판 — 위는 밝고 아래는 어두운 2.5D 금속판
  const px = x + pad, py = y + pad, pw = tile - pad * 2, ph = tile - pad * 2;
  const pg = ctx.createLinearGradient(px, py, px + pw * 0.6, py + ph);
  pg.addColorStop(0, lightenish(pal.plate, 0.16));
  pg.addColorStop(0.55, pal.plate);
  pg.addColorStop(1, 'rgba(8, 10, 14, 0.72)');
  roundRect(ctx, px, py, pw, ph, r);
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.strokeStyle = selected ? '#ffe6b0' : pal.edge;
  ctx.lineWidth = selected ? 1.8 : 1;
  ctx.stroke();
  // 윗면 하이라이트
  ctx.beginPath();
  ctx.moveTo(px + r, py + 1);
  ctx.lineTo(px + pw - r, py + 1);
  ctx.strokeStyle = 'rgba(255, 240, 210, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 정면 창벽 — 바라보는 쪽에 세운 금빛 창 세 자루
  const bw = Math.max(2.2, tile * 0.075);
  const drawWall = (x0, y0, w, h, vertical) => {
    ctx.fillStyle = '#e8c884';
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = 'rgba(40, 26, 10, 0.45)';
    if (vertical) {
      for (let i = 0; i < 3; i++) ctx.fillRect(x0 + w * 0.1, y0 + h * (0.16 + i * 0.3), w * 0.8, Math.max(1, h * 0.06));
    } else {
      for (let i = 0; i < 3; i++) ctx.fillRect(x0 + w * (0.16 + i * 0.3), y0 + h * 0.1, Math.max(1, w * 0.06), h * 0.8);
    }
  };
  if (dir === 'E') drawWall(px + pw - bw - 1, py + tile * 0.12, bw, ph - tile * 0.24, true);
  else if (dir === 'W') drawWall(px + 1, py + tile * 0.12, bw, ph - tile * 0.24, true);
  else if (dir === 'N') drawWall(px + tile * 0.12, py + 1, pw - tile * 0.24, bw, false);
  else drawWall(px + tile * 0.12, py + ph - bw - 1, pw - tile * 0.24, bw, false);

  // 진형 대형 — 판 위쪽
  drawFormation(ctx, u.formation, x + tile / 2, y + tile * 0.3, tile * 0.56, dir, pal);

  // 아래 띠: 이름 + 병력
  const bandH = Math.max(14, Math.round(tile * 0.4));
  const by = y + tile - bandH;
  const bg = ctx.createLinearGradient(0, by, 0, y + tile);
  bg.addColorStop(0, 'rgba(20, 15, 10, 0.92)');
  bg.addColorStop(1, 'rgba(8, 6, 4, 0.96)');
  ctx.fillStyle = bg;
  ctx.fillRect(x + pad, by, tile - pad * 2, bandH - 1);
  ctx.strokeStyle = 'rgba(240, 200, 140, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + pad, by + 0.5);
  ctx.lineTo(x + tile - pad, by + 0.5);
  ctx.stroke();
  const ratio = Math.max(0, Math.min(1, u.troops / 4000));
  const bar = ctx.createLinearGradient(x + pad, 0, x + tile - pad, 0);
  bar.addColorStop(0, ratio > 0.4 ? '#7fae62' : '#c98d46');
  bar.addColorStop(1, ratio > 0.4 ? '#c8e29a' : '#f0c07a');
  ctx.fillStyle = bar;
  ctx.fillRect(x + pad, by, (tile - pad * 2) * ratio, 1.6);
  pixelText(ctx, u.name, x + tile / 2, by + bandH * 0.38, Math.max(7, Math.min(9.5, tile * 0.24)), '#f6ecd4', 'center');
  pixelText(ctx, fmt(u.troops), x + tile / 2, by + bandH * 0.8, Math.max(6, Math.min(7.5, tile * 0.2)), pal.text, 'center');

  if (u.acted) {
    ctx.fillStyle = 'rgba(8, 7, 5, 0.42)';
    roundRect(ctx, px, py, pw, ph, r);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/* rgba 문자열을 밝게/어둡게 */
function lightenish(rgbaStr, amt) {
  const m = String(rgbaStr).match(/rgba?\(([^)]+)\)/);
  if (!m) return rgbaStr;
  const parts = m[1].split(',').map((v) => parseFloat(v));
  const a = parts.length > 3 ? parts[3] : 1;
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v + (amt >= 0 ? (255 - v) * amt : v * amt))));
  return `rgba(${cl(parts[0])},${cl(parts[1])},${cl(parts[2])},${a})`;
}

/* 공격 타겟 위에 정면/측면/배후와 배율을 띄운다 */
function drawAttackHint(ctx, t, tile) {
  const e = B.attackEdge(battleSel, t);
  const label = `${B.SIDE_KO[e.side]}${e.mult !== 1 ? ' ×' + e.mult.toFixed(2) : ''}`;
  const extra = e.relation === 'advantage' ? '진형↑' : e.relation === 'disadvantage' ? '진형↓' : '';
  const cx = t.x * tile + tile / 2;
  const top = t.y * tile;
  ctx.font = `600 7px "Gmarket Sans", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
  const w = Math.max(ctx.measureText(label).width, ctx.measureText(extra).width) + 6;
  const h = extra ? 15 : 9;
  const bx = Math.max(1, Math.min(battle.w * tile - w - 1, cx - w / 2));
  const by = top > h + 1 ? top - h - 1 : top + 1;
  const tone = e.side === 'rear' ? '#ff6a4d' : e.side === 'flank' ? '#ffb15c' : '#9fb6c8';
  ctx.fillStyle = 'rgba(8,11,18,0.92)';
  ctx.fillRect(bx, by, w, h);
  ctx.strokeStyle = tone; ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = tone;
  ctx.fillText(label, bx + w / 2, by + (extra ? 5 : h / 2));
  if (extra) {
    ctx.fillStyle = e.relation === 'advantage' ? '#8ed18e' : '#e08a7a';
    ctx.fillText(extra, bx + w / 2, by + 11);
  }
}

function unitCardHTML(u, selected) {
  const t = gd(u.gid);
  const isPlayer = u.side === battle.playerSide;
  return `<button class="pick-chip bt-card ${selected ? 'on' : ''} ${u.acted ? 'done' : ''}" data-act="bt-select" data-unit="${u.id}">
    ${formationSVG(u.formation, u.dir || 'E', 20, isPlayer ? {} : { body: '#f0b3a3', shade: '#3c1310' })}
    <span class="bc-main">
      <span class="bc-name">${u.name}${u.confused > 0 ? ' <i class="bu-chaos">혼란</i>' : ''}</span>
      <b class="bc-troop">${fmt(u.troops)}</b>
      <span class="bc-morale">사기 ${Math.round(u.morale)}</span>
    </span>
  </button>`;
}

/* 선택한 부대 — 진형 대형 미리보기와 상성·방향 안내 */
function unitInfoHTML(u) {
  const f = B.formOf(u);
  const grp = formationGroup(u.formation);
  const rel = formationCounterText(u.formation);
  const dirKo = DIR_KO[u.dir || 'E'] || '동';
  return `<div class="bt-unitinfo">
    ${formationSVG(u.formation, u.dir || 'E', 34)}
    <div class="bu-main">
      <div class="bu-name"><b>${u.name}</b> <span>${fmt(u.troops)} · 사기 ${Math.round(u.morale)}</span>${u.acted ? ' <i class="bu-done">행동 완료</i>' : ''}${u.confused > 0 ? ' <i class="bu-chaos">혼란</i>' : ''}</div>
      <div class="bu-form">${f.ko} <em class="fg-${grp ? grp.id : 'none'}">${grp ? grp.ko + '진' : ''}</em> · ${dirKo}쪽을 바라봄</div>
      <div class="bu-ct">${rel}</div>
    </div>
  </div>`;
}

/* 전장 아래 진형 상성표 — 지금 어떤 진형이 무엇에 강한지 바로 보이게 */
function battleGuideHTML() {
  const cols = Object.values(FORMATION_GROUPS).map((g) => `<div class="bg-col">
      <b class="fg-${g.id}">${g.ko}진</b>
      ${g.forms.filter((f) => FORMATIONS[f]).map((f) => `<span class="bg-item${battleSel && battleSel.formation === f ? ' on' : ''}">${formationSVG(f, 'E', 15)}${FORMATIONS[f].ko}</span>`).join('')}
    </div>`).join('');
  return `<div class="bg-head">진형 상성 <span>돌격 → 포위 → 방어 → 돌격</span></div>
    <div class="bg-cols">${cols}</div>
    <div class="bg-tip">노란 창벽이 정면 — 옆에서 치면 <b class="lg-flank">측면 ×1.25</b>, 뒤에서 치면 <b class="lg-rear">배후 ×1.50</b></div>`;
}

/* 하단 전술 안내 — 방향 배율과 진형 상성 순환 */
function battleLegendHTML() {
  return `<div class="bt-legend-row">
    <span class="lg-front">정면 ×1.00</span> <span class="lg-flank">측면 ×1.25</span> <span class="lg-rear">배후 ×1.50</span>
    <span class="lg-sep">|</span>
    <span class="lg-charge">돌격</span>→<span class="lg-pincer">포위</span>→<span class="lg-guard">방어</span>→<span class="lg-charge">돌격</span>
    <small>유리 ×1.25 · 불리 ×0.85</small>
  </div>`;
}

function renderBattle() {
  if (!battle) return;
  const my = battle.playerSide;
  $('#bt-name').textContent = `${CITY_BY_ID[battle.toCityId].ko} 전투 · R${battle.round}`;
  $('#bt-round').textContent = battle.over ? '전투 종료' : `${battle.phase === my ? '내 차례' : '적의 차례'} · ${battle.phase === 'atk' ? '공격측 행동' : '수비측 행동'}`;
  const atkAlive = B.unitsOf(battle, 'atk'), defAlive = B.unitsOf(battle, 'def');
  const atkTroops = atkAlive.reduce((s, u) => s + u.troops, 0);
  const defTroops = defAlive.reduce((s, u) => s + u.troops, 0);
  const isAtkPlayer = my === 'atk';
  $('#bt-side').innerHTML = `<b style="color:${isAtkPlayer ? '#7ec4ff' : '#ff9a8a'}">${isAtkPlayer ? '공격' : '수비'}</b> 아군 ${fmt(isAtkPlayer ? atkTroops : defTroops)}<br><b>${isAtkPlayer ? '수비' : '공격'}</b> 적 ${fmt(isAtkPlayer ? defTroops : atkTroops)}`;

  drawBattle();

  const mine = battle.units.filter((u) => u.side === my && u.alive);
  const info = battleSel ? unitInfoHTML(battleSel) : '';
  $('#bt-info').innerHTML = info;
  $('#bt-legend').innerHTML = battleLegendHTML();
  $('#bt-guide').innerHTML = battleGuideHTML();

  $('#bt-log').innerHTML = battle.log.slice(-40).map((l) => {
    const cls = /\[원군 도착!\]/.test(l) ? 'rein' : /\[배후 기습!\]/.test(l) ? 'hi' : /\[측면 공격!\]|\[진형 유리!\]/.test(l) ? 'hi' : /\[진형 불리\]|궤멸/.test(l) ? 'bad' : '';
    return `<div class="${cls}">${l}</div>`;
  }).join('');
  $('#bt-log').scrollTop = $('#bt-log').scrollHeight;

  const canAct = !battleBusy && !battle.over && battle.phase === my && battleSel && !battleSel.acted && battleSel.side === my;
  const duelReady = canAct && B.duelOptions(battle, battleSel).length > 0;
  $('#bt-cmds').innerHTML = `
    <button class="btn" data-act="bt-move" ${canAct ? '' : 'disabled'}>이동</button>
    <button class="btn" data-act="bt-attack" ${canAct && B.targetsFor(battle, battleSel).length ? '' : 'disabled'}>공격</button>
    <button class="btn" data-act="bt-tactic" ${canAct ? '' : 'disabled'}>계략</button>
    <button class="btn" data-act="bt-duel" ${duelReady ? '' : 'disabled'}>일기토</button>
    <button class="btn" data-act="bt-wait" ${canAct ? '' : 'disabled'}>대기</button>
  `;
  $('#bt-next').textContent = battle.phase === my ? '진행 ▶' : '적 행동…';
  $('#bt-next').disabled = battleBusy || battle.phase !== my || !!battle.over;
  const cards = mine.map((u) => unitCardHTML(u, u === battleSel)).join('');
  if (cards) $('#bt-info').insertAdjacentHTML('beforeend', `<div style="display:flex;gap:4px;overflow-x:auto;margin-top:4px">${cards}</div>`);
}

function battleTap(clientX, clientY) {
  const c = $('#battle-canvas');
  const rect = c.getBoundingClientRect();
  const tile = c._tile || 28;
  const x = Math.floor((clientX - rect.left) / tile);
  const y = Math.floor((clientY - rect.top) / tile);
  if (x < 0 || y < 0 || x >= battle.w || y >= battle.h) return;
  if (battleBusy || battle.over) return;
  const u = battle.units.find((o) => o.alive && o.x === x && o.y === y);
  const my = battle.playerSide;

  if (battleMode === 'move' && battleSel) {
    const r = B.moveUnit(battle, battleSel, x, y);
    if (r.ok) { sfx.march(); battleMode = null; }
    else toast(r.msg, 1200);
    renderBattle();
    return;
  }
  if (battleMode === 'attack' && battleSel) {
    if (u && u.side !== my) {
      const seed = Math.floor(Math.random() * 99999);
      const r = B.attack(battle, battleSel, u, seed);
      if (r.ok) { sfx.hit(); battleMode = null; }
      renderBattle();
      checkBattleOver();
    }
    return;
  }
  if (battleMode && battleMode.startsWith('tactic:') && battleSel) {
    const kind = battleMode.split(':')[1];
    if (u) {
      const seed = Math.floor(Math.random() * 99999);
      const r = B.tactic(battle, battleSel, u, kind, seed);
      if (r.ok) { sfx.tactic(); battleMode = null; toast(r.lines && r.lines[0] ? r.lines[0] : '계략', 1500); }
    }
    renderBattle();
    checkBattleOver();
    return;
  }
  if (u) {
    if (u.side === my && battle.phase === my) { battleSel = u; battleMode = null; sfx.click(); }
    else { battleSel = u; battleMode = null; sfx.click(); }
    renderBattle();
  }
}

function checkBattleOver() {
  if (!battle) return;
  if (B.checkEnd(battle)) setTimeout(finishBattle, 600);
}

function enemyPhase() {
  if (!battle || battle.over) { finishBattle(); return; }
  battleBusy = true;
  const side = battle.phase;
  const units = B.unitsOf(battle, side);
  let i = 0;
  const step = () => {
    if (!battle) return;
    if (battle.over) { finishBattle(); return; }
    if (i >= units.length) {
      B.nextPhase(battle);
      renderBattle();
      if (battle.over) { finishBattle(); return; }
      if (battle.phase !== battle.playerSide) { setTimeout(enemyPhase, 300); return; }
      battleBusy = false; renderBattle(); return;
    }
    const u = units[i++];
    if (u.alive && !u.acted) {
      B.aiUnitAct(battle, u, () => Math.random());
      sfx.hit();
      renderBattle();
    }
    setTimeout(step, 170);
  };
  setTimeout(step, 200);
}

function allOut() {
  if (!battle || battleBusy || battle.over || battle.phase !== battle.playerSide) return;
  battleBusy = true;
  battleSel = null; battleMode = null;
  renderBattle();
  const units = B.unitsOf(battle, battle.playerSide);
  let i = 0;
  const step = () => {
    if (!battle) return;
    if (battle.over) { finishBattle(); return; }
    if (i >= units.length) {
      battleBusy = false;
      playerNext();
      return;
    }
    const u = units[i++];
    if (u.alive && !u.acted) {
      B.aiUnitAct(battle, u, () => Math.random());
      sfx.hit();
      renderBattle();
    }
    setTimeout(step, 190);
  };
  setTimeout(step, 150);
}

function playerNext() {
  if (!battle || battleBusy || battle.over) return;
  if (battle.phase !== battle.playerSide) return;
  const myUnits = B.unitsOf(battle, battle.playerSide);
  if (myUnits.some((u) => !u.acted)) {
    // 남은 부대 자동 대기 후 넘김
    myUnits.forEach((u) => { if (!u.acted) B.endUnit(u); });
  }
  B.nextPhase(battle);
  renderBattle();
  if (battle.over) { finishBattle(); return; }
  if (battle.phase !== battle.playerSide) enemyPhase();
}

function retreat() {
  if (!battle) return;
  battle.over = battle.playerSide === 'atk' ? 'def' : 'atk';
  finishBattle();
}

function finishBattle() {
  if (!battle) return;
  if (lastBattleResult) return;
  const res = B.battleResult(battle);
  lastBattleResult = res;
  const win = (res.winner === 'attacker' && battle.playerSide === 'atk') || (res.winner === 'defender' && battle.playerSide === 'def');
  const iAmAttacker = battle.playerSide === 'atk';
  const summary = iAmAttacker
    ? `아군 손실 ${fmt(res.atkLoss)} · 적 손실 ${fmt(res.defLoss)}`
    : `아군 손실 ${fmt(res.defLoss)} · 적 손실 ${fmt(res.atkLoss)}`;
  if (win) sfx.win(); else sfx.lose();

  // 엔진 반영 (포로는 여기서 붙잡혀 처분 대기 상태가 된다)
  const applied = E.applyBattleResult(game, res);
  const prisoners = (applied.prisoners || []).map((p) => gd(p.gid).ko).join(', ');
  autoSave();

  openSheet(win ? '승전' : '패전', `
    <div style="text-align:center;padding:8px 0 4px">
      <div style="font-size:30px;letter-spacing:4px;color:${win ? '#f5d97a' : '#e08a7a'}">${win ? '승리' : '패배'}</div>
      <p style="margin:8px 0;color:#cbbf9d">${battle.over === 'atk' ? CITY_BY_ID[battle.toCityId].ko + ' 함락' : CITY_BY_ID[battle.toCityId].ko + ' 공략 실패'}</p>
    </div>
    <p class="note">${summary} · ${res.rounds}라운드${prisoners ? '<br>사로잡은 장수: <b style="color:#f5d97a">' + prisoners + '</b> — 처분을 기다립니다' : ''}</p>
    ${win && res.winner === 'attacker' ? `<p class="note">${E.withJosa(CITY_BY_ID[battle.toCityId].ko, '이')} 우리 것이 되었습니다.</p>` : ''}
    <button class="btn big" data-act="bt-close" style="margin-top:12px">${prisoners ? '포로 처분으로 ▶' : '계속'}</button>
  `);
}

function closeBattle() {
  closeSheet();
  battle = null; battleSel = null; battleMode = null; battleBusy = false;
  // 잡힌 장수가 있으면 처분 화면을 먼저 연다
  if ((game.pendingPrisoners || []).length) {
    show('scr-game');
    openPrisonerSheet();
    return;
  }
  continueAfterBattle();
}

function continueAfterBattle() {
  show('scr-game');
  const pending = game.pendingBattles || [];
  if (pending.length) {
    const next = pending.shift();
    setTimeout(() => beginBattle(next, next.defenderFaction === game.playerId ? 'def' : 'atk'), 220);
    renderGame();
    return;
  }
  if (turnPending) {
    turnPending = false;
    if (!E.checkVictory(game)) {
      E.endTurnPhase2(game);
      sfx.turn();
      toast(`${game.year}년 ${game.month}월 — 새 달이 밝았습니다.`, 1600);
    }
  }
  renderGame();
  autoSave();
}

/* ---------- 승전 후 포로 처분 (등용 · 해방 · 참수) ---------- */
let prisonerNotes = [];
let execConfirm = null;

function openPrisonerSheet() {
  const list = game.pendingPrisoners || [];
  if (!list.length) {
    prisonerSheetOpen = true;
    openSheet('포로 처분', `${prisonerNotesHTML()}
      <p class="note">모든 포로를 처분했습니다.</p>
      <button class="btn big" data-act="prisoner-done" style="margin-top:10px">마무리</button>`);
    return;
  }
  prisonerSheetOpen = true;
  openSheet(`포로 처분 · ${list.length}명`, prisonerSheetHTML());
}

function prisonerNotesHTML() {
  if (!prisonerNotes.length) return '';
  return `<div class="pw-notes">${prisonerNotes.map((n) => `<div>${n}</div>`).join('')}</div>`;
}

function prisonerSheetHTML() {
  const list = game.pendingPrisoners || [];
  const f = game.factions[game.playerId];
  const lord = gd(f.lord);
  return `${prisonerNotesHTML()}
    <p class="note">${f.name}군 승전 — 잡힌 장수 <b>${list.length}</b>명. 등용 판정은 군주 ${lord.ko}의 매력 <b>${lord.cha}</b> · 명성 <b>${Math.round(f.fame)}</b>로 겨룹니다.</p>
    ${list.map(prisonerRowHTML).join('')}
    <p class="note" style="margin-top:8px">해방하면 명성 +5 · 참수하면 그 장수는 다시 나타나지 않고 명성이 조금 깎입니다.</p>`;
}

function prisonerRowHTML(rec) {
  const t = gd(rec.gid);
  const g = game.generals[rec.gid] || {};
  const chance = Math.round(E.recruitChance(game, rec.gid) * 100);
  const confirm = execConfirm === rec.gid;
  return `<div class="pw-row">
    <img src="${portraitURL(rec.gid, t, 46, colorOf(rec.faction))}" alt="" />
    <div class="pw-main">
      <div class="pw-name">${t.ko}${rec.isLord ? ' <i class="pw-lord">군주</i>' : ''}</div>
      <div class="pw-stats">통 <b>${t.lead}</b> 무 <b>${t.war}</b> 지 <b>${t.int}</b> 매 <b>${t.cha}</b></div>
      <div class="pw-meta">${fname(rec.faction)} 소속 · 충성 ${Math.round(g.loyalty || 0)} · 친밀 ${E.affinityOf(game, rec.gid)} · 등용 성공률 <b>${chance}%</b>${rec.tried ? ' · <i style="color:#e08a7a">등용 거절</i>' : ''}</div>
    </div>
    <div class="pw-btns">
      <button class="pw-btn rec" data-act="prisoner-recruit" data-gid="${rec.gid}" ${rec.tried ? 'disabled' : ''}>등용</button>
      <button class="pw-btn rel" data-act="prisoner-release" data-gid="${rec.gid}">해방</button>
      <button class="pw-btn exec ${confirm ? 'on' : ''}" data-act="prisoner-execute" data-gid="${rec.gid}">${confirm ? '참수 확정' : '참수'}</button>
    </div>
  </div>`;
}

function prisonerAct(kind, gid) {
  if (kind === 'execute' && execConfirm !== gid) {
    execConfirm = gid;
    sfx.select();
    openPrisonerSheet();
    return;
  }
  let r = null;
  if (kind === 'recruit') r = E.recruitPrisoner(game, gid, Math.random);
  else if (kind === 'release') r = E.releasePrisoner(game, gid);
  else if (kind === 'execute') r = E.executePrisoner(game, gid);
  if (!r) return;
  if (kind === 'recruit' && r.accepted === false) sfx.fail();
  else if (kind === 'execute') sfx.lose();
  else sfx.win();
  prisonerNotes.unshift(r.msg);
  execConfirm = null;
  autoSave();
  renderGame();
  openPrisonerSheet();
}

function closePrisonerSheet() {
  prisonerNotes = [];
  execConfirm = null;
  prisonerSheetOpen = false;
  closeSheet();
  continueAfterBattle();
}

/* 포로 창을 X로 닫아도 전투 흐름은 이어진다(남은 포로는 다음에 다시 묻는다) */
let prisonerSheetOpen = false;

/* ---------- 일기토 ---------- */
function openDuel(target) {
  const mine = battleSel;
  if (!mine || !target) return;
  const gA = gd(mine.gid);
  const gB = gd(target.gid);
  duelCtx = { d: createDuel(gA, gB, Math.floor(Math.random() * 99999), { a: '아군', b: '적군' }), mine, target };
  $('#duel').classList.remove('hidden');
  sfx.duel();
  renderDuel();
}

function renderDuel() {
  const { d, mine, target } = duelCtx;
  const img = (gid, color) => `<img src="${portraitURL(gid, gd(gid), 62, color)}" alt="" />`;
  const sideColor = (isMine) => (isMine ? colorOf(game.playerId) : '#8c2f24');
  $('#duel-a').className = 'fighter a';
  $('#duel-a').innerHTML = `${img(d.a.gid, sideColor(true))}
    <div class="f-name">${d.a.name}</div><div class="f-war">무력 ${d.a.war}</div>
    <div class="hpbar"><i style="width:${(d.a.hp / d.a.maxHp) * 100}%"></i></div>
    <div class="ki">기백 ${'◆'.repeat(Math.max(0, d.a.ki))}</div>`;
  $('#duel-b').className = 'fighter b';
  $('#duel-b').innerHTML = `${img(d.b.gid, sideColor(false))}
    <div class="f-name">${d.b.name}</div><div class="f-war">무력 ${d.b.war}</div>
    <div class="hpbar"><i style="width:${(d.b.hp / d.b.maxHp) * 100}%"></i></div>
    <div class="ki">기백 ${'◆'.repeat(Math.max(0, d.b.ki))}</div>`;
  $('#duel-log').innerHTML = d.log.slice(-12).map((l) => `<div>${l}</div>`).join('');
  $('#duel-log').scrollTop = $('#duel-log').scrollHeight;
  if (d.over) {
    const won = d.winner === d.a;
    $('#duel-cmds').innerHTML = `<div class="duel-result" style="grid-column:1/3">${won ? '일기토 승리!' : '일기토 패배…'}<br>
      <span style="font-size:11px;color:#b3a884">${won ? target.name + ' 부대 사기 급락' : mine.name + ' 부대 사기 급락'}</span><br>
      <button class="btn" data-act="duel-close" style="margin-top:8px">돌아가기</button></div>`;
  } else {
    $('#duel-cmds').innerHTML = DUEL_ACTIONS.map((a) => `<button class="btn" data-act="duel-act" data-a="${a.id}"><b>${a.ko}</b></button>`).join('');
  }
}

function duelAct(action) {
  const { d } = duelCtx;
  if (d.over) return;
  duelRound(d, action, true);
  sfx.hit();
  renderDuel();
  if (d.over) applyDuelResult();
}

function applyDuelResult() {
  const { d, mine, target } = duelCtx;
  const winner = d.winner === d.a ? mine : target;
  const loser = d.winner === d.a ? target : mine;
  loser.morale = Math.max(0, loser.morale - 35);
  const loss = Math.round(loser.troops * 0.18);
  loser.troops = Math.max(0, loser.troops - loss);
  winner.morale = Math.min(100, winner.morale + 12);
  game.stats.duels++;
  if (winner === mine) game.stats.duelWins++;
  battle.log.push(`일기토 — ${winner.name} 승리! ${loser.name} 부대 사기 -35, ${fmt(loss)}명 손실.`);
  if (loser.troops <= 0) {
    loser.alive = false;
    battle.log.push(`${loser.name} 부대가 궤멸했습니다.`);
  }
  mine.acted = true; mine.moved = true;
  if (d.winner === d.a) sfx.win(); else sfx.lose();
  renderDuel();
  renderBattle();
  autoSave();
  checkBattleOver();
}

function closeDuel() {
  $('#duel').classList.add('hidden');
  const wasOver = duelCtx && duelCtx.d.over;
  const won = duelCtx && duelCtx.d.winner === duelCtx.d.a;
  duelCtx = null;
  if (battle) { battleSel = null; battleMode = null; renderBattle(); }
  if (wasOver && battle && battle.over) setTimeout(finishBattle, 300);
}

/* ---------- 턴 종료 ---------- */
function endTurn() {
  if (!game || game.gameOver) return;
  if (battle) return;
  sfx.turn();
  const battles = E.endTurnPhase1(game);
  if (battles && battles.length) {
    toast('적군이 쳐들어왔습니다!', 1600);
    turnPending = true;
    const first = battles.shift();
    setTimeout(() => beginBattle(first, first.defenderFaction === game.playerId ? 'def' : 'atk'), 250);
    renderGame();
    return;
  }
  turnPending = false;
  E.endTurnPhase2(game);
  renderGame();
  autoSave();
  toast(`${game.year}년 ${game.month}월 — 새 달이 밝았습니다.`, 1500);
}

/* ---------- 외교 ---------- */
let diploConfirm = null;

function openDiplomacy() { sfx.click(); diploConfirm = null; renderDiplomacySheet(); }

function renderDiplomacySheet() {
  if (!game) return;
  const list = E.diplomacyView(game);
  const office = E.officeOf(game, game.playerId);
  const nx = E.nextOffice(game, game.playerId);
  const gold = E.factionGold(game, game.playerId);
  const head = `
    <div class="dp-head">
      <div class="dp-cell"><b>${office.ko}</b><span>관직</span></div>
      <div class="dp-cell"><b>${fmt(gold)}</b><span>세력 금</span></div>
      <div class="dp-cell"><b>${game.actionPoints}/${game.maxActionPoints}</b><span>행동력</span></div>
    </div>
    <p class="note">${nx ? `다음 관직 <b style="color:#e0c98a">${nx.ko}</b> — ${nx.needCities ? `성 ${nx.needCities}곳 더` : '성 조건 충족'}${nx.needFame ? ` · 명성 ${nx.needFame} 더` : ''} (행동력 +${nx.ap} · 세금 +${Math.round(nx.tax * 100)}%)` : '이미 황제의 자리에 올랐습니다.'}</p>
    <p class="note">증정 금 300(+15~25) · 증정 식량 1,200(+12~22) · 동맹 500 · 정전 400 · 권고 — 모두 행동력 1을 씁니다. 동맹·정전 중에는 서로 칠 수 없습니다.</p>
    <p class="note">항복 권고는 성·병력이 압도적으로 앞설 때만 통합니다. 성공하면 그 성·장수·자원을 거두고, 실패하면 우호도가 -25 떨어집니다.</p>`;
  if (!list.length) { openSheet('외교', head + '<p class="note">겨룰 세력이 남아 있지 않습니다.</p>'); return; }
  const rows = list.map((d) => {
    const tone = d.allied ? 'ally' : d.truce ? 'truce' : d.rel >= 60 ? 'good' : d.rel < 30 ? 'bad' : 'mid';
    const chk = (k) => E.diplomacyCheck(game, k, d.id).ok;
    const breaking = diploConfirm === d.id;
    return `<div class="dp-row ${tone}">
      <div class="dp-top">
        <img src="${portraitURL(d.lordId, gd(d.lordId), 44, d.color)}" alt="${d.lordName}" />
        <div class="dp-main">
          <div class="dp-name">${d.name}군 <small>${d.lordName}</small></div>
          <div class="dp-meta">성 ${d.cities} · 병력 ${fmt(d.troops)} · 명성 ${d.fame}</div>
        </div>
        <div class="dp-rel"><b>${d.label}</b><span>우호 ${d.rel}</span>${d.allied ? `<em>동맹 ${d.allyMonths}개월</em>` : d.truce ? `<em>정전 ${d.truceMonths}개월</em>` : ''}</div>
      </div>
      <div class="dp-btns">
        <button class="dp-btn" data-act="diplo-act" data-fid="${d.id}" data-kind="giftGold" ${chk('giftGold') ? '' : 'disabled'}>증정 금 300</button>
        <button class="dp-btn" data-act="diplo-act" data-fid="${d.id}" data-kind="giftFood" ${chk('giftFood') ? '' : 'disabled'}>증정 식량 1,200</button>
        <button class="dp-btn" data-act="diplo-act" data-fid="${d.id}" data-kind="alliance" ${chk('alliance') ? '' : 'disabled'}>동맹 500</button>
        <button class="dp-btn" data-act="diplo-act" data-fid="${d.id}" data-kind="truce" ${chk('truce') ? '' : 'disabled'}>정전 400</button>
        <button class="dp-btn advise" data-act="diplo-act" data-fid="${d.id}" data-kind="surrender" ${chk('surrender') && d.surrender > 0 ? '' : 'disabled'}>권고 ${d.surrender}%</button>
        ${d.allied ? `<button class="dp-btn danger ${breaking ? 'on' : ''}" data-act="diplo-act" data-fid="${d.id}" data-kind="break">${breaking ? '파기 확정' : '동맹 파기'}</button>` : ''}
      </div>
    </div>`;
  }).join('');
  openSheet('외교', head + rows);
}

function doDiplomacy(kind, fid) {
  if (kind === 'break' && diploConfirm !== fid) { diploConfirm = fid; sfx.select(); renderDiplomacySheet(); return; }
  let res;
  if (kind === 'giftGold') res = E.giveGift(game, fid, 'gold');
  else if (kind === 'giftFood') res = E.giveGift(game, fid, 'food');
  else if (kind === 'envoy') res = E.giveGift(game, fid, 'gold');
  else if (kind === 'alliance') res = E.proposeAlliance(game, fid);
  else if (kind === 'truce') res = E.proposeTruce(game, fid);
  else if (kind === 'surrender') res = E.demandSurrender(game, fid);
  else res = E.breakAlliance(game, fid);
  diploConfirm = null;
  if (!res.ok || res.accepted === false) { sfx.fail(); toast(res.msg, 2800); }
  else { sfx.ok(); toast(res.msg, 3000); }
  renderGame();
  autoSave();
  if (!$('#sheet').classList.contains('hidden')) renderDiplomacySheet();
}

/* ---------- 전략 계략 ---------- */
let plotDraft = null;

function bestIntIn(cityId) {
  const gens = E.generalsInCity(game, cityId).filter((g) => !g.acted);
  gens.sort((a, b) => gd(b.id).int - gd(a.id).int);
  return gens.length ? gens[0].id : null;
}

function openPlotSheet(toCityId = null, fromCityId = null) {
  const me = game.playerId;
  let from = fromCityId;
  let to = toCityId;
  if (!from && to) {
    const srcs = E.adjacentFriends(game, to).filter((id) => E.generalsInCity(game, id).length);
    if (!srcs.length) { toast('인접한 아군 성에 계략을 보낼 장수가 없습니다.'); sfx.fail(); return; }
    from = srcs.find((id) => game.cities[id].gold >= 200) || srcs[0];
  }
  if (!to && from) {
    const foes = E.neighborFoes(game, from).filter((n) => !E.isPacified(game, me, game.cities[n].owner));
    if (!foes.length) { toast('이 성과 인접한 적 성이 없습니다.'); sfx.fail(); return; }
    to = foes[0];
  }
  if (!from || !to) { toast('계략을 쓸 대상이 없습니다.'); sfx.fail(); return; }
  plotDraft = { toCityId: to, fromCityId: from, kind: 'sow', gid: bestIntIn(from) };
  renderPlotSheet();
  sfx.click();
}

function renderPlotSheet() {
  const d = plotDraft;
  if (!d) return;
  const me = game.playerId;
  const to = game.cities[d.toCityId];
  const srcs = E.adjacentFriends(game, d.toCityId).filter((id) => E.generalsInCity(game, id).length);
  const foes = E.neighborFoes(game, d.fromCityId).filter((n) => !E.isPacified(game, me, game.cities[n].owner));
  const si = E.isScouted(game, d.toCityId) ? E.scoutedInfo(game, d.toCityId) : null;
  const kinds = Object.entries(E.PLOTS).map(([k, p]) => `<button class="pick-chip ${d.kind === k ? 'on' : ''}" data-act="plot-kind" data-kind="${k}">${p.ko} <b style="color:#9c9270">${p.gold}</b></button>`).join('');
  const gold = game.cities[d.fromCityId].gold;
  const rows = E.generalsInCity(game, d.fromCityId).map((g) => {
    const t = gd(g.id);
    const on = d.gid === g.id;
    const chance = Math.round(E.plotChance(game, d.fromCityId, d.toCityId, d.kind, g.id) * 100);
    return `<button class="officer-row ${on ? 'picked' : ''} ${g.acted ? 'done' : ''}" data-act="plot-gen" data-officer="${g.id}" ${g.acted ? 'disabled' : ''}>
      <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
      <div class="or-main">
        <div class="or-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
        <div class="or-stats"><span>지 <b>${t.int}</b></span><span>충 <b>${g.loyalty}</b></span><span>성공률 <b>${chance}%</b></span></div>
      </div>
      <div class="or-go">${g.acted ? '완료' : on ? '파견' : '선택'}</div>
    </button>`;
  }).join('');
  const check = d.gid ? E.plotCheck(game, d.fromCityId, d.toCityId, d.kind, d.gid) : { ok: false, why: '파견할 장수를 고르세요.' };
  const chance = d.gid ? Math.round(E.plotChance(game, d.fromCityId, d.toCityId, d.kind, d.gid) * 100) : 0;
  const intel = si
    ? `<div class="sc-box" style="margin:6px 0">
        <div class="sc-head">정탐 정보 <span>${E.scoutTurnsLeft(game, d.toCityId)}턴 남음</span></div>
        <div class="sc-meta">훈련 ${si.train} · 치안 ${si.order} · 방어 ${si.def} · 금 ${fmt(si.gold)} · 량 ${fmt(si.food)}</div>
        <div class="sc-gens">${si.generals.map((g) => `<div class="sc-gen"><b>${g.ko}</b><span>통${g.lead} 무${g.war} 지${g.int} 충${g.loyalty} 친${g.affinity}</span><button class="mini" data-act="befriend" data-gid="${g.gid}" ${E.befriendCheck(game, g.gid).ok ? '' : 'disabled'}>친교</button></div>`).join('') || '<span class="none">주둔 장수 없음</span>'}</div>
      </div>`
    : `<p class="note">적 성 최고 지력 ${E.cityBestInt(game, d.toCityId)} — 정탐을 보내면 속내를 볼 수 있습니다.</p>`;
  openSheet(`${CITY_BY_ID[d.toCityId].ko} 계략`, `
    <p class="note">${fname(to.owner)}군 · 병력 ${fmt(to.troops)} · 방어 ${to.def} · 치안 ${to.order} · 훈련 ${to.train}</p>
    ${foes.length > 1 ? `<div class="chip-row">${foes.map((n) => `<button class="pick-chip ${n === d.toCityId ? 'on' : ''}" data-act="plot-to" data-city="${n}">${CITY_BY_ID[n].ko}</button>`).join('')}</div>` : ''}
    ${intel}
    <div class="chip-row">${kinds}</div>
    <p class="note">${E.PLOTS[d.kind].desc} 이 성의 금 ${fmt(gold)} · 행동력 1을 씃니다.</p>
    ${srcs.length > 1 ? `<div class="chip-row">${srcs.map((s) => `<button class="pick-chip ${s === d.fromCityId ? 'on' : ''}" data-act="plot-from" data-city="${s}">${CITY_BY_ID[s].ko}</button>`).join('')}</div>` : ''}
    <p class="note" style="margin-top:8px">파견 장수 — 지력이 높을수록 성공률이 오릅니다. 예상 성공률 <b>${chance}%</b></p>
    ${rows}
    <div class="sheet-foot">
      ${check.ok ? '' : `<p class="note warn">${check.why}</p>`}
      <button class="btn big" data-act="plot-go" ${check.ok ? '' : 'disabled'}>${E.PLOTS[d.kind].ko} 실행 · 금 ${E.PLOTS[d.kind].gold} (성공률 ${chance}%)</button>
    </div>`);
}

function doPlot() {
  const d = plotDraft;
  if (!d || !d.gid) return;
  const res = E.runPlot(game, d.fromCityId, d.toCityId, d.kind, d.gid);
  closeSheet();
  plotDraft = null;
  if (!res.ok) { sfx.fail(); toast(res.msg); }
  else if (!res.success) { sfx.fail(); toast(res.msg, 2800); }
  else { sfx.win(); toast(res.msg, 3200); }
  renderGame();
  autoSave();
}

/* ---------- 교역 (쌀 시세) ---------- */
/* 성의 금으로 식량을 사거나, 식량을 팔아 금을 얻는다 — 행동력 1 */
function openTradeSheet(cityId) {
  if (!cityId || !game.cities[cityId] || game.cities[cityId].owner !== game.playerId) {
    toast('아군 성을 고르세요.'); sfx.fail(); return;
  }
  sheetCityId = cityId;
  renderTradeSheet();
  sfx.click();
}

function renderTradeSheet() {
  const cityId = sheetCityId;
  const c = game.cities[cityId];
  const price = E.ricePriceOf(game);
  const buys = [300, 600, 1000].map((g) => {
    const q = E.tradeQuote(game, 'buy', g);
    const off = c.gold < q.gold || game.actionPoints < 1;
    return `<button class="tr-chip" data-act="trade" data-kind="buy" data-amount="${g}" ${off ? 'disabled' : ''}>
      <b>금 ${fmt(q.gold)}</b><span>→ 식량 ${fmt(q.food)}</span></button>`;
  }).join('');
  const sells = [500, 1000, 2000].map((f) => {
    const q = E.tradeQuote(game, 'sell', f);
    const off = c.food < q.food || game.actionPoints < 1;
    return `<button class="tr-chip sell" data-act="trade" data-kind="sell" data-amount="${f}" ${off ? 'disabled' : ''}>
      <b>식량 ${fmt(q.food)}</b><span>→ 금 ${fmt(q.gold)}</span></button>`;
  }).join('');
  openSheet(`${CITY_BY_ID[cityId].ko} — 교역`, `
    <div class="tr-price">
      <div class="tr-big">쌀 시세 <b>${price}</b></div>
      <div class="tr-sub">금 100으로 식량 ${price} · ${E.riceLabel(game)}</div>
    </div>
    <p class="note">행동력 1을 써서 이 성의 금과 식량을 맞바꿉니다. 시세는 달마다 흔들리고, 풍작이 들면 쌀이 싸지고 가뭄이 들면 비싸집니다.</p>
    <p class="note">이 성의 금 <b>${fmt(c.gold)}</b> · 식량 <b>${fmt(c.food)}</b> · 행동력 <b>${game.actionPoints}</b></p>
    <p class="note" style="margin-top:10px">사들인다 — 금으로 식량을 산다</p>
    <div class="tr-grid">${buys}</div>
    <p class="note" style="margin-top:10px">판다 — 식량을 팔아 금을 얻는다</p>
    <div class="tr-grid">${sells}</div>`);
}

function doTrade(kind, amount) {
  const res = E.trade(game, sheetCityId, kind, amount);
  if (!res.ok) { sfx.fail(); toast(res.msg, 2400); return; }
  sfx.coin();
  toast(res.msg, 2600);
  renderGame();
  autoSave();
  if (!$('#sheet').classList.contains('hidden') && $('#sheet-title').textContent.includes('교역')) renderTradeSheet();
}

/* ---------- 특수 (순찰 · 연회 · 징세 · 구휼 · 보물) ---------- */
let specialCity = null;

function openSpecialSheet(cityId = null) {
  const mine = E.factionCities(game, game.playerId);
  if (!mine.length) { toast('성이 없습니다.'); sfx.fail(); return; }
  const pick = cityId || (selectedCity && game.cities[selectedCity] && game.cities[selectedCity].owner === game.playerId ? selectedCity : mine[0].id);
  specialCity = pick;
  renderSpecialSheet();
  sfx.click();
}

function renderSpecialSheet() {
  const mine = E.factionCities(game, game.playerId);
  if (!specialCity || !game.cities[specialCity] || game.cities[specialCity].owner !== game.playerId) specialCity = mine[0].id;
  const c = game.cities[specialCity];
  const price = E.ricePriceOf(game);
  const adv = E.advisorOf(game);
  const owned = E.infoTreasures(game).filter((t) => t.owned);
  const equipped = owned.filter((t) => t.holder && t.holderMine).length;
  const rows = Object.entries(E.SPECIALS).map(([k, sp]) => {
    const chk = E.specialCheck(game, k, specialCity);
    const cost = [sp.gold ? `금 ${fmt(sp.gold)}` : '', sp.food ? `식량 ${fmt(sp.food)}` : ''].filter(Boolean).join(' · ') || '값 들지 않음';
    const effect = k === 'patrol' ? `치안 +4~7 · 명성 +2 · 가끔 보물/소문`
      : k === 'banquet' ? `이 성 장수 전원 충성 +4~7 · 친밀 +4~7`
      : k === 'levy' ? `금 +600~1,000 · 치안 -10~15 · 명성 -3`
      : `치안 +8~14 · 명성 +4`;
    return `<button class="sp-row" data-act="special" data-kind="${k}" ${chk.ok ? '' : 'disabled'}>
      <span class="sp-name">${sp.ko}<em>${cost} · 행동력 ${sp.ap}</em></span>
      <span class="sp-eff">${effect}</span>
      <span class="sp-go">${chk.ok ? '실행' : (chk.why || '불가')}</span>
    </button>`;
  }).join('');
  openSheet('특수', `
    <div class="chip-row">${mine.map((x) => `<button class="pick-chip ${x.id === specialCity ? 'on' : ''}" data-act="special-city" data-city="${x.id}">${CITY_BY_ID[x.id].ko}</button>`).join('')}</div>
    <div class="sp-head">
      <div><b>${CITY_BY_ID[specialCity].ko}</b> 치안 <b>${c.order}</b> · 명성 <b>${Math.round(game.factions[game.playerId].fame)}</b> · 행동력 <b>${game.actionPoints}</b></div>
      <div class="sp-price" data-act="trade-open" role="button">쌀 시세 <b>${price}</b> · 교역 ▶</div>
    </div>
    ${rows}
    <div class="sp-block">
      <div class="sp-block-head">보물 <span>${owned.length}/${E.TREASURES.length}종 · 장착 ${equipped}</span></div>
      <p class="note">탐색·순찰·포로 처분·세력 멸망으로 얻습니다. 장수에게 수여하면 능력치가 오릅니다.</p>
      <button class="btn big" data-act="treasures">보물 관리 ▶</button>
    </div>
    <div class="sp-block">
      <div class="sp-block-head">참모 ${adv ? `<span>${adv.ko} · 지력 ${adv.int} · 계략·등용·외교 +${Math.round(E.advisorBonus(game) * 100)}%</span>` : '<span>아직 없습니다</span>'}</div>
      <p class="note adv-line">${esc(E.advisorAdvice(game))}</p>
      <button class="btn big ghost" data-act="advisor">참모 임명·변경 ▶</button>
    </div>`);
}

function doSpecial(kind) {
  const res = E.runSpecial(game, kind, specialCity);
  if (!res.ok) { sfx.fail(); toast(res.msg, 2400); return; }
  sfx.ok();
  toast(res.msg, 3200);
  renderGame();
  autoSave();
  if (!$('#sheet').classList.contains('hidden') && $('#sheet-title').textContent === '특수') renderSpecialSheet();
}

/* ---------- 보물 ---------- */
function openTreasureSheet() {
  const list = E.infoTreasures(game);
  const rows = list.map((t) => {
    const status = t.holder
      ? (t.holderMine ? `<span class="ts-holder mine">${t.holderName}</span>` : `<span class="ts-holder">${t.holderFaction && t.holderFaction !== t.holderName ? t.holderFaction + ' ' : ''}${t.holderName}</span>`)
      : '<span class="ts-holder lost">행방 모름</span>';
    const btns = t.owned
      ? (t.holderMine
        ? `<button class="mini" data-act="treasure-revoke" data-tid="${t.id}">회수</button>`
        : `<button class="mini" data-act="treasure-pick" data-tid="${t.id}">수여</button>`)
      : '';
    return `<div class="ts-row ${t.owned ? 'own' : ''}">
      <div class="ts-main">
        <div class="ts-name">${t.ko} <em>${t.kind}</em></div>
        <div class="ts-bonus">${t.bonusText}</div>
      </div>
      <div class="ts-side">${status}${btns}</div>
    </div>`;
  }).join('');
  openSheet('보물', `<p class="note">보물은 지닌 장수의 능력치를 올립니다. 우리가 손에 넣은 보물은 장수에게 수여하거나 창고로 회수할 수 있습니다.</p>${rows}`);
}

function openTreasurePick(tid) {
  const tr = (E.TREASURES || []).find((x) => x.id === tid);
  const gens = E.factionGenerals(game, game.playerId).map((g) => ({ g, t: gd(g.id) }));
  gens.sort((a, b) => (b.t.war + b.t.lead) - (a.t.war + a.t.lead));
  const rows = gens.map(({ g, t }) => {
    const now = E.treasureOf(game, g.id);
    return `<button class="officer-row" data-act="treasure-award" data-tid="${tid}" data-gid="${g.id}">
      <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
      <div class="or-main">
        <div class="or-name">${t.ko} <span class="or-tag">${now ? '지닌 보물 ' + now.ko : '빈손'}</span></div>
        <div class="or-stats"><span>통<b>${t.lead}</b></span><span>무<b>${t.war}</b></span><span>지<b>${t.int}</b></span><span>정<b>${t.pol}</b></span><span>매<b>${t.cha}</b></span></div>
      </div>
      <div class="or-go">수여</div>
    </button>`;
  }).join('');
  openSheet(`${tr ? tr.ko : '보물'} 수여`, `<p class="note">${tr ? tr.desc + ' (' + E.treasureBonusText(tr) + ')' : ''} 이미 다른 보물을 지닌 장수에게 주면 그것은 창고로 돌아갑니다.</p>${rows || '<p class="note">수여할 장수가 없습니다.</p>'}`);
}

function doTreasureAward(tid, gid) {
  const res = E.awardTreasure(game, tid, gid);
  if (!res.ok) { sfx.fail(); toast(res.msg, 2400); return; }
  sfx.ok(); toast(res.msg, 2800);
  renderGame(); autoSave();
  openTreasureSheet();
}

function doTreasureRevoke(tid) {
  const res = E.revokeTreasure(game, tid);
  if (!res.ok) { sfx.fail(); toast(res.msg); return; }
  sfx.select(); toast(res.msg);
  renderGame(); autoSave();
  openTreasureSheet();
}

/* ---------- 참모 ---------- */
function openAdvisorSheet() {
  const gens = E.factionGenerals(game, game.playerId).map((g) => ({ g, t: gd(g.id) }));
  gens.sort((a, b) => b.t.int - a.t.int);
  const cur = game.advisorId;
  const rows = gens.map(({ g, t }) => `
    <button class="officer-row ${g.id === cur ? 'picked' : ''}" data-act="advisor-pick" data-gid="${g.id}">
      <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
      <div class="or-main">
        <div class="or-name">${t.ko} ${g.id === cur ? '<i class="mv-lord">참모</i>' : ''} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
        <div class="or-stats"><span>지력 <b>${t.int}</b></span><span>정치 <b>${t.pol}</b></span><span>충성 <b>${g.loyalty}</b></span></div>
      </div>
      <div class="or-go">${g.id === cur ? '재임 중' : `+${Math.max(2, Math.min(8, Math.round((t.int - 55) / 6)))}%`}</div>
    </button>`).join('');
  openSheet('참모 임명', `<p class="note">참모의 지력에 따라 계략·등용·외교 성공률이 <b>2~8%</b> 오릅니다. 기본은 지력이 가장 높은 장수가 앉습니다.</p>
    <p class="note adv-line">${esc(E.advisorAdvice(game))}</p>${rows}`);
}

function doAdvisorPick(gid) {
  const res = E.appointAdvisor(game, gid);
  if (!res.ok) { sfx.fail(); toast(res.msg); return; }
  sfx.ok(); toast(res.msg, 2800);
  renderGame(); autoSave();
  openAdvisorSheet();
}

/* ---------- 정보 일람 ---------- */
let infoTab = 'rank';
let infoScope = 'mine';

function openInfoSheet(tab = null) {
  if (tab) infoTab = tab;
  renderInfoSheet();
  sfx.click();
}

function renderInfoSheet() {
  const tabs = [['rank', '세력 순위'], ['cities', '아군 도시'], ['generals', '무장 일람'], ['treasures', '보물 도감']];
  const adv = E.advisorOf(game);
  const head = `<div class="adv-box">
      <div class="adv-head">참모 ${adv ? `<b>${adv.ko}</b> <span>지력 ${adv.int} · 계략·등용·외교 +${Math.round(E.advisorBonus(game) * 100)}%</span>` : '<span>아직 없습니다</span>'}</div>
      <p class="adv-line">${esc(E.advisorAdvice(game))}</p>
    </div>`;
  const tabHTML = `<div class="info-tabs">${tabs.map(([k, ko]) => `<button class="pick-chip ${infoTab === k ? 'on' : ''}" data-act="info-tab" data-tab="${k}">${ko}</button>`).join('')}</div>`;
  openSheet('정보', head + tabHTML + infoTabHTML());
}

function infoTabHTML() {
  if (infoTab === 'cities') {
    const rows = E.infoCities(game).map((c) => `
      <button class="info-row city" data-act="info-city" data-city="${c.cityId}">
        <span class="ir-name">${c.ko}<em>${c.region}</em></span>
        <span class="ir-deleg ${c.delegation !== 'none' ? 'on' : ''}">${c.delegationKo}</span>
        <span class="ir-na">농업 ${c.agri} · 상업 ${c.comm} · 치안 ${c.order} · 수리 ${c.water}</span>
        <span class="ir-nb">병 ${fmt(c.troops)} · 장수 ${c.generals}명 · 금 ${fmt(c.gold)} · 량 ${fmt(c.food)}</span>
      </button>`).join('');
    return `<p class="note">성 이름을 누르면 지도에서 그 성을 고릅니다. 위임한 성은 턴이 바뀔 때 스스로 내정·군사를 돌봅니다.</p>${rows}`;
  }
  if (infoTab === 'generals') {
    const scope = `<div class="chip-row" style="margin:6px 0"><button class="pick-chip ${infoScope === 'mine' ? 'on' : ''}" data-act="info-scope" data-scope="mine">아군</button><button class="pick-chip ${infoScope === 'all' ? 'on' : ''}" data-act="info-scope" data-scope="all">전체</button></div>`;
    const all = E.infoGenerals(game, infoScope);
    const pool = infoScope === 'all' ? all : E.infoGenerals(game, 'all');
    const mine = pool.filter((g) => g.faction === game.playerId).length;
    const freeN = pool.filter((g) => !g.faction).length;
    const count = `<p class="note ig-count">전체 장수 <b>${pool.length}</b>명 — 아군 ${mine} · 재야 ${freeN} · 그 외 ${pool.length - mine - freeN}</p>`;
    const list = all.slice(0, 60);
    const rows = list.map((g) => `
      <div class="info-gen">
        <img src="${portraitURL(g.gid, gd(g.gid), 34, g.faction ? colorOf(g.faction) : '#6b6b6b')}" alt="${g.ko}" />
        <div class="ig-main">
          <div class="ig-name">${g.ko}${g.isAdvisor ? ' <i class="mv-lord">참모</i>' : ''}${g.treasure ? ` <i class="ig-tr">${g.treasure}</i>` : ''}<em>${infoScope === 'all' ? g.factionName + ' · ' + g.city : g.city}</em></div>
          <div class="ig-stats"><span>통 ${g.lead}</span><span>무 ${g.war}</span><span>지 ${g.int}</span><span>정 ${g.pol}</span><span>매 ${g.cha}</span>${infoScope === 'mine' ? `<span>충 ${g.loyalty}</span><span>친 ${g.affinity}</span>` : ''}</div>
        </div>
      </div>`).join('');
    return `${scope}${count}${rows || '<p class="note">장수가 없습니다.</p>'}<p class="note">보물을 지닌 장수는 능력치가 보정된 값으로 보입니다.${all.length > 60 ? ' (상위 60명만)' : ''}</p>`;
  }
  if (infoTab === 'treasures') {
    const rows = E.infoTreasures(game).map((t) => `
      <div class="ts-row ${t.owned ? 'own' : ''}">
        <div class="ts-main"><div class="ts-name">${t.ko} <em>${t.kind}</em></div><div class="ts-bonus">${t.bonusText}</div></div>
        <div class="ts-side">${t.holder ? (t.holderMine ? `<span class="ts-holder mine">${t.holderName}</span>` : `<span class="ts-holder">${t.holderFaction && t.holderFaction !== t.holderName ? t.holderFaction + ' ' : ''}${t.holderName}</span>`) : '<span class="ts-holder lost">행방 모름</span>'}</div>
      </div>`).join('');
    return `<p class="note">보물 ${E.infoTreasures(game).filter((t) => t.owned).length}종을 손에 넣었습니다. 수여와 회수는 <b>특수 › 보물</b>에서 합니다.</p>${rows}`;
  }
  const rows = E.infoFactions(game).map((f, i) => `
    <div class="info-row fac ${f.mine ? 'mine' : ''}">
      <span class="ir-name" style="color:${f.color}">${i + 1}. ${f.name}${f.lordName && f.lordName !== f.name ? `<em>${f.lordName}</em>` : ''}</span>
      <span class="ir-rel ${f.relation === '동맹' ? 'ally' : f.relation === '정전' ? 'truce' : f.relation === '적대' ? 'bad' : ''}">${f.relation}${f.allyMonths ? ` ${f.allyMonths}개월` : f.truceMonths ? ` ${f.truceMonths}개월` : ''}</span>
      <span class="ir-nums">성 <b>${f.cities}</b> · 병 ${fmt(f.troops)} · 금 ${fmt(f.gold)} · 량 ${fmt(f.food)} · 명성 ${f.fame}</span>
    </div>`).join('');
  return `<p class="note">전력(성·병력) 순입니다. 우리와의 관계는 동맹 · 정전 · 우호 · 중립 · 적대입니다.</p>${rows}`;
}

/* ---------- 월간 이벤트 ---------- */
function openEventSheet() {
  const ev = game && game.pendingEvent;
  if (!ev) return;
  const gold = E.factionGold(game, game.playerId);
  const opts = (ev.options || []).map((o) => {
    const off = (ev.id === 'plague' && o.id === 'treat' && gold < 300) || (ev.id === 'drought' && o.id === 'irrigate' && gold < 250);
    const soft = o.id === 'endure' || o.id === 'refuse' || o.id === 'ignore';
    return `<button class="btn big ev-opt ${soft ? 'ghost' : ''}" data-act="event-go" data-id="${o.id}" ${off ? 'disabled' : ''} style="margin-bottom:8px">
      <span>${o.ko}</span>${o.hint ? `<small>${off ? '금이 부족합니다' : o.hint}</small>` : ''}</button>`;
  }).join('');
  openSheet(`${ev.year}년 ${ev.month}월 — 달의 소식`, `<div class="ev-box">
      <div class="ev-title">${ev.title}</div>
      <p class="ev-text">${ev.text}</p>
    </div>${opts || '<button class="btn big" data-act="sheet-close">닫기</button>'}`);
  sfx.select();
}

function doEvent(choiceId) {
  const res = E.resolveEvent(game, choiceId);
  if (!res.ok) { toast(res.msg); return; }
  closeSheet();
  sfx.ok();
  toast(res.msg, 3200);
  renderGame();
  autoSave();
}

/* ---------- 5월 무예 대회 · 10월 설전 대회 ---------- */
let tourTreasure = null;

function tournamentBracketHTML(tv) {
  const names = E.TOURNAMENT.rounds;
  return (tv.rounds || []).map((matches, ri) => `
    <div class="tour-round">
      <div class="tour-round-head">${names[ri] || ''}</div>
      ${matches.map((m) => {
        const aWin = m.winner === 'a';
        return `<div class="tour-match">
          <span class="tm-team ${aWin ? 'win' : 'lose'}">${m.a.ko}<em>${m.a.score}</em></span>
          <span class="tm-vs">vs</span>
          <span class="tm-team ${aWin ? 'lose' : 'win'}">${m.b.ko}<em>${m.b.score}</em></span>
        </div>`;
      }).join('')}
    </div>`).join('');
}

function openTournamentSheet() {
  const tv = game && game.pendingTournament;
  if (!tv) return;
  const gold = E.factionGold(game, game.playerId);
  const prizes = E.tournamentPrizes(game);
  if (tourTreasure && !prizes.some((p) => p.id === tourTreasure)) tourTreasure = null;
  if (!tourTreasure && prizes.length) tourTreasure = prizes[0].id;
  const R = E.TOURNAMENT.reward;
  const goldOff = gold < R.gold.gold;
  const prize = prizes.find((p) => p.id === tourTreasure) || null;
  const chipRow = prizes.length > 1
    ? `<div class="chip-row" style="margin:6px 0 4px">${prizes.map((p) => `<button class="pick-chip ${p.id === tourTreasure ? 'on' : ''}" data-act="tour-treasure" data-tid="${p.id}">${p.ko}</button>`).join('')}</div><p class="note" style="margin:0 0 6px">${prize ? prize.bonusText : ''}${prize && prize.from === 'prize' ? ' · 대회 포상' : ''}</p>`
    : '';
  openSheet(`${tv.year}년 ${tv.month}월 — ${tv.title}`, `
    <div class="ev-box tour-head-box">
      <div class="ev-title">${tv.title}</div>
      <p class="ev-text">세력 장수 ${tv.totalGenerals || tv.entrants}명 중 ${tv.statKo} 상위 ${tv.entrants}명이 ${tv.statKo === '무력' ? '연무장에서' : '의정당에서'} 기량을 겨뤘습니다.</p>
    </div>
    ${tournamentBracketHTML(tv)}
    <div class="tour-champ">
      <span>우승</span>
      <b>${tv.championKo}</b>
      <em>${tv.statKo} ${tv.championStat}</em>
    </div>
    <p class="note" style="margin-top:10px">우승 장수를 치하하는 방식을 고르세요. 하사는 세력 금과 보물을 씁니다.</p>
    <button class="btn big ev-opt" data-act="tour-reward" data-kind="gold" ${goldOff ? 'disabled' : ''} style="margin-bottom:8px">
      <span>금 하사</span><small>${goldOff ? `세력 금이 부족합니다 (보유 ${fmt(gold)} / 필요 ${R.gold.gold})` : `금 ${R.gold.gold} · 충성 +${R.gold.loyalty} · 친밀 +${R.gold.affinity} · 명성 +${R.gold.fame}`}</small>
    </button>
    <button class="btn big ev-opt" data-act="tour-reward" data-kind="treasure" ${prizes.length ? '' : 'disabled'} style="margin-bottom:8px">
      <span>보물 하사${prize ? ` — ${prize.ko}` : ''}</span><small>${prizes.length ? `충성 +${R.treasure.loyalty} · 친밀 +${R.treasure.affinity} · 명성 +${R.treasure.fame}${prizes.length > 1 ? ' · 위에서 보물 선택' : ''}` : '하사할 보물이 없습니다'}</small>
    </button>
    ${chipRow}
    <button class="btn big ghost ev-opt" data-act="tour-reward" data-kind="praise">
      <span>치하만 하기</span><small>비용 없음 · 충성 +${R.praise.loyalty} · 친밀 +${R.praise.affinity} · 명성 +${R.praise.fame}</small>
    </button>
  `);
  sfx.win();
}

function doTournamentReward(kind) {
  if (!game || !game.pendingTournament) { closeSheet(); return; }
  const res = E.resolveTournamentReward(game, kind, { treasureId: tourTreasure });
  if (!res.ok) { sfx.fail(); toast(res.msg, 2800); return; }
  closeSheet();
  sfx.win();
  toast(res.msg, 3600);
  renderGame();
  autoSave();
}

/* ---------- 장수 상세 ---------------- */
const GD_STAT_LABELS = [['lead', '통솔'], ['war', '무력'], ['int', '지력'], ['pol', '정치'], ['cha', '매력']];

function openGeneralDetail(gid) {
  if (!game) return;
  const rec = game.generals[gid];
  const t = gd(gid);
  if (!rec || !t) return;
  const eff = E.effectiveGeneral(game, gid) || t;
  const fac = rec.faction ? game.factions[rec.faction] : null;
  const city = rec.city ? CITY_BY_ID[rec.city] : null;
  const aff = E.affinityOf(game, gid);
  const tr = E.treasureOf(game, gid);
  const forms = E.formationOptions(gid, game).map((f) => f.ko);
  const status = rec.dead ? '전사' : rec.captive ? '포로' : rec.acted ? '이번 달 행동 완료' : '이번 달 대기';
  const statusCls = rec.captive || rec.dead ? 'bad' : rec.acted ? 'done' : 'ready';
  const stats = GD_STAT_LABELS.map(([key, ko]) => {
    const base = t[key] || 0, val = eff[key] || base;
    const plus = val > base ? `<i>+${val - base}</i>` : '';
    return `<div class="gd-stat">
      <span class="gs-ko">${ko}</span>
      <b>${val}${plus}</b>
      <div class="gs-bar"><i style="width:${Math.max(4, Math.min(100, val))}%"></i></div>
    </div>`;
  }).join('');
  openSheet(`${t.ko} — 장수`, `
    <div class="gd-top">
      <img class="gd-face" src="${portraitURL(gid, t, 92, colorOf(rec.faction))}" alt="${t.ko}" />
      <div class="gd-id">
        <div class="gd-name">${t.ko}</div>
        <div class="gd-sub"><b style="color:${fac ? fac.color : '#9a8f7a'}">${fac ? fac.name + '군' : '재야'}</b>${city ? ` · ${city.ko} 주둔` : ''}</div>
        <div class="gd-tags"><span>${t.arms || '보병'}</span><span>${skillName(t.skill)}</span></div>
        <div class="gd-status ${statusCls}">${status}</div>
      </div>
    </div>
    <div class="gd-stats">${stats}</div>
    <div class="gd-rows">
      <div class="gd-row"><span>충성</span><b>${rec.faction === game.playerId ? rec.loyalty : '-'}</b></div>
      <div class="gd-row"><span>친밀</span><b>${aff} <em>${E.affinityLabel(aff)}</em></b></div>
      <div class="gd-row"><span>보유 보물</span><b>${tr ? `${tr.ko} <em>${E.treasureBonusText(tr)}</em>` : '없음'}</b></div>
      <div class="gd-row"><span>주력 진형</span><b>${forms.join(' · ') || '어린'}</b></div>
    </div>
    <button class="btn big" data-act="sheet-close" style="margin-top:10px">닫기</button>
  `);
  sfx.select();
}

/* ---------- 관직 승급 ---------- */
function openPromotionSheet() {
  const list = (game.lastPromotions || []).filter((p) => p.factionId === game.playerId);
  if (!list.length) return;
  const p = list[list.length - 1];
  E.clearPromotions(game);
  const before = game.maxActionPoints;
  game.maxActionPoints = E.calcActionPoints(game, game.playerId);
  game.actionPoints += Math.max(0, game.maxActionPoints - before);
  const f = game.factions[game.playerId];
  const nx = E.nextOffice(game, game.playerId);
  $('#res-ap').textContent = `${game.actionPoints}/${game.maxActionPoints}`;
  $('#turn-hint').textContent = `명령 ${game.actionPoints}`;
  sfx.win();
  openSheet('관직 승급', `
    <div class="promo">
      <div class="promo-to">${p.to}</div>
      <p class="promo-text">${f.name}군의 관직이 ${p.from}에서 ${E.withJosa(p.to, '로')} 올랐습니다.<br>천하에 그 이름이 더 크게 울립니다.</p>
      <div class="promo-bonus">
        <div><b>+${p.ap}</b><span>최대 행동력</span></div>
        <div><b>+${Math.round(p.tax * 100)}%</b><span>세금 수입</span></div>
      </div>
      ${nx ? `<p class="note">다음 관직 <b>${nx.ko}</b> — 성 ${nx.cities}곳 · 명성 ${nx.fame}</p>` : '<p class="note">이제 천하의 황제입니다.</p>'}
    </div>
    <button class="btn big" data-act="promo-ok" style="margin-top:10px">받들겠습니다</button>`);
}

/* ---------- 메뉴/저장 ---------- */
function openMenu() {
  openSheet('군의', `
    <div class="acc-box acc-menu" id="menu-account"></div>
    <button class="btn big" data-act="save-slot" data-slot="1" style="margin-bottom:8px">슬롯 1에 저장</button>
    <button class="btn big" data-act="save-slot" data-slot="2" style="margin-bottom:8px">슬롯 2에 저장</button>
    <button class="btn big" data-act="save-slot" data-slot="3" style="margin-bottom:8px">슬롯 3에 저장</button>
    <button class="btn big ghost" data-act="open-load" style="margin-bottom:8px">불러오기</button>
    <button class="btn big ghost" data-act="open-reports" style="margin-bottom:8px">군보</button>
    <button class="btn big ghost" data-act="diplomacy" style="margin-bottom:8px">외교 · 관직</button>
    ${game && game.pendingEvent ? '<button class="btn big ghost" data-act="open-event" style="margin-bottom:8px">달의 소식</button>' : ''}
    ${game && game.pendingTournament ? '<button class="btn big ghost" data-act="open-tournament" style="margin-bottom:8px">이달의 대회</button>' : ''}
    <button class="btn big ghost" data-act="open-rank" style="margin-bottom:8px">세력 순위</button>
    <button class="btn big ghost" data-act="open-help" style="margin-bottom:8px">게임 방법</button>
    <button class="btn big ghost" data-act="to-title">타이틀로</button>
  `);
  Cloud.mount($('#menu-account'));
}

function openLoad() {
  const rows = [];
  if (Cloud.state().signedIn) {
    rows.push(`<p class="note acc-load-note">☁ ${Cloud.state().name} 님으로 로그인됨 — 기기 저장과 클라우드 저장을 합친 상태입니다.</p>`);
  }
  for (let i = 1; i <= 3; i++) {
    const raw = localStorage.getItem(KEYS.slot(i));
    rows.push(loadRow(i, raw, `슬롯 ${i}`));
  }
  rows.push(loadRow('auto', localStorage.getItem(KEYS.auto), '자동 저장'));
  openSheet('불러오기', rows.join('') || '<p class="note">저장된 기록이 없습니다.</p>');
}

function loadRow(slot, raw, label) {
  if (!raw) return `<button class="officer-row done" disabled><div class="or-main"><div class="or-name">${label}</div><div class="or-stats">비어 있음</div></div></button>`;
  let info = null;
  try {
    const s = JSON.parse(raw);
    const f = s.factions[s.playerId];
    info = `${s.year}년 ${s.month}월 · ${f.name} · 성 ${E.factionCities(s, s.playerId).length}곳`;
  } catch (e) { info = '손상된 기록'; }
  return `<button class="officer-row" data-act="do-load" data-slot="${slot}">
    <img src="${portraitURL('save-' + slot, { war: 60, lead: 60 }, 40, '#3a3428')}" alt="" />
    <div class="or-main"><div class="or-name">${label}</div><div class="or-stats">${info}</div></div>
    <div class="or-go">불러오기</div></button>`;
}

function doLoad(slot) {
  const raw = slot === 'auto' ? localStorage.getItem(KEYS.auto) : localStorage.getItem(KEYS.slot(slot));
  if (!raw) { toast('저장 기록이 없습니다.'); return; }
  try {
    game = E.deserialize(raw);
    closeSheet();
    selectedCity = E.factionCities(game, game.playerId)[0]?.id || null;
    cityPanelOpen = true;
    if (!mapView) {
      mapView = createMapView($('#map'), { onSelectCity: (id) => selectCity(id) });
    }
    show('scr-game');
    mapView.setState(game);
    mapView.setSelected(selectedCity);
    if (selectedCity) mapView.focusCity(selectedCity);
    mapView.resize();
    renderGame();
    sfx.ok();
    toast('기록을 불러왔습니다.', 1400);
    if ((game.pendingPrisoners || []).length) setTimeout(openPrisonerSheet, 500);
  } catch (e) {
    toast('불러오기 실패: ' + e.message);
    sfx.fail();
  }
}

function openRank() {
  const list = E.ranking(game);
  openSheet('세력 순위', list.map((r, i) => `
    <div class="officer-row">
      <div style="width:22px;text-align:center;color:${i < 3 ? '#d8b34a' : '#7d745a'}">${i + 1}</div>
      <div class="or-main">
        <div class="or-name" style="color:${r.color}">${r.name}${r.id === game.playerId ? ' <small>(아군)</small>' : ''}</div>
        <div class="or-stats"><span>성 <b>${r.cities}</b></span><span>병력 <b>${fmt(r.troops)}</b></span><span>장수 <b>${r.generals}</b></span><span>전력 <b>${fmt(r.power)}</b></span></div>
      </div>
    </div>`).join(''));
}

function openHelp() {
  openSheet('게임 방법', `
    <p class="note" style="line-height:1.9">
    <b style="color:#e6d9b3">1. 목표</b> — 전국 42개 성을 모두 차지하면 천하통일입니다.<br>
    <b style="color:#e6d9b3">2. 달마다</b> — 행동력만큼 명령을 내립니다. 장수는 한 달에 한 번만 움직입니다.<br>
    <b style="color:#e6d9b3">3. 내정</b> — 개발(농업)·상업·치안·수리로 성을 키우고, 징병·훈련으로 군세를 만듭니다.<br>
    <b style="color:#e6d9b3">4. 인사</b> — 탐색으로 인재를 찾고 등용합니다. 장수마다 친밀도가 있어 낯설면 등용이 어렵습니다. 친교(금 200·행동력 1)로 친밀도를 쌓고, 포상(금 120)으로 충성과 친밀도를 함께 올립니다.<br>
    <b style="color:#e6d9b3">5. 이동</b> — 아군 성끼리 장수를 옮깁니다. 행동력 1을 쓰고, 옮긴 장수는 그 달 행동을 마칩니다.<br>
    <b style="color:#e6d9b3">6. 대화</b> — 성의 장수와 이야기를 나누면 충성도와 친밀도가 오릅니다(행동력 1, 장수마다 한 달 1회, 금은 들지 않음).<br>
    <b style="color:#e6d9b3">7. 출진</b> — 인접한 적 성을 공격합니다. 전장에서 부대를 움직여 성을 함락시키세요.<br>
    <b style="color:#e6d9b3">8. 진형</b> — 어린(공격)·방원(방어)·학익(원거리)·봉시(돌격) 등 9종. 부대의 진형에 따라 공격·방어·사거리가 달라집니다.<br>
    <b style="color:#e6d9b3">9. 계략</b> — 지력이 높은 장수는 화계·혼란·고무·치료를 씁니다.<br>
    <b style="color:#e6d9b3">10. 일기토</b> — 인접한 적 장수에게 1:1 대결을 걸 수 있습니다. 이기면 적 부대 사기가 급락합니다.<br>
    <b style="color:#e6d9b3">11. 외교</b> — 성 시트의 외교 버튼에서 증정(금 300·식량 1,200)·동맹(금 500·12개월)·정전(금 400·6개월)·항복 권고를 씁니다. 동맹·정전 중인 세력은 서로 치지 못하고, 동맹은 원군도 보냅니다. 동맹 파기는 명성 -15. 항복 권고는 성·병력이 압도적일 때만 통하며 성공하면 그 세력을 통째로 거둡니다.<br>
    <b style="color:#e6d9b3">12. 계략</b> — 적 성을 고르면 계략을 쓸 수 있습니다. 이간(충성 하락)·정탐(3턴 속내 열람)·유언비어(치안·훈련·물자 약화). 지력이 높은 장수일수록 성공합니다.<br>
    <b style="color:#e6d9b3">13. 관직</b> — 성 수와 명성에 따라 현령→자사→주목→대장군→승상→왕→황제로 오르며 행동력·세금이 늘어납니다.<br>
    <b style="color:#e6d9b3">14. 원군</b> — 출진할 때 인접한 아군·동맹 성에서 원군을 고르면 2라운드에 전장 가장자리로 들어옵니다. 방어전에서는 자동으로 합류합니다.<br>
    <b style="color:#e6d9b3">15. 달의 소식</b> — 새 달에 풍작·도적·역병·가뭄·유랑 무장 같은 일이 생깁니다. 선택에 따라 결과가 달라집니다.<br>
    <b style="color:#e6d9b3">16. 교역</b> — 성 시트의 내정 → 교역. 금 100으로 사는 식량(쌀 시세)이 달마다 흔들립니다. 풍작이면 싸지고 가뭄이면 비싸집니다. 행동력 1로 금과 식량을 맞바꿉니다.<br>
    <b style="color:#e6d9b3">17. 특수</b> — 지도 위 특수에서 순찰(치안·명성, 가끔 보물)·연회(장수 충성·친밀)·징세(금, 대신 치안·명성 손해)·구휼(식량으로 치안·명성)을 씁니다.<br>
    <b style="color:#e6d9b3">18. 보물</b> — 적토마·청룡언월도·손자병법 같은 보물 14종. 탐색·순찰·포로 처분·세력 멸망으로 얻고, 장수에게 수여하면 능력치가 오릅니다(정보 → 보물 도감).<br>
    <b style="color:#e6d9b3">19. 참모</b> — 지력이 가장 높은 장수가 참모로 앉아 계략·등용·외교 성공률을 2~8% 올리고 조언을 합니다(정보에서 변경).<br>
    <b style="color:#e6d9b3">20. 담당</b> — 성마다 직할·내정 위임·군사 위임을 정합니다. 위임한 성은 턴이 바뀔 때 행동력 없이 스스로 개발·징병·훈련을 합니다.<br>
    <b style="color:#e6d9b3">21. 전술 계략</b> — 화계·혼란·고무·치료에 수계(물가)·낙석(산기슭)이 더해집니다. 계략마다 지력·매력으로 정해지는 성공률이 표시됩니다.<br>
    <b style="color:#e6d9b3">22. 저장</b> — 매 명령마다 자동 저장되며, 슬롯 3개에 수동 저장할 수 있습니다.
    </p>`);
}

/* ---------- 엔딩 ---------- */
function showEnding() {
  if (!game || !game.gameOver) return;
  const g = game.gameOver;
  const sum = E.factionSummary(game, game.playerId);
  const win = g.type === 'victory';
  sfx[win ? 'win' : 'lose']();
  $('#end-wrap').innerHTML = `
    <div class="end-mark">${win ? '천하' : '낙일'}</div>
    <div class="end-title">${win ? '천하통일' : '낙일'}</div>
    <p class="end-text">${g.text}</p>
    <div class="end-stats">
      <div class="end-stat"><i>치세</i><b>${game.year}년 ${game.month}월</b></div>
      <div class="end-stat"><i>보유 성</i><b>${sum.cities} / 42</b></div>
      <div class="end-stat"><i>총 병력</i><b>${fmt(sum.troops)}</b></div>
      <div class="end-stat"><i>명성</i><b>${Math.round(game.factions[game.playerId].fame)}</b></div>
      <div class="end-stat"><i>전투</i><b>${game.stats.battles}회 · ${game.stats.wins}승</b></div>
      <div class="end-stat"><i>일기토</i><b>${game.stats.duels}회 · ${game.stats.duelWins}승</b></div>
    </div>
    <button class="btn big" data-act="to-title" style="margin-bottom:8px">타이틀로</button>
    <button class="btn big ghost" data-act="new">새 게임</button>
  `;
  show('scr-end');
}

/* ---------- 이벤트 ---------- */
function onClick(e) {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'new': sfx.click(); game = null; renderScenarios(); show('scr-scenario'); break;
    case 'continue': {
      const raw = localStorage.getItem(KEYS.auto);
      if (!raw) { toast('이어할 기록이 없습니다.'); break; }
      doLoad('auto');
      break;
    }
    case 'load': openLoad(); break;
    case 'mute': {
      sfx.mute(!sfx.isMuted());
      $$('[data-act="mute"]').forEach((b) => { b.textContent = sfx.isMuted() ? '✕' : '♪'; });
      break;
    }
    case 'back-title': refreshContinue(); show('scr-title'); drawTitleArt(); break;
    case 'back-scenario': renderScenarios(); show('scr-scenario'); break;
    case 'pick-scenario': renderLords(el.dataset.id); show('scr-lord'); break;
    case 'pick-lord': startGame(el.dataset.sc, el.dataset.id); break;
    case 'open-custom': openCustomScreen(el.dataset.sc || (currentScenario && currentScenario.id) || SCENARIOS[0].id); break;
    case 'cst-scenario': customDraft.scenarioId = el.dataset.v; renderCustomBody(); break;
    case 'cst-mark': customDraft.mark = el.dataset.v; renderCustomBody(); break;
    case 'cst-color': customDraft.color = el.dataset.v; renderCustomBody(); break;
    case 'cst-style': customDraft.style[el.dataset.k] = Number(el.dataset.v); renderCustomBody(); break;
    case 'cst-stat': adjustCustomStat(el.dataset.k, Number(el.dataset.d)); break;
    case 'cst-dice': {
      const dice = E.rollCustomDice();
      Object.assign(customDraft, customDiceFields(dice));
      renderCustomBody();
      if (dice.legend) {
        sfx.ok();
        toast(`✨ 전설 탄생! 능력치 총합 ${dice.total} — 100번 중 1번의 대박입니다.`, 3200);
      } else sfx.click();
      break;
    }
    case 'cst-skill': customDraft.skill = el.dataset.v; renderCustomBody(); break;
    case 'cst-arms': customDraft.arms = el.dataset.v; renderCustomBody(); break;
    case 'cst-retinue': customDraft.retinue = Number(el.dataset.v); renderCustomBody(); break;
    case 'cst-start': startCustomGame(); break;
    case 'jump-region': {
      closeSheet();
      if (el.dataset.region === '__mine') {
        const mine = E.factionCities(game, game.playerId);
        if (mine.length) { cityPanelOpen = true; selectedCity = mine[0].id; mapView.focusCity(selectedCity); mapView.setSelected(selectedCity); renderCityPanel(); }
      } else {
        mapView.focusRegion(el.dataset.region);
      }
      break;
    }
    case 'region-menu': sfx.click(); openRegionMenu(); break;
    case 'diplomacy': openDiplomacy(); break;
    case 'diplo-act': doDiplomacy(el.dataset.kind, el.dataset.fid); break;
    case 'plot-city': openPlotSheet(el.dataset.city, null); break;
    case 'plot-to': plotDraft.toCityId = el.dataset.city; renderPlotSheet(); sfx.click(); break;
    case 'plot-kind': plotDraft.kind = el.dataset.kind; renderPlotSheet(); sfx.click(); break;
    case 'plot-from': plotDraft.fromCityId = el.dataset.city; plotDraft.gid = bestIntIn(el.dataset.city); renderPlotSheet(); sfx.click(); break;
    case 'plot-gen': plotDraft.gid = el.dataset.officer; renderPlotSheet(); sfx.click(); break;
    case 'plot-go': doPlot(); break;
    case 'march-reinforce': {
      const id = el.dataset.city;
      const i = pendingSetup.reinforce.indexOf(id);
      if (i >= 0) pendingSetup.reinforce.splice(i, 1);
      else if (pendingSetup.reinforce.length < E.REINFORCE_MAX) pendingSetup.reinforce.push(id);
      else { toast(`원군은 ${E.REINFORCE_MAX}부대까지 함께 갈 수 있습니다.`); sfx.fail(); }
      $('#sheet-body').innerHTML = marchSheetHTML();
      sfx.click();
      break;
    }
    case 'event-go': doEvent(el.dataset.id); break;
    case 'gen-detail': openGeneralDetail(el.dataset.gid); break;
    case 'open-tournament': openTournamentSheet(); break;
    case 'tour-treasure': tourTreasure = el.dataset.tid; openTournamentSheet(); sfx.click(); break;
    case 'tour-reward': doTournamentReward(el.dataset.kind); break;
    case 'promo-ok': closeSheet(); break;
    case 'open-event': openEventSheet(); break;
    case 'open-reports': sfx.click(); openReports(); break;
    case 'city-toggle': cityPanelOpen = !cityPanelOpen; cityCmdGroup = null; sfx.click(); renderCityPanel(); break;
    case 'cmd-group': {
      const g = el.dataset.group;
      cityCmdGroup = cityCmdGroup === g ? null : g;
      sfx.click();
      syncCmdPopover();
      break;
    }
    case 'city-prev': cityCmdGroup = null; stepCity(-1); break;
    case 'city-next': cityCmdGroup = null; stepCity(1); break;
    case 'zoom-in': mapView.zoomBy(1.25); break;
    case 'zoom-out': mapView.zoomBy(0.8); break;
    case 'zoom-reset': mapView.resetView(); break;
    case 'endturn': cityCmdGroup = null; syncCmdPopover(); endTurn(); break;
    case 'close-city': selectedCity = null; cityPanelOpen = false; cityCmdGroup = null; mapView.setSelected(null); renderCityPanel(); break;
    case 'cmd': {
      const cmd = el.dataset.cmd;
      cityCmdGroup = null;
      syncCmdPopover();
      if (cmd === 'move') openMoveSheet(el.dataset.city);
      else if (cmd === 'talk') openTalkSheet(el.dataset.city);
      else if (cmd === 'plot') openPlotSheet(null, el.dataset.city);
      else if (cmd === 'trade') openTradeSheet(el.dataset.city);
      else openCommandSheet(cmd, el.dataset.city);
      break;
    }
    /* 교역 · 특수 · 보물 · 참모 · 정보 */
    case 'trade': doTrade(el.dataset.kind, Number(el.dataset.amount)); break;
    case 'trade-open': openTradeSheet(specialCity || selectedCity); break;
    case 'special-menu': openSpecialSheet(); break;
    case 'special': doSpecial(el.dataset.kind); break;
    case 'special-city': specialCity = el.dataset.city; renderSpecialSheet(); sfx.click(); break;
    case 'treasures': openTreasureSheet(); break;
    case 'treasure-pick': openTreasurePick(el.dataset.tid); break;
    case 'treasure-award': doTreasureAward(el.dataset.tid, el.dataset.gid); break;
    case 'treasure-revoke': doTreasureRevoke(el.dataset.tid); break;
    case 'advisor': cityCmdGroup = null; syncCmdPopover(); openAdvisorSheet(); break;
    case 'advisor-pick': doAdvisorPick(el.dataset.gid); break;
    case 'info': openInfoSheet(); break;
    case 'info-tab': infoTab = el.dataset.tab; renderInfoSheet(); sfx.click(); break;
    case 'info-scope': infoScope = el.dataset.scope; renderInfoSheet(); sfx.click(); break;
    case 'info-city': {
      const cid = el.dataset.city;
      closeSheet();
      cityPanelOpen = true;
      selectedCity = cid;
      if (mapView) { mapView.setSelected(cid); mapView.focusCity(cid); }
      renderCityPanel();
      sfx.select();
      break;
    }
    case 'deleg': {
      const res = E.setDelegation(game, selectedCity, el.dataset.mode);
      if (!res.ok) { sfx.fail(); toast(res.msg); break; }
      sfx.ok(); toast(res.msg, 2000);
      renderGame(); autoSave();
      break;
    }
    case 'mv-gen': toggleMoveGeneral(el.dataset.officer); break;
    case 'mv-dest': moveDraft.toCityId = el.dataset.city; renderMoveSheet(); sfx.click(); break;
    case 'mv-go': doMoveGenerals(); break;
    case 'talk-go': doTalk(el.dataset.officer); break;
    case 'talk-more': renderTalkSheet(); break;
    case 'do-command': doCommand(sheetCommandType, el.dataset.officer, sheetCityId); break;
    case 'do-hire': doHire(sheetCityId, el.dataset.officer); break;
    case 'befriend': doBefriend(el.dataset.gid || el.dataset.officer); break;
    case 'do-reward': doReward(sheetCityId, el.dataset.officer); break;
    case 'tr-target': {
      uiState.trTarget = el.dataset.city;
      $$('#tr-targets .pick-chip').forEach((b) => b.classList.toggle('on', b.dataset.city === el.dataset.city));
      break;
    }
    case 'tr-gold+': case 'tr-gold-': case 'tr-food+': case 'tr-food-': adjustTransport(act); break;
    case 'do-transport': doTransport(el.dataset.officer); break;
    case 'march': pendingSetup = null; cityCmdGroup = null; syncCmdPopover(); openMarchSheet(el.dataset.city); break;
    case 'attack-enemy': openAttackEnemySheet(el.dataset.city); break;
    case 'march-from': openMarchSheet(el.dataset.city, el.dataset.to); break;
    case 'march-target': pendingSetup.targetId = el.dataset.city; $('#sheet-body').innerHTML = marchSheetHTML(); break;
    case 'march-gen': {
      const id = el.dataset.officer;
      const idx = pendingSetup.generals.indexOf(id);
      if (idx >= 0) pendingSetup.generals.splice(idx, 1);
      else if (pendingSetup.generals.length < 5) pendingSetup.generals.push(id);
      $('#sheet-body').innerHTML = marchSheetHTML();
      break;
    }
    case 'march-ratio+': case 'march-ratio-': {
      const inp = $('#march-ratio');
      let v = parseInt(inp.value, 10) || 100;
      v = act === 'march-ratio+' ? Math.min(100, v + 10) : Math.max(20, v - 10);
      pendingSetup.ratio = v / 100;
      $('#sheet-body').innerHTML = marchSheetHTML();
      break;
    }
    case 'march-form': {
      pendingSetup.forms[el.dataset.officer] = el.dataset.form;
      pendingSetup.focus = el.dataset.officer;
      $('#sheet-body').innerHTML = marchSheetHTML();
      sfx.click();
      break;
    }
    case 'march-go': startPlayerBattle(); break;
    case 'sheet-close': if (prisonerSheetOpen) closePrisonerSheet(); else closeSheet(); break;
    case 'menu': openMenu(); break;
    case 'open-load': openLoad(); break;
    case 'open-rank': openRank(); break;
    case 'open-help': openHelp(); break;
    case 'save-slot': {
      const slot = el.dataset.slot;
      try {
        localStorage.setItem(KEYS.slot(slot), E.serialize(game));
        Cloud.noteSaved(slot);
        toast(Cloud.state().signedIn ? `슬롯 ${slot}에 저장했습니다 · 클라우드로도 올립니다.` : `슬롯 ${slot}에 저장했습니다.`);
        sfx.ok();
      } catch (err) { toast('저장 실패'); }
      break;
    }
    case 'do-load': doLoad(el.dataset.slot); break;
    case 'to-title': closeSheet(); $('#duel').classList.add('hidden'); refreshContinue(); show('scr-title'); drawTitleArt(); break;
    case 'new-game': break;
    /* 전투 */
    case 'bt-select': {
      const u = battle.units.find((x) => x.id === el.dataset.unit);
      if (u) { battleSel = u; battleMode = null; renderBattle(); }
      break;
    }
    case 'bt-move': battleMode = 'move'; renderBattle(); break;
    case 'bt-attack': battleMode = 'attack'; renderBattle(); break;
    case 'bt-tactic': {
      const opts = B.tacticOptions(battle, battleSel);
      openSheet('계략 선택', `<p class="note">지력·매력에 따라 성공률이 달라집니다. 수계는 물, 낙석은 산에 닿은 적에게만 통합니다.</p>
        <div class="tactic-grid">${opts.map((o) => `<button class="btn tc-btn" data-act="bt-tactic-kind" data-kind="${o.kind}" ${o.blocked ? 'disabled' : ''}>
          <b>${o.ko}</b><em>성공률 ${Math.round(o.rate * 100)}%</em><small>${o.blocked || (o.terrain ? (o.terrain === 'water' ? '물에 닿은 적' : '산에 닿은 적') : o.ally ? '아군 부대' : '적 부대')}</small>
        </button>`).join('')}</div>`);
      break;
    }
    case 'bt-tactic-kind': {
      battleMode = 'tactic:' + el.dataset.kind;
      closeSheet();
      toast(el.dataset.kind === 'rally' || el.dataset.kind === 'heal' ? '아군 부대를 고르세요' : '적 부대를 고르세요', 1200);
      renderBattle();
      break;
    }
    case 'bt-duel': {
      const opts = B.duelOptions(battle, battleSel);
      openSheet('일기토 상대', opts.map((u) => {
        const t = gd(u.gid);
        return `<button class="officer-row" data-act="bt-duel-go" data-unit="${u.id}">
          <img src="${portraitURL(u.gid, t, 40, '#8c2f24')}" alt="" />
          <div class="or-main"><div class="or-name">${t.ko}</div>
          <div class="or-stats"><span>무력 <b>${t.war}</b></span><span>병력 <b>${fmt(u.troops)}</b></span><span>사기 <b>${Math.round(u.morale)}</b></span></div></div>
          <div class="or-go">일기토</div></button>`;
      }).join(''));
      break;
    }
    case 'bt-duel-go': {
      const target = battle.units.find((u) => u.id === el.dataset.unit);
      closeSheet();
      openDuel(target);
      break;
    }
    case 'duel-act': duelAct(el.dataset.a); break;
    case 'duel-close': closeDuel(); break;
    case 'bt-wait': if (battleSel) { B.endUnit(battleSel); battleMode = null; renderBattle(); } break;
    case 'bt-next': playerNext(); break;
    case 'bt-all': allOut(); break;
    case 'bt-retreat': retreat(); break;
    case 'bt-close': closeBattle(); break;
    case 'prisoner-recruit': prisonerAct('recruit', el.dataset.gid); break;
    case 'prisoner-release': prisonerAct('release', el.dataset.gid); break;
    case 'prisoner-execute': prisonerAct('execute', el.dataset.gid); break;
    case 'prisoner-done': closePrisonerSheet(); break;
    default: break;
  }
}

function adjustTransport(act) {
  const goldInp = $('#tr-gold'), foodInp = $('#tr-food');
  const cityId = sheetCityId;
  if (act === 'tr-gold+') uiState.trGold = Math.min(game.cities[cityId].gold, uiState.trGold + 500);
  if (act === 'tr-gold-') uiState.trGold = Math.max(0, uiState.trGold - 500);
  if (act === 'tr-food+') uiState.trFood = Math.min(game.cities[cityId].food, uiState.trFood + 1000);
  if (act === 'tr-food-') uiState.trFood = Math.max(0, uiState.trFood - 1000);
  if (goldInp) goldInp.value = uiState.trGold;
  if (foodInp) foodInp.value = uiState.trFood;
}

function doTransport(officerId) {
  const cityId = sheetCityId;
  const gold = parseInt($('#tr-gold')?.value || '0', 10) || 0;
  const food = parseInt($('#tr-food')?.value || '0', 10) || 0;
  const res = E.runCommand(game, 'transport', { cityId, officerId, targetCityId: uiState.trTarget, gold, food });
  closeSheet();
  if (res.ok) { sfx.ok(); toast(res.msg); } else { sfx.fail(); toast(res.msg); }
  renderGame(); autoSave();
}

/* ---------- 부트 ---------- */
export function boot() {
  $$('[data-act="mute"]').forEach((b) => { b.textContent = sfx.isMuted() ? '✕' : '♪'; });
  document.addEventListener('click', onClick);
  document.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('input', onCustomInput);
  document.addEventListener('change', onCustomInput);
  bindCityPanelSwipe();
  refreshContinue();
  $('#map') && $('#map').addEventListener('pointerdown', () => sfx.unlock(), { once: true });
  const bc = $('#battle-canvas');
  bc && bc.addEventListener('click', (e) => { if (battle) battleTap(e.clientX, e.clientY); });
  window.addEventListener('resize', () => {
    if (mapView) mapView.resize();
    if (!$('#scr-battle').classList.contains('hidden')) resizeBattleCanvas();
    if (!$('#scr-title').classList.contains('hidden')) drawTitleArt();
    fitResValues();
    placeCmdPopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheet(); }
  });
  renderScenarios();
  show('scr-title');
  drawTitleArt();
  Cloud.mount($('#title-account'));
  Cloud.start({
    onStatus: () => { const b = $('#btn-continue'); if (b) b.disabled = !localStorage.getItem(KEYS.auto); },
    onApplied: () => {
      const b = $('#btn-continue');
      if (b) b.disabled = !localStorage.getItem(KEYS.auto);
      drawTitleArt();
    },
    onSignedIn: ({ name }) => toast(`${name} 님으로 로그인했습니다. 저장을 동기화합니다.`, 2600),
  }).then((res) => {
    if (res && Cloud.state().signedIn && !$('#scr-title').classList.contains('hidden')) {
      toast('☁ 클라우드 저장과 동기화했습니다.', 1800);
    }
  });
  setTimeout(drawTitleArt, 100);
  setTimeout(() => { if (!$('#scr-title').classList.contains('hidden')) drawTitleArt(); }, 500);

  // Gmarket Sans 는 self-host 라도 첫 페인트 전에 도착하지 않을 수 있다.
  // 캔버스 글자가 대체 폰트로 굳지 않도록, 폰트가 준비되면 한 번 더 그린다.
  if (document.fonts) {
    const refreshFonts = () => {
      if (mapView && mapView.render) mapView.render();
      if (!$('#scr-title').classList.contains('hidden')) drawTitleArt();
    };
    Promise.all([
      document.fonts.load('500 16px "Gmarket Sans"'),
      document.fonts.load('700 16px "Gmarket Sans"'),
    ]).then(refreshFonts).catch(() => {});
    if (document.fonts.ready) document.fonts.ready.then(refreshFonts).catch(() => {});
  }
}

export { game };
