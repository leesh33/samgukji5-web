"""삼국 한 턴 — 병력 수송 · 보물 종류별 장착 라이브 검증 (390×844)
사용: python3 samgukji5-web/tests/verify_transport_treasure.py [URL] [TAG]

확인:
  · 수송 시트에 병력 스텝퍼와 「도착 성 주둔 상한/보낼 수 있는 병력」 안내가 있다
  · 금·식량·병력을 함께 보내면 양쪽 성 수치가 즉시 바뀌고 훈련도가 가중 평균된다
  · 병력만 단독 수송도 된다
  · 보물 수여 화면이 「지닌 보물 …」·「같은 종류 → 교체」를 구분해 보여 준다
  · 다른 종류 보물 2개를 한 장수에게 주면 둘 다 남고 장수 상세에 모두 보인다
  · 여포처럼 처음부터 두 종류를 지닌 장수는 무장 일람에서 「적토마 +1」로 보이고 상세에 둘 다 나온다
  · 겹침·가로 넘침 0 · 콘솔 오류 0
"""
import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

from _cmdmenu import click_cmd, close_groups

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
BASE = sys.argv[1] if len(sys.argv) > 1 else "local"
if BASE in ("local", "", "-"):
    # 검증용 정적 서버를 같은 프로세스에서 띄운다(백그라운드 프로세스가 정리되지 않도록)
    handler = partial(SimpleHTTPRequestHandler, directory=ROOT)
    srv = ThreadingHTTPServer(("127.0.0.1", 4173), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    BASE = "http://127.0.0.1:4173/index.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "local"
OUT = os.path.join(ROOT, "downloads", "samguk5")
CHROME = os.path.abspath(os.environ.get("CHROME", "/workspace/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"))
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
os.makedirs(OUT, exist_ok=True)

steps, errors = [], []


def step(label, ok, extra=""):
    steps.append({"step": label, "ok": bool(ok), "extra": str(extra)[:300]})
    print(("OK   " if ok else "FAIL ") + label + ("  -> " + str(extra)[:220] if extra != "" else ""), flush=True)


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
      return {docW: document.documentElement.scrollWidth, winW: w, bad: bad.slice(0, 6)};
    }""")


def close_sheet(page):
    if page.locator('#sheet:not(.hidden)').count():
        btn = page.locator('#sheet [data-act="sheet-close"]').first
        try:
            btn.click(timeout=1500)
        except Exception:
            page.keyboard.press("Escape")
        page.wait_for_timeout(260)


def sheet_text(page):
    return page.evaluate("() => (document.querySelector('#sheet:not(.hidden)') || {}).innerText || ''")


def sheet_title(page):
    return page.evaluate("() => (document.querySelector('#sheet-title') || {}).textContent || ''")


def open_city(page, city_id, wait=520):
    close_sheet(page)
    page.click('[data-act="info"]'); page.wait_for_timeout(260)
    page.click('[data-act="info-tab"][data-tab="cities"]'); page.wait_for_timeout(260)
    page.click(f'[data-act="info-city"][data-city="{city_id}"]'); page.wait_for_timeout(wait)


def facts(page):
    return page.evaluate("""async () => {
      const E = await import('./js/engine.js');
      const ui = await import('./js/ui.js');
      const g = ui.game;
      const pick = (id) => { const c = g.cities[id];
        return { troops: c.troops, train: c.train, gold: c.gold, food: c.food, cap: E.cityTroopsCap(g, id) }; };
      return {
        chenliu: pick('chenliu'), xuchang: pick('xuchang'),
        ap: g.actionPoints,
        treasure: {
          dun: E.treasuresOf(g, 'xiahou_dun').map((t) => t.id).sort(),
          lubu: E.treasuresOf(g, 'lu_bu').map((t) => t.id).sort(),
          dunBonus: E.treasureBonusOf(g, 'xiahou_dun'),
        },
      };
    }""")


def city_stat(page, label_prefix):
    cells = page.evaluate("""() => Array.from(document.querySelectorAll('#citypanel .cs-stats .stat')).map(el => ({
      label: ((el.querySelector('i') || {}).textContent || '').trim(),
      text: el.innerText.replace(/\\n/g, ' ').replace(/\\s+/g, ' ').trim(),
    }))""")
    return next((c for c in cells if c["label"].startswith(label_prefix)), None)


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
    page.click('[data-act="new"]'); page.wait_for_timeout(300)
    page.click('.sc-card[data-id="s194"]'); page.wait_for_timeout(350)
    page.click('.lord-card[data-id="jojo"]'); page.wait_for_timeout(1300)
    page.evaluate("() => localStorage.clear()")
    step("194년 조조로 새 게임 시작", page.evaluate("() => !!document.querySelector('#citypanel')"))

    # ---------- 1. 수송 시트 — 병력 스텝퍼 ----------
    open_city(page, "chenliu")
    before = facts(page)
    click_cmd(page, 'transport'); page.wait_for_timeout(520)
    step("수송 시트 열림", sheet_title(page) == "진류 수송", sheet_title(page))
    labels = page.evaluate("""() => Array.from(document.querySelectorAll('#sheet .field-row label')).map(el => el.textContent.trim())""")
    step("금·식량·병력 세 칸", len(labels) == 3 and labels[2].startswith("병력"), labels)
    step("병력 입력칸(스텝퍼)", page.locator('#tr-troop').count() == 1)
    room = page.evaluate("() => (document.querySelector('#tr-room') || {}).textContent || ''")
    step("도착 성 주둔 상한·보낼 수 있는 병력 안내", "상한" in room and "보낼 수 있는 병력" in room, room)
    step("훈련도 가중 평균 안내", "가중 평균" in sheet_text(page), sheet_text(page)[-80:])
    ov = overflow(page)
    step("수송 시트 가로 넘침 0", ov["bad"] == [], ov["bad"])
    shot(page, "01-transport-sheet")

    # ---------- 2. 금·식량·병력 함께 수송 ----------
    page.click('[data-act="tr-gold+"]'); page.wait_for_timeout(120)
    page.click('[data-act="tr-gold+"]'); page.wait_for_timeout(120)
    page.click('[data-act="tr-food+"]'); page.wait_for_timeout(120)
    page.click('[data-act="tr-food+"]'); page.wait_for_timeout(120)
    page.click('[data-act="tr-troop+"]'); page.wait_for_timeout(120)
    page.click('[data-act="tr-troop+"]'); page.wait_for_timeout(120)
    vals = page.evaluate("""() => ['tr-gold','tr-food','tr-troop'].map(id => (document.querySelector('#' + id) || {}).value)""")
    step("스텝퍼로 금 1,000 · 식량 2,000 · 병력 1,000 입력", vals == ["1000", "2000", "1000"], vals)
    shot(page, "02-transport-filled")
    page.locator('[data-act="do-transport"]:not([disabled])').first.click(); page.wait_for_timeout(900)
    after = facts(page)
    b, a = before, after
    step("금·식량·병력이 양쪽 성에서 함께 이동",
         a["chenliu"]["gold"] == b["chenliu"]["gold"] - 1000 and a["xuchang"]["gold"] == b["xuchang"]["gold"] + 1000
         and a["chenliu"]["food"] == b["chenliu"]["food"] - 2000 and a["xuchang"]["food"] == b["xuchang"]["food"] + 2000
         and a["chenliu"]["troops"] == b["chenliu"]["troops"] - 1000 and a["xuchang"]["troops"] == b["xuchang"]["troops"] + 1000,
         f"진류 {b['chenliu']} → {a['chenliu']} · 허창 {b['xuchang']} → {a['xuchang']}")
    step("훈련도가 병력 수로 가중 평균",
         a["xuchang"]["train"] == round((b["xuchang"]["train"] * b["xuchang"]["troops"] + b["chenliu"]["train"] * 1000)
                                        / (b["xuchang"]["troops"] + 1000)),
         f"훈련 {b['xuchang']['train']} → {a['xuchang']['train']}")
    step("행동력 1 소모", a["ap"] == b["ap"] - 1, f"{b['ap']} → {a['ap']}")
    troops_cell = city_stat(page, "병력")
    step("성 시트 병력 숫자가 즉시 갱신", bool(troops_cell) and a["chenliu"]["troops"] in
         [int(x.replace(",", "")) for x in troops_cell["text"].replace("/", " ").split() if x.replace(",", "").isdigit()],
         troops_cell and troops_cell["text"])
    shot(page, "03-after-transport")

    # ---------- 3. 병력만 단독 수송 ----------
    click_cmd(page, 'transport'); page.wait_for_timeout(460)
    page.click('[data-act="tr-troop+"]'); page.wait_for_timeout(120)
    b2 = facts(page)
    page.locator('[data-act="do-transport"]:not([disabled])').first.click(); page.wait_for_timeout(900)
    a2 = facts(page)
    step("병력만 단독 수송(금·식량 그대로)",
         a2["chenliu"]["troops"] == b2["chenliu"]["troops"] - 500 and a2["xuchang"]["troops"] == b2["xuchang"]["troops"] + 500
         and a2["chenliu"]["gold"] == b2["chenliu"]["gold"] and a2["xuchang"]["food"] == b2["xuchang"]["food"],
         f"진류 병력 {b2['chenliu']['troops']:,} → {a2['chenliu']['troops']:,} · 허창 {b2['xuchang']['troops']:,} → {a2['xuchang']['troops']:,}")

    # ---------- 4. 보물 — 종류별 1개씩 ----------
    close_sheet(page)
    close_groups(page)
    page.click('[data-act="special-menu"]'); page.wait_for_timeout(500)
    step("특수 시트", sheet_title(page) == "특수", sheet_title(page))
    sp = sheet_text(page)
    step("보물 안내에 종류별 1개·최대 5개", "종류별로 1개" in sp and "5개" in sp, sp[sp.find("보물"):][:120].replace("\n", " | "))
    page.click('[data-act="treasures"]'); page.wait_for_timeout(500)
    step("보물 시트", sheet_title(page) == "보물", sheet_title(page))
    note = sheet_text(page)
    step("보물 시트 안내에 종류·최대 5개", "최대 5개" in note, note[:150].replace("\n", " | "))
    shot(page, "04-treasure-sheet")

    # 조조의 의천검(무기)을 회수해 창고에 넣고, 하후돈에게 준다
    rev = page.locator('[data-act="treasure-revoke"][data-tid="uicheon"]')
    step("우리 장수 보물 회수 버튼", rev.count() == 1)
    if rev.count():
        rev.first.click(); page.wait_for_timeout(700)
    pick = page.locator('[data-act="treasure-pick"][data-tid="uicheon"]')
    step("회수 뒤 수여 버튼", pick.count() == 1)
    pick.first.click(); page.wait_for_timeout(500)
    step("수여 화면 제목", "의천검 수여" == sheet_title(page), sheet_title(page))
    pick_note = sheet_text(page)
    step("수여 화면이 같은 종류만 교체된다고 안내", "같은 종류" in pick_note and "다른 종류" in pick_note,
         pick_note[:160].replace("\n", " | "))
    tags = page.evaluate("""() => Array.from(document.querySelectorAll('[data-act="treasure-award"]')).map(b => ({
      gid: b.dataset.gid, tag: (b.querySelector('.or-tag') || {}).textContent || '' }))""")
    dun_tag = next((t["tag"] for t in tags if t["gid"] == "xiahou_dun"), "")
    step("빈손 장수에게는 「빈손」", "빈손" in dun_tag, dun_tag)
    page.locator('[data-act="treasure-award"][data-gid="xiahou_dun"]').first.click(); page.wait_for_timeout(800)
    step("의천검 수여 뒤 보물 시트로 복귀", sheet_title(page) == "보물", sheet_title(page))

    # 명광개(갑옷)도 회수해 같은 장수에게 — 종류가 달라 둘 다 남는다
    rev2 = page.locator('[data-act="treasure-revoke"][data-tid="myeonggwang"]')
    step("명광개(갑옷) 회수 버튼", rev2.count() == 1)
    if rev2.count():
        rev2.first.click(); page.wait_for_timeout(700)
    pick2 = page.locator('[data-act="treasure-pick"][data-tid="myeonggwang"]')
    pick2.first.click(); page.wait_for_timeout(500)
    tags2 = page.evaluate("""() => Array.from(document.querySelectorAll('[data-act="treasure-award"]')).map(b => ({
      gid: b.dataset.gid, tag: (b.querySelector('.or-tag') || {}).textContent || '' }))""")
    dun_tag2 = next((t["tag"] for t in tags2 if t["gid"] == "xiahou_dun"), "")
    step("무기를 지닌 장수는 「지닌 보물 의천검」", "지닌 보물" in dun_tag2 and "의천검" in dun_tag2, dun_tag2)
    page.evaluate("() => { const b = document.querySelector('#sheet .sheet-body'); if (b) b.scrollTop = 0; }")
    page.wait_for_timeout(200)
    shot(page, "05-treasure-pick-held")
    page.locator('[data-act="treasure-award"][data-gid="xiahou_dun"]').first.click(); page.wait_for_timeout(800)
    t = facts(page)["treasure"]
    step("다른 종류 2개가 함께 장착된다(무기+갑옷)", t["dun"] == ["myeonggwang", "uicheon"], t["dun"])
    step("능력치 보너스 합산(통솔 +4 · 무력 +7 · 매력 +1)",
         t["dunBonus"].get("lead") == 4 and t["dunBonus"].get("war") == 7 and t["dunBonus"].get("cha") == 1,
         t["dunBonus"])

    # ---------- 5. 장수 상세 — 보유 보물 두 줄 ----------
    close_sheet(page)
    open_city(page, "chenliu")
    chip = page.locator('[data-act="gen-detail"][data-gid="xiahou_dun"]')
    step("성 시트 장수 칩", chip.count() >= 1)
    chip.first.click(); page.wait_for_timeout(600)
    detail = sheet_text(page)
    step("장수 상세에 두 보물이 모두 표시", "의천검" in detail and "명광개" in detail and "보유 보물" in detail,
         detail[detail.find("보유 보물"):][:120].replace("\n", " | "))
    ov = overflow(page)
    step("장수 상세 가로 넘침 0", ov["bad"] == [], ov["bad"])
    shot(page, "06-general-detail-treasures")
    close_sheet(page)

    # ---------- 6. 여포 — 처음부터 두 종류(여포로 새 게임) ----------
    t = facts(page)["treasure"]
    step("여포가 적토마·방천화극을 함께 지님", t["lubu"] == ["bangcheon", "jeoktoma"], t["lubu"])
    close_sheet(page)
    page.evaluate("() => localStorage.clear()")
    page.reload(wait_until="networkidle"); page.wait_for_timeout(700)
    page.click('[data-act="new"]'); page.wait_for_timeout(300)
    page.click('.sc-card[data-id="s194"]'); page.wait_for_timeout(350)
    page.click('.lord-card[data-id="lubu"]'); page.wait_for_timeout(1300)
    step("194년 여포로 새 게임 시작", page.evaluate("() => !!document.querySelector('#citypanel')"))
    open_city(page, "puyang")
    page.click('[data-act="info"]'); page.wait_for_timeout(300)
    page.click('[data-act="info-tab"][data-tab="generals"]'); page.wait_for_timeout(400)
    rows = page.evaluate("""() => Array.from(document.querySelectorAll('.info-gen')).map(b => ({
      gid: b.dataset.gid, text: b.querySelector('.ig-name').innerText.replace(/\\s+/g, ' ').trim() }))""")
    lubu = next((r for r in rows if r["gid"] == "lu_bu"), None)
    step("무장 일람에 여포가 「적토마 +1」로 표시", bool(lubu) and "적토마 +1" in lubu["text"], lubu and lubu["text"])
    ov = overflow(page)
    step("무장 일람 가로 넘침 0", ov["bad"] == [], ov["bad"])
    shot(page, "07-info-generals-treasures")
    if lubu:
        page.locator('.info-gen[data-gid="lu_bu"] .ig-name').first.click(); page.wait_for_timeout(600)
        d = sheet_text(page)
        step("여포 상세에 적토마·방천화극이 모두 표시", "적토마" in d and "방천화극" in d and "보유 보물" in d,
             d[d.find("보유 보물"):][:120].replace("\n", " | "))
        step("여포 무력이 방천화극(+8)·통솔이 적토마(+4)만큼 보정", page.evaluate("""async () => {
          const E = await import('./js/engine.js'); const ui = await import('./js/ui.js');
          const base = E.generalOf(ui.game, 'lu_bu'), eff = E.effectiveGeneral(ui.game, 'lu_bu');
          return { war: eff.war - base.war, lead: eff.lead - base.lead, cha: eff.cha - base.cha };
        }""") == {"war": 8, "lead": 4, "cha": 1})
        ov = overflow(page)
        step("여포 상세 가로 넘침 0", ov["bad"] == [], ov["bad"])
        shot(page, "08-lubu-detail-treasures")
        close_sheet(page)

    # 컨테이너 메모리가 빠듯하면 배경 선로딩(행동 연출 webp·접속 통계 RPC)이
    # ERR_INSUFFICIENT_RESOURCES 로 밀릴 수 있다 — 게임 화면·기능과 무관한 요청이므로
    # JS·페이지 오류와 구분해 기록한다(에셋 자체는 200으로 서빙됨).
    preload = [e for e in errors if e[0] == "reqfail" and ("/assets/" in e[1] or "supabase.co" in e[1])]
    hard = [e for e in errors if e[0] in ("console", "pageerror")
            and "ERR_INSUFFICIENT_RESOURCES" not in e[1]]
    step("콘솔·페이지 오류 0", not hard, hard[:3])
    if preload:
        print(f"-- 배경 선로딩 실패 {len(preload)}건(컨테이너 자원 한계, 에셋은 200 서빙): {preload[:4]}", flush=True)

    print("\n== 요약 ==")
    ok = sum(1 for s in steps if s["ok"])
    print(f"{ok}/{len(steps)} 통과")
    for s in steps:
        if not s["ok"]:
            print("  FAIL", s["step"], "->", s["extra"])
    browser.close()
    sys.exit(0 if ok == len(steps) else 1)
