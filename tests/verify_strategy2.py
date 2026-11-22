"""도트삼국 — 4대 전략 고도화 라이브 검증 2부 (390×844 · 관직 승급·전투 원군·달의 소식)

사용: python3 tests/verify_strategy2.py [URL] [TAG]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "/workspace/downloads/samguk5"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors = [], {}


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


def sheet_open(page):
    return not page.locator("#sheet").evaluate("el => el.classList.contains('hidden')")


def sheet_title(page):
    return page.locator("#sheet-title").inner_text() if sheet_open(page) else ""


def close_sheet(page):
    if sheet_open(page) and page.locator('.sheet-head [data-act="sheet-close"]').count():
        page.locator('.sheet-head [data-act="sheet-close"]').first.click()
        page.wait_for_timeout(180)


def ap_now(page):
    txt = page.locator("#res-ap").inner_text()
    try:
        return int(txt.split("/")[0])
    except Exception:
        return 0


def clear_prisoners(page):
    for _ in range(8):
        if not page.locator('[data-act="prisoner-release"]').count():
            break
        try:
            page.locator('[data-act="prisoner-release"]').first.click()
            page.wait_for_timeout(260)
        except Exception:
            break
    if page.locator('[data-act="prisoner-done"]').count():
        page.click('[data-act="prisoner-done"]')
        page.wait_for_timeout(600)


def resolve_overlays(page, budget=14, keep_event=False, keep_promo=False):
    """전투·포로·이벤트·승급 시트를 정리하고, 본 시트 이름을 돌려준다"""
    seen = []
    for _ in range(budget):
        # 1) 시트(전투 결과·포로·이벤트·승급) 먼저
        if sheet_open(page):
            title = sheet_title(page)
            seen.append(title)
            if page.locator('[data-act="bt-close"]').count():
                page.click('[data-act="bt-close"]')
                page.wait_for_timeout(700)
                continue
            if page.locator('[data-act="prisoner-release"]').count():
                clear_prisoners(page)
                continue
            if page.locator('[data-act="event-go"]').count():
                if keep_event:
                    return seen
                page.locator('[data-act="event-go"]').first.click()
                page.wait_for_timeout(500)
                continue
            if page.locator('[data-act="promo-ok"]').count():
                if keep_promo:
                    return seen
                try:
                    page.locator('[data-act="promo-ok"]').first.click(timeout=3000)
                except Exception:
                    close_sheet(page)
                page.wait_for_timeout(350)
                continue
            close_sheet(page)
            continue
        # 2) 전투 화면
        if page.locator("#scr-battle").is_visible():
            seen.append("전투")
            try:
                page.click('[data-act="bt-retreat"]', timeout=3000)
            except Exception:
                pass
            page.wait_for_timeout(800)
            continue
        return seen
    return seen


def end_turn(page, keep_event=False, keep_promo=False):
    if sheet_open(page):
        return False
    btn = page.locator('[data-act="endturn"]')
    if not btn.count() or not btn.is_visible():
        return False
    try:
        btn.click(timeout=2500)
    except Exception:
        return False
    page.wait_for_timeout(900)
    resolve_overlays(page, keep_event=keep_event, keep_promo=keep_promo)
    page.wait_for_timeout(300)
    return True


def ensure_ap(page, need=1):
    for _ in range(4):
        if ap_now(page) >= need:
            return True
        end_turn(page)
    return ap_now(page) >= need


def open_mine(page):
    if sheet_open(page):
        close_sheet(page)
        page.wait_for_timeout(150)
    if not page.locator('[data-act="jump-region"][data-region="__mine"]').count():
        return
    page.click('[data-act="jump-region"][data-region="__mine"]')
    page.wait_for_timeout(350)
    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        if page.locator(".cs-toggle").count():
            page.click(".cs-toggle")
            page.wait_for_timeout(350)


def do_cmd(page, cmd):
    """현재 성 패널에서 명령 하나를 실행(첫 가용 장수). 성공하면 True"""
    if sheet_open(page):
        return False
    btn = page.locator(f'[data-act="cmd"][data-cmd="{cmd}"]')
    if not btn.count() or btn.first.is_disabled():
        return False
    try:
        btn.first.click(timeout=2500)
    except Exception:
        return False
    page.wait_for_timeout(320)
    rows = page.locator(".officer-row:not(.done)")
    if not rows.count():
        close_sheet(page)
        return False
    before = ap_now(page)
    try:
        rows.first.click(timeout=2500)
    except Exception:
        close_sheet(page)
        return False
    page.wait_for_timeout(420)
    return ap_now(page) != before


def capture_promo(page, shot_name):
    """관직 승급 시트가 떠 있으면 기록하고 닫는다"""
    if not sheet_open(page) or not page.locator('[data-act="promo-ok"]').count():
        return None
    if not page.locator(".promo-to").count():
        return None
    office_after = page.locator(".promo-to").inner_text()
    step("관직 승급 알림", True, office_after)
    shot(page, shot_name)
    try:
        page.locator('[data-act="promo-ok"]').first.click(timeout=3000)
    except Exception:
        close_sheet(page)
    page.wait_for_timeout(450)
    step("HUD 관직 갱신", page.locator("#hud-office").inner_text() == office_after,
         page.locator("#hud-office").inner_text())
    return office_after


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.setdefault("console", []).append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.setdefault("pageerror", []).append(str(e)))
    page.on("requestfailed", lambda r: errors.setdefault("reqfail", []).append(r.url[:120]))

    # ---------- 게임 시작 ----------
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    page.click('[data-act="new"]')
    page.wait_for_timeout(300)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(350)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1000)
    step("본 게임 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())
    step("HUD 관직 표시", page.locator("#hud-office").inner_text() == "현령", page.locator("#hud-office").inner_text())
    shot(page, "b01-game")

    # ---------- 관직 승급 (명성 50 → 자사) ----------
    promoted = False
    for _ in range(18):
        if capture_promo(page, "b02-promotion"):
            promoted = True
            break
        if sheet_open(page):
            resolve_overlays(page, budget=2, keep_promo=True)
            page.wait_for_timeout(200)
            continue
        if ap_now(page) < 1:
            end_turn(page, keep_promo=True)
            page.wait_for_timeout(250)
            continue
        page.wait_for_timeout(320)          # 미뤄 둔 승급 알림이 뜰 시간을 준다
        if capture_promo(page, "b02-promotion"):
            promoted = True
            break
        moved = False
        for _city in range(3):
            for cmd in ("agri", "order", "comm", "water"):
                if do_cmd(page, cmd):
                    moved = True
                    break
            if moved:
                break
            if page.locator('[data-act="city-next"]').count() and not sheet_open(page):
                try:
                    page.click('[data-act="city-next"]', timeout=2000)
                except Exception:
                    pass
                page.wait_for_timeout(240)
        if not moved:
            end_turn(page, keep_promo=True)
        page.wait_for_timeout(250)
    step("관직 승급 도달", promoted, f"명성 {page.locator('#res-fame').inner_text()} · {page.locator('#hud-office').inner_text()}")

    # ---------- 출진 + 원군 ----------
    open_mine(page)
    ensure_ap(page, 1)
    reinforced = False
    if page.locator('[data-act="march"]').count():
        page.locator('[data-act="march"]').first.click()
        page.wait_for_timeout(450)
        chips = page.locator('[data-act="march-reinforce"]')
        step("출진 시트 원군 후보", chips.count() >= 1, f"{chips.count()}부대")
        if chips.count():
            chips.first.click()
            page.wait_for_timeout(350)
            step("원군 선택", page.locator('[data-act="march-reinforce"].on').count() == 1,
                 page.locator('[data-act="march-reinforce"].on').count())
            shot(page, "b03-march-reinforce")
        page.click('[data-act="march-go"]')
        page.wait_for_timeout(1100)
        step("전투 진입", page.locator("#scr-battle").is_visible(), page.locator("#bt-name").inner_text())
        shot(page, "b04-battle-r1")
        for _ in range(30):
            if not page.locator("#scr-battle").is_visible():
                break
            if "R2" in page.locator("#bt-name").inner_text():
                break
            try:
                if page.locator('[data-act="bt-next"]').is_visible() and not page.locator('[data-act="bt-next"]').is_disabled():
                    page.click('[data-act="bt-next"]')
                elif page.locator('[data-act="bt-all"]').is_visible() and not page.locator('[data-act="bt-all"]').is_disabled():
                    page.click('[data-act="bt-all"]')
            except Exception:
                pass
            page.wait_for_timeout(1200)
        logb = page.locator("#bt-log").inner_text() if page.locator("#bt-log").count() else ""
        reinforced = "원군 도착" in logb
        if page.locator("#scr-battle").is_visible():
            shot(page, "b05-battle-r2")
        step("전투 R2 원군 도착 로그", reinforced, [l for l in logb.split("\n") if "원군" in l][:2])
        resolve_overlays(page)
        page.wait_for_timeout(400)
    else:
        step("출진 시트 원군 후보", False, "출진 버튼 없음")

    # ---------- 월간 이벤트 ----------
    event_seen = ""
    for _ in range(14):
        if page.locator('[data-act="event-go"]').count():
            event_seen = page.locator(".ev-title").inner_text()
            step("월간 이벤트 모달", True, event_seen)
            shot(page, "b06-event")
            page.locator('[data-act="event-go"]').first.click()
            page.wait_for_timeout(700)
            step("이벤트 선택 반영", page.locator('[data-act="event-go"]:visible').count() == 0,
                 (page.locator("#toast").inner_text() if page.locator("#toast").count() else "") + " / 시트:" + (sheet_title(page) or "없음"))
            break
        end_turn(page, keep_event=True)
        page.wait_for_timeout(300)
    step("월간 이벤트 발생", bool(event_seen), event_seen or "14턴 안에 미발생")

    # ---------- 최종 점검 ----------
    page.wait_for_timeout(300)
    o = overflow(page)
    step("가로 넘침 없음(최종)", len(o["bad"]) == 0, o)
    shot(page, "b07-final")
    hanja = page.evaluate("""() => {
      const re = /[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/;
      const hits = [];
      document.querySelectorAll('body *').forEach(el => {
        for (const n of el.childNodes) if (n.nodeType === 3 && re.test(n.textContent)) hits.push(n.textContent.trim().slice(0, 20));
      });
      return hits.slice(0, 5);
    }""")
    step("화면에 한자 0자", len(hanja) == 0, hanja)
    err = []
    for k, v in errors.items():
        for item in v:
            err.append(f"{k}:{item}")
    step("콘솔 오류 0", len(err) == 0, err[:4])

    browser.close()

ok = all(s["ok"] for s in steps)
print("\n" + json.dumps({"ok": ok, "passed": sum(1 for s in steps if s["ok"]), "total": len(steps),
                        "steps": steps}, ensure_ascii=False, indent=1), flush=True)
sys.exit(0 if ok else 1)
