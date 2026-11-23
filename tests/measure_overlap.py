#!/usr/bin/env python3
"""전장 부대 카드 줄과 아래 안내(#bt-legend) 겹침 측정 — 여러 화면 높이에서 확인

usage: measure_overlap.py [URL]
env: SHOT_DIR, CHROME, HEIGHTS="844,780,740,700,660,568"
각 높이에서 카드 줄 바닥과 안내 줄 윗변의 겹침(px)과 화면 스크롤 필요 여부를 출력한다.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_march, march_locator

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/index.html"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "/workspace/downloads/samguk5/measure"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
HEIGHTS = [int(x) for x in os.environ.get("HEIGHTS", "844,780,740,700,660,568").split(",")]
WIDTH = int(os.environ.get("WIDTH", "390"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

MEASURE = """() => {
  const rr = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return {top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1)}; };
  const info = document.querySelector('#bt-info');
  const legend = document.querySelector('#bt-legend');
  const rowEl = info ? info.querySelector('.bt-card-row') : null;
  const legendRow = legend ? legend.querySelector('.bt-legend-row') : null;
  const cards = [...document.querySelectorAll('[data-act="bt-select"]')].map((c) => ({
    name: c.innerText.split('\\n')[0],
    card: rr(c),
    morale: rr(c.querySelector('.bc-morale')),
  }));
  const cardBottom = Math.max(0, ...cards.map((c) => (c.card ? c.card.bottom : 0)));
  const moraleBottom = Math.max(0, ...cards.map((c) => (c.morale ? c.morale.bottom : 0)));
  const legendTop = legendRow ? legendRow.getBoundingClientRect().top : (legend ? legend.getBoundingClientRect().top : 0);
  const scr = document.querySelector('#scr-battle');
  return {
    info: rr(info), cardsRow: rr(rowEl), legend: rr(legend), legendRow: rr(legendRow),
    cardBottom, moraleBottom, legendTop,
    overlapCard: +(cardBottom - legendTop).toFixed(1),
    overlapMorale: +(moraleBottom - legendTop).toFixed(1),
    cards: cards.map((c) => ({name: c.name, h: c.card && c.card.h})),
    screenNeedsScroll: scr ? scr.scrollHeight - scr.clientHeight : null,
    lastBtnBottom: (() => { const b = document.querySelector('.bt-bar'); return b ? +b.getBoundingClientRect().bottom.toFixed(1) : null; })(),
  };
}"""

results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    for h in HEIGHTS:
        ctx = browser.new_context(viewport={"width": WIDTH, "height": h}, device_scale_factor=2,
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
        if not march_locator(page).count():
            raise SystemExit("출진 버튼 없음")
        click_march(page)
        page.wait_for_timeout(400)
        if page.locator('[data-act="march-target"][data-city="xiaopei"]').count():
            page.click('[data-act="march-target"][data-city="xiaopei"]')
            page.wait_for_timeout(220)
        page.click('[data-act="march-go"]')
        page.wait_for_timeout(1500)
        page.locator('[data-act="bt-select"]').first.click()
        page.wait_for_timeout(350)
        m = page.evaluate(MEASURE)
        results[h] = m
        page.locator("#scr-battle").screenshot(path=os.path.join(OUT, f"battle-{h}.png"))
        ctx.close()
    browser.close()

print(json.dumps(results, ensure_ascii=False, indent=1))
print("\n=== 요약 (카드/사기 줄 바닥 - 안내 줄 윗변: 양수면 겹침) ===")
for h, m in results.items():
    print(f"{h}px  카드겹침 {m['overlapCard']:+.1f}  사기겹침 {m['overlapMorale']:+.1f}  "
          f"카드높이 {[c['h'] for c in m['cards']]}  스크롤여유 {m['screenNeedsScroll']}")
