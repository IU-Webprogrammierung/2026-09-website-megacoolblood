window.lycheelabTheme = (() => {
  const storageKey = 'lycheelab-theme';
  const changeEvent = 'lycheelab-themechange';
  const preferences = Object.freeze(['system', 'light', 'dark']);

  function normalizePreference(value) {
    return preferences.includes(value) ? value : 'system';
  }

  function readStoredPreference() {
    try {
      return normalizePreference(localStorage.getItem(storageKey));
    } catch {
      return 'system';
    }
  }

  function applyPreference(preference) {
    if (preference === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = preference;
    }
  }

  let currentPreference = readStoredPreference();
  applyPreference(currentPreference);

  function updatePreference(preference) {
    if (preference === currentPreference) {
      return;
    }

    currentPreference = preference;
    applyPreference(preference);
    document.dispatchEvent(new CustomEvent(changeEvent, { detail: { preference } }));
  }

  function getPreference() {
    return currentPreference;
  }

  function setPreference(preference) {
    if (!preferences.includes(preference)) {
      throw new RangeError(`Unknown color scheme: ${preference}`);
    }

    updatePreference(preference);

    try {
      localStorage.setItem(storageKey, preference);
      return localStorage.getItem(storageKey) === preference;
    } catch {
      return false;
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) {
      return;
    }

    try {
      if (event.storageArea !== localStorage) {
        return;
      }
    } catch {
      return;
    }

    updatePreference(normalizePreference(event.newValue));
  });

  return Object.freeze({ storageKey, changeEvent, preferences, getPreference, setPreference });
})();
