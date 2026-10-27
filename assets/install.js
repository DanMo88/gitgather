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
      '<div class="row-btns"><button class="btn primary" value="ok">OK · باشه</button></div></form>';
    document.body.appendChild(d);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    d.addEventListener('close', function () { d.remove(); });
  }
  var shareIcon = '<svg class="ios-share" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2l4 4-1.4 1.4L13 5.8V15h-2V5.8L9.4 7.4 8 6l4-4zM5 10h3v2H6v8h12v-8h-2v-2h3a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V11a1 1 0 011-1z"/></svg>';
  function steps(fa, en) {
    return '<div class="install-steps"><ol dir="rtl" lang="fa">' + fa.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      '<ol dir="ltr" lang="en">' + en.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol></div>' +
      '<p class="small muted">بعد از نصب، فقط یک بار با GitHub وارد شو؛ دفعه‌های بعد خودکار وارد می‌شوی.<br>After installing, sign in with GitHub once — you stay signed in.</p>';
  }

  function install() {
    if (standalone()) return;
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; refresh(); });
      return;
    }
    if (isIOS) {
      if (!isSafari) {
        modal('📲 نصب روی آیفون · Install on iPhone', steps(
          ['این صفحه را در <b>Safari</b> باز کن (روی آیفون نصب فقط از Safari ممکن است).', 'دکمه‌ی اشتراک‌گذاری ' + shareIcon + ' را بزن.', '<b>Add to Home Screen</b> را انتخاب کن و <b>Add</b> را بزن.'],
          ['Open this page in <b>Safari</b> (iPhone apps install from Safari).', 'Tap the Share button ' + shareIcon + '.', 'Choose <b>Add to Home Screen</b>, then <b>Add</b>.']));
      } else {
        modal('📲 نصب روی آیفون · Install on iPhone', steps(
          ['دکمه‌ی اشتراک‌گذاری ' + shareIcon + ' پایین (یا بالای) صفحه را بزن.', 'پایین برو و <b>Add to Home Screen</b> را انتخاب کن.', '<b>Add</b> را بزن — آیکون Gitgather روی صفحه‌ی اصلی می‌آید.'],
          ['Tap the Share button ' + shareIcon + ' in Safari\'s toolbar.', 'Scroll down and choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b> — Gitgather appears on your Home Screen.']));
      }
      return;
    }
    if (isAndroid) {
      modal('📲 نصب روی اندروید · Install on Android', steps(
        ['منوی مرورگر <b>⋮</b> (Chrome) را باز کن.', '<b>Install app</b> یا <b>Add to Home screen</b> را بزن.', 'تأیید کن — Gitgather مثل یک اپ نصب می‌شود.'],
        ['Open the browser menu <b>⋮</b> (Chrome).', 'Tap <b>Install app</b> or <b>Add to Home screen</b>.', 'Confirm — Gitgather installs like an app.']));
      return;
    }
    if (isSafari) {
      modal('💻 نصب روی مک · Install on Mac', steps(
        ['در Safari منوی <b>File</b> را باز کن.', '<b>Add to Dock…</b> را بزن و <b>Add</b> را تأیید کن.'],
        ['In Safari open the <b>File</b> menu.', 'Choose <b>Add to Dock…</b>, then <b>Add</b>.']));
      return;
    }
    if (isFirefox) {
      modal('💻 نصب روی کامپیوتر · Install on desktop', steps(
        ['Firefox نصب اپ وب را پشتیبانی نمی‌کند.', 'این صفحه را در <b>Chrome</b> یا <b>Edge</b> باز کن و دکمه‌ی «نصب اپ» را بزن (یا آیکون نصب ⊕ در نوار آدرس).'],
        ['Firefox can\'t install web apps.', 'Open this page in <b>Chrome</b> or <b>Edge</b> and press “Install app” (or the install icon ⊕ in the address bar).']));
      return;
    }
    modal('💻 نصب روی کامپیوتر · Install on desktop', steps(
      ['در نوار آدرس روی آیکون نصب <b>⊕</b> کلیک کن،', 'یا از منوی <b>⋮</b> گزینه‌ی <b>Install Gitgather</b> / <b>Apps → Install this site as an app</b> را بزن.'],
      ['Click the install icon <b>⊕</b> in the address bar,', 'or open the <b>⋮</b> menu → <b>Install Gitgather</b> / <b>Apps → Install this site as an app</b>.']));
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
