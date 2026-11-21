import os
from playwright.sync_api import sync_playwright
CHROME = os.path.abspath('.cache/ms-playwright/chromium-1134/chrome-linux/chrome')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME)
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:4173/index.html', wait_until='networkidle'); pg.wait_for_timeout(600)
    pg.click('[data-act="new"]'); pg.wait_for_timeout(200)
    pg.click('.sc-card[data-id="s194"]'); pg.wait_for_timeout(250)
    pg.click('.lord-card[data-id="jojo"]'); pg.wait_for_timeout(700)
    pg.click('[data-act="march"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="march-go"]'); pg.wait_for_timeout(900)
    print('round', pg.locator('#bt-round').inner_text())
    pg.click('[data-act="bt-all"]'); pg.wait_for_timeout(4500)
    print('after allout:', pg.locator('#bt-round').inner_text(), '| info:', pg.locator('#bt-info').inner_text()[:60].replace('\n',' '))
    cards = pg.locator('[data-act="bt-select"]')
    print('cards', cards.count())
    for i in range(cards.count()):
        pg.locator('[data-act="bt-select"]').nth(i).click(); pg.wait_for_timeout(220)
        txt = pg.locator('#bt-info').inner_text().split('\n')[0]
        print(i, txt[:70], '| duel enabled', pg.locator('[data-act="bt-duel"]').is_enabled())
        if pg.locator('[data-act="bt-duel"]').is_enabled():
            pg.click('[data-act="bt-duel"]'); pg.wait_for_timeout(400)
            print('  sheet title', pg.locator('#sheet-title').inner_text(), 'rows', pg.locator('[data-act="bt-duel-go"]').count())
            break
    print('errors', errs[:3])
    b.close()
