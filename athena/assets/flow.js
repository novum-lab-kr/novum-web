/* 메인 흐름 그림: 카드 사이 연결선을 SVG 로 그리고, 카드에 올리거나 눌러 이어진 선만 켠다.
   카드 · 선 위치는 화면에서 직접 재서 그리므로 언어가 바뀌어 글 길이가 달라져도 다시 그린다.
   JS 가 없으면 카드만 보인다(내용은 그대로). 동작 줄이기를 켠 사람은 움직임 없이 켜고 끄기만 된다 */
(function () {
  var fig = document.querySelector('.hf');
  if (!fig) return;
  var board = fig.querySelector('.hf-board'), svg = fig.querySelector('.hf-wires');
  var nodes = [].slice.call(fig.querySelectorAll('.hf-node')), byId = {}, wires = [], pinned = null;
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  nodes.forEach(function (node, i) { byId[node.id.replace('hf-', '')] = node; node.style.setProperty('--i', i); });

  // 이어진 쌍: 주 흐름(카드의 data-next) + 다시 돌아오는 두 선(n) + 에이전트가 나에게 묻는 선(q)
  var edges = [];
  nodes.forEach(function (node) {
    (node.getAttribute('data-next') || '').split(' ').forEach(function (to) {
      if (to) edges.push({ from: node.id.replace('hf-', ''), to: to, kind: 'm' });
    });
  });
  edges.push({ from: 'merge', to: 'agents', kind: 'n' }, { from: 'notes', to: 'athena', kind: 'n' }, { from: 'agents', to: 'you', kind: 'q' });

  // 카드 위치는 등장 효과(transform)에 영향받지 않는 레이아웃 좌표로 잰다
  function rect(node) {
    var x = 0, y = 0, el = node, w = node.offsetWidth, h = node.offsetHeight;
    while (el && el !== board) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { l: x, r: x + w, t: y, b: y + h, cx: x + w / 2, cy: y + h / 2 };
  }
  // 꺾이는 곳을 둥글게 깎은 꺾은선
  function round(pts, rad) {
    var d = 'M' + pts[0][0] + ' ' + pts[0][1], i;
    for (i = 1; i < pts.length - 1; i++) {
      var p = pts[i - 1], c = pts[i], n = pts[i + 1];
      var l1 = Math.hypot(c[0] - p[0], c[1] - p[1]), l2 = Math.hypot(n[0] - c[0], n[1] - c[1]), k = Math.min(rad, l1 / 2, l2 / 2);
      d += ' L' + (c[0] - (c[0] - p[0]) / l1 * k) + ' ' + (c[1] - (c[1] - p[1]) / l1 * k) +
        ' Q' + c[0] + ' ' + c[1] + ' ' + (c[0] + (n[0] - c[0]) / l2 * k) + ' ' + (c[1] + (n[1] - c[1]) / l2 * k);
    }
    return d + ' L' + pts[pts.length - 1][0] + ' ' + pts[pts.length - 1][1];
  }
  function route(e) {
    var a = rect(byId[e.from]), b = rect(byId[e.to]), W = board.clientWidth;
    if (e.kind === 'q') return [[a.l, a.cy], [14, a.cy], [14, b.cy], [b.l, b.cy]];
    if (e.from === 'notes') return [[a.r, a.cy], [W - 14, a.cy], [W - 14, 14], [b.cx, 14], [b.cx, b.t]];
    if (e.kind === 'n' && Math.abs(a.cy - b.cy) < 8) return [[a.cx, a.t], [a.cx, a.t - 22], [b.cx + 20, a.t - 22], [b.cx + 20, b.t]];
    if (Math.abs(a.cy - b.cy) < 8) return [[a.r, a.cy], [b.l, b.cy]];
    var mid = (a.b + b.t) / 2;
    if (e.kind === 'n') return [[a.cx, a.t], [a.cx, mid + 16], [b.cx + 20, mid + 16], [b.cx + 20, b.t]];
    return [[a.cx, a.b], [a.cx, mid - 8], [b.cx, mid - 8], [b.cx, b.t]];
  }
  // 화살촉이 카드 테두리에 가려지지 않게 끝을 카드에서 살짝 띄운다
  function trim(pts, gap) {
    var l = pts[pts.length - 1], p = pts[pts.length - 2], len = Math.hypot(l[0] - p[0], l[1] - p[1]);
    if (len > gap * 2) pts[pts.length - 1] = [l[0] - (l[0] - p[0]) / len * gap, l[1] - (l[1] - p[1]) / len * gap];
    return pts;
  }
  function marker(kind, on) { return 'url(#hf-ah-' + (on ? 'on' : kind) + ')'; }

  function draw() {
    if (getComputedStyle(svg).display === 'none') return;
    var w = board.clientWidth, h = board.clientHeight;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML = '<defs>' + ['m', 'n', 'q', 'on'].map(function (k) {
      return '<marker id="hf-ah-' + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M1 1.2L9 5L1 8.8Q2.6 5 1 1.2z" class="hf-head' + (k === 'm' ? '' : '-' + k) + '"/></marker>';
    }).join('') + '</defs>';
    // 좁은 화면(2열)에서는 주 흐름 선만 그린다. 돌아오는 선 · 묻는 선은 아래 뜻풀이 글로 대신한다
    var narrow = window.matchMedia && matchMedia('(max-width: 760px)').matches;
    wires = edges.filter(function (e) { return !narrow || e.kind === 'm'; }).map(function (e) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', round(trim(route(e), 5), 12));
      p.setAttribute('class', 'hf-w' + (e.kind === 'n' ? ' hf-wn' : e.kind === 'q' ? ' hf-wq' : ''));
      p.setAttribute('marker-end', marker(e.kind, false));
      svg.appendChild(p);
      return { el: p, e: e };
    });
    paint();
  }

  // 올리거나 고정한 카드와 닿은 카드 · 선을 켠다
  function paint(hot) {
    var focus = hot || pinned, on = {}, lit;
    if (focus) {
      on[focus] = true;
      edges.forEach(function (e) { if (e.from === focus) on[e.to] = true; if (e.to === focus) on[e.from] = true; });
      lit = function (e) { return e.from === focus || e.to === focus; };
    } else lit = function () { return false; };
    board.classList.toggle('has-focus', !!focus);
    nodes.forEach(function (node) {
      var id = node.id.replace('hf-', '');
      node.classList.toggle('is-on', !!on[id]);
      node.classList.toggle('is-pin', pinned === id);
      node.firstElementChild.setAttribute('aria-pressed', pinned === id ? 'true' : 'false');
    });
    wires.forEach(function (w) {
      var isLit = lit(w.e);
      w.el.classList.toggle('is-on', isLit);
      w.el.setAttribute('marker-end', marker(w.e.kind, isLit));
    });
  }

  nodes.forEach(function (node) {
    var id = node.id.replace('hf-', ''), btn = node.firstElementChild;
    node.addEventListener('mouseenter', function () { paint(id); });
    node.addEventListener('mouseleave', function () { paint(); });
    btn.addEventListener('focus', function () { paint(id); });
    btn.addEventListener('blur', function () { paint(); });
    btn.addEventListener('click', function () { pinned = pinned === id ? null : id; paint(id); });
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && pinned) { pinned = null; paint(); } });
  document.addEventListener('click', function (ev) { if (pinned && !fig.contains(ev.target)) { pinned = null; paint(); } });

  // 처음 화면에 들어올 때 한 번: 카드가 차례로 올라오고 선이 나타난다
  fig.classList.add('hf-js');
  function reveal() { fig.classList.add('hf-in'); }
  if (reduce || !('IntersectionObserver' in window)) reveal();
  else new IntersectionObserver(function (es, ob) { if (es[0].isIntersecting) { reveal(); ob.disconnect(); } }, { threshold: 0.25 }).observe(board);

  // 글 길이 · 화면 크기가 바뀌면(언어 바꿈 포함) 선을 다시 그린다
  var raf = 0;
  function redraw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(redraw); ro.observe(board); nodes.forEach(function (node) { ro.observe(node); }); }
  else window.addEventListener('resize', redraw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  draw();
})();
