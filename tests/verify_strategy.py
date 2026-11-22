"""도트삼국 — 4대 전략 고도화 라이브 검증 1부 (390×844 · 외교·계략·관직 표시)

사용: python3 tests/verify_strategy.py [URL] [TAG]
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

    # ---------- 관직 표시 ----------
    office = page.locator("#hud-office").inner_text() if page.locator("#hud-office").count() else ""
    step("HUD 관직 표시", office == "현령", office)
    o = overflow(page)
    step("가로 넘침 없음(지도)", len(o["bad"]) == 0, o)
    shot(page, "s01-game")

    # ---------- 외교 모달 ----------
    page.click('[data-act="diplomacy"]')
    page.wait_for_timeout(500)
    rows = page.locator(".dp-row").count()
    step("외교 모달 — 세력 목록", rows >= 5, f"{rows}세력 · {sheet_title(page)}")
    step("외교 모달 — 관계 라벨", page.locator(".dp-rel b").count() == rows, page.locator(".dp-rel b").first.inner_text())
    o = overflow(page)
    step("가로 넘침 없음(외교)", len(o["bad"]) == 0, o)
    shot(page, "s02-diplomacy")

    gold0 = page.locator("#res-gold").inner_text()
    rel0 = page.locator(".dp-row").first.locator(".dp-rel span").inner_text()
    page.locator('.dp-row').first.locator('[data-kind="envoy"]').click()
    page.wait_for_timeout(700)
    rel1 = page.locator(".dp-row").first.locator(".dp-rel span").inner_text()
    gold1 = page.locator("#res-gold").inner_text()
    step("친선 사절 — 우호도 상승·금 소모", rel0 != rel1 and gold0 != gold1, f"{rel0} -> {rel1} / 금 {gold0} -> {gold1}")
    shot(page, "s03-envoy")

    page.locator('.dp-row').first.locator('[data-kind="alliance"]').click()
    page.wait_for_timeout(800)
    label = page.locator(".dp-row").first.locator(".dp-rel b").inner_text()
    ally_ok = label == "동맹"
    step("동맹 제의 — 판정 동작", label in ("동맹", "중립", "우호", "적대", "정전"), f"결과 {label}")
    shot(page, "s04-alliance")

    if ally_ok:
        months = page.locator(".dp-row").first.locator(".dp-rel em").inner_text()
        step("동맹 12개월 표시", "12" in months, months)
        shot(page, "s05-ally")
    else:
        page.locator('.dp-row').first.locator('[data-kind="truce"]').click()
        page.wait_for_timeout(700)
        step("정전 협정 — 판정 동작", page.locator(".dp-row").first.locator(".dp-rel b").inner_text() in ("정전", "중립", "우호", "적대"),
             page.locator(".dp-row").first.locator(".dp-rel b").inner_text())
    close_sheet(page)
    page.wait_for_timeout(250)

    # ---------- 계략 (내 성 → 적 성) ----------
    open_mine(page)
    page.click('[data-act="cmd"][data-cmd="plot"]')
    page.wait_for_timeout(500)
    step("계략 모달 진입", sheet_open(page) and "계략" in sheet_title(page), sheet_title(page))
    step("계략 3종 + 성공률 표시", page.locator('[data-act="plot-kind"]').count() == 3
         and page.locator(".or-stats").first.inner_text().find("%") >= 0,
         page.locator('[data-act="plot-kind"]').count())
    shot(page, "s06-plot")

    # 정탐 — 성공할 때까지 (AP·장수가 남는 동안)
    scouted = False
    for attempt in range(5):
        if not ensure_ap(page, 1):
            break
        open_mine(page)
        if not page.locator('[data-act="cmd"][data-cmd="plot"]').count():
            break
        if page.locator('[data-act="cmd"][data-cmd="plot"]').first.is_disabled():
            end_turn(page)
            continue
        page.click('[data-act="cmd"][data-cmd="plot"]')
        page.wait_for_timeout(350)
        if not sheet_open(page):
            continue
        page.click('[data-act="plot-kind"][data-kind="scout"]')
        page.wait_for_timeout(250)
        rows = page.locator(".officer-row:not(.done)")
        if not rows.count():
            close_sheet(page)
            end_turn(page)
            continue
        rows.first.click()
        page.wait_for_timeout(200)
        go = page.locator('[data-act="plot-go"]')
        if not go.count() or go.first.is_disabled():
            close_sheet(page)
            end_turn(page)
            continue
        go.first.click()
        page.wait_for_timeout(700)
        # 다시 열어 정탐 정보가 보이는지 확인
        open_mine(page)
        page.click('[data-act="cmd"][data-cmd="plot"]')
        page.wait_for_timeout(400)
        if page.locator(".sc-box").count():
            scouted = True
            shot(page, "s07-scout")
            break
        close_sheet(page)
    step("정탐 — 적 성 속내 열람", scouted, "정탐 정보 표시" if scouted else "성공 실패(확률)")

    # 이간계 · 유언비어 — 실행 여부
    plot_done = []
    for kind in ("sow", "rumor"):
        for attempt in range(3):
            if not ensure_ap(page, 1):
                break
            open_mine(page)
            btn = page.locator('[data-act="cmd"][data-cmd="plot"]')
            if not btn.count() or btn.first.is_disabled():
                end_turn(page)
                continue
            btn.first.click()
            page.wait_for_timeout(320)
            if not sheet_open(page):
                continue
            page.click(f'[data-act="plot-kind"][data-kind="{kind}"]')
            page.wait_for_timeout(220)
            rows = page.locator(".officer-row:not(.done)")
            if not rows.count():
                close_sheet(page)
                end_turn(page)
                continue
            rows.first.click()
            page.wait_for_timeout(180)
            go = page.locator('[data-act="plot-go"]')
            if not go.count() or go.first.is_disabled():
                close_sheet(page)
                end_turn(page)
                continue
            before = page.locator("#res-ap").inner_text()
            go.first.click()
            page.wait_for_timeout(700)
            if page.locator("#res-ap").inner_text() != before:
                plot_done.append(kind)
                break
            end_turn(page)
    step("이간계·유언비어 실행(행동력·금 소모)", len(plot_done) == 2, plot_done)
    open_mine(page)
    # 군보에 계략 기록이 남는가
    page.click('[data-act="menu"]')
    page.wait_for_timeout(350)
    page.click('[data-act="open-reports"]')
    page.wait_for_timeout(450)
    log_text = page.locator("#sheet-body").inner_text()
    step("군보에 외교·계략 기록", ("사신" in log_text or "우호도" in log_text) and ("계략" in log_text or "정탐" in log_text or "유언비어" in log_text or "이간" in log_text),
         log_text[:120].replace("\n", " / "))
    shot(page, "s08-reports")
    close_sheet(page)
    page.wait_for_timeout(200)

    # ---------- 최종 점검 ----------
    page.wait_for_timeout(300)
    o = overflow(page)
    step("가로 넘침 없음(최종)", len(o["bad"]) == 0, o)
    shot(page, "s14-final")
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
print("\\n" + json.dumps({"ok": ok, "passed": sum(1 for s in steps if s["ok"]), "total": len(steps),
                        "steps": steps}, ensure_ascii=False, indent=1), flush=True)
sys.exit(0 if ok else 1)
