/* ── 모바일 드로어 ── */
function toggleDrawer(){
  const s = document.getElementById('sidebar');
  const o = document.getElementById('drawer-overlay');
  const isOpen = s.classList.contains('open');
  if(isOpen){ closeDrawer(); } else {
    s.classList.add('open');
    o.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}
function closeDrawer(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('show');
  document.body.style.overflow = '';
}

/* ── 하단 탭 활성화 ── */
function setMobActive(page){
  document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('mob-btn-' + page);
  if(el) el.classList.add('active');
}

/* 기존 showPage 후처리 — 모바일 탭 동기화 */
const _origShowPage = typeof showPage === 'function' ? showPage : null;
(function patchShowPage(){
  // showPage는 app.js 로드 후 존재 — MutationObserver 불필요, 이벤트 위임으로 처리
  // setMobActive는 onclick에서 직접 호출하므로 추가 패치 불필요
})();

/* ── 스와이프로 드로어 열기 (좌→우 스와이프) ── */
(function(){
  let startX = 0, startY = 0;
  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    // 왼쪽 엣지(40px)에서 오른쪽으로 50px+ 스와이프
    if(startX < 40 && dx > 50 && dy < 80){
      const s = document.getElementById('sidebar');
      if(!s.classList.contains('open')) toggleDrawer();
    }
    // 드로어 열린 상태에서 오른쪽→왼쪽 스와이프로 닫기
    if(dx < -60 && dy < 80){
      const s = document.getElementById('sidebar');
      if(s.classList.contains('open')) closeDrawer();
    }
  }, { passive: true });
})();

/* ── SAO 스타일 방사형 메뉴 ── */
(function(){
  const row     = document.getElementById('sao-row');
  const overlay = document.getElementById('sao-overlay');
  const handle  = document.getElementById('sao-handle');
  const hint    = document.getElementById('sao-hint');
  if(!row) return;

  let saoOpen = false;

  // 힌트: 3초 후 서서히 사라짐
  setTimeout(()=>{ if(hint) hint.style.opacity='0'; }, 3000);

  window.toggleSaoMenu = function(){
    saoOpen ? closeSaoMenu() : openSaoMenu();
  };

  window.openSaoMenu = function(){
    if(saoOpen) return;
    saoOpen = true;
    row.classList.remove('close');
    row.classList.add('open');
    overlay.classList.add('open');
    handle.classList.add('active');
    if(hint) hint.style.opacity='0';
  };

  window.closeSaoMenu = function(){
    if(!saoOpen) return;
    saoOpen = false;
    row.classList.remove('open');
    row.classList.add('close');
    overlay.classList.remove('open');
    handle.classList.remove('active');
    // close 클래스 정리
    setTimeout(()=>{ if(!saoOpen) row.classList.remove('close'); }, 300);
  };

  // ── 오른쪽 엣지에서 왼쪽으로 스와이프 감지 ──
  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartTime = 0;

  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchStartX;   // 음수 = 왼쪽 방향
    const dy = Math.abs(endY - touchStartY);
    const dt = Date.now() - touchStartTime;
    const sw = window.innerWidth;

    // 오른쪽 엣지(60px) → 왼쪽으로 40px+ 스와이프 → 메뉴 열기
    if(!saoOpen && touchStartX > sw - 60 && dx < -40 && dy < 80 && dt < 400){
      openSaoMenu();
      return;
    }
    // 메뉴 열린 상태 → 오른쪽으로 스와이프 or 왼쪽 영역 탭 → 닫기
    if(saoOpen && dx > 40 && dy < 80 && dt < 400){
      closeSaoMenu();
    }
  }, { passive: true });

  // ESC 키
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && saoOpen) closeSaoMenu();
  });
})();


