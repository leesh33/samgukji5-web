/* 중국 전도 — 미니멀 거점 노선도풍 지도
   어두운 네이비 바다 + 은은한 도트 그리드 · 깔끔한 대륙 윤곽 · 심플한 강줄기
   또렷한 도로선 · 세력 색 원형 거점 노드. 드래그·핀치 줌·탭 선택은 그대로. */
import { CITIES, CITY_BY_ID, FACTION_COLORS } from './data.js';

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

/* 바다에 흩어진 작은 섬 — 대륙 윤곽만으로는 비어 보이는 물빛을 채운다 */
const ISLANDS = [
  { x: 23.4, y: 42.5, rx: 1.35, ry: 0.8, rot: 0.3 },
  { x: 26.6, y: 55.5, rx: 1.1, ry: 0.7, rot: -0.22 },
  { x: 28.2, y: 58.6, rx: 0.7, ry: 0.45, rot: 0.1 },
  { x: 89.8, y: 24.8, rx: 1.5, ry: 0.85, rot: 0.15 },
  { x: 88.4, y: 49.6, rx: 1.2, ry: 0.7, rot: -0.3 },
  { x: 84.6, y: 57.0, rx: 0.9, ry: 0.55, rot: 0.2 },
  { x: 72.2, y: 64.4, rx: 1.0, ry: 0.6, rot: -0.15 },
  { x: 59.0, y: 68.2, rx: 1.15, ry: 0.62, rot: 0.08 },
  { x: 40.4, y: 51.6, rx: 0.75, ry: 0.5, rot: 0.4 },
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

/* ---------- 팔레트 ---------- */
const P = {
  seaTop: '#112539', seaMid: '#0a1826', seaBot: '#060e18',
  landHi: '#e3d4b4', landMid: '#d6c39d', landLo: '#c3ad87',
  coast: '#7c6a4c', coastLit: '#fff6e2',
  grain: '#6a5636',
  river: '#4d8dab', riverLit: '#a8d2e2',
  road: 'rgba(255,252,245,0.72)', roadSoft: 'rgba(92,72,46,0.16)',
  gold: '#ffd79a',
};

/* 둥근 사각형 */
function roundRect(c, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}

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
  let labelBoxes = []; // 마지막 이름표 자리 — 탭 판정에는 쓰지 않고 디버깅·검증용

  /* 정적인 지형 레이어 캐시 — 카메라·크기·영토가 바뀔 때만 다시 그린다 */
  let bg = null;
  let bgKey = '';

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

  /* 육지 윤곽 — 꼭짓점을 지나는 부드러운 곡선으로 이어 해안선을 유기적으로 */
  function landPath(c = ctx) {
    const n = LAND.length;
    const pts = LAND.map(([x, y]) => toScreen(x, y));
    c.beginPath();
    c.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      c.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
    }
    c.closePath();
  }

  /* ---------- 바다 ---------- */
  function drawSea(c) {
    const g = c.createLinearGradient(0, 0, cssW * 0.35, cssH);
    g.addColorStop(0, P.seaTop);
    g.addColorStop(0.5, P.seaMid);
    g.addColorStop(1, P.seaBot);
    c.fillStyle = g;
    c.fillRect(0, 0, cssW, cssH);

    // 도트 그리드 — 화면에 고르게 박힌 작은 점
    const step = 22;
    c.fillStyle = 'rgba(150,192,220,0.10)';
    for (let y = step * 0.5; y < cssH; y += step) {
      for (let x = step * 0.5; x < cssW; x += step) {
        c.beginPath();
        c.arc(x, y, 0.85, 0, Math.PI * 2);
        c.fill();
      }
    }
    // 가장자리만 살짝 어둡게 — 가운데 대륙이 떠 보이도록
    const v = c.createRadialGradient(cssW / 2, cssH * 0.45, Math.min(cssW, cssH) * 0.2, cssW / 2, cssH * 0.45, Math.max(cssW, cssH) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,4,10,0.5)');
    c.fillStyle = v;
    c.fillRect(0, 0, cssW, cssH);
  }

  /* ---------- 작은 섬 ---------- */
  function drawIslands(c) {
    const s = scale();
    for (const is of ISLANDS) {
      const p = toScreen(is.x, is.y);
      const rx = Math.max(1.4, is.rx * s * 0.78), ry = Math.max(1.0, is.ry * scaleY() * 0.78);
      if (p.x < -30 || p.y < -30 || p.x > cssW + 30 || p.y > cssH + 30) continue;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(is.rot || 0);
      c.beginPath();
      c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      c.shadowColor = 'rgba(110,180,205,0.28)';
      c.shadowBlur = 5;
      c.fillStyle = mix(P.landMid, P.landLo, 0.45);
      c.fill();
      c.restore();
    }
  }

  /* ---------- 육지 ---------- */
  function drawLand(c) {
    // 바다 위로 떠 보이게 — 물빛 후광
    c.save();
    landPath(c);
    c.shadowColor = 'rgba(120,190,215,0.38)';
    c.shadowBlur = Math.max(10, scale() * 3);
    c.fillStyle = P.landMid;
    c.fill();
    c.restore();

    landPath(c);
    const gy0 = toScreen(0, 0).y, gy1 = toScreen(0, 70).y;
    if (!Number.isFinite(gy0) || !Number.isFinite(gy1)) return;
    const g = c.createLinearGradient(0, gy0, 0, gy1);
    g.addColorStop(0, P.landHi);
    g.addColorStop(0.42, P.landMid);
    g.addColorStop(1, P.landLo);
    c.fillStyle = g;
    c.fill();

    // 종이 결 — 은은한 알갱이
    c.save();
    landPath(c);
    c.clip();
    for (let i = 0; i < 520; i++) {
      const wx = 24 + rnd(i, 11) * 66, wy = 3 + rnd(i, 12) * 64;
      const p = toScreen(wx, wy);
      if (p.x < 0 || p.y < 0 || p.x > cssW || p.y > cssH) continue;
      const big = rnd(i, 13) > 0.9;
      c.fillStyle = big ? 'rgba(255,250,236,0.16)' : 'rgba(110,90,60,0.07)';
      c.fillRect(p.x, p.y, big ? 2 : 1, big ? 2 : 1);
    }
    // 해안 안쪽 밝은 테 — 윤곽을 또렷하게
    landPath(c);
    c.strokeStyle = 'rgba(255,250,236,0.26)';
    c.lineWidth = Math.max(3, scale() * 1.1);
    c.stroke();
    c.restore();

    // 해안선
    landPath(c);
    c.strokeStyle = 'rgba(84,68,46,0.5)';
    c.lineWidth = 1.2;
    c.stroke();
  }

  /* ---------- 강 ---------- */
  function smoothPath(c, pts) {
    c.beginPath();
    const P0 = pts.map(([x, y]) => toScreen(x, y));
    c.moveTo(P0[0].x, P0[0].y);
    for (let i = 1; i < P0.length - 1; i++) {
      const mx = (P0[i].x + P0[i + 1].x) / 2, my = (P0[i].y + P0[i + 1].y) / 2;
      c.quadraticCurveTo(P0[i].x, P0[i].y, mx, my);
    }
    const last = P0[P0.length - 1];
    c.lineTo(last.x, last.y);
  }

  function drawRivers(c) {
    const s = scale();
    const w = Math.max(1.2, Math.min(2.6, s * 0.26));
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const river of RIVERS) {
      smoothPath(c, river);
      c.strokeStyle = 'rgba(104,150,166,0.35)';
      c.lineWidth = w * 2.2;
      c.stroke();
      smoothPath(c, river);
      c.strokeStyle = P.river;
      c.lineWidth = w;
      c.stroke();
      smoothPath(c, river);
      c.strokeStyle = 'rgba(186,222,236,0.32)';
      c.lineWidth = Math.max(0.5, w * 0.34);
      c.stroke();
    }
  }

  /* ---------- 도로 ---------- */
  function roadSegments() {
    const seen = new Set();
    const segs = [];
    for (const city of CITIES) {
      for (const nb of city.roads) {
        const key = [city.id, nb].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const other = CITY_BY_ID[nb];
        if (!other) continue;
        segs.push([city, other, toScreen(city.x, city.y), toScreen(other.x, other.y)]);
      }
    }
    return segs;
  }

  function drawRoads(c, segs) {
    c.lineCap = 'round';
    for (const [, , a, b] of segs) {
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      c.strokeStyle = P.roadSoft;
      c.lineWidth = 3.2;
      c.stroke();
    }
    for (const [, , a, b] of segs) {
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      c.strokeStyle = P.road;
      c.lineWidth = 1.25;
      c.stroke();
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
      c.fillStyle = rgba(color, 0.09);
      c.fill();
      c.save();
      c.setLineDash([5, 5]);
      c.strokeStyle = rgba(color, 0.34);
      c.lineWidth = 1;
      c.stroke();
      c.restore();
    }
  }

  /* ---------- 거점 노드 ---------- */
  function nodeRadius(sz) {
    return Math.max(6.4, Math.min(12.5, sz));
  }

  function drawCityNodes(c, t) {
    const sc = scale();
    const own = state ? state.playerId : null;
    const items = [];
    for (const city of CITIES) {
      const p = toScreen(city.x, city.y);
      if (p.x < -40 || p.y < -40 || p.x > cssW + 40 || p.y > cssH + 40) continue;
      const st = state ? state.cities[city.id] : null;
      const isOwn = !!(st && own && st.owner === own);
      const ownerId = st ? st.owner : null;
      const fac = ownerId && state.factions[ownerId];
      const color = ownerId ? ((fac && fac.color) || FACTION_COLORS[ownerId] || '#8a8474') : '#8d7a5c';
      items.push({
        c: city, p, isOwn, owner: ownerId, color,
        r: nodeRadius(sc * (city.major ? 1.22 : 1.0) * (selected === city.id ? 1.1 : 1)),
        pri: (selected === city.id ? 4 : 0) + (isOwn ? 2 : 0) + (city.major ? 1 : 0),
      });
    }

    for (const it of items.slice().sort((a, b) => a.pri - b.pri)) {
      const { p, r, color, owner } = it;
      const isSel = selected === it.c.id;

      // 은은한 글로우 링
      const glow = c.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r * 2.5);
      glow.addColorStop(0, rgba(color, owner ? 0.3 : 0.16));
      glow.addColorStop(0.55, rgba(color, owner ? 0.1 : 0.05));
      glow.addColorStop(1, rgba(color, 0));
      c.fillStyle = glow;
      c.beginPath();
      c.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
      c.fill();

      // 선택 성 — 숨쉬는 금빛 링
      if (isSel) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 520);
        c.save();
        c.strokeStyle = `rgba(255,222,160,${0.5 + 0.4 * pulse})`;
        c.lineWidth = 1.6;
        c.shadowColor = 'rgba(255,190,110,0.8)';
        c.shadowBlur = 10 + 8 * pulse;
        c.beginPath();
        c.arc(p.x, p.y, r + 4 + pulse * 2.4, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }

      // 노드 본체
      const body = c.createRadialGradient(p.x - r * 0.34, p.y - r * 0.4, r * 0.1, p.x, p.y, r * 1.05);
      body.addColorStop(0, mix(color, '#ffffff', 0.42));
      body.addColorStop(0.52, color);
      body.addColorStop(1, mix(color, '#12100c', 0.34));
      c.beginPath();
      c.arc(p.x, p.y, r, 0, Math.PI * 2);
      c.fillStyle = body;
      c.fill();

      // 테두리 — 밝은 링 + 바깥 어두운 선
      c.strokeStyle = 'rgba(18,16,12,0.42)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(p.x, p.y, r + 0.4, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = isSel ? 'rgba(255,238,200,0.95)' : 'rgba(255,250,238,0.75)';
      c.lineWidth = Math.max(1, r * 0.14);
      c.beginPath();
      c.arc(p.x, p.y, r - 0.6, 0, Math.PI * 2);
      c.stroke();

      // 안쪽 심볼 — 작은 점, 큰 성은 한 겹 더
      c.fillStyle = 'rgba(255,252,244,0.92)';
      c.beginPath();
      c.arc(p.x, p.y, Math.max(1.3, r * 0.26), 0, Math.PI * 2);
      c.fill();
      if (it.c.major || isSel) {
        c.strokeStyle = 'rgba(255,252,244,0.55)';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(p.x, p.y, r * 0.66, 0, Math.PI * 2);
        c.stroke();
      }
      it.iconR = r;
    }
    return items;
  }

  /* ---------- 이름표 ---------- */
  function rectCircleHit(rect, cx, cy, r) {
    const nx = Math.max(rect[0], Math.min(cx, rect[0] + rect[2]));
    const ny = Math.max(rect[1], Math.min(cy, rect[1] + rect[3]));
    return (nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) < r * r;
  }
  function rectOverlap(r, q, pad = 1.5) {
    return !(r[0] > q[0] + q[2] + pad || r[0] + r[2] + pad < q[0] || r[1] > q[1] + q[3] + pad || r[1] + r[3] + pad < q[1]);
  }

  function drawLabels(c, items) {
    const sc = scale();
    const fs = Math.max(9, Math.min(12.5, 8.6 + cam.zoom * 1.3 + Math.max(0, sc - 6) * 0.16));
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const placed = [];
    const nodes = items.map((it) => ({ id: it.c.id, x: it.p.x, y: it.p.y, r: it.iconR || 7 }));
    // 지도 위 버튼(권역·확대·턴 종료)이 덮는 자리는 비워 둔다
    const obstacles = [
      [4, 2, 178, 34],
      [cssW - 52, cssH * 0.66, 48, cssH * 0.34],
      [6, cssH - 74, 132, 70],
    ];
    const dirs = [
      ['S', 0, 1], ['N', 0, -1], ['E', 1, 0], ['W', -1, 0],
      ['SE', 0.72, 0.9], ['SW', -0.72, 0.9], ['NE', 0.72, -0.9], ['NW', -0.72, -0.9],
    ];

    for (const it of items.slice().sort((a, b) => b.pri - a.pri)) {
      const isSel = selected === it.c.id;
      c.font = `${isSel ? 700 : 600} ${fs}px "Gmarket Sans", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
      const label = it.c.ko;
      const tw = Math.round(c.measureText(label).width) + 10;
      const th = Math.round(fs + 4);
      const r = it.iconR || 7;
      const rings = [r + 3, r + 12, r + 22, r + 34];
      let best = null, bestDist = 0;
      for (const gap of rings) {
        for (const [, dx, dy] of dirs) {
          let lx, ly;
          if (dy !== 0 && dx !== 0) {
            lx = it.p.x + dx * gap - tw / 2;
            ly = it.p.y + dy * gap - th / 2;
          } else if (dy !== 0) {
            lx = it.p.x - tw / 2;
            ly = dy > 0 ? it.p.y + gap : it.p.y - gap - th;
          } else {
            lx = dx > 0 ? it.p.x + gap : it.p.x - gap - tw;
            ly = it.p.y - th / 2;
          }
          const rect = [lx, ly, tw, th];
          // 화면 밖으로 넘치지 않게
          if (rect[0] < 3 || rect[0] + tw > cssW - 3 || rect[1] < TOP_INSET - 4 || rect[1] + th > cssH - 3) continue;
          const clash = placed.some((q) => rectOverlap(rect, q))
            || obstacles.some((q) => rectOverlap(rect, q, 0))
            || nodes.some((n) => n.id !== it.c.id && rectCircleHit(rect, n.x, n.y, n.r + 1.5));
          if (!clash) { best = rect; bestDist = gap; break; }
        }
        if (best) break;
      }
      if (!best) {
        // 빽빽한 중원 — 노드 둘레를 조금씩 밀어 보며 빈자리를 찾는다
        const baseX = Math.max(3, Math.min(cssW - tw - 3, it.p.x - tw / 2));
        const baseY = Math.max(TOP_INSET, Math.min(cssH - th - 3, it.p.y + r + 4));
        const dirs8 = [[0, 1], [0, -1], [1, 0], [-1, 0], [0.72, 0.72], [-0.72, 0.72], [0.72, -0.72], [-0.72, -0.72]];
        for (const d of [5, 10, 16, 22, 30, 40, 52, 66, 82, 100]) {
          for (const [dx, dy] of dirs8) {
            const rect = [baseX + dx * d, baseY + dy * d, tw, th];
            if (rect[0] < 3 || rect[0] + tw > cssW - 3 || rect[1] < TOP_INSET - 4 || rect[1] + th > cssH - 3) continue;
            if (placed.some((q) => rectOverlap(rect, q))) continue;
            if (nodes.some((n) => n.id !== it.c.id && rectCircleHit(rect, n.x, n.y, n.r + 1.5))) continue;
            best = rect;
            bestDist = Math.hypot(rect[0] + tw / 2 - it.p.x, rect[1] + th / 2 - it.p.y);
            break;
          }
          if (best) break;
        }
        if (!best) {
          if (!isSel) continue;
          best = [baseX, baseY, tw, th];
          bestDist = r + 4;
        }
      }
      placed.push(best);
      labelBoxes.push({ id: it.c.id, rect: best });

      // 멀리 밀려난 이름표는 가는 지시선으로 노드와 잇는다
      if (bestDist > r + 14) {
        const cx = best[0] + tw / 2, cy = best[1] + th / 2;
        c.strokeStyle = 'rgba(20,18,14,0.22)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(it.p.x, it.p.y);
        c.lineTo(cx, cy);
        c.stroke();
      }

      const bx = Math.round(best[0]), by = Math.round(best[1]);
      // 어두운 이름판 — 지도 위에서 또렷하게
      const pg = c.createLinearGradient(0, by, 0, by + th);
      if (isSel) {
        pg.addColorStop(0, 'rgba(74,52,24,0.97)');
        pg.addColorStop(1, 'rgba(40,27,12,0.97)');
      } else {
        pg.addColorStop(0, 'rgba(22,28,36,0.9)');
        pg.addColorStop(1, 'rgba(12,16,22,0.9)');
      }
      c.fillStyle = pg;
      roundRect(c, bx, by, tw, th, 3);
      c.fill();
      c.strokeStyle = isSel ? 'rgba(255,232,180,0.95)'
        : it.owner ? rgba(it.color, 0.9)
        : 'rgba(255,250,238,0.28)';
      c.lineWidth = isSel ? 1.4 : 1;
      c.stroke();

      c.fillStyle = isSel ? '#fff3d0' : it.isOwn ? '#fff8ea' : '#e9e4d8';
      c.fillText(label, bx + tw / 2, by + th / 2 + 0.5);
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
      const fs = Math.max(9, Math.min(13, 8 + cam.zoom * 4));
      c.font = `600 ${fs}px "Gmarket Sans", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
      c.fillStyle = 'rgba(88,70,46,0.14)';
      c.fillText(region, p.x, p.y);
    }
  }

  /* ---------- 레이어 캐시 ---------- */
  function buildBackground() {
    if (!cssW || !cssH) return;
    const key = `${cssW.toFixed(1)}|${cssH.toFixed(1)}|${dpr}|${cam.x.toFixed(3)}|${cam.y.toFixed(3)}|${cam.zoom.toFixed(3)}|${stateVer}`;
    if (key === bgKey && bg) return;
    if (!bg) bg = document.createElement('canvas');
    const c = bg.getContext('2d');
    bg.width = Math.round(cssW * dpr);
    bg.height = Math.round(cssH * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cssW, cssH);
    c.imageSmoothingEnabled = true;
    drawSea(c);
    drawIslands(c);
    drawLand(c);
    drawTerritory(c);
    drawRoads(c, roadSegments());
    drawRivers(c);
    bgKey = key;
  }

  function render() {
    if (!cssW || !cssH) return;
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    buildBackground();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bg) ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    labelBoxes = [];
    const items = drawCityNodes(ctx, t);
    drawRegionLabels(ctx);
    drawLabels(ctx, items);
  }

  /* 지도가 화면에 보일 때만 선택 링을 조금씩 움직인다 */
  let animTimer = null;
  function startAnim() {
    if (animTimer) return;
    animTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!cssW || !cssH) return;
      if (selected == null) return; // 선택된 성이 없으면 정지 화면 그대로
      if (canvas.getBoundingClientRect().width < 2) return;
      requestRender();
    }, 140);
  }
  startAnim();

  function hitTest(sx, sy) {
    const s = scale();
    let best = null, bestD = Infinity;
    for (const city of CITIES) {
      const p = toScreen(city.x, city.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < Math.max(16, s * 2.6) && d < bestD) { best = city.id; bestD = d; }
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
    getLabels: () => labelBoxes.map((b) => ({ ...b })),
  };
}
