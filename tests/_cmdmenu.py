"""성 패널 카테고리 메뉴 헬퍼 (내정 · 인사 · 군사 · 계략).

하단 성 시트의 1차 버튼은 4개(내정·인사·군사·계략)로 묶여 있고,
개발·징병·이동·출진 같은 세부 명령은 해당 카테고리를 연 뒤에 나타난다.
검증 스크립트는 이 헬퍼로 카테고리를 열고 세부 명령을 누른다.
"""

GROUPS = {
    'agri': 'civil', 'comm': 'civil', 'order': 'civil', 'water': 'civil', 'transport': 'civil',
    'move': 'people', 'talk': 'people', 'search': 'people', 'hire': 'people', 'reward': 'people',
    'draft': 'army', 'train': 'army', 'march': 'army',
}
GROUP_LABELS = {'civil': '내정', 'people': '인사', 'army': '군사'}


def group_btn(page, group):
    return page.locator(f'[data-act="cmd-group"][data-group="{group}"]')


def open_group(page, group, wait=220):
    """카테고리를 연다. 이미 열려 있으면 그대로 둔다."""
    btn = group_btn(page, group)
    if not btn.count():
        return False
    if btn.first.get_attribute('aria-pressed') != 'true':
        btn.first.click()
        page.wait_for_timeout(wait)
    return True


def close_groups(page, wait=180):
    """열린 카테고리를 모두 접는다."""
    for g in GROUP_LABELS:
        btn = group_btn(page, g)
        if btn.count() and btn.first.get_attribute('aria-pressed') == 'true':
            btn.first.click()
            page.wait_for_timeout(wait)


def cmd_locator(page, cmd):
    """세부 명령 버튼 locator. 필요하면 카테고리를 먼저 연다."""
    sel = f'[data-act="cmd"][data-cmd="{cmd}"]'
    g = GROUPS.get(cmd)
    if g and not page.locator(sel).count():
        open_group(page, g)
    return page.locator(sel)


def click_cmd(page, cmd, timeout=2500):
    cmd_locator(page, cmd).first.click(timeout=timeout)


def march_locator(page):
    if not page.locator('[data-act="march"]').count():
        open_group(page, 'army')
    return page.locator('[data-act="march"]')


def click_march(page, timeout=2500):
    march_locator(page).first.click(timeout=timeout)


def menu_labels(page):
    """1차 메뉴 라벨 목록(줄바꿈은 '/'로)."""
    return [t.replace('\n', '/') for t in page.locator('.cp-cmds .btn').all_inner_texts()]
