// ══════════════════════════════════════════
// freelance.js — N잡·알바·프리랜서 수입 관리
// v13: 직종별 계산방식 분리
//   시간제: 편의점/단기알바/쿠팡물류 → 시급×시간
//   건수제: 배달/대리/프리랜서 → 건수×건당단가 (여러건 추가)
// ══════════════════════════════════════════

// 직종별 계산 타입
const JOB_CALC_TYPE = {
  convenience: 'hourly',   // 시급×시간
  shortAlba:   'hourly',
  delivery:    'perCase',  // 건수×단가
  driver:      'perCase',
  freelancer:  'perCase',
  etc:         'manual',
};

// ── 자연어 파서 ──────────────────────────
const NL_PATTERNS = [
  { key:'convenience', regex:/편의점|마트|슈퍼|쿠팡물류/ },
  { key:'delivery',    regex:/배달|쿠팡이츠|배민|요기요/ },
  { key:'driver',      regex:/대리기사|대리운전|대리/ },
  { key:'freelancer',  regex:/프리랜서|외주|프리/ },
  { key:'shortAlba',   regex:/단기|행사|알바/ },
];

function parseNaturalInput(text){
  const results = [];
  if(!text) return results;

  const hourMatch = text.match(/(\d+\.?\d*)\s*시간/g) || [];
  const hours = hourMatch.map(m => parseFloat(m));

  const caseMatch = text.match(/(\d+)\s*(건|콜|회|개)/g) || [];
  const cases = caseMatch.map(m => parseInt(m));

  const amountMatch = text.match(/(\d+)\s*만\s*원?|(\d+)\s*원/g) || [];
  const amounts = amountMatch.map(m => {
    if(m.includes('만')) return parseInt(m) * 10000;
    return parseInt(m.replace(/원/,''));
  }).filter(a => a > 0);

  let hIdx=0, cIdx=0, aIdx=0;

  for(const p of NL_PATTERNS){
    if(p.regex.test(text)){
      const calc = JOB_CALC_TYPE[p.key] || 'hourly';
      const entry = { typeLabel: p.key, calc };
      if(calc === 'hourly' && hIdx < hours.length) entry.hours = hours[hIdx++];
      else if(calc === 'perCase' && cIdx < cases.length) entry.cases = cases[cIdx++];
      else if(aIdx < amounts.length) entry.amount = amounts[aIdx++];
      results.push(entry);
    }
  }

  if(results.length === 0 && amounts.length > 0)
    results.push({ typeLabel:'etc', calc:'manual', amount:amounts[0] });

  return results;
}

// ── 수입 계산 ──────────────────────────
function calcJobIncome(entry, wages){
  let amount = 0, detail = '';
  if(entry.calc === 'hourly'){
    const wage = wages[entry.typeLabel] || 10320;
    if(entry.hours){ amount = Math.round(entry.hours * wage); detail = `${entry.hours}시간 × ${wage.toLocaleString()}원`; }
    else if(entry.amount){ amount = entry.amount; detail = '직접 입력'; }
  } else if(entry.calc === 'perCase'){
    // 건수제는 items 배열로 관리 (여러 건 추가)
    if(entry.items && entry.items.length > 0){
      amount = entry.items.reduce((s,it) => s + (parseInt(it.count)||0)*(parseInt(it.price)||0), 0);
      detail = `${entry.items.length}종 ${entry.items.reduce((s,it)=>s+(parseInt(it.count)||0),0)}건`;
    } else if(entry.amount){ amount = entry.amount; detail = '직접 입력'; }
  } else {
    amount = entry.amount || 0; detail = '직접 입력';
  }
  return { amount, detail };
}

// ── 주휴수당 계산 ──────────────────────
function calcWeeklyHolidayPay(weeklyHours, hourlyWage){
  if(weeklyHours < 15) return 0;
  return Math.round(hourlyWage * 8);
}

// ── 메인 렌더 ──────────────────────────
function renderIncomeCalc(){
  const page = document.getElementById('salary-page');
  if(!page) return;

  const selectedJobs = loadSelectedJobs ? loadSelectedJobs() : [];
  const isEmployee = selectedJobs.includes('employee') || jobType === 'employee';
  if(isEmployee){ if(typeof renderSalaryPage==='function') renderSalaryPage(); return; }

  const incKey = `atm2_income_${curY}_${pad2(curM+1)}`;
  let incomeItems = [];
  try{ const raw=localStorage.getItem(incKey); if(raw) incomeItems=JSON.parse(raw); }catch(e){}

  const wageKey = 'atm2_jobWages';
  let wages = {};
  try{ const raw=localStorage.getItem(wageKey); if(raw) wages=JSON.parse(raw); }catch(e){}

  const totalGross = incomeItems.reduce((s,it)=>s+(parseInt(it.amount)||0),0);
  const tax33 = Math.round(totalGross * 0.033);
  const afterTax = totalGross - tax33;

  const byType = {};
  incomeItems.forEach(it=>{
    const t = it.jobType||'etc';
    if(!byType[t]) byType[t]={total:0,count:0};
    byType[t].total += parseInt(it.amount)||0;
    byType[t].count++;
  });

  const totalHours = incomeItems.reduce((s,it)=>s+(parseFloat(it.hours)||0),0);

  const jobChips = selectedJobs.filter(j=>j!=='employee').map(j=>{
    const info = JOB_TYPES[j]||{};
    const t = byType[j]?.total||0;
    return `<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;
                        border-radius:20px;background:rgba(0,0,0,.05);border:1px solid var(--border);
                        font-size:12px;font-weight:600;color:var(--text);">
              ${info.icon||'💼'} ${info.name||j}
              ${t>0?`<span style="color:var(--green);font-size:11px;">+${t.toLocaleString()}원</span>`:''}
            </div>`;
  }).join('');

  const itemRows = incomeItems.map((it,i)=>{
    const info = JOB_TYPES[it.jobType]||{icon:'💼',name:'기타'};
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                  background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;">
        <div style="font-size:20px;flex-shrink:0;">${info.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:var(--text);">${it.label||info.name}</div>
          <div style="font-size:11px;color:var(--text3);">
            ${it.date||''} ${it.detail?'· '+it.detail:''} ${it.note?'· '+it.note:''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:14px;font-weight:700;color:var(--green);">+${parseInt(it.amount).toLocaleString()}원</div>
          ${it.hours?`<div style="font-size:10px;color:var(--text3);">${it.hours}시간</div>`:''}
        </div>
        <button onclick="deleteIncomeItem(${i})"
          style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;">✕</button>
      </div>`;
  }).join('');

  page.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
    <div>
      <h2 style="font-size:20px;font-weight:700;">💼 ${curY}년 ${curM+1}월 수입관리</h2>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">N잡·알바·프리랜서 통합 수입 · 3.3% 자동계산</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="openNLInput()"
        style="padding:9px 14px;border-radius:8px;border:none;background:var(--accent);
               color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
        🗣️ 자연어 입력</button>
      <button onclick="openAddIncomeItem()"
        style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);
               color:var(--text);font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
        + 직접 입력</button>
    </div>
  </div>

  ${jobChips?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">${jobChips}</div>`:''}

  <div style="background:linear-gradient(135deg,rgba(61,214,140,.15),rgba(79,124,255,.08));
              border:1px solid rgba(61,214,140,.3);border-radius:14px;padding:20px 22px;margin-bottom:16px;">
    <div style="font-size:13px;color:var(--text2);margin-bottom:10px;">이번달 통합 수입 요약</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">총 수입 (세전)</div>
        <div style="font-size:17px;font-weight:700;font-family:'JetBrains Mono';color:var(--text);">${totalGross.toLocaleString()}원</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--red);margin-bottom:4px;">3.3% 원천징수</div>
        <div style="font-size:17px;font-weight:700;font-family:'JetBrains Mono';color:var(--red);">-${tax33.toLocaleString()}원</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--green);margin-bottom:4px;">실수령 (세후)</div>
        <div style="font-size:22px;font-weight:900;font-family:'JetBrains Mono';color:var(--green);">${afterTax.toLocaleString()}원</div>
      </div>
    </div>
    ${totalHours>0?`<div style="background:rgba(0,0,0,.06);border-radius:8px;padding:8px 14px;
                display:flex;justify-content:space-between;">
      <span style="font-size:12px;color:var(--text2);">이번달 총 근무시간</span>
      <span style="font-size:13px;font-weight:700;color:var(--text);">${totalHours.toFixed(1)}시간</span>
    </div>`:''}
  </div>

  ${incomeItems.length===0?`
  <div onclick="openNLInput()"
       style="background:rgba(79,124,255,.06);border:1.5px dashed rgba(79,124,255,.4);
              border-radius:14px;padding:22px;margin-bottom:16px;text-align:center;cursor:pointer;">
    <div style="font-size:28px;margin-bottom:8px;">🗣️</div>
    <div style="font-size:14px;font-weight:700;color:var(--accent);margin-bottom:6px;">자연어로 수입을 기록해보세요</div>
    <div style="font-size:12px;color:var(--text3);line-height:1.8;">
      <b>"오늘 편의점 5시간, 배달 8건 했어"</b><br>
      <b>"대리 7콜 했고 외주 하나 마무리했어"</b>
    </div>
    <div style="margin-top:12px;display:inline-block;padding:8px 20px;border-radius:20px;
                background:var(--accent);color:#fff;font-size:13px;font-weight:700;">탭해서 입력하기</div>
  </div>`:''}

  ${incomeItems.length>0?`
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:16px 18px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);">📋 수입 내역 (${incomeItems.length}건)</div>
      <button onclick="if(confirm('모두 삭제할까요?'))clearIncomeItems()"
        style="font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid rgba(255,92,122,.3);
               background:none;color:var(--red);cursor:pointer;">전체삭제</button>
    </div>
    ${itemRows}
  </div>`:''}

  <!-- 직종별 시급/단가 설정 -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
              padding:16px 18px;margin-bottom:16px;">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;">⚙️ 직종별 시급·단가 설정</div>
    ${renderWageSettings(selectedJobs.filter(j=>j!=='employee'), wages)}
  </div>

  ${totalGross>0?`
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:16px;">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">📋 세금 안내</div>
    <div style="font-size:12px;color:var(--text2);line-height:2;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
        <span>소득세 (3%)</span><span style="font-weight:700;color:var(--red);">-${Math.round(totalGross*0.03).toLocaleString()}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
        <span>지방소득세 (0.3%)</span><span style="font-weight:700;color:var(--red);">-${Math.round(totalGross*0.003).toLocaleString()}원</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;">
        <span style="font-weight:700;">실수령액</span>
        <span style="font-weight:700;font-size:15px;color:var(--green);">${afterTax.toLocaleString()}원</span>
      </div>
    </div>
    <div style="margin-top:10px;padding:9px 12px;background:rgba(255,209,102,.07);
                border:1px solid rgba(255,209,102,.25);border-radius:8px;font-size:11px;
                color:var(--text3);line-height:1.8;">
      ⚠️ 연간 수입 합산 후 <b>매년 5월</b> 종합소득세 신고 필수<br>
      연 수입 2,400만원 이하 → 단순경비율 적용으로 환급 가능성 높음
    </div>
  </div>`:''}`;

  if(typeof budgetState!=='undefined' && budgetState.customIncome===0 && afterTax>0){
    const s=document.createElement('div');
    s.style.cssText='background:rgba(79,124,255,.06);border:1px solid rgba(79,124,255,.2);border-radius:10px;padding:12px 16px;margin-bottom:16px;';
    s.innerHTML=`<div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:6px;">💡 가계부 자동연동</div>
      <div style="font-size:12px;color:var(--text2);">실수령액 <b style="color:var(--green);">${afterTax.toLocaleString()}원</b>을 가계부 수입으로 반영할까요?</div>
      <button onclick="applyIncomeTobudget(${afterTax})"
        style="margin-top:8px;padding:7px 14px;border-radius:7px;border:none;background:var(--accent);
               color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">💳 가계부에 반영</button>`;
    page.appendChild(s);
  }
}

// ── 시급/단가 설정 렌더 ──────────────────
function renderWageSettings(jobs, wages){
  if(!jobs||jobs.length===0) return '<div style="font-size:12px;color:var(--text3);">직종을 먼저 선택해주세요</div>';
  return jobs.map(j=>{
    const info = JOB_TYPES[j]||{};
    const calcType = JOB_CALC_TYPE[j]||'hourly';
    const isPerCase = calcType==='perCase';
    if(j==='etc') return '';
    const currentWage = wages[j]||(isPerCase?5000:10320);
    const label = isPerCase?'건당 단가':'시급';
    const unit = isPerCase?'원/건':'원/시간';
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="font-size:18px;flex-shrink:0;">${info.icon||'💼'}</div>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px;">
            ${info.name||j} ${label}
            <span style="font-size:10px;font-weight:400;color:var(--text3);margin-left:4px;">
              ${isPerCase?'(거리·상황마다 다르면 기록 시 직접 입력)':''}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="number" id="wage-${j}" value="${currentWage}" min="0" step="100"
              onchange="saveWageSetting('${j}',this.value)"
              style="width:110px;background:var(--surface2);border:1px solid var(--border);
                     color:var(--text);border-radius:7px;padding:7px 10px;font-size:14px;
                     font-family:'JetBrains Mono';font-weight:700;text-align:right;outline:none;">
            <span style="font-size:12px;color:var(--text3);">${unit}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function saveWageSetting(key,val){
  const wageKey='atm2_jobWages';
  let wages={};
  try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
  wages[key]=parseInt(val)||0;
  try{localStorage.setItem(wageKey,JSON.stringify(wages));}catch(e){}
  showToast('✅ 저장됨');
}

// ── 자연어 입력 팝업 ──────────────────────
function openNLInput(){
  let ov=document.getElementById('nl-input-popup');
  if(!ov){
    ov=document.createElement('div');
    ov.id='nl-input-popup';ov.className='overlay';
    ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};
    document.body.appendChild(ov);
  }
  ov.innerHTML=`
    <div class="popup" style="width:380px;padding:24px 22px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:16px;margin:0;">🗣️ 자연어로 수입 기록</h3>
        <button onclick="document.getElementById('nl-input-popup').style.display='none'"
          style="background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="background:rgba(79,124,255,.06);border:1px solid rgba(79,124,255,.2);
                  border-radius:10px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:6px;">입력 예시</div>
        <div style="font-size:12px;color:var(--text2);line-height:2;">
          "오늘 편의점 5시간, 배달 8건 했어"<br>
          "대리 7콜 했고 외주 프로젝트 2건"<br>
          "단기알바 4시간"
        </div>
      </div>
      <textarea id="nl-text-inp" placeholder="오늘 한 일을 자유롭게 입력하세요..." rows="3"
        style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
               border-radius:10px;padding:12px;font-size:14px;font-family:'Noto Sans KR';
               outline:none;resize:none;line-height:1.6;box-sizing:border-box;"></textarea>
      <div id="nl-preview" style="margin:10px 0;min-height:40px;"></div>
      <button onclick="processNLInput()"
        style="width:100%;padding:12px;border-radius:8px;border:none;background:var(--accent);
               color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">
        자동 분석 & 저장</button>
    </div>`;
  ov.style.display='flex';
  setTimeout(()=>{
    const inp=document.getElementById('nl-text-inp');
    if(inp){
      inp.focus();
      inp.addEventListener('input',()=>{
        const parsed=parseNaturalInput(inp.value);
        const prev=document.getElementById('nl-preview');
        if(!prev)return;
        if(parsed.length===0){prev.innerHTML='';return;}
        const wageKey='atm2_jobWages';let wages={};
        try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
        const items=parsed.map(p=>{
          const info=JOB_TYPES[p.typeLabel]||{icon:'💼',name:p.typeLabel};
          const {amount,detail}=calcJobIncome(p,wages);
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;
                              background:var(--surface2);border-radius:8px;margin-bottom:4px;">
                    <span style="font-size:16px;">${info.icon}</span>
                    <div style="flex:1;font-size:12px;color:var(--text2);">${info.name} · ${detail||'-'}</div>
                    <div style="font-size:13px;font-weight:700;color:var(--green);">
                      ${amount>0?'+'+amount.toLocaleString()+'원':'금액 미상'}
                    </div>
                  </div>`;
        }).join('');
        prev.innerHTML=`<div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;">분석 결과</div>${items}`;
      });
    }
  },100);
}

function processNLInput(){
  const inp=document.getElementById('nl-text-inp');
  if(!inp||!inp.value.trim()){showToast('⚠️ 내용을 입력해주세요');return;}
  const text=inp.value.trim();
  const parsed=parseNaturalInput(text);
  if(parsed.length===0){showToast('⚠️ 인식된 수입이 없어요. 직접 입력을 사용해주세요');return;}
  const wageKey='atm2_jobWages';let wages={};
  try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
  const incKey=`atm2_income_${curY}_${pad2(curM+1)}`;
  let items=[];
  try{const raw=localStorage.getItem(incKey);if(raw)items=JSON.parse(raw);}catch(e){}
  const today=new Date();
  const dateStr=`${pad2(today.getMonth()+1)}/${pad2(today.getDate())}`;
  let cnt=0;
  parsed.forEach(p=>{
    const info=JOB_TYPES[p.typeLabel]||{name:p.typeLabel};
    const {amount,detail}=calcJobIncome(p,wages);
    items.push({id:Date.now()+cnt,label:info.name||p.typeLabel,jobType:p.typeLabel,
      amount,hours:p.hours||null,cases:p.cases||null,detail,date:dateStr,note:'',fromNL:text.substring(0,30)});
    cnt++;
  });
  try{localStorage.setItem(incKey,JSON.stringify(items));}catch(e){}
  document.getElementById('nl-input-popup').style.display='none';
  renderIncomeCalc();
  showToast(`✅ ${cnt}건 기록됨`);
}

// ── 직접 입력 팝업 ────────────────────────
function openAddIncomeItem(){
  let ov=document.getElementById('add-income-popup');
  if(!ov){
    ov=document.createElement('div');ov.id='add-income-popup';ov.className='overlay';
    ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};
    document.body.appendChild(ov);
  }
  const selectedJobs=loadSelectedJobs?loadSelectedJobs():[];
  const jobs=selectedJobs.filter(j=>j!=='employee');
  const today=new Date();
  const defDate=`${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
  const wageKey='atm2_jobWages';let wages={};
  try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}

  const jobOptions=jobs.map(j=>{
    const info=JOB_TYPES[j]||{};
    return `<option value="${j}">${info.icon||''} ${info.name||j}</option>`;
  }).join('')||'<option value="etc">➕ 기타</option>';

  ov.innerHTML=`
    <div class="popup" style="width:380px;padding:22px 20px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:16px;margin:0;">+ 수입 직접 입력</h3>
        <button onclick="document.getElementById('add-income-popup').style.display='none'"
          style="background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;">✕</button>
      </div>

      <div style="margin-bottom:10px;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:5px;">직종</div>
        <select id="inc-type-sel" onchange="onJobTypeChange(this.value)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:14px;font-family:'Noto Sans KR';outline:none;">
          ${jobOptions}
        </select>
      </div>

      <div style="margin-bottom:10px;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:5px;">항목명</div>
        <input id="inc-label-inp" type="text" placeholder="예: 야간 편의점, 배달 저녁타임, 웹개발 외주"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:14px;font-family:'Noto Sans KR';outline:none;">
      </div>

      <!-- 시간제 입력 -->
      <div id="hourly-form">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:5px;">시급 (원)</div>
            <input id="inc-wage-inp" type="number" placeholder="10320" min="0" step="10"
              style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                     border-radius:8px;padding:9px 12px;font-size:14px;font-family:'JetBrains Mono';
                     font-weight:700;outline:none;">
          </div>
          <div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:5px;">근무시간</div>
            <input id="inc-hours-inp" type="number" placeholder="0" min="0" step="0.5"
              style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                     border-radius:8px;padding:9px 12px;font-size:14px;font-family:'JetBrains Mono';
                     font-weight:700;outline:none;">
          </div>
        </div>
        <div id="hourly-preview" style="font-size:12px;color:var(--green);margin-bottom:10px;display:none;"></div>
      </div>

      <!-- 건수제 입력 (배달/대리/프리랜서) -->
      <div id="percase-form" style="display:none;">
        <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">건별 내역 (여러 건 추가 가능)</div>
        <div id="case-items-list"></div>
        <button onclick="addCaseItem()"
          style="width:100%;padding:8px;border:1px dashed var(--border);border-radius:8px;
                 background:none;color:var(--text2);font-size:13px;cursor:pointer;margin-bottom:10px;
                 font-family:'Noto Sans KR';">+ 건 추가</button>
        <div id="percase-total" style="font-size:13px;font-weight:700;color:var(--green);text-align:right;margin-bottom:10px;"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:5px;">날짜</div>
          <input id="inc-date-inp" type="date" value="${defDate}"
            style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:13px;outline:none;">
        </div>
        <div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:5px;">메모 (선택)</div>
          <input id="inc-note-inp" type="text" placeholder="메모..."
            style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:13px;font-family:'Noto Sans KR';outline:none;">
        </div>
      </div>

      <button onclick="saveIncomeItem()"
        style="width:100%;padding:12px;border-radius:8px;border:none;background:var(--green);
               color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR';">저장</button>
    </div>`;

  ov.style.display='flex';

  // 초기 직종에 맞게 폼 전환
  setTimeout(()=>{
    const sel=document.getElementById('inc-type-sel');
    if(sel) onJobTypeChange(sel.value);
    // 시급 자동입력
    const wInp=document.getElementById('inc-wage-inp');
    if(wInp && sel){
      const w=wages[sel.value]||10320;
      wInp.value=w;
    }
    // 시급×시간 실시간 계산
    ['inc-wage-inp','inc-hours-inp'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.addEventListener('input', updateHourlyPreview);
    });
    // 첫 건수 항목 추가
    addCaseItem();
  },100);
}

let caseItemCount=0;
function addCaseItem(){
  caseItemCount++;
  const list=document.getElementById('case-items-list');
  if(!list)return;
  const idx=caseItemCount;
  const row=document.createElement('div');
  row.id=`case-row-${idx}`;
  row.style.cssText='display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:8px;align-items:center;';
  row.innerHTML=`
    <input type="number" placeholder="건수" min="1" step="1" id="case-count-${idx}"
      oninput="updateCaseTotal()"
      style="background:var(--surface2);border:1px solid var(--border);color:var(--text);
             border-radius:8px;padding:8px 10px;font-size:14px;font-family:'JetBrains Mono';
             font-weight:700;outline:none;">
    <div style="position:relative;">
      <input type="number" placeholder="건당단가" min="0" step="100" id="case-price-${idx}"
        oninput="updateCaseTotal()"
        style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
               border-radius:8px;padding:8px 10px;font-size:14px;font-family:'JetBrains Mono';
               font-weight:700;outline:none;">
      <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);
                   font-size:11px;color:var(--text3);pointer-events:none;">원</span>
    </div>
    <button onclick="removeCaseItem(${idx})"
      style="background:none;border:1px solid rgba(255,92,122,.3);border-radius:6px;
             color:var(--red);width:30px;height:36px;cursor:pointer;font-size:14px;flex-shrink:0;">✕</button>`;
  list.appendChild(row);
}

function removeCaseItem(idx){
  const row=document.getElementById(`case-row-${idx}`);
  if(row)row.remove();
  updateCaseTotal();
}

function updateCaseTotal(){
  let total=0;
  document.querySelectorAll('[id^="case-row-"]').forEach(row=>{
    const idx=row.id.replace('case-row-','');
    const cnt=parseInt(document.getElementById(`case-count-${idx}`)?.value)||0;
    const price=parseInt(document.getElementById(`case-price-${idx}`)?.value)||0;
    total+=cnt*price;
  });
  const el=document.getElementById('percase-total');
  if(el) el.textContent=total>0?`소계: +${total.toLocaleString()}원`:'';
}

function updateHourlyPreview(){
  const wage=parseInt(document.getElementById('inc-wage-inp')?.value)||0;
  const hours=parseFloat(document.getElementById('inc-hours-inp')?.value)||0;
  const prev=document.getElementById('hourly-preview');
  if(!prev)return;
  if(wage>0&&hours>0){
    const amt=Math.round(wage*hours);
    prev.style.display='block';
    prev.textContent=`${wage.toLocaleString()}원 × ${hours}시간 = ${amt.toLocaleString()}원`;
  } else prev.style.display='none';
}

function onJobTypeChange(jobKey){
  const calcType=JOB_CALC_TYPE[jobKey]||'hourly';
  const hForm=document.getElementById('hourly-form');
  const pForm=document.getElementById('percase-form');
  if(!hForm||!pForm)return;
  if(calcType==='perCase'){
    hForm.style.display='none';
    pForm.style.display='block';
    // 건수제 직종 설명 추가
    const desc=document.getElementById('percase-desc');
    if(!desc){
      const d=document.createElement('div');
      d.id='percase-desc';
      d.style.cssText='font-size:11px;color:var(--text3);margin-bottom:8px;padding:6px 10px;background:rgba(255,209,102,.07);border-radius:6px;';
      d.textContent='거리·상황마다 단가가 다를 수 있어요. 건별로 따로 입력해주세요.';
      pForm.insertBefore(d,pForm.firstChild);
    }
  } else {
    hForm.style.display='block';
    pForm.style.display='none';
    // 저장된 시급 자동세팅
    const wageKey='atm2_jobWages';let wages={};
    try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
    const wInp=document.getElementById('inc-wage-inp');
    if(wInp) wInp.value=wages[jobKey]||10320;
    updateHourlyPreview();
  }
}

function saveIncomeItem(){
  const jobType_=document.getElementById('inc-type-sel')?.value||'etc';
  const label=(document.getElementById('inc-label-inp')?.value||'').trim();
  const date=document.getElementById('inc-date-inp')?.value||'';
  const note=(document.getElementById('inc-note-inp')?.value||'').trim();
  const calcType=JOB_CALC_TYPE[jobType_]||'hourly';

  if(!label){showToast('⚠️ 항목명을 입력해주세요');return;}

  let amount=0, detail='', hours=null;

  if(calcType==='hourly'){
    const wage=parseInt(document.getElementById('inc-wage-inp')?.value)||0;
    hours=parseFloat(document.getElementById('inc-hours-inp')?.value)||0;
    if(wage<=0){showToast('⚠️ 시급을 입력해주세요');return;}
    if(hours<=0){showToast('⚠️ 근무시간을 입력해주세요');return;}
    amount=Math.round(wage*hours);
    detail=`${wage.toLocaleString()}원 × ${hours}시간`;
    // 시급 자동저장
    const wageKey='atm2_jobWages';let wages={};
    try{const raw=localStorage.getItem(wageKey);if(raw)wages=JSON.parse(raw);}catch(e){}
    wages[jobType_]=wage;
    try{localStorage.setItem(wageKey,JSON.stringify(wages));}catch(e){}
  } else {
    // 건수제: 여러 건 합산
    const rows=document.querySelectorAll('[id^="case-row-"]');
    if(rows.length===0){showToast('⚠️ 건 내역을 추가해주세요');return;}
    let caseItems=[];
    rows.forEach(row=>{
      const idx=row.id.replace('case-row-','');
      const cnt=parseInt(document.getElementById(`case-count-${idx}`)?.value)||0;
      const price=parseInt(document.getElementById(`case-price-${idx}`)?.value)||0;
      if(cnt>0&&price>0) caseItems.push({count:cnt,price});
      amount+=cnt*price;
    });
    if(amount<=0){showToast('⚠️ 건수와 단가를 입력해주세요');return;}
    detail=caseItems.map(it=>`${it.count}건×${it.price.toLocaleString()}원`).join(', ');
  }

  const dateParts=date.split('-');
  const y=parseInt(dateParts[0])||curY;
  const m=parseInt(dateParts[1])-1;
  const incKey=`atm2_income_${y}_${pad2(m+1)}`;
  let items=[];
  try{const raw=localStorage.getItem(incKey);if(raw)items=JSON.parse(raw);}catch(e){}
  items.push({id:Date.now(),jobType:jobType_,label,amount,hours,detail,
    date:`${dateParts[1]}/${dateParts[2]}`,note});
  try{localStorage.setItem(incKey,JSON.stringify(items));}catch(e){}

  document.getElementById('add-income-popup').style.display='none';
  caseItemCount=0;
  renderIncomeCalc();
  showToast(`✅ ${label} +${amount.toLocaleString()}원 추가됨`);
}

function deleteIncomeItem(idx){
  const incKey=`atm2_income_${curY}_${pad2(curM+1)}`;
  let items=[];
  try{const raw=localStorage.getItem(incKey);if(raw)items=JSON.parse(raw);}catch(e){}
  items.splice(idx,1);
  try{localStorage.setItem(incKey,JSON.stringify(items));}catch(e){}
  renderIncomeCalc();
}

function clearIncomeItems(){
  const incKey=`atm2_income_${curY}_${pad2(curM+1)}`;
  try{localStorage.removeItem(incKey);}catch(e){}
  renderIncomeCalc();
}

function applyIncomeTobudget(amount){
  if(typeof budgetState!=='undefined'){
    budgetState.customIncome=amount;
    if(typeof budgetSave==='function') budgetSave();
    showToast(`✅ 가계부 수입 ${amount.toLocaleString()}원으로 설정됨`);
    renderIncomeCalc();
  }
}
// ══════════════════════════════════════════
