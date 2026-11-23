#!/usr/bin/env python3
"""라이브 전장 스크린샷 — 부대 카드 줄(보병·기병 칩)과 아래 안내 줄이 겹치지 않는지 눈으로 확인할 컷

usage: shot_live_arm_affinity.py [URL]
저장: /workspace/downloads/samguk5/live-arm-affinity.png (기본 글꼴)
      /workspace/downloads/samguk5/live-arm-affinity-bigfont.png (큰 글꼴 = 제보 화면과 같은 조건)
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _cmdmenu import click_march, march_locator

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://dotsamguk.vercel.app/index.html"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "/workspace/downloads/samguk5"))
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
  const rect = (el) => { const r = el.getBoundingClientRect();
    return {top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1)}; };
  const cards = [...document.querySelectorAll('[data-act="bt-select"]')];
  const legend = document.querySelector('#bt-legend .bt-legend-row');
  const cardBottom = Math.max(...cards.map((c) => c.getBoundingClientRect().bottom));
  const moraleBottom = Math.max(...cards.map((c) => c.querySelector('.bc-morale').getBoundingClientRect().bottom));
  const legendTop = legend.getBoundingClientRect().top;
  const scr = document.querySelector('#scr-battle');
  return {cardH: cards.map((c) => +c.getBoundingClientRect().height.toFixed(1)),
          cardBottom: +cardBottom.toFixed(1), moraleBottom: +moraleBottom.toFixed(1),
          legendTop: +legendTop.toFixed(1),
          overlap: +(cardBottom - legendTop).toFixed(1),
          moraleOverlap: +(moraleBottom - legendTop).toFixed(1),
          scroll: scr.scrollHeight - scr.clientHeight};
}"""


def run(page, inject_big):
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    page.click('[data-act="new"]')
    page.wait_for_timeout(320)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(380)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1000)
    click_march(page)
    page.wait_for_timeout(420)
    if page.locator('[data-act="march-target"][data-city="xiaopei"]').count():
        page.click('[data-act="march-target"][data-city="xiaopei"]')
        page.wait_for_timeout(240)
    page.click('[data-act="march-go"]')
    page.wait_for_timeout(1600)
    page.locator('[data-act="bt-select"]').first.click()
    page.wait_for_timeout(400)
    if inject_big:
        page.add_style_tag(content=BIG)
        page.wait_for_timeout(350)
    return page.evaluate(MEASURE)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    out = {}
    for big, name in ((False, "live-arm-affinity.png"), (True, "live-arm-affinity-bigfont.png")):
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, user_agent=UA)
        page = ctx.new_page()
        m = run(page, big)
        path = os.path.join(OUT, name)
        page.locator("#scr-battle").screenshot(path=path)
        m["shot"] = path
        out[name] = m
        print(("OK  " if m["overlap"] < 0 else "FAIL") + f" {name}  겹침 {m['overlap']:+.1f}px  "
              f"카드높이 {m['cardH']}  스크롤여유 {m['scroll']}", flush=True)
        ctx.close()
    browser.close()

print(json.dumps(out, ensure_ascii=False, indent=1))
