"""도트삼국 — 도시간 장수 이동 · 장수 대화 · 한자 0자 라이브 검증 (390×844 · iPhone UA · 실제 터치)
사용: python3 tests/verify_move_talk.py [URL] [TAG]
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd, open_group, menu_labels

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
fails = []


def step(label, ok, extra=""):
    if not ok:
        fails.append(label)
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if extra != "" else ""), flush=True)


def shot(page, name):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path)
    print("SHOT " + os.path.basename(path), flush=True)
    return path


def cjk_of(page, scope="document.body"):
    return page.evaluate(
        """(sel) => {
          const el = sel === 'document.body' ? document.body : document.querySelector(sel);
          const t = el ? (el.innerText || '') : '';
          const m = t.match(/[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/g);
          return { n: m ? m.length : 0, sample: m ? m.slice(0, 6).join('') : '' };
        }""",
        scope,
    )


def state(page):
    return page.evaluate("() => JSON.parse(localStorage.getItem('samguk5.auto') || 'null')")


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


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:100], r.failure)))

    # ---------- 타이틀 ----------
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    step("타이틀 화면", page.locator(".title-mark h1").is_visible(), page.locator(".title-mark h1").inner_text())
    step("타이틀에 한자 없음", cjk_of(page)["n"] == 0, cjk_of(page))
    step("한자 제목 표기 제거", page.locator(".title-hanja").count() == 0)
    shot(page, "01-title")

    # ---------- 시나리오 · 군주 ----------
    page.click('[data-act="new"]')
    page.wait_for_timeout(350)
    step("시나리오 7종", page.locator(".sc-card[data-id]").count() == 7, page.locator(".sc-card").count())
    step("시나리오 화면 한자 없음", cjk_of(page)["n"] == 0, cjk_of(page))
    names = page.locator(".sc-name").all_inner_texts()
    step("시나리오 이름이 한글뿐", all(not CJK.search(n) for n in names), names)
    shot(page, "02-scenarios")

    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(450)
    step("군주 선택 화면 한자 없음", cjk_of(page)["n"] == 0, cjk_of(page))
    marks = page.locator(".lc-mark").all_inner_texts()
    step("세력 깃발이 한글 1자", len(marks) >= 15 and all(re.fullmatch(r"[가-힣]", m) for m in marks), marks[:8])
    shot(page, "03-lords")

    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1000)
    st = state(page)
    step("본 게임 진입", st is not None and page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())
    crest = page.locator("#hud-crest").inner_text()
    step("헤더 깃발 한글 1자", re.fullmatch(r"[가-힣]", crest) is not None, crest)
    step("게임 화면 한자 없음", cjk_of(page)["n"] == 0, cjk_of(page))
    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        page.click(".cs-toggle")
        page.wait_for_timeout(350)

    # ---------- 이동 버튼 ----------
    step("하단 1차 메뉴 4개(내정·인사·군사·계략)",
         [x.split("/")[0] for x in menu_labels(page)] == ["내정", "인사", "군사", "계략"], menu_labels(page))
    open_group(page, "people")
    move_btn = page.locator('[data-act="cmd"][data-cmd="move"]')
    talk_btn = page.locator('[data-act="cmd"][data-cmd="talk"]')
    step("인사 메뉴에 이동·대화 버튼", move_btn.count() == 1 and talk_btn.count() == 1,
         f"{move_btn.count()} / {talk_btn.count()}")
    step("이동 버튼 활성(내 성 2곳)", move_btn.is_enabled())
    shot(page, "04-citypanel")

    # ---------- 도시간 장수 이동 ----------
    from_city = page.locator("#citypanel").get_attribute("data-city")
    ap0 = st["actionPoints"]
    gens_from0 = [g for g in st["generals"].values() if g["city"] == from_city and g["faction"] == st["playerId"]]
    click_cmd(page, "move")
    page.wait_for_timeout(450)
    step("이동 시트 열림", "장수 이동" in page.locator("#sheet-title").inner_text(),
         page.locator("#sheet-title").inner_text())
    dests = page.locator(".mv-dest").count()
    step("도착 성 후보 = 내 성 - 1", dests == len([c for c in st["cities"].values() if c["owner"] == st["playerId"]]) - 1, dests)
    shot(page, "05-move-sheet")

    picked = page.locator('[data-act="mv-gen"]:not([disabled])')
    step("이동할 장수 목록", picked.count() >= 2, picked.count())
    picked.nth(0).click()
    page.wait_for_timeout(200)
    picked.nth(1).click()
    page.wait_for_timeout(250)
    sel_count = page.locator(".officer-row.picked").count()
    step("장수 2명 선택", sel_count == 2, sel_count)
    page.locator(".mv-dest").first.click()
    page.wait_for_timeout(250)
    dest_city = page.locator(".mv-dest.on").get_attribute("data-city")
    go = page.locator('[data-act="mv-go"]')
    step("이동 실행 버튼 활성", go.is_enabled(), page.locator('[data-act="mv-go"]').inner_text()[:60])
    gb = go.bounding_box()
    step("이동 실행 버튼이 스크롤 없이 보임", bool(gb) and gb["y"] + gb["height"] <= 844, gb)
    shot(page, "06-move-picked")

    movers = page.locator(".officer-row.picked .or-name").all_inner_texts()
    go.click()
    page.wait_for_timeout(700)
    st2 = state(page)
    moved_ids = [gid for gid, g in st2["generals"].items()
                 if g["city"] == dest_city and g["acted"] and g.get("movedThisTurn")]
    step("장수 소속 성 변경(도착 성 반영)", len(moved_ids) >= 2, f"{from_city} -> {dest_city} : {len(moved_ids)}명")
    step("이동 후 행동력 1 소모", st2["actionPoints"] == ap0 - 1, f"{ap0} -> {st2['actionPoints']}")
    step("이동한 장수는 그 달 행동 완료", all(st2["generals"][g]["acted"] for g in moved_ids))
    step("도착 성 장수 수 증가", len([g for g in st2["generals"].values() if g["city"] == dest_city and g["faction"] == st2["playerId"]])
         == len([g for g in st["generals"].values() if g["city"] == dest_city and g["faction"] == st["playerId"]]) + len(moved_ids))
    shot(page, "07-move-done")

    # 도착 성으로 넘어가 장수가 실제로 있는지 화면에서도 확인
    page.click('[data-act="city-next"]')
    page.wait_for_timeout(500)
    shown_city = page.locator("#citypanel").get_attribute("data-city")
    step("내 성 전환 후 도착 성 표시", shown_city == dest_city, f"{shown_city} / {dest_city}")
    done_chips = page.locator("#citypanel .gen-chip.done").count()
    step("도착 성 장수 줄에 옮긴 장수 즉시 반영", done_chips >= len(moved_ids), f"완료 표시 {done_chips}")
    shot(page, "08-move-arrived")

    # ---------- 장수 대화 ----------
    # 현재 선택된 성의 장수와 대화한다
    talk_city = page.locator("#citypanel").get_attribute("data-city")
    st4 = state(page)
    partners = [g for g in st4["generals"].values()
                if g["city"] == talk_city and g["faction"] == st4["playerId"]
                and g["id"] != st4["factions"][st4["playerId"]]["lord"] and not g["captive"]]
    step("대화 상대 존재", len(partners) > 0, len(partners))
    ap1 = st4["actionPoints"]
    click_cmd(page, "talk")
    page.wait_for_timeout(450)
    step("대화 시트 열림", "대화" in page.locator("#sheet-title").inner_text(), page.locator("#sheet-title").inner_text())
    rows = page.locator('[data-act="talk-go"]')
    step("대화 장수 목록", rows.count() == len(partners), f"{rows.count()} / {len(partners)}")
    step("충성 게이지 표시", page.locator("#sheet-body .loy-bar i").count() >= 1)
    shot(page, "09-talk-sheet")

    target_row = page.locator('[data-act="talk-go"]:not([disabled])').first
    target_gid = target_row.get_attribute("data-officer")
    before_loy = st4["generals"][target_gid]["loyalty"]
    target_row.click()
    page.wait_for_timeout(650)
    lines = page.locator(".talk-line").all_inner_texts()
    step("장수 대사 + 군주 한마디", len(lines) == 2 and all(len(x) > 8 for x in lines),
         [x[:28] for x in lines])
    st5 = state(page)
    after = st5["generals"][target_gid]["loyalty"]
    step("충성도 상승(+4 이상)", after >= min(100, before_loy + 4), f"{before_loy} -> {after}")
    step("대화 후 행동력 1 소모", st5["actionPoints"] == ap1 - 1, f"{ap1} -> {st5['actionPoints']}")
    step("이번 턴 대화 기록", st5.get("talked", {}).get(target_gid) == st5["turn"], st5.get("talked"))
    step("금은 들지 않음", st5["cities"][talk_city]["gold"] == st4["cities"][talk_city]["gold"])
    step("대화 장면에 한자 없음", cjk_of(page)["n"] == 0, cjk_of(page))
    shot(page, "10-talk-scene")

    page.click('[data-act="talk-more"]')
    page.wait_for_timeout(400)
    talked_row = page.locator(f'[data-act="talk-go"][data-officer="{target_gid}"]')
    step("재대화 제한(같은 달 완료 표시)",
         talked_row.count() == 1 and talked_row.is_disabled() and "완료" in talked_row.inner_text(),
         talked_row.inner_text().replace("\n", " ")[:60])
    shot(page, "11-talk-limit")
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(300)

    # ---------- 턴 종료 → 대화 제한 해제 ----------
    page.click('[data-act="endturn"]')
    page.wait_for_timeout(1200)
    # AI 침공으로 전투에 들어갔으면 정리
    for _ in range(30):
        if not page.locator("#scr-battle").is_visible():
            break
        if page.locator('[data-act="bt-all"]').count() and not page.locator('[data-act="bt-all"]').is_disabled():
            page.click('[data-act="bt-all"]')
        elif page.locator('[data-act="bt-next"]').count() and not page.locator('[data-act="bt-next"]').is_disabled():
            page.click('[data-act="bt-next"]')
        page.wait_for_timeout(1300)
        if page.locator('[data-act="bt-close"]').count():
            page.click('[data-act="bt-close"]')
            page.wait_for_timeout(500)
    if page.locator('[data-act="prisoner-release"]').count():
        page.click('[data-act="prisoner-release"]')
        page.wait_for_timeout(400)
    if page.locator('[data-act="prisoner-done"]').count():
        page.click('[data-act="prisoner-done"]')
        page.wait_for_timeout(400)
    st6 = state(page)
    step("턴 종료: 대화 기록 초기화", st6["talked"] == {}, st6.get("talked"))
    step("턴 종료: 이동 장수 행동 해제", all(not g["acted"] for g in st6["generals"].values() if g.get("movedThisTurn")) or
         all(not g.get("movedThisTurn") for g in st6["generals"].values()))

    # ---------- 화면 전체 한자·넘침·오류 ----------
    if page.locator("#scr-game").is_visible():
        c = cjk_of(page)
        step("게임 화면 전체 한자 0자", c["n"] == 0, c)
        o = overflow(page)
        step("가로 넘침 없음", len(o["bad"]) == 0, o)
        shot(page, "12-after-turn")

    # 메뉴/도움말/군보도 확인
    page.click('[data-act="menu"]')
    page.wait_for_timeout(400)
    step("메뉴 화면 한자 없음", cjk_of(page)["n"] == 0, cjk_of(page))
    page.click('[data-act="open-help"]')
    page.wait_for_timeout(350)
    step("게임 방법 한자 없음", cjk_of(page)["n"] == 0, cjk_of(page))
    step("게임 방법에 이동·대화 안내",
         "이동" in page.locator("#sheet-body").inner_text() and "대화" in page.locator("#sheet-body").inner_text())
    shot(page, "13-help")
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(250)

    errs = [e for e in errors if not str(e).startswith("reqfail")]
    step("콘솔 오류 0", len(errs) == 0, errs[:4])
    ctx.close()
    browser.close()

print("\n" + ("ALL PASS" if not fails else f"FAILED {len(fails)}: " + ", ".join(fails)))
sys.exit(0 if not fails else 1)
