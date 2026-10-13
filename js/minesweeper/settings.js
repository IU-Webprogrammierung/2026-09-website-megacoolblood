const settingsForm = document.querySelector('#settings-form');
const difficultySelect = document.querySelector('#difficulty');
const settingsStatus = document.querySelector('#settings-status');
const storageKey = 'lycheelab-difficulty';

function readDifficulty() {
  try {
    return localStorage.getItem(storageKey) || 'beginner';
  } catch {
    return 'beginner';
  }
}

function saveDifficulty(event) {
  event.preventDefault();

  try {
    localStorage.setItem(storageKey, difficultySelect.value);
    settingsStatus.textContent = 'Einstellungen gespeichert.';
  } catch {
    settingsStatus.textContent = 'Einstellungen konnten nicht gespeichert werden.';
  }
}

difficultySelect.value = readDifficulty();
settingsForm.addEventListener('submit', saveDifficulty);
