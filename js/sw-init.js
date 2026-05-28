// Service Worker: sw.js 파일이 있을 때만 등록 (없으면 조용히 무시)
if('serviceWorker' in navigator){
  // claude.ai / 미리보기 환경에서는 sw.js 없으므로 skip
  const loc = location.href;
  const isPreview = loc.includes('claude.ai') || loc.includes('claudeusercontent') || loc.startsWith('blob:') || loc.startsWith('data:');
  if(!isPreview){
    fetch('sw.js', {method:'HEAD'})
      .then(r => {
        if(r.ok) navigator.serviceWorker.register('sw.js').catch(()=>{});
      })
      .catch(()=>{}); // sw.js 없으면 조용히 무시
  }
}

// 오프라인 상태 감지
window._isOnline = navigator.onLine;
window.addEventListener('online',  ()=>{ window._isOnline=true;  updateOnlineBadge(); });
window.addEventListener('offline', ()=>{ window._isOnline=false; updateOnlineBadge(); });

function updateOnlineBadge(){
  const badge = document.getElementById('online-badge');
  if(!badge) return;
  if(window._isOnline){
    badge.textContent = '🟢 온라인';
    badge.style.background = 'rgba(61,214,140,.15)';
    badge.style.color = 'var(--green)';
    badge.style.borderColor = 'rgba(61,214,140,.3)';
  } else {
    badge.textContent = '🔴 오프라인';
    badge.style.background = 'rgba(255,92,122,.15)';
    badge.style.color = 'var(--red)';
    badge.style.borderColor = 'rgba(255,92,122,.3)';
  }
}
