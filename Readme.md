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
- Three input modes: Reveal, Flag, and Mark with a question mark
- Mode switching through buttons or the `A`, `F`, and `M` keyboard shortcuts
- Mouse Left and Right clicks, Space key, and arrow key controls
- The first move of a game always reveals a cell, regardless of the selected
  mode or mouse button
- The board supports mouse-wheel zoom, mouse dragging, touch dragging, and
  pinch zoom; separate controls provide zoom in, zoom out, and reset
- The game starts in immersive mode below 768 px; a button toggles the global
  website header and footer. On wider screens, the site chrome is visible by
  default and can be hidden with the same control
- Pan/zoom operates on the board viewport; keyboard cell navigation remains
  independent of the visual zoom level
- Visible focus state for board cells
- Status messages for starting a game, revealing cells, winning, and losing
- Winning streak and game statistics stored using `localStorage`
- Statistics are grouped by difficulty and contain cleared mines, success rate,
  current streak, and best streak
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
