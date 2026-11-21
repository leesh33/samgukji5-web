/* 도트삼국 — 정적 데이터
 * 성 42곳 · 실존 장수 130여 명 · 시나리오 3종 · 진형 9종
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
  ['xiangping', '양평', '襄平', '유주', 84, 12, 38, 34, 62, 35, 4200, 1600, 5200, 0, ['beiping']],
  ['beiping', '북평', '北平', '유주', 78, 15, 44, 38, 66, 40, 5600, 2000, 6400, 0, ['xiangping', 'ji', 'nanpi']],
  ['ji', '계', '薊', '유주', 71, 15, 52, 48, 68, 46, 7200, 2600, 8600, 1, ['beiping', 'julu', 'jinyang']],
  ['jinyang', '진양', '晉陽', '병주', 57, 21, 50, 44, 64, 42, 6000, 2200, 7400, 0, ['ji', 'ye', 'julu', 'luoyang']],
  ['ye', '업', '鄴', '기주', 64, 25, 72, 70, 76, 68, 11000, 4200, 15200, 1, ['jinyang', 'julu', 'nanpi', 'puyang', 'luoyang']],
  ['nanpi', '남피', '南皮', '기주', 72, 21, 60, 58, 70, 54, 8000, 3000, 10000, 0, ['ye', 'beiping', 'pingyuan', 'linzi', 'julu']],
  ['pingyuan', '평원', '平原', '기주', 70, 26, 58, 52, 68, 60, 7400, 2800, 9600, 0, ['nanpi', 'linzi', 'beihai', 'chenliu', 'puyang']],
  ['julu', '거록', '鉅鹿', '기주', 62, 22, 62, 50, 70, 56, 7600, 2700, 9800, 0, ['ye', 'ji', 'jinyang', 'nanpi', 'puyang']],
  ['linzi', '임치', '臨淄', '청주', 76, 28, 64, 66, 70, 52, 8200, 3400, 10400, 1, ['nanpi', 'pingyuan', 'beihai', 'xiapi']],
  ['beihai', '북해', '北海', '청주', 80, 30, 56, 54, 66, 46, 6800, 2600, 8800, 0, ['linzi', 'pingyuan', 'xiapi']],
  ['xiapi', '하비', '下邳', '서주', 74, 34, 64, 62, 72, 60, 9000, 3400, 12000, 1, ['linzi', 'beihai', 'pengcheng', 'xiaopei', 'guangling', 'shouchun']],
  ['pengcheng', '팽성', '彭城', '서주', 71, 32, 60, 58, 70, 56, 7800, 2900, 9800, 0, ['xiapi', 'xiaopei', 'shouchun', 'runan']],
  ['xiaopei', '소패', '小沛', '서주', 72, 30, 52, 48, 62, 50, 6200, 2200, 7800, 0, ['pengcheng', 'xiapi', 'chenliu', 'xuchang', 'puyang']],
  ['guangling', '광릉', '廣陵', '서주', 77, 37, 54, 60, 64, 52, 6400, 2800, 8200, 0, ['xiapi', 'shouchun', 'jianye']],
  ['puyang', '복양', '濮陽', '연주', 67, 29, 58, 54, 66, 58, 7000, 2600, 9000, 0, ['ye', 'julu', 'pingyuan', 'chenliu', 'xiaopei']],
  ['chenliu', '진류', '陳留', '연주', 64, 31, 66, 64, 72, 62, 8600, 3200, 11200, 1, ['puyang', 'pingyuan', 'xuchang', 'luoyang', 'xiaopei']],
  ['xuchang', '허창', '許昌', '예주', 66, 34, 74, 76, 78, 70, 12000, 4800, 16200, 1, ['chenliu', 'xiaopei', 'runan', 'luoyang', 'xinye']],
  ['runan', '여남', '汝南', '예주', 67, 37, 62, 56, 68, 58, 7600, 2800, 9600, 0, ['xuchang', 'pengcheng', 'shouchun', 'xinye', 'jiangxia']],
  ['luoyang', '낙양', '洛陽', '사례', 60, 31, 70, 78, 74, 66, 10000, 4200, 13800, 1, ['jinyang', 'ye', 'chenliu', 'xuchang', 'hongnong', 'xinye']],
  ['changan', '장안', '長安', '사례', 51, 30, 68, 70, 70, 62, 9600, 3800, 13000, 1, ['hongnong', 'tianshui', 'hanzhong']],
  ['hongnong', '홍농', '弘農', '사례', 55, 30, 50, 46, 64, 50, 5200, 1900, 7000, 0, ['luoyang', 'changan']],
  ['wuwei', '무위', '武威', '량주', 35, 21, 40, 44, 60, 32, 5200, 1800, 6600, 0, ['tianshui', 'longxi']],
  ['tianshui', '천수', '天水', '량주', 42, 32, 48, 46, 62, 44, 6000, 2100, 7400, 0, ['wuwei', 'longxi', 'changan', 'hanzhong']],
  ['longxi', '농서', '隴西', '량주', 44, 34, 42, 38, 58, 36, 4800, 1700, 6200, 0, ['wuwei', 'tianshui', 'hanzhong']],
  ['xinye', '신야', '新野', '형주', 64, 36, 48, 44, 64, 52, 5400, 1900, 7000, 0, ['xuchang', 'luoyang', 'runan', 'xiangyang', 'jiangxia']],
  ['xiangyang', '양양', '襄陽', '형주', 63, 38, 70, 68, 74, 66, 9800, 3800, 13000, 1, ['xinye', 'jiangling', 'jiangxia', 'hanzhong']],
  ['jiangling', '강릉', '江陵', '형주', 62, 42, 66, 62, 70, 62, 8800, 3300, 11800, 1, ['xiangyang', 'jiangxia', 'changsha', 'jiangzhou']],
  ['jiangxia', '강하', '江夏', '형주', 67, 41, 58, 56, 66, 58, 7200, 2600, 9200, 0, ['xiangyang', 'jiangling', 'xinye', 'runan', 'lujiang', 'changsha', 'yuzhang']],
  ['changsha', '장사', '長沙', '형주', 65, 48, 62, 54, 68, 56, 7800, 2800, 10000, 0, ['jiangling', 'jiangxia', 'guiyang', 'yuzhang']],
  ['guiyang', '계양', '桂陽', '형주', 66, 53, 44, 40, 60, 44, 5000, 1800, 6600, 0, ['changsha', 'nanhai']],
  ['shouchun', '수춘', '壽春', '양주', 72, 38, 62, 60, 68, 60, 8000, 3000, 10200, 1, ['xiapi', 'guangling', 'pengcheng', 'runan', 'lujiang', 'jianye']],
  ['lujiang', '여강', '廬江', '양주', 71, 42, 54, 50, 64, 56, 6400, 2400, 8200, 0, ['shouchun', 'jianye', 'jiangxia', 'yuzhang']],
  ['jianye', '건업', '建業', '양주', 78, 40, 68, 72, 72, 64, 9200, 3800, 12000, 1, ['guangling', 'shouchun', 'lujiang', 'wu', 'yuzhang']],
  ['wu', '오', '吳', '양주', 81, 43, 62, 66, 70, 58, 7600, 3200, 9800, 0, ['jianye', 'kuaiji']],
  ['kuaiji', '회계', '會稽', '양주', 84, 47, 58, 58, 66, 52, 7000, 2800, 9000, 0, ['wu', 'yuzhang']],
  ['yuzhang', '예장', '豫章', '양주', 73, 47, 52, 48, 62, 50, 6200, 2200, 8000, 0, ['jianye', 'lujiang', 'jiangxia', 'changsha', 'kuaiji', 'nanhai']],
  ['hanzhong', '한중', '漢中', '익주', 52, 35, 52, 46, 66, 48, 7000, 2400, 9000, 0, ['changan', 'tianshui', 'longxi', 'zitong', 'xiangyang']],
  ['zitong', '자동', '梓潼', '익주', 50, 38, 50, 44, 64, 46, 6200, 2100, 8000, 0, ['hanzhong', 'chengdu', 'jiangzhou']],
  ['chengdu', '성도', '成都', '익주', 45, 40, 78, 74, 78, 74, 12000, 4800, 16800, 1, ['zitong', 'jiangzhou']],
  ['jiangzhou', '강주', '江州', '익주', 52, 44, 58, 54, 66, 54, 7000, 2500, 9200, 0, ['chengdu', 'zitong', 'jiangling', 'nanhai']],
  ['nanhai', '남해', '南海', '교주', 70, 56, 46, 52, 60, 44, 5200, 2200, 7000, 0, ['guiyang', 'yuzhang', 'jiaozhi', 'jiangzhou']],
  ['jiaozhi', '교지', '交趾', '교주', 62, 62, 40, 44, 56, 38, 4600, 1800, 6400, 0, ['nanhai']],
];

export const CITIES = CITY_ROWS.map((r) => ({
  id: r[0], ko: r[1], hanja: r[2], region: r[3], x: r[4], y: r[5],
  agri: r[6], comm: r[7], order: r[8], water: r[9],
  troops: r[10], gold: r[11], food: r[12], major: !!r[13], roads: r[14],
}));

export const CITY_BY_ID = Object.fromEntries(CITIES.map((c) => [c.id, c]));

/* 진형 9종: [id, 한글, 공격, 방어, 기동, 사거리, 설명] */
export const FORMATIONS = {
  eorin: { id: 'eorin', ko: '어린', hanja: '魚鱗', atk: 1.15, def: 1.0, move: 1.0, range: 1, desc: '공격에 치중한 기본 진형. 정면 돌파에 강하다.' },
  hakyik: { id: 'hakyik', ko: '학익', hanja: '鶴翼', atk: 0.9, def: 1.1, move: 0.9, range: 2, desc: '좌우로 날개를 펼쳐 원거리에서 협공한다.' },
  bongsi: { id: 'bongsi', ko: '봉시', hanja: '鋒矢', atk: 1.25, def: 0.85, move: 1.2, range: 1, desc: '화살촉처럼 돌격하는 공격 특화 진형.' },
  bangwon: { id: 'bangwon', ko: '방원', hanja: '方円', atk: 0.8, def: 1.3, move: 0.8, range: 1, desc: '원형 방진. 수비와 버티기에 최적.' },
  eonwol: { id: 'eonwol', ko: '언월', hanja: '偃月', atk: 1.1, def: 1.05, move: 1.0, range: 1, desc: '초승달 대형. 균형 잡힌 공수.' },
  jangsa: { id: 'jangsa', ko: '장사', hanja: '長蛇', atk: 1.05, def: 0.95, move: 1.15, range: 1, desc: '뱀처럼 길게 늘어서 기동에 강하다.' },
  anhaeng: { id: 'anhaeng', ko: '안행', hanja: '雁行', atk: 0.85, def: 1.15, move: 1.0, range: 2, desc: '기러기 대형. 사거리가 길고 방어가 두텁다.' },
  guhaeng: { id: 'guhaeng', ko: '구행', hanja: '鉤行', atk: 1.0, def: 1.0, move: 1.25, range: 1, desc: '갈고리 대형. 측면 우회에 능하다.' },
  sujin: { id: 'sujin', ko: '수진', hanja: '水陣', atk: 1.1, def: 1.1, move: 1.0, range: 1, desc: '수상 전투용 진형. 물 위에서 위력을 발휘한다.' },
};

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

/* 장수: id, 한글, 한자, 통솔, 무력, 지력, 정치, 매력, 병과, 특기, 보유진형 */
const FORM_BY_KO = Object.fromEntries(Object.values(FORMATIONS).map((f) => [f.ko, f.id]));
function G(id, ko, hanja, lead, war, int, pol, cha, arms, skill, forms) {
  const list = [];
  for (let i = 0; i < forms.length; i += 2) {
    const koName = forms.slice(i, i + 2);
    list.push(FORM_BY_KO[koName] || 'eorin');
  }
  return { id, ko, hanja, lead, war, int, pol, cha, arms, skill, formations: list };
}

export const GENERALS = [
  // 위(魏) · 조조군
  G('cao_cao', '조조', '曹操', 99, 72, 91, 94, 96, '보병', 'tongsol', '어린학익봉시방원언월'),
  G('xiahou_dun', '하후돈', '夏侯惇', 90, 94, 61, 70, 76, '기병', 'dolgyeok', '어린봉시장사'),
  G('xiahou_yuan', '하후연', '夏侯淵', 88, 92, 68, 62, 74, '기병', 'dolgyeok', '봉시학익'),
  G('cao_ren', '조인', '曹仁', 91, 86, 68, 70, 72, '보병', 'cheolbyeok', '방원학익'),
  G('cao_hong', '조홍', '曹洪', 76, 82, 40, 55, 66, '기병', 'dolgyeok', '봉시'),
  G('zhang_liao', '장료', '張遼', 95, 92, 78, 58, 78, '기병', 'yongmaeng', '학익봉시어린'),
  G('xu_huang', '서황', '徐晃', 91, 89, 74, 68, 74, '보병', 'cheolbyeok', '어린방원'),
  G('yue_jin', '악진', '樂進', 84, 86, 62, 54, 66, '보병', 'dolgyeok', '어린'),
  G('yu_jin', '우금', '于禁', 85, 78, 68, 74, 62, '보병', 'gyeonsu', '방원'),
  G('dian_wei', '전위', '典韋', 78, 96, 38, 26, 68, '보병', 'hogwi', '어린'),
  G('xu_chu', '허저', '許褚', 76, 96, 32, 28, 70, '보병', 'hogwi', '어린'),
  G('xun_yu', '순욱', '荀彧', 70, 32, 95, 96, 88, '궁병', 'sinsan', '방원'),
  G('xun_you', '순유', '荀攸', 68, 30, 94, 88, 80, '궁병', 'hwagye', '방원'),
  G('guo_jia', '곽가', '郭嘉', 60, 22, 98, 86, 82, '궁병', 'sinsan', '방원'),
  G('cheng_yu', '정욱', '程昱', 72, 48, 92, 90, 74, '궁병', 'hwagye', '방원'),
  G('sima_yi', '사마의', '司馬懿', 96, 63, 98, 94, 88, '보병', 'sinsan', '학익어린'),
  G('jia_xu', '가후', '賈詡', 70, 32, 97, 86, 62, '궁병', 'hollan', '방원'),
  G('liu_ye', '유엽', '劉曄', 66, 40, 88, 84, 70, '궁병', 'hwagye', '학익'),
  G('man_chong', '만총', '滿寵', 74, 60, 80, 82, 62, '보병', 'cheolbyeok', '방원'),
  G('lv_qian', '여건', '呂虔', 70, 68, 62, 66, 58, '보병', 'gyeonsu', '어린'),
  G('cao_ang', '조앙', '曹昂', 70, 74, 66, 68, 74, '기병', 'dolgyeok', '봉시'),
  G('wen_pin', '문빙', '文聘', 82, 80, 70, 72, 68, '수군', 'sujeon', '방원'),
  G('li_dian', '이전', '李典', 80, 76, 74, 70, 70, '보병', 'gyeonsu', '학익'),
  G('zhang_he', '장합', '張郃', 92, 88, 82, 74, 72, '기병', 'cheolbyeok', '학익봉시'),
  G('gao_lan', '고람', '高覽', 78, 80, 60, 52, 56, '보병', 'dolgyeok', '어린'),
  G('zhu_ling', '주령', '朱靈', 72, 74, 58, 60, 54, '보병', 'dolgyeok', '어린'),
  G('mao_jie', '모개', '毛玠', 60, 40, 72, 84, 66, '궁병', 'gyeonsu', '방원'),
  G('cao_chun', '조순', '曹純', 80, 78, 70, 66, 68, '기병', 'dolgyeok', '봉시'),
  G('cao_xiu', '조휴', '曹休', 78, 74, 68, 66, 64, '기병', 'dolgyeok', '봉시'),

  // 촉(蜀) · 유비군
  G('liu_bei', '유비', '劉備', 82, 74, 78, 84, 99, '보병', 'indeok', '어린학익'),
  G('guan_yu', '관우', '關羽', 98, 97, 75, 64, 92, '기병', 'wieom', '언월어린봉시'),
  G('zhang_fei', '장비', '張飛', 95, 98, 40, 22, 64, '기병', 'pokgyeok', '봉시장사'),
  G('zhao_yun', '조운', '趙雲', 96, 97, 76, 66, 88, '기병', 'cheolbyeok', '학익봉시방원'),
  G('zhuge_liang', '제갈량', '諸葛亮', 92, 38, 100, 96, 92, '궁병', 'sinsan', '방원학익'),
  G('xu_shu', '서서', '徐庶', 76, 60, 90, 76, 76, '궁병', 'hwagye', '방원'),
  G('pang_tong', '방통', '龐統', 70, 40, 96, 82, 60, '궁병', 'hwagye', '방원'),
  G('huang_zhong', '황충', '黃忠', 88, 95, 68, 56, 72, '궁병', 'jeogyeok', '학익'),
  G('wei_yan', '위연', '魏延', 86, 91, 68, 50, 56, '기병', 'dolgyeok', '봉시'),
  G('fa_zheng', '법정', '法正', 72, 40, 94, 84, 66, '궁병', 'hwagye', '방원'),
  G('li_yan', '이엄', '李嚴', 82, 80, 80, 76, 60, '보병', 'cheolbyeok', '방원'),
  G('ma_liang', '마량', '馬良', 62, 30, 86, 88, 74, '궁병', 'gyeonsu', '방원'),
  G('sun_qian', '손건', '孫乾', 56, 40, 74, 82, 80, '궁병', 'gyeonsu', '방원'),
  G('mi_zhu', '미축', '糜竺', 50, 30, 66, 90, 78, '궁병', 'gyeonsu', '방원'),
  G('jian_yong', '간옹', '簡雍', 54, 32, 74, 78, 76, '궁병', 'gyeonsu', '방원'),
  G('liu_feng', '유봉', '劉封', 70, 78, 54, 50, 56, '기병', 'dolgyeok', '봉시'),
  G('yan_yan', '엄안', '嚴顏', 82, 84, 66, 72, 70, '보병', 'cheolbyeok', '방원'),
  G('wu_yi', '오의', '吳懿', 74, 72, 66, 70, 68, '보병', 'gyeonsu', '학익'),
  G('liao_hua', '요화', '廖化', 72, 70, 60, 62, 64, '보병', 'dolgyeok', '어린'),
  G('ma_dai', '마대', '馬岱', 78, 80, 66, 60, 66, '기병', 'dolgyeok', '봉시'),
  G('chen_deng', '진등', '陳登', 66, 58, 86, 84, 74, '궁병', 'sinsan', '방원'),
  G('chen_gui', '진규', '陳珪', 54, 34, 82, 86, 70, '궁병', 'gyeonsu', '방원'),

  // 오(吳) · 손씨
  G('sun_jian', '손견', '孫堅', 94, 92, 74, 72, 88, '기병', 'yongmaeng', '봉시학익'),
  G('sun_ce', '손책', '孫策', 92, 90, 70, 62, 90, '기병', 'dolgyeok', '봉시'),
  G('sun_quan', '손권', '孫權', 80, 60, 82, 90, 94, '보병', 'tongsol', '방원학익'),
  G('zhou_yu', '주유', '周瑜', 94, 66, 98, 84, 92, '수군', 'hwagye', '학익언월'),
  G('lu_su', '노숙', '魯肅', 78, 40, 88, 92, 86, '수군', 'gyeonsu', '방원'),
  G('lu_meng', '여몽', '呂蒙', 88, 84, 86, 76, 74, '수군', 'sujeon', '방원'),
  G('lu_xun', '육손', '陸遜', 92, 62, 96, 88, 80, '수군', 'hwagye', '학익'),
  G('huang_gai', '황개', '黃蓋', 80, 78, 68, 66, 68, '수군', 'hwagye', '방원'),
  G('han_dang', '한당', '韓當', 80, 82, 58, 54, 62, '수군', 'sujeon', '언월'),
  G('cheng_pu', '정보', '程普', 84, 80, 70, 68, 72, '수군', 'gyeonsu', '방원'),
  G('taishi_ci', '태사자', '太史慈', 88, 92, 74, 62, 80, '궁병', 'jeogyeok', '학익'),
  G('gan_ning', '감녕', '甘寧', 90, 92, 60, 40, 70, '수군', 'sujeon', '장사'),
  G('zhou_tai', '주태', '周泰', 82, 90, 44, 36, 70, '수군', 'cheolbyeok', '방원'),
  G('jiang_qin', '장흠', '蔣欽', 78, 78, 60, 58, 62, '수군', 'sujeon', '어린'),
  G('lv_fan', '여범', '呂範', 70, 62, 74, 78, 66, '수군', 'gyeonsu', '방원'),
  G('zhuge_jin', '제갈근', '諸葛瑾', 62, 40, 86, 82, 80, '궁병', 'gyeonsu', '방원'),
  G('zhang_zhao', '장소', '張昭', 60, 26, 90, 92, 76, '궁병', 'gyeonsu', '방원'),
  G('gu_yong', '고옹', '顧雍', 58, 24, 84, 90, 70, '궁병', 'gyeonsu', '방원'),
  G('ling_tong', '능통', '凌統', 84, 86, 68, 62, 70, '수군', 'dolgyeok', '봉시'),
  G('xu_sheng', '서성', '徐盛', 80, 80, 62, 60, 64, '수군', 'cheolbyeok', '방원'),
  G('ding_feng', '정봉', '丁奉', 78, 82, 64, 58, 62, '수군', 'sujeon', '장사'),
  G('pan_zhang', '반장', '潘璋', 72, 74, 46, 38, 48, '수군', 'gyeonsu', '어린'),
  G('zhu_zhi', '주치', '朱治', 66, 66, 64, 66, 60, '수군', 'gyeonsu', '방원'),
  G('sun_huan', '손환', '孫桓', 60, 62, 60, 58, 60, '보병', 'gyeonsu', '어린'),

  // 여포군
  G('lu_bu', '여포', '呂布', 96, 100, 32, 18, 78, '기병', 'bigyeok', '봉시장사'),
  G('chen_gong', '진궁', '陳宮', 74, 44, 92, 86, 70, '궁병', 'hwagye', '방원'),
  G('gao_shun', '고순', '高順', 88, 90, 60, 46, 72, '보병', 'cheolbyeok', '방원'),
  G('zang_ba', '장패', '臧霸', 82, 86, 56, 52, 66, '보병', 'dolgyeok', '언월'),
  G('wei_xu', '위속', '魏續', 66, 68, 40, 36, 44, '기병', 'dolgyeok', '어린'),
  G('hou_cheng', '후성', '侯成', 64, 66, 36, 34, 42, '기병', 'dolgyeok', '어린'),
  G('song_xian', '송헌', '宋憲', 62, 64, 32, 30, 40, '보병', 'gyeonsu', '어린'),
  G('cao_xing', '조성', '曹性', 68, 72, 44, 40, 46, '궁병', 'jeogyeok', '학익'),
  G('hao_meng', '학맹', '郝萌', 60, 62, 34, 30, 40, '보병', 'dolgyeok', '어린'),

  // 원소군
  G('yuan_shao', '원소', '袁紹', 80, 62, 70, 82, 90, '보병', 'tongsol', '어린방원'),
  G('yuan_tan', '원담', '袁譚', 68, 72, 50, 48, 56, '기병', 'dolgyeok', '봉시'),
  G('yuan_shang', '원상', '袁尙', 66, 76, 52, 50, 66, '기병', 'dolgyeok', '봉시'),
  G('yan_liang', '안량', '顏良', 82, 94, 36, 26, 60, '기병', 'dolgyeok', '봉시'),
  G('wen_chu', '문추', '文醜', 82, 95, 32, 22, 58, '기병', 'dolgyeok', '봉시'),
  G('ju_shou', '저수', '沮授', 70, 40, 92, 86, 70, '궁병', 'sinsan', '방원'),
  G('tian_feng', '전풍', '田豐', 66, 30, 94, 88, 62, '궁병', 'sinsan', '방원'),
  G('feng_ji', '봉기', '逢紀', 60, 30, 84, 76, 48, '궁병', 'hollan', '방원'),
  G('guo_tu', '곽도', '郭圖', 58, 34, 80, 70, 44, '궁병', 'hollan', '방원'),
  G('shen_pei', '심배', '審配', 74, 56, 78, 80, 60, '보병', 'cheolbyeok', '방원'),
  G('xu_you', '허유', '許攸', 56, 24, 88, 70, 40, '궁병', 'hwagye', '방원'),
  G('chunyu_qiong', '순우경', '淳于瓊', 68, 64, 40, 46, 44, '보병', 'gyeonsu', '어린'),
  G('lv_kuang', '여광', '呂曠', 64, 66, 44, 42, 46, '보병', 'dolgyeok', '어린'),
  G('lv_xiang', '여상', '呂翔', 62, 64, 42, 40, 44, '보병', 'dolgyeok', '어린'),
  G('yuan_xi', '원희', '袁熙', 62, 60, 54, 56, 58, '기병', 'gyeonsu', '어린'),
  G('gao_gan', '고간', '高幹', 70, 68, 60, 60, 56, '보병', 'gyeonsu', '방원'),

  // 유표군
  G('liu_biao', '유표', '劉表', 70, 54, 74, 84, 86, '보병', 'tongsol', '방원'),
  G('cai_mao', '채모', '蔡瑁', 76, 70, 62, 64, 50, '수군', 'sujeon', '방원'),
  G('kuai_yue', '괴월', '蒯越', 66, 40, 86, 88, 70, '궁병', 'gyeonsu', '방원'),
  G('huang_zu', '황조', '黃祖', 72, 74, 50, 48, 50, '수군', 'sujeon', '방원'),
  G('zhang_yun', '장윤', '張允', 66, 64, 48, 46, 44, '수군', 'sujeon', '방원'),
  G('liu_cong', '유종', '劉琮', 48, 40, 52, 60, 62, '보병', 'gyeonsu', '어린'),
  G('han_song', '한숭', '韓嵩', 58, 34, 78, 80, 60, '궁병', 'gyeonsu', '방원'),
  G('cai_xun', '채훈', '蔡勳', 60, 58, 52, 54, 50, '수군', 'gyeonsu', '방원'),
  G('yi_ji', '이규', '伊籍', 54, 36, 76, 82, 76, '궁병', 'gyeonsu', '방원'),

  // 유장군
  G('liu_zhang', '유장', '劉璋', 54, 40, 48, 66, 70, '보병', 'gyeonsu', '어린'),
  G('zhang_ren', '장임', '張任', 84, 86, 72, 66, 70, '궁병', 'jeogyeok', '학익'),
  G('zhang_song', '장송', '張松', 42, 20, 82, 74, 40, '궁병', 'gyeonsu', '방원'),
  G('huang_quan', '황권', '黃權', 72, 60, 80, 80, 66, '보병', 'gyeonsu', '방원'),
  G('lei_tong', '뇌동', '雷銅', 66, 72, 46, 42, 48, '보병', 'dolgyeok', '어린'),
  G('ling_bao', '냉포', '泠苞', 64, 70, 44, 40, 46, '보병', 'dolgyeok', '어린'),
  G('deng_xian', '등현', '鄧賢', 62, 66, 44, 42, 44, '보병', 'gyeonsu', '어린'),
  G('liu_gui', '유괴', '劉璝', 70, 72, 58, 56, 54, '보병', 'gyeonsu', '방원'),
  G('yang_huai', '양회', '楊懷', 68, 70, 50, 48, 50, '보병', 'gyeonsu', '어린'),
  G('gao_pei', '고패', '高沛', 66, 68, 48, 46, 48, '보병', 'gyeonsu', '어린'),

  // 마등·한수
  G('ma_teng', '마등', '馬騰', 82, 84, 60, 62, 82, '기병', 'dolgyeok', '봉시'),
  G('ma_chao', '마초', '馬超', 94, 98, 48, 40, 88, '기병', 'bigyeok', '봉시장사'),
  G('pang_de', '방덕', '龐德', 86, 92, 66, 58, 72, '기병', 'cheolbyeok', '봉시'),
  G('ma_xiu', '마휴', '馬休', 66, 70, 50, 50, 56, '기병', 'dolgyeok', '어린'),
  G('ma_tie', '마철', '馬鐵', 64, 68, 48, 48, 54, '기병', 'dolgyeok', '어린'),
  G('han_sui', '한수', '韓遂', 78, 76, 66, 64, 66, '기병', 'gyeonsu', '방원'),
  G('cheng_yi', '성의', '成宜', 66, 68, 44, 42, 44, '기병', 'dolgyeok', '어린'),
  G('hou_xuan', '후선', '侯選', 64, 66, 42, 40, 42, '기병', 'gyeonsu', '어린'),
  G('liang_xing', '양흥', '梁興', 64, 66, 40, 38, 40, '기병', 'dolgyeok', '어린'),
  G('yan_xing', '염행', '閻行', 72, 74, 58, 56, 56, '기병', 'gyeonsu', '봉시'),

  // 공손찬군
  G('gongsun_zan', '공손찬', '公孫瓚', 82, 78, 60, 58, 74, '기병', 'dolgyeok', '봉시'),
  G('gongsun_yue', '공손월', '公孫越', 64, 66, 44, 42, 48, '기병', 'dolgyeok', '어린'),
  G('gongsun_fan', '공손범', '公孫範', 62, 64, 42, 42, 46, '기병', 'gyeonsu', '어린'),
  G('shan_jing', '선경우', '單經', 60, 58, 50, 52, 46, '보병', 'gyeonsu', '방원'),
  G('tian_kai', '전해', '田楷', 68, 66, 56, 58, 56, '보병', 'gyeonsu', '어린'),
  G('yan_gang', '엄강', '嚴綱', 62, 64, 40, 38, 40, '기병', 'dolgyeok', '어린'),
  G('guan_jing', '관정', '關靖', 58, 44, 74, 70, 56, '궁병', 'hwagye', '방원'),
  G('zou_dan', '추단', '鄒丹', 60, 60, 40, 40, 42, '기병', 'dolgyeok', '어린'),
  G('gongsun_du', '공손도', '公孫度', 68, 62, 66, 68, 60, '보병', 'gyeonsu', '방원'),

  // 원술군
  G('yuan_shu', '원술', '袁術', 62, 50, 54, 62, 74, '보병', 'gyeonsu', '어린'),
  G('ji_ling', '기령', '紀靈', 78, 84, 44, 38, 50, '보병', 'dolgyeok', '어린'),
  G('zhang_xun', '장훈', '張勳', 68, 70, 50, 54, 50, '보병', 'gyeonsu', '방원'),
  G('qiao_rui', '교예', '橋蕤', 64, 66, 46, 46, 44, '보병', 'dolgyeok', '어린'),
  G('lei_bao', '뇌박', '雷薄', 60, 62, 38, 36, 38, '보병', 'dolgyeok', '어린'),
  G('chen_lan', '진란', '陳蘭', 58, 60, 36, 34, 36, '보병', 'gyeonsu', '어린'),
  G('yang_hong', '양홍', '楊弘', 56, 42, 70, 66, 54, '궁병', 'gyeonsu', '방원'),
  G('yan_xiang', '염상', '閻象', 52, 30, 74, 72, 56, '궁병', 'gyeonsu', '방원'),

  // 장로군
  G('zhang_lu', '장로', '張魯', 60, 44, 70, 74, 78, '보병', 'gyeonsu', '어린'),
  G('zhang_wei', '장위', '張衛', 70, 74, 54, 50, 54, '보병', 'gyeonsu', '방원'),
  G('yang_ren', '양임', '楊任', 68, 70, 52, 48, 50, '보병', 'dolgyeok', '어린'),
  G('yan_pu', '염포', '閻圃', 54, 30, 80, 78, 60, '궁병', 'sinsan', '방원'),
  G('yang_song', '양송', '楊松', 40, 20, 60, 50, 30, '보병', 'gyeonsu', '방원'),
  G('yang_bo', '양백', '楊柏', 60, 62, 44, 42, 44, '보병', 'gyeonsu', '어린'),

  // 도겸군
  G('tao_qian', '도겸', '陶謙', 60, 40, 62, 74, 82, '보병', 'indeok', '방원'),
  G('cao_bao', '조표', '曹豹', 62, 64, 40, 44, 42, '보병', 'gyeonsu', '어린'),

  // 유요군
  G('liu_yao', '유요', '劉繇', 58, 50, 60, 66, 70, '보병', 'gyeonsu', '방원'),
  G('zhang_ying', '장영', '張英', 62, 64, 44, 42, 44, '보병', 'dolgyeok', '어린'),
  G('fan_neng', '번능', '樊能', 58, 60, 40, 38, 40, '보병', 'gyeonsu', '어린'),
  G('yu_mi', '우미', '于糜', 54, 56, 38, 36, 38, '보병', 'gyeonsu', '어린'),

  // 공융군
  G('kong_rong', '공융', '孔融', 40, 20, 82, 78, 86, '궁병', 'indeok', '방원'),
  G('wu_anguo', '무안국', '武安國', 62, 70, 42, 40, 46, '보병', 'gyeonsu', '어린'),

  // 이각·곽사군
  G('li_jue', '이각', '李傕', 78, 84, 44, 34, 30, '기병', 'dolgyeok', '봉시'),
  G('guo_si', '곽사', '郭汜', 74, 82, 38, 30, 28, '기병', 'dolgyeok', '봉시'),
  G('zhang_ji', '장제', '張濟', 70, 74, 48, 46, 44, '기병', 'gyeonsu', '어린'),
  G('fan_chou', '번조', '樊稠', 72, 80, 40, 34, 34, '기병', 'dolgyeok', '어린'),
  G('yang_feng', '양봉', '楊奉', 66, 70, 44, 42, 44, '보병', 'gyeonsu', '방원'),

  // 사섭군
  G('shi_xie', '사섭', '士燮', 56, 40, 62, 74, 80, '보병', 'gyeonsu', '방원'),
  G('shi_yi', '사의', '士壹', 50, 40, 54, 62, 60, '보병', 'gyeonsu', '어린'),
];

export const GENERAL_BY_ID = Object.fromEntries(GENERALS.map((g) => [g.id, g]));

export const ARMS = ['보병', '궁병', '기병', '수군'];

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
  free: '#6b6b6b',
};

/* 시나리오 */
export const SCENARIOS = [
  {
    id: 's194',
    year: 194,
    name: '군웅할거',
    hanja: '群雄割據',
    desc: '동탁이 죽고 천하가 쪼개졌다. 조조는 연주에서 여포와 맞서고, 원소는 기주를 움켜쥐었다. 유비는 서주에 몸을 붙였다.',
    factions: [
      { id: 'jojo', name: '조조', hanja: '曹操', lord: 'cao_cao', cities: ['xuchang', 'chenliu'], gold: 0,
        generals: ['cao_cao', 'xiahou_dun', 'xiahou_yuan', 'cao_ren', 'cao_hong', 'yue_jin', 'yu_jin', 'dian_wei', 'xun_yu', 'xun_you', 'cheng_yu', 'man_chong', 'mao_jie', 'cao_chun', 'cao_xiu', 'lv_qian', 'li_dian', 'zhu_ling'] },
      { id: 'lubu', name: '여포', hanja: '呂布', lord: 'lu_bu', cities: ['puyang'],
        generals: ['lu_bu', 'chen_gong', 'gao_shun', 'zhang_liao', 'zang_ba', 'wei_xu', 'hou_cheng', 'song_xian', 'cao_xing', 'hao_meng'] },
      { id: 'yuanshao', name: '원소', hanja: '袁紹', lord: 'yuan_shao', cities: ['ye', 'nanpi', 'pingyuan', 'julu', 'jinyang'],
        generals: ['yuan_shao', 'yuan_tan', 'yuan_shang', 'yan_liang', 'wen_chu', 'ju_shou', 'tian_feng', 'feng_ji', 'guo_tu', 'shen_pei', 'xu_you', 'chunyu_qiong', 'lv_kuang', 'lv_xiang', 'yuan_xi', 'gao_gan', 'zhang_he', 'gao_lan'] },
      { id: 'gongsunzan', name: '공손찬', hanja: '公孫瓚', lord: 'gongsun_zan', cities: ['ji', 'beiping'],
        generals: ['gongsun_zan', 'gongsun_yue', 'gongsun_fan', 'shan_jing', 'tian_kai', 'yan_gang', 'guan_jing', 'zou_dan'] },
      { id: 'gongsundu', name: '공손도', hanja: '公孫度', lord: 'gongsun_du', cities: ['xiangping'], generals: ['gongsun_du'] },
      { id: 'liubei', name: '유비', hanja: '劉備', lord: 'liu_bei', cities: ['xiaopei'],
        generals: ['liu_bei', 'guan_yu', 'zhang_fei', 'sun_qian', 'mi_zhu', 'jian_yong'] },
      { id: 'taoqian', name: '도겸', hanja: '陶謙', lord: 'tao_qian', cities: ['xiapi', 'pengcheng', 'guangling'],
        generals: ['tao_qian', 'cao_bao', 'chen_deng', 'chen_gui'] },
      { id: 'kong_rong', name: '공융', hanja: '孔融', lord: 'kong_rong', cities: ['beihai', 'linzi'],
        generals: ['kong_rong', 'wu_anguo'] },
      { id: 'li_jue', name: '이각', hanja: '李傕', lord: 'li_jue', cities: ['changan', 'hongnong', 'luoyang'],
        generals: ['li_jue', 'guo_si', 'zhang_ji', 'fan_chou', 'yang_feng'] },
      { id: 'sunce', name: '손책', hanja: '孫策', lord: 'sun_ce', cities: ['jianye', 'wu', 'kuaiji'],
        generals: ['sun_ce', 'zhou_yu', 'cheng_pu', 'huang_gai', 'han_dang', 'zhang_zhao', 'jiang_qin', 'zhu_zhi', 'sun_quan', 'lv_fan'] },
      { id: 'liuyao', name: '유요', hanja: '劉繇', lord: 'liu_yao', cities: ['lujiang'],
        generals: ['liu_yao', 'taishi_ci', 'zhang_ying', 'fan_neng', 'yu_mi'] },
      { id: 'yuan_shu', name: '원술', hanja: '袁術', lord: 'yuan_shu', cities: ['shouchun', 'runan', 'yuzhang'],
        generals: ['yuan_shu', 'ji_ling', 'zhang_xun', 'qiao_rui', 'lei_bao', 'chen_lan', 'yang_hong', 'yan_xiang'] },
      { id: 'liubiao', name: '유표', hanja: '劉表', lord: 'liu_biao', cities: ['xiangyang', 'jiangling', 'jiangxia', 'changsha', 'guiyang', 'xinye'],
        generals: ['liu_biao', 'cai_mao', 'kuai_yue', 'huang_zu', 'wen_pin', 'zhang_yun', 'han_song', 'cai_xun', 'yi_ji', 'liu_cong', 'huang_zhong', 'wei_yan'] },
      { id: 'liuzhang', name: '유장', hanja: '劉璋', lord: 'liu_zhang', cities: ['chengdu', 'zitong', 'jiangzhou'],
        generals: ['liu_zhang', 'zhang_ren', 'zhang_song', 'huang_quan', 'lei_tong', 'ling_bao', 'deng_xian', 'liu_gui', 'yang_huai', 'gao_pei', 'fa_zheng', 'wu_yi', 'li_yan'] },
      { id: 'zhanglu', name: '장로', hanja: '張魯', lord: 'zhang_lu', cities: ['hanzhong'],
        generals: ['zhang_lu', 'zhang_wei', 'yang_ren', 'yan_pu', 'yang_song', 'yang_bo'] },
      { id: 'mateng', name: '마등', hanja: '馬騰', lord: 'ma_teng', cities: ['wuwei', 'tianshui'],
        generals: ['ma_teng', 'ma_chao', 'pang_de', 'ma_xiu', 'ma_tie', 'ma_dai'] },
      { id: 'hansui', name: '한수', hanja: '韓遂', lord: 'han_sui', cities: ['longxi'],
        generals: ['han_sui', 'cheng_yi', 'hou_xuan', 'liang_xing', 'yan_xing'] },
      { id: 'shixie', name: '사섭', hanja: '士燮', lord: 'shi_xie', cities: ['nanhai', 'jiaozhi'], generals: ['shi_xie', 'shi_yi'] },
    ],
    free: { beiping: ['zhao_yun'], jiangxia: ['gan_ning'], chenliu: ['sima_yi', 'liu_ye'], xuchang: ['xu_chu', 'guo_jia', 'jia_xu'], xiangyang: ['zhuge_liang', 'pang_tong'], chengdu: ['lu_xun'] },
  },
  {
    id: 's200',
    year: 200,
    name: '관도대전',
    hanja: '官渡之戰',
    desc: '하북의 원소와 중원의 조조가 황하를 사이에 두고 격돌한다. 서주에는 유비가, 강동에는 손권이 자리한다.',
    factions: [
      { id: 'jojo', name: '조조', hanja: '曹操', lord: 'cao_cao', cities: ['xuchang', 'luoyang', 'chenliu', 'hongnong', 'puyang', 'runan', 'linzi', 'beihai', 'guangling'],
        generals: ['cao_cao', 'xiahou_dun', 'xiahou_yuan', 'cao_ren', 'cao_hong', 'xu_huang', 'yue_jin', 'yu_jin', 'xu_chu', 'xun_yu', 'xun_you', 'guo_jia', 'cheng_yu', 'jia_xu', 'liu_ye', 'man_chong', 'lv_qian', 'cao_ang', 'li_dian', 'zhu_ling', 'mao_jie', 'cao_chun', 'cao_xiu'] },
      { id: 'yuanshao', name: '원소', hanja: '袁紹', lord: 'yuan_shao', cities: ['ye', 'nanpi', 'pingyuan', 'julu', 'jinyang', 'ji', 'beiping'],
        generals: ['yuan_shao', 'yuan_tan', 'yuan_shang', 'yan_liang', 'wen_chu', 'zhang_he', 'gao_lan', 'ju_shou', 'tian_feng', 'feng_ji', 'guo_tu', 'shen_pei', 'xu_you', 'chunyu_qiong', 'lv_kuang', 'lv_xiang', 'yuan_xi', 'gao_gan'] },
      { id: 'liubei', name: '유비', hanja: '劉備', lord: 'liu_bei', cities: ['xiapi', 'pengcheng', 'xiaopei'],
        generals: ['liu_bei', 'guan_yu', 'zhang_fei', 'zhao_yun', 'sun_qian', 'mi_zhu', 'jian_yong', 'chen_deng', 'chen_gui'] },
      { id: 'sunquan', name: '손권', hanja: '孫權', lord: 'sun_quan', cities: ['jianye', 'wu', 'kuaiji', 'lujiang', 'yuzhang'],
        generals: ['sun_quan', 'zhou_yu', 'lu_su', 'cheng_pu', 'huang_gai', 'han_dang', 'taishi_ci', 'zhang_zhao', 'jiang_qin', 'zhu_zhi', 'lv_fan', 'zhuge_jin', 'ling_tong', 'xu_sheng', 'ding_feng', 'pan_zhang'] },
      { id: 'yuan_shu', name: '원술', hanja: '袁術', lord: 'yuan_shu', cities: ['shouchun'],
        generals: ['yuan_shu', 'ji_ling', 'zhang_xun', 'qiao_rui'] },
      { id: 'liubiao', name: '유표', hanja: '劉表', lord: 'liu_biao', cities: ['xiangyang', 'jiangling', 'jiangxia', 'changsha', 'guiyang', 'xinye'],
        generals: ['liu_biao', 'cai_mao', 'kuai_yue', 'huang_zu', 'wen_pin', 'zhang_yun', 'han_song', 'cai_xun', 'yi_ji', 'liu_cong', 'huang_zhong', 'wei_yan'] },
      { id: 'liuzhang', name: '유장', hanja: '劉璋', lord: 'liu_zhang', cities: ['chengdu', 'zitong', 'jiangzhou'],
        generals: ['liu_zhang', 'zhang_ren', 'zhang_song', 'huang_quan', 'lei_tong', 'ling_bao', 'deng_xian', 'liu_gui', 'yang_huai', 'gao_pei', 'fa_zheng', 'wu_yi', 'li_yan'] },
      { id: 'zhanglu', name: '장로', hanja: '張魯', lord: 'zhang_lu', cities: ['hanzhong'],
        generals: ['zhang_lu', 'zhang_wei', 'yang_ren', 'yan_pu', 'yang_bo'] },
      { id: 'gongsundu', name: '공손도', hanja: '公孫度', lord: 'gongsun_du', cities: ['xiangping'], generals: ['gongsun_du'] },
      { id: 'mateng', name: '마등', hanja: '馬騰', lord: 'ma_teng', cities: ['wuwei', 'tianshui', 'changan'],
        generals: ['ma_teng', 'ma_chao', 'pang_de', 'ma_xiu', 'ma_tie', 'ma_dai'] },
      { id: 'hansui', name: '한수', hanja: '韓遂', lord: 'han_sui', cities: ['longxi'],
        generals: ['han_sui', 'cheng_yi', 'hou_xuan', 'liang_xing', 'yan_xing'] },
      { id: 'shixie', name: '사섭', hanja: '士燮', lord: 'shi_xie', cities: ['nanhai', 'jiaozhi'], generals: ['shi_xie', 'shi_yi'] },
    ],
    free: { xinye: ['xushu'], luoyang: ['sima_yi'], xuchang: ['zhuge_liang'], chengdu: ['pang_tong'] },
  },
  {
    id: 's208',
    year: 208,
    name: '적벽대전',
    hanja: '赤壁之戰',
    desc: '북방을 통일한 조조가 백만 대군으로 남하한다. 형주는 무너지고, 유비와 손권은 손을 잡을 수밖에 없다.',
    factions: [
      { id: 'jojo', name: '조조', hanja: '曹操', lord: 'cao_cao', cities: ['xuchang', 'luoyang', 'changan', 'hongnong', 'chenliu', 'puyang', 'ye', 'nanpi', 'pingyuan', 'julu', 'jinyang', 'ji', 'beiping', 'xiangping', 'xiaopei', 'pengcheng', 'xiapi', 'guangling', 'shouchun', 'runan', 'linzi', 'beihai'],
        generals: ['cao_cao', 'xiahou_dun', 'xiahou_yuan', 'cao_ren', 'cao_hong', 'zhang_liao', 'zhang_he', 'xu_huang', 'yue_jin', 'yu_jin', 'xu_chu', 'xun_yu', 'xun_you', 'cheng_yu', 'sima_yi', 'jia_xu', 'liu_ye', 'man_chong', 'lv_qian', 'cao_ang', 'wen_pin', 'li_dian', 'gao_lan', 'zhu_ling', 'mao_jie', 'cao_chun', 'cao_xiu'] },
      { id: 'liubei', name: '유비', hanja: '劉備', lord: 'liu_bei', cities: ['xinye'],
        generals: ['liu_bei', 'guan_yu', 'zhang_fei', 'zhao_yun', 'zhuge_liang', 'sun_qian', 'mi_zhu', 'jian_yong', 'liu_feng'] },
      { id: 'sunquan', name: '손권', hanja: '孫權', lord: 'sun_quan', cities: ['jianye', 'wu', 'kuaiji', 'lujiang', 'yuzhang'],
        generals: ['sun_quan', 'zhou_yu', 'lu_su', 'lu_meng', 'lu_xun', 'cheng_pu', 'huang_gai', 'han_dang', 'taishi_ci', 'gan_ning', 'zhou_tai', 'zhang_zhao', 'gu_yong', 'zhuge_jin', 'lv_fan', 'jiang_qin', 'ling_tong', 'xu_sheng', 'ding_feng', 'zhu_zhi', 'sun_huan'] },
      { id: 'liubiao', name: '유표', hanja: '劉表', lord: 'liu_biao', cities: ['xiangyang', 'jiangling', 'jiangxia', 'changsha', 'guiyang'],
        generals: ['liu_biao', 'cai_mao', 'kuai_yue', 'huang_zu', 'zhang_yun', 'han_song', 'cai_xun', 'yi_ji', 'liu_cong', 'huang_zhong', 'wei_yan'] },
      { id: 'liuzhang', name: '유장', hanja: '劉璋', lord: 'liu_zhang', cities: ['chengdu', 'zitong', 'jiangzhou'],
        generals: ['liu_zhang', 'zhang_ren', 'zhang_song', 'huang_quan', 'lei_tong', 'ling_bao', 'deng_xian', 'liu_gui', 'yang_huai', 'gao_pei', 'fa_zheng', 'wu_yi', 'li_yan'] },
      { id: 'zhanglu', name: '장로', hanja: '張魯', lord: 'zhang_lu', cities: ['hanzhong'],
        generals: ['zhang_lu', 'zhang_wei', 'yang_ren', 'yan_pu', 'yang_song', 'yang_bo'] },
      { id: 'mateng', name: '마등', hanja: '馬騰', lord: 'ma_teng', cities: ['wuwei', 'tianshui', 'longxi'],
        generals: ['ma_teng', 'ma_chao', 'pang_de', 'ma_xiu', 'ma_tie', 'ma_dai', 'han_sui', 'cheng_yi', 'hou_xuan', 'liang_xing', 'yan_xing'] },
      { id: 'shixie', name: '사섭', hanja: '士燮', lord: 'shi_xie', cities: ['nanhai', 'jiaozhi'], generals: ['shi_xie', 'shi_yi'] },
    ],
    free: { xiangyang: ['pang_tong', 'xu_shu'], wu: ['sun_jian'] },
  },
];

export const FORMATION_IDS = Object.keys(FORMATIONS);
