# LycheeLab

LycheeLab is a static website with progressive web application features.
The project was created as part of the IU Web Programming course using
semantic HTML, custom CSS, and vanilla JavaScript.

## Dependencies

- `@panzoom/panzoom` 4.6.2 (MIT), from
  [the official repository](https://github.com/timmywil/panzoom), is added for the Minesweeper board viewport.
  Its ESM build and MIT license are included in `assets/vendor`, so static hosting does not require `node_modules`.
  The vendored build includes a local pinch-zoom synchronization patch; reapply it when updating Panzoom.
  Install the pinned dependency with `npm ci` when updating the vendored build.
- `prettier` 3.9.10 (MIT) is a pinned development dependency for code
  formatting only; it is not part of the published site.

## Development

- Install the pinned tools with `npm ci`.
- Format HTML, CSS, and JavaScript with `npm run format`; check the formatting
  with `npm run format:check`. The settings are in `.prettierrc.json`
  (120 characters, single quotes, no trailing commas); indentation and line
  endings come from `.editorconfig`.
- `.gitattributes` checks out text files with LF line endings on every
  platform, so the format check also passes on Windows.
- `node_modules`, `assets/vendor`, `package-lock.json`, and Markdown files are
  not formatted.
- Browser checks in headless Chrome for responsive layout, keyboard focus,
  contrast, the game boards, the color scheme script and its sync between tabs,
  full storage, and reduced motion are in `tests/`, as well as a visual
  comparison with the last commit for refactorings; see
  [tests/README.md](tests/README.md) for requirements, usage, and known results.

## Features

### Color scheme

- A "Farbschema" select in the site header offers System, Hell (light), and
  Dunkel (dark). Below 768 px it is part of the menu.
- System is the default and follows the operating system setting through
  `prefers-color-scheme`, also when it changes while the page is open.
- The choice is stored in `localStorage` under `lycheelab-theme`. If storage is
  unavailable, full, or holds an unknown value, System applies; a choice that
  cannot be saved only applies to the current page.
- `js/theme.js` is loaded without `defer` before the stylesheets on every page,
  so the stored choice is applied before the first paint and the page does not
  flash in the wrong scheme.
- A change in one tab is applied to other open tabs of the site without a
  reload, including their select. Removing the stored value, for example with
  `localStorage.clear()`, switches open tabs back to System.
- Every color is a CSS custom property in `css/style.css`, `css/minesweeper.css`,
  or `css/2048.css` defined with `light-dark()`; `color-scheme` on the root
  element selects the value, and `data-theme` overrides the system setting.
  Native controls, scrollbars, and dialogs follow the scheme as well.
- Icons are SVG files used as CSS masks filled with the current text color, so
  they follow the scheme. The two-colored flag stacks two masks: the pole
  follows the text color and the cloth uses its own flag color.
- Buttons share a lab-flask design based on the site-mascot: green-rimmed glass
  pills with a gloss, an orange glow on hover,
  and a filled orange "potion" with bubbles and a thicker rim for the selected
  Minesweeper mode, so the selection is not shown by color alone. Transitions
  only run without `prefers-reduced-motion: reduce`.
- Both game boards have their own dark palette. In Minesweeper, raised cells
  stay mid gray and revealed cells turn dark with light numbers; in 2048, low
  tiles are dark with light text and high tiles are bright with dark text.

### Minesweeper

- Overview, game, settings, and statistics pages
- Four preset difficulty levels:
  - Beginner: 9 × 9 cells and 10 mines
  - Intermediate: 16 × 16 cells and 40 mines
  - Expert: 30 × 16 cells and 99 mines
  - Maximum: 100 × 100 cells and 2,000 mines
- Custom difficulties in the settings: 5 to 100 rows and columns and at most
  33 % mines, keeping the 3 × 3 start area free. Preset sizes are shown
  read-only; custom values are validated with a message per field
- Rule switches in the settings: extra lives, Check, and less-guess placement.
  All three are on by default. Each combination of size, mines, and rules is a
  separate difficulty with its own saved game and statistics. Disabled extra
  lives end the game on the first mine, and disabled Check removes the Check
  mode, its charges, and the `P` shortcut.
- Less-guess placement avoids two small guess situations: two adjacent cells
  sharing one mine, and a 2 × 2 block with two mines, where the surrounding
  numbers cannot tell the possible layouts apart. A cell that would complete
  such a situation is skipped and only receives a mine when no other free cell
  is left. Larger guess situations are intentionally not handled, so the
  placement does not guarantee a game without guessing. The placement logic in
  `js/minesweeper/mine-placement.js` has no DOM access and was checked with
  Node scripts
- Random mine placement and display of adjacent mine counts
- Automatic revealing of connected empty areas
- Four input modes: Reveal, Flag, Mark with a question mark, and limited Check
- Mode switching through buttons or the `A`, `F`, `M`, and `P` keyboard shortcuts
  (`P` only with Check enabled); the selected mode is stored locally. If no
  Check charges are left, the game starts in Reveal mode instead
- With extra lives enabled, the game starts with three extra lives; revealing a
  mine consumes one, and another mine hit at zero lives ends the game
- Safe reveals grant a reward for each difficulty-specific threshold:
  `ceil(1.5 * (fields / mines)^4)`, capped at 9,999 fields
  (Beginner: 6,458; Intermediate: 2,517; Expert: 829; Maximum: 938 fields).
  The settings page shows the threshold for the selected difficulty while
  extra lives or Check are enabled. The reward depends on the enabled rules:
  - Both: an extra life up to three; at full lives, three Check charges instead
  - Extra lives only: an extra life up to three; at full lives, the reward is lost
  - Check only: three Check charges
  - Neither: no rewards and no reward progress
- Check mode starts with three charges and uses one to flag a mine or reveal a
  safe cell; on the first move it reveals without using a charge. Marked
  question cells can be checked, while flags must be removed first
- After a win, Score, extra lives, Check charges, and reward progress carry into
  the next round. Restarting resets the active difficulty's series; a loss ends
  it. Each difficulty has its own saved board and series, so changing difficulty
  preserves the previous save and resumes it when selected again
- Saved boards store one character per cell, so a 100 × 100 save takes about
  10,000 characters instead of about 900,000; invalid saved cells start a new
  game. If `localStorage` is full, the game keeps running and reports that it
  could not be saved
- Right-click in Check mode toggles a question mark
- Mouse Left and Right clicks, Space key, and arrow key controls
- The first move of a game always reveals a cell, regardless of the selected
  mode or mouse button
- The game header shows remaining mines, series Score, and extra lives; the
  mode controls show remaining Check charges
- The board supports mouse-wheel zoom, mouse dragging, touch dragging, and
  pinch zoom; separate controls provide zoom in, zoom out, and centering. The
  centering control and loading a saved game move the view to the unrevealed,
  unmarked cell next to a revealed cell that is closest to the last used cell;
  without such a cell, the view is reset
- The game is always in immersive mode below 768 px, where the website header
  and footer are hidden. Only the site menu button stays visible in the top
  right corner; opening the menu also shows the footer with Impressum and
  Datenschutz above the game, so the board keeps its size. From 768 px a
  labeled "Vollbild" button hides header and footer and becomes "Vollbild
  beenden" while they are hidden. This is a CSS layout mode, not the browser
  Fullscreen API
- Pan/zoom operates on the board viewport; keyboard cell navigation remains
  independent of the visual zoom level
- A frame in a contrasting color marks the real board edge on a dotted
  surface, and inner shadows on the viewport edges show where the board
  continues beyond the visible area
- Visible focus state for board cells
- Status messages for starting a game, revealing cells, winning, and losing;
  the win message includes the playing time
- A win opens a modal `<dialog>` with the playing time, the Score, and the
  options "Nächste Runde" and "Spielfeld anschauen" (also Escape); focus then
  returns to the header button. A short pop-in animation only plays without
  `prefers-reduced-motion: reduce`, and reloading a won game does not reopen
  the dialog
- Playing time runs from the first move until the round ends, pauses while
  the page is hidden, and is saved with the game so a reload continues it
- After a game ends, correct flags are highlighted and wrong flags are crossed
  out; a win flags every remaining mine automatically, so all flags show as
  correct and the remaining mine count is 0
- Winning streak and game statistics stored using `localStorage`
- Statistics are grouped by difficulty, including custom sizes and rule
  combinations; cards list presets by size first, then custom difficulties,
  and unknown keys are skipped. They contain games won, success rate,
  cleared mines, wrong flags, best, average, and slowest winning time, current
  streak, longest winning streak, and the highest Score achieved within a
  series. A win counts every
  mine as cleared; a lost or aborted round counts its correct flags as cleared
  mines and its wrong flags separately, both only when the round ends. Times
  cover won games
- No account, application backend, or tracking required
- Serve the static files over HTTP; component loading and the local Panzoom ESM
  import are not supported by a plain `file://` launch

### 2048

- Classic 4 × 4 board with randomly placed 2 and 4 tiles
- Arrow-key controls for moving tiles in all four directions
- Swipe controls for touch devices
- Matching tiles merge into a tile with double the value
- Score, best score, and game status are displayed during play
- One-step undo function for the latest valid move
- The game can be continued after reaching the 2048 tile
- A game ends when no valid move remains
- Statistics include started games, valid and invalid moves, undos, wins,
  losses, highest tile, and total score
- Best score and statistics are stored locally using `localStorage`

## Refactoring

Larger refactorings were made in separate commits (`refactor`, `perf`, or
`style` for formatting and CSS nesting) that do not change the behavior, so
each step can be reviewed and reverted on its own:

- Minesweeper data model: the cells moved from a flat array to a 2D array
  addressed by row and column; difficulties became a configuration of size,
  mines, and rule switches with one key per combination
  (`js/minesweeper/difficulty.js`), which enabled custom sizes and rule
  combinations; statistics and saved games share storage helpers in
  `js/minesweeper/run-state.js`
- Saved boards: one character per cell instead of an object per cell, so a
  100 × 100 save needs about 10,000 instead of about 900,000 characters
- Shared JavaScript: marking the current page with `aria-current` and the rule
  for when global shortcuts are ignored (form fields, open dialogs) each moved
  into one function in `js/components.js` used by both games; the page scripts
  are loaded the same way with `defer` in every document head, except
  `js/theme.js`, which runs before the stylesheets on purpose
- CSS organization: Minesweeper layout rules moved from `css/style.css` to
  `css/minesweeper.css`, duplicate board rules were merged, the site header
  rules were restructured, and related selectors were grouped with native CSS
  nesting
- Colors: all hard-coded colors became CSS custom properties, which later
  allowed the dark scheme with `light-dark()` without duplicating rules
- Icons: images and background images became CSS masks filled with the current
  text color, so they follow the color scheme; the flag uses two mask layers
- Code formatting: Prettier was introduced and the existing code formatted
  once in a separate commit, so later commits contain no formatting noise
- Browser checks: the shared setup of the test scripts (local server, headless
  Chrome, output) moved into `tests/browser-check.mjs`, which removed about 290
  repeated lines

Before a refactoring is committed,
[the visual regression check](tests/visual-regression-check.mjs) compares it
with the last commit (see Testing).

## Testing

All tests were run manually in November 2026 on the version published on
[GitHub Pages](https://iu-webprogrammierung.github.io/2026-09-website-megacoolblood/index.html),
unless stated otherwise.
Performance was judged subjectively and not measured.

### Tools

- `npm run format:check` (Prettier) passes without findings
- All internal links were checked by hand
- Viewport widths were read from the browser developer tools
- [Nu Html Checker](https://validator.w3.org/nu/) on all 10 pages and the
  header and footer components:
  - Error on every page: the placeholders `<component path="…">` for the
    header and footer are not a valid HTML element (see Open findings)
  - Header and footer: missing doctype, `<title>`, and `lang`. These are
    expected, because the components are fragments that are inserted into a
    complete page and are not documents of their own
  - Info only: a trailing slash on void elements such as `<meta … />`. It comes
    from Prettier's HTML output and has no effect, because all attribute values
    are quoted
  - No other errors or warnings. The subnavigation fragments and the pages
    after the components are inserted were not checked
- Lighthouse accessibility audit in the Chrome DevTools on all 10 pages, each
  in the light and the dark color scheme:
  - Score 100: start page, Impressum, Datenschutz, and the instructions,
    settings, and statistics pages of both games
  - Score 95: Minesweeper game, because the board with `role="grid"` contains
    no elements with `role="row"`
  - Score 91: 2048 game, for the same reason and because its
    `role="gridcell"` tiles are not inside a `role="row"` element
  - Both findings are listed under Open findings. Automated audits only find
    part of the possible problems and do not replace manual checks
- [Contrast audit](tests/contrast-audit.mjs) in headless Chrome 157 on a
  local server: every visible text, control border, and icon against the
  background it is seen on, in 15 page states with the light and the dark
  system color scheme, including all Minesweeper cell states, both dialogs, the
  settings error, the open menu at 360 px, and 2048 tiles 2 to 4096 at 1280
  and 360 px. All 585 color pairs per scheme meet WCAG 1.4.3 (4.5:1, 3:1 for
  large text) and 1.4.11 (3:1). Not counted: the red flag cloth on Minesweeper
  cells (1.10:1 to 1.56:1), because the flag is recognizable by its pole
- [Browser matrix](tests/browser-matrix-check.mjs) in headless Chrome 157 on a
  local server, without findings:
  - All 10 pages at 360, 768, 1280, and 1920 px with the system scheme light
    and dark and with Hell and Dunkel stored against the system setting: the
    expected scheme and select value, no horizontal scrolling, no console
    errors or failed requests
  - Keyboard at 1280 px: all 128 Tab stops on the 10 pages show an outline of
    at least 2 px with at least 3:1 against their background, in light and
    dark
  - Minesweeper with 9 × 9, 16 × 30, and 100 × 100 cells at 360, 767, 768,
    1280, and 1920 px: no horizontal scrolling before and after opening the
    site menu (below 768 px, which also shows the footer) or toggling
    "Vollbild"; below 768 px, Tab reaches the menu button before the status
    and the restart button
- [Color scheme script check](tests/theme-script-check.mjs) in headless
  Chrome 157 on a local server, without findings: a stored Dunkel is set before
  the first stylesheet on all 10 pages; every stored value (none, System, Hell,
  Dunkel, invalid) gives the expected scheme with a light and a dark system
  setting; with simulated blocked or full storage, the system scheme applies,
  a new choice only affects the current page, and the Minesweeper game page
  loads without errors
- [Color scheme sync check](tests/theme-sync-check.mjs) with two tabs in
  headless Chrome 157 on a local server, without findings: a change in either
  tab reaches the other without a reload, with one change event per tab and
  none for the same value again; invalid, removed, and cleared values fall back
  to System; other keys and `sessionStorage` events are ignored; a focused
  select keeps its focus, and immersive mode does not block the change
- [Game board check](tests/game-board-check.mjs) in headless Chrome 157 on a
  local server, without findings: in light and dark, hidden and revealed
  Minesweeper cells differ by at least 3:1, all 7 cell states have different
  backgrounds, the board frame stands out from the surface by at least 3:1, and
  focused cells show an outline of at least 2 px; edge shadows appear only when
  the board does not fit; a color scheme switch on a 100 × 100 board takes less
  than 1 s; the arrow keys move the 2048 tiles
- [Visual regression check](tests/visual-regression-check.mjs): compares the
  computed colors and pixels of 14 views at 360 and 1920 px, light and dark,
  with a committed version. It is meant for refactorings; a deliberate color
  and spacing change was detected in 50 of 54 views, and the other 4 do not
  show the changed elements

### Browsers and devices

- Windows 11 with Firefox 159.0.1 and Chrome 156.0.8078.74, on a 1440p and a
  1920 px wide monitor
- Android 15: Fairphone 5 with Chrome 156.0.8078.79
- iOS 27.2: iPhone 15 Pro (Safari), iPhone 15 (Firefox), and iPhone SE
  2nd generation (Safari)
- iPadOS 27.2: iPad mini (Safari) and iPad Air 5th generation (Safari)
- Touch, drag, and pinch were tested on the real phones and tablets, not only in
  device emulation
- All pages were opened on the mobile devices; most of the mobile testing was
  spent on Minesweeper

### Responsive layout

- All pages were checked at 360, 768, 1280, and 1920 px by resizing the browser
  window, without findings; the browser matrix (see Tools) repeats this for
  horizontal scrolling and the color scheme
- The 768 px breakpoint was checked exactly at the switch between 767 and 768 px
- Portrait and landscape: the desktop works in both window shapes; on iPads
  landscape is usable and works better in immersive mode; on smartphones
  Minesweeper is only usable in landscape in immersive mode, and even then
  limited, because the game header and footer take up much of the low height
- Browser zoom in Firefox on the 1440p monitor: usable up to 300 %
- System text size on the iPhone 15 Pro: from step 4 onward, the Minesweeper
  board is no longer visible; other pages were not checked with this setting

### Keyboard

- Tab order and visible focus were checked on all pages; all interactive
  elements can be reached. The browser matrix (see Tools) also measures the
  focus outline at every Tab stop
- Menu below 768 px: opens with the menu button and closes with Escape. After
  opening, focus stays on the menu button, so the next Tab reaches the
  "Farbschema" select and then the links. Before, focus jumped to the first
  link and the select could only be reached with Shift+Tab; the fix was
  checked by hand and with key presses in headless Chrome 157
- The "Farbschema" select can be operated with the arrow keys
- Minesweeper settings: the form can be filled in by keyboard; after an invalid
  submission, focus moves to the invalid field, and both the focus change and
  the error message are understandable
- Minesweeper: arrow keys and Space on the board, the `A`, `F`, `M`, and `P`
  shortcuts, the zoom and immersive mode buttons, and the win dialog including
  Escape and the focus returning to the header button
- 2048: arrow keys
- Minesweeper below 768 px: the site menu button in the top right corner
  replaced a separate "Menü anzeigen" button, which received focus only after
  the status message and the restart button although it sat above them. Tab
  now reaches the menu button first; checked with key presses in headless
  Chrome 157, not yet by hand

### Color scheme

- System, Hell, and Dunkel
- Changing the system setting while the page is open
- Applying a change to other open tabs; the color scheme sync check (see Tools)
  repeats this automatically
- No flash in the wrong scheme when a page loads; the color scheme script
  check (see Tools) confirms that the stored scheme is set before the first
  stylesheet
- An invalid stored value (`lycheelab-theme` set to `quatsch`) falls back to
  System
- Blocked site data in Chrome: a selected scheme only applies to the current
  page; the next page shows System again

### Color vision

- Simulated with "Emulate vision deficiencies" in the Chrome DevTools:
  protanopia, deuteranopia, tritanopia, and achromatopsia, each in the light
  and the dark color scheme
- Minesweeper after a lost game with correct and wrong flags: numbers 1–8,
  flags, wrong flags, the triggered mine, hidden and revealed cells, and the
  selected mode can be told apart. Without any color, wrong flags are still
  recognizable by their cross
- 2048: all tiles can be told apart; without any color, by their numbers
- All numbers stay readable in every simulation

### Reduced motion

- `prefers-reduced-motion` was emulated in headless Chrome 157 on a local
  server, and the computed styles of the Minesweeper game page were read with
  [a script](tests/reduced-motion-check.mjs), because the effects are too
  short to compare reliably by eye:
  - `reduce`: no button transitions and no pop-in animation of the win dialog
  - `no-preference`: button transitions of 120 ms (glow) and 90 ms (press) and
    the 400 ms pop-in animation of the win dialog
  - The 160 ms transition of the menu icon runs in both cases (see Open
    findings)
- In the Chrome DevTools, no difference was visible by eye

### Minesweeper

- Games played to a win or a loss: Beginner, Intermediate, Expert, Maximum,
  and a custom 100 × 100 board with 2,500 mines
- Extra lives, Check, and less-guess placement, each switched on and off
- Rewards at the threshold, carrying Score and extra lives into the next round,
  and resuming the saved game per difficulty after switching
- After a reload, the playing time continues and the win dialog does not reopen;
  the timer pauses while the page is hidden
- Left and right click, mouse-wheel zoom, dragging the board, and the centering
  control
- Invalid custom values in the settings show a message at the matching field
- Statistics after won, lost, and aborted rounds, including the card order
- Full `localStorage`, filled up to the last few free characters: a
  difficulty without a saved game keeps running, reports "Spielstand konnte
  nicht gespeichert werden.", and starts a new game after a reload. An existing
  save is still updated, because overwriting it only adds a few characters.
  Both cases were checked with [a script](tests/storage-full-check.mjs) in
  headless Chrome 157 on a local server; the existing-save case also by hand in
  Chrome on GitHub Pages
- Blocked site data in Chrome (`chrome://settings/content/siteData`): the game
  keeps running and reports "Spielstand konnte nicht gespeichert werden."
- Invalid values (`quatsch`) in the saved game, difficulty, mode, and
  statistics keys: each page loads with default values or a new game and
  without errors in the console. With an invalid statistics value, however,
  no further results are saved (see Open findings)
- 100 × 100 boards on all listed devices: loading, revealing, and panning felt
  smooth; at the minimum zoom of 13 % the board reacts more slowly but stays
  usable

### 2048

- Swipe controls on touch devices, undo, continuing after 2048, the end of a
  game, statistics, and keeping the best score after a reload
- Blocked site data in Chrome: moves and the statistics page work without
  errors in the console
- Invalid values (`quatsch`) in the best score and statistics keys: the game
  and statistics pages load with default values and without errors in the
  console

### Open findings

- iOS and iPadOS in Safari and Firefox: a long press on the board occasionally
  selects text or a cell. It could not be reproduced reliably. Since all iOS
  browsers use WebKit, the cause is assumed to be WebKit-specific; this has not
  been verified
- iOS in several browsers: about three times in roughly 30 hours of play, the
  board got into a state in which a one-finger drag zoomed like a pinch. It
  could not be reproduced on purpose
- Fairphone 5: showing and hiding the edge shadows while panning towards the
  board edge is slightly laggy
- GitHub Pages: switching between pages can take very long; on a local HTTP
  server the pages loaded quickly
- HTML validity: `<component>` is not a defined HTML element, and a custom
  element name would need a hyphen. Browsers treat it as an unknown element;
  `js/components.js` replaces it with the header or footer after loading
- Minesweeper statistics: if `lycheelab-statistics` holds text that is not
  valid JSON, wins, losses, and the winning streak are no longer saved, without
  a message to the player, until the key is removed. `readStatistics()` in
  `js/minesweeper/run-state.js` deliberately returns `null` in this case so
  that the stored value is not overwritten. 2048 replaces unreadable
  statistics with default values and keeps saving
- ARIA grid structure: the Minesweeper board (`role="grid"`) contains the cell
  buttons directly, and the 2048 board contains its `role="gridcell"` tiles
  directly. A grid requires `role="row"` elements between the grid and its
  cells, so screen readers may announce rows and columns incorrectly
- Reduced motion: the 160 ms transition of the menu icon (three lines turning
  into a cross) in `css/style.css` is not limited to
  `prefers-reduced-motion: no-preference` and also runs with `reduce`

### Not tested

- CSS validator and axe
- Screen readers
- Contrast of colors on gradients, background images, or semi-transparent
  elements, which the contrast audit does not measure

## Browser support

The site relies on CSS `light-dark()` and native CSS nesting. According to
[MDN browser compatibility data](https://github.com/mdn/browser-compat-data),
`light-dark()` requires Chrome and Edge 123, Firefox 120, or Safari 17.5;
unprefixed `mask-image` requires Chrome 120, Firefox 53, or Safari 15.4.
Older browsers do not get valid colors. Showing the footer with the open menu
on the Minesweeper game page below 768 px uses `:has()`, which requires Chrome
and Edge 105, Firefox 121, or Safari 15.4; in Firefox 120 the footer stays
hidden there.
