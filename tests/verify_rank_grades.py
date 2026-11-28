"""삼국 한 턴 — 9품관~1품관 제도 라이브 검증 (390×844)
사용: python3 tests/verify_rank_grades.py [URL] [TAG]

준비한 저장(downloads/rank-verify-save.json)을 브라우저 localStorage에 넣고
실제 장수 상세·인사(품관 임명)·승진 연출 화면에서 품관 표기가 깨지지 않는지 본다.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://dotsamguk.vercel.app/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "live"
OUT = os.path.abspath("downloads/rank-grades")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
SAVE = os.path.abspath("downloads/rank-verify-save.json")
os.makedirs(OUT, exist_ok=True)

steps, errors = [], []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:300]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if extra != "" else ""), flush=True)


def shot(page, name, full=False):
    path = os.path.join(OUT, f"{name}.png")
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


def sheet_text(page):
    return page.locator("#sheet-body").inner_text()


def close_sheet(page):
    page.locator('button[data-act="sheet-close"]').last.click()
    page.wait_for_timeout(260)


def open_detail(page, gid):
    page.click(f'[data-act="gen-detail"][data-gid="{gid}"]')
    page.wait_for_timeout(420)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    save_raw = open(SAVE, encoding="utf-8").read()
    ctx.add_init_script("window.__RANK_SAVE__ = %s;" % json.dumps(save_raw))
    ctx.add_init_script("try { localStorage.setItem('samguk5.auto', window.__RANK_SAVE__); } catch (e) {}")
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:120])))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(700)
    step("이어하기 버튼 활성", page.locator("#btn-continue").is_enabled())
    page.click("#btn-continue")
    page.wait_for_timeout(1400)
    step("게임 화면 진입", page.locator("#scr-game").is_visible())
    step("성 패널 열림", page.locator("#citypanel").is_visible())
    shot(page, f"samguk-rank-{TAG}-01-city")

    # ---------- 9품관 장수 상세 ----------
    open_detail(page, "xiahou_dun")
    txt = sheet_text(page)
    step("상세: 9품관 표기", "9품관" in txt, [l for l in txt.splitlines() if "품관" in l][:2])
    step("상세: 장군 직위 없음 안내", "장군 직위 없음" in txt)
    step("상세: 첫 장군 직위 안내", "8품관 · 비장군" in txt and "첫 장군 직위" in txt)
    step("상세: 최대 지휘 7,500", "7,500" in txt)
    shot(page, f"samguk-rank-{TAG}-02-detail-9")

    # 상세에서 바로 임명 버튼(8품관 · 비장군으로 임명)
    btn = page.locator('[data-act="promote-do"]')
    step("상세: 8품관 · 비장군으로 임명 버튼", btn.count() == 1 and "8품관 · 비장군으로 임명" in btn.first.inner_text(),
         btn.first.inner_text() if btn.count() else "버튼 없음")

    # ---------- 1품관 장수 상세 ----------
    close_sheet(page)
    open_detail(page, "xun_you")
    txt = sheet_text(page)
    step("상세: 1품관 · 대장군 표기", "1품관 · 대장군" in txt)
    step("상세: 최고 품관", "최고 품관" in txt)
    step("상세: 최대 지휘 25,000", "25,000" in txt)
    shot(page, f"samguk-rank-{TAG}-03-detail-1")
    close_sheet(page)

    # ---------- 인사 → 품관 임명 ----------
    page.click('[data-act="cmd-group"][data-group="people"]')
    page.wait_for_timeout(320)
    pop = page.locator('[data-act="promote-open"]')
    step("인사 메뉴에 품관 임명", pop.count() == 1 and "품관 임명" in pop.first.inner_text(),
         pop.first.inner_text() if pop.count() else "없음")
    pop.first.click()
    page.wait_for_timeout(520)
    txt = sheet_text(page)
    want = ["9품관", "8품관 · 비장군", "7품관 · 편장군", "6품관 · 아장군", "5품관 · 중랑장",
            "4품관 · 진북장군", "3품관 · 정북장군", "2품관 · 거기장군", "1품관 · 대장군"]
    missing = [w for w in want if w not in txt]
    step("임명 화면에 9품관~1품관 모두 표시", not missing, f"missing={missing}")
    step("임명 화면 안내 문구", "9품관" in txt and "8품관 비장군이 첫 장군 직위" in txt)
    shot(page, f"samguk-rank-{TAG}-04-promote-top")

    # 시트 안쪽을 끝까지 굴려 아래 품관도 확인
    page.evaluate("""() => {
      const s = document.querySelector('#sheet');
      const b = document.querySelector('#sheet-body');
      (b || s).scrollTop = (b || s).scrollHeight;
    }""")
    page.wait_for_timeout(300)
    shot(page, f"samguk-rank-{TAG}-05-promote-bottom")

    ov = overflow(page)
    step("390px 가로 넘침 없음", not ov["bad"], ov)
    step("JS 오류 없음", not errors, errors[:3])

    # ---------- 승진 연출 ----------
    page.evaluate("() => { const b = document.querySelector('#sheet-body'); if (b) b.scrollTop = 0; }")
    page.wait_for_timeout(200)
    rowbtn = page.locator('[data-act="promote-do"][data-officer="xiahou_dun"]')
    step("9품관 장수 임명 버튼 활성", rowbtn.count() == 1 and rowbtn.first.is_enabled())
    if rowbtn.count():
        rowbtn.first.click()
        page.wait_for_timeout(700)
        afx = page.locator(".afx").inner_text() if page.locator(".afx").count() else ""
        step("승진 연출에 8품관 · 비장군", "8품관 · 비장군" in afx, afx.replace("\n", " / ")[:160])
        shot(page, f"samguk-rank-{TAG}-06-promote-fx")
        page.wait_for_timeout(1900)

    # ---------- 출진·전투 화면의 품관 ----------
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(700)
    page.click("#btn-continue")
    page.wait_for_timeout(1300)
    page.click('[data-act="cmd-group"][data-group="army"]')
    page.wait_for_timeout(320)
    page.locator('[data-act="march"]').first.click()
    page.wait_for_timeout(600)
    tg = page.locator('[data-act="march-target"]')
    if tg.count():
        tg.first.click()
        page.wait_for_timeout(300)
    chips = [t.strip() for t in page.locator('.mc-rank').all_inner_texts()]
    step("출진 장수 칩에 품관", any("품관" in t for t in chips), chips[:6])
    shot(page, f"samguk-rank-{TAG}-07-march")
    go = page.locator('[data-act="march-go"]')
    if go.count() and go.first.is_enabled():
        go.first.click()
        page.wait_for_timeout(1600)
        step("전투 진입", page.locator("#scr-battle").is_visible())
        if page.locator('[data-act="bt-select"]').count():
            page.locator('[data-act="bt-select"]').first.click()
            page.wait_for_timeout(400)
            info = page.locator(".bt-unitinfo").inner_text()
            step("전투 부대 정보에 품관", "품관" in info and "지휘 상한" in info, info.replace("\n", " ")[:140])
            shot(page, f"samguk-rank-{TAG}-08-battle")
    ov2 = overflow(page)
    step("전투 화면 390px 넘침 없음", not ov2["bad"], ov2)

    browser.close()

ok = all(s["ok"] for s in steps)
print("\nRESULT", "PASS" if ok else "FAIL", f"{sum(1 for s in steps if s['ok'])}/{len(steps)}", flush=True)
if errors:
    print("ERRORS", errors[:5], flush=True)
sys.exit(0 if ok else 1)
