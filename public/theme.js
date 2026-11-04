(function () {
  var STORAGE_KEY = 'arcode_lexreview_theme';

  function getStoredTheme() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (_) {
      // Ignore storage access errors in restricted contexts
    }
    return null;
  }

  function getSystemTheme() {
    try {
      if (window.matchMedia) {
        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
          return 'light';
        }
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return 'dark';
        }
      }
    } catch (_) {
      // Ignore matchMedia errors
    }
    return 'dark';
  }

  function getPreferredTheme() {
    var stored = getStoredTheme();
    if (stored) {
      return stored;
    }
    return getSystemTheme();
  }

  function syncToggleButtons(theme) {
    var isDark = theme === 'dark';
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    var label = isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي';
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
  }

  function applyTheme(theme) {
    var resolved = theme === 'light' ? 'light' : 'dark';
    var isDark = resolved === 'dark';
    var root = document.documentElement;

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', resolved);

    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#050507' : '#FAFAFC');
    }

    syncToggleButtons(resolved);
  }

  applyTheme(getPreferredTheme());

  document.addEventListener('DOMContentLoaded', function () {
    syncToggleButtons(getPreferredTheme());
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    var toggleBtn = target.closest('[data-theme-toggle]');
    if (!toggleBtn) return;

    event.preventDefault();
    var current = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
    var next = current === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {
      // Ignore storage write errors
    }
    applyTheme(next);
  });

  try {
    if (window.matchMedia) {
      var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      var onSystemChange = function () {
        if (!getStoredTheme()) {
          applyTheme(getSystemTheme());
        }
      };
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', onSystemChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(onSystemChange);
      }
    }
  } catch (_) {
    // Ignore matchMedia subscription errors
  }

  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY) {
      if (event.newValue === 'light' || event.newValue === 'dark') {
        applyTheme(event.newValue);
      } else {
        applyTheme(getSystemTheme());
      }
    }
  });
})();
