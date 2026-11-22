"""도트삼국 — 로그인 UI 로컬 확인 (390×844)
사용: python3 tests/verify_cloud.py [URL]
"""
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


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA, locale="ko-KR")
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(900)

    # ① 타이틀 로그인 버튼
    g = page.locator('#title-account [data-cloud="in-google"]')
    k = page.locator('#title-account [data-cloud="in-kakao"]')
    step("타이틀: 구글 로그인 버튼", g.count() == 1 and g.is_visible())
    step("타이틀: 카카오 로그인 버튼", k.count() == 1 and k.is_visible())
    step("타이틀: 안내 문구", "로그인하면" in page.inner_text("#title-account"))
    step("타이틀: 버튼 글자", g.inner_text().replace("\n", " ").strip().endswith("구글로 로그인")
         and k.inner_text().replace("\n", " ").strip().endswith("카카오로 로그인"))
    page.screenshot(path=os.path.join(OUT, "cloud-local-01-title.png"))

    # 가로 넘침
    ov = page.evaluate("""() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })""")
    step("가로 넘침 0", ov["sw"] <= ov["iw"], str(ov))

    # 로그인 없이 바로 플레이 가능한가 (새 게임 → 시나리오 목록)
    page.click('[data-act="new"]')
    page.wait_for_timeout(400)
    step("비로그人 새 게임 진입", page.locator("#scenario-list .sc-card").count() >= 3)
    page.screenshot(path=os.path.join(OUT, "cloud-local-02-scenario.png"))

    # 게임 메뉴의 로그인 자리
    page.click('#scenario-list .sc-card >> nth=0')
    page.wait_for_timeout(300)
    page.click('#lord-list .lord-card >> nth=0')
    page.wait_for_timeout(900)
    page.click('[data-act="menu"]')
    page.wait_for_timeout(400)
    step("게임 메뉴: 로그인 자리", page.locator('#menu-account [data-cloud="in-google"]').count() == 1)
    page.screenshot(path=os.path.join(OUT, "cloud-local-03-menu.png"))
    empty = page.evaluate("""() => { const e = document.querySelector('#menu-account'); return e ? e.innerText : ''; }""")
    step("게임 메뉴: 안내 문구", "로그인하면" in empty, empty.replace("\n", " | "))

    # Gemini... 아니, 클라우드 모듈 로드 상태
    step("콘솔 오류 0", len(errors) == 0, " / ".join(errors[:3]))

    browser.close()

print("RESULT", "ALL_OK" if not fails else "FAILED: " + ", ".join(fails), flush=True)
