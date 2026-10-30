const settingsForm = document.querySelector('#settings-form');
const difficultySelect = document.querySelector('#difficulty');
const settingsStatus = document.querySelector('#settings-status');
const storageKey = 'lycheelab-difficulty';

function readDifficulty() {
  try {
    const storedDifficulty = localStorage.getItem(storageKey);
    return minesweeperRunState.difficulties.includes(storedDifficulty)
      ? storedDifficulty
      : 'beginner';
  } catch {
    settingsStatus.textContent = 'Einstellungen konnten nicht gelesen werden; Anfänger wird angezeigt.';
    return 'beginner';
  }
}

function saveDifficulty(event) {
  event.preventDefault();

  if (!minesweeperRunState.difficulties.includes(difficultySelect.value)) {
    settingsStatus.textContent = 'Einstellungen konnten nicht gespeichert werden.';
    return;
  }

  try {
    localStorage.setItem(storageKey, difficultySelect.value);
    if (localStorage.getItem(storageKey) !== difficultySelect.value) {
      settingsStatus.textContent = 'Einstellungen konnten nicht gespeichert werden.';
      return;
    }

    settingsStatus.textContent = 'Einstellungen gespeichert.';
  } catch {
    settingsStatus.textContent = 'Einstellungen konnten nicht gespeichert werden.';
  }
}

difficultySelect.value = readDifficulty();
settingsForm.addEventListener('submit', saveDifficulty);
