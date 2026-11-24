/* 달의 소식 화면 검증용 저장 파일 만들기 — 실제 엔진으로 게임을 만들어 pendingEvent 만 붙인다.
 * 사용: node tests/_event_saves.mjs [OUT_DIR]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createGame, buildEvent, serialize } from '../js/engine.js';

const out = process.argv[2] || '/tmp/event-saves';
fs.mkdirSync(out, { recursive: true });

const wanted = [
  ['treasureMerchant', 'treasure'],
  ['remnant', 'remnant'],
  ['sage', 'sage'],
];

for (const [id, name] of wanted) {
  const s = createGame('s194', 'jojo', 33);
  const ev = buildEvent(s, id, () => 0.4);
  if (!ev) { console.error('이벤트를 만들 수 없습니다:', id); process.exit(1); }
  ev.turn = s.turn; ev.year = s.year; ev.month = s.month;
  s.pendingEvent = ev;
  const file = path.join(out, `${name}.json`);
  fs.writeFileSync(file, serialize(s));
  console.log(file, '|', ev.title, '|', ev.options.map((o) => o.ko).join(' / '));
}
