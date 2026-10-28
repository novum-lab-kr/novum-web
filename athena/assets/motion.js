/* 움직임: 스크롤해 들어오는 칸을 부드럽게 올리고, 구조도는 칸 → 화살표 순서로 그린다.
   동작 줄이기를 켠 사람은 그대로 둔다(내용은 처음부터 보인다).
   IntersectionObserver 는 빠르게 지나친 칸에 알림을 주지 않아서, 스크롤 위치로 직접 판단한다 —
   화면 아래 경계보다 위에 있는 칸(이미 지나간 칸 포함)은 모두 보이게 한다 */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SEL = '.h3-sec h2, .h3-sec .h3-p, .h3-quote, .h3-panel, .h3-code, .h3-start > *, .h3-facts > div, .h3-end .wrap > *,' +
    ' .feat .txt, .feat figure, .feat .pair, .sec-head, .three > div, .rel, .faq details, .sec-grid > div, .key, .cmp, .story .beat > *';
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
  // 모든 점이 같은 주기(CYCLE)를 쓰고 자기 차례에만 보이게 해서, 점 하나가 끝까지 흘러가는 것처럼 보인다
  var NS = 'http://www.w3.org/2000/svg';
  function startPulses(svg) {
    var lines = [].slice.call(svg.querySelectorAll('.fd-l')).filter(function (p) {
      try { return p.getTotalLength() > 20; } catch (e) { return false; }
    });
    if (!lines.length) return;
    var CYCLE = Math.max(4, lines.length * 0.9), slot = 0.9 / lines.length;
    lines.forEach(function (p, i) {
      if (!p.id) p.id = 'fdp-' + Math.random().toString(36).slice(2, 9);
      var a = 0.02 + i * slot, b = a + slot * 0.9, e = slot * 0.12;
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', '3.6');
      c.setAttribute('class', 'fd-pulse');
      c.setAttribute('opacity', '0');
      var mv = document.createElementNS(NS, 'animateMotion');
      mv.setAttribute('dur', CYCLE + 's'); mv.setAttribute('repeatCount', 'indefinite');
      mv.setAttribute('calcMode', 'linear');
      mv.setAttribute('keyPoints', '0;0;1;1'); mv.setAttribute('keyTimes', '0;' + a.toFixed(4) + ';' + b.toFixed(4) + ';1');
      var mp = document.createElementNS(NS, 'mpath');
      mp.setAttribute('href', '#' + p.id); mp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + p.id);
      mv.appendChild(mp);
      var op = document.createElementNS(NS, 'animate');
      op.setAttribute('attributeName', 'opacity'); op.setAttribute('dur', CYCLE + 's'); op.setAttribute('repeatCount', 'indefinite');
      op.setAttribute('values', '0;0;1;1;0;0');
      op.setAttribute('keyTimes', ['0', a, a + e, b - e, b, '1'].map(function (v) { return typeof v === 'number' ? v.toFixed(4) : v; }).join(';'));
      c.appendChild(mv); c.appendChild(op);
      p.parentNode.insertBefore(c, p.nextSibling);
      try { mv.beginElement(); op.beginElement(); } catch (err) {}
    });
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
