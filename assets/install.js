/* Gitgather — "Install app" (PWA) for Android, iOS and desktop. Classic script, loaded early on every page
   so the beforeinstallprompt event is never missed. Wires every [data-install] element and #installBar. */
(function () {
  var deferred = null;
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS|Firefox|SamsungBrowser/i.test(ua);
  var isFirefox = /Firefox|FxiOS/i.test(ua);
  function standalone() {
    return (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || matchMedia('(display-mode: minimal-ui)').matches)) || navigator.standalone === true;
  }
  window.ggIsStandalone = standalone;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {}); });
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; refresh(); });
  window.addEventListener('appinstalled', function () { deferred = null; try { localStorage.setItem('gg-installed', '1'); } catch (_) {} refresh(); });

  function els() { return Array.prototype.slice.call(document.querySelectorAll('[data-install], #installBar')); }
  function refresh() {
    var hide = standalone();
    els().forEach(function (el) { el.hidden = hide; });
  }

  function modal(title, bodyHtml) {
    var d = document.createElement('dialog');
    d.className = 'dlg install-dlg';
    d.innerHTML = '<form method="dialog"><div class="dlg-head"><h3>' + title + '</h3><button class="icon-btn" value="x" aria-label="Close">✕</button></div>' + bodyHtml +
      '<div class="row-btns"><button class="btn primary" value="ok">OK</button></div></form>';
    document.body.appendChild(d);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    d.addEventListener('close', function () { d.remove(); });
  }
  var shareIcon = '<svg class="ios-share" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2l4 4-1.4 1.4L13 5.8V15h-2V5.8L9.4 7.4 8 6l4-4zM5 10h3v2H6v8h12v-8h-2v-2h3a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V11a1 1 0 011-1z"/></svg>';
  function steps(list) {
    return '<div class="install-steps"><ol>' + list.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol></div>' +
      '<p class="small muted" style="margin:0">After installing, sign in with GitHub once — you stay signed in.</p>';
  }

  function install() {
    if (standalone()) return;
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; refresh(); });
      return;
    }
    if (isIOS) {
      modal('📲 Install on iPhone', steps(isSafari
        ? ['Tap the Share button ' + shareIcon + ' in Safari\'s toolbar.', 'Scroll down and choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b> — Gitgather appears on your Home Screen.']
        : ['Open this page in <b>Safari</b> (iPhone apps install from Safari).', 'Tap the Share button ' + shareIcon + '.', 'Choose <b>Add to Home Screen</b>, then <b>Add</b>.']));
      return;
    }
    if (isAndroid) {
      modal('📲 Install on Android', steps(['Open the browser menu <b>⋮</b> (Chrome).', 'Tap <b>Install app</b> or <b>Add to Home screen</b>.', 'Confirm — Gitgather installs like an app.']));
      return;
    }
    if (isSafari) {
      modal('💻 Install on Mac', steps(['In Safari, open the <b>File</b> menu.', 'Choose <b>Add to Dock…</b>, then <b>Add</b>.']));
      return;
    }
    if (isFirefox) {
      modal('💻 Install on desktop', steps(['Firefox can\'t install web apps.', 'Open this page in <b>Chrome</b> or <b>Edge</b> and press “Install app” (or the install icon ⊕ in the address bar).']));
      return;
    }
    modal('💻 Install on desktop', steps(['Click the install icon <b>⊕</b> in the address bar,', 'or open the <b>⋮</b> menu → <b>Install Gitgather</b> / <b>Apps → Install this site as an app</b>.']));
  }
  window.ggInstall = install;

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-install]');
    if (t) { e.preventDefault(); install(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh); else refresh();
  if (window.matchMedia) { try { matchMedia('(display-mode: standalone)').addEventListener('change', refresh); } catch (_) {} }
  document.addEventListener('gg:layout', refresh);
})();
