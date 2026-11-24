"""삼국 한 턴 — 성 주둔 상한(규모 맥스 · 인구 30%) 라이브 검증 (390×844)
사용: python3 samgukji5-web/tests/verify_troop_cap.py [URL] [TAG]

확인:
  · 성 시트 병력 칸이 「병력 N /최대」로 뜨고, 최대 = min(규모 맥스, floor(인구×0.3))와 같다
  · 인구 칸이 엔진 인구와 같고, 병력 툴팁에 「성 인구 N의 30%와 ○형 맥스(M) 중 작은 쪽」이 있다
  · 징병 시트 안내에 인구 30%와 이 성의 상한이 적힌다
  · 인구가 먼저 걸리는 성(중형 진류)에서 상한까지 채우면 징병이 막히고 「인구 N의 30%」를 알린다
  · 규모 맥스가 먼저 걸리는 성(특대형·인구 많음)은 「○형 성의 맥스」를 알린다
  · 턴을 넘기면 인구가 늘고 병력 최대치가 줄지 않는다
  · 겹침·잘림·가로 넘침 0 · 콘솔 오류 0
"""
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd, close_groups

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
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:220] if extra != "" else ""), flush=True)


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


def overlap_stats(page):
    """시트 안 글자가 서로 겹치거나 잘린 곳이 있는지 — 칸(stat) 단위로 본다."""
    return page.evaluate("""() => {
      const bad = [];
      document.querySelectorAll('#citypanel .stat').forEach(el => {
        const b = el.querySelector('b'), i = el.querySelector('i');
        if (!b || !i) return;
        const rb = b.getBoundingClientRect(), ri = i.getBoundingClientRect();
        if (rb.left < ri.right - 1) bad.push((i.textContent || '') + ' 글자 겹침');
        if (el.scrollWidth > el.clientWidth + 1) bad.push((i.textContent || '') + ' 칸 넘침');
      });
      return bad.slice(0, 6);
    }""")


def close_sheet(page):
    """열린 시트를 화면의 닫기(✕) 버튼으로 실제로 닫는다 — DOM을 건드리지 않는다."""
    if page.locator('#sheet:not(.hidden)').count():
        btn = page.locator('#sheet [data-act="sheet-close"]').first
        try:
            btn.click(timeout=1500)
        except Exception:
            page.keyboard.press("Escape")
        page.wait_for_timeout(260)


def open_city(page, city_id, wait=520):
    close_sheet(page)
    page.click('[data-act="info"]'); page.wait_for_timeout(260)
    page.click('[data-act="info-tab"][data-tab="cities"]'); page.wait_for_timeout(260)
    page.click(f'[data-act="info-city"][data-city="{city_id}"]'); page.wait_for_timeout(wait)


def city_facts(page, city_id):
    return page.evaluate("""async (id) => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities[id];
      return {
        pop: E.cityPopOf(g, id), ceil: E.cityPopCeil(g, id), cap: E.cityTroopsCap(g, id),
        troops: c.troops, sizeKo: E.citySizeKoOf(g, id), size: E.citySizeOf(g, id),
        popCap: Math.floor(E.cityPopOf(g, id) * 0.3),
        sizeMax: (await import('./js/data.js')).sizeTroopCap(c.size),
      };
    }""", city_id)


def stat_cells(page):
    return page.evaluate("""() => Array.from(document.querySelectorAll('#citypanel .cs-stats .stat')).map(el => ({
      label: (el.querySelector('i') || {}).textContent || '',
      text: el.innerText.replace(/\\n/g, ' ').replace(/\\s+/g, ' ').trim(),
      title: el.getAttribute('title') || '',
    }))""")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:100])))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(700)
    page.click('[data-act="new"]'); page.wait_for_timeout(300)
    page.click('.sc-card[data-id="s194"]'); page.wait_for_timeout(350)
    page.click('.lord-card[data-id="jojo"]'); page.wait_for_timeout(1300)
    page.evaluate("() => localStorage.clear()")
    step("194년 조조로 새 게임 시작", page.evaluate("() => !!document.querySelector('#citypanel')"))

    # ---------- 1. 중형 진류 — 인구 30%가 먼저 걸리는 성 ----------
    open_city(page, "chenliu")
    f = city_facts(page, "chenliu")
    step("진류(중형) 상한 = min(중형 맥스 50,000, 인구 30%)", f["cap"] == min(f["sizeMax"], f["popCap"]),
         f"인구 {f['pop']:,} · 30% {f['popCap']:,} · 맥스 {f['sizeMax']:,} → {f['cap']:,}")
    step("중형이라도 인구가 먼저 걸린다(상한 < 규모 맥스)", f["cap"] < f["sizeMax"], f"{f['cap']:,} < {f['sizeMax']:,}")
    cells = stat_cells(page)
    cap_cell = next((c for c in cells if c["label"].startswith("병력")), None)
    pop_cell = next((c for c in cells if c["label"].startswith("인구")), None)
    step("성 시트 병력 칸이 「병력 N /최대」", bool(cap_cell) and f"/{f['cap']:,}" in cap_cell["text"], cap_cell and cap_cell["text"])
    step("병력 툴팁에 인구 30%·규모 맥스 설명", bool(cap_cell) and "30%" in cap_cell["title"] and "맥스" in cap_cell["title"],
         cap_cell and cap_cell["title"])
    step("인구 칸이 엔진 인구와 같다", bool(pop_cell) and f"{f['pop']:,}" in pop_cell["text"], pop_cell and pop_cell["text"])
    step("인구 칸 툴팁에 수용력 안내", bool(pop_cell) and "수용력" in pop_cell["title"], pop_cell and pop_cell["title"])
    shot(page, "01-city-chenliu")

    # ---------- 2. 징병 시트 — 인구 30% 안내 ----------
    click_cmd(page, 'draft')
    page.wait_for_timeout(500)
    sheet = page.evaluate("""() => (document.querySelector('#sheet') || {}).innerText || ''""")
    step("징병 시트에 인구 30%와 성 상한 안내", ("30%" in sheet) and (f"{f['cap']:,}" in sheet), sheet[:160].replace("\n", " | "))
    shot(page, "02-draft-pop")
    close_sheet(page)

    # ---------- 3. 상한까지 채우면 징병이 막히고 이유를 알린다 ----------
    blocked = page.evaluate("""async (id) => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities[id];
      c.troops = E.cityTroopsCap(g, id) - 50;     // 상한 바로 아래
      g.actionPoints = 6;
      for (const x of E.generalsInCity(g, id)) x.acted = false;
      const r = E.runCommand(g, 'draft', { cityId: id, officerId: E.generalsInCity(g, id)[0].id });
      const officer = E.generalsInCity(g, id).find((x) => !x.acted) || E.generalsInCity(g, id)[0];
      g.actionPoints = 6;
      const r2 = E.runCommand(g, 'draft', { cityId: id, officerId: officer.id });
      return { first: r, troops: c.troops, cap: E.cityTroopsCap(g, id), second: r2 };
    }""", "chenliu")
    step("상한까지 징병하면 상한에서 멈춘다", blocked["troops"] == blocked["cap"], f"{blocked['troops']:,} / {blocked['cap']:,}")
    step("그 다음 징병은 거절하고 「인구 N의 30%」를 알린다",
         (not blocked["second"].get("ok")) and ("30%" in blocked["second"].get("msg", "")),
         blocked["second"].get("msg", "")[:150])
    close_sheet(page)
    page.screenshot(path=os.path.join(OUT, f"{TAG}-03-chenliu-full.png"))

    # ---------- 4. 규모 맥스가 먼저 걸리는 성 — 특대형 · 인구 넉넉 ----------
    huge = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities.xuchang;
      c.size = 3; c.pop = 900000;           // 특대형 맥스 200,000 · 인구 30% = 270,000
      return { cap: E.cityTroopsCap(g, 'xuchang'), pop: E.cityPopOf(g, 'xuchang') };
    }""")
    step("특대형·인구 90만이면 규모 맥스 200,000이 걸린다", huge["cap"] == 200000, f"{huge['cap']:,}")
    open_city(page, "xuchang")
    mass = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities.xuchang;
      c.troops = 200000;
      for (const x of E.generalsInCity(g, 'xuchang')) x.acted = false;
      g.actionPoints = 6;
      const r = E.runCommand(g, 'draft', { cityId: 'xuchang', officerId: E.generalsInCity(g, 'xuchang')[0].id });
      return r;
    }""")
    step("규모 맥스에서 막히면 「특대형 성의 맥스」를 알린다",
         (not mass.get("ok")) and ("맥스" in mass.get("msg", "")), mass.get("msg", "")[:150])
    shot(page, "04-xuchang-sizemax")

    # ---------- 5. 턴을 넘기면 인구가 자란다 ----------
    grow = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const id = 'chenliu';
      const before = { pop: E.cityPopOf(g, id), cap: E.cityTroopsCap(g, id) };
      for (let i = 0; i < 6; i++) {
        g.actionPoints = 6; E.endTurnPhase1(g);
        g.pendingBattles = []; g.pendingEvent = null; g.pendingTournament = null;
        E.endTurnPhase2(g);
      }
      const after = { pop: E.cityPopOf(g, id), cap: E.cityTroopsCap(g, id) };
      return { before, after };
    }""")
    step("6개월이 지나면 인구가 늘고 상한도 줄지 않는다",
         grow["after"]["pop"] > grow["before"]["pop"] and grow["after"]["cap"] >= grow["before"]["cap"],
         f"인구 {grow['before']['pop']:,} → {grow['after']['pop']:,} · 상한 {grow['before']['cap']:,} → {grow['after']['cap']:,}")

    # ---------- 6. 화면 — 겹침·넘침 ----------
    close_sheet(page)
    mine = page.evaluate("""async () => {
      const E = await import('./js/engine.js'); const ui = await import('./js/ui.js');
      return E.factionCities(ui.game, ui.game.playerId).map((c) => c.id).slice(0, 3);
    }""")
    for i, cid in enumerate(mine):
        open_city(page, cid)
        ov = overflow(page)
        step(f"{cid} 성 시트 가로 넘침 0", ov["bad"] == [], ov["bad"])
        bad = overlap_stats(page)
        step(f"{cid} 칸 글자 겹침·잘림 0", bad == [], bad)
        shot(page, f"0{5 + i}-city-{cid}")

    step("콘솔 오류 0", not [e for e in errors if e[0] in ("console", "pageerror")], [e for e in errors if e[0] in ("console", "pageerror")][:3])

    print("\n== 요약 ==")
    ok = sum(1 for s in steps if s["ok"])
    print(f"{ok}/{len(steps)} 통과")
    for s in steps:
        if not s["ok"]:
            print("  FAIL", s["step"], "->", s["extra"])
    browser.close()
    sys.exit(0 if ok == len(steps) else 1)
