if (new URLSearchParams(location.search).get('settingsOnly') === '1') {
  document.documentElement.classList.add('settings-only');
}
