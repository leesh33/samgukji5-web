"""도트삼국 — 상단 자원 바 검증 (390×844 · iPhone UA · 실제 터치)

세력 타이틀 + 금·식량·총병력·명성·행동력 라벨이 한 줄에 잘림·넘침 없이 들어가는지 확인한다.
사용: LD_LIBRARY_PATH=... python3 samgukji5-web/tests/verify_resbar.py [URL] [TAG]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath("downloads/samguk5/resbar")
CHROME = os.path.abspath(".cache/ms-playwright/chromium-1134/chrome-linux/chrome")
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

report = {"base": BASE, "tag": TAG, "steps": [], "errors": []}
fails = 0


def step(label, ok, extra=""):
    global fails
    if not ok:
        fails += 1
    report["steps"].append({"step": label, "ok": bool(ok), "extra": extra})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:400] if extra != "" else ""), flush=True)


def probe(page):
    return page.evaluate("""() => {
      const bar = document.querySelector('.resbar');
      const br = bar.getBoundingClientRect();
      const cells = [...bar.children].map(el => {
        const r = el.getBoundingClientRect();
        const label = el.querySelector('i');
        const val = el.querySelector('b');
        const cs = getComputedStyle(el);
        return {
          tag: el.className || el.tagName,
          text: el.innerText.replace(/\\n/g, '｜'),
          label: label ? label.innerText : null,
          value: val ? val.innerText : null,
          x: +r.left.toFixed(1), right: +r.right.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
          pad: cs.paddingLeft + '/' + cs.paddingRight,
          clipX: el.scrollWidth - el.clientWidth,
          clipY: el.scrollHeight - el.clientHeight,
          labelFont: label ? getComputedStyle(label).fontSize : null,
          labelColor: label ? getComputedStyle(label).color : null,
          labelLines: label ? Math.round(label.getBoundingClientRect().height / parseFloat(getComputedStyle(label).lineHeight)) : null,
          valFont: val ? getComputedStyle(val).fontSize : null,
          valColor: val ? getComputedStyle(val).color : null,
          valLines: val ? Math.round(val.getBoundingClientRect().height / parseFloat(getComputedStyle(val).lineHeight)) : null,
        };
      });
      return {
        docW: document.documentElement.scrollWidth,
        winW: document.documentElement.clientWidth,
        bar: {x: +br.left.toFixed(1), right: +br.right.toFixed(1), w: +br.width.toFixed(1), h: +br.height.toFixed(1),
              bg: getComputedStyle(bar).backgroundColor, clipX: bar.scrollWidth - bar.clientWidth},
        cells,
      };
    }""")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, user_agent=UA)
    page = ctx.new_page()
    page.on("console", lambda m: report["errors"].append(("console", m.text)) if m.type == "error" else None)
    page.on("pageerror", lambda e: report["errors"].append(("pageerror", str(e))))

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(700)
    page.click('[data-act="new"]')
    page.wait_for_timeout(350)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1200)

    d = probe(page)
    report["first"] = d
    print(json.dumps(d, ensure_ascii=False, indent=1)[:2200], flush=True)

    titles = [c["label"] for c in d["cells"] if c["label"]]
    step("자원 바 존재", d["bar"]["w"] > 0, f'{d["bar"]["w"]}×{d["bar"]["h"]}')
    step("세력 타이틀", d["cells"][0]["text"] == "세력", d["cells"][0]["text"])
    step("한글 라벨 순서", titles == ["금", "식량", "총병력", "명성", "행동력"], titles)
    step("한자 라벨 없음", not any(ch in d["cells"][0]["text"] + "".join(titles) for ch in "金糧兵名令"))
    step("가로 넘침 없음(doc)", d["docW"] <= d["winW"], f'{d["docW"]} / {d["winW"]}')
    step("바 자체 넘침 없음", d["bar"]["clipX"] <= 0, d["bar"]["clipX"])
    step("셀 내부 잘림 없음", all(c["clipX"] <= 0 and c["clipY"] <= 0 for c in d["cells"]),
         [(c["text"], c["clipX"], c["clipY"]) for c in d["cells"] if c["clipX"] > 0 or c["clipY"] > 0])
    step("셀 한 줄 유지(라벨)", all(c["labelLines"] == 1 for c in d["cells"] if c["label"]),
         [(c["label"], c["labelLines"]) for c in d["cells"] if c["label"]])
    step("셀 한 줄 유지(숫자)", all(c["valLines"] == 1 for c in d["cells"] if c["value"]),
         [(c["value"], c["valLines"]) for c in d["cells"] if c["value"]])
    step("바 화면 안에 들어옴", d["cells"][0]["x"] >= 0 and d["cells"][-1]["right"] <= 390.5,
         (d["cells"][0]["x"], d["cells"][-1]["right"]))
    step("5칸 동일 폭", max(c["w"] for c in d["cells"][1:]) - min(c["w"] for c in d["cells"][1:]) < 1.5,
         [c["w"] for c in d["cells"][1:]])
    step("숫자 폰트 11.5px 이상", all(float(c["valFont"].replace("px", "")) >= 11.5 for c in d["cells"] if c["valFont"]),
         [c["valFont"] for c in d["cells"] if c["valFont"]])

    bar = page.locator(".resbar")
    bar.screenshot(path=os.path.join(OUT, f"{TAG}-01-resbar.png"))
    page.screenshot(path=os.path.join(OUT, f"{TAG}-02-map-390x844.png"))
    print("SHOT " + f"{TAG}-01-resbar.png", flush=True)

    # 숫자가 커진 상태(징병·개발 후)에서도 잘리지 않는지: 엔진 상태를 직접 키워 렌더
    page.evaluate("""() => {
      const set = (id, v) => { document.getElementById(id).textContent = v; };
      set('res-gold', '1,284,700'); set('res-food', '2,431,900');
      set('res-troops', '438,250'); set('res-fame', '187'); set('res-ap', '3/3');
      window.dispatchEvent(new Event('resize'));
      return true;
    }""")
    page.wait_for_timeout(250)
    big = probe(page)
    report["big"] = big
    step("큰 숫자(7자리·콤마) 잘림 없음", all(c["clipX"] <= 0 for c in big["cells"]),
         [(c["text"], c["clipX"], c["w"]) for c in big["cells"]])
    step("큰 숫자 한 줄 유지", all(c["valLines"] == 1 for c in big["cells"] if c["value"]),
         [(c["value"], c["valLines"]) for c in big["cells"] if c["value"]])
    step("큰 숫자에서도 가로 넘침 없음", big["docW"] <= big["winW"], f'{big["docW"]} / {big["winW"]}')
    bar.screenshot(path=os.path.join(OUT, f"{TAG}-03-resbar-bignum.png"))
    print("SHOT " + f"{TAG}-03-resbar-bignum.png", flush=True)

    # 라이브 값은 실제 게임 값으로 되돌려 놓는다(재로드)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(700)
    if page.locator('[data-act="continue"]').count():
        page.click('[data-act="continue"]')
        page.wait_for_timeout(1200)
    after = probe(page)
    report["after"] = after
    step("재로드 후 라벨 유지", [c["label"] for c in after["cells"] if c["label"]] == ["금", "식량", "총병력", "명성", "행동력"],
         [c["label"] for c in after["cells"] if c["label"]])
    step("재로드 후 넘침 없음", after["docW"] <= after["winW"], f'{after["docW"]} / {after["winW"]}')
    page.screenshot(path=os.path.join(OUT, f"{TAG}-04-map-after-reload.png"))

    # 데스크톱 폭에서도 확인
    page.set_viewport_size({"width": 1280, "height": 900})
    page.wait_for_timeout(500)
    dk = probe(page)
    report["desktop"] = dk
    step("데스크톱 1280 넘침 없음", dk["docW"] <= dk["winW"], f'{dk["docW"]} / {dk["winW"]}')
    page.screenshot(path=os.path.join(OUT, f"{TAG}-05-desktop-1280.png"))
    print("SHOT " + f"{TAG}-05-desktop-1280.png", flush=True)

    step("콘솔·페이지 오류 0", len(report["errors"]) == 0, report["errors"][:3])
    browser.close()

report["fails"] = fails
report["result"] = "PASS" if fails == 0 else "FAIL"
with open(os.path.join(OUT, f"{TAG}-report.json"), "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
print("RESULT " + report["result"] + f" ({len(report['steps']) - fails}/{len(report['steps'])})", flush=True)
sys.exit(0 if fails == 0 else 1)
