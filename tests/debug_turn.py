import os, json
from playwright.sync_api import sync_playwright

CHROME = os.path.abspath('.cache/ms-playwright/chromium-1134/chrome-linux/chrome')
def info(pg, tag):
    print(tag, '| screen-game', pg.locator('#scr-game').is_visible(),
          '| battle', pg.locator('#scr-battle').is_visible(),
          '| sheet', pg.locator('#sheet').get_attribute('class'),
          '| close#', pg.locator('[data-act="bt-close"]').count(),
          '| closevis', pg.locator('[data-act="bt-close"]').count() and pg.locator('[data-act="bt-close"]').is_visible(),
          '| date', pg.locator('#hud-date').inner_text(), flush=True)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    ctx = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
    pg.goto('http://127.0.0.1:4173/index.html', wait_until='networkidle')
    pg.wait_for_timeout(500)
    pg.click('[data-act="new"]'); pg.wait_for_timeout(200)
    pg.click('.sc-card[data-id="s194"]'); pg.wait_for_timeout(300)
    pg.click('.lord-card[data-id="jojo"]'); pg.wait_for_timeout(700)
    pg.click('[data-act="march"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="march-go"]'); pg.wait_for_timeout(800)
    info(pg,'battle-start')
    for i in range(25):
        if pg.locator('[data-act="bt-close"]').count() and pg.locator('[data-act="bt-close"]').is_visible():
            info(pg,'result'); pg.click('[data-act="bt-close"]'); pg.wait_for_timeout(800); break
        if pg.locator('#scr-battle').is_visible() and not pg.locator('[data-act="bt-next"]').is_disabled():
            pg.click('[data-act="bt-next"]')
        pg.wait_for_timeout(600)
    info(pg,'after-battle')
    # 턴 종료 → AI 공격
    pg.click('#btn-endturn'); pg.wait_for_timeout(1200)
    info(pg,'after-endturn')
    for i in range(40):
        if pg.locator('#scr-end').is_visible(): info(pg,'end-screen'); break
        if pg.locator('[data-act="bt-close"]').count() and pg.locator('[data-act="bt-close"]').is_visible():
            info(pg,'ai-result'); pg.click('[data-act="bt-close"]'); pg.wait_for_timeout(900); continue
        if pg.locator('#scr-battle').is_visible() and not pg.locator('[data-act="bt-next"]').is_disabled():
            pg.click('[data-act="bt-next"]')
        pg.wait_for_timeout(600)
    info(pg,'final')
    print('errors', errs[:5])
    b.close()
