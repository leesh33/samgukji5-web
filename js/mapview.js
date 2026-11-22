/* 중국 전도 — HD-2D 전장 지도
   입체 산맥 음영 · 대기 원근 안개 · 흐르는 강물 · 돌다리 · 2.5D 성곽
   드래그·핀치 줌·탭 선택은 그대로. */
import { CITIES, CITY_BY_ID, FACTION_COLORS, REGIONS } from './data.js';

const LAND = [
  [30, 4], [42, 3], [54, 4], [64, 6], [72, 5], [80, 6], [86, 9], [88, 14], [84, 16], [80, 17],
  [76, 18], [78, 22], [82, 24], [86, 28], [84, 31], [86, 35], [84, 38], [86, 42], [82, 46],
  [78, 50], [74, 54], [70, 58], [66, 62], [64, 66], [60, 64], [56, 58], [52, 56], [48, 52],
  [44, 48], [40, 44], [36, 40], [32, 36], [29, 32], [26, 28], [25, 23], [26, 16], [28, 9],
];

const RIVERS = [
  [[38, 26], [45, 27], [52, 26], [58, 27], [64, 27], [70, 29], [76, 30], [82, 31]],
  [[42, 38], [48, 40], [54, 41], [60, 41], [66, 41], [72, 41], [78, 40], [84, 40]],
  [[52, 44], [56, 46], [61, 47], [66, 46], [70, 44]],
];

/* 산맥 — 굵직한 능선 (좌표는 지도 눈금) */
const MOUNTAINS = [
  [33, 26], [36, 30], [39, 34], [42, 28], [46, 30], [49, 33], [35, 35], [38, 38],
  [43, 36], [47, 37], [52, 33], [55, 35], [34, 22], [40, 24], [45, 22], [50, 28],
  [58, 36], [60, 38], [30, 34], [37, 44], [42, 44],
  [55, 43], [63, 33], [66, 30], [43, 33], [31, 29], [48, 25], [53, 30], [70, 45],
  [75, 47], [79, 41], [62, 55], [57, 52], [45, 40],
];

/* ---------- 색 도구 ---------- */
function hexToRgb(a) {
  const h = String(a || '#888888').replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mix(a, b, t) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(pa.r * (1 - t) + pb.r * t), g = Math.round(pa.g * (1 - t) + pb.g * t), bl = Math.round(pa.b * (1 - t) + pb.b * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}
function rgba(hex, a) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}
function rnd(seed, i) {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* 볼록 껍질 — 권역 영토 경계선 */
function hull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

/* 두 선분의 교차점 (없으면 null) */
function segCross(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  if (t <= 0.04 || t >= 0.96 || u <= 0.02 || u >= 0.98) return null;
  return { x: a.x + r.x * t, y: a.y + r.y * t, along: { x: r.x, y: r.y } };
}

/* ---------- 팔레트 ---------- */
const P = {
  seaTop: '#123a40', seaMid: '#0a2830', seaBot: '#04141a',
  landHi: '#5d5b34', land: '#454a2a', landLo: '#292f1c',
  grass: '#42522e', lush: '#3d5429', desert: '#6f5b36', marsh: '#3d4d40',
  rockLit: '#9d8f66', rockMid: '#6b6042', rockDark: '#33301f',
  haze: '#c9a877',
  tree: '#31482a', treeLit: '#688a4a', treeDark: '#1d2a17',
  water: '#1f5666', waterDeep: '#092430', waterLit: '#8fd4dc', foam: '#bfe6e8',
  road: '#b08a52',
  gold: '#d9a05a', goldHi: '#ffd79a',
};

export function createMapView(canvas, { onSelectCity, onTapEmpty } = {}) {
  const ctx = canvas.getContext('2d');
  let state = null;
  let stateVer = 0;
  let selected = null;
  let cam = { x: 57, y: 35, zoom: 1 };
  let dpr = Math.min(2.5, window.devicePixelRatio || 1);
  let cssW = 0, cssH = 0;
  let dragging = false;
  let moved = false;
  let pointers = new Map();
  let lastPinch = 0;
  let raf = null;

  /* 정적인 지형 레이어 캐시 — 카메라·크기·영토가 바뀔 때만 다시 그린다 */
  let bg = null;
  let bgKey = '';
  let bgCtx = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width || canvas.clientWidth || 0);
    const h = Math.max(1, rect.height || canvas.clientHeight || 0);
    const d = Math.min(2.5, window.devicePixelRatio || 1);
    if (w < 2 || h < 2) return; // 숨겨진 화면(전투 등)에서는 크기를 유지
    if (w === cssW && h === cssH && d === dpr) return;
    cssW = w; cssH = h; dpr = d;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    clampCam();
    requestRender();
  }
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => resize()).observe(canvas);
  }

  const TOP_INSET = 26;
  const BOUNDS = { x0: 23, x1: 91, y0: 2, y1: 68 };
  // 세로 화면을 채우기 위한 완만한 세로 신축(지도 여백 제거)
  const STRETCH = 1.5;
  const fitScale = () => Math.max(0.01, Math.min(cssW / (BOUNDS.x1 - BOUNDS.x0), (cssH - TOP_INSET) / (BOUNDS.y1 - BOUNDS.y0)));
  const scale = () => fitScale() * cam.zoom;
  const scaleY = () => scale() * Math.min(STRETCH, Math.max(1, Math.max(0, (cssH - TOP_INSET)) / (BOUNDS.y1 - BOUNDS.y0) / fitScale()));

  function toScreen(wx, wy) {
    return { x: (wx - cam.x) * scale() + cssW / 2, y: (wy - cam.y) * scaleY() + TOP_INSET + (cssH - TOP_INSET) / 2 };
  }
  function toWorld(sx, sy) {
    return { x: (sx - cssW / 2) / scale() + cam.x, y: (sy - TOP_INSET - (cssH - TOP_INSET) / 2) / scaleY() + cam.y };
  }

  function clampCam() {
    cam.zoom = Math.max(1, Math.min(3.6, cam.zoom));
    if (!Number.isFinite(cam.x) || !Number.isFinite(cam.y)) cam.x = 57, cam.y = 35;
    if (!cssW || !cssH) return;
    const halfW = cssW / 2 / scale(), halfH = (cssH - TOP_INSET) / 2 / scaleY();
    const minX = BOUNDS.x0 + halfW, maxX = BOUNDS.x1 - halfW;
    const minY = BOUNDS.y0 + halfH, maxY = BOUNDS.y1 - halfH;
    cam.x = minX > maxX ? (minX + maxX) / 2 : Math.max(minX, Math.min(maxX, cam.x));
    cam.y = minY > maxY ? (minY + maxY) / 2 : Math.max(minY, Math.min(maxY, cam.y));
  }

  function requestRender() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; render(); });
  }

  function insideLand(x, y) {
    let inside = false;
    for (let i = 0, j = LAND.length - 1; i < LAND.length; j = i++) {
      const xi = LAND[i][0], yi = LAND[i][1], xj = LAND[j][0], yj = LAND[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function landPath(c = ctx) {
    c.beginPath();
    LAND.forEach(([x, y], i) => {
      const p = toScreen(x, y);
      if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
    });
    c.closePath();
  }

  /* ---------- 바다 ---------- */
  function drawSea(c) {
    const g = c.createLinearGradient(0, 0, cssW * 0.25, cssH);
    g.addColorStop(0, P.seaTop);
    g.addColorStop(0.45, P.seaMid);
    g.addColorStop(1, P.seaBot);
    c.fillStyle = g;
    c.fillRect(0, 0, cssW, cssH);

    // 잔물결 — 낮게 깔린 청록 결
    c.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const y0 = (i / 16) * cssH + 4;
      c.beginPath();
      for (let x = -12; x <= cssW + 12; x += 26) {
        const y = y0 + Math.sin(x * 0.011 + i * 1.7) * 5 + Math.sin(x * 0.027 + i) * 1.8;
        if (x === -12) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = i % 4 === 0 ? 'rgba(140, 210, 220, 0.055)' : 'rgba(96, 168, 186, 0.03)';
      c.stroke();
    }
    // 상단의 따뜻한 빛 — 해가 낮게 걸린 느낌
    const warm = c.createRadialGradient(cssW * 0.22, -cssH * 0.06, 0, cssW * 0.22, -cssH * 0.06, Math.max(cssW, cssH) * 0.9);
    warm.addColorStop(0, 'rgba(255, 178, 96, 0.22)');
    warm.addColorStop(0.42, 'rgba(220, 130, 70, 0.07)');
    warm.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = warm;
    c.fillRect(0, 0, cssW, cssH);
  }

  /* ---------- 육지 ---------- */
  function drawLand(c) {
    landPath(c);
    const gy0 = toScreen(0, 0).y, gy1 = toScreen(0, 70).y;
    if (!Number.isFinite(gy0) || !Number.isFinite(gy1)) return;
    const g = c.createLinearGradient(0, gy0, 0, gy1);
    g.addColorStop(0, mix(P.landHi, P.haze, 0.22));
    g.addColorStop(0.34, P.land);
    g.addColorStop(0.76, mix(P.landLo, P.land, 0.45));
    g.addColorStop(1, P.landLo);
    // 2.5D — 육지가 바다 위로 살짝 떠 보이게 그림자를 깔고 채운다
    c.save();
    c.shadowColor = 'rgba(2, 8, 10, 0.8)';
    c.shadowBlur = Math.max(14, scale() * 5);
    c.shadowOffsetY = Math.max(5, scale() * 1.6);
    c.fillStyle = g;
    c.fill();
    c.restore();

    c.save();
    landPath(c);
    c.clip();
    // 해안 안쪽 그늘 — 육지가 살짝 떠 보이게
    landPath(c);
    c.strokeStyle = 'rgba(14, 12, 6, 0.5)';
    c.lineWidth = Math.max(10, scale() * 4);
    c.stroke();
    c.restore();

    // 해안선 — 모래빛 띠 + 밝은 물빛 테
    landPath(c);
    c.strokeStyle = 'rgba(12, 10, 5, 0.55)';
    c.lineWidth = 2.4;
    c.stroke();
    if (cam.zoom > 1.35) {
      landPath(c);
      c.strokeStyle = 'rgba(206, 178, 118, 0.3)';
      c.lineWidth = 1.1;
      c.stroke();
    }
    landPath(c);
    c.save();
    c.shadowColor = 'rgba(150, 220, 225, 0.45)';
    c.shadowBlur = 7;
    c.strokeStyle = 'rgba(170, 226, 230, 0.22)';
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  }

  /* ---------- 지형 결: 권역 색감 · 능선 흙빛 · 등고선 ---------- */
  function drawTerrainTexture(c) {
    c.save();
    landPath(c);
    c.clip();

    const s = scale();
    const patches = [
      { x: 33, y: 20, rx: 10, ry: 6, col: '#7d6432', a: 0.6 },   // 서북 마른 땅
      { x: 41, y: 15, rx: 8, ry: 5, col: '#6b5831', a: 0.4 },
      { x: 44, y: 41, rx: 9, ry: 7, col: '#3b5a28', a: 0.62 },    // 익주 분지
      { x: 67, y: 33, rx: 13, ry: 8, col: '#52602f', a: 0.55 },    // 중원 평야
      { x: 78, y: 45, rx: 8, ry: 7, col: '#33564c', a: 0.55 },    // 강남 물가
      { x: 56, y: 8, rx: 11, ry: 6, col: '#4a5230', a: 0.42 },
      { x: 62, y: 53, rx: 9, ry: 7, col: '#2e5028', a: 0.6 },
      { x: 76, y: 24, rx: 7, ry: 6, col: '#3f5330', a: 0.34 },
    ];
    for (const pt of patches) {
      const p = toScreen(pt.x, pt.y);
      const rad = Math.max(pt.rx, pt.ry) * s;
      const rg = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      rg.addColorStop(0, rgba(pt.col, pt.a));
      rg.addColorStop(0.55, rgba(pt.col, pt.a * 0.45));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.beginPath();
      c.ellipse(p.x, p.y, pt.rx * s, pt.ry * scaleY(), 0, 0, Math.PI * 2);
      c.fill();
    }

    // 흙 알갱이 — 넓은 벌판에 결을 준다
    for (let i = 0; i < 900; i++) {
      const wx = 24 + rnd(i, 11) * 68, wy = 3 + rnd(i, 12) * 65;
      const p = toScreen(wx, wy);
      if (p.x < 0 || p.y < 0 || p.x > cssW || p.y > cssH) continue;
      const big = rnd(i, 13) > 0.86;
      c.fillStyle = big ? 'rgba(240, 220, 170, 0.05)' : 'rgba(14, 12, 7, 0.07)';
      c.fillRect(p.x, p.y, big ? 2 : 1, big ? 2 : 1);
    }

    // 능선 흙빛 — 빛 받는 쪽(좌상)은 밝게, 반대쪽은 어둡게 번진 자리
    for (let i = 0; i < MOUNTAINS.length; i++) {
      const [wx, wy] = MOUNTAINS[i];
      const p = toScreen(wx, wy);
      const r = Math.max(6, s * 2.6);
      const lg = c.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, 0, p.x - r * 0.35, p.y - r * 0.4, r);
      lg.addColorStop(0, 'rgba(236, 210, 150, 0.11)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = lg;
      c.beginPath(); c.arc(p.x - r * 0.35, p.y - r * 0.4, r, 0, Math.PI * 2); c.fill();
      const dg = c.createRadialGradient(p.x + r * 0.5, p.y + r * 0.55, 0, p.x + r * 0.5, p.y + r * 0.55, r);
      dg.addColorStop(0, 'rgba(16, 14, 8, 0.24)');
      dg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = dg;
      c.beginPath(); c.arc(p.x + r * 0.5, p.y + r * 0.55, r, 0, Math.PI * 2); c.fill();
    }

    // 넓은 기복 — 빛은 좌상, 그늘은 우하로 길게
    const hills = MOUNTAINS.concat([
      [55, 18], [60, 22], [68, 20], [74, 34], [70, 40], [58, 44], [50, 48], [46, 52],
      [40, 30], [30, 40], [36, 48], [64, 58], [72, 50], [80, 34], [52, 36], [44, 22],
    ]);
    for (let i = 0; i < hills.length; i++) {
      const [hx, hy] = hills[i];
      const hp = toScreen(hx, hy);
      const r = Math.max(10, s * (2.6 + rnd(i, 21) * 2.2));
      const lightG = c.createRadialGradient(hp.x - r * 0.42, hp.y - r * 0.46, 0, hp.x - r * 0.42, hp.y - r * 0.46, r);
      lightG.addColorStop(0, 'rgba(255, 232, 172, 0.13)');
      lightG.addColorStop(0.55, 'rgba(240, 210, 150, 0.05)');
      lightG.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = lightG;
      c.beginPath(); c.arc(hp.x - r * 0.42, hp.y - r * 0.46, r, 0, Math.PI * 2); c.fill();
      const darkG = c.createRadialGradient(hp.x + r * 0.5, hp.y + r * 0.56, 0, hp.x + r * 0.5, hp.y + r * 0.56, r * 1.1);
      darkG.addColorStop(0, 'rgba(14, 16, 7, 0.2)');
      darkG.addColorStop(0.6, 'rgba(14, 16, 7, 0.07)');
      darkG.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = darkG;
      c.beginPath(); c.arc(hp.x + r * 0.5, hp.y + r * 0.56, r * 1.1, 0, Math.PI * 2); c.fill();
    }

    // 숲 그늘 — 산기슭과 강가에 짙은 초록
    const woods = [
      [41, 30, 5, 3], [46, 34, 4, 3], [37, 42, 5, 3.5], [50, 46, 4, 3],
      [57, 40, 4.5, 3], [62, 46, 5, 3.5], [70, 52, 5, 4], [76, 38, 4, 3],
      [80, 46, 4, 3], [58, 28, 4, 2.6], [48, 22, 4, 2.6], [66, 24, 4, 3],
      [72, 44, 3.5, 2.6], [34, 36, 4, 3],
    ];
    for (const [wx, wy, rx, ry] of woods) {
      const p2 = toScreen(wx, wy);
      const rg = c.createRadialGradient(p2.x, p2.y, 0, p2.x, p2.y, Math.max(rx, ry) * s);
      rg.addColorStop(0, 'rgba(26, 48, 22, 0.4)');
      rg.addColorStop(0.6, 'rgba(28, 50, 22, 0.18)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.beginPath(); c.ellipse(p2.x, p2.y, rx * s, ry * scaleY(), 0, 0, Math.PI * 2); c.fill();
    }

    // 등고선 — 완만하게 흔들리는 지형선
    c.lineWidth = 1;
    const lines = 16;
    for (let i = 0; i < lines; i++) {
      const wy = 3 + (i / lines) * 66;
      c.beginPath();
      let started = false;
      for (let wx = 24; wx <= 92; wx += 2) {
        const y = wy
          + Math.sin(wx * 0.31 + i * 1.6) * 1.35
          + Math.sin(wx * 0.13 + i * 0.7) * 1.9
          + Math.sin(wx * 0.61 + i * 0.4) * 0.55;
        const p = toScreen(wx, y);
        if (!started) { c.moveTo(p.x, p.y); started = true; } else c.lineTo(p.x, p.y);
      }
      c.strokeStyle = i % 5 === 0 ? 'rgba(240, 214, 160, 0.085)' : 'rgba(210, 200, 170, 0.038)';
      c.stroke();
    }
    c.restore();
  }

  /* ---------- 산맥 2.5D ---------- */
  /* ---------- 산맥 2.5D ---------- */
  function ridgePeak(c, x, y, w, h, lit, mid, dark, hazeA) {
    c.beginPath();
    c.moveTo(x, y - h);
    c.quadraticCurveTo(x - w * 0.26, y - h * 0.42, x - w, y + h * 0.24);
    c.lineTo(x + w, y + h * 0.24);
    c.quadraticCurveTo(x + w * 0.2, y - h * 0.5, x, y - h);
    c.closePath();
    const g = c.createLinearGradient(x - w, y - h, x + w, y + h * 0.2);
    g.addColorStop(0, lit);
    g.addColorStop(0.36, mid);
    g.addColorStop(0.78, dark);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(18, 16, 9, 0.4)';
    c.lineWidth = Math.max(0.4, h * 0.03);
    c.stroke();

    // 오른쪽 그늘면
    c.beginPath();
    c.moveTo(x, y - h);
    c.quadraticCurveTo(x + w * 0.46, y - h * 0.24, x + w, y + h * 0.24);
    c.lineTo(x + w * 0.04, y + h * 0.24);
    c.closePath();
    c.fillStyle = 'rgba(10, 9, 5, 0.32)';
    c.fill();

    // 빛 받는 능선
    c.beginPath();
    c.moveTo(x, y - h);
    c.quadraticCurveTo(x - w * 0.2, y - h * 0.4, x - w * 0.7, y + h * 0.2);
    c.strokeStyle = `rgba(255, 236, 190, ${0.32 * (1 - hazeA)})`;
    c.lineWidth = Math.max(0.5, h * 0.045);
    c.stroke();
    // 바위 결
    c.strokeStyle = `rgba(22, 19, 11, ${0.24 * (1 - hazeA)})`;
    c.lineWidth = Math.max(0.35, h * 0.03);
    for (const k of [0.3, 0.58]) {
      c.beginPath();
      c.moveTo(x - w * 0.06, y - h * (0.95 - k));
      c.lineTo(x - w * (0.2 + k * 0.34), y + h * 0.2);
      c.stroke();
    }
  }

  /* 줌이 낮을 때: 뾰족한 봉우리 대신 부드러운 둔덕 — 지도가 가시밭처럼 보이지 않게 */
  function drawMountainMounds(c) {
    const s = scale();
    for (let i = 0; i < MOUNTAINS.length; i++) {
      const [wx, wy] = MOUNTAINS[i];
      const p = toScreen(wx, wy);
      if (p.x < -50 || p.y < -50 || p.x > cssW + 50 || p.y > cssH + 50) continue;
      const far = Math.max(0, Math.min(1, 1 - (wy - 3) / 42));
      const h = Math.max(3.6, s * (1.15 + rnd(i, 3) * 0.5));
      const w = h * (1.5 + rnd(i, 7) * 0.4);
      const lit = mix(mix('#9c8c62', '#756a4a', rnd(i, 9)), P.haze, 0.4 * far);
      const dark = mix('#1d1c12', P.haze, 0.36 * far);
      // 그림자
      const shg = c.createRadialGradient(p.x + w * 0.35, p.y + h * 0.2, 0, p.x + w * 0.35, p.y + h * 0.2, w * 0.9);
      shg.addColorStop(0, 'rgba(10, 9, 5, 0.28)');
      shg.addColorStop(1, 'rgba(10, 9, 5, 0)');
      c.fillStyle = shg;
      c.beginPath(); c.ellipse(p.x + w * 0.35, p.y + h * 0.2, w * 0.9, h * 0.4, 0, 0, Math.PI * 2); c.fill();
      // 둔덕
      c.beginPath();
      c.moveTo(p.x - w, p.y + h * 0.24);
      c.quadraticCurveTo(p.x - w * 0.45, p.y - h * 1.05, p.x + w * 0.05, p.y - h * 0.95);
      c.quadraticCurveTo(p.x + w * 0.7, p.y - h * 0.7, p.x + w, p.y + h * 0.24);
      c.closePath();
      const g = c.createLinearGradient(p.x - w * 0.6, p.y - h, p.x + w, p.y + h * 0.2);
      g.addColorStop(0, lit);
      g.addColorStop(0.55, mix(lit, dark, 0.55));
      g.addColorStop(1, dark);
      c.fillStyle = g;
      c.fill();
      // 빛 받는 등성이
      c.beginPath();
      c.moveTo(p.x - w * 0.82, p.y + h * 0.2);
      c.quadraticCurveTo(p.x - w * 0.42, p.y - h * 0.95, p.x + w * 0.02, p.y - h * 0.86);
      c.strokeStyle = `rgba(255, 234, 186, ${0.24 * (1 - far)})`;
      c.lineWidth = Math.max(0.5, h * 0.1);
      c.stroke();
    }
  }

  function drawMountains(c) {
    if (cam.zoom < 1.5) { drawMountainMounds(c); return; }
    const s = scale();
    for (let i = 0; i < MOUNTAINS.length; i++) {
      const [wx, wy] = MOUNTAINS[i];
      const p = toScreen(wx, wy);
      if (p.x < -70 || p.y < -70 || p.x > cssW + 70 || p.y > cssH + 70) continue;
      // 원근: 북쪽(위)일수록 옅고 안개에 잠긴다
      const far = Math.max(0, Math.min(1, 1 - (wy - 3) / 42));
      const h = Math.max(4.6, s * (1.6 + rnd(i, 3) * 0.62));
      const w = h * (1.18 + rnd(i, 7) * 0.3);
      const lit = mix(mix('#a4936a', '#7d7150', rnd(i, 9)), P.haze, 0.36 * far);
      const mid = mix('#4e4830', P.haze, 0.4 * far);
      const dark = mix('#181710', P.haze, 0.34 * far);
      const hazeA = 0.55 * far;

      // 발치 그림자 — 오른쪽 아래로
      const shg = c.createRadialGradient(p.x + w * 0.45, p.y + h * 0.3, 0, p.x + w * 0.45, p.y + h * 0.3, w * 1.2);
      shg.addColorStop(0, 'rgba(10, 9, 5, 0.34)');
      shg.addColorStop(1, 'rgba(10, 9, 5, 0)');
      c.fillStyle = shg;
      c.beginPath();
      c.ellipse(p.x + w * 0.45, p.y + h * 0.3, w * 1.2, h * 0.34, 0, 0, Math.PI * 2);
      c.fill();

      const b = i * 13.7;
      // 뒤줄 봉우리 — 흐리고 작게
      ridgePeak(c, p.x - w * (1.0 + rnd(b, 1) * 0.28), p.y + h * 0.1, w * 0.62, h * (0.62 + rnd(b, 2) * 0.2), mid, dark, mix(dark, '#0d0c07', 0.35), hazeA + 0.15);
      ridgePeak(c, p.x + w * (1.02 + rnd(b, 3) * 0.3), p.y + h * 0.13, w * 0.58, h * (0.56 + rnd(b, 4) * 0.22), mix(mid, '#000', 0.1), dark, mix(dark, '#0d0c07', 0.4), hazeA + 0.15);
      // 앞줄 봉우리
      ridgePeak(c, p.x, p.y, w, h, lit, mid, dark, hazeA);
      // 곁봉우리
      if (i % 2 === 0) ridgePeak(c, p.x - w * 0.52, p.y + h * 0.16, w * 0.52, h * 0.7, lit, mid, dark, hazeA);

      // 발치 안개 — 봉우리가 땅에 잠기듯
      const fg = c.createRadialGradient(p.x, p.y + h * 0.24, 0, p.x, p.y + h * 0.24, w * 1.5);
      fg.addColorStop(0, rgba(mix(P.land, P.haze, 0.6), 0.28 + far * 0.3));
      fg.addColorStop(0.65, rgba(mix(P.land, P.haze, 0.6), 0.12 + far * 0.14));
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = fg;
      c.beginPath();
      c.ellipse(p.x, p.y + h * 0.22, w * 1.5, h * 0.4, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  function treeAt(c, x, y, h, tone) {
    // 그림자
    c.beginPath();
    c.ellipse(x + h * 0.16, y + h * 0.06, h * 0.42, h * 0.13, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(10, 12, 6, 0.32)';
    c.fill();
    // 줄기
    c.fillStyle = 'rgba(46, 34, 18, 0.9)';
    c.fillRect(x - h * 0.05, y - h * 0.22, h * 0.1, h * 0.26);
    // 세 단 잎
    for (let k = 0; k < 3; k++) {
      const yy = y - h * (0.18 + k * 0.22);
      const ww = h * (0.42 - k * 0.09);
      c.beginPath();
      c.moveTo(x, yy - h * 0.34);
      c.lineTo(x + ww, yy + h * 0.02);
      c.lineTo(x - ww, yy + h * 0.02);
      c.closePath();
      c.fillStyle = tone;
      c.fill();
      c.beginPath();
      c.moveTo(x, yy - h * 0.34);
      c.lineTo(x - ww * 0.92, yy + h * 0.02);
      c.lineTo(x - ww * 0.16, yy + h * 0.02);
      c.closePath();
      c.fillStyle = 'rgba(180, 210, 130, 0.22)';
      c.fill();
    }
  }

  function drawTrees(c) {
    const s = scale();
    const step = 3.1;
    for (let gx = 24; gx < 92; gx += step) {
      for (let gy = 3; gy < 68; gy += step) {
        const id = gx * 7.3 + gy * 3.1;
        const r1 = rnd(id, 1), r2 = rnd(id, 2);
        if (r1 > 0.42) continue;
        const wx = gx + (r2 - 0.5) * step * 0.85;
        const wy = gy + (rnd(id, 3) - 0.5) * step * 0.85;
        if (!insideLand(wx, wy)) continue;
        // 성·도로 근처는 비운다
        let near = false;
        for (const cty of CITIES) {
          if (Math.abs(cty.x - wx) < 2.1 && Math.abs(cty.y - wy) < 1.9) { near = true; break; }
        }
        if (near) continue;
        for (const river of RIVERS) {
          for (let i = 0; i < river.length - 1; i++) {
            const [ax, ay] = river[i], [bx, by] = river[i + 1];
            const dx = bx - ax, dy = by - ay;
            const t = Math.max(0, Math.min(1, ((wx - ax) * dx + (wy - ay) * dy) / (dx * dx + dy * dy)));
            const px = ax + dx * t, py = ay + dy * t;
            if (Math.hypot(px - wx, py - wy) < 1.5) { near = true; break; }
          }
          if (near) break;
        }
        if (near) continue;
        const p = toScreen(wx, wy);
        if (p.x < -12 || p.y < -12 || p.x > cssW + 12 || p.y > cssH + 12) continue;
        const h = Math.max(2.4, s * (0.5 + rnd(id, 4) * 0.34));
        const far = Math.max(0, Math.min(1, 1 - (wy - 4) / 44));
        const tone = mix(mix(P.tree, P.treeDark, rnd(id, 5) * 0.5), P.haze, 0.4 * far);
        treeAt(c, p.x, p.y, h, tone);
      }
    }
  }

  /* ---------- 강물 (흐름은 매 프레임) ---------- */
  function riverPath(c, river) {
    c.beginPath();
    river.forEach(([x, y], i) => {
      const p = toScreen(x, y);
      if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
    });
  }

  /* ---------- 강물 (흐름은 매 프레임) ---------- */
  function riverPath(c, river) {
    c.beginPath();
    river.forEach(([x, y], i) => {
      const p = toScreen(x, y);
      if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
    });
  }

  function drawRivers(c, t, moving) {
    const s = scale();
    const w = Math.max(2.2, s * 0.5);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const river of RIVERS) {
      // 기슭 그늘
      riverPath(c, river);
      c.strokeStyle = 'rgba(8, 20, 20, 0.5)';
      c.lineWidth = w * 1.9;
      c.stroke();
      // 물 — 바닥은 짙고 가운데로 갈수록 밝게
      riverPath(c, river);
      c.strokeStyle = P.waterDeep;
      c.lineWidth = w;
      c.stroke();
      riverPath(c, river);
      c.strokeStyle = 'rgba(33, 96, 110, 0.96)';
      c.lineWidth = w * 0.6;
      c.stroke();
      riverPath(c, river);
      c.strokeStyle = 'rgba(150, 214, 220, 0.16)';
      c.lineWidth = Math.max(0.5, w * 0.14);
      c.stroke();
      // 흐르는 물빛
      riverPath(c, river);
      c.setLineDash([Math.max(2, s * 0.3), Math.max(14, s * 3.4)]);
      c.lineDashOffset = moving ? -((t * 0.014) % 320) : 0;
      c.strokeStyle = 'rgba(222, 246, 250, 0.3)';
      c.lineWidth = Math.max(0.5, w * 0.16);
      c.stroke();
      c.setLineDash([]);
      c.lineDashOffset = 0;
    }
  }

  /* ---------- 도로 ---------- */
  function drawRoads(c) {
    const s = scale();
    const seen = new Set();
    const segs = [];
    for (const city of CITIES) {
      for (const nb of city.roads) {
        const key = [city.id, nb].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = toScreen(city.x, city.y), b = toScreen(CITY_BY_ID[nb].x, CITY_BY_ID[nb].y);
        segs.push([city, CITY_BY_ID[nb], a, b]);
      }
    }
    // 길 아래 그늘
    c.lineCap = 'round';
    for (const [, , a, b] of segs) {
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      c.strokeStyle = 'rgba(10, 9, 6, 0.26)';
      c.lineWidth = Math.max(1.6, s * 0.34);
      c.stroke();
    }
    // 흙길 — 점선
    c.setLineDash([Math.max(2, s * 0.32), Math.max(2.6, s * 0.44)]);
    for (const [, , a, b] of segs) {
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      c.strokeStyle = 'rgba(226, 190, 128, 0.34)';
      c.lineWidth = Math.max(0.7, Math.min(1.5, s * 0.11));
      c.stroke();
    }
    c.setLineDash([]);
    return segs;
  }
  function drawBridges(c, segs) {
    const s = scale();
    for (const [, , a, b] of segs) {
      for (const river of RIVERS) {
        for (let i = 0; i < river.length - 1; i++) {
          const ca = toScreen(river[i][0], river[i][1]);
          const cb = toScreen(river[i + 1][0], river[i + 1][1]);
          const hit = segCross({ x: a.x, y: a.y }, { x: b.x, y: b.y }, ca, cb);
          if (!hit) continue;
          const ang = Math.atan2(hit.along.y, hit.along.x);
          const len = Math.max(7, s * 1.9), wide = Math.max(4, s * 0.95);
          c.save();
          c.translate(hit.x, hit.y);
          c.rotate(ang);
          // 그림자
          c.fillStyle = 'rgba(8, 10, 8, 0.4)';
          c.fillRect(-len / 2, -wide * 0.1, len, wide * 0.62);
          // 다리 상판 (돌)
          const g = c.createLinearGradient(0, -wide / 2, 0, wide / 2);
          g.addColorStop(0, '#b6a17c');
          g.addColorStop(0.45, '#8b7856');
          g.addColorStop(1, '#4f422c');
          c.fillStyle = g;
          c.fillRect(-len / 2, -wide / 2, len, wide);
          // 난간 밝은 선
          c.fillStyle = 'rgba(255, 230, 180, 0.45)';
          c.fillRect(-len / 2, -wide / 2, len, Math.max(0.7, wide * 0.12));
          // 홍예(아치) 그림자 두 개
          c.fillStyle = 'rgba(12, 16, 14, 0.55)';
          for (const dx of [-0.22, 0.22]) {
            c.beginPath();
            c.arc(len * dx, wide * 0.24, wide * 0.2, Math.PI, Math.PI * 2);
            c.fill();
          }
          c.restore();
        }
      }
    }
  }

  /* ---------- 권역 영토 ---------- */
  function drawTerritory(c) {
    if (!state) return;
    const groups = {};
    for (const city of CITIES) {
      const st = state.cities[city.id];
      if (!st || !st.owner) continue;
      (groups[city.region] = groups[city.region] || []).push({ c: city, owner: st.owner });
    }
    for (const [, list] of Object.entries(groups)) {
      if (list.length < 2) continue;
      const count = {};
      for (const it of list) count[it.owner] = (count[it.owner] || 0) + 1;
      const owner = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
      const fac = state.factions[owner];
      const color = (fac && fac.color) || FACTION_COLORS[owner] || '#8a8474';
      const pts = hull(list.map((it) => [it.c.x, it.c.y]));
      if (pts.length < 3) continue;
      c.beginPath();
      pts.forEach(([wx, wy], i) => {
        const p = toScreen(wx, wy);
        if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
      });
      c.closePath();
      const cg = c.createRadialGradient(cssW / 2, cssH / 2, 0, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.7);
      cg.addColorStop(0, rgba(color, 0.1));
      cg.addColorStop(1, rgba(color, 0.03));
      c.fillStyle = cg;
      c.fill();
      c.save();
      c.setLineDash([6, 5]);
      c.strokeStyle = rgba(color, 0.5);
      c.lineWidth = 1;
      c.stroke();
      c.setLineDash([]);
      c.restore();
      // 안쪽 은은한 빛
      c.save();
      c.shadowColor = rgba(color, 0.45);
      c.shadowBlur = 10;
      c.strokeStyle = rgba(color, 0.26);
      c.stroke();
      c.restore();
    }
  }

  /* ---------- 대기: 따뜻한 안개 · 빛줄기 · 비네트 ---------- */
  function drawAtmosphere(c) {
    // 낮게 깔린 안개 띠
    const bands = [
      { y: 0.3, h: 0.1, a: 0.05 },
      { y: 0.52, h: 0.09, a: 0.045 },
      { y: 0.7, h: 0.1, a: 0.04 },
    ];
    c.save();
    landPath(c);
    c.clip();
    for (const b of bands) {
      const g = c.createLinearGradient(0, cssH * b.y, 0, cssH * (b.y + b.h));
      g.addColorStop(0, 'rgba(228, 190, 132, 0)');
      g.addColorStop(0.5, `rgba(228, 190, 132, ${b.a})`);
      g.addColorStop(1, 'rgba(228, 190, 132, 0)');
      c.fillStyle = g;
      c.fillRect(0, cssH * b.y, cssW, cssH * b.h);
    }
    // 좌상단에서 내려오는 빛
    c.globalCompositeOperation = 'screen';
    const beam = c.createLinearGradient(cssW * 0.1, 0, cssW * 0.6, cssH * 0.75);
    beam.addColorStop(0, 'rgba(255, 196, 120, 0.09)');
    beam.addColorStop(0.45, 'rgba(255, 170, 90, 0.03)');
    beam.addColorStop(1, 'rgba(255, 160, 80, 0)');
    c.fillStyle = beam;
    c.fillRect(0, 0, cssW, cssH);
    c.globalCompositeOperation = 'source-over';
    c.restore();

    // 가장자리 비네트
    const v = c.createRadialGradient(cssW / 2, cssH * 0.46, Math.min(cssW, cssH) * 0.28, cssW / 2, cssH * 0.46, Math.max(cssW, cssH) * 0.82);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.74, 'rgba(6, 5, 3, 0.16)');
    v.addColorStop(1, 'rgba(4, 3, 2, 0.46)');
    c.fillStyle = v;
    c.fillRect(0, 0, cssW, cssH);
  }

  /* ---------- 성곽 2.5D ---------- */
  /* ---------- 성곽 2.5D ---------- */
  function eaveRoof(c, cx, yy, halfW, peakH, hi, mid, lo) {
    c.beginPath();
    c.moveTo(cx - halfW, yy);
    c.quadraticCurveTo(cx - halfW * 0.5, yy - peakH * 0.52, cx - halfW * 0.06, yy - peakH);
    c.lineTo(cx + halfW * 0.06, yy - peakH);
    c.quadraticCurveTo(cx + halfW * 0.5, yy - peakH * 0.52, cx + halfW, yy);
    c.quadraticCurveTo(cx + halfW * 0.45, yy + peakH * 0.24, cx, yy + peakH * 0.28);
    c.quadraticCurveTo(cx - halfW * 0.45, yy + peakH * 0.24, cx - halfW, yy);
    c.closePath();
    const g = c.createLinearGradient(cx - halfW, yy - peakH, cx + halfW, yy + peakH * 0.28);
    g.addColorStop(0, hi);
    g.addColorStop(0.48, mid);
    g.addColorStop(1, lo);
    c.fillStyle = g;
    c.fill();

    // 처마선 — 금빛
    c.beginPath();
    c.moveTo(cx - halfW, yy);
    c.quadraticCurveTo(cx - halfW * 0.5, yy - peakH * 0.52, cx - halfW * 0.06, yy - peakH);
    c.lineTo(cx + halfW * 0.06, yy - peakH);
    c.quadraticCurveTo(cx + halfW * 0.5, yy - peakH * 0.52, cx + halfW, yy);
    c.strokeStyle = 'rgba(255, 208, 144, 0.6)';
    c.lineWidth = Math.max(0.35, peakH * 0.075);
    c.stroke();

    // 기와 골
    c.strokeStyle = 'rgba(255, 226, 176, 0.17)';
    c.lineWidth = Math.max(0.28, peakH * 0.05);
    for (let k = -2; k <= 2; k++) {
      c.beginPath();
      c.moveTo(cx + k * halfW * 0.07, yy - peakH * 0.9);
      c.lineTo(cx + k * halfW * 0.34, yy + peakH * 0.14);
      c.stroke();
    }
  }

  function castleArt(c, p, sz, color, owner, major, t) {
    const u = sz / 2;
    const x = p.x, y = p.y;
    const stoneHi = mix('#d0b98c', color, 0.12);
    const stoneMid = mix('#8a7857', color, 0.18);
    const stoneLo = mix('#2f281b', color, 0.2);
    const roofHi = mix(color, '#a8c8d0', 0.46);
    const roofMid = mix(color, '#1e2c33', 0.66);
    const roofLo = mix(color, '#080f13', 0.8);

    const wallBot = y + u * 0.62;
    const wallH = u * 0.46;
    const wallTop = wallBot - wallH;
    const wHalf = u * 1.05;
    const thick = u * 0.13;

    // 바닥 그림자
    const sh = c.createRadialGradient(x, wallBot + u * 0.08, 0, x, wallBot + u * 0.08, u * 1.35);
    sh.addColorStop(0, 'rgba(8, 7, 4, 0.52)');
    sh.addColorStop(0.55, 'rgba(8, 7, 4, 0.24)');
    sh.addColorStop(1, 'rgba(8, 7, 4, 0)');
    c.fillStyle = sh;
    c.beginPath();
    c.ellipse(x, wallBot + u * 0.08, u * 1.35, u * 0.4, 0, 0, Math.PI * 2);
    c.fill();

    /* --- 뒤편 누각 --- */
    const cw = u * (major ? 0.94 : 0.8);
    const keepTop = wallTop - u * (major ? 0.82 : 0.64);
    const keepBot = wallTop + u * 0.16;
    const kg = c.createLinearGradient(x - cw / 2, keepTop, x + cw / 2, keepBot);
    kg.addColorStop(0, stoneHi);
    kg.addColorStop(0.5, stoneMid);
    kg.addColorStop(1, stoneLo);
    c.fillStyle = kg;
    c.fillRect(x - cw / 2, keepTop, cw, keepBot - keepTop);
    // 누각 몸체의 기둥 그림자
    c.fillStyle = 'rgba(20, 16, 10, 0.3)';
    c.fillRect(x + cw * 0.28, keepTop, cw * 0.06, keepBot - keepTop);
    // 불 켜진 창
    c.fillStyle = 'rgba(255, 198, 112, 0.92)';
    for (const dx of [-0.26, 0, 0.26]) {
      c.fillRect(x + cw * dx - Math.max(0.5, cw * 0.05), keepTop + (keepBot - keepTop) * 0.42, Math.max(1, cw * 0.1), Math.max(1, cw * 0.11));
    }
    // 지붕 — 2층
    eaveRoof(c, x, keepTop + u * 0.02, cw * 0.82, u * (major ? 0.5 : 0.42), roofHi, roofMid, roofLo);
    if (major) eaveRoof(c, x, keepTop - u * 0.3, cw * 0.52, u * 0.3, roofHi, roofMid, roofLo);

    /* --- 성벽 앞면 --- */
    const wg = c.createLinearGradient(x - wHalf, wallTop, x + wHalf, wallBot);
    wg.addColorStop(0, stoneHi);
    wg.addColorStop(0.45, stoneMid);
    wg.addColorStop(1, stoneLo);
    c.fillStyle = wg;
    c.fillRect(x - wHalf, wallTop, wHalf * 2, wallH);
    // 오른쪽 그늘면 · 왼쪽 빛
    const shading = c.createLinearGradient(x - wHalf, 0, x + wHalf, 0);
    shading.addColorStop(0, 'rgba(255, 240, 200, 0.16)');
    shading.addColorStop(0.42, 'rgba(0, 0, 0, 0)');
    shading.addColorStop(1, 'rgba(10, 8, 4, 0.34)');
    c.fillStyle = shading;
    c.fillRect(x - wHalf, wallTop, wHalf * 2, wallH);

    // 벽돌 결 — 세 줄 가로 + 어긋난 세로
    c.strokeStyle = 'rgba(26, 21, 13, 0.3)';
    c.lineWidth = Math.max(0.3, u * 0.022);
    for (let r = 1; r <= 3; r++) {
      const ly = wallTop + (wallH / 4) * r;
      c.beginPath();
      c.moveTo(x - wHalf, ly);
      c.lineTo(x + wHalf, ly);
      c.stroke();
    }
    for (let r = 0; r < 3; r++) {
      const ly = wallTop + (wallH / 4) * r;
      for (let k = 0; k < 5; k++) {
        const jx = x - wHalf + ((k + (r % 2 ? 0.5 : 0)) / 5) * wHalf * 2;
        c.beginPath();
        c.moveTo(jx, ly);
        c.lineTo(jx, ly + wallH / 4);
        c.stroke();
      }
    }

    // 성벽 윗면(2.5D 두께)
    c.beginPath();
    c.moveTo(x - wHalf, wallTop);
    c.lineTo(x - wHalf + thick * 0.5, wallTop - thick);
    c.lineTo(x + wHalf - thick * 0.5, wallTop - thick);
    c.lineTo(x + wHalf, wallTop);
    c.closePath();
    c.fillStyle = mix(stoneHi, '#fff', 0.12);
    c.fill();

    // 성가퀴
    const merlonN = 7;
    for (let i = 0; i < merlonN; i++) {
      if (i % 2) continue;
      const mw = (wHalf * 2) / merlonN;
      const mx = x - wHalf + i * mw + mw * 0.16;
      c.fillStyle = mix(stoneMid, '#ffe0a8', 0.1);
      c.fillRect(mx, wallTop - thick - u * 0.12, mw * 0.68, u * 0.12);
      c.fillStyle = 'rgba(255, 232, 180, 0.16)';
      c.fillRect(mx, wallTop - thick - u * 0.12, mw * 0.68, Math.max(0.4, u * 0.02));
    }

    // 성문 — 홍예
    const gw = u * (major ? 0.5 : 0.44), gh = u * 0.4;
    c.beginPath();
    c.moveTo(x - gw / 2, wallBot);
    c.lineTo(x - gw / 2, wallBot - gh * 0.45);
    c.quadraticCurveTo(x, wallBot - gh * 1.2, x + gw / 2, wallBot - gh * 0.45);
    c.lineTo(x + gw / 2, wallBot);
    c.closePath();
    const gg = c.createLinearGradient(0, wallBot - gh, 0, wallBot);
    gg.addColorStop(0, 'rgba(58, 36, 16, 0.96)');
    gg.addColorStop(1, 'rgba(10, 8, 4, 0.98)');
    c.fillStyle = gg;
    c.fill();
    c.strokeStyle = 'rgba(255, 206, 140, 0.8)';
    c.lineWidth = Math.max(0.35, u * 0.03);
    c.stroke();
    // 문 안쪽 불빛
    c.save();
    c.globalCompositeOperation = 'lighter';
    const gl = c.createRadialGradient(x, wallBot - gh * 0.35, 0, x, wallBot - gh * 0.35, gw * 1.1);
    gl.addColorStop(0, 'rgba(255, 160, 70, 0.3)');
    gl.addColorStop(1, 'rgba(255, 140, 50, 0)');
    c.fillStyle = gl;
    c.beginPath(); c.arc(x, wallBot - gh * 0.35, gw * 1.1, 0, Math.PI * 2); c.fill();
    c.restore();

    /* --- 좌우 망루 --- */
    for (const side of [-1, 1]) {
      const tw = u * 0.5;
      const tx = x + side * (wHalf - tw * 0.55);
      const tTop = wallTop - u * 0.34;
      const tBot = wallBot + u * 0.02;
      const tg = c.createLinearGradient(tx - tw / 2, tTop, tx + tw / 2, tBot);
      tg.addColorStop(0, stoneHi);
      tg.addColorStop(0.5, stoneMid);
      tg.addColorStop(1, stoneLo);
      c.fillStyle = tg;
      c.fillRect(tx - tw / 2, tTop, tw, tBot - tTop);
      c.fillStyle = 'rgba(255, 232, 180, 0.14)';
      c.fillRect(tx - tw / 2, tTop, tw * 0.24, tBot - tTop);
      // 망루 창
      c.fillStyle = 'rgba(255, 198, 112, 0.9)';
      c.fillRect(tx - tw * 0.09, tTop + u * 0.16, Math.max(0.9, tw * 0.18), Math.max(0.9, tw * 0.2));
      // 망루 지붕
      eaveRoof(c, tx, tTop + u * 0.03, tw * 0.82, u * 0.34, roofHi, roofMid, roofLo);
      // 작은 깃발
      c.strokeStyle = 'rgba(28, 20, 12, 0.85)';
      c.lineWidth = Math.max(0.6, u * 0.045);
      c.beginPath();
      c.moveTo(tx, tTop - u * 0.3);
      c.lineTo(tx, tTop - u * 0.68);
      c.stroke();
      const pw = u * 0.3, ph = u * 0.2;
      c.beginPath();
      c.moveTo(tx, tTop - u * 0.68);
      c.lineTo(tx + side * pw, tTop - u * 0.62);
      c.lineTo(tx, tTop - u * 0.53);
      c.closePath();
      c.fillStyle = mix(color, '#ffe0b0', 0.24);
      c.fill();
    }

    /* --- 깃대와 큰 세력 깃발 --- */
    const poleX = x + cw * 0.52;
    const poleTop = keepTop - u * (major ? 1.24 : 1.02);
    c.strokeStyle = 'rgba(26, 18, 10, 0.9)';
    c.lineWidth = Math.max(0.9, u * 0.06);
    c.beginPath(); c.moveTo(poleX, keepTop - u * 0.1); c.lineTo(poleX, poleTop); c.stroke();
    c.strokeStyle = 'rgba(255, 214, 150, 0.85)';
    c.lineWidth = Math.max(0.35, u * 0.024);
    c.beginPath(); c.moveTo(poleX, keepTop - u * 0.1); c.lineTo(poleX, poleTop); c.stroke();

    const fw = u * 0.95, fh = u * 0.56;
    const wave = Math.sin((t || 0) / 400 + x * 0.05) * 0.26;
    c.beginPath();
    c.moveTo(poleX, poleTop);
    c.bezierCurveTo(poleX + fw * 0.36, poleTop + fh * (0.06 + wave), poleX + fw * 0.7, poleTop + fh * (0.2 - wave), poleX + fw, poleTop + fh * 0.32);
    c.lineTo(poleX + fw * 0.82, poleTop + fh * 0.62);
    c.bezierCurveTo(poleX + fw * 0.58, poleTop + fh * (0.54 - wave), poleX + fw * 0.32, poleTop + fh * (0.44 + wave), poleX, poleTop + fh * 0.7);
    c.closePath();
    const fg = c.createLinearGradient(poleX, poleTop, poleX + fw, poleTop + fh);
    fg.addColorStop(0, mix(color, '#ffe8b8', 0.3));
    fg.addColorStop(1, mix(color, '#1d1208', 0.28));
    c.fillStyle = fg;
    c.fill();
    c.strokeStyle = 'rgba(22, 14, 6, 0.6)';
    c.lineWidth = Math.max(0.28, u * 0.02);
    c.stroke();

    // 소유 세력 — 벽 아래 은은한 띠
    if (owner) {
      c.fillStyle = rgba(color, 0.5);
      c.fillRect(x - wHalf * 0.92, wallBot - u * 0.03, wHalf * 1.84, Math.max(1, u * 0.06));
      c.fillStyle = 'rgba(255, 226, 176, 0.25)';
      c.fillRect(x - wHalf * 0.92, wallBot - u * 0.03, wHalf * 1.84, Math.max(0.4, u * 0.015));
    }
  }
  function drawRegionLabels(c) {
    if (cam.zoom > 1.12) return;
    const groups = {};
    for (const city of CITIES) {
      (groups[city.region] = groups[city.region] || []).push(city);
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const [region, list] of Object.entries(groups)) {
      const cx = list.reduce((n, city) => n + city.x, 0) / list.length;
      const cy = list.reduce((n, city) => n + city.y, 0) / list.length;
      const p = toScreen(cx, cy);
      const fs = Math.max(10, Math.min(15, 9 + cam.zoom * 5));
      c.font = `600 ${fs}px "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
      c.fillStyle = 'rgba(255, 220, 160, 0.13)';
      c.fillText(region, p.x, p.y);
      const tw = c.measureText(region).width;
      c.strokeStyle = 'rgba(255, 210, 150, 0.12)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(p.x - tw / 2, p.y + fs * 0.72);
      c.lineTo(p.x + tw / 2, p.y + fs * 0.72);
      c.stroke();
    }
  }

  function drawCities(c, t) {
    const sc = scale();
    const own = state ? state.playerId : null;
    const items = [];
    for (const city of CITIES) {
      const p = toScreen(city.x, city.y);
      if (p.x < -80 || p.y < -80 || p.x > cssW + 80 || p.y > cssH + 80) continue;
      const st = state ? state.cities[city.id] : null;
      const isOwn = !!(st && own && st.owner === own);
      items.push({
        c: city, city: st, isOwn, p,
        sz: Math.max(19, Math.min(34, sc * 3.05)) * (city.major ? 1.08 : 1),
        pri: (selected === city.id ? 4 : 0) + (isOwn ? 2 : 0) + (city.major ? 1 : 0),
      });
    }
    const iconRects = [];
    for (const it of items.slice().sort((a, b) => a.pri - b.pri)) {
      const owner = it.city ? it.city.owner : null;
      const color = owner ? (state.factions[owner] ? state.factions[owner].color : '#888') : '#8d7a5c';
      const isSel = selected === it.c.id;

      // 세력 영토 톤 — 성 아래 옅은 빛
      if (owner) {
        const rg = c.createRadialGradient(it.p.x, it.p.y + it.sz * 0.2, 0, it.p.x, it.p.y + it.sz * 0.2, it.sz * 1.6);
        rg.addColorStop(0, rgba(color, 0.26));
        rg.addColorStop(0.55, rgba(color, 0.1));
        rg.addColorStop(1, rgba(color, 0));
        c.fillStyle = rg;
        c.beginPath();
        c.ellipse(it.p.x, it.p.y + it.sz * 0.2, it.sz * 1.6, it.sz * 1.15, 0, 0, Math.PI * 2);
        c.fill();
      }
      if (isSel) {
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t / 520));
        const r = it.sz * 0.95;
        c.save();
        c.strokeStyle = `rgba(255, 226, 166, ${0.4 + 0.45 * pulse})`;
        c.lineWidth = 1.2;
        c.shadowColor = 'rgba(255, 190, 110, 0.7)';
        c.shadowBlur = 10 + 6 * pulse;
        c.beginPath();
        c.moveTo(it.p.x - r, it.p.y - r * 0.9);
        c.lineTo(it.p.x + r, it.p.y - r * 0.9);
        c.lineTo(it.p.x + r, it.p.y + r * 0.9);
        c.lineTo(it.p.x - r, it.p.y + r * 0.9);
        c.closePath();
        c.stroke();
        c.fillStyle = `rgba(255, 214, 150, ${0.05 + 0.05 * pulse})`;
        c.fill();
        c.restore();
      }
      castleArt(c, it.p, it.sz, color, owner, it.c.major, t);
      iconRects.push({ id: it.c.id, r: [it.p.x - it.sz * 0.62, it.p.y - it.sz * 0.62, it.sz * 1.24, it.sz * 1.24] });
    }

    // 이름표 — 금빛 테를 두른 어두운 나무 패
    const fs = Math.max(9.5, Math.min(14.5, 8.5 + cam.zoom * 2 + Math.max(0, sc - 8) * 0.5));
    c.font = `600 ${fs}px "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const placed = [];
    const overlap = (r, q, pad = 1) => !(r[0] > q[0] + q[2] + pad || r[0] + r[2] + pad < q[0] || r[1] > q[1] + q[3] + pad || r[1] + r[3] + pad < q[1]);
    for (const it of items.slice().sort((a, b) => b.pri - a.pri)) {
      if (it.p.x < 6 || it.p.x > cssW - 6 || it.p.y < TOP_INSET || it.p.y > cssH - 4) continue;
      const isSel = selected === it.c.id;
      const label = it.c.ko;
      const tw = Math.round(c.measureText(label).width) + 10;
      const th = Math.round(fs + 5);
      const half = it.sz * 0.7;
      const cands = [
        [it.p.x - tw / 2, it.p.y + half],
        [it.p.x - tw / 2, it.p.y - half - th],
        [it.p.x + half + 2, it.p.y - th / 2],
        [it.p.x - half - 2 - tw, it.p.y - th / 2],
      ];
      let rect = null;
      for (const [lx, ly] of cands) {
        const r = [lx, ly, tw, th];
        const clash = placed.some((q) => overlap(r, q))
          || iconRects.some((ic) => ic.id !== it.c.id && overlap(r, ic.r, 0));
        if (!clash) { rect = r; break; }
      }
      if (!rect) {
        if (!isSel) continue;
        rect = [cands[0][0], cands[0][1], tw, th];
      }
      rect[0] = Math.max(2, Math.min(cssW - tw - 2, rect[0]));
      placed.push(rect);
      const bx = Math.round(rect[0]), by = Math.round(rect[1]);
      // 패 배경 — 위는 따뜻한 나무, 아래로 어둡게
      const pg = c.createLinearGradient(bx, by, bx, by + th);
      if (isSel) {
        pg.addColorStop(0, 'rgba(92, 64, 28, 0.98)');
        pg.addColorStop(1, 'rgba(48, 31, 12, 0.98)');
      } else {
        pg.addColorStop(0, 'rgba(38, 28, 18, 0.94)');
        pg.addColorStop(1, 'rgba(18, 13, 8, 0.94)');
      }
      c.fillStyle = pg;
      c.fillRect(bx, by, tw, th);
      // 금빛 테
      c.strokeStyle = isSel ? 'rgba(255, 232, 180, 0.96)' : (it.isOwn ? 'rgba(240, 194, 128, 0.75)' : 'rgba(180, 150, 110, 0.45)');
      c.lineWidth = 1;
      c.strokeRect(bx + 0.5, by + 0.5, tw - 1, th - 1);
      // 윗면 하이라이트
      c.fillStyle = 'rgba(255, 226, 170, 0.14)';
      c.fillRect(bx + 1, by + 1, tw - 2, 1);
      c.fillStyle = isSel ? '#fff3d0' : it.isOwn ? '#f6e6c4' : '#ddd2bc';
      c.fillText(label, bx + tw / 2, by + th / 2 + 0.5);
    }
  }

  /* ---------- 레이어 캐시 ---------- */
  function buildBackground() {
    if (!cssW || !cssH) return;
    const key = `${cssW.toFixed(1)}|${cssH.toFixed(1)}|${dpr}|${cam.x.toFixed(3)}|${cam.y.toFixed(3)}|${cam.zoom.toFixed(3)}|${stateVer}|${selected || ''}`;
    if (key === bgKey && bg) return;
    if (!bg) {
      bg = document.createElement('canvas');
      bgCtx = bg.getContext('2d');
    }
    bg.width = Math.round(cssW * dpr);
    bg.height = Math.round(cssH * dpr);
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.clearRect(0, 0, cssW, cssH);
    bgCtx.imageSmoothingEnabled = true;
    drawSea(bgCtx);
    drawLand(bgCtx);
    drawTerrainTexture(bgCtx);
    drawTerritory(bgCtx);
    const segs = drawRoads(bgCtx);
    drawRivers(bgCtx, 0, false);
    drawBridges(bgCtx, segs);
    drawMountains(bgCtx);
    drawTrees(bgCtx);
    drawAtmosphere(bgCtx);
    bgKey = key;
  }

  function render() {
    if (!cssW || !cssH) return;
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    buildBackground();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bg) ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 살아 있는 물결 — 캐시 위에 흐름만 얹는다
    drawRivers(ctx, t, true);
    drawCities(ctx, t);
    drawRegionLabels(ctx);
  }

  /* 지도가 화면에 보일 때만 물결·깃발을 조금씩 움직인다 */
  let animTimer = null;
  function startAnim() {
    if (animTimer) return;
    animTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!cssW || !cssH) return;
      if (canvas.getBoundingClientRect().width < 2) return;
      requestRender();
    }, 120);
  }
  startAnim();

  function hitTest(sx, sy) {
    const s = scale();
    let best = null, bestD = Infinity;
    for (const city of CITIES) {
      const p = toScreen(city.x, city.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < Math.max(18, s * 3) && d < bestD) { best = city.id; bestD = d; }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragging = true; moved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      lastPinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch > 0) {
        const rect = canvas.getBoundingClientRect();
        const midX = (a.x + b.x) / 2 - rect.left, midY = (a.y + b.y) / 2 - rect.top;
        const before = toWorld(midX, midY);
        cam.zoom = Math.max(1, Math.min(3.6, cam.zoom * (d / lastPinch)));
        const after = toWorld(midX, midY);
        cam.x += before.x - after.x;
        cam.y += before.y - after.y;
        clampCam();
        requestRender();
      }
      lastPinch = d;
      moved = true;
      return;
    }
    if (dragging) {
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      cam.x -= dx / scale();
      cam.y -= dy / scaleY();
      clampCam();
      requestRender();
    }
  });

  const endPointer = (e) => {
    const wasSingle = pointers.size === 1;
    if (wasSingle && dragging && !moved) {
      const rect = canvas.getBoundingClientRect();
      const id = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (id && onSelectCity) onSelectCity(id);
      else if (!id && onTapEmpty) onTapEmpty();
    }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
    if (pointers.size === 0) dragging = false;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const before = toWorld(px, py);
    cam.zoom = Math.max(1, Math.min(3.6, cam.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
    const after = toWorld(px, py);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
    clampCam();
    requestRender();
  }, { passive: false });

  return {
    setState(s) { state = s; stateVer++; requestRender(); },
    setSelected(id) { selected = id; requestRender(); },
    focusCity(id) {
      const city = CITY_BY_ID[id];
      if (!city) return;
      cam.x = city.x; cam.y = city.y;
      cam.zoom = Math.max(1.9, cam.zoom);
      clampCam();
      requestRender();
    },
    focusRegion(region) {
      const list = CITIES.filter((c) => c.region === region);
      if (!list.length) return;
      const mx = list.reduce((s, c) => s + c.x, 0) / list.length;
      const my = list.reduce((s, c) => s + c.y, 0) / list.length;
      cam.x = mx; cam.y = my;
      cam.zoom = 1.9;
      clampCam();
      requestRender();
    },
    zoomBy(f) { cam.zoom = Math.max(1, Math.min(3.6, cam.zoom * f)); clampCam(); requestRender(); },
    resetView() { cam = { x: 57, y: 35, zoom: 1 }; clampCam(); requestRender(); },
    resize,
    render: requestRender,
    getZoom: () => cam.zoom,
  };
}
