"""삼국 한 턴 — 미니멀 지도 · 대회 · 등용 버튼 라이브 검증 (390×844)
사용: python3 tests/verify_minimal_tournament.py [URL] [TAG]
"""
import functools
import json
import os
import re
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ATK = ("/workspace/.tools/chromelibs/all:/workspace/.local/atklibs/usr/lib/x86_64-linux-gnu:"
       "/workspace/.local/libs/root/usr/lib/x86_64-linux-gnu")
os.environ["LD_LIBRARY_PATH"] = ATK + (":" + os.environ["LD_LIBRARY_PATH"] if os.environ.get("LD_LIBRARY_PATH") else "")
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath("/workspace/downloads/samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors = [], []
srv = None
if BASE.startswith("http://127.0.0.1:4173"):
    handler = functools.partial(SimpleHTTPRequestHandler, directory=ROOT)
    srv = ThreadingHTTPServer(("127.0.0.1", 4173), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    BASE = "http://127.0.0.1:4173/index.html"


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:300]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if extra != "" else ""), flush=True)


def shot(page, name):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path)
    print("SHOT " + os.path.basename(path), flush=True)
    return path


def overflow(page):
    return page.evaluate("""() => {
      const w = document.documentElement.clientWidth; const bad = [];
      const scrollable = (el) => { for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p); if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true; } return false; };
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


def toast_state(page):
    return page.evaluate("""() => {
      const t = document.querySelector('#toast');
      if (!t) return {missing: true};
      const r = t.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        text: t.textContent.trim(), hidden: t.classList.contains('hidden'),
        z: getComputedStyle(t).zIndex, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        onTop: !!el && (el === t || t.contains(el)),
        hit: el ? (el.id || el.className || el.tagName) : null,
      };
    }""")


def patch_save(page, mutate):
    raw = page.evaluate("() => localStorage.getItem('samguk5.auto')")
    state = json.loads(raw)
    mutate(state)
    page.evaluate("(s) => localStorage.setItem('samguk5.auto', s)", json.dumps(state))
    return state


def add_generals(state, n_faction=34, n_free_in_city=5):
    pid = state["playerId"]
    city = [c for c in state["cities"].values() if c["owner"] == pid][0]["id"]
    free = [g for g in state["generals"].values() if not g.get("faction") and not g.get("dead") and not g.get("captive")]
    for g in free[:n_faction]:
        g["faction"] = pid; g["city"] = city; g["loyalty"] = 70; g["acted"] = False
        g["captive"] = False; g["dead"] = False
    for g in free[n_faction:n_faction + n_free_in_city]:
        g["faction"] = None; g["city"] = city; g["captive"] = False; g["dead"] = False; g["acted"] = False
    return city


def calm_front(state):
    pid = state["playerId"]
    for c in state["cities"].values():
        if c["owner"] and c["owner"] != pid:
            c["troops"] = 800


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    page.click('[data-act="new"]')
    page.wait_for_timeout(320)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1100)
    step("본 게임 진입", page.locator("#scr-game").is_visible() and page.locator("#map").is_visible())

    # ---------- 1. 미니멀 지도 ----------
    page.wait_for_timeout(500)
    shot(page, "minimal-map")
    mapinfo = page.evaluate("""() => {
      const c = document.querySelector('#map'); const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let navy = 0, parchment = 0, total = 0;
      for (let i = 0; i < d.length; i += 4 * 97) {
        total++;
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (b > r && b > gg && b < 90 && r < 60) navy++;
        if (r > 190 && gg > 170 && b > 130) parchment++;
      }
      return {w: c.width, h: c.height, navy: navy / total, parchment: parchment / total};
    }""")
    step("지도 캔버스 렌더(네이비 바다·파치먼트 대륙)", mapinfo["w"] > 0 and mapinfo["navy"] > 0.2 and mapinfo["parchment"] > 0.1, mapinfo)
    o = overflow(page)
    step("가로 넘침 없음(지도)", len(o["bad"]) == 0, o)

    # ---------- 1b. 장수 카드 → 능력치 상세 ----------
    page.wait_for_timeout(200)
    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        page.click(".cs-toggle")
        page.wait_for_timeout(400)
    chips = page.locator(".gen-chip").count()
    first_name = page.locator(".gen-chip span").first.inner_text()
    page.locator(".gen-chip").first.click()
    page.wait_for_timeout(500)
    gtitle = page.locator("#sheet-title").inner_text()
    stats = page.locator(".gd-stat").count()
    face = page.locator(".gd-face").is_visible()
    rows = page.locator(".gd-row").count()
    step("장수 카드 탭 → 상세 시트가 열린다", chips > 0 and "장수" in gtitle and stats == 5 and face and rows >= 2,
         f"{first_name} · {gtitle} · 능력치 {stats} · 정보줄 {rows}")
    shot(page, "general-detail")
    page.click("#sheet .sheet-body [data-act='sheet-close']")
    page.wait_for_timeout(350)
    step("장수 상세 닫기", page.locator("#sheet").evaluate("el => el.classList.contains('hidden')"))

    # 좌우 스와이프는 상세를 열지 않는다
    gbox = page.locator(".cp-gens").bounding_box()
    if gbox:
        page.mouse.move(gbox["x"] + gbox["width"] - 20, gbox["y"] + gbox["height"] / 2)
        page.mouse.down()
        page.mouse.move(gbox["x"] + 20, gbox["y"] + gbox["height"] / 2, steps=12)
        page.mouse.up()
        page.wait_for_timeout(400)
    step("장수 줄 좌우 스와이프는 상세를 열지 않는다",
         page.locator("#sheet").evaluate("el => el.classList.contains('hidden')"),
         page.locator("#sheet-title").inner_text() if page.locator("#sheet").is_visible() else "")

    # ---------- 2. 등용 버튼 (행동력 0 → 안내 / 정상 조건 → 동작) ----------
    def prep_hire(state):
        add_generals(state)
        calm_front(state)
        state["actionPoints"] = 0
        state["month"] = 4
    patch_save(page, prep_hire)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(700)
    page.click('[data-act="continue"]')
    page.wait_for_timeout(900)
    step("이어하기(장수 34명·4월)", page.locator("#scr-game").is_visible(), page.locator("#hud-date").inner_text())

    page.click('[data-act="jump-region"][data-region="__mine"]')
    page.wait_for_timeout(350)
    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        page.click(".cs-toggle")
        page.wait_for_timeout(400)
    page.click('[data-act="cmd-group"][data-group="people"]')
    page.wait_for_timeout(250)
    page.click('[data-act="cmd"][data-cmd="hire"]')
    page.wait_for_timeout(500)
    title = page.locator("#sheet-title").inner_text()
    warn = page.locator(".warn-box").count()
    tstate = toast_state(page)
    step("등용 시트 — 행동력 부족 안내가 시트 상단에 보인다", "등용" in title and warn == 1, f"{title} · warn {warn}")
    step("행동력 부족 토스트가 시트 위에서 보인다", (not tstate.get("hidden")) and tstate.get("onTop") and tstate.get("z") == "120",
         tstate)
    dis = page.evaluate("""() => {
      const b = document.querySelector('[data-act="do-hire"]');
      return b ? {disabled: b.disabled, text: b.textContent.trim()} : null;
    }""")
    step("행동력이 없으면 등용 버튼이 잠긴다", dis and dis["disabled"], dis)
    shot(page, "hire-blocked")

    # 정상 조건 — 행동력을 채우고 다시 연다
    def refill(state):
        state["maxActionPoints"] = max(state.get("maxActionPoints") or 0, 6)
        state["actionPoints"] = 6
    patch_save(page, refill)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(700)
    page.click('[data-act="continue"]')
    page.wait_for_timeout(900)
    page.click('[data-act="jump-region"][data-region="__mine"]')
    page.wait_for_timeout(350)
    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        page.click(".cs-toggle")
        page.wait_for_timeout(400)
    page.click('[data-act="cmd-group"][data-group="people"]')
    page.wait_for_timeout(250)
    page.click('[data-act="cmd"][data-cmd="hire"]')
    page.wait_for_timeout(450)
    warn2 = page.locator(".warn-box").count()
    ap0 = page.locator("#res-ap").inner_text()
    page.locator('[data-act="do-hire"]').first.click()
    page.wait_for_timeout(700)
    tstate2 = toast_state(page)
    ap1 = page.locator("#res-ap").inner_text()
    sheet_closed = page.locator("#sheet").evaluate("el => el.classList.contains('hidden')")
    step("정상 조건 — 등용 클릭 시 시트가 닫히고 결과 토스트가 보인다",
         warn2 == 0 and sheet_closed and (not tstate2.get("hidden")) and tstate2.get("onTop"), tstate2)
    step("등용으로 행동력 사용(또는 실패 안내)", ap0 != ap1 or "행동력" not in tstate2.get("text", ""),
         f"{ap0} -> {ap1} · {tstate2.get('text')}")
    shot(page, "hire-normal")

    # ---------- 3. 5월 무예 대회 ----------
    def prep_tournament(state):
        state["month"] = 4
        state["actionPoints"] = 6
        state["maxActionPoints"] = 6
        calm_front(state)
    patch_save(page, prep_tournament)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(700)
    page.click('[data-act="continue"]')
    page.wait_for_timeout(900)
    gens = page.evaluate("() => document.querySelector('#hud-faction').textContent")
    page.click('[data-act="endturn"]')
    page.wait_for_timeout(1400)
    stitle = page.locator("#sheet-title").inner_text()
    matches = page.locator(".tour-match").count()
    champ = page.locator(".tour-champ b").count()
    round_heads = page.locator(".tour-round-head").all_inner_texts()
    step("5월로 넘어가면 무예 대회가 뜬다", "무예 대회" in stitle, f"{stitle} · {round_heads}")
    step("대진 8강·4강·결승 7경기 + 우승자 표시", matches == 7 and champ == 1 and round_heads == ["8강", "4강", "결승"],
         f"{matches}경기 · {round_heads}")
    rewards = page.evaluate("""() => [...document.querySelectorAll('[data-act="tour-reward"]')].map(b => ({
      kind: b.dataset.kind, disabled: b.disabled, text: b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 70)}))""")
    step("보상 하사 3종(금·보물·치하)", len(rewards) == 3 and [r["kind"] for r in rewards] == ["gold", "treasure", "praise"], rewards)
    o = overflow(page)
    step("가로 넘침 없음(대회 시트)", len(o["bad"]) == 0, o)
    shot(page, "tournament")

    gold_before = page.locator("#res-gold").inner_text()
    page.click('[data-act="tour-reward"][data-kind="praise"]')
    page.wait_for_timeout(800)
    tstate3 = toast_state(page)
    stitle3 = page.locator("#sheet-title").inner_text() if page.locator("#sheet").is_visible() else ""
    step("치하만 하기 — 대회 시트가 닫히고 결과 토스트가 보인다",
         "대회" not in stitle3 and (not tstate3.get("hidden")), f"{stitle3} · {tstate3.get('text')}")
    step("치하 후 진행 중 대회가 사라진다", page.evaluate("() => !document.querySelector('[data-act=\"open-tournament\"]')"), "")
    step("치하는 금을 쓰지 않는다", page.locator("#res-gold").inner_text() == gold_before,
         f"{gold_before} -> {page.locator('#res-gold').inner_text()}")
    shot(page, "tournament-reward")

    # 10월 설전 대회
    def prep_debate(state):
        state["month"] = 9
        state["actionPoints"] = 6
        state["maxActionPoints"] = 6
        state["pendingTournament"] = None
        calm_front(state)
    patch_save(page, prep_debate)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(700)
    page.click('[data-act="continue"]')
    page.wait_for_timeout(900)
    page.click('[data-act="endturn"]')
    page.wait_for_timeout(1400)
    dtitle = page.locator("#sheet-title").inner_text()
    step("10월로 넘어가면 설전 대회가 뜬다", "설전 대회" in dtitle, dtitle)
    page.click("#sheet .sheet-head [data-act='sheet-close']")
    page.wait_for_timeout(300)

    # ---------- 4. 공통 점검 ----------
    hanja = page.evaluate("""() => {
      const re = /[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/;
      const hits = [];
      document.querySelectorAll('body *').forEach(el => {
        for (const n of el.childNodes) if (n.nodeType === 3 && re.test(n.textContent)) hits.push(n.textContent.trim().slice(0, 24));
      });
      return hits.slice(0, 5);
    }""")
    step("화면에 한자 0자", len(hanja) == 0, hanja)
    errs = [e for e in errors if "favicon" not in str(e)]
    step("콘솔 오류 0", len(errs) == 0, errs[:4])
    o = overflow(page)
    step("가로 넘침 없음(최종)", len(o["bad"]) == 0, o)

    browser.close()
if srv:
    srv.shutdown()

pass_n = sum(1 for s in steps if s["ok"])
print(f"\nRESULT {pass_n}/{len(steps)}", flush=True)
sys.exit(0 if pass_n == len(steps) else 1)
