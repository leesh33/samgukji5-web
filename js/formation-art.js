/* 진형 도트 대형 — 학익·어린·봉시·방원… 각 진형의 실제 대형을 픽셀 병사로 그린다.
   좌표계: 정면 = +x(동쪽). 각 점은 [-0.5, 0.5] 정사각 안에 들어간다.
   바라보는 방향(dir: N/E/S/W)에 맞춰 회전시켜 전장과 미리보기에 함께 쓴다. */

export const DIR_ANGLE = { E: 0, S: 90, W: 180, N: 270 }; // 화면 기준 시계방향(도)
export const DIR_KO = { E: '동', S: '남', W: '서', N: '북' };

/* 진형별 병사 배치 — 앞(+x)이 정면 */
export const FORMATION_DOTS = {
  // 학익: 정면 한 점에서 좌우 날개를 뒤로 펼친 V자 — 뒤 가운데는 비어 있다
  hakyik: [[0.46, 0], [0.34, 0.12], [0.34, -0.12], [0.22, 0.23], [0.22, -0.23], [0.09, 0.33], [0.09, -0.33], [-0.05, 0.42], [-0.05, -0.42], [-0.20, 0.46], [-0.20, -0.46]],
  // 어린: 비늘처럼 겹겹이 채운 넓은 쐐기
  eorin: [[0.44, 0], [0.27, 0.16], [0.27, -0.16], [0.27, 0], [0.09, 0.31], [0.09, -0.31], [0.09, 0.10], [0.09, -0.10], [-0.10, 0.43], [-0.10, -0.43], [-0.10, 0.22], [-0.10, -0.22]],
  // 봉시: 촉·살촉·자루가 다 보이는 화살
  bongsi: [[0.46, 0], [0.31, 0.13], [0.31, -0.13], [0.17, 0.25], [0.17, -0.25], [0.22, 0], [-0.01, 0], [-0.23, 0], [-0.44, 0], [-0.31, 0.15], [-0.31, -0.15]],
  // 방원: 둥글게 둘러선 방진
  bangwon: [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35], [0.25, 0.25], [0.25, -0.25], [-0.25, 0.25], [-0.25, -0.25]],
  // 언월: 뿔을 적 쪽으로 내민 초승달 — 가운데 앞이 비어 있다
  eonwol: [[0.42, 0.38], [0.42, -0.38], [0.16, 0.44], [0.16, -0.44], [-0.08, 0.36], [-0.08, -0.36], [-0.28, 0.22], [-0.28, -0.22], [-0.40, 0], [-0.40, 0.10], [-0.40, -0.10]],
  // 장사: 물결치며 길게 늘어선 뱀
  jangsa: [[0.46, 0.04], [0.46, -0.08], [0.32, 0.12], [0.32, 0.0], [0.18, 0.14], [0.18, 0.02], [0.04, 0.02], [0.04, -0.10], [-0.10, -0.10], [-0.10, -0.22], [-0.24, -0.18], [-0.38, -0.10], [-0.44, 0.02]],
  // 안행: 사선으로 늘어선 기러기 두 줄
  anhaeng: [[0.44, -0.40], [0.28, -0.26], [0.12, -0.12], [-0.04, 0.02], [-0.20, 0.16], [-0.36, 0.30], [-0.44, 0.42], [0.40, -0.28], [0.24, -0.14], [0.08, 0.0], [-0.08, 0.14], [-0.24, 0.28], [-0.40, 0.40]],
  // 구행: 옆으로 길게 돌다 앞을 거는 갈고리
  guhaeng: [[0.44, -0.32], [0.26, -0.34], [0.08, -0.32], [-0.10, -0.26], [-0.26, -0.15], [-0.36, 0.01], [-0.40, 0.21], [0.40, -0.44], [0.22, -0.45], [0.04, -0.43], [-0.14, -0.37], [-0.30, -0.26], [-0.40, -0.10]],
  // 수진: 물결 세 줄
  sujin: [[0.40, 0.30], [0.20, 0.22], [0.0, 0.30], [-0.20, 0.38], [-0.38, 0.30], [0.36, 0.0], [0.16, -0.08], [-0.04, 0.0], [-0.24, 0.08], [-0.42, 0.0], [0.40, -0.30], [0.20, -0.38], [0.0, -0.30], [-0.20, -0.22]],
  // 추행: 송곳처럼 좁고 길게 뚫는 창끝
  chuhaeng: [[0.46, 0], [0.34, 0.08], [0.34, -0.08], [0.20, 0.14], [0.20, -0.14], [0.06, 0.16], [0.06, -0.16], [-0.10, 0.18], [-0.10, -0.18], [-0.26, 0.15], [-0.26, -0.15], [-0.42, 0.11], [-0.42, -0.11]],
  // 형액: 멱을 거는 두 줄 횡대 — 가운데 고삐
  hyeongaek: [[-0.38, -0.26], [-0.19, -0.26], [0, -0.26], [0.19, -0.26], [0.38, -0.26], [-0.38, 0.26], [-0.19, 0.26], [0, 0.26], [0.19, 0.26], [0.38, 0.26]],
};

const FALLBACK = FORMATION_DOTS.eorin;

export function dotsOf(formId) {
  return FORMATION_DOTS[formId] || FALLBACK;
}

export function rotatePoint(x, y, dir) {
  const a = ((DIR_ANGLE[dir] || 0) * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

/* dir 방향으로 회전한 점 목록 (정면 = +x 기준) */
export function formationDots(formId, dir = 'E') {
  return dotsOf(formId).map(([x, y]) => rotatePoint(x, y, dir));
}

/* 정면 쪽 가장 밖의 점 — 창끝 표시용 */
export function frontTip(formId, dir = 'E') {
  const pts = formationDots(formId, dir);
  let best = { x: 0, y: 0 }, bd = -Infinity;
  const a = ((DIR_ANGLE[dir] || 0) * Math.PI) / 180;
  for (const p of pts) {
    const d = p.x * Math.cos(a) + p.y * Math.sin(a);
    if (d > bd) { bd = d; best = p; }
  }
  return best;
}

/* canvas 2D — 부대 한 칸 안의 진형 대형을 2.5D 병사 토큰으로 찍는다 */
function shadeHex(hex, amt) {
  const h = String(hex || '#888888').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v + (amt >= 0 ? (255 - v) * amt : v * amt))));
  return '#' + ((cl((n >> 16) & 255) << 16) | (cl((n >> 8) & 255) << 8) | cl(n & 255)).toString(16).padStart(6, '0');
}

export function drawFormation(ctx, formId, cx, cy, size, dir = 'E', colors = {}) {
  const body = colors.body || '#a9cdff';
  const shade = colors.shade || '#0d1720';
  const tip = colors.tip || '#e9d3a4';
  const metal = colors.metal || '#dfe6ea';
  const pts = formationDots(formId, dir);
  const r = Math.max(2, size * 0.062);
  const a = ((DIR_ANGLE[dir] || 0) * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  const tipDot = frontTip(formId, dir);
  const hi = shadeHex(body, 0.42);

  for (const p of pts) {
    const x = cx + p.x * size;
    const y = cy + p.y * size;
    // 바닥 그림자
    ctx.beginPath();
    ctx.ellipse(x + r * 0.34, y + r * 0.4, r * 1.15, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade;
    ctx.fill();
    // 몸통 — 어두운 테두리를 둘러 병사로 읽히게
    ctx.beginPath();
    ctx.arc(x, y, r * 1.16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 8, 10, 0.75)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    // 윗면 빛
    ctx.beginPath();
    ctx.arc(x - r * 0.24, y - r * 0.28, r * 0.48, 0, Math.PI * 2);
    ctx.fillStyle = hi;
    ctx.fill();
    // 창 — 정면 쪽으로
    ctx.beginPath();
    ctx.moveTo(x + ca * r * 0.9, y + sa * r * 0.9);
    ctx.lineTo(x + ca * r * 2.3, y + sa * r * 2.3);
    ctx.strokeStyle = metal;
    ctx.lineWidth = Math.max(0.5, r * 0.32);
    ctx.stroke();
    // 창끝
    ctx.beginPath();
    ctx.arc(x + ca * r * 2.5, y + sa * r * 2.5, Math.max(0.5, r * 0.22), 0, Math.PI * 2);
    ctx.fillStyle = metal;
    ctx.fill();
  }
  // 창끝(정면)은 금빛 토큰으로 한 점 더 — 어느 쪽이 정면인지 바로 보이게
  const tx = cx + tipDot.x * size;
  const ty = cy + tipDot.y * size;
  ctx.beginPath();
  ctx.arc(tx + r * 0.2, ty + r * 0.24, r * 1.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8, 6, 3, 0.5)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tx, ty, r * 1.36, 0, Math.PI * 2);
  ctx.fillStyle = tip;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tx - r * 0.3, ty - r * 0.34, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 250, 225, 0.85)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tx, ty, r * 1.36, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(20, 16, 8, 0.55)';
  ctx.lineWidth = Math.max(0.6, r * 0.26);
  ctx.stroke();
}

/* HTML 미리보기 — 작은 SVG로 같은 대형을 그린다 */
export function formationSVG(formId, dir = 'E', px = 24, opt = {}) {
  const body = opt.body || '#9cc4ee';
  const shade = opt.shade || '#0d1720';
  const tip = opt.tip || '#e9d3a4';
  const metal = opt.metal || '#dfe6ea';
  const hi = shadeHex(body, 0.45);
  const pts = formationDots(formId, dir);
  const tipDot = frontTip(formId, dir);
  const a = ((DIR_ANGLE[dir] || 0) * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  const r = 0.068;
  const dots = pts.map((p) => {
    const isTip = Math.abs(p.x - tipDot.x) < 1e-6 && Math.abs(p.y - tipDot.y) < 1e-6;
    const spear = `<line x1="${(p.x + ca * r * 0.9).toFixed(3)}" y1="${(p.y + sa * r * 0.9).toFixed(3)}"
      x2="${(p.x + ca * r * 2.2).toFixed(3)}" y2="${(p.y + sa * r * 2.2).toFixed(3)}"
      stroke="${metal}" stroke-width="${(r * 0.3).toFixed(3)}"/>`;
    if (isTip) {
      return `${spear}<circle cx="${p.x.toFixed(3)}" cy="${p.y.toFixed(3)}" r="${(r * 1.4).toFixed(3)}" fill="${tip}" stroke="rgba(20,16,8,0.55)" stroke-width="0.014"/>`;
    }
    return `${spear}<ellipse cx="${(p.x + r * 0.3).toFixed(3)}" cy="${(p.y + r * 0.36).toFixed(3)}" rx="${(r * 1.12).toFixed(3)}" ry="${(r * 0.82).toFixed(3)}" fill="${shade}"/>
      <circle cx="${p.x.toFixed(3)}" cy="${p.y.toFixed(3)}" r="${(r * 1.16).toFixed(3)}" fill="rgba(6,8,10,0.75)"/>
      <circle cx="${p.x.toFixed(3)}" cy="${p.y.toFixed(3)}" r="${r.toFixed(3)}" fill="${body}"/>
      <circle cx="${(p.x - r * 0.24).toFixed(3)}" cy="${(p.y - r * 0.28).toFixed(3)}" r="${(r * 0.46).toFixed(3)}" fill="${hi}"/>`;
  }).join('');
  return `<svg class="form-svg" width="${px}" height="${px}" viewBox="-0.55 -0.55 1.1 1.1" aria-hidden="true"><rect x="-0.55" y="-0.55" width="1.1" height="1.1" fill="#171009"/><rect x="-0.53" y="-0.53" width="1.06" height="1.06" fill="none" stroke="rgba(240,196,128,0.26)" stroke-width="0.016"/><rect x="-0.5" y="-0.5" width="1" height="0.5" fill="rgba(255,200,130,0.05)"/>${dots}</svg>`;
}
