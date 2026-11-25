"""삼국 한 턴 — ⚔️ 영웅전(비동기 유저 군단) 라이브 검증 (390×844 · iPhone UA · 실제 터치)
사용:
  LD_LIBRARY_PATH=/workspace/.local/chromedeps/usr/lib/x86_64-linux-gnu \
  python3 tests/verify_legion_live.py http://127.0.0.1:4173/index.html local-legion

확인하는 것
  1) 정보 › 영웅전 진입 · 내 군단 등록(성 선택 · 이름 · 전력/장수 스냅샷)
  2) 원정 도전장 — 전력이 비슷한 상대 3~5개(닉네임 · 전적 · 병력)
  3) 상대 확인 → 기존 전장 진입(수동 지휘) → 전투 결과 창
  4) 12개월 뒤 유저 군단 습격 — '○○ 님의 군단이 국경을 넘었습니다!' → 수비 전장
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "legion"
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors = [], {}


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:400]})
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
      return { docW: document.documentElement.scrollWidth, winW: w, bad: bad.slice(0, 6) };
    }""")


def sheet_hidden(page):
    return page.locator("#sheet").evaluate("el => el.classList.contains('hidden')")


def close_sheet(page):
    if not sheet_hidden(page):
        try:
            page.click('#sheet .sheet-head [data-act="sheet-close"]', timeout=3000)
        except Exception:
            pass
        page.wait_for_timeout(220)


def in_battle(page):
    return page.locator("#scr-battle").is_visible()


RESULT_TITLES = ("원정 승전", "원정 패전", "습격을 막아냈다", "습격을 받았다")


def clear_battle_overlays(page):
    """전투 중 뜨는 시트(일기토 도발 · 돌발 이벤트)를 치운다. 결과 창은 건드리지 않는다."""
    for _ in range(8):
        if sheet_hidden(page):
            return
        title = page.locator("#sheet-title").inner_text()
        if title in RESULT_TITLES:
            return
        clicked = False
        for sel in ('[data-act="provoke-decline"]', '[data-act="battle-event-go"]'):
            loc = page.locator(sel)
            if loc.count():
                try:
                    loc.last.click(timeout=2500)
                    clicked = True
                except Exception:
                    page.wait_for_timeout(200)
                break
        if not clicked:
            head = page.locator('#sheet .sheet-head [data-act="sheet-close"]')
            if head.count():
                try:
                    head.first.click(timeout=2500)
                    clicked = True
                except Exception:
                    page.wait_for_timeout(200)
        page.wait_for_timeout(320)
        if not clicked:
            return




def autoplay_battle(page, max_steps=60):
    """전투를 직접 끝까지 치른다(수비전에서 성을 잃지 않게). 결과 창은 닫는다."""
    for _ in range(max_steps):
        if not in_battle(page) and sheet_hidden(page):
            return True
        clear_battle_overlays(page)
        if not sheet_hidden(page):
            if page.locator('[data-act="bt-close"]').count():
                try:
                    page.click('[data-act="bt-close"]', timeout=2500)
                except Exception:
                    pass
                page.wait_for_timeout(320)
                continue
            if page.locator('[data-act="bt-retreat"]').count():
                retreat_to_result(page)
                continue
            close_sheet(page)
            continue
        for act in ("bt-all", "bt-next"):
            btn = page.locator(f'[data-act="{act}"]')
            if btn.count() and not btn.is_disabled():
                try:
                    btn.first.click(timeout=2500)
                except Exception:
                    pass
                page.wait_for_timeout(420)
                break
        else:
            page.wait_for_timeout(500)
    return False


def retreat_to_result(page, timeout=25):
    """퇴각을 두 번 눌러 전투를 끝내고 결과 창 제목을 돌려준다(도발·돌발 시트는 치운다)."""
    end = time.time() + timeout
    while time.time() < end:
        clear_battle_overlays(page)
        title = page.locator("#sheet-title").inner_text() if not sheet_hidden(page) else ""
        if title in RESULT_TITLES:
            return title
        if not in_battle(page) and not title:
            return ""
        btn = page.locator('[data-act="bt-retreat"]')
        if btn.count() and not btn.is_disabled():
            try:
                btn.first.click(timeout=3000)
            except Exception:
                pass
            page.wait_for_timeout(360)
        else:
            page.wait_for_timeout(400)
    return ""


def finish_battle(page):
    """전투 화면이면 퇴각으로 끝내고 결과 창을 닫는다(턴 넘기기용)"""
    if not in_battle(page):
        return False
    retreat_to_result(page)
    if not sheet_hidden(page) and page.locator('[data-act="bt-close"]').count():
        try:
            page.click('[data-act="bt-close"]', timeout=3000)
        except Exception:
            pass
        page.wait_for_timeout(400)
    return True


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.setdefault("console", []).append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.setdefault("pageerror", []).append(str(e)))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(900)
    step("타이틀", page.locator(".title-mark h1").is_visible(), page.title())

    page.click('[data-act="new"]')
    page.wait_for_timeout(320)
    page.click('.sc-card[data-id="s208"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1000)
    step("본 게임 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())

    # ---------- 1) 정보 › 영웅전 ----------
    page.click('[data-act="info"]')
    page.wait_for_timeout(400)
    entry = page.locator('.lg-entry')
    step("정보 패널에 영웅전 진입점", entry.count() == 1 and entry.is_visible(), entry.inner_text()[:60] if entry.count() else "")
    shot(page, "01-info-entry")

    entry.click()
    page.wait_for_timeout(400)
    title = page.locator("#sheet-title").inner_text()
    tabs = page.locator(".lg-tabs .pick-chip").count()
    step("영웅전 시트(내 군단 · 원정 도전장)", title == "영웅전" and tabs == 2, f"{title} · 탭 {tabs}")
    shot(page, "02-legion-sheet")

    # ---------- 내 군단 등록 ----------
    page.click('[data-act="legion-register"]')
    page.wait_for_timeout(420)
    step("군단 등록 화면(성 선택 · 이름 · 장수 스냅샷)",
         page.locator('[data-act="legion-city"]').count() >= 1 and page.locator("#lg-nick").count() == 1
         and page.locator(".lg-genrow").count() >= 1,
         f"성 {page.locator('[data-act=\"legion-city\"]').count()} · 장수 {page.locator('.lg-genrow').count()}명")
    o = overflow(page)
    step("가로 넘침 없음(등록 화면)", len(o["bad"]) == 0, o)
    shot(page, "03-legion-register")

    snaphead = page.locator(".lg-snaphead").inner_text()
    page.fill("#lg-nick", "검단 군단")
    page.click('[data-act="legion-save"]')
    page.wait_for_timeout(2200)
    mine = page.locator(".lg-card.mine")
    step("군단 등록 완료(전력·전적 표시)", mine.count() == 1, mine.inner_text().replace("\n", " / ")[:120] if mine.count() else "")
    shot(page, "04-legion-registered")
    registered = "등록됨" in mine.inner_text() if mine.count() else False
    step("서버 등록 표시", registered, mine.inner_text()[:80] if mine.count() else "")

    # ---------- 2) 원정 도전장 ----------
    page.click('[data-act="legion-view"][data-view="expedition"]')
    page.wait_for_timeout(2200)
    foes = page.locator(".lg-card.foe")
    n = foes.count()
    text = foes.first.inner_text().replace("\n", " / ") if n else ""
    step("원정 도전장 3~5개", 3 <= n <= 5, f"{n}개 · {text[:120]}")
    step("상대 카드에 닉네임·전적·병력", ("승" in text and "패" in text and "병" in text), text[:120])
    o = overflow(page)
    step("가로 넘침 없음(도전장)", len(o["bad"]) == 0, o)
    shot(page, "05-legion-list")

    # ---------- 3) 상대 확인 → 전장 ----------
    foes.first.click()
    page.wait_for_timeout(380)
    vs = page.locator(".lg-vs").count()
    go = page.locator('[data-act="legion-go"]')
    step("대결 확인(전력 비교 · 보상 안내)", vs == 1 and go.count() == 1, page.locator("#sheet-title").inner_text())
    shot(page, "06-legion-vs")

    go.click()
    page.wait_for_timeout(1100)
    step("기존 전장 진입(수동 지휘)", in_battle(page), page.locator("#bt-round").inner_text() if in_battle(page) else "전장 아님")
    cards = page.locator(".bt-card").count()
    step("아군·적 부대 카드", cards >= 2, f"{cards}부대")
    step("전장 제목에 상대 땅 이름", "전투" in page.locator("#bt-name").inner_text(), page.locator("#bt-name").inner_text())
    shot(page, "07-legion-battle")

    # 한 라운드 진행해 실제로 지휘되는지
    page.click('[data-act="bt-all"]')
    page.wait_for_timeout(900)
    step("전군 돌격(지휘 동작)", True, page.locator("#bt-round").inner_text())
    shot(page, "08-legion-battle-round")

    stitle = retreat_to_result(page)
    page.wait_for_timeout(300)
    step("전투 결과 창(원정 승전/패전)", stitle in ("원정 승전", "원정 패전"),
         f"title={stitle!r} battle={in_battle(page)} body={page.locator('#sheet-body').inner_text()[:60]!r}")
    shot(page, "09-legion-result")
    close_sheet(page)

    # ---------- 4) 12개월 뒤 습격 ----------
    # 12개월(1년)이 지나면 달마다 확률로 유저 군단이 국경을 넘는다 — 올 때까지 달을 넘긴다
    page.wait_for_timeout(300)
    months = 0
    guard = 0
    invasion_seen = False
    while months < 30 and guard < 140 and not invasion_seen:
        guard += 1
        if in_battle(page):
            autoplay_battle(page)
            continue
        if not sheet_hidden(page):
            title = page.locator("#sheet-title").inner_text()
            if title == "국경에 적이 나타났습니다":
                invasion_seen = True
                break
            close_sheet(page)
            continue
        if page.locator("#scr-end").is_visible():
            print("  게임 종료 화면 — 달 넘기기 중단", flush=True)
            break
        if not page.locator("#scr-game").is_visible():
            print(f"  [loop {guard}] scr-game 숨김 (battle={in_battle(page)} sheet={not sheet_hidden(page)})", flush=True)
            page.wait_for_timeout(400)
            continue
        try:
            page.click('[data-act="endturn"]', timeout=5000)
        except Exception:
            page.wait_for_timeout(400)
            continue
        page.wait_for_timeout(2150)
        months += 1
        print(f"  [loop {guard}] {months}개월 · {page.locator('#hud-date').inner_text()}", flush=True)
        if not sheet_hidden(page):
            title = page.locator("#sheet-title").inner_text()
            if title == "국경에 적이 나타났습니다":
                invasion_seen = True
    # 창이 열려 있어 미적 둔 습격이면 정보 › 영웅전의 붉은 안내에서 연다
    if not invasion_seen and sheet_hidden(page) and page.locator("#scr-game").is_visible():
        page.click('[data-act="info"]')
        page.wait_for_timeout(320)
        page.click('.lg-entry')
        page.wait_for_timeout(420)
        if page.locator(".lg-alert").count():
            page.click(".lg-alert")
            page.wait_for_timeout(420)
            invasion_seen = not sheet_hidden(page) and page.locator("#sheet-title").inner_text() == "국경에 적이 나타났습니다"
        else:
            close_sheet(page)

    turn_text = page.locator("#hud-date").inner_text() if page.locator("#hud-date").count() else ""
    step("12개월 이후 달 넘기기", months >= 12 or invasion_seen, f"{months}개월 · {turn_text}")
    step("유저 군단 습격 안내", invasion_seen,
         page.locator(".lg-inv-title").inner_text() if page.locator(".lg-inv-title").count() else "아직 오지 않음")
    shot(page, "10-legion-invasion")

    defense = page.locator('[data-act="legion-defense"]')
    if defense.count():
        defense.click()
        page.wait_for_timeout(1100)
        step("수비 전장 진입", in_battle(page), page.locator("#bt-name").inner_text() if in_battle(page) else "전장 아님")
        shot(page, "11-legion-defense-battle")
        rtitle = retreat_to_result(page)
        page.wait_for_timeout(300)
        step("습격 결과 창", rtitle in ("습격을 막아냈다", "습격을 받았다"), rtitle)
        shot(page, "12-legion-defense-result")
        close_sheet(page)

    # 지도 화면으로 돌아와 레이아웃 확인
    page.wait_for_timeout(400)
    o = overflow(page)
    step("가로 넘침 없음(지도)", len(o["bad"]) == 0, o)
    step("오류 없음", not errors, json.dumps(errors)[:300])
    shot(page, "13-map-final")

    browser.close()

bad = [s for s in steps if not s["ok"]]
print("\nRESULT " + ("PASS" if not bad else f"FAIL {len(bad)}/{len(steps)}"))
for s in bad:
    print("  - " + s["step"] + " :: " + s["extra"])
sys.exit(0 if not bad else 1)
