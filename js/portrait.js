/* 장수 초상화 — HD-2D 픽셀 아트
   64×64 격자에 다층 음영·림라이트·눈빛·머리카락·갑옷 결을 그려 SVG로 내보낸다.
   장수 id에서 결정론적으로 생성하므로 같은 장수는 언제나 같은 얼굴이 나온다. */

const W = 64, H = 64;
const cache = new Map();

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rnd(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function rgb(c) {
  const h = String(c || '#888888').replace('#', '');
  const s = h.length === 3 ? h.split('').map((k) => k + k).join('') : h;
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function hex(r, g, b) {
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + ((cl(r) << 16) | (cl(g) << 8) | cl(b)).toString(16).padStart(6, '0');
}
function mix(a, b, t) {
  const pa = rgb(a), pb = rgb(b);
  return hex(pa.r + (pb.r - pa.r) * t, pa.g + (pb.g - pa.g) * t, pa.b + (pb.b - pa.b) * t);
}
function light(c, amt) { return amt >= 0 ? mix(c, '#fff4e2', amt) : mix(c, '#0a0805', -amt); }

const SKINS = [
  { hi: '#f8ddb6', mid: '#e7bf92', base: '#d3a273', sh: '#a97449', deep: '#7c5030' },
  { hi: '#f4d2a8', mid: '#dcae80', base: '#c69263', sh: '#9a673f', deep: '#6e472a' },
  { hi: '#edc79c', mid: '#cda071', base: '#b08357', sh: '#865a36', deep: '#5c3b22' },
  { hi: '#faddba', mid: '#ecc79c', base: '#d6ab80', sh: '#ab7e56', deep: '#7f5637' },
];
const HAIRS = ['#1a1116', '#1e1512', '#241a12', '#150f0c'];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* ---------- 얼굴 조명: 타원 표면의 법선으로 4단 피부색 ---------- */
function skinShade(skin, nx, ny, nz, x, y) {
  // 빛은 좌상단에서
  const d = nx * -0.44 + ny * -0.55 + nz * 0.71;
  const t = clamp01((d + 0.28) / 1.16);
  let idx;
  if (t > 0.74) idx = 0; else if (t > 0.56) idx = 1; else if (t > 0.38) idx = 2; else idx = 3;
  // 경계에 디더 — 도트 특유의 부드러운 단차
  const edge = [0.74, 0.56, 0.38][idx === 0 ? 0 : idx === 1 ? 1 : 2];
  if (Math.abs(t - edge) < 0.035 && ((x + y) & 1)) idx = Math.min(3, idx + 1);
  return [skin.hi, skin.mid, skin.base, skin.sh][idx];
}

function build(gid, general, factionColor, style) {
  const seed = hash(gid || 'x');
  const r = (i) => rnd(seed % 9973, i);
  const war = general && general.war != null ? general.war : 60;
  const lead = general && general.lead != null ? general.lead : 60;
  const fac = factionColor || '#3b4f6b';
  const st = style || {};

  const hat = st.hat != null ? Math.max(0, Math.min(4, Math.floor(st.hat))) : (lead > 88 ? 1 : Math.floor(r(8) * 5));
  const beard = st.beard != null ? Math.max(0, Math.min(3, Math.floor(st.beard))) : (r(4) < 0.34 ? 0 : r(5) < 0.55 ? 1 : r(6) < 0.62 ? 2 : 3);
  const skin = SKINS[st.skin != null ? Math.max(0, Math.min(3, Math.floor(st.skin))) : Math.floor(r(1) * 4)];
  const hairC = HAIRS[Math.floor(r(9) * HAIRS.length)];
  const hairHi = mix(hairC, '#a8834f', 0.52);
  const scar = r(12) < 0.2;
  const scarf = mix(fac, '#1a120c', 0.4);
  const scarfHi = mix(fac, '#ffe0b4', 0.36);
  const lash = mix(hairC, '#1a0f08', 0.4);
  const irisC = mix('#6b4526', '#2c1a0e', 0.45 + r(24) * 0.3);

  const grid = new Array(W * H).fill(null);
  const set = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H || !c) return;
    grid[y * W + x] = c;
  };
  const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : grid[y * W + x]);
  const fillEllipse = (cx, cy, rx, ry, color) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y, color);
      }
    }
  };
  const rect = (x, y, w, h, color) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, color);
  };

  const cx = 32, cy = 27.5;
  const rx = 9.8 + r(20) * 0.8;
  const ry = 13.6;
  const eyeY = 28 + (r(22) > 0.78 ? 1 : 0);
  const eyeDx = 4.6 + r(23) * 0.5;
  const mouthY = 36;

  /* ---------- 몸통·갑옷 ---------- */
  const bodyHalf = (y) => {
    const t = clamp01((y - 46) / (H - 46));
    return 8.6 + Math.pow(t, 0.5) * 19.5;
  };
  for (let y = 46; y < H; y++) {
    const half = bodyHalf(y);
    for (let x = Math.round(32 - half); x <= Math.round(32 + half); x++) {
      const nx = (x - 32) / half;
      let c = mix('#241b13', '#4a3927', 0.35 + (1 - Math.abs(nx)) * 0.3);
      if (nx < -0.55) c = light(c, 0.2);
      else if (nx > 0.5) c = light(c, -0.26);
      set(x, y, c);
    }
  }
  // 가슴 찰갑 띠와 못
  for (let y = 53; y < H; y += 4) {
    for (let x = 8; x < 57; x++) {
      const c = get(x, y);
      if (!c) continue;
      set(x, y, light(c, 0.16));
      set(x, y + 1, light(c, -0.3));
    }
    for (let x = 12; x < 54; x += 5) {
      const c = get(x, y - 1);
      if (c) set(x, y - 1, '#d8a866');
    }
  }
  // 어깨 판금 — 몸통 곡선을 따라 겹친 판
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const yy = 48 + k * 3;
      const half = bodyHalf(yy) - 0.6;
      const w = 10 - k * 2;
      const x0 = side < 0 ? Math.round(32 - half) : Math.round(32 + half - w + 1);
      for (let i = 0; i < w; i++) {
        const t = i / Math.max(1, w - 1);
        const base = mix('#3f4a54', '#101519', 0.3);
        let c = side < 0 ? light(base, 0.26 - t * 0.18) : light(base, 0.04 - t * 0.2);
        if (k === 0) c = light(c, 0.12);
        set(x0 + i, yy, c);
        set(x0 + i, yy + 1, light(c, -0.44));
      }
      set(side < 0 ? x0 + w - 1 : x0, yy, '#e8bc7c');
      set(side < 0 ? x0 : x0 + w - 1, yy, '#b8863e');
    }
  }
  // 가슴 중앙의 금빛 고리
  set(32, 54, '#f0cc86');
  set(32, 55, '#c8944e');
  set(31, 55, '#8a5f28');
  set(33, 55, '#8a5f28');

  // 목깃 — 세력색 옷깃
  for (let y = 43; y <= 49; y++) {
    const half = 5.2 + (y - 43) * 1.55;
    for (let x = Math.round(32 - half); x <= Math.round(32 + half); x++) {
      const nx = (x - 32) / half;
      let c = nx < -0.2 ? scarfHi : scarf;
      if (y === 43) c = light(c, 0.22);
      if (nx > 0.55) c = light(c, -0.22);
      set(x, y, c);
    }
  }

  /* ---------- 목 (턱 그늘 포함) ---------- */
  for (let y = 38; y <= 47; y++) {
    for (let x = 29; x <= 35; x++) {
      const nx = (x - 32) / 4, ny = (y - 42) / 6;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let c = skinShade(skin, nx * 0.55, ny, nz, x, y);
      if (y < 42) c = light(c, -0.3);
      if (x > 34) c = light(c, -0.12);
      set(x, y, c);
    }
  }

  /* ---------- 얼굴 ---------- */
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const vy = (y - cy) / ry;
    let rrx = rx;
    if (vy > 0.24) rrx = rx * (1 - Math.pow((vy - 0.24) / 0.9, 1.45) * 0.5);
    if (vy < -0.5) rrx *= 0.95;
    for (let x = Math.round(cx - rrx); x <= Math.round(cx + rrx); x++) {
      const nx = (x - cx) / rrx;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - vy * vy));
      let c = skinShade(skin, nx, vy, nz, x, y);
      // 광대·턱의 면
      if (nx > 0.52 && vy > -0.1 && vy < 0.55) c = light(c, -0.06);
      if (vy > 0.6) c = light(c, -0.1);
      if (nx < -0.62 && vy > 0.1) c = light(c, 0.05);
      set(x, y, c);
    }
  }
  // 턱 밑 그늘 — 목과 분리
  for (let x = Math.round(cx - rx * 0.55); x <= Math.round(cx + rx * 0.55); x++) {
    set(x, Math.round(cy + ry * 0.94), light(skin.deep, -0.16));
  }
  // 귀
  for (const side of [-1, 1]) {
    const ex = Math.round(cx + side * (rx - 0.2));
    for (let y = eyeY - 3; y <= eyeY + 2; y++) {
      set(ex, y, side < 0 ? light(skin.base, 0.04) : light(skin.sh, 0.02));
    }
    set(ex + side, eyeY - 1, light(skin.sh, -0.06));
  }

  /* ---------- 눈 ---------- */
  for (const side of [-1, 1]) {
    const ex = Math.round(cx + side * eyeDx);
    // 눈두덩 그늘
    for (let x = ex - 2; x <= ex + 2; x++) set(x, eyeY - 2, light(skin.base, -0.02));
    // 눈: 바깥→안쪽
    const inner = -side; // 코 쪽
    set(ex + inner * 2, eyeY, '#ded0b8');
    set(ex + inner, eyeY, irisC);
    set(ex, eyeY, mix(irisC, '#0d0805', 0.55));
    set(ex - inner, eyeY, '#ecdfc9');
    set(ex - inner * 2, eyeY, light(skin.sh, 0.02));
    // 위 눈꺼풀선
    for (let x = ex - 2; x <= ex + 1; x++) set(x, eyeY - 1, lash);
    // 안광 — 눈동자 위 한 점
    set(ex + inner, eyeY - 1, '#ffe9b8');
    // 아래 눈꺼풀
    set(ex - 1, eyeY + 1, light(skin.sh, 0.06));
    set(ex, eyeY + 1, light(skin.sh, 0.02));
    set(ex + 1, eyeY + 1, light(skin.sh, -0.04));

  }
  // 눈썹
  const steep = war >= 85 || r(25) > 0.7;
  const browC = mix(hairC, '#4a3722', 0.45);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const bx = Math.round(cx + side * (eyeDx - 2.4 + i * 0.9));
      const lift = steep ? Math.round((i > 3 ? (i - 3) : 0) * 0.5) : 0;
      set(bx, eyeY - 4 - lift, i === 0 ? light(browC, -0.1) : browC);
    }
    set(Math.round(cx + side * (eyeDx + 2.6)), eyeY - 4, light(browC, 0.06));
  }

  /* ---------- 코 ---------- */
  set(cx - 1, eyeY + 2, light(skin.mid, 0.16));
  set(cx - 1, eyeY + 3, light(skin.mid, 0.2));
  set(cx + 1, eyeY + 2, light(skin.sh, -0.04));
  set(cx + 1, eyeY + 3, light(skin.sh, -0.06));
  set(cx, eyeY + 4, light(skin.sh, -0.02));
  set(cx - 1, eyeY + 4, light(skin.deep, 0.06));
  set(cx + 1, eyeY + 4, light(skin.deep, 0.06));
  // 콧방울 그늘
  set(cx - 2, eyeY + 4, light(skin.sh, -0.04));
  set(cx + 2, eyeY + 4, light(skin.sh, -0.1));

  /* ---------- 입 ---------- */
  const lipC = mix('#a8604a', skin.base, 0.4);
  for (let x = cx - 1; x <= cx + 2; x++) set(x, mouthY, lipC);
  set(cx - 1, mouthY, light(lipC, -0.1));
  set(cx + 2, mouthY, light(lipC, -0.16));
  set(cx, mouthY + 1, light(skin.mid, 0.16));

  /* ---------- 수염 ---------- */
  const beardC = mix(hairC, '#4e3a26', 0.42);
  if (beard >= 1) {
    for (let x = cx - 2; x <= cx + 2; x++) set(x, mouthY - 1, x === cx ? beardC : light(beardC, -0.08));
  }
  if (beard === 1) { // 짧은 턱수염
    for (let x = cx - 2; x <= cx + 2; x++) set(x, mouthY + 2, light(beardC, 0.04));
    set(cx - 1, mouthY + 2, light(beardC, 0.12));
  } else if (beard === 2) { // 구레나룻 + 턱수염
    for (const side of [-1, 1]) {
      for (let y = eyeY - 1; y <= mouthY + 2; y++) {
        const bx = Math.round(cx + side * (rx - 0.8 + (y - eyeY) * 0.04));
        set(bx, y, side < 0 ? light(beardC, 0.1) : beardC);
      }
    }
    for (let x = cx - 1; x <= cx + 1; x++) set(x, mouthY + 2, beardC);
    rect(cx - 1, mouthY + 3, 3, 2, light(beardC, -0.04));
    set(cx, mouthY + 4, light(beardC, 0.12));
  } else if (beard === 3) { // 장수염 — 가슴까지
    for (const side of [-1, 1]) {
      for (let y = eyeY; y <= mouthY + 1; y++) {
        const bx = Math.round(cx + side * (rx - 0.9));
        set(bx, y, hairC);
      }
    }
    for (let y = mouthY + 2; y <= mouthY + 10; y++) {
      const w = Math.max(1, 3 - Math.floor((y - mouthY) / 3));
      for (let x = cx - w; x <= cx + w; x++) {
        set(x, y, x < cx ? light(beardC, 0.12) : beardC);
      }
    }
    set(cx, mouthY + 6, light(beardC, 0.3));
    set(cx - 1, mouthY + 4, light(beardC, 0.18));
  }

  /* ---------- 흉터 ---------- */
  if (scar) {
    for (let i = 0; i < 4; i++) set(cx + 5 + (i % 2), eyeY - 3 + i, light(skin.sh, -0.3));
  }

  /* ---------- 머리카락 ---------- */
  const hairTop = 13.2 + r(26) * 0.7;
  const hairR = rx + 1.5;
  for (let y = Math.floor(hairTop); y <= Math.round(cy + 4); y++) {
    const vy = (y - (cy - 2.2)) / (ry + 3);
    let hrx = hairR;
    if (vy > 0.3) hrx = hairR * (1 - Math.pow((vy - 0.3) / 0.85, 1.3) * 0.62);
    for (let x = Math.round(cx - hrx); x <= Math.round(cx + hrx); x++) {
      const nx = (x - cx) / hrx;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - vy * vy));
      const insideFace = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
      // 이마를 덮는 앞머리 — 눈썹 위까지
      const fringe = y < hairTop + 3.4
        + Math.sin((x - 18) * 0.62) * 1.1
        + Math.sin((x - 18) * 1.9) * 0.7
        + rnd(x + 17, 31) * 1.5;
      if (insideFace && !fringe) continue;
      // 귀는 살린다
      if (insideFace && y > eyeY - 4 && Math.abs(x - cx) < rx - 2.5) continue;
      let c = mix(hairC, hairHi, clamp01(nz * 0.75) * 0.45);
      if (nx < -0.35) c = light(c, 0.1);
      if (nx > 0.5) c = light(c, -0.2);
      set(x, y, c);
    }
  }
  // 윤기 가닥
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 4; k++) {
      set(25 - i + k * 0.4, Math.round(hairTop) + 1 + i * 2 + Math.round(k * 0.4), mix(hairHi, '#d8b070', 0.32));
    }
  }

  /* ---------- 쓰개 ---------- */
  if (hat === 1) {
    const capTop = Math.round(hairTop) - 7;
    for (let y = capTop; y <= Math.round(hairTop) + 2; y++) {
      const half = 6.2 + (y - capTop) * 0.5;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const nx = (x - cx) / half;
        set(x, y, nx < -0.3 ? '#2d2b34' : nx > 0.4 ? '#141319' : '#1f1e26');
      }
    }
    for (let x = Math.round(cx - 8); x <= Math.round(cx + 8); x++) set(x, Math.round(hairTop) + 2, '#d9a95e');
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const yy = Math.round(hairTop) + 1 + Math.round(i * 0.2);
        set(cx + side * (9 + i), yy, i % 2 ? '#33313a' : '#1b1a21');
        set(cx + side * (9 + i), yy + 1, '#141319');
        if (i < 5) set(cx + side * (9 + i), yy - 1, '#8a6532');
      }
    }
    set(cx, capTop - 1, '#e8c078');
  } else if (hat === 0) {
    const helmTop = Math.round(hairTop) - 5;
    for (let y = helmTop; y <= Math.round(hairTop) + 1; y++) {
      const vy = (y - (helmTop + 3)) / 4.6;
      const half = 10 * Math.sqrt(Math.max(0.03, 1 - vy * vy * 0.7));
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const nx = (x - cx) / half;
        let c = nx < -0.25 ? '#5f6d78' : nx > 0.4 ? '#1b222a' : '#333d46';
        if (vy < -0.35) c = light(c, 0.2);
        set(x, y, c);
      }
    }
    for (let x = Math.round(cx - 9); x <= Math.round(cx + 9); x++) set(x, Math.round(hairTop) + 1, '#e0b070');
    for (const side of [-1, 1]) {
      for (let y = Math.round(hairTop) + 1; y <= eyeY + 5; y++) {
        const bx = Math.round(cx + side * (rx - 0.4));
        set(bx, y, side < 0 ? '#414c55' : '#232a31');
        set(bx + side, y, '#1a2127');
      }
    }
    for (let i = 0; i < 7; i++) {
      set(cx - 1 + Math.round(Math.sin(i * 0.8) * 1.5), helmTop - 2 - i, i > 4 ? '#c8563e' : '#9c3a2a');
      set(cx + Math.round(Math.sin(i * 0.8) * 1.5), helmTop - 2 - i, '#7a2a1e');
    }
  } else if (hat === 2) {
    for (let y = Math.round(hairTop) + 1; y <= Math.round(hairTop) + 4; y++) {
      for (let x = Math.round(cx - rx - 1); x <= Math.round(cx + rx + 1); x++) {
        const inside = ((x - cx) / (rx + 1.3)) ** 2 + ((y - cy) / ry) ** 2 <= 1.14;
        if (!inside) continue;
        const nx = (x - cx) / rx;
        set(x, y, nx < -0.2 ? '#4c3b45' : nx > 0.4 ? '#221a20' : '#342731');
      }
    }
    for (let i = 0; i < 8; i++) {
      set(Math.round(cx - rx - 1 - i * 0.45), Math.round(hairTop) + 3 + i, i % 2 ? '#2e2229' : '#43333b');
      if (i % 3 === 0) set(Math.round(cx - rx - 2 - i * 0.45), Math.round(hairTop) + 3 + i, '#57424c');
    }
    for (let y = Math.round(hairTop) + 1; y <= Math.round(hairTop) + 5; y++) {
      set(Math.round(cx - rx - 1), y, '#5a4550');
    }
    for (let x = Math.round(cx - 8); x <= Math.round(cx + 7); x++) set(x, Math.round(hairTop) + 1, '#705863');
  } else if (hat === 3) {
    fillEllipse(cx, Math.round(hairTop) - 3, 3.4, 3, hairC);
    fillEllipse(cx - 0.8, Math.round(hairTop) - 4, 1.5, 1.3, mix(hairC, hairHi, 0.55));
    for (let x = Math.round(cx - 4); x <= Math.round(cx + 3); x++) set(x, Math.round(hairTop) - 3, '#d8a860');
    for (let i = 0; i < 4; i++) set(cx + i, Math.round(hairTop) - 4, '#e8c078');
  } else if (hat === 4) {
    for (let x = Math.round(cx - 17); x <= Math.round(cx + 17); x++) {
      const dx = (x - cx) / 17;
      const th = Math.max(1, Math.round(2.8 * Math.sqrt(Math.max(0, 1 - dx * dx))));
      for (let k = 0; k < th; k++) set(x, Math.round(hairTop) - 1 + k, k === 0 ? '#4d4231' : '#241e16');
    }
    for (let y = Math.round(hairTop) - 7; y <= Math.round(hairTop); y++) {
      const half = 6.2 - (Math.round(hairTop) - y) * 0.22;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const nx = (x - cx) / half;
        set(x, y, nx < -0.2 ? '#5f5439' : nx > 0.4 ? '#2a2418' : '#3d3524');
      }
    }
    set(cx, Math.round(hairTop) - 7, '#c8563e');
    set(cx, Math.round(hairTop) - 8, '#8e3324');
  }

  /* ---------- 림라이트 ---------- */
  const lit = grid.slice();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = lit[y * W + x];
      if (!c) continue;
      const left = lit[y * W + x - 1];
      const right = x + 1 < W ? lit[y * W + x + 1] : null;
      const up = y > 0 ? lit[(y - 1) * W + x] : null;
      if (!left) grid[y * W + x] = light(c, 0.22);
      else if (!right) grid[y * W + x] = light(c, -0.2);
      else if (!up) grid[y * W + x] = light(c, 0.1);
    }
  }

  /* ---------- 배경 ---------- */
  const bg = new Array(W * H);
  const baseDark = mix(fac, '#0a0806', 0.74);
  const baseMid = mix(fac, '#1a120c', 0.52);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const vy = y / H;
      let c = mix(baseMid, baseDark, clamp01(vy * 1.05));
      const dx = (x - 30) / 40, dy = (y - 18) / 34;
      const g = clamp01(1 - Math.sqrt(dx * dx + dy * dy) * 1.15);
      if (g > 0) c = mix(c, mix(fac, '#ffd9a0', 0.42), g * 0.55);
      if (((x + y * 2) % 37 === 0) && y < 44) c = light(c, 0.12);
      const vx = (x - 32) / 32, vyr = (y - 32) / 32;
      const v = clamp01(Math.sqrt(vx * vx + vyr * vyr) - 0.55);
      c = light(c, -v * 0.5);
      bg[y * W + x] = c;
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rnd(seed, 40 + i) * W), y = Math.floor(rnd(seed, 60 + i) * 44);
    bg[y * W + x] = mix('#ffd79a', fac, 0.2);
  }

  const out = new Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = grid[i] || bg[i];
  return out;
}

function toSVG(grid, size) {
  const byColor = new Map();
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = grid[y * W + x];
      let w = 1;
      while (x + w < W && grid[y * W + x + w] === c) w++;
      if (c) {
        if (!byColor.has(c)) byColor.set(c, []);
        byColor.get(c).push(`M${x} ${y}h${w}v1h-${w}z`);
      }
      x += w;
    }
  }
  let paths = '';
  for (const [c, list] of byColor) paths += `<path fill="${c}" d="${list.join('')}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${size}" height="${size}" shape-rendering="crispEdges">${paths}</svg>`;
}

export function portraitSVG(gid, general, size = 64, factionColor = '#3b4f6b', style = null) {
  const fac = factionColor || '#3b4f6b';
  const key = `${gid}|${size}|${fac}|${style ? `${style.hat}-${style.beard}-${style.skin}` : '-'}|v2`;
  if (cache.has(key)) return cache.get(key);
  const grid = build(gid, general, fac, style);
  const svg = toSVG(grid, size);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  cache.set(key, url);
  return url;
}

export function portraitURL(gid, general, size = 64, color = '#3b4f6b', style = null) {
  return portraitSVG(gid, general, size, color, style);
}
