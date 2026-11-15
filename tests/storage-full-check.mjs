// Checks the Minesweeper save when localStorage is full.
// Usage: node tests/storage-full-check.mjs [chrome.exe], or set CHROME_PATH.
import { check, runBrowserCheck, sleep } from './browser-check.mjs';

const saveErrorMessage = 'Spielstand konnte nicht gespeichert werden.';

// Halving the value size fills the storage until not even one character fits.
const fillStorage = `(() => {
  let index = 0;
  for (let size = 1000000; size >= 1; size = Math.floor(size / 2)) {
    try {
      while (true) localStorage.setItem('fill' + index++, 'x'.repeat(size));
    } catch {}
  }
  try {
    localStorage.setItem('probe', 'x');
    return false;
  } catch {
    return true;
  }
})()`;
const readSave = `localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('lycheelab-minesweeper-game:')))`;
const readStatus = `document.getElementById('game-status').textContent.trim()`;
const clickHiddenCell = `document.querySelector('.game-cell:not(.is-revealed)').click()`;
const countRevealedCells = `document.querySelectorAll('.game-cell.is-revealed').length`;

async function checkNewSave(session) {
  await session.navigate();
  await session.evaluate('localStorage.clear()');
  await session.navigate();

  check(await session.evaluate(fillStorage), 'new save: storage is full');
  await session.evaluate(clickHiddenCell);
  await sleep(300);
  check((await session.evaluate(readStatus)) === saveErrorMessage, 'new save: status reports the failed save');
  check((await session.evaluate(readSave)) === null, 'new save: no saved game is stored');

  await session.navigate();
  check((await session.evaluate(countRevealedCells)) === 0, 'new save: a reload starts a new game');
}

async function checkExistingSave(session) {
  await session.navigate();
  await session.evaluate('localStorage.clear()');
  await session.navigate();
  await session.evaluate(clickHiddenCell);
  await sleep(300);

  const saveBeforeFill = await session.evaluate(readSave);
  check(saveBeforeFill !== null, 'existing save: the first move is saved');
  check(await session.evaluate(fillStorage), 'existing save: storage is full');
  await session.evaluate(clickHiddenCell);
  await sleep(300);
  check((await session.evaluate(readStatus)) !== saveErrorMessage, 'existing save: status reports no failed save');

  const saveAfterMove = await session.evaluate(readSave);
  check(saveAfterMove !== saveBeforeFill, 'existing save: the move updates the saved game');

  const revealedAfterMove = await session.evaluate(countRevealedCells);
  await session.navigate();
  check(
    (await session.evaluate(countRevealedCells)) === revealedAfterMove,
    'existing save: a reload restores the board after the move'
  );
}

await runBrowserCheck({
  name: 'storage-check',
  pagePath: '/pages/minesweeper/game.html',
  serverPort: 8765,
  debugPort: 9333,
  run: async (session) => {
    await checkNewSave(session);
    await checkExistingSave(session);
  }
});
