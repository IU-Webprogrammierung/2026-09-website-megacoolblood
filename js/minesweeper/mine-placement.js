const minesweeperMinePlacement = (() => {
  const guessWindowShapes = Object.freeze([
    Object.freeze({ rows: 2, columns: 1, mines: 1 }),
    Object.freeze({ rows: 1, columns: 2, mines: 1 }),
    Object.freeze({ rows: 2, columns: 2, mines: 2 })
  ]);

  function countBits(value) {
    let count = 0;

    for (let rest = value; rest > 0; rest >>= 1) {
      count += rest & 1;
    }

    return count;
  }

  function getWindowCells(top, left, shape) {
    const windowCells = [];

    for (let row = top; row < top + shape.rows; row += 1) {
      for (let column = left; column < left + shape.columns; column += 1) {
        windowCells.push({ row, column });
      }
    }

    return windowCells;
  }

  // Bit i of a layout mask stands for window cell i.
  function getWindowMineMask(board, windowCells) {
    return windowCells.reduce(
      (mask, cell, bit) => (board.isMine[cell.row * board.columns + cell.column] ? mask | (1 << bit) : mask),
      0
    );
  }

  // One mask per safe cell around the window; bit i is set when that cell touches window cell i.
  function getSafeNeighborTouchMasks(board, top, left, shape, windowCells) {
    const touchMasks = [];

    for (let row = Math.max(0, top - 1); row <= Math.min(board.rows - 1, top + shape.rows); row += 1) {
      for (
        let column = Math.max(0, left - 1);
        column <= Math.min(board.columns - 1, left + shape.columns);
        column += 1
      ) {
        const isInWindow = row >= top && row < top + shape.rows && column >= left && column < left + shape.columns;

        if (!isInWindow && !board.isMine[row * board.columns + column]) {
          touchMasks.push(
            windowCells.reduce(
              (mask, cell, bit) =>
                Math.abs(cell.row - row) <= 1 && Math.abs(cell.column - column) <= 1 ? mask | (1 << bit) : mask,
              0
            )
          );
        }
      }
    }

    return touchMasks;
  }

  // The window needs a guess when another layout with the same mine count shows the same number on every
  // cell around it. Cells outside the board and mines show no number.
  function isGuessWindow(board, top, left, shape) {
    const windowCells = getWindowCells(top, left, shape);
    const mineMask = getWindowMineMask(board, windowCells);

    if (countBits(mineMask) !== shape.mines) {
      return false;
    }

    const touchMasks = getSafeNeighborTouchMasks(board, top, left, shape, windowCells);

    for (let otherMask = 0; otherMask < 1 << windowCells.length; otherMask += 1) {
      if (
        otherMask !== mineMask &&
        countBits(otherMask) === shape.mines &&
        touchMasks.every((touchMask) => countBits(mineMask & touchMask) === countBits(otherMask & touchMask))
      ) {
        return true;
      }
    }

    return false;
  }

  function findGuessWindows(board) {
    const guessWindows = [];

    guessWindowShapes.forEach((shape) => {
      for (let top = 0; top + shape.rows <= board.rows; top += 1) {
        for (let left = 0; left + shape.columns <= board.columns; left += 1) {
          if (isGuessWindow(board, top, left, shape)) {
            guessWindows.push({ row: top, column: left, rows: shape.rows, columns: shape.columns });
          }
        }
      }
    });

    return guessWindows;
  }

  function createsGuessSituation(board, index) {
    const row = Math.floor(index / board.columns);
    const column = index % board.columns;

    return guessWindowShapes.some((shape) => {
      const lastTop = Math.min(board.rows - shape.rows, row + 1);
      const lastLeft = Math.min(board.columns - shape.columns, column + 1);

      for (let top = Math.max(0, row - shape.rows); top <= lastTop; top += 1) {
        for (let left = Math.max(0, column - shape.columns); left <= lastLeft; left += 1) {
          if (isGuessWindow(board, top, left, shape)) {
            return true;
          }
        }
      }

      return false;
    });
  }

  function getStartAreaIndexes(rows, columns, startIndex) {
    const startRow = Math.floor(startIndex / columns);
    const startColumn = startIndex % columns;
    const startArea = new Set();

    for (let row = Math.max(0, startRow - 1); row <= Math.min(rows - 1, startRow + 1); row += 1) {
      for (let column = Math.max(0, startColumn - 1); column <= Math.min(columns - 1, startColumn + 1); column += 1) {
        startArea.add(row * columns + column);
      }
    }

    return startArea;
  }

  function shuffle(values, random) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }

    return values;
  }

  // Mines are placed in random order and the start area stays free. With lessGuess, a cell that would complete a
  // guess situation is locked; locked cells only receive the mines that are left when no free cell remains.
  function placeMines({ rows, columns, mines, startIndex, lessGuess, random = Math.random }) {
    const board = { rows, columns, isMine: new Uint8Array(rows * columns) };
    const startArea = getStartAreaIndexes(rows, columns, startIndex);
    const candidates = shuffle(
      Array.from({ length: rows * columns }, (_, index) => index).filter((index) => !startArea.has(index)),
      random
    );
    const mineIndexes = [];
    const lockedIndexes = [];

    for (const index of candidates) {
      if (mineIndexes.length === mines) {
        break;
      }

      board.isMine[index] = 1;

      if (lessGuess && createsGuessSituation(board, index)) {
        board.isMine[index] = 0;
        lockedIndexes.push(index);
      } else {
        mineIndexes.push(index);
      }
    }

    // Locked cells keep the shuffled order, so taking the first ones is a random choice.
    const fallbackIndexes = lockedIndexes.slice(0, mines - mineIndexes.length);

    return {
      mineIndexes: [...mineIndexes, ...fallbackIndexes],
      fallbackMines: fallbackIndexes.length
    };
  }

  return Object.freeze({
    guessWindowShapes,
    isGuessWindow,
    findGuessWindows,
    placeMines
  });
})();
