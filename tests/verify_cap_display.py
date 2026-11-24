"""삼국 한 턴 — 치안 100 상한 · 포상 실제 상승분 표기 · 부대 편성 일괄 버튼 위치 라이브 검증 (390×844)
사용: python3 samgukji5-web/tests/verify_cap_display.py [URL] [TAG]
확인: 중형 성의 치안 칸이 /100으로 표시되고 100에서 더 오르지 않음 ·
      포상 충성 85 → 100에서 연출·군보 모두 "+15"(캡 전 수치 아님) ·
      부대 편성의 균등 편성·상한 채우기·모두 해제가 요약 바 바로 아래(스크롤 없이 보임) ·
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


def shot(page, name, full=False):
    path = os.path.join(OUT, f"{name}.png")
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


def open_city(page, city_id, wait=500):
    """정보 › 아군 도시에서 성을 눌러 성 시트를 연다(게임 상태를 바꾼 뒤 다시 그릴 때 쓴다)."""
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

    # ---------- 1. 성 시트 — 성 규모 라벨과 수치별 상한 ----------
    labels = page.evaluate("""async () => {
      const D = await import('./js/data.js');
      return D.CITY_SIZES.map(s => s.ko);
    }""")
    step("성 규모 이름 — 소형 · 중형 · 대형 · 특대형", labels == ["소형", "중형", "대형", "특대형"], labels)

    page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities.xuchang;      // 중형(상한 130)
      c.order = 93; c.agri = 130; c.comm = 104; c.water = 77;
      g.actionPoints = 6; g.maxActionPoints = 6;
      for (const k of Object.keys(g.generals)) g.generals[k].acted = false;
    }""")
    open_city(page, "xuchang")

    head = page.evaluate("""() => {
      const p = document.querySelector('#citypanel');
      const badge = p.querySelector('.cs-size');
      return {
        badge: badge ? badge.textContent.trim() : null,
        title: badge ? badge.title : '',
        caps: Array.from(p.querySelectorAll('.stat .stat-cap')).slice(0, 4).map(e => e.textContent.trim()),
        statText: Array.from(p.querySelectorAll('.cs-stats .stat')).map(e => e.textContent.replace(/\\s+/g, ' ').trim()),
      };
    }""")
    step("성 시트 배지 — 중형", head["badge"] == "중형", head["badge"])
    step("성 시트 내정 칸 상한 — 농업·상업 /130 · 치안 /100 · 수리 /130",
         head["caps"] == ["/130", "/130", "/100", "/130"], head["caps"])
    step("치안 칸이 「치안 93 /100」로 보인다", any("치안" in t and "93" in t and "/100" in t for t in head["statText"]), head["statText"])
    step("규모 배지 툴팁 — 중형 · 농업·상업·수리 130 · 치안 100",
         "규모 중형" in head["title"] and "130" in head["title"] and "치안 100" in head["title"], head["title"])
    shot(page, f"live-cap-city-sheet-{TAG}")

    # ---------- 2. 치안 명령 — 100에서 멈추고 실제 상승분만 ----------
    page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      const p = document.querySelector('#citypanel');
      const c = ui.game.cities.xuchang;
      c.order = 98;
    }""")
    page.wait_for_timeout(200)
    open_group(page, "civil")
    page.locator('[data-act="cmd"][data-cmd="order"]').first.click()
    page.wait_for_timeout(400)
    note = page.locator("#sheet-body .size-note").inner_text()
    step("치안 명령 시트 안내 — 중형 · 농업·상업·수리 130 · 치안 100",
         "중형" in note and "치안 100" in note and "130" in note, note)
    shot(page, f"live-cap-order-sheet-{TAG}")
    page.locator('#sheet-body .officer-row[data-act="do-command"]').first.click()
    page.wait_for_timeout(2600)
    order = page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities.xuchang;
      const p = document.querySelector('#citypanel');
      return {
        order: c.order,
        caps: Array.from(p.querySelectorAll('.stat .stat-cap')).slice(0, 4).map(e => e.textContent.trim()),
        logs: g.log.slice(-2).map(l => l.text),
      };
    }""")
    step("치안 98 → 100에서 멈춘다(중형이어도 100 초과 없음)", order["order"] == 100, order["order"])
    step("치안 명령 뒤에도 치안 칸은 /100", order["caps"][2] == "/100", order["caps"])
    step("군보에 실제 상승분(+2)만 적힌다",
         any("치안을 2 올렸습니다" in l for l in order["logs"]) and not any("치안을 3" in l or "치안을 4" in l for l in order["logs"]),
         order["logs"])

    # ---------- 3. 포상 — 충성 85 → 100, "+15"로 표기 ----------
    page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const E = await import('./js/engine.js');
      const c = g.cities.xuchang;
      const lord = g.factions[g.playerId].lord;
      const target = E.generalsInCity(g, c.id).find(x => x.id !== lord);
      target.loyalty = 85;
      window.__rewardTarget = target.id;
      g.actionPoints = 6;
      for (const k of Object.keys(g.generals)) g.generals[k].acted = false;
      c.gold = 5000;
    }""")
    page.wait_for_timeout(200)
    open_group(page, "people")
    page.locator('[data-act="cmd"][data-cmd="reward"]').first.click()
    page.wait_for_timeout(400)
    targets = page.evaluate("""() => {
      const id = window.__rewardTarget;
      const rows = Array.from(document.querySelectorAll('#sheet-body .officer-row[data-act="do-reward"]'));
      const row = rows.find(r => r.dataset.officer === id);
      const box = row ? row.getBoundingClientRect() : null;
      return { count: rows.length, found: !!row, disabled: row ? row.disabled : null, y: box ? Math.round(box.top) : null };
    }""")
    step("포상 시트에 대상 장수(충성 85)가 있다", targets["found"] and not targets["disabled"], targets)
    shot(page, f"live-cap-reward-sheet-{TAG}")
    page.evaluate("""() => {
      const id = window.__rewardTarget;
      document.querySelector(`#sheet-body .officer-row[data-act="do-reward"][data-officer="${id}"]`).click();
    }""")
    page.wait_for_timeout(700)   # 2초 연출 도중 — 변화량 배지가 떠 있는 순간
    fx = page.evaluate("""() => {
      const ov = document.querySelector('.afx');
      const d = ov ? ov.querySelector('.afx-deltas b') : null;
      const line = ov ? ov.querySelector('.afx-line') : null;
      return { open: !!ov, delta: d ? d.textContent.trim() : null, line: line ? line.textContent.trim() : null };
    }""")
    step("포상 연출이 뜬다", fx["open"], fx)
    step("연출 변화량 — 「충성 +15」(캡 전 20이 아님)", fx["delta"] == "충성 +15", fx["delta"])
    shot(page, f"live-cap-reward-fx-{TAG}")
    page.wait_for_timeout(2200)
    after = page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const t = g.generals[window.__rewardTarget];
      return { loyalty: t.loyalty, logs: g.log.slice(-2).map(l => l.text) };
    }""")
    step("포상 뒤 충성 100", after["loyalty"] == 100, after["loyalty"])
    step("군보 — 「충성도가 15 올랐습니다 (충성 85 → 100)」",
         any("충성도가 15 올랐습니다" in l and "85 → 100" in l for l in after["logs"]), after["logs"])

    # ---------- 4. 부대 편성 — 일괄 버튼이 요약 바 바로 아래 ----------
    open_city(page, "chenliu")
    open_group(page, "army")
    page.locator('[data-act="army-reorg"]').first.click()
    page.wait_for_timeout(500)
    layout = page.evaluate("""() => {
      const body = document.querySelector('#sheet-body');
      const sum = document.querySelector('.rg-sum');
      const acts = document.querySelector('.rg-acts');
      const list = document.querySelector('.rg-list');
      const guide = document.querySelector('.rg-arm-guide');
      const r = (el) => el ? el.getBoundingClientRect() : null;
      const btns = acts ? Array.from(acts.querySelectorAll('button')).map(b => {
        const br = b.getBoundingClientRect();
        return { ko: b.textContent.trim(), top: Math.round(br.top), bottom: Math.round(br.bottom),
                 w: Math.round(br.width), h: Math.round(br.height), font: parseFloat(getComputedStyle(b).fontSize) };
      }) : [];
      return {
        scrollTop: body.scrollTop,
        bodyTop: Math.round(r(body).top), bodyBottom: Math.round(r(body).bottom),
        sumBottom: Math.round(r(sum).bottom), actsTop: Math.round(r(acts).top), actsBottom: Math.round(r(acts).bottom),
        listTop: Math.round(r(list).top), guideTop: Math.round(r(guide).top),
        cards: document.querySelectorAll('.rg-card').length,
        btns,
      };
    }""")
    step("부대 편성 시트 — 일괄 버튼 3개(균등 편성·상한 채우기·모두 해제)",
         [b["ko"] for b in layout["btns"]] == ["균등 편성", "상한 채우기", "모두 해제"], layout["btns"])
    step("일괄 버튼이 장수 목록 위에 있다", layout["actsBottom"] <= layout["listTop"], f"acts {layout['actsTop']}-{layout['actsBottom']} · list {layout['listTop']}")
    step("요약 바 바로 아래에 붙어 있다(간격 16px 이내)", 0 <= layout["actsTop"] - layout["sumBottom"] <= 16,
         f"sum {layout['sumBottom']} → acts {layout['actsTop']}")
    step("일괄 버튼이 병종 안내보다 위", layout["actsBottom"] <= layout["guideTop"], f"acts {layout['actsBottom']} · guide {layout['guideTop']}")
    step("스크롤 없이(맨 위 상태) 시트 안에 다 보인다",
         layout["scrollTop"] == 0 and all(b["top"] >= layout["bodyTop"] and b["bottom"] <= layout["bodyBottom"] for b in layout["btns"]),
         {"scrollTop": layout["scrollTop"], "body": (layout["bodyTop"], layout["bodyBottom"]), "btns": layout["btns"]})
    step("버튼 높이 40px 이상 · 글자 11px 이상(잘리지 않음)",
         all(b["h"] >= 40 and b["font"] >= 11 for b in layout["btns"]), layout["btns"])
    step("장수 카드는 그대로 목록에 있다", layout["cards"] >= 5, layout["cards"])
    shot(page, f"live-cap-reorg-top-{TAG}")

    # 누르면 실제로 동작하고, 다시 그려져도 버튼은 맨 위에 남는다
    page.locator('.rg-acts [data-act="reorg-plan"][data-mode="even"]').click(); page.wait_for_timeout(400)
    after_click = page.evaluate("""() => {
      const q = (s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
      const body = document.querySelector('#sheet-body');
      const acts = document.querySelector('.rg-acts');
      const list = document.querySelector('.rg-list');
      const r = (el) => el.getBoundingClientRect();
      return { assigned: q('#rg-assigned'), reserve: q('#rg-reserve'),
               actsBottom: Math.round(r(acts).bottom), listTop: Math.round(r(list).top), scrollTop: body.scrollTop };
    }""")
    step("균등 편성을 누르면 배분이 채워진다", after_click["assigned"] != "0", after_click)
    step("다시 그려져도 일괄 버튼은 목록 위·맨 위 화면", after_click["actsBottom"] <= after_click["listTop"] and after_click["scrollTop"] == 0, after_click)
    shot(page, f"live-cap-reorg-even-{TAG}")

    # ---------- 5. 마무리 — 넘침·겹침·오류 ----------
    ov = overflow(page)
    step("가로 넘침 0 (docW=390)", ov["docW"] <= 390 and not ov["bad"], ov)
    overlap = page.evaluate("""() => {
      const q = (s) => document.querySelector(s);
      const pairs = [['.rg-sum', '.rg-acts'], ['.rg-acts', '.rg-arm-guide'], ['.rg-acts', '.rg-list']];
      const out = [];
      for (const [a, b] of pairs) {
        const ra = q(a).getBoundingClientRect(), rb = q(b).getBoundingClientRect();
        const over = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (over > 0.5) out.push(a + '↔' + b + ':' + Math.round(over));
      }
      return out;
    }""")
    step("부대 편성 상단 요소끼리 겹침 0", not overlap, overlap)
    hanja = page.evaluate("""() => /[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/.test(document.body.innerText)""")
    step("화면에 한자 0자", hanja is False, hanja)
    errs = [e for e in errors if "favicon" not in e[1]]
    step("콘솔·페이지 오류 0", not errs, errs[:4])

    browser.close()

ok = all(s["ok"] for s in steps)
print(f"\n{'ALL OK' if ok else 'FAILED'} — {sum(1 for s in steps if s['ok'])}/{len(steps)} 단계", flush=True)
sys.exit(0 if ok else 1)
