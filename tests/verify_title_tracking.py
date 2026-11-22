"""삼국 한 턴 — 타이틀 화면 자간 확인.
사용: python3 tests/verify_title_tracking.py [URL] [TAG]

검증 항목
  1. 타이틀 로고(`삼국 한 턴`) 자간이 자연스럽게 조여졌다(계산값 1px 이하)
  2. 타이틀 메뉴 버튼(`새 게임`·`이어하기`·`불러오기`) 자간도 1px 이하
  3. 로고·버튼이 화면을 넘지 않고, 가로 넘침 0 · 콘솔 오류 0 · 한자 0자
"""
import os
import sys

from playwright.sync_api import sync_playwright

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


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:100])))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1200)

    m = page.evaluate("""() => {
      const h1 = document.querySelector('.title-mark h1');
      const cs = getComputedStyle(h1);
      const btns = [...document.querySelectorAll('.title-menu .btn')].map(b => {
        const s = getComputedStyle(b);
        return {ko: b.textContent.trim(), ls: s.letterSpacing, fs: s.fontSize, w: Math.round(b.getBoundingClientRect().width)};
      });
      const r = h1.getBoundingClientRect();
      return {
        title: h1.textContent.trim(), ls: cs.letterSpacing, wordSpacing: cs.wordSpacing,
        fs: cs.fontSize, w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right),
        btns,
        docW: document.documentElement.scrollWidth, winW: document.documentElement.clientWidth,
      };
    }""")

    def px(v):
        try:
            return float(str(v).replace("px", ""))
        except Exception:
            return 999.0

    step("타이틀 로고 자간 1px 이하", abs(px(m["ls"])) <= 1.0, f"{m['title']} · letter-spacing {m['ls']}")
    step("로고가 화면 안에 들어옴", m["left"] >= 0 and m["right"] <= m["winW"], f"{m['left']}~{m['right']} / {m['winW']}")
    for b in m["btns"]:
        step(f"버튼 '{b['ko']}' 자간 1px 이하", abs(px(b["ls"])) <= 1.0, b)
    step("가로 넘침 없음", m["docW"] <= m["winW"], f"docW {m['docW']} / winW {m['winW']}")

    hanja = page.evaluate("""() => {
      const t = document.body.innerText || '';
      const x = t.match(/[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/g);
      return x ? x.length : 0;
    }""")
    step("화면 한자 0자", hanja == 0, hanja)
    step("콘솔·페이지 오류 0", len(errors) == 0, errors[:3])

    shot = os.path.join(OUT, f"{TAG}-title-tight-tracking.png")
    page.screenshot(path=shot)
    print("SHOT " + shot, flush=True)
    browser.close()

ok = sum(1 for s in steps if s["ok"])
print(f"\nSUMMARY {ok}/{len(steps)} OK", flush=True)
sys.exit(0 if ok == len(steps) else 1)
