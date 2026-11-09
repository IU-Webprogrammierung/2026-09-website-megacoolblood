window.lycheelabTheme = (() => {
  const storageKey = 'lycheelab-theme';
  const preferences = Object.freeze(['system', 'light', 'dark']);

  function readStoredPreference() {
    try {
      const value = localStorage.getItem(storageKey);
      return preferences.includes(value) ? value : 'system';
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

  function getPreference() {
    return currentPreference;
  }

  function setPreference(preference) {
    if (!preferences.includes(preference)) {
      throw new RangeError(`Unknown color scheme: ${preference}`);
    }

    currentPreference = preference;
    applyPreference(preference);

    try {
      localStorage.setItem(storageKey, preference);
      return localStorage.getItem(storageKey) === preference;
    } catch {
      return false;
    }
  }

  return Object.freeze({ storageKey, preferences, getPreference, setPreference });
})();
