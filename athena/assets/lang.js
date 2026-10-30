/* 언어 주소 · 언어 링크. 페이지는 언어마다 따로 있다 — 영어 / · /features/ …, 그 밖의 언어 /ko/ · /ja/ · /zh/ 아래 같은 경로.
   언어판은 deploy/gen-athena-lang.mjs 가 영어 페이지와 /assets/i18n/<언어>.js 사전으로 미리 만들어 둔다(브라우저에서 바꾸지 않는다).
   언어 정하기: ?lang= 이 붙은 예전 링크 → 그 언어 주소로. 영어 주소에서는 이 브라우저에서 고른 언어(localStorage)가 있으면 그 주소로.
   언어 주소(/ko/ …)로 들어오면 그 언어 그대로. 브라우저 언어는 보지 않는다(덕배 2026-10-28, 처음은 늘 영어) */
(function () {
  var LANGS = ['en', 'ko', 'ja', 'zh'];
  var KEY = 'athena-lang';
  var PREFIX = /^\/(ko|ja|zh)(\/|$)/;
  var found = PREFIX.exec(location.pathname);
  var page = found ? found[1] : 'en';

  // 같은 페이지의 다른 언어 주소(?lang= 은 빼고 나머지 검색어 · #절은 그대로)
  function urlFor(l) {
    var rest = location.pathname.replace(PREFIX, '/');
    var search = '';
    try {
      var params = new URLSearchParams(location.search);
      params['delete']('lang');
      search = params.toString();
    } catch (e) {}
    return (l === 'en' ? '' : '/' + l) + rest + (search ? '?' + search : '') + location.hash;
  }

  function wanted() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    if (LANGS.indexOf(q) >= 0) return q;
    if (page !== 'en') return page;
    try { var s = localStorage.getItem(KEY); if (LANGS.indexOf(s) >= 0) return s; } catch (e) {}
    return 'en';
  }

  var want = wanted();
  if (want !== page) {
    location.replace(urlFor(want));
    return;
  }

  // 큰 제목 금빛 점등 — 처음 한 번만. 글자를 span 으로 나눠 CSS 가 왼→오로 차례로 켠다.
  // 모션 줄이기 설정이면 나누지 않고 바로 보인다.
  function glowTitle() {
    var el = document.querySelector('h1[data-t="n.h1"]');
    if (!el) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var plain = el.textContent;
    var lines = el.innerHTML.split(/<br\s*\/?>/i);
    var holder = document.createElement('span');
    var index = 0;
    holder.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < lines.length; i++) {
      var line = document.createElement('span');
      line.className = 'gl-ln';
      var tmp = document.createElement('div');
      tmp.innerHTML = lines[i];
      var words = tmp.textContent.split(' ');
      for (var w = 0; w < words.length; w++) {
        var word = document.createElement('span');
        word.className = 'gl-w';
        var chars = Array.from(words[w]);
        for (var c = 0; c < chars.length; c++) {
          var ch = document.createElement('span');
          ch.className = 'gl-c';
          ch.style.setProperty('--i', index++);
          ch.textContent = chars[c];
          word.appendChild(ch);
        }
        line.appendChild(word);
        if (w < words.length - 1) { line.appendChild(document.createTextNode(' ')); index++; }
      }
      holder.appendChild(line);
    }
    el.setAttribute('aria-label', plain);
    el.textContent = '';
    el.appendChild(holder);
    el.classList.add('gl');
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

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    glowTitle();
    document.addEventListener('click', function (e) {
      // 언어 링크: 고른 언어를 기억하고 같은 페이지의 그 언어 주소로(#절 유지). JS 가 없어도 href 로 간다
      var b = e.target.closest('[data-set-lang]');
      if (b) {
        var l = b.getAttribute('data-set-lang');
        try { localStorage.setItem(KEY, l); } catch (e2) {}
        e.preventDefault();
        if (l !== page) location.href = urlFor(l);
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
