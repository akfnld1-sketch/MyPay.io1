// 프리랜서 모드 - 달력 스케줄 팝업
// ══════════════════════════════════════════
const FL_TYPES = {
  meeting:  {label:'📅 미팅',    cls:'type-meeting'},
  deadline: {label:'🔥 마감',    cls:'type-deadline'},
  work:     {label:'💼 작업',    cls:'type-work'},
  personal: {label:'🧘 개인',    cls:'type-personal'},
  etc:      {label:'📌 기타',    cls:'type-etc'}
};

function openFlPopup(key, d){
  editKey = key;
  const items = flData[key] || [];
  const dateLabel = `${curY}년 ${curM+1}월 ${d}일`;

  let overlay = document.getElementById('fl-popup');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'fl-popup';
    overlay.className = 'overlay';
    overlay.style.display = 'none';
    overlay.onclick = e=>{ if(e.target===overlay) closeFlPopup(); };
    document.body.appendChild(overlay);
  }

  const itemsHtml = items.map((item,i)=>`
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 12px 10px;margin-bottom:8px;position:relative;"
         class="${item.alarmTime?'alarm-active':''}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(79,124,255,.15);color:var(--accent);">
          ${FL_TYPES[item.type]?.label||'📌 기타'}
        </span>
        ${item.alarmTime?`<span style="font-size:10px;color:var(--yellow);">🔔 ${item.alarmTime}</span>`:''}
        <button onclick="deleteFlItem('${key}',${i})" style="margin-left:auto;background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;line-height:1;">✕</button>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:3px;">${item.title}</div>
      ${item.note?`<div style="font-size:12px;color:var(--text2);line-height:1.5;">${item.note}</div>`:''}
    </div>`).join('');

  overlay.innerHTML = `
    <div class="popup" style="width:400px;padding:22px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:16px;margin:0;">💻 ${dateLabel}</h3>
        <button onclick="closeFlPopup()" style="background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;">✕</button>
      </div>

      <!-- 등록된 스케줄 -->
      <div id="fl-items-list" style="max-height:220px;overflow-y:auto;margin-bottom:14px;">
        ${items.length?itemsHtml:'<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">등록된 스케줄 없음</div>'}
      </div>

      <!-- 새 스케줄 추가 폼 -->
      <div style="background:rgba(79,124,255,.05);border:1px solid rgba(79,124,255,.2);border-radius:12px;padding:14px;">
        <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:10px;">+ 새 스케줄 추가</div>

        <!-- 유형 선택 -->
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;" id="fl-type-btns">
          ${Object.entries(FL_TYPES).map(([k,v])=>`
            <button onclick="selFlType('${k}')" id="flt-${k}"
              style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);
                     background:${k==='work'?'rgba(79,124,255,.2)':'var(--surface2)'};
                     color:${k==='work'?'var(--accent)':'var(--text2)'};
                     font-size:12px;font-weight:600;cursor:pointer;font-family:'Noto Sans KR';
                     transition:all .15s;">${v.label}</button>`).join('')}
        </div>

        <!-- 제목 -->
        <input id="fl-title-inp" type="text" placeholder="제목 (예: 클라이언트 미팅, 프로젝트 마감)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:14px;font-family:'Noto Sans KR';outline:none;
                 margin-bottom:8px;">

        <!-- 메모 -->
        <textarea id="fl-note-inp" placeholder="메모 (선택사항)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:13px;font-family:'Noto Sans KR';outline:none;
                 resize:none;height:56px;margin-bottom:8px;"></textarea>

        <!-- 알람 시간 -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:13px;color:var(--text2);">🔔 알람</span>
          <input id="fl-alarm-inp" type="time"
            style="background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:6px;padding:6px 10px;font-size:13px;font-family:'Noto Sans KR';outline:none;flex:1;">
          <span style="font-size:11px;color:var(--text3);">시간 선택 (선택사항)</span>
        </div>

        <button onclick="addFlItem('${key}')"
          style="width:100%;padding:11px;border-radius:8px;border:none;
                 background:var(--accent);color:#fff;font-size:14px;font-weight:700;
                 cursor:pointer;font-family:'Noto Sans KR';">+ 추가</button>
      </div>

      <button onclick="closeFlPopup()" style="width:100%;margin-top:10px;padding:10px;border-radius:8px;
        border:1px solid var(--border);background:var(--surface2);color:var(--text2);
        font-size:14px;cursor:pointer;font-family:'Noto Sans KR';">닫기</button>
    </div>`;

  overlay.style.display = 'flex';
  // work 타입 기본 선택
  window._flSelType = 'work';
}

function selFlType(t){
  window._flSelType = t;
  Object.keys(FL_TYPES).forEach(k=>{
    const btn = document.getElementById('flt-'+k);
    if(!btn) return;
    btn.style.background = k===t?'rgba(79,124,255,.2)':'var(--surface2)';
    btn.style.color = k===t?'var(--accent)':'var(--text2)';
    btn.style.borderColor = k===t?'var(--accent)':'var(--border)';
  });
}

function addFlItem(key){
  const title = (document.getElementById('fl-title-inp').value||'').trim();
  if(!title){ showToast('⚠️ 제목을 입력해주세요'); return; }
  const note = (document.getElementById('fl-note-inp').value||'').trim();
  const alarmTime = document.getElementById('fl-alarm-inp').value || '';
  const type = window._flSelType || 'work';

  if(!flData[key]) flData[key] = [];
  const item = { id: Date.now(), type, title, note, alarmTime };
  flData[key].push(item);

  // 알람 등록
  if(alarmTime){
    registerAlarm(key, alarmTime, `📅 ${title}`);
  }
  lsSave();
  renderCalendar();
  closeFlPopup();
  showToast('✅ 스케줄 추가됨');
}

function deleteFlItem(key, idx){
  if(!flData[key]) return;
  flData[key].splice(idx, 1);
  if(flData[key].length === 0) delete flData[key];
  lsSave();
  renderCalendar();
  closeFlPopup();
}

function closeFlPopup(){
  const o = document.getElementById('fl-popup');
  if(o) o.style.display = 'none';
}

// ══════════════════════════════════════════
// 알바 모드 - 날짜별 알바 입력 팝업
// ══════════════════════════════════════════
function openAlbaPopup(key, d){
  editKey = key;
  const items = albaData[key] || [];
  const dateLabel = `${curY}년 ${curM+1}월 ${d}일`;

  let overlay = document.getElementById('alba-popup');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'alba-popup';
    overlay.className = 'overlay';
    overlay.style.display = 'none';
    overlay.onclick = e=>{ if(e.target===overlay) closeAlbaPopup(); };
    document.body.appendChild(overlay);
  }

  const fmtWon = n => n ? n.toLocaleString('ko-KR')+'원' : '0원';
  const calcPay = item => {
    if(!item.startH || !item.endH) return 0;
    let h = item.endH - item.startH;
    if(h < 0) h += 24;
    return Math.round(h * (item.wage||0));
  };

  const itemsHtml = items.map((item,i)=>{
    const pay = calcPay(item);
    const hrs = item.endH && item.startH ? (()=>{let h=item.endH-item.startH;if(h<0)h+=24;return h;})() : 0;
    return `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;position:relative;"
           class="${item.alarmTime?'alarm-active':''}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:14px;font-weight:700;color:var(--text);flex:1;">${item.name||'알바'}</span>
          ${item.alarmTime?`<span style="font-size:10px;color:var(--yellow);">🔔 ${item.alarmTime}</span>`:''}
          <button onclick="deleteAlbaItem('${key}',${i})" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;line-height:1;">✕</button>
        </div>
        <div style="font-size:12px;color:var(--text2);display:flex;gap:12px;flex-wrap:wrap;">
          ${item.startH!==undefined?`<span>⏰ ${pad2(item.startH)}:00 ~ ${pad2(item.endH)}:00 (${hrs}h)</span>`:''}
          ${item.wage?`<span>💰 시급 ${item.wage.toLocaleString()}원</span>`:''}
          ${pay>0?`<span style="color:var(--green);font-weight:700;">= ${fmtWon(pay)}</span>`:''}
        </div>
        ${item.note?`<div style="font-size:12px;color:var(--text3);margin-top:4px;">${item.note}</div>`:''}
      </div>`;
  }).join('');

  // 총 수입 계산
  const totalPay = items.reduce((s,it)=>s+calcPay(it),0);
  const tax33 = Math.round(totalPay * 0.033);
  const afterTax = totalPay - tax33;

  overlay.innerHTML = `
    <div class="popup" style="width:400px;padding:22px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:16px;margin:0;">⏰ ${dateLabel}</h3>
        <button onclick="closeAlbaPopup()" style="background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;">✕</button>
      </div>

      <!-- 합계 + 3.3% 세금 -->
      ${totalPay>0?`<div style="background:rgba(61,214,140,.1);border:1px solid rgba(61,214,140,.3);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:13px;color:var(--text2);">오늘 급여 합계</span>
          <span style="font-size:16px;font-weight:700;color:var(--text);">${fmtWon(totalPay)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:12px;color:var(--red);">3.3% 원천징수 공제</span>
          <span style="font-size:13px;font-weight:600;color:var(--red);">-${fmtWon(tax33)}</span>
        </div>
        <div style="border-top:1px solid rgba(61,214,140,.3);margin-top:4px;padding-top:6px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;font-weight:700;color:var(--text2);">실수령 (세후)</span>
          <span style="font-size:18px;font-weight:700;color:var(--green);">${fmtWon(afterTax)}</span>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-top:4px;">※ 3.3% = 소득세 3% + 지방소득세 0.3% (프리랜서/알바 원천징수)</div>
      </div>`:''}

      <!-- 등록된 알바 목록 -->
      <div style="max-height:200px;overflow-y:auto;margin-bottom:14px;">
        ${items.length?itemsHtml:'<div style="text-align:center;padding:18px;color:var(--text3);font-size:13px;">등록된 알바 없음</div>'}
      </div>

      <!-- 새 알바 추가 폼 -->
      <div style="background:rgba(255,140,66,.05);border:1px solid rgba(255,140,66,.25);border-radius:12px;padding:14px;">
        <div style="font-size:12px;font-weight:700;color:var(--orange);margin-bottom:10px;">+ 알바 추가</div>

        <input id="alba-name-inp" type="text" placeholder="알바명 (예: 편의점, 카페, 배달)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:10px 12px;font-size:14px;font-family:'Noto Sans KR';outline:none;margin-bottom:8px;">

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px;">출근 시간</div>
            <select id="alba-start-inp" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:7px 8px;font-size:13px;font-family:'Noto Sans KR';">
              ${Array.from({length:24},(_,h)=>`<option value="${h}">${pad2(h)}:00</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px;">퇴근 시간</div>
            <select id="alba-end-inp" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:7px 8px;font-size:13px;font-family:'Noto Sans KR';">
              ${Array.from({length:24},(_,h)=>`<option value="${h}" ${h===18?'selected':''}>${pad2(h)}:00</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px;">시급 (원)</div>
            <input id="alba-wage-inp" type="number" value="" id="alba-wage-inp" min="0" step="100"
              style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                     border-radius:6px;padding:7px 8px;font-size:13px;font-family:'Noto Sans KR';outline:none;text-align:right;">
          </div>
        </div>

        <textarea id="alba-note-inp" placeholder="메모 (선택사항)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:13px;font-family:'Noto Sans KR';outline:none;
                 resize:none;height:48px;margin-bottom:8px;"></textarea>

        <!-- 알람 -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:13px;color:var(--text2);">🔔 알람</span>
          <input id="alba-alarm-inp" type="time"
            style="background:var(--surface2);border:1px solid var(--border);color:var(--text);
                   border-radius:6px;padding:6px 10px;font-size:13px;font-family:'Noto Sans KR';outline:none;flex:1;">
          <span style="font-size:11px;color:var(--text3);">출근 알람 시간</span>
        </div>

        <button onclick="addAlbaItem('${key}')"
          style="width:100%;padding:11px;border-radius:8px;border:none;
                 background:var(--orange);color:#fff;font-size:14px;font-weight:700;
                 cursor:pointer;font-family:'Noto Sans KR';">+ 추가</button>
      </div>

      <button onclick="closeAlbaPopup()" style="width:100%;margin-top:10px;padding:10px;border-radius:8px;
        border:1px solid var(--border);background:var(--surface2);color:var(--text2);
        font-size:14px;cursor:pointer;font-family:'Noto Sans KR';">닫기</button>
    </div>`;

  overlay.style.display = 'flex';
  // 기본 출근시간 9시로 맞춤
  const startSel = document.getElementById('alba-start-inp');
  if(startSel) startSel.value = '9';
}

function addAlbaItem(key){
  const name = (document.getElementById('alba-name-inp').value||'').trim();
  if(!name){ showToast('⚠️ 알바명을 입력해주세요'); return; }
  const startH = parseInt(document.getElementById('alba-start-inp').value)||0;
  const endH   = parseInt(document.getElementById('alba-end-inp').value)||18;
  const wageEl = document.getElementById('alba-wage-inp'); if(wageEl && !wageEl.value) wageEl.value = CURRENT_MIN_WAGE;
  const wage   = parseInt(document.getElementById('alba-wage-inp').value)||CURRENT_MIN_WAGE;
  const note   = (document.getElementById('alba-note-inp').value||'').trim();
  const alarmTime = document.getElementById('alba-alarm-inp').value || '';

  if(!albaData[key]) albaData[key] = [];
  albaData[key].push({ id:Date.now(), name, startH, endH, wage, note, alarmTime });

  if(alarmTime) registerAlarm(key, alarmTime, `⏰ ${name} 알바 시작`);
  lsSave();
  renderCalendar();
  closeAlbaPopup();
  showToast('✅ 알바 추가됨');
}

function deleteAlbaItem(key, idx){
  if(!albaData[key]) return;
  albaData[key].splice(idx, 1);
  if(albaData[key].length===0) delete albaData[key];
  lsSave();
  renderCalendar();
  closeAlbaPopup();
}

function closeAlbaPopup(){
  const o = document.getElementById('alba-popup');
  if(o) o.style.display = 'none';
}

// ══════════════════════════════════════════
// 알람 시스템 (Web Notifications + Interval)
// ══════════════════════════════════════════
function registerAlarm(dateKey, timeStr, label){
  // 기존 같은 날짜+시간 중복 제거
  alarmList = alarmList.filter(a => !(a.key===dateKey && a.time===timeStr && a.label===label));
  alarmList.push({ key: dateKey, time: timeStr, label, fired: false });
  lsSave();
  requestNotifPermission();
}

function requestNotifPermission(){
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
}

function startAlarmTick(){
  if(_alarmTick) return;
  _alarmTick = setInterval(checkAlarms, 30000); // 30초마다 체크
  checkAlarms(); // 즉시 1회 체크
}

function checkAlarms(){
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
  const nowTime = pad2(now.getHours())+':'+pad2(now.getMinutes());

  alarmList.forEach((alarm, idx) => {
    if(alarm.fired) return;
    if(alarm.key !== todayKey) return;
    if(alarm.time !== nowTime) return;

    // 알람 발동!
    alarmList[idx].fired = true;
    fireAlarm(alarm.label, alarm.key);
  });
}

function fireAlarm(label, dateKey){
  // 브라우저 알림
  if('Notification' in window && Notification.permission === 'granted'){
    new Notification('📅 일정 알람', {
      body: label,
      icon: localStorage.getItem('companyLogo') || '',
      badge: '',
      tag: 'atm-alarm-' + dateKey
    });
  }
  // 인앱 토스트 (항상 표시)
  let t = document.getElementById('_alarm-toast');
  if(!t){
    t = document.createElement('div');
    t.id = '_alarm-toast';
    t.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);
      background:linear-gradient(135deg,#4f7cff,#9b7cff);color:#fff;
      padding:14px 24px;border-radius:16px;font-size:15px;font-weight:700;
      z-index:9999;box-shadow:0 8px 32px rgba(79,124,255,.4);
      font-family:'Noto Sans KR';text-align:center;max-width:90vw;
      border:1px solid rgba(255,255,255,.3);`;
    document.body.appendChild(t);
  }
  t.innerHTML = `🔔 알람<br><span style="font-size:13px;font-weight:400;opacity:.9;">${label}</span>`;
  t.style.display = 'block';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.style.display='none',400); }, 5000);
  // 진동 (모바일)
  if('vibrate' in navigator) navigator.vibrate([200,100,200]);
  playNotifSound('alarm');
  lsSave();
}

// ══════════════════════════════════════════
// 달력 렌더 오버라이드 (프리랜서/알바 모드)
// ══════════════════════════════════════════
const _origRenderCalendar = renderCalendar;
renderCalendar = function(){
  if(jobType === 'freelancer'){
    renderFlCalendar();
  } else if(jobType === 'alba'){
    renderAlbaCalendar();
  } else {
    _origRenderCalendar();
  }
};

function renderFlCalendar(){
  const today = new Date();
  document.getElementById('month-title').textContent = `${curY}년 ${curM+1}월`;
  const grid = document.getElementById('calendar');
  grid.innerHTML = '';
  ['일','월','화','수','목','금','토'].forEach(d=>{
    const h=document.createElement('div');
    h.className='cal-hdr'; h.textContent=d; grid.appendChild(h);
  });
  const firstDay = new Date(curY,curM,1).getDay();
  for(let i=0;i<firstDay;i++){
    const e=document.createElement('div'); e.className='cal-day empty'; grid.appendChild(e);
  }
  const dim = new Date(curY,curM+1,0).getDate();
  // 월별 스케줄 수 집계
  let totalItems=0, totalAlarm=0;
  for(let d=1;d<=dim;d++){
    const key=dk(curY,curM,d);
    const items = flData[key]||[];
    totalItems += items.length;
    if(items.some(it=>it.alarmTime)) totalAlarm++;
    const dow = new Date(curY,curM,d).getDay();
    const isToday = today.getFullYear()===curY&&today.getMonth()===curM&&today.getDate()===d;
    const el=document.createElement('div');
    el.className='cal-day'+(isToday?' today':'')+(dow===0?' is-sun':'')+(dow===6?' is-sat':'');
    if(items.some(it=>it.alarmTime)) el.classList.add('alarm-active');
    el.onclick=()=>openFlPopup(key,d);
    let html=`<div class="dn">${d}</div>`;
    const hName=HOLIDAYS[key];
    if(hName) html+=`<div style="font-size:8px;color:var(--orange);margin-bottom:2px;">${hName}</div>`;
    items.slice(0,3).forEach(item=>{
      const cls = FL_TYPES[item.type]?.cls||'type-etc';
      html+=`<div class="fl-chip ${cls}${item.alarmTime?' has-alarm':''}">${item.title}</div>`;
    });
    if(items.length>3) html+=`<div style="font-size:8px;color:var(--text3);">+${items.length-3}개 더</div>`;
    el.innerHTML=html;
    grid.appendChild(el);
  }
  // stats-row: 프리랜서용
  document.getElementById('stats-row').innerHTML=`
    <div class="stat-card"><div class="lbl">이번달 일정</div><div class="val" style="color:var(--accent)">${totalItems}</div></div>
    <div class="stat-card"><div class="lbl">알람 설정</div><div class="val" style="color:var(--yellow)">${totalAlarm}개</div></div>
    <div class="stat-card" onclick="showAlarmManager()" style="cursor:pointer;">
      <div class="lbl">🔔 알람 관리</div>
      <div class="val" style="font-size:14px;color:var(--green);">보기</div>
    </div>`;
}

function renderAlbaCalendar(){
  const today = new Date();
  document.getElementById('month-title').textContent = `${curY}년 ${curM+1}월`;
  const grid = document.getElementById('calendar');
  grid.innerHTML = '';
  ['일','월','화','수','목','금','토'].forEach(d=>{
    const h=document.createElement('div');
    h.className='cal-hdr'; h.textContent=d; grid.appendChild(h);
  });
  const firstDay = new Date(curY,curM,1).getDay();
  for(let i=0;i<firstDay;i++){
    const e=document.createElement('div'); e.className='cal-day empty'; grid.appendChild(e);
  }
  const dim = new Date(curY,curM+1,0).getDate();
  let totalPay=0, workDays=0, totalHrs=0;
  for(let d=1;d<=dim;d++){
    const key=dk(curY,curM,d);
    const items = albaData[key]||[];
    const dayPay = items.reduce((s,it)=>{
      let h=it.endH-it.startH; if(h<0)h+=24;
      return s+Math.round(h*(it.wage||0));
    },0);
    const dayHrs = items.reduce((s,it)=>{
      let h=it.endH-it.startH; if(h<0)h+=24; return s+h;
    },0);
    if(items.length>0){ workDays++; totalPay+=dayPay; totalHrs+=dayHrs; }
    const dow = new Date(curY,curM,d).getDay();
    const isToday = today.getFullYear()===curY&&today.getMonth()===curM&&today.getDate()===d;
    const el=document.createElement('div');
    el.className='cal-day'+(isToday?' today':'')+(dow===0?' is-sun':'')+(dow===6?' is-sat':'');
    if(items.some(it=>it.alarmTime)) el.classList.add('alarm-active');
    el.onclick=()=>openAlbaPopup(key,d);
    let html=`<div class="dn">${d}</div>`;
    const hName=HOLIDAYS[key];
    if(hName) html+=`<div style="font-size:8px;color:var(--orange);margin-bottom:2px;">${hName}</div>`;
    items.slice(0,2).forEach(item=>{
      const hrs=(()=>{let h=item.endH-item.startH;if(h<0)h+=24;return h;})();
      html+=`<div class="alba-chip${item.alarmTime?' has-alarm':''}">${item.name||'알바'} ${hrs}h</div>`;
    });
    if(items.length>2) html+=`<div style="font-size:8px;color:var(--text3);">+${items.length-2}</div>`;
    if(dayPay>0) html+=`<div style="font-size:9px;color:var(--green);font-weight:700;margin-top:1px;">${Math.round(dayPay/1000)}천원</div>`;
    el.innerHTML=html;
    grid.appendChild(el);
  }
  // stats-row: 알바용
  document.getElementById('stats-row').innerHTML=`
    <div class="stat-card"><div class="lbl">알바 일수</div><div class="val" style="color:var(--accent)">${workDays}일</div></div>
    <div class="stat-card"><div class="lbl">총 근무시간</div><div class="val" style="color:var(--yellow)">${totalHrs}h</div></div>
    <div class="stat-card"><div class="lbl">이번달 수입</div><div class="val" style="color:var(--green);font-size:15px;">${totalPay>=10000?Math.round(totalPay/10000)+'만':totalPay.toLocaleString()}원</div></div>
    <div class="stat-card"><div class="lbl">3.3% 공제후</div><div class="val" style="color:var(--accent);font-size:15px;">${(()=>{const a=Math.round(totalPay*0.967);return a>=10000?Math.round(a/10000)+'만':a.toLocaleString()})()}원</div></div>
    <div class="stat-card" onclick="showAlarmManager()" style="cursor:pointer;">
      <div class="lbl">🔔 알람 관리</div><div class="val" style="font-size:14px;">보기</div>
    </div>`;
}

// ══════════════════════════════════════════
// 알람 관리 팝업
// ══════════════════════════════════════════
function showAlarmManager(){
  let overlay = document.getElementById('alarm-mgr-popup');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'alarm-mgr-popup';
    overlay.className = 'overlay';
    overlay.style.display = 'none';
    overlay.onclick = e=>{ if(e.target===overlay) overlay.style.display='none'; };
    document.body.appendChild(overlay);
  }

  const upcoming = alarmList
    .filter(a=>!a.fired)
    .sort((a,b)=>a.key>b.key?1:a.key<b.key?-1:a.time>b.time?1:-1);
  const fired = alarmList.filter(a=>a.fired);

  const listHtml = upcoming.length ? upcoming.map((a,i)=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);
                border:1px solid var(--border);border-radius:8px;margin-bottom:6px;">
      <span style="font-size:20px;">🔔</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:var(--text);">${a.label}</div>
        <div style="font-size:11px;color:var(--text3);">${a.key} · ${a.time}</div>
      </div>
      <button onclick="removeAlarm(${alarmList.indexOf(a)})" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;">✕</button>
    </div>`).join('')
    : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">등록된 알람 없음</div>';

  overlay.innerHTML = `
    <div class="popup" style="width:380px;padding:22px 20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-size:16px;margin:0;">🔔 알람 관리</h3>
        <button onclick="document.getElementById('alarm-mgr-popup').style.display='none'"
          style="background:none;border:none;color:var(--text2);font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;">
        예정된 알람 (${upcoming.length}개)
      </div>
      <div style="max-height:280px;overflow-y:auto;margin-bottom:12px;">${listHtml}</div>
      ${fired.length?`<div style="font-size:11px;color:var(--text3);margin-bottom:8px;">완료된 알람 ${fired.length}개</div>`:''}
      <div style="display:flex;gap:8px;">
        <button onclick="clearFiredAlarms()" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--border);
          background:var(--surface2);color:var(--text2);font-size:13px;cursor:pointer;font-family:'Noto Sans KR';">
          완료 알람 정리</button>
        <button onclick="document.getElementById('alarm-mgr-popup').style.display='none'"
          style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--border);
          background:var(--surface2);color:var(--text2);font-size:13px;cursor:pointer;font-family:'Noto Sans KR';">
          닫기</button>
      </div>
    </div>`;
  overlay.style.display = 'flex';
}

function removeAlarm(idx){
  alarmList.splice(idx,1);
  lsSave();
  showAlarmManager(); // 새로고침
}

function clearFiredAlarms(){
  alarmList = alarmList.filter(a=>!a.fired);
  lsSave();
  showAlarmManager();
}


// ══════════════════════════════════════════

// ══════════════════════════════════════════
// N잡 달력 통합 — 직장인 날짜 팝업에 알바/배달/프리 섹션 추가
// ══════════════════════════════════════════

// N잡 데이터 키: atm2_njob_YYYY-MM-DD
function njobKey(key){ return 'atm2_njob_'+key; }

function njobLoad(key){
  try{ const r=localStorage.getItem(njobKey(key)); if(r) return JSON.parse(r); }catch(e){}
  return { alba:[], delivery:[], free:[] };
}

function njobSave(key, data){
  try{ localStorage.setItem(njobKey(key), JSON.stringify(data)); }catch(e){}
  renderCalendar();
  njobRefresh(key);
}

// 팝업 열릴 때 N잡 섹션 초기화
function initNjobSection(key){
  const selectedJobs = loadSelectedJobs ? loadSelectedJobs() : [];
  const hasNjob = selectedJobs.some(j=>j!=='employee');
  const sec = document.getElementById('njob-section');
  if(!sec) return;

  // 항상 N잡 섹션 표시 (직장인도 N잡 가능)
  sec.style.display='block';

  // 알바/배달/프리랜서 3개 섹션 항상 모두 표시
  const albaWrap = document.getElementById('njob-alba-wrap');
  const deliveryWrap = document.getElementById('njob-delivery-wrap');
  const freeWrap = document.getElementById('njob-free-wrap');

  if(albaWrap) albaWrap.style.display = 'block';
  if(deliveryWrap) deliveryWrap.style.display = 'block';
  if(freeWrap) freeWrap.style.display = 'block';

  // 기존 데이터 로드
  const data = njobLoad(key);

  // 시급 자동세팅
  const wageKey='atm2_jobWages'; let wages={};
  try{ const r=localStorage.getItem(wageKey); if(r) wages=JSON.parse(r); }catch(e){}
  const albaWageEl = document.getElementById('njob-alba-wage');
  if(albaWageEl){
    const j = selectedJobs.find(j=>['convenience','shortAlba'].includes(j));
    albaWageEl.value = wages[j] || 10320;
  }

  njobRefresh(key);
  njobBindPreviews();
}

function njobRefresh(key){
  const data = njobLoad(key);

  // 알바 목록 렌더
  const albaList = document.getElementById('njob-alba-items');
  if(albaList){
    albaList.innerHTML = data.alba.map((it,i)=>{
      const amt = it.amount || Math.round((it.wage||0)*(it.hours||0));
      const timeStr = it.startTime ? `${it.startTime}~${it.endTime}` : `${it.hours}시간`;
      const detailStr = it.detail || `${it.wage.toLocaleString()}원/h`;
      const nightBadge = it.nightHours > 0
        ? `<span style="font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(79,124,255,.15);color:var(--accent);margin-left:4px;">야간포함</span>` : '';
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:7px 10px;background:var(--surface);border:1px solid var(--border);
                  border-radius:8px;margin-bottom:5px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:var(--text);">${it.name||'알바'}${nightBadge}</div>
          <div style="font-size:11px;color:var(--text3);">${timeStr} · ${detailStr}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <span style="font-size:13px;font-weight:700;color:var(--green);">+${amt.toLocaleString()}원</span>
          <button onclick="deleteNjobItem('${key}','alba',${i})"
            style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;">✕</button>
        </div>
      </div>`;
    }).join('') || '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px;">기록 없음</div>';
    const badge = document.getElementById('njob-alba-badge');
    if(badge) badge.textContent = data.alba.length>0?`(${data.alba.length}건)`:'';
  }

  // 배달/대리 목록 렌더
  const delivList = document.getElementById('njob-delivery-items');
  if(delivList){
    delivList.innerHTML = data.delivery.map((it,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:7px 10px;background:var(--surface);border:1px solid var(--border);
                  border-radius:8px;margin-bottom:5px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);">${it.name||'배달'}</div>
          <div style="font-size:11px;color:var(--text3);">${it.count}건 × ${it.price.toLocaleString()}원</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:700;color:var(--green);">+${(it.count*it.price).toLocaleString()}원</span>
          <button onclick="deleteNjobItem('${key}','delivery',${i})"
            style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;">✕</button>
        </div>
      </div>`).join('') || '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px;">기록 없음</div>';
    const badge = document.getElementById('njob-delivery-badge');
    if(badge) badge.textContent = data.delivery.length>0?`(${data.delivery.length}건)`:'';
  }

  // 프리랜서 목록 렌더
  const freeList = document.getElementById('njob-free-items');
  if(freeList){
    freeList.innerHTML = data.free.map((it,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:7px 10px;background:var(--surface);border:1px solid var(--border);
                  border-radius:8px;margin-bottom:5px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);">${it.name||'외주'}</div>
          <div style="font-size:11px;color:var(--text3);">${it.count}건 × ${it.price.toLocaleString()}원</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:700;color:var(--green);">+${(it.count*it.price).toLocaleString()}원</span>
          <button onclick="deleteNjobItem('${key}','free',${i})"
            style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;">✕</button>
        </div>
      </div>`).join('') || '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px;">기록 없음</div>';
    const badge = document.getElementById('njob-free-badge');
    if(badge) badge.textContent = data.free.length>0?`(${data.free.length}건)`:'';
  }

  // 오늘 N잡 합계
  const albaTotal = data.alba.reduce((s,it)=>s+Math.round(it.wage*it.hours),0);
  const delivTotal = data.delivery.reduce((s,it)=>s+(it.count*it.price),0);
  const freeTotal = data.free.reduce((s,it)=>s+(it.count*it.price),0);
  const total = albaTotal + delivTotal + freeTotal;
  const totalBar = document.getElementById('njob-total-bar');
  const totalVal = document.getElementById('njob-total-val');
  if(totalBar) totalBar.style.display = total>0?'flex':'none';
  if(totalVal) totalVal.textContent = '+'+total.toLocaleString()+'원';
}

function njobBindPreviews(){
  // 알바 미리보기
  const albaW = document.getElementById('njob-alba-wage');
  const albaH = document.getElementById('njob-alba-hours');
  const albaPrev = document.getElementById('njob-alba-preview');
  [albaW, albaH].forEach(el=>{
    if(el) el.addEventListener('input',()=>{
      const w=parseInt(albaW?.value)||0, h=parseFloat(albaH?.value)||0;
      if(albaPrev){ if(w>0&&h>0){albaPrev.style.display='block';albaPrev.textContent=`${w.toLocaleString()}원 × ${h}시간 = ${Math.round(w*h).toLocaleString()}원`;}else albaPrev.style.display='none';}
    });
  });
  // 배달 미리보기
  const delivC = document.getElementById('njob-delivery-count');
  const delivP = document.getElementById('njob-delivery-price');
  const delivPrev = document.getElementById('njob-delivery-preview');
  [delivC, delivP].forEach(el=>{
    if(el) el.addEventListener('input',()=>{
      const c=parseInt(delivC?.value)||0, p=parseInt(delivP?.value)||0;
      if(delivPrev){ if(c>0&&p>0){delivPrev.style.display='block';delivPrev.textContent=`${c}건 × ${p.toLocaleString()}원 = ${(c*p).toLocaleString()}원`;}else delivPrev.style.display='none';}
    });
  });
  // 프리 미리보기
  const freeC = document.getElementById('njob-free-count');
  const freeP = document.getElementById('njob-free-price');
  const freePrev = document.getElementById('njob-free-preview');
  [freeC, freeP].forEach(el=>{
    if(el) el.addEventListener('input',()=>{
      const c=parseInt(freeC?.value)||0, p=parseInt(freeP?.value)||0;
      if(freePrev){ if(c>0&&p>0){freePrev.style.display='block';freePrev.textContent=`${c}건 × ${p.toLocaleString()}원 = ${(c*p).toLocaleString()}원`;}else freePrev.style.display='none';}
    });
  });
}

function toggleNjobSec(type){
  const body = document.getElementById(`njob-${type}-body`);
  const arr = document.getElementById(`njob-${type}-arr`);
  if(!body) return;
  const open = body.style.display==='none';
  body.style.display = open?'block':'none';
  if(arr) arr.textContent = open?'▲':'▼';
}

function addNjobAlba(){
  const key = editKey;
  const name = (document.getElementById('njob-alba-name')?.value||'').trim();
  const wage = parseInt(document.getElementById('njob-alba-wage')?.value)||0;
  const hours = parseFloat(document.getElementById('njob-alba-hours')?.value)||0;
  if(!name){showToast('⚠️ 알바명을 입력해주세요');return;}
  if(wage<=0){showToast('⚠️ 시급을 입력해주세요');return;}
  if(hours<=0){showToast('⚠️ 근무시간을 입력해주세요');return;}
  const data = njobLoad(key);
  data.alba.push({id:Date.now(), name, wage, hours});
  njobSave(key, data);
  // 시급 저장
  const selectedJobs = loadSelectedJobs?loadSelectedJobs():[];
  const j = selectedJobs.find(j=>['convenience','shortAlba'].includes(j));
  if(j){ const wk='atm2_jobWages';let wages={};try{const r=localStorage.getItem(wk);if(r)wages=JSON.parse(r);}catch(e){} wages[j]=wage; try{localStorage.setItem(wk,JSON.stringify(wages));}catch(e){} }
  document.getElementById('njob-alba-name').value='';
  document.getElementById('njob-alba-hours').value='';
  document.getElementById('njob-alba-preview').style.display='none';
  showToast(`✅ ${name} +${Math.round(wage*hours).toLocaleString()}원 추가됨`);
}

function addNjobDelivery(){
  const key = editKey;
  const name = (document.getElementById('njob-delivery-name')?.value||'').trim();
  const count = parseInt(document.getElementById('njob-delivery-count')?.value)||0;
  const price = parseInt(document.getElementById('njob-delivery-price')?.value)||0;
  if(!name){showToast('⚠️ 배달앱명을 입력해주세요');return;}
  if(count<=0){showToast('⚠️ 건수를 입력해주세요');return;}
  if(price<=0){showToast('⚠️ 건당 단가를 입력해주세요');return;}
  const data = njobLoad(key);
  data.delivery.push({id:Date.now(), name, count, price});
  njobSave(key, data);
  document.getElementById('njob-delivery-name').value='';
  document.getElementById('njob-delivery-count').value='';
  document.getElementById('njob-delivery-price').value='';
  document.getElementById('njob-delivery-preview').style.display='none';
  showToast(`✅ ${name} ${count}건 +${(count*price).toLocaleString()}원 추가됨`);
}

function addNjobFree(){
  const key = editKey;
  const name = (document.getElementById('njob-free-name')?.value||'').trim();
  const count = parseInt(document.getElementById('njob-free-count')?.value)||1;
  const price = parseInt(document.getElementById('njob-free-price')?.value)||0;
  if(!name){showToast('⚠️ 프로젝트명을 입력해주세요');return;}
  if(price<=0){showToast('⚠️ 단가를 입력해주세요');return;}
  const data = njobLoad(key);
  data.free.push({id:Date.now(), name, count, price});
  njobSave(key, data);
  document.getElementById('njob-free-name').value='';
  document.getElementById('njob-free-count').value='1';
  document.getElementById('njob-free-price').value='';
  document.getElementById('njob-free-preview').style.display='none';
  showToast(`✅ ${name} +${(count*price).toLocaleString()}원 추가됨`);
}

function deleteNjobItem(key, type, idx){
  const data = njobLoad(key);
  if(data[type]) data[type].splice(idx,1);
  njobSave(key, data);
  showToast('🗑️ 삭제됨');
}

// ── 달력 날짜에 N잡 수입 표시 ──
function njobDayTotal(key){
  const data = njobLoad(key);
  const a = data.alba.reduce((s,it)=>s+Math.round(it.wage*it.hours),0);
  const d = data.delivery.reduce((s,it)=>s+(it.count*it.price),0);
  const f = data.free.reduce((s,it)=>s+(it.count*it.price),0);
  return a+d+f;
}
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// 날짜 팝업 — 아코디언 방식 직종별 기록
// ══════════════════════════════════════════

function initDayJobTabs(key){
  // N잡 섹션 항상 표시
  const njobSec = document.getElementById('njob-section');
  if(njobSec) njobSec.style.display = 'block';

  // 알바/배달/프리 섹션 항상 표시
  ['njob-alba-wrap','njob-delivery-wrap','njob-free-wrap'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = 'block';
  });

  // 기록 있는 섹션 자동 펼침
  const data = njobLoad(key);
  if(data.alba.length > 0)     autoOpenNjobSec('alba');
  if(data.delivery.length > 0) autoOpenNjobSec('delivery');
  if(data.free.length > 0)     autoOpenNjobSec('free');

  // 직장 기록 있으면 직장 섹션도 자동 펼침 (기존 팝업 로직이 처리)
}

function autoOpenNjobSec(type){
  const body = document.getElementById('njob-'+type+'-body');
  const arr  = document.getElementById('njob-'+type+'-arr');
  const hdr  = body?.previousElementSibling;
  if(!body) return;
  body.style.display = 'block';
  if(arr) arr.textContent = '▲';
  if(hdr) hdr.style.borderRadius = '10px 10px 0 0';
}
// ══════════════════════════════════════════

// ── 전체 저장 버튼 (입력된 내용 한번에 저장) ──
function saveNjobAll(){
  const key = editKey;
  if(!key){ showToast('⚠️ 날짜를 선택해주세요'); return; }

  let saved = false;

  // 알바 입력 내용 저장
  const albaName = (document.getElementById('njob-alba-name')?.value||'').trim();
  const albaWage = parseInt(document.getElementById('njob-alba-wage')?.value)||0;
  const albaHours = parseFloat(document.getElementById('njob-alba-hours')?.value)||0;
  if(albaName && albaWage > 0 && albaHours > 0){
    const data = njobLoad(key);
    data.alba.push({id:Date.now(), name:albaName, wage:albaWage, hours:albaHours});
    njobSave(key, data);
    document.getElementById('njob-alba-name').value = '';
    document.getElementById('njob-alba-hours').value = '';
    const prev = document.getElementById('njob-alba-preview');
    if(prev) prev.style.display = 'none';
    saved = true;
    // 시급 자동저장
    const wk='atm2_jobWages'; let wages={};
    try{const r=localStorage.getItem(wk);if(r)wages=JSON.parse(r);}catch(e){}
    wages['convenience'] = albaWage;
    try{localStorage.setItem(wk,JSON.stringify(wages));}catch(e){}
  }

  // 배달 입력 내용 저장
  const delivName = (document.getElementById('njob-delivery-name')?.value||'').trim();
  const delivCount = parseInt(document.getElementById('njob-delivery-count')?.value)||0;
  const delivPrice = parseInt(document.getElementById('njob-delivery-price')?.value)||0;
  if(delivName && delivCount > 0 && delivPrice > 0){
    const data = njobLoad(key);
    data.delivery.push({id:Date.now(), name:delivName, count:delivCount, price:delivPrice});
    njobSave(key, data);
    document.getElementById('njob-delivery-name').value = '';
    document.getElementById('njob-delivery-count').value = '';
    document.getElementById('njob-delivery-price').value = '';
    const prev = document.getElementById('njob-delivery-preview');
    if(prev) prev.style.display = 'none';
    saved = true;
  }

  // 프리랜서 입력 내용 저장
  const freeName = (document.getElementById('njob-free-name')?.value||'').trim();
  const freeCount = parseInt(document.getElementById('njob-free-count')?.value)||1;
  const freePrice = parseInt(document.getElementById('njob-free-price')?.value)||0;
  if(freeName && freePrice > 0){
    const data = njobLoad(key);
    data.free.push({id:Date.now(), name:freeName, count:freeCount, price:freePrice});
    njobSave(key, data);
    document.getElementById('njob-free-name').value = '';
    document.getElementById('njob-free-count').value = '1';
    document.getElementById('njob-free-price').value = '';
    const prev = document.getElementById('njob-free-preview');
    if(prev) prev.style.display = 'none';
    saved = true;
  }

  if(saved){
    showToast('✅ 저장됐어요!');
    renderCalendar();
  } else {
    showToast('⚠️ 입력된 내용이 없어요');
  }
}

// ══════════════════════════════════════════
// 알바 시간 자동 계산 (야간수당 포함)
// 야간: 22:00 ~ 06:00 → 시급 × 1.5
// ══════════════════════════════════════════

function selectAlbaType(name){
  // 버튼 스타일 토글
  document.querySelectorAll('.alba-type-btn').forEach(btn=>{
    const isSelected = btn.textContent.includes(name) && name !== '';
    btn.style.background = isSelected ? 'rgba(255,140,66,.15)' : 'var(--surface)';
    btn.style.borderColor = isSelected ? 'var(--orange)' : 'var(--border)';
    btn.style.color = isSelected ? 'var(--orange)' : 'var(--text2)';
    btn.style.fontWeight = isSelected ? '700' : '400';
  });
  // 이름 자동입력 (직접입력 제외)
  const nameInp = document.getElementById('njob-alba-name');
  if(nameInp && name !== '') nameInp.value = name;
  if(name !== '') calcAlbaAuto();
}

function calcAlbaAuto(){
  const wage = parseInt(document.getElementById('njob-alba-wage')?.value)||0;
  const startStr = document.getElementById('njob-alba-start')?.value||'09:00';
  const endStr   = document.getElementById('njob-alba-end')?.value||'18:00';
  const prev     = document.getElementById('njob-alba-preview');
  const detail   = document.getElementById('njob-alba-preview-detail');
  const total    = document.getElementById('njob-alba-preview-total');

  if(!prev||!detail||!total) return;
  if(wage <= 0){ prev.style.display='none'; return; }

  const [sh,sm] = startStr.split(':').map(Number);
  const [eh,em] = endStr.split(':').map(Number);

  let startMin = sh*60+sm;
  let endMin   = eh*60+em;
  if(endMin <= startMin) endMin += 24*60; // 익일

  const totalMin = endMin - startMin;
  const totalHours = totalMin / 60;

  // 야간 시간 계산 (22:00~06:00 = 1320~360 + 24*60)
  let nightMin = 0;
  let cur = startMin;
  while(cur < endMin){
    const h = Math.floor(cur/60) % 24;
    if(h >= 22 || h < 6) nightMin++;
    cur++;
  }

  const dayMin   = totalMin - nightMin;
  const dayHours   = Math.round(dayMin/60*10)/10;
  const nightHours = Math.round(nightMin/60*10)/10;

  const dayPay   = Math.round(dayHours * wage);
  const nightPay = Math.round(nightHours * wage * 1.5);
  const totalPay = dayPay + nightPay;

  let detailHtml = '';
  if(dayHours > 0)   detailHtml += `주간 ${dayHours}시간 × ${wage.toLocaleString()}원 = ${dayPay.toLocaleString()}원<br>`;
  if(nightHours > 0) detailHtml += `야간 ${nightHours}시간 × ${Math.round(wage*1.5).toLocaleString()}원(×1.5) = ${nightPay.toLocaleString()}원<br>`;
  detailHtml += `총 ${Math.round(totalHours*10)/10}시간 근무`;

  detail.innerHTML = detailHtml;
  total.textContent = '+'+totalPay.toLocaleString()+'원';
  prev.style.display = 'block';
}

// addNjobAlba 함수 오버라이드 — 시간 기반으로 재계산
const _origAddNjobAlba = typeof addNjobAlba !== 'undefined' ? addNjobAlba : null;

function addNjobAlba(){
  const key = editKey;
  const name = (document.getElementById('njob-alba-name')?.value||'').trim();
  const wage = parseInt(document.getElementById('njob-alba-wage')?.value)||0;
  const startStr = document.getElementById('njob-alba-start')?.value||'09:00';
  const endStr   = document.getElementById('njob-alba-end')?.value||'18:00';

  if(!name){ showToast('⚠️ 알바명을 입력해주세요'); return; }
  if(wage <= 0){ showToast('⚠️ 시급을 입력해주세요'); return; }

  const [sh,sm] = startStr.split(':').map(Number);
  const [eh,em] = endStr.split(':').map(Number);
  let startMin = sh*60+sm;
  let endMin   = eh*60+em;
  if(endMin <= startMin) endMin += 24*60;

  const totalMin = endMin - startMin;
  const totalHours = Math.round(totalMin/60*10)/10;

  // 야간 계산
  let nightMin = 0;
  let cur = startMin;
  while(cur < endMin){ const h=Math.floor(cur/60)%24; if(h>=22||h<6) nightMin++; cur++; }
  const dayMin = totalMin - nightMin;
  const dayHours   = Math.round(dayMin/60*10)/10;
  const nightHours = Math.round(nightMin/60*10)/10;
  const amount = Math.round(dayHours*wage) + Math.round(nightHours*wage*1.5);

  const detail = nightHours > 0
    ? `주간 ${dayHours}h + 야간 ${nightHours}h(×1.5)`
    : `${totalHours}시간`;

  const data = njobLoad(key);
  data.alba.push({
    id:Date.now(), name, wage, hours:totalHours,
    startTime:startStr, endTime:endStr,
    dayHours, nightHours, amount, detail
  });
  njobSave(key, data);

  // 시급 저장
  const wk='atm2_jobWages'; let wages={};
  try{const r=localStorage.getItem(wk);if(r)wages=JSON.parse(r);}catch(e){}
  wages['convenience']=wage;
  try{localStorage.setItem(wk,JSON.stringify(wages));}catch(e){}

  // 입력 초기화
  document.getElementById('njob-alba-name').value='';
  document.getElementById('njob-alba-start').value='09:00';
  document.getElementById('njob-alba-end').value='18:00';
  const prev=document.getElementById('njob-alba-preview');
  if(prev) prev.style.display='none';
  document.querySelectorAll('.alba-type-btn').forEach(b=>{
    b.style.background='var(--surface)';b.style.borderColor='var(--border)';
    b.style.color='var(--text2)';b.style.fontWeight='400';
  });

  showToast(`✅ ${name} +${amount.toLocaleString()}원 추가됨`);
  renderCalendar();
}
// ══════════════════════════════════════════
