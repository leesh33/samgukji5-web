"""도트삼국 — 신군주 주사위 최대 255 랜덤화 검증 (390×844 · iPhone UA · 실제 터치)

사용:
  LD_LIBRARY_PATH=/workspace/.local/chromedeps/usr/lib/x86_64-linux-gnu \
    python3 tests/verify_custom255.py [URL] [TAG]
  예) 로컬: python3 tests/verify_custom255.py http://127.0.0.1:4173/index.html local
      라이브: python3 tests/verify_custom255.py https://dotsamguk.vercel.app/ live

경로 주의: 스크린샷은 실행 cwd 기준 downloads/samguk5/ 에 저장된다.
TAG=live 로 돌리면 대표 스크린샷이 downloads/samguk5/live-custom-255.png 로 저장된다.
"""
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd

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
    """'최대 255 · 합계 N · 남은 +M' 한 줄과 실제 합계를 함께 읽는다."""
    return page.evaluate("""() => {
      const small = document.querySelector('#cst-left').parentElement;
      const txt = small.textContent.replace(/\\s+/g, ' ').trim();
      const mSum = txt.match(/합계\\s*(-?\\d+)/);
      const mLeft = txt.match(/남은\\s*([+-]?\\d+)/);
      return {
        small: txt,
        sum: mSum ? +mSum[1] : null,
        leftRaw: mLeft ? mLeft[1] : null,
        left: mLeft ? +mLeft[1] : null,
        shown: Array.from(document.querySelectorAll('[data-stat]'))
                   .map(e => +e.textContent).reduce((a, b) => a + b, 0),
      };
    }""")


def toast_text(page):
    return page.evaluate(
        "() => { const t = document.querySelector('#toast'); "
        "return t && !t.classList.contains('hidden') ? t.textContent.trim() : ''; }")


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

    # ---------- 주사위 10회: 총합이 165~255에서 매번 달라진다 ----------
    rolls, heads = [], []
    for _ in range(10):
        page.click('[data-act="cst-dice"]')
        page.wait_for_timeout(180)
        st = stats(page)
        h = head(page)
        rolls.append({"stats": st, "sum": sum(st), "head": h})
        heads.append(h)
    sums = [r["sum"] for r in rolls]
    step(f"주사위 총합 {DICE_MIN}~{BUDGET} 이내", all(DICE_MIN <= s <= BUDGET for s in sums), sums)
    step("주사위 총합이 매번 달라짐(3가지 이상)", len(set(sums)) >= 3, f"총합 종류 {sorted(set(sums))}")
    step(f"항목별 {STAT_MIN}~{STAT_MAX} 범위",
         all(STAT_MIN <= v <= STAT_MAX for r in rolls for v in r["stats"]),
         [min(min(r["stats"]) for r in rolls), max(max(r["stats"]) for r in rolls)])
    step("‘최대 255 · 합계 · 남은’ 표기",
         all(f"최대 {BUDGET}" in h["small"] and f"합계 {h['sum']}" in h["small"]
             and "남은" in h["small"] for h in heads), heads[-1]["small"])
    step("합계 표기 = 실제 합", all(h["sum"] == h["shown"] for h in heads),
         [(h["sum"], h["shown"]) for h in heads[-2:]])
    step("남은 = 255 - 합계",
         all(h["left"] == BUDGET - h["shown"] for h in heads), heads[-1]["small"])
    print(f"NOTE 주사위 10회 총합: {sums} (최소 {min(sums)} · 최대 {max(sums)})", flush=True)

    # ---------- 수동 + / - : 255까지 채우고, 넘게는 못 넣는다 ----------
    guard = 0
    while guard < 400:
        guard += 1
        cur = stats(page)
        if sum(cur) >= BUDGET:
            break
        room = [(k, v) for k, v in zip(KEYS, cur) if v < STAT_MAX]
        if not room:  # 이론상 도달 불가(5×96=480) — 그래도 방어
            break
        k = room[0][0]
        page.click(f'[data-act="cst-stat"][data-k="{k}"][data-d="1"]')
        page.wait_for_timeout(35)
    filled = stats(page)
    head_full = head(page)
    step("수동 +로 255까지 채움", sum(filled) == BUDGET and head_full["sum"] == BUDGET,
         f"{filled} · {head_full['small']}")
    step("255에서 남은 0 표기", head_full["left"] == 0 and head_full["sum"] == BUDGET,
         head_full["small"])
    # 대표 스크린샷: '최대 255 · 합계 255 · 남은 0' 라벨이 화면 가운데에 오게 스크롤
    # (이 앱은 문서가 아니라 화면 컨테이너가 스크롤되므로 scrollIntoView를 쓴다)
    page.evaluate("""() => {
      const lab = document.querySelector('#cst-left').closest('label');
      if (lab) lab.scrollIntoView({block: 'center'});
    }""")
    page.wait_for_timeout(400)
    shot(page, "custom-255")  # → downloads/samguk5/live-custom-255.png (TAG=live)

    # 255를 넘기는 +는 막힌다 — 단, 96(항목 상한)에 이미 닿은 항목은 '상한' 으로 조용히 무시되므로
    # 아직 여유가 있는 항목을 골라야 '예산 초과' 안내가 뜬다
    room_at_full = [(k, v) for k, v in zip(KEYS, filled) if v < STAT_MAX]
    k_block = room_at_full[0][0] if room_at_full else None
    page.click(f'[data-act="cst-stat"][data-k="{k_block}"][data-d="1"]')
    page.wait_for_timeout(300)
    after_click = stats(page)
    tmsg = toast_text(page)
    step("255 초과 + 차단(합계 불변 + 안내)",
         k_block is not None and sum(after_click) == BUDGET and "모두 썼" in tmsg,
         f"{k_block}({dict(zip(KEYS, filled))[k_block] if k_block else '-'}) · {sum(after_click)} · {tmsg}")
    page.wait_for_timeout(2400)  # 토스트가 사라질 때까지
    page.click(f'[data-act="cst-stat"][data-k="{k_block}"][data-d="-1"]')
    page.wait_for_timeout(250)
    after_minus = stats(page)
    h_minus = head(page)
    step("- 로 줄이면 남은 점수 생김",
         sum(after_minus) == BUDGET - 1 and h_minus["left"] == 1, h_minus["small"])
    page.click(f'[data-act="cst-stat"][data-k="{k_block}"][data-d="1"]')
    page.wait_for_timeout(250)
    step("+ 로 되돌려 다시 255", sum(stats(page)) == BUDGET and head(page)["left"] == 0,
         head(page)["small"])
    # 항목 상한(96)도 막힌다: 96인 항목의 +는 조용히 무시
    capped = [k for k, v in zip(KEYS, stats(page)) if v == STAT_MAX]
    if capped:
        page.click(f'[data-act="cst-stat"][data-k="{capped[0]}"][data-d="1"]')
        page.wait_for_timeout(250)
        step("항목 96 상한 + 무시(합계 불변)", sum(stats(page)) == BUDGET, f"{capped[0]} · {sum(stats(page))}")

    # ---------- 다시 굴려 새 총합으로 시작 ----------
    page.click('[data-act="cst-dice"]')
    page.wait_for_timeout(300)
    rolled = stats(page)
    rolled_head = head(page)
    step("재굴림도 165~255 이내", DICE_MIN <= sum(rolled) <= BUDGET and rolled_head["sum"] == sum(rolled),
         f"{rolled} · {rolled_head['small']}")
    page.locator('[data-act="cst-start"]').scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    o = overflow(page)
    step("신군주 화면 가로 넘침 없음", len(o["bad"]) == 0, o)
    shot(page, "custom-255-screen", full=True)
    page.click('[data-act="cst-start"]')
    page.wait_for_timeout(1600)
    step("주사위 능력치로 게임 시작", page.locator("#scr-game").is_visible(),
         page.locator("#hud-faction").inner_text())
    hud = page.locator("#hud-faction").inner_text()
    step("세력 이름 표시", "한호" in hud, hud)
    gens = page.locator("#citypanel .gen-chip").count()
    step("휘하 3명(군주+2) 표시", gens == 3, gens)
    chips = page.evaluate("""() => Array.from(document.querySelectorAll('#citypanel .gen-chip'))
      .map(c => c.textContent.replace(/\\s+/g, ' ').trim()).slice(0, 3)""")
    print("NOTE 장수 칩:", chips, flush=True)
    o = overflow(page)
    step("게임 화면 가로 넘침 없음", len(o["bad"]) == 0, o)
    hanja = page.evaluate(
        "() => (document.body.innerText.match(/[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/g) || []).slice(0, 5)")
    step("화면에 한자 0자", len(hanja) == 0, hanja)
    shot(page, "custom-255-game")

    # ---------- 내정 한 번(실제 진행 확인) ----------
    ap0 = page.locator("#res-ap").inner_text()
    click_cmd(page, "agri")
    page.wait_for_timeout(500)
    rows = page.locator(".officer-row:not(.done)")
    if rows.count():
        rows.first.click()
        page.wait_for_timeout(600)
    step("신군주 내정 실행", page.locator("#res-ap").inner_text() != ap0,
         f"{ap0} -> {page.locator('#res-ap').inner_text()}")
    hanja2 = page.evaluate(
        "() => (document.body.innerText.match(/[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/g) || []).slice(0, 5)")
    step("내정 뒤에도 한자 0자", len(hanja2) == 0, hanja2)

    step("콘솔·페이지 오류 0", len(errors) == 0, errors[:3])
    browser.close()

ok = all(s["ok"] for s in steps)
print("SUMMARY", "ALL_OK" if ok else "FAILED",
      sum(1 for s in steps if s["ok"]), "/", len(steps), flush=True)
for s in steps:
    if not s["ok"]:
        print("  FAILED STEP:", s["step"], "->", s["extra"], flush=True)
sys.exit(0 if ok else 1)
