import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERALS, GENERAL_BY_ID, SCENARIOS, CITY_BY_ID, FORMATIONS, SKILLS, ARMS } from '../js/data.js';
import * as E from '../js/engine.js';

const STAT_KEYS = ['lead', 'war', 'int', 'pol', 'cha'];

test('장수 350명 이상 — 중복 id·이름 없음', () => {
  assert.ok(GENERALS.length >= 350, `장수 ${GENERALS.length}명`);
  assert.equal(new Set(GENERALS.map((g) => g.id)).size, GENERALS.length, 'id 중복 없음');
  assert.equal(new Set(GENERALS.map((g) => g.ko)).size, GENERALS.length, '한글 이름 중복 없음');
});

test('모든 장수의 능력치·병과·특기·진형이 유효하다', () => {
  for (const g of GENERALS) {
    for (const k of STAT_KEYS) {
      assert.ok(Number.isInteger(g[k]) && g[k] >= 1 && g[k] <= 100, `${g.ko}.${k}=${g[k]}`);
    }
    assert.ok(ARMS.includes(g.arms), `${g.ko} 병과 ${g.arms}`);
    assert.ok(SKILLS[g.skill], `${g.ko} 특기 ${g.skill}`);
    assert.ok(g.formations.length >= 1, `${g.ko} 진형`);
    for (const f of g.formations) assert.ok(FORMATIONS[f], `${g.ko} 진형 ${f}`);
  }
});

test('장수는 모두 시나리오 배치나 고향 성을 갖는다 — 어디에도 걸리지 않는 장수 없음', () => {
  const placed = new Set();
  for (const sc of SCENARIOS) {
    for (const f of sc.factions) for (const g of f.generals) placed.add(g);
    for (const list of Object.values(sc.free || {})) for (const g of list) placed.add(g);
  }
  for (const g of GENERALS) {
    if (g.home !== undefined) assert.ok(CITY_BY_ID[g.home], `${g.ko} 고향 ${g.home}`);
    assert.ok(placed.has(g.id) || g.home, `${g.ko} 배치·고향 없음`);
  }
});

test('시나리오 배치: 미지의 장수 없음 · 세력과 재야 중복 없음 · 재야 중복 없음', () => {
  for (const sc of SCENARIOS) {
    const owned = new Set();
    for (const f of sc.factions) {
      assert.ok(!owned.has(f.lord), `${sc.id} ${f.name} 군주 중복`);
      for (const g of f.generals) {
        assert.ok(GENERAL_BY_ID[g], `${sc.id} 미지의 장수 ${g}`);
        assert.ok(!owned.has(g), `${sc.id} ${g} 세력 중복`);
        owned.add(g);
      }
    }
    const freeSeen = new Set();
    for (const [cid, list] of Object.entries(sc.free || {})) {
      assert.ok(CITY_BY_ID[cid], `${sc.id} 재야 위치 ${cid}`);
      for (const g of list) {
        assert.ok(GENERAL_BY_ID[g], `${sc.id} 미지의 재야 ${g}`);
        assert.ok(!owned.has(g), `${sc.id} ${g} 세력·재야 중복`);
        assert.ok(!freeSeen.has(g), `${sc.id} ${g} 재야 중복`);
        freeSeen.add(g);
      }
    }
    assert.ok(owned.size >= 50, `${sc.id} 배치 장수 ${owned.size}`);
  }
});

test('보강 장수: 위·촉·오·군벌·재야 명장이 빠짐없이 들어 있다', () => {
  const names = new Set(GENERALS.map((g) => g.ko));
  const need = [
    '하후상', '조상', '문앙', '관구검', '진태', '학소', '종요', '화흠', '진군', '양수', '가규', '조창',
    '주창', '장억', '진도', '동윤', '초주', '양의', '제갈첨', '부첨', '나헌', '유선',
    '전종', '주환', '보즐', '장굉', '손소', '능조', '여대', '육개', '당자',
    '배원소', '구력거', '답돈', '괴량', '유기', '오란', '성공영', '대래동주', '타사대왕', '목록대왕',
    '사마휘', '화타', '좌자', '우길', '예형', '유우', '공손강', '장연', '가비능', '한현',
  ];
  for (const n of need) assert.ok(names.has(n), `${n} 포함`);
  // 한 글자 이름·동명이인 유의: 유언(유장의 아버지)과 유염(유비의 장수)은 다른 사람이다
  assert.ok(names.has('유언') && names.has('유염'));
  assert.notEqual(GENERAL_BY_ID.liu_yan.id, GENERAL_BY_ID.liu_yan_shu.id);
});

test('새 게임: 시나리오마다 전체 372명이 살아 있고 재야는 고향 성에 흩어진다', () => {
  for (const sc of SCENARIOS) {
    const s = E.createGame(sc.id, sc.factions[0].id, 11);
    const alive = Object.values(s.generals).filter((g) => !g.dead);
    assert.equal(alive.length, GENERALS.length, `${sc.id} 전원 배치`);
    for (const g of alive) assert.ok(g.city && CITY_BY_ID[g.city], `${sc.id} ${g.id} 위치`);
    const free = alive.filter((g) => !g.faction);
    const cities = new Set(free.map((g) => g.city));
    assert.ok(cities.size >= 20, `${sc.id} 재야가 ${cities.size}개 성에 흩어짐`);
    const luoyang = free.filter((g) => g.city === 'luoyang').length;
    assert.ok(luoyang < free.length, `${sc.id} 재야가 낙양에만 몰리지 않음`);
  }
});

test('옛 저장(v9) 호환: 새 장수는 재야로 채워지고 게임이 계속된다', () => {
  const old = E.createGame('s194', 'jojo', 5);
  // 보강 이전 저장을 흉내 낸다 — 새 장수를 지운다
  for (const g of GENERALS) if (g.home) delete old.generals[g.id];
  const json = E.serialize(old);
  const back = E.deserialize(json);
  for (const g of GENERALS) assert.ok(back.generals[g.id], `${g.ko} 복원`);
  for (const g of GENERALS) {
    if (!g.home) continue;
    const st = back.generals[g.id];
    assert.equal(st.faction, null);
    assert.ok(CITY_BY_ID[st.city], `${g.ko} 재야 위치`);
  }
  // 이어하기 뒤에도 한 달이 정상으로 돌아간다
  back.actionPoints = 3;
  const turn0 = back.turn;
  E.endTurnPhase2(back);
  assert.ok(back.turn > turn0, `${turn0} -> ${back.turn}`);
  assert.equal(Object.values(back.generals).filter((g) => !g.dead).length, GENERALS.length);
});
