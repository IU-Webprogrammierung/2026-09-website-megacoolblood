const settingsForm = document.querySelector('#settings-form');
const difficultySelect = document.querySelector('#difficulty');
const settingsStatus = document.querySelector('#settings-status');

function isStorageReadable() {
  try {
    return typeof localStorage.getItem === 'function';
  } catch {
    return false;
  }
}

function readDifficulty() {
  if (!isStorageReadable()) {
    settingsStatus.textContent = 'Einstellungen konnten nicht gelesen werden; Anfänger wird angezeigt.';
  }

  return minesweeperDifficulty.getPresetName(minesweeperDifficulty.readStoredDifficulty()) ?? 'beginner';
}

function saveDifficulty(event) {
  event.preventDefault();

  const preset = minesweeperDifficulty.createPresetDifficulty(difficultySelect.value);

  if (!preset) {
    settingsStatus.textContent = 'Einstellungen konnten nicht gespeichert werden.';
    return;
  }

  // Rule switches have no controls yet, so a preset change keeps the stored rules.
  const { extraLives, checks, noGuess } = minesweeperDifficulty.readStoredDifficulty();
  const saved = minesweeperDifficulty.writeStoredDifficulty({ ...preset, extraLives, checks, noGuess });

  settingsStatus.textContent = saved
    ? 'Einstellungen gespeichert.'
    : 'Einstellungen konnten nicht gespeichert werden.';
}

difficultySelect.value = readDifficulty();
settingsForm.addEventListener('submit', saveDifficulty);
