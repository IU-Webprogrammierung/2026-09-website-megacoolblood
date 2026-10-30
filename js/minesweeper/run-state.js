const minesweeperRunState = (() => {
  const storageKeys = Object.freeze({
    gameStatePrefix: 'lycheelab-minesweeper-game',
    statistics: 'lycheelab-statistics'
  });
  const difficulties = Object.freeze(['beginner', 'intermediate', 'expert', 'maximum']);
  const maxExtraLives = 3;
  const initialCheckCharges = 3;

  function getGameStateStorageKey(difficulty) {
    if (!difficulties.includes(difficulty)) {
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

    return {
      bestStreak: toCount(source.bestStreak),
      bestSeriesRevealedFields: toCount(source.bestSeriesRevealedFields),
      currentStreak: toCount(source.currentStreak),
      gamesPlayed: toCount(source.gamesPlayed),
      minesCleared: toCount(source.minesCleared),
      wins: toCount(source.wins)
    };
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

  function endSeries(difficulty, { countAsLoss = false, revealedFields = 0 } = {}) {
    const statistics = readStatistics();

    if (statistics) {
      const difficultyStatistics = readDifficultyStatistics(statistics, difficulty);
      const scoreChanged = updateBestSeriesRevealedFields(difficultyStatistics, revealedFields);

      if (scoreChanged || countAsLoss || difficultyStatistics.currentStreak > 0) {
        difficultyStatistics.currentStreak = 0;
        if (countAsLoss) {
          difficultyStatistics.gamesPlayed += 1;
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
    difficulties,
    maxExtraLives,
    getGameStateStorageKey,
    createDefaultSeries,
    normalizeSeries,
    readStatistics,
    writeStatistics,
    readDifficultyStatistics,
    updateBestSeriesRevealedFields,
    readSavedGame,
    writeSavedGame,
    removeSavedGame,
    endSeries,
    getSeriesLossMessage,
    confirmSeriesReset
  });
})();
