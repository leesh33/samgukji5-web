"""삼국 한 턴 — 허창 등용 화면 '낯섦(친밀 40 미만)' 상한 12% 라이브 검증 (390×844)

사용: python3 tests/verify_hire_cap.py [URL] [OUTDIR]
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
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:400]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if extra != "" else ""), flush=True)


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
    page.wait_for_timeout(320)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1100)
    step("본 게임 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())

    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        page.click('[data-act="city-toggle"]')
        page.wait_for_timeout(400)

    # 내 성 순회 → 허창
    found = page.locator(".cs-name").inner_text().strip() == "허창"
    for _ in range(24):
        if found:
            break
        btn = page.locator('[data-act="city-next"]')
        if not btn.count():
            break
        btn.first.click()
        page.wait_for_timeout(320)
        found = page.locator(".cs-name").inner_text().strip() == "허창"
    step("허창 선택", found, page.locator(".cs-name").inner_text().strip())

    open_group(page, "people")
    click_cmd(page, "hire")
    page.wait_for_timeout(600)
    title = page.locator("#sheet-title").inner_text()
    step("허창 등용 시트 열림", "허창" in title and "등용" in title, title)

    rows = page.evaluate("""() => [...document.querySelectorAll('.officer-row.hire')].map(row => {
      const stats = [...row.querySelectorAll('.or-stats')];
      const affLine = stats[1] ? stats[1].innerText : '';
      const name = row.querySelector('.or-name') ? row.querySelector('.or-name').innerText.trim() : '';
      const m = affLine.match(/친밀\\s*(\\d+)\\s*(\\S*)[\\s\\S]*?등용 성공률\\s*(\\d+)%/);
      return {name, raw: affLine.replace(/\\n/g, ' '), aff: m ? +m[1] : null,
              label: m ? m[2] : null, chance: m ? +m[3] : null};
    })""")
    step("등용 목록 행", len(rows) > 0, len(rows))

    low = [r for r in rows if r["aff"] is not None and r["aff"] < 40]
    high = [r for r in rows if r["aff"] is not None and r["aff"] >= 40]
    step("낯섦(친밀 40 미만) 행 존재", len(low) > 0, [f"{r['name']} 친밀{r['aff']} {r['chance']}%" for r in low])
    step("낯섦 행 등용 성공률 전부 12% 이하", low and all(r["chance"] is not None and r["chance"] <= 12 for r in low),
         [f"{r['name']} {r['chance']}%" for r in low])
    step("낯섦 행 12% 상한 적용 확인(최대 12%)", low and max(r["chance"] for r in low) == 12,
         f"최대 {max((r['chance'] for r in low), default=None)}%")
    step("알음(친밀 40 이상) 행은 기존 계산 유지(12% 초과)", high and all(r["chance"] > 12 for r in high),
         [f"{r['name']} 친밀{r['aff']} {r['chance']}%" for r in high])

    shot = os.path.join(OUTDIR, "live-hire-cap12.png")
    page.screenshot(path=shot)
    print("SHOT " + shot, flush=True)

    o = overflow(page)
    step("가로 넘침 없음", len(o["bad"]) == 0, o)
    step("콘솔·네트워크 오류 0", len(errors) == 0, errors[:4])

    result = {"ok": all(s["ok"] for s in steps), "steps": steps, "rows": rows,
              "screenshot": shot, "errors": errors[:10], "overflow": o}
    browser.close()

print(json.dumps(result, ensure_ascii=False, indent=1)[:4000])
sys.exit(0 if result.get("ok") else 1)
