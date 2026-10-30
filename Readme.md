# LycheeLab

LycheeLab is a static website with progressive web application features.
The project was created as part of the IU Web Programming course using
semantic HTML, custom CSS, and vanilla JavaScript.

## Dependency

- `@panzoom/panzoom` 4.6.2 (MIT), from
  [the official repository](https://github.com/timmywil/panzoom), is added for the Minesweeper board viewport.
  Its ESM build and MIT license are included in `assets/vendor`, so static hosting does not require `node_modules`.
  Install the pinned dependency with `npm ci` when updating the vendored build.

## Features

### Minesweeper

- Overview, game, settings, and statistics pages
- Four difficulty levels:
  - Beginner: 9 × 9 cells and 10 mines
  - Intermediate: 16 × 16 cells and 40 mines
  - Expert: 30 × 16 cells and 99 mines
  - Maximum: 100 × 100 cells and 2,000 mines
- Random mine placement and display of adjacent mine counts
- Automatic revealing of connected empty areas
- Four input modes: Reveal, Flag, Mark with a question mark, and limited Check
- Mode switching through buttons or the `A`, `F`, `M`, and `P` keyboard shortcuts;
  the selected mode is stored locally. If no
  Check charges are left, the game starts in Reveal mode instead
- Three starting extra lives; revealing a mine consumes one, and another mine
  hit at zero lives ends the game
- Safe reveals grant a reward for each difficulty-specific threshold:
  `ceil(totalFields / (mines * (mines / totalFields)^3 * 5 / 4))`
  (Beginner: 3,444; Intermediate: 1,343; Expert: 443; Maximum: 500 fields).
  Rewards restore an extra life up to three; at full lives, a reward adds a
  Check charge instead
- Check mode starts with three charges and uses one to flag a mine or reveal a
  safe cell; on the first move it reveals without using a charge. Marked
  question cells can be checked, while flags must be removed first
- After a win, Score, extra lives, Check charges, and reward progress carry into
  the next round. Restarting resets the active difficulty's series; a loss ends
  it. Each difficulty has its own saved board and series, so changing difficulty
  preserves the previous save and resumes it when selected again
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
- A dark frame marks the real board edge on a dotted surface, and inner
  shadows on the viewport edges show where the board continues beyond the
  visible area
- Visible focus state for board cells
- Status messages for starting a game, revealing cells, winning, and losing;
  the win message includes the playing time
- Playing time runs from the first move until the round ends, pauses while
  the page is hidden, and is saved with the game so a reload continues it
- After a game ends, correct flags are highlighted and wrong flags are crossed
  out; a win flags every remaining mine automatically, so all flags show as
  correct and the remaining mine count is 0
- Winning streak and game statistics stored using `localStorage`
- Statistics are grouped by difficulty and contain games won, success rate,
  cleared mines, wrong flags, best, average, and slowest winning time, current
  streak, longest winning streak, and the highest Score achieved within a
  series. A win counts every
  mine as cleared; a lost or aborted round counts its correct flags as cleared
  mines and its wrong flags separately, both only when the round ends. Times
  only cover wins recorded after time tracking was added
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
