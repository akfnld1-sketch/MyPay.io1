// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
let wt   = 'day';
let curY = new Date().getFullYear();
let curM = new Date().getMonth();
let dayData   = {};
let satToggle = {};
let editKey   = null;
let pSt       = 'work';
let p2Sh      = 'day';
let p3Sh      = 'A';
let myShift3  = 'A';  // 3교대 사용자 현재 소속 조 (달력 자동 적용)
let hireDate      = '';      // 입사일 (YYYY-MM-DD)
let leaveOverride = null;   // 사용자가 직접 말한 연차 총량 (null이면 자동계산)
// ── 대화 기억 (키워드 패턴으로 저장) ──
let memName      = null;  // 사용자 이름/호칭 (예: "민준")
let memPayday    = null;  // 급여일 (예: 25)
let memCompany   = null;  // 회사명 (예: "스타벅스")
let memJobTitle  = null;  // 직책 (예: "알바", "파트타이머")
let memHourlyRate = null; // 기억된 시급 (예: 12000)
let chatHistory  = [];    // 최근 대화 맥락 (최대 5개 저장)
let onboardingDone = false; // 온보딩 완료 여부
let onboardingStep = 0;     // 온보딩 단계 (0=미시작, 1=이름묻는중, 2=완료)
let hourlyRate    = CURRENT_MIN_WAGE;  // 법정 최저시급 2026년 기준 (기본급 209h 계산용)
let companyRate   = CURRENT_MIN_WAGE;  // 회사 실제 시급 (OT·야간·휴일 등 추가수당 계산용)
let allowances = {tenure:0,weekly:0,perfect:0,other:0};
let weeklyOn = false;  // 주휴수당 ON/OFF 토글 (기본 OFF)
// 4대보험/세금 직접 수정값 (null이면 자동계산 사용)
let insOverride = {np:null, hi:null, ltc:null, ei:null};
let taxOverride = {income:null, local:null};
let lunchBreak = 1;
const DINNER_BREAK  = 0.5;  // 저녁(주간조 잔업) / 야식(야간·교대) 공제시간 동일 0.5h
const LUNCH_BREAK_H = 1.0;  // 점심 1h (주간 기본)
let dayStart   = 9;
let nightStart = 22;
// 기본급 계산 방식: 'actual' = 실근무시간×시급 | 'fixed' = 209h×시급(고정)
// 사용자 답변: 실근무시간 기준 → 'actual' 고정
const PAY_MODE = 'actual';

// ══════════════════════════════════════════
// 직업 유형 (jobType): 'employee'|'freelancer'|'alba'
// ══════════════════════════════════════════
let jobType = localStorage.getItem('atm2_jobType') || 'employee';

// 프리랜서 스케줄 데이터: { 'YYYY-MM-DD': [{id,type,title,note,alarmTime}] }
let flData = {};

// 알바 기록: { 'YYYY-MM-DD': [{id,name,startH,endH,wage,note,alarmTime}] }
let albaData = {};

// 알람 목록 [{key:'YYYY-MM-DD',time:'HH:MM',label:'...',fired:false}]
let alarmList = [];
let _alarmTick = null;

// ══════════════════════════════════════════
// localStorage - 월 단위 분리 저장
// ══════════════════════════════════════════
// dayData는 월별로 분리: atm2_dd_YYYY_MM
// satToggle, cfg는 기존 단일 키 유지

function ddKey(y, m){ return `atm2_dd_${y}_${pad2(m+1)}`; }

// ══════════════════════════════════════════
// 연차 자동 발생 계산 (근로기준법 제60조)
// ══════════════════════════════════════════
/**
 * 입사일 기준 연차 발생 계산
 * - 1년 미만: 1개월 만근 시 1일 (최대 11일) → 월차
 * - 1년 이상 + 출근율 80% 이상: 기본 15일
 * - 3년 이상: 매 2년마다 1일 가산 (최대 25일)
 * 기준: 2025년 근로기준법 제60조
 */
function calcAnnualLeave(hireDateStr) {
  if (!hireDateStr) return null;
  const hire = new Date(hireDateStr);
  const today = new Date();
  // KST 기준 오늘
  const kst = new Date(today.getTime() + 9*3600*1000);
  const now = new Date(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());

  if (isNaN(hire.getTime())) return null;

  // 근속 개월 수 (정수)
  const diffMs = now - hire;
  const diffDays = Math.floor(diffMs / (1000*60*60*24));
  const diffMonths = Math.floor(diffDays / 30.4375);
  const diffYears = diffDays / 365.25;

  // 근속연수 (정수)
  const yearsInt = Math.floor(diffYears);

  let totalLeave = 0;
  let breakdown = [];

  let isMonthly = false;  // true: 1년 미만 월차, false: 연차
  let monthlyEarned = 0;  // 이번달까지 발생한 월차 수 (1년 미만)

  if (diffYears < 1) {
    isMonthly = true;
    // 1년 미만: 매월 개근 시 1일 (최대 11일)
    const monthLeave = Math.min(diffMonths, 11);
    monthlyEarned = monthLeave;
    totalLeave = monthLeave;
    breakdown.push(`📋 월차 (입사 1년 미만)`);
    breakdown.push(`발생: ${monthLeave}일 (근속 ${diffMonths}개월)`);
    if (monthLeave < 11) {
      breakdown.push(`앞으로 ${11 - monthLeave}일 더 발생 가능`);
    } else {
      breakdown.push(`월차 최대치(11일) 도달`);
    }
  } else {
    isMonthly = false;
    // 1년 이상: 연간 연차
    let annualDays = 15;
    if (yearsInt >= 3) {
      const extraYears = yearsInt - 1;
      const extra = Math.floor(extraYears / 2);
      annualDays = Math.min(15 + extra, 25);
    }
    totalLeave = annualDays;
    breakdown.push(`📋 연차 (입사 ${yearsInt}년 이상)`);
    breakdown.push(`기본 15일${yearsInt >= 3 ? ` + 가산 ${annualDays-15}일` : ''} = ${annualDays}일`);
    if (annualDays < 25) {
      const nextExtra = 15 + Math.floor(yearsInt / 2);
      const nextExtraDays = Math.min(nextExtra, 25);
      if(nextExtraDays > annualDays) breakdown.push(`다음 가산 시 ${nextExtraDays}일 예정`);
    } else {
      breakdown.push(`최대 연차 25일 도달`);
    }
    breakdown.push(`※ 입사 1년차 월차(최대11일)는 별도 부여`);
  }

  // 근속연수별 다음 발생 예고
  let nextInfo = '';
  if (diffYears < 1) {
    // 다음 달 월차 발생일
    const nextMonth = new Date(hire);
    nextMonth.setMonth(nextMonth.getMonth() + diffMonths + 1);
    if (diffMonths < 11) {
      nextInfo = `다음 월차: ${nextMonth.getMonth()+1}월 ${nextMonth.getDate()}일`;
    } else {
      const oneYear = new Date(hire);
      oneYear.setFullYear(oneYear.getFullYear() + 1);
      nextInfo = `1년 연차 발생: ${oneYear.getFullYear()}년 ${oneYear.getMonth()+1}월 ${oneYear.getDate()}일 (15일)`;
    }
  } else {
    const nextAnniv = new Date(hire);
    nextAnniv.setFullYear(hire.getFullYear() + yearsInt + 1);
    let nextDays = 15;
    const nextYears = yearsInt + 1;
    if (nextYears >= 3) nextDays = Math.min(15 + Math.floor((nextYears-1)/2), 25);
    nextInfo = `다음 연차: ${nextAnniv.getFullYear()}년 ${nextAnniv.getMonth()+1}월 ${nextAnniv.getDate()}일 (${nextDays}일)`;
  }

  return {
    totalLeave,
    breakdown,
    nextInfo,
    diffYears,
    yearsInt,
    diffMonths,
    diffDays,
    isMonthly,      // true: 월차 (1년 미만), false: 연차 (1년 이상)
    monthlyEarned,  // 1년 미만 시 현재까지 발생한 월차 수
  };
}

function toggleLeavePanel(){
  const panel = document.getElementById('leave-panel');
  if(!panel) return;
  if(panel.style.display === 'none' || panel.style.display === ''){
    renderLeavePanel();
    panel.style.display = 'block';
    panel.scrollIntoView({behavior:'smooth', block:'nearest'});
  } else {
    panel.style.display = 'none';
  }
}

function renderLeavePanel(){
  const inner = document.getElementById('leave-panel-inner');
  if(!inner) return;

  const result = calcAnnualLeave(hireDate);

  // ── 이번달 연차/반차 사용 현황 ──
  let usedLeave=0, usedHalf=0, usedEarly=0;
  const dim = new Date(curY, curM+1, 0).getDate();
  for(let d=1; d<=dim; d++){
    const key = `${curY}-${pad2(curM+1)}-${pad2(d)}`;
    const data = dayData[key];
    if(!data) continue;
    if(data.status==='leave') usedLeave++;
    if(data.status==='half')  usedHalf++;
    if(data.status==='early') usedEarly++;
  }

  // ── 연간 누적 (1~현재월) ──
  let yearLeave=0, yearHalf=0;
  for(let m=0; m<=curM; m++){
    const dim2 = new Date(curY, m+1, 0).getDate();
    for(let d=1; d<=dim2; d++){
      const key = `${curY}-${pad2(m+1)}-${pad2(d)}`;
      const data = dayData[key];
      if(!data) continue;
      if(data.status==='leave') yearLeave++;
      if(data.status==='half')  yearHalf++;
    }
  }

  // ── 입사연도부터 현재까지 전체 사용 연차 누적 (잔여 계산용) ──
  // 1년 미만: 입사월부터 현재월까지 전 기간 합산
  // 1년 이상: 마지막 연차 발생일(입사 주년일) 이후 사용분만 잔여에서 차감
  let totalUsedLeave=0, totalUsedHalf=0;
  if(result && hireDate){
    const hire = new Date(hireDate);
    if(result.yearsInt < 1){
      // 1년 미만: 입사 월부터 전체 누적
      const startY = hire.getFullYear();
      const startM = hire.getMonth();
      for(let y=startY; y<=curY; y++){
        const mStart = (y===startY) ? startM : 0;
        const mEnd   = (y===curY)   ? curM   : 11;
        for(let m=mStart; m<=mEnd; m++){
          const dim3 = new Date(y, m+1, 0).getDate();
          for(let d=1; d<=dim3; d++){
            const k = `${y}-${pad2(m+1)}-${pad2(d)}`;
            const dd = dayData[k];
            if(!dd) continue;
            if(dd.status==='leave') totalUsedLeave++;
            if(dd.status==='half')  totalUsedHalf++;
          }
        }
      }
    } else {
      // 1년 이상: 가장 최근 연차 발생일(입사 주년일) 이후 사용분
      const lastAnniv = new Date(hire);
      lastAnniv.setFullYear(hire.getFullYear() + result.yearsInt);
      for(let y=lastAnniv.getFullYear(); y<=curY; y++){
        const mStart = (y===lastAnniv.getFullYear()) ? lastAnniv.getMonth() : 0;
        const mEnd   = (y===curY) ? curM : 11;
        for(let m=mStart; m<=mEnd; m++){
          const dim3 = new Date(y, m+1, 0).getDate();
          const dStart = (y===lastAnniv.getFullYear() && m===lastAnniv.getMonth()) ? lastAnniv.getDate() : 1;
          for(let d=dStart; d<=dim3; d++){
            const k = `${y}-${pad2(m+1)}-${pad2(d)}`;
            const dd = dayData[k];
            if(!dd) continue;
            if(dd.status==='leave') totalUsedLeave++;
            if(dd.status==='half')  totalUsedHalf++;
          }
        }
      }
    }
  } else {
    totalUsedLeave = yearLeave;
    totalUsedHalf  = yearHalf;
  }

  // ── 연차 발생 내역 (근로기준법) ──
  let leaveSection = '';
  if(result){
    const { totalLeave, breakdown, nextInfo, yearsInt, diffMonths } = result;
    const remaining = Math.max(0, totalLeave - totalUsedLeave - Math.floor(totalUsedHalf/2));
    const progressPct = totalLeave > 0 ? Math.min(100, Math.round((totalUsedLeave + totalUsedHalf*0.5)/totalLeave*100)) : 0;

    // 월차/연차 구분 배지 색상
    const isM = result.isMonthly;
    const leaveTypeLabel = isM ? '🗓 월차 (1년 미만)' : '🌿 연차 (1년 이상)';
    const leaveColor     = isM ? 'var(--yellow)' : 'var(--green)';
    const leaveBg        = isM ? 'rgba(255,209,102,.07)' : 'rgba(61,214,140,.07)';
    const leaveBorder    = isM ? 'rgba(255,209,102,.3)'  : 'rgba(61,214,140,.25)';
    const leaveBarColor  = isM ? 'var(--yellow)' : 'var(--green)';

    // 월차: 이번달까지 발생한 월차 vs 총 11일 기준 진행률
    const progressTotal  = isM ? 11 : totalLeave;
    const progressUsed   = totalUsedLeave + Math.floor(totalUsedHalf/2);
    const progressPctNew = progressTotal > 0 ? Math.min(100, Math.round(progressUsed/progressTotal*100)) : 0;

    leaveSection = `
    <div style="background:${leaveBg};border:1px solid ${leaveBorder};border-radius:10px;padding:14px 16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:13px;font-weight:700;color:${leaveColor};">${leaveTypeLabel}</div>
        <div style="font-size:11px;background:${leaveBg};border:1px solid ${leaveBorder};border-radius:6px;padding:2px 10px;color:${leaveColor};font-weight:700;">
          ${isM ? `발생 ${totalLeave}일` : `총 ${totalLeave}일`}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:12px;color:var(--text2);">사용 ${progressUsed}일 / 잔여 <b style="color:${leaveColor};font-size:14px;">${remaining}일</b></div>
        <div style="font-size:11px;color:var(--text3);">${progressPctNew}% 사용</div>
      </div>
      <div style="background:var(--surface2);border-radius:4px;height:7px;margin-bottom:10px;overflow:hidden;">
        <div style="background:${leaveBarColor};height:100%;width:${progressPctNew}%;border-radius:4px;transition:width .4s;"></div>
      </div>
      <div style="font-size:11px;color:var(--text3);line-height:1.9;">
        ${breakdown.map((b,i) => {
          if(b.startsWith('📋')) return `<b style="color:${leaveColor};">${b}</b>`;
          return '• ' + b;
        }).join('<br>')}
        <br><span style="color:var(--accent);">📅 ${nextInfo}</span>
      </div>
    </div>`;
  } else {
    leaveSection = `
    <div style="background:rgba(255,209,102,.07);border:1px solid rgba(255,209,102,.25);border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:12px;color:var(--text2);">
      ⚠️ 왼쪽 사이드바에서 <b>입사일을 입력</b>하면 법정 연차 발생일수가 자동 계산됩니다.
    </div>`;
  }

  inner.innerHTML = leaveSection + `
  <!-- 이번달 사용 현황 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px;">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📅 ${curY}년 ${curM+1}월 사용 현황</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;">
      <div style="background:rgba(61,214,140,.08);border:1px solid rgba(61,214,140,.2);border-radius:8px;padding:10px 4px;">
        <div style="font-size:20px;font-weight:700;color:var(--green);">${usedLeave}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px;">${result && result.isMonthly ? '🗓 월차 (일)' : '🌿 연차 (일)'}</div>
      </div>
      <div style="background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.2);border-radius:8px;padding:10px 4px;">
        <div style="font-size:20px;font-weight:700;color:var(--yellow);">${usedHalf}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px;">⏰ 반차 (회)</div>
      </div>
      <div style="background:rgba(255,92,122,.08);border:1px solid rgba(255,92,122,.2);border-radius:8px;padding:10px 4px;">
        <div style="font-size:20px;font-weight:700;color:var(--red);">${usedEarly}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px;">🚶 조퇴 (회)</div>
      </div>
    </div>
  </div>

  <!-- 올해 누적 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📊 ${curY}년 누적 (1월~${curM+1}월)</div>
    <div style="display:flex;gap:12px;">
      <div style="flex:1;text-align:center;background:rgba(61,214,140,.08);border:1px solid rgba(61,214,140,.2);border-radius:8px;padding:10px 4px;">
        <div style="font-size:22px;font-weight:700;color:var(--green);">${yearLeave}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px;">${result && result.isMonthly ? '🗓 월차 합계' : '🌿 연차 합계'}</div>
      </div>
      <div style="flex:1;text-align:center;background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.2);border-radius:8px;padding:10px 4px;">
        <div style="font-size:22px;font-weight:700;color:var(--yellow);">${yearHalf}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px;">⏰ 반차 합계</div>
      </div>
      <div style="flex:1;text-align:center;background:rgba(79,124,255,.08);border:1px solid rgba(79,124,255,.2);border-radius:8px;padding:10px 4px;">
        <div style="font-size:22px;font-weight:700;color:var(--accent);">${(yearLeave + yearHalf*0.5).toFixed(1)}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px;">📋 총 사용일</div>
      </div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:8px;">※ 반차 2회 = 연차 1일 기준</div>
  </div>`;
}

function renderLeaveInfo() {
  const box = document.getElementById('leave-info-box');
  if (!box) return;
  const result = calcAnnualLeave(hireDate);
  if (!result) { box.style.display='none'; return; }

  const { totalLeave, breakdown, nextInfo, yearsInt, diffMonths } = result;
  const yr = yearsInt > 0 ? `${yearsInt}년 ` : '';
  const mo = diffMonths % 12 > 0 ? `${diffMonths % 12}개월` : '';

  const isMonthlyLI = result.isMonthly;
  const leaveIconLI = isMonthlyLI ? '🗓' : '🌿';
  const leaveColorLI = isMonthlyLI ? 'var(--yellow)' : 'var(--green)';
  const leaveTypeLI  = isMonthlyLI ? '월차' : '연차';
  box.innerHTML = `
    <div style="color:${leaveColorLI};font-weight:700;font-size:12px;margin-bottom:4px;">
      ${leaveIconLI} ${leaveTypeLI} ${totalLeave}일 (근속 ${yr}${mo || (yearsInt===0?diffMonths+'개월':'')})
    </div>
    ${breakdown.map(b => b.startsWith('📋')
      ? `<div style="font-size:10px;color:${leaveColorLI};font-weight:700;">${b}</div>`
      : `<div style="font-size:10px;color:var(--text3);">${b}</div>`
    ).join('')}
    <div style="font-size:10px;color:var(--accent);margin-top:3px;">📅 ${nextInfo}</div>
    <div style="font-size:9px;color:var(--text3);margin-top:3px;">※ 근로기준법 제60조 기준 / 출근율 80% 이상 가정</div>
  `;
  box.style.display = 'block';
}

function lsSave(){
  try{
    // ★ v11: 현재 직원 설정 저장
    if(activeWpId && activeEmpId){
      saveGlobalsToActiveEmp();
      attSaveMonth(activeWpId, activeEmpId, curY, curM, dayData);
      // AI 메모리 저장
      const mem = { name: memName, payday: memPayday, company: memCompany, jobTitle: memJobTitle, hourlyRate: memHourlyRate, onboardingDone };
      memSave(activeWpId, activeEmpId, mem);
    }
    localStorage.setItem('atm2_st', JSON.stringify(satToggle));
    if(leaveOverride !== null) localStorage.setItem('atm2_leaveOverride', String(leaveOverride));
    else localStorage.removeItem('atm2_leaveOverride');
    // 채팅 히스토리 (전역)
    localStorage.setItem('atm2_chatHistory', JSON.stringify(chatHistory.slice(-5)));
    // 직업유형 + 프리랜서/알바 데이터
    if(jobType) localStorage.setItem('atm2_jobType', jobType);
    try{ localStorage.setItem('atm2_flData', JSON.stringify(flData)); }catch(e2){}
    try{ localStorage.setItem('atm2_albaData', JSON.stringify(albaData)); }catch(e2){}
    try{ localStorage.setItem('atm2_alarmList', JSON.stringify(alarmList)); }catch(e2){}
    // 수동급여 저장
    if(activeWpId && activeEmpId) localStorage.setItem(PAY_KEY(activeWpId,activeEmpId)+'_manual', JSON.stringify(manualPay));
    // 이번달 예상 실수령액 (다음달 비교용)
    try{
      const pd = getPayData();
      if(pd && pd.finalPay > 0){
        const nextM = curM === 11 ? 0 : curM + 1;
        const nextY = curM === 11 ? curY + 1 : curY;
        localStorage.setItem(`pay_prev_${nextY}_${nextM}`, String(pd.finalPay));
      }
    }catch(e2){}
  }catch(e){}
}

function lsSaveAll(){
  // 전체 dayData를 월별로 분리 저장 (import 후 호출)
  try{
    const months = {};
    Object.keys(dayData).forEach(k=>{
      const [y,m] = k.split('-');
      const mk = `${y}_${m}`;
      if(!months[mk]) months[mk]=[];
      months[mk].push(k);
    });
    Object.keys(months).forEach(mk=>{
      const [y,m] = mk.split('_');
      const mData = {};
      months[mk].forEach(k=>{ mData[k]=dayData[k]; });
      localStorage.setItem(`atm2_dd_${mk}`, JSON.stringify(mData));
    });
    localStorage.setItem('atm2_st',  JSON.stringify(satToggle));
    localStorage.setItem('atm2_cfg', JSON.stringify({
      wt, hourlyRate, companyRate, allowances, lunchBreak, shift3: SHIFT3, weeklyOn, insOverride,
      dayStart, nightStart, myShift3,
      company: document.getElementById('company-input').value,
      hireDate
    }));
  }catch(e){}
}

function lsLoad(){
  try{
    // ★ v11: 현재 직원 근태 데이터 로드
    if(activeWpId && activeEmpId){
      const dd = attLoadMonth(activeWpId, activeEmpId, curY, curM);
      Object.assign(dayData, dd);
      syncActiveEmpToGlobals();
      // 수동급여 로드
      try{ const mp=localStorage.getItem(PAY_KEY(activeWpId,activeEmpId)+'_manual'); if(mp) manualPay=JSON.parse(mp); }catch(e2){}
      // AI 메모리 복원
      try{
        const m = memLoad(activeWpId, activeEmpId);
        if(m){
          if(m.name)        memName       = m.name;
          if(m.company)     memCompany    = m.company;
          if(m.jobTitle)    memJobTitle   = m.jobTitle;
          if(m.hourlyRate)  memHourlyRate = m.hourlyRate;
          if(m.onboardingDone) onboardingDone = m.onboardingDone;
          const _pdSetting = parseInt(localStorage.getItem('payDay_setting') || '0');
          const _pdBudget  = (typeof budgetState !== 'undefined' && budgetState.paydayDay) ? budgetState.paydayDay : 0;
          const _pdMem     = m.payday ? parseInt(m.payday) : 0;
          memPayday = _pdSetting || _pdBudget || _pdMem || null;
          if(memPayday){
            if(typeof budgetState !== 'undefined') budgetState.paydayDay = memPayday;
            localStorage.setItem('payDay_setting', String(memPayday));
          }
        }
      }catch(e2){}
    }
    const st = localStorage.getItem('atm2_st'); if(st) satToggle=JSON.parse(st);
    const mp=localStorage.getItem('atm2_manual'); if(mp && !manualPay) manualPay=JSON.parse(mp); // 레거시 fallback
    const lov=localStorage.getItem('atm2_leaveOverride');
    leaveOverride = lov !== null ? parseFloat(lov) : null;
    // 채팅 히스토리 복원
    try{
      const rawHist = localStorage.getItem('atm2_chatHistory');
      if(rawHist) chatHistory = JSON.parse(rawHist);
    }catch(e3){}
    // 프리랜서/알바/알람 복원
    try{ const fd=localStorage.getItem('atm2_flData'); if(fd) flData=JSON.parse(fd); }catch(e4){}
    try{ const ad=localStorage.getItem('atm2_albaData'); if(ad) albaData=JSON.parse(ad); }catch(e5){}
    try{ const al=localStorage.getItem('atm2_alarmList'); if(al) alarmList=JSON.parse(al); }catch(e6){}
    // 저장된 로고 복원
    const wp = wpGet(activeWpId);
    const savedLogo = wp?.logo || localStorage.getItem('companyLogo');
    if(savedLogo){
      const img = document.getElementById('logo-img');
      if(img){ img.src=savedLogo; img.style.display='block'; }
      const ph = document.getElementById('logo-ph');
      if(ph) ph.style.display='none';
      const favicon = document.getElementById('favicon-link');
      if(favicon) favicon.href = savedLogo;
      const appleIconR = document.getElementById('apple-icon-link');
      if(appleIconR) appleIconR.href = savedLogo;
      updateManifest(savedLogo);
    }
  }catch(e){}
}

function lsLoadMonth(y, m){
  // ★ v11: 현재 직원의 해당 월 데이터 로드
  try{
    if(activeWpId && activeEmpId){
      const newData = attLoadMonth(activeWpId, activeEmpId, y, m);
      // 현재 dayData에서 해당 월 키만 교체
      const ym = `${y}-${pad2(m+1)}`;
      Object.keys(dayData).forEach(k=>{ if(k.startsWith(ym+'-')) delete dayData[k]; });
      Object.assign(dayData, newData);
      return;
    }
    // 레거시 fallback
    const dd = localStorage.getItem(`atm2_dd_${y}_${pad2(m+1)}`);
    if(dd){ const parsed=JSON.parse(dd); Object.assign(dayData, parsed); }
  }catch(e){}
  // 해당 월 공휴일 자동 적용 (기존 기록 없는 날만)
  autoApplyHolidays(y, m);
}

function autoApplyHolidays(y, m){
  const dim = new Date(y, m+1, 0).getDate();
  for(let d=1; d<=dim; d++){
    const key = dk(y, m, d);
    const hName = HOLIDAYS[key];
    if(hName && (!dayData[key] || !dayData[key].status || dayData[key].status==='none')){
      dayData[key] = { status:'public', note:hName };
    }
  }
}

// ══════════════════════════════════════════
// JSON Export / Import
// ══════════════════════════════════════════
function resetAllData(){
  if(!confirm('⚠️ 모든 데이터를 초기화할까요?\n\n• 근태 기록 (전체 월)\n• 급여 설정 (시급·수당 등)\n• 회사명 및 로고\n• 저장된 모든 설정\n\n이 작업은 되돌릴 수 없습니다.')) return;

  // localStorage에서 atm2_ 관련 키 전체 삭제
  const keysToDelete = [];
  for(let i=0; i<localStorage.length; i++){
    const k = localStorage.key(i);
    if(k && (k.startsWith('atm2_') || k === 'companyLogo')) keysToDelete.push(k);
  }
  keysToDelete.forEach(k => localStorage.removeItem(k));

  // 변수 초기값으로 리셋
  Object.keys(dayData).forEach(k => delete dayData[k]);
  Object.keys(manualPay).forEach(k => delete manualPay[k]);
  Object.keys(satToggle).forEach(k => delete satToggle[k]);
  hourlyRate   = CURRENT_MIN_WAGE;
  companyRate  = CURRENT_MIN_WAGE;
  weeklyOn     = false;
  lunchBreak   = 1;
  wt           = 'day';
  dayStart     = 9;
  nightStart   = 22;
  myShift3     = 'A';
  allowances   = {tenure:0, weekly:0, perfect:0, other:0};
  insOverride  = {np:null, hi:null, ltc:null, ei:null};
  taxOverride  = {income:null, local:null};
  // customShift 초기화
  if(typeof customShift !== 'undefined'){
    customShift = { day:{start:9,end:18}, night:{start:22,end:6}, shift2day:{start:8,end:20}, shift2night:{start:20,end:8}, shift3a:{start:6,end:14}, shift3b:{start:14,end:22}, shift3c:{start:22,end:6} };
    initCustomShiftSelects && initCustomShiftSelects();
  }
  // bgIdx 초기화 (흰색)
  bgIdx = 0; applyBg(0, false); renderBgPalette && renderBgPalette();

  // 회사명 초기화
  const ci = document.getElementById('company-input');
  if(ci) ci.value = '주식회사 VibeWork';

  // 로고 초기화
  const logoImg = document.getElementById('logo-img');
  if(logoImg){ logoImg.src=''; logoImg.style.display='none'; }
  const logoPh = document.getElementById('logo-ph');
  if(logoPh) logoPh.style.display='';

  // favicon 초기화
  const favicon = document.getElementById('favicon-link');
  if(favicon) favicon.href='';
  const appleIcon = document.getElementById('apple-icon-link');
  if(appleIcon) appleIcon.href='';

  // UI 재렌더링
  renderCalendar();
  if(document.getElementById('salary-page').style.display !== 'none') renderSalary();

  showToast('✅ 초기화 완료! 모든 데이터가 리셋됐습니다.');
}

function exportData(){
  // localStorage 전체 근태 데이터 수집
  const allData = {};
  for(let i=0; i<localStorage.length; i++){
    const k = localStorage.key(i);
    if(k && k.startsWith('atm2_')){
      try{ allData[k] = JSON.parse(localStorage.getItem(k)); }catch(e){ allData[k]=localStorage.getItem(k); }
    }
  }
  // 현재 메모리 dayData도 병합
  allData['__dayData_live'] = dayData;
  allData['__satToggle_live'] = satToggle;
  allData['__exportedAt'] = new Date().toISOString();
  allData['__version'] = '2.0';

  const json = JSON.stringify(allData, null, 2);
  const company = (document.getElementById('company-input').value || '근태관리').replace(/[/\\:*?"<>|]/g,'');
  const now = new Date();
  const date = now.toISOString().slice(0,10);
  const time = pad2(now.getHours()) + pad2(now.getMinutes());
  const fileName = `${company}_근태백업_${date}_${time}.json`;

  // iOS Safari 감지
  const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  if(isIOS || isSafari){
    // iOS/Safari: 새 창에 JSON 텍스트 표시 → 길게 누르기 → 저장 안내
    const win = window.open('', '_blank');
    if(win){
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>${fileName}</title>
        <style>
          body{font-family:-apple-system,sans-serif;padding:16px;background:#f5f5f5;}
          h2{font-size:16px;margin-bottom:8px;color:#333;}
          p{font-size:13px;color:#666;margin-bottom:12px;line-height:1.6;}
          .box{background:#fff;border-radius:10px;padding:12px;border:1px solid #ddd;}
          pre{font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto;}
          .copy-btn{display:block;width:100%;padding:13px;background:#4f7cff;color:#fff;
            border:none;border-radius:10px;font-size:15px;font-weight:700;margin-bottom:10px;cursor:pointer;}
        </style></head><body>
        <h2>💾 근태 데이터 백업</h2>
        <p>📋 아래 방법으로 저장하세요:<br>
        ① <b>복사 버튼</b>을 눌러 복사<br>
        ② 메모장·카카오톡 나에게 보내기에 붙여넣기 후 저장</p>
        <button class="copy-btn" onclick="
          navigator.clipboard.writeText(document.getElementById('jd').textContent)
            .then(()=>{ this.textContent='✅ 복사 완료!'; this.style.background='#1a9e5c'; })
            .catch(()=>{ this.textContent='❌ 복사 실패 - 텍스트 직접 선택하세요'; });
        ">📋 전체 복사</button>
        <div class="box"><pre id="jd">${json.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></div>
        </body></html>`);
      win.document.close();
    } else {
      // 팝업 차단된 경우 - 클립보드 복사 시도
      if(navigator.clipboard){
        navigator.clipboard.writeText(json)
          .then(()=> showToast('📋 백업 데이터가 클립보드에 복사됐습니다. 메모장에 붙여넣어 저장하세요.'))
          .catch(()=> showToast('⚠️ 팝업이 차단됐습니다. 브라우저 설정에서 팝업을 허용해주세요.'));
      }
    }
    return;
  }

  // Android Chrome / 데스크탑: 파일 직접 다운로드
  try{
    const blob = new Blob([json], {type:'application/json;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    // revokeObjectURL을 딜레이 후 실행 (모바일 다운로드 보장)
    setTimeout(()=>{ URL.revokeObjectURL(url); document.body.removeChild(a); }, 3000);
    showToast('💾 백업 파일 다운로드 중...');
  }catch(err){
    // 최후 수단: 데이터 URI
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=> document.body.removeChild(a), 1000);
    showToast('💾 백업 파일 저장 중...');
  }
}

function openImportDialog(){
  const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  if(isIOS || isSafari){
    // iOS/Safari: 텍스트 붙여넣기 팝업
    let overlay = document.getElementById('import-paste-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'import-paste-overlay';
      overlay.className = 'overlay';
      overlay.onclick = e=>{ if(e.target===overlay) overlay.style.display='none'; };
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="popup" style="width:380px;padding:22px 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h3 style="font-size:16px;margin:0;">📂 백업 데이터 복원</h3>
          <button onclick="document.getElementById('import-paste-overlay').style.display='none'"
            style="background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;">✕</button>
        </div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:12px;line-height:1.7;">
          백업 시 복사한 JSON 데이터를 아래에 붙여넣어 주세요.<br>
          <span style="font-size:11px;color:var(--text3);">카카오톡·메모장에서 백업 텍스트를 복사 후 붙여넣기</span>
        </div>
        <textarea id="import-paste-area"
          placeholder='{"__version":"2.0", ...} 형식의 JSON 붙여넣기'
          style="width:100%;height:140px;background:var(--surface2);border:1px solid var(--border);
                 color:var(--text);border-radius:8px;padding:10px 12px;font-size:12px;
                 font-family:'JetBrains Mono';outline:none;resize:none;"></textarea>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button onclick="importFromPaste()"
            style="flex:1;padding:12px;border-radius:8px;border:none;background:var(--accent);
                   color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
            ✅ 복원하기</button>
          <button onclick="document.getElementById('import-inp2').click()"
            style="flex:1;padding:12px;border-radius:8px;border:1px solid var(--border);
                   background:var(--surface2);color:var(--text2);font-size:13px;cursor:pointer;font-family:'Noto Sans KR';">
            📁 파일 선택</button>
        </div>
      </div>`;
    overlay.style.display = 'flex';
    setTimeout(()=>{ const ta=document.getElementById('import-paste-area'); if(ta) ta.focus(); }, 200);
  } else {
    // 안드로이드/데스크탑: 파일 선택
    document.getElementById('import-inp').click();
  }
}

function importFromPaste(){
  const ta = document.getElementById('import-paste-area');
  if(!ta || !ta.value.trim()){ showToast('⚠️ 붙여넣을 데이터가 없습니다.'); return; }
  const fakeEvent = {
    target: {
      files: [new Blob([ta.value], {type:'application/json'})],
      value: ''
    }
  };
  // Blob을 File처럼 다루기 위해 직접 파싱
  const text = ta.value.trim();
  document.getElementById('import-paste-overlay').style.display = 'none';
  // importData 로직 재사용
  try{
    const fakeFile = new File([text], 'restore.json', {type:'application/json'});
    const dt = new DataTransfer();
    dt.items.add(fakeFile);
    const inp = document.getElementById('import-inp');
    inp.files = dt.files;
    importData({target:{files:[fakeFile], value:''}});
  }catch(e){
    // DataTransfer 미지원 시 직접 처리
    const reader = new FileReader();
    reader.onload = ev => importData({target:{files:[{...ev}], result:text, value:''}});
    // 직접 텍스트로 파싱
    try{
      const allData = JSON.parse(text);
      const fakeEv = { target: { result: text, files: [], value:'' } };
      // FileReader.onload 흉내
      (function(){
        const ev = { target: { result: text } };
        importData({ target: { files: [{ name:'paste.json' }], value:'' } });
        // 실제로는 아래 직접 호출
      })();
    }catch(e2){}
    // 가장 단순한 방법으로 직접 처리
    directImport(text);
  }
}

function directImport(text){
  try{
    const allData = JSON.parse(text);
    if(!allData || typeof allData !== 'object'){ showToast('❌ 올바른 백업 데이터가 아닙니다.'); return; }
    // importData와 동일 로직 - localStorage에 직접 쓰기
    Object.keys(allData).forEach(k => {
      if(k.startsWith('atm2_') || k.startsWith('pay_prev_') || k === 'companyLogo'){
        try{ const v=allData[k]; localStorage.setItem(k, typeof v==='string'?v:JSON.stringify(v)); }catch(e2){}
      }
    });
    dayData = {};
    if(allData.__dayData_live) Object.assign(dayData, allData.__dayData_live);
    Object.keys(allData).forEach(k=>{ if(k.startsWith('atm2_dd_')&&typeof allData[k]==='object') Object.assign(dayData, allData[k]); });
    if(allData.__satToggle_live) satToggle = allData.__satToggle_live;
    let cfg={};
    try{ cfg = typeof allData.atm2_cfg==='string'?JSON.parse(allData.atm2_cfg):allData.atm2_cfg||{}; }catch(e2){}
    if(cfg.wt) wt=cfg.wt;
    if(cfg.hourlyRate) hourlyRate=cfg.hourlyRate;
    if(cfg.lunchBreak!==undefined) lunchBreak=cfg.lunchBreak;
    if(cfg.allowances) allowances=Object.assign({tenure:0,weekly:0,perfect:0,other:0},cfg.allowances);
    if(cfg.company){ const ci=document.getElementById('company-input'); if(ci) ci.value=cfg.company; }
    if(cfg.hireDate){ hireDate=cfg.hireDate; const hi=document.getElementById('hire-date-inp'); if(hi) hi.value=hireDate; }
    if(allData.atm2_flData){ try{ flData=typeof allData.atm2_flData==='string'?JSON.parse(allData.atm2_flData):allData.atm2_flData; }catch(e2){} }
    if(allData.atm2_albaData){ try{ albaData=typeof allData.atm2_albaData==='string'?JSON.parse(allData.atm2_albaData):allData.atm2_albaData; }catch(e2){} }
    document.querySelectorAll('.wt-btn').forEach(b=>b.classList.remove('active'));
    const wb=document.getElementById('wt-'+wt); if(wb) wb.classList.add('active');
    const li=document.getElementById('lunch-inp'); if(li) li.value=lunchBreak;
    try{ updateLegend(); }catch(e2){}
    try{ renderCalendar(); }catch(e2){}
    try{ renderLeaveInfo(); }catch(e2){}
    showToast('✅ 복원 완료!');
  }catch(err){ showToast('❌ 복원 실패: '+err.message); }
}

function importData(e){
  const file = e.target.files[0];
  if(!file){ return; }

  const reader = new FileReader();
  reader.onload = ev => {
    try{
      const text = ev.target.result;
      if(!text || text.trim() === ''){ showToast('❌ 파일이 비어있습니다.'); return; }

      let allData;
      try{ allData = JSON.parse(text); }
      catch(pe){ showToast('❌ JSON 파싱 실패: 파일이 손상됐습니다.'); return; }

      // ── 버전 체크 (느슨하게) ──
      if(!allData || typeof allData !== 'object'){
        showToast('❌ 올바른 백업 파일이 아닙니다.'); return;
      }

      // ── 1. localStorage에 atm2_ 키 전체 직접 복원 (가장 중요) ──
      Object.keys(allData).forEach(k => {
        if(k.startsWith('atm2_') || k.startsWith('pay_prev_') || k.startsWith('companyLogo')){
          try{
            const v = allData[k];
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          }catch(e2){}
        }
      });

      // ── 2. dayData 메모리 복원 ──
      dayData = {};
      if(allData.__dayData_live && typeof allData.__dayData_live === 'object'){
        // 신버전: 라이브 스냅샷
        Object.assign(dayData, allData.__dayData_live);
      }
      // 월별 키에서도 병합 (구버전 + 신버전 모두)
      Object.keys(allData).forEach(k => {
        if(k.startsWith('atm2_dd_') && typeof allData[k] === 'object'){
          Object.assign(dayData, allData[k]);
        }
      });

      // ── 3. satToggle 복원 ──
      if(allData.__satToggle_live) satToggle = allData.__satToggle_live;
      else if(allData.atm2_st){
        try{ satToggle = typeof allData.atm2_st === 'string' ? JSON.parse(allData.atm2_st) : allData.atm2_st; }catch(e2){}
      }

      // ── 4. 설정값 복원 ──
      let cfg = {};
      if(allData.atm2_cfg){
        try{ cfg = typeof allData.atm2_cfg === 'string' ? JSON.parse(allData.atm2_cfg) : allData.atm2_cfg; }catch(e2){}
      }
      if(cfg.wt){ wt = cfg.wt; }
      if(cfg.hourlyRate) hourlyRate = cfg.hourlyRate;
      if(cfg.companyRate) companyRate = cfg.companyRate;
      if(cfg.lunchBreak !== undefined) lunchBreak = cfg.lunchBreak;
      if(cfg.allowances) allowances = Object.assign({tenure:0,weekly:0,perfect:0,other:0}, cfg.allowances);
      if(cfg.hireDate){ hireDate = cfg.hireDate; }
      if(cfg.weeklyOn !== undefined) weeklyOn = cfg.weeklyOn;
      if(cfg.SHIFT3 || cfg.shift3){ SHIFT3 = cfg.SHIFT3 || cfg.shift3; }
      if(cfg.dayStart !== undefined) dayStart = cfg.dayStart;
      if(cfg.nightStart !== undefined) nightStart = cfg.nightStart;
      if(cfg.insOverride) insOverride = cfg.insOverride;
      if(cfg.taxOverride) taxOverride = cfg.taxOverride;

      // ── 5. 회사명·로고 복원 ──
      if(cfg.company){
        const ci = document.getElementById('company-input');
        if(ci) ci.value = cfg.company;
      }
      if(hireDate){
        const hi = document.getElementById('hire-date-inp');
        if(hi) hi.value = hireDate;
      }

      // ── 6. UI 동기화 ──
      document.querySelectorAll('.wt-btn').forEach(b => b.classList.remove('active'));
      const wtBtn = document.getElementById('wt-' + wt);
      if(wtBtn) wtBtn.classList.add('active');
      const lunchInp = document.getElementById('lunch-inp');
      if(lunchInp) lunchInp.value = lunchBreak;

      // ── 7. 프리랜서/알바 데이터 복원 ──
      if(allData.atm2_flData){
        try{ flData = typeof allData.atm2_flData === 'string' ? JSON.parse(allData.atm2_flData) : allData.atm2_flData; }catch(e2){}
      }
      if(allData.atm2_albaData){
        try{ albaData = typeof allData.atm2_albaData === 'string' ? JSON.parse(allData.atm2_albaData) : allData.atm2_albaData; }catch(e2){}
      }
      if(allData.atm2_alarmList){
        try{ alarmList = typeof allData.atm2_alarmList === 'string' ? JSON.parse(allData.atm2_alarmList) : allData.atm2_alarmList; }catch(e2){}
      }

      // ── 8. manualPay 복원 ──
      if(allData.atm2_manual){
        try{ manualPay = typeof allData.atm2_manual === 'string' ? JSON.parse(allData.atm2_manual) : allData.atm2_manual; }catch(e2){}
      }

      // ── 9. 로고 복원 ──
      const savedLogo = allData.companyLogo || localStorage.getItem('companyLogo');
      if(savedLogo){
        try{
          const img = document.getElementById('logo-img');
          if(img){ img.src = savedLogo; img.style.display = 'block'; }
          const ph = document.getElementById('logo-ph');
          if(ph) ph.style.display = 'none';
        }catch(e2){}
      }

      // ── 10. 전체 재렌더링 ──
      try{ updateLegend(); }catch(e2){}
      try{ initStartSelects(); }catch(e2){}
      try{ openAccForWT(wt); }catch(e2){}
      try{ renderCalendar(); }catch(e2){}
      try{ renderLeaveInfo(); }catch(e2){}

      showToast('✅ 복원 완료! 모든 데이터가 불러와졌습니다.');
    }catch(err){
      showToast('❌ 복원 실패: ' + err.message);
      console.error('Import error:', err);
    }
    e.target.value = ''; // 같은 파일 재선택 가능하게
  };
  reader.onerror = () => showToast('❌ 파일 읽기 실패');
  reader.readAsText(file, 'utf-8');
}

// ══════════════════════════════════════════
// 공휴일 DB (2024~2027 대한민국)
// ══════════════════════════════════════════
const HOLIDAYS = {
  // 2024
  '2024-01-01':'신정','2024-02-09':'설날 연휴','2024-02-10':'설날',
  '2024-02-11':'설날 연휴','2024-02-12':'대체공휴일','2024-03-01':'삼일절',
  '2024-04-10':'국회의원선거','2024-05-05':'어린이날','2024-05-06':'대체공휴일',
  '2024-05-15':'부처님오신날','2024-06-06':'현충일','2024-08-15':'광복절',
  '2024-09-16':'추석 연휴','2024-09-17':'추석','2024-09-18':'추석 연휴',
  '2024-10-03':'개천절','2024-10-09':'한글날','2024-12-25':'크리스마스',
  // 2025
  '2025-01-01':'신정','2025-01-28':'설날 연휴','2025-01-29':'설날',
  '2025-01-30':'설날 연휴','2025-03-01':'삼일절','2025-03-03':'대체공휴일',
  '2025-05-05':'어린이날','2025-05-06':'부처님오신날','2025-06-06':'현충일',
  '2025-08-15':'광복절','2025-10-03':'개천절','2025-10-05':'추석 연휴',
  '2025-10-06':'추석','2025-10-07':'추석 연휴','2025-10-08':'대체공휴일',
  '2025-10-09':'한글날','2025-12-25':'크리스마스',
  // 2026
  '2026-01-01':'신정','2026-02-16':'설날 연휴','2026-02-17':'설날',
  '2026-02-18':'설날 연휴','2026-03-01':'삼일절','2026-03-02':'대체공휴일',
  '2026-05-05':'어린이날','2026-05-24':'부처님오신날','2026-06-06':'현충일',
  '2026-08-15':'광복절','2026-08-17':'대체공휴일','2026-09-24':'추석 연휴',
  '2026-09-25':'추석','2026-09-26':'추석 연휴','2026-10-03':'개천절',
  '2026-10-09':'한글날','2026-12-25':'크리스마스',
  // 2027
  '2027-01-01':'신정','2027-02-06':'설날 연휴','2027-02-07':'설날',
  '2027-02-08':'설날 연휴','2027-03-01':'삼일절','2027-05-05':'어린이날',
  '2027-05-13':'부처님오신날','2027-06-06':'현충일','2027-08-15':'광복절',
  '2027-08-16':'대체공휴일','2027-09-14':'추석 연휴','2027-09-15':'추석',
  '2027-09-16':'추석 연휴','2027-10-03':'개천절','2027-10-04':'대체공휴일',
  '2027-10-09':'한글날','2027-12-25':'크리스마스',
};

function applyHolidays(){
  const y=curY, m=curM;
  const dim=new Date(y,m+1,0).getDate();
  let cnt=0;
  for(let d=1;d<=dim;d++){
    const key=dk(y,m,d);
    const hName = HOLIDAYS[key];
    if(hName){
      // 이미 다른 상태(출근 등)가 있으면 덮어쓰지 않음
      if(!dayData[key]||!dayData[key].status||dayData[key].status==='none'){
        dayData[key]={ status:'public', note:hName };
        cnt++;
      }
    }
  }
  lsSave();
  renderCalendar();
  showToast(cnt>0 ? `🗓️ ${cnt}개 공휴일을 표시했습니다.` : '이번 달 신규 공휴일 없음 (이미 적용됨)');
}

