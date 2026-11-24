"""삼국 한 턴 — 급료·군량 월 수지 · 출진 예상(승산) · 성 시트 장수 전원 표시 라이브 검증 (390×844)
사용: python3 samgukji5-web/tests/verify_balance.py [URL] [TAG]
확인: 성 시트에 「월 수지 금 ±N · 식량 ±N」과 급료·군량이 뜨고 세입−급료와 맞음 ·
      턴을 넘기면 금이 세입−급료만큼 움직임 ·
      출진 시트의 예상 전력이 승산 높음/반반/열세와 권장 병력을 보여 줌 ·
      장수가 13명인 성(184 원소의 계)에서도 12명에서 잘리지 않음 ·
      겹침·잘림·가로 넘침 0 · 콘솔 오류 0
"""
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import open_group

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
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if extra != "" else ""), flush=True)


def shot(page, name):
    path = os.path.join(OUT, f"{name}.png")
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


def open_city(page, city_id, wait=500):
    page.click('[data-act="info"]'); page.wait_for_timeout(280)
    page.click('[data-act="info-tab"][data-tab="cities"]'); page.wait_for_timeout(280)
    page.click(f'[data-act="info-city"][data-city="{city_id}"]'); page.wait_for_timeout(wait)


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

    # ---------- 1. 성 시트 — 금·식량 칸의 월 수지 ----------
    open_city(page, "chenliu")
    bal = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const cells = Array.from(document.querySelectorAll('#citypanel .cs-stats .stat'));
      const pick = (label) => cells.find(el => el.querySelector('i') && el.querySelector('i').textContent.trim().startsWith(label));
      const gold = pick('금'), food = pick('식량');
      const net = (el) => el && el.querySelector('.stat-net') ? el.querySelector('.stat-net').textContent.trim() : null;
      const lab = (el) => el && el.querySelector('i') ? el.querySelector('i').textContent.replace(/\\s+/g, '').trim() : null;
      const ref = E.cityMonthlyBalance(g, 'chenliu');
      return { goldNet: net(gold), foodNet: net(food), goldLabel: lab(gold), foodLabel: lab(food),
               goldTitle: gold ? gold.title : '', foodTitle: food ? food.title : '',
               ref, panelH: document.querySelector('#citypanel').getBoundingClientRect().height };
    }""")
    step("금 칸에 이번 달 수지(+N)가 붙는다", bool(bal["goldNet"]) and bal["goldNet"].startswith("+") and bal["goldLabel"].startswith("금"), f"{bal['goldLabel']} / {bal['goldNet']}")
    step("식량 칸에도 이번 달 수지가 붙는다", bool(bal["foodNet"]) and bal["foodLabel"].startswith("식량"), f"{bal['foodLabel']} / {bal['foodNet']}")
    step("금 칸 툴팁에 세입−급료가 적힌다", "급료" in bal["goldTitle"] and str(bal["ref"]["salary"]) in bal["goldTitle"].replace(",", ""), bal["goldTitle"])
    step("식량 칸 툴팁에 생산−군량이 적힌다", "군량" in bal["foodTitle"], bal["foodTitle"])
    shot(page, f"live-balance-city-{TAG}")

    # ---------- 2. 턴을 넘기면 금이 세입-급료만큼 움직인다 ----------
    turn = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities.chenliu;
      const before = c.gold;
      const bal = E.cityMonthlyBalance(g, 'chenliu');
      g.rngState = 2024;              // 재해(3.5%)를 피한다
      E.endTurnPhase2(g);
      return { before, after: c.gold, net: bal.goldNet, income: bal.goldIn, salary: bal.salary,
               logs: g.log.slice(-3).map(l => l.text) };
    }""")
    moved = turn["after"] - turn["before"]
    step("턴이 바뀌면 금이 세입−급료만큼 움직인다",
         abs(moved - turn["net"]) <= 1 or (turn["income"] and abs(moved - turn["net"]) <= round(turn["income"] * 0.16) + 1),
         f"{turn['before']} → {turn['after']} (net {turn['net']})")

    # ---------- 3. 출진 예상 — 승산 라벨과 권장 병력 ----------
    page.wait_for_timeout(300)
    open_city(page, "chenliu")
    open_group(page, "army")
    page.locator('[data-act="march"]').first.click()
    page.wait_for_timeout(500)
    mar = page.evaluate("""async () => {
      const note = Array.from(document.querySelectorAll('#sheet-body .note')).map(e => e.textContent.replace(/\\s+/g, ' ').trim()).join(' | ');
      return { text: note };
    }""")
    text = mar["text"]
    step("출진 시트에 「예상 전력」이 있다", "예상 전력" in text, text[:180])
    step("예상 전력에 승산(승산 높음/반반/열세)이 붙는다",
         any(k in text for k in ["승산 높음", "반반", "열세"]), text[:180])
    weak = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const enemyId = Object.keys(g.cities).find(cid => g.cities[cid].owner && g.cities[cid].owner !== g.playerId
        && E.adjacentFriends(g, cid).includes('chenliu')) || 'xuchang';
      const small = E.siegeOdds(g, 'chenliu', enemyId, { troops: 500 });
      const big = E.siegeOdds(g, 'chenliu', enemyId, { troops: 60000 });
      return { small, big };
    }""")
    step("병력이 적으면 열세, 많으면 우세로 갈린다",
         weak["small"]["label"] == "열세" and weak["big"]["label"] == "우세",
         f"{weak['small']['label']} / {weak['big']['label']}")
    step("권장 병력(수비를 이기려면 필요한 병력)이 계산된다", weak["small"]["recommend"] > 0, weak["small"]["recommend"])
    shot(page, f"live-balance-march-{TAG}")

    # ---------- 4. 장수가 13명인 성도 전원 보인다(184 원소의 계) ----------
    page.reload(wait_until="networkidle"); page.wait_for_timeout(700)
    page.click('[data-act="new"]'); page.wait_for_timeout(300)
    page.click('.sc-card[data-id="s184"]'); page.wait_for_timeout(350)
    if page.locator('.lord-card[data-id="yuanshao"]').count():
        page.click('.lord-card[data-id="yuanshao"]'); page.wait_for_timeout(1300)
        page.click('[data-act="info"]'); page.wait_for_timeout(280)
        page.click('[data-act="info-tab"][data-tab="cities"]'); page.wait_for_timeout(280)
        page.click('[data-act="info-city"][data-city="ji"]'); page.wait_for_timeout(600)
        counts = page.evaluate("""async () => {
          const ui = await import('./js/ui.js');
          const E = await import('./js/engine.js');
          const g = ui.game;
          const total = E.generalsInCity(g, 'ji').length;
          const shown = document.querySelectorAll('#citypanel .gen-chip').length;
          return { total, shown };
        }""")
        step("장수 13명인 성에서도 13명 모두 보인다(12명에서 잘리지 않음)",
             counts["shown"] == counts["total"] and counts["total"] >= 13, counts)
        shot(page, f"live-balance-gen13-{TAG}")

    # ---------- 5. 마무리 — 넘침·한자·오류 ----------
    ov = overflow(page)
    step("가로 넘침 0 (docW=390)", ov["docW"] <= 390 and not ov["bad"], ov)
    hanja = page.evaluate("""() => /[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/.test(document.body.innerText)""")
    step("화면에 한자 0자", hanja is False, hanja)
    errs = [e for e in errors if "favicon" not in e[1]]
    step("콘솔·페이지 오류 0", not errs, errs[:4])

    browser.close()

ok = all(s["ok"] for s in steps)
print(f"\n{'ALL OK' if ok else 'FAILED'} — {sum(1 for s in steps if s['ok'])}/{len(steps)} 단계", flush=True)
sys.exit(0 if ok else 1)
