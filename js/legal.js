/* legal.js — 개인정보처리방침 · 이용약관 (앱 안 모달)
   · ☰ 메뉴에서 열고, 읽기 편한 전체 화면 모달로 보여 준다.
   · 문구는 이 파일 한 곳에 모아 두어 화면과 검사가 같은 내용을 본다.
   · 서비스 이름은 「삼국 한 턴」, 로그인은 Google·카카오, 저장은 브라우저와 클라우드(Supabase).
   · 한자는 쓰지 않는다. */

export const LEGAL_META = {
  service: '삼국 한 턴',
  effective: '2026년 11월 24일',
  operator: '이상훈',
  contact: 'andy.leesh33@gmail.com',
};

const CONTACT_TAIL = '문의: andy.leesh33@gmail.com';

export const LEGAL_DOCS = {
  privacy: {
    key: 'privacy',
    title: '개인정보처리방침',
    lead: '「삼국 한 턴」은 로그인 없이 바로 즐기는 무료 웹 전략 게임입니다. 로그인하지 않으면 게임 기록은 이용자의 브라우저(로컬 저장소)에만 남고 운영자에게 전송되지 않습니다. Google·카카오·Apple 로그인은 기기를 바꿔도 이어서 하고 싶을 때만 선택하는 기능입니다. 아이폰 앱에서는 Apple 로그인을 앱 안에서 바로 할 수 있습니다.',
    sections: [
      {
        h: '1. 수집하는 개인정보 항목',
        rows: [
          {
            k: 'Google 로그인 (선택)',
            v: '계정 식별자, 이메일 주소, 이름, 프로필 사진 주소 — 이용자가 로그인 버튼을 눌러 동의한 때',
          },
          {
            k: '카카오 로그인 (선택)',
            v: '카카오 계정 식별자, 닉네임, 프로필 사진 주소, 동의한 경우 이메일 주소 — 로그인 버튼을 눌러 동의한 때',
          },
          {
            k: 'Apple 로그인 (선택, iOS 앱)',
            v: 'Apple 계정 식별자, 이메일 주소(이메일 가리기를 고르면 Apple의 비공개 이메일 주소), 이름 — Apple로 로그인하기를 눌러 동의한 때',
          },
          {
            k: '게임 기록 (로그인 시)',
            v: '진행 중인 게임 상태(세력·성·장수·금·식량·공적·저장 시각), 자동 저장과 슬롯 1~3 — 저장할 때마다 자동',
          },
          {
            k: '브라우저 저장 (로그인 전)',
            v: '게임 기록과 소리 설정 — 이 기기의 브라우저에만 남고 서버로 보내지 않습니다',
          },
        ],
        p: ['주민등록번호, 전화번호, 주소, 결제 정보는 수집하지 않습니다. 비밀번호도 받지 않습니다(로그인은 Google·카카오·Apple 계정으로만 합니다).'],
      },
      {
        h: '2. 이용 목적',
        items: [
          '게임 진행 상황과 저장 슬롯을 기기 사이에서 이어 주기 위해',
          '로그인한 본인만 자기 기록을 읽고 쓸 수 있게 하기 위해(접근 권한 확인)',
          '로그인 상태를 유지하고, 저장이 제대로 올라갔는지 확인하기 위해',
        ],
      },
      {
        h: '3. 보유 및 이용 기간',
        items: [
          '로그인 계정 정보와 클라우드 게임 기록: 이용자가 삭제를 요청할 때까지',
          '삭제를 요청하시면 지체 없이(영업일 기준 7일 이내) 파기합니다',
          '브라우저에 저장된 기록: 이용자가 브라우저 설정에서 사이트 데이터를 지우면 즉시 사라지며, 운영자는 이를 보관하지 않습니다',
        ],
      },
      {
        h: '4. 처리 위탁 및 국외 이전',
        p: ['서비스 운영을 위해 아래 사업자에게 처리를 위탁하며, 해당 정보는 표에 적힌 나라에 저장됩니다. 이전 방법은 서비스 이용 시점의 네트워크 전송입니다.'],
        rows: [
          { k: 'Supabase, Inc. (미국)', v: '로그인 인증과 게임 기록 데이터베이스 보관 — 계정 식별자, 이메일, 이름, 게임 기록' },
          { k: 'Vercel, Inc. (미국)', v: '웹사이트 호스팅 — 접속 기록(IP 주소 등 서버 로그)' },
          { k: 'Google LLC (미국)', v: 'Google 계정 로그인 — 로그인할 때 Google이 제공하는 이메일·이름·프로필 사진' },
          { k: '주식회사 카카오 (대한민국)', v: '카카오 계정 로그인 — 로그인할 때 카카오가 제공하는 계정 식별자·닉네임·프로필 사진' },
          { k: 'Apple Inc. (미국)', v: 'Apple 계정 로그인(iOS 앱) — 로그인할 때 Apple이 제공하는 계정 식별자·이메일·이름' },
        ],
      },
      {
        h: '5. 제3자 제공',
        p: ['이용자의 개인정보를 위 4항의 처리 위탁 범위를 넘어 다른 사람이나 회사에 제공하지 않습니다. 다만 법령에 따라 수사기관 등이 적법하게 요청하는 경우에는 그 범위에서 제공할 수 있습니다.'],
      },
      {
        h: '6. 이용자의 권리',
        items: [
          '화면의 로그아웃으로 언제든지 클라우드 연결을 끊을 수 있습니다',
          '로그인한 뒤 군의 메뉴의 「계정 · 클라우드 기록 삭제」로 클라우드 기록과 이 기기의 저장을 직접 지울 수 있습니다',
          '개인정보의 열람·정정·삭제·처리 정지를 아래 문의처로 요청할 수 있습니다',
          '브라우저의 사이트 데이터 삭제로 기기에 저장된 기록을 직접 지울 수 있습니다',
        ],
      },
      {
        h: '7. 쿠키 및 로컬 저장소',
        p: ['이 서비스는 맞춤형 광고나 방문자 분석을 위한 쿠키를 사용하지 않습니다. 게임 진행과 로그인 상태를 유지하기 위해 브라우저의 로컬 저장소에 기록을 저장합니다. 이 값은 서버로 보내지지 않으며, 로그인한 경우에만 게임 기록이 위 4항의 데이터베이스에 함께 저장됩니다.'],
      },
      {
        h: '8. 광고',
        p: ['현재 서비스에는 광고를 넣지 않았습니다. 광고를 넣게 되면 광고 사업자, 맞춤형 광고 여부, 사용하는 쿠키와 식별자를 이 방침에 먼저 적고 시행합니다.'],
      },
      {
        h: '9. 만 14세 미만 아동',
        p: ['이 서비스는 만 14세 미만 아동을 주 이용자로 하지 않습니다. 만 14세 미만 아동이 로그인하는 경우 법정대리인의 동의가 필요하며, 동의 없이 수집된 사실이 확인되면 지체 없이 파기합니다.'],
      },
      {
        h: '10. 안전성 확보 조치',
        items: [
          '로그인한 이용자는 자기 기록만 읽고 쓸 수 있도록 데이터베이스 수준에서 접근을 제한합니다',
          '모든 통신은 HTTPS로 암호화합니다',
          '운영자는 이용자의 비밀번호를 보관하지 않습니다(Google·카카오·Apple 로그인만 사용)',
        ],
      },
      {
        h: '11. 개인정보 보호책임자 및 문의',
        rows: [
          { k: '책임자', v: '이상훈 (운영자)' },
          { k: '문의', v: 'andy.leesh33@gmail.com' },
        ],
      },
      {
        h: '12. 고지 의무',
        p: ['이 방침의 내용이 추가·삭제·수정되면 시행 7일 전부터 이 화면에 알립니다. 다만 이용자에게 불리한 변경은 30일 전에 알립니다.'],
      },
    ],
    foot: `시행일 ${LEGAL_META.effective} · ${LEGAL_META.service} · ${CONTACT_TAIL}`,
  },

  terms: {
    key: 'terms',
    title: '이용약관',
    lead: '「삼국 한 턴」은 삼국 시대를 배경으로 달마다 명령을 내리며 성을 넓혀 가는 무료 웹 전략 게임입니다. 설치 없이 브라우저에서 바로 시작할 수 있습니다.',
    sections: [
      {
        h: '1. 서비스 소개',
        p: ['전국 42개 성을 두고 세력과 겨루는 턴제 전략 게임으로, 내정·외교·전투·장수 육성을 즐길 수 있습니다. 로그인 없이도 모든 기능을 쓸 수 있고, Google·카카오·Apple 로그인은 기기를 바꿔도 이어서 하기 위한 선택 기능입니다.'],
      },
      {
        h: '2. 약관의 효력',
        p: ['이 약관은 서비스 화면에 게시함으로써 효력이 생깁니다. 운영자는 필요한 경우 약관을 바꿀 수 있으며, 바뀐 약관은 시행 7일 전부터 이 화면에 알립니다. 이용자에게 불리한 변경은 30일 전에 알립니다.'],
      },
      {
        h: '3. 계정과 로그인',
        items: [
          '로그인은 Google·카카오 또는 Apple 계정으로만 하며, 운영자는 비밀번호를 받거나 보관하지 않습니다',
          '로그인 계정의 관리(비밀번호, 2단계 인증 등)는 이용자의 몫입니다',
          '로그아웃하면 이 기기에서 클라우드 연결이 끊기며, 이미 저장된 기록은 남습니다',
          '로그인한 뒤 「계정 · 클라우드 기록 삭제」로 계정의 클라우드 기록과 이 기기의 저장을 직접 지울 수 있으며, 지운 기록은 되돌릴 수 없습니다',
        ],
      },
      {
        h: '4. 게임 기록의 저장',
        items: [
          '로그인하지 않으면 진행 상황은 이 브라우저에만 저장됩니다',
          '로그인하면 같은 기록이 클라우드에도 저장되어 다른 기기에서 이어집니다',
          '두 기기의 기록은 저장 시각이 더 최신인 쪽을 남기고, 한쪽에만 있는 슬롯은 지우지 않습니다',
          '브라우저 데이터를 지우거나 기기를 바꾸면 로그인하지 않은 기록은 사라질 수 있습니다',
        ],
      },
      {
        h: '5. 이용자의 의무',
        p: ['다음 행위는 하지 말아 주세요. 운영자는 서비스 운영을 위해 필요한 경우 이용을 제한할 수 있습니다.'],
        items: [
          '자동화된 프로그램으로 과도한 요청을 보내 서비스 운영을 방해하는 행위',
          '서비스의 취약점을 악용하거나 다른 이용자의 기록에 접근하려는 행위',
          '서비스의 이름이나 화면을 그대로 복제해 다른 서비스로 오인하게 하는 행위',
        ],
      },
      {
        h: '6. 지식재산권',
        p: ['삼국 시대의 역사와 인물은 역사적 사실에 바탕을 둔 것으로 누구나 다룰 수 있습니다. 다만 게임의 규칙·수치·이야기·그림·연출·코드 등 서비스가 제공하는 콘텐츠의 권리는 운영자에게 있습니다. 개인적으로 즐기거나 소개하는 것은 자유롭게 해 주세요. 복제·배포·판매 등 상업적 이용은 운영자의 허락이 필요합니다.'],
      },
      {
        h: '7. 서비스의 변경과 중단',
        p: ['서비스는 무료로 제공되며, 운영자는 점검·개선·운영상 필요에 따라 내용을 바꾸거나 잠시 멈출 수 있습니다. 서비스를 끝내게 되면 미리 이 화면에 알리고, 클라우드에 저장된 기록의 삭제 방법을 안내합니다.'],
      },
      {
        h: '8. 책임의 범위',
        items: [
          '게임의 수치와 역사적 묘사는 오락을 위한 창작이며, 실제 역사나 조언과 다를 수 있습니다',
          '천재지변, 통신 장애, 제3자 서비스(Supabase·Vercel·Google·카카오 등)의 장애처럼 운영자가 통제하기 어려운 사유로 생긴 손해에 대해서는 책임을 지지 않습니다',
          '운영자의 고의 또는 중대한 과실이 있는 경우에는 그러하지 않습니다',
        ],
      },
      {
        h: '9. 준거법 및 분쟁',
        p: ['이 약관은 대한민국 법률에 따릅니다. 서비스 이용과 관련해 분쟁이 생기면 운영자와 이용자가 성실히 협의하고, 협의가 되지 않으면 관할 법원의 판단에 따릅니다.'],
      },
      {
        h: '10. 문의',
        rows: [
          { k: '운영자', v: '이상훈' },
          { k: '문의', v: 'andy.leesh33@gmail.com' },
        ],
      },
    ],
    foot: `시행일 ${LEGAL_META.effective} · ${LEGAL_META.service} · ${CONTACT_TAIL}`,
  },
};

export function legalDoc(kind) {
  return LEGAL_DOCS[kind] || LEGAL_DOCS.privacy;
}

/** 웹 페이지(privacy.html·terms.html)가 같은 문구를 그대로 그릴 때 쓴다 */
export function legalDocHTML(kind) {
  const doc = legalDoc(kind);
  return {
    title: doc.title,
    meta: `${LEGAL_META.service} · 시행일 ${LEGAL_META.effective}`,
    foot: doc.foot,
    html: docHTML(doc),
  };
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ensureStyle() {
  if (document.getElementById('legal-style')) return;
  const st = document.createElement('style');
  st.id = 'legal-style';
  st.textContent = `
    .legal { position: fixed; inset: 0; z-index: 140; display: flex; align-items: center; justify-content: center;
      padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom));
      background: radial-gradient(120% 90% at 50% 40%, rgba(26,16,8,0.78) 0%, rgba(4,3,2,0.95) 80%);
      animation: legalIn 0.16s ease-out; -webkit-tap-highlight-color: transparent; }
    .legal-box { width: min(96vw, 440px); max-height: 88vh; display: flex; flex-direction: column;
      border-radius: 10px; overflow: hidden; border: 1px solid #8a6532; background: #171009;
      box-shadow: 0 0 0 1px rgba(255,190,120,0.08), 0 20px 60px rgba(0,0,0,0.75), 0 0 44px rgba(200,120,40,0.14);
      animation: legalPop 0.2s cubic-bezier(.2,1.2,.5,1); }
    .legal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 11px 12px; border-bottom: 1px solid rgba(217,160,90,0.24);
      background: linear-gradient(180deg, #3a2a1a, #241a11); }
    .legal-head h2 { margin: 0; font-family: var(--font-head); font-size: 15px; color: var(--gold-hi, #ffe3ae);
      letter-spacing: 2px; font-weight: 600; text-shadow: 0 1px 2px #000; }
    .legal-close { width: 30px; height: 30px; flex: 0 0 auto; border-radius: 3px; border: 1px solid #6b4b28;
      background: linear-gradient(180deg, #3b2b1a, #21170e); color: #e8d3ab; font-size: 13px; line-height: 1; }
    .legal-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;
      padding: 12px 13px 14px; }
    .legal-meta { font-size: 10px; color: #9c8a70; letter-spacing: 0.3px; margin-bottom: 8px; }
    .legal-lead { margin: 0 0 12px; padding: 9px 10px; font-size: 11.5px; line-height: 1.75; color: #efe2c6;
      border-radius: 3px; background: linear-gradient(180deg, #241c13, #191209); border: 1px solid #3d2c1c;
      border-left: 2px solid #b47c36; }
    .legal-sec { margin: 0 0 13px; }
    .legal-sec h3 { margin: 0 0 5px; font-size: 12px; font-weight: 700; color: #ffd79a; letter-spacing: 0.3px; }
    .legal-sec p { margin: 0 0 6px; font-size: 11.5px; line-height: 1.78; color: #d8c9ab; }
    .legal-sec ul { margin: 0; padding-left: 14px; }
    .legal-sec li { font-size: 11.5px; line-height: 1.75; color: #d8c9ab; margin-bottom: 3px; }
    .legal-sec li::marker { color: #b47c36; }
    .legal-rows { display: flex; flex-direction: column; gap: 4px; }
    .legal-row { font-size: 11.5px; line-height: 1.65; color: #cdbd9e; padding: 6px 8px; border-radius: 3px;
      background: rgba(40,30,19,0.6); border: 1px solid rgba(120,90,52,0.35); }
    .legal-row b { display: block; color: #ecd5a8; font-weight: 600; font-size: 11px; margin-bottom: 1px; }
    .legal-foot { flex: 0 0 auto; padding: 9px 12px calc(9px + env(safe-area-inset-bottom));
      border-top: 1px solid rgba(217,160,90,0.2); background: linear-gradient(180deg, rgba(30,21,13,0.9), #171009);
      display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .legal-foot span { font-size: 9.5px; color: #8f7d63; line-height: 1.5; }
    .legal-foot .btn { flex: 0 0 auto; }
    .legal-foot .legal-close { display: inline-flex; align-items: center; justify-content: center;
      width: auto; min-width: 66px; height: 34px; padding: 0 14px; font-size: 12px; line-height: 1;
      letter-spacing: 1px; white-space: nowrap; font-family: inherit; }
    @keyframes legalIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes legalPop { from { transform: translateY(10px) scale(0.985); opacity: 0.6; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .legal, .legal-box { animation: none; } }
  `;
  document.head.appendChild(st);
}

function docHTML(doc) {
  const secs = doc.sections.map((s) => {
    const rows = s.rows && s.rows.length
      ? `<div class="legal-rows">${s.rows.map((r) => `<div class="legal-row"><b>${esc(r.k)}</b>${esc(r.v)}</div>`).join('')}</div>`
      : '';
    const items = s.items && s.items.length
      ? `<ul>${s.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
      : '';
    const paras = (s.p || []).map((t) => `<p>${esc(t)}</p>`).join('');
    return `<section class="legal-sec"><h3>${esc(s.h)}</h3>${paras}${items}${rows}</section>`;
  }).join('');
  return `
    <div class="legal-meta">${esc(LEGAL_META.service)} · 시행일 ${esc(LEGAL_META.effective)}</div>
    <p class="legal-lead">${esc(doc.lead)}</p>
    ${secs}
    <p class="legal-meta" style="margin:10px 0 0">${esc(doc.foot)}</p>`;
}

let el = null;
let onKey = null;

export function legalOpen() {
  return !!el;
}

export function closeLegal() {
  if (!el) return;
  const node = el;
  el = null;
  if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
  node.remove();
}

/** kind: 'privacy' | 'terms' */
export function openLegal(kind) {
  if (typeof document === 'undefined') return null;
  ensureStyle();
  closeLegal();
  const doc = legalDoc(kind);
  const root = document.createElement('div');
  root.className = 'legal';
  root.id = 'legal';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', doc.title);
  root.innerHTML = `
    <div class="legal-box">
      <div class="legal-head">
        <h2>${esc(doc.title)}</h2>
        <button type="button" class="legal-close" aria-label="닫기">✕</button>
      </div>
      <div class="legal-body">${docHTML(doc)}</div>
      <div class="legal-foot">
        <span>${esc(LEGAL_META.service)} · ${esc(LEGAL_META.effective)} 시행</span>
        <button type="button" class="btn small ghost legal-close">닫기</button>
      </div>
    </div>`;
  root.addEventListener('click', (e) => {
    if (e.target === root) { closeLegal(); return; }
    const btn = e.target.closest('.legal-close');
    if (btn) { e.preventDefault(); e.stopPropagation(); closeLegal(); }
  });
  onKey = (e) => { if (e.key === 'Escape' && el) { e.stopPropagation(); closeLegal(); } };
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(root);
  el = root;
  const body = root.querySelector('.legal-body');
  if (body) body.scrollTop = 0;
  const btn = root.querySelector('.legal-close');
  if (btn) btn.focus({ preventScroll: true });
  return root;
}
