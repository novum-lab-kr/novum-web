/* 언어 고르기 · 바꾸기. 페이지는 영어 원문을 담고, data-t 키가 있는 곳만 /assets/i18n/<언어>.js 사전으로 바꾼다.
   고르는 순서: ?lang= → 이 브라우저에서 고른 것(localStorage) → 브라우저 언어 → 영어 */
(function () {
  var LANGS = ['en', 'ko', 'ja', 'zh'];
  var NAMES = { en: 'EN', ko: '한국어', ja: '日本語', zh: '中文' };
  var KEY = 'athena-lang';
  var VER = '20261028b';
  var root = document.documentElement;
  var dicts = {};

  function pick() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (LANGS.indexOf(q) >= 0) return q;
    try { var s = localStorage.getItem(KEY); if (LANGS.indexOf(s) >= 0) return s; } catch (e) {}
    var list = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var c = String(list[i] || '').slice(0, 2).toLowerCase();
      if (LANGS.indexOf(c) >= 0) return c;
    }
    return 'en';
  }

  function setRoot(l) {
    root.lang = l === 'zh' ? 'zh-Hans' : l;
    root.setAttribute('data-lang', l);
  }

  function load(l, cb) {
    if (l === 'en') return cb({});
    if (dicts[l]) return cb(dicts[l]);
    var s = document.createElement('script');
    s.src = '/assets/i18n/' + l + '.js?v=' + VER;
    s.onload = function () { dicts[l] = (window.ATHENA_I18N || {})[l] || {}; cb(dicts[l]); };
    s.onerror = function () { cb({}); };
    document.head.appendChild(s);
  }

  function apply(l, d) {
    var i, el, k;
    var ts = document.querySelectorAll('[data-t]');
    for (i = 0; i < ts.length; i++) {
      el = ts[i];
      if (el._en == null) el._en = el.innerHTML;
      k = el.getAttribute('data-t');
      el.innerHTML = d[k] != null ? d[k] : el._en;
    }
    var as = document.querySelectorAll('[data-ta]');
    for (i = 0; i < as.length; i++) {
      el = as[i];
      el._ena = el._ena || {};
      var pairs = el.getAttribute('data-ta').split(',');
      for (var j = 0; j < pairs.length; j++) {
        var p = pairs[j].split(':'), attr = p[0].trim(), key = p[1].trim();
        if (el._ena[attr] == null) el._ena[attr] = el.getAttribute(attr) || '';
        el.setAttribute(attr, d[key] != null ? d[key] : el._ena[attr]);
      }
    }
    // 화면 언어에 맞는 앱 스크린샷(workspace-<언어>)
    var imgs = document.querySelectorAll('img[data-lang-src]');
    for (i = 0; i < imgs.length; i++) setShot(imgs[i], imgs[i].getAttribute('data-lang-src').replace('{l}', l));
    var cur = document.querySelectorAll('[data-set-lang]');
    for (i = 0; i < cur.length; i++) cur[i].setAttribute('aria-current', cur[i].getAttribute('data-set-lang') === l ? 'true' : 'false');
    var lab = document.querySelectorAll('[data-lang-label]');
    for (i = 0; i < lab.length; i++) lab[i].textContent = NAMES[l];
    var tabs = document.querySelectorAll('[data-tabs="lang"]');
    for (i = 0; i < tabs.length; i++) selectTab(tabs[i], l);
  }

  function setShot(img, base) {
    img.src = base + '.webp';
    img.srcset = base + '-1200.webp 1200w, ' + base + '.webp 2400w';
  }

  function selectTab(group, name) {
    var bs = group.querySelectorAll('[data-tab]');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-selected', bs[i].getAttribute('data-tab') === name ? 'true' : 'false');
    var scope = group.closest('[data-tab-scope]') || document;
    var ps = scope.querySelectorAll('[data-panel]');
    for (var j = 0; j < ps.length; j++) ps[j].hidden = ps[j].getAttribute('data-panel') !== name;
    var im = scope.querySelectorAll('img[data-tab-src]');
    for (var m = 0; m < im.length; m++) setShot(im[m], im[m].getAttribute('data-tab-src').replace('{l}', name));
  }

  function change(l) {
    try { localStorage.setItem(KEY, l); } catch (e) {}
    load(l, function (d) { setRoot(l); apply(l, d); });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  var lang = pick();
  setRoot(lang);
  if (lang !== 'en') {
    root.classList.add('i18n-wait');
    setTimeout(function () { root.classList.remove('i18n-wait'); }, 1500);
  }
  load(lang, function (d) {
    ready(function () { apply(lang, d); root.classList.remove('i18n-wait'); });
  });

  ready(function () {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-set-lang]');
      if (b) {
        e.preventDefault();
        change(b.getAttribute('data-set-lang'));
        var det = b.closest('details');
        if (det) det.open = false;
        return;
      }
      var t = e.target.closest('[data-tab]');
      if (t) selectTab(t.closest('[data-tabs]'), t.getAttribute('data-tab'));
      // 바깥을 누르면 언어 목록 닫기
      var open = document.querySelectorAll('details.lang[open]');
      for (var i = 0; i < open.length; i++) if (!open[i].contains(e.target)) open[i].open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = document.querySelectorAll('details.lang[open]');
      for (var i = 0; i < open.length; i++) open[i].open = false;
    });
  });
})();
