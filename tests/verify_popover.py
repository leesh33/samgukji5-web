"""삼국 한 턴 — 성 시트 1차 메뉴 팝오버 검증 (390×844 · iPhone UA · 실제 터치)
사용: LD_LIBRARY_PATH=... python3 samgukji5-web/tests/verify_popover.py [URL] [TAG]

검증 항목
  1. 내정·인사·군사 팝오버를 열고 닫아도 #citypanel 높이 변화 0px (지도 높이도 그대로)
  2. 팝오버는 누른 버튼 바로 위에 뜨고(꼬리가 버튼을 가리킴) 화면 안에 들어온다
  3. 팝오버 항목: 내정 6(개발·상업·치안·수리·교역(쌀 시세)·수송) / 인사 6(탐색·등용·이동·대화·포상·참모) / 군사 3(징병·훈련·출진)
  4. 같은 버튼을 다시 누르면 닫히고, 바깥(지도)을 탭해도 닫힌다
  5. 하위 명령을 누르면 팝오버가 닫히고 시트가 열린다
  6. 접었을 때 맨 아래에 `▲ 성 메뉴` 탭 손잡이가 보이고, 누르면 다시 펼쳐진다
  7. 가로 넘침 0 · 콘솔 오류 0
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import GROUP_LABELS, group_btn

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors = [], []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:300]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:180] if extra != "" else ""), flush=True)


def shot(page, name):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path)
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


def geom(page):
    return page.evaluate("""() => {
      const p = document.querySelector('#citypanel');
      const map = document.querySelector('#map');
      const pop = document.querySelector('#cmdp');
      const tab = pop && pop.dataset.group
        ? document.querySelector(`[data-act="cmd-group"][data-group="${pop.dataset.group}"]`) : null;
      const pr = pop ? pop.getBoundingClientRect() : null;
      const tr = tab ? tab.getBoundingClientRect() : null;
      const cs = pop && !pop.classList.contains('hidden') ? getComputedStyle(pop) : null;
      return {
        panelH: p.getBoundingClientRect().height,
        mapH: map.clientHeight,
        open: p.classList.contains('open'),
        visible: !p.classList.contains('hidden'),
        popVisible: !!pop && !pop.classList.contains('hidden'),
        popH: pr ? Math.round(pr.height) : 0,
        popW: pr ? Math.round(pr.width) : 0,
        popTop: pr ? Math.round(pr.top) : 0,
        popLeft: pr ? Math.round(pr.left) : 0,
        popRight: pr ? Math.round(pr.right) : 0,
        popBottom: pr ? Math.round(pr.bottom) : 0,
        tabTop: tr ? Math.round(tr.top) : 0,
        tabLeft: tr ? Math.round(tr.left) : 0,
        tabRight: tr ? Math.round(tr.right) : 0,
        tail: cs ? cs.getPropertyValue('--tail').trim() : '',
        labels: pop && !pop.classList.contains('hidden')
          ? [...pop.querySelectorAll('.btn')].map(b => (b.innerText || '').replace(/\\n/g, '/'))
          : [],
        handle: !!p.querySelector('.cs-handle'),
        handleText: (p.querySelector('.cs-handle') || {}).innerText || '',
      };
    }""")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:100])))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    page.click('[data-act="new"]'); page.wait_for_timeout(300)
    page.click('.sc-card[data-id="s194"]'); page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]'); page.wait_for_timeout(1200)
    print("URL " + page.url, flush=True)

    base = geom(page)
    step("시트 펼침·1차 메뉴 5개", base["visible"] and base["open"],
         f"panelH={base['panelH']:.1f} mapH={base['mapH']}")

    expected = {
        "civil": ["개발", "상업", "치안", "수리", "교역", "수송"],
        "people": ["탐색", "등용", "이동", "대화", "포상", "참모"],
        "army": ["징병", "훈련", "출진"],
    }
    heights = {}
    for g, want in expected.items():
        group_btn(page, g).first.click()
        page.wait_for_timeout(260)
        st = geom(page)
        heights[g] = st
        step(f"{GROUP_LABELS[g]} 팝오버 열림", st["popVisible"], f"h={st['popH']} w={st['popW']} tail={st['tail']}")
        step(f"{GROUP_LABELS[g]} 팝오버 열어도 시트 높이 그대로",
             abs(st["panelH"] - base["panelH"]) < 0.5 and st["mapH"] == base["mapH"],
             f"panelH {base['panelH']:.1f} -> {st['panelH']:.1f} / mapH {base['mapH']} -> {st['mapH']}")
        labels = [x.split("/")[0] for x in st["labels"]]
        step(f"{GROUP_LABELS[g]} 항목 {len(want)}개 · 순서", labels == want, st["labels"])
        step(f"{GROUP_LABELS[g]} 팝오버가 버튼 바로 위",
             st["popBottom"] <= st["tabTop"] and st["tabTop"] - st["popBottom"] <= 16,
             f"popBottom={st['popBottom']} tabTop={st['tabTop']}")
        step(f"{GROUP_LABELS[g]} 팝오버가 화면 안·가로 넘침 없음",
             st["popLeft"] >= 0 and st["popRight"] <= 390 and st["popW"] > 0,
             f"{st['popLeft']}~{st['popRight']}")
        if g == "civil":
            step("교역에 쌀 시세 표시", any("쌀 " in x for x in st["labels"]), st["labels"])
            shot(page, "pop-civil")
        if g == "people":
            shot(page, "pop-people")

    # 같은 버튼 다시 → 닫힘
    group_btn(page, "army").first.click()
    page.wait_for_timeout(240)
    st = geom(page)
    step("같은 버튼 다시 누르면 닫힘", not st["popVisible"] and abs(st["panelH"] - base["panelH"]) < 0.5, st["panelH"])
    step("닫힌 뒤에도 1차 버튼 aria-pressed=false",
         group_btn(page, "army").first.get_attribute("aria-pressed") == "false")

    # 바깥(지도) 탭 → 닫힘
    group_btn(page, "civil").first.click()
    page.wait_for_timeout(240)
    mb = page.locator("#map").bounding_box()
    page.touchscreen.tap(mb["x"] + mb["width"] * 0.5, mb["y"] + mb["height"] * 0.3)
    page.wait_for_timeout(320)
    st = geom(page)
    step("지도(바깥) 탭하면 닫힘", not st["popVisible"], st["popVisible"])
    # 지도 탭으로 다른 성이 잡혔을 수 있으니 내 성으로 돌아온다
    page.click('[data-act="jump-region"][data-region="__mine"]')
    page.wait_for_timeout(420)
    step("내 성으로 복귀", geom(page)["open"], geom(page)["panelH"])

    # 항목을 누르면 팝오버 닫히고 시트 열림
    group_btn(page, "civil").first.click()
    page.wait_for_timeout(240)
    page.locator('#cmdp .btn[data-cmd="agri"]').first.click()
    page.wait_for_timeout(420)
    st = geom(page)
    sheet_open = not page.locator("#sheet").evaluate("el => el.classList.contains('hidden')")
    step("하위 명령 실행 → 팝오버 닫힘", not st["popVisible"], st["popVisible"])
    step("하위 명령 실행 → 시트 열림", sheet_open, page.locator("#sheet-title").inner_text() if sheet_open else "")
    shot(page, "pop-command-sheet")
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(260)

    # 참모 항목이 인사에서 열린다
    group_btn(page, "people").first.click()
    page.wait_for_timeout(240)
    page.locator('#cmdp .btn[data-act="advisor"]').first.click()
    page.wait_for_timeout(420)
    title = page.locator("#sheet-title").inner_text() if page.locator("#sheet").is_visible() else ""
    step("인사 → 참모 시트", title == "참모 임명", title)
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(260)

    # 접기 → ▲ 성 메뉴 손잡이
    page.click(".cs-toggle")
    page.wait_for_timeout(420)
    col = geom(page)
    step("접힌 시트에 ▲ 성 메뉴 손잡이", col["handle"] and "성 메뉴" in col["handleText"], col["handleText"].replace("\n", "/"))
    step("접힌 높이 150 미만", col["panelH"] < 150, round(col["panelH"], 1))
    shot(page, "pop-collapsed-handle")
    page.tap(".cs-handle")
    page.wait_for_timeout(420)
    back = geom(page)
    step("손잡이 탭 → 다시 펼침", back["open"] and abs(back["panelH"] - base["panelH"]) < 0.5,
         f"{round(col['panelH'], 1)} -> {round(back['panelH'], 1)}")

    of = overflow(page)
    step("가로 넘침 0", len(of["bad"]) == 0, of)
    step("콘솔 오류 0", len(errors) == 0, errors[:3])

    # 넓은 화면(데스크톱 사이드 패널)에서도 같은 방식으로 뜨는지
    page.set_viewport_size({"width": 1280, "height": 900})
    page.wait_for_timeout(450)
    group_btn(page, "civil").first.click()
    page.wait_for_timeout(320)
    d = geom(page)
    step("데스크톱 팝오버도 버튼 위·화면 안",
         d["popVisible"] and d["popBottom"] <= d["tabTop"] and d["popRight"] <= 1280 and d["popLeft"] >= 0,
         f"{d['popLeft']}~{d['popRight']} bottom={d['popBottom']} tabTop={d['tabTop']}")
    shot(page, "pop-desktop")
    group_btn(page, "civil").first.click()
    page.wait_for_timeout(220)
    step("데스크톱에서도 다시 누르면 닫힘", not geom(page)["popVisible"])

    browser.close()

ok = all(s["ok"] for s in steps)
print(json.dumps({"ok": ok, "tag": TAG, "base": BASE, "steps": steps, "errors": errors}, ensure_ascii=False, indent=1), flush=True)
print(f"RESULT {TAG} " + ("ALL PASS" if ok else "FAIL"), flush=True)
sys.exit(0 if ok else 1)
