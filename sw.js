// Change the version when files are added, renamed, or removed, so the old cache is deleted.
const cacheName = 'lycheelab-v1';
const precacheFiles = [
  './',
  './index.html',
  './manifest.webmanifest',
  './components/header.html',
  './components/footer.html',
  './pages/impressum.html',
  './pages/datenschutz.html',
  './pages/minesweeper/game.html',
  './pages/minesweeper/instructions.html',
  './pages/minesweeper/settings.html',
  './pages/minesweeper/statistics.html',
  './pages/minesweeper/subnavigation.html',
  './pages/2048/game.html',
  './pages/2048/instructions.html',
  './pages/2048/statistics.html',
  './pages/2048/subnavigation.html',
  './css/style.css',
  './css/minesweeper.css',
  './css/2048.css',
  './js/theme.js',
  './js/components.js',
  './js/pwa.js',
  './js/minesweeper/difficulty.js',
  './js/minesweeper/run-state.js',
  './js/minesweeper/mine-placement.js',
  './js/minesweeper/game.js',
  './js/minesweeper/settings.js',
  './js/minesweeper/statistics.js',
  './js/2048/game.js',
  './js/2048/statistics.js',
  './assets/vendor/panzoom.es.js',
  './assets/images/LycheeLab.png',
  './assets/images/minesweeper.png',
  './assets/images/2048.png',
  './assets/images/apple-touch-icon.png',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './assets/images/icon-maskable-512.png',
  './assets/icons/center.svg',
  './assets/icons/check.svg',
  './assets/icons/flag-cloth.svg',
  './assets/icons/flag-pole.svg',
  './assets/icons/fullscreen-exit.svg',
  './assets/icons/fullscreen.svg',
  './assets/icons/heart.svg',
  './assets/icons/increase.svg',
  './assets/icons/mine.svg',
  './assets/icons/next-round.svg',
  './assets/icons/questionmark.svg',
  './assets/icons/reload.svg',
  './assets/icons/zoom-in.svg',
  './assets/icons/zoom-out.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(precacheFiles))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== cacheName).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

async function storeResponse(request, response) {
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await storeResponse(request, await fetch(request));
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // GitHub Pages serves index.html for a folder address such as the site root.
    const url = new URL(request.url);
    if (request.mode === 'navigate' && url.pathname.endsWith('/')) {
      const index = await caches.match(new URL('index.html', url));
      if (index) {
        return index;
      }
    }
    throw error;
  }
}

async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request);
  const update = fetch(event.request).then((response) => storeResponse(event.request, response));

  if (cached) {
    // Keep the worker alive until the background update is stored; an offline update simply fails.
    event.waitUntil(update.catch(() => {}));
    return cached;
  }
  return update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  const isDocument = request.mode === 'navigate' || url.pathname.endsWith('.html');
  event.respondWith(isDocument ? networkFirst(request) : staleWhileRevalidate(event));
});
