/* UI — 화면 전환 · 지도 · 내정 · 전술전투 · 일기토 */
import { CITIES, CITY_BY_ID, GENERAL_BY_ID, SCENARIOS, FORMATIONS, REGIONS } from './data.js';
import * as E from './engine.js';
import * as B from './battle.js';
import { createDuel, duelRound, DUEL_ACTIONS } from './duel.js';
import { portraitURL } from './portrait.js';
import { createMapView } from './mapview.js';
import { sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

const KEYS = { auto: 'samguk5.auto', slot: (i) => `samguk5.slot${i}`, muted: 'samguk5.muted' };

let game = null;
let mapView = null;
let selectedCity = null;
let cityPanelOpen = false;
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
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#070c16'); sky.addColorStop(0.55, '#101a2b'); sky.addColorStop(1, '#241a16');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // 별
  for (let i = 0; i < 90; i++) {
    const x = (i * 97.13) % w, y = (i * 53.7) % (h * 0.6);
    ctx.fillStyle = i % 5 === 0 ? '#f5e9c0' : 'rgba(220,220,200,0.5)';
    ctx.fillRect(Math.round(x), Math.round(y), i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
  }
  // 달
  const mx = w * 0.72, my = h * 0.2, mr = Math.min(w, h) * 0.09;
  ctx.fillStyle = '#e9d9a8';
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cfbc85';
  ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + mr * 0.35, my + mr * 0.25, mr * 0.12, 0, Math.PI * 2); ctx.fill();
  // 산
  const step = Math.max(6, w / 36);
  const baseY = h * 0.72;
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = ['#0d1622', '#131e2a', '#1a2430'][layer];
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + step; x += step) {
      const seed = Math.sin((x * 0.013) + layer * 2.1) * 0.5 + Math.sin(x * 0.031 + layer) * 0.5;
      const y = baseY + layer * h * 0.07 - Math.abs(seed) * h * (0.16 - layer * 0.03);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }
  // 성 실루엣
  const gy = h * 0.92, gw = Math.min(250, w * 0.66), gx = w / 2 - gw / 2;
  const u = gw / 24;
  // 성벽 뒤 은은한 불빛
  const glow = ctx.createRadialGradient(w / 2, gy - u * 4, 4, w / 2, gy - u * 4, gw * 0.75);
  glow.addColorStop(0, 'rgba(200,120,50,0.20)');
  glow.addColorStop(1, 'rgba(200,120,50,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, gy - u * 16, w, h * 0.24);
  ctx.fillStyle = '#131e2a';
  ctx.fillRect(gx, gy - u * 4, gw, h * 0.2);
  ctx.fillRect(gx - u * 2, gy - u * 7, u * 7, h * 0.2);
  ctx.fillRect(gx + gw - u * 5, gy - u * 7, u * 7, h * 0.2);
  ctx.fillRect(gx + gw / 2 - u * 3, gy - u * 9, u * 6, h * 0.2);
  ctx.fillStyle = '#1b2734';
  for (let i = 0; i < 12; i++) ctx.fillRect(gx + i * u * 2, gy - u * 5, u, u);
  // 깃발
  ctx.fillStyle = '#2a2418'; ctx.fillRect(gx + gw / 2 + u * 2, gy - u * 13, 2, u * 5);
  ctx.fillStyle = '#8f2a22'; ctx.fillRect(gx + gw / 2 + u * 2 + 2, gy - u * 13, u * 4, u * 3);
  // 횃불
  for (let i = 0; i < 6; i++) {
    const fx = gx + u * (2 + i * 4), fy = gy - u * 1.5;
    const flick = 0.6 + 0.4 * Math.sin(Date.now() / 220 + i);
    ctx.fillStyle = `rgba(255,170,60,${0.55 * flick})`;
    ctx.fillRect(fx, fy, 2, 3);
  }
}

/* ---------- 시나리오 / 군주 ---------- */
function renderScenarios() {
  $('#scenario-list').innerHTML = SCENARIOS.map((s) => {
    const facs = s.factions.length;
    const gens = new Set();
    s.factions.forEach((f) => f.generals.forEach((g) => gens.add(g)));
    return `<button class="sc-card" data-act="pick-scenario" data-id="${s.id}">
      <div class="sc-year">${s.year}년</div>
      <div class="sc-name">${s.name} <small>${s.hanja}</small></div>
      <div class="sc-meta"><span>세력 <b>${facs}</b></span><span>성 <b>${s.factions.reduce((n, f) => n + f.cities.length, 0)}</b></span><span>등장 장수 <b>${gens.size}</b></span></div>
    </button>`;
  }).join('');
}

function renderLords(scenarioId) {
  const sc = SCENARIOS.find((s) => s.id === scenarioId);
  currentScenario = sc;
  $('#lord-title').textContent = `${sc.year}년 ${sc.name} — 군주 선택`;
  $('#lord-list').innerHTML = sc.factions.map((f) => {
    const lord = GENERAL_BY_ID[f.lord];
    const color = (game && game.factions[f.id]) ? game.factions[f.id].color : (SCENARIO_COLORS[f.id] || '#888');
    return `<button class="lord-card" data-act="pick-lord" data-id="${f.id}" data-sc="${sc.id}">
      <img src="${portraitURL(lord.id, lord, 56, color)}" alt="${lord.ko}" />
      <div class="lc-name">${f.name}</div>
      <div class="lc-hanja">${f.hanja}</div>
      <div class="lc-meta"><span>성 <b>${f.cities.length}</b></span><span>장수 <b>${f.generals.length}</b></span></div>
      <div class="lc-meta lc-stats"><span>통 <b>${lord.lead}</b></span><span>무 <b>${lord.war}</b></span><span>지 <b>${lord.int}</b></span></div>
    </button>`;
  }).join('');
}
const SCENARIO_COLORS = {
  jojo: '#3f6fb5', liubei: '#3f9b6b', sunquan: '#c2453f', lubu: '#8a5cc4', yuanshao: '#c08a3e',
  liubiao: '#4a9a9a', liuzhang: '#a8a04a', mateng: '#b06a3a', gongsunzan: '#6a7fb0', sunce: '#c2453f',
  liuyao: '#6a8ab0', yuan_shu: '#b04a8a', zhanglu: '#9a7a5a', taoqian: '#c0a05a', hansui: '#a06a30',
  gongsundu: '#5a8f9a', shixie: '#5a9a6a', free: '#6b6b6b',
};

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
  mapView.setSelected(selectedCity);
  mapView.resetView();
  mapView.resize();
  renderGame();
  autoSave();
}

function autoSave() {
  if (!game) return;
  try { localStorage.setItem(KEYS.auto, E.serialize(game)); } catch (e) { /* 저장 공간 부족 */ }
}

/* ---------- HUD ---------- */
function renderGame() {
  if (!game) return;
  if (!game.gameOver) E.checkVictory(game);
  const f = game.factions[game.playerId];
  const sum = E.factionSummary(game, game.playerId);
  const lord = GENERAL_BY_ID[f.lord];
  $('#hud-crest').textContent = f.hanja ? f.hanja[0] : f.name[0];
  $('#hud-crest').style.background = f.color;
  $('#hud-crest').style.color = '#10131a';
  $('#hud-faction').textContent = `${f.name}군${lord && lord.ko !== f.name ? ' · ' + lord.ko : ''}`;
  $('#hud-date').textContent = `${game.year}년 ${game.month}월 · 제${game.turn}턴`;
  $('#res-gold').textContent = fmt(sum.gold);
  $('#res-food').textContent = fmt(sum.food);
  $('#res-troops').textContent = fmt(sum.troops);
  $('#res-fame').textContent = Math.round(f.fame);
  $('#res-ap').textContent = `${game.actionPoints}/${game.maxActionPoints}`;
  $('#turn-hint').textContent = `명령 ${game.actionPoints}`;
  $('#btn-endturn').disabled = !!game.gameOver;


  renderCityPanel();
  if (mapView) {
    mapView.setState(game);
    mapView.setSelected(selectedCity);
  }
  if (game.gameOver) setTimeout(showEnding, 350);
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
  openSheet('군보(軍報)', rows || '<p class="note">아직 기록이 없습니다.</p>');
}

/* ---------- 도시 패널 ---------- */
function selectCity(id) {
  if (id !== selectedCity) cityPanelOpen = false;
  selectedCity = id;
  sfx.select();
  if (mapView) { mapView.setSelected(id); }
  renderCityPanel();
}

function renderCityPanel() {
  const panel = $('#citypanel');
  if (!selectedCity) { panel.classList.add('hidden'); return; }
  const c = game.cities[selectedCity];
  const base = CITY_BY_ID[selectedCity];
  const mine = c.owner === game.playerId;
  const ownerName = c.owner ? fname(c.owner) : '재야';
  const gens = mine ? E.generalsInCity(game, selectedCity) : Object.values(game.generals).filter((g) => g.city === selectedCity && g.faction === c.owner && !g.captive);
  const genHTML = gens.slice(0, 12).map((g) => {
    const t = GENERAL_BY_ID[g.id];
    return `<div class="gen-chip ${g.acted ? 'done' : ''}" title="${t.ko}">
      <img src="${portraitURL(g.id, t, 32, colorOf(g.faction))}" alt="${t.ko}" />
      <span>${t.ko}</span></div>`;
  }).join('');

  let cmdHTML = '';
  if (mine) {
    const acts = [
      ['agri', '개발'], ['comm', '상업'], ['order', '치안'], ['water', '수리'],
      ['draft', '징병', '2령'], ['train', '훈련'], ['search', '탐색'], ['hire', '등용'],
      ['reward', '포상'], ['transport', '수송'],
    ];
    cmdHTML = acts.map(([k, ko, sub]) => `<button class="btn" data-act="cmd" data-cmd="${k}" data-city="${selectedCity}">${ko}${sub ? `<small>${sub}</small>` : ''}</button>`).join('');
    const enemies = E.adjacentEnemies(game, selectedCity);
    cmdHTML += enemies.length
      ? `<button class="btn march" data-act="march" data-city="${selectedCity}">출진</button>`
      : '<button class="btn" disabled>출진</button>';
  } else {
    const src = E.adjacentFriends(game, selectedCity).filter((id) => E.generalsInCity(game, id).length);
    cmdHTML = src.length
      ? `<button class="btn march" data-act="attack-enemy" data-city="${selectedCity}" style="grid-column:span 2">공격</button>`
      : '<button class="btn" disabled style="grid-column:span 2">공격 불가</button>';
  }

  panel.classList.remove('hidden');
  panel.classList.toggle('open', cityPanelOpen);
  panel.innerHTML = `
    <div class="cs-head">
      <div class="cs-row">
        <div class="cs-id"><span class="region-tag">${base.region}</span><b class="cs-name">${base.ko}</b><small class="cs-hanja">${base.hanja}</small></div>
        <span class="cs-owner" style="color:${colorOf(c.owner)}">${ownerName}</span>
        <div class="cs-actions">
          <button class="cs-toggle" data-act="city-toggle">${cityPanelOpen ? '접기 ▾' : '명령 ▴'}</button>
          <button class="cs-close" data-act="close-city" aria-label="닫기">✕</button>
        </div>
      </div>
      <div class="cs-brief">
        <span>병 <b>${fmt(c.troops)}</b></span><span>금 <b>${fmt(c.gold)}</b></span><span>량 <b>${fmt(c.food)}</b></span><span>방 <b>${c.def}</b></span>
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
      <div class="cp-cmds">${cmdHTML}</div>
    </div>
  `;
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
  const t = GENERAL_BY_ID[g.id];
  const done = g.acted || g.captive;
  return `<button class="officer-row ${done ? 'done' : ''}" data-act="${actionAct}" data-officer="${g.id}" ${done ? 'disabled' : ''}>
    <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
    <div class="or-main">
      <div class="or-name">${t.ko}<small>${t.hanja}</small> <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
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
      const t = GENERAL_BY_ID[g.id];
      return `<button class="officer-row" data-act="do-hire" data-officer="${g.id}" data-city="${cityId}">
        <img src="${portraitURL(g.id, t, 40, '#444')}" alt="${t.ko}" />
        <div class="or-main"><div class="or-name">${t.ko}<small>${t.hanja}</small> <span class="or-tag">${t.arms}·${skillName(t.skill)}</span></div>
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
      const t = GENERAL_BY_ID[g.id];
      return `<button class="officer-row" data-act="do-reward" data-officer="${g.id}" data-city="${cityId}">
        <img src="${portraitURL(g.id, t, 40, colorOf(g.faction))}" alt="${t.ko}" />
        <div class="or-main"><div class="or-name">${t.ko}<small>${t.hanja}</small></div>
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
      const t = GENERAL_BY_ID[g.id];
      const on = p.generals.includes(g.id);
      return `<button class="pick-chip ${on ? 'on' : ''}" data-act="march-gen" data-officer="${g.id}">${t.ko} <b style="color:#9c9270">무${t.war}</b></button>`;
    }).join('')}</div>
    <button class="btn big" data-act="march-go" style="margin-top:14px" ${p.generals.length ? '' : 'disabled'}>${CITY_BY_ID[p.targetId].ko}으로 출진 (${p.generals.length}부대)</button>
    <p class="note">전투에서는 부대별 이동·공격·계략과 일기토를 지휘합니다. 수비측은 성곽에서 시작합니다.</p>`;
}

function openAttackEnemySheet(enemyCityId) {
  const sources = E.adjacentFriends(game, enemyCityId).filter((id) => E.generalsInCity(game, id).length && game.cities[id].troops >= 1000);
  if (!sources.length) { toast('공격할 수 있는 인접 아군 성이 없습니다.'); sfx.fail(); return; }
  openSheet(`${CITY_BY_ID[enemyCityId].ko} 공격`, `<p class="note">어느 성에서 출진할지 고르세요.</p>
    ${sources.map((s) => `<button class="officer-row" data-act="march-from" data-city="${s}" data-to="${enemyCityId}">
      <img src="${portraitURL(Object.values(game.generals).find((g) => g.city === s && g.faction === game.playerId)?.id || game.factions[game.playerId].lord, GENERAL_BY_ID[game.factions[game.playerId].lord], 40, colorOf(game.playerId))}" alt="" />
      <div class="or-main"><div class="or-name">${CITY_BY_ID[s].ko}</div><div class="or-stats"><span>병력 <b>${fmt(game.cities[s].troops)}</b></span><span>장수 <b>${E.generalsInCity(game, s).length}</b></span></div></div>
      <div class="or-go">출진</div></button>`).join('')}`);
}

function startPlayerBattle() {
  const p = pendingSetup;
  const c = game.cities[p.cityId];
  const target = game.cities[p.targetId];
  const troops = Math.round(c.troops * p.ratio);
  const setup = {
    fromCityId: p.cityId, toCityId: p.targetId,
    attackerFaction: game.playerId, defenderFaction: target.owner,
    atkGenerals: p.generals, defGenerals: E.generalsInCity(game, p.targetId).map((g) => g.id),
    atkTroops: troops, defTroops: target.troops, defBonus: target.def,
  };
  closeSheet();
  beginBattle(setup, 'atk');
}

/* ---------- 전투 ---------- */
function beginBattle(setup, playerSide) {
  battle = B.createBattle({ ...setup, seed: (battleSeedCounter++), playerSide });
  battleSel = null; battleMode = null; battleBusy = false;
  lastBattleResult = null;
  show('scr-battle');
  setTimeout(resizeBattleCanvas, 20);
  renderBattle();
  sfx.battle();
  if (battle.phase !== battle.playerSide) enemyPhase();
}

function resizeBattleCanvas() {
  const c = $('#battle-canvas');
  if (!c) return;
  const wrap = c.parentElement;
  const cssW = Math.max(200, wrap.clientWidth - 16);
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
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0a1018';
  ctx.fillRect(0, 0, c.width, c.height);

  const reach = battleSel && battleMode === 'move' && battleSel.side === battle.playerSide ? B.reachable(battle, battleSel) : null;
  const atkTargets = battleSel && battleMode === 'attack' ? B.targetsFor(battle, battleSel) : [];
  const tacTargets = battleSel && battleMode && battleMode.startsWith('tactic:') ? battle.units.filter((u) => u.alive && (battleMode.endsWith('rally') || battleMode.endsWith('heal') ? u.side === battleSel.side : u.side !== battleSel.side) && B.dist(battleSel, u) <= 3) : [];

  for (const t of battle.grid) {
    const x = t.x * tile, y = t.y * tile;
    ctx.fillStyle = B.TERRAIN[t.t].color;
    ctx.fillRect(x, y, tile, tile);
    // 픽셀 텍스처
    if (t.t === 'forest') {
      ctx.fillStyle = 'rgba(20,50,20,0.7)';
      ctx.fillRect(x + tile * 0.25, y + tile * 0.3, 2, tile * 0.4);
      ctx.fillRect(x + tile * 0.6, y + tile * 0.5, 2, tile * 0.3);
    } else if (t.t === 'hill') {
      ctx.fillStyle = 'rgba(120,100,70,0.5)';
      ctx.fillRect(x + tile * 0.2, y + tile * 0.5, tile * 0.5, 2);
    } else if (t.t === 'water') {
      ctx.fillStyle = 'rgba(80,140,190,0.35)';
      ctx.fillRect(x + tile * 0.2, y + tile * 0.45, tile * 0.4, 1);
      ctx.fillRect(x + tile * 0.5, y + tile * 0.65, tile * 0.3, 1);
    } else if (t.t === 'castle') {
      ctx.fillStyle = '#6b6252';
      ctx.fillRect(x, y, tile, tile * 0.25);
      ctx.fillStyle = '#3a3528';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + i * tile / 3 + 2, y - 2, tile / 5, 4);
    }
    if (reach && reach.has(t.y * battle.w + t.x)) {
      ctx.fillStyle = 'rgba(90,170,230,0.28)';
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      ctx.strokeStyle = 'rgba(140,210,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
    }
    if (atkTargets.some((u) => u.x === t.x && u.y === t.y) || tacTargets.some((u) => u.x === t.x && u.y === t.y)) {
      ctx.strokeStyle = 'rgba(240,90,70,0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, tile, tile);
  }

  for (const u of battle.units) {
    if (!u.alive) continue;
    const x = u.x * tile, y = u.y * tile;
    const isPlayer = u.side === battle.playerSide;
    const col = isPlayer ? '#2f7fd0' : '#c0392b';
    const col2 = isPlayer ? '#7ec4ff' : '#ff9a8a';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 3, y + tile - 8, tile - 6, 4);
    ctx.fillStyle = col;
    ctx.fillRect(x + 2, y + 4, tile - 4, tile - 12);
    ctx.fillStyle = col2;
    ctx.fillRect(x + 2, y + 4, tile - 4, 3);
    // 병력 바
    const ratio = Math.max(0, Math.min(1, u.troops / 8000));
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x + 3, y + tile - 7, tile - 6, 3);
    ctx.fillStyle = ratio > 0.4 ? '#8ed18e' : '#e0a05a'; ctx.fillRect(x + 3, y + tile - 7, (tile - 6) * ratio, 3);
    // 이름
    ctx.fillStyle = '#0b0b0b';
    const fs = Math.max(7, Math.min(10, Math.floor(tile * 0.3)));
    ctx.font = `700 ${fs}px "Galmuri11", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(u.name, x + tile / 2, y + tile * 0.4);
    ctx.fillStyle = '#f4ecd2';
    ctx.fillText(u.name, x + tile / 2, y + tile * 0.4);
    ctx.font = `400 ${Math.max(6, fs - 2)}px "Galmuri11", system-ui, sans-serif`;
    ctx.strokeText(fmt(u.troops), x + tile / 2, y + tile * 0.64);
    ctx.fillStyle = '#cfe4ff';
    ctx.fillText(fmt(u.troops), x + tile / 2, y + tile * 0.64);
    if (battleSel === u) {
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
    }
    if (u.acted) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 2, y + 4, tile - 4, tile - 12);
    }
  }
  // 진형 표시
  if (battleSel) {
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `700 10px "Galmuri11", system-ui, sans-serif`;
  }
}

function unitCardHTML(u, selected) {
  const t = GENERAL_BY_ID[u.gid];
  return `<button class="pick-chip ${selected ? 'on' : ''} ${u.acted ? 'done' : ''}" data-act="bt-select" data-unit="${u.id}" style="opacity:${u.acted ? 0.5 : 1};padding:5px 7px">
    <span style="display:block;white-space:nowrap">${u.name}</span>
    <b style="font-size:10px;color:#9fd0a0;white-space:nowrap">${fmt(u.troops)}</b>
    <span style="font-size:9px;color:#b8ab84;white-space:nowrap">사기 ${Math.round(u.morale)}</span>
  </button>`;
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
  const info = battleSel
    ? `<b>${battleSel.name}</b> ${fmt(battleSel.troops)} · 사기 ${Math.round(battleSel.morale)} · ${B.formOf(battleSel).ko}${battleSel.acted ? ' · 완료' : ''}`
    : '';
  $('#bt-info').innerHTML = info;

  $('#bt-log').innerHTML = battle.log.slice(-40).map((l) => `<div>${l}</div>`).join('');
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
  const captured = res.capturedGenerals.map((g) => GENERAL_BY_ID[g].ko).join(', ');
  if (win) sfx.win(); else sfx.lose();

  // 엔진 반영
  E.applyBattleResult(game, res);
  autoSave();

  openSheet(win ? '승전' : '패전', `
    <div style="text-align:center;padding:8px 0 4px">
      <div style="font-size:30px;letter-spacing:4px;color:${win ? '#f5d97a' : '#e08a7a'}">${win ? '승리' : '패배'}</div>
      <p style="margin:8px 0;color:#cbbf9d">${battle.over === 'atk' ? CITY_BY_ID[battle.toCityId].ko + ' 함락' : CITY_BY_ID[battle.toCityId].ko + ' 공략 실패'}</p>
    </div>
    <p class="note">${summary} · ${res.rounds}라운드${captured ? '<br>사로잡은 장수: ' + captured : ''}</p>
    ${win && res.winner === 'attacker' ? `<p class="note">${CITY_BY_ID[battle.toCityId].ko}이(가) 우리 것이 되었습니다.</p>` : ''}
    <button class="btn big" data-act="bt-close" style="margin-top:12px">계속</button>
  `);
}

function closeBattle() {
  closeSheet();
  battle = null; battleSel = null; battleMode = null; battleBusy = false;
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

/* ---------- 일기토 ---------- */
function openDuel(target) {
  const mine = battleSel;
  if (!mine || !target) return;
  const gA = GENERAL_BY_ID[mine.gid];
  const gB = GENERAL_BY_ID[target.gid];
  duelCtx = { d: createDuel(gA, gB, Math.floor(Math.random() * 99999), { a: '아군', b: '적군' }), mine, target };
  $('#duel').classList.remove('hidden');
  sfx.duel();
  renderDuel();
}

function renderDuel() {
  const { d, mine, target } = duelCtx;
  const img = (gid, color) => `<img src="${portraitURL(gid, GENERAL_BY_ID[gid], 62, color)}" alt="" />`;
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

/* ---------- 메뉴/저장 ---------- */
function openMenu() {
  openSheet('군의(軍議)', `
    <button class="btn big" data-act="save-slot" data-slot="1" style="margin-bottom:8px">슬롯 1에 저장</button>
    <button class="btn big" data-act="save-slot" data-slot="2" style="margin-bottom:8px">슬롯 2에 저장</button>
    <button class="btn big" data-act="save-slot" data-slot="3" style="margin-bottom:8px">슬롯 3에 저장</button>
    <button class="btn big ghost" data-act="open-load" style="margin-bottom:8px">불러오기</button>
    <button class="btn big ghost" data-act="open-reports" style="margin-bottom:8px">군보(軍報)</button>
    <button class="btn big ghost" data-act="open-rank" style="margin-bottom:8px">세력 순위</button>
    <button class="btn big ghost" data-act="open-help" style="margin-bottom:8px">게임 방법</button>
    <button class="btn big ghost" data-act="to-title">타이틀로</button>
  `);
}

function openLoad() {
  const rows = [];
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
    <b style="color:#e6d9b3">2. 달마다</b> — 행동력(令)만큼 명령을 내립니다. 장수는 한 달에 한 번만 움직입니다.<br>
    <b style="color:#e6d9b3">3. 내정</b> — 개발(농업)·상업·치안·수리로 성을 키우고, 징병·훈련으로 군세를 만듭니다.<br>
    <b style="color:#e6d9b3">4. 인사</b> — 탐색으로 인재를 찾고 등용합니다. 포상으로 충성을 올립니다.<br>
    <b style="color:#e6d9b3">5. 출진</b> — 인접한 적 성을 공격합니다. 전장에서 부대를 움직여 성을 함락시키세요.<br>
    <b style="color:#e6d9b3">6. 진형</b> — 어린(공격)·방원(방어)·학익(원거리)·봉시(돌격) 등 9종. 부대의 진형에 따라 공격·방어·사거리가 달라집니다.<br>
    <b style="color:#e6d9b3">7. 계략</b> — 지력이 높은 장수는 화계·혼란·고무·치료를 씁니다.<br>
    <b style="color:#e6d9b3">8. 일기토</b> — 인접한 적 장수에게 1:1 대결을 걸 수 있습니다. 이기면 적 부대 사기가 급락합니다.<br>
    <b style="color:#e6d9b3">9. 저장</b> — 매 명령마다 자동 저장되며, 슬롯 3개에 수동 저장할 수 있습니다.
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
    <div class="end-hanja">${win ? '天下統一' : '群雄割據'}</div>
    <div class="end-title">${win ? '천하통일' : '낙일(落日)'}</div>
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
    case 'back-title': show('scr-title'); drawTitleArt(); break;
    case 'back-scenario': renderScenarios(); show('scr-scenario'); break;
    case 'pick-scenario': renderLords(el.dataset.id); show('scr-lord'); break;
    case 'pick-lord': startGame(el.dataset.sc, el.dataset.id); break;
    case 'jump-region': {
      closeSheet();
      if (el.dataset.region === '__mine') {
        const mine = E.factionCities(game, game.playerId);
        if (mine.length) { cityPanelOpen = false; selectedCity = mine[0].id; mapView.focusCity(selectedCity); mapView.setSelected(selectedCity); renderCityPanel(); }
      } else {
        mapView.focusRegion(el.dataset.region);
      }
      break;
    }
    case 'region-menu': sfx.click(); openRegionMenu(); break;
    case 'open-reports': sfx.click(); openReports(); break;
    case 'city-toggle': cityPanelOpen = !cityPanelOpen; sfx.click(); renderCityPanel(); break;
    case 'zoom-in': mapView.zoomBy(1.25); break;
    case 'zoom-out': mapView.zoomBy(0.8); break;
    case 'zoom-reset': mapView.resetView(); break;
    case 'endturn': endTurn(); break;
    case 'close-city': selectedCity = null; cityPanelOpen = false; mapView.setSelected(null); renderCityPanel(); break;
    case 'cmd': openCommandSheet(el.dataset.cmd, el.dataset.city); break;
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
    case 'march-go': startPlayerBattle(); break;
    case 'sheet-close': closeSheet(); break;
    case 'menu': openMenu(); break;
    case 'open-load': openLoad(); break;
    case 'open-rank': openRank(); break;
    case 'open-help': openHelp(); break;
    case 'save-slot': {
      const slot = el.dataset.slot;
      try { localStorage.setItem(KEYS.slot(slot), E.serialize(game)); toast(`슬롯 ${slot}에 저장했습니다.`); sfx.ok(); }
      catch (err) { toast('저장 실패'); }
      break;
    }
    case 'do-load': doLoad(el.dataset.slot); break;
    case 'to-title': closeSheet(); $('#duel').classList.add('hidden'); show('scr-title'); drawTitleArt(); break;
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
        const t = GENERAL_BY_ID[u.gid];
        return `<button class="officer-row" data-act="bt-duel-go" data-unit="${u.id}">
          <img src="${portraitURL(u.gid, t, 40, '#8c2f24')}" alt="" />
          <div class="or-main"><div class="or-name">${t.ko}<small>${t.hanja}</small></div>
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
  $('#btn-continue').disabled = !localStorage.getItem(KEYS.auto);
  $('#map') && $('#map').addEventListener('pointerdown', () => sfx.unlock(), { once: true });
  const bc = $('#battle-canvas');
  bc && bc.addEventListener('click', (e) => { if (battle) battleTap(e.clientX, e.clientY); });
  window.addEventListener('resize', () => {
    if (mapView) mapView.resize();
    if (!$('#scr-battle').classList.contains('hidden')) resizeBattleCanvas();
    if (!$('#scr-title').classList.contains('hidden')) drawTitleArt();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheet(); }
  });
  renderScenarios();
  show('scr-title');
  drawTitleArt();
  setTimeout(drawTitleArt, 100);
  setTimeout(() => { if (!$('#scr-title').classList.contains('hidden')) drawTitleArt(); }, 500);
}

export { game };
