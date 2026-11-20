window.lycheelabTheme = (() => {
  const storageKey = 'lycheelab-theme';
  const changeEvent = 'lycheelab-themechange';
  const preferences = Object.freeze(['system', 'light', 'dark', 'oled']);

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

  // The browser bar follows the chosen scheme: one theme-color applies to all media, the others to none.
  // The system reports only light or dark, so the OLED color applies only when it is chosen.
  function applyThemeColor(preference) {
    document.querySelectorAll('meta[name="theme-color"][data-scheme]').forEach((meta) => {
      const scheme = meta.dataset.scheme;

      if (preference === 'system') {
        meta.media = scheme === 'oled' ? 'not all' : `(prefers-color-scheme: ${scheme})`;
      } else {
        meta.media = scheme === preference ? 'all' : 'not all';
      }
    });
  }

  function applyPreference(preference) {
    if (preference === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = preference;
    }
    applyThemeColor(preference);
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
