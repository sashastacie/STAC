/* STAC visitor stats: GoatCounter (goatcounter.com). No cookies, no personal
   data, so no consent banner is needed. Page views are counted automatically;
   window.stacTrack(name, title) counts an event (e.g. a chat opening).
   Nothing a visitor types is ever sent, only that something happened.
   GoatCounter skips localhost, so local testing doesn't pollute the stats. */
(function(){
  'use strict';
  var GC_CODE = 'stac';   // GoatCounter site code; dashboard at https://stac.goatcounter.com

  var queue = [];
  function ready(){ return window.goatcounter && typeof window.goatcounter.count === 'function'; }
  window.stacTrack = function(name, title){
    var ev = { path: String(name), title: String(title || name), event: true };
    if (ready()) window.goatcounter.count(ev);
    else if (queue.length < 50) queue.push(ev);
  };
  window.STAC_ANALYTICS = { provider: 'goatcounter', configured: !!GC_CODE };

  // Clicks worth knowing about, counted in one place (queued until stats are switched on)
  document.addEventListener('click', function(e){
    var el = e.target && e.target.closest ? e.target.closest('a[href], #bnl, #ben') : null;
    if (!el) return;
    if (el.id === 'bnl') return window.stacTrack('switch-to-dutch', 'Switched to Dutch');
    if (el.id === 'ben') return;
    var h = el.getAttribute('href') || '';
    if (/instagram\.com/i.test(h)) window.stacTrack('click-instagram', 'Instagram link');
    else if (/tiktok\.com/i.test(h)) window.stacTrack('click-tiktok', 'TikTok link');
    else if (/linkedin\.com/i.test(h)) window.stacTrack('click-linkedin', 'LinkedIn link');
    else if (/^mailto:/i.test(h)) window.stacTrack('click-email', 'E-mail link');
    else if (el.classList.contains('wk-skip')) window.stacTrack(h === '#about' ? 'flythrough-skip-to-about' : 'flythrough-back-to-services', 'Fly-through exit button');
  }, true);

  if (!GC_CODE) return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', 'https://' + GC_CODE + '.goatcounter.com/count');
  s.onload = function(){
    var tries = 0, t = setInterval(function(){
      if (ready()) { clearInterval(t); queue.splice(0).forEach(function(ev){ window.goatcounter.count(ev); }); }
      else if (++tries > 25) clearInterval(t);
    }, 200);
  };
  document.head.appendChild(s);
})();
