// Checks the Minesweeper save when localStorage is full.
// Usage: node tests/storage-full-check.mjs [chrome.exe], or set CHROME_PATH.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFile, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const chromePath =
  process.argv[2] || process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const serverPort = 8765;
const debugPort = 9333;
const pageUrl = `http://127.0.0.1:${serverPort}/pages/minesweeper/game.html`;
const saveErrorMessage = 'Spielstand konnte nicht gespeichert werden.';
const contentTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};
const failures = [];
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function check(condition, description) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${description}`);
  if (!condition) {
    failures.push(description);
  }
}

function startServer() {
  return createServer((request, response) => {
    const file = join(siteRoot, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));

    if (!file.startsWith(siteRoot + sep)) {
      response.writeHead(404).end();
      return;
    }

    readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream' });
      response.end(data);
    });
  }).listen(serverPort, '127.0.0.1');
}

async function connectToPage() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = targets.find((target) => target.type === 'page');
      if (page) {
        const socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolveOpen) => socket.addEventListener('open', resolveOpen, { once: true }));
        return socket;
      }
    } catch {
      // Chrome is not ready yet.
    }
    await sleep(200);
  }
  throw new Error(`Chrome did not open debugging port ${debugPort}.`);
}

function createSession(socket) {
  let nextId = 1;
  const pendingCommands = new Map();
  const eventWaiters = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.id && pendingCommands.has(message.id)) {
      pendingCommands.get(message.id)(message);
      pendingCommands.delete(message.id);
    } else if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      check(false, `no page exception (${details.exception?.description || details.text})`);
    } else if (eventWaiters.has(message.method)) {
      eventWaiters.get(message.method)();
      eventWaiters.delete(message.method);
    }
  });

  function send(method, params = {}) {
    const id = nextId++;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveCommand) => pendingCommands.set(id, resolveCommand));
  }

  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.result.exceptionDetails) {
      throw new Error(`${expression}: ${response.result.exceptionDetails.text}`);
    }
    return response.result.result.value;
  }

  async function navigate() {
    const loaded = new Promise((resolveLoad) => eventWaiters.set('Page.loadEventFired', resolveLoad));
    await send('Page.navigate', { url: pageUrl });
    await loaded;
    // Panzoom is imported after the load event.
    await sleep(500);
  }

  return { send, evaluate, navigate };
}

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

const profileDir = mkdtempSync(join(tmpdir(), 'lycheelab-storage-check-'));
const server = startServer();
const chrome = spawn(
  chromePath,
  ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, 'about:blank'],
  { stdio: 'ignore' }
);
const chromeExited = new Promise((resolveExit) => chrome.once('exit', resolveExit));
let socket;

try {
  socket = await connectToPage();
  const session = createSession(socket);
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await checkNewSave(session);
  await checkExistingSave(session);
} catch (error) {
  check(false, `check run completes (${error.message})`);
} finally {
  socket?.close();
  chrome.kill();
  await chromeExited;
  server.close();
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

console.log(failures.length === 0 ? 'All checks passed.' : `${failures.length} check(s) failed.`);
process.exitCode = failures.length === 0 ? 0 : 1;
