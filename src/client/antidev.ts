declare const DisableDevtool: (opts?: Record<string, any>) => void;

(function () {
  if ((window as any).__antidev) return;
  (window as any).__antidev = true;

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  function hardBlock() {
    if ((window as any).__hardBlocked) return;
    (window as any).__hardBlocked = true;
    try {
      document.body.innerHTML = '';
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#0d0d0d;color:#ff5252;display:flex;align-items:center;justify-content:center;font:16px/1.6 system-ui,sans-serif;text-align:center;padding:20px;';
      overlay.textContent = 'Đã phát hiện công cụ kiểm tra (DevTools). Trang đã bị khóa.';
      document.body.appendChild(overlay);
    } catch (e) {}
    try {
      const video = document.querySelector('video');
      if (video) video.pause();
    } catch (e) {}
    try {
      window.opener = null;
      window.open('', '_self');
      window.close();
    } catch (e) {}
  }

  document.addEventListener('keydown', function (e) {
    const k = (e.key || '').toUpperCase();
    if (e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'J' || k === 'C' || k === 'S')) ||
        (e.ctrlKey && k === 'U') ||
        (e.metaKey && k === 'I')) {
      e.preventDefault();
      e.stopPropagation();
      hardBlock();
    }
  }, true);

  if (!isTouch) {
    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      hardBlock();
    }, true);
  }

  setInterval(function () {
    (function () { debugger; })();
  }, 250);

  if (!isTouch) {
    let sizeHits = 0;
    function checkSize() {
      const w = window.outerWidth - window.innerWidth;
      const h = window.outerHeight - window.innerHeight;
      const suspicious = (w > 200 && h > 300) || w > 500;
      sizeHits = suspicious ? sizeHits + 1 : 0;
      if (sizeHits >= 2) hardBlock();
    }
    window.addEventListener('resize', checkSize);
    setInterval(checkSize, 1000);
  }

  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (m) {
    const orig = (console as any)[m];
    (console as any)[m] = function () {
      const args = Array.prototype.slice.call(arguments);
      orig.apply(console, ['\u2588\u2588\u25a0\u25cf\u25b0\u25a0'].concat(args));
    };
  });

  if (!isTouch && typeof DisableDevtool !== 'undefined') {
    DisableDevtool({
      ondevtoolopen: function (type: unknown, next: () => void) {
        try { next(); } catch (e) {}
        hardBlock();
      },
      disableMenu: true,
      clearLog: true,
      interval: 500,
      detectors: 'all',
      clearIntervalWhenDevOpenTrigger: false,
      rewriteHTML: '<div style="position:fixed;inset:0;z-index:999999;background:#0d0d0d;color:#ff5252;display:flex;align-items:center;justify-content:center;font:16px system-ui,sans-serif;text-align:center;">Đã phát hiện công cụ kiểm tra (DevTools). Trang đã bị khóa.</div>',
    });
  }
})();
