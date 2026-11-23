#!/usr/bin/env python3
"""도트삼국 — 병종 상성(기병>궁병>보병>기병) · 병종별 전장 특성 라이브 검증 (390×844)

사용:
  LD_LIBRARY_PATH=/workspace/.local/chromedeps/usr/lib/x86_64-linux-gnu python3 tests/verify_arm_affinity.py [URL] [TAG]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_march, march_locator, open_group

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "/workspace/downloads/samguk5"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors, shots = [], [], {}


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:300]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if str(extra) else ""), flush=True)


def shot(page, name):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path)
    shots[name] = path
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
      return { docW: document.documentElement.scrollWidth, winW: w, bad: bad.slice(0, 6) };
    }""")


def has_hanja(page):
    return page.evaluate("""() => {
      const RE = /[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/;
      const texts = [];
      const walk = (n) => {
        if (n.nodeType === 3) texts.push(n.nodeValue);
        else if (n.nodeType === 1 && !['SCRIPT', 'STYLE'].includes(n.tagName)) {
          for (const c of n.childNodes) walk(c);
        }
      };
      walk(document.body);
      const bad = texts.filter((t) => RE.test(t));
      return bad.slice(0, 3);
    }""")


def battle_state(page):
    return page.evaluate("""() => {
      const log = document.querySelector('#bt-log');
      const cards = [...document.querySelectorAll('[data-act=\"bt-select\"]')].map((b) => b.innerText.replace(/\\n/g, '/'));
      return {
        log: log ? log.innerText : '',
        cards,
        info: (document.querySelector('#bt-info') || {}).innerText || '',
        legend: (document.querySelector('#bt-legend') || {}).innerText || '',
        guide: (document.querySelector('#bt-guide') || {}).innerText || '',
        attackEnabled: (() => { const b = document.querySelector('[data-act=\"bt-attack\"]'); return !!(b && !b.disabled); })(),
      };
    }""")


def finish_battle(page, max_wait=30):
    for _ in range(max_wait):
        if page.locator('[data-act="bt-close"]').count():
            return True
        if not page.locator('#scr-battle').is_visible():
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


def go_city(page, name):
    for _ in range(6):
        if name in page.locator('#citypanel').inner_text():
            return True
        page.click('[data-act="city-next"]')
        page.wait_for_timeout(350)
    return name in page.locator('#citypanel').inner_text()


def march(page, target):
    if not march_locator(page).count():
        return False
    try:
        click_march(page)
    except Exception:
        return False
    page.wait_for_timeout(450)
    if page.locator(f'[data-act="march-target"][data-city="{target}"]').count():
        page.click(f'[data-act="march-target"][data-city="{target}"]')
        page.wait_for_timeout(250)
    return page.locator('[data-act="march-go"]').count() > 0


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:90], r.failure)))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(900)
    step("타이틀", page.locator(".title-mark h1").is_visible(), page.title())

    page.click('[data-act="new"]')
    page.wait_for_timeout(350)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1100)
    step("본 게임 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())

    # ---------- 부대 편성 시트: 병종 상성 안내 ----------
    go_city(page, "허창")
    page.wait_for_timeout(250)
    open_group(page, "army")
    page.wait_for_timeout(250)
    if page.locator('[data-act="army-reorg"]').count():
        page.click('[data-act="army-reorg"]')
        page.wait_for_timeout(500)
        guide = page.locator(".rg-arm-guide").inner_text() if page.locator(".rg-arm-guide").count() else ""
        step("부대 편성 상단 병종 상성 안내", "기병" in guide and "궁병" in guide and "보병" in guide, guide.replace("\n", " ")[:140])
        step("병종별 특징 안내(기동+1·사거리2·-15%)",
             all(k in guide for k in ("기동 +1", "사거리 2", "-15%")), guide.replace("\n", " ")[:160])
        step("수군 중립·물길 안내", "수군" in guide and "물길" in guide, guide.replace("\n", " ")[-80:])
        chips = page.locator(".rag-chip").count()
        step("병종 칩 3종", chips == 3, chips)
        arm_btns = page.locator(".rg-arm").count()
        titles = page.eval_on_selector_all(".rg-arm", "els => els.slice(0,3).map(e => e.title)")
        step("병종 버튼 툴팁에 상성·특징", all(t and "·" in t for t in titles), titles)
        page.wait_for_timeout(200)
        shot(page, "01-arm-sheet")
        page.locator('.sheet-head [data-act="sheet-close"]').click()
        page.wait_for_timeout(350)
    else:
        step("부대 편성 시트", False, "버튼 없음")

    # ---------- 전투 진입 ----------
    if not go_city(page, "허창"):
        step("내 성 전환(허창)", False, page.locator("#citypanel").inner_text()[:60])
    opened = march(page, "xiaopei")
    step("출진 시트", opened, page.locator("#sheet-title").inner_text() if opened else "")
    page.click('[data-act="march-go"]')
    page.wait_for_timeout(1400)
    st = battle_state(page)
    step("전투 진입", page.locator("#scr-battle").is_visible(), page.locator("#bt-name").inner_text())
    step("부대 카드에 병종 표시", any(any(a in c for a in ("기병", "궁병", "보병", "수군")) for c in st["cards"]),
         st["cards"][:3])
    step("전장 안내에 병종 상성 순환", "기병" in st["legend"] and "궁병" in st["legend"] and "보병" in st["legend"],
         st["legend"].replace("\n", " ")[:140])
    step("안내에 상성 배율(+20%/-15%)", "+20%" in st["legend"] and "-15%" in st["legend"], st["legend"].replace("\n", " ")[-70:])
    step("도움말에 병종 특징", "사거리2" in st["guide"] or "사거리 2" in st["guide"], st["guide"].replace("\n", " ")[-110:])
    shot(page, "02-battle-start")

    # ---------- 부대 선택 → 병종·특징 안내 ----------
    page.locator('[data-act="bt-select"]').first.click()
    page.wait_for_timeout(300)
    st = battle_state(page)
    step("선택 부대 정보에 병종·특징", "사거리" in st["info"] and any(a in st["info"] for a in ("기병", "궁병", "보병", "수군")),
         st["info"].replace("\n", " ")[:120])
    shot(page, "03-unit-info")

    # ---------- 공격 예상: 상성 배지 + 예상 피해 ----------
    def capture_hints(prefix, max_shots=3, max_waves=9):
        got = []
        for _ in range(max_waves):
            if page.locator('[data-act="bt-close"]').count():
                break
            if len(got) < max_shots:
                n = page.locator('[data-act="bt-select"]').count()
                for i in range(n):
                    if len(got) >= max_shots:
                        break
                    card = page.locator('[data-act="bt-select"]').nth(i)
                    try:
                        card.click(timeout=2000)
                    except Exception:
                        continue
                    page.wait_for_timeout(200)
                    if battle_state(page)["attackEnabled"]:
                        try:
                            page.click('[data-act="bt-attack"]', timeout=2000)
                        except Exception:
                            continue
                        page.wait_for_timeout(400)
                        got.append(shot(page, f"{prefix}-{len(got) + 1}"))
                        try:
                            card.click(timeout=2000)
                        except Exception:
                            pass
                        page.wait_for_timeout(120)
            if page.locator('[data-act="bt-close"]').count():
                break
            try:
                page.click('[data-act="bt-next"]', timeout=2000)
            except Exception:
                pass
            page.wait_for_timeout(1300)
        return got

    hint_shots = capture_hints("04-attack-hint", max_shots=4, max_waves=10)
    step("공격 예상 힌트(상성 배지·예상 피해) 노출", bool(hint_shots), len(hint_shots))

    log = battle_state(page)["log"]
    tags = [t for t in ("[상성 우위]", "[상성 열세]") if t in log]
    step("전투 로그에 병종 상성 문구", bool(tags), ",".join(tags))
    page.wait_for_timeout(200)
    shot(page, "05-battle-log")

    # ---------- 전투 종료 ----------
    if not page.locator('[data-act="bt-close"]').count():
        finish_battle(page)
    won = page.locator('[data-act="bt-close"]').count() > 0
    step("전투 종료 시트", won, page.locator("#sheet-title").inner_text() if won else "")
    if won:
        shot(page, "06-battle-result")
        page.click('[data-act="bt-close"]')
        page.wait_for_timeout(800)
        while page.locator('[data-act="prisoner-release"]').count():
            page.locator('[data-act="prisoner-release"]').first.click()
            page.wait_for_timeout(400)
        if page.locator('[data-act="prisoner-done"]').count():
            page.locator('[data-act="prisoner-done"]').click()
            page.wait_for_timeout(700)

    # ---------- 배포 코드 그대로 브라우저에서 병종 규칙 검증 ----------
    engine = page.evaluate("""async () => {
      const B = await import('./js/battle.js');
      const out = {};
      out.cycle = B.ARM_CYCLE_KO;
      out.rel = [B.armRelation('기병','궁병'), B.armRelation('궁병','보병'), B.armRelation('보병','기병')];
      out.rev = [B.armRelation('궁병','기병'), B.armRelation('보병','궁병'), B.armRelation('기병','보병')];
      out.navy = B.armRelation('수군','기병');
      const mk = (atkArms, defArms, gap) => {
        const b = B.createBattle({ fromCityId: 'xuchang', toCityId: 'chenliu', attackerFaction: 'jojo',
          defenderFaction: 'lubu', atkGenerals: ['cao_cao'], defGenerals: ['lu_bu'],
          atkTroops: 8000, defTroops: 8000, defBonus: 40, seed: 5 });
        b.grid.forEach((g) => { g.t = 'plain'; });
        const u = b.units.find((x) => x.side === 'atk'), t = b.units.find((x) => x.side === 'def');
        u.spec = { ...u.spec, arms: atkArms, war: 70, lead: 70, int: 40, skill: null };
        t.spec = { ...t.spec, arms: defArms, war: 70, lead: 70, int: 40, skill: null };
        u.formation = 'eorin'; t.formation = 'eorin';
        u.troops = 4000; t.troops = 4000; u.morale = 70; t.morale = 70;
        u.rankBonus = 0; t.rankBonus = 0; u.acted = false;
        u.x = 2; u.y = 3; t.x = 2 + gap; t.y = 3; u.dir = 'E'; t.dir = 'W';
        return { b, u, t };
      };
      const cav = mk('기병', '보병', 1), inf = mk('보병', '보병', 1);
      out.cavMp = B.movePoints(cav.u); out.infMp = B.movePoints(inf.u);
      const ar = mk('궁병', '보병', 2);
      out.archerRange = B.attackRange(ar.u);
      out.archerCanHit2 = B.canAttack(ar.b, ar.u, ar.t);
      const before = ar.u.troops;
      const r = B.attack(ar.b, ar.u, ar.t, 9);
      out.archerHit = r.ok; out.archerRanged = r.distance;
      out.archerCountered = ar.u.troops < before;
      const adv = mk('기병', '궁병', 1), neu = mk('기병', '기병', 1), dis = mk('기병', '보병', 1);
      out.advDamage = B.previewAttack(adv.b, adv.u, adv.t).damage;
      out.neuDamage = B.previewAttack(neu.b, neu.u, neu.t).damage;
      out.armGuard = B.armEdge(dis.b, dis.u, dis.t).guard;
      out.advRatio = +(out.advDamage / out.neuDamage).toFixed(3);
      out.preview = B.previewAttack(neu.b, neu.u, neu.t);
      out.previewKeys = Object.keys(out.preview).filter((k) => ['damage','counter','armRelation','edge'].includes(k));
      return out;
    }""")
    step("브라우저: 3각 상성 유리", engine["rel"] == ["advantage"] * 3, engine["rel"])
    step("브라우저: 3각 상성 불리", engine["rev"] == ["disadvantage"] * 3, engine["rev"])
    step("브라우저: 수군 중립", engine["navy"] == "neutral", engine["navy"])
    step("브라우저: 기병 기동 +1", engine["cavMp"] == engine["infMp"] + 1, f"{engine['cavMp']} vs {engine['infMp']}")
    step("브라우저: 궁병 사거리 2", engine["archerRange"] == 2 and engine["archerCanHit2"], engine["archerRange"])
    step("브라우저: 원거리 사격엔 반격 없음", engine["archerHit"] and engine["archerRanged"] == 2 and not engine["archerCountered"],
         f"거리 {engine['archerRanged']} · 반격 {engine['archerCountered']}")
    step("브라우저: 상성 우위 피해 +20%", abs(engine["advRatio"] - 1.2) < 0.02, engine["advRatio"])
    step("브라우저: 보병 받는 피해 -15%", abs(engine["armGuard"] - 0.85) < 1e-9, engine["armGuard"])
    step("브라우저: 미리보기 값(피해·반격·상성)", len(engine["previewKeys"]) == 4, engine["previewKeys"])

    # ---------- 마무리 점검 ----------
    o = overflow(page)
    step("가로 넘침 없음", len(o["bad"]) == 0, o)
    hz = has_hanja(page)
    step("화면에 한자 0자", len(hz) == 0, hz)
    step("콘솔 오류 0", len(errors) == 0, errors[:3])

    browser.close()

print("\n=== RESULT ===")
print(json.dumps({"steps": steps, "errors": errors, "shots": shots,
                  "pass": sum(1 for s in steps if s["ok"]), "total": len(steps)}, ensure_ascii=False, indent=1))
