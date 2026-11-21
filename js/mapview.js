/* 중국 전도 — 도트 스타일 캔버스 지도 (드래그·핀치 줌·탭 선택) */
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

const MOUNTAINS = [
  [33, 26], [36, 30], [39, 34], [42, 28], [46, 30], [49, 33], [35, 35], [38, 38],
  [43, 36], [47, 37], [52, 33], [55, 35], [34, 22], [40, 24], [45, 22], [50, 28],
  [58, 36], [60, 38], [30, 34], [37, 44], [42, 44],
];

function mix(a, b, t) {
  const pa = parseInt(String(a).replace('#', ''), 16), pb = parseInt(String(b).replace('#', ''), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar * (1 - t) + br * t), g = Math.round(ag * (1 - t) + bg * t), bl = Math.round(ab * (1 - t) + bb * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
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
  let hover = null;

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

  function drawPixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawLand() {
    ctx.beginPath();
    LAND.forEach(([x, y], i) => {
      const p = toScreen(x, y);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    const gy0 = toScreen(0, 0).y, gy1 = toScreen(0, 70).y;
    if (!Number.isFinite(gy0) || !Number.isFinite(gy1)) return;
    const g = ctx.createLinearGradient(0, gy0, 0, gy1);
    g.addColorStop(0, '#33492f');
    g.addColorStop(0.5, '#3b5334');
    g.addColorStop(1, '#2f452a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#16241a';
    ctx.lineWidth = Math.max(2, 2.5 * dpr);
    ctx.stroke();
    // 해안선 하이라이트
    ctx.strokeStyle = 'rgba(150,190,165,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawSea() {
    ctx.fillStyle = '#0a1728';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 물결 픽셀
    const s = scale();
    for (let i = 0; i < 90; i++) {
      const wx = 8 + ((i * 37) % 88);
      const wy = 6 + ((i * 53) % 62);
      const p = toScreen(wx, wy);
      if (insideLand(wx, wy)) continue;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(60,110,150,0.5)' : 'rgba(40,80,120,0.4)';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(2, 3), Math.max(1, 1));
    }
  }

  function insideLand(x, y) {
    let inside = false;
    for (let i = 0, j = LAND.length - 1; i < LAND.length; j = i++) {
      const xi = LAND[i][0], yi = LAND[i][1], xj = LAND[j][0], yj = LAND[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function drawPatches() {
    const patches = [
      { x: 34, y: 20, rx: 9, ry: 6, c: 'rgba(120,100,60,0.20)' },   // 서량 사막
      { x: 44, y: 41, rx: 6, ry: 5, c: 'rgba(90,130,70,0.18)' },    // 촉 분지
      { x: 66, y: 34, rx: 9, ry: 6, c: 'rgba(110,140,70,0.16)' },   // 중원 평야
      { x: 78, y: 44, rx: 6, ry: 5, c: 'rgba(70,120,110,0.16)' },   // 강남
      { x: 56, y: 8, rx: 8, ry: 4, c: 'rgba(90,110,70,0.14)' },
    ];
    for (const pt of patches) {
      const c = toScreen(pt.x, pt.y);
      const s2 = scale();
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, pt.rx * s2, pt.ry * s2, 0, 0, Math.PI * 2);
      ctx.fillStyle = pt.c;
      ctx.fill();
    }
  }

  function drawMountains() {
    const s = scale();
    for (const [x, y] of MOUNTAINS) {
      const p = toScreen(x, y);
      const size = Math.max(5, s * 1.7);
      ctx.fillStyle = '#4b4335';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size);
      ctx.lineTo(p.x + size, p.y + size * 0.6);
      ctx.lineTo(p.x - size, p.y + size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6a6050';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size);
      ctx.lineTo(p.x + size * 0.35, p.y - size * 0.1);
      ctx.lineTo(p.x - size * 0.1, p.y + size * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRivers() {
    const s = scale();
    ctx.strokeStyle = '#2f6a94';
    ctx.lineWidth = Math.max(2, s * 0.75);
    ctx.lineJoin = 'round';
    for (const river of RIVERS) {
      ctx.beginPath();
      river.forEach(([x, y], i) => {
        const p = toScreen(x, y);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,190,230,0.35)';
      ctx.lineWidth = Math.max(1, s * 0.28);
      ctx.stroke();
      ctx.strokeStyle = '#2f6a94';
      ctx.lineWidth = Math.max(2, s * 0.75);
    }
  }

  function drawRoads() {
    const s = scale();
    ctx.lineWidth = Math.max(1.4, Math.min(3.6, s * 0.55));
    const seen = new Set();
    for (const c of CITIES) {
      for (const nb of c.roads) {
        const key = [c.id, nb].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = toScreen(c.x, c.y), b = toScreen(CITY_BY_ID[nb].x, CITY_BY_ID[nb].y);
        ctx.strokeStyle = 'rgba(214,192,138,0.42)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        // 도트 길
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.floor(len / 9);
        ctx.fillStyle = 'rgba(226,205,150,0.36)';
        for (let i = 1; i < steps; i += 2) {
          const t = i / steps;
          ctx.fillRect(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t), 2, 2);
        }
      }
    }
  }

  function castleIcon(p, size, color, owner) {
    const u = Math.max(1, Math.round(size / 8));
    const x = Math.round(p.x - u * 4), y = Math.round(p.y - u * 3);
    const wall = mix(color, '#8a7f66', 0.4);
    const wallTop = mix(color, '#e0d2a4', 0.55);
    const gate = mix(color, '#1a1610', 0.72);
    // 땅 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y + u * 6, u * 8, u);
    // 성벽 바탕(어두운 테)
    drawPixelRect(x - u * 0.4, y - u * 0.4, u * 8.8, u * 6.8, '#0a0d13');
    // 성벽 + 상단 하이라이트
    drawPixelRect(x, y, u * 8, u * 6, wall);
    drawPixelRect(x, y, u * 8, u, wallTop);
    drawPixelRect(x, y + u * 5, u * 8, u, gate);
    // 성가퀴 3개
    for (let i = 0; i < 3; i++) drawPixelRect(x + u * (0.3 + i * 3), y - u * 1.6, u * 2, u * 1.8, wall);
    // 성문
    drawPixelRect(x + u * 3, y + u * 3.2, u * 2, u * 2.8, gate);
    // 깃대 + 세력 깃발
    drawPixelRect(x + u * 3.5, y - u * 4.4, u * 1, u * 3, '#2c2418');
    drawPixelRect(x + u * 4.2, y - u * 4.4, u * 3.4, u * 2.1, color);
    drawPixelRect(x + u * 4.2, y - u * 4.4, u * 3.4, u * 0.7, mix(color, '#ffffff', 0.35));
    // 소유 테두리
    ctx.strokeStyle = owner ? color : '#79705d';
    ctx.lineWidth = Math.max(1, u * 0.9);
    ctx.strokeRect(x - u * 0.4, y - u * 0.4, u * 8.8, u * 6.8);
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
      const fs = Math.max(11, Math.min(16, 10 + cam.zoom * 5));
      ctx.font = `700 ${fs}px "Galmuri11", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(230, 210, 150, 0.22)';
      ctx.fillText(region, p.x, p.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillText(region, p.x + 1, p.y + 1);
      ctx.fillStyle = 'rgba(230, 210, 150, 0.21)';
      ctx.fillText(region, p.x, p.y);
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
        sz: Math.max(15, Math.min(34, sc * 3.0)) * (c.major ? 1.12 : 1),
        pri: (selected === c.id ? 4 : 0) + (isOwn ? 2 : 0) + (c.major ? 1 : 0),
      });
    }
    // 아이콘: 중요도 낮은 성부터 그려 선택 성이 맨 위에 오게
    const iconRects = [];
    for (const it of items.slice().sort((a, b) => a.pri - b.pri)) {
      const owner = it.city ? it.city.owner : null;
      const color = owner ? (state.factions[owner] ? state.factions[owner].color : '#888') : '#7d7462';
      const isSel = selected === it.c.id;
      if (isSel) {
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 520));
        ctx.strokeStyle = `rgba(255,226,140,${0.35 + 0.5 * pulse})`;
        ctx.lineWidth = 2;
        const r = it.sz * 0.78;
        ctx.strokeRect(Math.round(it.p.x - r), Math.round(it.p.y - r), Math.round(r * 2), Math.round(r * 2));
      }
      castleIcon(it.p, it.sz, color, owner);
      iconRects.push({ id: it.c.id, r: [it.p.x - it.sz * 0.55, it.p.y - it.sz * 0.55, it.sz * 1.1, it.sz * 1.1] });
    }
    // 이름표: 중요한 성부터 자리를 잡고, 겹치면 다음 후보/생략
    const fs = Math.max(9.5, Math.min(14, 8.5 + cam.zoom * 2.2));
    ctx.font = `700 ${fs}px "Galmuri11", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const placed = [];
    const overlap = (r, q, pad = 1) => !(r[0] > q[0] + q[2] + pad || r[0] + r[2] + pad < q[0] || r[1] > q[1] + q[3] + pad || r[1] + r[3] + pad < q[1]);
    for (const it of items.slice().sort((a, b) => b.pri - a.pri)) {
      const isSel = selected === it.c.id;
      const label = it.c.ko;
      const tw = Math.round(ctx.measureText(label).width) + 7;
      const th = Math.round(fs + 4);
      const half = it.sz * 0.62;
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
      ctx.fillStyle = isSel ? 'rgba(58,44,12,0.95)' : 'rgba(7,11,17,0.86)';
      ctx.fillRect(Math.round(rect[0]), Math.round(rect[1]), tw, th);
      ctx.strokeStyle = isSel ? '#f0c94a' : (it.isOwn ? 'rgba(150,205,130,0.55)' : 'rgba(145,125,75,0.45)');
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(rect[0]) + 0.5, Math.round(rect[1]) + 0.5, tw - 1, th - 1);
      ctx.fillStyle = isSel ? '#ffe9a8' : it.isOwn ? '#dcf5cb' : '#e8dec4';
      ctx.fillText(label, rect[0] + tw / 2, rect[1] + th / 2 + 0.5);
    }
  }

  function render() {
    if (!cssW || !cssH) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSea();
    drawLand();
    drawPatches();
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
