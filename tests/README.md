# Browser checks

These Node scripts check the site in headless Chrome. They repeat tests that
are hard to do reliably by hand and print `PASS` or `FAIL` per check. Page
exceptions, console errors, and failed requests also count as `FAIL`. A script
ends with exit code 0 when all checks pass and 1 otherwise.

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
node tests/storage-full-check.mjs
node tests/reduced-motion-check.mjs
```

`browser-check.mjs` contains the shared setup: it serves the site locally,
starts headless Chrome with a temporary profile, and removes both afterwards.
Each check uses its own ports, so several checks can run at the same time.

## Checks

| Script                     | Checks                                                                                                                                                                                         | Ports      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `browser-matrix-check.mjs` | All 10 pages at 360, 768, 1280, and 1920 px in four color modes (system light and dark, stored Hell and Dunkel): expected scheme and select value, no horizontal scrolling, site header and `h1` present. Keyboard: every Tab stop on all pages shows an outline of at least 2 px with 3:1, light and dark. Minesweeper with 9 × 9, 16 × 30, and 100 × 100 cells at 360, 767, 768, 1280, and 1920 px: no horizontal scrolling before and after the header toggle. About 2.5 minutes | 8768, 9336 |
| `contrast-audit.mjs`       | WCAG contrast of every visible text, control border, and icon in 15 page states, with the light and the dark system color scheme; 2048 tiles also at 360 px, where their numbers need 4.5:1 | 8767, 9335 |
| `storage-full-check.mjs`   | Minesweeper save when `localStorage` is full, without and with an existing save                                                                                                                | 8765, 9333 |
| `reduced-motion-check.mjs` | Transitions and animations of the Minesweeper game page with `prefers-reduced-motion` set to `reduce` and `no-preference`                                                                    | 8766, 9334 |

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
- The scripts wait a fixed time after each page load; on a slow machine, a
  check can fail without a real defect. Repeat the run before investigating.
