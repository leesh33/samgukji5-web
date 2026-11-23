import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as B from '../js/battle.js';

/* 공적(merit) 누적 · 장군 직위 임명 · 지휘 병력 상한 · 세이브 호환 */

const newGame = (seed = 11) => E.createGame('s194', 'jojo', seed);
const playerLord = (s) => s.factions[s.playerId].lord;

/* ---------- 기본값과 직위 사다리 ---------- */
test('새 게임: 모든 장수는 일반·공적 0, 군주는 군주 직위로 10,000명', () => {
  const s = newGame(3);
  for (const g of Object.values(s.generals)) {
    assert.equal(g.merit, 0, `${g.id} 공적`);
    assert.equal(g.rank, 0, `${g.id} 직위`);
  }
  const r = E.rankInfoOf(s, playerLord(s));
  assert.equal(r.ko, '군주');
  assert.equal(r.cap, 10000);
  assert.equal(r.isLord, true);
  assert.equal(r.canPromote, false, '군주는 임명 대상이 아니다');
  assert.deepEqual(E.RANKS.map((x) => x.ko), ['일반', '비장군', '편장군', '아장군', '진북장군', '정북장군', '대장군']);
  assert.deepEqual(E.RANKS.map((x) => x.merit), [0, 80, 200, 400, 700, 1100, 1600]);
  assert.deepEqual(E.RANKS.map((x) => x.cap), [3000, 4000, 5000, 6500, 8000, 9000, 10000]);
  assert.equal(E.RANKS[1].bonus, 0.03, '단계마다 3% 보정');
  assert.equal(E.RANKS[6].bonus, 0.18);
});

/* ---------- 행동으로 공적이 쌓인다 ---------- */
test('개발·상업·치안·수리·징병·훈련이 그 장수의 공적을 쌓는다', () => {
  const s = newGame(7);
  const gid = 'xiahou_dun';
  const run = (type) => {
    s.actionPoints = 6;
    s.generals[gid].acted = false;
    const c = s.cities.chenliu;
    c.gold = 8000; c.food = 8000;
    c.agri = 40; c.comm = 40; c.order = 40; c.water = 40;
    return E.runCommand(s, type, { cityId: 'chenliu', officerId: gid });
  };
  const expect = { agri: [15, 25], comm: [15, 25], order: [15, 25], water: [15, 25], draft: [18, 24], train: [18, 24] };
  let total = 0;
  for (const type of Object.keys(expect)) {
    const before = s.generals[gid].merit;
    const r = run(type);
    assert.ok(r.ok, `${type}: ${r.msg}`);
    const [lo, hi] = expect[type];
    assert.ok(r.merit >= lo && r.merit <= hi, `${type} 공적 ${r.merit} (${lo}~${hi})`);
    assert.equal(s.generals[gid].merit, before + r.merit, `${type} 누적`);
    assert.equal(r.fx.kind, type);
    assert.equal(r.fx.name, E.generalOf(s, gid).ko);
    assert.ok(r.fx.merit === r.merit);
    total += r.merit;
  }
  assert.ok(total >= 100, `한 달 여섯 번이면 비장군 문턱(80)을 넘는다: ${total}`);
  // 징병 결과 문구에 병사 수가 들어간다
  const rr = run('draft');
  assert.match(rr.fx.line, /병사 [\d,]+명을 모았습니다!/);
  assert.match(rr.fx.delta, /^병력 \+/);
});

test('등용 성공·포상도 공적을 남긴다 — 실패한 등용은 공적 없음', () => {
  const s = newGame(9);
  const officer = 'xiahou_dun';
  const free = E.freeGeneralsInCity(s, 'chenliu')[0];
  s.actionPoints = 6;
  s.generals[officer].acted = false;
  // 성공률 100%로 만든다 — 친밀도 최대
  s.affinity[free.id] = 100;
  let r = E.runCommand(s, 'hire', { cityId: 'chenliu', officerId: officer, hireId: free.id });
  assert.ok(r.ok, r.msg);
  assert.ok(r.merit >= 22 && r.merit <= 30, `등용 공적 ${r.merit}`);
  assert.equal(s.generals[free.id].faction, s.playerId);
  assert.equal(r.fx.kind, 'hire');

  // 포상
  s.actionPoints = 6;
  s.generals[officer].acted = false;
  s.cities.chenliu.gold = 5000;
  const before = s.generals[officer].merit;
  r = E.runCommand(s, 'reward', { cityId: 'chenliu', officerId: officer, rewardId: free.id });
  assert.ok(r.ok, r.msg);
  assert.ok(r.merit >= 8 && r.merit <= 14);
  assert.equal(s.generals[officer].merit, before + r.merit);
  assert.match(r.fx.line, /포상했습니다!/);
});

test('친교·계략·진형 전수도 공적을 남긴다', () => {
  const s = newGame(17);
  const free = E.freeGeneralsInCity(s, 'chenliu')[0];
  s.actionPoints = 6;
  s.cities.chenliu.gold = 5000;
  const b = E.befriend(s, free.id);
  assert.ok(b.ok, b.msg);
  assert.ok(b.merit >= 22 && b.merit <= 30, `친교 공적 ${b.merit}`);
  assert.equal(b.fx.kind, 'befriend');

  // 계략 — 유언비어를 인접한 적 성에
  s.actionPoints = 6;
  const gid = 'xiahou_dun';
  s.generals[gid].acted = false;
  s.cities.chenliu.gold = 5000;
  const p = E.runPlot(s, 'chenliu', 'puyang', 'rumor', gid);
  assert.ok(p.ok, p.msg);
  assert.ok(p.merit > 0, `계략 공적 ${p.merit}`);
  assert.equal(p.fx.kind, 'plot');

  // 진형 전수 — 학익을 아는 조인에게 악진이 배운다
  s.actionPoints = 6;
  s.generals.yue_jin.acted = false;
  const before = E.meritOf(s, 'yue_jin');
  const l = E.trainFormation(s, 'chenliu', 'yue_jin', 'hakyik', 'cao_ren');
  assert.ok(l.ok, l.msg);
  assert.ok(l.merit >= 18 && l.merit <= 24, `전수 공적 ${l.merit}`);
  assert.equal(E.meritOf(s, 'yue_jin'), before + l.merit);
  assert.equal(l.fx.kind, 'learn');
});

/* ---------- 임명 ---------- */
test('공적 80에서 비장군 — 상한 4,000 · 충성 +5 · 행동력은 그대로', () => {
  const s = newGame(13);
  s.actionPoints = 3;
  const gid = 'yue_jin';
  s.generals[gid].merit = 79;
  s.generals[gid].loyalty = 70;
  const no = E.promoteGeneral(s, gid);
  assert.equal(no.ok, false);
  assert.match(no.msg, /공적/);
  assert.equal(s.generals[gid].rank, 0, '실패하면 직위 그대로');
  assert.equal(E.promotableGenerals(s).includes(gid), false);

  s.generals[gid].merit = 80;
  assert.equal(E.promotableGenerals(s).includes(gid), true, '배지 대상');
  const ap0 = s.actionPoints;
  const res = E.promoteGeneral(s, gid);
  assert.ok(res.ok, res.msg);
  assert.equal(res.from, '일반');
  assert.equal(res.to, '비장군');
  assert.equal(res.cap, 4000);
  assert.equal(s.generals[gid].rank, 1);
  assert.equal(s.generals[gid].loyalty, 75, '충성 +5');
  assert.equal(s.actionPoints, ap0, '임명은 행동력을 쓰지 않는다');
  assert.equal(E.maxTroopsOf(s, gid), 4000);
  assert.equal(E.battleBonusOf(s, gid), 0.03);
  assert.match(res.msg, /4,000/);
  assert.match(res.msg, /충성 \+5/);
});

test('직위 사다리를 하나씩 오르고 대장군 뒤에는 임명할 수 없다', () => {
  const s = newGame(19);
  const gid = 'cao_ren';
  s.generals[gid].merit = 5000;
  const seen = [];
  for (let i = 0; i < 6; i++) {
    const r = E.promoteGeneral(s, gid);
    assert.ok(r.ok, r.msg);
    seen.push(r.to);
  }
  assert.deepEqual(seen, ['비장군', '편장군', '아장군', '진북장군', '정북장군', '대장군']);
  assert.equal(E.maxTroopsOf(s, gid), 10000);
  assert.equal(s.generals[gid].loyalty, 100, '충성은 100에서 멈춘다');
  const over = E.promoteGeneral(s, gid);
  assert.equal(over.ok, false);
  assert.match(over.msg, /대장군/);
  const info = E.rankInfoOf(s, gid);
  assert.equal(info.next, null);
  assert.equal(info.progress, 1);
});

test('임명은 아군 장수만 — 적 장수·군주는 거절한다', () => {
  const s = newGame(23);
  s.generals.lu_bu.merit = 5000;
  const foe = E.canPromote(s, 'lu_bu');
  assert.equal(foe.ok, false);
  assert.match(foe.why, /아군/);
  s.generals[playerLord(s)].merit = 5000;
  const lord = E.canPromote(s, playerLord(s));
  assert.equal(lord.ok, false);
  assert.match(lord.why, /군주/);
});

/* ---------- 전투: 병력 상한과 직위 보정 ---------- */
test('출진 병력은 장수 지휘 상한까지만 — 넘는 병력은 성에 남는다', () => {
  const s = newGame(21);
  s.cities.chenliu.troops = 30000;
  for (const g of Object.values(s.generals)) { g.rank = 0; g.merit = 0; }
  const gens = E.generalsInCity(s, 'chenliu').slice(0, 2).map((g) => g.id);
  const setup = E.battleSetup(s, 'chenliu', 'puyang', { atkGenerals: gens, atkTroops: 30000 });
  assert.equal(setup.atkTroops, 6000, '일반 2명 × 3,000');
  const battle = B.createBattle({ ...setup, seed: 1, generals: E.generalMap(s) });
  for (const u of B.unitsOf(battle, 'atk')) assert.ok(u.troops <= 3000, `${u.name} ${u.troops}`);

  // 한 명을 비장군으로 올리면 상한이 7,000으로 늘어난다
  s.cities.chenliu.troops = 30000;
  s.generals[gens[0]].rank = 1;
  const setup2 = E.battleSetup(s, 'chenliu', 'puyang', { atkGenerals: gens, atkTroops: 30000 });
  assert.equal(setup2.atkTroops, 7000);
  assert.equal(setup2.troopCaps[gens[0]], 4000);
  assert.equal(setup2.rankBonus[gens[0]], 0.03);
});

test('직위 보정이 같은 조건의 피해량을 키운다', () => {
  const base = {
    fromCityId: 'xuchang', toCityId: 'chenliu',
    attackerFaction: 'jojo', defenderFaction: 'lubu',
    atkGenerals: ['cao_cao'], defGenerals: ['lu_bu'],
    atkTroops: 3000, defTroops: 3000, defBonus: 40, seed: 5, playerSide: 'atk',
  };
  const deal = (bonus) => {
    const b = B.createBattle({ ...base, rankBonus: { cao_cao: bonus } });
    const u = B.unitsOf(b, 'atk')[0];
    const t = B.unitsOf(b, 'def')[0];
    t.x = u.x + 1; t.y = u.y;
    const r = B.attack(b, u, t, 12);
    return r.damage;
  };
  const plain = deal(0);
  const ranked = deal(0.18);
  assert.ok(ranked > plain, `일반 ${plain} → 대장군 ${ranked}`);
});

test('전투 승리 공적 +50~80 — 이긴 쪽에 나선 장수 전원', () => {
  const s = newGame(27);
  const g1 = 'xiahou_dun', g2 = 'cao_ren';
  s.generals[g1].merit = 0; s.generals[g2].merit = 0;
  const res = {
    fromCityId: 'chenliu', toCityId: 'puyang', winner: 'attacker',
    atkGenerals: [g1, g2], defGenerals: ['lu_bu'],
    atkSurvivors: 4000, defSurvivors: 0, atkLoss: 1000, defLoss: 7000,
    defeatedGenerals: [], playerSide: 'atk',
  };
  const out = E.applyBattleResult(s, res, E.mulberry32 ? E.mulberry32(9) : undefined);
  for (const gid of [g1, g2]) {
    const m = s.generals[gid].merit;
    assert.ok(m >= 50 && m <= 80, `${gid} 승리 공적 ${m}`);
  }
  assert.ok(out.merit >= 100, `승리 공적 합계 ${out.merit}`);
  assert.equal(s.generals.lu_bu.merit, 0, '진 쪽은 공적이 없다');
});

/* ---------- 세이브 ---------- */
test('세이브 v10: 공적·직위가 저장되고 다시 열린다', () => {
  const s = newGame(31);
  s.generals.xiahou_dun.merit = 140;
  s.generals.xiahou_dun.rank = 1;
  const back = E.deserialize(E.serialize(s));
  assert.equal(back.version, 11);
  assert.equal(back.generals.xiahou_dun.merit, 140);
  assert.equal(back.generals.xiahou_dun.rank, 1);
  assert.equal(E.maxTroopsOf(back, 'xiahou_dun'), 4000);
});

test('옛 저장(v9)에는 공적·직위가 없어 0으로 채워 열린다', () => {
  const s = newGame(37);
  s.generals.yue_jin.merit = 300;
  s.generals.yue_jin.rank = 2;
  const raw = JSON.parse(E.serialize(s));
  raw.version = 9;
  for (const g of Object.values(raw.generals)) { delete g.merit; delete g.rank; }
  const back = E.deserialize(JSON.stringify(raw));
  assert.equal(back.version, 11);
  for (const g of Object.values(back.generals)) {
    assert.equal(g.merit, 0, `${g.id} 공적`);
    assert.equal(g.rank, 0, `${g.id} 직위`);
  }
  assert.equal(E.maxTroopsOf(back, 'yue_jin'), 3000);
  // 이상한 값도 안전하게 보정
  const raw2 = JSON.parse(E.serialize(s));
  raw2.version = 9;
  raw2.generals.yue_jin.merit = 'x';
  raw2.generals.yue_jin.rank = 99;
  const fixed = E.deserialize(JSON.stringify(raw2));
  assert.equal(fixed.generals.yue_jin.merit, 0);
  assert.equal(fixed.generals.yue_jin.rank, E.RANK_MAX);
});
