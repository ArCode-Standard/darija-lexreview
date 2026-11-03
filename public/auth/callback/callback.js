(function () {
  var themeKey = 'arcode_lexreview_theme';
  try {
    var savedTheme = window.localStorage.getItem(themeKey);
    document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  // Keep the callback same-origin. Never forward auth codes or tokens to window.opener.
  // Supabase JS on the app root consumes the PKCE code/hash after this navigation.
  var callbackData = window.location.search + window.location.hash;
  window.location.replace('/' + callbackData);
})();
