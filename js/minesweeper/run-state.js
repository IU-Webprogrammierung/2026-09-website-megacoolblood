const minesweeperRunState = (() => {
  const storageKeys = Object.freeze({
    gameState: 'lycheelab-minesweeper-game',
    statistics: 'lycheelab-statistics'
  });

  function toCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
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
      currentStreak: toCount(source.currentStreak),
      gamesPlayed: toCount(source.gamesPlayed),
      minesCleared: toCount(source.minesCleared),
      wins: toCount(source.wins)
    };
  }

  function readSavedGame() {
    try {
      return JSON.parse(localStorage.getItem(storageKeys.gameState) || 'null');
    } catch {
      return null;
    }
  }

  function removeSavedGame() {
    try {
      localStorage.removeItem(storageKeys.gameState);
    } catch {
    }
  }

  return Object.freeze({
    storageKeys,
    readStatistics,
    writeStatistics,
    readDifficultyStatistics,
    readSavedGame,
    removeSavedGame
  });
})();
