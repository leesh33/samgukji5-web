#!/usr/bin/env python3
"""큰 글꼴(아이폰 큰 텍스트)에서도 카드 줄과 안내 줄이 겹치지 않는지 확인

usage: measure_bigfont.py [URL]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_march, march_locator

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "/workspace/downloads/samguk5/bigfont"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

BIG = """
.bt-card .bc-name { font-size: 14px; }
.bt-card .bc-troop { font-size: 13px; }
.bt-card .bc-morale { font-size: 12px; }
.bc-arm { font-size: 11px; }
.bt-legend { font-size: 12px; }
.bt-info { font-size: 13.5px; }
.bt-unitinfo .bu-name { font-size: 13px; }
.bu-form, .bu-arm, .bu-ct { font-size: 12px; }
"""

MEASURE = """() => {
  const rr = (el) => { const r = el.getBoundingClientRect(); return {top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1)}; };
  const info = document.querySelector('#bt-info');
  const legend = document.querySelector('#bt-legend');
  const cards = [...document.querySelectorAll('[data-act="bt-select"]')].map((c) => ({name: c.innerText.split('\\n')[0], card: rr(c), morale: rr(c.querySelector('.bc-morale'))}));
  const legendRow = legend.querySelector('.bt-legend-row');
  const legendTop = legendRow.getBoundingClientRect().top;
  const cardBottom = Math.max(...cards.map((c) => c.card.bottom));
  const scr = document.querySelector('#scr-battle');
  return {cards, cardBottom, legendTop, overlap: +(cardBottom - legendTop).toFixed(1),
          scroll: scr.scrollHeight - scr.clientHeight, legend: rr(legend), info: rr(info)};
}"""

out = {}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    for h in (844, 780, 740):
        ctx = browser.new_context(viewport={"width": 390, "height": h}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, user_agent=UA)
        page = ctx.new_page()
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(700)
        page.click('[data-act="new"]')
        page.wait_for_timeout(300)
        page.click('.sc-card[data-id="s194"]')
        page.wait_for_timeout(350)
        page.click('.lord-card[data-id="jojo"]')
        page.wait_for_timeout(1000)
        click_march(page)
        page.wait_for_timeout(400)
        if page.locator('[data-act="march-target"][data-city="xiaopei"]').count():
            page.click('[data-act="march-target"][data-city="xiaopei"]')
            page.wait_for_timeout(220)
        page.click('[data-act="march-go"]')
        page.wait_for_timeout(1500)
        page.locator('[data-act="bt-select"]').first.click()
        page.wait_for_timeout(300)
        page.add_style_tag(content=BIG)
        page.wait_for_timeout(300)
        out[h] = page.evaluate(MEASURE)
        page.locator("#scr-battle").screenshot(path=os.path.join(OUT, f"bigfont-{h}.png"))
        ctx.close()
    browser.close()

print(json.dumps(out, ensure_ascii=False, indent=1))
print("\n=== 큰 글꼴 요약 (겹침 양수면 문제) ===")
for h, m in out.items():
    print(f"{h}px  겹침 {m['overlap']:+.1f}  카드높이 {[c['card']['h'] for c in m['cards']]}  스크롤여유 {m['scroll']}")
