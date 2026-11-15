// All pages at 360, 768, 1280, and 1920 px in four color modes, a keyboard focus walk in light and dark,
// and the Minesweeper header: no horizontal scrolling with the header toggle or the site menu, and the focus order
// below 768 px.
// Usage: node tests/browser-matrix-check.mjs [chrome.exe], or set CHROME_PATH.
import { check, hasSchemeBackground, runBrowserCheck, sleep } from './browser-check.mjs';

const pages = [
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
const widths = [360, 768, 1280, 1920];
const colorModes = [
  { name: 'system light', system: 'light', stored: null, expected: 'light' },
  { name: 'system dark', system: 'dark', stored: null, expected: 'dark' },
  { name: 'stored Hell, system dark', system: 'dark', stored: 'light', expected: 'light' },
  { name: 'stored Dunkel, system light', system: 'light', stored: 'dark', expected: 'dark' }
];
// The focus walk stops when focus returns to an element it has already seen.
const maxFocusStops = 100;

async function setViewport(session, width) {
  await session.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
}

async function setSystemScheme(session, scheme) {
  await session.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: scheme },
      { name: 'prefers-reduced-motion', value: 'reduce' }
    ]
  });
}

async function openPage(session, path) {
  await session.navigate(path);
  await session.evaluate('window.lycheelabComponentsLoaded');
}

async function resetStorage(session, entries = {}) {
  await openPage(session, '/index.html');
  await session.evaluate(`localStorage.clear();
    Object.entries(${JSON.stringify(entries)}).forEach(([key, value]) => localStorage.setItem(key, value))`);
}

const readPageState = (expectedScheme) => `({
  background: getComputedStyle(document.body).backgroundColor,
  hasExpectedBackground: ${hasSchemeBackground(expectedScheme)},
  select: document.querySelector('[data-theme-select]')?.value,
  overflow: document.documentElement.scrollWidth - innerWidth,
  hasHeader: !!document.querySelector('#site-header'),
  hasHeading: !!document.querySelector('main h1')
})`;

async function checkPageMatrix(session) {
  for (const mode of colorModes) {
    await setSystemScheme(session, mode.system);
    await resetStorage(session, mode.stored ? { 'lycheelab-theme': mode.stored } : {});
    const issues = [];

    for (const width of widths) {
      await setViewport(session, width);
      for (const path of pages) {
        await openPage(session, path);
        const state = await session.evaluate(readPageState(mode.expected));
        const pageIssues = [];
        if (!state.hasExpectedBackground) pageIssues.push(`background ${state.background}`);
        if (state.select !== (mode.stored ?? 'system')) pageIssues.push(`select ${state.select}`);
        if (state.overflow > 0) pageIssues.push(`horizontal overflow ${state.overflow}px`);
        if (!state.hasHeader || !state.hasHeading) pageIssues.push('site header or h1 missing');
        if (pageIssues.length) issues.push(`${width}px ${path}: ${pageIssues.join(', ')}`);
      }
    }

    check(
      issues.length === 0,
      `${mode.name}: ${pages.length} pages at ${widths.join(', ')} px in the expected scheme without horizontal scrolling`
    );
    issues.forEach((issue) => console.log(`     ${issue}`));
  }
}

// Runs in the page after each Tab: describes the focused element and its outline.
const readFocus = `(() => {
  const element = document.activeElement;
  if (!element || element === document.body) return null;
  const parse = (value) => {
    const parts = value.match(/[\\d.]+/g);
    return parts ? [+parts[0], +parts[1], +parts[2], parts[3] === undefined ? 1 : +parts[3]] : null;
  };
  const luminance = ([r, g, b]) => {
    const channel = (value) => {
      const share = value / 255;
      return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const contrastRatio = (first, second) => {
    const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  };
  // The outline is drawn around the element, so it is compared with the background behind it.
  const background = (start) => {
    for (let current = start; current; current = current.parentElement) {
      const color = parse(getComputedStyle(current).backgroundColor);
      if (color && color[3] >= 0.99) return color;
    }
    return [255, 255, 255, 1];
  };
  const style = getComputedStyle(element);
  const color = parse(style.outlineColor);
  const label = (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 24);
  return {
    key: element.id || element.outerHTML.slice(0, 80),
    name: element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') + ' "' + label + '"',
    hasOutline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
    contrast: color ? +contrastRatio(color, background(element.parentElement)).toFixed(2) : 0
  };
})()`;

async function pressTab(session) {
  for (const type of ['rawKeyDown', 'keyUp']) {
    await session.send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  }
  await sleep(20);
}

async function checkFocusWalk(session) {
  await setViewport(session, 1280);

  for (const scheme of ['light', 'dark']) {
    await setSystemScheme(session, scheme);
    await resetStorage(session);
    let stopCount = 0;
    const weakStops = [];

    for (const path of pages) {
      await openPage(session, path);
      await session.evaluate('document.activeElement.blur(); window.scrollTo(0, 0)');
      const seen = new Set();

      for (let step = 0; step <= maxFocusStops; step++) {
        await pressTab(session);
        const focus = await session.evaluate(readFocus);
        if (!focus || seen.has(focus.key)) break;
        if (step === maxFocusStops) {
          check(false, `${scheme} ${path}: focus walk ends within ${maxFocusStops} stops`);
          break;
        }
        seen.add(focus.key);
        stopCount++;
        if (!focus.hasOutline || focus.contrast < 3) {
          weakStops.push(`${path}: ${focus.name} outline=${focus.hasOutline} contrast=${focus.contrast}`);
        }
      }
    }

    check(
      weakStops.length === 0,
      `${scheme}: all ${stopCount} focus stops on ${pages.length} pages show an outline of at least 2 px with 3:1`
    );
    weakStops.forEach((stop) => console.log(`     ${stop}`));
  }
}

const minesweeperBoards = [
  { name: 'Beginner', rows: 9, columns: 9, mines: 10 },
  { name: 'Expert', rows: 16, columns: 30, mines: 99 },
  { name: 'Maximum', rows: 100, columns: 100, mines: 2000 }
];
const readOverflow = 'document.documentElement.scrollWidth - innerWidth';
const readFocusName = `(() => {
  const element = document.activeElement;
  return element.id || element.getAttribute('aria-label') || element.tagName.toLowerCase();
})()`;
const isFooterShown = `getComputedStyle(document.querySelector('#site-footer')).display !== 'none'`;

// Below 768 px the game is immersive: the site menu button comes first and opening the menu shows the footer.
// From 768 px the "Vollbild" toggle hides and shows the site header and footer.
async function checkMinesweeperHeader(session) {
  await setSystemScheme(session, 'light');

  for (const board of minesweeperBoards) {
    const { name, ...size } = board;
    const difficulty = JSON.stringify({ ...size, extraLives: true, checks: true, lessGuess: true });
    const issues = [];

    for (const width of [360, 767, 768, 1280, 1920]) {
      await setViewport(session, width);
      await resetStorage(session, { 'lycheelab-minesweeper-difficulty': difficulty });
      await openPage(session, '/pages/minesweeper/game.html');
      const before = await session.evaluate(readOverflow);
      const toggle = width < 768 ? '[data-menu-toggle]' : '#game-chrome-toggle';
      await session.evaluate(`document.querySelector('${toggle}').click()`);
      await sleep(300);
      const after = await session.evaluate(readOverflow);
      if (before > 0 || after > 0) issues.push(`${width}px: overflow ${before}px, after ${toggle} ${after}px`);
      if (width < 768 && !(await session.evaluate(isFooterShown))) issues.push(`${width}px: open menu without footer`);
    }

    check(
      issues.length === 0,
      `Minesweeper ${name}: no horizontal scrolling before and after the header toggle or the site menu`
    );
    issues.forEach((issue) => console.log(`     ${issue}`));
  }

  for (const width of [360, 767]) {
    await setViewport(session, width);
    await openPage(session, '/pages/minesweeper/game.html');
    await session.evaluate(`document.querySelector('.skip-link').focus()`);
    const order = [];
    for (let step = 0; step < 3; step++) {
      await pressTab(session);
      order.push(await session.evaluate(readFocusName));
    }
    check(
      order.join() === 'Menü öffnen,game-status,new-game',
      `Minesweeper ${width}px: after the skip link, Tab reaches the menu button, the status, and the restart button`,
      order.join(' > ')
    );
  }
}

await runBrowserCheck({
  name: 'browser-matrix-check',
  serverPort: 8768,
  debugPort: 9336,
  run: async (session) => {
    await checkPageMatrix(session);
    await checkFocusWalk(session);
    await checkMinesweeperHeader(session);
  }
});
