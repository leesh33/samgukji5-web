#!/usr/bin/env python3
"""삼국 한 턴 — 일기토 도발 · 전투 돌발 이벤트 라이브 검증 (390×844)

사용:
  LD_LIBRARY_PATH=/workspace/.local/chromedeps/usr/lib/x86_64-linux-gnu \
    python3 tests/verify_events.py [URL] [TAG]

  1부  적장의 일기토 도발 → 거절(아군 사기 하락) → 전투 돌발(야습·화공)
  2부  도발 수락 → 기존 일기토 화면 → 일기토가 끝나면 적의 차례가 이어진다
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_march, march_locator

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
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
                page.wait_for_timeout(180)
            except Exception:
                pass


def dismiss_popup(page):
    for act in ("promo-ok",):
        try:
            btn = page.locator(f'[data-act="{act}"]').first
            if btn.count() and btn.is_visible():
                btn.click()
                page.wait_for_timeout(320)
        except Exception:
            pass


def go_city(page, name):
    dismiss_popup(page)
    for _ in range(6):
        if name in page.locator("#citypanel").inner_text():
            return True
        page.click('[data-act="city-next"]')
        page.wait_for_timeout(300)
    return name in page.locator("#citypanel").inner_text()


def march(page, target):
    dismiss_popup(page)
    if not march_locator(page).count():
        return False
    try:
        click_march(page)
    except Exception:
        return False
    page.wait_for_timeout(420)
    if page.locator(f'[data-act="march-target"][data-city="{target}"]').count():
        page.click(f'[data-act="march-target"][data-city="{target}"]')
        page.wait_for_timeout(250)
    return page.locator('[data-act="march-go"]').count() > 0


def battle_log(page):
    return page.evaluate("() => (document.querySelector('#bt-log')||{}).innerText || ''")


def battle_round(page):
    return page.evaluate("() => (document.querySelector('#bt-round')||{}).innerText || ''")


def my_turn(page):
    txt = battle_round(page)
    return "내 차례" in txt and "전투 종료" not in txt


def finish_battle(page, max_wait=26):
    for _ in range(max_wait):
        if page.locator('[data-act="bt-close"]').count():
            return True
        if not page.locator("#scr-battle").is_visible():
            return False
        try:
            allb = page.locator('[data-act="bt-all"]')
            nxt = page.locator('[data-act="bt-next"]')
            if allb.is_visible() and not allb.is_disabled():
                allb.click()
            elif nxt.is_visible() and not nxt.is_disabled():
                nxt.click()
        except Exception:
            pass
        page.wait_for_timeout(1200)
    return page.locator('[data-act="bt-close"]').count() > 0


def new_game(page):
    page.goto(BASE, wait_until="networkidle", timeout=25000)
    page.wait_for_timeout(700)
    page.click('[data-act="new"]')
    page.wait_for_timeout(350)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1200)


def wait_provoke(page, rounds=8):
    """적 차례마다 난수 0을 심어 도발을 반드시 걸리게 하고, 시트가 뜨면 True."""
    for _ in range(rounds):
        if page.locator('[data-act="provoke-accept"]').count():
            return True
        # 돌발 이벤트 시트가 먼저 떠 있으면 답하고 넘어간다(도발은 다음 적 차례에 다시 노린다)
        if sheet_open(page) and sheet_title(page) == "전장의 변수":
            try:
                page.locator('[data-act="battle-event-go"]').last.click()
                page.wait_for_timeout(600)
            except Exception:
                pass
            continue
        if page.locator('[data-act="bt-close"]').count() or not page.locator("#scr-battle").is_visible():
            return False
        if page.locator('[data-act="duel-act"]').count():
            return False
        if my_turn(page):
            try:
                allb = page.locator('[data-act="bt-all"]')
                if allb.is_visible() and not allb.is_disabled():
                    allb.click()          # 전군 돌격 → 모든 부대가 행동 → 적 차례
                    page.wait_for_timeout(2100)
            except Exception:
                pass
            page.evaluate("() => { window.__rq = [0]; }")
        try:
            nxt = page.locator('[data-act="bt-next"]')
            if nxt.is_visible() and not nxt.is_disabled():
                nxt.click()
        except Exception:
            pass
        for _w in range(14):
            page.wait_for_timeout(240)
            if page.locator('[data-act="provoke-accept"]').count():
                return True
            if page.locator('[data-act="bt-close"]').count():
                return False
    return page.locator('[data-act="provoke-accept"]').count() > 0


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.set_default_timeout(1800)
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:90], r.failure)))

    # 난수 갈고리 — window.__rq 순서대로, window.__arm(패턴) 으로 주기적 난수
    page.add_init_script("""(() => {
      const orig = Math.random.bind(Math);
      window.__rq = null;
      Math.random = () => (window.__rq && window.__rq.length ? window.__rq.shift() : orig());
      window.__arm = (pat) => { window.__c = 0; Math.random = () => pat[(window.__c++) % pat.length]; };
      window.__reset = () => { Math.random = () => (window.__rq && window.__rq.length ? window.__rq.shift() : orig()); };
    })();""")

    # ---------------- 1부 · 도발 거절 + 전투 돌발 ----------------
    new_game(page)
    step("타이틀 → 새 게임", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())

    go_city(page, "허창")
    opened = march(page, "xiaopei")
    step("출진 시트(허창 → 소패)", opened, sheet_title(page))
    page.click('[data-act="march-go"]')
    page.wait_for_timeout(1200)
    step("전투 진입", page.locator("#scr-battle").is_visible(), page.locator("#bt-name").inner_text())
    shot(page, "ev01-battle-start")

    got = wait_provoke(page)
    step("적장의 일기토 도발 시트", got, sheet_title(page))
    if got:
        body = page.locator("#sheet-body").inner_text()
        step("도발 시트 — 수락/거절 선택지", "수락 — 일기토" in body and "거절 — 아군 사기 소폭 하락" in body,
             body.replace("\n", " ")[:150])
        ov = overflow(page)
        step("도발 시트 가로 넘침 없음", not ov["bad"] and ov["docW"] <= ov["winW"], ov)
        shot(page, "ev02-duel-provoke")
        page.click('[data-act="provoke-decline"]')
        page.wait_for_timeout(900)
        log = battle_log(page)
        step("거절 → 아군 사기 하락 로그", "[도발 거절]" in log,
             [l for l in log.split("\n") if "[도발 거절]" in l][-1:][0][:120] if "[도발 거절]" in log else log[-80:])
        shot(page, "ev03-provoke-declined")

    # 돌발 이벤트 — 홀수 번째 난수 0(발동) · 짝수 번째 0.999(후보 맨 끝=야습)
    event_shots = []
    for rnd in range(10):
        if page.locator('[data-act="bt-close"]').count() or not page.locator("#scr-battle").is_visible():
            break
        if my_turn(page) and not (sheet_open(page) and sheet_title(page) == "전장의 변수"):
            page.evaluate("() => window.__arm([0, 0.999])")
        try:
            nxt = page.locator('[data-act="bt-next"]')
            if nxt.is_visible() and not nxt.is_disabled():
                nxt.click()
        except Exception:
            pass
        for _w in range(20):
            page.wait_for_timeout(220)
            if sheet_open(page) and sheet_title(page) == "전장의 변수":
                break
            if page.locator('[data-act="bt-close"]').count():
                break
        if not (sheet_open(page) and sheet_title(page) == "전장의 변수"):
            continue
        title = ev_title(page)
        body = page.locator("#sheet-body").inner_text()
        idx = len(event_shots) + 1
        base = 4 + (idx - 1) * 2
        ov = overflow(page)
        step(f"전투 돌발 이벤트 — {title}", len(body) > 20 and not ov["bad"], body.replace("\n", " ")[:150])
        shot(page, f"ev{base:02d}-battle-event-{idx}")
        event_shots.append(title)
        first = page.locator('[data-act="battle-event-go"]').first
        if first.count():
            first.click()
            page.wait_for_timeout(800)
            log = battle_log(page)
            step(f"돌발 이벤트 결과 로그 — {title}",
                 any(t in log for t in ("[원군 도착!]", "[내응]", "[동요]", "[야습 성공]", "[야습 실패]", "[화공 성공]", "[화공 실패]")),
                 [l for l in log.split("\n") if l.startswith("[")][-1:][0][:120] if "[" in log else log[-80:])
            shot(page, f"ev{base + 1:02d}-battle-event-{idx}-after")
        if len(event_shots) >= 2:
            break

    page.evaluate("() => window.__reset()")
    if not page.locator('[data-act="bt-close"]').count():
        finish_battle(page)
    if page.locator('[data-act="bt-close"]').count():
        step("전투 종료", True, sheet_title(page))
        shot(page, "ev08-battle-result")
        page.click('[data-act="bt-close"]')
        page.wait_for_timeout(900)
    if sheet_open(page):
        close_sheet(page)
    step("1부 가로 넘침 없음", overflow(page)["docW"] <= 390, overflow(page))

    # ---------------- 2부 · 도발 수락 → 일기토 ----------------
    new_game(page)
    go_city(page, "허창")
    step("2부 출진", march(page, "xiaopei"), sheet_title(page))
    page.click('[data-act="march-go"]')
    page.wait_for_timeout(1200)
    got2 = wait_provoke(page)
    step("도발 시트(2부)", got2, sheet_title(page))
    accepted = False
    duel_seen = False
    if got2:
        shot(page, "ev09-provoke-accept")
        page.click('[data-act="provoke-accept"]')
        page.wait_for_timeout(800)
        accepted = True
        if page.locator("#duel").is_visible():
            duel_seen = True
            step("도발 수락 → 기존 일기토 화면", "일기토" in page.locator("#duel-a").inner_text() + page.locator(".duel-head").inner_text(),
                 page.locator("#duel-a").inner_text().replace("\n", " ")[:70])
            shot(page, "ev10-duel-screen")
            page.locator('[data-act="duel-act"]').first.click()
            page.wait_for_timeout(900)
            shot(page, "ev11-duel-action")
            log = battle_log(page)
            step("수락 기록이 전투 로그에 남는다", "[일기토 승낙]" in log, log[-100:])
    step("도발 수락 경로", accepted and duel_seen, "duel" if duel_seen else "no-duel")

    # 일기토를 끝까지 진행 → 전장으로 복귀 → 적의 차례가 이어진다
    resume = False
    for _ in range(26):
        if not page.locator("#duel").is_visible():
            break
        if page.locator('[data-act="duel-close"]').count():
            page.click('[data-act="duel-close"]')
            page.wait_for_timeout(1200)
            resume = page.locator("#scr-battle").is_visible()
            break
        btn = page.locator('[data-act="duel-act"]').first
        if btn.count():
            btn.click()
            page.wait_for_timeout(420)
    step("일기토 뒤 전장 복귀", resume, battle_round(page))
    shot(page, "ev12-after-duel")

    page.evaluate("() => window.__reset()")
    if not page.locator('[data-act="bt-close"]').count():
        finish_battle(page, 18)
    if page.locator('[data-act="bt-close"]').count():
        page.click('[data-act="bt-close"]')
        page.wait_for_timeout(700)
    if sheet_open(page):
        close_sheet(page)

    page_errors = [e for e in errors if e[0] in ("pageerror",)]
    step("자바스크립트 오류 없음", not page_errors, page_errors[:3])

    report = {
        "url": BASE, "tag": TAG, "battle_events": event_shots,
        "steps": steps, "shots": shots, "errors": errors[:20],
        "failed": [s["step"] for s in steps if not s["ok"]],
    }
    out = os.path.join(OUT, f"{TAG}-events-report.json")
    with open(out, "w") as f:
        f.write(json.dumps(report, ensure_ascii=False, indent=1))
    print("REPORT " + out, flush=True)
    print("FAILED " + str(report["failed"]), flush=True)
    browser.close()
