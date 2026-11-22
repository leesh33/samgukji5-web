/* 행동 연출 — 주요 명령을 실행하면 딱 2.0초 동안 재생되고 저절로 닫힌다.
   · 스킵 버튼은 두지 않는다(사용자 요청). 2초가 지나면 스스로 사라진다.
   · 장수 초상화 + 행동별 도트 장면(캔버스) + 결과 문구·변화량·공적을 함께 보여 준다.
   · 전장·시트 위에 덮이도록 가장 높은 층(z-index 120)에 붙인다. */

export const ACTION_FX_MS = 2000;
const W = 360;
const H = 200;

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

export function sceneOf(kind) {
  return ACTION_FX_SCENES[kind] || ACTION_FX_DEFAULT;
}

/* ---------- 도트 그리기 도구 ---------- */
function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function glow(ctx, x, y, r, c) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, c);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function stage(ctx, tone) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#171009');
  g.addColorStop(0.55, '#241a10');
  g.addColorStop(1, '#0c0805');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W / 2, 26, 180, 'rgba(255,190,110,0.20)');
  glow(ctx, W / 2, H - 20, 150, `${tone}22`);
  // 달과 먼 산
  glow(ctx, 62, 44, 46, 'rgba(255,240,200,0.20)');
  ctx.fillStyle = '#f2e6c6';
  ctx.beginPath();
  ctx.arc(62, 44, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(50,36,22,0.96)';
  for (let i = 0; i < 6; i++) {
    const x = i * 70 - 20;
    ctx.beginPath();
    ctx.moveTo(x, H - 40);
    ctx.lineTo(x + 45, H - 96 - (i % 3) * 12);
    ctx.lineTo(x + 95, H - 40);
    ctx.fill();
  }
  // 바닥
  px(ctx, 0, H - 36, W, 36, 'rgba(84,58,32,0.65)');
  px(ctx, 0, H - 36, W, 2, 'rgba(168,120,68,0.5)');
  ctx.fillStyle = 'rgba(30,20,12,0.5)';
  for (let x = 0; x < W; x += 24) ctx.fillRect(x, H - 30, 12, 2);
}

/* 병사 — 작은 도트. facing: 1 오른쪽 / -1 왼쪽, s: 키 배율 */
function soldier(ctx, x, y, step, tone, facing = 1, s = 2.4) {
  const u = (v) => v * s;
  const bob = Math.sin(step * 9) > 0 ? 1 : 0;
  const leg = Math.sin(step * 9) > 0 ? 1 : -1;
  // 발밑 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(x + u(4), y + u(14.4), u(6.5), u(2), 0, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, x + u(2), y + u(10) + bob, u(2.4), u(4) + leg, '#241a10');
  px(ctx, x + u(5.4), y + u(10) + bob, u(2.4), u(4) - leg, '#241a10');
  // 몸통 — 어두운 윤곽 위에 갑옷
  px(ctx, x + u(0.6), y + u(3.2) + bob, u(7), u(7.4), '#1d140c');
  px(ctx, x + u(1), y + u(3.6) + bob, u(6.2), u(6.4), tone);
  px(ctx, x + u(1.2), y + u(4) + bob, u(5.8), u(1.2), '#f0c080');
  px(ctx, x + u(3), y + u(6.6) + bob, u(2.4), u(1.2), '#3a2a1a');
  // 머리와 투구
  px(ctx, x + u(1.6), y - u(0.4) + bob, u(4.8), u(4.6), '#1d140c');
  px(ctx, x + u(2), y + bob, u(3.8), u(3.6), '#f4d6a4');
  px(ctx, x + u(2.4), y + u(1.2) + bob, u(0.9), u(0.9), '#3a2a1a');
  px(ctx, x + u(0.8), y - u(2.8) + bob, u(6.4), u(3.2), '#6e5232');
  px(ctx, x + u(1.6), y - u(4) + bob, u(4.8), u(1.5), '#e2bd6e');
  px(ctx, x + u(2.6), y - u(6.2) + bob, u(1.8), u(2.4), '#b4463a');
  // 창
  const sx = facing > 0 ? x + u(8.6) : x - u(3.2);
  px(ctx, sx, y - u(11) + bob, Math.max(1, u(0.7)), u(24), '#d8c49a');
  px(ctx, sx - u(1), y - u(13.5) + bob, u(2.6), u(3), '#fff3d6');
  // 방패
  const hx = facing > 0 ? x - u(0.4) : x + u(6.6);
  px(ctx, hx, y + u(4.2) + bob, u(3.2), u(4.6), '#4a3622');
  px(ctx, hx + u(0.5), y + u(5) + bob, u(2.2), u(2.6), '#c9a45c');
}

function gate(ctx) {
  px(ctx, 268, H - 96, 74, 60, '#3a2b1c');
  px(ctx, 264, H - 100, 82, 8, '#5a432a');
  for (let i = 0; i < 5; i++) px(ctx, 270 + i * 15, H - 94, 4, 58, '#4a3623');
  px(ctx, 288, H - 66, 34, 30, '#0c0805');              // 성문
  px(ctx, 286, H - 68, 38, 3, '#8a6532');
  px(ctx, 300, H - 36, 3, 36, '#2a1e12');
  // 성문 양쪽 횃불
  for (const x of [282, 324]) {
    glow(ctx, x, H - 78, 18, 'rgba(255,170,80,0.45)');
    px(ctx, x - 1, H - 82, 3, 6, '#ffcf7a');
    px(ctx, x, H - 85, 1, 3, '#ffe8b0');
  }
  // 깃발
  px(ctx, 262, H - 118, 2, 22, '#8a6532');
  const wave = Math.sin(Date.now() / 180) * 2;
  ctx.fillStyle = '#b4463a';
  ctx.beginPath();
  ctx.moveTo(264, H - 118);
  ctx.lineTo(292 + wave, H - 113);
  ctx.lineTo(264, H - 106);
  ctx.fill();
}

function coin(ctx, x, y, s, t) {
  const w = Math.max(2, Math.round(Math.abs(Math.cos(t * 4 + x)) * s));
  px(ctx, x - w / 2, y, w, s, '#ffd76a');
  px(ctx, x - w / 4, y + s * 0.32, Math.max(1, w / 2), s * 0.36, '#8a5f1c');
  px(ctx, x - w / 2, y, w, 1, '#fff0b8');
}

function spark(ctx, x, y, r, color = '#ffe6a8') {
  px(ctx, x - r, y, r * 2 + 1, 1, color);
  px(ctx, x, y - r, 1, r * 2 + 1, color);
  px(ctx, x - 1, y - 1, 3, 3, '#fff8df');
}

/* ---------- 장면 ---------- */
function sceneDraft(ctx, t, p, tone) {
  // 막사 — 왼쪽에 천막 몇 채
  for (let i = 0; i < 2; i++) {
    const x = 8 + i * 66, base = H - 42, w = 58, h = 40;
    ctx.fillStyle = i ? '#5a412a' : '#6a4c2c';
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x + w / 2, base - h);
    ctx.lineTo(x + w, base);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,130,0.18)';
    ctx.beginPath();
    ctx.moveTo(x + w / 2, base - h);
    ctx.lineTo(x + w, base);
    ctx.lineTo(x + w * 0.72, base);
    ctx.fill();
    px(ctx, x + w / 2 - 1, base - h - 14, 2, 16, '#8a6532');
    px(ctx, x + w / 2 + 1, base - h - 14, 15, 9, '#a8483a');
    px(ctx, x + w / 2 - 7, base - 14, 14, 14, '#150e08');
  }
  gate(ctx);
  // 성문으로 들어가는 병사 행렬 — 뒷줄은 작고 느리게
  const k = Math.min(1, p * 1.15);
  const n = Math.round(4 + k * 6);
  for (let i = 0; i < n; i++) {
    const lane = i % 3;
    const speed = 96 - lane * 18;
    const x = -40 + ((i * 64 + t * speed) % 380);
    const y = H - 38 - lane * 26;
    soldier(ctx, x, y, t * 3 + i, i % 2 ? '#a8763e' : '#bd8c4c', 1, 2.6 - lane * 0.34);
  }
  // 흙먼지
  for (let i = 0; i < 16; i++) {
    const x = ((i * 47 + t * 40) % W);
    const y = H - 10 - ((i * 17) % 16);
    px(ctx, x, y, 2, 2, 'rgba(225,195,150,0.22)');
  }
  if (p > 0.62) glow(ctx, 306, H - 60, 46, 'rgba(255,200,120,0.22)');
}

function sceneTrain(ctx, t, p, tone) {
  // 훈련장 — 마주 선 두 병사, 창이 부딪힌다
  // 뒤쪽 울타리
  for (let x = 0; x < W; x += 18) {
    px(ctx, x, H - 92, 3, 52, '#4a3622');
    px(ctx, x + 2, H - 84, 16, 2, '#5c452c');
  }
  const cx = W / 2;
  const bob = Math.sin(t * 22) * 2;
  // 발밑 먼지
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(180,140,96,0.14)';
    ctx.beginPath();
    ctx.ellipse(cx - 64 + i * 42, H - 38, 26, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  soldier(ctx, cx - 82 - Math.abs(bob), H - 38, t * 3, '#a8763e', 1, 2.7);
  soldier(ctx, cx + 74 + Math.abs(bob), H - 38, t * 3 + 2, '#bd8c4c', -1, 2.7);
  // 두 창이 가운데서 엇갈린다
  ctx.strokeStyle = '#d8c49a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 46, H - 118 + bob);
  ctx.lineTo(cx + 28, H - 58 + bob);
  ctx.moveTo(cx + 46, H - 118 - bob);
  ctx.lineTo(cx - 28, H - 58 - bob);
  ctx.stroke();
  ctx.fillStyle = '#fff3d6';
  ctx.fillRect(cx + 25, H - 61 + bob, 5, 5);
  ctx.fillRect(cx - 30, H - 61 - bob, 5, 5);
  const beat = (t * 6) % 1;
  if (beat < 0.25) {
    spark(ctx, cx, H - 88 + bob, 4 + Math.round(beat * 18));
    glow(ctx, cx, H - 88 + bob, 30, 'rgba(255,220,150,0.55)');
  }
  // 짚 허수아비 — 훈련 표적
  px(ctx, 286, H - 96, 3, 56, '#6a4c2c');
  px(ctx, 274, H - 90, 28, 20, '#a89060');
  px(ctx, 280, H - 86, 4, 4, '#3a2a1a');
  px(ctx, 292, H - 86, 4, 4, '#3a2a1a');
  px(ctx, 266, H - 82, 44, 3, '#6a4c2c');
  // 기합 — 옅은 원이 퍼진다
  for (let i = 0; i < 3; i++) {
    const q = ((t * 0.7 + i * 0.33) % 1);
    ctx.strokeStyle = `rgba(240,225,190,${0.35 * (1 - q)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + (i - 1) * 50, H - 112 - q * 34, 5 + q * 14, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function sceneFarm(ctx, t, p, tone) {
  // 논밭 — 이랑과 벼, 흙먼지
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const y = H - 34 - r * 13;
    ctx.fillStyle = r % 2 ? 'rgba(70,52,30,0.85)' : 'rgba(58,44,26,0.85)';
    ctx.fillRect(0, y, W, 34);
    for (let i = 0; i < 16; i++) {
      const x = i * 24 + (r % 2) * 12;
      const sway = Math.sin(t * 4 + i * 0.8 + r) * 2;
      px(ctx, x + sway, y - 9, 2, 9, r < 3 ? '#8fbf5a' : '#79ab4a');
      px(ctx, x + sway - 1, y - 11, 4, 2, '#c9d86a');
      px(ctx, x + sway + 2, y - 7, 3, 1, '#a9cf5a');
    }
  }
  // 흙을 고르는 장정
  px(ctx, 262, H - 64, 8, 8, '#d8b98c');
  px(ctx, 258, H - 66, 16, 4, '#8a6a44');
  px(ctx, 260, H - 56, 12, 14, '#7e5a34');
  px(ctx, 272, H - 46 + Math.sin(t * 8) * 3, 2, 18, '#8a6532');
  px(ctx, 268, H - 30, 3, 12, '#3b2a1a');
  for (let i = 0; i < 14; i++) {
    const q = (t * 0.8 + i * 0.19) % 1;
    px(ctx, 250 + i * 9 + Math.sin(q * 6 + i) * 6, H - 30 - q * 44, 2, 2, 'rgba(205,225,150,0.5)');
  }
}

function sceneMarket(ctx, t, p, tone) {
  // 저잣거리 — 노점과 오르는 금화
  for (let i = 0; i < 3; i++) {
    const x = 26 + i * 108;
    px(ctx, x, H - 70, 76, 4, i % 2 ? '#8a4632' : '#6a5a3a');
    px(ctx, x + 4, H - 66, 4, 30, '#5a432a');
    px(ctx, x + 66, H - 66, 4, 30, '#5a432a');
    for (let k = 0; k < 4; k++) px(ctx, x + 10 + k * 15, H - 88 + (k % 2) * 5, 11, 8, k % 2 ? '#c9a45c' : '#b4463a');
  }
  for (let i = 0; i < 9; i++) {
    const q = (t * 0.55 + i * 0.13) % 1;
    const x = 40 + ((i * 67) % 280) + Math.sin(q * 5 + i) * 12;
    coin(ctx, x, H - 26 - q * 92, 6, t + i);
  }
  glow(ctx, W / 2, H - 96, 80, 'rgba(255,215,120,0.10)');
}

function sceneOrder(ctx, t, p, tone) {
  // 밤 순찰 — 등불 두 개와 성벽
  px(ctx, 0, H - 78, W, 44, '#33261a');
  for (let x = 8; x < W; x += 26) px(ctx, x, H - 78, 12, 4, '#4a3623');
  const swing = Math.sin(t * 3) * 0.25;
  const lantern = (x, y) => {
    px(ctx, x, y - 26, 2, 26, '#6a5030');
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(swing);
    px(ctx, -7, 0, 14, 18, '#c9463a');
    px(ctx, -5, 3, 10, 12, '#ffcf7a');
    px(ctx, -7, 17, 14, 2, '#6a2a20');
    ctx.restore();
    glow(ctx, x, y + 8, 42, 'rgba(255,200,110,0.20)');
  };
  lantern(92, H - 78);
  lantern(252, H - 78);
  // 순찰병
  const x = 30 + ((t * 54) % 280);
  soldier(ctx, x, H - 42, t * 2.4, '#6a7e9a', 1, 2.2);
  px(ctx, x + 8, H - 62, 1, 18, '#b9a078');
  px(ctx, x + 7, H - 64, 4, 4, '#ffcf7a');
}

function sceneWater(ctx, t, p, tone) {
  // 물길 — 둑과 차오르는 물
  px(ctx, 0, H - 54, W, 10, '#6b5436');
  px(ctx, 0, H - 44, W, 10, '#4a3a24');
  const level = 10 + p * 16;
  ctx.fillStyle = 'rgba(56,128,168,0.85)';
  ctx.fillRect(26, H - 44 - level, 308, level + 6);
  for (let i = 0; i < 7; i++) {
    const y = H - 44 - level + i * 5;
    const off = Math.sin(t * 4 + i) * 8;
    ctx.fillStyle = 'rgba(140,210,235,0.55)';
    ctx.fillRect(26 + off, y, 120, 2);
    ctx.fillRect(180 - off, y, 120, 2);
  }
  // 두레박
  px(ctx, 300, H - 92, 2, 44, '#8a6532');
  px(ctx, 292, H - 50, 18, 12, '#a98a5a');
  px(ctx, 292, H - 46, 18, 3, '#6fc0e0');
  glow(ctx, 300, H - 60, 30, 'rgba(120,200,240,0.16)');
  for (let i = 0; i < 10; i++) {
    const q = (t * 0.9 + i * 0.21) % 1;
    px(ctx, 300 + Math.sin(q * 8 + i) * 18, H - 52 - q * 20, 2, 2, 'rgba(180,230,255,0.6)');
  }
}

function sceneHire(ctx, t, p, tone) {
  // 문서 — 펼친 첩자와 절하는 장수
  const open = Math.min(1, p * 1.6);
  const w = 40 + open * 140;
  px(ctx, W / 2 - w / 2, H - 92, w, 54, '#e8dcc0');
  px(ctx, W / 2 - w / 2, H - 92, w, 3, '#b49a6a');
  if (open > 0.5) {
    px(ctx, W / 2 - w / 2 + 10, H - 82, w - 20, 2, 'rgba(60,44,28,0.7)');
    px(ctx, W / 2 - w / 2 + 10, H - 74, w - 34, 2, 'rgba(60,44,28,0.55)');
    px(ctx, W / 2 - w / 2 + 10, H - 66, w - 48, 2, 'rgba(60,44,28,0.45)');
    if (p > 0.7) {
      px(ctx, W / 2 + w / 2 - 26, H - 70, 14, 14, '#b4463a');
      px(ctx, W / 2 + w / 2 - 22, H - 66, 6, 6, '#e8dcc0');
      glow(ctx, W / 2 + w / 2 - 19, H - 63, 18, 'rgba(200,80,60,0.35)');
    }
  }
  const bx = W / 2 - 96 + Math.min(0, (p - 0.4) * 120);
  px(ctx, bx, H - 56, 8, 8, '#d8b98c');
  px(ctx, bx - 2, H - 60, 12, 4, '#8a6a44');
  px(ctx, bx - 2, H - 48, 12, 12, '#8a6a44');
  px(ctx, bx, H - 36, 8, 4, '#4a3826');
  // 인사 표시
  if (p > 0.55) {
    const a = Math.min(1, (p - 0.55) * 4);
    ctx.fillStyle = `rgba(255,230,170,${a})`;
    ctx.beginPath();
    ctx.arc(bx + 4, H - 74, 4, 0, Math.PI * 2);
    ctx.fill();
    px(ctx, bx + 1, H - 76, 2, 2, '#6a4a20');
  }
}

function sceneBanquet(ctx, t, p, tone) {
  // 친교 — 술잔을 맞대고 웃는 두 사람
  px(ctx, 0, H - 40, W, 8, '#5a432a');
  const clink = Math.min(1, p * 1.4);
  const gap = 30 - clink * 14;
  const cup = (x, flip) => {
    px(ctx, x - 5, H - 62, 10, 12, '#c9a45c');
    px(ctx, x - 4, H - 60, 8, 4, '#f2e0b0');
    px(ctx, x - 1, H - 50, 2, 6, '#8a6532');
    px(ctx, x - 5, H - 44, 10, 2, '#8a6532');
  };
  cup(W / 2 - gap, 0);
  cup(W / 2 + gap, 1);
  px(ctx, W / 2 - gap - 30, H - 62, 7, 7, '#d8b98c');
  px(ctx, W / 2 - gap - 28, H - 55, 10, 14, '#b4463a');
  px(ctx, W / 2 + gap + 24, H - 62, 7, 7, '#d8b98c');
  px(ctx, W / 2 + gap + 23, H - 55, 10, 14, '#6a5a8a');
  if (clink >= 1) {
    spark(ctx, W / 2, H - 62, 3 + Math.round((t * 5) % 5), '#ffe6b0');
    glow(ctx, W / 2, H - 62, 26, 'rgba(255,220,150,0.28)');
  }
  for (let i = 0; i < 8; i++) {
    const q = (t * 0.7 + i * 0.16) % 1;
    px(ctx, W / 2 - 40 + i * 11, H - 70 - q * 30, 2, 2, 'rgba(255,220,170,0.45)');
  }
}

function sceneReward(ctx, t, p, tone) {
  // 포상 — 금괴가 쏟아지는 보따리
  px(ctx, W / 2 - 34, H - 64, 68, 28, '#8a5a32');
  px(ctx, W / 2 - 34, H - 64, 68, 6, '#c9a45c');
  const open = Math.min(1, p * 2);
  px(ctx, W / 2 - 28, H - 68 - open * 8, 56, 8, '#a8763e');
  for (let i = 0; i < 10; i++) {
    const q = (t * 0.6 + i * 0.11) % 1;
    const y = H - 58 - q * 74;
    const x = W / 2 - 46 + ((i * 37) % 92);
    coin(ctx, x, y, 6, t + i * 0.4);
  }
  glow(ctx, W / 2, H - 70, 70, 'rgba(255,210,120,0.16)');
}

function sceneLearn(ctx, t, p, tone) {
  // 진형 전수 — 점들이 학익 대형으로 늘어선다
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3), col = i % 3;
    pts.push({ gx: 60 + col * 30, gy: H - 50 - row * 24 });
    pts.push({ gx: W / 2 + (col - 1) * 52, gy: H - 48 - row * 26 - (col === 1 ? 18 : 0) });
  }
  pts.forEach((q, i) => {
    const k = Math.min(1, Math.max(0, p * 1.5 - (i % 6) * 0.09));
    const x = q.gx + (i % 2 ? 0 : (1 - k) * -40);
    const y = q.gy + (1 - k) * 26;
    px(ctx, x - 2, y - 2, 4, 4, i % 2 ? '#c9a45c' : '#9cd0a8');
    if (k > 0.7) px(ctx, x - 4, y - 1, 8, 2, 'rgba(255,230,170,0.25)');
  });
  // 스승과 제자
  px(ctx, W / 2 - 120, H - 62, 8, 8, '#d8b98c');
  px(ctx, W / 2 - 122, H - 64, 12, 4, '#8a6a44');
  px(ctx, W / 2 - 122, H - 54, 12, 16, '#6a7e5a');
  px(ctx, W / 2 + 112, H - 62, 8, 8, '#d8b98c');
  px(ctx, W / 2 + 110, H - 64, 12, 4, '#8a6a44');
  px(ctx, W / 2 + 110, H - 54, 12, 16, '#7e5a34');
  if (p > 0.60) glow(ctx, W / 2, H - 66, 80, 'rgba(160,220,170,0.12)');
}

function scenePlot(ctx, t, p, tone) {
  // 계략 — 밤안개와 엿보는 눈
  for (let i = 0; i < 8; i++) {
    const x = ((i * 61 + t * 26) % (W + 80)) - 40;
    const y = H - 60 - (i % 4) * 16;
    ctx.fillStyle = `rgba(120,96,150,${0.10 + (i % 3) * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 42, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const ex = W / 2, ey = H - 84;
  px(ctx, ex - 34, ey - 2, 68, 18, '#1a1420');
  ctx.fillStyle = '#c9a45c';
  ctx.beginPath();
  ctx.ellipse(ex, ey + 7, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#241a10';
  ctx.beginPath();
  ctx.arc(ex, ey + 7, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c15a';
  ctx.beginPath();
  ctx.arc(ex + 2, ey + 5, 3, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, ex, ey + 7, 46, `rgba(200,170,255,${0.10 + Math.abs(Math.sin(t * 3)) * 0.10})`);
  // 두루마리
  px(ctx, 42, H - 58, 46, 8, '#e8dcc0');
  px(ctx, 42, H - 50, 46, 4, '#b49a6a');
}

function scenePromote(ctx, t, p, tone) {
  // 장군 임명 — 깃발이 솟고 금빛이 터진다
  const rise = Math.min(1, p * 1.4);
  const top = H - 36 - rise * 96;
  px(ctx, W / 2 - 2, top, 4, H - 36 - top, '#8a6532');
  const wave = Math.sin(t * 5) * 4;
  ctx.fillStyle = '#b4463a';
  ctx.beginPath();
  ctx.moveTo(W / 2 + 2, top + 4);
  ctx.lineTo(W / 2 + 62 + wave, top + 14);
  ctx.lineTo(W / 2 + 56 + wave, top + 40);
  ctx.lineTo(W / 2 + 2, top + 36);
  ctx.fill();
  px(ctx, W / 2 + 18, top + 14, 20, 3, 'rgba(255,230,170,0.75)');
  px(ctx, W / 2 + 18, top + 22, 14, 3, 'rgba(255,230,170,0.6)');
  // 금빛 광선
  ctx.save();
  ctx.translate(W / 2, top + 20);
  ctx.rotate(t * 0.7);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.fillStyle = `rgba(255,215,140,${0.06 + 0.05 * Math.sin(t * 4 + i)})`;
    ctx.fillRect(0, -2, 90 * rise, 4);
  }
  ctx.restore();
  // 절하는 장수
  px(ctx, W / 2 - 96, H - 54, 9, 9, '#d8b98c');
  px(ctx, W / 2 - 98, H - 58, 13, 5, '#c9a45c');
  px(ctx, W / 2 - 98, H - 45, 13, 16, '#8a3a2c');
  px(ctx, W / 2 - 96, H - 29, 10, 3, '#3b2a1a');
  if (p > 0.55) {
    for (let i = 0; i < 14; i++) {
      const a = i * 1.7 + t * 2;
      const r = 20 + ((t * 60 + i * 17) % 70);
      px(ctx, W / 2 + Math.cos(a) * r, top + 24 + Math.sin(a) * r * 0.5, 2, 2, 'rgba(255,225,160,0.8)');
    }
  }
}

const SCENES = {
  draft: sceneDraft,
  train: sceneTrain,
  agri: sceneFarm,
  comm: sceneMarket,
  order: sceneOrder,
  water: sceneWater,
  hire: sceneHire,
  befriend: sceneBanquet,
  reward: sceneReward,
  learn: sceneLearn,
  plot: scenePlot,
  promote: scenePromote,
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
    .afx-canvas { display: block; width: 100%; height: 190px; image-rendering: pixelated; background: #120c07; }
    .afx.rank .afx-canvas { height: 210px; }
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
  if (current) { clearTimeout(current.timer); clearInterval(current.raf); current.el.remove(); current = null; }
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
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const t0 = performance.now();
  const draw = (now) => {
    if (!current || current.el !== el) return;
    const t = Math.min(1, (now - t0) / ACTION_FX_MS); // 0~1
    const sec = (now - t0) / 1000;
    stage(ctx, tone);
    const scene = SCENES[kind] || sceneReward;
    scene(ctx, sec, t, tone);
    // 마무리 섬광
    if (t > 0.86) {
      const a = Math.sin((t - 0.86) / 0.14 * Math.PI) * 0.16;
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
