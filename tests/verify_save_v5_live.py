"""도트삼국 — 옛 저장(v5) 호환 라이브 검증 (390×844)
v5 저장을 만들어 이어하기로 열고, 게임이 열리며 깃발 글자가 한글로 바뀌고 한자가 화면에 없음을 확인한다.
사용: python3 tests/verify_save_v5_live.py [URL] [TAG]
"""
import os
import re
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd, cmd_locator, menu_labels

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://dotsamguk.vercel.app"
TAG = sys.argv[2] if len(sys.argv) > 2 else "live"
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)
CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
fails = []


def step(label, ok, extra=""):
    if not ok:
        fails.append(label)
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if extra != "" else ""), flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    page.click('[data-act="new"]')
    page.wait_for_timeout(350)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(350)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(900)
    step("새 게임(저장 만들기)", page.locator("#scr-game").is_visible())

    # 저장을 v5 옛 양식으로 되돌린다: version=5, talked 없음, 세력에 hanja(옛 깃발 글자)만 있고 mark 없음
    made = page.evaluate("""() => {
      const raw = localStorage.getItem('samguk5.auto');
      if (!raw) return null;
      const s = JSON.parse(raw);
      s.version = 5;
      delete s.talked;
      for (const f of Object.values(s.factions || {})) { delete f.mark; f.hanja = 'A'; }
      localStorage.setItem('samguk5.auto', JSON.stringify(s));
      return { v: JSON.parse(localStorage.getItem('samguk5.auto')).version };
    }""")
    step("옛 v5 저장 주입", made is not None and made["v"] == 5, made)

    page.reload(wait_until="networkidle")
    page.wait_for_timeout(700)
    step("이어하기 버튼 활성", page.locator("#btn-continue").is_enabled())
    page.click('[data-act="continue"]')
    page.wait_for_timeout(1200)
    step("v5 저장으로 게임 열림", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())
    crest = page.locator("#hud-crest").inner_text()
    step("옛 깃발 글자가 한글로 대체", re.fullmatch(r"[가-힣]", crest) is not None, crest)
    body = page.evaluate("""() => {
      const t = document.body.innerText || '';
      const m = t.match(/[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/g);
      return { n: m ? m.length : 0, sample: m ? m.slice(0, 5).join('') : '' };
    }""")
    step("불러온 화면에 한자 없음", body["n"] == 0, body)
    step("성 시트·명령 동작", page.locator("#citypanel").is_visible()
         and [x.split("/")[0] for x in menu_labels(page)] == ["내정", "인사", "군사", "외교", "계략"], menu_labels(page))
    o = page.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    step("가로 넘침 없음", o)
    page.screenshot(path=os.path.join(OUT, f"{TAG}-save-v5.png"))
    print("SHOT save-v5.png", flush=True)

    # 이어하기 후 저장 양식이 최신으로 올라가는지(명령 1회 → 자동 저장)
    click_cmd(page, "agri")
    page.wait_for_timeout(350)
    if page.locator(".officer-row:not(.done)").count():
        page.locator(".officer-row:not(.done)").first.click()
        page.wait_for_timeout(450)
    v = page.evaluate("() => { const r = localStorage.getItem('samguk5.auto'); return r ? JSON.parse(r).version : null; }")
    step("저장 뒤 최신 양식(v7)", v == 7, v)

    errs = [e for e in errors if "favicon" not in str(e).lower()]
    step("콘솔 오류 0", len(errs) == 0, errs[:3])
    ctx.close()
    browser.close()

print("\n" + ("ALL PASS" if not fails else f"FAILED {len(fails)}: " + ", ".join(fails)))
sys.exit(0 if not fails else 1)
