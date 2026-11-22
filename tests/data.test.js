import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, CITY_BY_ID, GENERALS, GENERAL_BY_ID, SCENARIOS, FORMATIONS, SKILLS, ARMS, CORE_FORMATIONS } from '../js/data.js';

test('성 42곳 · id 유일 · 필수 거점 포함', () => {
  assert.equal(CITIES.length, 42);
  const ids = new Set(CITIES.map((c) => c.id));
  assert.equal(ids.size, CITIES.length);
  const names = CITIES.map((c) => c.ko);
  for (const need of ['낙양', '장안', '허창', '업', '건업', '강릉', '양양', '한중', '성도', '하비']) {
    assert.ok(names.includes(need), `${need} 성이 있어야 합니다`);
  }
  const regions = new Set(CITIES.map((c) => c.region));
  assert.ok(regions.size >= 13, '권역 13종');
  for (const r of ['유주', '기주', '청주', '서주', '연주', '예주', '사례', '량주', '형주', '양주', '익주', '교주']) {
    assert.ok(regions.has(r), `${r} 권역`);
  }
});

test('도로망: 양방향 · 유효 id · 전 성 연결', () => {
  for (const c of CITIES) {
    for (const nb of c.roads) {
      assert.ok(CITY_BY_ID[nb], `${c.id} → ${nb} 유효`);
      assert.ok(CITY_BY_ID[nb].roads.includes(c.id), `${c.id}-${nb} 양방향`);
      assert.notEqual(nb, c.id);
    }
  }
  const seen = new Set(['luoyang']);
  const q = ['luoyang'];
  while (q.length) {
    const cur = q.shift();
    for (const nb of CITY_BY_ID[cur].roads) {
      if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    }
  }
  assert.equal(seen.size, CITIES.length, '모든 성이 하나의 도로망으로 연결');
  // 각 성은 최소 1개 도로
  for (const c of CITIES) assert.ok(c.roads.length >= 1, `${c.id} 도로`);
});

test('장수 350명 이상 · 능력치 범위 · 진형/특기/병과 유효', () => {
  assert.ok(GENERALS.length >= 350, `장수 ${GENERALS.length}명`);
  assert.equal(new Set(GENERALS.map((g) => g.id)).size, GENERALS.length);
  assert.equal(new Set(GENERALS.map((g) => g.ko)).size, GENERALS.length, '한글 이름 중복 없음');
  for (const g of GENERALS) {
    for (const k of ['lead', 'war', 'int', 'pol', 'cha']) {
      assert.ok(g[k] >= 1 && g[k] <= 100, `${g.ko}.${k}=${g[k]}`);
    }
    assert.ok(ARMS.includes(g.arms), `${g.ko} 병과 ${g.arms}`);
    assert.ok(SKILLS[g.skill], `${g.ko} 특기 ${g.skill}`);
    assert.ok(g.formations.length >= 1, `${g.ko} 진형`);
    for (const f of g.formations) assert.ok(FORMATIONS[f], `${g.ko} 진형 ${f}`);
  }
  const famous = ['조조', '유비', '손권', '여포', '원소', '유표', '유장', '마등', '관우', '장비', '제갈량', '주유', '여몽', '사마의'];
  const names = GENERALS.map((g) => g.ko);
  for (const n of famous) assert.ok(names.includes(n), `${n} 포함`);
  // 황건·한말과 삼국 후기 보강 인물
  const added = ['장각', '장보', '장량', '황보숭', '노식', '주준', '하진', '정원', '동탁', '왕윤', '화웅', '이유', '우보', '서영',
    '조비', '조진', '등애', '종회', '양호', '두예', '강유', '장완', '비의', '곽준', '마충', '관흥', '장포', '육항', '주연', '제갈각', '맹획', '축융'];
  for (const n of added) assert.ok(names.includes(n), `${n} 포함`);
});

test('진형 11종(핵심 9종 + 안행·수진): 공격/방어/기동/사거리 정의', () => {
  const keys = Object.keys(FORMATIONS);
  assert.equal(keys.length, 11);
  for (const k of keys) {
    const f = FORMATIONS[k];
    assert.ok(f.atk > 0 && f.def > 0 && f.move > 0, k);
    assert.ok([1, 2].includes(f.range), k + ' 사거리');
  }
  // 요청하신 핵심 9종은 모두 존재하고 상성표에 들어 있다
  for (const ko of ['학익', '어린', '봉시', '방원', '장사', '언월', '추행', '구행', '형액']) {
    assert.ok(keys.some((k) => FORMATIONS[k].ko === ko), ko + ' 진형');
  }
  assert.equal(CORE_FORMATIONS.length, 9);
  for (const id of CORE_FORMATIONS) assert.ok(FORMATIONS[id], id);
  const atk = keys.map((k) => FORMATIONS[k].atk);
  const def = keys.map((k) => FORMATIONS[k].def);
  assert.ok(Math.max(...atk) !== Math.min(...atk), '공격 계수 차이');
  assert.ok(Math.max(...def) !== Math.min(...def), '방어 계수 차이');
});

test('시나리오 7종 · 성 중복 배정 없음 · 장수 중복 없음', () => {
  assert.equal(SCENARIOS.length, 7);
  assert.deepEqual(SCENARIOS.map((s) => s.year), [184, 189, 194, 200, 208, 219, 225]);
  assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, SCENARIOS.length);
  const allCityIds = CITIES.map((c) => c.id);
  for (const sc of SCENARIOS) {
    const cityOwner = new Map();
    const genOwner = new Map();
    for (const f of sc.factions) {
      assert.ok(GENERAL_BY_ID[f.lord], `${sc.id} ${f.name} 군주`);
      assert.ok(f.generals.includes(f.lord), `${sc.id} ${f.name} 군주가 소속 장수에 포함`);
      assert.ok(f.cities.length >= 1, `${sc.id} ${f.name} 성`);
      assert.ok(f.generals.length >= 1, `${sc.id} ${f.name} 장수`);
      for (const c of f.cities) {
        assert.ok(CITY_BY_ID[c], `${sc.id} 성 ${c}`);
        assert.ok(!cityOwner.has(c), `${sc.id} ${c} 중복 소유 (${cityOwner.get(c)} / ${f.id})`);
        cityOwner.set(c, f.id);
      }
      for (const g of f.generals) {
        assert.ok(GENERAL_BY_ID[g], `${sc.id} 장수 ${g}`);
        assert.ok(!genOwner.has(g), `${sc.id} ${g} 중복 소속 (${genOwner.get(g)} / ${f.id})`);
        genOwner.set(g, f.id);
      }
    }
    // 성 42곳이 빈틈없이 한 세력씩 차지해야 한다(전 시나리오 공통)
    assert.equal(cityOwner.size, allCityIds.length, `${sc.id}: 소유자 없는 성 ${allCityIds.filter((c) => !cityOwner.has(c)).join(',')}`);
    // 세력 id 유일
    assert.equal(new Set(sc.factions.map((f) => f.id)).size, sc.factions.length, `${sc.id} 세력 id`);
    // 재야 장수는 소속과 겹치지 않아야 함
    for (const [city, list] of Object.entries(sc.free || {})) {
      assert.ok(CITY_BY_ID[city], `${sc.id} 재야 위치 ${city}`);
      for (const g of list) {
        assert.ok(GENERAL_BY_ID[g], `${sc.id} 재야 장수 ${g}`);
        assert.ok(!genOwner.has(g), `${sc.id} 재야 ${g} 중복`);
      }
    }
    if (sc.id === 's194') assert.ok(sc.factions.length >= 12);
    if (sc.id === 's184') {
      const names = sc.factions.map((f) => f.name);
      assert.ok(names.includes('황건적') && names.includes('한실'), '184 황건적·한실');
    }
    if (sc.id === 's189') assert.ok(sc.factions.some((f) => f.id === 'dongzhuo'), '189 동탁');
    if (sc.id === 's219' || sc.id === 's225') {
      const ids = sc.factions.map((f) => f.id);
      assert.ok(ids.includes('jojo') && ids.includes('liubei') && ids.includes('sunquan'), `${sc.id} 위·촉·오`);
    }
    if (sc.id === 's225') assert.ok(sc.factions.some((f) => f.id === 'nanman'), '225 남만');
  }
});
