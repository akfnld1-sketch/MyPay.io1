// ══════════════════════════════════════════
// 직업 유형 선택 & 모드 전환
// v12: 다중 직종 동시 등록 지원
// ══════════════════════════════════════════

// 직종 정보 정의
const JOB_TYPES = {
  employee:   { icon:'🏢', name:'직장인',    desc:'출퇴근·OT 기록<br>급여·연차 자동계산', calcType:'hourly',   color:'var(--accent)'  },
  convenience:{ icon:'🏪', name:'편의점알바', desc:'시급 × 근무시간<br>주휴수당 자동계산', calcType:'hourly',   color:'var(--orange)' },
  delivery:   { icon:'🛵', name:'배달',       desc:'건당 수입 기록<br>일별 수익 합산',     calcType:'perCase',  color:'var(--yellow)'  },
  driver:     { icon:'🚗', name:'대리기사',   desc:'건당 수입 기록<br>야간 할증 지원',     calcType:'perCase',  color:'var(--purple)'  },
  freelancer: { icon:'💻', name:'프리랜서',   desc:'프로젝트 단가<br>3.3% 세금계산',       calcType:'project',  color:'var(--green)'   },
  shortAlba:  { icon:'📋', name:'단기알바',   desc:'날짜별 시급 기록<br>다양한 단기 업무',  calcType:'hourly',   color:'var(--teal)'    },
  etc:        { icon:'➕', name:'기타수입',   desc:'직접 금액 입력<br>자유 기록',           calcType:'manual',   color:'var(--text2)'   },
};

// 선택된 직종들 (다중 선택)
// jobType: 'employee' | 'multi' (기존 호환성 유지)
// selectedJobs: ['convenience','delivery',...] (새 구조)

function loadSelectedJobs(){
  try{
    const raw = localStorage.getItem('atm2_selectedJobs');
    if(raw) return JSON.parse(raw);
  }catch(e){}
  // 기존 jobType 마이그레이션
  if(typeof jobType !== 'undefined' && jobType && jobType !== 'multi'){
    return jobType === 'employee' ? ['employee'] : [jobType];
  }
  return [];
}

function saveSelectedJobs(jobs){
  try{ localStorage.setItem('atm2_selectedJobs', JSON.stringify(jobs)); }catch(e){}
  // 기존 jobType 호환성
  if(jobs.includes('employee') && jobs.length === 1){
    jobType = 'employee';
  } else if(jobs.length > 0 && !jobs.includes('employee')){
    jobType = jobs[0]; // 첫번째 직종
  } else {
    jobType = 'multi';
  }
  localStorage.setItem('atm2_jobType', jobType);
}

function showJobTypeSelector(forceShow){
  let overlay = document.getElementById('job-type-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'job-type-overlay';
    overlay.onclick = e => {
      if(e.target === overlay && loadSelectedJobs().length > 0) overlay.style.display = 'none';
    };
    document.body.appendChild(overlay);
  }

  const currentJobs = loadSelectedJobs();
  const isChanging = currentJobs.length > 0;
  let tempSelected = [...currentJobs];

  function renderModal(){
    const isEmployee = tempSelected.includes('employee');

    const employeeCard = `
      <div id="jt-employee" class="job-type-card${tempSelected.includes('employee')?' selected':''}"
           onclick="jtToggle('employee')"
           style="${tempSelected.includes('employee')?'border-color:var(--accent);background:rgba(79,124,255,.12);':''}">
        <span class="jt-icon">🏢</span>
        <div class="jt-name">직장인</div>
        <div class="jt-desc">출퇴근·OT 기록<br>급여·연차 자동계산</div>
        ${tempSelected.includes('employee')?'<div style="margin-top:6px;font-size:10px;font-weight:700;color:var(--accent);background:rgba(79,124,255,.15);padding:2px 8px;border-radius:10px;">✓ 선택됨</div>':''}
      </div>`;

    const multiCards = ['convenience','delivery','driver','freelancer','shortAlba','etc'].map(type => {
      const info = JOB_TYPES[type];
      const sel = tempSelected.includes(type);
      const disabled = isEmployee && type !== 'employee';
      return `
        <div class="job-type-card${sel?' selected':''}${disabled?' disabled':''}"
             onclick="${disabled?'jtShowEmployeeOnly()':'jtToggle(\''+type+'\')'}"
             style="${sel?'border-color:'+info.color+';background:rgba(0,0,0,.08);':''}
                    ${disabled?'opacity:.4;cursor:not-allowed;':''}">
          <span class="jt-icon">${info.icon}</span>
          <div class="jt-name">${info.name}</div>
          <div class="jt-desc">${info.desc}</div>
          ${sel?`<div style="margin-top:6px;font-size:10px;font-weight:700;color:${info.color};padding:2px 8px;border-radius:10px;background:rgba(0,0,0,.06);">✓ 선택됨</div>`:''}
        </div>`;
    }).join('');

    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;
                  padding:28px 24px;max-width:520px;width:96%;max-height:92vh;overflow-y:auto;
                  box-shadow:0 24px 64px rgba(0,0,0,.45);position:relative;">

        ${isChanging ? `<button onclick="document.getElementById('job-type-overlay').style.display='none'"
          style="position:absolute;top:14px;right:16px;background:none;border:none;
                 color:var(--text3);font-size:20px;cursor:pointer;">✕</button>` : ''}

        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:36px;margin-bottom:8px;">${isChanging?'🔄':'👋'}</div>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:6px;">
            ${isChanging?'직종 변경':'나의 수익원 선택'}
          </h2>
          <div style="font-size:13px;color:var(--text3);line-height:1.6;">
            해당하는 직종을 <b>모두 선택</b>하세요<br>
            <span style="color:var(--accent);font-weight:600;">여러 직종 동시 선택 가능</span> (직장인은 단독 선택)
          </div>
        </div>

        <!-- 직장인 (단독) -->
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">
            📌 직장 근무
          </div>
          <div style="display:grid;grid-template-columns:1fr;">
            ${employeeCard}
          </div>
        </div>

        <!-- N잡/알바/프리랜서 -->
        <div style="margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">
            💼 N잡 · 알바 · 프리랜서 (복수 선택 가능)
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            ${multiCards}
          </div>
        </div>

        <!-- 선택된 직종 요약 -->
        <div id="jt-summary" style="margin-bottom:16px;min-height:36px;"></div>

        <button onclick="jtConfirm()"
          id="jt-confirm-btn"
          style="width:100%;padding:14px;border-radius:10px;border:none;
                 background:${tempSelected.length>0?'var(--accent)':'var(--border)'};
                 color:${tempSelected.length>0?'#fff':'var(--text3)'};
                 font-size:15px;font-weight:700;cursor:${tempSelected.length>0?'pointer':'not-allowed'};
                 font-family:'Noto Sans KR';transition:all .2s;">
          ${tempSelected.length>0?'✅ 선택 완료 ('+tempSelected.length+'개 직종)':'직종을 선택해주세요'}
        </button>

        <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:10px;line-height:1.7;">
          💡 상단 뱃지를 탭하면 언제든 변경 가능
        </div>
      </div>`;

    // 요약 업데이트
    updateJtSummary(tempSelected);
  }

  // 전역 함수로 노출 (onclick에서 사용)
  window.jtToggle = function(type){
    if(type === 'employee'){
      // 직장인 선택 시 다른 직종 모두 해제
      if(tempSelected.includes('employee')){
        tempSelected = tempSelected.filter(t => t !== 'employee');
      } else {
        tempSelected = ['employee'];
      }
    } else {
      // 직장인 선택 상태면 다른 직종 선택 불가
      if(tempSelected.includes('employee')) return;
      if(tempSelected.includes(type)){
        tempSelected = tempSelected.filter(t => t !== type);
      } else {
        tempSelected.push(type);
      }
    }
    renderModal();
  };

  window.jtShowEmployeeOnly = function(){
    showToast('💡 직장인 모드와 다른 직종은 함께 선택할 수 없어요');
  };

  window.jtConfirm = function(){
    if(tempSelected.length === 0){ showToast('⚠️ 직종을 하나 이상 선택해주세요'); return; }
    saveSelectedJobs(tempSelected);
    overlay.style.display = 'none';
    applyJobTypeUI();
    renderCalendar();
    const names = tempSelected.map(t => JOB_TYPES[t]?.icon + ' ' + JOB_TYPES[t]?.name).join(', ');
    showToast('✅ ' + names);
  };

  renderModal();
  overlay.style.display = 'flex';
}

function updateJtSummary(selected){
  const el = document.getElementById('jt-summary');
  if(!el) return;
  if(selected.length === 0){
    el.innerHTML = '';
    return;
  }
  const tags = selected.map(t => {
    const info = JOB_TYPES[t];
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;
                         border-radius:20px;font-size:12px;font-weight:600;
                         background:rgba(79,124,255,.1);color:var(--accent);border:1px solid rgba(79,124,255,.2);">
              ${info.icon} ${info.name}
            </span>`;
  }).join('');
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
    <span style="font-size:11px;color:var(--text3);">선택됨:</span>${tags}
  </div>`;
}

function selectJobType(type){
  // 기존 단일 선택 호환용
  saveSelectedJobs([type]);
  const overlay = document.getElementById('job-type-overlay');
  if(overlay) overlay.style.display = 'none';
  applyJobTypeUI();
  renderCalendar();
  const info = JOB_TYPES[type] || {};
  showToast((info.icon||'') + ' ' + (info.name||type) + ' 모드');
}

function applyJobTypeUI(){
  const selectedJobs = loadSelectedJobs();
  const isEmployee = selectedJobs.includes('employee') || jobType === 'employee';
  const isMulti = !isEmployee && selectedJobs.length > 0;

  const salBtn  = document.getElementById('btn-sal');
  const dashBtn = document.getElementById('btn-dash');
  const mobSal  = document.getElementById('mob-btn-sal');
  const mobDash = document.getElementById('mob-btn-dash');
  const sidebar    = document.getElementById('sidebar');
  const weekToggle = document.querySelector('.week-toggle-wrap');

  if(isEmployee){
    if(salBtn)  { salBtn.style.display='';  salBtn.textContent='💰 급여관리'; }
    if(dashBtn) { dashBtn.style.display=''; }
    if(mobSal)  { mobSal.style.display='';  mobSal.querySelector('span:last-child').textContent='급여관리'; }
    if(mobDash) { mobDash.style.display=''; }
    if(sidebar)    sidebar.style.display='';
    if(weekToggle) weekToggle.style.display='';
  } else {
    if(salBtn)  { salBtn.style.display='';  salBtn.textContent='🧮 수입관리'; }
    if(dashBtn) { dashBtn.style.display='none'; }
    if(mobSal)  { mobSal.style.display='';  mobSal.querySelector('span:last-child').textContent='수입관리'; }
    if(mobDash) { mobDash.style.display='none'; }
    if(weekToggle) weekToggle.style.display='none';
    if(sidebar) sidebar.style.display='none';
  }

  const budgetBtn = document.getElementById('btn-budget');
  const mobBudget = document.getElementById('mob-btn-budget');
  if(budgetBtn) budgetBtn.style.display='';
  if(mobBudget) mobBudget.style.display='';

  updateJobBadge();
}

function updateJobBadge(){
  let badge = document.getElementById('job-type-badge');
  if(!badge){
    badge = document.createElement('div');
    badge.id = 'job-type-badge';
    badge.style.cssText = 'font-size:11px;font-weight:700;padding:3px 8px;border-radius:12px;cursor:pointer;transition:all .2s;flex-shrink:0;';
    badge.onclick = ()=>showJobTypeSelector(true);
    const hdr = document.querySelector('.header-right');
    if(hdr) hdr.prepend(badge);
  }

  const selectedJobs = loadSelectedJobs();
  if(selectedJobs.length === 0){
    badge.textContent = '👤 직종선택';
    badge.style.background = 'rgba(160,160,160,.15)';
    badge.style.color = 'var(--text3)';
    badge.style.border = '1px solid var(--text3)';
    return;
  }
  if(selectedJobs.includes('employee') && selectedJobs.length === 1){
    badge.textContent = '🏢 직장인';
    badge.style.background = 'rgba(79,124,255,.15)';
    badge.style.color = 'var(--accent)';
    badge.style.border = '1px solid var(--accent)';
    return;
  }
  if(selectedJobs.length === 1){
    const info = JOB_TYPES[selectedJobs[0]];
    badge.textContent = (info?.icon||'') + ' ' + (info?.name||selectedJobs[0]);
    badge.style.background = 'rgba(61,214,140,.15)';
    badge.style.color = 'var(--green)';
    badge.style.border = '1px solid var(--green)';
    return;
  }
  badge.textContent = `💼 N잡 ${selectedJobs.length}개`;
  badge.style.background = 'rgba(255,140,66,.15)';
  badge.style.color = 'var(--orange)';
  badge.style.border = '1px solid var(--orange)';
}
// ══════════════════════════════════════════
