/* 自由卡片 · Service Worker：离线可用（FR-15.2） */
const CACHE = 'freecards-v3';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg',
];
// 版本强耦合三件套：HTML 引用了 JS/CSS 的元素与类名，任一件新旧错配
// 都会直接报错白屏，必须同版本。离线时回退缓存（三件套同一次写入，天然一致）。
const COUPLED = new Set(['index.html', 'styles.css', 'app.js', './', '']);

self.addEventListener('install', e => {
  // cache:'reload' 确保安装时拿到的是最新文件，不被 HTTP 缓存卡住
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  // 新版本及时生效，不卡住用户正在用的旧页面（FR-15.2）
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = url.pathname.split('/').pop().split('?')[0];
  // 页面导航 + 强耦合三件套：网络优先——在线时永远拿同版本最新，杜绝新旧错配；
  // 离线时回退缓存，保证离线可用。
  if (e.request.mode === 'navigate' || COUPLED.has(key)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html')))
    );
    return;
  }
  // 其余静态资源（图标、manifest）：缓存优先，命中不了再走网络
  e.respondWith(
    caches.match(e.request, { ignoreSearch: false }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
