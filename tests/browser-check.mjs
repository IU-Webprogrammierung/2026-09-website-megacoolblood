// Shared setup for the browser checks: a static server for the site, headless Chrome, and PASS/FAIL output.
// Page exceptions, console errors, and browser errors such as failed requests count as failures.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFile, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const siteRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const chromePath =
  process.argv[2] || process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const contentTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};
const failures = [];

export const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

// The optional detail is printed after a failed check, for example the measured value. Returns the condition.
export function check(condition, description, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${description}${!condition && detail ? ` – ${detail}` : ''}`);
  if (!condition) {
    failures.push(description);
  }
  return condition;
}

// OLED has no color scheme of its own: it uses the dark values with a black background.
export function hasSchemeBackground(scheme) {
  if (scheme === 'oled') {
    return `getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)'`;
  }
  return `(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'color-scheme: ${scheme}; background: var(--color-background)';
    document.body.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return getComputedStyle(document.body).backgroundColor === expected;
  })()`;
}

function startServer(root, serverPort) {
  return createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // Like GitHub Pages, a folder address such as the site root serves its index.html.
    const file = join(root, pathname.endsWith('/') ? `${pathname}index.html` : pathname);

    if (!file.startsWith(root + sep)) {
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

async function connectToPage(debugPort) {
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

function createSession(socket, siteUrl, pagePath) {
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
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      const text = message.params.args.map((arg) => arg.value ?? arg.description).join(' ');
      check(false, `no console error (${text})`);
    } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      // Browser messages such as failed requests.
      const { text, url } = message.params.entry;
      check(false, `no browser error (${text}${url ? ' ' + url : ''})`);
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

  // A path opens a page of the checked site; a full URL opens it as given, for example on a second server.
  async function navigate(path = pagePath) {
    const loaded = new Promise((resolveLoad) => eventWaiters.set('Page.loadEventFired', resolveLoad));
    await send('Page.navigate', { url: path.startsWith('http') ? path : siteUrl + path });
    await loaded;
    // Panzoom is imported after the load event.
    await sleep(500);
  }

  return { send, evaluate, navigate };
}

async function openSession(socket, siteUrl, pagePath) {
  const session = createSession(socket, siteUrl, pagePath);
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Log.enable');
  return session;
}

// Each check uses its own ports, so several checks can run at the same time.
// `session.navigate()` opens `pagePath`; `session.navigate(path)` opens another page of the site.
// `openTab()` opens another tab in the same browser profile and returns its session.
// `serveSite(root, port)` serves another copy of the site, for example a reference, and returns `{ url, close }`.
export async function runBrowserCheck({ name, pagePath = '/index.html', serverPort, debugPort, run }) {
  const siteUrl = `http://127.0.0.1:${serverPort}`;
  const profileDir = mkdtempSync(join(tmpdir(), `lycheelab-${name}-`));
  const servers = [startServer(siteRoot, serverPort)];
  const chrome = spawn(
    chromePath,
    ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, 'about:blank'],
    { stdio: 'ignore' }
  );
  const chromeExited = new Promise((resolveExit) => chrome.once('exit', resolveExit));
  const sockets = [];

  async function openTab() {
    const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveOpen) => socket.addEventListener('open', resolveOpen, { once: true }));
    sockets.push(socket);
    return openSession(socket, siteUrl, pagePath);
  }

  function serveSite(root, port) {
    const server = startServer(resolve(root), port);
    servers.push(server);
    // Closing also ends open keep-alive connections, so the next request fails as if the site were offline.
    const close = () => {
      server.closeAllConnections();
      server.close();
    };
    return { url: `http://127.0.0.1:${port}`, close };
  }

  try {
    const socket = await connectToPage(debugPort);
    sockets.push(socket);
    const session = await openSession(socket, siteUrl, pagePath);
    await run(session, { openTab, serveSite });
  } catch (error) {
    check(false, `check run completes (${error.message})`);
  } finally {
    sockets.forEach((socket) => socket.close());
    chrome.kill();
    await chromeExited;
    servers.forEach((server) => server.close());
    // Chrome's helper processes can hold the profile a little longer than the browser itself.
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      console.warn(`Could not remove the temporary profile ${profileDir} (${error.code}); delete it later.`);
    }
  }

  console.log(failures.length === 0 ? 'All checks passed.' : `${failures.length} check(s) failed.`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}
