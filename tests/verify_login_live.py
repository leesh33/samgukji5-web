"""도트삼국 — 로그인·클라우드 동기화 라이브 검증 (390×844)
사용: python3 tests/verify_login_live.py [URL] [TAG]
  ① 타이틀 & 메뉴에 구글/카카오 로그인 버튼
  ② 각 버튼 → accounts.google.com / kauth.kakao.com 인증 화면 (redirect_uri_mismatch 없음)
  ③ 가로 넘침 0 · 콘솔 오류 0
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://dotsamguk.vercel.app"
TAG = sys.argv[2] if len(sys.argv) > 2 else "live"
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(".cache/ms-playwright/chromium-1134/chrome-linux/chrome")
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

fails = []


def step(label, ok, extra=""):
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:220] if extra else ""), flush=True)
    if not ok:
        fails.append(label)


def shot(page, name):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path)
    print("SHOT " + os.path.basename(path), flush=True)


def overflow(page):
    return page.evaluate("""() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })""")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA, locale="ko-KR")
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1000)

    # ① 타이틀
    g = page.locator('#title-account [data-cloud="in-google"]')
    k = page.locator('#title-account [data-cloud="in-kakao"]')
    step("① 타이틀: 구글 로그인 버튼", g.count() == 1 and g.is_visible())
    step("① 타이틀: 카카오 로그인 버튼", k.count() == 1 and k.is_visible())
    step("① 타이틀: 선택 안내 문구", "로그인하면" in page.inner_text("#title-account"))
    ov = overflow(page)
    step("③ 타이틀: 가로 넘침 0", ov["sw"] <= ov["iw"], str(ov))
    shot(page, "01-title")

    # ② 구글 OAuth
    with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
        g.click()
    page.wait_for_timeout(2500)
    url = page.url
    step("② 구글: accounts.google.com 이동", "accounts.google.com" in url, url[:120])
    body = page.content()
    step("② 구글: redirect_uri_mismatch 없음", "redirect_uri_mismatch" not in body and "Error 400" not in body)
    step("② 구글: 인증 화면 렌더", ("로그인" in body or "Sign in" in body or "Choose an account" in body
                                  or "계정 선택" in body or "Google" in body), url[:80])
    shot(page, "02-google-oauth")

    # ② 카카오 OAuth
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    with page.expect_navigation(wait_until="domcontentloaded", timeout=30000):
        page.locator('#title-account [data-cloud="in-kakao"]').click()
    page.wait_for_timeout(2500)
    url = page.url
    step("② 카카오: kauth.kakao.com 이동", "kauth.kakao.com" in url, url[:120])
    body = page.content()
    step("② 카카오: redirect_uri_mismatch 없음", "redirect_uri_mismatch" not in body and "KOE006" not in body)
    step("② 카카오: 인증 화면 렌더", ("카카오" in body or "Kakao" in body or "로그인" in body), url[:80])
    shot(page, "03-kakao-oauth")

    # ① 게임 메뉴 자리 (로그인 없이 플레이 → ≡)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    errors.clear()
    page.click('[data-act="new"]')
    page.wait_for_timeout(400)
    page.click('#scenario-list .sc-card:not(.sc-custom) >> nth=0')  # 신군주 생성 카드 제외한 실제 시나리오
    page.wait_for_timeout(300)
    page.click('#lord-list .lord-card >> nth=0')
    page.wait_for_timeout(1000)
    step("① 비로그인 새 게임 진입", not page.locator("#scr-game").is_hidden())
    page.click('[data-act="menu"]')
    page.wait_for_timeout(400)
    step("① 게임 메뉴: 구글/카카오 자리",
         page.locator('#menu-account [data-cloud="in-google"]').count() == 1
         and page.locator('#menu-account [data-cloud="in-kakao"]').count() == 1)
    step("① 게임 메뉴: 안내 문구", "로그인하면" in page.inner_text("#menu-account"))
    ov = overflow(page)
    step("③ 메뉴: 가로 넘침 0", ov["sw"] <= ov["iw"], str(ov))
    shot(page, "04-menu")
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(300)
    ov = overflow(page)
    step("③ 게임 화면: 가로 넘침 0", ov["sw"] <= ov["iw"], str(ov))
    shot(page, "05-game")

    # 저장 → 클라우드 업로드 경로는 로그인 전엔 조용히 넘어가야 한다
    page.click('[data-act="endturn"]')
    page.wait_for_timeout(1200)
    # 턴 종료 후 AI가 공격해 오면 전술 전투 화면(#scr-battle)으로 넘어가는 것이 정상 흐름이다
    step("③ 비로그인 턴 진행 정상",
         not page.locator("#scr-game").is_hidden() or not page.locator("#scr-battle").is_hidden())
    step("③ 콘솔 0", len(errors) == 0, " / ".join(errors[:3]))

    # ④ 만료된 세션이 남아 있을 때 — 스스로 정리하고 다시 로그인할 수 있게 안내
    page2 = ctx.new_page()
    page2.goto(BASE, wait_until="networkidle")
    page2.evaluate("""() => {
      localStorage.setItem('samguk5.auth.session.v1', JSON.stringify({
        access_token: 'expired-token', refresh_token: 'dead-refresh',
        expires_at: Date.now() - 1000,
        user: { id: '00000000-0000-0000-0000-000000000000', email: 'expired@example.com' }
      }));
    }""")
    errs2 = []
    page2.on("console", lambda m: errs2.append(m.text) if m.type == "error" else None)
    page2.on("pageerror", lambda e: errs2.append("pageerror: " + str(e)))
    page2.reload(wait_until="networkidle")
    page2.wait_for_timeout(2500)
    txt = page2.inner_text("#title-account")
    step("④ 만료 세션: 다시 로그인 버튼 노출",
         page2.locator('#title-account [data-cloud="in-google"]').count() == 1)
    step("④ 만료 세션: 만료 안내 표시", "만료" in txt, txt.replace("\n", " | ")[:120])
    step("④ 만료 세션: 세션 저장소 정리",
         page2.evaluate("() => localStorage.getItem('samguk5.auth.session.v1')") is None)
    shot(page2, "06-expired-session")
    # 죽은 리프레시 토큰의 400 응답은 브라우저가 자동으로 콘솔에 남기는 네트워크 기록이다
    # (앱이 설계대로 세션을 정리하는 경로) — JS 예외만 오류로 본다
    js_errs = [e for e in errs2 if "Failed to load resource" not in e]
    step("④ 만료 세션: JS 오류 0", len(js_errs) == 0, " / ".join(js_errs[:3]))
    step("④ 만료 세션: 400은 갱신 실패 1건뿐", len(errs2) - len(js_errs) <= 1, str(len(errs2)))
    page2.close()

    browser.close()

print("RESULT", "ALL_OK" if not fails else "FAILED: " + ", ".join(fails), flush=True)
sys.exit(0 if not fails else 1)
