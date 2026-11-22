"""도트삼국 — 신군주 생성·시나리오 7종 검증 (390×844 · iPhone UA)
사용: python3 tests/verify_custom.py [URL] [TAG]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath("downloads/samguk5")
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
os.makedirs(OUT, exist_ok=True)

steps, errors = [], []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:300]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if extra != "" else ""), flush=True)


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


def finish_battles(page):
    for _ in range(60):
        if page.locator('[data-act="bt-close"]').count() and page.locator('[data-act="bt-close"]').is_visible():
            try:
                page.click('[data-act="bt-close"]')
            except Exception:
                pass
            page.wait_for_timeout(900)
            continue
        if not page.locator("#scr-battle").is_visible():
            return True
        try:
            if page.locator('[data-act="bt-all"]').is_visible() and not page.locator('[data-act="bt-all"]').is_disabled():
                page.click('[data-act="bt-all"]')
            elif page.locator('[data-act="bt-next"]').is_visible() and not page.locator('[data-act="bt-next"]').is_disabled():
                page.click('[data-act="bt-next"]')
        except Exception:
            pass
        page.wait_for_timeout(1100)
    return page.locator("#scr-game").is_visible()



with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:100])))

    # ---------- 타이틀 → 시나리오 ----------
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    page.evaluate("() => { localStorage.clear(); }")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(700)
    step("타이틀 화면", page.locator(".title-mark h1").is_visible())

    page.click('[data-act="new"]')
    page.wait_for_timeout(400)
    scs = page.locator('.sc-card[data-id]').count()
    step("시나리오 7종", scs == 7, scs)
    custom_entry = page.locator('.sc-card[data-act="open-custom"]').count()
    step("시나리오 화면에 신군주 진입 버튼", custom_entry == 1, custom_entry)
    o = overflow(page)
    step("시나리오 화면 가로 넘침 없음", len(o["bad"]) == 0, o)
    shot(page, "c01-scenarios", full=True)

    # ---------- 신군주 생성 ----------
    page.click('.sc-card[data-act="open-custom"]')
    page.wait_for_timeout(450)
    step("신군주 화면", page.locator("#scr-custom").is_visible())
    page.fill("#cst-name", "한호")
    page.wait_for_timeout(150)
    step("이름 미리보기 반영", "한호" in page.locator(".cst-name").inner_text(), page.locator(".cst-name").inner_text())
    page.click('[data-act="cst-scenario"][data-v="s194"]')
    page.wait_for_timeout(300)
    page.click('[data-act="cst-color"][data-v="#8a5cc4"]')
    page.wait_for_timeout(250)
    page.click('[data-act="cst-style"][data-k="hat"][data-v="2"]')
    page.click('[data-act="cst-style"][data-k="beard"][data-v="3"]')
    page.wait_for_timeout(250)
    page.click('[data-act="cst-skill"][data-v="yongmaeng"]')
    page.click('[data-act="cst-arms"][data-v="기병"]')
    page.click('[data-act="cst-retinue"][data-v="2"]')
    page.wait_for_timeout(300)
    # 능력치: 주사위 → + 버튼
    page.click('[data-act="cst-dice"]')
    page.wait_for_timeout(250)
    stats0 = page.evaluate("() => Array.from(document.querySelectorAll('[data-stat]')).map(e => +e.textContent)")
    page.click('[data-act="cst-stat"][data-k="war"][data-d="1"]')
    page.click('[data-act="cst-stat"][data-k="war"][data-d="1"]')
    page.wait_for_timeout(200)
    stats1 = page.evaluate("() => Array.from(document.querySelectorAll('[data-stat]')).map(e => +e.textContent)")
    step("능력치 총합 유지(배분)", sum(stats0) == sum(stats1) == 225, f"{stats0} -> {stats1}")
    # 시작 성 (첫 후보 그대로)
    city = page.evaluate("() => document.querySelector('#cst-city').value")
    city_ko = page.evaluate("() => document.querySelector('#cst-city').selectedOptions[0].textContent.split(' ')[0]")
    step("시작 성 선택", bool(city), f"{city_ko} ({city})")
    o = overflow(page)
    step("신군주 화면 가로 넘침 없음", len(o["bad"]) == 0, o)
    shot(page, "c02-custom-top")
    shot(page, "c02-custom", full=True)

    page.click('[data-act="cst-start"]')
    page.wait_for_timeout(1200)
    step("신군주로 게임 시작", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())
    hud = page.locator("#hud-faction").inner_text()
    step("세력 이름이 신군주", hut := ("한호" in hud), hud)
    crest = page.locator("#hud-crest").inner_text()
    step("깃발 글자 한글 1자", crest == "신" and len(crest) == 1, crest)
    step("시작 성", city_ko in page.locator("#citypanel").inner_text(), page.locator(".cs-name").inner_text())
    gens = page.locator("#citypanel .gen-chip").count()
    step("휘하 3명(군주+2) 표시", gens == 3, gens)
    o = overflow(page)
    step("게임 화면 가로 넘침 없음", len(o["bad"]) == 0, o)
    shot(page, "c03-custom-game")

    # 내정 한 번
    ap0 = page.locator("#res-ap").inner_text()
    page.click('[data-act="cmd"][data-cmd="agri"]')
    page.wait_for_timeout(350)
    page.locator(".officer-row:not(.done)").first.click()
    page.wait_for_timeout(450)
    step("신군주 내정 실행", page.locator("#res-ap").inner_text() != ap0,
         f"{ap0} -> {page.locator('#res-ap').inner_text()}")
    shot(page, "c04-custom-command")

    # ---------- 신군주 부대로 출진 → 전투 ----------
    if page.locator('[data-act="march"]').count():
        page.click('[data-act="march"]')
        page.wait_for_timeout(400)
        step("신군주 출진 시트", "출진" in page.locator("#sheet-title").inner_text(), page.locator("#sheet-title").inner_text())
        page.click('[data-act="march-go"]')
        page.wait_for_timeout(1100)
        step("신군주 전투 진입", page.locator("#scr-battle").is_visible(), page.locator("#bt-name").inner_text())
        names = page.locator('[data-act="bt-select"]').all_inner_texts()
        step("신군주 부대가 전장에 있음", any("한호" in n for n in names), names[:4])
        shot(page, "c04b-custom-battle")
        finish_battles(page)
        page.wait_for_timeout(600)
        step("전투 뒤 게임 복귀", page.locator("#scr-game").is_visible(),
             page.locator("#hud-faction").inner_text())

    # ---------- 저장 → 타이틀 → 이어하기 ----------
    page.click('[data-act="menu"]')
    page.wait_for_timeout(400)
    page.click('[data-act="save-slot"][data-slot="1"]')
    page.wait_for_timeout(500)
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(200)
    page.click('[data-act="menu"]')
    page.wait_for_timeout(300)
    page.click('[data-act="to-title"]')
    page.wait_for_timeout(500)
    page.click('[data-act="continue"]')
    page.wait_for_timeout(1200)
    step("이어하기로 신군주 복원", page.locator("#scr-game").is_visible() and "한호" in page.locator("#hud-faction").inner_text(),
         page.locator("#hud-faction").inner_text())
    step("복원 후 휘하 장수 유지", page.locator("#citypanel .gen-chip").count() == 3,
         page.locator("#citypanel .gen-chip").count())
    # 불러오기 목록에도 슬롯 정보 표시
    page.click('[data-act="menu"]')
    page.wait_for_timeout(300)
    page.click('[data-act="open-load"]')
    page.wait_for_timeout(400)
    load_txt = page.locator("#sheet-body").inner_text()
    step("불러오기 목록에 신군주 기록", "한호" in load_txt, load_txt[:120].replace("\n", " | "))
    shot(page, "c05-load")
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(200)

    # ---------- 184 황건의 난 ----------
    page.click('[data-act="menu"]')
    page.wait_for_timeout(300)
    page.click('[data-act="to-title"]')
    page.wait_for_timeout(400)
    page.click('[data-act="new"]')
    page.wait_for_timeout(400)
    page.click('.sc-card[data-id="s184"]')
    page.wait_for_timeout(500)
    step("184 군주 선택", "184" in page.locator("#lord-title").inner_text(), page.locator("#lord-title").inner_text())
    step("군주 화면 신군주 버튼", page.locator('.cst-lord-entry').count() == 1)
    step("황건적 세력 카드", page.locator('.lord-card[data-id="hwanggeon"]').count() == 1,
         page.locator(".lord-card").count())
    shot(page, "c06-lords-184")
    page.click('.lord-card[data-id="hwanggeon"]')
    page.wait_for_timeout(1200)
    step("184 플레이 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())
    step("184 날짜", "184년" in page.locator("#hud-date").inner_text(), page.locator("#hud-date").inner_text())
    o = overflow(page)
    step("184 화면 가로 넘침 없음", len(o["bad"]) == 0, o)
    shot(page, "c07-s184")
    for i in range(2):
        if page.locator('[data-act="endturn"]').is_visible():
            page.click('[data-act="endturn"]')
        page.wait_for_timeout(1400)
        finish_battles(page)
        page.wait_for_timeout(500)
    step("184 두 달 진행", page.locator("#scr-game").is_visible(), page.locator("#hud-date").inner_text())
    o = overflow(page)
    step("184 진행 후 가로 넘침 없음", len(o["bad"]) == 0, o)
    shot(page, "c08-s184-turn")

    # ---------- 다른 시나리오도 열리는지 ----------
    page.click('[data-act="menu"]')
    page.wait_for_timeout(300)
    page.click('[data-act="to-title"]')
    page.wait_for_timeout(400)
    page.click('[data-act="new"]')
    page.wait_for_timeout(300)
    for sid in ["s189", "s219", "s225"]:
        page.click(f'.sc-card[data-id="{sid}"]')
        page.wait_for_timeout(400)
        n = page.locator(".lord-card").count()
        step(f"{sid} 군주 목록", n >= 3, n)
        shot(page, f"c09-{sid}-lords")
        page.click('[data-act="back-scenario"]')
        page.wait_for_timeout(300)

    errs = [e for e in errors if "favicon" not in str(e).lower()]
    step("콘솔 오류 없음", len(errs) == 0, errs[:3])
    browser.close()

ok = all(s["ok"] for s in steps)
print("\n== 결과:", "전체 통과" if ok else "실패 있음", f"({sum(1 for s in steps if s['ok'])}/{len(steps)})")
print(json.dumps([s for s in steps if not s["ok"]], ensure_ascii=False))
print(json.dumps([e for e in errors[:6]], ensure_ascii=False))
sys.exit(0 if ok else 1)
