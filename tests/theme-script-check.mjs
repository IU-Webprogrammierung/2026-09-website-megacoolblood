// Early color scheme script (js/theme.js): applied before the first stylesheet, stored value against the system
// setting, the window.lycheelabTheme API, and blocked or full storage.
// Usage: node tests/theme-script-check.mjs [chrome.exe], or set CHROME_PATH.
import { check, hasSchemeBackground, runBrowserCheck } from './browser-check.mjs';

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

// Records whether data-theme was already set when the first stylesheet entered the DOM.
const recordThemeAtFirstStylesheet = `window.themeAtFirstStylesheet = 'not seen';
new MutationObserver((records, observer) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeName === 'LINK' && node.rel === 'stylesheet') {
        window.themeAtFirstStylesheet = document.documentElement.dataset.theme ?? 'none';
        observer.disconnect();
        return;
      }
    }
  }
}).observe(document, { childList: true, subtree: true });`;
// Browsers that block site data throw a SecurityError on every access to localStorage.
const blockStorage = `Object.defineProperty(window, 'localStorage', {
  get() { throw new DOMException('blocked', 'SecurityError'); }
});`;
const fillStorage = `Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };`;

async function setSystemScheme(session, scheme) {
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
}

async function openPage(session, path) {
  await session.navigate(path);
  await session.evaluate('window.lycheelabComponentsLoaded');
}

async function storeTheme(session, value) {
  await openPage(session, '/index.html');
  await session.evaluate(
    value === null
      ? `localStorage.removeItem('lycheelab-theme')`
      : `localStorage.setItem('lycheelab-theme', ${JSON.stringify(value)})`
  );
}

const hasSchemeThemeColor = (scheme) => `(() => {
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  const active = metas.find((meta) => !meta.media || matchMedia(meta.media).matches);
  return !!active && active.dataset.scheme === '${scheme}';
})()`;

const readState = (expectedScheme) => `({
  theme: document.documentElement.dataset.theme ?? 'none',
  themeAtFirstStylesheet: window.themeAtFirstStylesheet,
  hasExpectedBackground: ${hasSchemeBackground(expectedScheme)},
  hasExpectedThemeColor: ${hasSchemeThemeColor(expectedScheme)},
  preference: window.lycheelabTheme?.getPreference(),
  hasHeader: !!document.querySelector('#site-header')
})`;

async function checkStoredDarkOnAllPages(session) {
  await setSystemScheme(session, 'light');
  await storeTheme(session, 'dark');

  for (const path of pages) {
    await openPage(session, path);
    const state = await session.evaluate(readState('dark'));
    check(
      state.theme === 'dark' && state.themeAtFirstStylesheet === 'dark' && state.hasExpectedBackground,
      `stored Dunkel, system light, ${path}: dark before the first stylesheet`,
      `theme=${state.theme}, at first stylesheet=${state.themeAtFirstStylesheet}`
    );
  }
}

async function checkStoredValues(session) {
  for (const stored of [null, 'system', 'light', 'dark', 'oled', 'quatsch']) {
    for (const system of ['light', 'dark']) {
      const isExplicit = ['light', 'dark', 'oled'].includes(stored);
      await setSystemScheme(session, system);
      await storeTheme(session, stored);
      await openPage(session, '/index.html');
      const state = await session.evaluate(readState(isExplicit ? stored : system));
      const expectedPreference = ['system', 'light', 'dark', 'oled'].includes(stored) ? stored : 'system';
      check(
        state.theme === (isExplicit ? stored : 'none') &&
          state.preference === expectedPreference &&
          state.hasExpectedBackground &&
          state.hasExpectedThemeColor,
        `stored ${stored ?? 'nothing'}, system ${system}: ${isExplicit ? stored : 'system'} scheme and browser bar color apply`,
        `theme=${state.theme}, preference=${state.preference}, theme-color=${state.hasExpectedThemeColor}`
      );
    }
  }
}

async function checkApi(session) {
  await setSystemScheme(session, 'light');
  await storeTheme(session, null);
  await openPage(session, '/index.html');

  const savedDark = await session.evaluate(`window.lycheelabTheme.setPreference('dark')`);
  let state = await session.evaluate(readState('dark'));
  check(
    savedDark === true && state.theme === 'dark' && state.hasExpectedBackground && state.hasExpectedThemeColor,
    'setPreference("dark") applies at once, also to the browser bar color, and saves'
  );

  await openPage(session, '/pages/minesweeper/game.html');
  state = await session.evaluate(readState('dark'));
  check(state.theme === 'dark' && state.preference === 'dark', 'the choice persists on another page');

  const savedOled = await session.evaluate(`window.lycheelabTheme.setPreference('oled')`);
  state = await session.evaluate(readState('oled'));
  check(
    savedOled === true && state.theme === 'oled' && state.hasExpectedBackground && state.hasExpectedThemeColor,
    'setPreference("oled") applies at once with a black background and browser bar color'
  );

  const savedSystem = await session.evaluate(`window.lycheelabTheme.setPreference('system')`);
  state = await session.evaluate(readState('light'));
  check(
    savedSystem === true && state.theme === 'none' && state.hasExpectedBackground && state.hasExpectedThemeColor,
    'setPreference("system") removes data-theme and the browser bar follows the system again'
  );

  const errorName = await session.evaluate(`(() => {
    try {
      window.lycheelabTheme.setPreference('blue');
      return 'no error';
    } catch (error) {
      return error.name;
    }
  })()`);
  check(errorName === 'RangeError', 'an unknown value throws a RangeError', errorName);

  const isFrozen = await session.evaluate(
    'Object.isFrozen(window.lycheelabTheme) && Object.isFrozen(window.lycheelabTheme.preferences)'
  );
  check(isFrozen === true, 'the API and its list of preferences are frozen');
}

async function withScript(session, source, callback) {
  const { result } = await session.send('Page.addScriptToEvaluateOnNewDocument', { source });
  try {
    await callback();
  } finally {
    await session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: result.identifier });
  }
}

async function checkBlockedStorage(session) {
  await withScript(session, blockStorage, async () => {
    for (const system of ['light', 'dark']) {
      await setSystemScheme(session, system);
      await openPage(session, '/pages/minesweeper/game.html');
      const state = await session.evaluate(readState(system));
      check(
        state.theme === 'none' && state.preference === 'system' && state.hasExpectedBackground && state.hasHeader,
        `blocked storage, system ${system}: the system scheme applies and the page loads`
      );
    }

    await setSystemScheme(session, 'light');
    const saved = await session.evaluate(`window.lycheelabTheme.setPreference('dark')`);
    const state = await session.evaluate(readState('dark'));
    check(
      saved === false && state.theme === 'dark' && state.hasExpectedBackground,
      'blocked storage: setPreference returns false but applies to the page',
      `returned ${saved}`
    );
  });
}

async function checkFullStorage(session) {
  await setSystemScheme(session, 'light');
  await storeTheme(session, null);

  await withScript(session, fillStorage, async () => {
    await openPage(session, '/index.html');
    const saved = await session.evaluate(`window.lycheelabTheme.setPreference('dark')`);
    let state = await session.evaluate(readState('dark'));
    check(
      saved === false && state.theme === 'dark',
      'full storage: setPreference returns false but applies to the page',
      `returned ${saved}`
    );

    await openPage(session, '/index.html');
    state = await session.evaluate(readState('light'));
    check(
      state.theme === 'none',
      'full storage: after a reload the system scheme applies again',
      `theme=${state.theme}`
    );
  });
}

await runBrowserCheck({
  name: 'theme-script-check',
  serverPort: 8769,
  debugPort: 9337,
  run: async (session) => {
    await session.send('Page.addScriptToEvaluateOnNewDocument', { source: recordThemeAtFirstStylesheet });
    await checkStoredDarkOnAllPages(session);
    await checkStoredValues(session);
    await checkApi(session);
    await checkBlockedStorage(session);
    await checkFullStorage(session);
  }
});
