// Color scheme sync between two tabs of the same profile through the storage event.
// Usage: node tests/theme-sync-check.mjs [chrome.exe], or set CHROME_PATH.
import { check, hasSchemeBackground, runBrowserCheck, sleep } from './browser-check.mjs';

// Collects the change events of each tab from the start of every page.
const recordThemeEvents = `window.themeEvents = [];
document.addEventListener('lycheelab-themechange', (event) => window.themeEvents.push(event.detail.preference));`;
// Time for the storage event to reach the other tab.
const syncDelay = 300;

async function prepareTab(tab, path) {
  await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: recordThemeEvents });
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await tab.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  // Without focus emulation, the tab in the background would run its timers late.
  await tab.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await openPage(tab, path);
}

async function openPage(tab, path) {
  await tab.navigate(path);
  await tab.evaluate('window.lycheelabComponentsLoaded');
}

const readState = (scheme) => `({
  preference: lycheelabTheme.getPreference(),
  theme: document.documentElement.dataset.theme ?? 'none',
  select: document.querySelector('[data-theme-select]')?.value,
  hasSchemeBackground: ${hasSchemeBackground(scheme)},
  events: window.themeEvents.join(),
  focus: document.activeElement?.id
})`;

async function act(tab, expression) {
  await tab.evaluate(expression);
  await sleep(syncDelay);
}

const resetEvents = (...tabs) => Promise.all(tabs.map((tab) => tab.evaluate('window.themeEvents.length = 0')));
const setPreference = (value) => `lycheelabTheme.setPreference('${value}')`;

async function checkChangeInA(a, b) {
  await resetEvents(a, b);
  await act(a, setPreference('dark'));
  let stateA = await a.evaluate(readState('dark'));
  let stateB = await b.evaluate(readState('dark'));
  check(
    stateB.preference === 'dark' && stateB.theme === 'dark' && stateB.select === 'dark' && stateB.hasSchemeBackground,
    'Dunkel in tab A: tab B turns dark without a reload and its select shows Dunkel'
  );
  check(
    stateA.events === 'dark' && stateB.events === 'dark',
    'one change event in each tab',
    `A [${stateA.events}] B [${stateB.events}]`
  );

  await resetEvents(a, b);
  await act(a, setPreference('dark'));
  stateA = await a.evaluate(readState('dark'));
  stateB = await b.evaluate(readState('dark'));
  check(
    stateA.events === '' && stateB.events === '',
    'the same value again: no event in either tab',
    `A [${stateA.events}] B [${stateB.events}]`
  );

  await act(a, setPreference('system'));
  stateB = await b.evaluate(readState('light'));
  check(
    stateB.preference === 'system' &&
      stateB.theme === 'none' &&
      stateB.select === 'system' &&
      stateB.hasSchemeBackground,
    'System in tab A: tab B follows the system setting'
  );
}

async function checkSelectInB(a, b) {
  await resetEvents(a, b);
  await act(
    b,
    `(() => {
      const select = document.querySelector('[data-theme-select]');
      select.value = 'light';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`
  );
  const stateA = await a.evaluate(readState('light'));
  const stateB = await b.evaluate(readState('light'));
  check(
    stateA.preference === 'light' && stateA.theme === 'light' && stateA.select === 'light',
    'Hell in the select of tab B: tab A turns light and its select shows Hell'
  );
  check(
    stateA.events === 'light' && stateB.events === 'light',
    'one change event in each tab',
    `A [${stateA.events}] B [${stateB.events}]`
  );
}

async function checkFallbackToSystem(a, b) {
  for (const [label, action] of [
    ['an invalid value', `localStorage.setItem('lycheelab-theme', 'quatsch')`],
    ['removing the key', `localStorage.removeItem('lycheelab-theme')`],
    ['localStorage.clear()', 'localStorage.clear()']
  ]) {
    await act(a, setPreference('dark'));
    await act(a, action);
    const stateB = await b.evaluate(readState('light'));
    check(
      stateB.preference === 'system' && stateB.theme === 'none' && stateB.select === 'system',
      `${label} in tab A: tab B falls back to System`
    );
  }
}

async function checkUnrelatedChanges(a, b) {
  await act(a, setPreference('dark'));
  await resetEvents(a, b);
  await act(a, `localStorage.setItem('lycheelab-minesweeper-mode', 'flag')`);
  let stateB = await b.evaluate(readState('dark'));
  check(stateB.preference === 'dark' && stateB.events === '', 'another key in tab A: tab B stays unchanged');

  await b.evaluate(`window.dispatchEvent(new StorageEvent('storage', {
    key: 'lycheelab-theme',
    newValue: 'light',
    storageArea: sessionStorage
  }))`);
  stateB = await b.evaluate(readState('dark'));
  check(
    stateB.preference === 'dark' && stateB.events === '',
    'the same key from sessionStorage: tab B stays unchanged'
  );
}

async function checkMinesweeperTab(a, b) {
  await openPage(b, '/pages/minesweeper/game.html');
  await b.evaluate(`document.querySelector('[data-theme-select]').focus()`);
  await act(a, setPreference('light'));
  let stateB = await b.evaluate(readState('light'));
  check(
    stateB.theme === 'light' && stateB.select === 'light' && stateB.focus === 'theme-select',
    'a focused select in tab B is updated and keeps the focus',
    `focus=${stateB.focus}`
  );

  await b.evaluate(`document.querySelector('#game-chrome-toggle').click()`);
  await act(a, setPreference('dark'));
  stateB = await b.evaluate(readState('dark'));
  const isImmersive = await b.evaluate(`document.body.classList.contains('is-immersive')`);
  check(
    isImmersive && stateB.theme === 'dark' && stateB.hasSchemeBackground,
    'tab B in immersive mode still switches the scheme'
  );

  await openPage(b, '/pages/2048/game.html');
  stateB = await b.evaluate(readState('dark'));
  check(
    stateB.preference === 'dark' && stateB.select === 'dark',
    'after navigating, tab B starts with the stored choice'
  );
}

await runBrowserCheck({
  name: 'theme-sync-check',
  serverPort: 8770,
  debugPort: 9338,
  run: async (a, { openTab }) => {
    await prepareTab(a, '/index.html');
    await a.evaluate('localStorage.clear()');
    const b = await openTab();
    await prepareTab(b, '/pages/minesweeper/settings.html');

    await checkChangeInA(a, b);
    await checkSelectInB(a, b);
    await checkFallbackToSystem(a, b);
    await checkUnrelatedChanges(a, b);
    await checkMinesweeperTab(a, b);
  }
});
