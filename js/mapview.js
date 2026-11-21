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
  let cam = { x: 56, y: 36, zoom: 1 };
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
    cssW = Math.max(1, rect.width || canvas.clientWidth || 0);
    cssH = Math.max(1, rect.height || canvas.clientHeight || 0);
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    requestRender();
  }

  const fitScale = () => Math.min(cssW / 82, cssH / 72);
  const scale = () => fitScale() * cam.zoom;

  function toScreen(wx, wy) {
    const s = scale();
    return { x: (wx - cam.x) * s + cssW / 2, y: (wy - cam.y) * s + cssH / 2 };
  }
  function toWorld(sx, sy) {
    const s = scale();
    return { x: (sx - cssW / 2) / s + cam.x, y: (sy - cssH / 2) / s + cam.y };
  }

  function clampCam() {
    cam.zoom = Math.max(1, Math.min(3.6, cam.zoom));
    if (!Number.isFinite(cam.x) || !Number.isFinite(cam.y)) cam.x = 56, cam.y = 36;
    if (!cssW || !cssH) return;
    const halfW = cssW / 2 / scale(), halfH = cssH / 2 / scale();
    const minX = 22 + halfW, maxX = 92 - halfW;
    const minY = 4 + halfH, maxY = 70 - halfH;
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
    g.addColorStop(0, '#2c3f30');
    g.addColorStop(0.5, '#33452f');
    g.addColorStop(1, '#2a3a28');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#1b2a1e';
    ctx.lineWidth = Math.max(2, 2 * dpr);
    ctx.stroke();
    // 해안선 하이라이트
    ctx.strokeStyle = 'rgba(120,160,140,0.25)';
    ctx.lineWidth = 1;
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
    ctx.lineWidth = Math.max(1, Math.min(3, s * 0.45));
    const seen = new Set();
    for (const c of CITIES) {
      for (const nb of c.roads) {
        const key = [c.id, nb].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = toScreen(c.x, c.y), b = toScreen(CITY_BY_ID[nb].x, CITY_BY_ID[nb].y);
        ctx.strokeStyle = 'rgba(190,170,120,0.28)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        // 도트 길
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.floor(len / 9);
        ctx.fillStyle = 'rgba(200,180,130,0.22)';
        for (let i = 1; i < steps; i += 2) {
          const t = i / steps;
          ctx.fillRect(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t), 2, 2);
        }
      }
    }
  }

  function castleIcon(p, size, color, owner) {
    const u = Math.max(1, Math.round(size / 8));
    const x = Math.round(p.x - size / 2), y = Math.round(p.y - size / 2);
    // 성벽 본체 — 세력색을 섞어 소유를 한눈에
    const wall = mix(color, '#6b6252', 0.55);
    const wallTop = mix(color, '#a89e86', 0.5);
    drawPixelRect(x + u * 1, y + u * 3, u * 6, u * 5, '#241f18');
    drawPixelRect(x + u * 1, y + u * 3, u * 6, u * 4, wall);
    drawPixelRect(x + u * 1, y + u * 3, u * 6, u * 1, wallTop);
    // 성문
    drawPixelRect(x + u * 3, y + u * 5, u * 2, u * 3, '#221f19');
    // 탑
    drawPixelRect(x + u * 0, y + u * 1, u * 2, u * 5, mix(color, '#4e4739', 0.6));
    drawPixelRect(x + u * 6, y + u * 1, u * 2, u * 5, mix(color, '#4e4739', 0.6));
    drawPixelRect(x + u * 0, y + u * 0, u * 2, u * 2, '#c8b078');
    drawPixelRect(x + u * 6, y + u * 0, u * 2, u * 2, '#c8b078');
    drawPixelRect(x + u * 3, y + u * 0, u * 2, u * 2, '#c8b078');
    // 깃발(세력색)
    drawPixelRect(x + u * 3, y - u * 3, u * 1, u * 3, '#3a3326');
    drawPixelRect(x + u * 4, y - u * 3, u * 3, u * 2, color);
    // 소유자 표시 테두리
    ctx.strokeStyle = owner ? color : '#777';
    ctx.lineWidth = Math.max(1, u);
    ctx.strokeRect(x + u * 0.5, y + u * 0.5, u * 7, u * 7.5);
  }

  function drawCities() {
    const s = scale();
    const showAllLabels = cam.zoom > 1.75;
    const placed = [];
    const own = state ? state.playerId : null;
    const ordered = CITIES.slice().sort((a, b) => {
      const pa = (selected === a.id ? 3 : 0) + (state && state.cities[a.id].owner === own ? 2 : 0) + (a.major ? 1 : 0);
      const pb = (selected === b.id ? 3 : 0) + (state && state.cities[b.id].owner === own ? 2 : 0) + (b.major ? 1 : 0);
      return pb - pa;
    });
    for (const c of ordered) {
      const p = toScreen(c.x, c.y);
      if (p.x < -40 || p.y < -40 || p.x > cssW + 40 || p.y > cssH + 40) continue;
      const city = state ? state.cities[c.id] : null;
      const owner = city ? city.owner : null;
      const color = owner ? (state.factions[owner] ? state.factions[owner].color : '#888') : '#777';
      const isSel = selected === c.id;
      const size = Math.max(12, Math.min(22, s * 2.5));
      if (isSel) {
        const t = (Date.now() % 1000) / 1000;
        ctx.strokeStyle = `rgba(255,215,120,${0.5 + 0.5 * Math.sin(t * Math.PI * 2)})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(p.x - size * 0.85), Math.round(p.y - size * 0.85), Math.round(size * 1.7), Math.round(size * 1.7));
      }
      castleIcon(p, size, color, owner);
      const label = c.ko;
      const show = showAllLabels || isSel || (state && state.cities[c.id].owner === own);
      if (show) {
        const fs = Math.max(9, Math.min(13, 9 + cam.zoom * 2));
        const tw = label.length * fs * 0.98;
        const tx = Math.round(p.x);
        const ty = Math.round(p.y + size * 0.62);
        const rect = [tx - tw / 2 - 1, ty - 1, tw + 2, fs + 2];
        const hit = placed.some((r) => !(rect[0] > r[0] + r[2] || rect[0] + rect[2] < r[0] || rect[1] > r[1] + r[3] || rect[1] + rect[3] < r[1]));
        if (hit && !isSel && !(state && state.cities[c.id].owner === own)) continue;
        placed.push(rect);
        ctx.font = `700 ${fs}px "Galmuri11", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillText(label, tx + 1, ty + 1);
        ctx.fillStyle = isSel ? '#ffe9a8' : (state && state.cities[c.id].owner === own) ? '#d9f2c8' : '#ded4ba';
        ctx.fillText(label, tx, ty);
      }
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
      const s = scale();
      cam.x -= dx / s;
      cam.y -= dy / s;
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
    resetView() { cam = { x: 56, y: 36, zoom: 1 }; clampCam(); requestRender(); },
    resize,
    render: requestRender,
    getZoom: () => cam.zoom,
  };
}
