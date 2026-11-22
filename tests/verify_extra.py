"""추가 검증 — 이어하기 · 엔딩(통일/멸망) · 데스크톱 레이아웃
사용: python3 samgukji5-web/tests/verify_extra.py [URL] [TAG]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd, click_march, menu_labels

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://dotsamguk.vercel.app"
TAG = sys.argv[2] if len(sys.argv) > 2 else "live"
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)
steps, errors = [], []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:240]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:160] if extra else ""), flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    pg = ctx.new_page()
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_timeout(700)
    step("이름 삼국 한 턴 반영", "삼국 한 턴" in pg.locator(".title-mark h1").inner_text()
         and "삼국지" not in pg.title(), pg.title())

    # 새 게임 → 자동 저장 생성
    pg.click('[data-act="new"]'); pg.wait_for_timeout(250)
    pg.click('.sc-card[data-id="s208"]'); pg.wait_for_timeout(300)
    pg.click('.lord-card[data-id="liubei"]'); pg.wait_for_timeout(900)
    if not pg.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        pg.click('.cs-toggle'); pg.wait_for_timeout(400)
    pg.click('[data-act="cmd-group"][data-group="civil"]'); pg.wait_for_timeout(220)
    pg.click('[data-act="cmd"][data-cmd="agri"]'); pg.wait_for_timeout(300)
    if pg.locator(".officer-row:not(.done)").count():
        pg.locator(".officer-row:not(.done)").first.click()
        pg.wait_for_timeout(400)
    raw = pg.evaluate("() => localStorage.getItem('samguk5.auto')")
    step("자동 저장 생성", bool(raw), f"{len(raw or '')} bytes")

    # 새로고침 후 이어하기
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(600)
    cont_enabled = not pg.locator("#btn-continue").is_disabled()
    step("이어하기 버튼 활성", cont_enabled)
    pg.click("#btn-continue"); pg.wait_for_timeout(900)
    step("이어하기 복원", pg.locator("#scr-game").is_visible() and "유비" in pg.locator("#hud-faction").inner_text(),
         pg.locator("#hud-faction").inner_text())
    pg.screenshot(path=os.path.join(OUT, f"{TAG}-24-continue.png"))

    # 천하통일 엔딩: 모든 성을 유비 소유로 바꾼 저장본 로드
    s = json.loads(raw)
    me = s["playerId"]
    for c in s["cities"].values():
        c["owner"] = me
    s["gameOver"] = None
    pg.evaluate("(data) => localStorage.setItem('samguk5.auto', data)", json.dumps(s))
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(500)
    pg.click("#btn-continue"); pg.wait_for_timeout(1200)
    win = pg.locator("#scr-end").is_visible() and "천하통일" in pg.locator("#end-wrap").inner_text()
    step("천하통일 엔딩", win, pg.locator(".end-title").inner_text() if pg.locator("#scr-end").is_visible() else "")
    pg.screenshot(path=os.path.join(OUT, f"{TAG}-25-victory.png"))

    # 멸망 엔딩
    for c in s["cities"].values():
        c["owner"] = "jojo"
    s["gameOver"] = None
    pg.evaluate("(data) => localStorage.setItem('samguk5.auto', data)", json.dumps(s))
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(500)
    pg.click("#btn-continue"); pg.wait_for_timeout(1200)
    lose = pg.locator("#scr-end").is_visible() and "낙일" in pg.locator("#end-wrap").inner_text()
    step("멸망 엔딩", lose, pg.locator(".end-title").inner_text() if pg.locator("#scr-end").is_visible() else "")
    pg.screenshot(path=os.path.join(OUT, f"{TAG}-26-defeat.png"))

    # 데스크톱 레이아웃
    ctx2 = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    pg2 = ctx2.new_page()
    pg2.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg2.on("pageerror", lambda e: errors.append(str(e)))
    pg2.goto(BASE, wait_until="networkidle"); pg2.wait_for_timeout(700)
    pg2.click('[data-act="new"]'); pg2.wait_for_timeout(250)
    pg2.click('.sc-card[data-id="s200"]'); pg2.wait_for_timeout(300)
    pg2.click('.lord-card[data-id="yuanshao"]'); pg2.wait_for_timeout(1000)
    ok = pg2.locator("#map").is_visible() and pg2.locator("#citypanel").is_visible()
    w = pg2.evaluate("() => ({doc: document.documentElement.scrollWidth, win: window.innerWidth, mapW: document.querySelector('#map').clientWidth, mapH: document.querySelector('#map').clientHeight})")
    step("데스크톱 레이아웃", ok and w["doc"] <= w["win"], w)
    pg2.screenshot(path=os.path.join(OUT, f"{TAG}-27-desktop.png"))

    real = [e for e in errors if "favicon" not in str(e)]
    step("콘솔 오류 0", len(real) == 0, real[:3])

    result = {"base": BASE, "ok": all(s["ok"] for s in steps), "steps": steps, "errors": real[:8]}
    with open(os.path.join(OUT, f"{TAG}-extra-report.json"), "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("RESULT " + json.dumps({"ok": result["ok"], "fail": [s for s in steps if not s["ok"]], "errors": real[:3]}, ensure_ascii=False))
    browser.close()
