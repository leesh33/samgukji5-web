/* ☁️ 클라우드 동기화 순수 로직 테스트 — node --test tests/*.test.js */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SLOT_KEYS, parseSave, slotInfo, progressOf, normalizeSlots, pickEntry, mergeSlots,
  isEmptySlots, describeEntry, parseAuthParams, normalizeSession, sessionUsable,
  isRefreshDead, displayName, displayEmail, same, canon,
} from '../js/sync-core.js';

function saveText({ year = 194, month = 1, turn = 1, faction = '조조', fame = 50, cities = 5 } = {}) {
  const citiesMap = {};
  for (let i = 0; i < 42; i++) citiesMap['c' + i] = { id: 'c' + i, owner: i < cities ? 'caocao' : null };
  return JSON.stringify({
    version: 3, year, month, turn, playerId: 'caocao', scenarioName: '군웅할거',
    factions: { caocao: { id: 'caocao', name: faction, fame } }, cities: citiesMap,
  });
}

test('저장 문자열 해석: 정상/깨짐', () => {
  assert.ok(parseSave(saveText()));
  assert.equal(parseSave('not json'), null);
  assert.equal(parseSave('{"a":1}'), null);
  assert.equal(parseSave(''), null);
  assert.equal(parseSave(null), null);
});

test('슬롯 요약: 연·월·세력·성 수', () => {
  const info = slotInfo(saveText({ year: 200, month: 3, turn: 74, cities: 12 }));
  assert.equal(info.year, 200);
  assert.equal(info.month, 3);
  assert.equal(info.turn, 74);
  assert.equal(info.faction, '조조');
  assert.equal(info.cities, 12);
  assert.match(describeEntry({ raw: saveText({ cities: 3 }), at: 1 }), /194년 1월 · 조조 · 성 3곳/);
  assert.equal(describeEntry({ raw: 'x', at: 1 }), '손상된 기록');
});

test('진행도: 턴 > 성 수 > 명성', () => {
  const a = progressOf({ raw: saveText({ turn: 10, cities: 2 }), at: 1 });
  const b = progressOf({ raw: saveText({ turn: 11, cities: 1 }), at: 1 });
  const c = progressOf({ raw: saveText({ turn: 10, cities: 3 }), at: 1 });
  assert.ok(b > a, '턴이 많은 쪽이 앞선다');
  assert.ok(c > a, '같은 턴이면 성이 많은 쪽');
  assert.equal(progressOf({ raw: 'broken', at: 1 }), -1);
});

test('슬롯 정규화: 모르는 키·빈 값은 버리고 문자열도 받는다', () => {
  const n = normalizeSlots({ auto: saveText(), 1: { raw: saveText(), at: 5 }, 2: null, 9: saveText(), junk: { at: 1 } });
  assert.deepEqual(Object.keys(n).sort(), ['1', 'auto']);
  assert.equal(n['1'].at, 5);
  assert.equal(n.auto.at, 0);
  assert.deepEqual(normalizeSlots(null), {});
  assert.deepEqual(normalizeSlots([1, 2]), {});
  assert.ok(isEmptySlots({}));
  assert.ok(!isEmptySlots({ auto: { raw: saveText(), at: 1 } }));
});

test('슬롯 합치기: 마지막 저장 시각이 최신인 쪽을 남긴다', () => {
  const local = { auto: { raw: saveText({ turn: 5 }), at: 1000 } };
  const cloud = { auto: { raw: saveText({ turn: 9 }), at: 2000 } };
  const m = mergeSlots(local, cloud);
  assert.equal(m.took.auto, 'cloud');
  assert.equal(slotInfo(m.slots.auto.raw).turn, 9);
});

test('슬롯 합치기: 한쪽에만 있는 슬롯은 지우지 않는다', () => {
  const local = { auto: { raw: saveText({ turn: 3 }), at: 100 } };
  const cloud = { 1: { raw: saveText({ turn: 7 }), at: 200 }, 2: { raw: saveText({ turn: 1 }), at: 50 } };
  const m = mergeSlots(local, cloud);
  assert.deepEqual(Object.keys(m.slots).sort(), ['1', '2', 'auto']);
  assert.equal(m.took.auto, 'local');
  assert.equal(m.took['1'], 'cloud');
  assert.equal(m.took['2'], 'cloud');
  assert.equal(slotInfo(m.slots.auto.raw).turn, 3);
});

test('슬롯 합치기: 시각이 같으면 더 진행된 기록이 이긴다', () => {
  const local = { auto: { raw: saveText({ turn: 4, cities: 6 }), at: 500 } };
  const cloud = { auto: { raw: saveText({ turn: 4, cities: 9 }), at: 500 } };
  const m1 = mergeSlots(local, cloud);
  const m2 = mergeSlots(cloud, local);
  assert.equal(m1.took.auto, 'cloud');
  assert.equal(m2.took.auto, 'local');   // 인자를 바꾸면 '어느 쪽'인지만 바뀐다
  assert.equal(m1.slots.auto.raw, cloud.auto.raw);
  assert.equal(m2.slots.auto.raw, cloud.auto.raw);   // 결론은 같다 — 성 9곳
});

test('슬롯 합치기: 깨진 저장은 멀쩡한 쪽이 이긴다', () => {
  const local = { auto: { raw: '{broken', at: 9000 } };
  const cloud = { auto: { raw: saveText({ turn: 2 }), at: 10 } };
  const m = mergeSlots(local, cloud);
  assert.equal(m.took.auto, 'cloud');
  assert.equal(slotInfo(m.slots.auto.raw).turn, 2);
});

test('슬롯 합치기: 두 기기가 같은 결과로 모인다(순서 무관)', () => {
  const a = { auto: { raw: saveText({ turn: 3 }), at: 700 } };
  const b = { auto: { raw: saveText({ turn: 3 }), at: 700 } };
  assert.deepEqual(mergeSlots(a, b).slots, mergeSlots(b, a).slots);
  const m1 = mergeSlots(a, b).slots.auto.raw;
  const m2 = mergeSlots(b, a).slots.auto.raw;
  assert.equal(m1, m2);
});

test('슬롯 합치기: 빈 쪽이면 상대를 그대로 받는다', () => {
  const cloud = { auto: { raw: saveText(), at: 1 }, 3: { raw: saveText({ turn: 2 }), at: 2 } };
  assert.deepEqual(mergeSlots({}, cloud).slots, normalizeSlots(cloud));
  assert.deepEqual(mergeSlots(cloud, {}).slots, normalizeSlots(cloud));
  assert.deepEqual(mergeSlots({}, {}).slots, {});
});

test('슬롯 키는 자동·1·2·3 네 가지', () => {
  assert.deepEqual(SLOT_KEYS, ['auto', '1', '2', '3']);
});

test('로그인 리다이렉트 해석: PKCE 코드 / 토큰 / 오류', () => {
  const pkce = parseAuthParams('?code=abc123&state=xyz', '');
  assert.equal(pkce.code, 'abc123');
  assert.ok(pkce.hasAuth);
  assert.equal(pkce.error, '');

  const token = parseAuthParams('', '#access_token=tok&refresh_token=ref&expires_in=3600');
  assert.equal(token.accessToken, 'tok');
  assert.equal(token.refreshToken, 'ref');
  assert.equal(token.expiresIn, 3600);

  const err = parseAuthParams('?error=access_denied&error_description=User%20denied', '');
  assert.equal(err.error, 'access_denied');
  assert.match(err.description, /User denied/);

  assert.equal(parseAuthParams('', '').hasAuth, false);
  assert.equal(parseAuthParams('?utm=1', '').hasAuth, false);
});

test('세션 만료 계산·갱신 필요 판정', () => {
  const t0 = 1_700_000_000_000;
  const s = normalizeSession({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }, null, t0);
  assert.equal(s.expires_at, t0 + 3600_000);
  assert.ok(sessionUsable(s, t0 + 1000));
  assert.ok(!sessionUsable(s, t0 + 3600_000 - 30_000), '만료 1분 전이면 갱신 대상');
  assert.ok(!sessionUsable(null, t0));

  // expires_at(초 단위)로 온 응답
  const s2 = normalizeSession({ access_token: 'a', expires_at: 1_700_000_500 }, null, t0);
  assert.equal(s2.expires_at, 1_700_000_500_000);

  // 이전 세션의 리프레시 토큰 유지
  const s3 = normalizeSession({ access_token: 'b', expires_in: 60 }, { refresh_token: 'old', user: { id: 'u1' } }, t0);
  assert.equal(s3.refresh_token, 'old');
  assert.equal(s3.user.id, 'u1');
});

test('죽은 리프레시 토큰 판정: 400·401', () => {
  assert.ok(isRefreshDead(400));
  assert.ok(isRefreshDead(401));
  assert.ok(!isRefreshDead(500));
  assert.ok(!isRefreshDead(undefined));
});

test('표시 이름·이메일', () => {
  assert.equal(displayName({ user_metadata: { full_name: '홍길동' }, email: 'a@b.c' }), '홍길동');
  assert.equal(displayName({ user_metadata: { nickname: '카카오닉' } }), '카카오닉');
  assert.equal(displayName({ email: 'odol@example.com' }), 'odol');
  assert.equal(displayName(null), '내 계정');
  assert.equal(displayEmail({ email: 'odol@example.com' }), 'odol@example.com');
  assert.equal(displayEmail({}), '');
});

test('canon/same: 키 순서만 다른 jsonb 도 같다고 본다', () => {
  assert.ok(same({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }));
  assert.ok(!same({ a: 1 }, { a: 2 }));
  assert.deepEqual(canon({ b: 1, a: [2, 1] }), { a: [2, 1], b: 1 });
});
