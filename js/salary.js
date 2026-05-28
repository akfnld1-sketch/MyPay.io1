// 주휴수당 계산 (한국 노동법 기준)
// ══════════════════════════════════════════
/**
 * getWeeklyHolidayData: 월 단위 주휴수당 자동 계산
 *
 * 주휴수당 발생 조건 (근로기준법 제55조)
 * 1. 1주 소정근로시간 합계 >= 15시간
 * 2. 해당 주 소정근로일 결근 없이 개근
 *
 * 처리 기준
 * - 월~일 단위로 주를 구분
 * - 소정근로일: work/early/half/sat_work/sun_work 상태인 날
 * - 결근(absent)/무단결근(absent) 포함 시 해당 주 주휴 미발생
 * - 연차(leave)는 개근으로 인정 (소정근로일 충족으로 처리)
 * - 법정공휴일(public)은 소정근로일 아님
 * - 주휴수당 = 시급 × 8h
 */
function getWeeklyHolidayData(){
  const y = curY, m = curM;
  const dim = new Date(y, m+1, 0).getDate();

  // 이 달의 모든 날짜를 월~일 기준 주차 그룹으로 묶기
  // 각 주는 {weekNo, days:[{d, status, net}], totalH, hasAbsent, hasWork}
  const weeks = [];
  let weekMap = {}; // weekKey → week index

  for(let d = 1; d <= dim; d++){
    const date = new Date(y, m, d);
    const dow  = date.getDay(); // 0=일, 1=월 ... 6=토

    // ISO 주차 번호 (월요일 시작 기준)
    // 해당 날짜의 월요일 날짜를 key로 사용
    const monday = new Date(date);
    monday.setDate(d - (dow === 0 ? 6 : dow - 1));
    const weekKey = monday.toISOString().slice(0,10);

    if(!weekMap.hasOwnProperty(weekKey)){
      weekMap[weekKey] = weeks.length;
      weeks.push({
        weekKey,
        weekLabel: `${monday.getMonth()+1}/${monday.getDate()}주`,
        days: [],
        totalH: 0,
        hasAbsent: false,
        workDayCount: 0,   // 소정근로일(출근 기록 있는 날)
        plannedDays: 0,    // 해당 주 중 이번 달에 포함된 날 수
        holidayOk: false,  // 주휴 발생 여부
        amount: 0
      });
    }

    const wi   = weekMap[weekKey];
    const week = weeks[wi];
    const key  = dk(y, m, d);
    const data = dayData[key];
    const s    = data ? data.status : 'none';

    week.plannedDays++;

    // 근무 시간 계산 대상 상태
    const workStates = ['work','early','half','sat_work','sun_work'];
    if(workStates.includes(s)){
      const net = calcNetHours(data.start, data.end, s, data.shift);
      week.totalH += net;
      week.workDayCount++;
      week.days.push({d, dow, status:s, net});
    } else if(s === 'leave'){
      // 연차: 개근 인정, 8h로 계산
      week.totalH += 8;
      week.workDayCount++;
      week.days.push({d, dow, status:s, net:8});
    } else if(s === 'absent'){
      // 결근: 개근 실패 → 주휴 미발생
      week.hasAbsent = true;
      week.days.push({d, dow, status:s, net:0});
    } else {
      week.days.push({d, dow, status:s, net:0});
    }
  }

  // 각 주 주휴 발생 여부 판정
  let totalWeeklyAmt = 0;
  const weeklyAmt = hourlyRate * 8;
  const qualifiedWeeks = [];

  weeks.forEach(week => {
    // 조건 1: 주 총 근무시간 >= 15h
    const cond1 = week.totalH >= 15;
    // 조건 2: 결근 없음
    const cond2 = !week.hasAbsent;
    // 조건 3: 실제 근무 기록이 있는 주 (빈 주 제외)
    const cond3 = week.workDayCount > 0;

    week.holidayOk = cond1 && cond2 && cond3;
    week.cond1 = cond1;
    week.cond2 = cond2;
    week.amount = week.holidayOk ? weeklyAmt : 0;

    if(week.holidayOk){
      totalWeeklyAmt += weeklyAmt;
      qualifiedWeeks.push(week.weekLabel);
    }
  });

  return {
    weeks,
    totalWeeklyAmt,
    qualifiedWeeks,
    weeklyAmt,   // 1회 주휴수당
    qualCount: qualifiedWeeks.length
  };
}
// ══════════════════════════════════════════
// 급여 계산
// ══════════════════════════════════════════
function getPayData(){
  const y=curY, m=curM;
  const dim=new Date(y,m+1,0).getDate();
  const twd=countWD(y,m);

  let wDays=0, lDays=0, halfDays=0, absDays=0;
  let normalH=0;   // 기본 근무시간 (8h 이내, 수당 미포함)
  let totOT=0;     // 연장근무시간 (8h 초과)
  let nightH=0;    // 야간시간 (22~06시, 기본/연장 포함)
  let holidayH=0, satH=0, sunH=0;
  let earlyDeduct=0;

  let lateDeduct = 0;   // 지각 공제 (30분 단위)
  let lateCount  = 0;   // 지각 횟수

  for(let d=1;d<=dim;d++){
    const key=dk(y,m,d);
    const data=dayData[key];
    if(!data||!data.status||data.status==='none') continue;
    const s=data.status;
    const net=calcNetHours(data.start,data.end,s,data.shift);

    if(s==='work'||s==='early') wDays++;
    if(s==='half'){ wDays++; halfDays++; }
    if(s==='leave') lDays++;
    if(s==='absent') absDays++;

    // 기본시간 / OT 분리 (work, early)
    if(s==='work'||s==='early'){
      const ot = Math.max(0, net-8);
      totOT   += ot;
      normalH += net - ot;
    }
    if(s==='half') normalH += 4;

    // 야간시간
    if(['work','early','sat_work','sun_work','holiday'].includes(s)){
      nightH += calcNight(data.start, data.end);
    }

    if(s==='holiday') holidayH += net;
    if(s==='sat_work') satH += net;
    if(s==='sun_work') sunH += net;

    // ── 조퇴 공제: 8h 미달 시간 × 시급 ──
    if(s==='early'){
      const shortage = Math.max(0, 8 - net);
      earlyDeduct += shortage * hourlyRate;
    }

    // ── 지각 공제: 주간(day) 근무 + 출근시각이 dayStart 초과 시 30분 단위 올림 공제 ──
    // 예) dayStart=9, 출근=9:01(9.0166) → 지각 0.0166h → 올림 0.5h 공제 → -5,160원
    //     dayStart=9, 출근=9:30(9.5)   → 지각 0.5h   → 0.5h 공제       → -5,160원
    //     dayStart=9, 출근=9:31(9.5166)→ 지각 0.5166h → 올림 1.0h 공제  → -10,320원
    // ★ 주간(day) 근무만 적용 (야간·교대근무 제외)
    if(wt==='day' && (s==='work'||s==='early') && data.start !== undefined && data.start !== null){
      // 실제 출근시각이 업무시작(dayStart)보다 늦을 때만 지각
      if(data.start > dayStart){
        const lateRaw = data.start - dayStart;          // 실제 지각 시간(h)
        const lateRnd = Math.ceil(lateRaw / 0.5) * 0.5; // 30분 단위 올림
        lateDeduct += lateRnd * hourlyRate;
        lateCount++;
      }
    }
  }

  // ── 기본급: 시급 × 209h (고정, 주휴 포함) ──
  const BASE_HOURS = 209;
  const basePay = hourlyRate * BASE_HOURS;

  // ── 공제: 결근·조퇴·지각만 공제 (연차/반차/공휴일은 유급 처리) ──
  const dLeave   = 0;   // 연차: 유급 → 공제 없음
  const dHalf    = 0;   // 반차: 유급 → 공제 없음
  const dAbsent  = absDays * 8 * hourlyRate;  // 결근: 8h 공제
  const dEarly   = earlyDeduct;               // 조퇴: 미달시간 공제
  const dLate    = lateDeduct;               // 지각: 30분 단위 공제
  const totDeduct = dAbsent + dEarly + dLate;

  // ── 수당: companyRate(회사 실제 시급) 기준, 10원 단위 반올림 ──
  const r10 = function(n){ return Math.round(n/10)*10; };
  const aOT      = r10(totOT    * companyRate * 1.5);
  const aNight   = r10(nightH   * companyRate * 0.5);
  const aHoliday = r10(holidayH * companyRate * 2.0);
  const aSat     = r10(satH     * companyRate * 1.5);
  const aSun     = r10(sunH     * companyRate * 2.0);

  const isPerfect = wDays>=twd;
  const perfAmt   = isPerfect?(allowances.perfect||0):0;

  // 주휴수당: ON이면 사용자 입력값 사용, OFF면 0
  const aWeeklyManual = weeklyOn ? (allowances.weekly||0) : 0;
  const totAllow = aOT+aNight+aHoliday+aSat+aSun
                  +(allowances.tenure||0)
                  +aWeeklyManual
                  +perfAmt+(allowances.other||0);
  // companyRate 참조 (리턴에 포함)
  const _companyRate = companyRate;

  const grossPay = basePay + totAllow - totDeduct;
  const netPay   = grossPay;
  // 자동계산 후 override 적용
  const _ins = calc4Insurance(grossPay);
  const _tax = calcIncomeTax(grossPay);
  const ins = {
    np  : insOverride.np   !== null ? insOverride.np   : _ins.np,
    hi  : insOverride.hi   !== null ? insOverride.hi   : _ins.hi,
    ltc : insOverride.ltc  !== null ? insOverride.ltc  : _ins.ltc,
    ei  : insOverride.ei   !== null ? insOverride.ei   : _ins.ei,
    // auto: 자동계산값 (입력 필드 placeholder용)
    _np: _ins.np, _hi: _ins.hi, _ltc: _ins.ltc, _ei: _ins.ei,
  };
  ins.total = ins.np + ins.hi + ins.ltc + ins.ei;
  const tax = {
    income : taxOverride.income !== null ? taxOverride.income : _tax.income,
    local  : taxOverride.local  !== null ? taxOverride.local  : _tax.local,
    _income: _tax.income, _local: _tax.local,
  };
  tax.total = tax.income + tax.local;
  const finalPay = Math.max(0, grossPay - ins.total - tax.total);

  // ── 주휴수당 자동체크 (발생 여부 표시용 - 실제 급여에는 이미 포함) ──
  // 209h 기본급에 이미 주휴 포함 → 별도 금액 가산 없음, UI 표시용으로만 사용
  const wd = getWeeklyHolidayData();
  const aWeeklyHoliday = 0;  // 이미 기본급에 포함
  const totAllowWithWH = totAllow;
  const netPayWithWH   = grossPay;
  const grossPayWithWH = grossPay;
  const insWH  = ins;
  const taxWH  = tax;
  const finalPayWithWH = finalPay;

  return {basePay, normalH, twd, wDays, lDays, halfDays, absDays,
    totOT, nightH, holidayH, satH, sunH,
    dLeave, dHalf, dAbsent, dEarly, dLate, lateCount, totDeduct,
    aOT, aNight, aHoliday, aSat, aSun, aWeeklyManual, totAllow, _companyRate,
    netPay, grossPay, ins, tax, finalPay, isPerfect, perfAmt,
    wd, aWeeklyHoliday, totAllowWithWH,
    netPayWithWH, grossPayWithWH, insWH, taxWH, finalPayWithWH,
    BASE_HOURS};
}

function fmt(n){ return Math.round(n).toLocaleString('ko-KR')+'원'; }

// ══════════════════════════════════════════
// 4대보험 + 근로소득세 계산
// ══════════════════════════════════════════
// ── 연도별 4대보험 요율 테이블 (매년 업데이트) ──
const INS_TABLE = {
  2024: { NP:0.045, HI:0.03545, LTC_RATE:0.1295, EI:0.009, NP_MIN:370000, NP_MAX:5900000 },
  2025: { NP:0.045, HI:0.03545, LTC_RATE:0.1295, EI:0.009, NP_MIN:390000, NP_MAX:6170000 },
  2026: { NP:0.045, HI:0.03545, LTC_RATE:0.1295, EI:0.009, NP_MIN:400000, NP_MAX:6370000 }, // 2026 확정
};
// 현재 연도 요율 자동 선택 (테이블에 없으면 가장 최신 연도 사용)
function getInsRate(year) {
  if (INS_TABLE[year]) return INS_TABLE[year];
  const years = Object.keys(INS_TABLE).map(Number).sort((a,b)=>b-a);
  return INS_TABLE[years[0]];
}
const _curInsYear = new Date().getFullYear(); // 현재 연도 자동 적용 (2026 기준)
const _ins = getInsRate(_curInsYear);
const INS = { NP: _ins.NP, HI: _ins.HI, EI: _ins.EI };
const NP_MIN_SALARY = _ins.NP_MIN;
const NP_MAX_SALARY = _ins.NP_MAX;
const LTC_RATE      = _ins.LTC_RATE;

/**
 * calc4Insurance(grossPay)
 * grossPay: 총급여 (기본급 + 수당 합계, 근태공제 전)
 * 반환: { np, hi, ltc, ei, total, 각 항목 요율 표시용 }
 */
function calc4Insurance(grossPay){
  const gp = Math.round(grossPay);

  // 국민연금: 기준소득월액 상·하한 적용
  const npBase = Math.min(Math.max(gp, NP_MIN_SALARY), NP_MAX_SALARY);
  const np  = Math.round(npBase * INS.NP);

  // 건강보험
  const hi  = Math.round(gp * INS.HI);

  // 장기요양보험 = 건강보험료 × LTC_RATE (연도별)
  const ltc = Math.round(hi * LTC_RATE);

  // 고용보험
  const ei  = Math.round(gp * INS.EI);

  const total = np + hi + ltc + ei;
  return { np, hi, ltc, ei, total };
}

/**
 * calcIncomeTax(grossPay)
 * 근로소득세 간이세액표 기반 (비과세 없는 경우, 공제대상 가족 1인 기준)
 * 실무상 정확한 값은 국세청 간이세액표 조회이나,
 * 여기서는 근사식(과세표준 구간별 세율)을 적용
 */
function calcIncomeTax(grossPay){
  // 월 근로소득세 = (총급여 - 비과세) 기준 간이세액표 근사
  // 비과세: 식대 20만원 등 → 여기선 간단하게 총급여 기준
  const gp = Math.round(grossPay);

  // 연간 과세 급여 추정 (월×12)
  const annualGross = gp * 12;

  // 근로소득공제 계산 (소득세법 제47조)
  let wageDeduction = 0;
  if(annualGross <= 5000000)        wageDeduction = annualGross * 0.70;
  else if(annualGross <= 15000000)  wageDeduction = 3500000 + (annualGross - 5000000) * 0.40;
  else if(annualGross <= 45000000)  wageDeduction = 7500000 + (annualGross - 15000000) * 0.15;
  else if(annualGross <= 100000000) wageDeduction = 12000000 + (annualGross - 45000000) * 0.05;
  else                              wageDeduction = 14750000 + (annualGross - 100000000) * 0.02;
  // 공제 한도: 2,000만원
  wageDeduction = Math.min(wageDeduction, 20000000);

  // 근로소득금액
  const incomeAmt = annualGross - wageDeduction;

  // 인적공제: 본인 1인 → 150만원
  const personalDeduction = 1500000;

  // 과세표준
  const taxBase = Math.max(0, incomeAmt - personalDeduction);

  // 종합소득세율 (2024년 기준)
  let annualTax = 0;
  if(taxBase <= 14000000)       annualTax = taxBase * 0.06;
  else if(taxBase <= 50000000)  annualTax = 840000  + (taxBase - 14000000) * 0.15;
  else if(taxBase <= 88000000)  annualTax = 6240000 + (taxBase - 50000000) * 0.24;
  else if(taxBase <= 150000000) annualTax = 15360000+ (taxBase - 88000000) * 0.35;
  else if(taxBase <= 300000000) annualTax = 37060000+ (taxBase - 150000000)* 0.38;
  else if(taxBase <= 500000000) annualTax = 94060000+ (taxBase - 300000000)* 0.40;
  else                          annualTax = 174060000+(taxBase - 500000000)* 0.42;

  // 근로소득세액공제 (산출세액의 55~66%)
  let taxCredit = 0;
  if(annualTax <= 1300000)      taxCredit = annualTax * 0.55;
  else                          taxCredit = 715000 + (annualTax - 1300000) * 0.30;
  taxCredit = Math.min(taxCredit, 740000);

  const annualIncomeTax = Math.max(0, annualTax - taxCredit);

  // 월 근로소득세 = 연간 ÷ 12 (원 단위 반올림, 10원 단위)
  const monthlyTax = Math.round(annualIncomeTax / 12 / 10) * 10;

  // 지방소득세 = 근로소득세의 10%
  const localTax = Math.round(monthlyTax * 0.10 / 10) * 10;

  return { income: monthlyTax, local: localTax, total: monthlyTax + localTax };
}

// ══════════════════════════════════════════
// 연간 대시보드
// ══════════════════════════════════════════

// 특정 연·월의 dayData를 localStorage에서 가져와 급여 계산
function getPayDataForMonth(y, m){
  // 해당 월 dayData 수집 (메모리 + localStorage)
  const mData = {};
  const prefix = `${y}-${pad2(m+1)}-`;
  // 메모리에 있는 것 먼저
  Object.keys(dayData).forEach(k=>{ if(k.startsWith(prefix)) mData[k]=dayData[k]; });
  // localStorage에서 추가 로드
  try{
    const stored = localStorage.getItem(`atm2_dd_${y}_${pad2(m+1)}`);
    if(stored){ const p=JSON.parse(stored); Object.keys(p).forEach(k=>{ if(!mData[k]) mData[k]=p[k]; }); }
    // 구형 단일 키 호환
    const old = localStorage.getItem('atm2_dd');
    if(old){ const p=JSON.parse(old); Object.keys(p).forEach(k=>{ if(k.startsWith(prefix)&&!mData[k]) mData[k]=p[k]; }); }
  }catch(e){}

  const dim = new Date(y,m+1,0).getDate();
  const twd = countWD(y,m);
  let wDays=0,lDays=0,halfDays=0,absDays=0;
  let normalH=0,totOT=0,nightH=0,holidayH=0,satH=0,sunH=0,earlyDeduct=0;

  for(let d=1;d<=dim;d++){
    const key=`${y}-${pad2(m+1)}-${pad2(d)}`;
    const data=mData[key];
    if(!data||!data.status||data.status==='none') continue;
    const s=data.status;
    const net=calcNetHours(data.start,data.end,s,data.shift);
    if(s==='work'||s==='early') wDays++;
    if(s==='half'){ wDays++; halfDays++; }
    if(s==='leave') lDays++;
    if(s==='absent') absDays++;
    if(s==='work'||s==='early'){
      const ot=Math.max(0,net-8);
      totOT+=ot; normalH+=net-ot;
    }
    if(s==='half') normalH+=4;
    if(['work','early','sat_work','sun_work','holiday','public'].includes(s)) nightH+=calcNight(data.start,data.end);
    if(s==='holiday'||s==='public') holidayH+=net;
    if(s==='sat_work') satH+=net;
    if(s==='sun_work') sunH+=net;
    if(s==='early'){ const shortage=Math.max(0,8-net); earlyDeduct+=shortage*hourlyRate; }
  }

  const basePay   = hourlyRate * 209;  // 209h 고정 (getPayData와 동일)
  const dLeave    = lDays*8*hourlyRate;
  const dHalf     = halfDays*4*hourlyRate;
  const dAbsent   = absDays*8*hourlyRate;
  const totDeduct = dLeave+dHalf+dAbsent+earlyDeduct;
  const aOT       = totOT    * companyRate * 1.5;
  const aNight    = nightH   * companyRate * 0.5;
  const aHoliday  = holidayH * companyRate * 2.0;
  const aSat      = satH     * companyRate * 1.5;
  const aSun      = sunH     * companyRate * 2.0;
  const isPerfect = wDays>=twd;
  const perfAmt   = isPerfect?(allowances.perfect||0):0;
  const totAllow  = aNight+aOT+aHoliday+aSat+aSun+(allowances.tenure||0)+(allowances.weekly||0)+perfAmt+(allowances.other||0);
  const netPay    = basePay+totAllow-totDeduct;
  const totalWorkH= Object.keys(mData).reduce((sum,k)=>{
    const dd=mData[k]; if(!dd||!dd.status) return sum;
    return sum+calcNetHours(dd.start,dd.end,dd.status,dd.shift);
  },0);

  return { wDays, lDays, absDays, totOT, nightH, satH, sunH,
           basePay, totAllow, totDeduct, netPay, totalWorkH, twd, isPerfect };
}

let dashYear = new Date().getFullYear();
// 월별 실수령 직접 입력값: key = "YYYY-MM" → 숫자(원)
let manualPay = {};

function saveManualPay(ym, val){
  const n = parseInt(val.replace(/,/g,''))||0;
  if(n===0) delete manualPay[ym];
  else manualPay[ym]=n;
  lsSave();
  renderDash();
}

function renderDash(){
  const y = dashYear;
  const nowY = new Date().getFullYear();
  const nowM = new Date().getMonth(); // 0-indexed
  const months = [];
  for(let m=0;m<12;m++) months.push(getPayDataForMonth(y,m));

  // 월별 실제 지급액: 직접입력 우선, 없으면 앱 계산값
  // 미래 월은 앱 계산값만 (참고용)
  const MO_KO_S = ['1','2','3','4','5','6','7','8','9','10','11','12'];
  const isPastOrNow = (m) => y < nowY || (y === nowY && m <= nowM);

  const payList = months.map((d,m)=>{
    const ym = `${y}-${pad2(m+1)}`;
    const manual = manualPay[ym];
    const auto = d.netPay;
    const actual = manual !== undefined ? manual : auto;
    const hasManual = manual !== undefined;
    const isFuture = y > nowY || (y === nowY && m > nowM);
    return { m, ym, manual, auto, actual, hasManual, isFuture, d };
  });

  // 누적 연봉 (1월부터 현재까지 실지급 합산)
  const cumulativePay = payList
    .filter(p => !p.isFuture)
    .reduce((s,p) => s + p.actual, 0);

  // 연간 전체 예상 합산 (미래는 앱 계산값)
  const annualEstimate = payList.reduce((s,p) => s + p.actual, 0);

  // 연간 집계 (앱 계산 기반)
  const ann = {
    workH:  months.reduce((s,d)=>s+d.totalWorkH,0),
    OT:     months.reduce((s,d)=>s+d.totOT,0),
    night:  months.reduce((s,d)=>s+d.nightH,0),
    sat:    months.reduce((s,d)=>s+d.satH,0),
    sun:    months.reduce((s,d)=>s+d.sunH,0),
    leave:  months.reduce((s,d)=>s+d.lDays,0),
    absent: months.reduce((s,d)=>s+d.absDays,0),
    perfect:months.filter(d=>d.isPerfect).length,
  };

  const maxActual = Math.max(...payList.map(p=>p.actual), 1);
  const maxH = Math.max(...months.map(d=>d.totalWorkH), 1);

  // 분기별
  const quarters = [0,1,2,3].map(q=>{
    const ps = payList.slice(q*3,(q+1)*3);
    return {
      net: ps.reduce((s,p)=>s+p.actual,0),
      h:   months.slice(q*3,(q+1)*3).reduce((s,d)=>s+d.totalWorkH,0),
      hasData: ps.some(p=>!p.isFuture)
    };
  });

  // 월별 행 - 막대는 실제 데이터 있을 때만 표시
  const barRows = payList.map(({m, ym, actual, auto, hasManual, isFuture, d})=>{
    const pct  = actual>0        ? (actual/maxActual*100).toFixed(1)      : 0;
    const hpct = d.totalWorkH>0  ? (d.totalWorkH/maxH*100).toFixed(1)    : 0;
    const isNow     = (m===nowM && y===nowY);
    const manualVal = manualPay[ym]||'';
    const tagColor  = hasManual ? 'var(--yellow)' : (isFuture ? 'var(--text3)' : 'var(--green)');
    const tagText   = hasManual ? '직접' : (isFuture ? '예상' : '자동');
    const cumul     = payList.slice(0,m+1).filter(p=>!p.isFuture).reduce((s,p)=>s+p.actual,0);
    const hasData   = actual>0 || d.totalWorkH>0;

    const barHTML = hasData ? `
        <div style="height:14px;background:rgba(79,124,255,.12);border-radius:3px;overflow:hidden;margin-bottom:2px;">
          <div style="height:100%;width:${pct}%;background:${hasManual?'linear-gradient(90deg,#ffd166,#ff8c42)':'linear-gradient(90deg,var(--accent),var(--accent2))'};border-radius:3px;transition:width .5s;"></div>
        </div>
        <div style="height:7px;background:rgba(61,214,140,.1);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${hpct}%;background:rgba(61,214,140,.45);border-radius:2px;transition:width .5s;"></div>
        </div>` :
      `<div style="height:23px;display:flex;align-items:center;"><span style="font-size:10px;color:var(--text3);">명세서를 입력하면 막대가 표시됩니다</span></div>`;

    return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);">
      <div style="width:26px;font-size:11px;font-weight:700;color:${isNow?'var(--accent)':'var(--text2)'};">${MO_KO_S[m]}월</div>
      <div style="flex:1;min-width:0;">${barHTML}</div>
      <div style="position:relative;width:110px;">
        <input type="text"
          placeholder="${isFuture?'앱 계산: '+(auto>0?auto.toLocaleString():'0')+'원':'명세서 입력'}"
          value="${manualVal?manualVal.toLocaleString():''}"
          style="width:100%;background:${hasManual?'rgba(255,209,102,.1)':'var(--surface2)'};border:1px solid ${hasManual?'var(--yellow)':'var(--border)'};color:var(--text);border-radius:6px;padding:4px 7px;font-size:11px;font-family:'JetBrains Mono';font-weight:700;outline:none;text-align:right;"
          onchange="saveManualPay('${ym}',this.value)">
        <span style="position:absolute;top:-8px;right:2px;font-size:9px;font-weight:700;color:${tagColor};">${tagText}</span>
      </div>
      <div style="width:34px;text-align:right;font-size:10px;color:var(--text3);">${d.totalWorkH>0?d.totalWorkH+'h':'-'}</div>
      <div style="width:80px;text-align:right;font-size:10px;color:var(--text3);">누적 ${cumul>0?fmtK(cumul):'-'}</div>
    </div>`;
  }).join('');

  document.getElementById('dash-page').innerHTML = `
  <!-- 헤더 -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
    <div>
      <h2 style="font-size:20px;font-weight:700;">💰 ${y}년 연봉 현황</h2>
      <div style="font-size:11px;color:var(--text3);margin-top:3px;">직접 입력(노란색) 우선 · 미입력 시 앱 자동계산</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <button onclick="dashYear--;renderDash()" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:15px;cursor:pointer;">◀</button>
      <span style="font-size:16px;font-weight:700;min-width:60px;text-align:center;">${y}년</span>
      <button onclick="dashYear++;renderDash()" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:15px;cursor:pointer;">▶</button>
    </div>
  </div>

  <!-- 연봉 메인 카드 -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
    <div style="background:linear-gradient(135deg,rgba(61,214,140,.15),rgba(79,124,255,.1));border:1px solid var(--green);border-radius:var(--radius);padding:20px;text-align:center;">
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">📥 ${y}년 실수령 누적 (${y===nowY?nowM+1:12}월까지)</div>
      <div style="font-size:32px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);">${fmtK(cumulativePay)}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px;">직접입력 + 자동계산 합산</div>
    </div>
    <div style="background:linear-gradient(135deg,rgba(255,209,102,.1),rgba(255,140,66,.08));border:1px solid rgba(255,209,102,.4);border-radius:var(--radius);padding:20px;text-align:center;">
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">📊 ${y}년 예상 연봉 (12개월)</div>
      <div style="font-size:32px;font-weight:900;font-family:'JetBrains Mono';color:var(--yellow);">${fmtK(annualEstimate)}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px;">미래 월은 앱 계산값 기준</div>
    </div>
  </div>

  <!-- KPI 카드 -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px;">
    ${kpiCard('월 평균 실수령', fmtK(Math.round(cumulativePay/Math.max(payList.filter(p=>!p.isFuture).length,1))), 'var(--green)', '실지급 월 기준')}
    ${kpiCard('총 근무시간', ann.workH+'h', 'var(--accent)', '휴게 공제 후')}
    ${kpiCard('총 OT', ann.OT+'h', 'var(--yellow)', '평일 연장')}
    ${kpiCard('야간근무', ann.night+'h', 'var(--cyan)', '22~06시')}
    ${kpiCard('토요특근', ann.sat+'h', 'var(--sat)', '합계')}
    ${kpiCard('일요특근', ann.sun+'h', 'var(--sun)', '합계')}
    ${kpiCard('연차', ann.leave+'일', 'var(--green)', '사용 합계')}
    ${kpiCard('결근', ann.absent+'일', 'var(--red)', '합계')}
    ${kpiCard('만근', ann.perfect+'개월', 'var(--yellow)', '12개월 중')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
    <!-- 분기별 -->
    <div class="sal-section">
      <h3>📅 분기별 합산</h3>
      ${[0,1,2,3].map(q=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04);">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text2);">Q${q+1} · ${q*3+1}~${q*3+3}월</div>
            <div style="font-size:10px;color:var(--text3);">${quarters[q].h}h</div>
          </div>
          <div style="font-size:16px;font-weight:700;font-family:'JetBrains Mono';color:${quarters[q].hasData?'var(--green)':'var(--text3)'};">
            ${quarters[q].hasData?fmtK(quarters[q].net):'-'}
          </div>
        </div>`).join('')}
    </div>
    <!-- 입력 안내 -->
    <div class="sal-section">
      <h3>✏️ 직접입력 안내</h3>
      <div style="font-size:12px;color:var(--text2);line-height:1.9;">
        매월 <b style="color:var(--yellow)">실제 명세서</b>를 받으면<br>
        아래 표의 해당 월 칸에 입력하세요.<br><br>
        입력한 값은 <b style="color:var(--yellow)">노란 배경</b>으로 표시되며<br>
        앱 자동계산보다 <b style="color:var(--green)">우선 적용</b>됩니다.<br><br>
        <span style="color:var(--text3);font-size:11px;">입력값 지우면 자동계산으로 복귀</span>
      </div>
    </div>
  </div>

  <!-- 연간 차트 -->
  <div class="sal-section" style="margin-bottom:16px;">
    <h3>📈 월별 실수령액 추이</h3>
    <div style="position:relative;height:220px;" id="pay-chart-wrap">
      <canvas id="annual-pay-chart"></canvas>
      <div id="pay-chart-offline" style="display:none;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;color:var(--text3);font-size:13px;">
        <span style="font-size:28px;">📊</span>
        오프라인 상태 — 인터넷 연결 후 차트 표시
      </div>
    </div>
  </div>

  <div class="sal-section" style="margin-bottom:16px;">
    <h3>⏱️ 월별 근무시간 추이</h3>
    <div style="position:relative;height:180px;" id="hour-chart-wrap">
      <canvas id="annual-hour-chart"></canvas>
      <div id="hour-chart-offline" style="display:none;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:13px;">
        오프라인 — 차트 불가 (수치는 아래 표에서 확인)
      </div>
    </div>
  </div>

  <!-- 월별 상세 -->
  <div class="sal-section">
    <h3>📋 월별 급여 상세</h3>
    <div style="display:flex;gap:12px;margin-bottom:10px;font-size:10px;color:var(--text3);flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:5px;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:2px;display:inline-block;"></span>자동계산</div>
      <div style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:5px;background:linear-gradient(90deg,#ffd166,#ff8c42);border-radius:2px;display:inline-block;"></span>직접입력</div>
      <div style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:5px;background:rgba(61,214,140,.45);border-radius:2px;display:inline-block;"></span>근무시간</div>
      <span style="color:var(--accent);font-weight:700;">← 노란 칸에 실제 수령액 입력</span>
    </div>
    ${barRows}
  </div>`;

  // ── Chart.js 차트 렌더링 ──
  requestAnimationFrame(() => {
    const MO_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const payVals   = payList.map(p => Math.round(p.actual / 10000));   // 만원 단위
    const hourVals  = months.map(d => Math.round(d.totalWorkH * 10) / 10);
    const otVals    = months.map(d => Math.round(d.totOT * 10) / 10);
    const bgColors  = payList.map(p => p.hasManual
      ? 'rgba(255,209,102,0.7)' : p.isFuture
      ? 'rgba(79,124,255,0.2)'
      : 'rgba(79,124,255,0.6)'
    );
    const borderColors = payList.map(p => p.hasManual
      ? 'rgba(255,209,102,1)' : p.isFuture
      ? 'rgba(79,124,255,0.4)'
      : 'rgba(79,124,255,1)'
    );

    // Chart.js 오프라인 체크
    if(typeof Chart === 'undefined' || window._chartFailed){
      ['pay-chart-wrap','hour-chart-wrap'].forEach(id=>{
        const wrap = document.getElementById(id);
        if(wrap){
          const canvas = wrap.querySelector('canvas');
          const msg = wrap.querySelector('[id$="-offline"]');
          if(canvas) canvas.style.display='none';
          if(msg) msg.style.display='flex';
        }
      });
      return; // 차트 렌더 건너뜀
    }

    const chartDefaults = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#a8b3cf', font: { size: 11 } } },
                 tooltip: { backgroundColor: '#1e2230', borderColor: '#3a4060', borderWidth: 1,
                            titleColor: '#e2e8ff', bodyColor: '#a8b3cf' } },
      scales: {
        x: { ticks: { color: '#a8b3cf', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#a8b3cf', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    };

    // ① 실수령액 차트 (막대 + 선)
    const payCtx = document.getElementById('annual-pay-chart');
    if(payCtx && typeof Chart !== 'undefined') {
      if(payCtx._chartInst) payCtx._chartInst.destroy();
      payCtx._chartInst = new Chart(payCtx, {
        data: {
          labels: MO_LABELS,
          datasets: [
            {
              type: 'bar', label: '실수령액 (만원)',
              data: payVals,
              backgroundColor: bgColors, borderColor: borderColors,
              borderWidth: 1.5, borderRadius: 4,
              yAxisID: 'y'
            },
            {
              type: 'line', label: '추이선',
              data: payVals.map((v,i) => payList[i].isFuture ? null : v),
              borderColor: 'rgba(61,214,140,0.8)', backgroundColor: 'rgba(61,214,140,0.08)',
              pointBackgroundColor: 'rgba(61,214,140,1)', pointRadius: 4, pointHoverRadius: 6,
              tension: 0.35, fill: true, spanGaps: false,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          ...chartDefaults,
          scales: {
            ...chartDefaults.scales,
            y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks,
              callback: v => v + '만' } }
          }
        }
      });
    }

    // ② 근무시간 차트 (막대 + OT 선)
    const hourCtx = document.getElementById('annual-hour-chart');
    if(hourCtx && typeof Chart !== 'undefined') {
      if(hourCtx._chartInst) hourCtx._chartInst.destroy();
      hourCtx._chartInst = new Chart(hourCtx, {
        data: {
          labels: MO_LABELS,
          datasets: [
            {
              type: 'bar', label: '총 근무 (h)',
              data: hourVals,
              backgroundColor: 'rgba(61,214,140,0.4)', borderColor: 'rgba(61,214,140,0.8)',
              borderWidth: 1.5, borderRadius: 4, yAxisID: 'y'
            },
            {
              type: 'line', label: 'OT (h)',
              data: otVals,
              borderColor: 'rgba(255,209,102,0.9)', backgroundColor: 'rgba(255,209,102,0.08)',
              pointBackgroundColor: 'rgba(255,209,102,1)', pointRadius: 3, pointHoverRadius: 5,
              tension: 0.35, fill: false, yAxisID: 'y2'
            }
          ]
        },
        options: {
          ...chartDefaults,
          scales: {
            x: chartDefaults.scales.x,
            y:  { ...chartDefaults.scales.y, position: 'left',
                  ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + 'h' } },
            y2: { ...chartDefaults.scales.y, position: 'right', grid: { drawOnChartArea: false },
                  ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + 'h', color: 'rgba(255,209,102,0.8)' } }
          }
        }
      });
    }
  });
}

function kpiCard(label, value, color, sub){
  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;">
    <div style="font-size:10px;color:var(--text3);margin-bottom:6px;">${label}</div>
    <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono';color:${color};">${value}</div>
    <div style="font-size:9px;color:var(--text3);margin-top:3px;">${sub}</div>
  </div>`;
}
function annRow(label, value, color){
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);">
    <span style="font-size:13px;color:var(--text2);">${label}</span>
    <span style="font-size:15px;font-weight:700;font-family:'JetBrains Mono';color:${color};">${value}</span>
  </div>`;
}
function fmtK(n){
  // 만원 단위 표시 (100만 이상은 백만원 단위)
  const abs=Math.abs(Math.round(n));
  if(abs>=100000000) return (n/100000000).toFixed(1)+'억원';
  if(abs>=10000000)  return Math.round(n/1000000)+'백만원';
  if(abs>=1000000)   return (n/1000000).toFixed(1)+'백만원';
  return Math.round(n).toLocaleString('ko-KR')+'원';
}

// ══════════════════════════════════════════

// ══════════════════════════════════════════
// 통합 수입관리 페이지
// 직장인 급여 + N잡(알바/배달/프리) 통합 표시
// ══════════════════════════════════════════
function renderIncomePage(){
  const page = document.getElementById('salary-page');
  if(!page) return;

  const _p = n => String(n).padStart(2,'0');
  const dim = new Date(curY, curM+1, 0).getDate();

  // ── 직장인 급여 ──
  let employeePay = 0;
  let employeeData = null;
  try{
    const d = getPayData();
    if(d && d.finalPay > 0){ employeePay = d.finalPay; employeeData = d; }
  }catch(e){}

  // ── N잡 달력 데이터 집계 ──
  let albaItems=[], delivItems=[], freeItems=[];
  for(let d=1;d<=dim;d++){
    const key=`${curY}-${_p(curM+1)}-${_p(d)}`;
    try{
      const raw=localStorage.getItem('atm2_njob_'+key);
      if(!raw) continue;
      const nj=JSON.parse(raw);
      (nj.alba||[]).forEach(it=>albaItems.push({...it, date:`${curM+1}/${d}`}));
      (nj.delivery||[]).forEach(it=>delivItems.push({...it, date:`${curM+1}/${d}`}));
      (nj.free||[]).forEach(it=>freeItems.push({...it, date:`${curM+1}/${d}`}));
    }catch(e){}
  }

  const albaGross    = albaItems.reduce((s,it)=>s+(it.amount||Math.round((it.wage||0)*(it.hours||0))),0);
  const delivGross   = delivItems.reduce((s,it)=>s+(it.count||0)*(it.price||0),0);
  const freeGross    = freeItems.reduce((s,it)=>s+(it.count||0)*(it.price||0),0);
  const njobGross    = albaGross + delivGross + freeGross;
  const njobTax      = Math.round(njobGross * 0.033);
  const njobNet      = njobGross - njobTax;

  const totalNet = employeePay + njobNet;
  const hasEmployee = employeePay > 0;
  const hasNjob = njobGross > 0;

  page.innerHTML = `
  <!-- 헤더 -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
    <div>
      <h2 style="font-size:20px;font-weight:700;">💰 ${curY}년 ${curM+1}월 수입관리</h2>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">달력 기록 자동 집계 · 직장+N잡 통합</div>
    </div>
    <div style="display:flex;gap:6px;">
      <button onclick="showPage('att')"
        style="padding:7px 12px;border-radius:8px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text2);font-size:12px;
               cursor:pointer;font-family:'Noto Sans KR';">📅 달력으로</button>
    </div>
  </div>

  <!-- 총 실수령 큰 카드 -->
  <div style="background:linear-gradient(135deg,rgba(61,214,140,.15),rgba(79,124,255,.08));
              border:1px solid rgba(61,214,140,.3);border-radius:14px;padding:18px 20px;margin-bottom:14px;">
    <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">이번달 총 실수령액</div>
    <div style="font-size:30px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);">
      ${totalNet.toLocaleString()}원
    </div>
    ${totalNet === 0 ? `
    <div style="font-size:12px;color:var(--text3);margin-top:6px;">
      달력에서 근태/수입을 기록하면 자동으로 집계됩니다
    </div>` : `
    <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;">
      ${hasEmployee?`<div style="font-size:12px;color:var(--text2);">🏢 직장 <b style="color:var(--accent)">${employeePay.toLocaleString()}원</b></div>`:''}
      ${hasNjob?`<div style="font-size:12px;color:var(--text2);">💼 N잡 <b style="color:var(--orange)">${njobNet.toLocaleString()}원</b></div>`:''}
    </div>`}
  </div>

  ${hasEmployee ? `
  <!-- 직장인 급여 섹션 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              margin-bottom:10px;overflow:hidden;">
    <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.acc-arr').textContent=this.nextElementSibling.style.display==='none'?'▼':'▲'"
      style="display:flex;align-items:center;justify-content:space-between;
             padding:12px 16px;cursor:pointer;background:rgba(79,124,255,.06);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">🏢</span>
        <span style="font-size:13px;font-weight:700;color:var(--accent);">직장 급여</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;font-weight:700;color:var(--accent);">${employeePay.toLocaleString()}원</span>
        <span class="acc-arr" style="font-size:12px;color:var(--text3);">▼</span>
      </div>
    </div>
    <div style="display:none;padding:14px 16px;">
      ${employeeData ? `
      <div style="display:flex;flex-direction:column;gap:5px;">
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:12px;color:var(--text2);">기본급</span>
          <span style="font-size:12px;font-weight:700;color:var(--text);">${(employeeData.basePay||0).toLocaleString()}원</span>
        </div>
        ${(employeeData.totAllow||0)>0?`
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:12px;color:var(--text2);">각종 수당</span>
          <span style="font-size:12px;font-weight:700;color:var(--green);">+${(employeeData.totAllow||0).toLocaleString()}원</span>
        </div>`:''}
        ${(employeeData.totDeduct||0)>0?`
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:12px;color:var(--text2);">4대보험+세금</span>
          <span style="font-size:12px;font-weight:700;color:var(--red);">-${(employeeData.totDeduct||0).toLocaleString()}원</span>
        </div>`:''}
        <div style="display:flex;justify-content:space-between;padding:7px 0;">
          <span style="font-size:13px;font-weight:700;color:var(--text);">실수령</span>
          <span style="font-size:15px;font-weight:700;color:var(--green);">${employeePay.toLocaleString()}원</span>
        </div>
      </div>
      <button onclick="if(typeof renderSalary==='function'){renderSalary();document.getElementById('salary-page').scrollTop=0;}"
        style="width:100%;margin-top:10px;padding:8px;border-radius:8px;border:1px solid var(--border);
               background:var(--surface2);color:var(--text2);font-size:12px;cursor:pointer;
               font-family:'Noto Sans KR';">📊 급여 상세분석 보기</button>
      ` : '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px;">근태 기록 후 자동 계산됩니다</div>'}
    </div>
  </div>` : ''}

  ${albaItems.length>0 ? `
  <!-- 알바 섹션 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              margin-bottom:10px;overflow:hidden;">
    <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.acc-arr').textContent=this.nextElementSibling.style.display==='none'?'▼':'▲'"
      style="display:flex;align-items:center;justify-content:space-between;
             padding:12px 16px;cursor:pointer;background:rgba(255,140,66,.06);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">⏰</span>
        <span style="font-size:13px;font-weight:700;color:var(--orange);">알바 수입</span>
        <span style="font-size:11px;color:var(--text3);">${albaItems.length}건</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;font-weight:700;color:var(--orange);">${Math.round(albaGross*0.967).toLocaleString()}원</span>
        <span class="acc-arr" style="font-size:12px;color:var(--text3);">▼</span>
      </div>
    </div>
    <div style="display:none;padding:14px 16px;">
      ${albaItems.map(it=>{
        const amt = it.amount||Math.round((it.wage||0)*(it.hours||0));
        const night = it.nightHours>0?` <span style="font-size:10px;background:rgba(79,124,255,.15);color:var(--accent);padding:1px 4px;border-radius:3px;">야간포함</span>`:'';
        return `<div style="display:flex;justify-content:space-between;align-items:center;
                    padding:7px 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);">${it.name||'알바'}${night}</div>
            <div style="font-size:11px;color:var(--text3);">${it.date} · ${it.startTime||''}${it.endTime?'~'+it.endTime:''} · ${it.detail||it.hours+'h'}</div>
          </div>
          <span style="font-size:13px;font-weight:700;color:var(--orange);">+${amt.toLocaleString()}원</span>
        </div>`;
      }).join('')}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);margin-top:4px;">
        <span style="font-size:12px;color:var(--text2);">3.3% 공제 후</span>
        <span style="font-size:14px;font-weight:700;color:var(--green);">${Math.round(albaGross*0.967).toLocaleString()}원</span>
      </div>
    </div>
  </div>` : ''}

  ${delivItems.length>0 ? `
  <!-- 배달·대리 섹션 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              margin-bottom:10px;overflow:hidden;">
    <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.acc-arr').textContent=this.nextElementSibling.style.display==='none'?'▼':'▲'"
      style="display:flex;align-items:center;justify-content:space-between;
             padding:12px 16px;cursor:pointer;background:rgba(255,209,102,.06);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">🛵</span>
        <span style="font-size:13px;font-weight:700;color:var(--yellow);">배달·대리 수입</span>
        <span style="font-size:11px;color:var(--text3);">${delivItems.length}건</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;font-weight:700;color:var(--yellow);">${Math.round(delivGross*0.967).toLocaleString()}원</span>
        <span class="acc-arr" style="font-size:12px;color:var(--text3);">▼</span>
      </div>
    </div>
    <div style="display:none;padding:14px 16px;">
      ${delivItems.map(it=>`
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:7px 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);">${it.name||'배달'}</div>
            <div style="font-size:11px;color:var(--text3);">${it.date} · ${it.count}건 × ${(it.price||0).toLocaleString()}원</div>
          </div>
          <span style="font-size:13px;font-weight:700;color:var(--yellow);">+${((it.count||0)*(it.price||0)).toLocaleString()}원</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);margin-top:4px;">
        <span style="font-size:12px;color:var(--text2);">3.3% 공제 후</span>
        <span style="font-size:14px;font-weight:700;color:var(--green);">${Math.round(delivGross*0.967).toLocaleString()}원</span>
      </div>
    </div>
  </div>` : ''}

  ${freeItems.length>0 ? `
  <!-- 프리랜서 섹션 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              margin-bottom:10px;overflow:hidden;">
    <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.acc-arr').textContent=this.nextElementSibling.style.display==='none'?'▼':'▲'"
      style="display:flex;align-items:center;justify-content:space-between;
             padding:12px 16px;cursor:pointer;background:rgba(127,119,221,.06);">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">💻</span>
        <span style="font-size:13px;font-weight:700;color:var(--accent2);">프리랜서 수입</span>
        <span style="font-size:11px;color:var(--text3);">${freeItems.length}건</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;font-weight:700;color:var(--accent2);">${Math.round(freeGross*0.967).toLocaleString()}원</span>
        <span class="acc-arr" style="font-size:12px;color:var(--text3);">▼</span>
      </div>
    </div>
    <div style="display:none;padding:14px 16px;">
      ${freeItems.map(it=>`
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:7px 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);">${it.name||'외주'}</div>
            <div style="font-size:11px;color:var(--text3);">${it.date} · ${it.count}건 × ${(it.price||0).toLocaleString()}원</div>
          </div>
          <span style="font-size:13px;font-weight:700;color:var(--accent2);">+${((it.count||0)*(it.price||0)).toLocaleString()}원</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border);margin-top:4px;">
        <span style="font-size:12px;color:var(--text2);">3.3% 공제 후</span>
        <span style="font-size:14px;font-weight:700;color:var(--green);">${Math.round(freeGross*0.967).toLocaleString()}원</span>
      </div>
    </div>
  </div>` : ''}

  ${!hasEmployee && !hasNjob ? `
  <!-- 기록 없을 때 안내 -->
  <div style="text-align:center;padding:40px 20px;color:var(--text3);">
    <div style="font-size:40px;margin-bottom:12px;">📅</div>
    <div style="font-size:14px;font-weight:700;color:var(--text2);margin-bottom:8px;">아직 이번달 기록이 없어요</div>
    <div style="font-size:12px;line-height:1.8;margin-bottom:16px;">
      달력에서 날짜를 클릭해서<br>직장·알바·배달·프리랜서 기록을 추가하면<br>여기에 자동으로 집계돼요
    </div>
    <button onclick="showPage('att')"
      style="padding:10px 20px;border-radius:8px;border:none;background:var(--accent);
             color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
      📅 달력으로 이동</button>
  </div>` : ''}

  ${njobGross>0 ? `
  <!-- N잡 세금 안내 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:14px 16px;margin-bottom:16px;">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📋 N잡 세금 안내</div>
    <div style="font-size:12px;color:var(--text2);line-height:2;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
        <span>N잡 총 수입 (세전)</span>
        <span style="font-weight:700;">${njobGross.toLocaleString()}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
        <span>3.3% 원천징수</span>
        <span style="font-weight:700;color:var(--red);">-${njobTax.toLocaleString()}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="font-weight:700;">N잡 실수령</span>
        <span style="font-weight:700;font-size:14px;color:var(--green);">${njobNet.toLocaleString()}원</span>
      </div>
    </div>
    <div style="margin-top:8px;padding:8px 10px;background:rgba(255,209,102,.07);
                border-radius:7px;font-size:11px;color:var(--text3);line-height:1.8;">
      ⚠️ 연간 N잡 수입 합산 후 <b>5월 종합소득세 신고</b> 필수<br>
      연 2,400만원 이하 → 단순경비율 적용, 환급 가능성 높음
    </div>
  </div>` : ''}`;
}
// ══════════════════════════════════════════
