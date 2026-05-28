// ── 오늘 날짜 칸 자동 스크롤 (이번 달 진입 시) ──
(function scrollToToday(){
  const now = new Date();
  if(curY === now.getFullYear() && curM === now.getMonth()){
    setTimeout(()=>{
      const todayEl = document.querySelector('.cal-day.today');
      if(todayEl) todayEl.scrollIntoView({behavior:'smooth', block:'center'});
    }, 150);
  }
})();

try { bgIdx = parseInt(localStorage.getItem('atm2_bgIdx')||'0')||0; } catch(e){}
applyBg(bgIdx, false);

function applyBg(idx, animate){
  const c = BG_COLORS[idx];
  const isDark = c.dark;
  const root = document.documentElement;

  document.body.style.background = c.bg;

  if(isDark){
    // ── 다크 배경 ──
    // surface: 배경보다 약간 밝은 불투명 색
    root.style.setProperty('--surface',  '#1e2230');
    root.style.setProperty('--surface2', '#252a3a');
    root.style.setProperty('--surface3', '#2d3348');
    root.style.setProperty('--border',   '#3a4060');
    root.style.setProperty('--text',     '#e8ecf4');
    root.style.setProperty('--text2',    '#a0aabf');
    root.style.setProperty('--text3',    '#6a7490');
    // 강조색: 다크용 밝은 계열 고정
    root.style.setProperty('--accent',   '#4f7cff');
    root.style.setProperty('--accent2',  '#9b7cff');
    root.style.setProperty('--green',    '#3dd68c');
    root.style.setProperty('--yellow',   '#ffd166');
    root.style.setProperty('--red',      '#ff5c7a');
    root.style.setProperty('--cyan',     '#3dd6d6');
    root.style.setProperty('--orange',   '#ff8c42');
    root.style.setProperty('--sat',      '#7fb3ff');
    root.style.setProperty('--sun',      '#ff8fab');
    document.body.style.color = '#e8ecf4';
    // 사이드바·배너
    const sidebar=document.getElementById('sidebar');
    const banner=document.getElementById('banner');
    sidebar.style.background='#1e2230';
    sidebar.style.borderRightColor='#3a4060';
    banner.style.background='#161920';
    banner.style.borderBottomColor='#3a4060';
  } else {
    // ── 밝은 배경 ──
    // surface: 흰색에 가까운 반불투명 → 완전 불투명 밝은 색으로 고정
    root.style.setProperty('--surface',  '#ffffff');
    root.style.setProperty('--surface2', '#f0f2f8');
    root.style.setProperty('--surface3', '#e4e7f0');
    root.style.setProperty('--border',   '#c8ccdc');
    root.style.setProperty('--text',     '#1a1a2e');
    root.style.setProperty('--text2',    '#3a3a5a');
    root.style.setProperty('--text3',    '#6a6a8a');
    // 강조색: 밝은 배경에서 잘 보이는 진한 계열 고정
    root.style.setProperty('--accent',   '#2255cc');
    root.style.setProperty('--accent2',  '#6600cc');
    root.style.setProperty('--green',    '#1a9e5e');
    root.style.setProperty('--yellow',   '#9a6800');
    root.style.setProperty('--red',      '#cc0022');
    root.style.setProperty('--cyan',     '#007a7a');
    root.style.setProperty('--orange',   '#c05000');
    root.style.setProperty('--sat',      '#1a44bb');
    root.style.setProperty('--sun',      '#aa1155');
    document.body.style.color = '#1a1a2e';
    const sidebar=document.getElementById('sidebar');
    const banner=document.getElementById('banner');
    sidebar.style.background='#f0f2f8';
    sidebar.style.borderRightColor='#c8ccdc';
    banner.style.background='#e8eaf4';
    banner.style.borderBottomColor='#c8ccdc';
  }

  const ci = document.getElementById('company-input');
  if(ci) ci.style.color = isDark ? '#e8ecf4' : '#1a1a2e';

  if(animate) showBgToast(c.name, isDark);
  try { localStorage.setItem('atm2_bgIdx', idx); } catch(e){}
}

function showBgToast(name, isDark){
  let t = document.getElementById('bg-toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'bg-toast';
    t.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      backdrop-filter:blur(12px); border-radius:20px;
      padding:8px 20px; font-size:13px; font-weight:600;
      pointer-events:none; z-index:9999; opacity:0;
      transition:opacity .3s ease; white-space:nowrap;
    `;
    document.body.appendChild(t);
  }
  if(isDark){
    t.style.background = 'rgba(255,255,255,.13)';
    t.style.border     = '1px solid rgba(255,255,255,.2)';
    t.style.color      = '#fff';
  } else {
    t.style.background = 'rgba(0,0,0,.12)';
    t.style.border     = '1px solid rgba(0,0,0,.18)';
    t.style.color      = '#1a1a2e';
  }
  t.textContent = '🎨 ' + name;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.style.opacity='0'; }, 1400);
}

// 배경색 탭 변경 기능 비활성화 (설정에서 수동 변경)
function toggleBgChange(){ /* 미사용 */ }

// ── 배경색 팔레트 렌더링 ──
function renderBgPalette(){
  const pal = document.getElementById('bg-palette');
  const nameEl = document.getElementById('bg-cur-name');
  if(!pal) return;
  pal.innerHTML = '';
  BG_COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.title = c.name;
    btn.style.cssText = `width:100%;aspect-ratio:1;border-radius:6px;border:2px solid ${i===bgIdx?'var(--accent)':'var(--border)'};background:${c.bg};cursor:pointer;transition:border-color .15s;`;
    btn.onclick = () => {
      bgIdx = i;
      applyBg(i, true);
      renderBgPalette();
    };
    pal.appendChild(btn);
  });
  if(nameEl) nameEl.textContent = '현재: ' + BG_COLORS[bgIdx].name;
}

// ── 근무시간 커스텀 설정 ──
// 기본값 (2교대 12시간, 3교대 8시간)
let customShift = {
  day: { start: 9, end: 18 },
  night: { start: 22, end: 6 },
  shift2day: { start: 8, end: 20 },
  shift2night: { start: 20, end: 8 },
  shift3a: { start: 6, end: 14 },
  shift3b: { start: 14, end: 22 },
  shift3c: { start: 22, end: 6 }
};

function buildHourOpts(selId, curVal){
  const sel = document.getElementById(selId);
  if(!sel) return;
  sel.innerHTML = '';
  for(let h=0;h<24;h++){
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = (h<10?'0':'')+h+':00';
    if(h === curVal) opt.selected = true;
    sel.appendChild(opt);
  }
}

function initCustomShiftSelects(){
  // 로컬스토리지에서 불러오기
  try {
    const saved = localStorage.getItem('atm2_customShift');
    if(saved) customShift = Object.assign(customShift, JSON.parse(saved));
  } catch(e){}
  buildHourOpts('custom-day-start', customShift.day.start);
  buildHourOpts('custom-day-end', customShift.day.end);
  buildHourOpts('custom-night-start', customShift.night.start);
  buildHourOpts('custom-night-end', customShift.night.end);
  buildHourOpts('custom-2shift-day-start', customShift.shift2day.start);
  buildHourOpts('custom-2shift-day-end', customShift.shift2day.end);
  buildHourOpts('custom-2shift-night-start', customShift.shift2night.start);
  buildHourOpts('custom-2shift-night-end', customShift.shift2night.end);
  buildHourOpts('custom-3a-start', customShift.shift3a.start);
  buildHourOpts('custom-3a-end', customShift.shift3a.end);
  buildHourOpts('custom-3b-start', customShift.shift3b.start);
  buildHourOpts('custom-3b-end', customShift.shift3b.end);
  buildHourOpts('custom-3c-start', customShift.shift3c.start);
  buildHourOpts('custom-3c-end', customShift.shift3c.end);
}

function updateCustomShift(){
  const g = id => { const el = document.getElementById(id); return el ? parseInt(el.value) : 0; };
  customShift.day         = { start: g('custom-day-start'),          end: g('custom-day-end')          };
  customShift.night       = { start: g('custom-night-start'),        end: g('custom-night-end')        };
  customShift.shift2day   = { start: g('custom-2shift-day-start'),   end: g('custom-2shift-day-end')   };
  customShift.shift2night = { start: g('custom-2shift-night-start'), end: g('custom-2shift-night-end') };
  customShift.shift3a     = { start: g('custom-3a-start'),           end: g('custom-3a-end')           };
  customShift.shift3b     = { start: g('custom-3b-start'),           end: g('custom-3b-end')           };
  customShift.shift3c     = { start: g('custom-3c-start'),           end: g('custom-3c-end')           };
  // 기존 변수에 반영
  dayStart   = customShift.day.start;
  nightStart = customShift.night.start;
  // 2교대 시간 반영
  if(typeof SHIFT2 !== 'undefined'){
    SHIFT2.day   = { s: customShift.shift2day.start,   e: customShift.shift2day.end   };
    SHIFT2.night = { s: customShift.shift2night.start, e: customShift.shift2night.end };
  }
  SHIFT3.A = { s: customShift.shift3a.start, e: customShift.shift3a.end };
  SHIFT3.B = { s: customShift.shift3b.start, e: customShift.shift3b.end };
  SHIFT3.C = { s: customShift.shift3c.start, e: customShift.shift3c.end };
  try { localStorage.setItem('atm2_customShift', JSON.stringify(customShift)); } catch(e){}
  updateLegend();
  renderCalendar();
  showToast('⏱ 근무시간 설정 저장됨');
}

function resetCustomShift(){
  customShift = {
    day: { start: 9, end: 18 },
    night: { start: 22, end: 6 },
    shift2day: { start: 8, end: 20 },
    shift2night: { start: 20, end: 8 },
    shift3a: { start: 6, end: 14 },
    shift3b: { start: 14, end: 22 },
    shift3c: { start: 22, end: 6 }
  };
  try { localStorage.removeItem('atm2_customShift'); } catch(e){}
  initCustomShiftSelects();
  updateCustomShift();
}

// ── 초기화 ──
(function(){
  renderBgPalette();
  initCustomShiftSelects();
})();


const asstBtnEl = document.getElementById('asst-btn');

// ── 출근/퇴근 버튼 함수 (실시간 한국 표준시) ──
function nowKSTStr(){
  // 한국 표준시 (UTC+9)
  const now = new Date();
  const kst = new Date(now.getTime() + (9*60 - now.getTimezoneOffset())*60000);
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

function manualRecordAttendance(){
  const today = new Date();
  const y = today.getFullYear();
  const mo = today.getMonth();
  const d = today.getDate();
  if(y !== curY || mo !== curM){ curY=y; curM=mo; renderCalendar(); }
  const key = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  if(records[key] && records[key].status === 'work' && records[key].start){
    if(!asstOpen) toggleAsst();
    addBotMsg(`오늘(${d}일)은 이미 출근(${records[key].start})이 기록되어 있어요! 🐱\n변경하려면 달력에서 날짜를 클릭해주세요.`);
    return;
  }
  const startTime = nowKSTStr();
  const startNum = timeStrToNum(startTime);
  const endNum = startNum + 8;
  const endH = Math.floor(endNum); const endM2 = Math.round((endNum-endH)*60);
  const endTime = String(endH).padStart(2,'0')+':'+String(endM2).padStart(2,'0');
  if(!records[key]) records[key]={};
  records[key].status='work'; records[key].start=startTime; records[key].end=endTime;
  lsSave(); renderCalendar();
  if(!asstOpen) toggleAsst();
  addBotMsg(`✅ ${mo+1}월 ${d}일 출근 완료! 🐱\n⏰ 출근 시각: ${startTime}\n🏁 퇴근 예정: ${endTime} (자동 +8h)\n퇴근 시 퇴근 버튼을 눌러주세요!`);
}

function manualRecordLeave(){
  const today = new Date();
  const y = today.getFullYear();
  const mo = today.getMonth();
  const d = today.getDate();
  if(y !== curY || mo !== curM){ curY=y; curM=mo; renderCalendar(); }
  const key = `${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  if(!records[key] || records[key].status !== 'work'){
    if(!asstOpen) toggleAsst();
    addBotMsg(`오늘(${d}일)에 출근 기록이 없어요! 🐱\n먼저 출근 버튼을 눌러주세요.`);
    return;
  }
  const leaveTime = nowKSTStr();
  records[key].end = leaveTime;
  lsSave(); renderCalendar();
  const startTime = records[key].start || '?';
  if(!asstOpen) toggleAsst();
  addBotMsg(`✅ ${mo+1}월 ${d}일 퇴근 완료! 🐱\n⏰ 출근: ${startTime} → 퇴근: ${leaveTime}\n오늘도 수고하셨어요! 🐾`);
}


// 알바냥 클릭 → 채팅 열기/닫기
if(asstBtnEl){
  asstBtnEl.addEventListener('click', ()=>{ toggleAsst(); });
}



// 페이지 로드 후 연차 정보 표시
(function(){
  if(hireDate){
    const hi = document.getElementById('hire-date-inp');
    if(hi) hi.value = hireDate;
    renderLeaveInfo();
  }
})();

// ══════════════════════════════════════════
// 온보딩 튜토리얼
// ══════════════════════════════════════════
var _obCur = 1;
var _obTotal = 3;
var _obLsKey = 'atm2_onboarding_done';
var _obSelectedWT = 'day';

function obSelectWT(btn){
  document.querySelectorAll('.ob-wt-btn').forEach(b=>b.classList.remove('ob-wt-active'));
  btn.classList.add('ob-wt-active');
  _obSelectedWT = btn.dataset.wt;
}

function _obUpdateUI(){
  for(var i=1;i<=_obTotal;i++){
    var s=document.getElementById('ob-s'+i);
    if(s) s.className='ob-slide'+(i===_obCur?' active':'');
  }
  var fill=document.getElementById('ob-progress-fill');
  if(fill) fill.style.width=(_obCur/_obTotal*100)+'%';
  for(var j=1;j<=_obTotal;j++){
    var d=document.getElementById('ob-dot-'+j);
    if(!d) continue;
    d.className='ob-dot'+(j===_obCur?' active':j<_obCur?' done':'');
  }
  var btn=document.getElementById('ob-next');
  if(btn) btn.textContent=_obCur===_obTotal?'✅ 시작하기!':'다음 →';
  var skip=document.getElementById('ob-skip');
  if(skip) skip.textContent=_obCur===1?'건너뛰기':'← 이전';
  // 포커스 이동
  setTimeout(function(){
    var inp = _obCur===1 ? document.getElementById('ob-name-inp')
            : _obCur===2 ? document.getElementById('ob-wage-inp')
            : document.getElementById('ob-hire-inp');
    if(inp) inp.focus();
  }, 200);
}

function obNext(){
  if(_obCur===1){
    // STEP 1 → 이름/사업장 저장
    var name = (document.getElementById('ob-name-inp')||{}).value||'';
    var company = (document.getElementById('ob-company-inp')||{}).value||'';
    if(name.trim()){
      memName = name.trim();
      if(activeWpId && company.trim()) wpUpdate(activeWpId, {name: company.trim()});
      var ci = document.getElementById('company-input');
      if(ci && company.trim()) ci.value = company.trim();
    }
    _obCur++; _obUpdateUI();
  } else if(_obCur===2){
    // STEP 2 → 시급/근무유형 저장
    var wageEl = document.getElementById('ob-wage-inp');
    var wage = parseInt((wageEl||{}).value||'10320');
    if(wage < 10320){
      var warn = document.getElementById('ob-wage-warn');
      if(warn){ warn.style.display='block'; }
      if(wageEl) wageEl.style.borderColor='var(--red)';
      return; // 최저시급 미만이면 진행 막음
    }
    hourlyRate = wage;
    companyRate = wage;
    wt = _obSelectedWT;
    if(activeWpId && activeEmpId){
      empUpdate(activeWpId, activeEmpId, {hourlyRate: wage, companyRate: wage, wt: _obSelectedWT});
    }
    // 근무유형 버튼 UI 갱신
    document.querySelectorAll('.wt-btn').forEach(function(b){ b.classList.remove('active'); });
    var wtBtn = document.getElementById('wt-'+_obSelectedWT);
    if(wtBtn) wtBtn.classList.add('active');
    _obCur++; _obUpdateUI();
  } else {
    obClose();
  }
}

function obClose(){
  // STEP 3 → 입사일 저장 + 최종 저장
  var hireEl = document.getElementById('ob-hire-inp');
  if(hireEl && hireEl.value){
    hireDate = hireEl.value;
    var hi = document.getElementById('hire-date-inp');
    if(hi) hi.value = hireDate;
    if(activeWpId && activeEmpId) empUpdate(activeWpId, activeEmpId, {hireDate: hireDate});
  }
  lsSave();
  renderCalendar();
  updateEmpSwitcher();
  var ov=document.getElementById('onboarding-overlay');
  if(ov) ov.classList.remove('show');
  try{ localStorage.setItem(_obLsKey,'1'); }catch(e){}
  var rb=document.getElementById('ob-reopen-btn');
  if(rb) rb.dataset.show='true';
  _obCur=1;
  // 완료 토스트
  setTimeout(function(){ showToast('설정 완료! 달력에서 출근을 기록해보세요 🐱'); }, 400);
}

function obOpen(){
  _obCur=1;
  _obUpdateUI();
  var ov=document.getElementById('onboarding-overlay');
  if(ov) ov.classList.add('show');
}

// DOM 준비 후 이벤트 연결 및 자동 표시
document.addEventListener('DOMContentLoaded', function(){
  // skip/이전 버튼
  var skipBtn=document.getElementById('ob-skip');
  if(skipBtn){
    skipBtn.addEventListener('click', function(){
      if(_obCur===1){ obClose(); }
      else { _obCur--; _obUpdateUI(); }
    });
  }

  // 키보드
  document.addEventListener('keydown', function(e){
    var ov=document.getElementById('onboarding-overlay');
    if(!ov||!ov.classList.contains('show')) return;
    if(e.key==='ArrowRight'||e.key==='Enter') obNext();
    if(e.key==='ArrowLeft'&&_obCur>1){ _obCur--; _obUpdateUI(); }
    if(e.key==='Escape') obClose();
  });

  // 첫 진입 체크
  try{
    var done=localStorage.getItem(_obLsKey);
    if(!done){
      setTimeout(function(){
        _obUpdateUI();
        var ov=document.getElementById('onboarding-overlay');
        if(ov) ov.classList.add('show');
      }, 700);
    } else {
      var rb=document.getElementById('ob-reopen-btn');
      if(rb) rb.dataset.show='true';
    }
  }catch(e){}
});
