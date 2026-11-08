// اخايله – Service Worker
// الصفحة: من الشبكة أولاً (عشان أي تحديث ترفعه يوصل على طول)، ولو ما فيه نت يفتح آخر نسخة محفوظة
// المكتبات والأيقونات: من الذاكرة أولاً (أسرع)
const CACHE = 'akhila-v13';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './regions.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // صفحة التطبيق نفسها
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('.html'))) {
    e.respondWith(
      fetch(req, {cache: 'no-store'})
        .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
        .catch(() => caches.match(req, {ignoreSearch:true}).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  // ملفات التطبيق الثابتة + مكتبة الخريطة
  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'unpkg.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    })));
  }
  // بيانات الطقس والرادار ما نخزنها: لازم تكون دايماً جديدة
});
