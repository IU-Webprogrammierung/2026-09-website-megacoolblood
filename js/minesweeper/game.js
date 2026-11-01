const board = document.querySelector('#game-board');
const boardViewport = document.querySelector('.game-board-viewport');
const boardWorld = document.querySelector('.game-board-world');
const zoomLevelOutput = document.querySelector('#zoom-level');
const zoomInButton = document.querySelector('#zoom-in');
const zoomOutButton = document.querySelector('#zoom-out');
const resetViewButton = document.querySelector('#reset-view');
const newGameButton = document.querySelector('#new-game');
const newGameIcon = newGameButton.querySelector('.control-icon');
const newGameLabel = newGameButton.querySelector('.game-header-label');
const gameChromeToggle = document.querySelector('#game-chrome-toggle');
const gameChromeToggleIcon = gameChromeToggle.querySelector('.control-icon');
const gameChromeToggleLabel = gameChromeToggle.querySelector('.game-header-label');
const gameStatus = document.querySelector('#game-status');
const mineCount = document.querySelector('#mine-count');
const extraLivesElement = document.querySelector('#extra-lives');
const seriesRevealedFieldsElement = document.querySelector('#series-revealed-fields');
const seriesResetDialog = document.querySelector('#series-reset-dialog');
const winDialog = document.querySelector('#win-dialog');
const winDialogMessage = document.querySelector('#win-dialog-message');
const modeButtons = document.querySelectorAll('.mode-button');
const checkModeButton = document.querySelector('[data-mode="check"]');
const checkChargesElement = document.querySelector('#check-charges');
const mobileLayout = window.matchMedia('(max-width: 767px)');
let hasUserSelectedImmersiveMode = false;

const difficultyConfig = minesweeperDifficulty.readStoredDifficulty();
const difficulty = minesweeperDifficulty.getDifficultyKey(difficultyConfig);
const boardRows = difficultyConfig.rows;
const boardColumns = difficultyConfig.columns;
const mineTotal = difficultyConfig.mines;
const rewardThreshold = minesweeperDifficulty.getRewardThreshold(difficultyConfig);
const maxExtraLives = minesweeperRunState.maxExtraLives;
const iconPaths = {
  fullscreen: '../../assets/icons/fullscreen.svg',
  fullscreenExit: '../../assets/icons/fullscreen-exit.svg',
  menu: '../../assets/icons/menu.svg',
  nextRound: '../../assets/icons/next-round.svg',
  reload: '../../assets/icons/reload.svg'
};

// On narrow screens the hidden site navigation is what users look for, so the toggle offers the menu.
function updateChromeToggle() {
  const isImmersive = document.body.classList.contains('is-immersive');
  const state = !isImmersive
    ? { icon: iconPaths.fullscreen, label: 'Vollbild' }
    : mobileLayout.matches
      ? { icon: iconPaths.menu, label: 'Menü anzeigen' }
      : { icon: iconPaths.fullscreenExit, label: 'Vollbild beenden' };

  gameChromeToggle.setAttribute('aria-expanded', String(!isImmersive));
  gameChromeToggleIcon.setAttribute('src', state.icon);
  gameChromeToggleLabel.textContent = state.label;
}

function setImmersiveMode(isImmersive) {
  document.body.classList.toggle('is-immersive', isImmersive);
  updateChromeToggle();
}

setImmersiveMode(mobileLayout.matches);
mobileLayout.addEventListener('change', (event) => {
  if (hasUserSelectedImmersiveMode) {
    updateChromeToggle();
  } else {
    setImmersiveMode(event.matches);
  }
});
gameChromeToggle.addEventListener('click', () => {
  const isImmersive = document.body.classList.contains('is-immersive');
  const menuToggle = document.querySelector('#site-header [data-menu-toggle]');

  hasUserSelectedImmersiveMode = true;
  setImmersiveMode(!isImmersive);

  // "Menü anzeigen" opens the navigation directly instead of only revealing the site header's menu button.
  if (isImmersive && mobileLayout.matches && menuToggle?.getAttribute('aria-expanded') !== 'true') {
    menuToggle?.click();
  }
});
let mineCurrentCount = mineTotal;
let series = minesweeperRunState.createDefaultSeries();
let cells = [];
let gameOver = false;
let newGame = true;
let elapsedMs = 0;
let timerStartedAt = null;
let activeMode = 'reveal';
let activeCell = null;
let boardPanzoom = null;
let boardPointerGesture = null;
let suppressedPanClick = null;
let zoomAnnouncementTimeout = null;
let zoomAnnouncementPending = false;
let lastAnnouncedZoomLevel = null;
let boardEdgeHintFrame = null;
const boardEdgeTolerance = 1;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const activeBoardPointers = new Set();
const boardPanThreshold = 5;
const panClickSuppressionMs = 500;
const panClickSuppressionRadius = 16;

function getElapsedMs() {
  return timerStartedAt === null ? elapsedMs : elapsedMs + performance.now() - timerStartedAt;
}

// The timer runs only while a started, unfinished round is visible.
function resumeGameTimer() {
  if (timerStartedAt === null && !newGame && !gameOver && document.visibilityState === 'visible') {
    timerStartedAt = performance.now();
  }
}

function pauseGameTimer() {
  if (timerStartedAt !== null) {
    elapsedMs = getElapsedMs();
    timerStartedAt = null;
  }
}

function handlePageHidden() {
  if (timerStartedAt !== null) {
    pauseGameTimer();
    saveGameState();
  }
}

function countFlagResults() {
  const flaggedCells = cells.flat().filter((cell) => cell.isFlagged);
  const correctFlags = flaggedCells.filter((cell) => cell.isMine).length;

  return { correctFlags, wrongFlags: flaggedCells.length - correctFlags };
}

function recordGameResult(won) {
  const statistics = minesweeperRunState.readStatistics();

  if (!statistics) {
    return;
  }

  const difficultyStatistics = minesweeperRunState.readDifficultyStatistics(statistics, difficulty);

  minesweeperRunState.updateBestSeriesRevealedFields(difficultyStatistics, series.revealedFields);
  difficultyStatistics.gamesPlayed += 1;
  if (won) {
    difficultyStatistics.wins += 1;
    difficultyStatistics.minesCleared += mineTotal;
    difficultyStatistics.currentStreak += 1;
    difficultyStatistics.bestStreak = Math.max(difficultyStatistics.bestStreak, difficultyStatistics.currentStreak);
    minesweeperRunState.addWinTime(difficultyStatistics, Math.round(getElapsedMs()));
  } else {
    difficultyStatistics.currentStreak = 0;
    minesweeperRunState.addLossFlags(difficultyStatistics, countFlagResults());
  }

  statistics[difficulty] = difficultyStatistics;
  minesweeperRunState.writeStatistics(statistics);
}

function addRevealedSafeFields(count) {
  series.revealedFields += count;
  series.revealProgress += count;

  let extraLivesAwarded = 0;
  let checkChargesAwarded = 0;

  while (series.revealProgress >= rewardThreshold) {
    series.revealProgress -= rewardThreshold;
    if (series.extraLives < maxExtraLives) {
      series.extraLives += 1;
      extraLivesAwarded += 1;
    } else {
      series.checkCharges += 1;
      checkChargesAwarded += 1;
    }
  }

  const announcements = [];
  if (extraLivesAwarded > 0) {
    announcements.push(
      `Belohnung: ${extraLivesAwarded} Extraleben (${series.extraLives}/${maxExtraLives}).`
    );
  }
  if (checkChargesAwarded > 0) {
    const checkLabel = checkChargesAwarded === 1 ? 'Prüfung' : 'Prüfungen';
    announcements.push(
      `Belohnung: ${checkChargesAwarded} ${checkLabel} (${series.checkCharges.toLocaleString('de-DE')} verbleibend).`
    );
  }

  return announcements;
}

function updateSeriesDisplay() {
  seriesRevealedFieldsElement.textContent = series.revealedFields.toLocaleString('de-DE');
}

function updateExtraLivesDisplay() {
  extraLivesElement.querySelector('[aria-hidden="true"]').textContent =
    `${series.extraLives}/${maxExtraLives}`;
  extraLivesElement.querySelector('.visually-hidden').textContent =
    `${series.extraLives} von ${maxExtraLives}`;
}

function updateCheckChargesDisplay() {
  const checkCharges = series.checkCharges;

  checkChargesElement.textContent = checkCharges.toLocaleString('de-DE');
  checkModeButton.setAttribute('aria-label', `Prüfen (P), ${checkCharges} verbleibend`);
  checkModeButton.setAttribute('aria-disabled', String(checkCharges === 0));
}

function isTriggeredMine(cell) {
  return cell.isRevealed && cell.isMine;
}

function checkForWin() {
  return cells.every((row) => row.every((cell) => cell.isMine || cell.isRevealed));
}

function canStartNextRound() {
  return gameOver && checkForWin();
}

function updateNewGameButton() {
  const isNextRound = canStartNextRound();
  const iconPath = isNextRound ? iconPaths.nextRound : iconPaths.reload;

  if (newGameIcon.getAttribute('src') !== iconPath) {
    newGameIcon.setAttribute('src', iconPath);
  }
  newGameLabel.textContent = isNextRound ? 'Nächste Runde (R)' : 'Neustart (R)';
}

function saveGameState() {
  const gameState = {
    difficulty,
    gameOver,
    newGame,
    mineCurrentCount,
    elapsedMs: Math.round(getElapsedMs()),
    series,
    activeCell: activeCell ? { row: activeCell.row, column: activeCell.column } : null,
    cells: minesweeperRunState.encodeCells(cells)
  };

  if (!minesweeperRunState.writeSavedGame(difficulty, gameState)) {
    gameStatus.textContent = 'Spielstand konnte nicht gespeichert werden.';
  }
}

function restoreCellPresentation(cell) {
  cell.element.classList.toggle('is-flagged', cell.isFlagged);
  cell.element.classList.toggle('is-marked', cell.isMarked);
  cell.element.classList.toggle('is-revealed', cell.isRevealed);
  cell.element.classList.toggle('is-wrong-flag', cell.isWrongFlag);

  if (isTriggeredMine(cell)) {
    cell.element.classList.add('is-mine');
    cell.element.setAttribute('aria-label', `Ausgelöste Mine auf Feld ${cell.coordinate}`);
  } else if (cell.isRevealed) {
    const adjacentMines = countAdjacentMines(cell);
    setAdjacentMineCount(cell, adjacentMines);
  } else if (cell.isFlagged) {
    cell.element.setAttribute(
      'aria-label',
      cell.isWrongFlag
        ? `Falsch gesetzte Flagge auf Feld ${cell.coordinate}`
        : `Als Flagge markiertes Feld ${cell.coordinate}`
    );
  } else if (cell.isMarked) {
    cell.element.setAttribute('aria-label', `Als Fragezeichen markiertes Feld ${cell.coordinate}`);
  } else {
    cell.element.textContent = '';
    cell.element.setAttribute('aria-label', `Unaufgedecktes Feld ${cell.coordinate}`);
  }
}

function getColumnLabel(columnIndex) {
  let label = '';
  let remainingIndex = columnIndex;

  while (remainingIndex >= 0) {
    label = String.fromCharCode((remainingIndex % 26) + 65) + label;
    remainingIndex = Math.floor(remainingIndex / 26) - 1;
  }

  return label;
}

function getNeighbors(row, column) {
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;

      if (
        (rowOffset !== 0 || columnOffset !== 0) &&
        neighborRow >= 0 &&
        neighborRow < boardRows &&
        neighborColumn >= 0 &&
        neighborColumn < boardColumns
      ) {
        neighbors.push(cells[neighborRow][neighborColumn]);
      }
    }
  }

  return neighbors;
}

function placeMines(firstCell) {
  const mineIndexes = new Set();
  const noMineIndexes = new Set([firstCell.row * boardColumns + firstCell.column]);

  getNeighbors(firstCell.row, firstCell.column).forEach((neighbor) => {
    noMineIndexes.add(neighbor.row * boardColumns + neighbor.column);
  });

  while (mineIndexes.size < mineTotal) {
    let index = Math.floor(Math.random() * boardRows * boardColumns);
    if (!noMineIndexes.has(index)) {
      mineIndexes.add(index);
    }
  }
  let row;
  let column;

  mineIndexes.forEach((index) => {
    column = index % boardColumns;
    row = (index - column) / boardColumns;
    cells[row][column].isMine = true;
  });
}

function countFlags(cells) {
  return cells.filter((cell) => cell.isFlagged).length;
}

function countMines(cells) {
  return cells.filter((cell) => cell.isMine).length;
}

function countAdjacentMines(cell) {
  return countMines(getNeighbors(cell.row, cell.column));
}

function setAdjacentMineCount(cell, adjacentMines) {
  cell.element.textContent = adjacentMines > 0 ? adjacentMines : '';
  if (adjacentMines > 0) {
    cell.element.dataset.adjacentMines = adjacentMines;
  } else {
    delete cell.element.dataset.adjacentMines;
  }
  cell.element.setAttribute(
    'aria-label',
    `${cell.coordinate}, ${adjacentMines} angrenzende Minen`
  );
}

function registerHit(message) {
  if (series.extraLives === 0) {
    gameOver = true;
    pauseGameTimer();
    recordGameResult(false);
    gameStatus.textContent = `${message} Keine Extraleben mehr. Spiel verloren.`;
    gameOverRevealMines();
    return;
  }

  series.extraLives -= 1;
  updateExtraLivesDisplay();
  gameStatus.textContent = `${message} Noch ${series.extraLives} von ${maxExtraLives} Extraleben.`;
}

function revealCell(cell) {
  if (gameOver || cell.isRevealed || cell.isFlagged || cell.isMarked) {
    return [];
  }

  if (cell.isMine) {
    cell.isRevealed = true;
    cell.element.classList.add('is-revealed', 'is-mine');
    cell.element.setAttribute('aria-label', `Ausgelöste Mine auf Feld ${cell.coordinate}`);
    mineCurrentCount -= 1;
    mineCount.textContent = mineCurrentCount;
    registerHit(`Mine auf Feld ${cell.coordinate} ausgelöst.`);
    return [];
  }

  const cellsToReveal = [cell];
  let currentIndex = 0;
  let revealedCount = 0;

  while (currentIndex < cellsToReveal.length) {
    const currentCell = cellsToReveal[currentIndex];
    currentIndex += 1;

    if (currentCell.isRevealed || currentCell.isFlagged || currentCell.isMarked) {
      continue;
    }

    currentCell.isRevealed = true;
    revealedCount += 1;
    currentCell.element.classList.add('is-revealed');
    const adjacentMines = countAdjacentMines(currentCell);
    setAdjacentMineCount(currentCell, adjacentMines);

    if (adjacentMines === 0) {
      getNeighbors(currentCell.row, currentCell.column).forEach((neighbor) => {
        if (!neighbor.isMine && !neighbor.isRevealed && !neighbor.isFlagged && !neighbor.isMarked) {
          cellsToReveal.push(neighbor);
        }
      });
    }
  }

  const rewardAnnouncements = addRevealedSafeFields(revealedCount);

  if (checkForWin()) {
    gameOver = true;
    pauseGameTimer();
    recordGameResult(true);
    flagRemainingMines();
    gameOverRevealMines();
    gameStatus.textContent = `Gewonnen in ${minesweeperRunState.describeDuration(elapsedMs)}. Alle sicheren Felder sind aufgedeckt. Mit „Nächste Runde“ geht es weiter.`;
    return rewardAnnouncements;
  }

  gameStatus.textContent = `Feld ${cell.coordinate} aufgedeckt.`;
  return rewardAnnouncements;
}

function toggleFlag(cell) {
  if (gameOver || cell.isRevealed || cell.isMarked) {
    return;
  }

  cell.isFlagged = !cell.isFlagged;
  cell.isWrongFlag = false;
  cell.element.classList.toggle('is-flagged', cell.isFlagged);
  cell.element.classList.remove('is-wrong-flag');
  cell.element.setAttribute(
    'aria-label',
    `${cell.isFlagged ? 'Markiertes' : 'Unaufgedecktes'} Feld ${cell.coordinate}`
  );
  mineCurrentCount = mineCurrentCount + (cell.isFlagged ? -1 : 1);
  mineCount.textContent = mineCurrentCount;
  gameStatus.textContent = cell.isFlagged
    ? `Feld ${cell.coordinate} als vermutete Mine markiert.`
    : `Markierung von Feld ${cell.coordinate} entfernt.`;
}

function toggleMark(cell) {
  if (gameOver || cell.isRevealed || cell.isFlagged) {
    return;
  }

  cell.isMarked = !cell.isMarked;
  cell.element.classList.toggle('is-marked', cell.isMarked);
  cell.element.setAttribute(
    'aria-label',
    `${cell.isMarked ? 'Markiertes' : 'Unaufgedecktes'} Feld ${cell.coordinate}`
  );
  gameStatus.textContent = cell.isMarked
    ? `Feld ${cell.coordinate} mit einem Fragezeichen markiert.`
    : `Markierung von Feld ${cell.coordinate} entfernt.`;
}

function setMode(mode) {
  if (mode === 'check' && series.checkCharges === 0) {
    gameStatus.textContent = 'Keine Prüfungen übrig.';
    return false;
  }

  activeMode = mode;
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === activeMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  return true;
}

// Only explicit choices are stored, so automatic fallbacks keep the preferred mode.
function selectMode(mode) {
  if (setMode(mode)) {
    minesweeperRunState.writeActiveMode(mode);
  }
}

function restoreActiveMode() {
  const storedMode = minesweeperRunState.readActiveMode();
  const isKnownMode = [...modeButtons].some((button) => button.dataset.mode === storedMode);
  const isAvailable = storedMode !== 'check' || series.checkCharges > 0;

  setMode(isKnownMode && isAvailable ? storedMode : 'reveal');
}

function useCheckMode(cell) {
  if (gameOver) {
    return [];
  }

  if (cell.isFlagged) {
    gameStatus.textContent = `Entferne zuerst die Flagge auf Feld ${cell.coordinate}.`;
    return [];
  }

  if (series.checkCharges === 0) {
    gameStatus.textContent = 'Keine Prüfungen übrig.';
    setMode('reveal');
    return [];
  }

  series.checkCharges -= 1;
  updateCheckChargesDisplay();

  if (cell.isMarked) {
    cell.isMarked = false;
    cell.element.classList.remove('is-marked');
    cell.element.setAttribute('aria-label', `Unaufgedecktes Feld ${cell.coordinate}`);
  }

  if (cell.isMine) {
    toggleFlag(cell);
    gameStatus.textContent = `Prüfung: Auf Feld ${cell.coordinate} liegt eine Mine. Flagge gesetzt.`;
    if (series.checkCharges === 0) {
      setMode('reveal');
    }
    return [];
  }

  const rewardAnnouncements = revealCell(cell);
  if (!gameOver) {
    gameStatus.textContent = `Prüfung: Feld ${cell.coordinate} ist sicher und wurde aufgedeckt.`;
  }
  if (series.checkCharges === 0) {
    setMode('reveal');
  }
  return rewardAnnouncements;
}

function activeNumber(cell) {
  const neighbors = getNeighbors(cell.row, cell.column);
  const flaggedAndTriggeredMines = countFlags(neighbors)
    + neighbors.filter(isTriggeredMine).length;
  const adjacentMines = countMines(neighbors);

  if (flaggedAndTriggeredMines !== adjacentMines) {
    return [];
  }

  const cellsToReveal = neighbors.filter(
    (neighbor) => !neighbor.isRevealed && !neighbor.isFlagged && !neighbor.isMarked
  );
  const mineToReveal = cellsToReveal.find((neighbor) => neighbor.isMine);

  if (mineToReveal) {
    neighbors
      .filter((neighbor) => neighbor.isFlagged && !neighbor.isMine)
      .forEach((neighbor) => {
        neighbor.isWrongFlag = true;
        neighbor.element.classList.add('is-wrong-flag');
        neighbor.element.setAttribute(
          'aria-label',
          `Falsch gesetzte Flagge auf Feld ${neighbor.coordinate}`
        );
      });
    registerHit(`Falsche Flaggen um Feld ${cell.coordinate}.`);
    return [];
  }

  return cellsToReveal.flatMap(revealCell);
}

function useActiveMode(cell, mode = activeMode) {
  const wasGameOver = gameOver;
  let rewardAnnouncements = [];

  if (isTriggeredMine(cell)) {
    gameStatus.textContent = `Auf Feld ${cell.coordinate} liegt eine ausgelöste Mine.`;
  } else {
    if (newGame) {
      // The first move always reveals because mines are placed around the starting cell.
      mode = 'reveal';
      placeMines(cell);
      newGame = false;
      resumeGameTimer();
    }

    if (cell.isRevealed) {
      rewardAnnouncements = activeNumber(cell);
    } else if (mode === 'flag') {
      toggleFlag(cell);
    } else if (mode === 'mark') {
      toggleMark(cell);
    } else if (mode === 'check') {
      rewardAnnouncements = useCheckMode(cell);
    } else {
      rewardAnnouncements = revealCell(cell);
    }
  }

  if (rewardAnnouncements.length > 0) {
    gameStatus.textContent = `${gameStatus.textContent} ${rewardAnnouncements.join(' ')}`;
  }

  updateCheckChargesDisplay();
  updateExtraLivesDisplay();
  updateSeriesDisplay();
  updateNewGameButton();
  saveGameState();

  // Only a win in this move opens the dialog, so reloading a won game stays quiet.
  if (!wasGameOver && canStartNextRound()) {
    showWinDialog();
  }
}

function showWinDialog() {
  if (typeof winDialog?.showModal !== 'function' || winDialog.open) {
    return;
  }

  winDialogMessage.textContent = `Großartig gespielt! Du hast alle sicheren Felder in ${minesweeperRunState.describeDuration(elapsedMs)} aufgedeckt. Dein Score steht jetzt bei ${series.revealedFields.toLocaleString('de-DE')}.`;
  winDialog.returnValue = '';
  winDialog.showModal();
}

// Escape closes the dialog without a value and behaves like "Spielfeld anschauen".
function handleWinDialogClose() {
  newGameButton.focus();

  if (winDialog.returnValue === 'next') {
    startNewGame();
  }
}

function handleCellClick(event) {
  const cellElement = event.target.closest('.game-cell');
  if (!cellElement) {
    return;
  }
  const cell = cells[cellElement.getAttribute('row')][cellElement.getAttribute('column')];

  if (cell) {
    setActiveCell(cell);
    useActiveMode(cell);
  }
}

function handleCellContextMenu(event) {
  event.preventDefault();

  const cellElement = event.target.closest('.game-cell');
  if (!cellElement) {
    return;
  }
  const cell = cells[cellElement.getAttribute('row')][cellElement.getAttribute('column')];

  if (!cell) {
    return;
  }

  setActiveCell(cell);

  if (activeMode === 'check' && !newGame) {
    toggleMark(cell);
    updateCheckChargesDisplay();
    updateExtraLivesDisplay();
    updateSeriesDisplay();
    updateNewGameButton();
    saveGameState();
    return;
  }

  const contextMode = activeMode === 'reveal' ? 'flag' : 'reveal';

  if (newGame || activeMode !== 'mark') {
    useActiveMode(cell, contextMode);
  }
}

function handleBoardPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }

  activeBoardPointers.add(event.pointerId);

  if (!boardPointerGesture) {
    boardPointerGesture = {
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
  } else {
    boardPointerGesture.moved = true;
  }
}

function handleBoardPointerMove(event) {
  if (!boardPointerGesture || !activeBoardPointers.has(event.pointerId)) {
    return;
  }

  const distance = Math.hypot(
    event.clientX - boardPointerGesture.startX,
    event.clientY - boardPointerGesture.startY
  );

  if (!boardPointerGesture.moved && distance <= boardPanThreshold) {
    event.stopImmediatePropagation();
    return;
  }

  boardPointerGesture.moved = true;
}

function handleBoardPointerEnd(event) {
  if (!boardPointerGesture || !activeBoardPointers.has(event.pointerId)) {
    return;
  }

  activeBoardPointers.delete(event.pointerId);

  if (event.type === 'pointercancel') {
    activeBoardPointers.clear();
    boardPointerGesture = null;
    return;
  }

  if (activeBoardPointers.size > 0) {
    return;
  }

  if (boardPointerGesture.moved) {
    suppressedPanClick = {
      expiresAt: performance.now() + panClickSuppressionMs,
      x: event.clientX,
      y: event.clientY
    };
  }

  boardPointerGesture = null;
}

function preventClickAfterPan(event) {
  if (!event.detail || !suppressedPanClick) {
    return;
  }

  if (performance.now() > suppressedPanClick.expiresAt) {
    suppressedPanClick = null;
    return;
  }

  const cellElement = event.target.closest('.game-cell');
  const releaseDistance = Math.hypot(
    event.clientX - suppressedPanClick.x,
    event.clientY - suppressedPanClick.y
  );

  if (cellElement && releaseDistance <= panClickSuppressionRadius) {
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressedPanClick = null;
  }
}

function updateZoomLevelText() {
  if (!boardPanzoom || !zoomLevelOutput) {
    return;
  }

  const zoomLevel = `${Math.round(boardPanzoom.getScale() * 100)}%`;
  if (zoomLevel === lastAnnouncedZoomLevel) {
    return;
  }

  lastAnnouncedZoomLevel = zoomLevel;
  zoomLevelOutput.textContent = zoomLevel;
}

function scheduleZoomLevelAnnouncement() {
  window.clearTimeout(zoomAnnouncementTimeout);
  zoomAnnouncementPending = true;
  zoomAnnouncementTimeout = window.setTimeout(announceZoomLevel, 700);
}

function announceZoomLevel() {
  window.clearTimeout(zoomAnnouncementTimeout);
  if (!zoomAnnouncementPending) {
    return;
  }

  zoomAnnouncementPending = false;
  updateZoomLevelText();
}

function finishZoomLevelAnnouncement() {
  if (zoomAnnouncementPending) {
    announceZoomLevel();
  }
}

function updateBoardEdgeHints() {
  boardEdgeHintFrame = null;
  const viewportRect = boardViewport.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();

  boardViewport.classList.toggle('has-more-left', boardRect.left < viewportRect.left - boardEdgeTolerance);
  boardViewport.classList.toggle('has-more-right', boardRect.right > viewportRect.right + boardEdgeTolerance);
  boardViewport.classList.toggle('has-more-top', boardRect.top < viewportRect.top - boardEdgeTolerance);
  boardViewport.classList.toggle('has-more-bottom', boardRect.bottom > viewportRect.bottom + boardEdgeTolerance);
}

function scheduleBoardEdgeHints() {
  if (boardEdgeHintFrame === null) {
    boardEdgeHintFrame = window.requestAnimationFrame(updateBoardEdgeHints);
  }
}

function isFrontierCell(cell) {
  return !cell.isRevealed && !cell.isFlagged && !cell.isMarked
    && getNeighbors(cell.row, cell.column).some((neighbor) => neighbor.isRevealed && !neighbor.isMine);
}

function findFrontierCell(reference) {
  let closestCell = null;
  let closestDistance = Infinity;

  cells.forEach((row) => row.forEach((cell) => {
    const distance = (cell.row - reference.row) ** 2 + (cell.column - reference.column) ** 2;

    if (distance < closestDistance && isFrontierCell(cell)) {
      closestCell = cell;
      closestDistance = distance;
    }
  }));

  return closestCell;
}

// Layout offsets ignore the Panzoom transform, so the target position is independent of the current view.
function getLayoutOffset(element) {
  let left = 0;
  let top = 0;

  for (let current = element; current; current = current.offsetParent) {
    left += current.offsetLeft;
    top += current.offsetTop;
  }

  return { left, top };
}

function getWorkAreaTarget() {
  return gameOver || newGame ? null : findFrontierCell(activeCell ?? cells[0][0]);
}

// Pan values at 100 % that center the cell, limited like Panzoom's "outside" containment.
function getCenteringPan(cell) {
  const viewportOffset = getLayoutOffset(boardViewport);
  const cellOffset = getLayoutOffset(cell.element);
  const worldOffset = getLayoutOffset(boardWorld);
  const worldLeft = worldOffset.left - viewportOffset.left;
  const worldTop = worldOffset.top - viewportOffset.top;
  const scrollLeft = cellOffset.left - viewportOffset.left + cell.element.offsetWidth / 2 - boardViewport.clientWidth / 2;
  const scrollTop = cellOffset.top - viewportOffset.top + cell.element.offsetHeight / 2 - boardViewport.clientHeight / 2;
  const minX = boardViewport.clientWidth - worldLeft - boardWorld.offsetWidth;
  const minY = boardViewport.clientHeight - worldTop - boardWorld.offsetHeight;

  return {
    scrollLeft,
    scrollTop,
    x: Math.min(Math.max(-scrollLeft, minX), -worldLeft),
    y: Math.min(Math.max(-scrollTop, minY), -worldTop)
  };
}

function centerViewOnWorkArea() {
  if (!boardPanzoom) {
    return;
  }

  const animate = !reducedMotion.matches;
  const target = getWorkAreaTarget();

  if (!target) {
    boardPanzoom.reset({ animate, startX: 0, startY: 0 });
    return;
  }

  setActiveCell(target);
  const pan = getCenteringPan(target);
  boardPanzoom.zoom(1, { animate });
  // Panzoom would limit the pan with the old, not yet rendered scale; the values are already limited.
  boardPanzoom.pan(pan.x, pan.y, { animate, contain: false });
  gameStatus.textContent = `Ansicht auf Feld ${target.coordinate} zentriert.`;
}

function setActiveCell(nextCell, shouldFocus = false) {
  if (activeCell !== nextCell) {
    if (activeCell) {
      activeCell.element.tabIndex = -1;
    }

    activeCell = nextCell;
    activeCell.element.tabIndex = 0;
  }

  if (shouldFocus) {
    activeCell.element.focus();
    activeCell.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function moveFocus(currentCell, rowOffset, columnOffset) {
  const targetRow = currentCell.row + rowOffset;
  const targetColumn = currentCell.column + columnOffset;

  if (
    targetRow < 0 ||
    targetRow >= boardRows ||
    targetColumn < 0 ||
    targetColumn >= boardColumns
  ) {
    return;
  }

  const targetCell = cells[targetRow][targetColumn];
  setActiveCell(targetCell, true);
}

function handleCellKeyDown(event) {
  const cellElement = event.target.closest('.game-cell');
  const cell = cells[cellElement.getAttribute('row')][cellElement.getAttribute('column')];

  if (cell && event.key.startsWith('Arrow')) {
    const movement = {
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0]
    }[event.key];

    if (movement) {
      event.preventDefault();
      moveFocus(cell, movement[0], movement[1]);
    }
    return;
  }

  if (event.key === ' ') {
    event.preventDefault();

    if (cell) {
      useActiveMode(cell);
    }
    return;
  }
}


function handleGlobalShortcut(event) {
  if (isGlobalShortcutBlocked(event)) {
    return;
  }

  const key = event.key.toLowerCase();
  const modeShortcuts = { a: 'reveal', f: 'flag', m: 'mark', p: 'check' };
  const mode = modeShortcuts[key];

  if (key === 'r' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.repeat) {
    event.preventDefault();
    startNewGame();
    return;
  }

  if (mode) {
    event.preventDefault();
    selectMode(mode);
    return;
  }

  const viewActions = {
    '+': () => zoomInButton.click(),
    '=': () => zoomInButton.click(),
    '-': () => zoomOutButton.click(),
    '0': () => resetViewButton.click()
  };
  const viewAction = viewActions[key];

  if (viewAction && !event.ctrlKey && !event.altKey && !event.metaKey && !event.repeat) {
    const button = key === '+' || key === '='
      ? zoomInButton
      : key === '-'
        ? zoomOutButton
        : resetViewButton;

    if (!button.disabled) {
      event.preventDefault();
      viewAction();
    }
  }
}

function createBoard() {
  board.replaceChildren();
  cells = [];
  activeCell = null;
  gameOver = false;
  newGame = true;
  elapsedMs = 0;
  timerStartedAt = null;
  gameStatus.textContent = 'Neues Spiel gestartet.';
  mineCurrentCount = mineTotal;
  mineCount.textContent = mineCurrentCount;
  updateCheckChargesDisplay();
  updateExtraLivesDisplay();
  updateSeriesDisplay();
  updateNewGameButton();

  board.style.gridTemplateColumns = `repeat(${boardColumns}, var(--cell-size))`;

  for (let row = 0; row < boardRows; row += 1) {
    cells[row] = [];
    for (let column = 0; column < boardColumns; column += 1) {
      const cell = document.createElement('button');
      const coordinate = `${getColumnLabel(column)}${row + 1}`;
      const cellState = {
        row,
        column,
        coordinate,
        element: cell,
        isMine: false,
        isFlagged: false,
        isMarked: false,
        isRevealed: false,
        isWrongFlag: false
      };

      cell.type = 'button';
      cell.className = 'game-cell';
      cell.tabIndex = -1;
      cell.setAttribute('aria-label', `Unaufgedecktes Feld ${coordinate}`);
      cell.setAttribute('row', `${row}`);
      cell.setAttribute('column', `${column}`);
      cell.textContent = '';
      cells[row][column] = cellState;
      board.append(cell);
    }
  }

  setActiveCell(cells[0][0]);
}

// After a win every remaining mine gets a flag, as in classic Minesweeper, so all flags show as correct.
function flagRemainingMines() {
  cells.forEach((row) => row.forEach((cell) => {
    if (cell.isMine && !cell.isFlagged && !isTriggeredMine(cell)) {
      cell.isFlagged = true;
      cell.isMarked = false;
      cell.element.classList.remove('is-marked');
      cell.element.classList.add('is-flagged');
    }
  }));
  mineCurrentCount = 0;
  mineCount.textContent = mineCurrentCount;
}

function gameOverRevealMines() {
  cells.forEach(row => row.filter((currentCell) => (
    currentCell.isMine && !currentCell.isFlagged && !isTriggeredMine(currentCell)
  )).forEach((mine) => {
    mine.element.setAttribute('aria-label', `Mine auf Feld ${mine.coordinate}`);
    mine.element.classList.add('is-mine');
  }));
  cells.forEach(row => row.filter((currentCell) => !currentCell.isMine && currentCell.isFlagged).forEach((flag) => {
    flag.isWrongFlag = true;
    flag.element.setAttribute('aria-label', `Falsch gesetzte Flagge auf Feld ${flag.coordinate}`);
    flag.element.classList.add('is-wrong-flag');
  }));
  cells.forEach(row => row.filter((currentCell) => currentCell.isMine && currentCell.isFlagged).forEach((flag) => {
    flag.element.setAttribute('aria-label', `Richtig als Flagge markiertes Feld ${flag.coordinate}`);
    flag.element.classList.add('is-correct-flag');
  }));
}

async function startNewGame() {
  const isNextRound = canStartNextRound();

  if (!isNextRound && !gameOver) {
    const roundInProgress = !newGame;
    const message = minesweeperRunState.getSeriesLossMessage({ series, roundInProgress });

    if (message) {
      const confirmed = await minesweeperRunState.confirmSeriesReset(seriesResetDialog, message);

      if (!confirmed) {
        gameStatus.textContent = 'Neustart abgebrochen.';
        return;
      }

      minesweeperRunState.endSeries(difficulty, {
        countAsLoss: roundInProgress,
        revealedFields: series.revealedFields,
        flags: countFlagResults()
      });
    }
  }

  minesweeperRunState.removeSavedGame(difficulty);

  if (!isNextRound) {
    series = minesweeperRunState.createDefaultSeries();
  }
  createBoard();

  if (isNextRound) {
    const checkChargeLabel = series.checkCharges === 1 ? 'Prüfung' : 'Prüfungen';
    const carriedLives = `${series.extraLives} von ${maxExtraLives} Extraleben`;
    const carriedChecks = `${series.checkCharges} ${checkChargeLabel}`;
    gameStatus.textContent = `Nächste Runde gestartet. Score von ${series.revealedFields.toLocaleString('de-DE')} übernommen. ${carriedLives} und ${carriedChecks} übernommen.`;
  }
  saveGameState();
}

function loadGameState() {
  const savedGameState = minesweeperRunState.readSavedGame(difficulty);
  const savedCells = minesweeperRunState.decodeCells(savedGameState?.cells, boardRows, boardColumns);

  if (!savedCells || savedGameState.difficulty !== difficulty) {
    createBoard();
    return;
  }

  createBoard();

  savedCells.forEach((savedRow, row) => {
    savedRow.forEach((savedCell, column) => {
      cells[row][column].isMine = savedCell.isMine;
      cells[row][column].isFlagged = savedCell.isFlagged;
      cells[row][column].isMarked = savedCell.isMarked;
      cells[row][column].isRevealed = savedCell.isRevealed;
      cells[row][column].isWrongFlag = savedCell.isWrongFlag
        && cells[row][column].isFlagged
        && !cells[row][column].isMine;
    });
  });

  cells.forEach((row) => row.forEach((cell) => restoreCellPresentation(cell)));

  const savedActiveCell = cells[savedGameState.activeCell?.row]?.[savedGameState.activeCell?.column];
  if (savedActiveCell) {
    setActiveCell(savedActiveCell);
  }

  series = minesweeperRunState.normalizeSeries(savedGameState.series);
  updateCheckChargesDisplay();
  updateExtraLivesDisplay();
  updateSeriesDisplay();
  gameOver = Boolean(savedGameState.gameOver);
  newGame = Boolean(savedGameState.newGame);
  elapsedMs = Number.isFinite(savedGameState.elapsedMs) && savedGameState.elapsedMs > 0
    ? savedGameState.elapsedMs
    : 0;
  resumeGameTimer();
  mineCurrentCount = Number.isFinite(savedGameState.mineCurrentCount)
    ? savedGameState.mineCurrentCount
    : mineTotal;
  mineCount.textContent = mineCurrentCount;
  if (canStartNextRound()) {
    gameStatus.textContent = 'Gespeichertes Spiel gewonnen. Mit „Nächste Runde“ geht es weiter.';
  } else {
    gameStatus.textContent = gameOver
      ? 'Gespeichertes Spiel beendet.'
      : 'Gespeichertes Spiel fortgesetzt.';
  }
  updateNewGameButton();
  if (canStartNextRound()) {
    flagRemainingMines();
  }
  if (gameOver) {
    gameOverRevealMines();
  }
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => selectMode(button.dataset.mode));
});

boardViewport.addEventListener('pointerdown', handleBoardPointerDown, true);
document.addEventListener('pointermove', handleBoardPointerMove, true);
document.addEventListener('pointerup', handleBoardPointerEnd, true);
document.addEventListener('pointercancel', handleBoardPointerEnd, true);
board.addEventListener('click', preventClickAfterPan, true);

zoomInButton.addEventListener('click', () => boardPanzoom?.zoomIn());
zoomOutButton.addEventListener('click', () => boardPanzoom?.zoomOut());
resetViewButton.addEventListener('click', centerViewOnWorkArea);

board.addEventListener('click', handleCellClick);
board.addEventListener('contextmenu', handleCellContextMenu);
board.addEventListener('keydown', handleCellKeyDown);
document.addEventListener('keydown', handleGlobalShortcut);
newGameButton.addEventListener('click', startNewGame);
winDialog?.addEventListener('close', handleWinDialogClose);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    handlePageHidden();
  } else {
    resumeGameTimer();
  }
});
window.addEventListener('pagehide', handlePageHidden);
window.addEventListener('pageshow', resumeGameTimer);
loadGameState();
restoreActiveMode();

// Edge hints follow the visible board area, also when Panzoom is unavailable and the viewport scrolls.
boardViewport.addEventListener('scroll', scheduleBoardEdgeHints, { passive: true });
new ResizeObserver(scheduleBoardEdgeHints).observe(boardViewport);
scheduleBoardEdgeHints();

async function initializeBoardPanzoom() {
  if (!boardViewport || !boardWorld) {
    return;
  }

  // The site header and footer change the viewport size, so the start position waits for them.
  await window.lycheelabComponentsLoaded;
  const loadTarget = getWorkAreaTarget();

  if (loadTarget) {
    setActiveCell(loadTarget);
  }

  try {
    const { default: Panzoom } = await import(
      '../../assets/vendor/panzoom.es.js'
    );

    // Panzoom hides the overflow itself; doing it first keeps the measured start position exact.
    boardViewport.style.overflow = 'hidden';
    const startPan = loadTarget ? getCenteringPan(loadTarget) : { x: 0, y: 0 };

    boardPanzoom = Panzoom(boardWorld, {
      startX: startPan.x,
      startY: startPan.y,
      startScale: 1,
      minScale: 0.125,
      maxScale: 4,
      contain: 'outside',
      panOnlyWhenZoomed: false,
      touchAction: 'none',
      overflow: 'hidden'
    });
    boardWorld.addEventListener('panzoomzoom', scheduleZoomLevelAnnouncement);
    boardWorld.addEventListener('panzoomreset', scheduleZoomLevelAnnouncement);
    boardWorld.addEventListener('panzoomend', finishZoomLevelAnnouncement);
    boardWorld.addEventListener('panzoomchange', scheduleBoardEdgeHints);
    // Animated zoom and reset report their target first; recheck once the transition ends.
    boardWorld.addEventListener('transitionend', scheduleBoardEdgeHints);
    updateZoomLevelText();
    scheduleBoardEdgeHints();

    [zoomInButton, zoomOutButton, resetViewButton].forEach((button) => {
      button.disabled = false;
    });

    boardViewport.addEventListener(
      'wheel',
      boardPanzoom.zoomWithWheel,
      { passive: false }
    );
  } catch (error) {
    boardViewport.style.overflow = 'auto';
    console.error('Panzoom konnte nicht geladen werden.', error);
    gameStatus.textContent = 'Pan-/Zoom-Ansicht nicht verfügbar; das Spielfeld bleibt scrollbar.';

    if (loadTarget) {
      const { scrollLeft, scrollTop } = getCenteringPan(loadTarget);
      boardViewport.scrollTo({ left: scrollLeft, top: scrollTop });
    }
  }
}

initializeBoardPanzoom();
