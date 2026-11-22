"""도트삼국 — 로그인 후 동기화 경로 검증 (가짜 Supabase 응답, 390×844)

실제 계정 로그인 없이 클라이언트 파이프라인(pull → 합치기 → put → 화면)을 확인한다.
네트워크는 Playwright route 로 가로채며, 실제 서버에는 아무것도 쓰지 않는다.
사용: python3 tests/verify_sync_e2e.py [URL]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(".cache/ms-playwright/chromium-1134/chrome-linux/chrome")
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

fails = []


def step(label, ok, extra=""):
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if extra else ""), flush=True)
    if not ok:
        fails.append(label)


def save_text(turn, cities, faction="조조"):
    cities_map = {"c%d" % i: {"id": "c%d" % i, "owner": "caocao" if i < cities else None} for i in range(42)}
    return json.dumps({
        "version": 3, "year": 194, "month": 1, "turn": turn, "playerId": "caocao",
        "scenarioName": "군웅할거",
        "factions": {"caocao": {"id": "caocao", "name": faction, "fame": 50}},
        "cities": cities_map,
    }, ensure_ascii=False)


CLOUD = {
    "1": {"raw": save_text(9, 8), "at": 9000},      # 클라우드에만 있는 슬롯
    "2": {"raw": save_text(4, 3), "at": 2000},      # 로컬(더 최신)이 이겨야 함
}
LOCAL_SLOT2 = save_text(7, 5)
puts = []

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA, locale="ko-KR")
    ctx.add_init_script("""
      localStorage.setItem('samguk5.slot2', %s);
      localStorage.setItem('samguk5.sync.meta.v1', JSON.stringify({ slotAt: { '2': 5000 }, at: 5000 }));
      localStorage.setItem('samguk5.auth.session.v1', JSON.stringify({
        access_token: 'test-token', refresh_token: 'test-refresh',
        expires_at: Date.now() + 3600 * 1000,
        user: { id: '00000000-0000-0000-0000-000000000001', email: 'odol@example.com',
                user_metadata: { full_name: '상훈' } }
      }));
    """ % json.dumps(LOCAL_SLOT2))

    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

    def handle_pull(route):
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps([{"slots": CLOUD, "revised_at": 9000}], ensure_ascii=False))

    def handle_put(route):
        body = json.loads(route.request.post_data or "{}")
        puts.append(body)
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps(body.get("p_slots", {}), ensure_ascii=False))

    page.route("**/rest/v1/samguk_saves*", handle_pull)
    page.route("**/rest/v1/rpc/samguk_put_saves*", handle_put)

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(2500)

    acc = page.inner_text("#title-account")
    step("로그인 상태 표시", "동기화됨" in acc and "상훈" in acc, acc.replace("\n", " | "))
    step("☁ 근처: 로그아웃 버튼", page.locator('#title-account [data-cloud="out"]').count() == 1)

    slots = page.evaluate("""() => ({
      one: localStorage.getItem('samguk5.slot1'),
      two: localStorage.getItem('samguk5.slot2')
    })""")
    step("클라우드에만 있던 슬롯 1 내려받음", slots["one"] and json.loads(slots["one"])["turn"] == 9)
    step("로컬이 더 최신인 슬롯 2 는 유지", slots["two"] and json.loads(slots["two"])["turn"] == 7)
    step("이어하기 활성화(자동 저장 없음 → 그대로 비활성)", page.locator("#btn-continue").is_disabled())

    first = puts[0]["p_slots"] if puts else {}
    step("put: 두 슬롯 모두 올림", set(first.keys()) == {"1", "2"}, list(first.keys()))
    step("put: 슬롯 1 은 클라우드 최신(턴 9)", json.loads(first["1"]["raw"])["turn"] == 9)
    step("put: 슬롯 2 는 로컬 최신(턴 7)", json.loads(first["2"]["raw"])["turn"] == 7)
    step("put: revised_at 전송", isinstance(puts[0].get("p_revised_at"), int) and puts[0]["p_revised_at"] > 9000,
         puts[0].get("p_revised_at") if puts else None)

    # 플레이 후 자동 저장 → 1.4초 뒤 클라우드로 한 번 더 올라간다
    puts.clear()
    page.click('[data-act="new"]')
    page.wait_for_timeout(400)
    page.click('#scenario-list .sc-card >> nth=0')
    page.wait_for_timeout(300)
    page.click('#lord-list .lord-card >> nth=0')
    page.wait_for_timeout(2600)
    step("자동 저장 후 클라우드 push 발생", len(puts) >= 1, f"{len(puts)}회")
    last = puts[-1]["p_slots"] if puts else {}
    step("push 본문에 자동 저장 슬롯 포함", "auto" in last and bool(json.loads(last["auto"]["raw"]).get("playerId")))
    step("기존 클라우드 슬롯 1 유지", "1" in last)
    page.click('[data-act="menu"]')
    page.wait_for_timeout(500)
    menu = page.inner_text("#menu-account")
    step("게임 메뉴에도 동기화 상태 표시", "동기화됨" in menu, menu.replace("\n", " | ")[:120])
    page.screenshot(path=os.path.join(OUT, "sync-e2e-01-menu-synced.png"))

    step("콘솔 오류 0", len(errors) == 0, " / ".join(errors[:3]))
    browser.close()

print("RESULT", "ALL_OK" if not fails else "FAILED: " + ", ".join(fails), flush=True)
sys.exit(0 if not fails else 1)
