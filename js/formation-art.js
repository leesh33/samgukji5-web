/* 진형 도트 대형 — 학익·어린·봉시·방원… 각 진형의 실제 대형을 픽셀 병사로 그린다.
   좌표계: 정면 = +x(동쪽). 각 점은 [-0.5, 0.5] 정사각 안에 들어간다.
   바라보는 방향(dir: N/E/S/W)에 맞춰 회전시켜 전장과 미리보기에 함께 쓴다. */

export const DIR_ANGLE = { E: 0, S: 90, W: 180, N: 270 }; // 화면 기준 시계방향(도)
export const DIR_KO = { E: '동', S: '남', W: '서', N: '북' };

/* 진형별 병사 배치 — 앞(+x)이 정면 */
export const FORMATION_DOTS = {
  // 학익(鶴翼): 정면 한 점에서 좌우 날개를 뒤로 펼친 V자 — 뒤 가운데는 비어 있다
  hakyik: [[0.46, 0], [0.34, 0.12], [0.34, -0.12], [0.22, 0.23], [0.22, -0.23], [0.09, 0.33], [0.09, -0.33], [-0.05, 0.42], [-0.05, -0.42], [-0.20, 0.46], [-0.20, -0.46]],
  // 어린(魚鱗): 비늘처럼 겹겹이 채운 넓은 쐐기
  eorin: [[0.44, 0], [0.27, 0.16], [0.27, -0.16], [0.27, 0], [0.09, 0.31], [0.09, -0.31], [0.09, 0.10], [0.09, -0.10], [-0.10, 0.43], [-0.10, -0.43], [-0.10, 0.22], [-0.10, -0.22]],
  // 봉시(鋒矢): 촉·살촉·자루가 다 보이는 화살
  bongsi: [[0.46, 0], [0.31, 0.13], [0.31, -0.13], [0.17, 0.25], [0.17, -0.25], [0.22, 0], [-0.01, 0], [-0.23, 0], [-0.44, 0], [-0.31, 0.15], [-0.31, -0.15]],
  // 방원(方円): 둥글게 둘러선 방진
  bangwon: [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35], [0.25, 0.25], [0.25, -0.25], [-0.25, 0.25], [-0.25, -0.25]],
  // 언월(偃月): 뿔을 적 쪽으로 내민 초승달 — 가운데 앞이 비어 있다
  eonwol: [[0.42, 0.38], [0.42, -0.38], [0.16, 0.44], [0.16, -0.44], [-0.08, 0.36], [-0.08, -0.36], [-0.28, 0.22], [-0.28, -0.22], [-0.40, 0], [-0.40, 0.10], [-0.40, -0.10]],
  // 장사(長蛇): 물결치며 길게 늘어선 뱀
  jangsa: [[0.46, 0.04], [0.46, -0.08], [0.32, 0.12], [0.32, 0.0], [0.18, 0.14], [0.18, 0.02], [0.04, 0.02], [0.04, -0.10], [-0.10, -0.10], [-0.10, -0.22], [-0.24, -0.18], [-0.38, -0.10], [-0.44, 0.02]],
  // 안행(雁行): 사선으로 늘어선 기러기 두 줄
  anhaeng: [[0.44, -0.40], [0.28, -0.26], [0.12, -0.12], [-0.04, 0.02], [-0.20, 0.16], [-0.36, 0.30], [-0.44, 0.42], [0.40, -0.28], [0.24, -0.14], [0.08, 0.0], [-0.08, 0.14], [-0.24, 0.28], [-0.40, 0.40]],
  // 구행(鉤行): 옆으로 길게 돌다 앞을 거는 갈고리
  guhaeng: [[0.44, -0.32], [0.26, -0.34], [0.08, -0.32], [-0.10, -0.26], [-0.26, -0.15], [-0.36, 0.01], [-0.40, 0.21], [0.40, -0.44], [0.22, -0.45], [0.04, -0.43], [-0.14, -0.37], [-0.30, -0.26], [-0.40, -0.10]],
  // 수진(水陣): 물결 세 줄
  sujin: [[0.40, 0.30], [0.20, 0.22], [0.0, 0.30], [-0.20, 0.38], [-0.38, 0.30], [0.36, 0.0], [0.16, -0.08], [-0.04, 0.0], [-0.24, 0.08], [-0.42, 0.0], [0.40, -0.30], [0.20, -0.38], [0.0, -0.30], [-0.20, -0.22]],
  // 추행(錐行): 송곳처럼 좁고 길게 뚫는 창끝
  chuhaeng: [[0.46, 0], [0.34, 0.08], [0.34, -0.08], [0.20, 0.14], [0.20, -0.14], [0.06, 0.16], [0.06, -0.16], [-0.10, 0.18], [-0.10, -0.18], [-0.26, 0.15], [-0.26, -0.15], [-0.42, 0.11], [-0.42, -0.11]],
  // 형액(衡軛): 멱을 거는 두 줄 횡대 — 가운데 고삐
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

/* canvas 2D — 부대 한 칸 안의 진형 대형을 픽셀 병사로 찍는다 */
export function drawFormation(ctx, formId, cx, cy, size, dir = 'E', colors = {}) {
  const body = colors.body || '#a9cdff';
  const shade = colors.shade || '#12283d';
  const tip = colors.tip || '#ffe066';
  const pts = formationDots(formId, dir);
  const px = Math.max(2, Math.round(size * 0.13));
  const tipDot = frontTip(formId, dir);
  for (const p of pts) {
    const x = Math.round(cx + p.x * size);
    const y = Math.round(cy + p.y * size);
    ctx.fillStyle = shade;
    ctx.fillRect(x - px / 2 + 1, y - px / 2 + 1, px, px);
    ctx.fillStyle = body;
    ctx.fillRect(x - px / 2, y - px / 2, px, px);
  }
  // 창끝(정면)은 밝은 색으로 한 점 더
  const tx = Math.round(cx + tipDot.x * size);
  const ty = Math.round(cy + tipDot.y * size);
  ctx.fillStyle = tip;
  ctx.fillRect(tx - px / 2, ty - px / 2, px, px);
}

/* HTML 미리보기 — 작은 SVG로 같은 대형을 그린다 */
export function formationSVG(formId, dir = 'E', px = 24, opt = {}) {
  const body = opt.body || '#9cc4ee';
  const shade = opt.shade || '#1b2c3f';
  const tip = opt.tip || '#ffe066';
  const pts = formationDots(formId, dir);
  const tipDot = frontTip(formId, dir);
  const d = 0.2;
  const rects = pts.map((p) => {
    const isTip = Math.abs(p.x - tipDot.x) < 1e-6 && Math.abs(p.y - tipDot.y) < 1e-6;
    return `<rect x="${(p.x - d / 2).toFixed(3)}" y="${(p.y - d / 2).toFixed(3)}" width="${d}" height="${d}" fill="${isTip ? tip : body}"/>`;
  }).join('');
  return `<svg class="form-svg" width="${px}" height="${px}" viewBox="-0.55 -0.55 1.1 1.1" aria-hidden="true" shape-rendering="crispEdges"><rect x="-0.55" y="-0.55" width="1.1" height="1.1" fill="${shade}" opacity="0.55"/>${rects}</svg>`;
}
