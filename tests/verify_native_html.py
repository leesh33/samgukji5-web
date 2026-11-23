"""삼국 한 턴 — 앱에 내장하는 한 파일 HTML(오프라인 폴백) 검증 (390×844)
사용: python3 tests/verify_native_html.py
   · ../samguk-app/src/generated/html.js 를 꺼내 로컬 서버로 띄운다(라이브 웹과 같은 오리진 규칙).
   · 외부 파일 요청이 0건인지(글꼴·연출 그림까지 안에 있는지) 확인한다.
   · 타이틀 → 새 게임 → 시나리오 → 군주 → 게임 진입까지 실제로 눌러 본다.
   · 앱 다리(window.__SAMGUK_NATIVE__)를 심으면 Apple 칩이 뜨고, Apple 을 누르면 앱에 apple-signin 이 간다.
"""
import json
import os
import shutil
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TMP = os.path.join(ROOT, "_native_check.html")
OUT = os.path.abspath("downloads/samguk5-native-html")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

fails = []


def step(label, ok, extra=""):
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:300] if extra else ""), flush=True)
    if not ok:
        fails.append(label)


def export_html():
    src = os.path.join(ROOT, "..", "samguk-app", "src", "generated", "html.js")
    text = open(src, encoding="utf-8").read()
    start = text.index("export default ") + len("export default ")
    html = json.loads(text[start:text.rindex(";")])
    open(TMP, "w", encoding="utf-8").write(html)
    return html


html = export_html()
step("내장 HTML 이 한 파일(2~4MB)", 2_000_000 < len(html) < 4_500_000, len(html))
step("외부 스크립트·스타일시트 참조 없음", 'src="js/' not in html and 'href="css/' not in html)
step("글꼴이 data URI 로 들어 있다", html.count("data:font/woff2") == 2, html.count("data:font/woff2"))
step("행동 연출 그림 12장이 data URI 로 들어 있다", html.count("data:image/webp") == 12, html.count("data:image/webp"))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA, locale="ko-KR")
    ctx.add_init_script("window.__SAMGUK_NATIVE__ = { shell: 'ios', appleAuth: true };"
                        "window.__POSTS__ = [];"
                        "window.ReactNativeWebView = { postMessage: function (m) { window.__POSTS__.push(String(m)); } };")
    page = ctx.new_page()
    errors, requests = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
    page.on("request", lambda r: requests.append(r.url))

    # 파일 하나만 서버로 띄운다 — 옆의 다른 파일은 요청하지 않아야 한다
    page.goto("http://127.0.0.1:4173/_native_check.html", wait_until="load")
    page.wait_for_timeout(900)
    ext = [u for u in requests if not u.startswith("http://127.0.0.1:4173/_native_check.html")
           and not u.startswith("data:")]
    step("바깥 파일 요청 0건", not ext, ext[:3])
    step("타이틀 화면이 그려진다", page.locator("#scr-title").is_visible() and page.locator(".title-mark h1").inner_text().strip() == "삼국 한 턴")
    step("앱 안: Apple 칩이 뜬다", page.locator('#title-account [data-cloud="in-apple"]').count() == 1)
    page.screenshot(path=os.path.join(OUT, "01-title.png"))

    page.locator('[data-act="new"]').click()
    page.wait_for_timeout(700)
    page.screenshot(path=os.path.join(OUT, "02-scenario.png"))
    step("새 게임 → 시나리오 목록", page.locator("#scr-scenario").is_visible() and page.locator("#scenario-list > *").count() >= 7,
         page.locator("#scenario-list > *").count())

    page.locator('#scenario-list [data-act="pick-scenario"]').first.click()
    page.wait_for_timeout(800)
    step("시나리오 → 군주 선택", page.locator("#scr-lord").is_visible() and page.locator("#lord-list > *").count() > 0,
         page.locator("#lord-list > *").count())
    page.screenshot(path=os.path.join(OUT, "03-lord.png"))

    page.locator("#lord-list > *").first.click()
    page.wait_for_timeout(1400)
    step("군주 선택 → 게임 화면", page.locator("#scr-map").is_visible() or page.locator("#scr-game").is_visible(),
         page.evaluate("Array.from(document.querySelectorAll('.screen')).filter(e=>!e.classList.contains('hidden')).map(e=>e.id)"))
    page.screenshot(path=os.path.join(OUT, "04-game.png"))

    # 저장이 이 기기에 남는지(오프라인에서도 이어하기)
    step("게임이 로컬 저장소에 기록된다", page.evaluate("Object.keys(localStorage).some(k => k.indexOf('samguk5.') === 0)"),
         page.evaluate("Object.keys(localStorage)"))

    # Apple 다리
    page.evaluate("document.querySelector('#scr-title').classList.remove('hidden');")
    page.locator('#title-account [data-cloud="in-apple"]').click()
    page.wait_for_timeout(400)
    posts = page.evaluate("window.__POSTS__")
    step("Apple 을 누르면 앱에 apple-signin", any('"apple-signin"' in m for m in posts), posts[-2:])
    step("콘솔 오류 없음", not errors, errors[:3])
    ctx.close()
    browser.close()

if os.path.exists(TMP):
    os.remove(TMP)
print()
if fails:
    print("실패 %d건:" % len(fails))
    for f in fails:
        print(" -", f)
    sys.exit(1)
print("모두 통과 (스크린샷: %s)" % OUT)
