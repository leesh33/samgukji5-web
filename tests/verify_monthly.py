#!/usr/bin/env python3
"""삼국 한 턴 — 달의 소식(보물 상인 · 도적 잔당 · 재야 명장 천거) 라이브 검증 (390×844)

사용:
  node tests/_event_saves.mjs /tmp/event-saves          # 검증용 저장 3개 만들기
  LD_LIBRARY_PATH=... python3 tests/verify_monthly.py [URL] [TAG] [SAVE_DIR]

  1부  저장을 불러와 실제 화면에서 세 이벤트 시트를 확인하고 선택지까지 눌러 본다
  2부  새 게임으로 턴을 넘겨 달의 소식이 실제 플레이에서도 뜨는지 본다(TURNS, 기본 30)
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
SAVE_DIR = sys.argv[3] if len(sys.argv) > 3 else os.environ.get("SAVE_DIR", "/tmp/event-saves")
TURNS = int(os.environ.get("TURNS", "30"))
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "downloads/samguk5"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors, shots = [], [], {}


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:240]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if str(extra) else ""), flush=True)


def shot(page, name):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path)
    shots[name] = path
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
      return { docW: document.documentElement.scrollWidth, winW: w, bad: bad.slice(0, 6) };
    }""")


def sheet_open(page):
    return not page.locator("#sheet").evaluate("el => el.classList.contains('hidden')")


def sheet_title(page):
    return page.locator("#sheet-title").inner_text() if sheet_open(page) else ""


def ev_title(page):
    loc = page.locator(".ev-title")
    return loc.first.inner_text() if loc.count() else ""


def close_sheet(page):
    if sheet_open(page):
        el = page.locator('.sheet-head [data-act="sheet-close"]')
        if el.count():
            try:
                el.first.click()
                page.wait_for_timeout(160)
            except Exception:
                pass


def dismiss_popup(page):
    for act in ('promo-ok', 'tour-reward'):
        try:
            btn = page.locator(f'[data-act="{act}"]').first
            if btn.count() and btn.is_visible():
                btn.click()
                page.wait_for_timeout(300)
        except Exception:
            pass


def load_save(page, raw):
    page.evaluate("(v) => { localStorage.setItem('samguk5.auto', v); }", raw)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(700)
    page.click('[data-act="continue"]')
    page.wait_for_timeout(1400)


EVENTS = [
    ("treasure", "보물 상인", "m01-treasure-merchant", ["산다", "거절한다"]),
    ("remnant", "도적 잔당", "m02-remnant", ["소규모 출동", "회유한다", "방치한다"]),
    ("sage", "재야 명장 천거", "m03-sage", ["예우를 갖춘다", "사양한다"]),
]

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.set_default_timeout(2200)
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:90], r.failure)))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(700)

    # ---------- 1부 · 저장을 불러와 세 이벤트 화면 확인 ----------
    for key, title_ko, name, wants in EVENTS:
        path = os.path.join(SAVE_DIR, f"{key}.json")
        if not os.path.exists(path):
            step(f"저장 파일 {key}", False, path)
            continue
        raw = open(path, encoding="utf-8").read()
        load_save(page, raw)
        shown = False
        for _ in range(8):
            if sheet_open(page) and ev_title(page) == title_ko:
                shown = True
                break
            page.wait_for_timeout(300)
        body = page.locator("#sheet-body").inner_text() if shown else ""
        ov = overflow(page)
        step(f"달의 소식 — {title_ko}", shown and all(w in body for w in wants) and not ov["bad"],
             f"{sheet_title(page)} / {body.replace(chr(10), ' ')[:170]}")
        if shown:
            shot(page, name)
            # 첫 선택지를 눌러 결과 문구까지 본다
            btn = page.locator('[data-act="event-go"]').first
            if btn.count():
                btn.click()
                page.wait_for_timeout(700)
                toast = page.locator("#toast").inner_text()
                step(f"달의 소식 결과 — {title_ko}", len(toast) > 5 and not sheet_open(page), toast[:150])
                shot(page, name + "-after")

    # ---------- 2부 · 실제 플레이에서도 뜨는지(턴 넘기기) ----------
    page.evaluate("() => localStorage.removeItem('samguk5.auto')")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(600)
    page.click('[data-act="new"]')
    page.wait_for_timeout(320)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(360)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1100)
    step("본 게임 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())

    seen, turns = {}, 0
    deadline = time.time() + float(os.environ.get("PLAY_SECONDS", "120"))
    while turns < TURNS and time.time() < deadline:
        if page.locator("#scr-battle").is_visible():
            for _ in range(14):
                try:
                    if page.locator('[data-act="provoke-decline"]').count():
                        page.click('[data-act="provoke-decline"]')
                        page.wait_for_timeout(350)
                        continue
                    if page.locator('[data-act="battle-event-go"]').count():
                        page.locator('[data-act="battle-event-go"]').last.click()
                        page.wait_for_timeout(350)
                        continue
                    if page.locator('[data-act="bt-close"]').count():
                        page.click('[data-act="bt-close"]')
                        page.wait_for_timeout(450)
                        break
                    allb = page.locator('[data-act="bt-all"]')
                    nxt = page.locator('[data-act="bt-next"]')
                    if allb.count() and not allb.is_disabled():
                        allb.click()
                    elif nxt.count() and not nxt.is_disabled():
                        nxt.click()
                except Exception:
                    pass
                page.wait_for_timeout(750)
            continue
        dismiss_popup(page)
        if sheet_open(page):
            close_sheet(page)
        btn = page.locator("#btn-endturn")
        if not btn.count() or not btn.is_visible() or btn.is_disabled():
            page.wait_for_timeout(350)
            continue
        btn.click()
        turns += 1
        if turns % 10 == 0:
            print(f"... {turns}턴 {page.locator('#hud-date').inner_text()} {seen}", flush=True)
        page.wait_for_timeout(380)
        if page.locator("#scr-battle").is_visible():
            continue
        dismiss_popup(page)
        if not sheet_open(page):
            continue
        title = ev_title(page)
        if title:
            seen[title] = seen.get(title, 0) + 1
            opts = page.locator('[data-act="event-go"]')
            if opts.count():
                opts.first.click()
                page.wait_for_timeout(400)
            else:
                close_sheet(page)
        else:
            close_sheet(page)

    step("실제 플레이에서 달의 소식이 뜬다", len(seen) > 0, f"{turns}턴 / {seen}")
    print("TURNS", turns, "SEEN", seen, flush=True)

    report = {
        "url": BASE, "tag": TAG, "turns": turns, "events_seen": seen,
        "steps": steps, "shots": shots, "errors": errors[:20],
        "failed": [s["step"] for s in steps if not s["ok"]],
    }
    out = os.path.join(OUT, f"{TAG}-monthly-report.json")
    with open(out, "w") as f:
        f.write(json.dumps(report, ensure_ascii=False, indent=1))
    print("REPORT " + out, flush=True)
    print("FAILED " + str(report["failed"]), flush=True)
    browser.close()
