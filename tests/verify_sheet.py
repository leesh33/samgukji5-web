"""도트삼국 — 하단 도시 시트 검증 (기본 펼침 · 좌우 스와이프 도시 전환)
사용: LD_LIBRARY_PATH=... python3 samgukji5-web/tests/verify_sheet.py [URL] [TAG]

검증 항목
  1. 첫 진입 시 하단 도시 패널이 기본으로 펼쳐짐 (지도 영역 확보)
  2. 좌우 스와이프(실제 터치)로 내 성 전환 + 지도 카메라 포커스 이동
  3. 장수 초상화 줄 스와이프는 초상화 스크롤 우선(도시 전환 없음), 세로 제스처 무시
  4. 헤더 ‹ / › 인디케이터 탭 이동(순환 포함)
  5. 접기(cs-toggle) · 닫기(✕) 동작, 닫은 뒤 성을 탭하면 다시 펼침
  6. 적 성에서 스와이프하면 내 성으로 복귀
  7. 콘솔 오류 0 · 가로 넘침 0 · 데스크톱(1280) 레이아웃
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4175/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath(f"downloads/samguk5/sheet")
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


def panel_state(page):
    return page.evaluate("""() => {
      const p = document.querySelector('#citypanel');
      const map = document.querySelector('#map');
      const nav = p.querySelector('.cs-navidx');
      return {
        visible: !p.classList.contains('hidden'),
        open: p.classList.contains('open'),
        city: p.dataset.city || null,
        name: (p.querySelector('.cs-name') || {}).textContent || null,
        owner: (p.querySelector('.cs-owner') || {}).textContent || null,
        nav: nav ? nav.textContent : null,
        hasPrev: !!p.querySelector('[data-act="city-prev"]'),
        hasNext: !!p.querySelector('[data-act="city-next"]'),
        panelH: Math.round(p.getBoundingClientRect().height),
        mapH: map.clientHeight,
        mapPct: Math.round(map.clientHeight / innerHeight * 100),
      };
    }""")


def swipe(page, cdp, x0, y0, x1, y1, steps_n=12, gap=14):
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x0, "y": y0, "id": 1}]})
    for i in range(1, steps_n + 1):
        cdp.send("Input.dispatchTouchEvent", {
            "type": "touchMove",
            "touchPoints": [{"x": x0 + (x1 - x0) * i / steps_n, "y": y0 + (y1 - y0) * i / steps_n, "id": 1}],
        })
        page.wait_for_timeout(gap)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(420)


def swipe_panel(page, cdp, dx, dy=0, y_off=50):
    """패널 헤더(요약 줄)에서 좌우 스와이프. dx<0 = 다음 성"""
    box = page.locator("#citypanel").bounding_box()
    x0 = box["x"] + box["width"] * 0.5
    y0 = box["y"] + y_off
    swipe(page, cdp, x0, y0, x0 + dx, y0 + dy)


def tap_city(page, city_id):
    """지도(줌 1·전체 보기)에서 성을 정확히 탭 — mapview 좌표식을 그대로 계산"""
    pos = page.evaluate("""async (cityId) => {
      const d = await import('./js/data.js');
      const c = d.CITY_BY_ID[cityId];
      const cv = document.querySelector('#map');
      const cssW = cv.clientWidth, cssH = cv.clientHeight;
      const TOP_INSET = 26, B = {x0: 23, x1: 91, y0: 2, y1: 68};
      const fit = Math.min(cssW / (B.x1 - B.x0), (cssH - TOP_INSET) / (B.y1 - B.y0));
      const scaleY = fit * Math.min(1.5, Math.max(1, (cssH - TOP_INSET) / (B.y1 - B.y0) / fit));
      const camX = 57, camY = 35; // zoom 1에서는 clamp 결과가 항상 중앙
      return { x: (c.x - camX) * fit + cssW / 2, y: (c.y - camY) * scaleY + TOP_INSET + (cssH - TOP_INSET) / 2 };
    }""", city_id)
    box = page.locator("#map").bounding_box()
    page.touchscreen.tap(box["x"] + pos["x"], box["y"] + pos["y"])
    page.wait_for_timeout(450)
    return panel_state(page)


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
    page.click('.lord-card[data-id="jojo"]'); page.wait_for_timeout(1100)

    own = page.evaluate("""async () => {
      const d = await import('./js/data.js');
      const s = JSON.parse(localStorage.getItem('samguk5.auto'));
      return {
        mine: Object.values(s.cities).filter(c => c.owner === s.playerId).map(c => ({id: c.id, ko: d.CITY_BY_ID[c.id].ko})),
        enemy: Object.values(s.cities).filter(c => c.owner && c.owner !== s.playerId).map(c => ({id: c.id, ko: d.CITY_BY_ID[c.id].ko})),
      };
    }""")
    print("OWN " + json.dumps(own["mine"], ensure_ascii=False), flush=True)

    # ---------- 1. 기본 펼침 ----------
    st = panel_state(page)
    step("첫 진입 도시 패널 표시", st["visible"], st)
    step("첫 진입 기본 펼침", st["open"] and st["panelH"] > 200, f"open={st['open']} h={st['panelH']}")
    step("지도 영역 45% 이상 확보", st["mapPct"] >= 45, f"{st['mapPct']}%")
    step("헤더 ‹ › 인디케이터(내 성 2곳)", st["hasPrev"] and st["hasNext"] and st["nav"] == "1/2", st["nav"])
    step("첫 진입 가로 넘침 없음", len(overflow(page)["bad"]) == 0, overflow(page))
    shot(page, "01-default-open")

    cdp = ctx.new_cdp_session(page)

    # ---------- 2. 좌우 스와이프 ----------
    first = st["city"]
    swipe_panel(page, cdp, -170)
    st2 = panel_state(page)
    step("왼쪽 스와이프 → 다음 성", st2["city"] != first and st2["nav"] == "2/2",
         f"{st['name']} -> {st2['name']} ({st2['nav']})")
    shot(page, "02-swipe-next")

    swipe_panel(page, cdp, 170)
    st3 = panel_state(page)
    step("오른쪽 스와이프 → 이전 성", st3["city"] == first and st3["nav"] == "1/2",
         f"{st2['name']} -> {st3['name']} ({st3['nav']})")

    # 장수 초상화 줄: 가로 스크롤 우선
    gens = page.locator(".cp-gens").bounding_box()
    if gens:
        gb = panel_state(page)["city"]
        swipe(page, cdp, gens["x"] + gens["width"] - 30, gens["y"] + gens["height"] / 2,
              gens["x"] + 30, gens["y"] + gens["height"] / 2)
        step("초상화 줄 스와이프는 도시 전환 없음", panel_state(page)["city"] == gb,
             panel_state(page)["name"])
    # 세로 제스처는 무시
    vb = panel_state(page)["city"]
    swipe_panel(page, cdp, 10, dy=120, y_off=40)
    step("세로 스와이프는 도시 전환 없음", panel_state(page)["city"] == vb, panel_state(page)["name"])

    # ---------- 3. ‹ › 인디케이터 ----------
    page.click('[data-act="city-next"]'); page.wait_for_timeout(320)
    a = panel_state(page)
    page.click('[data-act="city-next"]'); page.wait_for_timeout(320)
    b = panel_state(page)
    step("› 버튼 다음 성 + 순환", a["nav"] == "2/2" and b["nav"] == "1/2", f"{a['nav']} -> {b['nav']}")
    page.click('[data-act="city-prev"]'); page.wait_for_timeout(320)
    c = panel_state(page)
    step("‹ 버튼 이전 성 + 순환", c["nav"] == "2/2", c["nav"])
    shot(page, "03-nav-buttons")

    # ---------- 4. 접기 / 닫기 / 재펼침 ----------
    page.click(".cs-toggle"); page.wait_for_timeout(400)
    col = panel_state(page)
    step("접기 → 본문 접힘·지도 확대", (not col["open"]) and col["mapPct"] > 70 and col["panelH"] < 150,
         f"open={col['open']} map={col['mapPct']}% h={col['panelH']}")
    step("접힌 상태에서도 ‹ › 유지", col["hasPrev"] and col["hasNext"] and col["nav"] == "2/2", col["nav"])
    shot(page, "04-collapsed")

    collapsed_city = col["city"]
    swipe_panel(page, cdp, 170, y_off=48)
    sw = panel_state(page)
    step("접힌 상태 스와이프도 성 전환", sw["city"] != collapsed_city and not sw["open"],
         f"{col['name']} -> {sw['name']} open={sw['open']}")

    page.click(".cs-toggle"); page.wait_for_timeout(400)
    step("명령 버튼 → 다시 펼침", panel_state(page)["open"], panel_state(page)["panelH"])

    page.click(".cs-close"); page.wait_for_timeout(450)
    closed = panel_state(page)
    step("✕ 닫기 → 패널 숨김·지도 확대", (not closed["visible"]) and closed["mapPct"] > 85, closed["mapPct"])

    # 닫은 뒤 다른 성을 탭하면 다시 펼쳐짐
    page.click('[data-act="zoom-reset"]'); page.wait_for_timeout(350)
    target = own["mine"][0]["id"] if closed["city"] != own["mine"][0]["id"] else own["mine"][1]["id"]
    tapped = tap_city(page, target)
    step("닫은 뒤 성 탭 → 다시 펼침", tapped["visible"] and tapped["open"] and tapped["city"] == target,
         f"{tapped['name']} open={tapped['open']}")
    shot(page, "05-reopen-by-tap")

    # ---------- 5. 지도 포커스 이동 확인 ----------
    # 내 성 두 곳을 스와이프로 오간 뒤, 닫고 지도 한가운데를 탭하면 그 성이 잡혀야 한다
    page.click('[data-act="zoom-reset"]'); page.wait_for_timeout(200)
    other = own["mine"][1]["id"] if panel_state(page)["city"] == own["mine"][0]["id"] else own["mine"][0]["id"]
    swipe_panel(page, cdp, -170)
    focused = panel_state(page)
    page.click(".cs-close"); page.wait_for_timeout(450)
    mb = page.locator("#map").bounding_box()
    page.touchscreen.tap(mb["x"] + mb["width"] / 2, mb["y"] + mb["height"] / 2 + 13)
    page.wait_for_timeout(450)
    after = panel_state(page)
    step("전환 후 지도 카메라가 해당 성에 포커스", focused["city"] == other and after["city"] == other,
         f"swipe→{focused['name']} / 중앙 탭→{after['name']}")
    shot(page, "06-map-focus")

    # ---------- 6. 적 성에서 스와이프 → 내 성 복귀 ----------
    page.click('[data-act="zoom-reset"]'); page.wait_for_timeout(300)
    enemy = own["enemy"][0]
    e = tap_city(page, enemy["id"])
    step("적 성 탭 → 소유자 표시", e["visible"] and e["city"] == enemy["id"], f"{e['name']} / {e['owner']}")
    shot(page, "07-enemy-city")
    swipe_panel(page, cdp, -170)
    back = panel_state(page)
    step("적 성에서 스와이프 → 내 성", back["city"] in [x["id"] for x in own["mine"]],
         f"{e['name']} -> {back['name']} ({back['nav']})")
    shot(page, "08-enemy-to-mine")

    real_errors = [x for x in errors if "favicon" not in str(x)]
    step("콘솔·페이지 오류 0", len(real_errors) == 0, real_errors[:4])
    step("최종 가로 넘침 없음", len(overflow(page)["bad"]) == 0, overflow(page))

    # ---------- 7. 데스크톱 ----------
    dctx = browser.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
    dp = dctx.new_page()
    dp.on("console", lambda m: errors.append(("console-desktop", m.text)) if m.type == "error" else None)
    dp.on("pageerror", lambda e: errors.append(("pageerror-desktop", str(e))))
    dp.goto(BASE, wait_until="networkidle"); dp.wait_for_timeout(700)
    dp.click('[data-act="new"]'); dp.wait_for_timeout(250)
    dp.click('.sc-card[data-id="s200"]'); dp.wait_for_timeout(300)
    dp.click('.lord-card[data-id="yuanshao"]'); dp.wait_for_timeout(1000)
    d = dp.evaluate("""() => {
      const p = document.querySelector('#citypanel');
      const cs = getComputedStyle(p.querySelector('.cs-body'));
      return {open: p.classList.contains('open'), bodyDisplay: cs.display, w: p.getBoundingClientRect().width,
              nav: (p.querySelector('.cs-navidx') || {}).textContent || null,
              doc: document.documentElement.scrollWidth, win: innerWidth,
              toggleHidden: getComputedStyle(p.querySelector('.cs-toggle')).display === 'none'};
    }""")
    dp.click('[data-act="city-next"]'); dp.wait_for_timeout(300)
    d2 = dp.evaluate("() => (document.querySelector('.cs-navidx')||{}).textContent")
    step("데스크톱 사이드 패널 + › 이동", d["open"] and d["bodyDisplay"] == "block" and d["doc"] <= d["win"] and d2 != d["nav"],
         f"{d['nav']} -> {d2}")
    dp.screenshot(path=os.path.join(OUT, f"{TAG}-09-desktop.png"))
    print("SHOT " + os.path.basename(os.path.join(OUT, f"{TAG}-09-desktop.png")), flush=True)

    real_errors = [x for x in errors if "favicon" not in str(x)]
    if real_errors:
        step("데스크톱 포함 콘솔 오류 0", False, real_errors[:4])

    result = {"base": BASE, "tag": TAG, "ok": all(s["ok"] for s in steps), "steps": steps, "errors": real_errors[:10]}
    with open(os.path.join(OUT, f"{TAG}-sheet-report.json"), "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("RESULT " + json.dumps({"ok": result["ok"], "fail": [s for s in steps if not s["ok"]],
                                  "errors": real_errors[:4]}, ensure_ascii=False), flush=True)
    browser.close()
