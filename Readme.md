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
- The game starts in immersive mode below 768 px, where the website header and
  footer are hidden. A labeled "Vollbild" button hides them on wider screens and
  becomes "Vollbild beenden" while they are hidden; below 768 px it is an icon
  button named "Menü anzeigen" that shows them again. This is a CSS layout
  mode, not the browser Fullscreen API
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

## Browser support

The site relies on CSS `light-dark()` and native CSS nesting. According to
[MDN browser compatibility data](https://github.com/mdn/browser-compat-data),
`light-dark()` requires Chrome and Edge 123, Firefox 120, or Safari 17.5;
unprefixed `mask-image` requires Chrome 120, Firefox 53, or Safari 15.4.
Older browsers do not get valid colors.
