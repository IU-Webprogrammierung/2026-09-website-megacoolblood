# LycheeLab

LycheeLab is a static website with progressive web application features.
The project was created as part of the IU Web Programming course using
semantic HTML, custom CSS, and vanilla JavaScript.

## Features

### Minesweeper

- Overview, game, settings, and statistics pages
- Three difficulty levels:
  - Beginner: 9 × 9 cells and 10 mines
  - Intermediate: 16 × 16 cells and 40 mines
  - Expert: 30 × 16 cells and 99 mines
- Random mine placement and display of adjacent mine counts
- Automatic revealing of connected empty areas
- Three input modes: Reveal, Flag, and Mark with a question mark
- Mode switching through buttons or the `A`, `F`, and `M` keyboard shortcuts
- Mouse Left and Right clicks, Space key, and arrow key controls
- Visible focus state for board cells
- Status messages for starting a game, revealing cells, winning, and losing
- Winning streak and game statistics stored using `localStorage`
- Statistics are grouped by difficulty and contain cleared mines, success rate,
  current streak, and best streak
- No account, server, or tracking required