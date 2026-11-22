/* 장수 초상화 — 하이엔드 보드게임풍 벡터 실루엣 초상화
   장수 id로부터 결정론적으로 생성한다(골드 림라이트 + 투구·관모·수염·세력색 배경).
   canvas 대신 SVG 데이터 URI를 돌려주므로 어떤 크기에서도 매끄럽게 확대된다. */

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

const GOLD = '#c9a45c';
const GOLD_HI = '#e8cf9f';

/* 얼굴 빛(피부) 4단 — 실루엣 위에 은은한 면 빛으로만 쓴다 */
const SKIN_GLOW = ['#f0d3ae', '#e2bd92', '#cfa276', '#b78a63'];

const clampIdx = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(Number(v) || 0)));

function shade(hex, amt) {
  const h = String(hex || '#6b6b6b').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* 몸통·머리 실루엣 (오른쪽을 바라보는 옆얼굴) */
const HEAD = 'M33,52 C32,34 42,21 55,21 C64,21 69.4,27 69.8,35.6 C70,39.4 69.2,41.4 68.8,43 C68.5,44.2 69,45 69.6,45.6 C71.4,47 74.4,49.4 74.9,52 C75.3,53.9 73.9,54.9 72.2,55.1 C70.5,55.3 69.4,55.2 68.7,55.9 C68.1,56.4 68.7,57.3 69.9,57.9 C71.1,58.5 71.3,59.3 70.5,60 C69.7,60.7 70.7,61.5 70.9,62.7 C71.1,64.5 70.3,66.7 68.5,68.3 C66.5,70.1 63.7,71.1 60.7,71.5 C58.4,71.8 57.2,74.2 57,77 C56.8,80.6 57.6,85 59,88 L59,96 L36,96 C35.4,87 34.4,79 34.4,71 C34,64 33.4,58 33,52 Z';

/* 앞쪽 윤곽 — 여기에 금빛 림라이트를 준다 */
const RIM = 'M69.8,35.6 C70,39.4 69.2,41.4 68.8,43 C68.5,44.2 69,45 69.6,45.6 C71.4,47 74.4,49.4 74.9,52 C75.3,53.9 73.9,54.9 72.2,55.1 C70.5,55.3 69.4,55.2 68.7,55.9 C68.1,56.4 68.7,57.3 69.9,57.9 C71.1,58.5 71.3,59.3 70.5,60 C69.7,60.7 70.7,61.5 70.9,62.7 C71.1,64.5 70.3,66.7 68.5,68.3 C66.5,70.1 63.7,71.1 60.7,71.5';

/* 어깨·갑옷 */
const TORSO = 'M14,120 L18,108 C22,99 30,94.4 39,93.4 L63,93.4 C73,94.4 81,99 85,109 L88,120 Z';
const PAULDRON = 'M57,93.4 C66,93.4 74.4,97 79,105 L81.4,113 L60.4,113 C59,105 58.2,98 57,93.4 Z';
const PAULDRON_BACK = 'M39,93.4 C31,94 24,98 20.4,105 L17,113 L38,113 C37.4,105.4 38,98.4 39,93.4 Z';

function hatArt(hat, hair, accent) {
  switch (hat) {
    case 1: // 관모 — 높은 관과 뒤로 뻗은 날개
      return {
        back: `<path d="M37.6,30.4 L25.6,26.6 L25,31.6 L37.4,35.2 Z" fill="${hair}" opacity="0.95"/>`,
        front: `<path d="M38.4,35.6 C38,25.4 45.6,17.6 55,17.6 C63.4,17.6 68.2,23 68.4,30.6 L68.6,36.2 Z" fill="#1b1f26"/>
          <path d="M38.4,33.4 L68.5,33.4 L68.6,36.4 L38.4,36.4 Z" fill="${GOLD}" opacity="0.55"/>
          <path d="M41,22.4 C45,18.4 51,16.6 56,16.8 C62,17 66,20.4 67,25.2 L66,26.6 C64.4,22 60,19.8 55,19.6 C49,19.4 44,21.8 41.6,25.6 Z" fill="${GOLD}" opacity="0.22"/>`,
      };
    case 2: // 두건 — 이마를 두른 천과 뒤로 늘어진 자락
      return {
        back: `<path d="M35.4,32.4 C30,38 28.6,47.6 29.8,57.4 L33.2,56.6 C32.6,47.6 33.4,39.6 37,34.4 Z" fill="${hair}"/>`,
        front: `<path d="M35.2,38.6 C34.2,26.6 43,18 55,18 C64.6,18 70.2,24 70.4,33.4 L69.8,36.6 C62.4,30.4 46,30.4 36.6,40.4 Z" fill="#251e24"/>
          <path d="M36.8,37.6 C46,29.4 62.4,29.6 69.6,35.8" fill="none" stroke="#3b2f36" stroke-width="1"/>
          <path d="M38.6,33.4 C47,26.4 62,26.6 68.6,32.4" fill="none" stroke="${GOLD}" stroke-width="0.7" opacity="0.28"/>`,
      };
    case 3: // 상투 — 머리를 올려 묶고 금비녀
      return {
        back: `<ellipse cx="52.4" cy="13.6" rx="5.6" ry="5.2" fill="${hair}"/>
          <path d="M47.4,14.6 L57.6,12.4" stroke="${GOLD}" stroke-width="1" stroke-linecap="round" opacity="0.85"/>`,
        front: `<path d="M33.4,48 C32.2,32 42,20 55,20 C64.2,20 69.4,26 69.8,34.8 L69,37.6 C62,30 44,30.4 35.4,42.6 Z" fill="${hair}"/>
          <path d="M36,30.6 C43,24.6 54,23.4 62.4,26.4" fill="none" stroke="#2a2b31" stroke-width="1.6" opacity="0.8"/>`,
      };
    case 4: // 전립 — 넓은 챙과 꼭지
      return {
        back: ``,
        front: `<path d="M46.2,31.6 C46,21.6 50.6,16.4 55.4,16.4 C60,16.4 62.6,22.2 62.4,31.6 Z" fill="#232830"/>
          <path d="M31.4,32 C38,29 47,27.6 55,27.6 C63,27.6 71,29 76.6,32 C71,35.2 63,36.4 55,36.4 C47,36.4 38,35 31.4,32 Z" fill="#1d222a"/>
          <path d="M31.4,32 C38,35 47,36.4 55,36.4 C63,36.4 71,35.2 76.6,32" fill="none" stroke="${GOLD}" stroke-width="0.7" opacity="0.45"/>
          <path d="M55.4,16.4 L55.4,11.6" stroke="${GOLD}" stroke-width="1.1"/>
          <path d="M55.6,11.4 C57.4,7.6 60.4,5.4 63.6,4.6 C61.4,8 60.2,11 60.2,13.4 Z" fill="${accent}" opacity="0.9"/>`,
      };
    default: // 투구 — 보호덮개와 깃장식
      return {
        back: `<path d="M34.6,36 C33,46 33.6,58 36,68 L39.4,67 C37.4,56 37,46 38,36 Z" fill="${hair}"/>`,
        front: `<path d="M34,41 C33,25.4 43.6,16.4 56,16.4 C66.4,16.4 72.2,23 72.6,33.6 L71.6,38.4 C70.6,29.4 64.4,22.6 55.6,22.2 C45,21.8 37.6,29.6 37,42 Z" fill="#2a2f37"/>
          <path d="M34.6,40.4 C44.6,34.4 64,33.6 72.2,36.6 L71.8,41 C62,37.8 45.4,38.6 35.4,44.4 Z" fill="${GOLD}" opacity="0.42"/>
          <path d="M66.6,42.4 L70.4,54.6 L64,53.2 Z" fill="#232830" opacity="0.95"/>
          <path d="M52.6,16.8 C50.6,10.2 52.6,5 57,2 C55.4,7 55.6,11.6 57.4,16.6 Z" fill="${accent}" opacity="0.85"/>
          <path d="M38.6,26.4 C42.6,21.6 49,19 55.4,19.2" fill="none" stroke="${GOLD_HI}" stroke-width="0.8" opacity="0.35"/>`,
      };
  }
}

function beardArt(beard, hair) {
  switch (beard) {
    case 1: // 짧은 수염 — 콧수염과 짧은 턱수염
      return `<path d="M66.2,55.9 C68.4,55.6 70.6,56.5 71.4,58.1 C70,58.9 67.6,58.7 66.2,57.9 Z" fill="${hair}"/>
        <path d="M65.6,66.4 C68,67.6 68.8,70.4 67.4,73.2 C66,76 63.4,77 61.6,76.2 C63.6,73.8 64.6,70.4 63.8,67.4 Z" fill="${hair}"/>`;
    case 2: // 구레나룻 — 턱선을 따라 흐르는 수염
      return `<path d="M48.4,45.4 C55,46.4 61.6,52.4 63.6,60.4 C65.4,67.6 64.2,71.6 62.4,73 C63.6,68 62.8,61.6 59.6,56.6 C56.6,52 52.2,48.6 47,47 Z" fill="${hair}" opacity="0.95"/>
        <path d="M66.2,56.2 C68.6,55.8 70.8,56.8 71.6,58.4 C70,59.2 67.6,59 66.2,58.2 Z" fill="${hair}"/>`;
    case 3: // 장수염 — 가슴까지 흐르는 긴 수염
      return `<path d="M66,55.8 C68.4,55.4 70.8,56.4 71.6,58.2 C69.8,59.4 67.2,59.2 65.8,58.2 Z" fill="${hair}"/>
        <path d="M64.6,66.6 C68.4,67.4 70.6,71 69.4,76.6 C68.4,81.6 64.6,89.6 60.6,94.4 C59,96.2 56.6,96.2 55.8,94.6 C58.4,90 60.6,83.4 61.2,77.6 C61.8,72.6 61.4,69 60.2,67.2 Z" fill="${hair}"/>
        <path d="M63.4,74.4 C65.4,78 65,84 63,88.6" fill="none" stroke="#000" stroke-width="0.5" opacity="0.35"/>`;
    default:
      return '';
  }
}

function browArt(war, seed) {
  const steep = war >= 85 || rnd(seed, 21) > 0.72;
  return steep
    ? `<path d="M60.8,40.6 C63.2,39 66.2,39.4 68,40.8" fill="none" stroke="#0a0b0d" stroke-width="1.5" stroke-linecap="round"/>`
    : `<path d="M61.4,41.2 C63.6,40.2 66.2,40.4 67.8,41.4" fill="none" stroke="#0a0b0d" stroke-width="1.3" stroke-linecap="round"/>`;
}

export function portraitSVG(gid, general, size = 64, factionColor = '#2b3550', style = null) {
  const st = style || (general && general.style) || null;
  const key = `${gid}|${size}|${factionColor}|${st ? `${st.hat}-${st.beard}-${st.skin}` : '-'}`;
  if (cache.has(key)) return cache.get(key);
  const seed = hash(gid || 'x');
  const r = (i) => rnd(seed % 9973, i);
  const war = general && general.war != null ? general.war : 60;
  const lead = general && general.lead != null ? general.lead : 60;

  const fac = factionColor || '#2b3550';
  const accent = shade(fac, 18);
  const hat = st && st.hat != null ? clampIdx(st.hat, 5) : (lead > 88 ? 0 : Math.floor(r(8) * 5));
  const beardId = st && st.beard != null ? clampIdx(st.beard, 4) : (r(4) < 0.18 ? 0 : r(5) < 0.5 ? 1 : r(6) < 0.55 ? 2 : 3);
  const skin = SKIN_GLOW[st && st.skin != null ? clampIdx(st.skin, 4) : Math.floor(r(1) * 4)];
  const hair = r(9) < 0.5 ? '#141519' : '#1a1713';
  const scar = r(12) < 0.22;
  const tilt = (r(31) * 5.2 - 2.6).toFixed(2);
  const hatArtParts = hatArt(hat, hair, accent);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.25" y2="1">
<stop offset="0" stop-color="#1a1f25"/><stop offset="0.55" stop-color="#12161b"/><stop offset="1" stop-color="#0b0e12"/>
</linearGradient>
<radialGradient id="glow" cx="0.6" cy="0.28" r="0.62">
<stop offset="0" stop-color="${accent}" stop-opacity="0.45"/><stop offset="0.5" stop-color="${shade(fac, -20)}" stop-opacity="0.24"/><stop offset="1" stop-color="#000000" stop-opacity="0"/>
</radialGradient>
<linearGradient id="face" x1="1" y1="0.1" x2="0.1" y2="0.95">
<stop offset="0" stop-color="${skin}" stop-opacity="0.58"/><stop offset="0.42" stop-color="${skin}" stop-opacity="0.24"/><stop offset="0.78" stop-color="${skin}" stop-opacity="0.06"/><stop offset="1" stop-color="${skin}" stop-opacity="0"/>
</linearGradient>
<linearGradient id="rim" x1="0.5" y1="0" x2="0.9" y2="1">
<stop offset="0" stop-color="${GOLD_HI}"/><stop offset="0.45" stop-color="${GOLD}"/><stop offset="1" stop-color="${shade(GOLD, -40)}"/>
</linearGradient>
<linearGradient id="steel" x1="0" y1="0" x2="0.6" y2="1">
<stop offset="0" stop-color="#333941"/><stop offset="0.5" stop-color="#1f242b"/><stop offset="1" stop-color="#12161b"/>
</linearGradient>
<linearGradient id="body" x1="0" y1="0" x2="0.3" y2="1">
<stop offset="0" stop-color="#1b1f25"/><stop offset="1" stop-color="#0a0d10"/>
</linearGradient>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.5"/></filter>
<filter id="soft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0.7"/></filter>
<clipPath id="frm"><rect x="2.6" y="2.6" width="94.8" height="94.8"/></clipPath>
</defs>
<g clip-path="url(#frm)">
<rect x="0" y="0" width="100" height="100" fill="url(#bg)"/>
<rect x="0" y="0" width="100" height="100" fill="url(#glow)"/>
<g stroke="${GOLD}" stroke-width="0.4" fill="none" opacity="0.12">
<path d="M-4,18 C16,14 32,22 48,17 C64,12 80,18 104,12"/>
<path d="M-4,25 C18,21 34,29 50,24 C66,19 82,25 104,20"/>
<path d="M-4,80 C18,76 34,83 50,79 C66,75 82,81 104,77"/>
<path d="M-4,87 C18,83 34,90 50,86 C66,82 82,88 104,84"/>
</g>
<ellipse cx="54" cy="26" rx="30" ry="24" fill="${accent}" opacity="0.13" filter="url(#soft)"/>
<g transform="translate(2.6,2.4) scale(0.90) rotate(${tilt} 54 62)">
<path d="${TORSO}" fill="url(#body)"/>
<path d="${PAULDRON_BACK}" fill="url(#steel)"/>
<path d="${PAULDRON}" fill="url(#steel)"/>
<path d="M60.6,96 C62.2,102 63.4,108 64,113" fill="none" stroke="${GOLD}" stroke-width="0.6" opacity="0.35"/>
<path d="M57.4,99.4 C59,104 60,108.6 60.6,112.6" fill="none" stroke="#0b0e12" stroke-width="1.4" opacity="0.8"/>
<path d="M41,96 C39.6,102 38.6,108 38.2,113" fill="none" stroke="#000" stroke-width="1" opacity="0.55"/>
<path d="M39.4,93.6 C47,91.6 58,91.4 63.6,93.4" fill="none" stroke="${GOLD}" stroke-width="0.8" opacity="0.5"/>
<path d="M18,110 C26,105 36,103 44,105" fill="none" stroke="${GOLD}" stroke-width="0.5" opacity="0.22"/>
${hatArtParts.back}
<path d="${HEAD}" fill="url(#body)"/>
<path d="${HEAD}" fill="url(#face)"/>
<ellipse cx="60.6" cy="36.4" rx="4.2" ry="5" fill="${skin}" opacity="0.34" filter="url(#soft)"/>
<path d="M67.6,44.6 C70.4,47.2 73,49.6 73.4,51.8" fill="none" stroke="${skin}" stroke-width="1.6" opacity="0.42" filter="url(#soft2)" stroke-linecap="round"/>
<path d="M62.4,38.6 C64.2,38.2 66,39 66.9,40.3" fill="none" stroke="${shade(skin, 40)}" stroke-width="1.5" opacity="0.35" filter="url(#soft2)" stroke-linecap="round"/>
<ellipse cx="64.2" cy="52.6" rx="3.4" ry="5.4" fill="#000" opacity="0.34" filter="url(#soft2)"/>
<path d="M62.4,45.4 C64.6,46.4 66,48.2 66.4,50.6" fill="none" stroke="#000" stroke-width="1.2" opacity="0.28" filter="url(#soft2)"/>
<path d="${RIM}" fill="none" stroke="${GOLD}" stroke-width="3.4" opacity="0.32" filter="url(#soft)" stroke-linecap="round"/>
<path d="${RIM}" fill="none" stroke="url(#rim)" stroke-width="1.2" stroke-linecap="round"/>
<path d="M34.4,50 C33.4,60 33.8,70 35.6,80" fill="none" stroke="${GOLD}" stroke-width="1.8" opacity="0.16" filter="url(#soft)"/>
<path d="M49.6,45.4 C51.6,45 53.2,46.6 53.2,48.6 C53.2,50.6 51.4,51.8 49.8,51.4" fill="none" stroke="${shade(skin, -90)}" stroke-width="0.7" opacity="0.55"/>
<path d="M62.4,43.3 C63.6,42.8 65.2,43 66.3,43.6 C65.1,44.2 63.5,44.2 62.4,43.3 Z" fill="#08090b" opacity="0.9"/>
<circle cx="64.7" cy="43.4" r="0.5" fill="${GOLD_HI}" opacity="0.6"/>
${browArt(war, seed)}
<path d="M67.8,57.4 C68.8,57.2 69.6,57.8 69.4,58.6" fill="none" stroke="#08090b" stroke-width="0.6" opacity="0.75"/>
${beardArt(beardId, hair)}
${scar ? `<path d="M65.2,46.4 L63.8,52.2" stroke="${shade(skin, -95)}" stroke-width="0.55" opacity="0.7"/>` : ''}
${hatArtParts.front}
<path d="M59.4,72 C57.4,75 56.8,81 58.4,86.4" fill="none" stroke="${GOLD}" stroke-width="1.6" opacity="0.2" filter="url(#soft)"/>
<path d="M59.4,72 C57.6,75.4 57.2,80.6 58.2,85.4" fill="none" stroke="rgba(201,164,92,0.42)" stroke-width="0.55"/>
<path d="M60.6,71.6 C62.6,74.6 63,80 62,85" fill="none" stroke="#000" stroke-width="1.2" opacity="0.5" filter="url(#soft2)"/>
</g>
</g>
<rect x="1.6" y="1.6" width="96.8" height="96.8" fill="none" stroke="${GOLD}" stroke-width="1.1" opacity="0.9"/>
<rect x="5" y="5" width="90" height="90" fill="none" stroke="${GOLD}" stroke-width="0.5" opacity="0.26"/>
<g fill="${GOLD}" opacity="0.95">
<rect x="47.4" y="-2.8" width="5.2" height="5.2" transform="rotate(45 50 -0.2)"/>
<rect x="47.4" y="97.4" width="5.2" height="5.2" transform="rotate(45 50 100)"/>
</g>
<g fill="${GOLD}" opacity="0.6">
<rect x="-0.6" y="-0.6" width="3" height="3" transform="rotate(45 0.9 0.9)"/>
<rect x="97.6" y="97.6" width="3" height="3" transform="rotate(45 99.1 99.1)"/>
</g>
</svg>`;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  cache.set(key, url);
  return url;
}

export function portraitURL(gid, general, size = 64, color = '#2b3550', style = null) {
  return portraitSVG(gid, general, size, color, style);
}
