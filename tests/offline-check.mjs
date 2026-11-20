// Service worker: the precache list matches the served files, pages come from the network first, stylesheets are
// updated in the background, and all pages and both games work after the server is gone.
// Usage: node tests/offline-check.mjs [chrome.exe], or set CHROME_PATH.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, runBrowserCheck, siteRoot, sleep } from './browser-check.mjs';

const cacheName = readFileSync(join(siteRoot, 'sw.js'), 'utf8').match(/const cacheName = '([^']+)'/)[1];
const pages = [
  '/',
  '/index.html',
  '/pages/impressum.html',
  '/pages/datenschutz.html',
  '/pages/minesweeper/game.html',
  '/pages/minesweeper/instructions.html',
  '/pages/minesweeper/settings.html',
  '/pages/minesweeper/statistics.html',
  '/pages/2048/game.html',
  '/pages/2048/instructions.html',
  '/pages/2048/statistics.html'
];
// Files in the repository that the site never loads, so they must not be precached.
const notServed = /^(tests\/|\.|package|sw\.js$|assets\/vendor\/.*\.txt$)|\.md$/;

// Resolves false if the worker does not take control, for example because precaching failed.
const waitForController = `Promise.race([
  navigator.serviceWorker.ready.then(() => navigator.serviceWorker.controller
    ? true
    : new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once: true }))),
  new Promise((resolve) => setTimeout(() => resolve(false), 10000))
])`;
const readCache = `(async () => ({
  names: await caches.keys(),
  paths: (await (await caches.open('${cacheName}')).keys()).map((request) => new URL(request.url).pathname)
}))()`;
const putInCache = (path, body, type) => `(async () => {
  const cache = await caches.open('${cacheName}');
  await cache.put('${path}', new Response(${JSON.stringify(body)}, { headers: { 'Content-Type': '${type}' } }));
})()`;
const readPage = `(async () => {
  await window.lycheelabComponentsLoaded;
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    title: document.title,
    header: !!document.querySelector('body > #site-header'),
    footer: !!document.querySelector('body > #site-footer'),
    heading: !!document.querySelector('main h1'),
    minesweeperCells: document.querySelectorAll('#game-board .game-cell').length,
    // Panzoom is imported on demand; without it the zoom buttons stay disabled.
    zoomReady: !document.querySelector('#zoom-in')?.disabled,
    tiles2048: document.querySelectorAll('.board-2048 .tile').length
  };
})()`;

function checkPrecacheList(cache) {
  // Tracked and new, not ignored files, so the check also covers files that are not committed yet.
  const served = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: siteRoot,
    encoding: 'utf8'
  })
    .split('\n')
    .filter((file) => file && !notServed.test(file))
    .map((file) => `/${file}`);
  const cached = new Set(cache.paths);
  const missing = served.filter((path) => !cached.has(path));
  const extra = cache.paths.filter((path) => path !== '/' && !served.includes(path));

  check(cache.names.join() === cacheName, `only the cache ${cacheName} exists`, cache.names.join());
  check(missing.length === 0, `all ${served.length} served files are precached`, `missing: ${missing.join(', ')}`);
  check(extra.length === 0, 'the precache contains no files outside the repository', `extra: ${extra.join(', ')}`);
}

async function checkUpdates(session, siteUrl) {
  // A changed page is loaded from the network, not from the cache.
  await session.evaluate(putInCache('/pages/impressum.html', '<title>old copy</title>', 'text/html'));
  await session.navigate(`${siteUrl}/pages/impressum.html`);
  check((await session.evaluate('document.title')) === 'Impressum | LycheeLab', 'online, pages come from the network');

  // A changed stylesheet is used once from the cache and replaced in the background for the next load.
  await session.evaluate(putInCache('/css/style.css', 'body { background: rgb(1, 2, 3); }', 'text/css'));
  const readBackground = 'getComputedStyle(document.body).backgroundColor';
  await session.navigate(`${siteUrl}/index.html`);
  const first = await session.evaluate(readBackground);
  await sleep(500);
  await session.navigate(`${siteUrl}/index.html`);
  const second = await session.evaluate(readBackground);
  check(
    first === 'rgb(1, 2, 3)' && second !== 'rgb(1, 2, 3)',
    'stylesheets come from the cache at once and are updated for the next load',
    `${first} -> ${second}`
  );
}

async function checkOffline(session, siteUrl) {
  for (const path of pages) {
    await session.navigate(`${siteUrl}${path}`);
    const page = await session.evaluate(readPage);
    const issues = [];
    if (!page.header || !page.footer || !page.heading) issues.push('header, footer, or h1 missing');
    if (path.includes('minesweeper/game') && (page.minesweeperCells === 0 || !page.zoomReady)) {
      issues.push(`Minesweeper cells ${page.minesweeperCells}, zoom ready ${page.zoomReady}`);
    }
    if (path.includes('2048/game') && page.tiles2048 !== 16) issues.push(`2048 tiles ${page.tiles2048}`);
    check(issues.length === 0, `offline ${path}: "${page.title}" loads completely`, issues.join(', '));
  }
}

await runBrowserCheck({
  name: 'offline-check',
  serverPort: 8774,
  debugPort: 9341,
  run: async (session, { serveSite }) => {
    // A second server for the same files, so it can be stopped to take the site offline.
    const site = serveSite(siteRoot, 8775);
    await session.navigate(`${site.url}/index.html`);
    if (
      !check(await session.evaluate(waitForController), 'the service worker controls the page after the first visit')
    ) {
      return;
    }

    checkPrecacheList(await session.evaluate(readCache));
    await checkUpdates(session, site.url);

    site.close();
    await checkOffline(session, site.url);
  }
});
