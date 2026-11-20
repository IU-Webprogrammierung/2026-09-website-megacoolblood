# Browser checks

These Node scripts check the site in headless Chrome. They repeat tests that
are hard to do reliably by hand and print `PASS` or `FAIL` per check; a failed
check also prints the measured value. Page exceptions, console errors, and
failed requests also count as `FAIL`. A script ends with exit code 0 when all
checks pass and 1 otherwise.

## Requirements

- Node.js 22 or newer; the scripts use the built-in `fetch` and `WebSocket`, so
  no npm packages are needed
- Google Chrome; the default path is
  `C:\Program Files\Google\Chrome\Application\chrome.exe`. Pass another path as
  the first argument or in `CHROME_PATH`

## Running

```sh
node tests/browser-matrix-check.mjs
node tests/contrast-audit.mjs
node tests/game-board-check.mjs
node tests/offline-check.mjs
node tests/storage-full-check.mjs
node tests/reduced-motion-check.mjs
node tests/theme-script-check.mjs
node tests/theme-sync-check.mjs
node tests/visual-regression-check.mjs
```

`visual-regression-check.mjs` compares the working copy with the last commit.
Set `REFERENCE` to another Git ref to compare with an older version, for
example `REFERENCE=HEAD~3` (PowerShell: `$env:REFERENCE = 'HEAD~3'`). Run it
before committing a refactoring to show that nothing visible changed.

`browser-check.mjs` contains the shared setup: it serves the site locally,
starts headless Chrome with a temporary profile, and removes both afterwards.
Like GitHub Pages, a folder address serves its `index.html`. It can open a
second tab in the same profile, serve a second copy of the site and stop it
again, and compares page backgrounds
with the `light-dark()` value of a color scheme, so the checks contain no
color values. Each check uses its own ports, so several checks can run at the
same time.

## Checks

| Script                     | Checks                                                                                                                                                                                         | Ports      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `browser-matrix-check.mjs` | All 10 pages at 360, 768, 1280, and 1920 px in four color modes (system light and dark, stored Hell and Dunkel): expected scheme and select value, no horizontal scrolling, site header and `h1` present. Keyboard: every Tab stop on all pages shows an outline of at least 2 px with 3:1, light and dark. Minesweeper with 9 × 9, 16 × 30, and 100 × 100 cells at 360, 767, 768, 1280, and 1920 px: no horizontal scrolling before and after the header toggle. About 2.5 minutes | 8768, 9336 |
| `contrast-audit.mjs`       | WCAG contrast of every visible text, control border, and icon in 15 page states, with the light and the dark system color scheme; 2048 tiles also at 360 px, where their numbers need 4.5:1 | 8767, 9335 |
| `game-board-check.mjs`     | Minesweeper, light and dark: hidden and revealed cells differ by at least 3:1, the 7 cell states have different backgrounds, the board frame stands out by at least 3:1, focused cells show an outline. Edge shadows only when the board does not fit; a color scheme switch on 100 × 100 cells under 1 s. 2048: the arrow keys move the tiles | 8771, 9339 |
| `offline-check.mjs`        | Service worker: it controls the page after the first visit; the precache list in `sw.js` contains every served file of the working copy and nothing else; online, pages come from the network and stylesheets from the cache with a background update; after the server is stopped, the site root, all 10 pages, and both games load completely | 8774, 8775, 9341 |
| `storage-full-check.mjs`   | Minesweeper save when `localStorage` is full, without and with an existing save                                                                                                                | 8765, 9333 |
| `reduced-motion-check.mjs` | Transitions and animations of the Minesweeper game page with `prefers-reduced-motion` set to `reduce` and `no-preference`                                                                    | 8766, 9334 |
| `theme-script-check.mjs`   | `js/theme.js`: a stored Dunkel is applied before the first stylesheet on all 10 pages; every stored value (none, System, Hell, Dunkel, invalid) against a light and a dark system setting, including the `theme-color` of the browser bar; the `window.lycheelabTheme` API; blocked and full storage | 8769, 9337 |
| `theme-sync-check.mjs`     | Color scheme sync between two tabs: a change in either tab, the same value again, invalid, removed, and cleared values, unrelated keys, a focused select, immersive mode, and navigation afterwards | 8770, 9338 |
| `visual-regression-check.mjs` | Working copy against a committed version (`REFERENCE`, default `HEAD`): computed colors of every element and identical pixels in 14 views at 360 and 1920 px, light and dark. Screenshots of different views are kept in a temporary folder, whose path is printed. About 2 minutes | 8772, 8773, 9340 |

## Known results

- `reduced-motion-check.mjs` reports
  `FAIL reduce: the menu icon has no transition` until the open finding on
  reduced motion in the [main README](../Readme.md) is fixed.
- `contrast-audit.mjs` lists the flag cloth on Minesweeper cells as `INFO`, not
  as a failure: the flag is recognizable by its pole, which is checked as its
  own layer.

## Limitations

- The contrast audit compares each color with the first opaque background
  behind it. It does not see gradients, background images, or colors blended
  through transparency; text on semi-transparent elements is listed as `INFO`
  instead of being checked.
- The audit uses the system color scheme (`prefers-color-scheme`), not the
  stored choice in the "Farbschema" select. Both select the same `light-dark()`
  values, but only the system setting is checked.
- The focus walk runs at 1280 px only and compares the outline with the first
  opaque background around the focused element.
- The time for a color scheme switch comes from headless Chrome without a
  graphics card. It is an upper bound against large slowdowns, not a
  measurement of the speed on real devices.
- The visual regression check needs Git and `tar` (included in Windows 10 and
  newer). It compares only committed files of the reference with the working
  copy, and identical pixels only within the same Chrome version; it shows that
  something changed, not whether the change is wanted. Delete the folder with
  the screenshots after reviewing them.
- The visual regression check hides scrollbars. A page that is almost exactly
  as high as the window can otherwise settle with or without a scrollbar,
  depending on load timing, and show a difference that is not caused by the
  code.
- The offline check takes the site offline by stopping its second server, so
  the requests of the service worker fail as well; it does not use the
  browser's network emulation.
- `theme-script-check.mjs` simulates blocked storage with a `localStorage`
  getter that throws a `SecurityError`, and full storage with a `setItem` that
  throws a `QuotaExceededError`, instead of changing browser settings.
- The scripts wait a fixed time after each page load; on a slow machine, a
  check can fail without a real defect. Repeat the run before investigating.
