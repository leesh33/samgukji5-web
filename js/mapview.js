/* 중국 전도 — 하이엔드 보드 전략풍 지도 (다크 슬레이트·등고선·권역 경계·벡터 성곽)
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

/* 산맥 — 굵직한 능선 몇 줄 (지형 질감용 장식) */
const MOUNTAINS = [
  [33, 26], [36, 30], [39, 34], [42, 28], [46, 30], [49, 33], [35, 35], [38, 38],
  [43, 36], [47, 37], [52, 33], [55, 35], [34, 22], [40, 24], [45, 22], [50, 28],
  [58, 36], [60, 38], [30, 34], [37, 44], [42, 44],
  [55, 43], [63, 33], [66, 30], [43, 33], [31, 29], [48, 25], [53, 30], [70, 45],
  [75, 47], [79, 41], [62, 55], [57, 52], [45, 40],
];

function mix(a, b, t) {
  const pa = parseInt(String(a).replace('#', ''), 16), pb = parseInt(String(b).replace('#', ''), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar * (1 - t) + br * t), g = Math.round(ag * (1 - t) + bg * t), bl = Math.round(ab * (1 - t) + bb * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

function rgba(hex, a) {
  const h = String(hex || '#888888').replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(s, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
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

export function createMapView(canvas, { onSelectCity, onTapEmpty } = {}) {
  const ctx = canvas.getContext('2d');
  let state = null;
  let selected = null;
  let cam = { x: 57, y: 35, zoom: 1 };
  let dpr = Math.min(2.5, window.devicePixelRatio || 1);
  let cssW = 0, cssH = 0;
  let dragging = false;
  let moved = false;
  let pointers = new Map();
  let lastPinch = 0;
  let raf = null;

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

  function landPath() {
    ctx.beginPath();
    LAND.forEach(([x, y], i) => {
      const p = toScreen(x, y);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
  }

  function drawSea() {
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, '#0b0f13');
    g.addColorStop(0.55, '#090c10');
    g.addColorStop(1, '#070a0d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
    // 은은한 물결 결 — 보드 위 대리석 질감처럼
    ctx.strokeStyle = 'rgba(120, 140, 160, 0.055)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      const y0 = (i / 22) * cssH + 6;
      ctx.beginPath();
      for (let x = -10; x <= cssW + 10; x += 22) {
        const y = y0 + Math.sin((x * 0.012) + i * 1.7) * 4 + Math.sin(x * 0.03 + i) * 1.4;
        if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 모서리 비네트
    const v = ctx.createRadialGradient(cssW / 2, cssH * 0.45, Math.min(cssW, cssH) * 0.25, cssW / 2, cssH * 0.45, Math.max(cssW, cssH) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function drawLand() {
    landPath();
    const gy0 = toScreen(0, 0).y, gy1 = toScreen(0, 70).y;
    if (!Number.isFinite(gy0) || !Number.isFinite(gy1)) return;
    const g = ctx.createLinearGradient(0, gy0, 0, gy1);
    g.addColorStop(0, '#1b2026');
    g.addColorStop(0.45, '#181d23');
    g.addColorStop(1, '#13171c');
    ctx.fillStyle = g;
    ctx.fill();
    // 해안 — 금빛 실선 하나, 그 위로 옅은 빛
    ctx.strokeStyle = 'rgba(201, 164, 92, 0.30)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = 'rgba(201, 164, 92, 0.35)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(233, 211, 164, 0.20)';
    ctx.stroke();
    ctx.restore();
  }

  /* 육지 안쪽 질감 — 등고선 + 육각 격자 + 지형 톤 */
  function drawTerrainTexture() {
    ctx.save();
    landPath();
    ctx.clip();

    // 지형 톤(사막·분지·평야·강남)
    const patches = [
      { x: 34, y: 20, rx: 9, ry: 6, c: 'rgba(120, 98, 62, 0.16)' },
      { x: 44, y: 41, rx: 7, ry: 6, c: 'rgba(84, 112, 72, 0.14)' },
      { x: 66, y: 34, rx: 11, ry: 7, c: 'rgba(98, 118, 70, 0.12)' },
      { x: 78, y: 44, rx: 7, ry: 6, c: 'rgba(66, 104, 100, 0.14)' },
      { x: 56, y: 8, rx: 9, ry: 5, c: 'rgba(84, 100, 70, 0.10)' },
    ];
    const s = scale();
    for (const pt of patches) {
      const c = toScreen(pt.x, pt.y);
      const rg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(pt.rx, pt.ry) * s);
      rg.addColorStop(0, pt.c);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, pt.rx * s, pt.ry * scaleY(), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 등고선 — 완만하게 흔들리는 지형선
    ctx.lineWidth = 1;
    const lines = 15;
    for (let i = 0; i < lines; i++) {
      const wy = 3 + (i / lines) * 66;
      ctx.beginPath();
      let started = false;
      for (let wx = 24; wx <= 92; wx += 2) {
        const y = wy
          + Math.sin(wx * 0.31 + i * 1.6) * 1.35
          + Math.sin(wx * 0.13 + i * 0.7) * 1.9
          + Math.sin(wx * 0.61 + i * 0.4) * 0.55;
        const p = toScreen(wx, y);
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(201, 164, 92, 0.10)' : 'rgba(160, 170, 180, 0.055)';
      ctx.stroke();
    }

    // 육각 격자 — 보드판의 결
    const R = 4.7;
    const hx = R * 1.732, hy = R * 1.5;
    ctx.strokeStyle = 'rgba(190, 200, 210, 0.032)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let row = -2; row * hy + 2 < 70; row++) {
      for (let col = -2; col * hx + 22 < 94; col++) {
        const cx = 24 + col * hx + (row % 2 ? hx / 2 : 0);
        const cy = 2 + row * hy;
        const c0 = toScreen(cx, cy);
        for (let k = 0; k <= 6; k++) {
          const a = (Math.PI / 3) * k - Math.PI / 6;
          const px = c0.x + Math.cos(a) * R * s * 0.98;
          const py = c0.y + Math.sin(a) * R * s * 0.98 * (scaleY() / s);
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawMountains() {
    const s = scale();
    for (const [x, y] of MOUNTAINS) {
      const p = toScreen(x, y);
      const h = Math.max(5, s * 1.55);
      const w = h * 1.35;
      // 뒤쪽 봉우리
      ctx.beginPath();
      ctx.moveTo(p.x - w * 0.15, p.y - h * 0.72);
      ctx.lineTo(p.x + w * 0.72, p.y + h * 0.34);
      ctx.lineTo(p.x - w * 0.62, p.y + h * 0.34);
      ctx.closePath();
      ctx.fillStyle = 'rgba(48, 47, 43, 0.85)';
      ctx.fill();
      // 앞 봉우리
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h);
      ctx.lineTo(p.x + w, p.y + h * 0.45);
      ctx.lineTo(p.x - w, p.y + h * 0.45);
      ctx.closePath();
      const mg = ctx.createLinearGradient(p.x - w, p.y - h, p.x + w, p.y + h);
      mg.addColorStop(0, '#3b3a34');
      mg.addColorStop(0.55, '#2c2c28');
      mg.addColorStop(1, '#20211f');
      ctx.fillStyle = mg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(201, 164, 92, 0.13)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // 좌면 하이라이트
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h);
      ctx.lineTo(p.x + w * 0.3, p.y + h * 0.42);
      ctx.lineTo(p.x - w * 0.06, p.y + h * 0.05);
      ctx.closePath();
      ctx.fillStyle = 'rgba(150, 148, 136, 0.18)';
      ctx.fill();
    }
  }

  function drawRivers() {
    const s = scale();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const river of RIVERS) {
      ctx.beginPath();
      river.forEach(([x, y], i) => {
        const p = toScreen(x, y);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = 'rgba(40, 66, 82, 0.9)';
      ctx.lineWidth = Math.max(2.4, s * 0.85);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(108, 154, 176, 0.40)';
      ctx.lineWidth = Math.max(0.9, s * 0.26);
      ctx.stroke();
    }
  }

  function drawRoads() {
    const s = scale();
    const seen = new Set();
    ctx.lineWidth = Math.max(0.8, Math.min(1.5, s * 0.16));
    ctx.setLineDash([Math.max(3, s * 0.55), Math.max(3, s * 0.5)]);
    for (const c of CITIES) {
      for (const nb of c.roads) {
        const key = [c.id, nb].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = toScreen(c.x, c.y), b = toScreen(CITY_BY_ID[nb].x, CITY_BY_ID[nb].y);
        ctx.strokeStyle = 'rgba(201, 164, 92, 0.26)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  /* 권역 경계 — 그 권역을 가장많이 가진 세력 색으로 옅게 */
  function drawTerritory() {
    if (!state) return;
    const groups = {};
    for (const c of CITIES) {
      const city = state.cities[c.id];
      if (!city || !city.owner) continue;
      (groups[c.region] = groups[c.region] || []).push({ c, owner: city.owner });
    }
    for (const [region, list] of Object.entries(groups)) {
      if (list.length < 2) continue;
      const count = {};
      for (const it of list) count[it.owner] = (count[it.owner] || 0) + 1;
      const owner = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
      const fac = state.factions[owner];
      const color = (fac && fac.color) || FACTION_COLORS[owner] || '#8a8474';
      const pts = hull(list.map((it) => [it.c.x, it.c.y]));
      if (pts.length < 3) continue;
      ctx.beginPath();
      pts.forEach(([wx, wy], i) => {
        const p = toScreen(wx, wy);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = rgba(color, 0.05);
      ctx.fill();
      ctx.strokeStyle = rgba(color, 0.42);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = rgba(color, 0.4);
      ctx.shadowBlur = 8;
      ctx.strokeStyle = rgba(color, 0.3);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* 성곽 엠블럼 — 벡터 성벽·탑·성문·세력 깃발 */
  function castleArt(p, sz, color, owner, major) {
    const u = sz / 2;
    const x = p.x, y = p.y;
    const lit = mix(color, '#6a7078', 0.52);
    const wall = mix(color, '#22272d', 0.68);
    const dark = mix(color, '#0e1216', 0.86);
    const gold = 'rgba(201, 164, 92, 0.50)';

    // 바닥 그림자
    ctx.beginPath();
    ctx.ellipse(x, y + u * 0.86, u * 1.15, u * 0.24, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    // 기단
    ctx.fillStyle = 'rgba(10, 13, 16, 0.9)';
    ctx.fillRect(x - u * 1.08, y + u * 0.5, u * 2.16, u * 0.26);

    const wallGrad = (x0, y0, w, h) => {
      const g = ctx.createLinearGradient(x0, y0, x0 + w * 0.7, y0 + h);
      g.addColorStop(0, lit);
      g.addColorStop(0.55, wall);
      g.addColorStop(1, dark);
      return g;
    };

    // 뒤쪽 외벽
    const ww = u * 1.72, wh = u * 0.58;
    ctx.fillStyle = wallGrad(x - ww / 2, y - wh * 0.1, ww, wh);
    ctx.fillRect(x - ww / 2, y - wh * 0.1, ww, wh);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.7;
    ctx.strokeRect(x - ww / 2 + 0.35, y - wh * 0.1 + 0.35, ww - 0.7, wh - 0.7);

    // 외벽 성가퀴
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = i % 2 ? wall : lit;
      ctx.fillRect(x - ww / 2 + (i * ww) / 6 + ww * 0.012, y - wh * 0.1 - u * 0.14, (ww / 6) * 0.72, u * 0.16);
    }

    // 좌우 탑
    for (const side of [-1, 1]) {
      const tw = u * 0.52, th = u * 0.98;
      const tx = x + side * (ww / 2 - tw * 0.42) - tw / 2;
      const ty = y - th * 0.42;
      ctx.fillStyle = wallGrad(tx, ty, tw, th);
      ctx.fillRect(tx, ty, tw, th);
      ctx.strokeStyle = gold;
      ctx.lineWidth = 0.7;
      ctx.strokeRect(tx + 0.35, ty + 0.35, tw - 0.7, th - 0.7);
      // 탑 꼭대기 홍예
      ctx.fillStyle = lit;
      ctx.fillRect(tx - tw * 0.06, ty - u * 0.12, tw * 1.12, u * 0.12);
      ctx.fillStyle = wall;
      ctx.fillRect(tx + tw * 0.2, ty - u * 0.24, tw * 0.2, u * 0.13);
      ctx.fillRect(tx + tw * 0.58, ty - u * 0.24, tw * 0.2, u * 0.13);
      // 탑 창
      ctx.fillStyle = 'rgba(9, 12, 15, 0.92)';
      ctx.fillRect(tx + tw * 0.34, ty + th * 0.42, tw * 0.32, th * 0.24);
    }

    // 중앙 탑(대도시는 높게)
    const ch = u * (major ? 1.02 : 0.84);
    const cw = u * 0.56;
    const cx = x - cw / 2, cy = y - ch * 0.46;
    ctx.fillStyle = wallGrad(cx, cy, cw, ch);
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = 'rgba(233, 211, 164, 0.45)';
    ctx.strokeRect(cx + 0.35, cy + 0.35, cw - 0.7, ch - 0.7);
    ctx.fillStyle = lit;
    ctx.fillRect(cx - cw * 0.08, cy - u * 0.12, cw * 1.16, u * 0.12);

    // 성문 — 홍예
    const gw = u * 0.4, gh = u * 0.42;
    const gy = y + u * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - gw / 2, gy);
    ctx.lineTo(x - gw / 2, gy - gh * 0.5);
    ctx.quadraticCurveTo(x, gy - gh * 1.22, x + gw / 2, gy - gh * 0.5);
    ctx.lineTo(x + gw / 2, gy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 11, 14, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 164, 92, 0.75)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // 깃대와 세력 깃발
    const poleBase = cy - u * 0.1;
    const poleTop = cy - u * 1.28;
    const px = x + cw * 0.34;
    ctx.strokeStyle = 'rgba(201, 164, 92, 0.85)';
    ctx.lineWidth = Math.max(0.8, u * 0.055);
    ctx.beginPath();
    ctx.moveTo(px, poleBase);
    ctx.lineTo(px, poleTop);
    ctx.stroke();
    const fw = u * 0.86, fh = u * 0.52;
    ctx.beginPath();
    ctx.moveTo(px, poleTop);
    ctx.quadraticCurveTo(px + fw * 0.52, poleTop + fh * 0.14, px + fw, poleTop + fh * 0.3);
    ctx.quadraticCurveTo(px + fw * 0.52, poleTop + fh * 0.78, px, poleTop + fh * 0.7);
    ctx.closePath();
    ctx.fillStyle = mix(color, '#ffffff', 0.06);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12, 15, 18, 0.55)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = 'rgba(233, 211, 164, 0.7)';
    ctx.beginPath();
    ctx.arc(px + fw * 0.42, poleTop + fh * 0.4, Math.max(0.55, u * 0.055), 0, Math.PI * 2);
    ctx.fill();

    // 소유 세력 식별 띠
    if (owner) {
      ctx.strokeStyle = rgba(color, 0.75);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - u * 1.08, y + u * 0.76);
      ctx.lineTo(x + u * 1.08, y + u * 0.76);
      ctx.stroke();
    }
  }

  function drawRegionLabels() {
    if (cam.zoom > 1.12) return;
    const groups = {};
    for (const c of CITIES) {
      (groups[c.region] = groups[c.region] || []).push(c);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [region, list] of Object.entries(groups)) {
      const cx = list.reduce((n, c) => n + c.x, 0) / list.length;
      const cy = list.reduce((n, c) => n + c.y, 0) / list.length;
      const p = toScreen(cx, cy);
      const fs = Math.max(10, Math.min(15, 9 + cam.zoom * 5));
      ctx.font = `600 ${fs}px "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(201, 164, 92, 0.20)';
      ctx.fillText(region, p.x, p.y);
      // 밑줄 장식
      const tw = ctx.measureText(region).width;
      ctx.strokeStyle = 'rgba(201, 164, 92, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - tw / 2, p.y + fs * 0.72);
      ctx.lineTo(p.x + tw / 2, p.y + fs * 0.72);
      ctx.stroke();
    }
  }

  function drawCities() {
    const sc = scale();
    const own = state ? state.playerId : null;
    const items = [];
    for (const c of CITIES) {
      const p = toScreen(c.x, c.y);
      if (p.x < -80 || p.y < -80 || p.x > cssW + 80 || p.y > cssH + 80) continue;
      const city = state ? state.cities[c.id] : null;
      const isOwn = !!(city && own && city.owner === own);
      items.push({
        c, city, isOwn, p,
        sz: Math.max(20, Math.min(38, sc * 3.5)) * (c.major ? 1.1 : 1),
        pri: (selected === c.id ? 4 : 0) + (isOwn ? 2 : 0) + (c.major ? 1 : 0),
      });
    }
    const iconRects = [];
    for (const it of items.slice().sort((a, b) => a.pri - b.pri)) {
      const owner = it.city ? it.city.owner : null;
      const color = owner ? (state.factions[owner] ? state.factions[owner].color : '#888') : '#7d7462';
      const isSel = selected === it.c.id;
      // 세력 영토 톤 — 성 아래 옅은 빛
      if (owner) {
        const rg = ctx.createRadialGradient(it.p.x, it.p.y + it.sz * 0.2, 0, it.p.x, it.p.y + it.sz * 0.2, it.sz * 1.5);
        rg.addColorStop(0, rgba(color, 0.20));
        rg.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(it.p.x, it.p.y + it.sz * 0.2, it.sz * 1.5, it.sz * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (isSel) {
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 520));
        const r = it.sz * 0.92;
        ctx.strokeStyle = `rgba(233, 211, 164, ${0.35 + 0.45 * pulse})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(it.p.x - r, it.p.y - r, r * 2, r * 2);
        ctx.fillStyle = `rgba(233, 211, 164, ${0.05 + 0.05 * pulse})`;
        ctx.fillRect(it.p.x - r, it.p.y - r, r * 2, r * 2);
      }
      castleArt(it.p, it.sz, color, owner, it.c.major);
      iconRects.push({ id: it.c.id, r: [it.p.x - it.sz * 0.62, it.p.y - it.sz * 0.62, it.sz * 1.24, it.sz * 1.24] });
    }
    // 이름표: 중요한 성부터 자리를 잡고, 겹치면 다음 후보/생략
    const fs = Math.max(9.5, Math.min(14.5, 8.5 + cam.zoom * 2 + Math.max(0, sc - 8) * 0.5));
    ctx.font = `600 ${fs}px "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const placed = [];
    const overlap = (r, q, pad = 1) => !(r[0] > q[0] + q[2] + pad || r[0] + r[2] + pad < q[0] || r[1] > q[1] + q[3] + pad || r[1] + r[3] + pad < q[1]);
    for (const it of items.slice().sort((a, b) => b.pri - a.pri)) {
      // 화면 밖 성의 이름표가 가장자리에 끌려 들어오지 않게
      if (it.p.x < 6 || it.p.x > cssW - 6 || it.p.y < TOP_INSET || it.p.y > cssH - 4) continue;
      const isSel = selected === it.c.id;
      const label = it.c.ko;
      const tw = Math.round(ctx.measureText(label).width) + 9;
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
      // 화면 밖으로 잘리지 않게
      rect[0] = Math.max(2, Math.min(cssW - tw - 2, rect[0]));
      placed.push(rect);
      ctx.fillStyle = isSel ? 'rgba(40, 34, 18, 0.96)' : 'rgba(11, 14, 18, 0.86)';
      ctx.fillRect(Math.round(rect[0]), Math.round(rect[1]), tw, th);
      ctx.strokeStyle = isSel ? 'rgba(233, 211, 164, 0.95)' : (it.isOwn ? 'rgba(201, 164, 92, 0.55)' : 'rgba(150, 140, 118, 0.35)');
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(rect[0]) + 0.5, Math.round(rect[1]) + 0.5, tw - 1, th - 1);
      ctx.fillStyle = isSel ? '#ffeeb8' : it.isOwn ? '#ece0c2' : '#ddd6c4';
      ctx.fillText(label, rect[0] + tw / 2, rect[1] + th / 2 + 0.5);
    }
  }

  function render() {
    if (!cssW || !cssH) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSea();
    drawLand();
    drawTerrainTexture();
    drawTerritory();
    drawRivers();
    drawMountains();
    drawRoads();
    drawRegionLabels();
    drawCities();
  }

  function hitTest(sx, sy) {
    const s = scale();
    let best = null, bestD = Infinity;
    for (const c of CITIES) {
      const p = toScreen(c.x, c.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < Math.max(18, s * 3) && d < bestD) { best = c.id; bestD = d; }
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
    setState(s) { state = s; requestRender(); },
    setSelected(id) { selected = id; requestRender(); },
    focusCity(id) {
      const c = CITY_BY_ID[id];
      if (!c) return;
      cam.x = c.x; cam.y = c.y;
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
