// Central difficulty model: a difficulty is the board size, the mine count, and the rule switches.
const minesweeperDifficulty = (() => {
  const storageKey = 'lycheelab-minesweeper-difficulty';
  const limits = Object.freeze({
    minSize: 5,
    maxSize: 100,
    minMines: 1,
    maxMineRatio: 0.33,
    // The first move reveals a 3 x 3 area without mines.
    startAreaSize: 9
  });
  const presets = Object.freeze({
    beginner: Object.freeze({ label: 'Anfänger', rows: 9, columns: 9, mines: 10 }),
    intermediate: Object.freeze({ label: 'Fortgeschritten', rows: 16, columns: 16, mines: 40 }),
    expert: Object.freeze({ label: 'Experte', rows: 16, columns: 30, mines: 99 }),
    maximum: Object.freeze({ label: 'Maximal (100 × 100)', rows: 100, columns: 100, mines: 2000 })
  });
  const defaultRules = Object.freeze({ extraLives: true, checks: true, lessGuess: true });
  const maxRewardThreshold = 9999;
  const keyPattern =
    /^(beginner|intermediate|expert|maximum|custom-(\d+)x(\d+)-(\d+))(-lives)?(-checks)?(-lessguess)?$/;

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function getMaxMines(rows, columns) {
    return Math.min(Math.floor(rows * columns * limits.maxMineRatio), rows * columns - limits.startAreaSize);
  }

  function createPresetDifficulty(presetName) {
    const preset = typeof presetName === 'string' && Object.hasOwn(presets, presetName) ? presets[presetName] : null;
    return preset ? { rows: preset.rows, columns: preset.columns, mines: preset.mines, ...defaultRules } : null;
  }

  // Non-numeric sizes fall back to Anfänger; numbers outside the limits are clamped.
  function normalizeDifficulty(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const [rows, columns, mines] = [source.rows, source.columns, source.mines].map((value) =>
      typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN
    );

    if (![rows, columns, mines].every(Number.isFinite)) {
      return createPresetDifficulty('beginner');
    }

    const normalizedRows = clamp(Math.round(rows), limits.minSize, limits.maxSize);
    const normalizedColumns = clamp(Math.round(columns), limits.minSize, limits.maxSize);

    return {
      rows: normalizedRows,
      columns: normalizedColumns,
      mines: clamp(Math.round(mines), limits.minMines, getMaxMines(normalizedRows, normalizedColumns)),
      extraLives: typeof source.extraLives === 'boolean' ? source.extraLives : defaultRules.extraLives,
      checks: typeof source.checks === 'boolean' ? source.checks : defaultRules.checks,
      lessGuess: typeof source.lessGuess === 'boolean' ? source.lessGuess : defaultRules.lessGuess
    };
  }

  function getPresetName(config) {
    return (
      Object.keys(presets).find(
        (name) =>
          presets[name].rows === config.rows &&
          presets[name].columns === config.columns &&
          presets[name].mines === config.mines
      ) ?? null
    );
  }

  // Suffixes only describe deviations from the default rules, so existing saves under "beginner" etc. stay valid.
  function getDifficultyKey(raw) {
    const config = normalizeDifficulty(raw);
    const base = getPresetName(config) ?? `custom-${config.rows}x${config.columns}-${config.mines}`;

    return (
      base +
      (config.extraLives ? '' : '-lives') +
      (config.checks ? '' : '-checks') +
      (config.lessGuess ? '' : '-lessguess')
    );
  }

  // Returns the configuration for a canonical key, or null for unknown or out-of-range keys.
  function parseDifficultyKey(key) {
    const match = typeof key === 'string' ? key.match(keyPattern) : null;

    if (!match) {
      return null;
    }

    const [, base, rows, columns, mines, livesOff, checksOff, lessGuessOff] = match;
    const dimensions = presets[base] ?? { rows: Number(rows), columns: Number(columns), mines: Number(mines) };
    const config = normalizeDifficulty({
      rows: dimensions.rows,
      columns: dimensions.columns,
      mines: dimensions.mines,
      extraLives: !livesOff,
      checks: !checksOff,
      lessGuess: !lessGuessOff
    });

    return getDifficultyKey(config) === key ? config : null;
  }

  function getDifficultyLabel(raw) {
    const config = normalizeDifficulty(raw);
    const presetName = getPresetName(config);
    const base = presetName
      ? presets[presetName].label
      : `Benutzerdefiniert (${config.rows} × ${config.columns}, ${config.mines.toLocaleString('de-DE')} Minen)`;
    const deviations = [
      config.extraLives ? null : 'ohne Extraleben',
      config.checks ? null : 'ohne Prüfen',
      config.lessGuess ? null : 'nicht ratearm'
    ].filter(Boolean);

    return [base, ...deviations].join(' · ');
  }

  // The coefficient controls reward frequency; denser boards still reward more often.
  function getRewardThreshold(raw) {
    const config = normalizeDifficulty(raw);
    const fieldsPerMine = (config.rows * config.columns) / config.mines;

    return Math.min(maxRewardThreshold, Math.ceil(1.5 * fieldsPerMine ** 4));
  }

  // Empty when neither extra lives nor checks are enabled, because there is nothing to reward.
  function describeReward(raw) {
    const config = normalizeDifficulty(raw);
    const every = `Alle ${getRewardThreshold(config).toLocaleString('de-DE')} aufgedeckten sicheren Felder`;

    if (config.extraLives && config.checks) {
      return `${every}: +1 Extraleben, bei 3 Extraleben stattdessen +3 Prüfungen.`;
    }
    if (config.extraLives) {
      return `${every}: +1 Extraleben, höchstens 3.`;
    }
    if (config.checks) {
      return `${every}: +1 Prüfung.`;
    }
    return '';
  }

  // Missing or invalid stored values lead to Anfänger.
  function readStoredDifficulty() {
    try {
      return normalizeDifficulty(JSON.parse(localStorage.getItem(storageKey)));
    } catch {
      return createPresetDifficulty('beginner');
    }
  }

  function writeStoredDifficulty(raw) {
    const config = normalizeDifficulty(raw);

    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
      return localStorage.getItem(storageKey) === JSON.stringify(config);
    } catch {
      return false;
    }
  }

  return Object.freeze({
    storageKey,
    limits,
    presets,
    defaultRules,
    maxRewardThreshold,
    getMaxMines,
    createPresetDifficulty,
    normalizeDifficulty,
    getPresetName,
    getDifficultyKey,
    parseDifficultyKey,
    getDifficultyLabel,
    getRewardThreshold,
    describeReward,
    readStoredDifficulty,
    writeStoredDifficulty
  });
})();
