const boardElement = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const undoButton = document.querySelector('#undo-move');
const gameStatus = document.querySelector('#game-status');
const scoreElement = document.querySelector('#game-score');
const bestScoreElement = document.querySelector('#best-score');
const boardSize = 4;
const bestScoreKey = 'lycheelab-2048-best-score';
const statisticsKey = 'lycheelab-2048-statistics';
const directions = {
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up'
};
const directionLabels = {
  down: 'unten',
  left: 'links',
  right: 'rechts',
  up: 'oben'
};
let board = [];
let score = 0;
let bestScore = readBestScore();
let gameOver = false;
let hasWon = false;
let pointerStart = null;
let previousState = null;

function createEmptyBoard() {
  return Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
}

function readBestScore() {
  try {
    const storedScore = Number.parseInt(localStorage.getItem(bestScoreKey), 10);
    return Number.isNaN(storedScore) || storedScore < 0 ? 0 : storedScore;
  } catch {
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(bestScoreKey, String(bestScore));
  } catch {
  }
}

function getDefaultStatistics() {
  return {
    actions: 0,
    gamesStarted: 0,
    highestTile: 0,
    invalidMoves: 0,
    losses: 0,
    moves: 0,
    totalScore: 0,
    undos: 0,
    wins: 0
  };
}

function readStatistics() {
  try {
    const storedStatistics = JSON.parse(localStorage.getItem(statisticsKey) || '{}');
    const defaults = getDefaultStatistics();

    return Object.keys(defaults).reduce((statistics, key) => {
      const value = Number(storedStatistics[key]);
      statistics[key] = Number.isFinite(value) && value >= 0 ? value : defaults[key];
      return statistics;
    }, defaults);
  } catch {
    return getDefaultStatistics();
  }
}

function writeStatistics(statistics) {
  try {
    localStorage.setItem(statisticsKey, JSON.stringify(statistics));
  } catch {
  }
}

function recordNewGame() {
  const statistics = readStatistics();
  statistics.gamesStarted += 1;
  writeStatistics(statistics);
}

function recordMove(isValid, gainedScore, result) {
  const statistics = readStatistics();
  statistics.actions += 1;
  if (isValid) {
    statistics.moves += 1;
  } else {
    statistics.invalidMoves += 1;
  }
  statistics.totalScore += gainedScore;
  statistics.highestTile = Math.max(statistics.highestTile, ...board.flat());
  statistics.wins += result === 'win' ? 1 : 0;
  statistics.losses += result === 'loss' ? 1 : 0;
  writeStatistics(statistics);
}

function recordUndo() {
  const statistics = readStatistics();
  statistics.actions += 1;
  statistics.undos += 1;
  writeStatistics(statistics);
}

function getEmptyPositions() {
  const positions = [];

  board.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value === 0) {
        positions.push({ columnIndex, rowIndex });
      }
    });
  });

  return positions;
}

function addRandomTile() {
  const emptyPositions = getEmptyPositions();

  if (emptyPositions.length === 0) {
    return;
  }

  const position = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
  board[position.rowIndex][position.columnIndex] = Math.random() < 0.9 ? 2 : 4;
}

function slideLine(line) {
  const compactLine = line.filter((value) => value !== 0);
  const mergedLine = [];
  let gainedScore = 0;

  for (let index = 0; index < compactLine.length; index += 1) {
    if (compactLine[index] === compactLine[index + 1]) {
      const mergedValue = compactLine[index] * 2;
      mergedLine.push(mergedValue);
      gainedScore += mergedValue;
      index += 1;
    } else {
      mergedLine.push(compactLine[index]);
    }
  }

  while (mergedLine.length < boardSize) {
    mergedLine.push(0);
  }

  return { gainedScore, line: mergedLine };
}

function getLine(direction, index) {
  if (direction === 'left' || direction === 'right') {
    const line = board[index].slice();
    return direction === 'right' ? line.reverse() : line;
  }

  const line = board.map((row) => row[index]);
  return direction === 'down' ? line.reverse() : line;
}

function setLine(direction, index, line) {
  const outputLine = direction === 'left' || direction === 'up' ? line : line.reverse();

  if (direction === 'left' || direction === 'right') {
    board[index] = outputLine;
    return;
  }

  outputLine.forEach((value, rowIndex) => {
    board[rowIndex][index] = value;
  });
}

function hasBoardChanged(previousBoard) {
  return board.some((row, rowIndex) => row.some((value, columnIndex) => value !== previousBoard[rowIndex][columnIndex]));
}

function canMove() {
  if (getEmptyPositions().length > 0) {
    return true;
  }

  for (let rowIndex = 0; rowIndex < boardSize; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < boardSize; columnIndex += 1) {
      const value = board[rowIndex][columnIndex];
      const rightValue = board[rowIndex][columnIndex + 1];
      const bottomValue = board[rowIndex + 1]?.[columnIndex];

      if (value === rightValue || value === bottomValue) {
        return true;
      }
    }
  }

  return false;
}

function updateScore() {
  scoreElement.textContent = score;
  bestScoreElement.textContent = bestScore;
}

function updateUndoButton() {
  undoButton.disabled = previousState === null;
}

function getTileLabel(value) {
  return value === 0 ? 'Leeres Feld' : `Stein mit ${value}`;
}

function renderBoard() {
  boardElement.replaceChildren();

  board.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const tile = document.createElement('div');
      tile.className = `tile tile-${value}`;
      tile.setAttribute('role', 'gridcell');
      tile.setAttribute('aria-rowindex', rowIndex + 1);
      tile.setAttribute('aria-colindex', columnIndex + 1);
      tile.setAttribute('aria-label', getTileLabel(value));
      tile.textContent = value === 0 ? '' : value;
      boardElement.append(tile);
    });
  });
}

function setGameStatus(message) {
  gameStatus.textContent = message;
}

function move(direction) {
  if (gameOver) {
    return;
  }

  const previousBoard = board.map((row) => row.slice());
  const stateBeforeMove = {
    board: previousBoard,
    hasWon,
    gameOver,
    score
  };
  let gainedScore = 0;

  for (let index = 0; index < boardSize; index += 1) {
    const result = slideLine(getLine(direction, index));
    gainedScore += result.gainedScore;
    setLine(direction, index, result.line);
  }

  if (!hasBoardChanged(previousBoard)) {
    setGameStatus('Dieser Zug ist nicht möglich.');
    recordMove(false, 0, null);
    return;
  }

  previousState = stateBeforeMove;
  addRandomTile();
  score += gainedScore;
  if (score > bestScore) {
    bestScore = score;
    saveBestScore();
  }

  let result = null;
  if (!hasWon && board.some((row) => row.includes(2048))) {
    hasWon = true;
    result = 'win';
    setGameStatus('2048 erreicht. Du kannst weiterspielen.');
  } else if (!canMove()) {
    gameOver = true;
    result = 'loss';
    setGameStatus('Kein Zug mehr möglich. Starte ein neues Spiel.');
  } else {
    setGameStatus(`Steine nach ${directionLabels[direction]} bewegt.`);
  }

  recordMove(true, gainedScore, result);
  updateScore();
  renderBoard();
  updateUndoButton();
}

function startGame() {
  board = createEmptyBoard();
  score = 0;
  gameOver = false;
  hasWon = false;
  previousState = null;
  addRandomTile();
  addRandomTile();
  updateScore();
  renderBoard();
  updateUndoButton();
  setGameStatus('Neues Spiel gestartet.');
  recordNewGame();
  boardElement.focus();
}

function undoMove() {
  if (!previousState) {
    return;
  }

  board = previousState.board;
  score = previousState.score;
  gameOver = previousState.gameOver;
  hasWon = previousState.hasWon;
  previousState = null;
  updateScore();
  renderBoard();
  updateUndoButton();
  recordUndo();
  setGameStatus('Der letzte Zug wurde zurückgenommen.');
  boardElement.focus();
}

function handleKeyDown(event) {
  const direction = directions[event.key];

  if (!direction) {
    return;
  }

  event.preventDefault();
  move(direction);
}

function handleGlobalKeyDown(event) {
  if (event.target.matches('input, textarea, select')) {
    return;
  }

  const isUndoShortcut = event.key === 'Backspace'
    || (event.ctrlKey && event.key.toLowerCase() === 'z');

  if (!isUndoShortcut) {
    return;
  }

  event.preventDefault();
  undoMove();
}

function handlePointerDown(event) {
  if (!event.isPrimary) {
    return;
  }

  pointerStart = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY
  };
  boardElement.setPointerCapture(event.pointerId);
}

function handlePointerUp(event) {
  if (!pointerStart || event.pointerId !== pointerStart.id) {
    return;
  }

  const deltaX = event.clientX - pointerStart.x;
  const deltaY = event.clientY - pointerStart.y;
  pointerStart = null;
  boardElement.releasePointerCapture(event.pointerId);

  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) {
    return;
  }

  const direction = Math.abs(deltaX) > Math.abs(deltaY)
    ? (deltaX > 0 ? 'right' : 'left')
    : (deltaY > 0 ? 'down' : 'up');
  move(direction);
}

newGameButton.addEventListener('click', startGame);
undoButton.addEventListener('click', undoMove);
document.addEventListener('keydown', handleGlobalKeyDown);
boardElement.addEventListener('keydown', handleKeyDown);
boardElement.addEventListener('pointerdown', handlePointerDown);
boardElement.addEventListener('pointerup', handlePointerUp);
boardElement.addEventListener('pointercancel', () => {
  pointerStart = null;
});
boardElement.addEventListener('lostpointercapture', () => {
  pointerStart = null;
});
bestScoreElement.textContent = bestScore;
startGame();
