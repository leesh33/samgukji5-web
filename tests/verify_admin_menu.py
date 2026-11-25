"""📊 어드민 버튼 위치 검증 — ☰ 군의 메뉴 맨 아래(관리자만) · 정보 패널에는 없음 (390×844)

사용: python3 tests/verify_admin_menu.py [URL] [TAG]

  ① 관리자 세션: ☰ 메뉴를 열면 시트 맨 아래(마지막 요소)에 📊 어드민 → admin.html
  ② 관리자 세션: 정보 패널에는 📊 어드민이 없다
  ③ 일반 계정 / ④ 비로그인: ☰ 메뉴·정보 패널 어디에도 어드민 흔적이 DOM 에 없다

세션은 localStorage(samguk5.auth.session.v1)에 심어 관리자 화면을 그린다(실제 OAuth 로그인은 하지 않는다).
Supabase 요청은 모두 끊어 검증 방문 row(app_visit_track)를 남기지 않는다.
"""
import json
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

fails = []


def step(label, ok, extra=""):
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:220] if extra != "" else ""), flush=True)
    if not ok:
        fails.append(label)


SESSION_JS = """(email) => {
  try {
    if (!email) { localStorage.removeItem('samguk5.auth.session.v1'); return; }
    localStorage.setItem('samguk5.auth.session.v1', JSON.stringify({
      access_token: 'verify-token', refresh_token: 'verify-refresh',
      expires_at: Date.now() + 3600 * 1000, token_type: 'bearer',
      user: { id: '00000000-0000-4000-8000-000000000001', email: email }
    }));
  } catch (e) {}
}"""


def enter_game(page):
    page.click('[data-act="new"]')
    page.wait_for_timeout(350)
    page.click('.sc-card[data-id="s194"]')
    page.wait_for_timeout(400)
    page.click('.lord-card[data-id="jojo"]')
    page.wait_for_timeout(1300)
    # 첫 달 안내 시트가 뜨면 닫고, 토스트가 사라질 때까지 기다린다(토스트가 버튼을 가로막는다)
    for _ in range(3):
        if page.locator("#sheet").is_visible():
            close_sheet(page)
        else:
            break
    try:
        page.wait_for_selector("#toast.hidden", timeout=6000)
    except Exception:
        pass
    page.wait_for_timeout(400)


def close_sheet(page):
    page.evaluate("() => { const b = document.querySelector('#sheet .sheet-head [data-act=\"sheet-close\"]'); if (b && !document.querySelector('#sheet').classList.contains('hidden')) b.click(); }")
    page.wait_for_timeout(300)


def sheet_hidden(page):
    page.wait_for_function("() => document.querySelector('#sheet').classList.contains('hidden')", timeout=8000)


def open_menu(page):
    close_sheet(page)
    sheet_hidden(page)
    page.locator('[data-act="menu"]').click(timeout=8000)
    page.wait_for_timeout(450)
    return page.locator("#sheet-title").inner_text().strip()


def open_info(page):
    close_sheet(page)
    sheet_hidden(page)
    page.locator('[data-act="info"]').click(timeout=8000)
    page.wait_for_timeout(450)
    return page.locator("#sheet-title").inner_text().strip()


def sheet_facts(page):
    return page.evaluate("""() => {
      const body = document.querySelector('#sheet-body');
      const last = body.lastElementChild;
      const link = body.querySelector('.admin-link');
      return {
        title: document.querySelector('#sheet-title').textContent.trim(),
        lastTag: last ? last.tagName : '',
        lastClass: last ? String(last.className || '') : '',
        lastHTML: last ? last.outerHTML.slice(0, 120) : '',
        links: body.querySelectorAll('.admin-link').length,
        href: link ? link.getAttribute('href') : '',
        hrefs: body.querySelectorAll('a[href*="admin"]').length,
        text: body.textContent
      };
    }""")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    errors = []

    def scenario(email, tag):
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, user_agent=UA, locale="ko-KR")
        ctx.add_init_script("(" + SESSION_JS + ")(" + json.dumps(email) + ")")
        # 검증 방문 row 를 남기지 않는다 — Supabase 통신 전부 차단
        ctx.route("**://zdcdvjlssncsawpqsjwe.supabase.co/**", lambda r: r.abort())
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append((tag, str(e))))
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(900)
        enter_game(page)
        menu_title = open_menu(page)
        menu = sheet_facts(page)
        if tag == "admin":
            # 시트 맨 아래까지 굴려 스크린샷
            page.evaluate("() => { const b = document.querySelector('#sheet-body'); b.scrollTop = b.scrollHeight; }")
            page.wait_for_timeout(300)
            path = os.path.join(OUT, f"{TAG}-admin-menu.png")
            page.screenshot(path=path)
            print("SHOT " + os.path.basename(path), flush=True)
        close_sheet(page)
        info_title = open_info(page)
        info = sheet_facts(page)
        ctx.close()
        return {"menuTitle": menu_title, "menu": menu, "infoTitle": info_title, "info": info}

    # ---------- ① ② 관리자 ----------
    admin = scenario("andy.leesh33@gmail.com", "admin")
    step("① ☰ 메뉴가 열린다", admin["menuTitle"] == "군의", admin["menuTitle"])
    step("① 메뉴 맨 아래가 📊 어드민 (마지막 요소)",
         admin["menu"]["links"] == 1 and admin["menu"]["lastClass"].find("admin-link") >= 0,
         admin["menu"]["lastHTML"])
    step("① /admin.html 로 간다", admin["menu"]["href"] == "admin.html", admin["menu"]["href"])
    step("① 관리자에게만 보이는 링크 1개", admin["menu"]["hrefs"] == 1, admin["menu"]["hrefs"])
    step("② 정보 패널에는 📊 어드민 없음",
         admin["infoTitle"] == "정보" and admin["info"]["links"] == 0 and admin["info"]["hrefs"] == 0
         and "어드민" not in admin["info"]["text"],
         admin["info"]["lastHTML"])

    # ---------- ③ 일반 계정 · ④ 비로그인 ----------
    for email, tag, name in [("player@example.com", "user", "③ 일반 계정"),
                             (None, "guest", "④ 비로그인")]:
        got = scenario(email, tag)
        step(f"{name}: ☰ 메뉴에 어드민 흔적 없음(DOM 0)",
             got["menu"]["links"] == 0 and got["menu"]["hrefs"] == 0 and "어드민" not in got["menu"]["text"],
             got["menu"]["lastHTML"])
        step(f"{name}: 정보 패널에도 없음",
             got["info"]["links"] == 0 and got["info"]["hrefs"] == 0 and "어드민" not in got["info"]["text"])

    browser.close()

step("콘솔 pageerror 0", len(errors) == 0, errors[:2])
print("\n" + ("ALL OK" if not fails else "FAILED: " + " / ".join(fails)), flush=True)
sys.exit(0 if not fails else 1)
