/* 시나리오 무결성 점검 도우미 (테스트가 아니라 개발용 진단 스크립트) */
import { CITIES, CITY_BY_ID, GENERALS, GENERAL_BY_ID, SCENARIOS } from '../js/data.js';

const allCities = CITIES.map((c) => c.id);
let bad = 0;

console.log(`장수 ${GENERALS.length}명 · 시나리오 ${SCENARIOS.length}종`);
for (const sc of SCENARIOS) {
  const owned = new Map();
  const genOwner = new Map();
  const issues = [];
  for (const f of sc.factions) {
    if (!GENERAL_BY_ID[f.lord]) issues.push(`군주 없음 ${f.id}:${f.lord}`);
    else if (!f.generals.includes(f.lord)) issues.push(`군주 미포함 ${f.id}:${f.lord}`);
    for (const c of f.cities) {
      if (!CITY_BY_ID[c]) issues.push(`없는 성 ${f.id}:${c}`);
      else if (owned.has(c)) issues.push(`성 중복 ${c}: ${owned.get(c)} / ${f.id}`);
      else owned.set(c, f.id);
    }
    for (const g of f.generals) {
      if (!GENERAL_BY_ID[g]) issues.push(`없는 장수 ${f.id}:${g}`);
      else if (genOwner.has(g)) issues.push(`장수 중복 ${g}: ${genOwner.get(g)} / ${f.id}`);
      else genOwner.set(g, f.id);
    }
  }
  for (const [city, list] of Object.entries(sc.free || {})) {
    if (!CITY_BY_ID[city]) issues.push(`재야 위치 없음 ${city}`);
    for (const g of list) {
      if (!GENERAL_BY_ID[g]) issues.push(`재야 없는 장수 ${city}:${g}`);
      if (genOwner.has(g)) issues.push(`재야 중복 ${g}: ${genOwner.get(g)}`);
    }
  }
  const missing = allCities.filter((c) => !owned.has(c));
  const totalCities = sc.factions.reduce((n, f) => n + f.cities.length, 0);
  const totalGens = sc.factions.reduce((n, f) => n + f.generals.length, 0);
  console.log(`\n[${sc.id}] ${sc.year} ${sc.name} — 세력 ${sc.factions.length} · 성 ${totalCities} · 소속장수 ${totalGens} · 재야 ${Object.values(sc.free || {}).flat().length}`);
  if (missing.length) { console.log('  ❌ 소유자 없는 성:', missing.join(', ')); bad++; }
  if (issues.length) { console.log('  ❌ 문제:', issues.join(' | ')); bad++; }
  const unused = GENERALS.filter((g) => !genOwner.has(g.id)).map((g) => g.ko);
  if (unused.length) console.log(`  · 미배치(재야 낙양) ${unused.length}명: ${unused.join(' ')}`);
}
console.log(bad ? `\n문제 ${bad}건` : '\n모든 시나리오 정상');
process.exit(bad ? 1 : 0);
