"""삼국 한 턴 — 부대 편성(병사 재편 · 병종 변경) 라이브 검증 (390×844)
사용: python3 samgukji5-web/tests/verify_reorg.py [URL] [TAG]
확인: 군사 › 부대 편성 열기 · 배분/예비병 계산 · 병종 변경(금 100 · 행동력 0) ·
      저장 후 성 시트 칩·장수 상세 표시 · 출진 시 편성 병력 반영과 성 총병력 차감 ·
      패전 시 생존 병력 복귀 · 콘솔 오류 0 · 가로 넘침 0
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

# 페이지 안에서 쓰는 줄바꿈 정리 — 정규식 없이 (따옴표 이스케이프 실수 방지)
NL = "String.fromCharCode(10)"

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

    # ---------- 1. 군사 팝오버에 부대 편성 ----------
    open_group(page, "army")
    labels = [t.replace("\n", "/") for t in page.locator('#cmdp .btn').all_inner_texts()]
    step("군사 팝오버에 「부대 편성」 버튼", any(l.startswith("부대 편성") for l in labels), labels)
    step("팝오버 버튼 5개가 한 줄에 (징병·훈련·진형전수·부대 편성·출진)", len(labels) == 5, labels)
    ov = overflow(page)
    step("팝오버 가로 넘침 없음", ov["docW"] <= ov["winW"] and not ov["bad"], ov)

    # ---------- 2. 부대 편성 시트 ----------
    page.click('[data-act="army-reorg"]'); page.wait_for_timeout(500)
    title = page.locator("#sheet-title").inner_text()
    step("부대 편성 시트가 열린다", "부대 편성" in title, title)
    head = page.evaluate(f"""() => {{
      const q = (s) => {{ const e = document.querySelector(s); return e ? e.textContent.trim() : null; }};
      return {{
        total: q('#rg-total'), assigned: q('#rg-assigned'), reserve: q('#rg-reserve'),
        cards: document.querySelectorAll('#sheet-body .rg-card').length,
        arms: Array.from(document.querySelectorAll('#sheet-body .rg-card')).slice(0,1)
          .map(c => Array.from(c.querySelectorAll('.rg-arm')).map(b => b.textContent.trim())),
        quick: Array.from(document.querySelectorAll('#sheet-body .rg-card')).slice(0,1)
          .map(c => Array.from(c.querySelectorAll('.rg-quick button')).map(b => b.textContent.trim())),
        sliders: document.querySelectorAll('#sheet-body .rg-slider').length,
        note: document.querySelector('#sheet-body .note').textContent.split({NL}).join(' '),
      }};
    }}""")
    step("상단에 성 총병력 · 배분 합계 · 예비병", head["total"] == "8,600" and head["assigned"] == "0" and head["reserve"] == "8,600", head)
    step("장수별 카드 9장 (진류 주둔 장수)", head["cards"] == 9, head["cards"])
    step("카드마다 병종 버튼 보병·기병·궁병", head["arms"] == [["보병", "기병", "궁병"]], head["arms"])
    step("카드마다 -500 / +500 / 최대 / 비우기 · 슬라이더", head["quick"] == [["-500", "+500", "최대", "비우기"]] and head["sliders"] == 9, head["quick"])
    step("행동력 없이 바꾼다는 안내", "행동력은 쓰지 않습니다" in head["note"], head["note"])
    shot(page, f"live-reorg-sheet-{TAG}")

    # ---------- 3. 배분 · 저장 ----------
    card = page.locator('#sheet-body .rg-card').first
    for _ in range(3):
        card.locator('[data-act="reorg-step"][data-delta="500"]').click()
        page.wait_for_timeout(90)
    mid = page.evaluate("""() => {
      const q = (s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
      return {assigned: q('#rg-assigned'), reserve: q('#rg-reserve'),
              num: document.querySelector('#sheet-body .rg-nums b').textContent.trim()};
    }""")
    step("+500 세 번 — 배분 1,500 · 예비 7,100", mid["assigned"] == "1,500" and mid["reserve"] == "7,100" and mid["num"] == "1,500", mid)

    page.evaluate("""() => {
      const s = document.querySelectorAll('#sheet-body .rg-slider')[1];
      s.value = 2000;
      s.dispatchEvent(new Event('input', {bubbles: true}));
      s.dispatchEvent(new Event('change', {bubbles: true}));
    }""")
    page.wait_for_timeout(200)
    step("슬라이더로 2,000 배분", page.locator("#rg-assigned").inner_text() == "3,500", page.locator("#rg-assigned").inner_text())

    page.click('[data-act="reorg-save"]'); page.wait_for_timeout(500)
    st = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const b = E.armyBreakdown(g, 'chenliu');
      return {assigned: b.assigned, reserve: b.reserve, total: b.total,
              rows: b.rows.map(r => [r.gid, r.troops]),
              sheetHidden: document.querySelector('#sheet').classList.contains('hidden')};
    }""")
    step("저장하면 엔진에 편성이 들어간다 — 3,500 / 예비 5,100",
         st["assigned"] == 3500 and st["reserve"] == 5100 and st["total"] == 8600, st)

    # ---------- 4. 성 시트 장수 칩에 편성·병종 ----------
    chips = page.evaluate("""() => Array.from(document.querySelectorAll('#citypanel .gen-chip')).map(c => ({
      name: c.querySelector('span').textContent.trim(),
      line: c.querySelector('.gc-tr') ? c.querySelector('.gc-tr').textContent.trim() : null,
      w: Math.round(c.getBoundingClientRect().width),
    }))""")
    hd = [c for c in chips if c["name"] == "하후돈"]
    step("성 시트 칩에 편성 병력과 병종", bool(hd) and hd[0]["line"] == "기병1,500", hd)
    step("칩 너비가 흔들리지 않는다 (46~52px)", all(c["w"] <= 52 for c in chips), [c["w"] for c in chips])
    shot(page, f"live-reorg-chips-{TAG}")

    # ---------- 5. 병종 변경 ----------
    gold0 = page.evaluate("""async () => (await import('./js/ui.js')).game.cities.chenliu.gold""")
    ap0 = page.evaluate("""async () => (await import('./js/ui.js')).game.actionPoints""")
    open_group(page, "army")
    page.click('[data-act="army-reorg"]'); page.wait_for_timeout(400)
    page.locator('#sheet-body .rg-card').nth(1).locator('.rg-arm[data-arm="궁병"]').click()
    page.wait_for_timeout(400)
    arm = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      return {arm: E.armOf(g, 'cao_ren'), base: E.baseArmOf(g, 'cao_ren'),
              gold: g.cities.chenliu.gold, ap: g.actionPoints,
              on: Array.from(document.querySelectorAll('#sheet-body .rg-card'))[1]
                   .querySelector('.rg-arm.on').textContent.trim()};
    }""")
    step("병종 변경 — 조인 보병 → 궁병", arm["arm"] == "궁병" and arm["base"] == "보병" and arm["on"] == "궁병", arm)
    step("병종 변경은 금 100 — 행동력 0", arm["gold"] == gold0 - 100 and arm["ap"] == ap0, [gold0, arm["gold"], ap0, arm["ap"]])
    shot(page, f"live-reorg-arm-{TAG}")

    # ---------- 6. 장수 상세에 병종·편성 ----------
    page.locator('.sheet-head [data-act="sheet-close"]').click(); page.wait_for_timeout(250)
    page.click('#citypanel .gen-chip[data-gid="cao_ren"]'); page.wait_for_timeout(450)
    detail = page.locator("#sheet-body").inner_text().replace("\n", " / ")
    step("장수 상세에 병종(궁병 · 원래 보병)", "병종" in detail and "궁병" in detail and "원래 보병" in detail, detail[:180])
    step("장수 상세에 편성 병력 · 예비", "편성 병력" in detail and "예비" in detail, detail[:180])
    page.locator('.sheet-head [data-act="sheet-close"]').click(); page.wait_for_timeout(250)

    # ---------- 7. 균등 편성 ----------
    open_group(page, "army")
    page.click('[data-act="army-reorg"]'); page.wait_for_timeout(400)
    page.click('[data-act="reorg-plan"][data-mode="even"]'); page.wait_for_timeout(250)
    page.click('[data-act="reorg-save"]'); page.wait_for_timeout(500)
    ev = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const b = E.armyBreakdown(ui.game, 'chenliu');
      return {assigned: b.assigned, reserve: b.reserve, vals: b.rows.map(r => r.troops)};
    }""")
    step("균등 편성 — 9명에게 8,600을 고르게", ev["assigned"] == 8600 and ev["reserve"] == 0 and max(ev["vals"]) - min(ev["vals"]) <= 1, ev)

    # ---------- 8. 출진 시트에 편성 반영 ----------
    open_group(page, "army")
    page.click('[data-act="march"]'); page.wait_for_timeout(500)
    march = page.evaluate(f"""() => ({{
      title: document.querySelector('#sheet-title').textContent.trim(),
      tag: !!document.querySelector('#sheet-body .rg-tag'),
      body: document.querySelector('#sheet-body').innerText.split({NL}).join(' / '),
      stepper: !!document.querySelector('#march-ratio'),
      chips: Array.from(document.querySelectorAll('#sheet-body .pick-chip[data-act="march-gen"]'))
        .map(b => b.innerText.split({NL}).join(' ')).join(' | '),
    }})""")
    step("출진 시트 — 부대 편성 표시 · 병력 % 조절 대신 편성 안내", march["tag"] and not march["stepper"], march["body"][:160])
    step("출진 시트에 예비병이 성에 남는다는 안내", "예비병" in march["body"] and "부대 편성" in march["body"], march["body"][:200])
    step("출진 장수 칩에 장수별 편성 병력", "956" in march["chips"] or "955" in march["chips"], march["chips"][:160])

    before = page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      return {troops: ui.game.cities.chenliu.troops};
    }""")
    page.click('[data-act="march-go"]'); page.wait_for_timeout(900)
    after = page.evaluate(f"""async () => {{
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const el = document.querySelector('#scr-battle');
      return {{troops: g.cities.chenliu.troops, battle: !el.classList.contains('hidden'),
              cards: document.querySelectorAll('#scr-battle .bt-card').length,
              text: el.innerText.split({NL}).join(' ').slice(0, 200)}};
    }}""")
    step("출진하면 편성 병력만큼 성 총병력에서 차감", after["troops"] < before["troops"] and after["battle"], [before, after])
    step("전장에 출진 부대가 선다", after["cards"] >= 1, after["cards"])
    shot(page, f"live-reorg-battle-{TAG}")

    # ---------- 9. 후퇴 — 생존 병력이 성으로 복귀 ----------
    page.click('[data-act="bt-retreat"]'); page.wait_for_timeout(900)
    res = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const b = E.armyBreakdown(g, 'chenliu');
      return {title: document.querySelector('#sheet-title').textContent.trim(),
              troops: g.cities.chenliu.troops, assigned: b.assigned, reserve: b.reserve,
              marchGens: ['xiahou_dun','cao_ren','yue_jin','dian_wei','xun_you'].map(id => E.assignedOf(g, id)),
              marchTroops: after0};
    }""".replace("after0", str(before["troops"] - after["troops"])))
    step("후퇴하면 전투 결과가 반영되고 생존 병력이 성으로 돌아온다",
         res["title"] in ("승전", "패전") and res["troops"] >= before["troops"] - res["marchTroops"] - 1, res)
    step("복귀한 병력은 예비병으로 — 나선 장수 편성 0 · 성에 남은 장수 편성 유지",
         res["assigned"] + res["reserve"] == res["troops"] and res["reserve"] >= 1
         and res["marchGens"] == [0, 0, 0, 0, 0], [res["troops"], res["assigned"], res["reserve"], res["marchGens"]])
    page.click('[data-act="bt-close"]'); page.wait_for_timeout(800)

    # ---------- 10. 편성 없이 출진하면 기존 방식 ----------
    open_group(page, "army")
    page.click('[data-act="army-reorg"]'); page.wait_for_timeout(400)
    page.click('[data-act="reorg-plan"][data-mode="none"]'); page.wait_for_timeout(200)
    page.click('[data-act="reorg-save"]'); page.wait_for_timeout(450)
    cleared = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const b = E.armyBreakdown(ui.game, 'chenliu');
      return {assigned: b.assigned, reserve: b.reserve};
    }""")
    step("모두 해제로 편성을 비우면 모두 예비병", cleared["assigned"] == 0 and cleared["reserve"] == 8600, cleared)
    open_group(page, "army")
    page.click('[data-act="march"]'); page.wait_for_timeout(450)
    legacy = page.evaluate("""() => ({
      stepper: !!document.querySelector('#march-ratio'),
      tag: !!document.querySelector('#sheet-body .rg-tag'),
    })""")
    step("편성이 없으면 기존 병력 % 조절이 그대로", legacy["stepper"] and not legacy["tag"], legacy)
    page.locator('.sheet-head [data-act="sheet-close"]').click(); page.wait_for_timeout(250)

    # ---------- 11. 저장·불러오기 호환 ----------
    save = page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      E.applyReorg(ui.game, 'chenliu', { xiahou_dun: 2000 });
      const raw = E.serialize(ui.game);
      const back = E.deserialize(raw);
      return {version: back.version, assigned: E.assignedOf(back, 'xiahou_dun'),
              arm: E.armOf(back, 'cao_ren'), json: raw.includes('assignedTroops')};
    }""")
    step("저장 양식 v12 — 편성·병종이 저장에 들어간다",
         save["version"] == 12 and save["assigned"] == 2000 and save["arm"] == "궁병" and save["json"], save)

    # ---------- 12. 한자 0자 · 콘솔 · 넘침 ----------
    hanja = page.evaluate("""() => {
      const CJK = new RegExp('[' + String.fromCharCode(0x3400) + '-' + String.fromCharCode(0x4dbf)
        + String.fromCharCode(0x4e00) + '-' + String.fromCharCode(0x9fff) + ']');
      const hits = [];
      document.querySelectorAll('body *').forEach(el => {
        if (el.children.length) return;
        const t = el.textContent || '';
        if (CJK.test(t)) hits.push(t.trim().slice(0, 20));
      });
      return hits.slice(0, 5);
    }""")
    step("화면에 한자 0자", not hanja, hanja)
    ov = overflow(page)
    step("가로 넘침 0", ov["docW"] <= ov["winW"] and not ov["bad"], ov)
    step("콘솔 오류 0", not errors, errors[:4])

    shot(page, f"live-reorg-{TAG}")
    shot(page, "live-reorg")
    browser.close()

total = len(steps)
ok = sum(1 for s in steps if s["ok"])
print(f"\n=== {ok}/{total} OK · {TAG} ===")
sys.exit(0 if ok == total else 1)
