// Game boards: Minesweeper cell states can be told apart, focus ring on cells, edge shadows, color scheme switch on a
// 100 x 100 board; 2048 tiles move with the arrow keys.
// Usage: node tests/game-board-check.mjs [chrome.exe], or set CHROME_PATH.
import { check, runBrowserCheck, sleep } from './browser-check.mjs';

// Fixed random numbers make the boards the same on every run.
const seedRandom = 'let seed = 42; Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;';
const boards = {
  beginner: { rows: 9, columns: 9, mines: 10, extraLives: true, checks: true, lessGuess: true },
  maximum: { rows: 100, columns: 100, mines: 2000, extraLives: true, checks: true, lessGuess: true }
};

// Puts the first cells of the board in every state; numbers get digits like the game renders them.
const showCellStates = `(() => {
  const cells = [...document.querySelectorAll('#game-board .game-cell')];
  const set = (index, classes, number) => {
    cells[index].classList.add(...classes);
    if (number) {
      cells[index].dataset.adjacentMines = number;
      cells[index].textContent = number;
    }
  };
  for (let number = 1; number <= 8; number++) set(number - 1, ['is-revealed'], String(number));
  set(9, ['is-revealed']);
  set(10, ['is-flagged']);
  set(11, ['is-marked']);
  set(12, ['is-mine']);
  set(13, ['is-revealed', 'is-mine']);
  set(14, ['is-flagged', 'is-correct-flag']);
  set(15, ['is-flagged', 'is-wrong-flag']);
})()`;
const readBoardColors = `(() => {
  const cells = [...document.querySelectorAll('#game-board .game-cell')];
  const background = (index) => getComputedStyle(cells[index]).backgroundColor;
  return {
    states: {
      hidden: background(20),
      revealed: background(9),
      questionMark: background(11),
      mine: background(12),
      triggeredMine: background(13),
      correctFlag: background(14),
      wrongFlag: background(15)
    },
    frame: getComputedStyle(document.querySelector('#game-board')).borderTopColor,
    surface: getComputedStyle(document.querySelector('.game-board-viewport')).backgroundColor
  };
})()`;
const readFocusOutline = (index) => `(() => {
  const cell = document.querySelectorAll('#game-board .game-cell')[${index}];
  cell.focus({ focusVisible: true });
  const style = getComputedStyle(cell);
  return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
})()`;
const readEdgeClasses = `[...document.querySelector('.game-board-viewport').classList]
  .filter((name) => name.startsWith('has-more')).join(' ')`;

function contrastRatio(first, second) {
  const luminance = (color) => {
    const [r, g, b] = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map((value) => {
        const share = +value / 255;
        return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

async function setView(session, scheme, width, height) {
  await session.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: scheme },
      { name: 'prefers-reduced-motion', value: 'reduce' }
    ]
  });
  await session.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
}

async function openMinesweeper(session, board) {
  await session.navigate('/index.html');
  await session.evaluate(`localStorage.clear();
    localStorage.setItem('lycheelab-minesweeper-difficulty', '${JSON.stringify(board)}')`);
  await session.navigate('/pages/minesweeper/game.html');
  await session.evaluate('window.lycheelabComponentsLoaded');
}

async function checkCellStates(session) {
  for (const scheme of ['light', 'dark']) {
    await setView(session, scheme, 1920, 1080);
    await openMinesweeper(session, boards.beginner);
    await session.evaluate(showCellStates);
    const colors = await session.evaluate(readBoardColors);

    const hiddenRatio = contrastRatio(colors.states.hidden, colors.states.revealed);
    check(hiddenRatio >= 3, `${scheme}: hidden and revealed cells differ by at least 3:1`, hiddenRatio.toFixed(2));

    const backgrounds = Object.values(colors.states);
    check(
      new Set(backgrounds).size === backgrounds.length,
      `${scheme}: the ${backgrounds.length} cell states have different backgrounds`,
      backgrounds.join(' ')
    );

    const frameRatio = contrastRatio(colors.frame, colors.surface);
    check(
      frameRatio >= 3,
      `${scheme}: the board frame stands out from the surface by at least 3:1`,
      frameRatio.toFixed(2)
    );

    for (const [name, index] of [
      ['hidden', 20],
      ['revealed', 9]
    ]) {
      const outline = await session.evaluate(readFocusOutline(index));
      check(
        outline.style !== 'none' && outline.width >= 2,
        `${scheme}: a focused ${name} cell shows an outline of at least 2 px`,
        `${outline.style} ${outline.width}px`
      );
    }
  }
}

async function checkLargeBoard(session) {
  await setView(session, 'dark', 1280, 900);
  await openMinesweeper(session, boards.beginner);
  check((await session.evaluate(readEdgeClasses)) === '', 'Beginner at 1280 px: no edge shadows, the board fits');

  await openMinesweeper(session, boards.maximum);
  const edges = await session.evaluate(readEdgeClasses);
  check(edges !== '', '100 x 100 at 1280 px: edge shadows show where the board continues', edges);

  // Two animation frames after each switch, so the time includes style and layout of all 10,000 cells.
  const switchTimes = await session.evaluate(`(async () => {
    const times = [];
    for (const preference of ['light', 'dark', 'light', 'dark']) {
      const start = performance.now();
      lycheelabTheme.setPreference(preference);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      times.push(Math.round(performance.now() - start));
    }
    return times;
  })()`);
  check(
    Math.max(...switchTimes) < 1000,
    '100 x 100: a color scheme switch takes less than 1 s',
    `${switchTimes.join(' / ')} ms`
  );
}

async function check2048ArrowKeys(session) {
  await setView(session, 'light', 1280, 900);
  await session.navigate('/pages/2048/game.html');
  await session.evaluate('window.lycheelabComponentsLoaded');
  await session.evaluate(`document.querySelector('.board-2048').focus()`);

  const readTiles = `[...document.querySelectorAll('.board-2048 .tile')].map((tile) => tile.textContent).join()`;
  const before = await session.evaluate(readTiles);
  for (const [key, keyCode] of [
    ['ArrowLeft', 37],
    ['ArrowUp', 38],
    ['ArrowRight', 39],
    ['ArrowDown', 40]
  ]) {
    for (const type of ['rawKeyDown', 'keyUp']) {
      await session.send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: keyCode });
    }
    await sleep(60);
  }
  check((await session.evaluate(readTiles)) !== before, '2048: the arrow keys move the tiles');
}

await runBrowserCheck({
  name: 'game-board-check',
  serverPort: 8771,
  debugPort: 9339,
  run: async (session) => {
    await session.send('Page.addScriptToEvaluateOnNewDocument', { source: seedRandom });
    // Without page focus, :focus-visible does not match for focus set by a script.
    await session.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await checkCellStates(session);
    await checkLargeBoard(session);
    await check2048ArrowKeys(session);
  }
});
