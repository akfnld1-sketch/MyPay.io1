/**
 * sw.js — Service Worker (오프라인 지원)
 * 전략: Cache First (캐시 우선) — 오프라인에서도 앱 전체 동작
 */

const CACHE_NAME = 'attendance-v8-cache-v1';

// 캐시할 외부 리소스
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// ── 설치: 앱 자체는 브라우저가 자동 캐시, 외부 리소스만 미리 캐시 ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 외부 리소스 미리 캐시 (실패해도 설치는 계속)
      await Promise.allSettled(
        EXTERNAL_RESOURCES.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => { if(res.ok) cache.put(url, res); })
            .catch(() => {}) // 오프라인이면 무시
        )
      );
    })
  );
  self.skipWaiting();
});

// ── 활성화: 이전 캐시 삭제 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── 네트워크 요청 처리 ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // HTML 파일 → Network First (최신 버전 우선, 오프라인이면 캐시)
  if (url.endsWith('.html') || url.endsWith('/') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // 성공 시 캐시 갱신
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request)) // 오프라인 → 캐시에서
    );
    return;
  }

  // 외부 리소스(폰트, Chart.js) → Cache First (캐시 우선, 없으면 네트워크)
  if (url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com') ||
      url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request, { mode: 'cors' })
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return res;
          })
          .catch(() => new Response('', { status: 503 })); // 완전 오프라인
      })
    );
    return;
  }

  // 나머지 → 기본 네트워크
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
