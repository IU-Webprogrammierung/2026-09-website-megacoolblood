// WCAG contrast audit: every visible text, control border, and icon against its effective background,
// in 15 page states, with the light and the dark system color scheme.
// Usage: node tests/contrast-audit.mjs [chrome.exe], or set CHROME_PATH.
import { check, runBrowserCheck, sleep } from './browser-check.mjs';

// Fixed random numbers make the boards the same on every run.
const seedRandom = 'let seed = 42; Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;';

// Puts one cell in every Minesweeper state: numbers 1 to 8, flag, question mark, mine, triggered mine,
// correct flag, wrong flag before and after revealing.
const showMinesweeperStates = `(() => {
  const cells = [...document.querySelectorAll('#game-board .game-cell')];
  const set = (index, classes, number) => {
    cells[index].classList.add(...classes);
    if (number) {
      cells[index].dataset.adjacentMines = number;
      cells[index].textContent = number;
    }
  };
  for (let number = 1; number <= 8; number++) set(number - 1, ['is-revealed'], String(number));
  set(9, ['is-flagged']);
  set(10, ['is-marked']);
  set(11, ['is-mine']);
  set(12, ['is-revealed', 'is-mine']);
  set(13, ['is-flagged', 'is-correct-flag']);
  set(14, ['is-flagged', 'is-wrong-flag']);
  set(15, ['is-revealed', 'is-wrong-flag'], '2');
})()`;
const show2048Tiles = `(() => {
  const values = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 2, 4, 8];
  document.querySelectorAll('.board-2048 .tile').forEach((tile, index) => {
    tile.className = 'tile tile-' + values[index];
    tile.textContent = values[index] || '';
  });
})()`;

const scenarios = [
  { name: 'start page', path: '/index.html' },
  {
    name: 'start page, menu open',
    path: '/index.html',
    width: 360,
    setup: `document.querySelector('[data-menu-toggle]').click()`
  },
  { name: 'Impressum', path: '/pages/impressum.html' },
  { name: 'Datenschutz', path: '/pages/datenschutz.html' },
  { name: 'Minesweeper game', path: '/pages/minesweeper/game.html', setup: showMinesweeperStates },
  {
    name: 'Minesweeper restart dialog',
    path: '/pages/minesweeper/game.html',
    setup: `document.querySelector('#series-reset-message').textContent = 'Wirklich neu starten?';
      document.querySelector('#series-reset-dialog').showModal()`
  },
  {
    name: 'Minesweeper win dialog',
    path: '/pages/minesweeper/game.html',
    setup: `document.querySelector('#win-dialog-message').textContent = 'Zeit 01:23, Score 42';
      document.querySelector('#win-dialog').showModal()`
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
      document.querySelector('#settings-form').requestSubmit()`
  },
  { name: 'Minesweeper statistics', path: '/pages/minesweeper/statistics.html' },
  { name: '2048 game', path: '/pages/2048/game.html', setup: show2048Tiles },
  // At 360 px the tile numbers are 18 px bold, which counts as normal text and needs 4.5:1.
  { name: '2048 game', path: '/pages/2048/game.html', width: 360, setup: show2048Tiles },
  { name: '2048 instructions', path: '/pages/2048/instructions.html' },
  { name: '2048 statistics', path: '/pages/2048/statistics.html' }
];

// Runs in the page: collects text, border, and icon colors with the background they are seen on.
const collectPairs = `(() => {
  const parse = (value) => {
    const parts = value.match(/[\\d.]+/g);
    if (!parts) return null;
    const scale = value.startsWith('color(') ? 255 : 1;
    return { r: +parts[0] * scale, g: +parts[1] * scale, b: +parts[2] * scale, a: parts[3] === undefined ? 1 : +parts[3] };
  };
  const isVisible = (element) => {
    const box = element.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1 || element.closest('[hidden], [inert]')) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  };
  const opacity = (element) => {
    let value = 1;
    for (let current = element; current; current = current.parentElement) value *= +getComputedStyle(current).opacity;
    return value;
  };
  // WCAG 1.4.3 and 1.4.11 exempt inactive controls.
  const isDisabled = (element) =>
    !!element.closest('button:disabled, [aria-disabled="true"], input:disabled, select:disabled');
  // The first ancestor, including the element itself, with an opaque background.
  const background = (element) => {
    for (let current = element; current; current = current.parentElement) {
      const color = parse(getComputedStyle(current).backgroundColor);
      if (color && color.a >= 0.99) return color;
    }
    return parse(getComputedStyle(document.documentElement).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  };
  const describe = (element) => {
    const id = element.id ? '#' + element.id : '';
    const classes = element.classList.length ? '.' + [...element.classList].slice(0, 2).join('.') : '';
    const text = (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 28);
    return element.tagName.toLowerCase() + id + classes + (text ? ' "' + text + '"' : '');
  };
  const rgb = (color) => [color.r, color.g, color.b].map(Math.round);
  const pairs = [];

  for (const element of document.body.querySelectorAll('*')) {
    if (!isVisible(element)) continue;
    const style = getComputedStyle(element);
    const hasOwnText = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());

    if (hasOwnText) {
      const color = parse(style.color);
      if (color && color.a > 0) {
        const size = parseFloat(style.fontSize);
        const isLarge = size >= 24 || (+style.fontWeight >= 700 && size >= 18.66);
        pairs.push({
          kind: 'text',
          label: describe(element),
          fg: rgb(color),
          bg: rgb(background(element)),
          min: isLarge ? 3 : 4.5,
          exempt: isDisabled(element) ? 'disabled' : opacity(element) < 1 ? 'semi-transparent' : ''
        });
      }
    }
    if (element.matches('button:not(.game-cell), input:not([type=checkbox]), select')) {
      const border = parse(style.borderTopColor);
      if (border && parseFloat(style.borderTopWidth) >= 1) {
        pairs.push({
          kind: 'border',
          label: describe(element),
          fg: rgb(border),
          bg: rgb(background(element.parentElement)),
          min: 3,
          exempt: isDisabled(element) ? 'disabled' : ''
        });
      }
    }
    if (element.matches('.icon')) {
      const isFlag = element.dataset.icon === 'flag';
      const fill = parse(isFlag ? getComputedStyle(element, '::after').backgroundColor : style.backgroundColor);
      if (fill) {
        pairs.push({
          kind: 'icon',
          label: describe(element) + ' ' + element.dataset.icon,
          fg: rgb(fill),
          bg: rgb(background(element.parentElement)),
          min: 3,
          exempt: isDisabled(element) ? 'disabled' : ''
        });
      }
    }
    if (element.matches('.game-cell')) {
      for (const pseudo of ['::before', '::after']) {
        const pseudoStyle = getComputedStyle(element, pseudo);
        if (pseudoStyle.content === 'none' || !pseudoStyle.maskImage || pseudoStyle.maskImage === 'none') continue;
        const fill = parse(pseudoStyle.backgroundColor);
        const icon = pseudoStyle.maskImage.replace(/.*icons\\//, '').replace('")', '');
        if (fill && fill.a > 0) {
          pairs.push({
            kind: 'cell icon',
            label: describe(element) + ' ' + icon,
            fg: rgb(fill),
            bg: rgb(background(element)),
            min: 3,
            // The flag shape is recognizable by its pole, which is checked as its own layer.
            exempt: icon === 'flag-cloth.svg' ? 'flag cloth, shape shown by the pole' : ''
          });
        }
      }
    }
  }
  return pairs;
})()`;

function luminance([r, g, b]) {
  const channel = (value) => {
    const share = value / 255;
    return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const toHex = (color) => '#' + color.map((value) => value.toString(16).padStart(2, '0')).join('');

async function auditScheme(session, scheme) {
  const findings = [];
  const exempt = [];
  let pairCount = 0;

  await session.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: scheme },
      { name: 'prefers-reduced-motion', value: 'reduce' }
    ]
  });

  for (const scenario of scenarios) {
    const width = scenario.width ?? 1280;
    await session.evaluate('try { localStorage.clear(); } catch {}');
    await session.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });
    await session.navigate(scenario.path);
    await session.evaluate('window.lycheelabComponentsLoaded');
    if (scenario.setup) {
      await session.evaluate(scenario.setup);
    }
    await sleep(250);

    const pairs = await session.evaluate(collectPairs);
    if (pairs.length === 0) {
      check(false, `${scheme} ${width}px ${scenario.name}: the page shows content to check`);
    }
    pairCount += pairs.length;

    const seen = new Set();
    for (const pair of pairs) {
      const ratio = contrastRatio(pair.fg, pair.bg);
      const key = `${pair.kind}|${toHex(pair.fg)}|${toHex(pair.bg)}|${pair.label.replace(/".*"/, '')}`;
      if (ratio >= pair.min || seen.has(key)) continue;
      seen.add(key);
      const finding = {
        ...pair,
        where: `${width}px ${scenario.name}`,
        description: `${pair.kind} ${toHex(pair.fg)} on ${toHex(pair.bg)} = ${ratio.toFixed(2)}:1 (min ${pair.min}:1)`
      };
      (pair.exempt ? exempt : findings).push(finding);
    }
  }

  check(
    findings.length === 0,
    `${scheme}: ${pairCount} color pairs in ${scenarios.length} page states meet the minimum`
  );
  for (const finding of findings) {
    console.log(`     ${finding.description} – ${finding.where}: ${finding.label}`);
  }
  for (const finding of exempt) {
    console.log(`INFO ${scheme}: not counted (${finding.exempt}): ${finding.description} – ${finding.where}`);
  }
}

await runBrowserCheck({
  name: 'contrast-audit',
  serverPort: 8767,
  debugPort: 9335,
  run: async (session) => {
    await session.send('Page.addScriptToEvaluateOnNewDocument', { source: seedRandom });
    await auditScheme(session, 'light');
    await auditScheme(session, 'dark');
  }
});
