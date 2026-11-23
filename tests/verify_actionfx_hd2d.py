"""삼국 한 턴 — HD-2D 행동 연출 12종 + 개인정보처리방침·이용약관 라이브 검증 (390×844)
사용: python3 tests/verify_actionfx_hd2d.py [URL] [TAG]
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd, open_group

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "/workspace/downloads/samguk5"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

KINDS = ["draft", "train", "agri", "comm", "order", "water", "hire", "befriend", "reward", "learn", "plot", "promote"]
KO = {"draft": "징병", "train": "훈련", "agri": "개발", "comm": "상업", "order": "치안", "water": "수리",
      "hire": "등용", "befriend": "친교", "reward": "포상", "learn": "진형 전수", "plot": "계략", "promote": "장군 임명"}

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


def canvas_sig(page):
    return page.evaluate("""() => {
      const c = document.querySelector('#actionfx canvas');
      if (!c) return null;
      const d = c.toDataURL();
      return {len: d.length, tail: d.slice(-120)};
    }""")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:120])))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1200)

    # ---------- 0. 배경 12장 미리 받기 ----------
    def bg_state():
        return page.evaluate("""() => {
          const rows = performance.getEntriesByType('resource').filter(e => e.name.includes('/assets/actionfx/'));
          return rows.map(e => ({name: e.name.split('/').pop(), size: e.decodedBodySize || 0,
                                 status: e.responseStatus || 200}));
        }""")

    deadline = time.time() + 12
    state = bg_state()
    while len([r for r in state if r["size"] > 0]) < 12 and time.time() < deadline:
        page.wait_for_timeout(300)
        state = bg_state()
    step("HD-2D 배경 12장을 미리 받아 둔다",
         len([r for r in state if r["size"] > 0]) == 12,
         f"{len([r for r in state if r['size'] > 0])}/12 · " + ", ".join(f"{r['name']}:{r['size'] // 1024}KB" for r in state[:4]))
    step("배경 webp 응답 모두 정상(200)", all(r["status"] == 200 for r in state) and len(state) == 12,
         [r for r in state if r["status"] != 200][:3])
    total_kb = sum(r["size"] for r in state) / 1024
    step("배경 12장 합계가 모바일에 가볍다(< 800KB)", total_kb < 800, f"{total_kb:.0f}KB")

    # ---------- 1. 게임 시작 ----------
    page.click('[data-act="new"]'); page.wait_for_timeout(300)
    page.click('.sc-card[data-id="s194"]'); page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]'); page.wait_for_timeout(1200)

    # ---------- 2. 징병 연출 — 배경·캔버스·60fps·2초 자동 종료 ----------
    page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      const g = ui.game; g.actionPoints = 9; g.maxActionPoints = 9;
      Object.values(g.generals).forEach(x => { if (x.faction === g.playerId) x.acted = false; });
    }""")
    page.evaluate("""() => {
      window.__afxT = {t0: 0, t1: 0};
      new MutationObserver(() => {
        const el = document.querySelector('#actionfx');
        if (el && !window.__afxT.t0) window.__afxT.t0 = performance.now();
        if (!el && window.__afxT.t0 && !window.__afxT.t1) window.__afxT.t1 = performance.now();
      }).observe(document.body, {childList: true, subtree: true});
    }""")
    click_cmd(page, "draft"); page.wait_for_timeout(400)
    page.locator(".officer-row:not(.done)").first.click()
    page.wait_for_selector("#actionfx", timeout=2000)
    page.wait_for_timeout(620)
    info = page.evaluate("""() => {
      const e = document.querySelector('#actionfx');
      const c = e.querySelector('canvas');
      const r = c.getBoundingClientRect();
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let mn = 255, mx = 0, sum = 0, n = 0;
      for (let i = 0; i < px.length; i += 4 * 97) {
        const v = (px[i] + px[i+1] + px[i+2]) / 3;
        mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; n++;
      }
      const bg = getComputedStyle(c).backgroundImage;
      return {
        tag: e.querySelector('.afx-tag').textContent,
        line: e.querySelector('.afx-line').textContent,
        delta: e.querySelector('.afx-deltas').textContent.replace(/\\s+/g, ' ').trim(),
        buttons: e.querySelectorAll('button').length,
        cw: c.width, ch: c.height,
        cssW: Math.round(r.width), cssH: Math.round(r.height),
        ratio: +(r.width / r.height).toFixed(3),
        z: getComputedStyle(e).zIndex,
        mn: Math.round(mn), mx: Math.round(mx), avg: Math.round(sum / n),
      };
    }""")
    shot(page, "live-action-anim-hd2d")
    sig1 = canvas_sig(page)
    page.wait_for_timeout(140)
    sig2 = canvas_sig(page)
    step("징병 연출이 뜬다 — 캔버스 720×405", info["cw"] == 720 and info["ch"] == 405, f"{info['cw']}x{info['ch']}")
    step("카드에서 16:9로 그려진다", abs(info["ratio"] - 16 / 9) < 0.02 and info["cssW"] > 300,
         f"{info['cssW']}x{info['cssH']} ratio {info['ratio']}")
    step("HD-2D 배경이 실제로 그려졌다(밝기 폭 넓음)", info["mx"] - info["mn"] > 90, info)
    step("레이어가 움직인다(두 프레임이 다름)", bool(sig1 and sig2 and (sig1["tail"] != sig2["tail"] or sig1["len"] != sig2["len"])),
         f"{sig1['len']} → {sig2['len']}")
    step("연출 문구·변화량·공적", "병사" in info["line"] and "공적 +" in info["delta"] and info["tag"] == "징병",
         (info["tag"], info["line"], info["delta"]))
    step("스킵 버튼 없음", info["buttons"] == 0, info["buttons"])
    step("연출이 가장 위 층(z 120)", info["z"] == "120", info["z"])
    page.wait_for_selector("#actionfx", state="detached", timeout=5000)
    life = page.evaluate("() => window.__afxT.t1 - window.__afxT.t0")
    step("약 2.0초 뒤 자동으로 닫힘(2초+짧은 페이드아웃)", 1900 <= life <= 2600, f"{life:.0f}ms")
    step("가로 넘침 없음(징병 뒤)", len(overflow(page)["bad"]) == 0, overflow(page))

    # ---------- 3. 12종 연출을 하나씩 띄워 배경·캔버스 확인 ----------
    seen = []
    for kind in KINDS:
        page.evaluate("""async (kind) => {
          const m = await import('./js/actionfx.js');
          window.__afx = m;
          m.playActionFx({kind, name: '관우', line: '연출 확인', delta: '변화 +1', merit: 5});
        }""", kind)
        page.wait_for_selector("#actionfx", timeout=2000)
        page.wait_for_timeout(560)
        st = page.evaluate("""() => {
          const c = document.querySelector('#actionfx canvas');
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let mn = 255, mx = 0, sum = 0, n = 0;
          for (let i = 0; i < d.length; i += 4 * 131) {
            const v = (d[i] + d[i+1] + d[i+2]) / 3;
            mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; n++;
          }
          return {tag: document.querySelector('#actionfx .afx-tag').textContent,
                  mn: Math.round(mn), mx: Math.round(mx), avg: Math.round(sum / n)};
        }""")
        seen.append({"kind": kind, **st})
        page.screenshot(path=os.path.join(OUT, f"fx-{kind}.png"))
        page.wait_for_selector("#actionfx", state="detached", timeout=5000)
    ok_all = all(s["tag"] == KO[s["kind"]] for s in seen)
    vivid = all((s["mx"] - s["mn"]) > 80 for s in seen)
    step("12종 모두 해당 이름으로 뜬다", ok_all, [(s["kind"], s["tag"]) for s in seen if s["tag"] != KO[s["kind"]]])
    step("12종 모두 배경 그림이 그려진다(어두운 화면 아님)", vivid,
         [(s["kind"], s["avg"]) for s in seen if (s["mx"] - s["mn"]) <= 80])
    step("12종 평균 밝기 — 모바일에서 읽힌다",
         all(15 <= s["avg"] <= 140 and s["mx"] >= 120 for s in seen), [(s["kind"], s["avg"]) for s in seen])

    # ---------- 4. 장군 임명 연출 ----------
    page.evaluate("""async () => {
      const ui = await import('./js/ui.js');
      const E = await import('./js/engine.js');
      const g = ui.game;
      const gid = Object.keys(g.generals).find(k => g.generals[k].faction === g.playerId
        && k !== g.factions[g.playerId].lord);
      g.generals[gid].merit = 300; g.actionPoints = 9; g.maxActionPoints = 9;
      ui.renderGame && ui.renderGame();
      return {gid, ko: E.generalOf(g, gid).ko};
    }""")
    if page.locator('#sheet:visible').count():
        page.locator('.sheet-head [data-act="sheet-close"]').click()
        page.wait_for_timeout(250)
    open_group(page, "people")
    page.locator('#cmdp .btn[data-act="promote-open"]').click(); page.wait_for_timeout(450)
    page.locator('[data-act="promote-do"]:not([disabled])').first.click()
    page.wait_for_selector("#actionfx", timeout=2000)
    page.wait_for_timeout(620)
    pf = page.evaluate("""() => {
      const e = document.querySelector('#actionfx');
      const c = e.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return {tag: e.querySelector('.afx-tag').textContent,
              line: e.querySelector('.afx-line').textContent,
              ratio: +(r.width / r.height).toFixed(3),
              cw: c.width};
    }""")
    page.screenshot(path=os.path.join(OUT, "live-action-anim-hd2d-promote.png"))
    step("장군 임명 연출도 HD-2D 배경·16:9", pf["tag"] == "장군 임명" and pf["cw"] == 720 and abs(pf["ratio"] - 16 / 9) < 0.02, pf)
    page.wait_for_selector("#actionfx", state="detached", timeout=5000)

    # ---------- 5. ☰ 메뉴 — 개인정보처리방침 · 이용약관 ----------
    if page.locator('#sheet:visible').count():
        page.locator('.sheet-head [data-act="sheet-close"]').click()
        page.wait_for_timeout(200)
    page.click('[data-act="menu"]'); page.wait_for_timeout(350)
    menu_txt = page.locator("#sheet-body").inner_text()
    step("☰ 메뉴에 개인정보처리방침·이용약관 항목", "개인정보처리방침" in menu_txt and "이용약관" in menu_txt,
         [x for x in menu_txt.split("\n") if "약관" in x or "처리방침" in x])

    page.locator('[data-act="legal-privacy"]').click(); page.wait_for_timeout(320)
    pv = page.evaluate("""() => {
      const m = document.querySelector('#legal');
      if (!m) return null;
      const box = m.querySelector('.legal-box').getBoundingClientRect();
      const body = m.querySelector('.legal-body');
      return {title: m.querySelector('h2').textContent,
              secs: m.querySelectorAll('.legal-sec').length,
              rows: m.querySelectorAll('.legal-row').length,
              text: body.innerText,
              w: Math.round(box.width), h: Math.round(box.height),
              z: getComputedStyle(m).zIndex,
              scrollable: body.scrollHeight > body.clientHeight + 4};
    }""")
    shot(page, "live-legal-privacy")
    step("개인정보처리방침 모달이 열린다", bool(pv) and pv["title"] == "개인정보처리방침" and pv["secs"] >= 12, pv and (pv["title"], pv["secs"]))
    step("읽기 쉬운 항목 — 표/목록으로 나뉨", pv and pv["rows"] >= 6 and pv["scrollable"], pv and (pv["rows"], pv["scrollable"]))
    step("구글·카카오 로그인·클라우드 저장·문의 안내", pv and all(k in pv["text"] for k in ["Google", "카카오", "클라우드", "andy.leesh33@gmail.com", "삼국 한 턴"]))
    step("모달이 카드 폭 안에 들어온다", pv and pv["w"] <= 380 and pv["h"] <= 844, pv and (pv["w"], pv["h"]))
    o = overflow(page)
    step("가로 넘침 없음(개인정보처리방침)", len(o["bad"]) == 0, o)

    page.locator("#legal .legal-foot .legal-close").click(); page.wait_for_timeout(250)
    step("닫으면 ☰ 메뉴로 돌아온다", page.locator("#legal").count() == 0 and "개인정보처리방침" in page.locator("#sheet-body").inner_text())

    page.locator('[data-act="legal-terms"]').click(); page.wait_for_timeout(320)
    tm = page.evaluate("""() => {
      const m = document.querySelector('#legal');
      if (!m) return null;
      const body = m.querySelector('.legal-body');
      body.scrollTop = body.scrollHeight;
      return {title: m.querySelector('h2').textContent,
              secs: m.querySelectorAll('.legal-sec').length,
              text: body.innerText,
              footVisible: m.querySelector('.legal-foot').getBoundingClientRect().bottom <= window.innerHeight + 1};
    }""")
    shot(page, "live-legal-terms")
    step("이용약관 모달이 열린다", bool(tm) and tm["title"] == "이용약관" and tm["secs"] >= 10, tm and (tm["title"], tm["secs"]))
    step("약관 — 계정·저장·지식재산권·문의", tm and all(k in tm["text"] for k in ["계정", "클라우드", "지식재산권", "andy.leesh33@gmail.com"]))
    step("스크롤해도 닫기 버튼이 붙어 있다", tm and tm["footVisible"], tm and tm["footVisible"])
    o = overflow(page)
    step("가로 넘침 없음(이용약관)", len(o["bad"]) == 0, o)
    page.locator("#legal .legal-head .legal-close").click(); page.wait_for_timeout(250)
    step("약관 닫기 — 모달 사라짐", page.locator("#legal").count() == 0)

    # ---------- 6. 기본 동작 회귀 — 성 시트 헤더·턴 진행 ----------
    if page.locator('#sheet:visible').count():
        page.locator('.sheet-head [data-act="sheet-close"]').click()
        page.wait_for_timeout(250)
    head = page.evaluate("""() => {
      const p = document.querySelector('#citypanel');
      return {open: !p.classList.contains('hidden'), toggle: !!p.querySelector('.cs-toggle'), close: !!p.querySelector('.cs-close')};
    }""")
    step("성 시트 헤더 유지(접기만, ✕ 없음)", head["open"] and head["toggle"] and not head["close"], head)

    real_errors = [x for x in errors if "favicon" not in str(x)]
    step("콘솔·페이지 오류 0", len(real_errors) == 0, real_errors[:5])
    step("최종 가로 넘침 0", len(overflow(page)["bad"]) == 0, overflow(page))
    shot(page, "live-actionfx-final")

    result = {"base": BASE, "tag": TAG, "ok": all(s["ok"] for s in steps), "steps": steps,
              "bg": state, "fx": seen, "errors": real_errors[:10]}
    with open(os.path.join(OUT, f"{TAG}-actionfx-hd2d-report.json"), "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("RESULT " + json.dumps({"ok": result["ok"], "fail": [s for s in steps if not s["ok"]],
                                  "errors": real_errors[:4]}, ensure_ascii=False), flush=True)
    browser.close()
