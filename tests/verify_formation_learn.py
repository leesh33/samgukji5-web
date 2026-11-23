"""삼국 한 턴 — 진형 전수(스승 장수에게 배우기) 라이브 검증 (390×844 · iPhone UA · 실제 터치)
사용: python3 samgukji5-web/tests/verify_formation_learn.py [URL] [TAG]

검증 항목
  1. 군사 팝오버에 징병 · 훈련 · 진형전수 · 부대 편성 · 출진 5개가 뜨고, 진형전수에 배울 수 있는 진형 수가 보인다
  2. 진형전수 시트: 전수 가능한 진형 칩(스승 이름 표시) · 진형 설명 · 제자별 숙련도 게이지
  3. 전수 실행 → 숙련도 상승(25~36%) · 행동력 -1 · 제자 행동 완료 · 토스트 안내
  4. 장수 상세 모달에 진행 중 숙련도가 보인다
  5. 74% 저장 → 한 번 더 전수 → 100% 습득 · 장수 상세 '주력 진형'과 출진 진형 선택에 반영
  6. 가로 넘침 0 · 콘솔 오류 0
"""
import json
import os
import subprocess
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import group_btn, open_group

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
ROOT = os.getcwd()
OUT = os.path.abspath("downloads/samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
NODE = os.environ.get("NODE", "/workspace/node-v22.11.0-linux-x64/bin/node")
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors = [], []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:400]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:240] if extra != "" else ""), flush=True)


def shot(page, name):
    path = os.path.join(OUT, f"{TAG}-{name}.png")
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
      return { docW: document.documentElement.scrollWidth, winW: w, bad: bad.slice(0, 6) };
    }""")


def sheet_info(page):
    return page.evaluate("""() => {
      const s = document.querySelector('#sheet');
      const body = document.querySelector('#sheet-body');
      const rows = [...body.querySelectorAll('.officer-row.learn')].map(b => ({
        gid: b.dataset.officer,
        text: b.innerText.replace(/\\n/g, '/'),
        gauge: (b.querySelector('.learn-bar em') || {}).innerText || '',
        disabled: b.disabled,
      }));
      return {
        open: !s.classList.contains('hidden'),
        title: (document.querySelector('#sheet-title') || {}).textContent || '',
        chips: [...body.querySelectorAll('.learn-forms .pick-chip')].map(b => ({
          form: b.dataset.form, text: b.innerText.replace(/\\n/g, '/'), on: b.classList.contains('on'), disabled: b.disabled,
        })),
        info: (body.querySelector('.learn-info') || {}).innerText || '',
        warn: (body.querySelector('.warn-box') || {}).innerText || '',
        rows,
      };
    }""")


def ap(page):
    return page.evaluate("() => document.querySelector('#res-ap').textContent")


def toast(page):
    return page.evaluate("() => { const t = document.querySelector('#toast'); return t && !t.classList.contains('hidden') ? t.textContent : ''; }")


def open_learn(page):
    open_group(page, "army")
    page.wait_for_timeout(240)
    page.click('#cmdp .btn[data-cmd="learn"]')
    page.wait_for_timeout(420)


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
    page.click('[data-act="new"]')
    page.wait_for_timeout(300)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1200)
    print("URL " + page.url, flush=True)

    # 1. 군사 팝오버
    open_group(page, "army")
    page.wait_for_timeout(260)
    labels = page.evaluate("() => [...document.querySelectorAll('#cmdp .btn')].map(b => b.innerText.replace(/\\n/g, '/'))")
    names = [x.split("/")[0] for x in labels]
    step("군사 팝오버 5개 · 순서", names == ["징병", "훈련", "진형전수", "부대 편성", "출진"], labels)
    learn_btn = page.locator('#cmdp .btn[data-cmd="learn"]')
    step("진형전수 버튼 활성", learn_btn.count() == 1 and not learn_btn.first.is_disabled(), labels)
    step("진형전수에 전수 가능 진형 수", any("종" in x for x in labels if x.startswith("진형전수")), labels)

    # 2. 진형 전수 시트
    learn_btn.first.click()
    page.wait_for_timeout(460)
    st = sheet_info(page)
    step("진형 전수 시트 열림", st["open"] and "진형 전수" in st["title"], st["title"])
    step("전수 가능한 진형 칩 + 스승 이름", len(st["chips"]) > 0 and any("스승" in c["text"] for c in st["chips"]),
         [c["text"] for c in st["chips"]][:6])
    hakyik = [c for c in st["chips"] if c["form"] == "hakyik"]
    step("학익 칩에 스승 조인", bool(hakyik) and "스승" in hakyik[0]["text"], hakyik[0]["text"] if hakyik else None)
    step("제자 목록 · 숙련도 게이지", len(st["rows"]) >= 2 and all("/100" in r["gauge"] or "익힘" in r["gauge"] for r in st["rows"]),
         [f"{r['text']}|{r['gauge']}" for r in st["rows"]][:4])

    page.click('#sheet-body .learn-forms .pick-chip[data-form="hakyik"]')
    page.wait_for_timeout(320)
    st = sheet_info(page)
    step("진형 설명·상성 표시", "학익" in st["info"] and "강함" in st["info"] and "협공" in st["info"], st["info"])
    yuejin = [r for r in st["rows"] if r["gid"] == "yue_jin"]
    step("악진 숙련도 0/100", bool(yuejin) and yuejin[0]["gauge"].startswith("0/100"), yuejin[0] if yuejin else None)

    # 3. 전수 실행
    ap0 = ap(page)
    page.click('#sheet-body .officer-row.learn[data-officer="yue_jin"]')
    page.wait_for_timeout(700)
    msg = toast(page)
    st = sheet_info(page)
    yuejin = [r for r in st["rows"] if r["gid"] == "yue_jin"][0]
    gain = int(yuejin["gauge"].split("/")[0]) if "/" in yuejin["gauge"] else -1
    step("전수 토스트: 숙련 상승", "숙련 0% →" in msg and "학익" in msg, msg)
    step("숙련도 25~36% 상승", 25 <= gain <= 36, f"{yuejin['gauge']} · {msg}")
    step("행동력 1 소모", ap(page) != ap0, f"{ap0} -> {ap(page)}")
    step("제자 행동 완료 표시 · 다시 못 누름", yuejin["disabled"] and "완료" in yuejin["text"], yuejin["text"])
    step("시트가 게이지 갱신 상태로 유지", st["open"] and st["title"].endswith("진형 전수"), st["title"])
    page.wait_for_timeout(2800)   # 토스트가 사라진 뒤의 시트를 대표 화면으로 남긴다
    shot(page, "live-formation-learn")

    # 4. 장수 상세 — 진행 중 숙련도
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(260)
    page.click('#citypanel [data-act="gen-detail"][data-gid="yue_jin"]')
    page.wait_for_timeout(420)
    gd = page.evaluate("""() => {
      const body = document.querySelector('#sheet-body');
      const row = [...body.querySelectorAll('.gd-row')].find(r => r.innerText.includes('주력 진형'));
      return {
        forms: [...body.querySelectorAll('.gd-form')].map(x => x.innerText.replace(/\\n/g, ' ')),
        row: row ? row.innerText.replace(/\\n/g, '/') : '',
      };
    }""")
    step("장수 상세 주력 진형에 진행 중 숙련도", any("학익" in f and "%" in f for f in gd["forms"]), gd)
    shot(page, "live-formation-learn-detail")
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(260)

    # 5. 74% 저장을 넣고 한 번 더 전수 → 100% 습득
    raw = subprocess.check_output([NODE, os.path.join(ROOT, "tests", "_learn_save.mjs")], cwd=ROOT).decode()
    page.evaluate("(raw) => localStorage.setItem('samguk5.auto', raw)", raw)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(700)
    page.click('[data-act="continue"]')
    page.wait_for_timeout(1400)
    step("74% 저장 불러오기", ap(page).startswith("6/"), ap(page))

    open_learn(page)
    page.click('#sheet-body .learn-forms .pick-chip[data-form="hakyik"]')
    page.wait_for_timeout(300)
    st = sheet_info(page)
    yuejin = [r for r in st["rows"] if r["gid"] == "yue_jin"][0]
    step("불러온 숙련도 74/100", yuejin["gauge"].startswith("74/100"), yuejin["gauge"])
    page.click('#sheet-body .officer-row.learn[data-officer="yue_jin"]')
    page.wait_for_timeout(800)
    msg = toast(page)
    step("100% 습득 토스트", "익혔습니다" in msg and "100%" in msg, msg)
    page.wait_for_timeout(3700)
    shot(page, "live-formation-learn-done")
    st = sheet_info(page)
    yuejin = [r for r in st["rows"] if r["gid"] == "yue_jin"][0]
    step("습득 뒤 보유 표시 · 게이지 익힘", "보유" in yuejin["text"] and "익힘" in yuejin["gauge"], yuejin)

    # 장수 상세 주력 진형에 영구 반영
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(260)
    page.click('#citypanel [data-act="gen-detail"][data-gid="yue_jin"]')
    page.wait_for_timeout(420)
    gd = page.evaluate("""() => {
      const body = document.querySelector('#sheet-body');
      const learned = [...body.querySelectorAll('.gd-form.learned')].map(x => x.innerText.replace(/\\n/g, ' '));
      const all = [...body.querySelectorAll('.gd-form')].map(x => x.innerText.replace(/\\n/g, ' '));
      return { learned, all };
    }""")
    step("장수 상세 주력 진형에 학익(전수)", any("학익" in f for f in gd["learned"]), gd)
    page.click('.sheet-head [data-act="sheet-close"]')
    page.wait_for_timeout(260)

    # 출진 진형 선택에도 학익
    if page.locator('[data-act="march"]').count() or open_group(page, "army"):
        open_group(page, "army")
        page.wait_for_timeout(240)
        if page.locator('[data-act="march"]').count():
            page.locator('[data-act="march"]').first.click()
            page.wait_for_timeout(600)
            fp = page.evaluate("""() => {
              const body = document.querySelector('#sheet-body');
              return [...body.querySelectorAll('.fp-row')].map(r => ({
                name: (r.querySelector('.fp-name') || {}).innerText || '',
                forms: [...r.querySelectorAll('.fp-chip')].map(b => b.dataset.form),
              }));
            }""")
            yue = [r for r in fp if r["name"] == "악진"]
            step("출진 진형 선택에 학익", bool(yue) and "hakyik" in yue[0]["forms"], fp)
            shot(page, "live-formation-learn-march")
            page.click('.sheet-head [data-act="sheet-close"]')
            page.wait_for_timeout(240)

    of = overflow(page)
    step("가로 넘침 0", len(of["bad"]) == 0, of)
    step("콘솔 오류 0", len(errors) == 0, errors[:3])

    browser.close()

ok = all(s["ok"] for s in steps)
print(json.dumps({"ok": ok, "tag": TAG, "base": BASE, "steps": steps, "errors": errors}, ensure_ascii=False, indent=1), flush=True)
print(f"RESULT {TAG} " + ("ALL PASS" if ok else "FAIL"), flush=True)
sys.exit(0 if ok else 1)
