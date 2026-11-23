/* 행동 연출 — HD-2D 디오라마.
   · 주요 명령을 실행하면 딱 2.0초 동안 재생되고 저절로 닫힌다(스킵 버튼 없음).
   · 배경은 행동마다 다른 HD-2D 디오라마 그림(assets/actionfx/*.webp)이고,
     그 위에 60fps 캔버스 레이어(도트 병사 행진·불꽃·반딧불·금화·물보라·광선)를 얹는다.
   · 그림은 앱이 뜬 뒤 미리 받아 두어 누를 때 지연 없이 그린다.
   · 글자는 캔버스에 그리지 않는다(한자 0자). 안내는 아래 캡션에서만 한다.
   · 전장·시트 위에 덮이도록 가장 높은 층(z-index 120)에 붙인다. */

export const ACTION_FX_MS = 2000;
const W = 720;
const H = 405;

export const ACTION_FX_SCENES = {
  agri: { ko: '개발', tone: '#9cc45e' },
  comm: { ko: '상업', tone: '#e8c15a' },
  order: { ko: '치안', tone: '#8fb4e0' },
  water: { ko: '수리', tone: '#6fc0e0' },
  draft: { ko: '징병', tone: '#e8964c' },
  train: { ko: '훈련', tone: '#e0c878' },
  hire: { ko: '등용', tone: '#b8a0e8' },
  befriend: { ko: '친교', tone: '#e8a8c0' },
  reward: { ko: '포상', tone: '#ffd79a' },
  learn: { ko: '진형 전수', tone: '#9cd0a8' },
  plot: { ko: '계략', tone: '#b09ae0' },
  promote: { ko: '장군 임명', tone: '#ffd79a' },
};
export const ACTION_FX_DEFAULT = { ko: '명령', tone: '#d9a05a' };

/* 배경 그림 — index.html 기준 경로 */
export const ACTION_FX_BG = {
  agri: 'assets/actionfx/agri.webp',
  comm: 'assets/actionfx/comm.webp',
  order: 'assets/actionfx/order.webp',
  water: 'assets/actionfx/water.webp',
  draft: 'assets/actionfx/draft.webp',
  train: 'assets/actionfx/train.webp',
  hire: 'assets/actionfx/hire.webp',
  befriend: 'assets/actionfx/befriend.webp',
  reward: 'assets/actionfx/reward.webp',
  learn: 'assets/actionfx/learn.webp',
  plot: 'assets/actionfx/plot.webp',
  promote: 'assets/actionfx/promote.webp',
};

export function sceneOf(kind) {
  return ACTION_FX_SCENES[kind] || ACTION_FX_DEFAULT;
}

/* ---------- 배경 미리 받기 ---------- */
const bgCache = new Map();

function canLoadImages() {
  return typeof window !== 'undefined' && typeof Image !== 'undefined';
}

function bgOf(kind) {
  if (!ACTION_FX_BG[kind]) return null;
  if (bgCache.has(kind)) return bgCache.get(kind);
  if (!canLoadImages()) { bgCache.set(kind, null); return null; }
  const img = new Image();
  img.decoding = 'async';
  img.src = ACTION_FX_BG[kind];
  bgCache.set(kind, img);
  return img;
}

export function actionFxBackgroundReady(kind) {
  const img = bgCache.get(kind);
  return !!(img && img.complete && img.naturalWidth > 0);
}

/** 앱이 뜬 뒤 불러 두면 명령을 눌렀을 때 지연이 없다. 이미 받은 그림은 다시 받지 않는다. */
export function preloadActionFxBackgrounds(kinds) {
  const list = Array.isArray(kinds) && kinds.length ? kinds : Object.keys(ACTION_FX_BG);
  if (!canLoadImages()) return list.length;   // 브라우저 밖(테스트)에서는 할 일이 없다
  let done = 0;
  const step = () => {
    if (done >= list.length) return true;
    const kind = list[done++];
    bgOf(kind);
    return done >= list.length;
  };
  // 유휴 시간에 한 장씩 — 첫 화면(타이틀) 그리기를 방해하지 않는다
  const idle = (fn) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(fn, { timeout: 800 });
    else setTimeout(fn, 60);
  };
  const loop = () => { if (!step()) idle(loop); };
  idle(loop);
  return list.length;
}

if (canLoadImages()) {
  const boot = () => preloadActionFxBackgrounds();
  if (document.readyState === 'complete') setTimeout(boot, 350);
  else window.addEventListener('load', () => setTimeout(boot, 350), { once: true });
}

/* ---------- 그리기 도구 ---------- */
function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

const GLOW = new Map();
function glowSprite(rgb) {
  if (GLOW.has(rgb)) return GLOW.get(rgb);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `rgba(${rgb},1)`);
  grd.addColorStop(0.42, `rgba(${rgb},0.32)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  GLOW.set(rgb, c);
  return c;
}

/** 빛 번짐 — 미리 만든 스프라이트를 additive로 얹는다(모바일 60fps용) */
function bloom(ctx, x, y, r, rgb, a = 0.4) {
  if (a <= 0.004) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function lerp(a, b, k) { return a + (b - a) * k; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/* 화면 가장자리 어둡게 + 아래쪽 글자 자리 + 위쪽 따뜻한 빛 */
let OVL = null;
function overlayLayer() {
  if (OVL) return OVL;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const scrim = g.createLinearGradient(0, H * 0.56, 0, H);
  scrim.addColorStop(0, 'rgba(8,6,4,0)');
  scrim.addColorStop(1, 'rgba(8,6,4,0.66)');
  g.fillStyle = scrim;
  g.fillRect(0, H * 0.56, W, H * 0.44);
  const vig = g.createRadialGradient(W / 2, H * 0.46, H * 0.3, W / 2, H * 0.5, W * 0.62);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.62)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  const rim = g.createLinearGradient(0, 0, 0, H * 0.34);
  rim.addColorStop(0, 'rgba(255,188,120,0.16)');
  rim.addColorStop(1, 'rgba(255,188,120,0)');
  g.fillStyle = rim;
  g.fillRect(0, 0, W, H * 0.34);
  OVL = c;
  return c;
}

/* 배경 그림이 아직 없을 때 — 빈 화면 대신 어두운 무대를 그린다 */
function fallbackStage(ctx, tone) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#171009');
  g.addColorStop(0.55, '#241a10');
  g.addColorStop(1, '#0c0805');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  bloom(ctx, W / 2, H * 0.28, W * 0.42, '255,190,110', 0.22);
  ctx.fillStyle = 'rgba(50,36,22,0.96)';
  for (let i = 0; i < 6; i++) {
    const x = i * 130 - 40;
    ctx.beginPath();
    ctx.moveTo(x, H - 70);
    ctx.lineTo(x + 90, H - 190 - (i % 3) * 24);
    ctx.lineTo(x + 190, H - 70);
    ctx.fill();
  }
  px(ctx, 0, H - 62, W, 62, 'rgba(84,58,32,0.7)');
  bloom(ctx, W / 2, H - 40, 160, tone.replace('#', '').match(/../g).map((v) => parseInt(v, 16)).join(','), 0.12);
}

function drawBackground(ctx, kind, p) {
  const img = bgOf(kind);
  const tone = sceneOf(kind).tone;
  // 아주 느리게 밀고 들어오는 카메라 — 정지 그림이 살아 움직이게
  const zoom = 1.015 + p * 0.05;
  const dx = Math.sin(p * Math.PI * 0.9) * 7;
  const dy = -p * 4;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, (W - W * zoom) / 2 + dx, (H - H * zoom) / 2 + dy, W * zoom, H * zoom);
  } else {
    fallbackStage(ctx, tone);
    if (img && !img.complete) img.addEventListener('load', () => {}, { once: true });
  }
}

/* ---------- 공통 레이어 ---------- */
function embers(ctx, t, p, rgb = '255,186,110', n = 20) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const speed = 0.15 + (i % 5) * 0.038;
    const q = (t * speed + i * 0.137) % 1;
    const x = ((i * 149) % W) + Math.sin(t * 1.7 + i * 1.3) * 16 + q * 8;
    const y = H + 6 - q * (H * 1.05);
    const a = Math.sin(q * Math.PI) * (0.30 + (i % 3) * 0.11) * (0.7 + p * 0.5);
    const r = 1.2 + (i % 3) * 0.8;
    ctx.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
    ctx.fillRect(x, y, r, r * (1.7 + (i % 2) * 0.8));
  }
  ctx.restore();
}

function dust(ctx, t, y, n = 12, rgb = 'rgba(222,192,152,') {
  for (let i = 0; i < n; i++) {
    const q = (t * 0.22 + i * 0.13) % 1;
    const x = ((i * 97 + t * (18 + (i % 4) * 9)) % (W + 40)) - 20;
    const yy = y - ((i * 13) % 26) - Math.sin(q * 6 + i) * 5;
    px(ctx, x, yy, 2 + (i % 2), 2, `${rgb}${(0.10 + (i % 3) * 0.05).toFixed(3)})`);
  }
}

/** 도트 병사 — 1u ≈ 1px, s=1이면 키 40px 남짓 */
function dotSoldier(ctx, x, y, s, t, seed, tone, shield = true) {
  const step = Math.sin(t * 9 + seed * 1.7);
  const bob = step > 0 ? -1 : 0;
  const u = s;
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(x + 8 * u, y + 0.5, 9 * u, 2.4 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, x + 5 * u, y - 9 * u + bob * u, 2.6 * u, 9 * u, '#1b120b');
  px(ctx, x + 9 * u, y - 9 * u + bob * u, 2.6 * u, 9 * u + (step > 0 ? 0 : 1.6 * u), '#1b120b');
  px(ctx, x + 3.2 * u, y - 21 * u + bob * u, 9.6 * u, 13 * u, '#19110a');
  px(ctx, x + 4.4 * u, y - 20 * u + bob * u, 7.2 * u, 11 * u, tone);
  px(ctx, x + 4.4 * u, y - 17 * u + bob * u, 7.2 * u, 1.4 * u, '#f2c47e');
  px(ctx, x + 4.4 * u, y - 28 * u + bob * u, 7.2 * u, 7.6 * u, '#19110a');
  px(ctx, x + 5.4 * u, y - 26.4 * u + bob * u, 5.2 * u, 5.2 * u, '#f0d0a0');
  px(ctx, x + 3.2 * u, y - 31.4 * u + bob * u, 9.6 * u, 3.8 * u, '#6f5332');
  px(ctx, x + 5.2 * u, y - 33.8 * u + bob * u, 5.6 * u, 2.6 * u, '#e2bd6e');
  px(ctx, x + 15 * u, y - 41 * u + bob * u, Math.max(1, 1.4 * u), 41 * u, '#d9c59b');
  px(ctx, x + 14 * u, y - 44 * u + bob * u, 3.6 * u, 4.2 * u, '#fff3d6');
  if (shield) {
    px(ctx, x + 0.8 * u, y - 20 * u + bob * u, 3.6 * u, 8.4 * u, '#4a3622');
    px(ctx, x + 1.6 * u, y - 18 * u + bob * u, 2 * u, 4.6 * u, '#c9a45c');
  }
  bloom(ctx, x + 9 * u, y - 21 * u, 13 * u, '255,172,84', 0.14);
}

function coin(ctx, x, y, s, t) {
  const w = Math.max(2, Math.abs(Math.cos(t * 3.4 + x * 0.05)) * s);
  px(ctx, x - w / 2, y, w, s * 0.92, '#ffd76a');
  px(ctx, x - w / 4, y + s * 0.3, Math.max(1, w / 2), s * 0.32, '#8a5f1c');
  px(ctx, x - w / 2, y, w, 1, '#fff0b8');
}

function spark(ctx, x, y, r, color = 'rgba(255,230,168,') {
  px(ctx, x - r, y, r * 2 + 1, 1, `${color}0.9)`);
  px(ctx, x, y - r, 1, r * 2 + 1, `${color}0.9)`);
  px(ctx, x - 1, y - 1, 3, 3, '#fff8df');
}

function firefly(ctx, x, y, a) {
  bloom(ctx, x, y, 11, '214,255,150', a * 0.75);
  px(ctx, x, y, 2, 2, `rgba(238,255,190,${a})`);
}

function glowRing(ctx, x, y, r, a, rgb = '255,232,180') {
  if (r <= 0 || a <= 0.01) return;
  ctx.strokeStyle = `rgba(${rgb},${a})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function sweep(ctx, p) {
  // 시작할 때 왼쪽에서 오른쪽으로 지나가는 빛줄기
  if (p > 0.24) return;
  const k = p / 0.24;
  const x = lerp(-120, W + 120, k);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
  g.addColorStop(0, 'rgba(255,220,170,0)');
  g.addColorStop(0.5, `rgba(255,226,180,${(0.20 * (1 - k)).toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 90, 0, 180, H);
  ctx.restore();
}

/* ---------- 행동별 살아 있는 레이어 ---------- */
function fxDraft(ctx, t, p) {
  bloom(ctx, 452, 150, 150, '255,178,92', 0.10 + 0.04 * Math.sin(t * 3));
  const lanes = [
    { y: H - 8, s: 1.05, v: 82, n: 6, tone: '#a8823f' },
    { y: H - 30, s: 0.8, v: 60, n: 5, tone: '#8a7048' },
  ];
  lanes.forEach((ln, li) => {
    for (let i = 0; i < ln.n; i++) {
      const span = W + 180;
      const x = ((i * (span / ln.n) + t * ln.v) % span) - 90;
      dotSoldier(ctx, x, ln.y, ln.s, t, i + li * 7, ln.tone);
    }
  });
  dust(ctx, t, H - 14, 14);
  embers(ctx, t, p, '255,186,110', 14);
}

function fxTrain(ctx, t, p) {
  const cx = 436, cy = 296;
  const beat = (t * 2.2) % 1;
  const hit = beat < 0.2 ? 1 - beat / 0.2 : 0;
  const glow = 0.10 + 0.09 * Math.sin(t * 4);
  bloom(ctx, cx - 70, cy - 40, 70, '255,196,120', glow);
  bloom(ctx, cx + 70, cy - 40, 70, '255,196,120', glow);
  if (hit > 0) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i - 4.5) * 0.32;
      const r = (1 - hit) * 88;
      px(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82, 2.4, 2.4, `rgba(255,${200 + (i % 4) * 12},150,${(hit * 0.95).toFixed(3)})`);
    }
    bloom(ctx, cx, cy, 30 + hit * 78, '255,214,150', 0.55 * hit);
    glowRing(ctx, cx, cy, 12 + (1 - hit) * 68, 0.55 * hit);
  }
  // 창끝을 스치는 잔광
  const flash = Math.max(0, Math.sin(t * 5.5));
  px(ctx, cx - 96, cy - 44, 46, 2, `rgba(255,240,200,${(0.18 * flash).toFixed(3)})`);
  px(ctx, cx + 50, cy - 46, 46, 2, `rgba(255,240,200,${(0.18 * flash).toFixed(3)})`);
  dust(ctx, t, H - 26, 12);
}

function fxAgri(ctx, t, p) {
  // 반딧불
  for (let i = 0; i < 18; i++) {
    const x = ((i * 71 + Math.sin(t * 0.8 + i) * 34) % W);
    const y = H * 0.42 + ((i * 43) % 132) + Math.sin(t * 1.4 + i * 2.1) * 11;
    firefly(ctx, x, y, 0.28 + 0.5 * Math.abs(Math.sin(t * 1.7 + i)));
  }
  // 앞줄 이삭 실루엣
  for (let i = 0; i < 26; i++) {
    const x = i * 29 + Math.sin(t * 1.5 + i * 0.7) * 4;
    const h = 20 + (i % 4) * 8;
    px(ctx, x, H - h, 1.6, h, 'rgba(38,44,20,0.55)');
    px(ctx, x + Math.sin(t * 1.5 + i) * 3, H - h - 3, 2.4, 4, 'rgba(96,108,44,0.5)');
  }
  // 물비늘
  for (let i = 0; i < 10; i++) {
    const q = (t * 0.6 + i * 0.17) % 1;
    const x = 60 + i * 62;
    px(ctx, x, H * 0.62 + q * 40, 16, 1.4, `rgba(255,214,150,${(0.22 * (1 - q)).toFixed(3)})`);
  }
  bloom(ctx, W * 0.72, H * 0.30, 120, '255,170,90', 0.10 + 0.03 * Math.sin(t * 2));
  embers(ctx, t, p, '255,206,140', 10);
}

function fxComm(ctx, t, p) {
  const lamps = [[168, 208], [352, 214], [556, 206]];
  lamps.forEach(([x, y], i) => {
    bloom(ctx, x, y - 92, 62, '255,186,96', 0.12 + 0.05 * Math.sin(t * 2.4 + i * 2));
  });
  for (let i = 0; i < 12; i++) {
    const q = (t * 0.52 + i * 0.113) % 1;
    const x = 120 + ((i * 61) % 470) + Math.sin(q * 5 + i) * 14;
    coin(ctx, x, H - 34 - q * 150, 7, t + i);
  }
  for (let i = 0; i < 10; i++) {
    const q = (t * 0.4 + i * 0.19) % 1;
    px(ctx, 60 + i * 62 + Math.sin(t + i) * 10, H * 0.72 - q * 90, 2, 2, `rgba(255,226,168,${(0.35 * (1 - q)).toFixed(3)})`);
  }
  embers(ctx, t, p, '255,200,120', 14);
}

function fxOrder(ctx, t, p) {
  // 성벽 위를 훑는 등불 빛
  const sx = 110 + ((t * 0.45) % 1) * 520;
  bloom(ctx, sx, 252, 138, '255,190,110', 0.17);
  // 순찰병 그림자
  for (let i = 0; i < 2; i++) {
    const x = 120 + ((t * 44 + i * 300) % 600);
    dotSoldier(ctx, x, 268, 0.62, t + i, i + 2, '#5d6c86', false);
  }
  // 성문 쪽 횃불 깜빡임
  bloom(ctx, 236, 300, 46, '255,160,70', 0.12 + 0.06 * Math.sin(t * 7.3));
  bloom(ctx, 470, 300, 40, '255,160,70', 0.10 + 0.05 * Math.sin(t * 6.1 + 1));
  embers(ctx, t, p, '255,190,120', 16);
}

function fxWater(ctx, t, p) {
  // 물길 — 아래로 흐르는 물줄기
  for (let i = 0; i < 22; i++) {
    const x = 336 + (i % 8) * 27 + Math.sin(t * 1.4 + i) * 3.2;
    const q = (t * 1.5 + i * 0.19) % 1;
    const y = 236 + q * 156;
    const len = 12 + (i % 3) * 12;
    px(ctx, x, y, 1.8, len, `rgba(198,236,255,${(0.20 * (1 - q)).toFixed(3)})`);
  }
  // 물보라
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const q = (t * 1.1 + i * 0.127) % 1;
    const a = -Math.PI / 2 + ((i % 9) - 4) * 0.26;
    const r = q * (46 + (i % 3) * 16);
    const x = 430 + Math.cos(a) * r;
    const y = 368 + Math.sin(a) * r * 0.55 + q * 10;
    ctx.fillStyle = `rgba(210,242,255,${(0.42 * (1 - q)).toFixed(3)})`;
    ctx.fillRect(x, y, 2.4, 2.4);
  }
  ctx.restore();
  // 잔물결
  for (let i = 0; i < 4; i++) {
    const q = (t * 0.8 + i * 0.25) % 1;
    glowRing(ctx, 400 + i * 22, 372, 10 + q * 40, 0.20 * (1 - q), '190,232,255');
  }
  bloom(ctx, 430, 350, 120, '190,230,255', 0.10);
}

function fxHire(ctx, t, p) {
  // 두루마리 위를 지나가는 빛
  const k = (t * 0.6) % 1;
  const sx = 300 + k * 226;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0);
  g.addColorStop(0, 'rgba(255,235,190,0)');
  g.addColorStop(0.5, 'rgba(255,235,190,0.22)');
  g.addColorStop(1, 'rgba(255,235,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(sx - 40, 214, 80, 46);
  ctx.restore();
  // 봉인 자리 반짝임 — 글자 없이 금빛 점만
  if (p > 0.42) {
    const a = clamp01((p - 0.42) * 3.2) * (0.6 + 0.4 * Math.sin(t * 9));
    bloom(ctx, 508, 240, 26, '255,214,140', 0.5 * a);
    spark(ctx, 508, 240, 5, 'rgba(255,236,190,');
  }
  // 향 연기
  for (let i = 0; i < 12; i++) {
    const q = (t * 0.5 + i * 0.2) % 1;
    const x = 206 + Math.sin(q * 6 + i) * 12;
    px(ctx, x, 250 - q * 110, 2, 2, `rgba(226,214,206,${(0.16 * (1 - q)).toFixed(3)})`);
    px(ctx, 610 + Math.sin(q * 5 + i) * 10, 252 - q * 96, 2, 2, `rgba(226,214,206,${(0.13 * (1 - q)).toFixed(3)})`);
  }
  embers(ctx, t, p, '255,200,130', 12);
}

function fxBefriend(ctx, t, p) {
  const cx = 352, cy = 286;
  const beat = (t * 1.3) % 1;
  const hit = beat < 0.22 ? 1 - beat / 0.22 : 0;
  if (hit > 0) {
    spark(ctx, cx, cy, 4 + Math.round((1 - hit) * 6), 'rgba(255,232,180,');
    glowRing(ctx, cx, cy, 8 + (1 - hit) * 26, 0.4 * hit, '255,226,170');
    bloom(ctx, cx, cy, 34, '255,214,150', 0.4 * hit);
  }
  // 잔에서 오르는 김이나 향
  for (let i = 0; i < 10; i++) {
    const q = (t * 0.55 + i * 0.17) % 1;
    px(ctx, 330 + i * 6 + Math.sin(q * 6 + i) * 7, 272 - q * 60, 2, 2, `rgba(240,226,206,${(0.14 * (1 - q)).toFixed(3)})`);
  }
  // 등불 곁 반딧불
  for (let i = 0; i < 7; i++) {
    const x = 176 + Math.sin(t * 0.9 + i * 2.3) * 26 + i * 4;
    const y = 150 + Math.cos(t * 1.2 + i) * 20 + (i % 3) * 14;
    firefly(ctx, x, y, 0.25 + 0.4 * Math.abs(Math.sin(t * 2 + i)));
  }
  bloom(ctx, 500, 128, 70, '255,206,140', 0.10);
  embers(ctx, t, p, '255,200,130', 10);
}

function fxReward(ctx, t, p) {
  const cx = 232, cy = 176;
  bloom(ctx, cx, cy - 16, 130, '255,200,110', 0.16 + 0.06 * Math.sin(t * 3.4));
  for (let i = 0; i < 16; i++) {
    const q = (t * 0.62 + i * 0.097) % 1;
    const spread = 34 + (i % 5) * 16;
    const x = cx + Math.sin(i * 2.4) * spread * (0.4 + q * 0.8);
    const y = cy - 4 - q * 150 + Math.sin(q * 5 + i) * 8;
    coin(ctx, x, y, 6 + (i % 3), t + i * 0.6);
  }
  for (let i = 0; i < 14; i++) {
    const a = i * 1.9 + t * 1.4;
    const r = 24 + ((t * 52 + i * 21) % 90);
    px(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62, 2, 2, `rgba(255,232,176,${(0.55 + 0.35 * Math.sin(t * 6 + i)).toFixed(3)})`);
  }
  embers(ctx, t, p, '255,214,130', 18);
}

function fxLearn(ctx, t, p) {
  const cx = 352, cy = 300;
  // 지휘하는 손끝에서 퍼지는 신호
  for (let i = 0; i < 3; i++) {
    const q = ((t * 0.9 + i * 0.33) % 1);
    glowRing(ctx, cx + 60, cy - 60, 10 + q * 190, 0.24 * (1 - q), '220,240,190');
  }
  bloom(ctx, cx + 60, cy - 60, 90, '210,235,170', 0.12 + 0.04 * Math.sin(t * 3));
  // 진형 위로 지나가는 빛결
  for (let i = 0; i < 24; i++) {
    const row = Math.floor(i / 8);
    const x = 250 + (i % 8) * 46 + Math.sin(t * 1.2 + i) * 3;
    const y = 236 - row * 34;
    const a = 0.25 + 0.45 * Math.abs(Math.sin(t * 2 + i * 0.5));
    px(ctx, x, y, 3, 3, `rgba(255,226,150,${a.toFixed(3)})`);
    if (a > 0.55) bloom(ctx, x, y, 8, '255,214,140', a * 0.35);
  }
  // 횃불 연기
  for (let i = 0; i < 8; i++) {
    const q = (t * 0.5 + i * 0.21) % 1;
    px(ctx, 120 + i * 66, 340 - q * 90, 2, 2, `rgba(230,206,180,${(0.12 * (1 - q)).toFixed(3)})`);
  }
  embers(ctx, t, p, '255,206,140', 14);
}

function fxPlot(ctx, t, p) {
  // 자줏빛 안개가 낮게 흐른다
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const x = ((i * 128 + t * 26) % (W + 240)) - 120;
    const y = H * 0.66 + Math.sin(t * 0.8 + i) * 12;
    bloom(ctx, x, y, 120, '150,120,200', 0.07 + (i % 3) * 0.02);
  }
  ctx.restore();
  // 촛불 흔들림
  const flick = 0.7 + 0.3 * Math.sin(t * 11) + 0.12 * Math.sin(t * 23);
  bloom(ctx, 594, 246, 40, '255,196,120', 0.24 * flick);
  px(ctx, 593, 236, 2.4, 7 + flick * 3, `rgba(255,226,160,${0.85 * flick})`);
  // 두루마리 곁의 속삭임 — 글자 없이 옅은 고리만
  for (let i = 0; i < 3; i++) {
    const q = ((t * 0.7 + i * 0.33) % 1);
    glowRing(ctx, 470, 272, 8 + q * 44, 0.16 * (1 - q), '196,160,240');
  }
  // 그림자 속의 기척
  const sus = 0.16 + 0.10 * Math.abs(Math.sin(t * 2.2));
  bloom(ctx, 96, 300, 34, '170,140,220', sus);
  for (let i = 0; i < 9; i++) {
    const q = (t * 0.4 + i * 0.2) % 1;
    px(ctx, 60 + i * 70, H * 0.8 - q * 70, 2, 2, `rgba(198,170,240,${(0.3 * (1 - q)).toFixed(3)})`);
  }
  embers(ctx, t, p, '190,160,235', 10);
}

function fxPromote(ctx, t, p) {
  const cx = 332, cy = 196;
  // 금빛 광선
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.6);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    const len = (70 + p * 90) * (0.75 + 0.25 * Math.sin(t * 3 + i));
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, 'rgba(255,224,150,0.26)');
    g.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -3, len, 6);
  }
  ctx.restore();
  bloom(ctx, cx, cy, 120, '255,210,130', 0.20 + 0.06 * Math.sin(t * 4));
  // 붉은 깃발 물결
  for (let i = 0; i < 4; i++) {
    px(ctx, 236 + i * 3, 90 + Math.sin(t * 3 + i) * 3, 30, 2, `rgba(255,180,140,${(0.10 + i * 0.04).toFixed(3)})`);
  }
  // 솟는 불티
  for (let i = 0; i < 16; i++) {
    const q = (t * 0.66 + i * 0.11) % 1;
    const x = cx - 60 + ((i * 53) % 160) + Math.sin(q * 6 + i) * 12;
    px(ctx, x, cy + 60 - q * 230, 2.2, 3.4, `rgba(255,226,160,${(0.6 * (1 - q)).toFixed(3)})`);
  }
  embers(ctx, t, p, '255,214,140', 18);
}

const SCENES = {
  draft: fxDraft,
  train: fxTrain,
  agri: fxAgri,
  comm: fxComm,
  order: fxOrder,
  water: fxWater,
  hire: fxHire,
  befriend: fxBefriend,
  reward: fxReward,
  learn: fxLearn,
  plot: fxPlot,
  promote: fxPromote,
};

/* ---------- 오버레이 ---------- */
let current = null;

function ensureStyle() {
  if (document.getElementById('afx-style')) return;
  const st = document.createElement('style');
  st.id = 'afx-style';
  st.textContent = `
    .afx { position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center;
      background: radial-gradient(120% 90% at 50% 40%, rgba(30,18,8,0.72) 0%, rgba(4,3,2,0.94) 78%);
      animation: afxIn 0.18s ease-out; -webkit-tap-highlight-color: transparent; }
    .afx.closing { animation: afxOut 0.32s ease-in forwards; }
    .afx-stage { position: relative; width: min(92vw, 380px); border-radius: 10px; overflow: hidden;
      border: 1px solid #8a6532; background: #120c07;
      box-shadow: 0 0 0 1px rgba(255,190,120,0.08), 0 18px 50px rgba(0,0,0,0.7), 0 0 46px rgba(200,120,40,0.18);
      animation: afxPop 0.24s cubic-bezier(.2,1.3,.5,1); }
    .afx-canvas { display: block; width: 100%; aspect-ratio: 16 / 9; height: auto; background: #120c07; }
    .afx-face { position: absolute; left: 10px; top: 10px; width: 58px; height: 58px; border-radius: 4px;
      border: 1px solid #b98a42; box-shadow: 0 0 16px rgba(255,170,80,0.3), 0 2px 8px rgba(0,0,0,0.6);
      image-rendering: pixelated; background: #1a130c; }
    .afx-tag { position: absolute; right: 10px; top: 10px; font-size: 10px; letter-spacing: 1.4px; color: #1a1208;
      background: linear-gradient(180deg, #ffe3ae, #d9a05a); border-radius: 2px; padding: 3px 8px; font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
    .afx-cap { padding: 12px 14px 14px; background: linear-gradient(180deg, rgba(36,26,16,0.92), rgba(18,12,7,0.96));
      border-top: 1px solid rgba(217,160,90,0.25); }
    .afx-name { font-size: 12px; color: #d9c6a2; letter-spacing: 1px; }
    .afx-line { margin-top: 4px; font-size: 15px; line-height: 1.5; color: #fff0d2; font-weight: 600; letter-spacing: 0.2px;
      text-shadow: 0 1px 3px #000, 0 0 18px rgba(255,170,80,0.18); }
    .afx-deltas { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .afx-deltas b { font-size: 12px; color: #ffdf9a; border: 1px solid #6b4b28; border-radius: 2px; padding: 3px 9px;
      background: rgba(60,40,20,0.6); letter-spacing: 0.4px; }
    .afx-merit { font-size: 11px; color: #b8d69a; border: 1px solid #4f6238; border-radius: 2px; padding: 3px 9px;
      background: rgba(40,52,26,0.5); letter-spacing: 0.4px; }
    .afx.bad .afx-line { color: #f0c0b0; }
    .afx.bad .afx-deltas b { color: #e8a090; border-color: #6a3a2c; }
    .afx-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(0,0,0,0.55); }
    .afx-bar i { display: block; height: 100%; width: 100%; transform-origin: left;
      background: linear-gradient(90deg, #b47c36, #ffe0a0); animation: afxBar ${ACTION_FX_MS}ms linear forwards; }
    @keyframes afxBar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes afxIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes afxOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes afxPop { from { transform: translateY(14px) scale(0.97); opacity: 0.6; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .afx-stage { animation: none; }
    }
  `;
  document.head.appendChild(st);
}

/*
 * playActionFx({ kind, name, line, delta, merit, portrait, tone })
 * — 2000ms 뒤 스스로 닫히고 resolve 된다. 스킵 입력은 받지 않는다.
 */
export function playActionFx(opts = {}) {
  if (typeof document === 'undefined') return Promise.resolve();
  ensureStyle();
  if (current) { clearTimeout(current.timer); cancelAnimationFrame(current.raf); current.el.remove(); current = null; }
  const kind = opts.kind || 'default';
  const meta = sceneOf(kind);
  const tone = opts.tone === 'bad' ? '#c4614a'
    : /^#[0-9a-f]{6}$/i.test(opts.tone || '') ? opts.tone : meta.tone;
  const el = document.createElement('div');
  el.className = 'afx' + (kind === 'promote' ? ' rank' : '') + (opts.tone === 'bad' ? ' bad' : '');
  el.id = 'actionfx';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="afx-stage">
      <canvas class="afx-canvas" width="${W}" height="${H}"></canvas>
      ${opts.portrait ? `<img class="afx-face" src="${opts.portrait}" alt="" />` : ''}
      <div class="afx-tag">${meta.ko}</div>
      <div class="afx-cap">
        <div class="afx-name">${opts.name || ''}</div>
        <div class="afx-line">${opts.line || ''}</div>
        <div class="afx-deltas">
          ${opts.delta ? `<b>${opts.delta}</b>` : ''}
          ${opts.merit ? `<span class="afx-merit">공적 +${opts.merit}</span>` : ''}
        </div>
      </div>
      <div class="afx-bar"><i></i></div>
    </div>`;
  document.body.appendChild(el);
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;

  const scene = SCENES[kind] || fxReward;
  const t0 = performance.now();
  const draw = (now) => {
    if (!current || current.el !== el) return;
    const t = Math.min(1, (now - t0) / ACTION_FX_MS);
    const sec = (now - t0) / 1000;
    drawBackground(ctx, kind, t);
    scene(ctx, sec, t, tone);
    embers(ctx, sec, t, '255,190,116', 8);
    sweep(ctx, t);
    ctx.drawImage(overlayLayer(), 0, 0);
    // 마무리 섬광
    if (t > 0.86) {
      const a = Math.sin(((t - 0.86) / 0.14) * Math.PI) * 0.15;
      ctx.fillStyle = `rgba(255,235,190,${a})`;
      ctx.fillRect(0, 0, W, H);
    }
    current.raf = requestAnimationFrame(draw);
  };
  current = { el, raf: requestAnimationFrame(draw), timer: null };

  return new Promise((resolve) => {
    const close = () => {
      if (!current || current.el !== el) { resolve(); return; }
      cancelAnimationFrame(current.raf);
      el.classList.add('closing');
      const done = () => { el.remove(); current = null; resolve(); };
      setTimeout(done, 320);
    };
    current.timer = setTimeout(close, ACTION_FX_MS);
  });
}

export function actionFxPlaying() {
  return !!current;
}
