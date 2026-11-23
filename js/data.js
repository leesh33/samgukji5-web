/* 삼국 한 턴 — 정적 데이터
 * 성 42곳 · 실존 장수 370여 명 · 시나리오 7종 · 진형 11종
 * 수치는 삼국 시대 고전 전략게임의 통념을 참고한 게임용 근사치입니다.
 */

export const REGIONS = {
  '유주': { color: '#5b7fa6', short: '유' },
  '병주': { color: '#7a6a9c', short: '병' },
  '기주': { color: '#8a6a4a', short: '기' },
  '청주': { color: '#4f8a76', short: '청' },
  '서주': { color: '#a5804a', short: '서' },
  '연주': { color: '#94724f', short: '연' },
  '예주': { color: '#7d8a4a', short: '예' },
  '사례': { color: '#a06a6a', short: '사' },
  '량주': { color: '#8a5f52', short: '량' },
  '형주': { color: '#4a7f8a', short: '형' },
  '양주': { color: '#4a6f8f', short: '양' },
  '익주': { color: '#5f7a52', short: '익' },
  '교주': { color: '#6a8a6a', short: '교' },
};

/* 성 목록: [id, 한글, 한자, 권역, x, y, 농업, 상업, 치안, 수리, 병력, 금, 식량, 대도시, 도로] */
const CITY_ROWS = [
  ['xiangping', '양평', '유주', 84, 12, 38, 34, 62, 35, 4200, 1600, 5200, 0, ['beiping']],
  ['beiping', '북평', '유주', 78, 15, 44, 38, 66, 40, 5600, 2000, 6400, 0, ['xiangping', 'ji', 'nanpi']],
  ['ji', '계', '유주', 71, 15, 52, 48, 68, 46, 7200, 2600, 8600, 1, ['beiping', 'julu', 'jinyang']],
  ['jinyang', '진양', '병주', 57, 21, 50, 44, 64, 42, 6000, 2200, 7400, 0, ['ji', 'ye', 'julu', 'luoyang']],
  ['ye', '업', '기주', 64, 25, 72, 70, 76, 68, 11000, 4200, 15200, 1, ['jinyang', 'julu', 'nanpi', 'puyang', 'luoyang']],
  ['nanpi', '남피', '기주', 72, 21, 60, 58, 70, 54, 8000, 3000, 10000, 0, ['ye', 'beiping', 'pingyuan', 'linzi', 'julu']],
  ['pingyuan', '평원', '기주', 70, 26, 58, 52, 68, 60, 7400, 2800, 9600, 0, ['nanpi', 'linzi', 'beihai', 'chenliu', 'puyang']],
  ['julu', '거록', '기주', 62, 22, 62, 50, 70, 56, 7600, 2700, 9800, 0, ['ye', 'ji', 'jinyang', 'nanpi', 'puyang']],
  ['linzi', '임치', '청주', 76, 28, 64, 66, 70, 52, 8200, 3400, 10400, 1, ['nanpi', 'pingyuan', 'beihai', 'xiapi']],
  ['beihai', '북해', '청주', 80, 30, 56, 54, 66, 46, 6800, 2600, 8800, 0, ['linzi', 'pingyuan', 'xiapi']],
  ['xiapi', '하비', '서주', 74, 34, 64, 62, 72, 60, 9000, 3400, 12000, 1, ['linzi', 'beihai', 'pengcheng', 'xiaopei', 'guangling', 'shouchun']],
  ['pengcheng', '팽성', '서주', 71, 32, 60, 58, 70, 56, 7800, 2900, 9800, 0, ['xiapi', 'xiaopei', 'shouchun', 'runan']],
  ['xiaopei', '소패', '서주', 72, 30, 52, 48, 62, 50, 6200, 2200, 7800, 0, ['pengcheng', 'xiapi', 'chenliu', 'xuchang', 'puyang']],
  ['guangling', '광릉', '서주', 77, 37, 54, 60, 64, 52, 6400, 2800, 8200, 0, ['xiapi', 'shouchun', 'jianye']],
  ['puyang', '복양', '연주', 67, 29, 58, 54, 66, 58, 7000, 2600, 9000, 0, ['ye', 'julu', 'pingyuan', 'chenliu', 'xiaopei']],
  ['chenliu', '진류', '연주', 64, 31, 66, 64, 72, 62, 8600, 3200, 11200, 1, ['puyang', 'pingyuan', 'xuchang', 'luoyang', 'xiaopei']],
  ['xuchang', '허창', '예주', 66, 34, 74, 76, 78, 70, 12000, 4800, 16200, 1, ['chenliu', 'xiaopei', 'runan', 'luoyang', 'xinye']],
  ['runan', '여남', '예주', 67, 37, 62, 56, 68, 58, 7600, 2800, 9600, 0, ['xuchang', 'pengcheng', 'shouchun', 'xinye', 'jiangxia']],
  ['luoyang', '낙양', '사례', 60, 31, 70, 78, 74, 66, 10000, 4200, 13800, 1, ['jinyang', 'ye', 'chenliu', 'xuchang', 'hongnong', 'xinye']],
  ['changan', '장안', '사례', 51, 30, 68, 70, 70, 62, 9600, 3800, 13000, 1, ['hongnong', 'tianshui', 'hanzhong']],
  ['hongnong', '홍농', '사례', 55, 30, 50, 46, 64, 50, 5200, 1900, 7000, 0, ['luoyang', 'changan']],
  ['wuwei', '무위', '량주', 35, 21, 40, 44, 60, 32, 5200, 1800, 6600, 0, ['tianshui', 'longxi']],
  ['tianshui', '천수', '량주', 42, 32, 48, 46, 62, 44, 6000, 2100, 7400, 0, ['wuwei', 'longxi', 'changan', 'hanzhong']],
  ['longxi', '농서', '량주', 44, 34, 42, 38, 58, 36, 4800, 1700, 6200, 0, ['wuwei', 'tianshui', 'hanzhong']],
  ['xinye', '신야', '형주', 64, 36, 48, 44, 64, 52, 5400, 1900, 7000, 0, ['xuchang', 'luoyang', 'runan', 'xiangyang', 'jiangxia']],
  ['xiangyang', '양양', '형주', 63, 38, 70, 68, 74, 66, 9800, 3800, 13000, 1, ['xinye', 'jiangling', 'jiangxia', 'hanzhong']],
  ['jiangling', '강릉', '형주', 62, 42, 66, 62, 70, 62, 8800, 3300, 11800, 1, ['xiangyang', 'jiangxia', 'changsha', 'jiangzhou']],
  ['jiangxia', '강하', '형주', 67, 41, 58, 56, 66, 58, 7200, 2600, 9200, 0, ['xiangyang', 'jiangling', 'xinye', 'runan', 'lujiang', 'changsha', 'yuzhang']],
  ['changsha', '장사', '형주', 65, 48, 62, 54, 68, 56, 7800, 2800, 10000, 0, ['jiangling', 'jiangxia', 'guiyang', 'yuzhang']],
  ['guiyang', '계양', '형주', 66, 53, 44, 40, 60, 44, 5000, 1800, 6600, 0, ['changsha', 'nanhai']],
  ['shouchun', '수춘', '양주', 72, 38, 62, 60, 68, 60, 8000, 3000, 10200, 1, ['xiapi', 'guangling', 'pengcheng', 'runan', 'lujiang', 'jianye']],
  ['lujiang', '여강', '양주', 71, 42, 54, 50, 64, 56, 6400, 2400, 8200, 0, ['shouchun', 'jianye', 'jiangxia', 'yuzhang']],
  ['jianye', '건업', '양주', 78, 40, 68, 72, 72, 64, 9200, 3800, 12000, 1, ['guangling', 'shouchun', 'lujiang', 'wu', 'yuzhang']],
  ['wu', '오', '양주', 81, 43, 62, 66, 70, 58, 7600, 3200, 9800, 0, ['jianye', 'kuaiji']],
  ['kuaiji', '회계', '양주', 84, 47, 58, 58, 66, 52, 7000, 2800, 9000, 0, ['wu', 'yuzhang']],
  ['yuzhang', '예장', '양주', 73, 47, 52, 48, 62, 50, 6200, 2200, 8000, 0, ['jianye', 'lujiang', 'jiangxia', 'changsha', 'kuaiji', 'nanhai']],
  ['hanzhong', '한중', '익주', 52, 35, 52, 46, 66, 48, 7000, 2400, 9000, 0, ['changan', 'tianshui', 'longxi', 'zitong', 'xiangyang']],
  ['zitong', '자동', '익주', 50, 38, 50, 44, 64, 46, 6200, 2100, 8000, 0, ['hanzhong', 'chengdu', 'jiangzhou']],
  ['chengdu', '성도', '익주', 45, 40, 78, 74, 78, 74, 12000, 4800, 16800, 1, ['zitong', 'jiangzhou']],
  ['jiangzhou', '강주', '익주', 52, 44, 58, 54, 66, 54, 7000, 2500, 9200, 0, ['chengdu', 'zitong', 'jiangling', 'nanhai']],
  ['nanhai', '남해', '교주', 70, 56, 46, 52, 60, 44, 5200, 2200, 7000, 0, ['guiyang', 'yuzhang', 'jiaozhi', 'jiangzhou']],
  ['jiaozhi', '교지', '교주', 62, 62, 40, 44, 56, 38, 4600, 1800, 6400, 0, ['nanhai']],
];

/* ---------- 성 규모 — 소 · 중 · 대 · 특대 ----------
 * 성의 농업·상업·치안·수리가 모두 그 규모의 상한(cap)에 닿으면 다음 규모로 승격한다.
 * 승격해도 채운 수치는 그대로 남고 상한만 넓어지므로(100 → 130 → 160 → 200)
 * 다시 0부터 채우는 일 없이 "꽉 채우면 업"이 이어진다.
 * 규모가 클수록 징병이 많이 모이고(draft), 금·식량 세입(income)과
 * 성의 주둔 병력 상한(troopCap)도 조금씩 오른다. */
export const CITY_SIZES = [
  { id: 0, ko: '소', cap: 100, draft: 1.0, income: 1.0, troopCap: 14000 },
  { id: 1, ko: '중', cap: 130, draft: 1.25, income: 1.08, troopCap: 18000 },
  { id: 2, ko: '대', cap: 160, draft: 1.5, income: 1.16, troopCap: 24000 },
  { id: 3, ko: '특대', cap: 200, draft: 1.8, income: 1.25, troopCap: 30000 },
];
export const CITY_SIZE_MAX = CITY_SIZES.length - 1;
export const citySize = (n) => CITY_SIZES[Math.max(0, Math.min(CITY_SIZE_MAX, Math.trunc(Number(n) || 0)))];
export const citySizeKo = (n) => citySize(n).ko;
export const sizeCap = (n) => citySize(n).cap;
export const sizeDraftMul = (n) => citySize(n).draft;
export const sizeIncomeMul = (n) => citySize(n).income;
export const sizeTroopCap = (n) => citySize(n).troopCap;

/* 42성 초기 규모 — 역사적·전략적 위상에 맞춰
 * 대(2) 5성: 낙양·장안·업·성도·건업 / 중(1) 14성 / 소(0) 23성 */
export const CITY_SIZE_SEED = {
  luoyang: 2, changan: 2, ye: 2, chengdu: 2, jianye: 2,
  xuchang: 1, shouchun: 1, jiangling: 1, xiangyang: 1,
  ji: 1, jinyang: 1, nanpi: 1, linzi: 1, xiapi: 1, chenliu: 1,
  jiangxia: 1, changsha: 1, wu: 1, hanzhong: 1,
};

export const CITIES = CITY_ROWS.map((r) => ({
  id: r[0], ko: r[1], region: r[2], x: r[3], y: r[4],
  agri: r[5], comm: r[6], order: r[7], water: r[8],
  troops: r[9], gold: r[10], food: r[11], major: !!r[12], roads: r[13],
  size: CITY_SIZE_SEED[r[0]] ?? 0,
}));

export const CITY_BY_ID = Object.fromEntries(CITIES.map((c) => [c.id, c]));

/* 진형 11종(핵심 9종 + 안행·수진): [id, 한글, 공격, 방어, 기동, 사거리, 설명] */
export const FORMATIONS = {
  eorin: { id: 'eorin', ko: '어린', atk: 1.15, def: 1.0, move: 1.0, range: 1, desc: '비늘처럼 겹친 쐐기. 정면 돌파에 강하다.' },
  hakyik: { id: 'hakyik', ko: '학익', atk: 0.9, def: 1.1, move: 0.9, range: 2, desc: '좌우로 날개를 펼쳐 원거리에서 협공한다.' },
  bongsi: { id: 'bongsi', ko: '봉시', atk: 1.25, def: 0.85, move: 1.2, range: 1, desc: '화살촉처럼 돌격하는 공격 특화 진형.' },
  bangwon: { id: 'bangwon', ko: '방원', atk: 0.8, def: 1.3, move: 0.8, range: 1, desc: '원형 방진. 수비와 버티기에 최적.' },
  eonwol: { id: 'eonwol', ko: '언월', atk: 1.1, def: 1.05, move: 1.0, range: 1, desc: '초승달 대형. 균형 잡힌 공수.' },
  jangsa: { id: 'jangsa', ko: '장사', atk: 1.05, def: 0.95, move: 1.15, range: 1, desc: '뱀처럼 길게 늘어서 기동에 강하다.' },
  anhaeng: { id: 'anhaeng', ko: '안행', atk: 0.85, def: 1.15, move: 1.0, range: 2, desc: '기러기 대형. 사거리가 길고 방어가 두텁다.' },
  guhaeng: { id: 'guhaeng', ko: '구행', atk: 1.0, def: 1.0, move: 1.25, range: 1, desc: '갈고리 대형. 측면 우회에 능하다.' },
  sujin: { id: 'sujin', ko: '수진', atk: 1.1, def: 1.1, move: 1.0, range: 1, desc: '수상 전투용 진형. 물 위에서 위력을 발휘한다.' },
  chuhaeng: { id: 'chuhaeng', ko: '추행', atk: 1.2, def: 0.9, move: 1.15, range: 1, desc: '송곳처럼 길게 뚫는 돌격진. 좁은 정면에 힘을 모은다.' },
  hyeongaek: { id: 'hyeongaek', ko: '형액', atk: 0.85, def: 1.25, move: 0.9, range: 1, desc: '두 줄 횡대로 멱을 걸어 막는 방어진. 정면 방어가 두겁다.' },
};

/* 진형 상성: 돌격 → 포위 → 방어 → 돌격 삼각 순환
   - 돌격진(어린·봉시·추행·장사)은 포위진의 벌린 날개를 뚫는다(유리) / 방어진에 막힌다(불리)
   - 포위진(학익·언월·구행·안행)은 방어진의 측면을 흔든다(유리) / 돌격진에 뚫린다(불리)
   - 방어진(방원·형액·수진)은 돌격을 받아낸다(유리) / 포위에 흔들린다(불리) */
export const FORMATION_GROUPS = {
  charge: { id: 'charge', ko: '돌격', beats: 'pincer', forms: ['eorin', 'bongsi', 'chuhaeng', 'jangsa'] },
  pincer: { id: 'pincer', ko: '포위', beats: 'guard', forms: ['hakyik', 'eonwol', 'guhaeng', 'anhaeng'] },
  guard: { id: 'guard', ko: '방어', beats: 'charge', forms: ['bangwon', 'hyeongaek', 'sujin'] },
};

/* 상성표를 함께 쓰는 핵심 9종 */
export const CORE_FORMATIONS = ['hakyik', 'eorin', 'bongsi', 'bangwon', 'jangsa', 'eonwol', 'chuhaeng', 'guhaeng', 'hyeongaek'];

export const FORMATION_GROUP_OF = (() => {
  const map = {};
  for (const g of Object.values(FORMATION_GROUPS)) for (const f of g.forms) map[f] = g.id;
  return map;
})();

export function formationGroup(formId) {
  const gid = FORMATION_GROUP_OF[formId];
  return gid ? FORMATION_GROUPS[gid] : null;
}

/* 공격 진형이 수비 진형에 대해 유리(advantage) / 불리(disadvantage) / 무상성(neutral) */
export function formationRelation(atkForm, defForm) {
  const a = FORMATION_GROUP_OF[atkForm];
  const d = FORMATION_GROUP_OF[defForm];
  if (!a || !d || a === d) return 'neutral';
  if (FORMATION_GROUPS[a].beats === d) return 'advantage';
  if (FORMATION_GROUPS[d].beats === a) return 'disadvantage';
  return 'neutral';
}

/* 상성 문구: '학익' → '방어진에 강함 · 돌격진에 약함' */
export function formationCounterText(formId) {
  const g = formationGroup(formId);
  if (!g) return '';
  const strong = FORMATION_GROUPS[g.beats];
  const weakId = Object.values(FORMATION_GROUPS).find((x) => x.beats === g.id);
  return `${strong.ko}진에 강함 · ${weakId ? weakId.ko + '진에 약함' : '약점 없음'}`;
}

export const SKILLS = {
  hwagye: { ko: '화계', desc: '불을 질러 적 부대를 태운다(전술).', tactic: 'fire' },
  hollan: { ko: '혼란', desc: '적 부대를 혼란시켜 사기를 꺾는다(전술).', tactic: 'confuse' },
  gomu: { ko: '고무', desc: '아군 부대의 사기를 올린다(전술).', tactic: 'rally' },
  chiryo: { ko: '치료', desc: '아군 부대의 병력을 회복한다(전술).', tactic: 'heal' },
  jeogyeok: { ko: '저격', desc: '원거리 공격 피해 +25%.' },
  dolgyeok: { ko: '돌격', desc: '공격 피해 +20%, 기동 +1.' },
  cheolbyeok: { ko: '철벽', desc: '받는 피해 -20%.' },
  sujeon: { ko: '수전', desc: '물·강 지형에서 피해 +25%, 이동 저항 무시.' },
  sinsan: { ko: '신산', desc: '계략 성공률 +30%, 계략 피해 +20%.' },
  tongsol: { ko: '통솔', desc: '부대 사기 +10, 지휘 피해 감소.' },
  yongmaeng: { ko: '용맹', desc: '일기토 승률과 공격 피해 증가.' },
  wieom: { ko: '위엄', desc: '적 부대 사기를 매 턴 2 감소시킨다.' },
  indeok: { ko: '인덕', desc: '등용·포상 성공률 증가, 민심 상승.' },
  gyeonsu: { ko: '견수', desc: '방어 시 피해 -10%, 성 방어 +15%.' },
  hogwi: { ko: '호위', desc: '일기토에서 받는 피해 -25%.' },
  bigyeok: { ko: '비장', desc: '일기토 필살 위력 대폭 증가.' },
  pokgyeok: { ko: '폭격', desc: '공격 피해 +15%, 사기 -5.' },
  singan: { ko: '신산', desc: '계략 성공률 +30%, 계략 피해 +20%.' },
};

/* 장수: id, 한글 이름, 통솔, 무력, 지력, 정치, 매력, 병과, 특기, 보유진형 */
const FORM_BY_KO = Object.fromEntries(Object.values(FORMATIONS).map((f) => [f.ko, f.id]));
function G(id, ko, lead, war, int, pol, cha, arms, skill, forms) {
  const list = [];
  for (let i = 0; i < forms.length; i += 2) {
    const koName = forms.slice(i, i + 2);
    list.push(FORM_BY_KO[koName] || 'eorin');
  }
  return { id, ko, lead, war, int, pol, cha, arms, skill, formations: list };
}

/* 신규 장수용 — 마지막 인자에 고향 성을 함께 적는다.
   시나리오에 따로 배치되지 않은 장수는 그 성의 재야로 나온다(engine.createGame). */
function GN(id, ko, lead, war, int, pol, cha, arms, skill, forms, home) {
  return { ...G(id, ko, lead, war, int, pol, cha, arms, skill, forms), home };
}

export const GENERALS = [
  // 위 · 조조군
  G('cao_cao', '조조', 99, 72, 91, 94, 96, '보병', 'tongsol', '어린학익봉시방원언월'),
  G('xiahou_dun', '하후돈', 90, 94, 61, 70, 76, '기병', 'dolgyeok', '어린봉시추행'),
  G('xiahou_yuan', '하후연', 88, 92, 68, 62, 74, '기병', 'dolgyeok', '봉시학익'),
  G('cao_ren', '조인', 91, 86, 68, 70, 72, '보병', 'cheolbyeok', '방원형액학익'),
  G('cao_hong', '조홍', 76, 82, 40, 55, 66, '기병', 'dolgyeok', '봉시'),
  G('zhang_liao', '장료', 95, 92, 78, 58, 78, '기병', 'yongmaeng', '학익봉시어린'),
  G('xu_huang', '서황', 91, 89, 74, 68, 74, '보병', 'cheolbyeok', '어린방원'),
  G('yue_jin', '악진', 84, 86, 62, 54, 66, '보병', 'dolgyeok', '어린'),
  G('yu_jin', '우금', 85, 78, 68, 74, 62, '보병', 'gyeonsu', '방원형액'),
  G('dian_wei', '전위', 78, 96, 38, 26, 68, '보병', 'hogwi', '어린추행'),
  G('xu_chu', '허저', 76, 96, 32, 28, 70, '보병', 'hogwi', '어린'),
  G('xun_yu', '순욱', 70, 32, 95, 96, 88, '궁병', 'sinsan', '방원'),
  G('xun_you', '순유', 68, 30, 94, 88, 80, '궁병', 'hwagye', '방원'),
  G('guo_jia', '곽가', 60, 22, 98, 86, 82, '궁병', 'sinsan', '방원'),
  G('cheng_yu', '정욱', 72, 48, 92, 90, 74, '궁병', 'hwagye', '방원'),
  G('sima_yi', '사마의', 96, 63, 98, 94, 88, '보병', 'sinsan', '학익어린'),
  G('jia_xu', '가후', 70, 32, 97, 86, 62, '궁병', 'hollan', '방원'),
  G('liu_ye', '유엽', 66, 40, 88, 84, 70, '궁병', 'hwagye', '학익'),
  G('man_chong', '만총', 74, 60, 80, 82, 62, '보병', 'cheolbyeok', '방원'),
  G('lv_qian', '여건', 70, 68, 62, 66, 58, '보병', 'gyeonsu', '어린'),
  G('cao_ang', '조앙', 70, 74, 66, 68, 74, '기병', 'dolgyeok', '봉시'),
  G('wen_pin', '문빙', 82, 80, 70, 72, 68, '수군', 'sujeon', '방원'),
  G('li_dian', '이전', 80, 76, 74, 70, 70, '보병', 'gyeonsu', '학익'),
  G('zhang_he', '장합', 92, 88, 82, 74, 72, '기병', 'cheolbyeok', '학익봉시'),
  G('gao_lan', '고람', 78, 80, 60, 52, 56, '보병', 'dolgyeok', '어린'),
  G('zhu_ling', '주령', 72, 74, 58, 60, 54, '보병', 'dolgyeok', '어린'),
  G('mao_jie', '모개', 60, 40, 72, 84, 66, '궁병', 'gyeonsu', '방원'),
  G('cao_chun', '조순', 80, 78, 70, 66, 68, '기병', 'dolgyeok', '봉시'),
  G('cao_xiu', '조휴', 78, 74, 68, 66, 64, '기병', 'dolgyeok', '봉시'),

  // 촉 · 유비군
  G('liu_bei', '유비', 82, 74, 78, 84, 99, '보병', 'indeok', '어린학익'),
  G('guan_yu', '관우', 98, 97, 75, 64, 92, '기병', 'wieom', '언월어린봉시'),
  G('zhang_fei', '장비', 95, 98, 40, 22, 64, '기병', 'pokgyeok', '봉시추행장사'),
  G('zhao_yun', '조운', 96, 97, 76, 66, 88, '기병', 'cheolbyeok', '학익봉시방원'),
  G('zhuge_liang', '제갈량', 92, 38, 100, 96, 92, '궁병', 'sinsan', '방원학익'),
  G('xu_shu', '서서', 76, 60, 90, 76, 76, '궁병', 'hwagye', '방원'),
  G('pang_tong', '방통', 70, 40, 96, 82, 60, '궁병', 'hwagye', '방원'),
  G('huang_zhong', '황충', 88, 95, 68, 56, 72, '궁병', 'jeogyeok', '학익'),
  G('wei_yan', '위연', 86, 91, 68, 50, 56, '기병', 'dolgyeok', '봉시'),
  G('fa_zheng', '법정', 72, 40, 94, 84, 66, '궁병', 'hwagye', '방원'),
  G('li_yan', '이엄', 82, 80, 80, 76, 60, '보병', 'cheolbyeok', '방원'),
  G('ma_liang', '마량', 62, 30, 86, 88, 74, '궁병', 'gyeonsu', '방원'),
  G('sun_qian', '손건', 56, 40, 74, 82, 80, '궁병', 'gyeonsu', '방원'),
  G('mi_zhu', '미축', 50, 30, 66, 90, 78, '궁병', 'gyeonsu', '방원'),
  G('jian_yong', '간옹', 54, 32, 74, 78, 76, '궁병', 'gyeonsu', '방원'),
  G('liu_feng', '유봉', 70, 78, 54, 50, 56, '기병', 'dolgyeok', '봉시'),
  G('yan_yan', '엄안', 82, 84, 66, 72, 70, '보병', 'cheolbyeok', '방원'),
  G('wu_yi', '오의', 74, 72, 66, 70, 68, '보병', 'gyeonsu', '학익'),
  G('liao_hua', '요화', 72, 70, 60, 62, 64, '보병', 'dolgyeok', '어린'),
  G('ma_dai', '마대', 78, 80, 66, 60, 66, '기병', 'dolgyeok', '봉시'),
  G('chen_deng', '진등', 66, 58, 86, 84, 74, '궁병', 'sinsan', '방원'),
  G('chen_gui', '진규', 54, 34, 82, 86, 70, '궁병', 'gyeonsu', '방원'),

  // 오 · 손씨
  G('sun_jian', '손견', 94, 92, 74, 72, 88, '기병', 'yongmaeng', '봉시학익'),
  G('sun_ce', '손책', 92, 90, 70, 62, 90, '기병', 'dolgyeok', '봉시'),
  G('sun_quan', '손권', 80, 60, 82, 90, 94, '보병', 'tongsol', '방원학익'),
  G('zhou_yu', '주유', 94, 66, 98, 84, 92, '수군', 'hwagye', '학익언월'),
  G('lu_su', '노숙', 78, 40, 88, 92, 86, '수군', 'gyeonsu', '방원'),
  G('lu_meng', '여몽', 88, 84, 86, 76, 74, '수군', 'sujeon', '방원'),
  G('lu_xun', '육손', 92, 62, 96, 88, 80, '수군', 'hwagye', '학익'),
  G('huang_gai', '황개', 80, 78, 68, 66, 68, '수군', 'hwagye', '방원'),
  G('han_dang', '한당', 80, 82, 58, 54, 62, '수군', 'sujeon', '언월'),
  G('cheng_pu', '정보', 84, 80, 70, 68, 72, '수군', 'gyeonsu', '방원'),
  G('taishi_ci', '태사자', 88, 92, 74, 62, 80, '궁병', 'jeogyeok', '학익'),
  G('gan_ning', '감녕', 90, 92, 60, 40, 70, '수군', 'sujeon', '장사'),
  G('zhou_tai', '주태', 82, 90, 44, 36, 70, '수군', 'cheolbyeok', '방원'),
  G('jiang_qin', '장흠', 78, 78, 60, 58, 62, '수군', 'sujeon', '어린'),
  G('lv_fan', '여범', 70, 62, 74, 78, 66, '수군', 'gyeonsu', '방원'),
  G('zhuge_jin', '제갈근', 62, 40, 86, 82, 80, '궁병', 'gyeonsu', '방원'),
  G('zhang_zhao', '장소', 60, 26, 90, 92, 76, '궁병', 'gyeonsu', '방원'),
  G('gu_yong', '고옹', 58, 24, 84, 90, 70, '궁병', 'gyeonsu', '방원'),
  G('ling_tong', '능통', 84, 86, 68, 62, 70, '수군', 'dolgyeok', '봉시'),
  G('xu_sheng', '서성', 80, 80, 62, 60, 64, '수군', 'cheolbyeok', '방원'),
  G('ding_feng', '정봉', 78, 82, 64, 58, 62, '수군', 'sujeon', '장사'),
  G('pan_zhang', '반장', 72, 74, 46, 38, 48, '수군', 'gyeonsu', '어린'),
  G('zhu_zhi', '주치', 66, 66, 64, 66, 60, '수군', 'gyeonsu', '방원'),
  G('sun_huan', '손환', 60, 62, 60, 58, 60, '보병', 'gyeonsu', '어린'),

  // 여포군
  G('lu_bu', '여포', 96, 100, 32, 18, 78, '기병', 'bigyeok', '봉시장사'),
  G('chen_gong', '진궁', 74, 44, 92, 86, 70, '궁병', 'hwagye', '방원'),
  G('gao_shun', '고순', 88, 90, 60, 46, 72, '보병', 'cheolbyeok', '방원'),
  G('zang_ba', '장패', 82, 86, 56, 52, 66, '보병', 'dolgyeok', '언월'),
  G('wei_xu', '위속', 66, 68, 40, 36, 44, '기병', 'dolgyeok', '어린'),
  G('hou_cheng', '후성', 64, 66, 36, 34, 42, '기병', 'dolgyeok', '어린'),
  G('song_xian', '송헌', 62, 64, 32, 30, 40, '보병', 'gyeonsu', '어린'),
  G('cao_xing', '조성', 68, 72, 44, 40, 46, '궁병', 'jeogyeok', '학익'),
  G('hao_meng', '학맹', 60, 62, 34, 30, 40, '보병', 'dolgyeok', '어린'),

  // 원소군
  G('yuan_shao', '원소', 80, 62, 70, 82, 90, '보병', 'tongsol', '어린방원'),
  G('yuan_tan', '원담', 68, 72, 50, 48, 56, '기병', 'dolgyeok', '봉시'),
  G('yuan_shang', '원상', 66, 76, 52, 50, 66, '기병', 'dolgyeok', '봉시'),
  G('yan_liang', '안량', 82, 94, 36, 26, 60, '기병', 'dolgyeok', '봉시'),
  G('wen_chu', '문추', 82, 95, 32, 22, 58, '기병', 'dolgyeok', '봉시'),
  G('ju_shou', '저수', 70, 40, 92, 86, 70, '궁병', 'sinsan', '방원'),
  G('tian_feng', '전풍', 66, 30, 94, 88, 62, '궁병', 'sinsan', '방원'),
  G('feng_ji', '봉기', 60, 30, 84, 76, 48, '궁병', 'hollan', '방원'),
  G('guo_tu', '곽도', 58, 34, 80, 70, 44, '궁병', 'hollan', '방원'),
  G('shen_pei', '심배', 74, 56, 78, 80, 60, '보병', 'cheolbyeok', '방원'),
  G('xu_you', '허유', 56, 24, 88, 70, 40, '궁병', 'hwagye', '방원'),
  G('chunyu_qiong', '순우경', 68, 64, 40, 46, 44, '보병', 'gyeonsu', '어린'),
  G('lv_kuang', '여광', 64, 66, 44, 42, 46, '보병', 'dolgyeok', '어린'),
  G('lv_xiang', '여상', 62, 64, 42, 40, 44, '보병', 'dolgyeok', '어린'),
  G('yuan_xi', '원희', 62, 60, 54, 56, 58, '기병', 'gyeonsu', '어린'),
  G('gao_gan', '고간', 70, 68, 60, 60, 56, '보병', 'gyeonsu', '방원'),

  // 유표군
  G('liu_biao', '유표', 70, 54, 74, 84, 86, '보병', 'tongsol', '방원'),
  G('cai_mao', '채모', 76, 70, 62, 64, 50, '수군', 'sujeon', '방원'),
  G('kuai_yue', '괴월', 66, 40, 86, 88, 70, '궁병', 'gyeonsu', '방원'),
  G('huang_zu', '황조', 72, 74, 50, 48, 50, '수군', 'sujeon', '방원'),
  G('zhang_yun', '장윤', 66, 64, 48, 46, 44, '수군', 'sujeon', '방원'),
  G('liu_cong', '유종', 48, 40, 52, 60, 62, '보병', 'gyeonsu', '어린'),
  G('han_song', '한숭', 58, 34, 78, 80, 60, '궁병', 'gyeonsu', '방원'),
  G('cai_xun', '채훈', 60, 58, 52, 54, 50, '수군', 'gyeonsu', '방원'),
  G('yi_ji', '이규', 54, 36, 76, 82, 76, '궁병', 'gyeonsu', '방원'),

  // 유장군
  G('liu_zhang', '유장', 54, 40, 48, 66, 70, '보병', 'gyeonsu', '어린'),
  G('zhang_ren', '장임', 84, 86, 72, 66, 70, '궁병', 'jeogyeok', '학익'),
  G('zhang_song', '장송', 42, 20, 82, 74, 40, '궁병', 'gyeonsu', '방원'),
  G('huang_quan', '황권', 72, 60, 80, 80, 66, '보병', 'gyeonsu', '방원'),
  G('lei_tong', '뇌동', 66, 72, 46, 42, 48, '보병', 'dolgyeok', '어린'),
  G('ling_bao', '냉포', 64, 70, 44, 40, 46, '보병', 'dolgyeok', '어린'),
  G('deng_xian', '등현', 62, 66, 44, 42, 44, '보병', 'gyeonsu', '어린'),
  G('liu_gui', '유괴', 70, 72, 58, 56, 54, '보병', 'gyeonsu', '방원'),
  G('yang_huai', '양회', 68, 70, 50, 48, 50, '보병', 'gyeonsu', '어린'),
  G('gao_pei', '고패', 66, 68, 48, 46, 48, '보병', 'gyeonsu', '어린'),

  // 마등·한수
  G('ma_teng', '마등', 82, 84, 60, 62, 82, '기병', 'dolgyeok', '봉시'),
  G('ma_chao', '마초', 94, 98, 48, 40, 88, '기병', 'bigyeok', '봉시장사'),
  G('pang_de', '방덕', 86, 92, 66, 58, 72, '기병', 'cheolbyeok', '봉시'),
  G('ma_xiu', '마휴', 66, 70, 50, 50, 56, '기병', 'dolgyeok', '어린'),
  G('ma_tie', '마철', 64, 68, 48, 48, 54, '기병', 'dolgyeok', '어린'),
  G('han_sui', '한수', 78, 76, 66, 64, 66, '기병', 'gyeonsu', '방원'),
  G('cheng_yi', '성의', 66, 68, 44, 42, 44, '기병', 'dolgyeok', '어린'),
  G('hou_xuan', '후선', 64, 66, 42, 40, 42, '기병', 'gyeonsu', '어린'),
  G('liang_xing', '양흥', 64, 66, 40, 38, 40, '기병', 'dolgyeok', '어린'),
  G('yan_xing', '염행', 72, 74, 58, 56, 56, '기병', 'gyeonsu', '봉시'),

  // 공손찬군
  G('gongsun_zan', '공손찬', 82, 78, 60, 58, 74, '기병', 'dolgyeok', '봉시'),
  G('gongsun_yue', '공손월', 64, 66, 44, 42, 48, '기병', 'dolgyeok', '어린'),
  G('gongsun_fan', '공손범', 62, 64, 42, 42, 46, '기병', 'gyeonsu', '어린'),
  G('shan_jing', '선경우', 60, 58, 50, 52, 46, '보병', 'gyeonsu', '방원'),
  G('tian_kai', '전해', 68, 66, 56, 58, 56, '보병', 'gyeonsu', '어린'),
  G('yan_gang', '엄강', 62, 64, 40, 38, 40, '기병', 'dolgyeok', '어린'),
  G('guan_jing', '관정', 58, 44, 74, 70, 56, '궁병', 'hwagye', '방원'),
  G('zou_dan', '추단', 60, 60, 40, 40, 42, '기병', 'dolgyeok', '어린'),
  G('gongsun_du', '공손도', 68, 62, 66, 68, 60, '보병', 'gyeonsu', '방원'),

  // 원술군
  G('yuan_shu', '원술', 62, 50, 54, 62, 74, '보병', 'gyeonsu', '어린'),
  G('ji_ling', '기령', 78, 84, 44, 38, 50, '보병', 'dolgyeok', '어린'),
  G('zhang_xun', '장훈', 68, 70, 50, 54, 50, '보병', 'gyeonsu', '방원'),
  G('qiao_rui', '교예', 64, 66, 46, 46, 44, '보병', 'dolgyeok', '어린'),
  G('lei_bao', '뇌박', 60, 62, 38, 36, 38, '보병', 'dolgyeok', '어린'),
  G('chen_lan', '진란', 58, 60, 36, 34, 36, '보병', 'gyeonsu', '어린'),
  G('yang_hong', '양홍', 56, 42, 70, 66, 54, '궁병', 'gyeonsu', '방원'),
  G('yan_xiang', '염상', 52, 30, 74, 72, 56, '궁병', 'gyeonsu', '방원'),

  // 장로군
  G('zhang_lu', '장로', 60, 44, 70, 74, 78, '보병', 'gyeonsu', '어린'),
  G('zhang_wei', '장위', 70, 74, 54, 50, 54, '보병', 'gyeonsu', '방원'),
  G('yang_ren', '양임', 68, 70, 52, 48, 50, '보병', 'dolgyeok', '어린'),
  G('yan_pu', '염포', 54, 30, 80, 78, 60, '궁병', 'sinsan', '방원'),
  G('yang_song', '양송', 40, 20, 60, 50, 30, '보병', 'gyeonsu', '방원'),
  G('yang_bo', '양백', 60, 62, 44, 42, 44, '보병', 'gyeonsu', '어린'),

  // 도겸군
  G('tao_qian', '도겸', 60, 40, 62, 74, 82, '보병', 'indeok', '방원'),
  G('cao_bao', '조표', 62, 64, 40, 44, 42, '보병', 'gyeonsu', '어린'),

  // 유요군
  G('liu_yao', '유요', 58, 50, 60, 66, 70, '보병', 'gyeonsu', '방원'),
  G('zhang_ying', '장영', 62, 64, 44, 42, 44, '보병', 'dolgyeok', '어린'),
  G('fan_neng', '번능', 58, 60, 40, 38, 40, '보병', 'gyeonsu', '어린'),
  G('yu_mi', '우미', 54, 56, 38, 36, 38, '보병', 'gyeonsu', '어린'),

  // 공융군
  G('kong_rong', '공융', 40, 20, 82, 78, 86, '궁병', 'indeok', '방원'),
  G('wu_anguo', '무안국', 62, 70, 42, 40, 46, '보병', 'gyeonsu', '어린'),

  // 이각·곽사군
  G('li_jue', '이각', 78, 84, 44, 34, 30, '기병', 'dolgyeok', '봉시'),
  G('guo_si', '곽사', 74, 82, 38, 30, 28, '기병', 'dolgyeok', '봉시'),
  G('zhang_ji', '장제', 70, 74, 48, 46, 44, '기병', 'gyeonsu', '어린'),
  G('fan_chou', '번조', 72, 80, 40, 34, 34, '기병', 'dolgyeok', '어린'),
  G('yang_feng', '양봉', 66, 70, 44, 42, 44, '보병', 'gyeonsu', '방원'),

  // 사섭군
  G('shi_xie', '사섭', 56, 40, 62, 74, 80, '보병', 'gyeonsu', '방원'),
  G('shi_yi', '사의', 50, 40, 54, 62, 60, '보병', 'gyeonsu', '어린'),

  // ── 184 황건·한말 ──
  G('zhang_jue', '장각', 78, 30, 88, 70, 92, '궁병', 'sinsan', '방원학익'),
  G('zhang_bao', '장보', 72, 66, 62, 44, 60, '보병', 'hollan', '어린방원'),
  G('zhang_liang', '장량', 74, 74, 48, 34, 52, '보병', 'dolgyeok', '봉시어린'),
  G('bo_cai', '파재', 70, 72, 40, 34, 50, '보병', 'dolgyeok', '어린'),
  G('zhang_mancheng', '장만성', 66, 68, 36, 30, 44, '보병', 'dolgyeok', '어린'),
  G('guan_hai', '관해', 74, 84, 30, 26, 44, '기병', 'dolgyeok', '봉시'),
  G('huangfu_song', '황보숭', 92, 80, 84, 78, 84, '보병', 'tongsol', '방원어린학익'),
  G('lu_zhi', '노식', 88, 68, 90, 86, 82, '보병', 'cheolbyeok', '방원학익'),
  G('zhu_jun', '주준', 86, 78, 76, 72, 74, '보병', 'gyeonsu', '방원'),
  G('he_jin', '하진', 74, 70, 40, 62, 58, '보병', 'gyeonsu', '어린'),
  G('ding_yuan', '정원', 78, 78, 60, 62, 66, '기병', 'dolgyeok', '봉시'),
  G('dong_zhuo', '동탁', 88, 86, 72, 50, 42, '기병', 'wieom', '봉시방원'),
  G('wang_yun', '왕윤', 56, 30, 86, 88, 74, '궁병', 'hollan', '방원'),
  G('hua_xiong', '화웅', 80, 90, 46, 40, 52, '기병', 'dolgyeok', '봉시'),
  G('li_ru', '이유', 70, 26, 94, 80, 50, '궁병', 'hwagye', '방원'),
  G('niu_fu', '우보', 68, 74, 40, 34, 40, '기병', 'dolgyeok', '어린'),
  G('xu_rong', '서영', 84, 82, 72, 60, 62, '기병', 'cheolbyeok', '봉시방원'),
  G('zhang_yang', '장양', 68, 66, 58, 60, 56, '보병', 'gyeonsu', '방원'),

  // ── 삼국정립·후기 ──
  G('cao_pi', '조비', 78, 62, 82, 88, 86, '보병', 'tongsol', '방원학익'),
  G('cao_rui', '조예', 72, 50, 78, 82, 76, '보병', 'gyeonsu', '방원'),
  G('cao_zhen', '조진', 82, 78, 66, 68, 66, '기병', 'cheolbyeok', '방원'),
  G('deng_ai', '등애', 94, 82, 90, 80, 70, '보병', 'cheolbyeok', '방원어린'),
  G('zhong_hui', '종회', 82, 52, 92, 84, 62, '궁병', 'sinsan', '방원'),
  G('yang_hu', '양호', 90, 60, 92, 94, 88, '보병', 'gyeonsu', '방원'),
  G('du_yu', '두예', 88, 54, 92, 90, 76, '보병', 'sinsan', '방원학익'),
  G('guo_huai', '곽회', 86, 74, 80, 78, 66, '보병', 'gyeonsu', '방원'),
  G('xiahou_ba', '하후패', 78, 82, 64, 58, 62, '기병', 'dolgyeok', '봉시'),
  G('sima_shi', '사마사', 84, 72, 90, 90, 64, '보병', 'gyeonsu', '방원'),
  G('sima_zhao', '사마소', 82, 70, 88, 92, 62, '보병', 'sinsan', '방원'),
  G('jiang_wei', '강유', 92, 88, 90, 74, 78, '기병', 'sinsan', '봉시학익'),
  G('zhang_wan', '장완', 78, 40, 88, 92, 78, '궁병', 'gyeonsu', '방원'),
  G('fei_yi', '비의', 74, 36, 86, 92, 84, '궁병', 'gyeonsu', '방원'),
  G('guo_jun', '곽준', 84, 78, 70, 66, 68, '보병', 'cheolbyeok', '방원'),
  G('ma_zhong', '마충', 80, 78, 72, 74, 66, '보병', 'gyeonsu', '방원'),
  G('guan_xing', '관흥', 76, 82, 58, 52, 62, '기병', 'dolgyeok', '봉시'),
  G('guan_ping', '관평', 78, 80, 62, 56, 66, '보병', 'gyeonsu', '방원'),
  G('zhang_bao_zi', '장포', 76, 84, 50, 44, 58, '기병', 'dolgyeok', '봉시'),
  G('wang_ping', '왕평', 86, 76, 70, 64, 62, '보병', 'cheolbyeok', '방원'),
  G('ma_su', '마속', 66, 62, 84, 68, 70, '궁병', 'sinsan', '방원'),
  G('lu_kang', '육항', 94, 64, 94, 90, 78, '수군', 'gyeonsu', '방원학익'),
  G('zhu_ran', '주연', 84, 80, 70, 68, 66, '수군', 'sujeon', '방원'),
  G('zhuge_ke', '제갈각', 80, 60, 88, 80, 66, '보병', 'sinsan', '방원'),
  G('meng_huo', '맹획', 82, 88, 48, 40, 76, '보병', 'dolgyeok', '장사어린'),
  G('zhurong', '축융', 78, 86, 50, 42, 80, '궁병', 'jeogyeok', '학익'),
  G('wutugu', '올돌골', 86, 90, 40, 24, 66, '보병', 'cheolbyeok', '방원'),
  G('liu_yan', '유언', 70, 50, 74, 84, 80, '보병', 'indeok', '방원'),

  // ── 대규모 보강: 위 · 조조·조비·사마의 계열 ──
  GN('xiahou_shang', '하후상', 82, 76, 74, 72, 70, '보병', 'gyeonsu', '방원학익', 'xuchang'),
  GN('xiahou_mao', '하후무', 60, 56, 58, 66, 64, '기병', 'gyeonsu', '어린', 'changan'),
  GN('xiahou_xuan', '하후현', 74, 66, 88, 82, 78, '보병', 'sinsan', '방원', 'luoyang'),
  GN('cao_tai', '조태', 68, 72, 52, 56, 58, '기병', 'dolgyeok', '봉시', 'chenliu'),
  GN('cao_shuang', '조상', 66, 58, 62, 72, 60, '보병', 'gyeonsu', '방원', 'luoyang'),
  GN('cao_xi', '조희', 58, 50, 66, 70, 58, '보병', 'gyeonsu', '방원', 'luoyang'),
  GN('cao_xun', '조훈', 56, 54, 52, 58, 52, '보병', 'gyeonsu', '어린', 'luoyang'),
  GN('cao_yan', '조언', 52, 48, 60, 64, 54, '보병', 'gyeonsu', '방원', 'luoyang'),
  GN('cao_zhang', '조창', 82, 90, 62, 50, 70, '기병', 'dolgyeok', '봉시', 'ye'),
  GN('cao_zhi', '조식', 40, 30, 86, 78, 80, '궁병', 'hollan', '방원', 'ye'),
  GN('wang_shuang', '왕쌍', 74, 88, 48, 42, 54, '기병', 'dolgyeok', '봉시', 'changan'),
  GN('chen_tai', '진태', 86, 72, 86, 80, 74, '보병', 'cheolbyeok', '방원학익', 'hongnong'),
  GN('chen_qun', '진군', 70, 40, 86, 92, 80, '궁병', 'gyeonsu', '방원', 'xuchang'),
  GN('sima_fu', '사마부', 74, 50, 84, 90, 78, '보병', 'gyeonsu', '방원', 'luoyang'),
  GN('wang_ling', '왕릉', 80, 70, 78, 80, 66, '보병', 'gyeonsu', '방원', 'shouchun'),
  GN('guanqiu_jian', '관구검', 82, 78, 76, 72, 68, '기병', 'dolgyeok', '봉시방원', 'shouchun'),
  GN('wen_qin', '문흠', 76, 82, 58, 52, 58, '기병', 'dolgyeok', '봉시', 'shouchun'),
  GN('wen_yang', '문앙', 84, 96, 60, 46, 72, '기병', 'yongmaeng', '봉시장사', 'shouchun'),
  GN('zhuge_dan', '제갈탄', 82, 76, 80, 76, 70, '보병', 'cheolbyeok', '방원', 'shouchun'),
  GN('zhuge_xu', '제갈서', 74, 68, 74, 70, 62, '보병', 'gyeonsu', '방원', 'luoyang'),
  GN('zhong_yao', '종요', 66, 40, 88, 94, 78, '궁병', 'gyeonsu', '방원', 'changan'),
  GN('hua_xin', '화흠', 56, 30, 82, 90, 74, '궁병', 'indeok', '방원', 'pingyuan'),
  GN('wang_lang', '왕랑', 58, 34, 80, 86, 72, '궁병', 'gyeonsu', '방원', 'xuchang'),
  GN('dong_zhao', '동소', 62, 40, 86, 88, 68, '궁병', 'hollan', '방원', 'xuchang'),
  GN('sun_li', '손례', 76, 74, 68, 70, 62, '보병', 'gyeonsu', '방원', 'ye'),
  GN('lu_yu', '노육', 60, 34, 80, 88, 70, '궁병', 'gyeonsu', '방원', 'beihai'),
  GN('meng_da', '맹달', 76, 72, 70, 66, 58, '보병', 'gyeonsu', '방원', 'xinye'),
  GN('xin_pi', '신비', 66, 48, 84, 82, 64, '궁병', 'gyeonsu', '방원', 'ye'),
  GN('yang_xiu', '양수', 58, 36, 90, 78, 60, '궁병', 'sinsan', '방원', 'hongnong'),
  GN('li_tong', '이통', 82, 84, 64, 62, 64, '보병', 'dolgyeok', '어린', 'jiangxia'),
  GN('jia_kui', '가규', 70, 60, 84, 84, 66, '궁병', 'gyeonsu', '방원', 'hongnong'),
  GN('wang_ji', '왕기', 86, 70, 84, 80, 68, '보병', 'cheolbyeok', '방원학익', 'shouchun'),
  GN('shi_bao', '석포', 74, 66, 74, 72, 62, '보병', 'gyeonsu', '방원', 'ye'),
  GN('hu_zhi', '호질', 78, 62, 76, 80, 64, '보병', 'gyeonsu', '방원', 'shouchun'),
  GN('hu_zun', '호준', 80, 76, 68, 66, 60, '보병', 'dolgyeok', '어린', 'wuwei'),
  GN('wang_chang', '왕창', 84, 66, 80, 82, 68, '보병', 'cheolbyeok', '방원', 'xiangyang'),
  GN('tian_yu', '전예', 86, 76, 80, 78, 70, '기병', 'cheolbyeok', '방원봉시', 'beiping'),
  GN('jia_chong', '가충', 60, 40, 86, 88, 58, '궁병', 'hollan', '방원', 'luoyang'),
  GN('wei_guan', '위관', 72, 54, 84, 86, 66, '보병', 'gyeonsu', '방원', 'luoyang'),
  GN('deng_zhong', '등충', 78, 82, 64, 58, 62, '기병', 'dolgyeok', '봉시', 'tianshui'),
  GN('shi_zhuan', '사찬', 66, 68, 56, 54, 50, '보병', 'dolgyeok', '어린', 'tianshui'),
  GN('qian_hong', '전속', 72, 70, 62, 58, 56, '보병', 'gyeonsu', '어린', 'wuwei'),
  GN('hu_lie', '호열', 76, 74, 64, 62, 58, '기병', 'dolgyeok', '봉시', 'longxi'),
  GN('cheng_ji', '성제', 50, 72, 36, 30, 34, '보병', 'dolgyeok', '어린', 'luoyang'),
  GN('qin_lang', '진랑', 70, 72, 60, 64, 62, '기병', 'dolgyeok', '봉시', 'xuchang'),
  GN('he_zhao', '학소', 84, 76, 78, 70, 64, '보병', 'gyeonsu', '방원', 'tianshui'),

  // ── 대규모 보강: 촉 · 유비·유선 계열 ──
  GN('liu_shan', '유선', 40, 32, 40, 52, 58, '보병', 'gyeonsu', '방원', 'chengdu'),
  GN('zhou_cang', '주창', 70, 84, 40, 34, 56, '보병', 'hogwi', '어린', 'jiangling'),
  GN('zhang_yi', '장억', 80, 76, 68, 64, 58, '보병', 'gyeonsu', '방원', 'hanzhong'),
  GN('chen_dao', '진도', 82, 80, 66, 60, 64, '보병', 'cheolbyeok', '방원', 'zitong'),
  GN('dong_yun', '동윤', 58, 34, 82, 88, 78, '궁병', 'gyeonsu', '방원', 'chengdu'),
  GN('qiao_zhou', '초주', 44, 22, 88, 82, 66, '궁병', 'gyeonsu', '방원', 'chengdu'),
  GN('liao_li', '요립', 60, 44, 82, 70, 56, '궁병', 'gyeonsu', '방원', 'changsha'),
  GN('liu_yan_shu', '유염', 66, 70, 52, 54, 58, '기병', 'dolgyeok', '봉시', 'jiangzhou'),
  GN('yang_yi', '양의', 66, 50, 82, 74, 54, '궁병', 'gyeonsu', '방원', 'xiangyang'),
  GN('zhuge_zhan', '제갈첨', 72, 62, 68, 66, 74, '보병', 'gyeonsu', '방원', 'chengdu'),
  GN('zhuge_shang', '제갈상', 68, 74, 54, 50, 60, '보병', 'dolgyeok', '어린', 'chengdu'),
  GN('huang_chong', '황숭', 58, 66, 54, 52, 58, '보병', 'gyeonsu', '어린', 'zitong'),
  GN('zhang_zun', '장준', 62, 60, 58, 60, 56, '보병', 'gyeonsu', '방원', 'hanzhong'),
  GN('fu_qian', '부첨', 76, 82, 60, 54, 62, '보병', 'cheolbyeok', '방원', 'hanzhong'),
  GN('luo_xian', '나헌', 84, 74, 78, 74, 70, '보병', 'cheolbyeok', '방원', 'jiangzhou'),
  GN('liu_ba', '유파', 54, 30, 86, 88, 64, '궁병', 'gyeonsu', '방원', 'chengdu'),
  GN('xu_jing', '허정', 46, 20, 80, 84, 82, '궁병', 'indeok', '방원', 'chengdu'),
  GN('mi_fang', '미방', 58, 54, 52, 66, 50, '보병', 'gyeonsu', '방원', 'jiangling'),
  GN('shi_ren', '사인', 56, 58, 44, 46, 42, '보병', 'gyeonsu', '어린', 'jiangling'),
  GN('zong_yu', '종예', 68, 58, 74, 76, 66, '보병', 'gyeonsu', '방원', 'hanzhong'),
  GN('xiang_lang', '상랑', 60, 40, 80, 86, 70, '궁병', 'gyeonsu', '방원', 'xiangyang'),
  GN('feng_xi', '풍습', 74, 68, 60, 56, 58, '보병', 'dolgyeok', '어린', 'jiangzhou'),
  GN('wu_ban', '오반', 74, 74, 58, 60, 58, '보병', 'gyeonsu', '방원', 'chengdu'),
  GN('chen_shi', '진식', 70, 72, 56, 52, 54, '보병', 'dolgyeok', '어린', 'hanzhong'),
  GN('meng_guang', '맹광', 54, 30, 78, 80, 64, '궁병', 'gyeonsu', '방원', 'chengdu'),
  GN('liu_min', '유민', 66, 60, 70, 72, 60, '보병', 'gyeonsu', '방원', 'hanzhong'),
  GN('zhang_nan', '장남', 72, 74, 54, 48, 52, '보병', 'dolgyeok', '어린', 'jiangzhou'),

  // ── 대규모 보강: 오 · 손책·손권 계열 ──
  GN('quan_cong', '전종', 80, 76, 68, 70, 68, '수군', 'sujeon', '방원', 'jianye'),
  GN('zhu_huan', '주환', 82, 84, 66, 62, 66, '수군', 'sujeon', '어린', 'wu'),
  GN('bu_zhi', '보즐', 78, 52, 84, 92, 76, '보병', 'gyeonsu', '방원', 'jianye'),
  GN('zhang_hong', '장굉', 54, 30, 84, 86, 76, '궁병', 'gyeonsu', '방원', 'kuaiji'),
  GN('sun_shao', '손소', 78, 78, 64, 66, 64, '수군', 'sujeon', '장사', 'jianye'),
  GN('ling_cao', '능조', 76, 82, 50, 44, 58, '수군', 'dolgyeok', '봉시', 'wu'),
  GN('lv_dai', '여대', 86, 70, 76, 78, 68, '수군', 'sujeon', '방원', 'jianye'),
  GN('zhu_ju', '주거', 70, 66, 72, 76, 62, '수군', 'gyeonsu', '방원', 'wu'),
  GN('wu_can', '오찬', 64, 48, 78, 82, 66, '궁병', 'gyeonsu', '방원', 'yuzhang'),
  GN('luo_tong', '낙통', 68, 50, 80, 78, 64, '수군', 'gyeonsu', '방원', 'kuaiji'),
  GN('shi_yi_wu', '시의', 60, 34, 78, 84, 76, '궁병', 'indeok', '방원', 'jianye'),
  GN('sun_jing', '손정', 68, 62, 62, 66, 64, '수군', 'gyeonsu', '방원', 'wu'),
  GN('sun_ben', '손분', 72, 74, 52, 60, 58, '수군', 'dolgyeok', '어린', 'jianye'),
  GN('sun_yi', '손익', 74, 80, 52, 56, 62, '수군', 'dolgyeok', '봉시', 'wu'),
  GN('wu_jing', '오경', 70, 66, 60, 64, 58, '수군', 'gyeonsu', '방원', 'jianye'),
  GN('kan_ze', '감택', 54, 32, 82, 84, 74, '궁병', 'gyeonsu', '방원', 'kuaiji'),
  GN('xue_zong', '설종', 52, 34, 80, 82, 72, '궁병', 'gyeonsu', '방원', 'kuaiji'),
  GN('yan_jun', '엄준', 50, 30, 78, 80, 72, '궁병', 'gyeonsu', '방원', 'kuaiji'),
  GN('zhang_wen', '장온', 56, 40, 80, 74, 70, '궁병', 'gyeonsu', '방원', 'wu'),
  GN('liu_zan', '유찬', 76, 84, 48, 40, 58, '보병', 'dolgyeok', '어린', 'yuzhang'),
  GN('tang_zi', '당자', 70, 74, 56, 52, 54, '수군', 'gyeonsu', '방원', 'lujiang'),
  GN('lu_kai', '육개', 76, 62, 82, 84, 74, '수군', 'gyeonsu', '방원', 'wu'),
  GN('shi_hui', '사휘', 58, 62, 54, 58, 54, '보병', 'gyeonsu', '어린', 'nanhai'),
  GN('sun_jiao', '손교', 78, 72, 66, 70, 68, '수군', 'sujeon', '방원', 'lujiang'),
  GN('wu_yan', '오언', 70, 72, 60, 58, 58, '수군', 'gyeonsu', '방원', 'yuzhang'),
  GN('tao_jun', '도준', 66, 60, 62, 60, 56, '수군', 'gyeonsu', '방원', 'jianye'),

  // ── 대규모 보강: 군벌·후한·황건·재야·이민족 ──
  GN('pei_yuanshao', '배원소', 56, 64, 40, 34, 44, '보병', 'dolgyeok', '어린', 'xiaopei'),
  GN('qiu_liju', '구력거', 78, 80, 54, 50, 62, '기병', 'dolgyeok', '봉시', 'xiangping'),
  GN('ta_dun', '답돈', 80, 82, 50, 44, 60, '기병', 'dolgyeok', '봉시', 'beiping'),
  GN('nan_lou', '난루', 70, 72, 48, 48, 54, '기병', 'gyeonsu', '어린', 'xiangping'),
  GN('lou_ban', '누반', 66, 70, 46, 44, 50, '기병', 'dolgyeok', '어린', 'xiangping'),
  GN('liu_qi', '유기', 62, 52, 68, 72, 74, '수군', 'gyeonsu', '방원', 'jiangxia'),
  GN('wu_lan', '오란', 70, 76, 48, 44, 48, '보병', 'dolgyeok', '어린', 'zitong'),
  GN('cheng_gongying', '성공영', 72, 50, 82, 76, 64, '궁병', 'sinsan', '방원', 'longxi'),
  GN('dailai_dongzhu', '대래동주', 70, 64, 60, 52, 66, '보병', 'gyeonsu', '방원', 'jiaozhi'),
  GN('tasa_daiwang', '타사대왕', 74, 70, 66, 50, 60, '보병', 'hollan', '방원', 'nanhai'),
  GN('mulok_daiwang', '목록대왕', 82, 72, 52, 40, 64, '보병', 'sinsan', '방원', 'nanhai'),
  GN('meng_you', '맹우', 70, 72, 48, 44, 58, '보병', 'dolgyeok', '어린', 'jiaozhi'),
  GN('mang_yazhang', '망아장', 76, 82, 40, 32, 48, '보병', 'dolgyeok', '어린', 'jiaozhi'),
  GN('dong_tuona', '동도나', 66, 68, 46, 40, 50, '보병', 'gyeonsu', '어린', 'nanhai'),
  GN('ahuinan', '아회남', 64, 66, 44, 38, 48, '보병', 'gyeonsu', '어린', 'nanhai'),
  GN('geumhwan_samgyeol', '금환삼결', 70, 76, 38, 30, 46, '보병', 'dolgyeok', '어린', 'jiaozhi'),
  GN('sima_hui', '사마휘', 40, 20, 94, 88, 90, '궁병', 'sinsan', '방원', 'xiangyang'),
  GN('hua_tuo', '화타', 30, 24, 90, 70, 86, '궁병', 'chiryo', '방원', 'runan'),
  GN('zuo_ci', '좌자', 34, 30, 88, 60, 78, '궁병', 'hollan', '방원', 'lujiang'),
  GN('yu_ji', '우길', 40, 26, 86, 72, 88, '궁병', 'chiryo', '방원', 'kuaiji'),
  GN('mi_heng', '예형', 30, 22, 88, 50, 70, '궁병', 'hollan', '방원', 'linzi'),
  GN('huang_chengyan', '황승언', 44, 30, 86, 80, 76, '궁병', 'gyeonsu', '방원', 'xiangyang'),
  GN('pang_degong', '방덕공', 40, 26, 88, 84, 82, '궁병', 'sinsan', '방원', 'xiangyang'),
  GN('cui_zhouping', '최주평', 42, 34, 80, 74, 70, '궁병', 'gyeonsu', '방원', 'xiangyang'),
  GN('shi_guangyuan', '석광원', 40, 30, 78, 72, 68, '궁병', 'gyeonsu', '방원', 'xiangyang'),
  GN('meng_gongwei', '맹공위', 44, 36, 80, 74, 68, '궁병', 'gyeonsu', '방원', 'xiangyang'),
  GN('guan_ning', '관녕', 38, 26, 86, 82, 84, '궁병', 'indeok', '방원', 'beihai'),
  GN('bing_yuan', '병원', 42, 30, 80, 78, 74, '궁병', 'gyeonsu', '방원', 'beihai'),
  GN('chen_lin', '진림', 40, 26, 84, 76, 72, '궁병', 'hollan', '방원', 'guangling'),
  GN('wang_can', '왕찬', 34, 22, 84, 82, 74, '궁병', 'gyeonsu', '방원', 'chenliu'),
  GN('liu_zhen', '유정', 36, 30, 76, 70, 68, '궁병', 'gyeonsu', '방원', 'pingyuan'),
  GN('han_fu', '한복', 52, 40, 64, 76, 66, '보병', 'gyeonsu', '방원', 'nanpi'),
  GN('liu_dai', '유대', 58, 56, 60, 66, 62, '보병', 'gyeonsu', '방원', 'puyang'),
  GN('bao_xin', '포신', 74, 72, 64, 66, 66, '보병', 'cheolbyeok', '방원', 'puyang'),
  GN('zhang_miao', '장막', 64, 58, 70, 72, 62, '보병', 'gyeonsu', '방원', 'chenliu'),
  GN('xu_shao', '허소', 30, 20, 82, 70, 74, '궁병', 'gyeonsu', '방원', 'runan'),
  GN('qiao_mao', '교모', 56, 50, 56, 66, 60, '보병', 'gyeonsu', '어린', 'puyang'),
  GN('han_hyeon', '한현', 54, 58, 48, 52, 48, '보병', 'gyeonsu', '어린', 'changsha'),
  GN('liu_du', '유도', 50, 44, 52, 60, 56, '보병', 'gyeonsu', '어린', 'jiangling'),
  GN('zhao_fan', '조범', 52, 54, 50, 54, 52, '보병', 'gyeonsu', '어린', 'guiyang'),
  GN('jin_xuan', '금선', 60, 66, 50, 52, 50, '보병', 'dolgyeok', '어린', 'jiangxia'),
  GN('gong_zhi', '공지', 54, 48, 70, 72, 62, '보병', 'gyeonsu', '방원', 'jiangling'),
  GN('xing_daorong', '형도영', 66, 82, 34, 30, 44, '보병', 'dolgyeok', '봉시', 'jiangling'),
  GN('liu_xian', '유현', 48, 52, 44, 48, 46, '보병', 'gyeonsu', '어린', 'jiangling'),
  GN('chen_ying', '진응', 58, 66, 40, 38, 42, '보병', 'dolgyeok', '어린', 'guiyang'),
  GN('bao_long', '포륭', 56, 64, 38, 36, 40, '보병', 'dolgyeok', '어린', 'guiyang'),
  GN('song_jian', '송건', 66, 70, 50, 48, 54, '기병', 'gyeonsu', '어린', 'wuwei'),
  GN('zhang_yan', '장연', 80, 78, 64, 58, 66, '기병', 'dolgyeok', '봉시', 'jinyang'),
  GN('yu_du', '우독', 66, 70, 42, 38, 44, '보병', 'dolgyeok', '어린', 'jinyang'),
  GN('sui_gu', '수고', 62, 68, 40, 36, 42, '보병', 'dolgyeok', '어린', 'jinyang'),
  GN('he_yi', '하의', 60, 62, 38, 34, 46, '보병', 'gyeonsu', '어린', 'runan'),
  GN('huang_shao', '황소', 64, 68, 40, 36, 44, '보병', 'dolgyeok', '어린', 'runan'),
  GN('liu_yu', '유우', 70, 50, 78, 88, 86, '보병', 'indeok', '방원', 'beiping'),
  GN('gongsun_kang', '공손강', 70, 64, 70, 72, 62, '기병', 'gyeonsu', '방원', 'xiangping'),
  GN('gongsun_gong', '공손공', 50, 44, 54, 62, 56, '기병', 'gyeonsu', '어린', 'xiangping'),
  GN('han_xian', '한섬', 70, 76, 48, 42, 46, '기병', 'dolgyeok', '봉시', 'hongnong'),
  GN('li_su', '이숙', 64, 70, 56, 52, 54, '기병', 'dolgyeok', '어린', 'changan'),
  GN('hu_zhen', '호진', 70, 72, 50, 46, 48, '기병', 'gyeonsu', '어린', 'changan'),
  GN('ke_bineng', '가비능', 80, 86, 46, 38, 56, '기병', 'dolgyeok', '봉시', 'wuwei'),
  GN('kuai_liang', '괴량', 62, 38, 86, 88, 74, '궁병', 'sinsan', '방원', 'xiangyang'),
];

export const GENERAL_BY_ID = Object.fromEntries(GENERALS.map((g) => [g.id, g]));

export const ARMS = ['보병', '궁병', '기병', '수군'];

/* 보물 14종 — 능력치 보정과 매력·충성 보너스. 탐색·순찰·포로 처분·세력 멸망으로 얻는다 */
export const TREASURES = [
  { id: 'jeoktoma', ko: '적토마', kind: '말', bonus: { lead: 4, cha: 1 }, desc: '하루에 천 리를 달린다는 붉은 명마. 통솔이 오르고 군이 빨라진다.' },
  { id: 'jeokro', ko: '적로', kind: '말', bonus: { lead: 3, cha: 2 }, desc: '주인에게 복을 부른다는 명마. 사람을 끄는 힘이 있다.' },
  { id: 'uicheon', ko: '의천검', kind: '무기', bonus: { war: 5, cha: 1 }, desc: '조조가 늘 곁에 두던 보검. 무력과 위엄이 오른다.' },
  { id: 'cheongryong', ko: '청룡언월도', kind: '무기', bonus: { war: 7 }, desc: '관우의 큰 도. 한 번 휘두르면 앞을 막는 자가 없다.' },
  { id: 'jangpal', ko: '장팔사모', kind: '무기', bonus: { war: 7 }, desc: '장비의 긴 창. 성벽을 넘길 만큼 길다.' },
  { id: 'bangcheon', ko: '방천화극', kind: '무기', bonus: { war: 8 }, desc: '여포의 극. 천하에 견줄 자가 없다.' },
  { id: 'chilseong', ko: '칠성도', kind: '무기', bonus: { war: 5, lead: 1 }, desc: '북두칠성의 빛을 담았다는 칼. 기세가 오른다.' },
  { id: 'sonja', ko: '손자병법', kind: '서적', bonus: { int: 6, lead: 2 }, desc: '병법의 정수를 담은 책. 지력과 통솔이 오른다.' },
  { id: 'taepyeong', ko: '태평요술서', kind: '서적', bonus: { int: 5, cha: 2 }, desc: '태평도의 비술이 적힌 책. 사람을 홀리는 힘이 있다.' },
  { id: 'maengdeok', ko: '맹덕신서', kind: '서적', bonus: { int: 5, pol: 2 }, desc: '조조가 지었다는 병서. 지력과 정치가 오른다.' },
  { id: 'cheongnang', ko: '청낭서', kind: '서적', bonus: { int: 4, cha: 3 }, desc: '명의가 남긴 의서. 병을 돌보는 이름이 퍼진다.' },
  { id: 'okse', ko: '옥새', kind: '보물', bonus: { cha: 6 }, loyal: 4, desc: '천자의 인장. 지닌 자의 위엄이 오르고 충성이 붙는다.' },
  { id: 'yongrin', ko: '용린갑', kind: '갑옷', bonus: { lead: 3, war: 3 }, desc: '용의 비늘을 엮은 갑옷. 지휘와 무력이 오른다.' },
  { id: 'myeonggwang', ko: '명광개', kind: '갑옷', bonus: { lead: 4, war: 2 }, desc: '빛을 되쏘는 투구와 갑옷. 군의 사기가 오른다.' },
];

export const TREASURE_BY_ID = Object.fromEntries(TREASURES.map((t) => [t.id, t]));

/* 처음부터 이름난 장수가 지니고 시작하는 보물 — 그 장수가 없는 시나리오에서는 행방을 찾아야 한다 */
export const TREASURE_OWNERS = {
  jeoktoma: 'lu_bu', bangcheon: 'lu_bu', cheongryong: 'guan_yu', jangpal: 'zhang_fei',
  uicheon: 'cao_cao', sonja: 'sun_jian', taepyeong: 'zhang_jue', maengdeok: 'cao_pi',
  okse: 'dong_zhuo', jeokro: 'liu_bei', chilseong: 'ma_chao', yongrin: 'zhao_yun', myeonggwang: 'dian_wei',
};

export const TREASURE_STAT_KO = { lead: '통솔', war: '무력', int: '지력', pol: '정치', cha: '매력' };

/* 세력 색상 */
export const FACTION_COLORS = {
  jojo: '#3f6fb5', // 위 - 청
  liubei: '#3f9b6b', // 촉 - 녹
  sunquan: '#c2453f', // 오 - 적
  lubu: '#8a5cc4',
  yuanshao: '#c08a3e',
  liubiao: '#4a9a9a',
  liuzhang: '#a8a04a',
  mateng: '#b06a3a',
  gongsunzan: '#6a7fb0',
  yuanshu: '#b04a8a',
  zhanglu: '#9a7a5a',
  taoqian: '#c0a05a',
  liuyao: '#6a8ab0',
  hansui: '#a06a30',
  gongsundu: '#5a8f9a',
  shixie: '#5a9a6a',
  kong_rong: '#7a9a6a',
  li_jue: '#8a4a3a',
  han: '#c9b26a',
  hwanggeon: '#d8a028',
  dongzhuo: '#8a3a4a',
  sunjian: '#c2453f',
  liuyan: '#8a9a5a',
  nanman: '#4f8a5a',
  free: '#6b6b6b',
};

/* 신군주(신세력) 세력 색 팔레트 — 기존 세력과 겹치지 않는 선명한 8색 */
export const CUSTOM_COLORS = [
  { id: 'crimson', ko: '주홍', hex: '#d1495b' },
  { id: 'azure', ko: '청람', hex: '#2f7fd0' },
  { id: 'jade', ko: '비취', hex: '#2fa46a' },
  { id: 'violet', ko: '자주', hex: '#8a5cc4' },
  { id: 'amber', ko: '호박', hex: '#d59b2a' },
  { id: 'teal', ko: '청록', hex: '#2aa0a0' },
  { id: 'rose', ko: '장미', hex: '#c8548f' },
  { id: 'slate', ko: '흑철', hex: '#6b7f9a' },
];

/* 깃발 글자 프리셋 — 한글 1자 */
export const CUSTOM_MARKS = ['신', '한', '이', '용', '별', '천', '호', '풍', '월', '검'];

/* 신군주 초상화 프리셋 — 도트 초상화 생성기의 스타일 값 */
export const PORTRAIT_HATS = [
  { id: 0, ko: '투구' }, { id: 1, ko: '관모' }, { id: 2, ko: '두건' },
  { id: 3, ko: '상투' }, { id: 4, ko: '전립' },
];
export const PORTRAIT_BEARDS = [
  { id: 0, ko: '없음' }, { id: 1, ko: '수염' }, { id: 2, ko: '구레나룻' }, { id: 3, ko: '장수염' },
];
export const PORTRAIT_SKINS = [
  { id: 0, ko: '밝음' }, { id: 1, ko: '보통' }, { id: 2, ko: '구릿빛' }, { id: 3, ko: '거무스름' },
];

/* 시나리오 */
export const SCENARIOS = [
  {
    id: 's184',
    year: 184,
    name: '황건의 난',
   
    desc: '태평도 장각이 “창천이 죽고 황천이 선다”며 봉기했다. 삿갓 쓴 백성이 기주·연주를 뒤덮고, 한실은 하진과 황보숭을 내세워 막아선다.',
    factions: [
      { id: 'hwanggeon', name: '황건적', lord: 'zhang_jue', cities: ['julu', 'ye', 'pingyuan', 'puyang', 'chenliu', 'nanpi', 'linzi'],
        generals: ['zhang_jue', 'zhang_bao', 'zhang_liang', 'bo_cai', 'zhang_mancheng', 'guan_hai'] },
      { id: 'han', name: '한실', lord: 'he_jin', cities: ['luoyang', 'hongnong', 'changan', 'xuchang', 'runan'],
        generals: ['he_jin', 'huangfu_song', 'lu_zhi', 'zhu_jun', 'wang_yun', 'liu_ye', 'mao_jie', 'xun_yu', 'zhu_ling', 'liu_yu', 'xu_shao', 'qiao_mao'] },
      { id: 'dongzhuo', name: '동탁', lord: 'dong_zhuo', cities: ['jinyang', 'tianshui', 'longxi', 'wuwei'],
        generals: ['dong_zhuo', 'li_ru', 'hua_xiong', 'niu_fu', 'xu_rong', 'li_jue', 'guo_si', 'zhang_ji', 'fan_chou', 'hu_zhen'] },
      { id: 'yuanshao', name: '원소', lord: 'yuan_shao', cities: ['ji'],
        generals: ['yuan_shao', 'yuan_tan', 'yuan_shang', 'yan_liang', 'wen_chu', 'ju_shou', 'tian_feng', 'feng_ji', 'guo_tu', 'shen_pei', 'xu_you', 'chunyu_qiong', 'gao_gan'] },
      { id: 'gongsunzan', name: '공손찬', lord: 'gongsun_zan', cities: ['beiping', 'xiangping'],
        generals: ['gongsun_zan', 'gongsun_yue', 'gongsun_fan', 'shan_jing', 'tian_kai', 'yan_gang', 'guan_jing', 'zou_dan', 'zhao_yun'] },
      { id: 'sunjian', name: '손견', lord: 'sun_jian', cities: ['changsha', 'jiangxia'],
        generals: ['sun_jian', 'cheng_pu', 'huang_gai', 'han_dang', 'zhu_zhi'] },
      { id: 'liubiao', name: '유표', lord: 'liu_biao', cities: ['xiangyang', 'jiangling', 'xinye', 'guiyang'],
        generals: ['liu_biao', 'cai_mao', 'kuai_yue', 'huang_zu', 'zhang_yun', 'han_song', 'cai_xun', 'huang_zhong', 'kuai_liang'] },
      { id: 'taoqian', name: '도겸', lord: 'tao_qian', cities: ['xiapi', 'pengcheng', 'xiaopei', 'guangling', 'beihai'],
        generals: ['tao_qian', 'cao_bao', 'chen_deng', 'chen_gui'] },
      { id: 'liuyao', name: '유요', lord: 'liu_yao', cities: ['shouchun', 'lujiang', 'jianye', 'wu', 'kuaiji', 'yuzhang'],
        generals: ['liu_yao', 'zhang_ying', 'fan_neng', 'yu_mi'] },
      { id: 'liuyan', name: '유언', lord: 'liu_yan', cities: ['chengdu', 'zitong', 'jiangzhou'],
        generals: ['liu_yan', 'zhang_ren', 'zhang_song', 'huang_quan', 'lei_tong', 'ling_bao', 'deng_xian', 'liu_gui', 'yang_huai', 'gao_pei', 'wu_yi'] },
      { id: 'zhanglu', name: '장로', lord: 'zhang_lu', cities: ['hanzhong'],
        generals: ['zhang_lu', 'zhang_wei', 'yang_ren', 'yan_pu', 'yang_bo'] },
      { id: 'shixie', name: '사섭', lord: 'shi_xie', cities: ['nanhai', 'jiaozhi'], generals: ['shi_xie', 'shi_yi'] },
    ],
    free: {
      luoyang: ['cao_cao'],
      ji: ['liu_bei', 'guan_yu', 'zhang_fei', 'zhang_yan', 'yu_du', 'sui_gu'],
      jinyang: ['ding_yuan'],
      lujiang: ['sun_ce', 'zuo_ci'],
      beiping: ['taishi_ci', 'ta_dun'],
      xiangping: ['qiu_liju', 'nan_lou', 'lou_ban', 'gongsun_kang', 'gongsun_gong'],
      xiangyang: ['sima_hui', 'pang_degong', 'cui_zhouping', 'shi_guangyuan', 'meng_gongwei', 'huang_chengyan'],
      runan: ['hua_tuo', 'he_yi', 'huang_shao'],
      kuaiji: ['yu_ji'],
      linzi: ['mi_heng', 'guan_ning', 'bing_yuan'],
      guangling: ['chen_lin'],
      chenliu: ['wang_can', 'zhang_miao', 'bao_xin'],
      pingyuan: ['liu_zhen'],
      nanpi: ['han_fu'],
      puyang: ['liu_dai'],
      xiaopei: ['pei_yuanshao'],
      changsha: ['han_hyeon', 'xing_daorong'],
      guiyang: ['zhao_fan', 'chen_ying'],
      jiangling: ['liu_du', 'liu_xian'],
      jiangxia: ['jin_xuan', 'gong_zhi', 'bao_long'],
    },
  },
  {
    id: 's189',
    year: 189,
    name: '반동탁 연합',
   
    desc: '동탁이 소제를 폐하고 낙양을 불태웠다. 원소를 맹주로 열여덟 제후가 들고일어나지만, 각자의 셈은 이미 달랐다.',
    factions: [
      { id: 'dongzhuo', name: '동탁', lord: 'dong_zhuo', cities: ['luoyang', 'hongnong', 'changan', 'xuchang'],
        generals: ['dong_zhuo', 'li_ru', 'hua_xiong', 'niu_fu', 'xu_rong', 'li_jue', 'guo_si', 'zhang_ji', 'fan_chou', 'yang_feng', 'lu_bu', 'chen_gong', 'gao_shun', 'zhang_liao', 'zang_ba', 'wei_xu', 'hou_cheng', 'song_xian', 'cao_xing', 'hao_meng', 'li_su', 'hu_zhen'] },
      { id: 'yuanshao', name: '원소', lord: 'yuan_shao', cities: ['ye', 'nanpi', 'julu', 'jinyang', 'ji', 'linzi'],
        generals: ['yuan_shao', 'yuan_tan', 'yuan_shang', 'yan_liang', 'wen_chu', 'ju_shou', 'tian_feng', 'feng_ji', 'guo_tu', 'shen_pei', 'xu_you', 'chunyu_qiong', 'gao_gan', 'zhang_he', 'gao_lan', 'zhang_yang'] },
      { id: 'jojo', name: '조조', lord: 'cao_cao', cities: ['chenliu', 'puyang'],
        generals: ['cao_cao', 'xiahou_dun', 'xiahou_yuan', 'cao_ren', 'cao_hong', 'yue_jin', 'yu_jin', 'dian_wei', 'xun_yu', 'xun_you', 'cheng_yu', 'man_chong', 'mao_jie', 'cao_chun', 'cao_xiu', 'lv_qian', 'li_dian', 'zhu_ling', 'cao_ang', 'wei_yan', 'bao_xin'] },
      { id: 'sunjian', name: '손견', lord: 'sun_jian', cities: ['changsha', 'jiangxia'],
        generals: ['sun_jian', 'sun_ce', 'cheng_pu', 'huang_gai', 'han_dang', 'zhu_zhi', 'sun_quan'] },
      { id: 'liubei', name: '유비', lord: 'liu_bei', cities: ['pingyuan'],
        generals: ['liu_bei', 'guan_yu', 'zhang_fei', 'zhao_yun', 'sun_qian', 'mi_zhu', 'jian_yong'] },
      { id: 'gongsunzan', name: '공손찬', lord: 'gongsun_zan', cities: ['beiping', 'xiangping'],
        generals: ['gongsun_zan', 'gongsun_yue', 'gongsun_fan', 'shan_jing', 'tian_kai', 'yan_gang', 'guan_jing', 'zou_dan'] },
      { id: 'liubiao', name: '유표', lord: 'liu_biao', cities: ['xiangyang', 'jiangling', 'xinye', 'guiyang'],
        generals: ['liu_biao', 'cai_mao', 'kuai_yue', 'huang_zu', 'zhang_yun', 'han_song', 'cai_xun', 'yi_ji', 'huang_zhong', 'kuai_liang'] },
      { id: 'taoqian', name: '도겸', lord: 'tao_qian', cities: ['xiapi', 'pengcheng', 'xiaopei', 'guangling', 'beihai'],
        generals: ['tao_qian', 'cao_bao', 'chen_deng', 'chen_gui'] },
      { id: 'yuan_shu', name: '원술', lord: 'yuan_shu', cities: ['runan', 'shouchun'],
        generals: ['yuan_shu', 'ji_ling', 'zhang_xun', 'qiao_rui', 'lei_bao', 'chen_lan', 'yang_hong', 'yan_xiang'] },
      { id: 'liuyao', name: '유요', lord: 'liu_yao', cities: ['lujiang', 'jianye', 'wu', 'kuaiji', 'yuzhang'],
        generals: ['liu_yao', 'zhang_ying', 'fan_neng', 'yu_mi', 'taishi_ci'] },
      { id: 'liuyan', name: '유언', lord: 'liu_yan', cities: ['chengdu', 'zitong', 'jiangzhou'],
        generals: ['liu_yan', 'zhang_ren', 'zhang_song', 'huang_quan', 'lei_tong', 'ling_bao', 'deng_xian', 'liu_gui', 'yang_huai', 'gao_pei', 'wu_yi', 'fa_zheng', 'li_yan', 'liu_ba'] },
      { id: 'zhanglu', name: '장로', lord: 'zhang_lu', cities: ['hanzhong'],
        generals: ['zhang_lu', 'zhang_wei', 'yang_ren', 'yan_pu', 'yang_song', 'yang_bo'] },
      { id: 'mateng', name: '마등', lord: 'ma_teng', cities: ['wuwei', 'tianshui', 'longxi'],
        generals: ['ma_teng', 'ma_chao', 'pang_de', 'ma_xiu', 'ma_tie', 'ma_dai', 'han_sui', 'cheng_yi', 'hou_xuan', 'liang_xing', 'yan_xing'] },
      { id: 'shixie', name: '사섭', lord: 'shi_xie', cities: ['nanhai', 'jiaozhi'], generals: ['shi_xie', 'shi_yi'] },
    ],
    free: {
      linzi: ['kong_rong', 'wu_anguo', 'mi_heng', 'guan_ning', 'bing_yuan'],
      xuchang: ['xu_chu', 'guo_jia', 'jia_xu'],
      luoyang: ['sima_yi', 'liu_ye'],
      xiangyang: ['zhuge_liang', 'pang_tong', 'sima_hui', 'pang_degong', 'cui_zhouping', 'shi_guangyuan', 'meng_gongwei', 'huang_chengyan'],
      jiangxia: ['lu_xun'],
      beiping: ['liu_yu', 'ta_dun'],
      xiangping: ['qiu_liju', 'nan_lou', 'lou_ban', 'gongsun_kang', 'gongsun_gong'],
      runan: ['hua_tuo', 'he_yi', 'huang_shao'],
      kuaiji: ['yu_ji'],
      guangling: ['chen_lin'],
      chenliu: ['wang_can', 'zhang_miao'],
      pingyuan: ['liu_zhen'],
      nanpi: ['han_fu'],
      puyang: ['liu_dai'],
      xiaopei: ['pei_yuanshao'],
      changsha: ['han_hyeon', 'xing_daorong'],
      guiyang: ['zhao_fan', 'chen_ying'],
      jiangling: ['liu_du', 'liu_xian'],
      jinyang: ['zhang_yan', 'yu_du', 'sui_gu', 'ding_yuan'],
    },
  },

  {
    id: 's194',
    year: 194,
    name: '군웅할거',
   
    desc: '동탁이 죽고 천하가 쪼개졌다. 조조는 연주에서 여포와 맞서고, 원소는 기주를 움켜쥐었다. 유비는 서주에 몸을 붙였다.',
    factions: [
      { id: 'jojo', name: '조조', lord: 'cao_cao', cities: ['xuchang', 'chenliu'], gold: 0,
        generals: ['cao_cao', 'xiahou_dun', 'xiahou_yuan', 'cao_ren', 'cao_hong', 'yue_jin', 'yu_jin', 'dian_wei', 'xun_yu', 'xun_you', 'cheng_yu', 'man_chong', 'mao_jie', 'cao_chun', 'cao_xiu', 'lv_qian', 'li_dian', 'zhu_ling'] },
      { id: 'lubu', name: '여포', lord: 'lu_bu', cities: ['puyang'],
        generals: ['lu_bu', 'chen_gong', 'gao_shun', 'zhang_liao', 'zang_ba', 'wei_xu', 'hou_cheng', 'song_xian', 'cao_xing', 'hao_meng'] },
      { id: 'yuanshao', name: '원소', lord: 'yuan_shao', cities: ['ye', 'nanpi', 'pingyuan', 'julu', 'jinyang'],
        generals: ['yuan_shao', 'yuan_tan', 'yuan_shang', 'yan_liang', 'wen_chu', 'ju_shou', 'tian_feng', 'feng_ji', 'guo_tu', 'shen_pei', 'xu_you', 'chunyu_qiong', 'lv_kuang', 'lv_xiang', 'yuan_xi', 'gao_gan', 'zhang_he', 'gao_lan'] },
      { id: 'gongsunzan', name: '공손찬', lord: 'gongsun_zan', cities: ['ji', 'beiping'],
        generals: ['gongsun_zan', 'gongsun_yue', 'gongsun_fan', 'shan_jing', 'tian_kai', 'yan_gang', 'guan_jing', 'zou_dan'] },
      { id: 'gongsundu', name: '공손도', lord: 'gongsun_du', cities: ['xiangping'], generals: ['gongsun_du'] },
      { id: 'liubei', name: '유비', lord: 'liu_bei', cities: ['xiaopei'],
        generals: ['liu_bei', 'guan_yu', 'zhang_fei', 'sun_qian', 'mi_zhu', 'jian_yong'] },
      { id: 'taoqian', name: '도겸', lord: 'tao_qian', cities: ['xiapi', 'pengcheng', 'guangling'],
        generals: ['tao_qian', 'cao_bao', 'chen_deng', 'chen_gui'] },
      { id: 'kong_rong', name: '공융', lord: 'kong_rong', cities: ['beihai', 'linzi'],
        generals: ['kong_rong', 'wu_anguo'] },
      { id: 'li_jue', name: '이각', lord: 'li_jue', cities: ['changan', 'hongnong', 'luoyang'],
        generals: ['li_jue', 'guo_si', 'zhang_ji', 'fan_chou', 'yang_feng'] },
      { id: 'sunce', name: '손책', lord: 'sun_ce', cities: ['jianye', 'wu', 'kuaiji'],
        generals: ['sun_ce', 'zhou_yu', 'cheng_pu', 'huang_gai', 'han_dang', 'zhang_zhao', 'jiang_qin', 'zhu_zhi', 'sun_quan', 'lv_fan', 'sun_jing', 'sun_ben', 'wu_jing'] },
      { id: 'liuyao', name: '유요', lord: 'liu_yao', cities: ['lujiang'],
        generals: ['liu_yao', 'taishi_ci', 'zhang_ying', 'fan_neng', 'yu_mi'] },
      { id: 'yuan_shu', name: '원술', lord: 'yuan_shu', cities: ['shouchun', 'runan', 'yuzhang'],
        generals: ['yuan_shu', 'ji_ling', 'zhang_xun', 'qiao_rui', 'lei_bao', 'chen_lan', 'yang_hong', 'yan_xiang'] },
      { id: 'liubiao', name: '유표', lord: 'liu_biao', cities: ['xiangyang', 'jiangling', 'jiangxia', 'changsha', 'guiyang', 'xinye'],
        generals: ['liu_biao', 'cai_mao', 'kuai_yue', 'huang_zu', 'wen_pin', 'zhang_yun', 'han_song', 'cai_xun', 'yi_ji', 'liu_cong', 'huang_zhong', 'wei_yan', 'kuai_liang', 'liu_qi', 'han_hyeon'] },
      { id: 'liuzhang', name: '유장', lord: 'liu_zhang', cities: ['chengdu', 'zitong', 'jiangzhou'],
        generals: ['liu_zhang', 'zhang_ren', 'zhang_song', 'huang_quan', 'lei_tong', 'ling_bao', 'deng_xian', 'liu_gui', 'yang_huai', 'gao_pei', 'fa_zheng', 'wu_yi', 'li_yan', 'wu_lan'] },
      { id: 'zhanglu', name: '장로', lord: 'zhang_lu', cities: ['hanzhong'],
        generals: ['zhang_lu', 'zhang_wei', 'yang_ren', 'yan_pu', 'yang_song', 'yang_bo'] },
      { id: 'mateng', name: '마등', lord: 'ma_teng', cities: ['wuwei', 'tianshui'],
        generals: ['ma_teng', 'ma_chao', 'pang_de', 'ma_xiu', 'ma_tie', 'ma_dai'] },
      { id: 'hansui', name: '한수', lord: 'han_sui', cities: ['longxi'],
        generals: ['han_sui', 'cheng_yi', 'hou_xuan', 'liang_xing', 'yan_xing'] },
      { id: 'shixie', name: '사섭', lord: 'shi_xie', cities: ['nanhai', 'jiaozhi'], generals: ['shi_xie', 'shi_yi'] },
    ],
    free: {
      beiping: ['zhao_yun', 'ta_dun'],
      jiangxia: ['gan_ning'],
      chenliu: ['sima_yi', 'liu_ye', 'wang_can', 'zhang_miao'],
      xuchang: ['xu_chu', 'guo_jia', 'jia_xu', 'hua_tuo'],
      xiangyang: ['zhuge_liang', 'pang_tong', 'sima_hui', 'pang_degong', 'cui_zhouping', 'shi_guangyuan', 'meng_gongwei', 'huang_chengyan'],
      chengdu: ['lu_xun'],
      linzi: ['mi_heng', 'guan_ning', 'bing_yuan'],
      kuaiji: ['yu_ji'],
      guangling: ['chen_lin'],
      pingyuan: ['liu_zhen'],
      nanpi: ['han_fu'],
      puyang: ['liu_dai', 'pei_yuanshao'],
      runan: ['he_yi', 'huang_shao'],
      jinyang: ['zhang_yan', 'yu_du', 'sui_gu'],
      xiangping: ['qiu_liju', 'nan_lou', 'lou_ban', 'gongsun_kang', 'gongsun_gong'],
      guiyang: ['zhao_fan', 'chen_ying'],
      jiangling: ['liu_du', 'liu_xian'],
      changsha: ['xing_daorong'],
      lujiang: ['zuo_ci'],
    },
  },
  {
    id: 's200',
    year: 200,
    name: '관도대전',
   
    desc: '하북의 원소와 중원의 조조가 황하를 사이에 두고 격돌한다. 서주에는 유비가, 강동에는 손권이 자리한다.',
    factions: [
      { id: 'jojo', name: '조조', lord: 'cao_cao', cities: ['xuchang', 'luoyang', 'chenliu', 'hongnong', 'puyang', 'runan', 'linzi', 'beihai', 'guangling'],
        generals: ['cao_cao', 'xiahou_dun', 'xiahou_yuan', 'cao_ren', 'cao_hong', 'xu_huang', 'yue_jin', 'yu_jin', 'xu_chu', 'xun_yu', 'xun_you', 'guo_jia', 'cheng_yu', 'jia_xu', 'liu_ye', 'man_chong', 'lv_qian', 'cao_ang', 'li_dian', 'zhu_ling', 'mao_jie', 'cao_chun', 'cao_xiu', 'li_tong', 'chen_qun', 'yang_xiu', 'wang_lang'] },
      { id: 'yuanshao', name: '원소', lord: 'yuan_shao', cities: ['ye', 'nanpi', 'pingyuan', 'julu', 'jinyang', 'ji', 'beiping'],
        generals: ['yuan_shao', 'yuan_tan', 'yuan_shang', 'yan_liang', 'wen_chu', 'zhang_he', 'gao_lan', 'ju_shou', 'tian_feng', 'feng_ji', 'guo_tu', 'shen_pei', 'xu_you', 'chunyu_qiong', 'lv_kuang', 'lv_xiang', 'yuan_xi', 'gao_gan'] },
      { id: 'liubei', name: '유비', lord: 'liu_bei', cities: ['xiapi', 'pengcheng', 'xiaopei'],
        generals: ['liu_bei', 'guan_yu', 'zhang_fei', 'zhao_yun', 'sun_qian', 'mi_zhu', 'jian_yong', 'chen_deng', 'chen_gui'] },
      { id: 'sunquan', name: '손권', lord: 'sun_quan', cities: ['jianye', 'wu', 'kuaiji', 'lujiang', 'yuzhang'],
        generals: ['sun_quan', 'zhou_yu', 'lu_su', 'cheng_pu', 'huang_gai', 'han_dang', 'taishi_ci', 'zhang_zhao', 'jiang_qin', 'zhu_zhi', 'lv_fan', 'zhuge_jin', 'ling_tong', 'xu_sheng', 'ding_feng', 'pan_zhang', 'sun_jing', 'sun_ben', 'wu_jing', 'sun_yi', 'shi_yi_wu', 'sun_jiao'] },
      { id: 'yuan_shu', name: '원술', lord: 'yuan_shu', cities: ['shouchun'],
        generals: ['yuan_shu', 'ji_ling', 'zhang_xun', 'qiao_rui'] },
      { id: 'liubiao', name: '유표', lord: 'liu_biao', cities: ['xiangyang', 'jiangling', 'jiangxia', 'changsha', 'guiyang', 'xinye'],
        generals: ['liu_biao', 'cai_mao', 'kuai_yue', 'huang_zu', 'wen_pin', 'zhang_yun', 'han_song', 'cai_xun', 'yi_ji', 'liu_cong', 'huang_zhong', 'wei_yan', 'kuai_liang', 'liu_qi', 'han_hyeon'] },
      { id: 'liuzhang', name: '유장', lord: 'liu_zhang', cities: ['chengdu', 'zitong', 'jiangzhou'],
        generals: ['liu_zhang', 'zhang_ren', 'zhang_song', 'huang_quan', 'lei_tong', 'ling_bao', 'deng_xian', 'liu_gui', 'yang_huai', 'gao_pei', 'fa_zheng', 'wu_yi', 'li_yan', 'wu_lan'] },
      { id: 'zhanglu', name: '장로', lord: 'zhang_lu', cities: ['hanzhong'],
        generals: ['zhang_lu', 'zhang_wei', 'yang_ren', 'yan_pu', 'yang_bo'] },
      { id: 'gongsundu', name: '공손도', lord: 'gongsun_du', cities: ['xiangping'], generals: ['gongsun_du'] },
      { id: 'mateng', name: '마등', lord: 'ma_teng', cities: ['wuwei', 'tianshui', 'changan'],
        generals: ['ma_teng', 'ma_chao', 'pang_de', 'ma_xiu', 'ma_tie', 'ma_dai'] },
      { id: 'hansui', name: '한수', lord: 'han_sui', cities: ['longxi'],
        generals: ['han_sui', 'cheng_yi', 'hou_xuan', 'liang_xing', 'yan_xing'] },
      { id: 'shixie', name: '사섭', lord: 'shi_xie', cities: ['nanhai', 'jiaozhi'], generals: ['shi_xie', 'shi_yi'] },
    ],
    free: {
      xinye: ['xu_shu'],
      luoyang: ['sima_yi', 'xu_shao'],
      xuchang: ['zhuge_liang', 'hua_tuo'],
      chengdu: ['pang_tong'],
      xiangyang: ['sima_hui', 'pang_degong', 'cui_zhouping', 'shi_guangyuan', 'meng_gongwei', 'huang_chengyan'],
      linzi: ['mi_heng', 'guan_ning', 'bing_yuan'],
      kuaiji: ['yu_ji'],
      guangling: ['chen_lin'],
      pingyuan: ['liu_zhen'],
      nanpi: ['han_fu'],
      puyang: ['liu_dai', 'pei_yuanshao', 'zhang_miao'],
      chenliu: ['wang_can'],
      runan: ['he_yi', 'huang_shao'],
      jinyang: ['zhang_yan', 'yu_du', 'sui_gu'],
      beiping: ['liu_yu', 'ta_dun'],
      xiangping: ['qiu_liju', 'nan_lou', 'lou_ban', 'gongsun_kang', 'gongsun_gong'],
      guiyang: ['zhao_fan', 'chen_ying'],
      jiangling: ['liu_du', 'liu_xian'],
      changsha: ['xing_daorong'],
      lujiang: ['zuo_ci'],
      wuwei: ['song_jian', 'ke_bineng'],
    },
  },
  {
    id: 's208',
    year: 208,
    name: '적벽대전',
   
    desc: '북방을 통일한 조조가 백만 대군으로 남하한다. 형주는 무너지고, 유비와 손권은 손을 잡을 수밖에 없다.',
    factions: [
      { id: 'jojo', name: '조조', lord: 'cao_cao', cities: ['xuchang', 'luoyang', 'changan', 'hongnong', 'chenliu', 'puyang', 'ye', 'nanpi', 'pingyuan', 'julu', 'jinyang', 'ji', 'beiping', 'xiangping', 'xiaopei', 'pengcheng', 'xiapi', 'guangling', 'shouchun', 'runan', 'linzi', 'beihai'],
        generals: ['cao_cao', 'xiahou_dun', 'xiahou_yuan', 'cao_ren', 'cao_hong', 'zhang_liao', 'zhang_he', 'xu_huang', 'yue_jin', 'yu_jin', 'xu_chu', 'xun_yu', 'xun_you', 'cheng_yu', 'sima_yi', 'jia_xu', 'liu_ye', 'man_chong', 'lv_qian', 'cao_ang', 'wen_pin', 'li_dian', 'gao_lan', 'zhu_ling', 'mao_jie', 'cao_chun', 'cao_xiu', 'li_tong', 'chen_qun', 'yang_xiu', 'wang_lang', 'hua_xin', 'zhong_yao', 'dong_zhao', 'xin_pi', 'xiahou_shang', 'he_zhao', 'qin_lang', 'meng_da', 'cao_zhang', 'cao_zhi', 'jia_kui'] },
      { id: 'liubei', name: '유비', lord: 'liu_bei', cities: ['xinye'],
        generals: ['liu_bei', 'guan_yu', 'zhang_fei', 'zhao_yun', 'zhuge_liang', 'sun_qian', 'mi_zhu', 'jian_yong', 'liu_feng'] },
      { id: 'sunquan', name: '손권', lord: 'sun_quan', cities: ['jianye', 'wu', 'kuaiji', 'lujiang', 'yuzhang'],
        generals: ['sun_quan', 'zhou_yu', 'lu_su', 'lu_meng', 'lu_xun', 'cheng_pu', 'huang_gai', 'han_dang', 'taishi_ci', 'gan_ning', 'zhou_tai', 'zhang_zhao', 'gu_yong', 'zhuge_jin', 'lv_fan', 'jiang_qin', 'ling_tong', 'xu_sheng', 'ding_feng', 'zhu_zhi', 'sun_huan', 'zhu_huan', 'quan_cong', 'shi_yi_wu', 'kan_ze', 'yan_jun', 'sun_jiao', 'lv_dai', 'luo_tong', 'sun_shao'] },
      { id: 'liubiao', name: '유표', lord: 'liu_biao', cities: ['xiangyang', 'jiangling', 'jiangxia', 'changsha', 'guiyang'],
        generals: ['liu_biao', 'cai_mao', 'kuai_yue', 'huang_zu', 'zhang_yun', 'han_song', 'cai_xun', 'yi_ji', 'liu_cong', 'huang_zhong', 'wei_yan', 'kuai_liang', 'liu_qi', 'han_hyeon', 'liu_du', 'zhao_fan', 'jin_xuan'] },
      { id: 'liuzhang', name: '유장', lord: 'liu_zhang', cities: ['chengdu', 'zitong', 'jiangzhou'],
        generals: ['liu_zhang', 'zhang_ren', 'zhang_song', 'huang_quan', 'lei_tong', 'ling_bao', 'deng_xian', 'liu_gui', 'yang_huai', 'gao_pei', 'fa_zheng', 'wu_yi', 'li_yan', 'wu_lan'] },
      { id: 'zhanglu', name: '장로', lord: 'zhang_lu', cities: ['hanzhong'],
        generals: ['zhang_lu', 'zhang_wei', 'yang_ren', 'yan_pu', 'yang_song', 'yang_bo'] },
      { id: 'mateng', name: '마등', lord: 'ma_teng', cities: ['wuwei', 'tianshui', 'longxi'],
        generals: ['ma_teng', 'ma_chao', 'pang_de', 'ma_xiu', 'ma_tie', 'ma_dai', 'han_sui', 'cheng_yi', 'hou_xuan', 'liang_xing', 'yan_xing'] },
      { id: 'shixie', name: '사섭', lord: 'shi_xie', cities: ['nanhai', 'jiaozhi'], generals: ['shi_xie', 'shi_yi'] },
    ],
    free: {
      xiangyang: ['pang_tong', 'xu_shu', 'sima_hui', 'pang_degong', 'cui_zhouping', 'shi_guangyuan', 'meng_gongwei', 'huang_chengyan'],
      wu: ['sun_jian'],
      runan: ['hua_tuo'],
      lujiang: ['zuo_ci'],
      kuaiji: ['yu_ji'],
      linzi: ['mi_heng', 'guan_ning', 'bing_yuan'],
      guangling: ['chen_lin'],
      chenliu: ['wang_can', 'zhang_miao'],
      pingyuan: ['liu_zhen'],
      nanpi: ['han_fu'],
      puyang: ['liu_dai'],
      luoyang: ['xu_shao'],
      jinyang: ['zhang_yan', 'yu_du', 'sui_gu'],
      beiping: ['liu_yu', 'ta_dun'],
      xiangping: ['qiu_liju', 'nan_lou', 'lou_ban', 'gongsun_kang', 'gongsun_gong'],
      xiaopei: ['pei_yuanshao'],
      jiangling: ['gong_zhi', 'liu_xian', 'xing_daorong'],
      guiyang: ['chen_ying', 'bao_long'],
      wuwei: ['song_jian', 'ke_bineng'],
    },
  },
  {
    id: 's219',
    year: 219,
    name: '한중 공방전',
   
    desc: '한중을 얻은 유비가 한중왕에 오르고, 관우는 양양을 포위해 북상을 노린다. 오는 형주를 노리고, 삼국의 국경이 굳어진다.',
    factions: [
      { id: 'jojo', name: '위', lord: 'cao_cao', cities: ['xuchang', 'luoyang', 'changan', 'hongnong', 'chenliu', 'puyang', 'ye', 'nanpi', 'pingyuan', 'julu', 'jinyang', 'ji', 'beiping', 'xiangping', 'xiaopei', 'pengcheng', 'xiapi', 'guangling', 'shouchun', 'runan', 'linzi', 'beihai', 'tianshui', 'longxi', 'wuwei', 'xinye'],
        generals: ['cao_cao', 'cao_pi', 'cao_ren', 'zhang_he', 'xu_huang', 'xu_chu', 'sima_yi', 'jia_xu', 'liu_ye', 'man_chong', 'wen_pin', 'cao_xiu', 'cao_zhen', 'pang_de', 'yu_jin', 'lv_qian', 'zhu_ling', 'mao_jie', 'cao_chun', 'cao_hong', 'cao_ang', 'zhang_liao', 'li_dian', 'gao_lan', 'xiahou_dun', 'xiahou_shang', 'cao_tai', 'cao_zhang', 'cao_zhi', 'he_zhao', 'zhong_yao', 'hua_xin', 'wang_lang', 'dong_zhao', 'chen_qun', 'xin_pi', 'yang_xiu', 'meng_da', 'qin_lang', 'sun_li', 'hu_zun', 'jia_kui'] },
      { id: 'liubei', name: '촉', lord: 'liu_bei', cities: ['chengdu', 'zitong', 'jiangzhou', 'hanzhong', 'xiangyang', 'jiangling', 'changsha', 'guiyang'],
        generals: ['liu_bei', 'guan_yu', 'zhang_fei', 'zhao_yun', 'zhuge_liang', 'fa_zheng', 'huang_zhong', 'wei_yan', 'ma_chao', 'ma_dai', 'liao_hua', 'guan_ping', 'guan_xing', 'zhang_bao_zi', 'yan_yan', 'li_yan', 'wu_yi', 'huang_quan', 'ma_liang', 'mi_zhu', 'sun_qian', 'jian_yong', 'zhang_wan', 'fei_yi', 'wang_ping', 'ma_su', 'guo_jun', 'ma_zhong', 'zhou_cang', 'zhang_yi', 'chen_dao', 'liao_li', 'liu_yan_shu', 'liu_ba', 'xu_jing', 'xiang_lang', 'wu_ban', 'chen_shi', 'zhang_nan'] },
      { id: 'sunquan', name: '오', lord: 'sun_quan', cities: ['jianye', 'wu', 'kuaiji', 'lujiang', 'yuzhang', 'jiangxia', 'nanhai', 'jiaozhi'],
        generals: ['sun_quan', 'lu_meng', 'lu_xun', 'lu_kang', 'zhu_ran', 'zhu_zhi', 'han_dang', 'jiang_qin', 'ling_tong', 'xu_sheng', 'ding_feng', 'pan_zhang', 'gan_ning', 'zhuge_jin', 'zhang_zhao', 'gu_yong', 'lv_fan', 'sun_huan', 'zhuge_ke', 'cheng_pu', 'zhou_tai', 'quan_cong', 'zhu_huan', 'lv_dai', 'shi_yi_wu', 'kan_ze', 'yan_jun', 'bu_zhi', 'sun_shao', 'luo_tong', 'wu_can', 'sun_jiao', 'zhang_wen', 'zhu_ju'] },
    ],
    free: {
      nanhai: ['meng_huo', 'zhurong', 'wutugu', 'meng_you', 'mang_yazhang', 'dong_tuona', 'ahuinan', 'geumhwan_samgyeol', 'dailai_dongzhu', 'tasa_daiwang', 'mulok_daiwang'],
      wuwei: ['han_sui'],
      xiangyang: ['sima_hui'],
      luoyang: ['xu_shao'],
      runan: ['hua_tuo'],
      lujiang: ['zuo_ci'],
      kuaiji: ['yu_ji'],
      linzi: ['mi_heng'],
      guangling: ['chen_lin'],
      jinyang: ['zhang_yan'],
    },
  },
  {
    id: 's225',
    year: 225,
    name: '남만정벌',
   
    desc: '이릉에서 진 촉은 제갈량이 이끄는 처지가 되었다. 남중의 맹획이 반기를 들자 제갈량이 직접 남정에 나서고, 위와 오는 이를 지켜본다.',
    factions: [
      { id: 'jojo', name: '위', lord: 'cao_rui', cities: ['xuchang', 'luoyang', 'changan', 'hongnong', 'chenliu', 'puyang', 'ye', 'nanpi', 'pingyuan', 'julu', 'jinyang', 'ji', 'beiping', 'xiangping', 'xiaopei', 'pengcheng', 'xiapi', 'guangling', 'shouchun', 'runan', 'linzi', 'beihai', 'tianshui', 'longxi', 'wuwei', 'xinye'],
        generals: ['cao_rui', 'sima_yi', 'sima_shi', 'sima_zhao', 'cao_zhen', 'cao_xiu', 'zhang_he', 'guo_huai', 'xiahou_ba', 'man_chong', 'wen_pin', 'cao_hong', 'zhang_liao', 'xu_chu', 'cao_ang', 'pang_de', 'yu_jin', 'jia_xu', 'liu_ye', 'gao_lan', 'zhu_ling', 'wang_shuang', 'he_zhao', 'zhong_yao', 'hua_xin', 'dong_zhao', 'chen_qun', 'wang_ji', 'wang_chang', 'hu_zun', 'hu_zhi', 'sun_li'] },
      { id: 'liubei', name: '촉', lord: 'zhuge_liang', cities: ['chengdu', 'zitong', 'jiangzhou', 'hanzhong'],
        generals: ['zhuge_liang', 'zhao_yun', 'wei_yan', 'jiang_wei', 'zhang_wan', 'fei_yi', 'wang_ping', 'ma_su', 'ma_dai', 'liao_hua', 'guan_xing', 'zhang_bao_zi', 'ma_zhong', 'guo_jun', 'wu_yi', 'li_yan', 'liu_shan', 'chen_dao', 'dong_yun', 'qiao_zhou', 'zhang_yi', 'liao_li', 'liu_yan_shu', 'yang_yi', 'zong_yu', 'wu_ban', 'chen_shi', 'meng_guang', 'liu_min'] },
      { id: 'sunquan', name: '오', lord: 'sun_quan', cities: ['jianye', 'wu', 'kuaiji', 'lujiang', 'yuzhang', 'jiangxia', 'changsha', 'guiyang', 'xiangyang', 'jiangling'],
        generals: ['sun_quan', 'lu_xun', 'lu_kang', 'zhu_ran', 'zhu_zhi', 'zhuge_ke', 'zhuge_jin', 'xu_sheng', 'ding_feng', 'pan_zhang', 'sun_huan', 'gu_yong', 'jiang_qin', 'ling_tong', 'sun_shao', 'lv_dai', 'quan_cong', 'zhu_huan', 'bu_zhi', 'luo_tong', 'wu_can', 'shi_yi_wu', 'kan_ze', 'yan_jun', 'lu_kai', 'tang_zi', 'liu_zan', 'zhu_ju', 'wu_yan', 'tao_jun'] },
      { id: 'nanman', name: '남만', lord: 'meng_huo', cities: ['nanhai', 'jiaozhi'],
        generals: ['meng_huo', 'zhurong', 'wutugu', 'meng_you', 'mang_yazhang', 'dong_tuona', 'ahuinan', 'geumhwan_samgyeol', 'dailai_dongzhu', 'tasa_daiwang', 'mulok_daiwang'] },
    ],
    free: {
      chengdu: ['xu_shu'],
      luoyang: ['deng_ai', 'zhong_hui', 'yang_hu', 'du_yu', 'wei_guan', 'jia_chong'],
      tianshui: ['deng_zhong', 'shi_zhuan'],
      wuwei: ['qian_hong', 'hu_lie'],
      xiangyang: ['sima_hui'],
      runan: ['hua_tuo'],
    },
  },
];

export const FORMATION_IDS = Object.keys(FORMATIONS);
