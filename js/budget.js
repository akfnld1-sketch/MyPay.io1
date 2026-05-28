/**
 * budget.js — 급여 기반 생존 관리 시스템
 * attendance_v8.html에서 로드됨
 * 의존: getPayData(), fmt(), pad2(), lsSave(), showToast(), curY, curM
 */

// ══════════════════════════════════════════
// 가계부 STATE
// ══════════════════════════════════════════

const BUDGET_KEY     = 'atm2_budget_v1';
const EXPENSE_PREFIX = 'atm2_expenses_';

// 고정지출 기본 카테고리
const FIXED_CATEGORIES = [
  { id: 'rent',    icon: '🏠', label: '월세/관리비' },
  { id: 'loan',    icon: '🏦', label: '대출상환' },
  { id: 'telecom', icon: '📱', label: '통신비' },
  { id: 'insur',   icon: '🛡️', label: '보험료' },
  { id: 'car',     icon: '🚗', label: '차량유지비' },
  { id: 'edu',     icon: '📚', label: '교육비' },
  { id: 'sub',     icon: '🎬', label: '구독서비스' },
  { id: 'other1',  icon: '📌', label: '기타고정1' },
  { id: 'other2',  icon: '📌', label: '기타고정2' },
];

// 변동지출 카테고리
const VAR_CATEGORIES = [
  { id: 'food',     icon: '🍚', label: '식비' },
  { id: 'cafe',     icon: '☕', label: '카페/간식' },
  { id: 'trans',    icon: '🚌', label: '교통비' },
  { id: 'health',   icon: '💊', label: '의료/건강' },
  { id: 'cloth',    icon: '👕', label: '의류/미용' },
  { id: 'entertain',icon: '🎮', label: '문화/오락' },
  { id: 'gift',     icon: '🎁', label: '경조사/선물' },
  { id: 'etc',      icon: '💳', label: '기타' },
];

// budgetState: 고정지출 설정, 목표 저축액, 기타 설정
let budgetState = {
  fixedExpenses: {},   // { rent: 500000, loan: 200000, ... }
  savingsGoal:   0,    // 목표 저축액
  customIncome:  0,    // 0이면 getPayData().finalPay 자동 사용
  paydayDay:     25,   // 급여일 (1~31)
  warningPct:    80,   // 지출 경고 비율 (%)
};

// 월별 변동지출 항목: key = 'YYYY-MM', value = [{id, cat, icon, label, amount, date, note}]
let monthExpenses = {};  // 현재 세션에 로드된 월들

// ── localStorage 유틸 ──
function budgetSave() {
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budgetState));
    // 현재 달 지출만 저장
    const mk = `${curY}-${pad2(curM + 1)}`;
    const key = EXPENSE_PREFIX + mk;
    localStorage.setItem(key, JSON.stringify(monthExpenses[mk] || []));
  } catch(e) {}
}

function budgetLoad() {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (raw) Object.assign(budgetState, JSON.parse(raw));
  } catch(e) {}
  budgetLoadMonth(curY, curM);
}

// ── 급여일 저장 (3곳 동시 동기화) ──
function savePayday() {
  const input  = document.getElementById('payday-input');
  const status = document.getElementById('payday-status');
  if (!input) return;
  const val = parseInt(input.value);
  if (isNaN(val) || val < 1 || val > 31) {
    if (status) { status.style.color='var(--red)'; status.textContent='⚠️ 1~31 사이 숫자를 입력해주세요'; }
    setTimeout(() => { if(status) status.textContent=''; }, 2500);
    return;
  }
  budgetState.paydayDay = val;
  budgetSave();
  localStorage.setItem('payDay_setting', String(val));
  if (typeof memPayday !== 'undefined') memPayday = val;
  lsSave();  // atm2_memory의 payday도 동시 갱신
  if (status) {
    status.style.color = 'var(--accent)';
    status.textContent = `✅ 급여일 매달 ${val}일 저장됨!`;
    setTimeout(() => { status.textContent = ''; }, 3000);
  }
}

// ── 급여일 설정창 초기값 복원 ──
function initPaydayInput() {
  const input = document.getElementById('payday-input');
  if (!input) return;
  const saved = budgetState.paydayDay
    || parseInt(localStorage.getItem('payDay_setting') || '0')
    || (typeof memPayday !== 'undefined' && memPayday ? parseInt(memPayday) : 0);
  if (saved > 0) input.value = saved;
}

function budgetLoadMonth(y, m) {
  const mk = `${y}-${pad2(m + 1)}`;
  if (monthExpenses[mk]) return; // 이미 로드됨
  try {
    const raw = localStorage.getItem(EXPENSE_PREFIX + mk);
    monthExpenses[mk] = raw ? JSON.parse(raw) : [];
  } catch(e) {
    monthExpenses[mk] = [];
  }
}

function budgetSaveMonth(y, m) {
  const mk = `${y}-${pad2(m + 1)}`;
  try {
    localStorage.setItem(EXPENSE_PREFIX + mk, JSON.stringify(monthExpenses[mk] || []));
  } catch(e) {}
}

// ══════════════════════════════════════════
// 핵심 계산 함수
// ══════════════════════════════════════════

/** 이번달 실수령 — 직장인 + N잡 달력 데이터 통합 자동 연동 */
function getBudgetIncome() {
  if (budgetState.customIncome > 0) return budgetState.customIncome;
  const _pad2 = n => String(n).padStart(2,'0');
  let total = 0;

  try {
    // 1. 직장인 급여 (getPayData)
    if (typeof getPayData === 'function') {
      const d = getPayData();
      if (d && d.finalPay) total += d.finalPay;
    }

    // 2. N잡 달력 데이터 (njobLoad) — 날짜별 알바/배달/프리 합산
    const dim = new Date(curY, curM + 1, 0).getDate();
    for (let day = 1; day <= dim; day++) {
      const key = `${curY}-${_pad2(curM + 1)}-${_pad2(day)}`;
      try {
        const raw = localStorage.getItem('atm2_njob_' + key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        // 알바: 시급 × 시간
        (data.alba || []).forEach(it => { total += Math.round((it.wage||0) * (it.hours||0)); });
        // 배달/대리: 건수 × 단가
        (data.delivery || []).forEach(it => { total += (it.count||0) * (it.price||0); });
        // 프리랜서: 건수 × 단가
        (data.free || []).forEach(it => { total += (it.count||0) * (it.price||0); });
      } catch(e2) {}
    }

    // 3. 기존 수입계산기 항목도 합산 (중복 방지: njob 없는 경우)
    const incKey = `atm2_income_${curY}_${_pad2(curM + 1)}`;
    const incRaw = localStorage.getItem(incKey);
    if (incRaw) {
      JSON.parse(incRaw).forEach(it => { total += parseInt(it.amount) || 0; });
    }
  } catch(e) {}

  // N잡 수입에 3.3% 원천징수 적용 (직장인 급여는 이미 공제됨)
  return total > 0 ? total : 0;
}

/** 이번달 고정지출 합계 */
function getTotalFixed() {
  return Object.values(budgetState.fixedExpenses)
    .reduce((s, v) => s + (parseInt(v) || 0), 0);
}

/** 이번달 변동지출 합계 */
function getTotalVariable(y, m) {
  y = y ?? curY; m = m ?? curM;
  budgetLoadMonth(y, m);
  const mk = `${y}-${pad2(m + 1)}`;
  return (monthExpenses[mk] || [])
    .reduce((s, e) => s + (parseInt(e.amount) || 0), 0);
}

/** 카테고리별 변동지출 합계 */
function getVarByCat(y, m) {
  y = y ?? curY; m = m ?? curM;
  budgetLoadMonth(y, m);
  const mk = `${y}-${pad2(m + 1)}`;
  const map = {};
  (monthExpenses[mk] || []).forEach(e => {
    map[e.cat] = (map[e.cat] || 0) + (parseInt(e.amount) || 0);
  });
  return map;
}

/** 핵심: 잔고 0원 예상 날짜 계산 */
function calcZeroBalanceDate() {
  const income    = getBudgetIncome();
  const fixed     = getTotalFixed();
  const variable  = getTotalVariable();
  const savings   = budgetState.savingsGoal || 0;
  const usable    = income - fixed - savings;  // 실사용 가능 금액

  if (usable <= 0) return { date: '이미 위험', daysLeft: 0, dailyAvg: 0, usable, income, fixed, variable };

  // 오늘까지 일수
  const today    = new Date();
  const isThisMonth = (today.getFullYear() === curY && today.getMonth() === curM);
  const daysPassed  = isThisMonth ? today.getDate() : new Date(curY, curM + 1, 0).getDate();
  const totalDays   = new Date(curY, curM + 1, 0).getDate();

  // 오늘까지 일평균 지출
  const dailyAvg = daysPassed > 0 ? variable / daysPassed : 0;

  // 남은 잔고 = 사용가능 - 이미 쓴 것
  const remaining = usable - variable;

  if (remaining <= 0) {
    return { date: '이미 초과', daysLeft: 0, dailyAvg, usable, income, fixed, variable, remaining: 0 };
  }

  if (dailyAvg <= 0) {
    // 지출 없음 → 월말까지 유지
    return {
      date: `${curY}년 ${curM + 1}월 말`,
      daysLeft: totalDays - daysPassed,
      dailyAvg: 0, usable, income, fixed, variable, remaining
    };
  }

  // 잔고 / 일평균 = 남은 일수
  const daysLeft = Math.floor(remaining / dailyAvg);
  const zeroDate = new Date(today);
  zeroDate.setDate(today.getDate() + daysLeft);

  const label = isThisMonth
    ? `${zeroDate.getMonth() + 1}월 ${zeroDate.getDate()}일`
    : `${zeroDate.getFullYear()}년 ${zeroDate.getMonth() + 1}월 ${zeroDate.getDate()}일`;

  // 절약 시나리오: 지출 30% 줄이면 몇 일 더?
  const frugalDaily = dailyAvg * 0.7;
  const frugalDays = frugalDaily > 0 ? Math.floor(remaining / frugalDaily) : 999;
  const extraDays = frugalDays - daysLeft;

  return { date: label, daysLeft, dailyAvg, usable, income, fixed, variable, remaining, extraDays };
}

/** 경고 레벨: 0=안전, 1=주의, 2=위험, 3=초위험 */
function getWarningLevel(calc) {
  if (!calc) return 0;
  const income = calc.income;
  if (income <= 0) return 0;
  const spentRatio = (calc.fixed + calc.variable) / income;
  if (spentRatio >= 1.0)   return 3;
  if (spentRatio >= 0.85)  return 2;
  if (spentRatio >= (budgetState.warningPct / 100)) return 1;
  return 0;
}

// ══════════════════════════════════════════
// 페이지 렌더링
// ══════════════════════════════════════════

function renderBudgetPage() {
  budgetLoadMonth(curY, curM);
  const calc   = calcZeroBalanceDate();
  const wLevel = getWarningLevel(calc);
  const mk     = `${curY}-${pad2(curM + 1)}`;
  const expenses = (monthExpenses[mk] || []).slice().reverse();
  const catMap = getVarByCat();

  const wColors  = ['var(--green)','var(--yellow)','var(--orange)','var(--red)'];
  const wIcons   = ['✅','⚠️','🔥','🚨'];
  const wLabels  = ['안전','주의','위험','초위험'];
  const wBgs     = ['rgba(61,214,140,.08)','rgba(255,209,102,.08)','rgba(255,140,66,.1)','rgba(255,92,122,.12)'];
  const wBorders = ['rgba(61,214,140,.3)','rgba(255,209,102,.35)','rgba(255,140,66,.4)','rgba(255,92,122,.5)'];

  const fixedTotal = getTotalFixed();
  const income     = calc.income;
  const spent      = calc.variable;
  const usable     = calc.usable > 0 ? calc.usable : 1;
  const spentPct   = Math.min(100, Math.round(spent / usable * 100));
  const barColor   = spentPct >= 90 ? 'var(--red)' : spentPct >= 70 ? 'var(--orange)' : 'var(--green)';
  const finalLeft  = income - fixedTotal - (budgetState.savingsGoal || 0) - spent;

  // N잡 수입 상세 (달력 데이터)
  const _p = n => String(n).padStart(2,'0');
  const dim = new Date(curY, curM+1, 0).getDate();
  let njobAlbaTotal=0, njobDelivTotal=0, njobFreeTotal=0;
  for(let d=1;d<=dim;d++){
    const k=`${curY}-${_p(curM+1)}-${_p(d)}`;
    try{
      const raw=localStorage.getItem('atm2_njob_'+k);
      if(!raw) continue;
      const data=JSON.parse(raw);
      (data.alba||[]).forEach(it=>{ njobAlbaTotal+=Math.round((it.wage||0)*(it.hours||0)); });
      (data.delivery||[]).forEach(it=>{ njobDelivTotal+=(it.count||0)*(it.price||0); });
      (data.free||[]).forEach(it=>{ njobFreeTotal+=(it.count||0)*(it.price||0); });
    }catch(e){}
  }
  const njobTotal = njobAlbaTotal + njobDelivTotal + njobFreeTotal;

  // 직장 수입
  let employeeIncome = 0;
  try{ if(typeof getPayData==='function'){const d=getPayData();if(d&&d.finalPay)employeeIncome=d.finalPay;} }catch(e){}

  const page = document.getElementById('budget-page');
  if (!page) return;

  page.innerHTML = `
  <!-- 헤더 -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
    <div>
      <h2 style="font-size:20px;font-weight:700;">💳 ${curY}년 ${curM+1}월 가계부</h2>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">수입 자동연동 · 잔고 소진일 예측</div>
    </div>
    <div style="display:flex;gap:6px;">
      <button onclick="openFixedExpenseEditor()"
        style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text2);font-size:12px;font-weight:600;
               cursor:pointer;font-family:'Noto Sans KR';">⚙️ 고정설정</button>
      <button onclick="openAddExpense()"
        style="padding:7px 14px;border-radius:8px;border:none;
               background:var(--accent);color:#fff;font-size:12px;font-weight:700;
               cursor:pointer;font-family:'Noto Sans KR';">+ 지출입력</button>
    </div>
  </div>

  <!-- 경고 배너 -->
  <div style="background:${wBgs[wLevel]};border:1px solid ${wBorders[wLevel]};border-radius:12px;
              padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;">
    <div style="font-size:24px;">${wIcons[wLevel]}</div>
    <div style="flex:1;">
      <div style="font-size:13px;font-weight:700;color:${wColors[wLevel]};">
        ${wLabels[wLevel]}
        ${calc.daysLeft>0?`· 잔고 소진 <b>${calc.date}</b> (${calc.daysLeft}일 후)`:`· <b>${calc.date}</b>`}
      </div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px;">
        ${calc.dailyAvg>0?`일평균 ${Math.round(calc.dailyAvg).toLocaleString()}원`:'지출 기록 없음'}
        ${calc.extraDays>0?` · 절약 시 +${calc.extraDays}일 연장`:''}
      </div>
    </div>
  </div>

  <!-- 수입 섹션 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:14px 16px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);">💰 이번달 수입</div>
      <div style="font-size:16px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);">
        ${income.toLocaleString()}원
      </div>
    </div>
    ${income>0?`
    <div style="display:flex;flex-direction:column;gap:5px;">
      ${employeeIncome>0?`
      <div style="display:flex;justify-content:space-between;padding:5px 8px;
                  background:rgba(79,124,255,.06);border-radius:6px;">
        <span style="font-size:12px;color:var(--text2);">🏢 직장 (실수령)</span>
        <span style="font-size:12px;font-weight:700;color:var(--accent);">+${employeeIncome.toLocaleString()}원</span>
      </div>`:''}
      ${njobAlbaTotal>0?`
      <div style="display:flex;justify-content:space-between;padding:5px 8px;
                  background:rgba(255,140,66,.06);border-radius:6px;">
        <span style="font-size:12px;color:var(--text2);">⏰ 알바</span>
        <span style="font-size:12px;font-weight:700;color:var(--orange);">+${njobAlbaTotal.toLocaleString()}원</span>
      </div>`:''}
      ${njobDelivTotal>0?`
      <div style="display:flex;justify-content:space-between;padding:5px 8px;
                  background:rgba(255,209,102,.06);border-radius:6px;">
        <span style="font-size:12px;color:var(--text2);">🛵 배달·대리</span>
        <span style="font-size:12px;font-weight:700;color:var(--yellow);">+${njobDelivTotal.toLocaleString()}원</span>
      </div>`:''}
      ${njobFreeTotal>0?`
      <div style="display:flex;justify-content:space-between;padding:5px 8px;
                  background:rgba(127,119,221,.06);border-radius:6px;">
        <span style="font-size:12px;color:var(--text2);">💻 프리랜서</span>
        <span style="font-size:12px;font-weight:700;color:var(--accent2);">+${njobFreeTotal.toLocaleString()}원</span>
      </div>`:''}
    </div>`:`
    <div style="font-size:12px;color:var(--text3);text-align:center;padding:8px;">
      달력에 근태/수입을 기록하면 자동 연동됩니다
    </div>`}
    <!-- 수입 직접입력 -->
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">직접 입력 (0=자동계산)</div>
      <div style="display:flex;align-items:center;gap:6px;">
        <input id="manual-income-inp" type="number" placeholder="0"
          value="${budgetState.customIncome||''}"
          style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:7px;padding:7px 10px;font-size:13px;font-family:'JetBrains Mono';
                 font-weight:700;outline:none;text-align:right;">
        <span style="font-size:12px;color:var(--text3);">원</span>
        <button onclick="saveCustomIncome()"
          style="padding:7px 12px;border-radius:7px;border:none;background:var(--surface3);
                 color:var(--text);font-size:12px;cursor:pointer;font-family:'Noto Sans KR';
                 border:1px solid var(--border);">저장</button>
      </div>
    </div>
  </div>

  <!-- 지출 요약 카드 -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">🔒 고정지출</div>
      <div style="font-size:17px;font-weight:700;font-family:'JetBrains Mono';color:var(--red);">${fixedTotal.toLocaleString()}원</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px;">수입의 ${income>0?Math.round(fixedTotal/income*100):0}%</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;">
      <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">💳 변동지출</div>
      <div style="font-size:17px;font-weight:700;font-family:'JetBrains Mono';color:${wLevel>=2?'var(--red)':'var(--yellow)'};">${spent.toLocaleString()}원</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px;">${spentPct}% 사용중</div>
    </div>
  </div>

  <!-- 잔여 금액 큰 카드 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:16px;margin-bottom:12px;">
    <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">이번달 남은 금액</div>
    <div style="font-size:30px;font-weight:900;font-family:'JetBrains Mono';
                color:${finalLeft>=0?'var(--accent)':'var(--red)'};">
      ${finalLeft>=0?finalLeft.toLocaleString():'('+Math.abs(finalLeft).toLocaleString()+')'}원
      ${finalLeft<0?'<span style="font-size:13px;"> 초과!</span>':''}
    </div>
    <div style="background:var(--surface2);border-radius:5px;height:8px;overflow:hidden;margin:10px 0 6px;">
      <div style="height:100%;width:${spentPct}%;background:${barColor};border-radius:5px;transition:width .4s;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);">
      <span>변동지출 ${spentPct}%</span>
      <span>사용가능 ${(calc.usable>0?calc.usable:0).toLocaleString()}원</span>
    </div>
  </div>

  <!-- 카테고리별 지출 -->
  ${spent>0?`
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:14px 16px;margin-bottom:12px;">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">🗂️ 카테고리별 지출</div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${VAR_CATEGORIES.map(cat=>{
        const amt=catMap[cat.id]||0;
        if(!amt) return '';
        const pct=spent>0?Math.round(amt/spent*100):0;
        return `<div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:15px;width:20px;">${cat.icon}</span>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="font-size:12px;color:var(--text2);">${cat.label}</span>
              <span style="font-size:12px;font-weight:700;color:var(--text);">${amt.toLocaleString()}원</span>
            </div>
            <div style="background:var(--surface2);border-radius:3px;height:5px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px;"></div>
            </div>
          </div>
          <span style="font-size:11px;color:var(--text3);width:28px;text-align:right;">${pct}%</span>
        </div>`;
      }).filter(Boolean).join('')}
    </div>
  </div>`:''}

  <!-- 지출 내역 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:14px 16px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);">📝 지출 내역 (${expenses.length}건)</div>
      ${expenses.length>0?`
      <button onclick="if(confirm('이번달 지출을 모두 삭제할까요?'))clearAllExpenses()"
        style="font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid rgba(255,92,122,.3);
               background:none;color:var(--red);cursor:pointer;">전체삭제</button>`:''}
    </div>
    ${expenses.length===0?`
    <div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">
      지출 내역이 없습니다
      <br><button onclick="openAddExpense()"
        style="margin-top:10px;padding:8px 16px;border-radius:8px;border:none;
               background:var(--accent);color:#fff;font-size:13px;cursor:pointer;
               font-family:'Noto Sans KR';">+ 첫 지출 입력</button>
    </div>`:`
    <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;">
      ${expenses.map((exp,ri)=>{
        const origIdx=(monthExpenses[mk]||[]).length-1-ri;
        return `<div style="display:flex;align-items:center;gap:8px;padding:9px 10px;
                    background:var(--surface2);border:1px solid var(--border);border-radius:8px;">
          <span style="font-size:18px;">${exp.icon||'💳'}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${exp.label||exp.cat}</div>
            <div style="font-size:11px;color:var(--text3);">${exp.date}${exp.note?' · '+exp.note:''}</div>
          </div>
          <div style="font-size:14px;font-weight:700;color:var(--red);white-space:nowrap;">-${parseInt(exp.amount).toLocaleString()}원</div>
          <button onclick="deleteExpense(${origIdx})"
            style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;">✕</button>
        </div>`;
      }).join('')}
    </div>`}
  </div>

  <!-- 고정지출 미리보기 -->
  ${fixedTotal>0?`
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:14px 16px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);">🔒 고정지출 항목</div>
      <button onclick="openFixedExpenseEditor()"
        style="font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text2);cursor:pointer;">수정</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;">
      ${FIXED_CATEGORIES.map(cat=>{
        const amt=parseInt(budgetState.fixedExpenses[cat.id]||0);
        if(!amt) return '';
        return `<div style="display:flex;justify-content:space-between;align-items:center;
                    padding:6px 8px;background:var(--surface2);border-radius:6px;">
          <span style="font-size:12px;color:var(--text2);">${cat.icon} ${cat.label}</span>
          <span style="font-size:13px;font-weight:700;color:var(--red);">-${amt.toLocaleString()}원</span>
        </div>`;
      }).filter(Boolean).join('')}
      <div style="display:flex;justify-content:space-between;padding:8px;border-top:1px solid var(--border);margin-top:2px;">
        <span style="font-size:13px;color:var(--text2);">합계</span>
        <span style="font-size:14px;font-weight:700;color:var(--red);">-${fixedTotal.toLocaleString()}원</span>
      </div>
    </div>
  </div>`:`
  <div style="background:rgba(255,209,102,.05);border:1px dashed rgba(255,209,102,.4);border-radius:12px;
              padding:16px;text-align:center;margin-bottom:12px;">
    <div style="font-size:13px;font-weight:700;color:var(--yellow);margin-bottom:6px;">🔒 고정지출을 등록해주세요</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px;">월세, 대출, 통신비 등 매달 나가는 항목</div>
    <button onclick="openFixedExpenseEditor()"
      style="padding:9px 18px;border-radius:8px;border:none;background:var(--yellow);
             color:#1a1a2e;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
      ⚙️ 고정지출 설정</button>
  </div>`}

  <!-- 저축 목표 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;
              padding:12px 16px;margin-bottom:20px;">
    <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;">🎯 월 저축 목표</div>
    <div style="display:flex;align-items:center;gap:6px;">
      <input id="savings-goal-inp" type="number" placeholder="목표 저축액"
        value="${budgetState.savingsGoal||''}"
        style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);
               border-radius:7px;padding:7px 10px;font-size:13px;font-family:'JetBrains Mono';
               font-weight:700;outline:none;text-align:right;">
      <span style="font-size:12px;color:var(--text3);">원</span>
      <button onclick="saveSavingsGoal()"
        style="padding:7px 12px;border-radius:7px;border:1px solid var(--border);
               background:var(--surface3);color:var(--text);font-size:12px;cursor:pointer;
               font-family:'Noto Sans KR';">저장</button>
    </div>
  </div>`;
}


// ── 요약 카드 헬퍼 ──
function summaryCard(label, amount, color, sub) {
  return `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;">
    <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">${label}</div>
    <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono';color:${color};">
      ${Math.abs(amount).toLocaleString()}원
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:3px;">${sub}</div>
  </div>`;
}

// ══════════════════════════════════════════
// 고정지출 설정 팝업
// ══════════════════════════════════════════
function openFixedExpenseEditor() {
  let overlay = document.getElementById('fixed-expense-popup');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'fixed-expense-popup';
    overlay.className = 'overlay';
    overlay.onclick = e => { if (e.target === overlay) closeFixedExpenseEditor(); };
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="popup" style="width:440px;padding:24px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <h3 style="font-size:16px;margin:0;">🔒 고정지출 설정</h3>
        <button onclick="closeFixedExpenseEditor()"
          style="background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:14px;">
        매달 고정으로 나가는 항목을 입력하세요. 0 입력 시 제외됩니다.
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;max-height:380px;overflow-y:auto;margin-bottom:16px;">
        ${FIXED_CATEGORIES.map(cat => `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;width:22px;text-align:center;">${cat.icon}</span>
            <label style="font-size:13px;color:var(--text2);flex:1;">${cat.label}</label>
            <input type="number" id="fixed-${cat.id}" min="0" step="1000"
              value="${parseInt(budgetState.fixedExpenses[cat.id] || 0) || ''}"
              placeholder="0"
              style="width:130px;background:var(--surface2);border:1px solid var(--border);
                     color:var(--text);border-radius:8px;padding:8px 10px;font-size:14px;
                     font-family:'JetBrains Mono';font-weight:700;outline:none;text-align:right;">
            <span style="font-size:12px;color:var(--text3);">원</span>
          </div>`).join('')}
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;
                  padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;
                  align-items:center;">
        <span style="font-size:13px;color:var(--text2);">고정지출 합계</span>
        <span id="fixed-total-preview" style="font-size:16px;font-weight:700;
              font-family:'JetBrains Mono';color:var(--red);">0원</span>
      </div>

      <div style="display:flex;gap:8px;">
        <button onclick="saveFixedExpenses()"
          style="flex:1;padding:12px;border-radius:8px;border:none;background:var(--accent);
                 color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
          저장</button>
        <button onclick="closeFixedExpenseEditor()"
          style="flex:1;padding:12px;border-radius:8px;border:1px solid var(--border);
                 background:var(--surface2);color:var(--text2);font-size:14px;cursor:pointer;
                 font-family:'Noto Sans KR';">취소</button>
      </div>
    </div>`;

  overlay.style.display = 'flex';
  updateFixedTotalPreview();

  // 입력 변경 시 합계 실시간 업데이트
  FIXED_CATEGORIES.forEach(cat => {
    const inp = document.getElementById('fixed-' + cat.id);
    if (inp) inp.addEventListener('input', updateFixedTotalPreview);
  });
}

function updateFixedTotalPreview() {
  let total = 0;
  FIXED_CATEGORIES.forEach(cat => {
    const inp = document.getElementById('fixed-' + cat.id);
    if (inp) total += parseInt(inp.value) || 0;
  });
  const el = document.getElementById('fixed-total-preview');
  if (el) el.textContent = total.toLocaleString() + '원';
}

function saveFixedExpenses() {
  FIXED_CATEGORIES.forEach(cat => {
    const inp = document.getElementById('fixed-' + cat.id);
    const val = parseInt(inp?.value) || 0;
    if (val > 0) budgetState.fixedExpenses[cat.id] = val;
    else delete budgetState.fixedExpenses[cat.id];
  });
  budgetSave();
  closeFixedExpenseEditor();
  renderBudgetPage();
  showToast('✅ 고정지출 저장됨');
}

function closeFixedExpenseEditor() {
  const o = document.getElementById('fixed-expense-popup');
  if (o) o.style.display = 'none';
}

// ══════════════════════════════════════════
// 지출 입력 팝업
// ══════════════════════════════════════════
function openAddExpense(prefillCat) {
  let overlay = document.getElementById('add-expense-popup');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'add-expense-popup';
    overlay.className = 'overlay';
    overlay.onclick = e => { if (e.target === overlay) closeAddExpense(); };
    document.body.appendChild(overlay);
  }

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  overlay.innerHTML = `
    <div class="popup" style="width:380px;padding:22px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:16px;margin:0;">💳 지출 입력</h3>
        <button onclick="closeAddExpense()"
          style="background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;">✕</button>
      </div>

      <!-- 카테고리 선택 -->
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px;">카테고리</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;" id="exp-cat-btns">
          ${VAR_CATEGORIES.map(cat => `
            <button onclick="selExpCat('${cat.id}','${cat.icon}','${cat.label}')" id="expcat-${cat.id}"
              style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);
                     background:${(prefillCat || 'food') === cat.id ? 'rgba(79,124,255,.2)' : 'var(--surface2)'};
                     color:${(prefillCat || 'food') === cat.id ? 'var(--accent)' : 'var(--text2)'};
                     font-size:12px;font-weight:600;cursor:pointer;font-family:'Noto Sans KR';
                     transition:all .15s;">${cat.icon} ${cat.label}</button>`).join('')}
        </div>
      </div>

      <!-- 금액 -->
      <div style="margin-bottom:10px;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px;">금액</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input id="exp-amount-inp" type="number" placeholder="0" min="0" step="100"
            style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:10px 12px;font-size:16px;font-family:'JetBrains Mono';
                   font-weight:700;outline:none;text-align:right;">
          <span style="font-size:13px;color:var(--text2);">원</span>
        </div>
        <!-- 빠른 금액 버튼 -->
        <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">
          ${[1000,3000,5000,10000,30000,50000].map(n=>`
            <button onclick="document.getElementById('exp-amount-inp').value=${n}"
              style="padding:4px 8px;border-radius:5px;border:1px solid var(--border);
                     background:var(--surface2);color:var(--text2);font-size:11px;cursor:pointer;">
              ${n >= 10000 ? (n/10000)+'만' : n.toLocaleString()}</button>`).join('')}
        </div>
      </div>

      <!-- 날짜 -->
      <div style="margin-bottom:10px;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px;">날짜</div>
        <input id="exp-date-inp" type="date" value="${defaultDate}"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:14px;font-family:'Noto Sans KR';outline:none;">
      </div>

      <!-- 메모 -->
      <div style="margin-bottom:16px;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px;">메모 (선택)</div>
        <input id="exp-note-inp" type="text" placeholder="예: 점심, 스타벅스, GS25..."
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:14px;font-family:'Noto Sans KR';outline:none;">
      </div>

      <button onclick="saveExpense()"
        style="width:100%;padding:12px;border-radius:8px;border:none;background:var(--accent);
               color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
        저장</button>
    </div>`;

  overlay.style.display = 'flex';
  window._selExpCat   = prefillCat || 'food';
  window._selExpIcon  = (VAR_CATEGORIES.find(c=>c.id===window._selExpCat)||VAR_CATEGORIES[0]).icon;
  window._selExpLabel = (VAR_CATEGORIES.find(c=>c.id===window._selExpCat)||VAR_CATEGORIES[0]).label;

  setTimeout(() => {
    const amtInp = document.getElementById('exp-amount-inp');
    if (amtInp) amtInp.focus();
  }, 100);
}

function selExpCat(id, icon, label) {
  window._selExpCat   = id;
  window._selExpIcon  = icon;
  window._selExpLabel = label;
  VAR_CATEGORIES.forEach(cat => {
    const btn = document.getElementById('expcat-' + cat.id);
    if (!btn) return;
    btn.style.background = cat.id === id ? 'rgba(79,124,255,.2)' : 'var(--surface2)';
    btn.style.color      = cat.id === id ? 'var(--accent)' : 'var(--text2)';
    btn.style.borderColor= cat.id === id ? 'var(--accent)' : 'var(--border)';
  });
}

function saveExpense() {
  const amount = parseInt(document.getElementById('exp-amount-inp').value) || 0;
  if (amount <= 0) { showToast('⚠️ 금액을 입력해주세요'); return; }

  const dateVal  = document.getElementById('exp-date-inp').value;
  const note     = document.getElementById('exp-note-inp').value.trim();
  const dateParts = dateVal.split('-');
  const y = parseInt(dateParts[0]);
  const m = parseInt(dateParts[1]) - 1;
  const mk = `${y}-${pad2(m + 1)}`;

  budgetLoadMonth(y, m);
  if (!monthExpenses[mk]) monthExpenses[mk] = [];

  monthExpenses[mk].push({
    id:     Date.now(),
    cat:    window._selExpCat  || 'etc',
    icon:   window._selExpIcon || '💳',
    label:  window._selExpLabel || '기타',
    amount,
    date:   `${dateParts[1]}/${dateParts[2]}`,
    note
  });

  budgetSaveMonth(y, m);
  closeAddExpense();
  renderBudgetPage();
  showToast(`✅ ${amount.toLocaleString()}원 지출 기록됨`);
}

function deleteExpense(idx) {
  const mk = `${curY}-${pad2(curM + 1)}`;
  if (!monthExpenses[mk] || idx < 0) return;
  monthExpenses[mk].splice(idx, 1);
  budgetSaveMonth(curY, curM);
  renderBudgetPage();
}

function clearAllExpenses() {
  const mk = `${curY}-${pad2(curM + 1)}`;
  monthExpenses[mk] = [];
  budgetSaveMonth(curY, curM);
  renderBudgetPage();
  showToast('🗑️ 이번달 지출 초기화됨');
}

function closeAddExpense() {
  const o = document.getElementById('add-expense-popup');
  if (o) o.style.display = 'none';
}

// ── 수입/저축 저장 ──
function saveCustomIncome() {
  const val = parseInt(document.getElementById('manual-income-inp')?.value) || 0;
  budgetState.customIncome = val;
  budgetSave();
  renderBudgetPage();
  showToast(val > 0 ? `✅ 수입 ${val.toLocaleString()}원 저장됨` : '✅ 자동계산으로 변경됨');
}

function saveSavingsGoal() {
  const val = parseInt(document.getElementById('savings-goal-inp')?.value) || 0;
  budgetState.savingsGoal = val;
  budgetSave();
  renderBudgetPage();
  showToast(val > 0 ? `🎯 저축 목표 ${val.toLocaleString()}원` : '저축 목표 해제됨');
}

// ══════════════════════════════════════════
// 초기화 (HTML에서 호출)
// ══════════════════════════════════════════
function initBudget() {
  budgetLoad();
}

