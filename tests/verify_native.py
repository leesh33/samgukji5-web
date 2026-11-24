"""삼국 한 턴 — iOS 앱 다리(Apple 로그인 · 딥링크 복귀 · 계정 삭제) 라이브 검증 (390×844)
사용: python3 tests/verify_native.py [URL]
   · 앱 다리가 없을 때: 웹 그대로(Google·카카오만, Apple 없음)
   · 앱 다리가 있을 때(window.__SAMGUK_NATIVE__): Apple 칩이 뜨고, 누르면 앱에 apple-signin 을 보낸다
   · 돌아온 주소(samguk://auth-callback)를 SamgukNative 가 받아 처리한다(취소·오류 문구)
   · 로그인 상태에서 군의 메뉴에 「계정 · 클라우드 기록 삭제」가 있고 2단계 확인이 동작한다
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
OUT = os.path.abspath("downloads/samguk5-native")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

fails = []


def step(label, ok, extra=""):
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:300] if extra else ""), flush=True)
    if not ok:
        fails.append(label)


# 앱이 심는 다리 + ReactNativeWebView.postMessage 수집
BRIDGE = r"""
window.__SAMGUK_NATIVE__ = { shell: 'ios', platform: 'ios', appleAuth: true, appVersion: '1.0.0' };
window.__POSTS__ = [];
window.ReactNativeWebView = { postMessage: function (m) { window.__POSTS__.push(String(m)); } };
"""

FAKE_SESSION = (
    '{"access_token":"fake-token","refresh_token":"fake-refresh","expires_at":'
    + str(9_999_999_999_000)
    + ',"user":{"id":"11111111-1111-1111-1111-111111111111","email":"tester@example.com",'
      '"user_metadata":{"name":"시험"},"app_metadata":{"provider":"apple"}}}'
)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    # ① 웹(사파리) — 앱 다리 없음: 예전 그대로
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA, locale="ko-KR")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(700)
    step("웹: 구글·카카오 칩이 있다",
         page.locator('#title-account [data-cloud="in-google"]').count() == 1
         and page.locator('#title-account [data-cloud="in-kakao"]').count() == 1)
    step("웹: Apple 칩은 없다(앱 안에서만)", page.locator('#title-account [data-cloud="in-apple"]').count() == 0)
    step("웹: window.SamgukNative 는 있어도 무해(appleReady=false)",
         page.evaluate("typeof window.SamgukNative === 'object' && window.SamgukNative.appleReady() === false"))
    page.screenshot(path=os.path.join(OUT, "01-web.png"))
    ctx.close()

    # ② 앱(Expo WebView) — 다리 있음
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA, locale="ko-KR")
    ctx.add_init_script(BRIDGE)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("app:" + str(e)))
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(700)
    step("앱: Apple 칩이 뜬다", page.locator('#title-account [data-cloud="in-apple"]').count() == 1)
    box = page.locator('#title-account [data-cloud="in-apple"]').bounding_box()
    step("앱: Apple 칩이 390 폭 안에 들어간다", bool(box) and box["x"] >= 0 and box["x"] + box["width"] <= 390.5,
         box)
    page.screenshot(path=os.path.join(OUT, "02-app-title.png"))

    page.locator('#title-account [data-cloud="in-apple"]').click()
    page.wait_for_timeout(400)
    posts = page.evaluate("window.__POSTS__")
    step("앱: Apple 칩을 누르면 앱에 apple-signin 을 보낸다",
         any('"apple-signin"' in m for m in posts), posts[-3:])

    # 돌아온 주소 처리 — 사용자가 취소
    out = page.evaluate("window.SamgukNative.oauthCallback('samguk://auth-callback?error=access_denied')")
    page.wait_for_timeout(300)
    note = page.locator('#title-account .acc-note.warn').inner_text()
    step("앱: 취소로 돌아오면 안내 문구", "취소" in note, note)
    page.screenshot(path=os.path.join(OUT, "03-app-cancel.png"))

    # 코드가 빈 응답은 조용히 실패하고 화면이 깨지지 않는다
    page.evaluate("window.SamgukNative.oauthCallback('samguk://auth-callback')")
    page.wait_for_timeout(200)
    step("앱: 빈 응답에도 화면이 살아 있다", page.locator("#scr-title").is_visible())

    # Google authorize 주소가 앱으로 넘어가는지 (Supabase authorize → 앱이 창을 띄운다)
    page.evaluate("window.__POSTS__.length = 0")
    page.evaluate("window.SamgukNative.state && 0")
    page.locator('#title-account [data-cloud="in-google"]').click()
    page.wait_for_timeout(600)
    posts = page.evaluate("window.__POSTS__")
    oauth = [m for m in posts if '"oauth"' in m]
    url = ""
    if oauth:
        import json
        url = json.loads(oauth[-1]).get("url", "")
    step("앱: 구글을 누르면 authorize 주소를 앱에 넘긴다(페이지 이동 없음)",
         "supabase.co/auth/v1/authorize" in url and "provider=google" in url
         and "redirect_to=samguk%3A%2F%2Fauth-callback" in url, url[:200])
    step("앱: 구글 로그인 창이 페이지를 떠나지 않았다", page.url.startswith(BASE.split("index.html")[0]), page.url)
    ctx.close()

    # ③ 로그인 상태 — 계정 삭제 버튼과 2단계 확인
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA, locale="ko-KR")
    ctx.add_init_script(BRIDGE)
    ctx.add_init_script("localStorage.setItem('samguk5.auth.session.v1', %r);" % FAKE_SESSION)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("signed:" + str(e)))
    page.route("**/zdcdvjlssncsawpqsjwe.supabase.co/**", lambda route: route.fulfill(
        status=200, content_type="application/json", body="[]"))
    page.goto(BASE, wait_until="load")
    page.wait_for_timeout(900)
    step("로그인: 동기화 칩이 보인다", page.locator('#title-account .acc-pill.on').count() == 1)
    step("로그인: 타이틀에는 삭제 버튼을 두지 않는다(실수 방지)",
         page.locator('#title-account [data-cloud="delete"]').count() == 0)

    # 게임 없이도 계정 영역만 따로 세워 군의 메뉴와 같은 조건(compact 아님)으로 검사한다
    page.evaluate("""
      const box = document.getElementById('menu-account');
      if (!box) {
        const d = document.createElement('div');
        d.id = 'menu-account'; d.className = 'acc-box acc-menu'; document.body.appendChild(d);
      }
    """)
    page.evaluate("import('/js/sync.js').then(m => m.mount(document.getElementById('menu-account')))")
    page.wait_for_timeout(500)
    step("로그인: 메뉴에 「계정 · 클라우드 기록 삭제」가 있다",
         page.locator('#menu-account [data-cloud="delete"]').count() == 1)

    page.evaluate("document.querySelector('#menu-account [data-cloud=\"delete\"]').click()")
    page.wait_for_timeout(500)
    step("삭제: 확인 시트가 열린다", page.locator('#sheet-body .del-account').count() == 1)
    step("삭제: 체크 전에는 실행 버튼이 잠겨 있다", page.locator('#del-go').is_disabled())
    page.screenshot(path=os.path.join(OUT, "04-delete-confirm.png"))
    page.locator('#del-ack').check()
    page.wait_for_timeout(200)
    step("삭제: 동의 체크 후 버튼이 열린다", not page.locator('#del-go').is_disabled())
    page.locator('[data-act="sheet-close"]').last.click()
    page.wait_for_timeout(200)
    ctx.close()
    browser.close()

step("콘솔 오류 없음", not errors, errors[:3])

print()
if fails:
    print("실패 %d건:" % len(fails))
    for f in fails:
        print(" -", f)
    sys.exit(1)
print("모두 통과 (스크린샷: %s)" % OUT)
