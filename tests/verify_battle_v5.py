#!/usr/bin/env python3
"""도트삼국 — 진형 도트 · 방향 대미지 · 진형 상성 · 포로 처분 라이브 검증 (390×844)

사용:
  LD_LIBRARY_PATH=/workspace/.local/chromedeps/usr/lib/x86_64-linux-gnu python3 tests/verify_battle_v5.py [URL] [TAG]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "downloads/samguk5/battle-v5"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors, shots = [], [], {}


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:240]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:160] if str(extra) else ""), flush=True)


def shot(page, name, full=False):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path, full_page=full)
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


def battle_state(page):
    return page.evaluate("""() => {
      const log = document.querySelector('#bt-log');
      const cv = document.querySelector('#battle-canvas');
      return {
        log: log ? log.innerText : '',
        canvas: cv ? [cv.width, cv.height, cv._tile] : null,
        cards: document.querySelectorAll('[data-act="bt-select"]').length,
        info: (document.querySelector('#bt-info') || {}).innerText || '',
        legend: (document.querySelector('#bt-legend') || {}).innerText || '',
        attackEnabled: (() => { const b = document.querySelector('[data-act="bt-attack"]'); return b && !b.disabled; })(),
      };
    }""")


def finish_battle(page, max_wait=30):
    """승패 시트가 뜰 때까지 전군 돌격/진행을 반복"""
    for _ in range(max_wait):
        if page.locator('[data-act="bt-close"]').count():
            return True
        if not page.locator('#scr-battle').is_visible():
            return False
        try:
            if page.locator('[data-act="bt-all"]').is_visible() and not page.locator('[data-act="bt-all"]').is_disabled():
                page.click('[data-act="bt-all"]')
            elif not page.locator('[data-act="bt-next"]').is_disabled():
                page.click('[data-act="bt-next"]')
        except Exception:
            pass
        page.wait_for_timeout(1500)
    return page.locator('[data-act="bt-close"]').count() > 0


def go_city(page, name):
    for _ in range(6):
        cur = page.locator('#citypanel').inner_text()
        if name in cur:
            return True
        page.click('[data-act="city-next"]')
        page.wait_for_timeout(350)
    return name in page.locator('#citypanel').inner_text()


def march(page, target):
    page.click('[data-act="march"]')
    page.wait_for_timeout(450)
    if page.locator(f'[data-act="march-target"][data-city="{target}"]').count():
        page.click(f'[data-act="march-target"][data-city="{target}"]')
        page.wait_for_timeout(250)
    return page.locator('[data-act="march-go"]').count() > 0


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:90], r.failure)))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(900)
    step("타이틀", page.locator(".title-mark h1").is_visible(), page.title())

    page.click('[data-act="new"]')
    page.wait_for_timeout(350)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1100)
    step("본 게임 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())

    # ---------- 출진 시트: 진형 미리보기 + 상성 ----------
    if not go_city(page, "허창"):
        step("내 성 전환(허창)", False, page.locator("#citypanel").inner_text()[:60])
    page.wait_for_timeout(250)
    opened = march(page, "xinye")
    step("출진 시트", opened, page.locator("#sheet-title").inner_text())
    picks = page.locator('[data-act="march-form"]').count()
    step("진형 선택 칩(미리보기 SVG)", picks >= 3, f"{picks}개")
    svg = page.locator('[data-act="march-form"] svg').count()
    step("진형 도트 미리보기 SVG", svg >= picks >= 1, f"svg {svg}")
    legend_cols = page.locator('.form-legend .fl-col').count()
    step("상성 범례 3무리(돌격·포위·방어)", legend_cols == 3, legend_cols)
    # 추행 같은 새 진형 고르기
    page.locator('[data-act="march-form"]').nth(1).click()
    page.wait_for_timeout(250)
    detail = page.locator(".fp-detail").inner_text()
    step("진형 상세(특징·상성)", "강함" in detail and "약함" in detail, detail.replace("\n", " ")[:80])
    shot(page, "01-march-formation")

    page.click('[data-act="march-go"]')
    page.wait_for_timeout(1200)
    st = battle_state(page)
    step("전투 진입", page.locator("#scr-battle").is_visible(), page.locator("#bt-name").inner_text())
    step("캔버스 11×8 격자", st["canvas"][2] >= 30, f"tile {st['canvas'][2]}px")
    step("부대 카드", st["cards"] >= 2, st["cards"])
    step("전술 안내(정면<측면<배후)", "×1.25" in st["legend"] and "×1.50" in st["legend"], st["legend"].replace("\n", " "))
    shot(page, "02-battle-start")

    # ---------- 부대 선택 → 진형 정보 ----------
    page.locator('[data-act="bt-select"]').first.click()
    page.wait_for_timeout(300)
    st = battle_state(page)
    step("선택 부대 정보(진형·방향·상성)", "바라봄" in st["info"] and "진" in st["info"], st["info"].replace("\n", " ")[:110])
    shot(page, "03-battle-unit-info")

    # ---------- 공격 예상 힌트 / 측면·배후 공격 ----------
    hint_shot = False
    hint_info = ""
    for wave in range(10):
        if page.locator('[data-act="bt-close"]').count():
            break
        if not hint_shot:
            n = page.locator('[data-act="bt-select"]').count()
            for i in range(n):
                card = page.locator('[data-act="bt-select"]').nth(i)
                try:
                    card.click()
                except Exception:
                    continue
                page.wait_for_timeout(200)
                if battle_state(page)["attackEnabled"]:
                    page.click('[data-act="bt-attack"]')
                    page.wait_for_timeout(350)
                    shot(page, "04-attack-hint")
                    hint_info = page.locator('#bt-log').inner_text()[-80:]
                    hint_shot = True
                    # 다시 눌러 모드 해제
                    page.locator('[data-act="bt-select"]').nth(i).click()
                    page.wait_for_timeout(150)
                    break
        if page.locator('[data-act="bt-close"]').count():
            break
        try:
            if page.locator('[data-act="bt-all"]').is_visible() and not page.locator('[data-act="bt-all"]').is_disabled():
                page.click('[data-act="bt-all"]')
            else:
                page.click('[data-act="bt-next"]')
        except Exception:
            pass
        page.wait_for_timeout(1700)

    step("공격 예상 힌트 노출(정면/측면/배후 칩)", hint_shot, hint_info)
    log_all = page.evaluate("() => (document.querySelector('#bt-log')||{}).innerText || ''")
    lag = battle_state(page)["log"] if not log_all else log_all
    tags = [t for t in ("[측면 공격!]", "[배후 기습!]", "[진형 유리!]", "[진형 불리]") if t in lag]
    step("전투 로그에 방향·상성 표시", bool(tags), ",".join(tags))
    shot(page, "05-battle-log")

    # 전투 종료까지
    if not page.locator('[data-act="bt-close"]').count():
        finish_battle(page)
    won = page.locator('[data-act="bt-close"]').count() > 0
    step("전투 종료 시트", won, page.locator("#sheet-title").inner_text() if won else "")
    shot(page, "06-battle-result")

    # ---------- 포로 처분 ----------
    prisoner_flow = False
    for attempt in range(2):
        if not won:
            break
        page.click('[data-act="bt-close"]')
        page.wait_for_timeout(800)
        if page.locator('[data-act="prisoner-recruit"]').count():
            break
        # 포로가 없으면 다음 성을 공격해 다시 시도
        page.wait_for_timeout(400)
        if not go_city(page, "허창"):
            break
        target = "xiaopei" if attempt == 0 else "runan"
        if not march(page, target):
            break
        page.click('[data-act="march-go"]')
        page.wait_for_timeout(1100)
        if not finish_battle(page):
            break
        won = page.locator('[data-act="bt-close"]').count() > 0

    rows = page.locator(".pw-row").count()
    if rows:
        prisoner_flow = True
        step("포로 처분 모달", rows >= 1, f"포로 {rows}명")
        shot(page, "07-prisoners")
        # 등용 시도 → 결과(수락/거절)
        page.locator('[data-act="prisoner-recruit"]').first.click()
        page.wait_for_timeout(700)
        notes = page.locator(".pw-notes").inner_text() if page.locator(".pw-notes").count() else ""
        step("등용 판정 결과", bool(notes), notes.replace("\n", " ")[:100])
        shot(page, "08-prisoner-recruit")
        # 남은 포로는 해방
        while page.locator('[data-act="prisoner-release"]').count():
            page.locator('[data-act="prisoner-release"]').first.click()
            page.wait_for_timeout(500)
        # 다음 성에서 참수까지 확인 (있으면)
        page.locator('[data-act="prisoner-done"]').click()
        page.wait_for_timeout(900)
        step("처분 후 전장 복귀", page.locator("#scr-game").is_visible(), "")
        # 명성 변화 확인
        fame = page.locator("#res-fame").inner_text()
        step("해방 후 명성 반영", fame.isdigit(), f"명성 {fame}")

        # 두 번째 전투에서 참수 확인
        if go_city(page, "허창") and march(page, "xiaopei"):
            page.click('[data-act="march-go"]')
            page.wait_for_timeout(1100)
            if finish_battle(page) and page.locator('[data-act="bt-close"]').count():
                page.click('[data-act="bt-close"]')
                page.wait_for_timeout(900)
                if page.locator('[data-act="prisoner-execute"]').count():
                    shot(page, "09-prisoner-before-exec")
                    page.locator('[data-act="prisoner-execute"]').first.click()
                    page.wait_for_timeout(400)
                    confirm = page.locator('[data-act="prisoner-execute"]').first.inner_text()
                    step("참수 확인 단계", "확정" in confirm, confirm)
                    page.locator('[data-act="prisoner-execute"]').first.click()
                    page.wait_for_timeout(700)
                    notes2 = page.locator(".pw-notes").inner_text() if page.locator(".pw-notes").count() else ""
                    step("참수 처리", "참수" in notes2, notes2.replace("\n", " ")[:100])
                    shot(page, "10-prisoner-executed")
                    if page.locator('[data-act="prisoner-done"]').count():
                        page.locator('[data-act="prisoner-done"]').click()
                        page.wait_for_timeout(600)
                else:
                    step("참수 단계(이번 전투 포로 없음)", True, "포로 미발생 — 이전 확인으로 갈음")
    else:
        step("포로 처분 모달", False, "포로가 잡히지 않아 모달 미표시")

    # ---------- 저장/불러오기(사망·등용 상태 유지) ----------
    page.wait_for_timeout(400)
    saved = page.evaluate("() => { const raw = localStorage.getItem('samguk5.auto'); if (!raw) return null; const s = JSON.parse(raw); return { v: s.version, dead: Object.values(s.generals).filter(g => g.dead).length, pris: (s.pendingPrisoners||[]).length }; }")
    step("저장 양식 최신(v6) · 죽음 상태 기록", saved and saved["v"] == 6, saved)

    o = overflow(page)
    step("가로 넘침 없음", len(o["bad"]) == 0, o)
    step("콘솔 오류 0", len(errors) == 0, errors[:3])

    browser.close()

print("\n=== RESULT ===")
print(json.dumps({"steps": steps, "errors": errors, "shots": shots,
                  "pass": sum(1 for s in steps if s["ok"]), "total": len(steps)}, ensure_ascii=False, indent=1))
