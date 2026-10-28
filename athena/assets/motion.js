/* 움직임: 스크롤해 들어오는 칸을 부드럽게 올리고, 구조도는 칸 → 화살표 순서로 그린다.
   동작 줄이기를 켠 사람은 그대로 둔다(내용은 처음부터 보인다).
   IntersectionObserver 는 빠르게 지나친 칸에 알림을 주지 않아서, 스크롤 위치로 직접 판단한다 —
   화면 아래 경계보다 위에 있는 칸(이미 지나간 칸 포함)은 모두 보이게 한다 */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SEL = '.h3-sec h2, .h3-sec .h3-p, .h3-quote, .h3-panel, .h3-code, .h3-start > *, .h3-facts > div, .h3-end .wrap > *,' +
    ' .feat .txt, .feat figure, .feat .pair, .sec-head, .three > div, .rel, .faq details, .sec-grid > div, .key, .cmp, .story .beat > *, .why-grid > div, .quad > div';
  var pending = [], diagrams = [];

  function playDiagram(svg) {
    var paths = [].slice.call(svg.querySelectorAll('.fd-l, .fd-n'));
    paths.forEach(function (p, i) {
      var len = 0, m = p.getAttribute('data-marker');
      try { len = p.getTotalLength(); } catch (e) {}
      if (!len) { if (m) p.setAttribute('marker-end', m); return; }
      p.style.transition = 'none';
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.getBoundingClientRect();
      p.style.transition = 'stroke-dashoffset .5s ease ' + (0.35 + i * 0.09) + 's';
      p.style.strokeDashoffset = 0;
      // 다 그린 뒤에는 그리기용 점선 설정을 지워 원래 선 모양(점선 등)으로 돌린다
      setTimeout(function () {
        if (m) p.setAttribute('marker-end', m);
        p.style.transition = ''; p.style.strokeDasharray = ''; p.style.strokeDashoffset = '';
      }, (0.35 + i * 0.09 + 0.5) * 1000);
    });
    svg.classList.add('fd-play');
    setTimeout(function () { startPulses(svg); }, (0.35 + paths.length * 0.09 + 0.6) * 1000);
  }

  // 다 그린 뒤 계속 도는 움직임: 금빛 점 하나가 흐름 순서(문서 순서)대로 선을 하나씩 타고 지나간다.
  // 선 길이에 맞춰 같은 빠르기(SPEED)로 가고, 선 사이에서 잠깐 쉰다. 모든 점이 같은 주기(cycle)를 쓰고
  // 자기 차례에만 보여서 점 하나가 끝까지 흘러가는 것처럼 보인다(Codex 4차: 선마다 같은 시간이면 긴 선에서 튄다)
  var NS = 'http://www.w3.org/2000/svg', SPEED = 95, MIN = 0.55, REST = 0.35;
  function startPulses(svg) {
    var lines = [], t = 0.3;
    [].forEach.call(svg.querySelectorAll('.fd-l'), function (p) {
      var len = 0;
      try { len = p.getTotalLength(); } catch (e) {}
      if (len <= 20) return;
      var d = Math.max(MIN, len / SPEED);
      lines.push({ p: p, s: t, d: d });
      t += d + REST;
    });
    if (!lines.length) return;
    var cycle = t + 1.2, f = function (v) { return (v / cycle).toFixed(4); };
    lines.forEach(function (L) {
      var p = L.p;
      if (!p.id) p.id = 'fdp-' + Math.random().toString(36).slice(2, 9);
      var e = Math.min(0.12, L.d / 4);
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', '2.8');
      c.setAttribute('class', 'fd-pulse');
      c.setAttribute('opacity', '0');
      var mv = document.createElementNS(NS, 'animateMotion');
      mv.setAttribute('dur', cycle.toFixed(2) + 's'); mv.setAttribute('repeatCount', 'indefinite');
      mv.setAttribute('calcMode', 'linear');
      mv.setAttribute('keyPoints', '0;0;1;1'); mv.setAttribute('keyTimes', '0;' + f(L.s) + ';' + f(L.s + L.d) + ';1');
      var mp = document.createElementNS(NS, 'mpath');
      mp.setAttribute('href', '#' + p.id); mp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + p.id);
      mv.appendChild(mp);
      var op = document.createElementNS(NS, 'animate');
      op.setAttribute('attributeName', 'opacity'); op.setAttribute('dur', cycle.toFixed(2) + 's'); op.setAttribute('repeatCount', 'indefinite');
      op.setAttribute('values', '0;0;1;1;0;0');
      op.setAttribute('keyTimes', ['0', f(L.s), f(L.s + e), f(L.s + L.d - e), f(L.s + L.d), '1'].join(';'));
      c.appendChild(mv); c.appendChild(op);
      p.parentNode.insertBefore(c, p.nextSibling);
      try { mv.beginElement(); op.beginElement(); } catch (err) {}
    });
    watch(svg);
  }

  // 화면 밖이거나 탭이 숨으면 멈추고, 돌아오면 이어서. [일시정지]로 멈춘 것은 저절로 다시 돌지 않는다
  function setRun(svg) {
    var fig = svg.closest('.flowd'), run = !fig.classList.contains('fd-user-pause') && svg._seen && !document.hidden;
    try { run ? svg.unpauseAnimations() : svg.pauseAnimations(); } catch (e) {}
    svg.classList.toggle('fd-paused', !run);
  }
  function watch(svg) {
    svg._seen = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (en) { svg._seen = en.isIntersecting; setRun(svg); }); }).observe(svg);
    }
    document.addEventListener('visibilitychange', function () { setRun(svg); });
    var fig = svg.closest('.flowd');
    if (fig.querySelector('.fd-toggle')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fd-toggle'; b.setAttribute('aria-label', 'Pause animation');
    b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path class="i-pause" d="M5 3.5v9M11 3.5v9"/><path class="i-play" d="M5 3.2l8 4.8-8 4.8z"/></svg>';
    b.addEventListener('click', function () {
      var off = fig.classList.toggle('fd-user-pause');
      b.setAttribute('aria-label', off ? 'Play animation' : 'Pause animation');
      [].forEach.call(fig.querySelectorAll('svg.fd-play'), setRun);
    });
    fig.appendChild(b);
  }

  function check() {
    var line = window.innerHeight * 0.92;
    pending = pending.filter(function (el) {
      if (el.getBoundingClientRect().top < line) { el.classList.add('in'); return false; }
      return true;
    });
    diagrams = diagrams.filter(function (svg) {
      var r = svg.getBoundingClientRect();
      if (!r.height) return true; // 숨은 쪽(모바일 · 데스크톱 중 안 쓰는 그림)은 기다린다
      if (r.top < window.innerHeight * 0.75) { playDiagram(svg); return false; }
      return true;
    });
    if (!pending.length && !diagrams.length) {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    }
  }

  // 화면 그리기 타이밍(requestAnimationFrame)에 기대지 않고 스크롤마다 바로 판단한다(칸 수가 적어 가볍다)
  function onScroll() { check(); }

  function init() {
    var vh = window.innerHeight;
    // 처음 화면에 보이는 것은 건드리지 않는다(깜빡임 방지)
    [].forEach.call(document.querySelectorAll(SEL), function (el) {
      if (el.getBoundingClientRect().top < vh * 0.92) return;
      el.classList.add('rv');
      pending.push(el);
    });
    [].forEach.call(document.querySelectorAll('.flowd svg'), function (svg) {
      [].forEach.call(svg.querySelectorAll('g'), function (g, i) { g.style.transitionDelay = (i * 0.07) + 's'; });
      svg.classList.add('fd-wait');
      // 화살촉은 선이 다 그려진 뒤에 붙인다
      [].forEach.call(svg.querySelectorAll('.fd-l, .fd-n'), function (p) {
        var m = p.getAttribute('marker-end');
        if (m) { p.setAttribute('data-marker', m); p.removeAttribute('marker-end'); }
      });
      diagrams.push(svg);
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    check();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
