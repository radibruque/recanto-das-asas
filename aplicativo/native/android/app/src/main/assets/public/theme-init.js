(function () {
  'use strict';

  // Apply the visual preference before React and its styles load. This store
  // belongs only to this installation; it never reads or writes the vault.
  if (window.__recantoAppearance) return;

  var key = 'recanto.ui.theme';
  var listeners = new Set();
  var media = null;
  var systemDark = false;
  var preference = 'system';
  var snapshot;

  function validPreference(value) {
    return value === 'light' || value === 'dark' || value === 'system';
  }

  try {
    var saved = window.localStorage.getItem(key);
    if (validPreference(saved)) preference = saved;
  } catch (_) {
    // A blocked or unavailable storage must not prevent opening the app.
  }

  try {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark = media.matches;
  } catch (_) {
    // Older web views without matchMedia use the light palette.
  }

  function apply() {
    var theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#233B46' : '#F4F8FA');
    if (snapshot && snapshot.preference === preference && snapshot.theme === theme) return;
    snapshot = Object.freeze({ preference: preference, theme: theme });
    listeners.forEach(function (listener) { listener(); });
  }

  apply();

  window.__recantoAppearance = {
    getSnapshot: function () { return snapshot; },
    subscribe: function (listener) {
      listeners.add(listener);
      return function () { listeners.delete(listener); };
    },
    setPreference: function (next) {
      if (!validPreference(next)) return;
      preference = next;
      try { window.localStorage.setItem(key, next); } catch (_) {
        // The selection still works for this session if saving is blocked.
      }
      apply();
    }
  };

  function systemChanged(event) {
    systemDark = event.matches;
    if (preference === 'system') apply();
  }

  if (media) {
    if (media.addEventListener) media.addEventListener('change', systemChanged);
    else if (media.addListener) media.addListener(systemChanged);
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    try {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
    } catch (_) { return; }
    preference = validPreference(event.newValue) ? event.newValue : 'system';
    apply();
  });
})();
