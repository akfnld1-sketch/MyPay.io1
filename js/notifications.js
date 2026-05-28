// 배경색 24종 순환 (빈 공간 터치/클릭 시)
// ══════════════════════════════════════════
const BG_COLORS = [
  // ── 흰색/밝은색 (기본) ──
  { bg:'#ffffff', name:'흰색 (기본)',        dark:false },
  { bg:'#f5f5f5', name:'소프트 화이트',      dark:false },
  { bg:'#fef9f0', name:'크림 화이트',        dark:false },
  { bg:'#e8f4f8', name:'아이스 블루',        dark:false },
  { bg:'#f0f4e8', name:'민트 크림',          dark:false },
  { bg:'#fdf0f8', name:'블러쉬 핑크',        dark:false },
  { bg:'#f0f0ff', name:'라벤더 미스트',      dark:false },
  { bg:'#fff8e8', name:'버터 옐로우',        dark:false },
  { bg:'#e8fff4', name:'민트 그린',          dark:false },
  { bg:'#ffe8e8', name:'로즈 쿼츠',          dark:false },
  { bg:'#e8eeff', name:'페리윙클',           dark:false },
  { bg:'#e8f8e8', name:'라임 화이트',        dark:false },
  { bg:'#fff0e8', name:'피치 크림',          dark:false },
  // ── 미디엄 ──
  { bg:'#5b8a8b', name:'틸 세이지',          dark:false },
  { bg:'#7b6fa0', name:'소프트 퍼플',        dark:false },
  { bg:'#6b8f71', name:'세이지 그린',        dark:false },
  { bg:'#8b7355', name:'웜 샌드',            dark:false },
  // ── 다크 ──
  { bg:'#0d0f14', name:'미드나잇 블랙',      dark:true  },
  { bg:'#0d1b2a', name:'딥 오션',            dark:true  },
  { bg:'#1a0a2e', name:'딥 바이올렛',        dark:true  },
  { bg:'#0a2e1a', name:'딥 에메랄드',        dark:true  },
  { bg:'#2e0a0a', name:'딥 크림슨',          dark:true  },
  { bg:'#1a1a2e', name:'코스믹 블루',        dark:true  },
  { bg:'#16213e', name:'딥 스페이스',        dark:true  },
  { bg:'#0f3460', name:'로열 네이비',        dark:true  },
  { bg:'#1b2838', name:'스팀 그레이',        dark:true  },
  { bg:'#1a1a1a', name:'그래파이트',         dark:true  },
  { bg:'#162032', name:'스틸 블루',          dark:true  },
  { bg:'#201232', name:'인디고 나이트',      dark:true  },
  { bg:'#2d4a22', name:'올리브 그린',        dark:true  },
  { bg:'#4a2222', name:'다크 로즈',          dark:true  },
  { bg:'#22334a', name:'슬레이트 블루',      dark:true  },
  { bg:'#3d2b4a', name:'다크 라벤더',        dark:true  },
];

let bgIdx = 0;

// ── INIT ──
initMultiEmp();   // ★ v11: 사업장/직원 초기화 (마이그레이션 포함)
lsLoad();
// 초기 로드 시 현재 월 공휴일 자동 적용
autoApplyHolidays(curY, curM);

// 주간/야간 시작시간 select 옵션 생성 및 초기값 설정
function initStartSelects(){
  const dSel = document.getElementById('day-start-sel');
  const nSel = document.getElementById('night-start-sel');
  if(!dSel||!nSel) return;
  dSel.innerHTML=''; nSel.innerHTML='';
  for(let h=0;h<24;h++){
    const opt1 = document.createElement('option');
    opt1.value=h; opt1.textContent=pad2(h)+':00';
    if(h===dayStart) opt1.selected=true;
    dSel.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value=h; opt2.textContent=pad2(h)+':00';
    if(h===nightStart) opt2.selected=true;
    nSel.appendChild(opt2);
  }
}
initStartSelects();
document.getElementById('lunch-inp').value = lunchBreak;
document.querySelectorAll('.wt-btn').forEach(b=>b.classList.remove('active'));
document.getElementById('wt-'+wt).classList.add('active');
updateLegend();
renderCalendar();
// ★ v11: 직원 스위처 초기 렌더링
updateEmpSwitcher();
// ── 현재 근무유형 아코디언 열기 ──
openAccForWT(wt);
// ── 직업유형 UI 적용 ──
applyJobTypeUI();
// ── 직장인 모드 고정 (설정창에서 변경 가능) ──
if(!localStorage.getItem('atm2_jobType')) localStorage.setItem('atm2_jobType','employee');
// ── 알람 틱 시작 ──
startAlarmTick();
requestNotifPermission();

// ══════════════════════════════════════════════════════════════
// 🔔 스마트 알림 시스템 v1.0
// - 지출 예산 초과 알림
// - 주간 과로 감지 알림 (40h+)
// - 급여일 D-3 / D-1 알림
// - 출근 예정 알림 (등록된 근무 30분 전)
//
// PWA 확장 준비: _smartNotif_pwa_ready 플래그 true 시
//   Service Worker pushManager 등록으로 전환 가능
// ══════════════════════════════════════════════════════════════

const _smartNotif_pwa_ready = false; // 추후 PWA 전환 시 true로 변경

// 알림 상태 저장 키
const SMART_NOTIF_KEY = 'atm2_smart_notif_v1';

function smartNotifLoad() {
  try {
    const raw = localStorage.getItem(SMART_NOTIF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function smartNotifSave(state) {
  try { localStorage.setItem(SMART_NOTIF_KEY, JSON.stringify(state)); } catch(e) {}
}

/**
 * 스마트 알림 전용 fireNotif
 * type: 'budget' | 'overwork' | 'payday' | 'commute'
 */
// ══════════════════════════════════════════════════════════════
// 🔊 알림 사운드 (Web Audio API — 파일 불필요)
// ══════════════════════════════════════════════════════════════
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // iOS: suspended 상태면 resume
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

/**
 * playNotifSound(type)
 * type: 'budget' | 'overwork' | 'payday' | 'commute' | 'alarm'
 * 각 타입별로 음색/패턴 다르게 설계
 */
function playNotifSound(type) {
  // 설정에서 꺼뒀으면 skip
  try {
    const cfg = JSON.parse(localStorage.getItem('atm2_smart_notif_cfg_v1') || '{}');
    if (cfg.sound === false) return;
  } catch(e) {}

  try {
    const ctx = getAudioCtx();
    const patterns = {
      // 💸 지출: 하강 2음 (경고 느낌)
      budget:   [{ f:880, d:0.12, t:0.0 }, { f:660, d:0.18, t:0.14 }],
      // 😓 과로: 저음 3연타 (묵직한 경고)
      overwork: [{ f:330, d:0.18, t:0.0 }, { f:330, d:0.18, t:0.22 }, { f:280, d:0.25, t:0.44 }],
      // 💰 급여일: 상승 3음 (기분 좋은 알림)
      payday:   [{ f:523, d:0.12, t:0.0 }, { f:659, d:0.12, t:0.14 }, { f:784, d:0.22, t:0.28 }],
      // 🚌 출근: 2음 짧게 (알림 느낌)
      commute:  [{ f:700, d:0.10, t:0.0 }, { f:900, d:0.15, t:0.13 }],
      // 🔔 기존 알람: 3연속 비프
      alarm:    [{ f:880, d:0.10, t:0.0 }, { f:880, d:0.10, t:0.15 }, { f:880, d:0.15, t:0.30 }],
    };
    const notes = patterns[type] || patterns.alarm;
    notes.forEach(({ f, d, t }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d + 0.01);
    });
  } catch(e) {
    // AudioContext 미지원 환경 무시
  }
}

function fireSmartNotif({ type, title, body, tag }) {
  // 브라우저 알림
  if ('Notification' in window && Notification.permission === 'granted') {
    const icons = {
      budget:   '💸',
      overwork: '😓',
      payday:   '💰',
      commute:  '🚌'
    };
    new Notification(icons[type] + ' ' + title, {
      body,
      tag: 'smart-' + tag,
      icon: localStorage.getItem('companyLogo') || '',
      renotify: false
    });
  }
  // 인앱 토스트 (항상 표시)
  const colors = {
    budget:   'linear-gradient(135deg,#ff6b6b,#ff4f7b)',
    overwork: 'linear-gradient(135deg,#ff9a3c,#ff6b6b)',
    payday:   'linear-gradient(135deg,#43e97b,#38f9d7)',
    commute:  'linear-gradient(135deg,#4f7cff,#9b7cff)'
  };
  const emojis = { budget:'💸', overwork:'😓', payday:'💰', commute:'🚌' };
  let t = document.getElementById('_smart-notif-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_smart-notif-toast';
    t.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);
      color:#fff;padding:14px 22px;border-radius:18px;font-size:14px;font-weight:700;
      z-index:10000;box-shadow:0 8px 32px rgba(0,0,0,.3);font-family:'Noto Sans KR';
      text-align:center;max-width:88vw;border:1px solid rgba(255,255,255,.25);
      transition:opacity .4s;cursor:pointer;`;
    t.onclick = () => { t.style.opacity = '0'; };
    document.body.appendChild(t);
  }
  t.style.background = colors[type] || colors.commute;
  t.innerHTML = `${emojis[type]} <b>${title}</b><br><span style="font-size:12px;font-weight:400;opacity:.92;">${body}</span>`;
  t.style.display = 'block';
  t.style.opacity = '1';
  clearTimeout(t._stimer);
  t._stimer = setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => { t.style.display = 'none'; }, 400);
  }, 6000);
  if ('vibrate' in navigator) navigator.vibrate([150, 80, 150]);
  playNotifSound(type);
}

// ── 1. 지출 예산 초과 알림 ──────────────────────────────────
function checkBudgetNotif() {
  if (typeof budgetState === 'undefined') return;
  const state = smartNotifLoad();
  const todayKey = new Date().toISOString().slice(0, 10);
  const notifKey = 'budget_' + new Date().getFullYear() + '_' + pad2(new Date().getMonth() + 1);
  if (state[notifKey] === todayKey) return; // 오늘 이미 알림

  const income = (typeof getMonthlyIncome === 'function') ? getMonthlyIncome() : 0;
  if (income <= 0) return;

  const fixedTotal = (typeof getFixedTotal === 'function') ? getFixedTotal() : 0;
  const varSpent   = (typeof getVarSpent === 'function')
    ? getVarSpent(new Date().getFullYear(), new Date().getMonth())
    : 0;
  const savings    = budgetState.savingsGoal || 0;
  const budget     = income - fixedTotal - savings;
  if (budget <= 0) return;

  const spentPct = Math.round((varSpent / budget) * 100);
  const warnPct  = budgetState.warningPct || 80;

  if (spentPct >= 100) {
    fireSmartNotif({
      type: 'budget',
      title: '변동지출 예산 초과!',
      body: `이번달 예산의 ${spentPct}% 사용했어요. 지출을 줄여보세요 🐱`,
      tag: notifKey
    });
    state[notifKey] = todayKey;
    smartNotifSave(state);
  } else if (spentPct >= warnPct) {
    const notifWarnKey = 'budget_warn_' + new Date().getFullYear() + '_' + pad2(new Date().getMonth() + 1);
    if (state[notifWarnKey] === todayKey) return;
    fireSmartNotif({
      type: 'budget',
      title: '지출 경고',
      body: `이번달 변동지출이 예산의 ${spentPct}%예요. 남은 금액: ${(budget - varSpent).toLocaleString()}원`,
      tag: notifWarnKey
    });
    state[notifWarnKey] = todayKey;
    smartNotifSave(state);
  }
}

// ── 2. 주간 과로 감지 알림 (40h+) ──────────────────────────
function checkOverworkNotif() {
  const now = new Date();
  // 월요일(1)에만 지난주 체크 + 현재주 체크
  const dow = now.getDay(); // 0=일,1=월,...,6=토
  const state = smartNotifLoad();

  // 이번주 월요일 기준 키
  const mondayOffset = (dow === 0) ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const weekKey = 'overwork_' + monday.toISOString().slice(0, 10);
  if (state[weekKey]) return; // 이번주 이미 알림

  // 이번주 월~오늘까지 근무시간 합산
  let weekHours = 0;
  for (let i = 0; i <= (dow === 0 ? 6 : dow - 1); i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    const data = dayData[key];
    if (!data || !data.status || data.status === 'none') continue;
    const s = data.status;
    if (['work','early','sat_work','sun_work','holiday'].includes(s)) {
      weekHours += (typeof calcNetHours === 'function')
        ? calcNetHours(data.start, data.end, s, data.shift)
        : 8;
    }
    // 알바 모드
    const albaItems = (typeof albaData !== 'undefined') ? (albaData[key] || []) : [];
    albaItems.forEach(a => { weekHours += Math.max(0, a.endH - a.startH); });
  }

  if (weekHours >= 52) {
    fireSmartNotif({
      type: 'overwork',
      title: '이번주 과로 주의!',
      body: `이번주 ${Math.round(weekHours)}시간 근무 중이에요. 충분한 휴식이 필요해요 😓`,
      tag: weekKey
    });
    state[weekKey] = now.toISOString().slice(0, 10);
    smartNotifSave(state);
  } else if (weekHours >= 40) {
    fireSmartNotif({
      type: 'overwork',
      title: '이번주 근무 40시간 초과',
      body: `현재 ${Math.round(weekHours)}시간 근무했어요. 무리하지 마세요 🐱`,
      tag: weekKey
    });
    state[weekKey] = now.toISOString().slice(0, 10);
    smartNotifSave(state);
  }
}

// ── 3. 급여일 D-3 / D-1 알림 ───────────────────────────────
function checkPaydayNotif() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const state = smartNotifLoad();

  // 급여일: budgetState.paydayDay 또는 memPayday
  const paydayDay = (typeof budgetState !== 'undefined' && budgetState.paydayDay)
    ? budgetState.paydayDay
    : (memPayday ? parseInt(memPayday) : 0);
  if (!paydayDay) return;

  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const actualPayday = Math.min(paydayDay, dim); // 말일 처리
  const paydayDate = new Date(y, m, actualPayday);
  const diffDays = Math.round((paydayDate - now) / (1000 * 60 * 60 * 24));

  if (diffDays === 3) {
    const key = 'payday_d3_' + y + '_' + pad2(m + 1);
    if (state[key] === todayStr) return;
    fireSmartNotif({
      type: 'payday',
      title: '급여일 D-3',
      body: `${m+1}월 ${actualPayday}일 급여일까지 3일 남았어요 💰`,
      tag: key
    });
    state[key] = todayStr;
    smartNotifSave(state);
  } else if (diffDays === 1) {
    const key = 'payday_d1_' + y + '_' + pad2(m + 1);
    if (state[key] === todayStr) return;
    fireSmartNotif({
      type: 'payday',
      title: '급여일 내일!',
      body: `내일(${m+1}월 ${actualPayday}일) 급여가 들어올 예정이에요 🎉`,
      tag: key
    });
    state[key] = todayStr;
    smartNotifSave(state);
  } else if (diffDays === 0) {
    const key = 'payday_d0_' + y + '_' + pad2(m + 1);
    if (state[key] === todayStr) return;
    fireSmartNotif({
      type: 'payday',
      title: '오늘 급여일!',
      body: `오늘 급여일이에요! 입금 확인해보세요 💸`,
      tag: key
    });
    state[key] = todayStr;
    smartNotifSave(state);
  }
}

// ── 4. 출근 예정 알림 (등록된 근무 30분 전) ────────────────
function checkCommuteNotif() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const state = smartNotifLoad();

  // 직장인 모드: dayData에서 오늘 근무 시작시간
  const dd = dayData[todayStr];
  if (dd && ['work','early','sat_work','sun_work','holiday'].includes(dd.status) && dd.start != null) {
    const startMins = (typeof dd.start === 'number') ? dd.start * 60 : timeStrToMins(dd.start);
    const diff = startMins - nowMins;
    if (diff >= 28 && diff <= 32) {
      const key = 'commute_' + todayStr;
      if (!state[key]) {
        const startLabel = (typeof dd.start === 'number')
          ? pad2(dd.start) + ':00'
          : String(dd.start);
        fireSmartNotif({
          type: 'commute',
          title: '출근 30분 전',
          body: `오늘 ${startLabel} 출근 예정이에요. 준비하세요! 🚌`,
          tag: key
        });
        state[key] = todayStr;
        smartNotifSave(state);
      }
    }
  }

  // 알바 모드
  if (typeof albaData !== 'undefined') {
    const items = albaData[todayStr] || [];
    items.forEach((a, idx) => {
      const startMins = a.startH * 60;
      const diff = startMins - nowMins;
      if (diff >= 28 && diff <= 32) {
        const key = 'commute_alba_' + todayStr + '_' + idx;
        if (!state[key]) {
          fireSmartNotif({
            type: 'commute',
            title: '알바 출근 30분 전',
            body: `${a.name || '알바'} ${pad2(a.startH)}:00 출근 예정이에요 🚌`,
            tag: key
          });
          state[key] = todayStr;
          smartNotifSave(state);
        }
      }
    });
  }

  // 프리랜서 모드
  if (typeof flData !== 'undefined') {
    const items = flData[todayStr] || [];
    items.forEach((a, idx) => {
      if (!a.alarmTime) return;
      const [ah, am] = a.alarmTime.split(':').map(Number);
      const alarmMins = ah * 60 + am;
      const diff = alarmMins - nowMins;
      if (diff >= 28 && diff <= 32) {
        const key = 'commute_fl_' + todayStr + '_' + idx;
        if (!state[key]) {
          fireSmartNotif({
            type: 'commute',
            title: '일정 30분 전',
            body: `${a.title || '일정'} 시작 30분 전이에요 📅`,
            tag: key
          });
          state[key] = todayStr;
          smartNotifSave(state);
        }
      }
    });
  }
}

// 시간 문자열 → 분 변환 헬퍼
function timeStrToMins(t) {
  if (t == null) return 0;
  if (typeof t === 'number') return t * 60;
  const parts = String(t).split(':');
  return parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0);
}

// ── 스마트 알림 통합 체크 (1분마다 실행) ──────────────────
let _smartNotifTick = null;
function startSmartNotifTick() {
  if (_smartNotifTick) return;
  // 즉시 1회 실행
  runSmartNotifChecks();
  // 1분마다 반복
  _smartNotifTick = setInterval(runSmartNotifChecks, 60000);
}

function runSmartNotifChecks() {
  try { checkBudgetNotif();  } catch(e) {}
  try { checkOverworkNotif(); } catch(e) {}
  try { checkPaydayNotif();  } catch(e) {}
  try { checkCommuteNotif(); } catch(e) {}
}

// 앱 시작 시 스마트 알림 틱 시작
startSmartNotifTick();

// ── 스마트 알림 설정 패널 렌더 ──────────────────────────────
const SMART_NOTIF_CFG_KEY = 'atm2_smart_notif_cfg_v1';

const SMART_NOTIF_ITEMS = [
  { id: 'budget',   emoji: '💸', label: '지출 예산 초과 알림',          desc: '변동지출이 예산의 80%·100% 초과 시' },
  { id: 'overwork', emoji: '😓', label: '주간 과로 감지 알림',           desc: '이번주 40h·52h 초과 시 경고' },
  { id: 'payday',   emoji: '💰', label: '급여일 D-3 / D-1 / D-day 알림', desc: '급여일 3일 전·하루 전·당일' },
  { id: 'commute',  emoji: '🚌', label: '출근 예정 알림',                desc: '등록된 근무 시작 30분 전' },
];

function smartNotifCfgLoad() {
  try {
    const raw = localStorage.getItem(SMART_NOTIF_CFG_KEY);
    // 기본값: 전체 ON
    const defaults = {};
    SMART_NOTIF_ITEMS.forEach(i => { defaults[i.id] = true; });
    return raw ? Object.assign(defaults, JSON.parse(raw)) : defaults;
  } catch(e) {
    const d = {}; SMART_NOTIF_ITEMS.forEach(i => d[i.id] = true); return d;
  }
}

function smartNotifCfgSave(cfg) {
  try { localStorage.setItem(SMART_NOTIF_CFG_KEY, JSON.stringify(cfg)); } catch(e) {}
}

function renderSmartNotifPanel() {
  const banner = document.getElementById('smart-notif-permission-banner');
  const wrap   = document.getElementById('smart-notif-toggles');
  if (!banner || !wrap) return;

  // 권한 배너
  const hasPerm = !('Notification' in window) || Notification.permission === 'granted';
  banner.style.display = hasPerm ? 'none' : 'block';

  const cfg = smartNotifCfgLoad();
  wrap.innerHTML = SMART_NOTIF_ITEMS.map(item => `
    <label style="display:flex;align-items:center;justify-content:space-between;
      padding:9px 4px;border-bottom:1px solid var(--border);cursor:pointer;gap:8px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text);">
          ${item.emoji} ${item.label}
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${item.desc}</div>
      </div>
      <div class="smart-toggle ${cfg[item.id] ? 'on' : ''}"
           onclick="toggleSmartNotif('${item.id}',this)"
           style="flex-shrink:0;width:40px;height:22px;border-radius:11px;
             background:${cfg[item.id] ? 'var(--accent,#4f7cff)' : 'var(--border)'};
             position:relative;transition:background .25s;cursor:pointer;">
        <span style="position:absolute;top:3px;
          left:${cfg[item.id] ? '20px' : '3px'};
          width:16px;height:16px;border-radius:50%;background:#fff;
          box-shadow:0 1px 4px rgba(0,0,0,.2);transition:left .25s;display:block;"></span>
      </div>
    </label>
  `).join('');
}

function toggleSmartNotif(id, el) {
  const cfg = smartNotifCfgLoad();
  cfg[id] = !cfg[id];
  smartNotifCfgSave(cfg);
  renderSmartNotifPanel();
  showToast(cfg[id] ? `🔔 ${id} 알림 켜짐` : `🔕 ${id} 알림 꺼짐`);
}

function resetSmartNotifState() {
  try { localStorage.removeItem(SMART_NOTIF_KEY); } catch(e) {}
  showToast('✅ 오늘 알림 기록이 초기화됐어요. 다시 체크할게요!');
  setTimeout(runSmartNotifChecks, 1000);
}

// 알림 cfg 체크를 runSmartNotifChecks에 적용
const _origRunChecks = runSmartNotifChecks;
runSmartNotifChecks = function() {
  const cfg = smartNotifCfgLoad();
  if (cfg.budget)   try { checkBudgetNotif();   } catch(e) {}
  if (cfg.overwork) try { checkOverworkNotif(); } catch(e) {}
  if (cfg.payday)   try { checkPaydayNotif();   } catch(e) {}
  if (cfg.commute)  try { checkCommuteNotif();  } catch(e) {}
};

// 드로어 열릴 때 패널 렌더 (toggleDrawer 래핑)
const _origToggleDrawer = typeof toggleDrawer === 'function' ? toggleDrawer : null;
if (_origToggleDrawer) {
  toggleDrawer = function() {
    _origToggleDrawer();
    setTimeout(() => { renderSmartNotifPanel(); initPaydayInput(); }, 100);
  };
}

// 소리 토글
function toggleSoundNotif(el) {
  const cfg = smartNotifCfgLoad();
  cfg.sound = (cfg.sound === false) ? true : false;
  smartNotifCfgSave(cfg);
  updateSoundToggleUI(cfg.sound !== false);
  playNotifSound('alarm'); // 미리듣기
  showToast(cfg.sound !== false ? '🔊 알림 소리 켜짐' : '🔇 알림 소리 꺼짐');
}

function updateSoundToggleUI(on) {
  const btn  = document.getElementById('sound-toggle-btn');
  const knob = document.getElementById('sound-toggle-knob');
  if (!btn || !knob) return;
  btn.style.background  = on ? 'var(--accent,#4f7cff)' : 'var(--border)';
  knob.style.left       = on ? '20px' : '3px';
}

// renderSmartNotifPanel 후 사운드 UI 동기화
const _origRenderPanel = renderSmartNotifPanel;
renderSmartNotifPanel = function() {
  _origRenderPanel();
  const cfg = smartNotifCfgLoad();
  setTimeout(() => updateSoundToggleUI(cfg.sound !== false), 50);
};

// 초기 렌더
setTimeout(() => { renderSmartNotifPanel(); initPaydayInput(); }, 500);
// ── 가계부 초기화 ──
if(typeof initBudget === 'function') initBudget();
// 초기 온라인 상태 뱃지 설정
if(typeof updateOnlineBadge === 'function') updateOnlineBadge();

