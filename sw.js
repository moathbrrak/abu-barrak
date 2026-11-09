// اخايله – Service Worker
// الصفحة: من الشبكة أولاً (عشان أي تحديث ترفعه يوصل على طول)، ولو ما فيه نت يفتح آخر نسخة محفوظة
// المكتبات والأيقونات: من الذاكرة أولاً (أسرع)
const CACHE = 'akhila-v23';
const R2C = 'akhila-r2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './regions.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => /^akhila-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
  // الخريطة المحفوظة (R2): كل جزء تشوفه ينحفظ، فيفتح بعدين بدون نت
  const range = req.headers.get('range');
  if (url.hostname.endsWith('.r2.dev') && range) {
    const key = req.url.split('?')[0] + '?r=' + encodeURIComponent(range);
    e.respondWith((async () => {
      const c = await caches.open(R2C);
      const hit = await c.match(key);
      if (hit) return new Response(await hit.arrayBuffer(), {status: 206, headers: hit.headers});
      const r = await fetch(req);
      if (r.status === 206) {
        const buf = await r.clone().arrayBuffer(), h = new Headers();
        ['content-range', 'content-type', 'etag'].forEach(k => { const v = r.headers.get(k); if (v) h.set(k, v); });
        h.set('content-length', String(buf.byteLength));
        c.put(key, new Response(buf, {status: 200, headers: h}));
      }
      return r;
    })());
    return;
  }
  // ملفات التطبيق الثابتة + مكتبة الخريطة + خطوط الخريطة
  if (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'unpkg.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'protomaps.github.io') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    })));
  }
  // بيانات الطقس والرادار ما نخزنها: لازم تكون دايماً جديدة
});
