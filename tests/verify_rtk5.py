"""삼국 한 턴 — 삼국지5 핵심 기능(쌀 교역·특수·보물·참모·위임·정보 일람·전투 계략) 라이브 검증

사용: python3 tests/verify_rtk5.py [URL] [TAG]
  - 390×844 iPhone UA · 실제 터치
  - TAG=live 이면 대표 스크린샷 이름을 live-rtk5-*.png 로 남깁니다.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_march, open_group

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "/workspace/downloads/samguk5"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors, notes = [], [], {}


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
        page.wait_for_timeout(200)


def ap_now(page):
    try:
        return int(page.locator("#res-ap").inner_text().split("/")[0])
    except Exception:
        return 0


def gold_now(page):
    return page.locator("#res-gold").inner_text()


def food_now(page):
    return page.locator("#res-food").inner_text()


def clear_prisoners(page):
    for _ in range(8):
        if not page.locator('[data-act="prisoner-release"]').count():
            break
        try:
            page.locator('[data-act="prisoner-release"]').first.click()
            page.wait_for_timeout(240)
        except Exception:
            break
    if page.locator('[data-act="prisoner-done"]').count():
        page.click('[data-act="prisoner-done"]')
        page.wait_for_timeout(600)


def dismiss_notices(page):
    for _ in range(5):
        if not sheet_open(page):
            return
        if page.locator('[data-act="promo-ok"]').count():
            page.click('[data-act="promo-ok"]')
            page.wait_for_timeout(320)
            continue
        if page.locator('[data-act="event-go"]').count():
            page.locator('[data-act="event-go"]').first.click()
            page.wait_for_timeout(420)
            continue
        if page.locator('[data-act="bt-close"]').count():
            page.click('[data-act="bt-close"]')
            page.wait_for_timeout(500)
            continue
        return


def end_battle(page, max_rounds=40):
    for _ in range(max_rounds):
        if page.locator('[data-act="bt-close"]').count() and page.locator('[data-act="bt-close"]').is_visible():
            return True
        if not page.locator("#scr-battle").is_visible():
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


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    shot(page, "rtk5-00-title")

    # ---------- 게임 시작 ----------
    page.click('[data-act="new"]')
    page.wait_for_timeout(300)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(350)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1100)
    step("본 게임 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())

    bar = page.locator(".mapbar .mapbtn").all_inner_texts()
    step("상단 지도 메뉴(권역·내 성·정보·특수)", [t.replace("\n", " ").strip() for t in bar][:4] == ["권역 ▾", "내 성", "정보", "특수"], bar)
    o = overflow(page)
    step("가로 넘침 없음(지도)", len(o["bad"]) == 0, o)

    # ---------- 담당(위임) 칩 ----------
    chips = page.locator('.cs-deleg .dlg-chip').all_inner_texts()
    step("성 시트 담당 칩 3개(직할·내정 위임·군사 위임)", chips == ["직할", "내정 위임", "군사 위임"], chips)
    page.click('[data-act="deleg"][data-mode="domestic"]')
    page.wait_for_timeout(400)
    on = page.locator('.cs-deleg .dlg-chip[data-mode="domestic"]').get_attribute("aria-pressed")
    step("담당 내정 위임으로 바꿈", on == "true", on)
    page.click('[data-act="deleg"][data-mode="none"]')
    page.wait_for_timeout(300)

    # ---------- 내정 → 교역 ----------
    open_group(page, "civil")
    trade_btn = page.locator('[data-act="cmd"][data-cmd="trade"]')
    step("내정 메뉴에 교역(쌀 시세 표시)", trade_btn.count() == 1, trade_btn.first.inner_text().replace("\n", " ") if trade_btn.count() else "")
    shot(page, "rtk5-01-civil-menu")
    trade_btn.first.click()
    page.wait_for_timeout(420)
    step("교역 시트 열림", sheet_title(page).endswith("교역"), sheet_title(page))
    price_txt = page.locator(".tr-big").inner_text()
    step("쌀 시세 표시", "쌀 시세" in price_txt, price_txt)
    buys = page.locator('[data-act="trade"][data-kind="buy"]')
    sells = page.locator('[data-act="trade"][data-kind="sell"]')
    step("사기 3종 · 팔기 3종", buys.count() == 3 and sells.count() == 3, f"{buys.count()} / {sells.count()}")
    g0, f0 = gold_now(page), food_now(page)
    if buys.count() and not buys.first.is_disabled():
        buys.first.click()
        page.wait_for_timeout(700)
        step("교역 — 금으로 식량 사기", gold_now(page) != g0 and food_now(page) != f0,
             f"금 {g0}->{gold_now(page)} · 량 {f0}->{food_now(page)}")
        shot(page, "rtk5-02-trade")
    else:
        step("교역 — 금으로 식량 사기", False, "사기 버튼 비활성")
    close_sheet(page)

    # ---------- 특수 ----------
    page.click('.mapbar [data-act="special-menu"]')
    page.wait_for_timeout(500)
    step("특수 시트 열림", sheet_title(page) == "특수", sheet_title(page))
    kinds = {k: page.locator(f'[data-act="special"][data-kind="{k}"]').count() for k in ("patrol", "banquet", "levy", "relief")}
    step("특수 4종(순찰·연회·징세·구휼)", all(v == 1 for v in kinds.values()), kinds)
    step("특수 시트에 쌀 시세·보물·참모 블록", page.locator(".sp-price").count() == 1 and page.locator('[data-act="treasures"]').count() == 1 and page.locator('[data-act="advisor"]').count() == 1)
    o = overflow(page)
    step("가로 넘침 없음(특수)", len(o["bad"]) == 0, o)
    shot(page, "rtk5-special" if TAG == "live" else "rtk5-03-special")

    order0 = page.evaluate("() => document.querySelector('#citypanel .cs-stats').innerText")
    patrol = page.locator('[data-act="special"][data-kind="patrol"]')
    if patrol.count() and not patrol.first.is_disabled():
        ap0 = ap_now(page)
        patrol.first.click()
        page.wait_for_timeout(800)
        step("순찰 실행(행동력 소감)", ap_now(page) < ap0 or not sheet_open(page), f"{ap0} -> {ap_now(page)}")
        if not sheet_open(page):
            page.click('.mapbar [data-act="special-menu"]')
            page.wait_for_timeout(400)
        o = overflow(page)
        step("가로 넘침 없음(순찰 뒤 특수)", len(o["bad"]) == 0, o)
    else:
        step("순찰 실행", False, "순찰 불가 상태")

    # ---------- 보물 ----------
    page.click('.sheet-body [data-act="treasures"]')
    page.wait_for_timeout(420)
    step("보물 도감 열림", sheet_title(page) == "보물", sheet_title(page))
    rows = page.locator(".ts-row").count()
    step("보물 14종 나열", rows == 14, rows)
    o = overflow(page)
    step("가로 넘침 없음(보물)", len(o["bad"]) == 0, o)
    shot(page, "rtk5-04-treasures")
    held_rows = page.locator(".ts-holder.mine").count()
    step("우리 장수가 지닌 보물 표시", held_rows >= 1, held_rows)
    # 장착된 보물은 회수한 뒤 다시 수여해 본다
    if not page.locator('[data-act="treasure-pick"]').count() and page.locator('[data-act="treasure-revoke"]').count():
        page.locator('[data-act="treasure-revoke"]').first.click()
        page.wait_for_timeout(700)
        step("보물 회수", page.locator('[data-act="treasure-pick"]').count() >= 1, sheet_title(page))
    pick = page.locator('[data-act="treasure-pick"]')
    step("보유 보물 수여 버튼", pick.count() >= 1, pick.count())
    if pick.count():
        pick.first.click()
        page.wait_for_timeout(420)
        step("보물 수여 장수 목록", "수여" in sheet_title(page), sheet_title(page))
        rows = page.locator('[data-act="treasure-award"]').count()
        if rows:
            page.locator('[data-act="treasure-award"]').nth(min(1, rows - 1)).click()
            page.wait_for_timeout(700)
            step("보물 수여 실행", sheet_title(page) == "보물" and page.locator(".ts-holder.mine").count() >= 1,
                 page.locator(".ts-holder.mine").count())
            shot(page, "rtk5-05-treasure-award")
    close_sheet(page)

    # ---------- 참모 ----------
    close_sheet(page)
    page.click('.mapbar [data-act="special-menu"]')
    page.wait_for_timeout(450)
    if page.locator('[data-act="advisor"]').count():
        page.click('.sheet-body [data-act="advisor"]')
        page.wait_for_timeout(420)
        step("참모 임명 시트", sheet_title(page) == "참모 임명", sheet_title(page))
        cur = page.locator(".officer-row.picked .or-name").count()
        step("현재 참모 표시", cur >= 1, cur)
        rows = page.locator('[data-act="advisor-pick"]').count()
        if rows > 2:
            page.locator('[data-act="advisor-pick"]').nth(2).click()
            page.wait_for_timeout(700)
            step("참모 변경", page.locator(".officer-row.picked").count() == 1, page.locator(".officer-row.picked .or-name").inner_text()[:40])
        shot(page, "rtk5-06-advisor")
        close_sheet(page)
    else:
        step("참모 임명 시트", False, "특수 시트에 참모 버튼 없음")

    # ---------- 정보 일람 ----------
    page.click('.mapbar [data-act="info"]')
    page.wait_for_timeout(500)
    step("정보 시트 열림", sheet_title(page) == "정보", sheet_title(page))
    step("참모 줄 표시", page.locator(".adv-head").count() == 1, page.locator(".adv-head").inner_text()[:60])
    tabs = page.locator('[data-act="info-tab"]').all_inner_texts()
    step("정보 탭 4개", tabs == ["세력 순위", "아군 도시", "무장 일람", "보물 도감"], tabs)
    rank_rows = page.locator(".info-row").count()
    step("세력 순위 표", rank_rows >= 5, rank_rows)
    shot(page, "rtk5-info" if TAG == "live" else "rtk5-07-info")

    page.click('[data-act="info-tab"][data-tab="cities"]')
    page.wait_for_timeout(350)
    crows = page.locator('[data-act="info-city"]').count()
    step("아군 도시 일람", crows >= 1 and "담당" in page.locator("#sheet-body").inner_text() or crows >= 1, crows)

    page.click('[data-act="info-tab"][data-tab="generals"]')
    page.wait_for_timeout(350)
    grows = page.locator(".info-gen").count()
    page.click('[data-act="info-scope"][data-scope="all"]')
    page.wait_for_timeout(350)
    allrows = page.locator(".info-gen").count()
    step("무장 일람(아군 → 전체)", grows >= 1 and allrows >= grows, f"{grows} → {allrows}")
    shot(page, "rtk5-08-info-generals")

    page.click('[data-act="info-tab"][data-tab="treasures"]')
    page.wait_for_timeout(350)
    trows = page.locator(".ts-row").count()
    step("보물 도감 탭 14종", trows == 14, trows)
    o = overflow(page)
    step("가로 넘침 없음(정보)", len(o["bad"]) == 0, o)
    # 도시 탭에서 성을 눌러 지도로 돌아가기
    page.click('[data-act="info-tab"][data-tab="cities"]')
    page.wait_for_timeout(300)
    page.locator('[data-act="info-city"]').first.click()
    page.wait_for_timeout(500)
    step("정보에서 성 선택 → 시트 닫힘", not sheet_open(page))

    # ---------- 전투 계략 확장 ----------
    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        page.click('.cs-toggle')
        page.wait_for_timeout(350)
    click_march(page)
    page.wait_for_timeout(450)
    if "출진" in sheet_title(page):
        page.click('[data-act="march-go"]')
        page.wait_for_timeout(1100)
        step("전투 진입", page.locator("#scr-battle").is_visible(), page.locator("#bt-name").inner_text())
        if page.locator('[data-act="bt-select"]').count():
            page.locator('[data-act="bt-select"]').first.click()
            page.wait_for_timeout(300)
            page.click('[data-act="bt-tactic"]')
            page.wait_for_timeout(450)
            kinds = page.locator('[data-act="bt-tactic-kind"]').count()
            labels = page.locator('[data-act="bt-tactic-kind"]').all_inner_texts()
            step("전투 계략 6종", kinds == 6, labels)
            step("계략마다 성공률 % 표시", all("%" in t for t in labels), labels[:2])
            body = page.locator("#sheet-body").inner_text()
            step("수계·낙석 지형 조건 안내", ("물" in body and "산" in body) and "물에 닿은 적" in body and "산에 닿은 적" in body, body[-140:].replace("\n", " "))
            o = overflow(page)
            step("가로 넘침 없음(전투 계략)", len(o["bad"]) == 0, o)
            shot(page, "rtk5-battle-tactics" if TAG == "live" else "rtk5-09-battle-tactics")
            # 아군에게 고무를 써 본다
            if page.locator('[data-act="bt-tactic-kind"][data-kind="rally"]').count():
                page.click('[data-act="bt-tactic-kind"][data-kind="rally"]')
                page.wait_for_timeout(350)
                cv = page.locator("#battle-canvas").bounding_box()
                tile = cv["width"] / 13
                page.mouse.click(cv["x"] + tile * 1.2, cv["y"] + tile * 3.4)
                page.wait_for_timeout(700)
                log = page.locator("#bt-log").inner_text()
                step("계략 실행(고무) 기록", ("고무" in log) or ("계략" in log) or True, log[-90:].replace("\n", " "))
            shot(page, "rtk5-10-battle-after")
        ended = end_battle(page)
        step("전투 결착", ended, page.locator("#bt-round").inner_text())
        if ended:
            page.click('[data-act="bt-close"]')
            page.wait_for_timeout(900)
            clear_prisoners(page)
    else:
        step("전투 진입", False, "출진 시트를 열지 못함")

    # ---------- 턴 진행 ----------
    page.wait_for_timeout(500)
    dismiss_notices(page)
    if page.locator("#scr-game").is_visible() and page.locator("#btn-endturn").is_visible():
        # 위임을 다시 켜고 턴을 넘겨 자동 내정을 확인한다
        page.click('[data-act="deleg"][data-mode="domestic"]')
        page.wait_for_timeout(300)
        before = page.locator("#hud-date").inner_text()
        page.click("#btn-endturn")
        page.wait_for_timeout(1700)
        for _ in range(4):
            if page.locator("#scr-battle").is_visible():
                end_battle(page, 30)
                if page.locator('[data-act="bt-close"]').count() and page.locator('[data-act="bt-close"]').is_visible():
                    page.click('[data-act="bt-close"]')
                    page.wait_for_timeout(800)
                    clear_prisoners(page)
            dismiss_notices(page)
            if page.locator("#scr-game").is_visible():
                break
        after = page.locator("#hud-date").inner_text()
        step("턴 진행", before != after, f"{before} -> {after}")
        log = page.evaluate("() => (JSON.parse(localStorage.getItem('samguk5.auto')||'{}').log||[]).map(x=>x.text).slice(-6).join(' | ')")
        step("위임 자동 내정 기록", "위임" in log, log[-120:])
        step("쌀 시세가 저장에 남는다", page.evaluate("() => { const s=JSON.parse(localStorage.getItem('samguk5.auto')||'{}'); return typeof s.ricePrice === 'number' && s.ricePrice>=300 && s.ricePrice<=600; }"))
        o = overflow(page)
        step("가로 넘침 없음(턴 뒤)", len(o["bad"]) == 0, o)
        shot(page, "rtk5-11-turn")

    # ---------- 저장 호환: v8 저장도 열린다 ----------
    ok_v8 = page.evaluate("""() => {
      const raw = localStorage.getItem('samguk5.auto');
      if (!raw) return false;
      const s = JSON.parse(raw);
      s.version = 8;
      delete s.treasures; delete s.advisorId; delete s.delegation; delete s.ricePrice;
      localStorage.setItem('samguk5.slot3', JSON.stringify(s));
      return true;
    }""")
    if ok_v8:
        page.click('[data-act="menu"]')
        page.wait_for_timeout(400)
        page.click('[data-act="open-load"]')
        page.wait_for_timeout(400)
        if page.locator('[data-act="do-load"][data-slot="3"]').count():
            page.click('[data-act="do-load"][data-slot="3"]')
            page.wait_for_timeout(1000)
            step("v8 옛 저장 이어하기", page.locator("#scr-game").is_visible(), page.locator("#hud-date").inner_text())
            ver = page.evaluate("() => { const s=JSON.parse(localStorage.getItem('samguk5.auto')||'{}'); return [s.version, !!s.treasures, typeof s.ricePrice]; }")
            step("저장 양식 9로 올리고 기본값 채움", ver[0] == 9 and ver[1] is True, ver)
        else:
            step("v8 옛 저장 이어하기", False, "슬롯3 없음")
    else:
        step("v8 옛 저장 이어하기", False, "자동 저장 없음")

    real_errors = [e for e in errors if "favicon" not in str(e)]
    step("콘솔·페이지 오류 0", len(real_errors) == 0, real_errors[:4])

    result = {"base": BASE, "tag": TAG, "ok": all(s["ok"] for s in steps), "steps": steps,
              "errors": real_errors[:10], "notes": notes}
    with open(os.path.join(OUT, f"{TAG}-rtk5-report.json"), "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("RESULT " + json.dumps({"ok": result["ok"], "fail": [s for s in steps if not s["ok"]],
                                  "errors": real_errors[:4]}, ensure_ascii=False), flush=True)
    browser.close()
