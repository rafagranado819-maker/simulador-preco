// Service worker: deixa o app instalável (PWA) e funcionar offline no básico.
const CACHE = 'revenda-v1';
const ESSENCIAIS = ['./', './index.html', './css/styles.css', './js/app.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Só cuidamos dos arquivos do próprio site. CDN e Supabase passam direto.
  if (url.origin !== location.origin) return;

  // Network-first: sempre tenta a versão nova; se estiver offline, usa o cache.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
