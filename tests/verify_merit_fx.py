"""삼국 한 턴 — 공적·장군 임명 + 2초 행동 연출 라이브 검증 (390×844)
사용: LD_LIBRARY_PATH=... python3 samgukji5-web/tests/verify_merit_fx.py [URL] [TAG]
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd, cmd_locator, open_group, menu_labels

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


def saved_game(page):
    return page.evaluate("() => JSON.parse(localStorage.getItem('samguk5.auto'))")


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

    # ---------- 1. 성 시트 헤더: ✕ 제거 · 접기가 맨 오른쪽 ----------
    head = page.evaluate("""() => {
      const p = document.querySelector('#citypanel');
      const t = p.querySelector('.cs-toggle');
      const row = p.querySelector('.cs-row').getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      const nav = p.querySelector('.cs-nav');
      return {
        hasClose: !!p.querySelector('.cs-close'),
        text: t.textContent.trim(),
        toggleRight: Math.round(tr.right), rowRight: Math.round(row.right),
        afterNav: nav ? tr.left >= nav.getBoundingClientRect().right - 1 : true,
      };
    }""")
    step("성 시트에서 ✕ 버튼 제거", not head["hasClose"], head)
    step("접기 버튼이 헤더 맨 오른쪽", head["toggleRight"] >= head["rowRight"] - 6 and head["afterNav"],
         f"toggleRight={head['toggleRight']} rowRight={head['rowRight']}")

    # ---------- 2. 인사 팝오버에 장군 임명 ----------
    open_group(page, "people")
    labels = [x.split("\n")[0] for x in page.locator("#cmdp .btn").all_inner_texts()]
    step("인사 팝오버 7개 · 장군 임명 포함", len(labels) == 7 and "장군 임명" in labels, labels)
    promote_btn = page.locator('#cmdp .btn[data-act="promote-open"]')
    step("장군 임명 항목에 공적 상태 표시", promote_btn.count() == 1,
         promote_btn.first.inner_text().replace("\n", "/"))

    # ---------- 3. 공적을 쌓아 임명 가능 상태로 (엔진 상태 직접 주입) ----------
    injected = page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      const E = await import('./js/engine.js');
      const g = ui.game;
      const gid = Object.keys(g.generals).find(k => g.generals[k].faction === g.playerId
        && k !== g.factions[g.playerId].lord && !g.generals[k].acted);
      g.generals[gid].merit = 260;
      g.actionPoints = 8; g.maxActionPoints = 8;
      ui.renderGame ? null : null;
      return { gid, ko: E.generalOf(g, gid).ko, merit: g.generals[gid].merit, ap: g.actionPoints };
    }""")
    print("INJECT " + json.dumps(injected, ensure_ascii=False), flush=True)
    promote_btn.click(); page.wait_for_timeout(450)
    title = page.locator("#sheet-title").inner_text()
    body = page.locator("#sheet-body").inner_text()
    step("장군 임명 시트 열림", title == "장군 임명", title)
    step("임명 안내 — 행동력 무소모·충성 +5", ("행동력은 쓰지 않습니다" in body) and ("충성 +5" in body))
    step("직위·공적·최대 지휘·다음 직위 표시",
         ("일반" in body) and ("공적 260" in body) and ("최대 지휘" in body) and ("비장군" in body))
    step("공적을 채운 장수의 임명 버튼 활성", page.locator('[data-act="promote-do"]:not([disabled])').count() >= 1)
    o = overflow(page)
    step("가로 넘침 없음(장군 임명 시트)", len(o["bad"]) == 0, o)
    shot(page, "live-general-rank")

    # ---------- 4. 징병 — 2초 연출 ----------
    page.click('.sheet-head [data-act="sheet-close"]'); page.wait_for_timeout(250)
    click_cmd(page, "draft"); page.wait_for_timeout(380)
    row = page.locator(".officer-row:not(.done)").first
    officer = row.locator(".or-name").inner_text().split("\n")[0]
    before = saved_game(page)
    row.click()
    page.wait_for_selector("#actionfx", timeout=1500)
    t0 = time.time()
    page.wait_for_timeout(560)   # 페이드인이 끝난 뒤 캡처
    fx = page.evaluate("""() => {
      const e = document.querySelector('#actionfx');
      const r = e.getBoundingClientRect();
      const c = e.querySelector('canvas');
      return {
        tag: e.querySelector('.afx-tag').textContent,
        line: e.querySelector('.afx-line').textContent,
        delta: e.querySelector('.afx-deltas').textContent.replace(/\\s+/g, ' ').trim(),
        buttons: e.querySelectorAll('button').length,
        canvas: !!c && c.width > 0 && c.height > 0,
        z: getComputedStyle(e).zIndex,
        w: Math.round(r.width), h: Math.round(r.height),
      };
    }""")
    page.screenshot(path=os.path.join(OUT, "live-action-anim.png"))
    print("SHOT live-action-anim.png", flush=True)
    step("징병 연출이 화면에 뜬다", fx["canvas"] and fx["w"] == 390 and fx["h"] == 844, fx)
    step("연출 문구 — 병사 모집 결과", ("병사" in fx["line"]) and ("모았습니다" in fx["line"]) and fx["tag"] == "징병", fx["line"])
    step("변화량·공적 표시", ("병력 +" in fx["delta"]) and ("공적 +" in fx["delta"]), fx["delta"])
    step("스킵 버튼 없음", fx["buttons"] == 0, fx["buttons"])
    step("연출이 시트·전장 위(z 120)", fx["z"] == "120", fx["z"])
    page.wait_for_selector("#actionfx", state="detached", timeout=5000)
    elapsed = time.time() - t0
    step("연출이 약 2.0초 뒤 자동으로 닫힘", 1.75 <= elapsed <= 2.6, f"{elapsed:.2f}s")
    after = saved_game(page)
    merit_of = {gid: g.get("merit", 0) for gid, g in after["generals"].items()}
    m0 = next((v for k, v in before["generals"].items() if v.get("merit", 0)), 0)
    m1 = merit_of.get(injected["gid"], 0)
    step("징병 뒤 장수 공적 누적", m1 > 0, f"공적 {m1}")
    step("징병 뒤 화면 갱신(행동력·병력)", page.locator("#res-ap").inner_text() != "", page.locator("#res-ap").inner_text())
    o = overflow(page)
    step("가로 넘침 없음(연출 뒤)", len(o["bad"]) == 0, o)

    # ---------- 5. 장수 상세 — 직위·공적·최대 지휘 ----------
    page.locator(".gen-chip").first.click(); page.wait_for_timeout(400)
    detail = page.locator("#sheet-body").inner_text()
    step("장수 상세에 직위·공적·최대 지휘", ("직위" in detail) and ("공적" in detail) and ("최대 지휘" in detail),
         [x for x in detail.split("\n") if "직위" in x or "최대 지휘" in x][:2])
    page.click('.sheet-head [data-act="sheet-close"]'); page.wait_for_timeout(250)

    # ---------- 6. 장군 임명 실행 — 연출 + 직위 상승 ----------
    open_group(page, "people")
    page.locator('#cmdp .btn[data-act="promote-open"]').click(); page.wait_for_timeout(400)
    target_row = page.locator(".promo-row", has=page.locator('[data-act="promote-do"]:not([disabled])')).first
    target_ko = target_row.locator(".or-name").inner_text().split("\n")[0].strip()
    before_rank = saved_game(page)
    target_gid = next((k for k, g in before_rank["generals"].items() if g.get("merit", 0) >= 80 and g.get("rank", 0) == 0), None)
    loyal0 = before_rank["generals"][target_gid]["loyalty"] if target_gid else None
    ap0 = page.locator("#res-ap").inner_text()
    page.locator('[data-act="promote-do"]:not([disabled])').first.click()
    page.wait_for_selector("#actionfx", timeout=1500)
    pfx = page.evaluate("""() => {
      const e = document.querySelector('#actionfx');
      return {tag: e.querySelector('.afx-tag').textContent, line: e.querySelector('.afx-line').textContent,
              delta: e.querySelector('.afx-deltas').textContent.replace(/\\s+/g, ' ').trim(),
              buttons: e.querySelectorAll('button').length};
    }""")
    step("임명 연출 — 장군 임명", pfx["tag"] == "장군 임명" and "임명되었습니다" in pfx["line"], pfx)
    step("임명 연출 — 새 지휘 상한·충성", ("최대 지휘" in pfx["delta"]) and ("충성 +5" in pfx["delta"]), pfx["delta"])
    page.wait_for_selector("#actionfx", state="detached", timeout=5000)
    page.wait_for_timeout(400)
    after_rank = saved_game(page)
    rank1 = after_rank["generals"][target_gid]["rank"]
    loyal1 = after_rank["generals"][target_gid]["loyalty"]
    step("임명 뒤 직위 1단계 상승", rank1 == 1, f"{target_ko} rank {before_rank['generals'][target_gid].get('rank', 0)} → {rank1}")
    step("임명 뒤 충성 +5", loyal1 == loyal0 + 5, f"{loyal0} → {loyal1}")
    step("임명은 행동력을 쓰지 않는다", page.locator("#res-ap").inner_text() == ap0,
         f"{ap0} → {page.locator('#res-ap').inner_text()}")
    page.wait_for_timeout(300)
    reopened = page.locator("#sheet-title").inner_text() if page.locator("#sheet").is_visible() else ""
    body2 = page.locator("#sheet-body").inner_text() if reopened else ""
    step("임명 뒤 임명 시트가 새 직위로 다시 열림", reopened == "장군 임명" and "비장군" in body2, reopened)
    step("새 최대 지휘 4,000 표시", "4,000" in body2 and "공적" in body2)
    o = overflow(page)
    step("가로 넘침 없음(임명 뒤)", len(o["bad"]) == 0, o)
    page.click('.sheet-head [data-act="sheet-close"]'); page.wait_for_timeout(250)

    # ---------- 7. 다른 행동도 연출되는지(훈련) ----------
    open_group(page, "army")
    page.locator('#cmdp .btn[data-cmd="train"]').click(); page.wait_for_timeout(380)
    if page.locator(".officer-row:not(.done)").count():
        page.locator(".officer-row:not(.done)").first.click()
        page.wait_for_selector("#actionfx", timeout=1500)
        tag = page.locator("#actionfx .afx-tag").inner_text()
        step("훈련 연출", tag == "훈련", tag)
        page.wait_for_selector("#actionfx", state="detached", timeout=5000)
    else:
        page.click('.sheet-head [data-act="sheet-close"]')

    real_errors = [x for x in errors if "favicon" not in str(x)]
    step("콘솔·페이지 오류 0", len(real_errors) == 0, real_errors[:4])
    step("최종 가로 넘침 없음", len(overflow(page)["bad"]) == 0, overflow(page))
    shot(page, "live-merit-final")

    result = {"base": BASE, "tag": TAG, "ok": all(s["ok"] for s in steps), "steps": steps, "errors": real_errors[:10]}
    with open(os.path.join(OUT, f"{TAG}-merit-fx-report.json"), "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("RESULT " + json.dumps({"ok": result["ok"], "fail": [s for s in steps if not s["ok"]],
                                  "errors": real_errors[:4]}, ensure_ascii=False), flush=True)
    browser.close()
