/* 도트 초상화 생성기 — 장수 id로부터 결정론적 픽셀 아트 */
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

const SKINS = ['#e8c39a', '#dcb184', '#c99a6e', '#b98a5f'];

export function portraitCanvas(gid, general, size = 40, factionColor = '#2b3550') {
  const key = `${gid}|${size}|${factionColor}`;
  if (cache.has(key)) return cache.get(key);
  const P = 24;
  const c = document.createElement('canvas');
  c.width = P; c.height = P;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const seed = hash(gid || 'x');
  const r = (i) => rnd(seed % 9973, i);

  // 배경 (세력색 계열 그라데이션)
  const bg = factionColor || '#2b3550';
  ctx.fillStyle = shade(bg, -55);
  ctx.fillRect(0, 0, P, P);
  ctx.fillStyle = shade(bg, -35);
  ctx.fillRect(0, 0, P, 8);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = shade(bg, r(i) > 0.5 ? -20 : -8);
    ctx.fillRect(Math.floor(r(i + 30) * P), Math.floor(r(i + 60) * P), 1, 1);
  }

  const skin = SKINS[Math.floor(r(1) * SKINS.length)];
  const armor = shade(bg, 25);
  const armorDark = shade(bg, -10);
  const trim = '#c8a24a';

  // 어깨 갑옷
  ctx.fillStyle = armorDark;
  ctx.fillRect(4, 19, 16, 5);
  ctx.fillStyle = armor;
  ctx.fillRect(5, 18, 14, 4);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = trim;
    ctx.fillRect(5 + i * 2, 18, 1, 1);
  }
  ctx.fillStyle = armorDark;
  ctx.fillRect(11, 16, 3, 3);

  // 얼굴
  ctx.fillStyle = skin;
  ctx.fillRect(7, 6, 10, 11);
  ctx.fillRect(6, 8, 1, 7);
  ctx.fillRect(17, 8, 1, 7);
  // 볼 음영
  ctx.fillStyle = shade(skin, -18);
  ctx.fillRect(6, 13, 2, 3);
  ctx.fillRect(16, 13, 2, 3);
  // 귀
  ctx.fillStyle = shade(skin, -10);
  ctx.fillRect(5, 10, 1, 3);
  ctx.fillRect(18, 10, 1, 3);

  // 눈썹
  ctx.fillStyle = '#241a12';
  ctx.fillRect(8, 10, 3, 1);
  ctx.fillRect(13, 10, 3, 1);
  // 눈
  ctx.fillStyle = '#101820';
  ctx.fillRect(9, 11, 2, 2);
  ctx.fillRect(14, 11, 2, 2);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(9, 11, 1, 1);
  ctx.fillRect(14, 11, 1, 1);
  // 코
  ctx.fillStyle = shade(skin, -22);
  ctx.fillRect(12, 12, 1, 3);
  // 입
  ctx.fillStyle = shade(skin, -45);
  ctx.fillRect(10, 16, 4, 1);

  // 수염 (무력/지력에 따라)
  const war = general ? general.war : 60;
  const lead = general ? general.lead : 60;
  if (r(4) < 0.55 || war > 82) {
    ctx.fillStyle = '#1b1410';
    if (r(5) < 0.4) {
      ctx.fillRect(9, 17, 6, 1);
      ctx.fillRect(10, 18, 4, 2);
      ctx.fillRect(11, 20, 2, 1);
    } else if (r(6) < 0.6) {
      ctx.fillRect(11, 17, 2, 3);
    } else {
      ctx.fillRect(8, 16, 3, 1);
      ctx.fillRect(13, 16, 3, 1);
      ctx.fillRect(9, 17, 6, 2);
      ctx.fillRect(10, 19, 4, 2);
    }
  }

  // 모자·투구
  const hatType = Math.floor(r(8) * 5);
  // 얼굴형 변형(턱)
  if (r(11) < 0.45) { ctx.fillStyle = skin; ctx.fillRect(8, 17, 8, 1); }
  // 눈매 — 무력이 높으면 치켜뜬 눈썹
  if (war >= 85) {
    ctx.fillStyle = '#241a12';
    ctx.fillRect(8, 9, 3, 1);
    ctx.fillRect(13, 9, 3, 1);
    ctx.fillStyle = skin;
    ctx.fillRect(8, 10, 1, 1);
    ctx.fillStyle = '#241a12';
    ctx.fillRect(7, 9, 1, 1);
    ctx.fillRect(16, 9, 1, 1);
  }
  // 점·흉터
  if (r(12) < 0.3) { ctx.fillStyle = shade(skin, -35); ctx.fillRect(9, 14, 1, 1); }
  if (r(13) < 0.18) { ctx.fillStyle = '#8a4a3a'; ctx.fillRect(14, 12, 1, 3); }
  if (hatType === 0 || lead > 88) {
    // 투구
    ctx.fillStyle = '#3c4356';
    ctx.fillRect(6, 3, 12, 4);
    ctx.fillRect(7, 2, 10, 1);
    ctx.fillStyle = trim;
    ctx.fillRect(6, 6, 12, 1);
    ctx.fillRect(11, 0, 2, 3);
    ctx.fillStyle = shade('#3c4356', 20);
    ctx.fillRect(8, 3, 3, 1);
  } else if (hatType === 1) {
    // 관모
    ctx.fillStyle = '#20232e';
    ctx.fillRect(7, 2, 10, 4);
    ctx.fillStyle = trim;
    ctx.fillRect(7, 5, 10, 1);
    ctx.fillRect(11, 0, 2, 2);
  } else if (hatType === 2) {
    // 두건
    ctx.fillStyle = '#4a2c2c';
    ctx.fillRect(6, 4, 12, 3);
    ctx.fillStyle = '#6a3c3c';
    ctx.fillRect(7, 3, 10, 1);
    ctx.fillRect(18, 5, 2, 4);
  } else if (hatType === 3) {
    // 맨머리 + 상투
    ctx.fillStyle = '#1a1612';
    ctx.fillRect(6, 4, 12, 3);
    ctx.fillRect(5, 6, 1, 5);
    ctx.fillRect(18, 6, 1, 5);
    ctx.fillRect(10, 1, 4, 3);
    ctx.fillStyle = trim;
    ctx.fillRect(10, 3, 4, 1);
  } else {
    // 전립(투구) — 깃장식
    ctx.fillStyle = '#3a3226';
    ctx.fillRect(6, 3, 12, 4);
    ctx.fillStyle = trim;
    ctx.fillRect(6, 6, 12, 1);
    ctx.fillStyle = '#b8382f';
    ctx.fillRect(15, 0, 3, 3);
    ctx.fillStyle = '#e0d5b3';
    ctx.fillRect(16, 0, 1, 1);
  }
  // 머리카락 옆
  ctx.fillStyle = '#1a1612';
  ctx.fillRect(6, 7, 1, 3);
  ctx.fillRect(17, 7, 1, 3);

  // 액자 테두리
  ctx.strokeStyle = trim;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, P - 1, P - 1);

  // 확대
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(c, 0, 0, size, size);
  cache.set(key, out);
  return out;
}

export function portraitURL(gid, general, size = 64, color = '#2b3550') {
  return portraitCanvas(gid, general, size, color).toDataURL('image/png');
}

function shade(hex, amt) {
  if (!hex) return '#223';
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
