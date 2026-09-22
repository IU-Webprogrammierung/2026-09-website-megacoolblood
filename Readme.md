# LycheeLab – Minesweeper

LycheeLab is a static website with a playable Minesweeper application.
The project was created as part of the IU Web Programming course using
semantic HTML, custom CSS, and vanilla JavaScript.

## Features

- Overview, game, settings, and high-score pages
- Three difficulty levels:
  - Beginner: 9 × 9 cells and 10 mines
  - Intermediate: 16 × 16 cells and 40 mines
  - Expert: 30 × 16 cells and 99 mines
- Random mine placement and display of adjacent mine counts
- Automatic revealing of connected empty areas
- Three input modes: Reveal, Flag, and Mark with a question mark
- Mode switching through buttons or the `A`, `F`, and `M` keyboard shortcuts
- Mouse, Space key, and arrow key controls
- Visible focus state for board cells
- Status messages for starting a game, revealing cells, winning, and losing
- Winning streak and high-score storage using `localStorage`
- High scores are stored only after a loss and contain the player name,
  winning streak, difficulty, and date
- No account, server, or tracking required

## Technical Implementation

- HTML5 with semantic elements and WAI-ARIA status regions
- CSS variables, Flexbox, CSS Grid, and media queries
- Responsive layout for smartphones, tablets, and desktop computers
- Dynamic board columns based on the selected difficulty
- Event delegation for board mouse and keyboard interactions
- Error handling for unavailable or invalid `localStorage`
- No external libraries or frameworks

## Accessibility

- `lang="de"` and unique page titles
- Visible labels for form controls
- Keyboard-operable buttons and board cells
- Arrow-key navigation within the board
- Understandable cell coordinates such as `A1`, `B6`, or `AA1`
- Visible focus outline
- Text-based status messages in addition to visual states
- Important states are not communicated through color alone


## Validation

Open tests:

- testing at 360 px, 768 px and 1280 px
- Testing with at least one screen reader
- Touch and performance testing with a 100 × 100 board

## Known Limitations

- High scores and settings are available only in the current browser.
- The high-score list currently has no filtering or delete function.
- The board is currently limited to the three predefined difficulty levels.
- The interface is currently available in German only, and the text content is not yet translatable.
