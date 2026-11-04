(function () {
  var themeKey = 'arcode_lexreview_theme';
  try {
    var savedTheme = window.localStorage.getItem(themeKey);
    var systemTheme =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    var resolvedTheme = savedTheme
      ? savedTheme === 'light' ? 'light' : 'dark'
      : systemTheme;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  // Keep the callback same-origin. Never forward authorization codes or tokens to another window.
  // Supabase JS on the app root consumes the PKCE code/hash after this navigation.
  var callbackData = window.location.search + window.location.hash;
  window.location.replace('/' + callbackData);
})();
