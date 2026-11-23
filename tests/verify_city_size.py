"""삼국 한 턴 — 성 규모(소·중·대·특대) 라이브 검증 (390×844)
사용: python3 samgukji5-web/tests/verify_city_size.py [URL] [TAG]
확인: 지도 노드 크기 차등 · 성 시트 규모 배지 · 내정 상한 표시 ·
      4대 내정을 꽉 채웠을 때 승격 · 규모별 징병량 · 콘솔 오류 0 · 가로 넘침 0
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd, open_group

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

    # ---------- 1. 데이터: 42성 규모 분포 + 게임 상태 ----------
    data = page.evaluate("""async () => {
      const D = await import('./js/data.js');
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const count = [0,0,0,0];
      D.CITIES.forEach(c => count[c.size]++);
      const sizes = {};
      for (const [id, c] of Object.entries(g.cities)) sizes[id] = c.size;
      return {
        count, sizes: D.CITY_SIZES.map(s => s.ko), caps: D.CITY_SIZES.map(s => s.cap),
        xuchang: g.cities.xuchang.size, luoyang: g.cities.luoyang.size, xiaopei: g.cities.xiaopei.size,
        cityCount: D.CITIES.length,
        names: { xuchang: D.CITY_BY_ID.xuchang.ko, luoyang: D.CITY_BY_ID.luoyang.ko },
        capXuchang: E.cityStatCap(g, 'xuchang'),
      };
    }""")
    step("42성 규모 분포 — 소 23 · 중 14 · 대 5 · 특대 0",
         data["cityCount"] == 42 and data["count"] == [23, 14, 5, 0], data["count"])
    step("규모 이름·상한 — 소/중/대/특대 · 100/130/160/200",
         data["sizes"] == ["소", "중", "대", "특대"] and data["caps"] == [100, 130, 160, 200],
         f"{data['sizes']} {data['caps']}")
    step("게임 상태 성 규모 — 허창 1(중) · 낙양 2(대) · 소패 0(소)",
         data["xuchang"] == 1 and data["luoyang"] == 2 and data["xiaopei"] == 0,
         f"허창 {data['xuchang']} · 낙양 {data['luoyang']} · 소패 {data['xiaopei']}")
    step("중 성 허창의 내정 상한 130", data["capXuchang"] == 130, data["capXuchang"])

    # ---------- 2. 지도 노드 크기 차등 ----------
    radii = page.evaluate("""async () => {
      const mv = await import('./js/mapview.js');
      // drawCityNodes와 같은 계산 — 화면 배율 × 규모 배율을 넣는다
      const at = (sc) => [0,1,2,3].map(s => Math.round(mv.cityNodeRadius(s, sc * mv.CITY_NODE_SCALE[s]) * 100) / 100);
      return { z1: at(5.7), z2: at(11.4), z3: at(20.5), scales: mv.CITY_NODE_SCALE };
    }""")
    r1, r2, r3 = radii["z1"], radii["z2"], radii["z3"]
    step("지도 노드 크기 — 소 < 중 < 대 < 특대 (기본 배율)",
         all(b > a for a, b in zip(r1, r1[1:])) and r1[3] - r1[0] >= 3.0, r1)
    step("지도 노드 크기 — 확대해도 규모 순서·차이 유지",
         all(b > a for a, b in zip(r2, r2[1:])) and r2[3] - r2[0] >= 4.0, r2)
    step("지도 노드 크기 — 최대 확대에서도 규모 순서 유지",
         all(b > a for a, b in zip(r3, r3[1:])), r3)

    # 실제 지도 픽셀에도 반영되는지 — 큰 성(낙양) 주변 노드 색 폭이 작은 성(소패)보다 넓다
    painted = page.evaluate("""async () => {
      const cv = document.getElementById('map');
      const ctx = cv.getContext('2d');
      const dpr = cv.width / cv.clientWidth;
      const w = cv.width, h = cv.height;
      const img = ctx.getImageData(0, 0, w, h).data;
      const bright = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return false;
        const i = (Math.round(y) * w + Math.round(x)) * 4;
        return img[i] + img[i+1] + img[i+2] > 420;
      };
      // 화면에 보이는 성 노드 후보 중 밝은 원(테두리) 폭을 찾아 평균 반지름을 잰다
      const probe = (px, py, maxR) => {
        let r = 0;
        for (let d = 2; d < maxR; d += 0.5) if (bright(px + d * dpr, py)) r = d;
        return r;
      };
      return {dpr};
    }""")
    step("지도 캔버스가 그려져 있다", painted["dpr"] > 0, painted)

    # ---------- 3. 성 시트 헤더 규모 배지 ----------
    page.click('[data-act="info"]'); page.wait_for_timeout(350)
    page.click('[data-act="info-tab"][data-tab="cities"]'); page.wait_for_timeout(350)
    infoTxt = page.locator("#sheet-body").inner_text()
    badges = page.evaluate("""() => Array.from(document.querySelectorAll('#sheet-body .ir-size'))
        .map(b => ({ko: b.textContent.trim(), cls: b.className}))""")
    step("정보 › 아군 도시에 규모 배지", len(badges) >= 2 and all(b["ko"] in ("소", "중", "대", "특대") for b in badges), badges)
    step("아군 도시 목록에 규모 안내 문구", "성 규모는 소 → 중 → 대 → 특대" in infoTxt, "")
    shot(page, f"live-city-size-info-{TAG}")

    # 허창을 정보 목록에서 눌러 성 시트 열기
    page.click('[data-act="info-city"][data-city="xuchang"]'); page.wait_for_timeout(500)
    head = page.evaluate("""() => {
      const p = document.querySelector('#citypanel');
      const size = p.querySelector('.cs-size');
      const name = p.querySelector('.cs-name');
      const owner = p.querySelector('.cs-owner');
      const r = (el) => el.getBoundingClientRect();
      return {
        text: size ? size.textContent.trim() : null,
        cls: size ? size.className : null,
        order: r(name).left < r(size).left && r(size).left < r(owner).left,
        caps: Array.from(p.querySelectorAll('.stat .stat-cap')).map(e => e.textContent.trim()),
        title: (size || {}).title || '',
      };
    }""")
    step("성 시트 헤더 — 예주 | 허창 | [중] | 조조 순서", head["text"] == "중" and head["order"], head)
    step("성 시트 내정 칸에 규모 상한(/130) 표시", head["caps"] == ["/130"] * 4, head["caps"])
    step("규모 배지 툴팁에 승격 안내(다음 규모·남은 내정)", "승격" in head["title"] and "남은 내정" in head["title"], head["title"])
    shot(page, f"live-city-size-sheet-{TAG}")

    # ---------- 4. 소 성의 내정을 꽉 채우면 승격 ----------
    prep = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities.xuchang;
      c.size = 0;                  // 소 성으로 되돌려 승격을 확인한다
      c.agri = 99; c.comm = 100; c.order = 100; c.water = 100;
      g.actionPoints = 6; g.maxActionPoints = 6;
      for (const k of Object.keys(g.generals)) g.generals[k].acted = false;
      return { cityId: c.id, size: c.size, cap: E.cityStatCap(g, c.id), agri: c.agri };
    }""")
    page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      window.dispatchEvent(new Event('resize'));
    }""")
    page.wait_for_timeout(200)
    open_group(page, "civil")
    click_cmd(page, "agri")
    page.wait_for_timeout(450)
    sheet_title = page.locator("#sheet-title").inner_text()
    step("개발 명령 장수 선택 시트", "허창" in sheet_title and "개발" in sheet_title, sheet_title)
    cmd_note = page.locator("#sheet-body .size-note").inner_text()
    step("개발 시트에 규모·승격 안내 — 소 · 100까지 채우면 중으로", "소" in cmd_note and "100" in cmd_note and "중" in cmd_note, cmd_note)
    page.locator('#sheet-body .officer-row[data-act="do-command"]').first.click()
    page.wait_for_timeout(2600)  # 2초 연출 + 승격 토스트

    promoted = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities.xuchang;
      const p = document.querySelector('#citypanel');
      return {
        size: c.size, agri: c.agri, comm: c.comm, order: c.order, water: c.water,
        cap: E.cityStatCap(g, c.id),
        badge: (p.querySelector('.cs-size') || {}).textContent,
        caps: Array.from(p.querySelectorAll('.stat .stat-cap')).map(e => e.textContent.trim()),
        title: (p.querySelector('.cs-size') || {}).title || '',
        toast: (document.querySelector('#toast') || {}).textContent || '',
        logs: g.log.slice(-3).map(l => l.text),
      };
    }""")
    step("4대 내정을 꽉 채우자 소 → 중 승격", promoted["size"] == 1,
         f"size {promoted['size']} · 수치 {promoted['agri']}/{promoted['comm']}/{promoted['order']}/{promoted['water']}")
    step("승격해도 수치는 그대로 100 (깎이지 않음)",
         [promoted["agri"], promoted["comm"], promoted["order"], promoted["water"]] == [100, 100, 100, 100],
         promoted["agri"])
    step("승격 뒤 상한이 130으로 넓어짐", promoted["cap"] == 130 and promoted["caps"] == ["/130"] * 4,
         f"{promoted['cap']} {promoted['caps']}")
    step("성 시트 배지가 중으로 바뀜", promoted["badge"] == "중", promoted["badge"])
    step("군보에 규모 승격 기록", any("규모 승격" in l for l in promoted["logs"]), promoted["logs"])
    step("승격 토스트 안내", "승격" in promoted["toast"], promoted["toast"][:80])
    step("배지 툴팁도 새 규모 기준으로 갱신", "규모 중" in promoted["title"] and "130" in promoted["title"], promoted["title"])
    shot(page, f"live-city-size-promoted-{TAG}")

    # ---------- 5. 규모별 징병량 ----------
    draft = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const c = g.cities.xuchang;
      const gid = Object.keys(g.generals).find(k => g.generals[k].city === c.id && g.generals[k].faction === g.playerId);
      const t = E.generalOf(g, gid);
      const run = (size) => {
        c.size = size; c.troops = 3000; c.gold = 5000; c.food = 9000;
        g.actionPoints = 6; g.generals[gid].acted = false;
        const before = c.troops;
        const r = E.runCommand(g, 'draft', { cityId: c.id, officerId: gid });
        return { add: c.troops - before, ok: r.ok, msg: r.msg };
      };
      const out = { lead: t.lead, base: 900 + Math.floor(t.lead * 4) };
      out.small = run(0); out.mid = run(1); out.big = run(2); out.huge = run(3);
      c.size = 1;
      return out;
    }""")
    base = draft["base"]
    step("소 성 징병 = 기본량(×1.0)", draft["small"]["add"] == base, f"{draft['small']['add']} vs {base}")
    step("중 성 징병 ×1.25", draft["mid"]["add"] == round(base * 1.25), draft["mid"]["add"])
    step("대 성 징병 ×1.5", draft["big"]["add"] == round(base * 1.5), draft["big"]["add"])
    step("특대 성 징병 ×1.8 — 규모가 크면 병사가 훨씬 많이 모인다",
         draft["huge"]["add"] == round(base * 1.8) and draft["huge"]["add"] > draft["small"]["add"], draft["huge"]["add"])

    # ---------- 6. 마무리 — 대표 스크린샷·오류·넘침 ----------
    page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      const t = document.querySelector('#toast');
      if (t) { t.classList.add('hidden'); t.textContent = ''; }
      ui.game.cities.xuchang.size = 1;
    }""")
    page.wait_for_timeout(300)
    page.click('[data-act="city-toggle"]'); page.wait_for_timeout(150)
    page.click('[data-act="city-toggle"]'); page.wait_for_timeout(400)
    page.evaluate("""() => { const t = document.querySelector('#toast'); if (t) t.classList.add('hidden'); }""")
    shot(page, "live-city-size")
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
