const settingsForm = document.querySelector('#settings-form');
const difficultySelect = document.querySelector('#difficulty');
const settingsStatus = document.querySelector('#settings-status');
const sizeInputs = {
  rows: document.querySelector('#rows'),
  columns: document.querySelector('#columns'),
  mines: document.querySelector('#mines')
};
const minesHint = document.querySelector('#mines-hint');
const ruleInputs = {
  extraLives: document.querySelector('#rule-extra-lives'),
  checks: document.querySelector('#rule-checks'),
  noGuess: document.querySelector('#rule-no-guess')
};
const rewardInfo = document.querySelector('#reward-info');
const { limits } = minesweeperDifficulty;

function isStorageReadable() {
  try {
    return typeof localStorage.getItem === 'function';
  } catch {
    return false;
  }
}

function readInteger(input) {
  const value = input.value.trim() === '' ? NaN : Number(input.value);
  return Number.isInteger(value) ? value : null;
}

function isValidSize(value) {
  return value !== null && value >= limits.minSize && value <= limits.maxSize;
}

function getMaxMinesForInputs() {
  const rows = readInteger(sizeInputs.rows);
  const columns = readInteger(sizeInputs.columns);

  return isValidSize(rows) && isValidSize(columns) ? minesweeperDifficulty.getMaxMines(rows, columns) : null;
}

function updateMinesLimit() {
  const maxMines = getMaxMinesForInputs();

  if (maxMines === null) {
    sizeInputs.mines.removeAttribute('max');
    minesHint.textContent = `Mindestens ${limits.minMines}; die Höchstzahl hängt von Zeilen und Spalten ab.`;
    return;
  }

  sizeInputs.mines.max = String(maxMines);
  minesHint.textContent = `${limits.minMines} bis ${maxMines.toLocaleString('de-DE')} (höchstens 33 % der Felder)`;
}

function readFormConfig() {
  const preset = minesweeperDifficulty.createPresetDifficulty(difficultySelect.value);
  const size = preset ?? {
    rows: readInteger(sizeInputs.rows),
    columns: readInteger(sizeInputs.columns),
    mines: readInteger(sizeInputs.mines)
  };

  return {
    rows: size.rows,
    columns: size.columns,
    mines: size.mines,
    extraLives: ruleInputs.extraLives.checked,
    checks: ruleInputs.checks.checked,
    noGuess: ruleInputs.noGuess.checked
  };
}

function updateRewardInfo() {
  const config = readFormConfig();
  const hasValidSize = isValidSize(config.rows) && isValidSize(config.columns) && config.mines !== null
    && config.mines >= limits.minMines && config.mines <= minesweeperDifficulty.getMaxMines(config.rows, config.columns);
  const description = hasValidSize ? minesweeperDifficulty.describeReward(config) : '';

  rewardInfo.textContent = description;
  rewardInfo.hidden = description === '';
}

// Preset sizes are shown read-only; "Benutzerdefiniert" keeps the shown values as a starting point.
function applySelection() {
  const preset = minesweeperDifficulty.createPresetDifficulty(difficultySelect.value);

  Object.entries(sizeInputs).forEach(([name, input]) => {
    input.readOnly = Boolean(preset);
    if (preset) {
      input.value = String(preset[name]);
      clearFieldError(input);
    }
  });
  updateMinesLimit();
  updateRewardInfo();
}

function setFieldError(input, message) {
  const error = document.querySelector(`#${input.id}-error`);

  input.setAttribute('aria-invalid', 'true');
  error.textContent = message;
  error.hidden = false;
}

function clearFieldError(input) {
  const error = document.querySelector(`#${input.id}-error`);

  input.removeAttribute('aria-invalid');
  error.textContent = '';
  error.hidden = true;
}

function validateCustomSize() {
  const invalidInputs = [];
  const sizeMessage = `Bitte gib eine ganze Zahl von ${limits.minSize} bis ${limits.maxSize} ein.`;

  [sizeInputs.rows, sizeInputs.columns].forEach((input) => {
    if (isValidSize(readInteger(input))) {
      clearFieldError(input);
    } else {
      setFieldError(input, sizeMessage);
      invalidInputs.push(input);
    }
  });

  const mines = readInteger(sizeInputs.mines);
  const maxMines = getMaxMinesForInputs();
  const isValidMines = mines !== null && mines >= limits.minMines && (maxMines === null || mines <= maxMines);

  if (isValidMines) {
    clearFieldError(sizeInputs.mines);
  } else {
    setFieldError(sizeInputs.mines, maxMines === null
      ? `Bitte gib eine ganze Zahl ab ${limits.minMines} ein.`
      : `Bitte gib eine ganze Zahl von ${limits.minMines} bis ${maxMines.toLocaleString('de-DE')} ein.`);
    invalidInputs.push(sizeInputs.mines);
  }

  return invalidInputs;
}

function loadSettings() {
  if (!isStorageReadable()) {
    settingsStatus.textContent = 'Einstellungen konnten nicht gelesen werden; Anfänger wird angezeigt.';
  }

  const config = minesweeperDifficulty.readStoredDifficulty();

  difficultySelect.value = minesweeperDifficulty.getPresetName(config) ?? 'custom';
  Object.entries(sizeInputs).forEach(([name, input]) => {
    input.value = String(config[name]);
  });
  Object.entries(ruleInputs).forEach(([name, input]) => {
    input.checked = config[name];
  });
  applySelection();
}

function saveSettings(event) {
  event.preventDefault();

  if (difficultySelect.value === 'custom') {
    const invalidInputs = validateCustomSize();

    if (invalidInputs.length > 0) {
      settingsStatus.textContent = 'Einstellungen nicht gespeichert. Bitte korrigiere die markierten Felder.';
      invalidInputs[0].focus();
      return;
    }
  }

  const config = readFormConfig();

  if (!minesweeperDifficulty.writeStoredDifficulty(config)) {
    settingsStatus.textContent = 'Einstellungen konnten nicht gespeichert werden.';
    return;
  }

  // A custom size equal to a preset counts as that preset, so the selection follows the saved difficulty.
  difficultySelect.value = minesweeperDifficulty.getPresetName(config) ?? 'custom';
  applySelection();
  settingsStatus.textContent = `Einstellungen gespeichert. Schwierigkeitsgrad: ${minesweeperDifficulty.getDifficultyLabel(config)}.`;
}

difficultySelect.addEventListener('change', applySelection);
Object.values(sizeInputs).forEach((input) => {
  input.addEventListener('input', () => {
    clearFieldError(input);
    updateMinesLimit();
    updateRewardInfo();
  });
});
Object.values(ruleInputs).forEach((input) => input.addEventListener('change', updateRewardInfo));
settingsForm.addEventListener('submit', saveSettings);
loadSettings();
