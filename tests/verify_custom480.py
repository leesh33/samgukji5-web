"""도트삼국 — 신군주 주사위 1% 전설(480) 검증 (390×844 · iPhone UA · 실제 터치)

사용:
  LD_LIBRARY_PATH=/workspace/.local/chromedeps/usr/lib/x86_64-linux-gnu \
    python3 tests/verify_custom480.py [URL] [TAG]
  예) 로컬: python3 tests/verify_custom480.py http://127.0.0.1:4173/index.html local
      라이브: python3 tests/verify_custom480.py https://dotsamguk.vercel.app/ live

TAG=live 로 돌리면 대표 스크린샷이 downloads/samguk5/live-custom-480.png 로 저장된다.
전설 굴림은 Math.random 스텁으로 한 번 강제해 화면 연출을 확정 검증한다(앱 코드는 그대로).
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://dotsamguk.vercel.app/"
TAG = sys.argv[2] if len(sys.argv) > 2 else "live"
OUT = os.path.abspath("downloads/samguk5")
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
CHROME = os.path.abspath(os.environ.get(
    "CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
os.makedirs(OUT, exist_ok=True)

BUDGET = 255
DICE_MIN = 165
STAT_MIN, STAT_MAX = 20, 96
LEG_MIN, LEG_MAX, LEG_FLOOR = 450, 480, 60
KEYS = ["lead", "war", "int", "pol", "cha"]

steps, errors = [], []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:300]})
    tail = f"  -> {str(extra)[:220]}" if extra != "" else ""
    print(("OK   " if ok else "FAIL ") + label + tail, flush=True)
    return bool(ok)


def shot(page, name, full=False):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
    page.screenshot(path=path, full_page=full)
    print("SHOT " + path, flush=True)
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


def stats(page):
    return page.evaluate(
        "() => Array.from(document.querySelectorAll('[data-stat]')).map(e => +e.textContent)")


def head(page):
    return page.evaluate("""() => {
      const small = document.querySelector('#cst-left').parentElement;
      const txt = small.textContent.replace(/\\s+/g, ' ').trim();
      const mMax = txt.match(/최대\\s*(-?\\d+)/);
      const mSum = txt.match(/합계\\s*(-?\\d+)/);
      const mLeft = txt.match(/남은\\s*([+-]?\\d+)/);
      return {
        small: txt,
        max: mMax ? +mMax[1] : null,
        sum: mSum ? +mSum[1] : null,
        left: mLeft ? +mLeft[1] : null,
        shown: Array.from(document.querySelectorAll('[data-stat]'))
                   .map(e => +e.textContent).reduce((a, b) => a + b, 0),
      };
    }""")


def legend_ui(page):
    return page.evaluate("""() => {
      const badge = document.querySelector('#cst-legend');
      const toast = document.querySelector('#toast');
      return {
        badge: !!badge,
        badgeText: badge ? badge.textContent.replace(/\\s+/g, ' ').trim() : '',
        badgePop: badge ? badge.classList.contains('pop') : false,
        statsLegend: !!document.querySelector('.cst-stats.legend'),
        diceLegend: !!document.querySelector('.cst-dice.legend'),
        toast: toast && !toast.classList.contains('hidden') ? toast.textContent.trim() : '',
      };
    }""")


def toast_text(page):
    return page.evaluate(
        "() => { const t = document.querySelector('#toast'); "
        "return t && !t.classList.contains('hidden') ? t.textContent.trim() : ''; }")


def disp(el):
    return el.evaluate("e => getComputedStyle(e).display")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(("console", m.text))
            if m.type == "error" and "favicon" not in m.text.lower() else None)
    page.on("pageerror", lambda e: errors.append(("pageerror", str(e))))
    page.on("requestfailed", lambda r: errors.append(("reqfail", r.url[:100]))
            if "favicon" not in r.url.lower() else None)

    # ---------- 타이틀 → 신군주 생성 ----------
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(900)
    step("타이틀 화면", page.locator(".title-mark h1").is_visible(), page.title())
    page.click('[data-act="new"]')
    page.wait_for_timeout(450)
    page.click('.sc-card[data-act="open-custom"]')
    page.wait_for_timeout(600)
    step("신군주 생성 화면", page.locator("#scr-custom").is_visible())
    page.fill("#cst-name", "한호")
    page.wait_for_timeout(150)
    page.click('[data-act="cst-scenario"][data-v="s194"]')
    page.wait_for_timeout(350)
    page.click('[data-act="cst-retinue"][data-v="2"]')
    page.wait_for_timeout(250)

    # ---------- 일반 굴림 12회: 전설은 아직 안 뜨거나 떠도 450~480 ----------
    rolls = []
    for _ in range(12):
        page.click('[data-act="cst-dice"]')
        page.wait_for_timeout(170)
        st = stats(page)
        h = head(page)
        lg = legend_ui(page)
        rolls.append({"stats": st, "sum": sum(st), "head": h, "legend": lg["badge"]})
    sums = [r["sum"] for r in rolls]
    normal = [r for r in rolls if not r["legend"]]
    legend_seen = [r for r in rolls if r["legend"]]
    step("굴림 총합: 일반 165~255 · 전설 450~480",
         all((LEG_MIN <= r["sum"] <= LEG_MAX) if r["legend"] else (DICE_MIN <= r["sum"] <= BUDGET)
             for r in rolls), sums)
    step("항목 범위: 일반 20~96 · 전설 60~100",
         all((LEG_FLOOR <= v <= 100) if r["legend"] else (STAT_MIN <= v <= STAT_MAX)
             for r in rolls for v in r["stats"]),
         [min(min(r["stats"]) for r in rolls), max(max(r["stats"]) for r in rolls)])
    step("합계 표기 = 실제 합", all(h["sum"] == h["shown"] for h in [r["head"] for r in rolls]),
         [(r["head"]["sum"], r["head"]["shown"]) for r in rolls[-3:]])
    step("예산 표기: 일반 255 · 전설은 뽑힌 총합",
         all(h["max"] == (r["sum"] if r["legend"] else BUDGET) for r in rolls
             for h in [r["head"]]),
         [(r["legend"], r["head"]["max"], r["sum"]) for r in rolls[-4:]])
    step("남은 = 예산 - 합계",
         all(h["left"] == h["max"] - h["shown"] for h in [r["head"] for r in rolls]),
         rolls[-1]["head"]["small"])
    step("일반 굴림 표본 확보", len(normal) >= 8, f"일반 {len(normal)} · 전설 {len(legend_seen)}")
    print(f"NOTE 굴림 12회 총합: {sums} (전설 {len(legend_seen)}회)", flush=True)

    # ---------- 전설 강제: 화면 연출·금빛 강조·토스트 ----------
    page.evaluate("""() => {
      window.__rnd = Math.random;
      let n = 0;
      // 첫 난수만 전설 구간(<0.01), 이후는 진짜 난수 → 총합 450~480
      Math.random = () => (n++ === 0 ? 0.004 : window.__rnd());
    }""")
    page.click('[data-act="cst-dice"]')
    page.wait_for_timeout(250)
    lg = legend_ui(page)
    lex = stats(page)
    lh = head(page)
    lsum = sum(lex)
    step("✨ 전설 탄생! 배지 표시", lg["badge"], lg["badgeText"])
    step("전설 반짝임(pop) 적용", lg["badgePop"], lg)
    step("전설 금빛 강조(능력치·주사위 버튼)", lg["statsLegend"] and lg["diceLegend"], lg)
    step("전설 토스트", "전설 탄생" in lg["toast"], lg["toast"])
    step("전설 총합 450~480", LEG_MIN <= lsum <= LEG_MAX, lsum)
    step("전설 항목 60~100", all(LEG_FLOOR <= v <= 100 for v in lex), lex)
    step("전설 합계 표기·예산 일치",
         lh["sum"] == lsum and lh["max"] == lsum and lh["left"] == 0, lh["small"])
    page.evaluate("() => { Math.random = window.__rnd; }")
    page.wait_for_timeout(300)
    # 다른 설정을 바꿔 다시 그려도 배지는 남고 반짝임은 다시 돌지 않는다
    page.click('[data-act="cst-color"] >> nth=2')
    page.wait_for_timeout(350)
    again = legend_ui(page)
    step("재렌더 뒤에도 배지 유지(반짝임은 1회)",
         again["badge"] and not again["badgePop"] and again["statsLegend"], again)

    # 대표 스크린샷 — 능력치 라벨이 화면 가운데 오게
    page.evaluate("""() => {
      const lab = document.querySelector('#cst-left').closest('label');
      if (lab) lab.scrollIntoView({block: 'center'});
    }""")
    page.wait_for_timeout(450)
    shot(page, "custom-480")  # → downloads/samguk5/live-custom-480.png (TAG=live)

    # ---------- 전설 예산 안에서 수동 재배분 ----------
    page.wait_for_timeout(2600)  # 토스트가 사라질 때까지
    room = [(k, v) for k, v in zip(KEYS, lex) if v < 100]
    if room:
        k_up = room[0][0]
        page.click(f'[data-act="cst-stat"][data-k="{k_up}"][data-d="1"]')
        page.wait_for_timeout(280)
        t = toast_text(page)
        step("전설 예산 초과 + 차단(합계 불변 + 안내)",
             sum(stats(page)) == lsum and "모두 썼" in t, f"{k_up} · {sum(stats(page))} · {t}")
        page.wait_for_timeout(2400)
        lower_key = [k for k, v in zip(KEYS, stats(page)) if v > LEG_FLOOR][0]
        page.click(f'[data-act="cst-stat"][data-k="{lower_key}"][data-d="-1"]')
        page.wait_for_timeout(280)
        h2 = head(page)
        step("- 로 줄이면 남은 점수 생김", h2["sum"] == lsum - 1 and h2["left"] == 1, h2["small"])
        page.click(f'[data-act="cst-stat"][data-k="{k_up}"][data-d="1"]')
        page.wait_for_timeout(280)
        h3 = head(page)
        step("+ 로 되돌려 다시 전설 예산", h3["sum"] == lsum and h3["left"] == 0, h3["small"])
        # 항목 상한 100까지 올릴 수 있다(96 상한이 아님)
        k_fill = room[0][0]
        guard = 0
        while guard < 60:
            guard += 1
            cur = dict(zip(KEYS, stats(page)))
            if cur[k_fill] >= 100:
                break
            donor = [k for k, v in cur.items() if k != k_fill and v > LEG_FLOOR + 1]
            if not donor:
                break
            page.click(f'[data-act="cst-stat"][data-k="{donor[0]}"][data-d="-1"]')
            page.wait_for_timeout(30)
            page.click(f'[data-act="cst-stat"][data-k="{k_fill}"][data-d="1"]')
            page.wait_for_timeout(30)
        filled = dict(zip(KEYS, stats(page)))
        step("전설 항목 상한 100까지 배분", filled[k_fill] == 100 and sum(filled.values()) == lsum,
             f"{filled} · 합 {sum(filled.values())}")
        page.wait_for_timeout(200)
        shot(page, "custom-480-redistribute")
    else:
        step("전설 항목 상한 배분(이미 100)", True, lex)

    # ---------- 다시 굴리면 일반 분포로 복귀 ----------
    for _ in range(3):
        page.click('[data-act="cst-dice"]')
        page.wait_for_timeout(200)
        if not legend_ui(page)["badge"]:
            break
    back = head(page)
    back_st = stats(page)
    step("일반 재굴림: 배지 사라짐 + 예산 255 복귀",
         not legend_ui(page)["badge"] and back["max"] == BUDGET
         and DICE_MIN <= sum(back_st) <= BUDGET and back["left"] == BUDGET - sum(back_st),
         f"{back_st} · {back['small']}")
    shot(page, "custom-normal-again")

    # ---------- 전설 능력치로 게임 시작 ----------
    page.evaluate("""() => {
      window.__rnd2 = Math.random;
      let n = 0;
      Math.random = () => (n++ === 0 ? 0.004 : window.__rnd2());
    }""")
    page.click('[data-act="cst-dice"]')
    page.wait_for_timeout(250)
    page.evaluate("() => { Math.random = window.__rnd2; }")
    start_st = stats(page)
    step("전설 상태에서 시작 준비", legend_ui(page)["badge"] and sum(start_st) >= LEG_MIN,
         f"{start_st} · {sum(start_st)}")
    page.locator('[data-act="cst-start"]').scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    o = overflow(page)
    step("신군주 화면 가로 넘침 없음", len(o["bad"]) == 0, o)
    shot(page, "custom-480-screen", full=True)
    page.click('[data-act="cst-start"]')
    page.wait_for_timeout(1600)
    step("전설 능력치로 게임 시작", page.locator("#scr-game").is_visible(),
         page.locator("#hud-faction").inner_text())
    hud = page.locator("#hud-faction").inner_text()
    step("세력 이름 표시", "한호" in hud, hud)
    gens = page.locator("#citypanel .gen-chip").count()
    step("휘하 3명(군주+2) 표시", gens == 3, gens)
    o = overflow(page)
    step("게임 화면 가로 넘침 없음", len(o["bad"]) == 0, o)
    hanja = page.evaluate(
        "() => (document.body.innerText.match(/[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/g) || []).slice(0, 5)")
    step("화면에 한자 0자", len(hanja) == 0, hanja)
    shot(page, "custom-480-game")

    step("콘솔·페이지 오류 0", len(errors) == 0, errors[:3])
    browser.close()

ok = all(s["ok"] for s in steps)
print("\n===== %s (%d/%d) =====" % ("전체 통과" if ok else "실패 있음",
                                   sum(1 for s in steps if s["ok"]), len(steps)), flush=True)
for s in steps:
    if not s["ok"]:
        print("  FAIL:", s["step"], "->", s["extra"], flush=True)
sys.exit(0 if ok else 1)
