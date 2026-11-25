"""삼국 한 턴 — 역사 등장연도(appearYear) + 시나리오 12종 라이브 검증 (390×844)

사용: python3 tests/verify_appear_year.py [URL] [OUTDIR]
확인:
  1) 시나리오 목록 12종(184·189·191·194·200·207·208·211·219·225·227·251)
  2) 194년 군웅할거 조조 — 진류 등용 목록에 사마의가 없다
  3) 251년 영웅집결 진입 — 등장연도 무시(가상)
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd, open_group

DEPS = "/workspace/.local/chromedeps/usr/lib/x86_64-linux-gnu"
if os.path.isdir(DEPS):
    os.environ["LD_LIBRARY_PATH"] = DEPS + (":" + os.environ["LD_LIBRARY_PATH"] if os.environ.get("LD_LIBRARY_PATH") else "")

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else "/workspace/downloads/samguk5"
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUTDIR, exist_ok=True)

steps, errors = [], []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:500]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:300] if extra != "" else ""), flush=True)


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


def pick_city(page, name):
    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        page.click('[data-act="city-toggle"]')
        page.wait_for_timeout(400)
    found = page.locator(".cs-name").inner_text().strip() == name
    for _ in range(30):
        if found:
            break
        btn = page.locator('[data-act="city-next"]')
        if not btn.count():
            break
        btn.first.click()
        page.wait_for_timeout(300)
        found = page.locator(".cs-name").inner_text().strip() == name
    return found


result = {"ok": False}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:100], r.failure)))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(900)
    page.click('[data-act="new"]')
    page.wait_for_timeout(400)

    # 1) 시나리오 12종
    cards = page.evaluate("""() => [...document.querySelectorAll('#scenario-list .sc-card[data-id]')].map(el => {
      const y = el.querySelector('.sc-year') ? el.querySelector('.sc-year').innerText.trim() : '';
      const n = el.querySelector('.sc-name') ? el.querySelector('.sc-name').innerText.trim() : '';
      return {id: el.dataset.id, year: y, name: n};
    })""")
    step("시나리오 카드 12종", len(cards) == 12, [(c["year"], c["name"]) for c in cards])
    ids = [c["id"] for c in cards]
    want = ["s184", "s189", "s191", "s194", "s200", "s207", "s208", "s211", "s219", "s225", "s227", "s251"]
    step("시나리오 id·연도 순서", ids == want, ids)
    step("신규 5종(191·207·211·227·251) 표시",
         all(c["id"] in ids for c in [{"id": "s191"}, {"id": "s207"}, {"id": "s211"}, {"id": "s227"}, {"id": "s251"}]),
         [c["name"] for c in cards if c["id"] in ("s191", "s207", "s211", "s227", "s251")])
    shot_list = os.path.join(OUTDIR, "live-appear-01-scenarios-390x844.png")
    page.screenshot(path=shot_list)
    print("SHOT " + shot_list, flush=True)
    step("시나리오 목록 가로 넘침 없음", len(overflow(page)["bad"]) == 0, overflow(page))

    # 2) 194년 군웅할거 → 조조 → 진류 등용 목록
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1200)
    step("194년 조조 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())
    step("진류 선택", pick_city(page, "진류"), page.locator(".cs-name").inner_text().strip())

    open_group(page, "people")
    click_cmd(page, "hire")
    page.wait_for_timeout(700)
    title = page.locator("#sheet-title").inner_text()
    rows = page.evaluate("""() => [...document.querySelectorAll('.officer-row.hire')].map(row => {
      const n = row.querySelector('.or-name');
      return n ? n.innerText.trim() : '';
    })""")
    step("진류 등용 시트 열림", "진류" in title and "등용" in title, title)
    step("진류 등용 목록에 사마의 없음", "사마의" not in rows, rows)
    step("진류 등용 목록에 다른 재야 장수 있음", len(rows) > 0, rows)
    shot_hire = os.path.join(OUTDIR, "live-appear-02-chenliu-194-390x844.png")
    page.screenshot(path=shot_hire)
    print("SHOT " + shot_hire, flush=True)

    # 3) 251년 영웅집결 — 새 게임 화면부터 다시
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    page.click('[data-act="new"]')
    page.wait_for_timeout(400)
    page.click('.sc-card[data-id="s251"]')
    page.wait_for_timeout(500)
    lords = page.evaluate("""() => [...document.querySelectorAll('.lord-card[data-id]')].map(el => el.dataset.id)""")
    step("251 군주 8세력", len(lords) == 8, lords)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1200)
    step("251 영웅집결 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())
    info = page.evaluate("""() => ({date: document.querySelector('#hud-date') ? document.querySelector('#hud-date').innerText : '',
                                    faction: document.querySelector('#hud-faction') ? document.querySelector('#hud-faction').innerText : ''})""")
    step("251년·위 세력 표시", "251" in info["date"] and "위" in info["faction"], info)
    shot_hero = os.path.join(OUTDIR, "live-appear-03-251-hero-390x844.png")
    page.screenshot(path=shot_hero)
    print("SHOT " + shot_hero, flush=True)

    step("콘솔·네트워크 오류 0", len(errors) == 0, errors[:4])

    result = {"ok": all(s["ok"] for s in steps), "steps": steps, "cards": cards, "rows": rows,
              "shots": [shot_list, shot_hire, shot_hero], "errors": errors[:10]}
    browser.close()

print(json.dumps(result, ensure_ascii=False, indent=1)[:6000])
sys.exit(0 if result.get("ok") else 1)
