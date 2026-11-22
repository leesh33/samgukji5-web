import * as E from '../js/engine.js';

/* 숙련도 74%에서 한 번만 더 훈련하면 익히는 저장 — 라이브 완료 검증용 */
const s = E.createGame('s194', 'jojo', 7);
s.formationMastery = { yue_jin: { hakyik: 74 } };
s.actionPoints = 6;
process.stdout.write(E.serialize(s));
