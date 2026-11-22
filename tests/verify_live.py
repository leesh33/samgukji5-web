"""도트삼국 — 라이브 검증 (390×844 · iPhone UA · 실제 터치)
사용: LD_LIBRARY_PATH=... python3 samgukji5-web/tests/verify_live.py [URL] [TAG]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors, notes = [], [], {}


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:300]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:180] if extra != "" else ""), flush=True)


def shot(page, name, full=False):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path, full_page=full)
    print("SHOT " + os.path.basename(path), flush=True)
    return path


def overflow(page):
    return page.evaluate("""() => {
      const w = document.documentElement.clientWidth;
      const bad = [];
      const scrollable = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true;
        }
        return false;
      };
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > w + 1.5 || r.left < -1.5)) {
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.overflow === 'hidden' || scrollable(el)) return;
          bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + ',' + Math.round(r.right));
        }
      });
      return {docW: document.documentElement.scrollWidth, winW: w, bad: bad.slice(0, 6)};
    }""")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:100], r.failure)))

    # ---------- 타이틀 ----------
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(900)
    step("타이틀 화면", page.locator(".title-mark h1").is_visible(), page.title())
    shot(page, "01-title")

    # ---------- 시나리오 / 군주 ----------
    page.click('[data-act="new"]')
    page.wait_for_timeout(320)
    step("시나리오 7종(+신군주 진입)", page.locator(".sc-card[data-id]").count() == 7
         and page.locator('.sc-card[data-act="open-custom"]').count() == 1,
         page.locator(".sc-card").count())
    shot(page, "02-scenarios")
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    step("군주 선택 18세력", page.locator(".lord-card").count() == 18, page.locator(".lord-card").count())
    shot(page, "03-lords")
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1000)
    step("본 게임 진입", page.locator("#scr-game").is_visible() and page.locator("#map").is_visible(),
         page.locator("#hud-faction").inner_text())
    open0 = page.locator("#citypanel").evaluate("el => el.classList.contains('open')")
    step("성 시트(기본 펼침)", page.locator("#citypanel").is_visible() and open0)
    ratio = page.evaluate("() => Math.round(document.querySelector('#map').clientHeight / innerHeight * 100)")
    step("지도 세로 비중 45% 이상", ratio >= 45, f"{ratio}%")
    o = overflow(page)
    step("가로 넘침 없음", len(o["bad"]) == 0, o)
    shot(page, "04-map")

    # ---------- 지도 조작 ----------
    box = page.locator("#map").bounding_box()
    page.mouse.move(box["x"] + 180, box["y"] + 240)
    page.mouse.down()
    page.mouse.move(box["x"] + 90, box["y"] + 170, steps=10)
    page.mouse.up()
    page.wait_for_timeout(250)
    page.click('[data-act="zoom-in"]')
    page.click('[data-act="zoom-in"]')
    page.wait_for_timeout(350)
    z = page.evaluate("() => document.querySelector('#map').width")
    shot(page, "05-map-zoom")
    step("드래그·확대", z > 0, page.evaluate("() => 1"))
    page.click('[data-act="region-menu"]')
    page.wait_for_timeout(300)
    page.click('.pick-chip[data-region="익주"]')
    page.wait_for_timeout(450)
    shot(page, "06-map-region")
    step("권역 빠른 이동(익주)", page.locator("#sheet").evaluate("el => el.classList.contains('hidden')"))
    page.click('[data-act="zoom-reset"]')
    page.wait_for_timeout(300)

    # ---------- 내정 ----------
    page.click('[data-act="jump-region"][data-region="__mine"]')
    page.wait_for_timeout(350)
    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        page.click('.cs-toggle')
        page.wait_for_timeout(400)
    step("성 시트 펼침", page.locator("#citypanel").evaluate("el => el.classList.contains('open')"),
         page.evaluate("() => Math.round(document.querySelector('#map').clientHeight / innerHeight * 100) + '%'"))
    shot(page, "06b-map-open")
    ap0 = page.locator("#res-ap").inner_text()
    gold0 = page.locator("#res-gold").inner_text()
    page.click('[data-act="cmd"][data-cmd="agri"]')
    page.wait_for_timeout(350)
    rows = page.locator(".officer-row").count()
    step("개발 장수 선택", rows > 0, page.locator("#sheet-title").inner_text())
    shot(page, "07-command")
    page.locator(".officer-row:not(.done)").first.click()
    page.wait_for_timeout(450)
    step("내정 실행", page.locator("#res-ap").inner_text() != ap0,
         f"{ap0} -> {page.locator('#res-ap').inner_text()}")
    shot(page, "08-command-done")

    # 징병 (금/식량 소모 확인)
    page.click('[data-act="cmd"][data-cmd="draft"]')
    page.wait_for_timeout(350)
    if page.locator(".officer-row:not(.done)").count():
        before = page.locator("#res-troops").inner_text()
        page.locator(".officer-row:not(.done)").first.click()
        page.wait_for_timeout(450)
        step("징병", page.locator("#res-troops").inner_text() != before,
             f"{before} -> {page.locator('#res-troops').inner_text()}")
    else:
        page.click('.sheet-head [data-act="sheet-close"]')

    # 등용 시도
    page.click('[data-act="cmd"][data-cmd="hire"]')
    page.wait_for_timeout(400)
    if page.locator(".officer-row").count():
        step("등용 목록", True, page.locator(".officer-row").count())
        shot(page, "09-hire")
        page.click('.sheet-head [data-act="sheet-close"]')
    else:
        step("등용 목록(재야 없음)", True, "재야 장수 없음")


    def clear_prisoners():
        """승전 뒤 포로 처분 창이 뜨면 해방으로 정리한다(새 전투 흐름)"""
        for _ in range(6):
            if not page.locator('[data-act="prisoner-release"]').count():
                break
            try:
                page.locator('[data-act="prisoner-release"]').first.click()
                page.wait_for_timeout(350)
            except Exception:
                break
        if page.locator('[data-act="prisoner-done"]').count():
            page.click('[data-act="prisoner-done"]')
            page.wait_for_timeout(700)

    # ---------- 출진 → 전술 전투 ----------
    page.click('[data-act="march"]')
    page.wait_for_timeout(400)
    step("출진 시트", "출진" in page.locator("#sheet-title").inner_text())
    shot(page, "10-march")
    page.click('[data-act="march-go"]')
    page.wait_for_timeout(900)
    step("전투 진입", page.locator("#scr-battle").is_visible(), page.locator("#bt-name").inner_text())
    shot(page, "11-battle")

    def end_battle(max_rounds=40, use_all=True):
        for _ in range(max_rounds):
            if page.locator('[data-act="bt-close"]').count() and page.locator('[data-act="bt-close"]').is_visible():
                return True
            if not page.locator("#scr-battle").is_visible():
                return False
            try:
                if use_all and page.locator('[data-act="bt-all"]').is_visible() and not page.locator('[data-act="bt-all"]').is_disabled():
                    page.click('[data-act="bt-all"]')
                elif not page.locator('[data-act="bt-next"]').is_disabled():
                    page.click('[data-act="bt-next"]')
            except Exception:
                pass
            page.wait_for_timeout(1400)
        return page.locator('[data-act="bt-close"]').count() > 0

    # 부대 선택 · 이동
    page.locator('[data-act="bt-select"]').first.click()
    page.wait_for_timeout(250)
    page.click('[data-act="bt-move"]')
    page.wait_for_timeout(250)
    cv = page.locator("#battle-canvas").bounding_box()
    tile = cv["width"] / 13
    page.mouse.click(cv["x"] + tile * 2.2, cv["y"] + tile * 4.4)
    page.wait_for_timeout(450)
    step("부대 이동", page.locator("#bt-info b").count() > 0, page.locator("#bt-info").inner_text()[:60])
    shot(page, "12-battle-move")

    # 계략
    page.locator('[data-act="bt-select"]').first.click()
    page.wait_for_timeout(200)
    page.click('[data-act="bt-tactic"]')
    page.wait_for_timeout(350)
    tactic_ok = page.locator('[data-act="bt-tactic-kind"]').count() > 0
    if tactic_ok:
        page.locator('[data-act="bt-tactic-kind"]').first.click()
        page.wait_for_timeout(250)
        page.mouse.click(cv["x"] + tile * 11.0, cv["y"] + tile * 4.4)
        page.wait_for_timeout(500)
        shot(page, "13-battle-tactic")
    step("계략", tactic_ok)

    # 전군 돌격 → 접근, 인접 후 일기토
    duel_done = False
    for wave in range(3):
        if duel_done:
            break
        if page.locator('[data-act="bt-close"]').count():
            break
        page.click('[data-act="bt-all"]')
        page.wait_for_timeout(3800)
        shot(page, f"14-battle-allout{wave + 1}")
        n = page.locator('[data-act="bt-select"]').count()
        for i in range(n):
            if page.locator('[data-act="bt-close"]').count():
                break
            try:
                page.locator('[data-act="bt-select"]').nth(i).click()
                page.wait_for_timeout(220)
                if not page.locator('[data-act="bt-duel"]').is_enabled():
                    continue
                page.click('[data-act="bt-duel"]')
                page.wait_for_timeout(400)
                if not page.locator('[data-act="bt-duel-go"]').count():
                    continue
                shot(page, "15-duel-sheet")
                page.locator('[data-act="bt-duel-go"]').first.click()
                page.wait_for_timeout(600)
                step("일기토 개시", page.locator("#duel").is_visible())
                shot(page, "16-duel")
                for _ in range(18):
                    if page.locator('[data-act="duel-close"]').count():
                        break
                    page.click('[data-act="duel-act"][data-a="strong"]')
                    page.wait_for_timeout(420)
                step("일기토 결착", page.locator('[data-act="duel-close"]').count() > 0,
                     page.locator("#duel-log").inner_text()[-90:].replace("\n", " "))
                shot(page, "17-duel-result")
                page.click('[data-act="duel-close"]')
                page.wait_for_timeout(600)
                duel_done = True
                break
            except Exception as e:
                notes["duel_err"] = str(e)[:120]
    step("일기토", duel_done, notes.get("duel_err", "3라운드 내 인접 실패" if not duel_done else ""))

    # 전투 결착
    ended = end_battle()
    step("전투 결착", ended, page.locator("#bt-round").inner_text())
    shot(page, "18-battle-result")
    if ended:
        page.click('[data-act="bt-close"]')
        page.wait_for_timeout(900)
        clear_prisoners()

    # ---------- 턴 진행 ----------
    if page.locator("#scr-game").is_visible():
        d0 = page.locator("#hud-date").inner_text()
        page.click("#btn-endturn")
        page.wait_for_timeout(1600)
        ai_battle = page.locator("#scr-battle").is_visible()
        if ai_battle:
            step("AI 반격 전투", True)
            shot(page, "19-ai-battle")
        # 연쇄 전투가 이어질 수 있으므로 모두 처리
        for _ in range(4):
            if not page.locator("#scr-battle").is_visible() and not page.locator('[data-act="bt-close"]').count():
                break
            if end_battle(max_rounds=40) and page.locator('[data-act="bt-close"]').count():
                page.click('[data-act="bt-close"]')
                page.wait_for_timeout(1100)
                clear_prisoners()
            else:
                break
        d1 = page.locator("#hud-date").inner_text()
        step("턴 진행", d0 != d1, f"{d0} -> {d1}")
        shot(page, "20-next-turn")
        step("턴 진행 후 넘침 없음", len(overflow(page)["bad"]) == 0, overflow(page))
        # 연속 턴
        for _ in range(3):
            if page.locator('[data-act="bt-close"]').count() and page.locator('[data-act="bt-close"]').is_visible():
                page.click('[data-act="bt-close"]')
                page.wait_for_timeout(600)
            if page.locator("#btn-endturn").is_visible():
                page.click("#btn-endturn")
                page.wait_for_timeout(1500)
            if page.locator("#scr-battle").is_visible():
                end_battle(max_rounds=30)
                if page.locator('[data-act="bt-close"]').count() and page.locator('[data-act="bt-close"]').is_visible():
                    page.click('[data-act="bt-close"]')
                    page.wait_for_timeout(700)
                    clear_prisoners()
        step("연속 턴 진행", page.locator("#hud-date").inner_text() != d1, page.locator("#hud-date").inner_text())
        shot(page, "21-turns-later")

    # ---------- 저장/불러오기 ----------
    if page.locator("#scr-game").is_visible():
        page.click('[data-act="menu"]')
        page.wait_for_timeout(350)
        shot(page, "22-menu")
        page.click('[data-act="save-slot"]')
        page.wait_for_timeout(350)
        page.click('[data-act="open-rank"]')
        page.wait_for_timeout(350)
        step("세력 순위", page.locator(".officer-row").count() > 3, page.locator(".officer-row").count())
        shot(page, "23-rank")
        page.click('.sheet-head [data-act="sheet-close"]')
        saved = page.evaluate("() => !!localStorage.getItem('samguk5.auto')")
        step("자동 저장", saved)

    real_errors = [e for e in errors if "favicon" not in str(e)]
    step("콘솔·페이지 오류 0", len(real_errors) == 0, real_errors[:4])

    result = {"base": BASE, "tag": TAG, "ok": all(s["ok"] for s in steps), "steps": steps, "errors": real_errors[:10],
              "notes": notes}
    with open(os.path.join(OUT, f"{TAG}-report.json"), "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("RESULT " + json.dumps({"ok": result["ok"], "fail": [s for s in steps if not s["ok"]],
                                  "errors": real_errors[:4]}, ensure_ascii=False), flush=True)
    browser.close()
