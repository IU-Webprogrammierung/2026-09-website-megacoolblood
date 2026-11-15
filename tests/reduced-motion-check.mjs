// Checks that transitions and animations follow prefers-reduced-motion.
// Usage: node tests/reduced-motion-check.mjs [chrome.exe], or set CHROME_PATH.
import { check, runBrowserCheck } from './browser-check.mjs';

// Reads the computed motion styles; the win dialog is opened briefly because its animation only applies while open.
const readMotionStyles = `(async () => {
  await window.lycheelabComponentsLoaded;
  const toDurations = (value) => value.split(',').map((duration) => parseFloat(duration));
  const button = getComputedStyle(document.getElementById('new-game'));
  const menuIconLine = getComputedStyle(document.querySelector('.menu-toggle .menu-icon span'));
  const dialog = document.querySelector('.win-dialog');
  dialog.show();
  const dialogAnimation = getComputedStyle(dialog).animationName;
  dialog.close();

  return {
    matchesReduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
    buttonDurations: toDurations(button.transitionDuration),
    menuIconDurations: toDurations(menuIconLine.transitionDuration),
    dialogAnimation
  };
})()`;

async function readStylesWith(session, preference) {
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: preference }]
  });
  await session.navigate();
  return session.evaluate(readMotionStyles);
}

async function checkReducedMotion(session) {
  const styles = await readStylesWith(session, 'reduce');

  check(styles.matchesReduce, 'reduce: the media query matches');
  check(
    styles.buttonDurations.every((duration) => duration === 0),
    'reduce: buttons have no transition'
  );
  check(styles.dialogAnimation === 'none', 'reduce: the win dialog has no animation');
  check(
    styles.menuIconDurations.every((duration) => duration === 0),
    'reduce: the menu icon has no transition'
  );
}

async function checkNoPreference(session) {
  const styles = await readStylesWith(session, 'no-preference');

  check(!styles.matchesReduce, 'no-preference: the reduce media query does not match');
  check(
    styles.buttonDurations.some((duration) => duration > 0),
    'no-preference: buttons have a transition'
  );
  check(styles.dialogAnimation === 'win-dialog-pop', 'no-preference: the win dialog has its pop-in animation');
  check(
    styles.menuIconDurations.some((duration) => duration > 0),
    'no-preference: the menu icon has a transition'
  );
}

await runBrowserCheck({
  name: 'motion-check',
  pagePath: '/pages/minesweeper/game.html',
  serverPort: 8766,
  debugPort: 9334,
  run: async (session) => {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 400,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await checkReducedMotion(session);
    await checkNoPreference(session);
  }
});
