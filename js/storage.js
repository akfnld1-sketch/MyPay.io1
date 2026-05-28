
// ══════════════════════════════════════════
// 상수
// ══════════════════════════════════════════
// ── 연도별 법정 최저시급 (매년 업데이트) ──
const MIN_WAGE_TABLE = {
  2024: 9860,
  2025: 10030,
  2026: 10320,
};
function getMinWage(year) {
  if (MIN_WAGE_TABLE[year]) return MIN_WAGE_TABLE[year];
  const years = Object.keys(MIN_WAGE_TABLE).map(Number).sort((a,b)=>b-a);
  return MIN_WAGE_TABLE[years[0]];
}
const CURRENT_MIN_WAGE = getMinWage(new Date().getFullYear()); // 현재연도 최저시급 자동

const SHIFT2  = {day:{s:8,e:20},night:{s:20,e:8}};
const ST_LBL  = {work:'출근',leave:'연차',half:'반차',early:'조퇴',absent:'결근',holiday:'휴일근무',public:'공휴일근무',sat_work:'토요특근',sun_work:'일요특근'};
const ST_CLS  = {work:'s-work',leave:'s-leave',half:'s-half',early:'s-early',absent:'s-absent',holiday:'s-holiday',public:'s-public',sat_work:'s-sat_work',sun_work:'s-sun_work'};
const MO_KO   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

// 3교대 시간 - 사용자 설정 가능 (기본값)
let SHIFT3 = {A:{s:6,e:14}, B:{s:14,e:22}, C:{s:22,e:6}};

// ══════════════════════════════════════════
// ★ 다중 사업장/직원 관리 엔진 (v11)
// ══════════════════════════════════════════

const WP_KEY   = 'atm2_workplaces';
const EMP_KEY  = (wpId) => `atm2_employees_${wpId}`;
const ATT_KEY  = (wpId, empId, y, m) => `atm2_att_${wpId}_${empId}_${y}_${pad2(m+1)}`;
const PAY_KEY  = (wpId, empId) => `atm2_pay_${wpId}_${empId}`;
const BDG_KEY  = (wpId, empId) => `atm2_bdg_${wpId}_${empId}`;
const MEM_KEY  = (wpId, empId) => `atm2_mem_${wpId}_${empId}`;

// 현재 선택된 사업장/직원
let activeWpId  = null;
let activeEmpId = null;

// ── 사업장 CRUD ──
function wpList(){
  try{ return JSON.parse(localStorage.getItem(WP_KEY)||'[]'); }catch(e){ return []; }
}
function wpSave(list){ localStorage.setItem(WP_KEY, JSON.stringify(list)); }

function wpCreate(name, logo){
  const list = wpList();
  const id   = 'wp_' + Date.now();
  list.push({ id, name: name||'내 사업장', logo: logo||'', createdAt: Date.now() });
  wpSave(list);
  return id;
}
function wpUpdate(id, fields){
  const list = wpList().map(w => w.id===id ? Object.assign(w,fields) : w);
  wpSave(list);
}
function wpDelete(id){
  // 소속 직원 전부 삭제
  empList(id).forEach(e => empDelete(id, e.id));
  wpSave(wpList().filter(w => w.id !== id));
}
function wpGet(id){ return wpList().find(w=>w.id===id)||null; }

// ── 직원 CRUD ──
function empList(wpId){
  try{ return JSON.parse(localStorage.getItem(EMP_KEY(wpId))||'[]'); }catch(e){ return []; }
}
function empSave(wpId, list){ localStorage.setItem(EMP_KEY(wpId), JSON.stringify(list)); }

function empCreate(wpId, fields){
  const list = empList(wpId);
  const id   = 'emp_' + Date.now();
  const emp  = Object.assign({
    id, name:'직원', hireDate:'', hourlyRate: CURRENT_MIN_WAGE,
    companyRate: CURRENT_MIN_WAGE, wt:'day', lunchBreak:1,
    weeklyOn:false, shift3: null, myShift3: null,
    allowances:{tenure:0,weekly:0,perfect:0,other:0},
    insOverride:{np:null,hi:null,ltc:null,ei:null},
    taxOverride:{income:null,local:null},
    dayStart:9, nightStart:22, jobType:'employee',
    createdAt: Date.now()
  }, fields);
  list.push(emp);
  empSave(wpId, list);
  return id;
}
function empUpdate(wpId, empId, fields){
  const list = empList(wpId).map(e => e.id===empId ? Object.assign(e,fields) : e);
  empSave(wpId, list);
}
function empDelete(wpId, empId){
  // 관련 데이터 전부 삭제 (근태/가계부/AI메모리)
  Object.keys(localStorage).forEach(k=>{
    if(k.startsWith(`atm2_att_${wpId}_${empId}`) ||
       k===PAY_KEY(wpId,empId) ||
       k.startsWith(BDG_KEY(wpId,empId)) ||
       k===MEM_KEY(wpId,empId)) localStorage.removeItem(k);
  });
  empSave(wpId, empList(wpId).filter(e=>e.id!==empId));
}
function empGet(wpId, empId){ return empList(wpId).find(e=>e.id===empId)||null; }

// ── 현재 선택된 직원 설정 상태 → 전역 변수로 동기화 ──
function syncActiveEmpToGlobals(){
  const emp = empGet(activeWpId, activeEmpId);
  if(!emp) return;
  wt = emp.wt || 'day';

  // ★ 구버전 최저시급 자동 업그레이드
  // 저장된 시급이 과거 법정 최저시급 값이면 현재 최저시급으로 자동 갱신
  const oldMinWages = Object.values(MIN_WAGE_TABLE);
  const savedRate    = emp.hourlyRate  || CURRENT_MIN_WAGE;
  const savedCRate   = emp.companyRate || CURRENT_MIN_WAGE;
  hourlyRate  = oldMinWages.includes(savedRate)  ? CURRENT_MIN_WAGE : savedRate;
  companyRate = oldMinWages.includes(savedCRate) ? CURRENT_MIN_WAGE : savedCRate;
  // 업그레이드된 경우 직원 데이터에도 저장
  if(savedRate !== hourlyRate || savedCRate !== companyRate){
    empUpdate(activeWpId, activeEmpId, { hourlyRate, companyRate });
  }
  lunchBreak  = emp.lunchBreak  !== undefined ? emp.lunchBreak : 1;
  weeklyOn    = emp.weeklyOn    || false;
  hireDate    = emp.hireDate    || '';
  allowances  = Object.assign({tenure:0,weekly:0,perfect:0,other:0}, emp.allowances||{});
  insOverride = Object.assign({np:null,hi:null,ltc:null,ei:null}, emp.insOverride||{});
  taxOverride = Object.assign({income:null,local:null}, emp.taxOverride||{});
  if(emp.shift3)   SHIFT3  = emp.shift3;
  if(emp.myShift3) myShift3= emp.myShift3;
  if(emp.dayStart   !== undefined) dayStart   = emp.dayStart;
  if(emp.nightStart !== undefined) nightStart = emp.nightStart;
  if(emp.jobType)  jobType = emp.jobType;
  // UI 반영
  const ci = document.getElementById('company-input');
  const wp = wpGet(activeWpId);
  if(ci && wp) ci.value = wp.name;
  const hi = document.getElementById('hire-date-inp');
  if(hi) hi.value = hireDate;
}

// ── 전역 변수 변경 → 현재 직원 객체에 저장 ──
function saveGlobalsToActiveEmp(){
  if(!activeWpId || !activeEmpId) return;
  const ci = document.getElementById('company-input');
  if(ci) wpUpdate(activeWpId, {name: ci.value});
  empUpdate(activeWpId, activeEmpId, {
    wt, hourlyRate, companyRate, lunchBreak, weeklyOn, hireDate,
    allowances: Object.assign({},allowances),
    insOverride: Object.assign({},insOverride),
    taxOverride: Object.assign({},taxOverride),
    shift3: Object.assign({},SHIFT3), myShift3,
    dayStart, nightStart, jobType
  });
}

// ── 근태 데이터 - 직원별 월별 저장/로드 ──
function attSaveMonth(wpId, empId, y, m, data){
  const monthData = {};
  const ym = `${y}-${pad2(m+1)}`;
  Object.keys(data).forEach(k=>{ if(k.startsWith(ym+'-')) monthData[k]=data[k]; });
  localStorage.setItem(ATT_KEY(wpId, empId, y, m), JSON.stringify(monthData));
}
function attLoadMonth(wpId, empId, y, m){
  try{
    const raw = localStorage.getItem(ATT_KEY(wpId, empId, y, m));
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}

// ── AI 메모리 - 직원별 ──
function memSave(wpId, empId, memObj){
  localStorage.setItem(MEM_KEY(wpId, empId), JSON.stringify(memObj));
}
function memLoad(wpId, empId){
  try{ return JSON.parse(localStorage.getItem(MEM_KEY(wpId,empId))||'null'); }catch(e){ return null; }
}

// ── 마이그레이션: 기존 데이터(atm2_*)를 신규 구조로 변환 ──
function migrateV10toV11(){
  // 이미 마이그레이션 됐으면 스킵
  if(localStorage.getItem('atm2_v11_migrated')) return;
  if(wpList().length > 0){ localStorage.setItem('atm2_v11_migrated','1'); return; }

  // 기존 cfg 읽기
  let oldCfg = {};
  try{ oldCfg = JSON.parse(localStorage.getItem('atm2_cfg')||'{}'); }catch(e){}
  let oldMem = {};
  try{ oldMem = JSON.parse(localStorage.getItem('atm2_memory')||'{}'); }catch(e){}

  // 기본 사업장 생성
  const wpId = wpCreate(oldCfg.company || '내 사업장', localStorage.getItem('companyLogo')||'');

  // 기본 직원 생성 (기존 설정 이관)
  // ★ 구버전 최저시급이면 현재 최저시급으로 업그레이드
  const _oldWages = Object.values(MIN_WAGE_TABLE);
  const _savedHr  = oldCfg.hourlyRate  || CURRENT_MIN_WAGE;
  const _savedCr  = oldCfg.companyRate || CURRENT_MIN_WAGE;
  const _hr = _oldWages.includes(_savedHr) ? CURRENT_MIN_WAGE : _savedHr;
  const _cr = _oldWages.includes(_savedCr) ? CURRENT_MIN_WAGE : _savedCr;

  const empId = empCreate(wpId, {
    name: oldMem.name || '나',
    hireDate: oldCfg.hireDate || '',
    hourlyRate: _hr,
    companyRate: _cr,
    wt: oldCfg.wt || 'day',
    lunchBreak: oldCfg.lunchBreak !== undefined ? oldCfg.lunchBreak : 1,
    weeklyOn: oldCfg.weeklyOn || false,
    allowances: oldCfg.allowances || {tenure:0,weekly:0,perfect:0,other:0},
    insOverride: oldCfg.insOverride || {np:null,hi:null,ltc:null,ei:null},
    taxOverride: oldCfg.taxOverride || {income:null,local:null},
    shift3: oldCfg.shift3 || null,
    myShift3: oldCfg.myShift3 || null,
    dayStart: oldCfg.dayStart !== undefined ? oldCfg.dayStart : 9,
    nightStart: oldCfg.nightStart !== undefined ? oldCfg.nightStart : 22,
    jobType: localStorage.getItem('atm2_jobType') || 'employee'
  });

  // 기존 근태 데이터 이관 (atm2_dd_YYYY_MM)
  Object.keys(localStorage).forEach(k=>{
    if(k.startsWith('atm2_dd_')){
      try{
        const parts = k.replace('atm2_dd_','').split('_');
        const y = parseInt(parts[0]);
        const mStr = parts[1];
        const m = parseInt(mStr) - 1;
        const raw = localStorage.getItem(k);
        if(raw){
          localStorage.setItem(ATT_KEY(wpId, empId, y, m), raw);
        }
      }catch(e){}
    }
  });

  // AI 메모리 이관
  if(oldMem && Object.keys(oldMem).length){
    memSave(wpId, empId, oldMem);
  }

  activeWpId  = wpId;
  activeEmpId = empId;
  localStorage.setItem('atm2_activeWp',  wpId);
  localStorage.setItem('atm2_activeEmp', empId);
  localStorage.setItem('atm2_v11_migrated','1');
  console.log('[v11] 마이그레이션 완료:', wpId, empId);
}

// ── 앱 초기화: 사업장/직원 선택 복원 ──
function initMultiEmp(){
  migrateV10toV11();
  const wps = wpList();
  if(wps.length === 0){
    // 완전 첫 실행
    const wpId  = wpCreate('내 사업장');
    const empId = empCreate(wpId, {name:'나'});
    activeWpId  = wpId;
    activeEmpId = empId;
  } else {
    activeWpId  = localStorage.getItem('atm2_activeWp')  || wps[0].id;
    // 사업장이 존재하는지 검증
    if(!wpGet(activeWpId)) activeWpId = wps[0].id;
    const emps  = empList(activeWpId);
    activeEmpId = localStorage.getItem('atm2_activeEmp') || (emps[0]||{}).id;
    if(!empGet(activeWpId, activeEmpId)) activeEmpId = (emps[0]||{}).id;
  }
  localStorage.setItem('atm2_activeWp',  activeWpId);
  localStorage.setItem('atm2_activeEmp', activeEmpId);
}

// ── 직원 전환 ──
function switchEmployee(wpId, empId){
  // 현재 직원 저장
  if(activeWpId && activeEmpId){
    saveGlobalsToActiveEmp();
    attSaveMonth(activeWpId, activeEmpId, curY, curM, dayData);
  }
  activeWpId  = wpId;
  activeEmpId = empId;
  localStorage.setItem('atm2_activeWp',  wpId);
  localStorage.setItem('atm2_activeEmp', empId);
  // 새 직원 데이터 로드
  dayData = attLoadMonth(wpId, empId, curY, curM);
  satToggle = {};
  syncActiveEmpToGlobals();
  // AI 메모리 복원
  const m = memLoad(wpId, empId);
  if(m){
    if(m.name)     memName     = m.name;
    if(m.company)  memCompany  = m.company;
    if(m.payday)   memPayday   = m.payday;
    if(m.jobTitle) memJobTitle = m.jobTitle;
  }
  renderCalendar();
  renderSalaryIfVisible();
  updateEmpSwitcher();
  showToast(`${(empGet(wpId,empId)||{}).name||'직원'} 님으로 전환했습니다`);
}

function renderSalaryIfVisible(){
  const sp = document.getElementById('salary-page');
  if(sp && sp.style.display !== 'none') renderSalary();
}

// ── 직원 전환 UI (헤더 드롭다운) ──
function updateEmpSwitcher(){
  // ★ 사이드바 직원 카드 업데이트
  const curEmp = empGet(activeWpId, activeEmpId) || {};
  const curWp  = wpGet(activeWpId) || {};
  const nameEl = document.getElementById('sb-emp-name');
  const subEl  = document.getElementById('sb-emp-sub');
  const avatarEl = document.getElementById('sb-emp-avatar');
  if(nameEl) nameEl.textContent = curEmp.name || '직원';
  if(subEl){
    const wtMap = {day:'주간',night:'야간','2shift':'2교대','3shift':'3교대',alba:'알바'};
    subEl.textContent = (curWp.name||'') + (curWp.name&&curEmp.wt?' · ':'') + (wtMap[curEmp.wt]||'');
  }
  if(avatarEl) avatarEl.textContent = (curEmp.name||'나').charAt(0);
  // 사이드바 요약 업데이트
  updateSbSummary();
}

// ── 사이드바 이번달 요약 (메인 히어로 카드로 이동, 호환성 유지)
function updateSbSummary(){ /* 메인 stats-row에서 처리 */ }

function toggleEmpMenu(){
  const m = document.getElementById('emp-menu');
  if(!m) return;
  m.style.display = m.style.display==='none' ? 'block' : 'none';
  if(m.style.display==='block'){
    const close = (e)=>{ if(!document.getElementById('emp-switcher-wrap')?.contains(e.target)){ m.style.display='none'; document.removeEventListener('click',close); }};
    setTimeout(()=>document.addEventListener('click',close),50);
  }
}

// ── 직원 추가 모달 ──
function openAddEmpModal(wpId){
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'add-emp-overlay';
  overlay.innerHTML = `
    <div class="popup" style="width:340px;padding:24px 20px">
      <h3 style="margin:0 0 16px;font-size:16px">직원 추가</h3>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:var(--color-text-secondary);display:block;margin-bottom:4px">이름</label>
        <input id="new-emp-name" type="text" placeholder="홍길동" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--color-border-secondary);border-radius:8px;font-size:14px;background:var(--color-background-secondary);color:var(--color-text-primary)">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:var(--color-text-secondary);display:block;margin-bottom:4px">시급 (원)</label>
        <input id="new-emp-wage" type="number" value="${CURRENT_MIN_WAGE}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--color-border-secondary);border-radius:8px;font-size:14px;background:var(--color-background-secondary);color:var(--color-text-primary)">
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:12px;color:var(--color-text-secondary);display:block;margin-bottom:4px">입사일</label>
        <input id="new-emp-hire" type="date" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--color-border-secondary);border-radius:8px;font-size:14px;background:var(--color-background-secondary);color:var(--color-text-primary)">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('add-emp-overlay').remove()" style="flex:1;padding:10px;border:1px solid var(--color-border-secondary);border-radius:8px;background:transparent;color:var(--color-text-secondary);cursor:pointer">취소</button>
        <button onclick="confirmAddEmp('${wpId}')" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-weight:500">추가</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(()=>document.getElementById('new-emp-name')?.focus(),100);
}

function confirmAddEmp(wpId){
  const name = document.getElementById('new-emp-name')?.value?.trim();
  const wage = parseInt(document.getElementById('new-emp-wage')?.value||CURRENT_MIN_WAGE);
  const hire = document.getElementById('new-emp-hire')?.value||'';
  if(!name){ showToast('이름을 입력해주세요'); return; }
  empCreate(wpId, { name, hourlyRate: wage, companyRate: wage, hireDate: hire });
  document.getElementById('add-emp-overlay')?.remove();
  updateEmpSwitcher();
  showToast(`${name} 님이 추가되었습니다`);
}

// ── 사업장 추가 모달 ──
function openAddWpModal(){
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'add-wp-overlay';
  overlay.innerHTML = `
    <div class="popup" style="width:320px;padding:24px 20px">
      <h3 style="margin:0 0 16px;font-size:16px">사업장 추가</h3>
      <div style="margin-bottom:20px">
        <label style="font-size:12px;color:var(--color-text-secondary);display:block;margin-bottom:4px">사업장명</label>
        <input id="new-wp-name" type="text" placeholder="홍길동 카페" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--color-border-secondary);border-radius:8px;font-size:14px;background:var(--color-background-secondary);color:var(--color-text-primary)">
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('add-wp-overlay').remove()" style="flex:1;padding:10px;border:1px solid var(--color-border-secondary);border-radius:8px;background:transparent;color:var(--color-text-secondary);cursor:pointer">취소</button>
        <button onclick="confirmAddWp()" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;font-weight:500">추가</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(()=>document.getElementById('new-wp-name')?.focus(),100);
}

function confirmAddWp(){
  const name = document.getElementById('new-wp-name')?.value?.trim();
  if(!name){ showToast('사업장 이름을 입력해주세요'); return; }
  const wpId = wpCreate(name);
  empCreate(wpId, {name:'직원 1'});
  document.getElementById('add-wp-overlay')?.remove();
  updateEmpSwitcher();
  showToast(`"${name}" 사업장이 추가되었습니다`);
}

// ── 직원/사업장 관리 모달 ──
function openEmpManageModal(){
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'emp-manage-overlay';
  const wps = wpList();
  let rows = '';
  wps.forEach(wp=>{
    rows += `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--color-border-tertiary)">
        <span style="font-size:14px;font-weight:500">${wp.name}</span>
        <div style="display:flex;gap:8px">
          <button onclick="promptRenameWp('${wp.id}')" style="font-size:12px;padding:4px 10px;border:1px solid var(--color-border-secondary);border-radius:6px;background:transparent;color:var(--color-text-secondary);cursor:pointer">이름 변경</button>
          <button onclick="promptDeleteWp('${wp.id}')" style="font-size:12px;padding:4px 10px;border:1px solid var(--color-border-danger);border-radius:6px;background:transparent;color:var(--color-text-danger);cursor:pointer">삭제</button>
        </div>
      </div>`;
    empList(wp.id).forEach(e=>{
      rows += `<div style="display:flex;align-items:center;padding:8px 0 8px 12px;gap:8px">
        <span style="flex:1;font-size:13px">${e.name} <span style="color:var(--color-text-tertiary);font-size:11px">${e.wt==='day'?'주간':e.wt==='night'?'야간':e.wt==='3shift'?'3교대':'알바'} · ${(e.hourlyRate||0).toLocaleString()}원</span></span>
        <button onclick="promptRenameEmp('${wp.id}','${e.id}','${e.name}')" style="font-size:11px;padding:3px 8px;border:1px solid var(--color-border-secondary);border-radius:5px;background:transparent;color:var(--color-text-secondary);cursor:pointer">수정</button>
        <button onclick="promptDeleteEmp('${wp.id}','${e.id}','${e.name}')" style="font-size:11px;padding:3px 8px;border:1px solid var(--color-border-danger);border-radius:5px;background:transparent;color:var(--color-text-danger);cursor:pointer">삭제</button>
      </div>`;
    });
    rows += `<button onclick="openAddEmpModal('${wp.id}');document.getElementById('emp-manage-overlay').remove()" style="margin:4px 0 0 12px;font-size:12px;padding:4px 10px;border:1px solid var(--color-border-secondary);border-radius:6px;background:transparent;color:var(--color-text-info);cursor:pointer">＋ 직원 추가</button>
    </div>`;
  });
  overlay.innerHTML = `
    <div class="popup" style="width:420px;padding:24px 20px;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:16px">직원 · 사업장 관리</h3>
        <button onclick="document.getElementById('emp-manage-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--color-text-secondary)">×</button>
      </div>
      ${rows}
      <button onclick="openAddWpModal();document.getElementById('emp-manage-overlay').remove()" style="width:100%;margin-top:8px;padding:10px;border:1px dashed var(--color-border-secondary);border-radius:8px;background:transparent;color:var(--color-text-secondary);cursor:pointer;font-size:13px">＋ 사업장 추가</button>
    </div>`;
  document.body.appendChild(overlay);
}

function promptRenameWp(wpId){
  const wp = wpGet(wpId);
  const newName = prompt('사업장 이름 변경:', wp?.name||'');
  if(newName?.trim()){ wpUpdate(wpId,{name:newName.trim()}); updateEmpSwitcher(); showToast('변경했습니다'); }
}
function promptDeleteWp(wpId){
  const wp = wpGet(wpId);
  if(wpList().length<=1){ showToast('마지막 사업장은 삭제할 수 없습니다'); return; }
  if(confirm(`"${wp?.name}" 사업장과 모든 직원 데이터를 삭제하시겠어요?`)){
    wpDelete(wpId);
    if(activeWpId===wpId){
      const remain=wpList(); activeWpId=remain[0]?.id;
      const remEmp=empList(activeWpId); activeEmpId=remEmp[0]?.id;
      localStorage.setItem('atm2_activeWp',activeWpId||'');
      localStorage.setItem('atm2_activeEmp',activeEmpId||'');
      dayData=attLoadMonth(activeWpId,activeEmpId,curY,curM);
      syncActiveEmpToGlobals(); renderCalendar();
    }
    document.getElementById('emp-manage-overlay')?.remove();
    updateEmpSwitcher(); showToast('삭제했습니다');
  }
}
function promptRenameEmp(wpId, empId, curName){
  openEmpEditModal(wpId, empId);
}

// ── 직원 상세 편집 모달 (이름 + 시급 + 근무유형 + 입사일) ──
function openEmpEditModal(wpId, empId){
  const emp = empGet(wpId, empId);
  if(!emp) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'emp-edit-overlay';
  const wtOpts = ['day','night','2shift','3shift'].map(v=>{
    const labels = {day:'☀️ 주간',night:'🌙 야간','2shift':'🔄 2교대','3shift':'⚙️ 3교대'};
    return `<option value="${v}"${emp.wt===v?' selected':''}>${labels[v]}</option>`;
  }).join('');
  overlay.innerHTML = `
    <div class="popup" style="width:360px;padding:24px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <h3 style="margin:0;font-size:16px;">직원 정보 편집</h3>
        <button onclick="document.getElementById('emp-edit-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text3);">×</button>
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px;color:var(--text2);font-weight:600;display:block;margin-bottom:5px;">이름</label>
        <input id="ee-name" type="text" value="${emp.name||''}" placeholder="홍길동"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface2);color:var(--text);font-size:14px;font-family:'Noto Sans KR';outline:none;"
          onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px;color:var(--text2);font-weight:600;display:block;margin-bottom:5px;">
          시급 <span style="font-size:10px;color:var(--text3);font-weight:400;">(2026 최저 10,320원)</span>
        </label>
        <div style="display:flex;align-items:center;gap:6px;">
          <input id="ee-wage" type="number" value="${emp.hourlyRate||10320}" min="10320" step="10"
            style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface2);color:var(--text);font-size:16px;font-family:'JetBrains Mono';font-weight:700;text-align:right;outline:none;"
            onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"
            oninput="var w=parseInt(this.value)||0;document.getElementById('ee-wage-warn').style.display=w>0&&w<10320?'block':'none';">
          <span style="font-size:13px;color:var(--text2);">원</span>
        </div>
        <div id="ee-wage-warn" style="font-size:11px;color:var(--red);margin-top:3px;display:none;">⚠️ 최저시급 미만</div>
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px;color:var(--text2);font-weight:600;display:block;margin-bottom:5px;">근무 형태</label>
        <select id="ee-wt"
          style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface2);color:var(--text);font-size:14px;font-family:'Noto Sans KR';outline:none;">
          ${wtOpts}
        </select>
      </div>

      <div style="margin-bottom:20px;">
        <label style="font-size:12px;color:var(--text2);font-weight:600;display:block;margin-bottom:5px;">입사일 <span style="font-size:10px;color:var(--text3);font-weight:400;">(연차 자동 계산)</span></label>
        <input id="ee-hire" type="date" value="${emp.hireDate||''}"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface2);color:var(--text);font-size:14px;font-family:'Noto Sans KR';outline:none;"
          onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      </div>

      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('emp-edit-overlay').remove()"
          style="flex:1;padding:11px;border:1px solid var(--border);border-radius:9px;background:transparent;color:var(--text2);cursor:pointer;font-family:'Noto Sans KR';font-size:14px;">취소</button>
        <button onclick="confirmEmpEdit('${wpId}','${empId}')"
          style="flex:2;padding:11px;border:none;border-radius:9px;background:var(--accent);color:#fff;cursor:pointer;font-family:'Noto Sans KR';font-size:14px;font-weight:700;">저장</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(()=>document.getElementById('ee-name')?.focus(), 100);
}

function confirmEmpEdit(wpId, empId){
  const name  = document.getElementById('ee-name')?.value?.trim();
  const wage  = parseInt(document.getElementById('ee-wage')?.value||'10320');
  const wtype = document.getElementById('ee-wt')?.value||'day';
  const hire  = document.getElementById('ee-hire')?.value||'';
  if(!name){ showToast('이름을 입력해주세요'); return; }
  empUpdate(wpId, empId, {
    name, hourlyRate: wage, companyRate: wage, wt: wtype, hireDate: hire
  });
  // 현재 활성 직원이면 전역변수도 동기화
  if(wpId===activeWpId && empId===activeEmpId){
    hourlyRate = wage; companyRate = wage; wt = wtype; hireDate = hire;
    const hi = document.getElementById('hire-date-inp');
    if(hi) hi.value = hire;
    document.querySelectorAll('.wt-btn').forEach(b=>b.classList.remove('active'));
    const wb = document.getElementById('wt-'+wtype);
    if(wb) wb.classList.add('active');
    renderCalendar();
    renderSalaryIfVisible();
  }
  document.getElementById('emp-edit-overlay')?.remove();
  document.getElementById('emp-manage-overlay')?.remove();
  updateEmpSwitcher();
  showToast(`${name} 님 정보가 저장됐습니다`);
}
function promptDeleteEmp(wpId, empId, empName){
  if(empList(wpId).length<=1){ showToast('마지막 직원은 삭제할 수 없습니다'); return; }
  if(confirm(`"${empName}" 님과 모든 근태 데이터를 삭제하시겠어요?`)){
    empDelete(wpId, empId);
    if(activeEmpId===empId){
      const remEmp=empList(wpId); activeEmpId=remEmp[0]?.id;
      localStorage.setItem('atm2_activeEmp',activeEmpId||'');
      dayData=attLoadMonth(wpId,activeEmpId,curY,curM);
      syncActiveEmpToGlobals(); renderCalendar();
    }
    document.getElementById('emp-manage-overlay')?.remove();
    updateEmpSwitcher(); showToast('삭제했습니다');
  }
}

