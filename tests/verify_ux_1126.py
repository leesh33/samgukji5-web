#!/usr/bin/env python3
"""삼국 한 턴 — 2026-11-26 UX 점검 10건 수정 검증 (390×844).

사용:
  LD_LIBRARY_PATH=/workspace/.local/chromedeps/usr/lib/x86_64-linux-gnu \
  python3 tests/verify_ux_1126.py [URL] [TAG]

기본 URL 은 로컬 정적 서버(스크립트가 직접 띄운다). 라이브는 두 번째 인자에 주소를 준다.
"""
import functools
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

ROOT = "/workspace/samgukji5-web"
BASE = sys.argv[1] if len(sys.argv) > 1 else ""
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "downloads/ux-audit/fixed-samguk"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, shots, errors = [], {}, []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:200]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:160] if str(extra) else ""), flush=True)


def shot(page, name, full=False):
    path = os.path.join(OUT, f"samguk-{TAG}-{name}.png")
    page.screenshot(path=path, full_page=full)
    shots[name] = path
    print("SHOT " + os.path.basename(path), flush=True)
    return path


def dismiss_popup(page):
    """관직 승급·달의 소식·전장의 변수 같은 안내 시트를 닫아 지도 조작을 막지 않게 한다."""
    for _ in range(4):
        for sel in ('[data-act="promo-ok"]', '[data-act="event-go"]', '[data-act="sheet-close"]'):
            btn = page.locator(sel).first
            if btn.count() and btn.is_visible():
                try:
                    btn.click(timeout=1500)
                except Exception:
                    continue
                page.wait_for_timeout(350)
                break
        else:
            return


def finish_battle(page, rounds=48):
    """전투 중 뜨는 도발·변수 시트를 정리하며 전군 돌격/진행으로 결산까지 민다."""
    for _ in range(rounds):
        if page.locator('[data-act="bt-close"]').count():
            return True
        if page.locator('[data-act="provoke-decline"]').count():
            try:
                page.click('[data-act="provoke-decline"]', timeout=1500)
            except Exception:
                pass
            page.wait_for_timeout(400)
            continue
        if page.locator('[data-act="battle-event-go"]').count():
            try:
                page.locator('[data-act="battle-event-go"]').last.click(timeout=1500)
            except Exception:
                pass
            page.wait_for_timeout(400)
            continue
        try:
            if page.locator('[data-act="bt-all"]').is_visible() and not page.locator('[data-act="bt-all"]').is_disabled():
                page.click('[data-act="bt-all"]', timeout=1500)
            elif not page.locator('[data-act="bt-next"]').is_disabled():
                page.click('[data-act="bt-next"]', timeout=1500)
        except Exception:
            pass
        page.wait_for_timeout(900)
    return page.locator('[data-act="bt-close"]').count() > 0


def run(base):
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                            has_touch=True, user_agent=UA, locale="ko-KR", timezone_id="Asia/Seoul")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
        page.goto(base, wait_until="networkidle")
        page.wait_for_timeout(800)
        step("타이틀", page.locator(".title-mark h1").is_visible(), page.title())

        page.click('[data-act="new"]')
        page.wait_for_timeout(400)
        page.click('.sc-card[data-id="s194"]')
        page.wait_for_timeout(500)

        # ---------- S11. 군주 카드 중복 글자 ----------
        marks = page.evaluate("""() => {
          const cards = [...document.querySelectorAll('.lord-card')];
          return cards.slice(0, 6).map(c => [(c.querySelector('.lc-name')||{}).textContent,
                                              (c.querySelector('.lc-mark')||{}).textContent || null]);
        }""")
        dup = [m for m in marks if m[1] and m[1].replace("깃발 ", "") == (m[0] or "")[:1]]
        step("군주 카드에 '위 / 위' 중복 없음", not dup, f"{len(marks)}장 확인 {marks[:3]}")
        shot(page, "01-lords")

        page.click('.lord-card[data-id="jojo"]')
        page.wait_for_timeout(1300)
        step("본 게임 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())

        # ---------- S7. 턴 종료 라벨 ----------
        hint = page.locator("#turn-hint").inner_text()
        step("턴 종료 버튼이 '행동력 N/M'", hint.startswith("행동력"), hint)

        # ---------- S1·S4. 토스트가 시트 버튼을 막지 않는다 ----------
        page.wait_for_timeout(900)   # 첫 달 안내 토스트가 뜬 뒤
        page.click('[data-act="menu"]')
        page.wait_for_timeout(300)
        probe = page.evaluate("""() => {
          const b = document.querySelector('[data-act="save-slot"][data-slot="1"]');
          const r = b.getBoundingClientRect();
          const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
          const t = document.querySelector('#toast');
          const tr = t ? t.getBoundingClientRect() : null;
          const overlap = tr ? !(tr.bottom < r.top || tr.top > r.bottom) : false;
          return { hit: el ? (el.id || el.className) : null, toastVisible: t ? !t.classList.contains('hidden') : false,
                   overlap, toastTop: tr ? Math.round(tr.top) : null, btnTop: Math.round(r.top),
                   pe: t ? getComputedStyle(t).pointerEvents : null };
        }""")
        step("토스트가 떠 있어도 '슬롯 1에 저장' 탭이 버튼에 닿는다",
             "save-slot" in (probe["hit"] or "") or "btn" in (probe["hit"] or ""), probe)
        step("토스트는 시트 버튼을 덮지 않는다(화면 위쪽으로 비켜남)", not probe["overlap"], probe)
        shot(page, "02-menu-toast")
        page.click('[data-act="save-slot"][data-slot="1"]')
        page.wait_for_timeout(400)
        saved = page.evaluate("() => localStorage.getItem('samguk5.slot1') ? 'saved' : 'no'")
        step("메뉴에서 슬롯 1 저장이 실제로 된다", saved == "saved", saved)
        shot(page, "03-menu-saved-toast")
        page.locator('#sheet .mini-btn[data-act="sheet-close"]').first.click()
        page.wait_for_timeout(300)

        # ---------- S7. 남은 행동력 확인 ----------
        dismiss_popup(page)
        y0 = page.locator("#hud-date").inner_text()
        page.click('[data-act="endturn"]')
        page.wait_for_timeout(350)
        confirm = page.locator("#turn-hint").inner_text()
        cls = page.locator("#btn-endturn").get_attribute("class") or ""
        step("행동력이 남았으면 한 번 더 묻는다", "정말" in confirm and "confirm" in cls, f"{confirm} / {cls}")
        step("첫 탭에서는 달이 넘어가지 않는다", page.locator("#hud-date").inner_text() == y0, page.locator("#hud-date").inner_text())
        shot(page, "04-turn-confirm")
        page.click('[data-act="endturn"]')
        page.wait_for_timeout(900)
        y1 = page.locator("#hud-date").inner_text()
        step("두 번째 탭에 턴이 넘어간다", y1 != y0, f"{y0} -> {y1}")
        step("턴 종료 안내 토스트가 단어 중간에서 끊기지 않는다",
             "새 달이" in page.locator("#toast").inner_text() or "밝았습니다" in page.locator("#toast").inner_text(),
             page.locator("#toast").inner_text())
        shot(page, "05-turn-end-toast")

        # ---------- S5. 도시 장수 칩 잘림 ----------
        dismiss_popup(page)
        gens = page.evaluate("""() => {
          const row = document.querySelector('.cp-gens');
          if (!row) return null;
          const chips = [...row.querySelectorAll('.gen-chip')];
          const rowR = row.getBoundingClientRect();
          const cut = chips.filter(c => c.getBoundingClientRect().right > rowR.right + 0.5).length;
          return { chips: chips.length, cut, wrap: getComputedStyle(row).flexWrap,
                   rows: new Set(chips.map(c => Math.round(c.getBoundingClientRect().top))).size,
                   sw: row.scrollWidth, cw: row.clientWidth };
        }""")
        step("장수 칩이 잘리지 않고 두 줄로 모두 보인다",
             gens and gens["cut"] == 0 and gens["wrap"] == "wrap", gens)
        shot(page, "06-citypanel-gens")

        # ---------- S3. 출진 예상 전력 ----------
        page.click('[data-act="cmd-group"][data-group="army"]')
        page.wait_for_timeout(250)
        page.click('[data-act="march"]')
        page.wait_for_timeout(500)
        body = page.locator("#sheet-body").inner_text()
        step("예상 전력에 전력비와 기준(×1.15)이 함께 보인다", "전력비 ×" in body and "공성 유리 기준 ×1.15" in body,
             body.split("\n")[2] if len(body.split("\n")) > 2 else body[:120])
        step("필요 병력이 성 병력보다 크면 '이 성 병력으로는 부족'",
             ("이 성 병력" in body and "부족합니다" in body) or "권장 병력" not in body,
             [l for l in body.split("\n") if "권장" in l][:1])
        shot(page, "07-march-odds")

        # ---------- S2·S5·S9. 전투 ----------
        page.click('[data-act="march-go"]')
        page.wait_for_timeout(1500)
        st = page.evaluate("""() => {
          const cmds = [...document.querySelectorAll('#bt-cmds .btn')].map(b => ({ t: b.textContent.trim(), d: b.disabled }));
          const cards = [...document.querySelectorAll('[data-act="bt-select"]')];
          const row = document.querySelector('.bt-card-row');
          const rowR = row.getBoundingClientRect();
          const cut = cards.filter(c => c.getBoundingClientRect().right > rowR.right + 0.5).length;
          const log = document.querySelector('#bt-log').getBoundingClientRect();
          const guide = document.querySelector('#bt-guide');
          return { cmds, cards: cards.length, cut, logH: Math.round(log.height),
                   guideCollapsed: guide.classList.contains('collapsed'),
                   guideH: Math.round(guide.getBoundingClientRect().height),
                   sel: !!document.querySelector('[data-act="bt-select"].on'),
                   info: (document.querySelector('#bt-info')||{}).innerText.slice(0,60),
                   hint: (document.querySelector('.bt-hint')||{}).innerText || null };
        }""")
        enabled = [c["t"] for c in st["cmds"] if not c["d"]]
        step("전투 진입 시 내 첫 부대가 자동 선택된다", st["sel"], st["info"].replace("\n", " "))
        step("진입 직후 이동·계략·대기가 바로 활성", "이동" in enabled and "계략" in enabled and "대기" in enabled, enabled)
        step("부대 카드 5장이 잘리지 않는다", st["cut"] == 0, f"cards={st['cards']} cut={st['cut']}")
        step("진형 상성표는 기본으로 접혀 있다", st["guideCollapsed"], f"높이 {st['guideH']}px")
        step("빈 로그 상자가 화면을 다 먹지 않는다", st["logH"] <= 110, f"{st['logH']}px")
        shot(page, "08-battle-entry")

        # 상성표 펼치기
        page.click('[data-act="bt-guide-toggle"]')
        page.wait_for_timeout(300)
        open_h = page.evaluate("() => Math.round(document.querySelector('#bt-guide').getBoundingClientRect().height)")
        step("ⓘ 로 진형 상성표를 펼칠 수 있다", open_h > st["guideH"] + 40, f"{st['guideH']} -> {open_h}")
        shot(page, "09-battle-guide-open")
        page.click('[data-act="bt-guide-toggle"]')
        page.wait_for_timeout(250)

        # 대기 → 행동 완료 안내
        page.click('[data-act="bt-wait"]')
        page.wait_for_timeout(300)
        hint = page.evaluate("() => (document.querySelector('.bt-hint')||{}).innerText || null")
        step("행동을 마친 부대를 고르면 다른 부대를 고르라고 알려 준다", hint and "행동을 마쳤습니다" in hint, hint)
        shot(page, "10-battle-acted-hint")
        page.locator('[data-act="bt-select"]').nth(1).click()
        page.wait_for_timeout(250)

        # 전투를 진행해 결산까지 가거나, 길어지면 퇴각으로 빠져나온다(회귀 확인)
        fought = finish_battle(page, rounds=22)
        if fought:
            shot(page, "11-battle-result")
            page.click('[data-act="bt-close"]')
            page.wait_for_timeout(1000)
        else:
            try:
                page.click('[data-act="bt-retreat"]', timeout=3000)
                page.wait_for_timeout(500)
                page.click('[data-act="bt-retreat"]', timeout=3000)
                page.wait_for_timeout(1200)
                if page.locator('[data-act="bt-close"]').count():
                    page.click('[data-act="bt-close"]', timeout=3000)
                    page.wait_for_timeout(1200)
            except Exception as exc:
                print("retreat err", str(exc)[:100], flush=True)
        back = False
        for _ in range(10):
            back = page.evaluate("() => !document.querySelector('#scr-game').classList.contains('hidden')")
            if back:
                break
            page.wait_for_timeout(400)
        step("전투가 결산 또는 퇴각으로 끝나 지도로 돌아온다", back, "결산" if fought else "퇴각")
        dismiss_popup(page)

        # ---------- S6. 계략 오타 ----------
        page.click('[data-act="jump-region"][data-region="__mine"]')
        page.wait_for_timeout(700)
        dismiss_popup(page)
        plot_ok = False
        plot_line = ""
        try:
            page.locator('[data-act="cmd"][data-cmd="plot"]').first.click(timeout=4000)
            page.wait_for_timeout(700)
            txt = page.locator("#sheet-body").inner_text()
            plot_line = [l for l in txt.split("\n") if "행동력 1" in l][:1]
            plot_ok = "행동력 1을 씁니다" in txt
            shot(page, "12-plot-sheet")
        except Exception as exc:
            plot_line = str(exc)[:80]
        step("계략 시트 문구가 '행동력 1을 씁니다'", plot_ok, plot_line)
        if page.locator("#sheet").is_visible():
            page.locator('#sheet .mini-btn[data-act="sheet-close"]').first.click()
            page.wait_for_timeout(250)

        # ---------- S10. 외교 ----------
        page.click('[data-act="menu"]')
        page.wait_for_timeout(500)
        page.evaluate("() => document.querySelector('[data-act=\"diplomacy\"]').click()")
        page.wait_for_timeout(700)
        d0 = page.evaluate("""() => ({ btns: document.querySelectorAll('.dp-btns').length,
                                       rows: document.querySelectorAll('.dp-row').length,
                                       height: document.querySelector('#sheet-body').scrollHeight })""")
        step("외교 첫 화면에 액션 40개가 쏟아지지 않는다", d0["btns"] == 0 and d0["rows"] > 0, d0)
        shot(page, "13-diplomacy")
        page.locator('[data-act="diplo-open"]').first.click()
        page.wait_for_timeout(350)
        d1 = page.evaluate("""() => ({ btns: document.querySelectorAll('.dp-btns').length,
                                       labels: [...document.querySelectorAll('.dp-btns .dp-btn')].map(b => b.innerText.replace(/\\n/g, ' ')) })""")
        step("세력을 누르면 그 세력 액션만 열린다", d1["btns"] == 1, d1["labels"])
        shot(page, "14-diplomacy-shelf")
        page.locator('#sheet .mini-btn[data-act="sheet-close"]').first.click()
        page.wait_for_timeout(250)

        # ---------- 콘솔 오류 · 가로 넘침 ----------
        ov = page.evaluate("""() => ({ docW: document.documentElement.scrollWidth, winW: innerWidth })""")
        step("390 화면에 가로 스크롤 없음", ov["docW"] <= ov["winW"] + 1, ov)
        step("콘솔 페이지 오류 없음", not errors, errors[:3])
        b.close()


if not BASE:
    h = functools.partial(SimpleHTTPRequestHandler, directory=ROOT)
    srv = ThreadingHTTPServer(("127.0.0.1", 4175), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    BASE = "http://127.0.0.1:4175/index.html"

run(BASE)
fails = [s for s in steps if not s["ok"]]
print(f"\n{len(steps) - len(fails)}/{len(steps)} 통과 · 스크린샷 {len(shots)}장 -> {OUT}")
if fails:
    for f in fails:
        print("  FAIL", f["step"], "->", f["extra"])
sys.exit(1 if fails else 0)
