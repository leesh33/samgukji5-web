#!/usr/bin/env python3
"""삼국 한 턴 — 2026-11-28 집중 탐색 · 공동 공격 라이브 검증 (390×844).

사용:
  LD_LIBRARY_PATH=/workspace/tmp_libs/root/usr/lib/x86_64-linux-gnu \
  python3 tests/verify_strategy_depth.py [BASE_URL] [TAG]

BASE_URL 을 주지 않으면 로컬 정적 서버를 직접 띄운다.
검증용 저장 파일은 tests/_strategy_saves.mjs 로 만든 것을 localStorage 슬롯 1에 넣는다.
"""
import functools
import json
import os
import subprocess
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

ROOT = "/workspace/samgukji5-web"
NODE = "/workspace/node-v22.11.0-linux-x64/bin/node"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.abspath(os.environ.get("SHOT_DIR", "downloads/strategy-depth"))
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, shots, errors = [], {}, []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:240]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:200] if str(extra) else ""), flush=True)


def shot(page, name):
    path = os.path.join(OUT, f"samguk-{TAG}-{name}.png")
    page.screenshot(path=path)
    shots[name] = path
    print("SHOT " + os.path.basename(path), flush=True)
    return path


def sheet_open(page):
    return not page.locator("#sheet").evaluate("el => el.classList.contains('hidden')")


def sheet_title(page):
    return page.locator("#sheet-title").inner_text() if sheet_open(page) else ""


def close_sheet(page):
    if sheet_open(page):
        el = page.locator('.sheet-head [data-act="sheet-close"]')
        if el.count():
            try:
                el.first.click()
                page.wait_for_timeout(200)
            except Exception:
                pass


def dismiss_popup(page):
    for _ in range(4):
        for sel in ('[data-act="promo-ok"]', '[data-act="event-go"]', '[data-act="sheet-close"]'):
            btn = page.locator(sel).first
            if btn.count() and btn.is_visible():
                try:
                    btn.click(timeout=1200)
                except Exception:
                    continue
                page.wait_for_timeout(300)
                break
        else:
            return


def make_save():
    out = "/tmp/strategy-saves"
    subprocess.run([NODE, "tests/_strategy_saves.mjs", out], cwd=ROOT, check=True, capture_output=True)
    with open(os.path.join(out, "strategy.json"), encoding="utf-8") as f:
        return f.read()


def run(base):
    raw = make_save()
    info = json.loads(raw)
    guest = "bao_long"   # _strategy_saves.mjs 가 고른 후보(가장 약한 재야) — 아래에서 이름을 다시 확인한다
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                            has_touch=True, user_agent=UA, locale="ko-KR", timezone_id="Asia/Seoul")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
        page.goto(base, wait_until="networkidle")
        page.wait_for_timeout(700)

        # ---------- 검증용 저장을 슬롯 1에 넣고 불러오기 ----------
        page.evaluate("raw => localStorage.setItem('samguk5.slot1', raw)", raw)
        page.click('[data-act="load"]')
        page.wait_for_timeout(400)
        page.click('[data-act="do-load"][data-slot="1"]')
        page.wait_for_timeout(1400)
        dismiss_popup(page)
        step("저장 불러오기 — 본 게임 진입", page.locator("#scr-game").is_visible(), page.locator("#hud-faction").inner_text())
        panel = page.locator("#citypanel").inner_text()
        step("조조군 성 시트가 열려 있다", "조조" in panel and ("명령" in panel or "내정" in panel), panel[:60])

        # ---------- 1. 집중 탐색 ----------
        page.click('#citypanel [data-act="cmd-group"][data-group="people"]')
        page.wait_for_timeout(350)
        focus_btn = page.locator('[data-act="cmd"][data-cmd="focus"]')
        step("인사 팝오버에 집중 탐색 버튼", focus_btn.count() == 1 and focus_btn.is_visible(),
             focus_btn.inner_text() if focus_btn.count() else "")
        shot(page, "01-people-popover")

        focus_btn.click()
        page.wait_for_timeout(500)
        title = sheet_title(page)
        step("집중 탐색 시트가 열린다", "집중 탐색" in title, title)
        rows = page.locator('#sheet [data-act="focus-do"]')
        n_rows = rows.count()
        step("재야 후보 목록 + 승낙 % 표시", n_rows > 0 and "%" in page.locator("#sheet").inner_text(),
             f"후보 {n_rows}명")
        first_row = page.locator("#sheet .officer-row").first.inner_text()
        step("후보 줄에 성·소속·친밀·승낙가 함께 보인다", "승낙" in first_row and "친밀" in first_row, first_row.replace("\n", " ")[:90])
        shot(page, "02-focus-sheet")

        # 가장 약한 후보(마지막 줄)에게 초빙 — 승낙 확률이 가장 높다. 최대 3번까지 다시 청한다.
        guest_name = page.locator("#sheet .officer-row").last.locator(".or-name").inner_text().split(" ")[0]
        hit = False
        for attempt in range(3):
            rows = page.locator('#sheet [data-act="focus-do"]')
            if rows.count() == 0:
                break
            last = page.locator("#sheet .officer-row").last
            target_name = last.locator(".or-name").inner_text().split(" ")[0]
            rows.nth(rows.count() - 1).click()
            page.wait_for_timeout(700)
            toast = page.locator("#toast").inner_text()
            print(f"  초빙 {attempt + 1}: {target_name} -> {toast[:80]}")
            if "왔습니다" in toast:
                hit = True
                guest_name = target_name
                break
            # 실패하면 시트가 새로 그려진다 — 다시 연다
            if not sheet_open(page):
                page.click('#citypanel [data-act="cmd-group"][data-group="people"]')
                page.wait_for_timeout(250)
                page.click('[data-act="cmd"][data-cmd="focus"]')
                page.wait_for_timeout(400)
        step("집중 탐색 성공 — 그 인물이 이 성으로 왔다", hit, f"{guest_name} / {page.locator('#toast').inner_text()[:90]}")
        shot(page, "03-focus-result")

        # 온 인물이 등용 목록에 잡히는지
        close_sheet(page)
        dismiss_popup(page)
        page.click('#citypanel [data-act="cmd-group"][data-group="people"]')
        page.wait_for_timeout(300)
        page.click('[data-act="cmd"][data-cmd="hire"]')
        page.wait_for_timeout(500)
        hire_txt = page.locator("#sheet").inner_text()
        step("인사 → 등용에 초빙한 인물이 보인다", guest_name in hire_txt, hire_txt.replace("\n", " ")[:90])
        shot(page, "04-hire-list")
        close_sheet(page)
        dismiss_popup(page)

        # ---------- 2. 공동 공격 ----------
        page.click('#citypanel [data-act="diplomacy"]')
        page.wait_for_timeout(500)
        step("외교 시트", "외교" in sheet_title(page), sheet_title(page))
        page.click('[data-act="diplo-open"][data-fid="lubu"]')
        page.wait_for_timeout(400)
        joint_btn = page.locator('[data-act="joint-open"][data-fid="lubu"]')
        step("여포 선반에 공동 공격 버튼", joint_btn.count() == 1 and joint_btn.is_visible(),
             joint_btn.inner_text() if joint_btn.count() else "")
        shot(page, "05-diplo-shelf")

        accepted = False
        for attempt in range(3):
            btn = page.locator('[data-act="joint-open"][data-fid="lubu"]')
            if btn.is_disabled():
                step("공동 공격 버튼이 잠겨 있다(동맹·우호 조건)", False, btn.inner_text())
                break
            btn.click()
            page.wait_for_timeout(450)
            step("공동 공격 대상 시트", "공동 공격" in sheet_title(page), sheet_title(page))
            if attempt == 0:
                body = page.locator("#sheet").inner_text()
                step("대상 성에 수비 병력·승낙 %", "수비 병력" in body and "%" in body, body.replace("\n", " ")[:100])
                shot(page, "06-joint-targets")
            page.locator('[data-act="joint-do"]').first.click()
            page.wait_for_timeout(800)
            toast = page.locator("#toast").inner_text()
            print(f"  공동 공격 {attempt + 1}: {toast[:90]}")
            if "함께 칩니다" in toast:
                accepted = True
                break
            # 거절되면 외교 시트로 돌아와 다시 청한다
            close_sheet(page)
            page.wait_for_timeout(200)
            if not sheet_open(page):
                page.click('#citypanel [data-act="diplomacy"]')
                page.wait_for_timeout(350)
                page.click('[data-act="diplo-open"][data-fid="lubu"]')
                page.wait_for_timeout(300)
        step("공동 공격 승낙", accepted, page.locator("#toast").inner_text()[:100])
        shot(page, "07-joint-accepted")

        # 외교 화면에 공동 약속 배지
        close_sheet(page)
        page.wait_for_timeout(200)
        page.click('#citypanel [data-act="diplomacy"]')
        page.wait_for_timeout(400)
        diplo_txt = page.locator("#sheet").inner_text()
        step("외교 화면에 '공동 ○○' 약속 표시", "공동 소패" in diplo_txt or "공동" in diplo_txt, diplo_txt.replace("\n", " ")[:110])
        shot(page, "08-joint-badge")
        close_sheet(page)
        dismiss_popup(page)

        # ---------- 3. 턴을 넘겨 실제 집행 확인 ----------
        date0 = page.locator("#hud-date").inner_text()
        for _ in range(4):
            page.click('[data-act="endturn"]')
            page.wait_for_timeout(700)
            dismiss_popup(page)
            if page.locator("#hud-date").inner_text() != date0:
                break
        page.wait_for_timeout(900)
        date1 = page.locator("#hud-date").inner_text()
        step("턴이 넘어간다", date1 != date0, f"{date0} -> {date1}")
        page.click('[data-act="menu"]')
        page.wait_for_timeout(300)
        page.click('[data-act="open-reports"]')
        page.wait_for_timeout(500)
        reports = page.locator("#sheet").inner_text()
        joint_lines = [ln for ln in reports.split("\n") if "공동" in ln]
        step("군보에 [공동 공격] 기록", any("[공동 공격]" in ln or "지키지 못했습니다" in ln for ln in joint_lines),
             " | ".join(joint_lines)[:200])
        shot(page, "09-reports")
        close_sheet(page)

        # 레이아웃 넘침 없음
        box = page.evaluate("""() => {
          const w = window.innerWidth;
          const bad = [...document.querySelectorAll('#sheet *')].filter(el => {
            const r = el.getBoundingClientRect();
            return r.width && (r.right > w + 1 || r.left < -1);
          }).length;
          return { w, bad, scrollW: document.documentElement.scrollWidth };
        }""")
        step("390 폭에서 가로 넘침 없음", box["bad"] == 0 and box["scrollW"] <= box["w"] + 1, box)
        step("자바스크립트 오류 없음", len(errors) == 0, errors[:3])
        b.close()


def serve():
    handler = functools.partial(SimpleHTTPRequestHandler, directory=ROOT)
    httpd = ThreadingHTTPServer(("127.0.0.1", 4191), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


if __name__ == "__main__":
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4191/index.html"
    httpd = None if len(sys.argv) > 1 else serve()
    try:
        run(base)
    finally:
        if httpd:
            httpd.shutdown()
    ok = sum(1 for s in steps if s["ok"])
    print(f"\n== {ok}/{len(steps)} OK · 스크린샷 {len(shots)}장 -> {OUT}")
    sys.exit(0 if ok == len(steps) else 1)
