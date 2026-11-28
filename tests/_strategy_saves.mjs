/* 2026-11-28 집중 탐색 · 공동 공격 라이브 검증용 저장 파일.
 * 실제 엔진으로 게임을 만들어 조건만 맞춘다(UI 조작은 verify_strategy_depth.py 가 한다).
 * 사용: node tests/_strategy_saves.mjs [OUT_DIR]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createGame, factionCities, generalsInCity, serialize, focusSearchCandidates, jointTargets, isAdjacent, cityPower, pairKey } from '../js/engine.js';

const out = process.argv[2] || '/tmp/strategy-saves';
fs.mkdirSync(out, { recursive: true });

/* 아군 성 하나 — 장수가 있고 금이 넉넉한 곳 */
function homeCity(s) {
  const cs = factionCities(s, s.playerId).filter((c) => generalsInCity(s, c.id).length);
  cs.sort((a, b) => b.gold - a.gold);
  return cs[0].id;
}

/* 공동 공격 대상이 있는 이웃 세력 */
function allyWithTarget(s) {
  for (const fid of Object.keys(s.factions)) {
    if (fid === s.playerId || !s.factions[fid].alive) continue;
    const t = jointTargets(s, fid);
    if (t.length) return { fid, target: t[0].id };
  }
  return null;
}

const s = createGame('s194', 'jojo', 777);
const cid = homeCity(s);
s.cities[cid].gold = 20000;

/* 1) 집중 탐색 — 가장 약한 재야 장수(승낙 확률이 가장 높다)와의 친밀도를 올려 둔다 */
const cands = focusSearchCandidates(s, cid);
const guest = cands[cands.length - 1];
s.affinity[guest.id] = 100;
s.factions[s.playerId].fame = 100;

/* 2) 공동 공격 — 이웃 세력과 동맹·우호 85, 그 세력의 국경 병력을 넉넉히 */
const pick = allyWithTarget(s);
if (!pick) { console.error('공동 공격 대상이 있는 세력을 찾지 못했습니다.'); process.exit(1); }
const k = pairKey(s.playerId, pick.fid);
s.diplomacy.ally[k] = 12;
s.diplomacy.rel[k] = 85;
for (const c of factionCities(s, pick.fid)) {
  if (!isAdjacent(c.id, pick.target)) continue;
  c.troops = Math.max(c.troops, Math.round(cityPower(s, pick.target, true) * 1.5));
  c.train = 100;
}

const file = path.join(out, 'strategy.json');
fs.writeFileSync(file, serialize(s));
console.log(file);
console.log(`집중 탐색: 성 ${cid} · 후보 ${guest.ko}(${guest.id}) · 친밀 ${s.affinity[guest.id]}`);
console.log(`공동 공격: ${s.factions[pick.fid].name}군(${pick.fid}) → ${pick.target}`);
