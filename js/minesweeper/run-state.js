const minesweeperRunState = (() => {
  const storageKeys = Object.freeze({
    activeMode: 'lycheelab-minesweeper-mode',
    gameStatePrefix: 'lycheelab-minesweeper-game',
    statistics: 'lycheelab-statistics'
  });
  const maxExtraLives = 3;
  const initialCheckCharges = 3;

  // Every canonical difficulty key has its own save, including custom sizes and rule combinations.
  function getGameStateStorageKey(difficulty) {
    if (!minesweeperDifficulty.parseDifficultyKey(difficulty)) {
      throw new RangeError(`Unbekannter Schwierigkeitsgrad: ${difficulty}`);
    }

    return `${storageKeys.gameStatePrefix}:${difficulty}`;
  }

  function toCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }

  function createDefaultSeries() {
    return {
      extraLives: maxExtraLives,
      checkCharges: initialCheckCharges,
      revealProgress: 0,
      revealedFields: 0
    };
  }

  function normalizeCount(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
    return Number.isInteger(value) && value >= 0 && value <= maximum ? value : fallback;
  }

  function normalizeSeries(savedSeries) {
    const defaults = createDefaultSeries();
    const source = savedSeries && typeof savedSeries === 'object' ? savedSeries : {};

    return {
      extraLives: normalizeCount(source.extraLives, defaults.extraLives, maxExtraLives),
      checkCharges: normalizeCount(source.checkCharges, defaults.checkCharges),
      revealProgress: normalizeCount(source.revealProgress, defaults.revealProgress),
      revealedFields: normalizeCount(source.revealedFields, defaults.revealedFields)
    };
  }

  // Returns null when stored statistics cannot be read, so callers do not overwrite them.
  function readStatistics() {
    try {
      const storedStatistics = JSON.parse(localStorage.getItem(storageKeys.statistics) || '{}');
      return storedStatistics && typeof storedStatistics === 'object' && !Array.isArray(storedStatistics)
        ? storedStatistics
        : {};
    } catch {
      return null;
    }
  }

  function writeStatistics(statistics) {
    try {
      localStorage.setItem(storageKeys.statistics, JSON.stringify(statistics));
      return true;
    } catch {
      return false;
    }
  }

  function readDifficultyStatistics(statistics, difficulty) {
    const storedStatistics = statistics?.[difficulty];
    const source = storedStatistics && typeof storedStatistics === 'object' ? storedStatistics : {};
    const currentStreak = toCount(source.currentStreak);

    return {
      // Versions without best-streak tracking kept counting the current streak, so it can exceed the stored best.
      bestStreak: Math.max(toCount(source.bestStreak), currentStreak),
      bestSeriesRevealedFields: toCount(source.bestSeriesRevealedFields),
      bestTimeMs: toCount(source.bestTimeMs),
      currentStreak,
      gamesPlayed: toCount(source.gamesPlayed),
      minesCleared: toCount(source.minesCleared),
      slowestTimeMs: toCount(source.slowestTimeMs),
      timedWins: toCount(source.timedWins),
      totalWinTimeMs: toCount(source.totalWinTimeMs),
      wins: toCount(source.wins),
      wrongFlags: toCount(source.wrongFlags)
    };
  }

  // A lost or aborted round counts its correct flags as cleared mines and keeps its wrong flags.
  function addLossFlags(difficultyStatistics, { correctFlags = 0, wrongFlags = 0 } = {}) {
    difficultyStatistics.minesCleared += toCount(correctFlags);
    difficultyStatistics.wrongFlags += toCount(wrongFlags);
  }

  // Wins saved before time tracking have no time, so the average uses timedWins instead of wins.
  function addWinTime(difficultyStatistics, elapsedMs) {
    const time = toCount(elapsedMs);

    difficultyStatistics.bestTimeMs = difficultyStatistics.timedWins > 0
      ? Math.min(difficultyStatistics.bestTimeMs, time)
      : time;
    difficultyStatistics.slowestTimeMs = Math.max(difficultyStatistics.slowestTimeMs, time);
    difficultyStatistics.totalWinTimeMs += time;
    difficultyStatistics.timedWins += 1;
  }

  function updateBestSeriesRevealedFields(difficultyStatistics, revealedFields) {
    const bestScore = Math.max(
      difficultyStatistics.bestSeriesRevealedFields,
      toCount(revealedFields)
    );
    const hasChanged = bestScore !== difficultyStatistics.bestSeriesRevealedFields;

    difficultyStatistics.bestSeriesRevealedFields = bestScore;
    return hasChanged;
  }

  // One character per cell keeps a 100 x 100 save small; the bits stand for the cell properties below.
  const cellAlphabet = '0123456789abcdefghijklmnopqrstuv';
  const cellProperties = Object.freeze(['isMine', 'isRevealed', 'isFlagged', 'isMarked', 'isWrongFlag']);

  function encodeCells(cells) {
    return cells.flat().map((cell) => cellAlphabet[
      cellProperties.reduce((bits, property, index) => (cell[property] ? bits | (1 << index) : bits), 0)
    ]).join('');
  }

  // Returns the cell states as rows, or null when the saved text does not match the board.
  function decodeCells(encodedCells, rows, columns) {
    if (typeof encodedCells !== 'string' || encodedCells.length !== rows * columns || !/^[0-9a-v]*$/.test(encodedCells)) {
      return null;
    }

    return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
      const bits = cellAlphabet.indexOf(encodedCells[row * columns + column]);
      return Object.fromEntries(cellProperties.map((property, index) => [property, (bits & (1 << index)) !== 0]));
    }));
  }

  function readSavedGame(difficulty) {
    const gameStateStorageKey = getGameStateStorageKey(difficulty);

    try {
      return JSON.parse(localStorage.getItem(gameStateStorageKey) || 'null');
    } catch {
      return null;
    }
  }

  function writeSavedGame(difficulty, gameState) {
    const gameStateStorageKey = getGameStateStorageKey(difficulty);

    try {
      localStorage.setItem(gameStateStorageKey, JSON.stringify(gameState));
      return true;
    } catch {
      return false;
    }
  }

  function removeSavedGame(difficulty) {
    const gameStateStorageKey = getGameStateStorageKey(difficulty);

    try {
      localStorage.removeItem(gameStateStorageKey);
      return true;
    } catch {
      return false;
    }
  }

  function readActiveMode() {
    try {
      return localStorage.getItem(storageKeys.activeMode);
    } catch {
      return null;
    }
  }

  function writeActiveMode(mode) {
    try {
      localStorage.setItem(storageKeys.activeMode, mode);
      return true;
    } catch {
      return false;
    }
  }

  function endSeries(difficulty, { countAsLoss = false, revealedFields = 0, flags } = {}) {
    const statistics = readStatistics();

    if (statistics) {
      const difficultyStatistics = readDifficultyStatistics(statistics, difficulty);
      const scoreChanged = updateBestSeriesRevealedFields(difficultyStatistics, revealedFields);

      if (scoreChanged || countAsLoss || difficultyStatistics.currentStreak > 0) {
        difficultyStatistics.currentStreak = 0;
        if (countAsLoss) {
          difficultyStatistics.gamesPlayed += 1;
          addLossFlags(difficultyStatistics, flags);
        }
        statistics[difficulty] = difficultyStatistics;
        writeStatistics(statistics);
      }
    }

    removeSavedGame(difficulty);
  }

  function getSeriesLossMessage({ series, roundInProgress }) {
    const parts = [];

    if (series.revealedFields > 0) {
      parts.push(`Dein Score von ${series.revealedFields.toLocaleString('de-DE')} geht verloren.`);
    }
    if (series.extraLives !== maxExtraLives || series.checkCharges !== initialCheckCharges) {
      parts.push(`Extraleben werden auf ${maxExtraLives} und Prüfungen auf ${initialCheckCharges} zurückgesetzt.`);
    }
    if (roundInProgress) {
      parts.push('Das laufende Spiel zählt in der Statistik als Niederlage.');
    }

    return parts.join(' ');
  }

  function describeDuration(milliseconds) {
    const totalSeconds = Math.floor(toCount(milliseconds) / 1000);
    const units = [
      [Math.floor(totalSeconds / 3600), 'Stunde', 'Stunden'],
      [Math.floor(totalSeconds / 60) % 60, 'Minute', 'Minuten'],
      [totalSeconds % 60, 'Sekunde', 'Sekunden']
    ];
    const parts = units
      .filter(([value]) => value > 0)
      .map(([value, singular, plural]) => `${value} ${value === 1 ? singular : plural}`);

    return parts.length > 0 ? parts.join(' ') : '0 Sekunden';
  }

  // Compact clock format such as "01:23" or "1:02:03" for statistics.
  function formatClockDuration(milliseconds) {
    const totalSeconds = Math.floor(toCount(milliseconds) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');

    return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
  }

  function confirmSeriesReset(dialog, message) {
    const title = document.getElementById(dialog?.getAttribute('aria-labelledby'))?.textContent ?? '';

    if (typeof dialog?.showModal !== 'function') {
      return Promise.resolve(window.confirm(`${title}\n\n${message}`.trim()));
    }
    if (dialog.open) {
      return Promise.resolve(false);
    }

    document.getElementById(dialog.getAttribute('aria-describedby')).textContent = message;
    dialog.returnValue = '';

    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
      dialog.showModal();
    });
  }

  return Object.freeze({
    storageKeys,
    maxExtraLives,
    getGameStateStorageKey,
    createDefaultSeries,
    normalizeSeries,
    readStatistics,
    writeStatistics,
    readDifficultyStatistics,
    addLossFlags,
    addWinTime,
    updateBestSeriesRevealedFields,
    readSavedGame,
    writeSavedGame,
    removeSavedGame,
    encodeCells,
    decodeCells,
    readActiveMode,
    writeActiveMode,
    endSeries,
    getSeriesLossMessage,
    describeDuration,
    formatClockDuration,
    confirmSeriesReset
  });
})();
