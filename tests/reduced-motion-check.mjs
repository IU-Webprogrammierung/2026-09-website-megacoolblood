// Checks that transitions and animations follow prefers-reduced-motion.
// Usage: node tests/reduced-motion-check.mjs [chrome.exe], or set CHROME_PATH.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFile, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const chromePath =
  process.argv[2] || process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const serverPort = 8766;
const debugPort = 9334;
const pageUrl = `http://127.0.0.1:${serverPort}/pages/minesweeper/game.html`;
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

const profileDir = mkdtempSync(join(tmpdir(), 'lycheelab-motion-check-'));
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
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 400,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  await checkReducedMotion(session);
  await checkNoPreference(session);
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
