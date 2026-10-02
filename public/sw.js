const V = 'nutriflow-v10';
const STATIC_CACHE = V;
const OFFLINE_DB = 'nutriflow-http-offline';
const OFFLINE_STORE = 'supabase-cache';

const isSupabaseRequest = request => {
  try {
    const url = new URL(request.url);
    return /(^|\.)supabase\.co$/i.test(url.hostname) ||
      /(^|\.)supabase\.in$/i.test(url.hostname);
  } catch {
    return false;
  }
};

const clearLegacySupabaseCache = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(OFFLINE_DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(OFFLINE_STORE, { keyPath: 'key' });
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  };
});

async function supabaseNetworkOnly(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch {
    return new Response(JSON.stringify({
      offline: true,
      error: 'Supabase indisponível. Use o catálogo seguro sincronizado neste dispositivo.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staticStrategy(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreSearch: false });
  const network = fetch(request, { cache: 'no-cache' }).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached || null);
  return cached || network || fetch(request);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope);
    const index = new URL('./index.html', scope);
    const response = await fetch(index, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Não foi possível pré-carregar o app: ${response.status}`);
    const html = await response.clone().text();
    const resources = [
      scope.href,
      index.href,
      ...Array.from(html.matchAll(/<(?:link\b[^>]*\bhref|script\b[^>]*\bsrc)=["']([^"']+)["']/gi), m => new URL(m[1], index).href)
    ].filter(url => {
      const parsed = new URL(url);
      return parsed.origin === scope.origin && parsed.pathname.startsWith(scope.pathname);
    });
    await (await caches.open(STATIC_CACHE)).addAll([...new Set(resources)]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== STATIC_CACHE).map(key => caches.delete(key))))
      .then(clearLegacySupabaseCache)
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' && request.method !== 'HEAD') return;
  if (isSupabaseRequest(request)) {
    event.respondWith(supabaseNetworkOnly(request));
    return;
  }
  if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(staticStrategy(request));
  }
});
