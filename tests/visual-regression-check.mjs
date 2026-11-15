// Compares the working copy with a committed version of the site: computed colors and pixels of 14 views at 360 and
// 1920 px, with the light and the dark system color scheme. Use it to show that a refactoring changes nothing visible.
// Usage: [REFERENCE=<git ref>] node tests/visual-regression-check.mjs [chrome.exe], or set CHROME_PATH.
// REFERENCE defaults to HEAD, so the check compares uncommitted changes with the last commit.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, runBrowserCheck, siteRoot, sleep } from './browser-check.mjs';

const reference = process.env.REFERENCE || 'HEAD';
const serverPort = 8772;
const referencePort = 8773;
const sizes = [
  { width: 360, height: 800 },
  { width: 1920, height: 1080 }
];
// Fixed random numbers make the boards the same on both sides.
const seedRandom = 'let seed = 42; Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;';

const showMinesweeperStates = `(() => {
  const cells = [...document.querySelectorAll('#game-board .game-cell')];
  const set = (index, classes, number) => {
    cells[index].classList.add(...classes);
    if (number) cells[index].dataset.adjacentMines = number;
  };
  for (let number = 1; number <= 8; number++) set(number - 1, ['is-revealed'], String(number));
  set(9, ['is-flagged']);
  set(10, ['is-marked']);
  set(11, ['is-mine']);
  set(12, ['is-revealed', 'is-mine']);
  set(13, ['is-flagged', 'is-correct-flag']);
  set(14, ['is-flagged', 'is-wrong-flag']);
  set(15, ['is-revealed', 'is-wrong-flag'], '2');
  set(16, ['is-revealed']);
})()`;

const scenarios = [
  { name: 'start page', path: '/index.html' },
  {
    name: 'start page, menu open',
    path: '/index.html',
    narrowOnly: true,
    setup: `document.querySelector('[data-menu-toggle]').click()`
  },
  { name: 'Impressum', path: '/pages/impressum.html' },
  { name: 'Datenschutz', path: '/pages/datenschutz.html' },
  { name: 'Minesweeper cell states', path: '/pages/minesweeper/game.html', setup: showMinesweeperStates },
  {
    name: 'Minesweeper restart dialog',
    path: '/pages/minesweeper/game.html',
    setup: `${showMinesweeperStates};
      document.querySelector('#series-reset-message').textContent = 'Test';
      document.querySelector('#series-reset-dialog').showModal();
      document.activeElement.blur()`
  },
  {
    name: 'Minesweeper win dialog',
    path: '/pages/minesweeper/game.html',
    setup: `document.querySelector('#win-dialog-message').textContent = 'Test';
      document.querySelector('#win-dialog').showModal();
      document.activeElement.blur()`
  },
  { name: 'Minesweeper instructions', path: '/pages/minesweeper/instructions.html' },
  {
    name: 'Minesweeper settings',
    path: '/pages/minesweeper/settings.html',
    setup: `const select = document.querySelector('#difficulty');
      select.value = 'beginner';
      select.dispatchEvent(new Event('change', { bubbles: true }))`
  },
  {
    name: 'Minesweeper settings, error',
    path: '/pages/minesweeper/settings.html',
    setup: `const select = document.querySelector('#difficulty');
      select.value = 'custom';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const rows = document.querySelector('#rows');
      rows.value = '2';
      rows.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#settings-form').requestSubmit();
      document.activeElement.blur()`
  },
  { name: 'Minesweeper statistics', path: '/pages/minesweeper/statistics.html' },
  {
    name: '2048 tiles',
    path: '/pages/2048/game.html',
    setup: `const values = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 2, 4, 8];
      document.querySelectorAll('.board-2048 .tile').forEach((tile, index) => {
        tile.className = 'tile tile-' + values[index];
        tile.textContent = values[index];
      })`
  },
  { name: '2048 instructions', path: '/pages/2048/instructions.html' },
  { name: '2048 statistics', path: '/pages/2048/statistics.html' }
];

// Runs in the page: the color-related computed style of every element and pseudo-element, in document order.
const collectColors = `(() => {
  const properties = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow', 'accent-color', 'text-decoration-color',
    'caret-color', 'fill', 'stroke', 'opacity', 'mask-image'];
  const read = (element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    if (pseudo && pseudo !== '::backdrop' && style.content === 'none') return null;
    // URLs contain the server port, which differs between both sides.
    return properties.map((property) => style.getPropertyValue(property)).join('|').replace(/127\\.0\\.0\\.1:\\d+/g, 'HOST');
  };
  const values = [];
  document.querySelectorAll('*:not(script)').forEach((element, index) => {
    const key = index + ':' + element.tagName.toLowerCase() + (element.id ? '#' + element.id : '');
    values.push(key + ' = ' + read(element));
    for (const pseudo of ['::before', '::after']) {
      const value = read(element, pseudo);
      if (value) values.push(key + pseudo + ' = ' + value);
    }
    if (element.tagName === 'DIALOG' && element.open) values.push(key + '::backdrop = ' + read(element, '::backdrop'));
  });
  return values;
})()`;

function exportReference(target) {
  const archive = join(target, 'reference.tar');
  execFileSync('git', ['archive', '--format=tar', '-o', archive, reference], { cwd: siteRoot });
  execFileSync('tar', ['-xf', archive, '-C', target]);
  rmSync(archive);
}

async function capture(session, baseUrl, scenario) {
  // Each side starts with empty storage, so saved games and statistics cannot differ.
  await session.send('Storage.clearDataForOrigin', { origin: baseUrl, storageTypes: 'local_storage' });
  await session.navigate(baseUrl + scenario.path);
  await session.evaluate('window.lycheelabComponentsLoaded.then(() => document.fonts.ready)');
  if (scenario.setup) {
    await session.evaluate(scenario.setup);
  }
  await sleep(250);
  const colors = await session.evaluate(collectColors);
  const { result } = await session.send('Page.captureScreenshot', { format: 'png' });
  return { colors, image: result.data };
}

function saveDifference(differenceDir, label, before, after) {
  mkdirSync(differenceDir, { recursive: true });
  const fileName = label.replace(/[^a-z0-9]+/gi, '-');
  writeFileSync(join(differenceDir, `${fileName}-reference.png`), Buffer.from(before.image, 'base64'));
  writeFileSync(join(differenceDir, `${fileName}-current.png`), Buffer.from(after.image, 'base64'));
}

async function compare(session, referenceUrl, currentUrl, differenceDir) {
  let differenceCount = 0;

  for (const scheme of ['light', 'dark']) {
    await session.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: scheme },
        { name: 'prefers-reduced-motion', value: 'reduce' }
      ]
    });

    for (const size of sizes) {
      await session.send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: false });
      // The first render after a change of size can scale images slightly differently, so it is not compared.
      await capture(session, referenceUrl, scenarios[0]);
      await capture(session, currentUrl, scenarios[0]);

      for (const scenario of scenarios) {
        if (scenario.narrowOnly && size.width > 767) continue;
        const label = `${scheme} ${size.width}px ${scenario.name}`;
        const before = await capture(session, referenceUrl, scenario);
        const after = await capture(session, currentUrl, scenario);
        const changedColors = before.colors
          .map((value, index) => [value, after.colors[index]])
          .filter(([old, current]) => old !== current);
        const sameElements = before.colors.length === after.colors.length;
        const samePixels = before.image === after.image;

        check(
          sameElements && changedColors.length === 0 && samePixels,
          `${label}: same colors and pixels as ${reference}`,
          `${sameElements ? '' : `elements ${before.colors.length} -> ${after.colors.length}, `}` +
            `${changedColors.length} color changes, pixels ${samePixels ? 'identical' : 'different'}`
        );
        changedColors.slice(0, 3).forEach(([old, current]) => console.log(`     ${old}\n  -> ${current}`));
        if (!samePixels) {
          saveDifference(differenceDir, label, before, after);
          differenceCount++;
        }
      }
    }
  }

  if (differenceCount > 0) {
    console.log(`Screenshots of ${differenceCount} different view(s): ${differenceDir}`);
  }
}

await runBrowserCheck({
  name: 'visual-regression-check',
  serverPort,
  debugPort: 9340,
  run: async (session, { serveSite }) => {
    const referenceRoot = mkdtempSync(join(tmpdir(), 'lycheelab-reference-'));
    try {
      exportReference(referenceRoot);
      const referenceUrl = serveSite(referenceRoot, referencePort);
      const differenceDir = join(tmpdir(), `lycheelab-visual-differences-${Date.now()}`);
      await session.send('Page.addScriptToEvaluateOnNewDocument', { source: seedRandom });
      await compare(session, referenceUrl, `http://127.0.0.1:${serverPort}`, differenceDir);
    } finally {
      rmSync(referenceRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
});
