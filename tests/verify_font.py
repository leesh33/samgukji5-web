"""삼국 한 턴 — Gmarket Sans 적용 검증 (390×844 · iPhone UA · 실제 터치)

확인할 것
  A. self-host GmarketSans-Medium/Bold.woff2 가 200 으로 서빙되고 document.fonts 에서 loaded
  B. 본문·제목·버튼·전투 로그·모달의 computed font-family 1순위가 'Gmarket Sans'
  C. 공백 글리프 대체가 정상 — 띄어쓰기 폭이 0.5em 미만(이모지 폰트가 앞에 오면 1em 이상으로 벌어짐)
  D. 화면별 가로 넘침 0 · 세로 잘림 0 · 줄바꿈으로 잘린 라벨 없음
  E. 외부 폰트 CDN(fonts.googleapis.com) 요청 없음

사용: python3 samgukji5-web/tests/verify_font.py [URL] [TAG]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4188/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors, notes = [], [], {}
font_requests = []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:400]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:220] if extra != "" else ""), flush=True)


def shot(page, name):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path)
    print("SHOT " + os.path.basename(path), flush=True)
    return path


SCAN = """() => {
  const w = document.documentElement.clientWidth;
  const bad = [];
  const clip = [];
  const scrollable = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (['auto', 'scroll'].includes(cs.overflowX)) return true;
    }
    return false;
  };
  const visible = (el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (r.right > w + 1.5 || r.left < -1.5) {
      if (cs.position === 'fixed' || cs.overflow === 'hidden' || scrollable(el)) return;
      bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + ',' + Math.round(r.right));
    }
    // 세로로 잘린 글자 — 줄바꿈이 깨져 두 줄이 한 줄 높이에 갇힌 경우
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (hasText && visible(el) && cs.overflowY === 'hidden' && cs.textOverflow !== 'ellipsis'
        && el.scrollHeight > el.clientHeight + 2) {
      const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
      if (el.clientHeight < line * 1.9) {
        clip.push((el.id || el.className || el.tagName) + ':'
          + el.clientHeight + '<' + el.scrollHeight + ' "' + el.textContent.trim().slice(0, 24) + '"');
      }
    }
  });
  return {docW: document.documentElement.scrollWidth, winW: w, bad: bad.slice(0, 8), clip: clip.slice(0, 8)};
}"""

FONTS = """async () => {
  const faces = [...document.fonts].map(f => ({family: f.family, weight: f.weight, status: f.status}));
  const gm = faces.filter(f => f.family.replace(/["']/g, '') === 'Gmarket Sans');
  const checks = {};
  for (const spec of ['400 16px "Gmarket Sans"', '500 16px "Gmarket Sans"', '700 16px "Gmarket Sans"']) {
    checks[spec] = document.fonts.check(spec);
  }
  // 실제로 그 글꼴로 그려지는지 — 같은 글자 폭을 대체 폰트와 비교
  const probe = (family) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '40px ' + family;
    return c.measureText('삼국 한 턴 123').width;
  };
  const used = document.querySelector('.title-mark h1') || document.body;
  return {
    faces, gmarketFaces: gm, checks,
    widthGmarket: Math.round(probe('"Gmarket Sans"')),
    widthFallback: Math.round(probe('"Apple SD Gothic Neo", "Noto Sans KR", sans-serif'),
    ),
    bodyFamily: getComputedStyle(document.body).fontFamily,
    titleFamily: getComputedStyle(used).fontFamily,
  };
}"""

SPACE = """() => {
  const mk = (txt) => {
    const s = document.createElement('span');
    s.textContent = txt;
    s.style.cssText = 'position:absolute;left:-9999px;font-size:16px;font-weight:500;white-space:pre';
    s.style.fontFamily = getComputedStyle(document.body).fontFamily;
    document.body.appendChild(s);
    const wid = s.getBoundingClientRect().width;
    s.remove();
    return wid;
  };
  const noSpace = mk('가나다라');
  const withSpace = mk('가나 다라');
  return {noSpace: +noSpace.toFixed(2), withSpace: +withSpace.toFixed(2), space: +(withSpace - noSpace).toFixed(2)};
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:100], r.failure)))
    page.on("request", lambda r: font_requests.append(r.url) if ("font" in r.resource_type) or "fonts." in r.url else None)

    page.goto(BASE, wait_until="networkidle")
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(800)

    # ---------- A. 폰트 서빙 ----------
    info = page.evaluate(FONTS)
    weights = sorted({f["weight"] for f in info["gmarketFaces"]})
    loaded = [f for f in info["gmarketFaces"] if f["status"] == "loaded"]
    step("Gmarket Sans @font-face 등록(500·700)", {"500", "700"}.issubset(set(weights)), weights)
    used = {f["weight"] for f in info["gmarketFaces"] if f["status"] == "loaded"}
    step("쓰는 굵기 400·500·600·700 모두 loaded", {"400", "500", "600", "700"} <= used,
         sorted(used))
    step("document.fonts.check 400·500·700", all(info["checks"].values()), info["checks"])
    step("실제 렌더가 Gmarket Sans(대체 폰트와 폭 다름)",
         abs(info["widthGmarket"] - info["widthFallback"]) > 1,
         f'Gmarket {info["widthGmarket"]}px vs fallback {info["widthFallback"]}px')
    step("본문 1순위 'Gmarket Sans'", info["bodyFamily"].strip().startswith('"Gmarket Sans"')
         or info["bodyFamily"].strip().startswith("Gmarket Sans"), info["bodyFamily"])
    step("제목도 'Gmarket Sans'", "Gmarket Sans" in info["titleFamily"]
         and not info["titleFamily"].strip().startswith("Noto Serif"), info["titleFamily"])

    sp = page.evaluate(SPACE)
    step("띄어쓰기 폭 0.5em 미만(공백 글리프 대체 정상)", 0 < sp["space"] < 8, sp)

    # ---------- B. 화면별 확인 ----------
    def scan(tag, label):
        s = page.evaluate(SCAN)
        step(f"{label} — 가로 넘침 0", len(s["bad"]) == 0, s["bad"])
        step(f"{label} — 세로 잘림 0", len(s["clip"]) == 0, s["clip"])
        shot(page, tag)
        return s

    page.locator(".title-mark h1").wait_for()
    scan("font-01-title", "타이틀")

    page.click('[data-act="new"]')
    page.wait_for_timeout(350)
    scan("font-02-scenario", "시나리오 선택")

    # 신군주 생성 화면도 이모지·숫자가 많아 잘림 확인
    page.click('.sc-card[data-act="open-custom"]')
    page.wait_for_timeout(450)
    scan("font-03-custom", "신군주 생성")
    page.click('#scr-custom [data-act="back-scenario"]')
    page.wait_for_timeout(350)

    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    scan("font-04-lord", "군주 선택")

    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1100)
    step("본 게임 진입", page.locator("#scr-game").is_visible())
    scan("font-05-map", "지도")
    ratio = page.evaluate("() => Math.round(document.querySelector('#map').clientHeight / innerHeight * 100)")
    step("지도 세로 비중 45% 이상", ratio >= 45, f"{ratio}%")

    # 내정 시트 · 장수 선택
    if not page.locator("#citypanel").evaluate("el => el.classList.contains('open')"):
        page.click('.cs-toggle')
        page.wait_for_timeout(400)
    scan("font-06-citypanel", "성 시트")
    page.click('[data-act="cmd"][data-cmd="agri"]')
    page.wait_for_timeout(400)
    scan("font-07-sheet", "모달 시트")
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(300)

    # 전투 화면
    page.click('[data-act="march"]')
    page.wait_for_timeout(400)
    scan("font-08-march", "출진 시트")
    page.click('[data-act="march-go"]')
    page.wait_for_timeout(1000)
    scan("font-09-battle", "전투")
    for _ in range(6):
        if page.locator('[data-act="bt-close"]').count():
            break
        if page.locator('[data-act="bt-all"]').is_visible() and not page.locator('[data-act="bt-all"]').is_disabled():
            page.click('[data-act="bt-all"]')
        else:
            page.click('[data-act="bt-next"]')
        page.wait_for_timeout(1500)
    pages_note = page.evaluate("() => document.querySelector('#bt-log').innerText.trim().length")
    step("전투 로그 채워짐", pages_note > 0, pages_note)
    scan("font-10-battle-log", "전투 로그")

    # 외부 폰트 CDN 미사용
    ext = [u for u in font_requests if "fonts.googleapis.com" in u or "fonts.gstatic.com" in u]
    step("외부 폰트 CDN 요청 없음", len(ext) == 0, ext[:3])
    local_fonts = [u for u in font_requests if "GmarketSans" in u]
    step("GmarketSans woff2 자체 서빙 요청", len(local_fonts) > 0, [u.split("/")[-1] for u in local_fonts][:4])

    real_errors = [e for e in errors if "favicon" not in str(e)]
    step("콘솔·페이지 오류 0", len(real_errors) == 0, real_errors[:4])

    result = {"base": BASE, "tag": TAG, "ok": all(s["ok"] for s in steps), "steps": steps,
              "font": {k: info[k] for k in ("checks", "bodyFamily", "titleFamily", "widthGmarket", "widthFallback")},
              "space": sp, "errors": real_errors[:10]}
    with open(os.path.join(OUT, f"{TAG}-font-report.json"), "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("RESULT " + json.dumps({"ok": result["ok"], "fail": [s for s in steps if not s["ok"]],
                                  "errors": real_errors[:4]}, ensure_ascii=False), flush=True)
    browser.close()
