/* UI — 화면 전환 · 지도 · 내정 · 전술전투 · 일기토 */
import { CITIES, CITY_BY_ID, GENERAL_BY_ID, SCENARIOS, FORMATIONS, REGIONS, FACTION_COLORS, CUSTOM_COLORS, CUSTOM_MARKS, PORTRAIT_HATS, PORTRAIT_BEARDS, PORTRAIT_SKINS, SKILLS, FORMATION_GROUPS, CORE_FORMATIONS, formationGroup, formationRelation, formationCounterText } from './data.js';
import { formationSVG, drawFormation, DIR_KO } from './formation-art.js';
import * as E from './engine.js';
import * as B from './battle.js';
import { createDuel, duelRound, DUEL_ACTIONS } from './duel.js';
import { portraitURL } from './portrait.js';
import { createMapView } from './mapview.js';
import { sfx } from './audio.js';
import * as Cloud from './sync.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const FALLBACK_SPEC = { ko: '무명', lead: 50, war: 50, int: 50, pol: 50, cha: 50, arms: '보병', skill: 'tongsol', formations: ['eorin'] };
/* 신군주가 만든 장수까지 포함해 장수 데이터를 찾는다 */
const gd = (id) => E.generalOf(game, id) || GENERAL_BY_ID[id] || FALLBACK_SPEC;

const KEYS = { auto: 'samguk5.auto', slot: (i) => `samguk5.slot${i}`, muted: 'samguk5.muted' };

let game = null;
let mapView = null;
let selectedCity = null;
let cityPanelOpen = true; // 성을 고르면 기본으로 펼친 상태
let pendingSetup = null; // 출진 준비
let battle = null;
let battleSel = null;
let battleMode = null;
let battleBusy = false;
let lastBattleResult = null;
let duelCtx = null;
let tickTimer = null;
let turnPending = false;
let currentScenario = null;
let battleSeedCounter = 1;

/* ---------- 화면 ---------- */
function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
  if (id === 'scr-game') {
    setTimeout(() => mapView && mapView.resize(), 30);
    if (!tickTimer) tickTimer = setInterval(() => { if (game && !$('#scr-game').classList.contains('hidden') && !battle) mapView && mapView.render(); }, 800);
  }
}
function toast(msg, ms = 2200) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function colorOf(fid) { return (game && game.factions[fid] && game.factions[fid].color) || '#777'; }
function fname(fid) { return (game && game.factions[fid] && game.factions[fid].name) || '재야'; }

/* ---------- 타이틀 ---------- */
function drawTitleArt() {
  const c = $('#title-canvas');
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth || window.innerWidth;
  const h = c.clientHeight || window.innerHeight;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 다크 슬레이트 바탕
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a0d10'); sky.addColorStop(0.42, '#0f1317'); sky.addColorStop(1, '#080a0d');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // 위쪽 은은한 금빛
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, h * 0.5);
  glow.addColorStop(0, 'rgba(201, 164, 92, 0.10)');
  glow.addColorStop(0.55, 'rgba(201, 164, 92, 0.03)');
  glow.addColorStop(1, 'rgba(201, 164, 92, 0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

  // 육각 보드 결
  const R = Math.max(16, w / 14);
  ctx.strokeStyle = 'rgba(190, 200, 210, 0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let row = -1; row < h / (R * 1.5) + 1; row++) {
    for (let col = -1; col < w / (R * 1.732) + 2; col++) {
      const cx = col * R * 1.732 + (row % 2 ? R * 0.866 : 0);
      const cy = row * R * 1.5;
      for (let k = 0; k <= 6; k++) {
        const a = (Math.PI / 3) * k - Math.PI / 6;
        const px = cx + Math.cos(a) * R;
        const py = cy + Math.sin(a) * R;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }
  }
  ctx.stroke();

  // 등고선
  for (let i = 0; i < 20; i++) {
    const y0 = (i / 20) * h;
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 24) {
      const y = y0 + Math.sin(x * 0.009 + i * 1.3) * 16 + Math.sin(x * 0.021 + i * 0.6) * 6;
      if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(201, 164, 92, 0.075)' : 'rgba(160, 175, 195, 0.045)';
    ctx.stroke();
  }

  // 아래쪽 산 실루엣 — 보드 위 능선
  const layers = [
    { c: '#0d1115', amp: 0.10, base: 0.86, step: 30 },
    { c: '#101519', amp: 0.13, base: 0.92, step: 22 },
    { c: '#12171c', amp: 0.16, base: 0.99, step: 15 },
  ];
  for (const L of layers) {
    ctx.beginPath();
    ctx.moveTo(-10, h);
    for (let x = -10; x <= w + 10; x += L.step) {
      const y = h * L.base - Math.abs(Math.sin(x * 0.008 + L.base * 6)) * h * L.amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 10, h);
    ctx.closePath();
    ctx.fillStyle = L.c;
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 164, 92, 0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 아래쪽 보드 헥스 — 세 세력의 색 테두리 (카드 보드 느낌)
  const hr = Math.max(26, w / 9.5);
  const hxStep = hr * 1.732, hyStep = hr * 1.5;
  const tones = ['rgba(106, 154, 168, 0.20)', 'rgba(201, 164, 92, 0.22)', 'rgba(184, 74, 62, 0.20)'];
  for (let row = 0; row * hyStep + h * 0.60 < h + hr * 2; row++) {
    for (let col = -1; col * hxStep < w + hxStep; col++) {
      const cx = col * hxStep + (row % 2 ? hxStep / 2 : 0);
      const cy = h * 0.60 + row * hyStep;
      const tone = tones[Math.min(2, Math.floor((cx / w) * 3))];
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (Math.PI / 3) * k - Math.PI / 6;
        const px = cx + Math.cos(a) * hr * 0.97;
        const py = cy + Math.sin(a) * hr * 0.97;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = tone;
      ctx.lineWidth = 1;
      ctx.stroke();
      // 성 표시 — 아주 옅은 성곽 실루엣
      if ((row + col) % 3 === 0) {
        ctx.fillStyle = tone;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(cx - hr * 0.16, cy - hr * 0.06, hr * 0.32, hr * 0.16);
        ctx.fillRect(cx - hr * 0.22, cy - hr * 0.2, hr * 0.09, hr * 0.16);
        ctx.fillRect(cx + hr * 0.13, cy - hr * 0.2, hr * 0.09, hr * 0.16);
        ctx.globalAlpha = 1;
      }
    }
  }
  // 아래쪽 짙은 그라데이션으로 버튼 가독성 확보는 CSS가 담당

  // 중앙 세로 기준선
  ctx.strokeStyle = 'rgba(201, 164, 92, 0.05)';
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
}

/* ---------- 시나리오 / 군주 ---------- */
function renderScenarios() {
  const entry = `<button class="sc-card sc-custom" data-act="open-custom" data-sc="${SCENARIOS[0].id}">
      <div class="sc-year">신세력</div>
      <div class="sc-name">★ 신군주 생성</div>
      <div class="sc-meta"><span>이름·깃발·색·초상화·능력을 정해 새 세력으로 시작</span></div>
    </button>`;
  $('#scenario-list').innerHTML = entry + SCENARIOS.map((s) => {
    const facs = s.factions.length;
    const gens = new Set();
    s.factions.forEach((f) => f.generals.forEach((g) => gens.add(g)));
    return `<button class="sc-card" data-act="pick-scenario" data-id="${s.id}">
      <div class="sc-year">${s.year}년</div>
      <div class="sc-name">${s.name}</div>
      <div class="sc-meta"><span>세력 <b>${facs}</b></span><span>성 <b>${s.factions.reduce((n, f) => n + f.cities.length, 0)}</b></span><span>등장 장수 <b>${gens.size}</b></span></div>
    </button>`;
  }).join('');
}

function renderLords(scenarioId) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId);
  currentScenario = sc;
  $('#lord-title').textContent = `${sc.year}년 ${sc.name} — 군주 선택`;
  $('#lord-list').innerHTML = sc.factions.map((f) => {
    const lord = gd(f.lord);
    const color = (game && game.factions[f.id]) ? game.factions[f.id].color : (FACTION_COLORS[f.id] || SCENARIO_COLORS[f.id] || '#888');
    return `<button class="lord-card" data-act="pick-lord" data-id="${f.id}" data-sc="${sc.id}">
      <img src="${portraitURL(lord.id, lord, 56, color)}" alt="${lord.ko}" />
      <div class="lc-name">${f.name}</div>
      <div class="lc-mark">${f.mark || f.name[0]}</div>
      <div class="lc-meta"><span>성 <b>${f.cities.length}</b></span><span>장수 <b>${f.generals.length}</b></span></div>
      <div class="lc-meta lc-stats"><span>통 <b>${lord.lead}</b></span><span>무 <b>${lord.war}</b></span><span>지 <b>${lord.int}</b></span></div>
    </button>`;
  }).join('') + `<button class="btn big cst-lord-entry" data-act="open-custom" data-sc="${sc.id}" style="grid-column:1/-1;margin-top:4px">★ 이 시나리오에서 신군주로 시작</button>`;
}
const SCENARIO_COLORS = {
  jojo: '#3f6fb5', liubei: '#3f9b6b', sunquan: '#c2453f', lubu: '#8a5cc4', yuanshao: '#c08a3e',
  liubiao: '#4a9a9a', liuzhang: '#a8a04a', mateng: '#b06a3a', gongsunzan: '#6a7fb0', sunce: '#c2453f',
  liuyao: '#6a8ab0', yuan_shu: '#b04a8a', zhanglu: '#9a7a5a', taoqian: '#c0a05a', hansui: '#a06a30',
  gongsundu: '#5a8f9a', shixie: '#5a9a6a', free: '#6b6b6b',
};

/* ---------- 신군주(신세력) 생성 ---------- */
let customDraft = null;
const STAT_LABELS = [['lead', '통솔'], ['war', '무력'], ['int', '지력'], ['pol', '정치'], ['cha', '매력']];
const CUSTOM_SKILLS = ['tongsol', 'yongmaeng', 'cheolbyeok', 'dolgyeok', 'sinsan', 'indeok', 'wieom', 'gyeonsu'];
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function openCustomScreen(scenarioId) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  const cities = E.customStartCities(sc.id);
  customDraft = {
    scenarioId: sc.id,
    name: '',
    mark: CUSTOM_MARKS[0],
    color: CUSTOM_COLORS[0].hex,
    style: { hat: 0, beard: 1, skin: 1 },
    stats: E.rollCustomStats(),
    skill: 'tongsol',
    arms: '보병',
    retinue: 0,
    cityId: cities.length ? cities[0].cityId : null,
  };
  renderCustomBody();
  show('scr-custom');
  sfx.click();
}

const customSum = () => STAT_LABELS.reduce((n, [k]) => n + (customDraft.stats[k] || 0), 0);

function renderCustomBody() {
  const d = customDraft;
  const sc = SCENARIOS.find((s) => s.id === d.scenarioId);
  const cities = E.customStartCities(d.scenarioId);
  if (!cities.some((c) => c.cityId === d.cityId)) d.cityId = cities.length ? cities[0].cityId : null;
  const owner = cities.find((c) => c.cityId === d.cityId);
  const preview = { ...d.stats, style: d.style };
  const left = E.CUSTOM_STAT_BUDGET - customSum();
  const leftHTML = left > 0 ? `<b style="color:#8ed18e">+${left}</b>` : left < 0 ? `<b style="color:#e08a7a">${left}</b>` : '<b>0</b>';
  const groups = {};
  for (const c of cities) (groups[c.region] = groups[c.region] || []).push(c);

  $('#custom-body').innerHTML = `
    <div class="cst-preview" style="--fac:${d.color}">
      <img class="cst-face" src="${portraitURL('cl_lord', preview, 104, d.color, d.style)}" alt="신군주 초상화" />
      <div class="cst-who">
        <div class="cst-flag" style="background:${d.color}">${esc(d.mark)}</div>
        <div class="cst-name" data-live="name">${esc(d.name || '새 군주')}</div>
        <div class="cst-sub">${sc.year}년 ${sc.name}${owner ? ` · ${owner.ko}에서 기상` : ''}</div>
      </div>
    </div>

    <div class="cst-sec">
      <label>시나리오</label>
      <div class="chip-row">${SCENARIOS.map((s) => `<button class="pick-chip ${s.id === d.scenarioId ? 'on' : ''}" data-act="cst-scenario" data-v="${s.id}">${s.year} ${s.name}</button>`).join('')}</div>
    </div>

    <div class="cst-sec">
      <label>군주 이름 <small>2~6자</small></label>
      <input id="cst-name" class="cst-input" maxlength="6" value="${esc(d.name)}" placeholder="예: 한호" autocomplete="off" />
    </div>

    <div class="cst-sec">
      <label>깃발 글자 <small>한글 1자</small></label>
      <div class="chip-row">${CUSTOM_MARKS.map((h) => `<button class="pick-chip ${h === d.mark ? 'on' : ''}" data-act="cst-mark" data-v="${h}" style="min-width:44px;font-size:15px">${h}</button>`).join('')}</div>
      <input id="cst-mark" class="cst-input" maxlength="1" value="${esc(d.mark)}" placeholder="한글 1자 직접 입력" autocomplete="off" />
    </div>

    <div class="cst-sec">
      <label>세력 색</label>
      <div class="cst-colors">${CUSTOM_COLORS.map((c) => `<button class="cst-color ${c.hex === d.color ? 'on' : ''}" data-act="cst-color" data-v="${c.hex}" style="background:${c.hex}" aria-label="${c.ko}" title="${c.ko}"></button>`).join('')}</div>
    </div>

    <div class="cst-sec">
      <label>초상화</label>
      <div class="cst-row"><span class="cst-key">머리</span><div class="chip-row">${PORTRAIT_HATS.map((h) => `<button class="pick-chip ${d.style.hat === h.id ? 'on' : ''}" data-act="cst-style" data-k="hat" data-v="${h.id}">${h.ko}</button>`).join('')}</div></div>
      <div class="cst-row"><span class="cst-key">수염</span><div class="chip-row">${PORTRAIT_BEARDS.map((b) => `<button class="pick-chip ${d.style.beard === b.id ? 'on' : ''}" data-act="cst-style" data-k="beard" data-v="${b.id}">${b.ko}</button>`).join('')}</div></div>
      <div class="cst-row"><span class="cst-key">피부</span><div class="chip-row">${PORTRAIT_SKINS.map((s) => `<button class="pick-chip ${d.style.skin === s.id ? 'on' : ''}" data-act="cst-style" data-k="skin" data-v="${s.id}">${s.ko}</button>`).join('')}</div></div>
    </div>

    <div class="cst-sec">
      <label>능력치 <small>최대 ${E.CUSTOM_STAT_BUDGET} · 합계 <span id="cst-sum">${customSum()}</span> · 남은 <span id="cst-left">${leftHTML}</span></small></label>
      <div class="cst-stats">
        ${STAT_LABELS.map(([k, ko]) => `<div class="cst-stat"><span>${ko}</span>
          <button data-act="cst-stat" data-k="${k}" data-d="-1" aria-label="${ko} 줄이기">－</button>
          <b data-stat="${k}">${d.stats[k]}</b>
          <button data-act="cst-stat" data-k="${k}" data-d="1" aria-label="${ko} 늘리기">＋</button></div>`).join('')}
      </div>
      <button class="btn ghost cst-dice" data-act="cst-dice">🎲 주사위로 다시 굴리기</button>
      <p class="note">주사위는 ${E.CUSTOM_STAT_DICE_MIN}~${E.CUSTOM_STAT_BUDGET} 사이 총합으로 나옵니다. 남은 점수는 ＋로 직접 더 넣을 수 있습니다.</p>
    </div>

    <div class="cst-sec">
      <label>특기</label>
      <div class="chip-row">${CUSTOM_SKILLS.map((k) => `<button class="pick-chip ${d.skill === k ? 'on' : ''}" data-act="cst-skill" data-v="${k}">${SKILLS[k].ko}</button>`).join('')}</div>
    </div>

    <div class="cst-sec">
      <label>주력 병과</label>
      <div class="chip-row">${['보병', '궁병', '기병', '수군'].map((a) => `<button class="pick-chip ${d.arms === a ? 'on' : ''}" data-act="cst-arms" data-v="${a}">${a}</button>`).join('')}</div>
    </div>

    <div class="cst-sec">
      <label>시작 성 <small>소세력의 성 하나를 받습니다</small></label>
      <select id="cst-city" class="cst-input">
        ${Object.entries(groups).map(([r, list]) => `<optgroup label="${r}">${list.map((c) => `<option value="${c.cityId}" ${c.cityId === d.cityId ? 'selected' : ''}>${c.ko} · ${c.fromName}군 (성 ${c.fromCities}곳·병 ${fmt(c.troops)})</option>`).join('')}</optgroup>`).join('')}
      </select>
      ${owner ? `<p class="note">${owner.ko}은(는) ${owner.fromName}군에서 떨어져 나옵니다. ${owner.fromName}군은 나머지 ${owner.fromCities - 1}성을 지킵니다.</p>` : ''}
    </div>

    <div class="cst-sec">
      <label>휘하 장수 <small>함께 시작하는 신무장</small></label>
      <div class="chip-row">${[0, 1, 2].map((n) => `<button class="pick-chip ${d.retinue === n ? 'on' : ''}" data-act="cst-retinue" data-v="${n}">${n === 0 ? '혼자' : `${n}명 동반`}</button>`).join('')}</div>
    </div>

    <button class="btn big" data-act="cst-start" style="margin:6px 0 20px">「${esc(d.name || '새 군주')}」 세력으로 시작</button>
  `;
  if (mapView) requestAnimationFrame(() => mapView.resize());
}

function adjustCustomStat(k, delta) {
  const r = E.adjustCustomStat(customDraft.stats, k, delta);
  if (!r.ok) {
    if (r.reason === 'limit') return;
    if (r.reason === 'budget') toast('배분할 수 있는 능력치를 모두 썼습니다. 다른 항목을 줄이세요.');
    sfx.fail();
    return;
  }
  customDraft.stats = r.stats;
  const cell = $(`[data-stat="${k}"]`);
  if (cell) cell.textContent = customDraft.stats[k];
  const left = E.CUSTOM_STAT_BUDGET - customSum();
  const lab = $('#cst-left');
  if (lab) lab.innerHTML = left > 0 ? `<b style="color:#8ed18e">+${left}</b>` : left < 0 ? `<b style="color:#e08a7a">${left}</b>` : '<b>0</b>';
  const sumEl = $('#cst-sum');
  if (sumEl) sumEl.textContent = customSum();
  sfx.click();
}

function startCustomGame() {
  const d = customDraft;
  const name = String($('#cst-name') ? $('#cst-name').value : d.name).trim();
  d.name = name;
  if (name.length < E.CUSTOM_NAME_MIN || name.length > E.CUSTOM_NAME_MAX) {
    toast('군주 이름은 2~6자로 지어 주세요.');
    sfx.fail();
    const inp = $('#cst-name');
    if (inp) inp.focus();
    return;
  }
  const mark = E.customMark(String($('#cst-mark') ? $('#cst-mark').value : d.mark).trim(), name);
  d.mark = mark;
  const cities = E.customStartCities(d.scenarioId);
  const cityId = d.cityId || (cities[0] && cities[0].cityId);
  if (!cityId) { toast('시작 성을 골라 주세요.'); sfx.fail(); return; }
  let custom;
  try {
    custom = E.buildCustomLord({
      name, mark: d.mark, color: d.color, cityId,
      stats: d.stats, skill: d.skill, arms: d.arms,
      retinue: d.retinue, style: d.style,
    });
  } catch (err) {
    toast(err.message);
    sfx.fail();
    return;
  }
  game = E.createGame(d.scenarioId, custom.faction.id, 1 + (Date.now() % 99991), { custom });
  currentScenario = SCENARIOS.find((s) => s.id === d.scenarioId);
  sfx.ok();
  afterGameInit();
  toast(`${custom.faction.name} 세력이 ${CITY_BY_ID[cityId].ko}에서 불기를 올렸습니다!`, 2600);
}

function onCustomInput(e) {
  if (!customDraft) return;
  const t = e.target;
  if (t.id === 'cst-name') {
    customDraft.name = t.value;
    const live = $('[data-live="name"]');
    if (live) live.textContent = t.value || '새 군주';
  } else if (t.id === 'cst-mark') {
    customDraft.mark = (t.value.match(/[가-힣]/) || [''])[0];
    if (t.value !== customDraft.mark) t.value = customDraft.mark;
    const flag = $('.cst-flag');
    if (flag) flag.textContent = customDraft.mark || (customDraft.name || '신')[0];
  } else if (t.id === 'cst-city' && e.type === 'change') {
    customDraft.cityId = t.value;
    renderCustomBody();
  }
}

/* ---------- 게임 시작 ---------- */
function startGame(scenarioId, factionId) {
  game = E.createGame(scenarioId, factionId, 1 + (Date.now() % 99991));
  afterGameInit();
}

function afterGameInit() {
  show('scr-game');
  if (!mapView) {
    mapView = createMapView($('#map'), {
      onSelectCity: (id) => selectCity(id),
      onTapEmpty: () => { selectedCity = null; cityPanelOpen = false; mapView.setSelected(null); renderCityPanel(); },
    });
  }
  mapView.setState(game);
  const playerCities = E.factionCities(game, game.playerId);
  selectedCity = playerCities.length ? playerCities[0].id : null;
  cityPanelOpen = true;
  mapView.setSelected(selectedCity);
  mapView.resetView();
  mapView.resize();
  renderGame();
  autoSave();
  if ((game.pendingPrisoners || []).length) setTimeout(openPrisonerSheet, 500);
}

function autoSave() {
  if (!game) return;
  try { localStorage.setItem(KEYS.auto, E.serialize(game)); } catch (e) { /* 저장 공간 부족 */ }
  Cloud.noteSaved('auto');
  refreshContinue();
}

/* 이어하기 버튼은 자동 저장 유무로 켜고 끈다 */
function refreshContinue() {
  const b = $('#btn-continue');
  if (b) b.disabled = !localStorage.getItem(KEYS.auto);
}

/* ---------- HUD ---------- */
// 자원 수치가 칸 폭을 넘으면 글자를 줄여 한 줄에 담는다(자릿수가 커지는 후반부 대비)
function fitResValues() {
  const sizes = ['', '12px', '11px', '10px'];
  document.querySelectorAll('.resbar .res b').forEach((b) => {
    const cell = b.parentElement;
    for (const size of sizes) {
      b.style.fontSize = size;
      if (cell.scrollWidth <= cell.clientWidth) break;
    }
  });
}

function renderGame() {
  if (!game) return;
  if (!game.gameOver) E.checkVictory(game);
  const f = game.factions[game.playerId];
  const sum = E.factionSummary(game, game.playerId);
  const lord = gd(f.lord);
  $('#hud-crest').textContent = f.mark || f.name[0];
  $('#hud-crest').style.background = '#161b21';
  $('#hud-crest').style.color = f.color;
  $('#hud-crest').style.borderColor = f.color;
  $('#hud-faction').textContent = `${f.name}군${lord && lord.ko !== f.name ? ' · ' + lord.ko : ''}`;
  $('#hud-date').textContent = `${game.year}년 ${game.month}월 · 제${game.turn}턴`;
  const office = E.officeOf(game, game.playerId);
  const officeEl = $('#hud-office');
  if (officeEl) {
    officeEl.textContent = office.ko;
    const nx = E.nextOffice(game, game.playerId);
    officeEl.title = nx ? `다음 관직 ${nx.ko} — 성 ${nx.cities}곳·명성 ${nx.fame}` : '황제의 자리';
  }
  $('#res-gold').textContent = fmt(sum.gold);
  $('#res-food').textContent = fmt(sum.food);
  $('#res-troops').textContent = fmt(sum.troops);
  $('#res-fame').textContent = Math.round(f.fame);
  $('#res-ap').textContent = `${game.actionPoints}/${game.maxActionPoints}`;
  fitResValues();
  $('#turn-hint').textContent = `명령 ${game.actionPoints}`;
  $('#btn-endturn').disabled = !!game.gameOver;


  renderCityPanel();
  if (mapView) {
    mapView.setState(game);
    mapView.setSelected(selectedCity);
  }
  if (game.gameOver) setTimeout(showEnding, 350);
  queueGameNotice();
}

/* 관직 승급·월간 이벤트는 시트가 비어 있을 때 한 번씩 띄운다 */
function queueGameNotice() {
  if (!game || game.gameOver) return;
  E.syncOffices(game);
  clearTimeout(queueGameNotice._t);
  queueGameNotice._t = setTimeout(() => {
    if (!game || !$('#sheet').classList.contains('hidden')) return;
    if ((game.lastPromotions || []).some((p) => p.factionId === game.playerId)) { openPromotionSheet(); return; }
    if (game.pendingEvent && !game.pendingEvent.shown) { game.pendingEvent.shown = true; openEventSheet(); }
  }, 280);
}

function openRegionMenu() {
  const regions = [...new Set(CITIES.map((c) => c.region))];
  const chips = regions.map((r) => {
    const mine = CITIES.filter((c) => c.region === r && game.cities[c.id].owner === game.playerId).length;
    return `<button class="pick-chip ${mine ? 'on' : ''}" data-act="jump-region" data-region="${r}" style="min-width:76px">${r}${mine ? ` <b style="color:#e8c96a">${mine}</b>` : ''}</button>`;
  }).join('');
  openSheet('권역 이동', `<div class="chip-row">${chips}</div>`);
}

function openReports() {
  const rows = game.log.slice(-40).reverse()
    .map((l) => `<div class="report-row"><b>${l.year}.${String(l.month).padStart(2, '0')}</b>${l.text}</div>`).join('');
  openSheet('군보', rows || '<p class="note">아직 기록이 없습니다.</p>');
}

/* ---------- 도시 패널 ---------- */
function selectCity(id) {
  if (id !== selectedCity) cityPanelOpen = true; // 새 성을 탭하면 다시 펼침
  selectedCity = id;
  sfx.select();
  if (mapView) { mapView.setSelected(id); }
  renderCityPanel();
}

/* 내 성을 지도 순서(북→남)대로 돌려보기 */
function ownCityIds() {
  if (!game) return [];
  const order = new Map(CITIES.map((c, i) => [c.id, i]));
  return E.factionCities(game, game.playerId).map((c) => c.id)
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

function stepCity(dir) {
  if (!game || !selectedCity) return false;
  const ids = ownCityIds();
  if (!ids.length) { toast('내 성이 없습니다.'); sfx.fail(); return false; }
  const cur = ids.indexOf(selectedCity);
  const next = cur < 0
    ? (dir > 0 ? ids[0] : ids[ids.length - 1])
    : ids[(cur + dir + ids.length) % ids.length];
  if (next === selectedCity) {
    if (mapView) mapView.focusCity(next);
    return false;
  }
  selectedCity = next;
  sfx.select();
  if (mapView) { mapView.setSelected(next); mapView.focusCity(next); }
  renderCityPanel(dir);
  return true;
}

/* 하단 도시 패널 좌우 스와이프 → 내 성 전환 (장수 줄·입력칸은 양보) */
let suppressClickUntil = 0;
let swipeState = null;

function bindCityPanelSwipe() {
  const panel = $('#citypanel');
  if (!panel || panel.dataset.swipeBound) return;
  panel.dataset.swipeBound = '1';

  const usable = (target) => !target.closest('.cp-gens') && !target.closest('input, select, textarea');

  const begin = (x, y) => {
    if (!selectedCity) return;
    swipeState = { x, y, t: Date.now(), dx: 0, dy: 0, axis: null };
  };
  const move = (x, y, ev) => {
    const s = swipeState;
    if (!s) return false;
    s.dx = x - s.x;
    s.dy = y - s.y;
    if (!s.axis && (Math.abs(s.dx) > 9 || Math.abs(s.dy) > 9)) {
      s.axis = Math.abs(s.dx) > Math.abs(s.dy) * 1.35 ? 'x' : 'y';
    }
    if (s.axis === 'x') {
      if (ev && ev.cancelable) ev.preventDefault();
      panel.style.transform = `translateX(${Math.max(-18, Math.min(18, s.dx * 0.22))}px)`;
    }
    return s.axis === 'x';
  };
  const finish = () => {
    const s = swipeState;
    swipeState = null;
    panel.style.transform = '';
    if (!s || s.axis !== 'x') return;
    const dt = Date.now() - s.t;
    const dist = Math.abs(s.dx);
    if (!(dist > 52 || (dist > 30 && dt < 500))) return;
    suppressClickUntil = Date.now() + 350;
    stepCity(s.dx < 0 ? 1 : -1);
  };

  // 터치: 브라우저 스크롤과 경합하지 않게 touch 이벤트로 처리
  panel.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || !usable(e.target)) return;
    begin(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    move(e.touches[0].clientX, e.touches[0].clientY, e);
  }, { passive: false });
  panel.addEventListener('touchend', finish);
  panel.addEventListener('touchcancel', () => { swipeState = null; panel.style.transform = ''; });

  // 마우스: 넓은 화면에서 드래그로도 넘김
  panel.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !usable(e.target)) return;
    begin(e.clientX, e.clientY);
  });
  panel.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    move(e.clientX, e.clientY, null);
  });
  panel.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') finish(); });
  panel.addEventListener('pointercancel', (e) => { if (e.pointerType === 'mouse') { swipeState = null; panel.style.transform = ''; } });
}

function renderCityPanel(dir = 0) {
  const panel = $('#citypanel');
  if (!selectedCity) { panel.classList.add('hidden'); return; }
  const c = game.cities[selectedCity];
  const base = CITY_BY_ID[selectedCity];
  const mine = c.owner === game.playerId;
  const ownerName = c.owner ? fname(c.owner) : '재야';
  const gens = mine ? E.generalsInCity(game, selectedCity) : Object.values(game.generals).filter((g) => g.city === selectedCity && g.faction === c.owner && !g.captive && !g.dead);
  const genHTML = gens.slice(0, 12).map((g) => {
    const t = gd(g.id);
    return `<div class="gen-chip ${g.acted ? 'done' : ''}" title="${t.ko}">
      <img src="${portraitURL(g.id, t, 32, colorOf(g.faction))}" alt="${t.ko}" />
      <span>${t.ko}</span></div>`;
  }).join('');

  let cmdHTML = '';
  if (mine) {
    const ownCount = E.factionCities(game, game.playerId).length;
    const partners = E.talkPartners(game, selectedCity);
    const talkLeft = partners.filter((g) => !E.talkedThisTurn(game, g.id) && g.loyalty < 100).length;
    const moveReady = ownCount > 1 && E.generalsInCity(game, selectedCity).some((g) => !g.acted);
    const moveSub = ownCount > 1 ? (moveReady ? '행동력 1' : '움직일 장수 없음') : '성 2곳부터';
    const talkSub = !partners.length ? '대상 없음' : (talkLeft ? '행동력 1' : '이번 달 완료');
    const plotFoes = E.neighborFoes(game, selectedCity).filter((n) => !E.isPacified(game, game.playerId, game.cities[n].owner));
    const plotReady = plotFoes.length > 0 && E.generalsInCity(game, selectedCity).some((g) => !g.acted) && game.actionPoints >= 1;
    const plotSub = !plotFoes.length ? '적 성 없음' : (game.actionPoints >= 1 ? '행동력 1' : '행동력 부족');
    const acts = [
      ['move', '이동', moveSub, !moveReady],
      ['talk', '대화', talkSub, !partners.length || !talkLeft || game.actionPoints < 1],
      ['plot', '계략', plotSub, !plotReady],
      ['agri', '개발'], ['comm', '상업'], ['order', '치안'], ['water', '수리'],
      ['draft', '징병', '2령'], ['train', '훈련'], ['search', '탐색'], ['hire', '등용'],
      ['reward', '포상'], ['transport', '수송'],
    ];
    cmdHTML = acts.map(([k, ko, sub, off]) => `<button class="btn ${k === 'move' || k === 'talk' || k === 'plot' ? k : ''}" data-act="cmd" data-cmd="${k}" data-city="${selectedCity}" ${off ? 'disabled' : ''}>${ko}${sub ? `<small>${sub}</small>` : ''}</button>`).join('');
    const enemies = E.adjacentEnemies(game, selectedCity);
    cmdHTML += enemies.length
      ? `<button class="btn march" data-act="march" data-city="${selectedCity}">출진</button>`
      : '<button class="btn" disabled>출진</button>';
  } else {
    const pacified = !!c.owner && E.isPacified(game, game.playerId, c.owner);
    const src = pacified ? [] : E.adjacentFriends(game, selectedCity).filter((id) => E.generalsInCity(game, id).length);
    const plotSrc = E.adjacentFriends(game, selectedCity).filter((id) => E.generalsInCity(game, id).length);
    if (c.owner) {
      cmdHTML = src.length
        ? `<button class="btn march" data-act="attack-enemy" data-city="${selectedCity}" style="grid-column:span 2">공격</button>`
        : `<button class="btn" disabled style="grid-column:span 2">${pacified ? (E.isAllied(game, game.playerId, c.owner) ? '동맹 중' : '정전 중') : '공격 불가'}</button>`;
      cmdHTML += plotSrc.length && !pacified
        ? `<button class="btn plot" data-act="plot-city" data-city="${selectedCity}" style="grid-column:span 2">계략</button>`
        : `<button class="btn" disabled style="grid-column:span 2">${pacified ? '계략 불가' : '계략 불가'}</button>`;
    } else {
      cmdHTML = '<button class="btn" disabled style="grid-column:span 2">공격 불가</button>';
    }
  }

  const own = ownCityIds();
  const ownIdx = own.indexOf(selectedCity);
  let scoutHTML = '';
  if (!mine && c.owner) {
    if (E.isScouted(game, selectedCity)) {
      const si = E.scoutedInfo(game, selectedCity);
      scoutHTML = `<div class="sc-box">
        <div class="sc-head">정탐 정보 <span>${E.scoutTurnsLeft(game, selectedCity)}턴 남음</span></div>
        <div class="sc-meta">훈련 ${si.train} · 치안 ${si.order} · 방어 ${si.def} · 금 ${fmt(si.gold)} · 량 ${fmt(si.food)}</div>
        <div class="sc-gens">${si.generals.map((g) => `<div class="sc-gen"><b>${g.ko}</b><span>통${g.lead} 무${g.war} 지${g.int} 충${g.loyalty}</span></div>`).join('') || '<span class="none">주둔 장수 없음</span>'}</div>
      </div>`;
    } else {
      scoutHTML = '<div class="sc-hint">정탐을 보내면 적 성의 장수·충성·훈련을 3턴 동안 살필 수 있습니다.</div>';
    }
  }
  const showNav = own.length > 1 || (own.length === 1 && ownIdx === -1);
  const navHTML = showNav
    ? `<div class="cs-nav" role="group" aria-label="내 성 이동">
        <button class="cs-navbtn" data-act="city-prev" aria-label="이전 내 성">‹</button>
        <span class="cs-navidx">${ownIdx >= 0 ? `${ownIdx + 1}/${own.length}` : `내 성 ${own.length}`}</span>
        <button class="cs-navbtn" data-act="city-next" aria-label="다음 내 성">›</button>
      </div>`
    : '';

  panel.classList.remove('hidden', 'swipe-next', 'swipe-prev');
  panel.classList.toggle('open', cityPanelOpen);
  panel.dataset.city = selectedCity;
  panel.style.transform = '';
  panel.innerHTML = `
    <div class="cs-head">
      <div class="cs-row">
        <div class="cs-id"><span class="region-tag">${base.region}</span><b class="cs-name">${base.ko}</b></div>
        <span class="cs-owner" style="color:${colorOf(c.owner)}">${ownerName}</span>
        <div class="cs-actions">
          <button class="cs-toggle" data-act="city-toggle">${cityPanelOpen ? '접기 ▾' : '명령 ▴'}</button>
          <button class="cs-close" data-act="close-city" aria-label="닫기">✕</button>
        </div>
      </div>
      <div class="cs-brief">
        <div class="cs-brief-main">
          <span>병 <b>${fmt(c.troops)}</b></span><span>금 <b>${fmt(c.gold)}</b></span><span>량 <b>${fmt(c.food)}</b></span><span>방 <b>${c.def}</b></span>
        </div>
        ${navHTML}
      </div>
    </div>
    <div class="cs-body">
      <div class="cs-stats">
        <div class="stat"><i>농업</i><b>${c.agri}</b></div>
        <div class="stat"><i>상업</i><b>${c.comm}</b></div>
        <div class="stat"><i>치안</i><b>${c.order}</b></div>
        <div class="stat"><i>수리</i><b>${c.water}</b></div>
        <div class="stat"><i>병력</i><b>${fmt(c.troops)}</b></div>
        <div class="stat"><i>훈련</i><b>${c.train}</b></div>
        <div class="stat"><i>금</i><b>${fmt(c.gold)}</b></div>
        <div class="stat"><i>식량</i><b>${fmt(c.food)}</b></div>
      </div>
      ${gens.length ? `<div class="cp-gens">${genHTML}</div>` : '<div class="cp-gens"><span class="none">주둔 장수 없음</span></div>'}
      ${scoutHTML}
      <div class="cp-cmds">${cmdHTML}</div>
    </div>
  `;
  if (dir) {
    void panel.offsetWidth; // 애니메이션 재시작
    panel.classList.add(dir > 0 ? 'swipe-next' : 'swipe-prev');
  }
  if (mapView) requestAnimationFrame(() => mapView.resize());
}

/* ---------- 시트 ---------- */
function openSheet(title, html) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  $('#sheet').classList.remove('hidden');
}
function closeSheet() { $('#sheet').classList.add('hidden'); }

function officerRowHTML(g, actionAct, extra = '', disabledHint = '') {
  const t = gd(g.id);
  const done = g.acted || g.captive;
  return `<button class="officer-row ${done ? 'done' : ''}" data-act="${actionAct}" data-officer="${g.id}" ${done ? 'disabled' : ''}>
    <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
    <div class="or-main">
      <div class="or-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
      <div class="or-stats"><span>통<b>${t.lead}</b></span><span>무<b>${t.war}</b></span><span>지<b>${t.int}</b></span><span>정<b>${t.pol}</b></span><span>매<b>${t.cha}</b></span><span>충<b>${g.loyalty}</b></span></div>
    </div>
    <div class="or-go">${done ? '완료' : extra || '선택'}</div>
  </button>`;
}
function skillName(id) {
  const map = { hwagye: '화계', hollan: '혼란', gomu: '고무', chiryo: '치료', jeogyeok: '저격', dolgyeok: '돌격', cheolbyeok: '철벽', sujeon: '수전', sinsan: '신산', tongsol: '통솔', yongmaeng: '용맹', wieom: '위엄', indeok: '인덕', gyeonsu: '견수', hogwi: '호위', bigyeok: '비장', pokgyeok: '폭격' };
  return map[id] || id;
}

let sheetCommandType = null;
let sheetCityId = null;

function openCommandSheet(type, cityId) {
  sheetCommandType = type;
  sheetCityId = cityId;
  const c = game.cities[cityId];
  const label = E.COMMANDS[type] ? E.COMMANDS[type].ko : type;
  const gens = E.generalsInCity(game, cityId);
  if (!gens.length) { toast('이 성에는 명령을 내릴 장수가 없습니다.'); sfx.fail(); return; }
  if (type === 'hire') {
    const free = E.freeGeneralsInCity(game, cityId);
    if (!free.length) { toast('이 성에 재야 장수가 없습니다.'); sfx.fail(); return; }
    const rows = free.map((g) => {
      const t = gd(g.id);
      return `<button class="officer-row" data-act="do-hire" data-officer="${g.id}" data-city="${cityId}">
        <img src="${portraitURL(g.id, t, 40, '#444')}" alt="${t.ko}" />
        <div class="or-main"><div class="or-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
        <div class="or-stats"><span>통<b>${t.lead}</b></span><span>무<b>${t.war}</b></span><span>지<b>${t.int}</b></span><span>정<b>${t.pol}</b></span><span>매<b>${t.cha}</b></span></div></div>
        <div class="or-go">등용</div></button>`;
    }).join('');
    openSheet(`${cityId ? CITY_BY_ID[cityId].ko : ''} 등용`, `<p class="note">먼저 등용에 나설 아군 장수를 고르세요. 매력과 명성에 따라 성공률이 달라집니다.</p>${rows}`);
    return;
  }
  if (type === 'transport') {
    openTransportSheet(cityId);
    return;
  }
  if (type === 'reward') {
    const targets = gens.filter((g) => g.id !== game.factions[game.playerId].lord);
    const rows = targets.sort((a, b) => a.loyalty - b.loyalty).map((g) => {
      const t = gd(g.id);
      return `<button class="officer-row" data-act="do-reward" data-officer="${g.id}" data-city="${cityId}">
        <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
        <div class="or-main"><div class="or-name">${t.ko}</div>
        <div class="or-stats"><span>충성 <b>${g.loyalty}</b></span><span>매력 <b>${t.cha}</b></span></div></div>
        <div class="or-go">포상</div></button>`;
    }).join('');
    openSheet('포상 — 금 120', `<p class="note">포상할 장수를 고르면 충성도가 오릅니다.</p>${rows || '<p class="note">포상할 장수가 없습니다.</p>'}`);
    return;
  }
  const rows = gens.map((g) => officerRowHTML(g, 'do-command')).join('');
  const extra = type === 'draft' ? '<p class="note">징병: 금 250 · 식량 400 · 행동력 2. 징병한 장수의 통솔이 많을수록 병력이 많이 모입니다.</p>'
    : type === 'search' ? '<p class="note">탐색: 숨은 인재·금·식량을 찾습니다. 지력이 높을수록 유리합니다.</p>'
    : `<p class="note">${E.COMMANDS[type] ? E.COMMANDS[type].desc : ''} 행동력 1을 사용합니다.</p>`;
  openSheet(`${CITY_BY_ID[cityId].ko} — ${label}`, extra + rows);
}

function openTransportSheet(cityId) {
  const targets = E.adjacentFriends(game, cityId);
  const c = game.cities[cityId];
  const gens = E.generalsInCity(game, cityId);
  openSheet(`${CITY_BY_ID[cityId].ko} 수송`,
    `<p class="note">인접한 아군 성으로 금·식량을 보냅니다. 보낼 장수와 대상을 고르세요.</p>
     <div class="chip-row" id="tr-targets">${targets.map((t, i) => `<button class="pick-chip ${i === 0 ? 'on' : ''}" data-act="tr-target" data-city="${t}">${CITY_BY_ID[t].ko}</button>`).join('')}</div>
     <div class="field-row"><label>금 (보유 ${fmt(c.gold)})</label><div class="stepper"><button data-act="tr-gold-" data-city="${cityId}">－</button><input id="tr-gold" type="number" value="0" min="0" max="${c.gold}" inputmode="numeric" /><button data-act="tr-gold+" data-city="${cityId}">＋</button></div></div>
     <div class="field-row"><label>식량 (보유 ${fmt(c.food)})</label><div class="stepper"><button data-act="tr-food-" data-city="${cityId}">－</button><input id="tr-food" type="number" value="0" min="0" max="${c.food}" inputmode="numeric" /><button data-act="tr-food+" data-city="${cityId}">＋</button></div></div>
     <div id="tr-officers">${gens.map((g) => officerRowHTML(g, 'do-transport')).join('')}</div>
     <p class="note" id="tr-note">보낼 장수를 고르면 실행됩니다.</p>`);
  uiState.trTarget = targets[0];
  uiState.trGold = 0; uiState.trFood = 0;
}
const uiState = { trTarget: null, trGold: 0, trFood: 0 };

/* ---------- 명령 실행 ---------- */
function doCommand(type, officerId, cityId) {
  const res = E.runCommand(game, type, { cityId, officerId });
  closeSheet();
  if (res.ok) { sfx.ok(); toast(res.msg); }
  else { sfx.fail(); toast(res.msg); }
  renderGame();
  autoSave();
}

function doHire(cityId, gid) {
  const officer = E.bestOfficer(game, cityId, 'cha');
  if (!officer) { toast('등용에 나설 장수가 없습니다.'); return; }
  const res = E.runCommand(game, 'hire', { cityId, officerId: officer.id, hireId: gid });
  closeSheet();
  if (res.ok) { sfx.ok(); toast(res.msg); } else { sfx.fail(); toast(res.msg); }
  renderGame(); autoSave();
}

function doReward(cityId, gid) {
  const officer = E.bestOfficer(game, cityId, 'cha');
  if (!officer) return;
  const res = E.runCommand(game, 'reward', { cityId, officerId: officer.id, rewardId: gid });
  closeSheet();
  if (res.ok) { sfx.coin(); toast(res.msg); } else { sfx.fail(); toast(res.msg); }
  renderGame(); autoSave();
}

/* ---------- 도시간 장수 이동 ---------- */
let moveDraft = null;

function openMoveSheet(cityId) {
  const dests = E.moveDestinations(game, cityId);
  if (!dests.length) { toast('옮겨 갈 다른 내 성이 없습니다.'); sfx.fail(); return; }
  const ready = E.generalsInCity(game, cityId).filter((g) => !g.acted);
  if (!ready.length) { toast('이번 달에 움직일 수 있는 장수가 없습니다.'); sfx.fail(); return; }
  moveDraft = { fromCityId: cityId, toCityId: dests[0].cityId, gids: [] };
  renderMoveSheet();
  sfx.click();
}

function toggleMoveGeneral(gid) {
  if (!moveDraft) return;
  const i = moveDraft.gids.indexOf(gid);
  if (i >= 0) moveDraft.gids.splice(i, 1); else moveDraft.gids.push(gid);
  renderMoveSheet();
  sfx.click();
}

function renderMoveSheet() {
  const d = moveDraft;
  if (!d) return;
  const fromName = CITY_BY_ID[d.fromCityId].ko;
  const gens = E.generalsInCity(game, d.fromCityId);
  const lordId = game.factions[game.playerId].lord;
  const rows = gens.map((g) => {
    const t = gd(g.id);
    const on = d.gids.includes(g.id);
    const done = !!g.acted;
    return `<button class="officer-row ${done ? 'done' : ''} ${on ? 'picked' : ''}" data-act="mv-gen" data-officer="${g.id}" ${done ? 'disabled' : ''}>
      <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
      <div class="or-main">
        <div class="or-name">${t.ko}${g.id === lordId ? ' <i class="mv-lord">군주</i>' : ''} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
        <div class="or-stats"><span>통<b>${t.lead}</b></span><span>무<b>${t.war}</b></span><span>지<b>${t.int}</b></span><span>충<b>${g.loyalty}</b></span></div>
      </div>
      <div class="or-go">${done ? '완료' : on ? '선택됨' : '선택'}</div>
    </button>`;
  }).join('');
  const dests = E.moveDestinations(game, d.fromCityId).map((x) => {
    const on = x.cityId === d.toCityId;
    return `<button class="mv-dest ${on ? 'on' : ''}" data-act="mv-dest" data-city="${x.cityId}">
      <b>${x.ko}</b>
      <span>장수 ${x.generals}명 · 병력 ${fmt(x.troops)}</span>
      <span class="mv-go-tag">${on ? '도착' : '고르기'}</span>
    </button>`;
  }).join('');
  const dest = E.moveDestinations(game, d.fromCityId).find((x) => x.cityId === d.toCityId);
  const check = E.canMoveGenerals(game, d.fromCityId, d.toCityId, d.gids);
  const room = dest ? E.MAX_OFFICERS_PER_CITY - dest.generals : 0;
  const over = !!dest && d.gids.length > room;
  let warn = '';
  if (d.gids.length && check.ok && check.warning) warn = `<p class="note warn">${check.warning}</p>`;
  else if (over) warn = `<p class="note warn">${dest.ko}의 장수 자리가 ${room}명 남았습니다. 선택을 줄여 주세요.</p>`;
  else if (d.gids.length && !check.ok) warn = `<p class="note warn">${check.why}</p>`;
  openSheet(`${fromName} — 장수 이동`,
    `<p class="note">옮길 장수를 고르고 도착할 성을 정하세요. 행동력 1을 쓰고, 옮긴 장수는 이번 달 행동을 마칩니다.</p>
     <p class="note" style="margin-top:8px">도착 성</p>
     <div class="mv-dest-row">${dests}</div>
     <p class="note">옮길 장수 — ${fromName} 주둔 ${gens.length}명</p>
     ${rows}
     <p class="note" style="margin-top:8px">아군 성끼리는 어디든 옮길 수 있습니다. 성을 완전히 비우면 적에게 그대로 노출됩니다.</p>
     <div class="sheet-foot">
       ${warn}
       <button class="btn big" data-act="mv-go" ${d.gids.length && check.ok && !over ? '' : 'disabled'}>
         ${E.withJosa(CITY_BY_ID[d.toCityId].ko, '로')} 이동 · ${d.gids.length}명 (행동력 1)
       </button>
     </div>`);
}

function doMoveGenerals() {
  const d = moveDraft;
  if (!d) return;
  const res = E.moveGenerals(game, d.fromCityId, d.toCityId, d.gids);
  closeSheet();
  moveDraft = null;
  if (res.ok) { sfx.ok(); toast(res.msg + (res.warning ? ' ' + res.warning : ''), 2800); }
  else { sfx.fail(); toast(res.msg); }
  renderGame();
  autoSave();
}

/* ---------- 장수 대화 ---------- */
function openTalkSheet(cityId) {
  const partners = E.talkPartners(game, cityId);
  if (!partners.length) { toast('이 성에는 이야기할 장수가 없습니다.'); sfx.fail(); return; }
  sheetCityId = cityId;
  renderTalkSheet();
  sfx.click();
}

function renderTalkSheet() {
  const cityId = sheetCityId;
  const partners = E.talkPartners(game, cityId);
  const rows = partners.map((g) => {
    const t = gd(g.id);
    const talked = E.talkedThisTurn(game, g.id);
    const maxed = g.loyalty >= 100;
    const off = talked || maxed || game.actionPoints < 1;
    const tag = talked ? '이번 달 완료' : maxed ? '충성 최대' : '대화';
    return `<button class="officer-row ${off ? 'done' : ''}" data-act="talk-go" data-officer="${g.id}" ${off ? 'disabled' : ''}>
      <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
      <div class="or-main">
        <div class="or-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
        <div class="or-stats"><span>매력 <b>${t.cha}</b></span><span>충성 <b>${g.loyalty}</b></span></div>
        <div class="or-loy"><div class="loy-bar"><i style="width:${g.loyalty}%"></i></div><span>${g.loyalty}/100</span></div>
      </div>
      <div class="or-go">${tag}</div>
    </button>`;
  }).join('');
  openSheet(`${CITY_BY_ID[cityId].ko} — 대화`,
    `<p class="note">장수와 이야기를 나누면 충성도가 오릅니다(기본 4~8, 군주 매력·인덕 보정, 최대 100). 금은 들지 않고 행동력 1을 쓰며, 장수마다 한 달에 한 번입니다.</p>
     ${rows}`);
}

function doTalk(gid) {
  const res = E.talkToGeneral(game, sheetCityId, gid);
  if (!res.ok) { sfx.fail(); toast(res.msg); return; }
  sfx.ok();
  renderTalkScene(gid, res);
  renderGame();
  autoSave();
}

function renderTalkScene(gid, res) {
  const t = gd(gid);
  const lord = gd(game.factions[game.playerId].lord);
  openSheet(`${E.withJosa(t.ko, '과')}의 대화`,
    `<div class="talk-scene">
      <div class="talk-who">
        <img src="${portraitURL(gid, t, 64, colorOf(game.playerId))}" alt="${t.ko}" />
        <div style="flex:1">
          <div class="talk-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
          <div class="talk-loy">충성 <b>${res.before}</b> → <b class="up">${res.after}</b><em>+${res.gain}</em></div>
          <div class="loy-bar"><i style="width:${res.after}%"></i></div>
        </div>
      </div>
      <p class="talk-line"><b>${t.ko}</b>“${res.line.g}”</p>
      <p class="talk-line lord"><b>${lord.ko}</b>“${res.line.l}”</p>
    </div>
    <button class="btn big" data-act="talk-more" style="margin-top:12px">다른 장수와 대화</button>
    <button class="btn big ghost" data-act="sheet-close" style="margin-top:6px">닫기</button>`);
}

/* ---------- 출진 ---------- */
function openMarchSheet(cityId, targetId = null) {
  const enemies = E.adjacentEnemies(game, cityId);
  if (!enemies.length) { toast('인접한 적 성이 없습니다.'); sfx.fail(); return; }
  const c = game.cities[cityId];
  const gens = E.generalsInCity(game, cityId);
  const targets = targetId ? enemies.filter((e) => e === targetId) : enemies;
  pendingSetup = {
    cityId, targetId: targets[0], generals: gens.slice(0, 5).map((g) => g.id),
    ratio: 1,
    forms: {},
    focus: gens.length ? gens[0].id : null,
    reinforce: [],
  };
  openSheet(`${CITY_BY_ID[cityId].ko} 출진`, marchSheetHTML());
}

function marchSheetHTML() {
  const p = pendingSetup;
  const c = game.cities[p.cityId];
  const gens = E.generalsInCity(game, p.cityId);
  const enemies = E.adjacentEnemies(game, p.cityId);
  const target = game.cities[p.targetId];
  const tname = fname(target.owner);
  const defPower = E.cityPower(game, p.targetId, true);
  const myPower = Math.round(c.troops * (0.7 + c.train / 180) * 0.95);
  return `
    <div class="field-row"><label>공격 대상</label><div class="chip-row" style="margin:0">
      ${enemies.map((e) => `<button class="pick-chip ${e === p.targetId ? 'on' : ''}" data-act="march-target" data-city="${e}">${CITY_BY_ID[e].ko}</button>`).join('')}
    </div></div>
    <p class="note">${CITY_BY_ID[p.targetId].ko}: ${tname}군 · 병력 ${fmt(target.troops)} · 성 방어 ${target.def}<br>
    예상 전력 — 아군 ${fmt(myPower * p.ratio)} vs 수비 ${fmt(defPower)}${myPower * p.ratio > defPower ? ' <span style="color:#8ed18e">(우세)</span>' : ' <span style="color:#e08a7a">(열세)</span>'}</p>
    <div class="field-row"><label>출진 병력 ${fmt(Math.round(c.troops * p.ratio))} / ${fmt(c.troops)}</label>
      <div class="stepper"><button data-act="march-ratio-" >－</button><input id="march-ratio" type="number" value="${Math.round(p.ratio * 100)}" min="20" max="100" />%<button data-act="march-ratio+">＋</button></div></div>
    <p class="note">출진 장수 (최대 5명)</p>
    <div class="chip-row">${gens.map((g) => {
      const t = gd(g.id);
      const on = p.generals.includes(g.id);
      return `<button class="pick-chip ${on ? 'on' : ''}" data-act="march-gen" data-officer="${g.id}">${t.ko} <b style="color:#9c9270">무${t.war}</b></button>`;
    }).join('')}</div>
    ${formationPickerHTML()}
    ${reinforcePickerHTML()}
    <button class="btn big" data-act="march-go" style="margin-top:12px" ${p.generals.length ? '' : 'disabled'}>${CITY_BY_ID[p.targetId].ko}으로 출진 (${p.generals.length}부대)</button>
    <p class="note">전투에서는 부대별 이동·공격·계략과 일기토를 지휘합니다. 정면보다 측면(×1.25)·배후(×1.5)를 노리세요.</p>`;
}

/* 원군 — 인접한 아군·동맹 성에서 최대 2부대 동행 */
function reinforcePickerHTML() {
  const p = pendingSetup;
  const cands = E.reinforcementCandidates(game, [p.cityId], game.playerId, [p.cityId, p.targetId]);
  if (!cands.length) {
    return `<p class="note" style="margin-top:10px">원군 — 인접한 아군·동맹 성에 보낼 여유 병력이 없습니다.</p>`;
  }
  const chips = cands.map((c) => {
    const on = p.reinforce.includes(c.cityId);
    return `<button class="pick-chip ${on ? 'on' : ''}" data-act="march-reinforce" data-city="${c.cityId}">
      ${c.city} ${c.gname} <b style="color:${c.ally ? '#8fc0e8' : '#9c9270'}">${fmt(c.troops)}</b>${c.ally ? ' <i class="mr-ally">동맹</i>' : ''}
    </button>`;
  }).join('');
  return `<p class="note" style="margin-top:12px">원군 — 인접한 아군·동맹 성에서 최대 ${E.REINFORCE_MAX}부대 (<b>${p.reinforce.length}/${E.REINFORCE_MAX}</b>)</p>
    <div class="chip-row">${chips}</div>
    <p class="note">원군은 2라운드에 전장 가장자리로 들어옵니다. 보낸 성의 병력은 그만큼 줄어듭니다.</p>`;
}

/* 출진 전 진형 고르기 — 장수별 대형 미리보기 + 상성 */
function formOfPick(gid) {
  const t = gd(gid);
  const own = (t.formations && t.formations.length ? t.formations : ['eorin']).filter((f) => FORMATIONS[f]);
  const picked = pendingSetup.forms[gid];
  return picked && own.includes(picked) ? picked : own[0];
}

function formationPickerHTML() {
  const p = pendingSetup;
  if (!p.generals.length) return '';
  const rows = p.generals.map((gid) => {
    const t = gd(gid);
    const own = (t.formations || ['eorin']).filter((f) => FORMATIONS[f]);
    const cur = formOfPick(gid);
    return `<div class="fp-row">
      <span class="fp-name">${t.ko}</span>
      <div class="fp-chips">${own.map((fid) => {
        const f = FORMATIONS[fid];
        return `<button class="fp-chip ${fid === cur ? 'on' : ''}" data-act="march-form" data-officer="${gid}" data-form="${fid}" aria-label="${t.ko} ${f.ko}">
          ${formationSVG(fid, 'E', 22)}<span>${f.ko}</span></button>`;
      }).join('')}</div>
    </div>`;
  }).join('');
  const focus = p.focus && p.generals.includes(p.focus) ? p.focus : p.generals[0];
  const cur = FORMATIONS[formOfPick(focus)] || FORMATIONS.eorin;
  const grp = formationGroup(cur.id);
  const cols = Object.values(FORMATION_GROUPS).map((g) => `<div class="fl-col">
      <b class="fg-${g.id}">${g.ko}진</b>
      ${g.forms.filter((f) => FORMATIONS[f]).map((f) => `<span class="fl-item">${formationSVG(f, 'E', 16)}${FORMATIONS[f].ko}</span>`).join('')}
    </div>`).join('');
  return `<div class="form-pick-box">
    <p class="note" style="margin:12px 0 4px">진형 — 장수마다 대형과 상성이 다릅니다</p>
    ${rows}
    <div class="fp-detail">
      <b>${cur.ko}</b>
      ${grp ? `<em class="fg-${grp.id}">${grp.ko}진</em>` : ''}
      <span>${cur.desc}</span>
      <span class="fp-ct">${formationCounterText(cur.id)}</span>
    </div>
    <div class="form-legend">${cols}</div>
    <p class="note" style="margin-top:6px">돌격 → 포위 → 방어 → 돌격 순환 · 유리 ×1.25 · 불리 ×0.85</p>
  </div>`;
}

function openAttackEnemySheet(enemyCityId) {
  const sources = E.adjacentFriends(game, enemyCityId).filter((id) => E.generalsInCity(game, id).length && game.cities[id].troops >= 1000);
  if (!sources.length) { toast('공격할 수 있는 인접 아군 성이 없습니다.'); sfx.fail(); return; }
  openSheet(`${CITY_BY_ID[enemyCityId].ko} 공격`, `<p class="note">어느 성에서 출진할지 고르세요.</p>
    ${sources.map((s) => `<button class="officer-row" data-act="march-from" data-city="${s}" data-to="${enemyCityId}">
      <img src="${portraitURL(Object.values(game.generals).find((g) => g.city === s && g.faction === game.playerId)?.id || game.factions[game.playerId].lord, gd(game.factions[game.playerId].lord), 40, colorOf(game.playerId))}" alt="" />
      <div class="or-main"><div class="or-name">${CITY_BY_ID[s].ko}</div><div class="or-stats"><span>병력 <b>${fmt(game.cities[s].troops)}</b></span><span>장수 <b>${E.generalsInCity(game, s).length}</b></span></div></div>
      <div class="or-go">출진</div></button>`).join('')}`);
}

function startPlayerBattle() {
  const p = pendingSetup;
  const c = game.cities[p.cityId];
  const troops = Math.round(c.troops * p.ratio);
  // 원군 병력은 battleSetup이 미리 빼 두고, 전장에는 R2에 합류한다
  const setup = E.battleSetup(game, p.cityId, p.targetId, {
    atkGenerals: p.generals,
    atkTroops: troops,
    atkReinforcements: p.reinforce || [],
  });
  setup.formations = Object.fromEntries(p.generals.map((gid) => [gid, formOfPick(gid)]));
  closeSheet();
  beginBattle(setup, 'atk');
}

/* ---------- 전투 ---------- */
function beginBattle(setup, playerSide) {
  battle = B.createBattle({ ...setup, seed: (battleSeedCounter++), playerSide, generals: E.generalMap(game) });
  battleSel = null; battleMode = null; battleBusy = false;
  lastBattleResult = null;
  show('scr-battle');
  setTimeout(resizeBattleCanvas, 20);
  renderBattle();
  sfx.battle();
  if (battle.phase !== battle.playerSide) enemyPhase();
}

/* 전장 바닥 톤 — 다크 슬레이트 보드 */
const BATTLE_TILE = {
  plain: '#171c21', road: '#1d2128', forest: '#151d18',
  hill: '#1d1c19', water: '#121b22', castle: '#201d18',
};

function resizeBattleCanvas() {
  const c = $('#battle-canvas');
  if (!c) return;
  const wrap = c.parentElement;
  const cssW = Math.max(200, wrap.clientWidth - 2);
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const tile = Math.floor(cssW / B.BW);
  c.style.width = (tile * B.BW) + 'px';
  c.style.height = (tile * B.BH) + 'px';
  c.width = Math.round(tile * B.BW * dpr);
  c.height = Math.round(tile * B.BH * dpr);
  c._tile = tile; c._dpr = dpr;
  renderBattle();
}

function drawBattle() {
  const c = $('#battle-canvas');
  if (!c || !battle) return;
  const tile = c._tile || 28;
  const dpr = c._dpr || 1;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#0a0d10';
  ctx.fillRect(0, 0, c.width, c.height);

  const reach = battleSel && battleMode === 'move' && battleSel.side === battle.playerSide ? B.reachable(battle, battleSel) : null;
  const atkTargets = battleSel && battleMode === 'attack' ? B.targetsFor(battle, battleSel) : [];
  const tacTargets = battleSel && battleMode && battleMode.startsWith('tactic:') ? battle.units.filter((u) => u.alive && (battleMode.endsWith('rally') || battleMode.endsWith('heal') ? u.side === battleSel.side : u.side !== battleSel.side) && B.dist(battleSel, u) <= 3) : [];

  for (const t of battle.grid) {
    const x = t.x * tile, y = t.y * tile;
    ctx.fillStyle = BATTLE_TILE[t.t] || '#171c21';
    ctx.fillRect(x, y, tile, tile);
    // 지형 표시 — 도트 대신 보드 위 기호
    if (t.t === 'forest') {
      ctx.strokeStyle = 'rgba(150, 190, 150, 0.30)';
      ctx.fillStyle = 'rgba(120, 165, 122, 0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const px = x + tile * (0.26 + i * 0.24), py = y + tile * (0.66 + (i % 2) * 0.08);
        const ph = tile * (0.20 + (i % 2) * 0.04);
        ctx.beginPath();
        ctx.moveTo(px, py - ph);
        ctx.lineTo(px + tile * 0.085, py - ph * 0.32);
        ctx.lineTo(px + tile * 0.032, py - ph * 0.32);
        ctx.lineTo(px + tile * 0.095, py);
        ctx.lineTo(px - tile * 0.095, py);
        ctx.lineTo(px - tile * 0.032, py - ph * 0.32);
        ctx.lineTo(px - tile * 0.085, py - ph * 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (t.t === 'hill') {
      ctx.strokeStyle = 'rgba(200, 186, 150, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + tile * 0.22, y + tile * 0.66);
      ctx.quadraticCurveTo(x + tile * 0.5, y + tile * 0.36, x + tile * 0.78, y + tile * 0.66);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + tile * 0.34, y + tile * 0.74);
      ctx.quadraticCurveTo(x + tile * 0.5, y + tile * 0.56, x + tile * 0.66, y + tile * 0.74);
      ctx.stroke();
    } else if (t.t === 'water') {
      ctx.strokeStyle = 'rgba(120, 170, 200, 0.30)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const wy = y + tile * (0.3 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(x + tile * 0.18, wy);
        ctx.quadraticCurveTo(x + tile * 0.4, wy - tile * 0.05, x + tile * 0.62, wy);
        ctx.quadraticCurveTo(x + tile * 0.74, wy + tile * 0.03, x + tile * 0.84, wy);
        ctx.stroke();
      }
    } else if (t.t === 'castle') {
      ctx.strokeStyle = 'rgba(201, 164, 92, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + tile * 0.08, y + tile * 0.2);
      ctx.lineTo(x + tile * 0.92, y + tile * 0.2);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(201, 164, 92, 0.22)';
        ctx.fillRect(x + tile * (0.1 + i * 0.22), y + tile * 0.12, tile * 0.12, tile * 0.08);
      }
    } else if (t.t === 'road') {
      ctx.strokeStyle = 'rgba(201, 164, 92, 0.16)';
      ctx.setLineDash([tile * 0.16, tile * 0.14]);
      ctx.beginPath();
      ctx.moveTo(x + tile / 2, y);
      ctx.lineTo(x + tile / 2, y + tile);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (reach && reach.has(t.y * battle.w + t.x)) {
      ctx.fillStyle = 'rgba(96, 148, 208, 0.14)';
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      ctx.strokeStyle = 'rgba(140, 200, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
    }
    if (atkTargets.some((u) => u.x === t.x && u.y === t.y) || tacTargets.some((u) => u.x === t.x && u.y === t.y)) {
      ctx.strokeStyle = 'rgba(226, 100, 78, 0.9)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
    }
    ctx.strokeStyle = 'rgba(201, 164, 92, 0.075)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, tile, tile);
  }

  for (const u of battle.units) {
    if (!u.alive) continue;
    drawBattleUnit(ctx, u, tile, u === battleSel);
  }
  // 공격 예상(정면/측면/배후 · 진형 상성) 힌트
  if (battleSel && battleMode === 'attack') {
    for (const t of atkTargets) drawAttackHint(ctx, t, tile);
  }
}

/* 진영 색 — 아군은 청, 적은 홍 */
function sidePalette(side) {
  const isPlayer = battle && side === battle.playerSide;
  return isPlayer
    ? { plate: 'rgba(26, 44, 64, 0.55)', edge: 'rgba(122, 174, 224, 0.62)', dot: '#9cc4ee', shade: '#0d1720', tip: '#e9d3a4', text: '#cfe4fa' }
    : { plate: 'rgba(58, 28, 24, 0.5)', edge: 'rgba(222, 140, 124, 0.58)', dot: '#e0a99c', shade: '#1d120f', tip: '#e9d3a4', text: '#f0c9bd' };
}

function pixelText(ctx, text, x, y, size, fill, align = 'center') {
  ctx.font = `600 ${size}px "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(6, 8, 11, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

/* 부대 토큰 — 진형 대형 토큰 + 바라보는 방향 + 이름·병력 */
function drawBattleUnit(ctx, u, tile, selected) {
  const x = u.x * tile, y = u.y * tile;
  const pal = sidePalette(u.side);
  const dir = u.dir || 'E';
  // 바닥판 — 진영 색 1px 테두리만 남겨 진형 그림이 또렷하게 보이게
  ctx.fillStyle = pal.plate;
  ctx.fillRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
  ctx.strokeStyle = selected ? '#e9d3a4' : pal.edge;
  ctx.lineWidth = selected ? 1.6 : 1;
  ctx.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3);

  // 바라보는 쪽(정면)에 세운 창벽 — 금빛 띠
  const wd = Math.max(2, tile * 0.07);
  ctx.fillStyle = '#e6c67e';
  ctx.strokeStyle = 'rgba(20, 16, 8, 0.5)';
  ctx.lineWidth = 0.7;
  if (dir === 'E') { ctx.fillRect(x + tile - 2.5 - wd, y + 3, wd, tile - 6); ctx.strokeRect(x + tile - 2.5 - wd, y + 3, wd, tile - 6); }
  else if (dir === 'W') { ctx.fillRect(x + 2.5, y + 3, wd, tile - 6); ctx.strokeRect(x + 2.5, y + 3, wd, tile - 6); }
  else if (dir === 'N') { ctx.fillRect(x + 3, y + 2.5, tile - 6, wd); ctx.strokeRect(x + 3, y + 2.5, tile - 6, wd); }
  else { ctx.fillRect(x + 3, y + tile - 2.5 - wd, tile - 6, wd); ctx.strokeRect(x + 3, y + tile - 2.5 - wd, tile - 6, wd); }

  // 진형 대형 — 타일 위쪽
  drawFormation(ctx, u.formation, x + tile / 2, y + tile * 0.27, tile * 0.60, dir, pal);

  // 아래 띠: 진형 색 띠 + 이름 + 병력
  const bandH = Math.max(14, Math.round(tile * 0.43));
  const by = y + tile - bandH;
  ctx.fillStyle = 'rgba(8, 10, 13, 0.88)';
  ctx.fillRect(x + 1.5, by, tile - 3, bandH - 1);
  ctx.strokeStyle = 'rgba(201, 164, 92, 0.20)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 1.5, by + 0.5);
  ctx.lineTo(x + tile - 1.5, by + 0.5);
  ctx.stroke();
  const ratio = Math.max(0, Math.min(1, u.troops / 4000));
  ctx.fillStyle = ratio > 0.4 ? '#8fbf74' : '#d7a35c';
  ctx.fillRect(x + 1.5, by, (tile - 3) * ratio, 1.4);
  pixelText(ctx, u.name, x + tile / 2, by + bandH * 0.38, Math.max(7, Math.min(9.5, tile * 0.24)), '#f0e6cd', 'center');
  pixelText(ctx, fmt(u.troops), x + tile / 2, by + bandH * 0.80, Math.max(6, Math.min(7.5, tile * 0.2)), pal.text, 'center');

  if (u.acted) {
    ctx.fillStyle = 'rgba(8, 10, 13, 0.45)';
    ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
  }
}

/* 공격 타겟 위에 정면/측면/배후와 배율을 띄운다 */
function drawAttackHint(ctx, t, tile) {
  const e = B.attackEdge(battleSel, t);
  const label = `${B.SIDE_KO[e.side]}${e.mult !== 1 ? ' ×' + e.mult.toFixed(2) : ''}`;
  const extra = e.relation === 'advantage' ? '진형↑' : e.relation === 'disadvantage' ? '진형↓' : '';
  const cx = t.x * tile + tile / 2;
  const top = t.y * tile;
  ctx.font = `600 7px "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`;
  const w = Math.max(ctx.measureText(label).width, ctx.measureText(extra).width) + 6;
  const h = extra ? 15 : 9;
  const bx = Math.max(1, Math.min(battle.w * tile - w - 1, cx - w / 2));
  const by = top > h + 1 ? top - h - 1 : top + 1;
  const tone = e.side === 'rear' ? '#ff6a4d' : e.side === 'flank' ? '#ffb15c' : '#9fb6c8';
  ctx.fillStyle = 'rgba(8,11,18,0.92)';
  ctx.fillRect(bx, by, w, h);
  ctx.strokeStyle = tone; ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = tone;
  ctx.fillText(label, bx + w / 2, by + (extra ? 5 : h / 2));
  if (extra) {
    ctx.fillStyle = e.relation === 'advantage' ? '#8ed18e' : '#e08a7a';
    ctx.fillText(extra, bx + w / 2, by + 11);
  }
}

function unitCardHTML(u, selected) {
  const t = gd(u.gid);
  const isPlayer = u.side === battle.playerSide;
  return `<button class="pick-chip bt-card ${selected ? 'on' : ''} ${u.acted ? 'done' : ''}" data-act="bt-select" data-unit="${u.id}">
    ${formationSVG(u.formation, u.dir || 'E', 20, isPlayer ? {} : { body: '#f0b3a3', shade: '#3c1310' })}
    <span class="bc-main">
      <span class="bc-name">${u.name}</span>
      <b class="bc-troop">${fmt(u.troops)}</b>
      <span class="bc-morale">사기 ${Math.round(u.morale)}</span>
    </span>
  </button>`;
}

/* 선택한 부대 — 진형 대형 미리보기와 상성·방향 안내 */
function unitInfoHTML(u) {
  const f = B.formOf(u);
  const grp = formationGroup(u.formation);
  const rel = formationCounterText(u.formation);
  const dirKo = DIR_KO[u.dir || 'E'] || '동';
  return `<div class="bt-unitinfo">
    ${formationSVG(u.formation, u.dir || 'E', 34)}
    <div class="bu-main">
      <div class="bu-name"><b>${u.name}</b> <span>${fmt(u.troops)} · 사기 ${Math.round(u.morale)}</span>${u.acted ? ' <i class="bu-done">행동 완료</i>' : ''}</div>
      <div class="bu-form">${f.ko} <em class="fg-${grp ? grp.id : 'none'}">${grp ? grp.ko + '진' : ''}</em> · ${dirKo}쪽을 바라봄</div>
      <div class="bu-ct">${rel}</div>
    </div>
  </div>`;
}

/* 전장 아래 진형 상성표 — 지금 어떤 진형이 무엇에 강한지 바로 보이게 */
function battleGuideHTML() {
  const cols = Object.values(FORMATION_GROUPS).map((g) => `<div class="bg-col">
      <b class="fg-${g.id}">${g.ko}진</b>
      ${g.forms.filter((f) => FORMATIONS[f]).map((f) => `<span class="bg-item${battleSel && battleSel.formation === f ? ' on' : ''}">${formationSVG(f, 'E', 15)}${FORMATIONS[f].ko}</span>`).join('')}
    </div>`).join('');
  return `<div class="bg-head">진형 상성 <span>돌격 → 포위 → 방어 → 돌격</span></div>
    <div class="bg-cols">${cols}</div>
    <div class="bg-tip">노란 창벽이 정면 — 옆에서 치면 <b class="lg-flank">측면 ×1.25</b>, 뒤에서 치면 <b class="lg-rear">배후 ×1.50</b></div>`;
}

/* 하단 전술 안내 — 방향 배율과 진형 상성 순환 */
function battleLegendHTML() {
  return `<div class="bt-legend-row">
    <span class="lg-front">정면 ×1.00</span> <span class="lg-flank">측면 ×1.25</span> <span class="lg-rear">배후 ×1.50</span>
    <span class="lg-sep">|</span>
    <span class="lg-charge">돌격</span>→<span class="lg-pincer">포위</span>→<span class="lg-guard">방어</span>→<span class="lg-charge">돌격</span>
    <small>유리 ×1.25 · 불리 ×0.85</small>
  </div>`;
}

function renderBattle() {
  if (!battle) return;
  const my = battle.playerSide;
  $('#bt-name').textContent = `${CITY_BY_ID[battle.toCityId].ko} 전투 · R${battle.round}`;
  $('#bt-round').textContent = battle.over ? '전투 종료' : `${battle.phase === my ? '내 차례' : '적의 차례'} · ${battle.phase === 'atk' ? '공격측 행동' : '수비측 행동'}`;
  const atkAlive = B.unitsOf(battle, 'atk'), defAlive = B.unitsOf(battle, 'def');
  const atkTroops = atkAlive.reduce((s, u) => s + u.troops, 0);
  const defTroops = defAlive.reduce((s, u) => s + u.troops, 0);
  const isAtkPlayer = my === 'atk';
  $('#bt-side').innerHTML = `<b style="color:${isAtkPlayer ? '#7ec4ff' : '#ff9a8a'}">${isAtkPlayer ? '공격' : '수비'}</b> 아군 ${fmt(isAtkPlayer ? atkTroops : defTroops)}<br><b>${isAtkPlayer ? '수비' : '공격'}</b> 적 ${fmt(isAtkPlayer ? defTroops : atkTroops)}`;

  drawBattle();

  const mine = battle.units.filter((u) => u.side === my && u.alive);
  const info = battleSel ? unitInfoHTML(battleSel) : '';
  $('#bt-info').innerHTML = info;
  $('#bt-legend').innerHTML = battleLegendHTML();
  $('#bt-guide').innerHTML = battleGuideHTML();

  $('#bt-log').innerHTML = battle.log.slice(-40).map((l) => {
    const cls = /\[원군 도착!\]/.test(l) ? 'rein' : /\[배후 기습!\]/.test(l) ? 'hi' : /\[측면 공격!\]|\[진형 유리!\]/.test(l) ? 'hi' : /\[진형 불리\]|궤멸/.test(l) ? 'bad' : '';
    return `<div class="${cls}">${l}</div>`;
  }).join('');
  $('#bt-log').scrollTop = $('#bt-log').scrollHeight;

  const canAct = !battleBusy && !battle.over && battle.phase === my && battleSel && !battleSel.acted && battleSel.side === my;
  const duelReady = canAct && B.duelOptions(battle, battleSel).length > 0;
  $('#bt-cmds').innerHTML = `
    <button class="btn" data-act="bt-move" ${canAct ? '' : 'disabled'}>이동</button>
    <button class="btn" data-act="bt-attack" ${canAct && B.targetsFor(battle, battleSel).length ? '' : 'disabled'}>공격</button>
    <button class="btn" data-act="bt-tactic" ${canAct ? '' : 'disabled'}>계략</button>
    <button class="btn" data-act="bt-duel" ${duelReady ? '' : 'disabled'}>일기토</button>
    <button class="btn" data-act="bt-wait" ${canAct ? '' : 'disabled'}>대기</button>
  `;
  $('#bt-next').textContent = battle.phase === my ? '진행 ▶' : '적 행동…';
  $('#bt-next').disabled = battleBusy || battle.phase !== my || !!battle.over;
  const cards = mine.map((u) => unitCardHTML(u, u === battleSel)).join('');
  if (cards) $('#bt-info').insertAdjacentHTML('beforeend', `<div style="display:flex;gap:4px;overflow-x:auto;margin-top:4px">${cards}</div>`);
}

function battleTap(clientX, clientY) {
  const c = $('#battle-canvas');
  const rect = c.getBoundingClientRect();
  const tile = c._tile || 28;
  const x = Math.floor((clientX - rect.left) / tile);
  const y = Math.floor((clientY - rect.top) / tile);
  if (x < 0 || y < 0 || x >= battle.w || y >= battle.h) return;
  if (battleBusy || battle.over) return;
  const u = battle.units.find((o) => o.alive && o.x === x && o.y === y);
  const my = battle.playerSide;

  if (battleMode === 'move' && battleSel) {
    const r = B.moveUnit(battle, battleSel, x, y);
    if (r.ok) { sfx.march(); battleMode = null; }
    else toast(r.msg, 1200);
    renderBattle();
    return;
  }
  if (battleMode === 'attack' && battleSel) {
    if (u && u.side !== my) {
      const seed = Math.floor(Math.random() * 99999);
      const r = B.attack(battle, battleSel, u, seed);
      if (r.ok) { sfx.hit(); battleMode = null; }
      renderBattle();
      checkBattleOver();
    }
    return;
  }
  if (battleMode && battleMode.startsWith('tactic:') && battleSel) {
    const kind = battleMode.split(':')[1];
    if (u) {
      const seed = Math.floor(Math.random() * 99999);
      const r = B.tactic(battle, battleSel, u, kind, seed);
      if (r.ok) { sfx.tactic(); battleMode = null; toast(r.lines && r.lines[0] ? r.lines[0] : '계략', 1500); }
    }
    renderBattle();
    checkBattleOver();
    return;
  }
  if (u) {
    if (u.side === my && battle.phase === my) { battleSel = u; battleMode = null; sfx.click(); }
    else { battleSel = u; battleMode = null; sfx.click(); }
    renderBattle();
  }
}

function checkBattleOver() {
  if (!battle) return;
  if (B.checkEnd(battle)) setTimeout(finishBattle, 600);
}

function enemyPhase() {
  if (!battle || battle.over) { finishBattle(); return; }
  battleBusy = true;
  const side = battle.phase;
  const units = B.unitsOf(battle, side);
  let i = 0;
  const step = () => {
    if (!battle) return;
    if (battle.over) { finishBattle(); return; }
    if (i >= units.length) {
      B.nextPhase(battle);
      renderBattle();
      if (battle.over) { finishBattle(); return; }
      if (battle.phase !== battle.playerSide) { setTimeout(enemyPhase, 300); return; }
      battleBusy = false; renderBattle(); return;
    }
    const u = units[i++];
    if (u.alive && !u.acted) {
      B.aiUnitAct(battle, u, () => Math.random());
      sfx.hit();
      renderBattle();
    }
    setTimeout(step, 170);
  };
  setTimeout(step, 200);
}

function allOut() {
  if (!battle || battleBusy || battle.over || battle.phase !== battle.playerSide) return;
  battleBusy = true;
  battleSel = null; battleMode = null;
  renderBattle();
  const units = B.unitsOf(battle, battle.playerSide);
  let i = 0;
  const step = () => {
    if (!battle) return;
    if (battle.over) { finishBattle(); return; }
    if (i >= units.length) {
      battleBusy = false;
      playerNext();
      return;
    }
    const u = units[i++];
    if (u.alive && !u.acted) {
      B.aiUnitAct(battle, u, () => Math.random());
      sfx.hit();
      renderBattle();
    }
    setTimeout(step, 190);
  };
  setTimeout(step, 150);
}

function playerNext() {
  if (!battle || battleBusy || battle.over) return;
  if (battle.phase !== battle.playerSide) return;
  const myUnits = B.unitsOf(battle, battle.playerSide);
  if (myUnits.some((u) => !u.acted)) {
    // 남은 부대 자동 대기 후 넘김
    myUnits.forEach((u) => { if (!u.acted) B.endUnit(u); });
  }
  B.nextPhase(battle);
  renderBattle();
  if (battle.over) { finishBattle(); return; }
  if (battle.phase !== battle.playerSide) enemyPhase();
}

function retreat() {
  if (!battle) return;
  battle.over = battle.playerSide === 'atk' ? 'def' : 'atk';
  finishBattle();
}

function finishBattle() {
  if (!battle) return;
  if (lastBattleResult) return;
  const res = B.battleResult(battle);
  lastBattleResult = res;
  const win = (res.winner === 'attacker' && battle.playerSide === 'atk') || (res.winner === 'defender' && battle.playerSide === 'def');
  const iAmAttacker = battle.playerSide === 'atk';
  const summary = iAmAttacker
    ? `아군 손실 ${fmt(res.atkLoss)} · 적 손실 ${fmt(res.defLoss)}`
    : `아군 손실 ${fmt(res.defLoss)} · 적 손실 ${fmt(res.atkLoss)}`;
  if (win) sfx.win(); else sfx.lose();

  // 엔진 반영 (포로는 여기서 붙잡혀 처분 대기 상태가 된다)
  const applied = E.applyBattleResult(game, res);
  const prisoners = (applied.prisoners || []).map((p) => gd(p.gid).ko).join(', ');
  autoSave();

  openSheet(win ? '승전' : '패전', `
    <div style="text-align:center;padding:8px 0 4px">
      <div style="font-size:30px;letter-spacing:4px;color:${win ? '#f5d97a' : '#e08a7a'}">${win ? '승리' : '패배'}</div>
      <p style="margin:8px 0;color:#cbbf9d">${battle.over === 'atk' ? CITY_BY_ID[battle.toCityId].ko + ' 함락' : CITY_BY_ID[battle.toCityId].ko + ' 공략 실패'}</p>
    </div>
    <p class="note">${summary} · ${res.rounds}라운드${prisoners ? '<br>사로잡은 장수: <b style="color:#f5d97a">' + prisoners + '</b> — 처분을 기다립니다' : ''}</p>
    ${win && res.winner === 'attacker' ? `<p class="note">${E.withJosa(CITY_BY_ID[battle.toCityId].ko, '이')} 우리 것이 되었습니다.</p>` : ''}
    <button class="btn big" data-act="bt-close" style="margin-top:12px">${prisoners ? '포로 처분으로 ▶' : '계속'}</button>
  `);
}

function closeBattle() {
  closeSheet();
  battle = null; battleSel = null; battleMode = null; battleBusy = false;
  // 잡힌 장수가 있으면 처분 화면을 먼저 연다
  if ((game.pendingPrisoners || []).length) {
    show('scr-game');
    openPrisonerSheet();
    return;
  }
  continueAfterBattle();
}

function continueAfterBattle() {
  show('scr-game');
  const pending = game.pendingBattles || [];
  if (pending.length) {
    const next = pending.shift();
    setTimeout(() => beginBattle(next, next.defenderFaction === game.playerId ? 'def' : 'atk'), 220);
    renderGame();
    return;
  }
  if (turnPending) {
    turnPending = false;
    if (!E.checkVictory(game)) {
      E.endTurnPhase2(game);
      sfx.turn();
      toast(`${game.year}년 ${game.month}월 — 새 달이 밝았습니다.`, 1600);
    }
  }
  renderGame();
  autoSave();
}

/* ---------- 승전 후 포로 처분 (등용 · 해방 · 참수) ---------- */
let prisonerNotes = [];
let execConfirm = null;

function openPrisonerSheet() {
  const list = game.pendingPrisoners || [];
  if (!list.length) {
    prisonerSheetOpen = true;
    openSheet('포로 처분', `${prisonerNotesHTML()}
      <p class="note">모든 포로를 처분했습니다.</p>
      <button class="btn big" data-act="prisoner-done" style="margin-top:10px">마무리</button>`);
    return;
  }
  prisonerSheetOpen = true;
  openSheet(`포로 처분 · ${list.length}명`, prisonerSheetHTML());
}

function prisonerNotesHTML() {
  if (!prisonerNotes.length) return '';
  return `<div class="pw-notes">${prisonerNotes.map((n) => `<div>${n}</div>`).join('')}</div>`;
}

function prisonerSheetHTML() {
  const list = game.pendingPrisoners || [];
  const f = game.factions[game.playerId];
  const lord = gd(f.lord);
  return `${prisonerNotesHTML()}
    <p class="note">${f.name}군 승전 — 잡힌 장수 <b>${list.length}</b>명. 등용 판정은 군주 ${lord.ko}의 매력 <b>${lord.cha}</b> · 명성 <b>${Math.round(f.fame)}</b>로 겨룹니다.</p>
    ${list.map(prisonerRowHTML).join('')}
    <p class="note" style="margin-top:8px">해방하면 명성 +5 · 참수하면 그 장수는 다시 나타나지 않고 명성이 조금 깎입니다.</p>`;
}

function prisonerRowHTML(rec) {
  const t = gd(rec.gid);
  const g = game.generals[rec.gid] || {};
  const chance = Math.round(E.recruitChance(game, rec.gid) * 100);
  const confirm = execConfirm === rec.gid;
  return `<div class="pw-row">
    <img src="${portraitURL(rec.gid, t, 46, colorOf(rec.faction))}" alt="" />
    <div class="pw-main">
      <div class="pw-name">${t.ko}${rec.isLord ? ' <i class="pw-lord">군주</i>' : ''}</div>
      <div class="pw-stats">통 <b>${t.lead}</b> 무 <b>${t.war}</b> 지 <b>${t.int}</b> 매 <b>${t.cha}</b></div>
      <div class="pw-meta">${fname(rec.faction)} 소속 · 충성 ${Math.round(g.loyalty || 0)} · 등용 성공률 <b>${chance}%</b>${rec.tried ? ' · <i style="color:#e08a7a">등용 거절</i>' : ''}</div>
    </div>
    <div class="pw-btns">
      <button class="pw-btn rec" data-act="prisoner-recruit" data-gid="${rec.gid}" ${rec.tried ? 'disabled' : ''}>등용</button>
      <button class="pw-btn rel" data-act="prisoner-release" data-gid="${rec.gid}">해방</button>
      <button class="pw-btn exec ${confirm ? 'on' : ''}" data-act="prisoner-execute" data-gid="${rec.gid}">${confirm ? '참수 확정' : '참수'}</button>
    </div>
  </div>`;
}

function prisonerAct(kind, gid) {
  if (kind === 'execute' && execConfirm !== gid) {
    execConfirm = gid;
    sfx.select();
    openPrisonerSheet();
    return;
  }
  let r = null;
  if (kind === 'recruit') r = E.recruitPrisoner(game, gid, Math.random);
  else if (kind === 'release') r = E.releasePrisoner(game, gid);
  else if (kind === 'execute') r = E.executePrisoner(game, gid);
  if (!r) return;
  if (kind === 'recruit' && r.accepted === false) sfx.fail();
  else if (kind === 'execute') sfx.lose();
  else sfx.win();
  prisonerNotes.unshift(r.msg);
  execConfirm = null;
  autoSave();
  renderGame();
  openPrisonerSheet();
}

function closePrisonerSheet() {
  prisonerNotes = [];
  execConfirm = null;
  prisonerSheetOpen = false;
  closeSheet();
  continueAfterBattle();
}

/* 포로 창을 X로 닫아도 전투 흐름은 이어진다(남은 포로는 다음에 다시 묻는다) */
let prisonerSheetOpen = false;

/* ---------- 일기토 ---------- */
function openDuel(target) {
  const mine = battleSel;
  if (!mine || !target) return;
  const gA = gd(mine.gid);
  const gB = gd(target.gid);
  duelCtx = { d: createDuel(gA, gB, Math.floor(Math.random() * 99999), { a: '아군', b: '적군' }), mine, target };
  $('#duel').classList.remove('hidden');
  sfx.duel();
  renderDuel();
}

function renderDuel() {
  const { d, mine, target } = duelCtx;
  const img = (gid, color) => `<img src="${portraitURL(gid, gd(gid), 62, color)}" alt="" />`;
  const sideColor = (isMine) => (isMine ? colorOf(game.playerId) : '#8c2f24');
  $('#duel-a').className = 'fighter a';
  $('#duel-a').innerHTML = `${img(d.a.gid, sideColor(true))}
    <div class="f-name">${d.a.name}</div><div class="f-war">무력 ${d.a.war}</div>
    <div class="hpbar"><i style="width:${(d.a.hp / d.a.maxHp) * 100}%"></i></div>
    <div class="ki">기백 ${'◆'.repeat(Math.max(0, d.a.ki))}</div>`;
  $('#duel-b').className = 'fighter b';
  $('#duel-b').innerHTML = `${img(d.b.gid, sideColor(false))}
    <div class="f-name">${d.b.name}</div><div class="f-war">무력 ${d.b.war}</div>
    <div class="hpbar"><i style="width:${(d.b.hp / d.b.maxHp) * 100}%"></i></div>
    <div class="ki">기백 ${'◆'.repeat(Math.max(0, d.b.ki))}</div>`;
  $('#duel-log').innerHTML = d.log.slice(-12).map((l) => `<div>${l}</div>`).join('');
  $('#duel-log').scrollTop = $('#duel-log').scrollHeight;
  if (d.over) {
    const won = d.winner === d.a;
    $('#duel-cmds').innerHTML = `<div class="duel-result" style="grid-column:1/3">${won ? '일기토 승리!' : '일기토 패배…'}<br>
      <span style="font-size:11px;color:#b3a884">${won ? target.name + ' 부대 사기 급락' : mine.name + ' 부대 사기 급락'}</span><br>
      <button class="btn" data-act="duel-close" style="margin-top:8px">돌아가기</button></div>`;
  } else {
    $('#duel-cmds').innerHTML = DUEL_ACTIONS.map((a) => `<button class="btn" data-act="duel-act" data-a="${a.id}"><b>${a.ko}</b></button>`).join('');
  }
}

function duelAct(action) {
  const { d } = duelCtx;
  if (d.over) return;
  duelRound(d, action, true);
  sfx.hit();
  renderDuel();
  if (d.over) applyDuelResult();
}

function applyDuelResult() {
  const { d, mine, target } = duelCtx;
  const winner = d.winner === d.a ? mine : target;
  const loser = d.winner === d.a ? target : mine;
  loser.morale = Math.max(0, loser.morale - 35);
  const loss = Math.round(loser.troops * 0.18);
  loser.troops = Math.max(0, loser.troops - loss);
  winner.morale = Math.min(100, winner.morale + 12);
  game.stats.duels++;
  if (winner === mine) game.stats.duelWins++;
  battle.log.push(`일기토 — ${winner.name} 승리! ${loser.name} 부대 사기 -35, ${fmt(loss)}명 손실.`);
  if (loser.troops <= 0) {
    loser.alive = false;
    battle.log.push(`${loser.name} 부대가 궤멸했습니다.`);
  }
  mine.acted = true; mine.moved = true;
  if (d.winner === d.a) sfx.win(); else sfx.lose();
  renderDuel();
  renderBattle();
  autoSave();
  checkBattleOver();
}

function closeDuel() {
  $('#duel').classList.add('hidden');
  const wasOver = duelCtx && duelCtx.d.over;
  const won = duelCtx && duelCtx.d.winner === duelCtx.d.a;
  duelCtx = null;
  if (battle) { battleSel = null; battleMode = null; renderBattle(); }
  if (wasOver && battle && battle.over) setTimeout(finishBattle, 300);
}

/* ---------- 턴 종료 ---------- */
function endTurn() {
  if (!game || game.gameOver) return;
  if (battle) return;
  sfx.turn();
  const battles = E.endTurnPhase1(game);
  if (battles && battles.length) {
    toast('적군이 쳐들어왔습니다!', 1600);
    turnPending = true;
    const first = battles.shift();
    setTimeout(() => beginBattle(first, first.defenderFaction === game.playerId ? 'def' : 'atk'), 250);
    renderGame();
    return;
  }
  turnPending = false;
  E.endTurnPhase2(game);
  renderGame();
  autoSave();
  toast(`${game.year}년 ${game.month}월 — 새 달이 밝았습니다.`, 1500);
}

/* ---------- 외교 ---------- */
let diploConfirm = null;

function openDiplomacy() { sfx.click(); diploConfirm = null; renderDiplomacySheet(); }

function renderDiplomacySheet() {
  if (!game) return;
  const list = E.diplomacyView(game);
  const office = E.officeOf(game, game.playerId);
  const nx = E.nextOffice(game, game.playerId);
  const gold = E.factionGold(game, game.playerId);
  const head = `
    <div class="dp-head">
      <div class="dp-cell"><b>${office.ko}</b><span>관직</span></div>
      <div class="dp-cell"><b>${fmt(gold)}</b><span>세력 금</span></div>
      <div class="dp-cell"><b>${game.actionPoints}/${game.maxActionPoints}</b><span>행동력</span></div>
    </div>
    <p class="note">${nx ? `다음 관직 <b style="color:#e0c98a">${nx.ko}</b> — ${nx.needCities ? `성 ${nx.needCities}곳 더` : '성 조건 충족'}${nx.needFame ? ` · 명성 ${nx.needFame} 더` : ''} (행동력 +${nx.ap} · 세금 +${Math.round(nx.tax * 100)}%)` : '이미 황제의 자리에 올랐습니다.'}</p>
    <p class="note">친선 금 300 · 동맹 금 500 · 정전 금 400 — 모두 행동력 1을 씃니다. 동맹·정전 중에는 서로 칠 수 없습니다.</p>`;
  if (!list.length) { openSheet('외교', head + '<p class="note">겨룰 세력이 남아 있지 않습니다.</p>'); return; }
  const rows = list.map((d) => {
    const tone = d.allied ? 'ally' : d.truce ? 'truce' : d.rel >= 60 ? 'good' : d.rel < 30 ? 'bad' : 'mid';
    const chk = (k) => E.diplomacyCheck(game, k, d.id).ok;
    const breaking = diploConfirm === d.id;
    return `<div class="dp-row ${tone}">
      <div class="dp-top">
        <img src="${portraitURL(d.lordId, gd(d.lordId), 44, d.color)}" alt="${d.lordName}" />
        <div class="dp-main">
          <div class="dp-name">${d.name}군 <small>${d.lordName}</small></div>
          <div class="dp-meta">성 ${d.cities} · 병력 ${fmt(d.troops)} · 명성 ${d.fame}</div>
        </div>
        <div class="dp-rel"><b>${d.label}</b><span>우호 ${d.rel}</span>${d.allied ? `<em>동맹 ${d.allyMonths}개월</em>` : d.truce ? `<em>정전 ${d.truceMonths}개월</em>` : ''}</div>
      </div>
      <div class="dp-btns">
        <button class="dp-btn" data-act="diplo-act" data-fid="${d.id}" data-kind="envoy" ${chk('envoy') ? '' : 'disabled'}>친선 300</button>
        <button class="dp-btn" data-act="diplo-act" data-fid="${d.id}" data-kind="alliance" ${chk('alliance') ? '' : 'disabled'}>동맹 500</button>
        <button class="dp-btn" data-act="diplo-act" data-fid="${d.id}" data-kind="truce" ${chk('truce') ? '' : 'disabled'}>정전 400</button>
        ${d.allied ? `<button class="dp-btn danger ${breaking ? 'on' : ''}" data-act="diplo-act" data-fid="${d.id}" data-kind="break">${breaking ? '파기 확정' : '동맹 파기'}</button>` : ''}
      </div>
    </div>`;
  }).join('');
  openSheet('외교', head + rows);
}

function doDiplomacy(kind, fid) {
  if (kind === 'break' && diploConfirm !== fid) { diploConfirm = fid; sfx.select(); renderDiplomacySheet(); return; }
  let res;
  if (kind === 'envoy') res = E.sendEnvoy(game, fid);
  else if (kind === 'alliance') res = E.proposeAlliance(game, fid);
  else if (kind === 'truce') res = E.proposeTruce(game, fid);
  else res = E.breakAlliance(game, fid);
  diploConfirm = null;
  if (!res.ok || res.accepted === false) { sfx.fail(); toast(res.msg, 2800); }
  else { sfx.ok(); toast(res.msg, 3000); }
  renderGame();
  autoSave();
  if (!$('#sheet').classList.contains('hidden')) renderDiplomacySheet();
}

/* ---------- 전략 계략 ---------- */
let plotDraft = null;

function bestIntIn(cityId) {
  const gens = E.generalsInCity(game, cityId).filter((g) => !g.acted);
  gens.sort((a, b) => gd(b.id).int - gd(a.id).int);
  return gens.length ? gens[0].id : null;
}

function openPlotSheet(toCityId = null, fromCityId = null) {
  const me = game.playerId;
  let from = fromCityId;
  let to = toCityId;
  if (!from && to) {
    const srcs = E.adjacentFriends(game, to).filter((id) => E.generalsInCity(game, id).length);
    if (!srcs.length) { toast('인접한 아군 성에 계략을 보낼 장수가 없습니다.'); sfx.fail(); return; }
    from = srcs.find((id) => game.cities[id].gold >= 200) || srcs[0];
  }
  if (!to && from) {
    const foes = E.neighborFoes(game, from).filter((n) => !E.isPacified(game, me, game.cities[n].owner));
    if (!foes.length) { toast('이 성과 인접한 적 성이 없습니다.'); sfx.fail(); return; }
    to = foes[0];
  }
  if (!from || !to) { toast('계략을 쓸 대상이 없습니다.'); sfx.fail(); return; }
  plotDraft = { toCityId: to, fromCityId: from, kind: 'sow', gid: bestIntIn(from) };
  renderPlotSheet();
  sfx.click();
}

function renderPlotSheet() {
  const d = plotDraft;
  if (!d) return;
  const me = game.playerId;
  const to = game.cities[d.toCityId];
  const srcs = E.adjacentFriends(game, d.toCityId).filter((id) => E.generalsInCity(game, id).length);
  const foes = E.neighborFoes(game, d.fromCityId).filter((n) => !E.isPacified(game, me, game.cities[n].owner));
  const si = E.isScouted(game, d.toCityId) ? E.scoutedInfo(game, d.toCityId) : null;
  const kinds = Object.entries(E.PLOTS).map(([k, p]) => `<button class="pick-chip ${d.kind === k ? 'on' : ''}" data-act="plot-kind" data-kind="${k}">${p.ko} <b style="color:#9c9270">${p.gold}</b></button>`).join('');
  const gold = game.cities[d.fromCityId].gold;
  const rows = E.generalsInCity(game, d.fromCityId).map((g) => {
    const t = gd(g.id);
    const on = d.gid === g.id;
    const chance = Math.round(E.plotChance(game, d.fromCityId, d.toCityId, d.kind, g.id) * 100);
    return `<button class="officer-row ${on ? 'picked' : ''} ${g.acted ? 'done' : ''}" data-act="plot-gen" data-officer="${g.id}" ${g.acted ? 'disabled' : ''}>
      <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
      <div class="or-main">
        <div class="or-name">${t.ko} <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
        <div class="or-stats"><span>지 <b>${t.int}</b></span><span>충 <b>${g.loyalty}</b></span><span>성공률 <b>${chance}%</b></span></div>
      </div>
      <div class="or-go">${g.acted ? '완료' : on ? '파견' : '선택'}</div>
    </button>`;
  }).join('');
  const check = d.gid ? E.plotCheck(game, d.fromCityId, d.toCityId, d.kind, d.gid) : { ok: false, why: '파견할 장수를 고르세요.' };
  const chance = d.gid ? Math.round(E.plotChance(game, d.fromCityId, d.toCityId, d.kind, d.gid) * 100) : 0;
  const intel = si
    ? `<div class="sc-box" style="margin:6px 0">
        <div class="sc-head">정탐 정보 <span>${E.scoutTurnsLeft(game, d.toCityId)}턴 남음</span></div>
        <div class="sc-meta">훈련 ${si.train} · 치안 ${si.order} · 방어 ${si.def} · 금 ${fmt(si.gold)} · 량 ${fmt(si.food)}</div>
        <div class="sc-gens">${si.generals.map((g) => `<div class="sc-gen"><b>${g.ko}</b><span>통${g.lead} 무${g.war} 지${g.int} 충${g.loyalty}</span></div>`).join('') || '<span class="none">주둔 장수 없음</span>'}</div>
      </div>`
    : `<p class="note">적 성 최고 지력 ${E.cityBestInt(game, d.toCityId)} — 정탐을 보내면 속내를 볼 수 있습니다.</p>`;
  openSheet(`${CITY_BY_ID[d.toCityId].ko} 계략`, `
    <p class="note">${fname(to.owner)}군 · 병력 ${fmt(to.troops)} · 방어 ${to.def} · 치안 ${to.order} · 훈련 ${to.train}</p>
    ${foes.length > 1 ? `<div class="chip-row">${foes.map((n) => `<button class="pick-chip ${n === d.toCityId ? 'on' : ''}" data-act="plot-to" data-city="${n}">${CITY_BY_ID[n].ko}</button>`).join('')}</div>` : ''}
    ${intel}
    <div class="chip-row">${kinds}</div>
    <p class="note">${E.PLOTS[d.kind].desc} 이 성의 금 ${fmt(gold)} · 행동력 1을 씃니다.</p>
    ${srcs.length > 1 ? `<div class="chip-row">${srcs.map((s) => `<button class="pick-chip ${s === d.fromCityId ? 'on' : ''}" data-act="plot-from" data-city="${s}">${CITY_BY_ID[s].ko}</button>`).join('')}</div>` : ''}
    <p class="note" style="margin-top:8px">파견 장수 — 지력이 높을수록 성공률이 오릅니다. 예상 성공률 <b>${chance}%</b></p>
    ${rows}
    <div class="sheet-foot">
      ${check.ok ? '' : `<p class="note warn">${check.why}</p>`}
      <button class="btn big" data-act="plot-go" ${check.ok ? '' : 'disabled'}>${E.PLOTS[d.kind].ko} 실행 · 금 ${E.PLOTS[d.kind].gold} (성공률 ${chance}%)</button>
    </div>`);
}

function doPlot() {
  const d = plotDraft;
  if (!d || !d.gid) return;
  const res = E.runPlot(game, d.fromCityId, d.toCityId, d.kind, d.gid);
  closeSheet();
  plotDraft = null;
  if (!res.ok) { sfx.fail(); toast(res.msg); }
  else if (!res.success) { sfx.fail(); toast(res.msg, 2800); }
  else { sfx.win(); toast(res.msg, 3200); }
  renderGame();
  autoSave();
}

/* ---------- 월간 이벤트 ---------- */
function openEventSheet() {
  const ev = game && game.pendingEvent;
  if (!ev) return;
  const gold = E.factionGold(game, game.playerId);
  const opts = (ev.options || []).map((o) => {
    const off = (ev.id === 'plague' && o.id === 'treat' && gold < 300) || (ev.id === 'drought' && o.id === 'irrigate' && gold < 250);
    const soft = o.id === 'endure' || o.id === 'refuse' || o.id === 'ignore';
    return `<button class="btn big ev-opt ${soft ? 'ghost' : ''}" data-act="event-go" data-id="${o.id}" ${off ? 'disabled' : ''} style="margin-bottom:8px">
      <span>${o.ko}</span>${o.hint ? `<small>${off ? '금이 부족합니다' : o.hint}</small>` : ''}</button>`;
  }).join('');
  openSheet(`${ev.year}년 ${ev.month}월 — 달의 소식`, `<div class="ev-box">
      <div class="ev-title">${ev.title}</div>
      <p class="ev-text">${ev.text}</p>
    </div>${opts || '<button class="btn big" data-act="sheet-close">닫기</button>'}`);
  sfx.select();
}

function doEvent(choiceId) {
  const res = E.resolveEvent(game, choiceId);
  if (!res.ok) { toast(res.msg); return; }
  closeSheet();
  sfx.ok();
  toast(res.msg, 3200);
  renderGame();
  autoSave();
}

/* ---------- 관직 승급 ---------- */
function openPromotionSheet() {
  const list = (game.lastPromotions || []).filter((p) => p.factionId === game.playerId);
  if (!list.length) return;
  const p = list[list.length - 1];
  E.clearPromotions(game);
  const before = game.maxActionPoints;
  game.maxActionPoints = E.calcActionPoints(game, game.playerId);
  game.actionPoints += Math.max(0, game.maxActionPoints - before);
  const f = game.factions[game.playerId];
  const nx = E.nextOffice(game, game.playerId);
  $('#res-ap').textContent = `${game.actionPoints}/${game.maxActionPoints}`;
  $('#turn-hint').textContent = `명령 ${game.actionPoints}`;
  sfx.win();
  openSheet('관직 승급', `
    <div class="promo">
      <div class="promo-to">${p.to}</div>
      <p class="promo-text">${f.name}군의 관직이 ${p.from}에서 ${E.withJosa(p.to, '로')} 올랐습니다.<br>천하에 그 이름이 더 크게 울립니다.</p>
      <div class="promo-bonus">
        <div><b>+${p.ap}</b><span>최대 행동력</span></div>
        <div><b>+${Math.round(p.tax * 100)}%</b><span>세금 수입</span></div>
      </div>
      ${nx ? `<p class="note">다음 관직 <b>${nx.ko}</b> — 성 ${nx.cities}곳 · 명성 ${nx.fame}</p>` : '<p class="note">이제 천하의 황제입니다.</p>'}
    </div>
    <button class="btn big" data-act="promo-ok" style="margin-top:10px">받들겠습니다</button>`);
}

/* ---------- 메뉴/저장 ---------- */
function openMenu() {
  openSheet('군의', `
    <div class="acc-box acc-menu" id="menu-account"></div>
    <button class="btn big" data-act="save-slot" data-slot="1" style="margin-bottom:8px">슬롯 1에 저장</button>
    <button class="btn big" data-act="save-slot" data-slot="2" style="margin-bottom:8px">슬롯 2에 저장</button>
    <button class="btn big" data-act="save-slot" data-slot="3" style="margin-bottom:8px">슬롯 3에 저장</button>
    <button class="btn big ghost" data-act="open-load" style="margin-bottom:8px">불러오기</button>
    <button class="btn big ghost" data-act="open-reports" style="margin-bottom:8px">군보</button>
    <button class="btn big ghost" data-act="diplomacy" style="margin-bottom:8px">외교 · 관직</button>
    ${game && game.pendingEvent ? '<button class="btn big ghost" data-act="open-event" style="margin-bottom:8px">달의 소식</button>' : ''}
    <button class="btn big ghost" data-act="open-rank" style="margin-bottom:8px">세력 순위</button>
    <button class="btn big ghost" data-act="open-help" style="margin-bottom:8px">게임 방법</button>
    <button class="btn big ghost" data-act="to-title">타이틀로</button>
  `);
  Cloud.mount($('#menu-account'));
}

function openLoad() {
  const rows = [];
  if (Cloud.state().signedIn) {
    rows.push(`<p class="note acc-load-note">☁ ${Cloud.state().name} 님으로 로그인됨 — 기기 저장과 클라우드 저장을 합친 상태입니다.</p>`);
  }
  for (let i = 1; i <= 3; i++) {
    const raw = localStorage.getItem(KEYS.slot(i));
    rows.push(loadRow(i, raw, `슬롯 ${i}`));
  }
  rows.push(loadRow('auto', localStorage.getItem(KEYS.auto), '자동 저장'));
  openSheet('불러오기', rows.join('') || '<p class="note">저장된 기록이 없습니다.</p>');
}

function loadRow(slot, raw, label) {
  if (!raw) return `<button class="officer-row done" disabled><div class="or-main"><div class="or-name">${label}</div><div class="or-stats">비어 있음</div></div></button>`;
  let info = null;
  try {
    const s = JSON.parse(raw);
    const f = s.factions[s.playerId];
    info = `${s.year}년 ${s.month}월 · ${f.name} · 성 ${E.factionCities(s, s.playerId).length}곳`;
  } catch (e) { info = '손상된 기록'; }
  return `<button class="officer-row" data-act="do-load" data-slot="${slot}">
    <img src="${portraitURL('save-' + slot, { war: 60, lead: 60 }, 40, '#3a3428')}" alt="" />
    <div class="or-main"><div class="or-name">${label}</div><div class="or-stats">${info}</div></div>
    <div class="or-go">불러오기</div></button>`;
}

function doLoad(slot) {
  const raw = slot === 'auto' ? localStorage.getItem(KEYS.auto) : localStorage.getItem(KEYS.slot(slot));
  if (!raw) { toast('저장 기록이 없습니다.'); return; }
  try {
    game = E.deserialize(raw);
    closeSheet();
    selectedCity = E.factionCities(game, game.playerId)[0]?.id || null;
    cityPanelOpen = true;
    if (!mapView) {
      mapView = createMapView($('#map'), { onSelectCity: (id) => selectCity(id) });
    }
    show('scr-game');
    mapView.setState(game);
    mapView.setSelected(selectedCity);
    if (selectedCity) mapView.focusCity(selectedCity);
    mapView.resize();
    renderGame();
    sfx.ok();
    toast('기록을 불러왔습니다.', 1400);
    if ((game.pendingPrisoners || []).length) setTimeout(openPrisonerSheet, 500);
  } catch (e) {
    toast('불러오기 실패: ' + e.message);
    sfx.fail();
  }
}

function openRank() {
  const list = E.ranking(game);
  openSheet('세력 순위', list.map((r, i) => `
    <div class="officer-row">
      <div style="width:22px;text-align:center;color:${i < 3 ? '#d8b34a' : '#7d745a'}">${i + 1}</div>
      <div class="or-main">
        <div class="or-name" style="color:${r.color}">${r.name}${r.id === game.playerId ? ' <small>(아군)</small>' : ''}</div>
        <div class="or-stats"><span>성 <b>${r.cities}</b></span><span>병력 <b>${fmt(r.troops)}</b></span><span>장수 <b>${r.generals}</b></span><span>전력 <b>${fmt(r.power)}</b></span></div>
      </div>
    </div>`).join(''));
}

function openHelp() {
  openSheet('게임 방법', `
    <p class="note" style="line-height:1.9">
    <b style="color:#e6d9b3">1. 목표</b> — 전국 42개 성을 모두 차지하면 천하통일입니다.<br>
    <b style="color:#e6d9b3">2. 달마다</b> — 행동력만큼 명령을 내립니다. 장수는 한 달에 한 번만 움직입니다.<br>
    <b style="color:#e6d9b3">3. 내정</b> — 개발(농업)·상업·치안·수리로 성을 키우고, 징병·훈련으로 군세를 만듭니다.<br>
    <b style="color:#e6d9b3">4. 인사</b> — 탐색으로 인재를 찾고 등용합니다. 포상으로 금을 써서 충성을 올립니다.<br>
    <b style="color:#e6d9b3">5. 이동</b> — 아군 성끼리 장수를 옮깁니다. 행동력 1을 쓰고, 옮긴 장수는 그 달 행동을 마칩니다.<br>
    <b style="color:#e6d9b3">6. 대화</b> — 성의 장수와 이야기를 나누면 충성도가 오릅니다(행동력 1, 장수마다 한 달 1회, 금은 들지 않음).<br>
    <b style="color:#e6d9b3">7. 출진</b> — 인접한 적 성을 공격합니다. 전장에서 부대를 움직여 성을 함락시키세요.<br>
    <b style="color:#e6d9b3">8. 진형</b> — 어린(공격)·방원(방어)·학익(원거리)·봉시(돌격) 등 9종. 부대의 진형에 따라 공격·방어·사거리가 달라집니다.<br>
    <b style="color:#e6d9b3">9. 계략</b> — 지력이 높은 장수는 화계·혼란·고무·치료를 씁니다.<br>
    <b style="color:#e6d9b3">10. 일기토</b> — 인접한 적 장수에게 1:1 대결을 걸 수 있습니다. 이기면 적 부대 사기가 급락합니다.<br>
    <b style="color:#e6d9b3">11. 외교</b> — 지도 위 외교 버튼에서 친선·동맹·정전을 맺습니다. 동맹·정전 중인 세력은 서로 치지 못하고, 동맹은 원군도 보냅니다. 동맹 파기는 명성 -15.<br>
    <b style="color:#e6d9b3">12. 계략</b> — 적 성을 고르면 계략을 쓸 수 있습니다. 이간(충성 하락)·정탐(3턴 속내 열람)·유언비어(치안·훈련·물자 약화). 지력이 높은 장수일수록 성공합니다.<br>
    <b style="color:#e6d9b3">13. 관직</b> — 성 수와 명성에 따라 현령→자사→주목→대장군→승상→왕→황제로 오르며 행동력·세금이 늘어납니다.<br>
    <b style="color:#e6d9b3">14. 원군</b> — 출진할 때 인접한 아군·동맹 성에서 원군을 고르면 2라운드에 전장 가장자리로 들어옵니다. 방어전에서는 자동으로 합류합니다.<br>
    <b style="color:#e6d9b3">15. 달의 소식</b> — 새 달에 풍작·도적·역병·가뭄·유랑 무장 같은 일이 생깁니다. 선택에 따라 결과가 달라집니다.<br>
    <b style="color:#e6d9b3">16. 저장</b> — 매 명령마다 자동 저장되며, 슬롯 3개에 수동 저장할 수 있습니다.
    </p>`);
}

/* ---------- 엔딩 ---------- */
function showEnding() {
  if (!game || !game.gameOver) return;
  const g = game.gameOver;
  const sum = E.factionSummary(game, game.playerId);
  const win = g.type === 'victory';
  sfx[win ? 'win' : 'lose']();
  $('#end-wrap').innerHTML = `
    <div class="end-mark">${win ? '천하' : '낙일'}</div>
    <div class="end-title">${win ? '천하통일' : '낙일'}</div>
    <p class="end-text">${g.text}</p>
    <div class="end-stats">
      <div class="end-stat"><i>치세</i><b>${game.year}년 ${game.month}월</b></div>
      <div class="end-stat"><i>보유 성</i><b>${sum.cities} / 42</b></div>
      <div class="end-stat"><i>총 병력</i><b>${fmt(sum.troops)}</b></div>
      <div class="end-stat"><i>명성</i><b>${Math.round(game.factions[game.playerId].fame)}</b></div>
      <div class="end-stat"><i>전투</i><b>${game.stats.battles}회 · ${game.stats.wins}승</b></div>
      <div class="end-stat"><i>일기토</i><b>${game.stats.duels}회 · ${game.stats.duelWins}승</b></div>
    </div>
    <button class="btn big" data-act="to-title" style="margin-bottom:8px">타이틀로</button>
    <button class="btn big ghost" data-act="new">새 게임</button>
  `;
  show('scr-end');
}

/* ---------- 이벤트 ---------- */
function onClick(e) {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'new': sfx.click(); game = null; renderScenarios(); show('scr-scenario'); break;
    case 'continue': {
      const raw = localStorage.getItem(KEYS.auto);
      if (!raw) { toast('이어할 기록이 없습니다.'); break; }
      doLoad('auto');
      break;
    }
    case 'load': openLoad(); break;
    case 'mute': {
      sfx.mute(!sfx.isMuted());
      $$('[data-act="mute"]').forEach((b) => { b.textContent = sfx.isMuted() ? '✕' : '♪'; });
      break;
    }
    case 'back-title': refreshContinue(); show('scr-title'); drawTitleArt(); break;
    case 'back-scenario': renderScenarios(); show('scr-scenario'); break;
    case 'pick-scenario': renderLords(el.dataset.id); show('scr-lord'); break;
    case 'pick-lord': startGame(el.dataset.sc, el.dataset.id); break;
    case 'open-custom': openCustomScreen(el.dataset.sc || (currentScenario && currentScenario.id) || SCENARIOS[0].id); break;
    case 'cst-scenario': customDraft.scenarioId = el.dataset.v; renderCustomBody(); break;
    case 'cst-mark': customDraft.mark = el.dataset.v; renderCustomBody(); break;
    case 'cst-color': customDraft.color = el.dataset.v; renderCustomBody(); break;
    case 'cst-style': customDraft.style[el.dataset.k] = Number(el.dataset.v); renderCustomBody(); break;
    case 'cst-stat': adjustCustomStat(el.dataset.k, Number(el.dataset.d)); break;
    case 'cst-dice': customDraft.stats = E.rollCustomStats(); renderCustomBody(); sfx.click(); break;
    case 'cst-skill': customDraft.skill = el.dataset.v; renderCustomBody(); break;
    case 'cst-arms': customDraft.arms = el.dataset.v; renderCustomBody(); break;
    case 'cst-retinue': customDraft.retinue = Number(el.dataset.v); renderCustomBody(); break;
    case 'cst-start': startCustomGame(); break;
    case 'jump-region': {
      closeSheet();
      if (el.dataset.region === '__mine') {
        const mine = E.factionCities(game, game.playerId);
        if (mine.length) { cityPanelOpen = true; selectedCity = mine[0].id; mapView.focusCity(selectedCity); mapView.setSelected(selectedCity); renderCityPanel(); }
      } else {
        mapView.focusRegion(el.dataset.region);
      }
      break;
    }
    case 'region-menu': sfx.click(); openRegionMenu(); break;
    case 'diplomacy': openDiplomacy(); break;
    case 'diplo-act': doDiplomacy(el.dataset.kind, el.dataset.fid); break;
    case 'plot-city': openPlotSheet(el.dataset.city, null); break;
    case 'plot-to': plotDraft.toCityId = el.dataset.city; renderPlotSheet(); sfx.click(); break;
    case 'plot-kind': plotDraft.kind = el.dataset.kind; renderPlotSheet(); sfx.click(); break;
    case 'plot-from': plotDraft.fromCityId = el.dataset.city; plotDraft.gid = bestIntIn(el.dataset.city); renderPlotSheet(); sfx.click(); break;
    case 'plot-gen': plotDraft.gid = el.dataset.officer; renderPlotSheet(); sfx.click(); break;
    case 'plot-go': doPlot(); break;
    case 'march-reinforce': {
      const id = el.dataset.city;
      const i = pendingSetup.reinforce.indexOf(id);
      if (i >= 0) pendingSetup.reinforce.splice(i, 1);
      else if (pendingSetup.reinforce.length < E.REINFORCE_MAX) pendingSetup.reinforce.push(id);
      else { toast(`원군은 ${E.REINFORCE_MAX}부대까지 함께 갈 수 있습니다.`); sfx.fail(); }
      $('#sheet-body').innerHTML = marchSheetHTML();
      sfx.click();
      break;
    }
    case 'event-go': doEvent(el.dataset.id); break;
    case 'promo-ok': closeSheet(); break;
    case 'open-event': openEventSheet(); break;
    case 'open-reports': sfx.click(); openReports(); break;
    case 'city-toggle': cityPanelOpen = !cityPanelOpen; sfx.click(); renderCityPanel(); break;
    case 'city-prev': stepCity(-1); break;
    case 'city-next': stepCity(1); break;
    case 'zoom-in': mapView.zoomBy(1.25); break;
    case 'zoom-out': mapView.zoomBy(0.8); break;
    case 'zoom-reset': mapView.resetView(); break;
    case 'endturn': endTurn(); break;
    case 'close-city': selectedCity = null; cityPanelOpen = false; mapView.setSelected(null); renderCityPanel(); break;
    case 'cmd': {
      const cmd = el.dataset.cmd;
      if (cmd === 'move') openMoveSheet(el.dataset.city);
      else if (cmd === 'talk') openTalkSheet(el.dataset.city);
      else if (cmd === 'plot') openPlotSheet(null, el.dataset.city);
      else openCommandSheet(cmd, el.dataset.city);
      break;
    }
    case 'mv-gen': toggleMoveGeneral(el.dataset.officer); break;
    case 'mv-dest': moveDraft.toCityId = el.dataset.city; renderMoveSheet(); sfx.click(); break;
    case 'mv-go': doMoveGenerals(); break;
    case 'talk-go': doTalk(el.dataset.officer); break;
    case 'talk-more': renderTalkSheet(); break;
    case 'do-command': doCommand(sheetCommandType, el.dataset.officer, sheetCityId); break;
    case 'do-hire': doHire(sheetCityId, el.dataset.officer); break;
    case 'do-reward': doReward(sheetCityId, el.dataset.officer); break;
    case 'tr-target': {
      uiState.trTarget = el.dataset.city;
      $$('#tr-targets .pick-chip').forEach((b) => b.classList.toggle('on', b.dataset.city === el.dataset.city));
      break;
    }
    case 'tr-gold+': case 'tr-gold-': case 'tr-food+': case 'tr-food-': adjustTransport(act); break;
    case 'do-transport': doTransport(el.dataset.officer); break;
    case 'march': pendingSetup = null; openMarchSheet(el.dataset.city); break;
    case 'attack-enemy': openAttackEnemySheet(el.dataset.city); break;
    case 'march-from': openMarchSheet(el.dataset.city, el.dataset.to); break;
    case 'march-target': pendingSetup.targetId = el.dataset.city; $('#sheet-body').innerHTML = marchSheetHTML(); break;
    case 'march-gen': {
      const id = el.dataset.officer;
      const idx = pendingSetup.generals.indexOf(id);
      if (idx >= 0) pendingSetup.generals.splice(idx, 1);
      else if (pendingSetup.generals.length < 5) pendingSetup.generals.push(id);
      $('#sheet-body').innerHTML = marchSheetHTML();
      break;
    }
    case 'march-ratio+': case 'march-ratio-': {
      const inp = $('#march-ratio');
      let v = parseInt(inp.value, 10) || 100;
      v = act === 'march-ratio+' ? Math.min(100, v + 10) : Math.max(20, v - 10);
      pendingSetup.ratio = v / 100;
      $('#sheet-body').innerHTML = marchSheetHTML();
      break;
    }
    case 'march-form': {
      pendingSetup.forms[el.dataset.officer] = el.dataset.form;
      pendingSetup.focus = el.dataset.officer;
      $('#sheet-body').innerHTML = marchSheetHTML();
      sfx.click();
      break;
    }
    case 'march-go': startPlayerBattle(); break;
    case 'sheet-close': if (prisonerSheetOpen) closePrisonerSheet(); else closeSheet(); break;
    case 'menu': openMenu(); break;
    case 'open-load': openLoad(); break;
    case 'open-rank': openRank(); break;
    case 'open-help': openHelp(); break;
    case 'save-slot': {
      const slot = el.dataset.slot;
      try {
        localStorage.setItem(KEYS.slot(slot), E.serialize(game));
        Cloud.noteSaved(slot);
        toast(Cloud.state().signedIn ? `슬롯 ${slot}에 저장했습니다 · 클라우드로도 올립니다.` : `슬롯 ${slot}에 저장했습니다.`);
        sfx.ok();
      } catch (err) { toast('저장 실패'); }
      break;
    }
    case 'do-load': doLoad(el.dataset.slot); break;
    case 'to-title': closeSheet(); $('#duel').classList.add('hidden'); refreshContinue(); show('scr-title'); drawTitleArt(); break;
    case 'new-game': break;
    /* 전투 */
    case 'bt-select': {
      const u = battle.units.find((x) => x.id === el.dataset.unit);
      if (u) { battleSel = u; battleMode = null; renderBattle(); }
      break;
    }
    case 'bt-move': battleMode = 'move'; renderBattle(); break;
    case 'bt-attack': battleMode = 'attack'; renderBattle(); break;
    case 'bt-tactic': {
      const g = B.unitSpec(battleSel);
      const can = [];
      if (g.skill === 'hwagye' || g.int >= 70) can.push(['fire', '화계']);
      if (g.skill === 'hollan' || g.int >= 75) can.push(['confuse', '혼란']);
      can.push(['rally', '고무']);
      if (g.skill === 'chiryo' || g.int >= 60) can.push(['heal', '치료']);
      openSheet('계략 선택', `<div class="tactic-grid">${can.map(([k, ko]) => `<button class="btn" data-act="bt-tactic-kind" data-kind="${k}">${ko}</button>`).join('')}</div>`);
      break;
    }
    case 'bt-tactic-kind': {
      battleMode = 'tactic:' + el.dataset.kind;
      closeSheet();
      toast(el.dataset.kind === 'rally' || el.dataset.kind === 'heal' ? '아군 부대를 고르세요' : '적 부대를 고르세요', 1200);
      renderBattle();
      break;
    }
    case 'bt-duel': {
      const opts = B.duelOptions(battle, battleSel);
      openSheet('일기토 상대', opts.map((u) => {
        const t = gd(u.gid);
        return `<button class="officer-row" data-act="bt-duel-go" data-unit="${u.id}">
          <img src="${portraitURL(u.gid, t, 40, '#8c2f24')}" alt="" />
          <div class="or-main"><div class="or-name">${t.ko}</div>
          <div class="or-stats"><span>무력 <b>${t.war}</b></span><span>병력 <b>${fmt(u.troops)}</b></span><span>사기 <b>${Math.round(u.morale)}</b></span></div></div>
          <div class="or-go">일기토</div></button>`;
      }).join(''));
      break;
    }
    case 'bt-duel-go': {
      const target = battle.units.find((u) => u.id === el.dataset.unit);
      closeSheet();
      openDuel(target);
      break;
    }
    case 'duel-act': duelAct(el.dataset.a); break;
    case 'duel-close': closeDuel(); break;
    case 'bt-wait': if (battleSel) { B.endUnit(battleSel); battleMode = null; renderBattle(); } break;
    case 'bt-next': playerNext(); break;
    case 'bt-all': allOut(); break;
    case 'bt-retreat': retreat(); break;
    case 'bt-close': closeBattle(); break;
    case 'prisoner-recruit': prisonerAct('recruit', el.dataset.gid); break;
    case 'prisoner-release': prisonerAct('release', el.dataset.gid); break;
    case 'prisoner-execute': prisonerAct('execute', el.dataset.gid); break;
    case 'prisoner-done': closePrisonerSheet(); break;
    default: break;
  }
}

function adjustTransport(act) {
  const goldInp = $('#tr-gold'), foodInp = $('#tr-food');
  const cityId = sheetCityId;
  if (act === 'tr-gold+') uiState.trGold = Math.min(game.cities[cityId].gold, uiState.trGold + 500);
  if (act === 'tr-gold-') uiState.trGold = Math.max(0, uiState.trGold - 500);
  if (act === 'tr-food+') uiState.trFood = Math.min(game.cities[cityId].food, uiState.trFood + 1000);
  if (act === 'tr-food-') uiState.trFood = Math.max(0, uiState.trFood - 1000);
  if (goldInp) goldInp.value = uiState.trGold;
  if (foodInp) foodInp.value = uiState.trFood;
}

function doTransport(officerId) {
  const cityId = sheetCityId;
  const gold = parseInt($('#tr-gold')?.value || '0', 10) || 0;
  const food = parseInt($('#tr-food')?.value || '0', 10) || 0;
  const res = E.runCommand(game, 'transport', { cityId, officerId, targetCityId: uiState.trTarget, gold, food });
  closeSheet();
  if (res.ok) { sfx.ok(); toast(res.msg); } else { sfx.fail(); toast(res.msg); }
  renderGame(); autoSave();
}

/* ---------- 부트 ---------- */
export function boot() {
  $$('[data-act="mute"]').forEach((b) => { b.textContent = sfx.isMuted() ? '✕' : '♪'; });
  document.addEventListener('click', onClick);
  document.addEventListener('input', onCustomInput);
  document.addEventListener('change', onCustomInput);
  bindCityPanelSwipe();
  refreshContinue();
  $('#map') && $('#map').addEventListener('pointerdown', () => sfx.unlock(), { once: true });
  const bc = $('#battle-canvas');
  bc && bc.addEventListener('click', (e) => { if (battle) battleTap(e.clientX, e.clientY); });
  window.addEventListener('resize', () => {
    if (mapView) mapView.resize();
    if (!$('#scr-battle').classList.contains('hidden')) resizeBattleCanvas();
    if (!$('#scr-title').classList.contains('hidden')) drawTitleArt();
    fitResValues();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheet(); }
  });
  renderScenarios();
  show('scr-title');
  drawTitleArt();
  Cloud.mount($('#title-account'));
  Cloud.start({
    onStatus: () => { const b = $('#btn-continue'); if (b) b.disabled = !localStorage.getItem(KEYS.auto); },
    onApplied: () => {
      const b = $('#btn-continue');
      if (b) b.disabled = !localStorage.getItem(KEYS.auto);
      drawTitleArt();
    },
    onSignedIn: ({ name }) => toast(`${name} 님으로 로그인했습니다. 저장을 동기화합니다.`, 2600),
  }).then((res) => {
    if (res && Cloud.state().signedIn && !$('#scr-title').classList.contains('hidden')) {
      toast('☁ 클라우드 저장과 동기화했습니다.', 1800);
    }
  });
  setTimeout(drawTitleArt, 100);
  setTimeout(() => { if (!$('#scr-title').classList.contains('hidden')) drawTitleArt(); }, 500);
}

export { game };
