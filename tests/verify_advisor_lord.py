"""삼국 한 턴 — 참모 임명에서 군주 제외 검증.
사용: python3 tests/verify_advisor_lord.py [URL] [TAG]

검증 항목
  1. 참모 임명 시트에 군주(조조)가 나오지 않고 부하 장수만 나온다
  2. 인사 › 참모 팝오버 라벨이 참모 이름(부하 장수)을 보여 준다
  3. 군주가 참모로 저장된 옛 세이브를 열면 부하 장수(지력 최고)로 보정된다
  4. 군주 말고 부하가 없으면 시트에 '참모로 임명할 부하 장수가 없습니다.' · 팝오버는 '부하 없음'
  5. 콘솔 오류 0 · 가로 넘침 0 · 화면 한자 0자
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


def hanja(page):
    return page.evaluate("""() => {
      const t = document.body.innerText || '';
      const m = t.match(/[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/g);
      return {n: m ? m.length : 0, sample: m ? m.slice(0, 5).join('') : ''};
    }""")


def save_state(page):
    return page.evaluate("""() => {
      const raw = localStorage.getItem('samguk5.auto');
      if (!raw) return null;
      const s = JSON.parse(raw);
      const lord = (s.factions[s.playerId] || {}).lord;
      const gens = Object.values(s.generals).filter(g => g.faction === s.playerId && !g.dead && !g.captive);
      return {lord, advisorId: s.advisorId, playerId: s.playerId, gens: gens.map(g => g.id)};
    }""")


def advisor_rows(page):
    return page.evaluate("""() => {
      return [...document.querySelectorAll('#sheet .officer-row')].map(el => ({
        gid: el.dataset.gid,
        name: (el.querySelector('.or-name') || {}).textContent?.trim() || '',
        picked: el.classList.contains('picked'),
      }));
    }""")


def open_people_advisor(page):
    """성 시트 인사 팝오버를 열고 참모 버튼 라벨을 돌려준다"""
    page.click('[data-act="cmd-group"][data-group="people"]')
    page.wait_for_timeout(260)
    btn = page.locator('#cmdp [data-act="advisor"]')
    label = btn.inner_text().replace('\n', ' ').strip()
    return label


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
    page.click('[data-act="new"]'); page.wait_for_timeout(320)
    page.click('.sc-card[data-id="s194"]'); page.wait_for_timeout(380)
    page.click('.lord-card[data-id="jojo"]'); page.wait_for_timeout(1100)

    st = save_state(page)
    lord = st["lord"]
    lord_name = page.evaluate("""async (gid) => {
      const d = await import('./js/data.js');
      const s = JSON.parse(localStorage.getItem('samguk5.auto'));
      const t = d.GENERAL_BY_ID[gid] || (s.customGenerals || {})[gid] || {};
      return t.ko || '';
    }""", lord)
    step("새 게임 · 군주는 조조(세력 조조)", st["playerId"] == "jojo" and lord == "cao_cao" and lord_name == "조조",
         f"lord={lord}/{lord_name}")
    step("시작부터 참모는 부하 장수", st["advisorId"] and st["advisorId"] != lord, f"advisor={st['advisorId']} lord={lord}")
    step("시작 화면 한자 0자", hanja(page)["n"] == 0, hanja(page))

    # ---------- 1. 인사 › 참모 팝오버 ----------
    label = open_people_advisor(page)
    adv_name = page.evaluate("""async (gid) => {
      const d = await import('./js/data.js');
      const s = JSON.parse(localStorage.getItem('samguk5.auto'));
      const t = d.GENERAL_BY_ID[gid] || (s.customGenerals || {})[gid] || {};
      return t.ko || '';
    }""", st["advisorId"])
    step("인사 › 참모 라벨 = 현재 참모(부하)", "참모" in label and adv_name and adv_name in label, f"{label} / 기대 {adv_name}")

    page.locator('#cmdp [data-act="advisor"]').click()
    page.wait_for_timeout(420)
    title = page.locator('#sheet-title').inner_text().strip()
    step("참모 임명 시트 열림", title == "참모 임명", title)
    rows = advisor_rows(page)
    names = [r["name"].split()[0] for r in rows]
    step("군주(조조)가 목록에 없음", all(r["gid"] != lord for r in rows), names)
    step("부하 장수만 표시(군주 제외 전원)", len(rows) == len(st["gens"]) - 1, f"{len(rows)}행 / 부하 {len(st['gens']) - 1}명")
    step("현재 참모 1명 표시", sum(1 for r in rows if r["picked"]) == 1, [r["name"] for r in rows if r["picked"]])
    o = overflow(page)
    step("가로 넘침 없음", len(o["bad"]) == 0, o)
    step("시트 한자 0자", hanja(page)["n"] == 0, hanja(page))
    page.screenshot(path=os.path.join(OUT, f"{TAG}-advisor-sheet.png"))
    print("SHOT " + os.path.basename(f"{TAG}-advisor-sheet.png"), flush=True)

    # ---------- 2. 옛 세이브: 군주가 참모 ----------
    expect = page.evaluate("""async (lord) => {
      const d = await import('./js/data.js');
      const s = JSON.parse(localStorage.getItem('samguk5.auto'));
      s.advisorId = lord;
      const gens = Object.values(s.generals).filter(g => g.faction === s.playerId && !g.dead && !g.captive && g.id !== lord);
      const tbl = { ...(d.GENERAL_BY_ID || {}), ...(s.customGenerals || {}) };
      const best = gens.sort((a, b) => (tbl[b.id] || {}).int - (tbl[a.id] || {}).int)[0];
      localStorage.setItem('samguk5.auto', JSON.stringify(s));
      return best ? best.id : null;
    }""", lord)
    page.reload(wait_until="networkidle"); page.wait_for_timeout(700)
    page.click('[data-act="continue"]'); page.wait_for_timeout(1200)
    label2 = open_people_advisor(page)
    expect_name = page.evaluate("""async (gid) => {
      const d = await import('./js/data.js');
      const s = JSON.parse(localStorage.getItem('samguk5.auto'));
      const t = d.GENERAL_BY_ID[gid] || (s.customGenerals || {})[gid] || {};
      return t.ko || '';
    }""", expect)
    step("옛 세이브: 군주 참모 → 부하 지력 최고로 보정(팝오버 라벨)",
         expect_name and expect_name in label2 and lord_name not in label2, f"{label2} / 기대 {expect_name}")
    page.locator('#cmdp [data-act="advisor"]').click()
    page.wait_for_timeout(400)
    rows2 = advisor_rows(page)
    picked2 = [r["name"].split()[0] for r in rows2 if r["picked"]]
    step("보정 뒤 목록에 군주 없음", all(r["gid"] != lord for r in rows2), [r["name"] for r in rows2])
    step("보정 뒤 재임 참모가 부하 지력 최고", picked2 == [expect_name], f"재임={picked2} 기대={expect_name}")
    page.screenshot(path=os.path.join(OUT, f"{TAG}-advisor-old-save.png"))

    # ---------- 3. 군주만 남은 세력 ----------
    page.evaluate("""(lord) => {
      const s = JSON.parse(localStorage.getItem('samguk5.auto'));
      s.advisorId = lord;
      for (const g of Object.values(s.generals)) {
        if (g.faction === s.playerId && g.id !== lord) { g.faction = null; g.city = 'luoyang'; }
      }
      localStorage.setItem('samguk5.auto', JSON.stringify(s));
    }""", lord)
    page.reload(wait_until="networkidle"); page.wait_for_timeout(700)
    page.click('[data-act="continue"]'); page.wait_for_timeout(1100)
    label3 = open_people_advisor(page)
    step("부하 0명이면 팝오버 라벨 '부하 없음'", "부하 없음" in label3 and lord_name not in label3, label3)
    page.locator('#cmdp [data-act="advisor"]').click()
    page.wait_for_timeout(400)
    txt = page.locator('#sheet').inner_text()
    step("시트 안내 '참모로 임명할 부하 장수가 없습니다.'", "참모로 임명할 부하 장수가 없습니다." in txt, txt[:160])
    step("시트에 장수 행 없음", len(advisor_rows(page)) == 0, len(advisor_rows(page)))
    o3 = overflow(page)
    step("가로 넘침 없음(부하 0명)", len(o3["bad"]) == 0, o3)
    page.screenshot(path=os.path.join(OUT, f"{TAG}-advisor-empty.png"))

    step("콘솔·페이지 오류 0", len(errors) == 0, errors[:3])
    browser.close()

ok = sum(1 for s in steps if s["ok"])
print(f"\nSUMMARY {ok}/{len(steps)} OK", flush=True)
sys.exit(0 if ok == len(steps) else 1)
