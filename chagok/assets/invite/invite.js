// 초대 페이지 동작 (chagok/invite/index.html).
// 1) 주소 /invite/<코드> 에서 코드를 읽어 [차곡차곡에서 열기]를 앱 주소(chagok://invite/<코드>)로 바꾼다.
// 2) 운영 서버의 초대 미리보기(preview_invite, 로그인 없이 부름)로 목표 이름과 함께하는 사람을 받아 넣는다.
//    공개 키는 앱에 들어 있는 것과 같은 anon 키다. 이 키로 로그인 없이 할 수 있는 일은 초대 미리보기뿐이고,
//    없는 코드를 한 곳에서 1시간에 30번 넣으면 서버가 rate_limited 를 돌려준다(앱 저장소 supabase/migrations/20261106000001~3).
// 3) 패널, 버튼, 배지의 계단 테두리를 앱 PixelFrame 과 같은 계산으로 그린다.
// 받은 값은 textContent 로만 넣는다(이름과 목표 이름은 사용자가 쓴 글이다).
(function () {
  'use strict';
  var API = 'https://chagok-api.novum-lab.com';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyNTg0MjgxLCJleHAiOjE5NTAyNjQyODF9.UikQs-z0POwDVf9PdS1YOxZBaXtZ1TDtI4DLllp6xCA';
  var CODE = /^[A-HJ-NP-Z2-9]{8}(?:[A-HJ-NP-Z2-9]{4})?$/;
  var INK = '#06261C', MINT = '#AFE1CB', LCD = '#C7DE94', APRICOT = '#FD855F', IVORY = '#FEF1D1';
  var SVG = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };

  // ── 계단 테두리 (앱 src/design-system/geometry.ts pixelOutline, components.tsx PixelFrame) ──
  function outline(w, h, inset, unit) {
    var x = inset, y = inset, r = w - inset, b = h - inset;
    if (r <= x || b <= y) return '';
    var u = Math.min(unit, (r - x) / 4, (b - y) / 4);
    return 'M' + (x + 2 * u) + ' ' + y + 'H' + (r - 2 * u) + 'V' + (y + u) + 'H' + (r - u) + 'V' + (y + 2 * u) + 'H' + r + 'V' + (b - 2 * u) +
      'H' + (r - u) + 'V' + (b - u) + 'H' + (r - 2 * u) + 'V' + b + 'H' + (x + 2 * u) + 'V' + (b - u) + 'H' + (x + u) + 'V' + (b - 2 * u) +
      'H' + x + 'V' + (y + 2 * u) + 'H' + (x + u) + 'V' + (y + u) + 'H' + (x + 2 * u) + 'Z';
  }
  function path(d, attrs) {
    var p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    for (var k in attrs) p.setAttribute(k, attrs[k]);
    return p;
  }
  function draw(el) {
    var w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    var old = el.querySelector(':scope > .px-frame');
    if (old) old.remove();
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'px-frame');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('shape-rendering', 'crispEdges');
    if (el.classList.contains('px-panel')) {
      // 바깥 잉크 3 → 민트 → 옅은 잉크 → 안쪽 잉크(8) → LCD(12). 계단 단위 6
      svg.appendChild(path(outline(w, h, 0, 6), { fill: INK }));
      svg.appendChild(path(outline(w, h, 3, 6), { fill: MINT }));
      svg.appendChild(path(outline(w, h, 3, 6), { fill: INK, opacity: '0.62' }));
      svg.appendChild(path(outline(w, h, 8, 6), { fill: INK }));
      svg.appendChild(path(outline(w, h, 12, 6), { fill: LCD }));
    } else if (el.classList.contains('px-button')) {
      // 그림자 2, 테두리 3, 계단 단위 5, 위와 왼쪽에 아이보리 빛 2
      var bw = w - 1, bh = h - 2, surface = outline(bw, bh, 1.5, 5), fill = el.classList.contains('secondary') ? IVORY : APRICOT;
      svg.appendChild(path(surface, { fill: INK, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'miter', transform: 'translate(1,2)' }));
      var g = document.createElementNS(SVG, 'g');
      g.setAttribute('class', 'px-frame-surface');
      g.appendChild(path(surface, { fill: fill, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'miter' }));
      g.appendChild(path('M' + (10 + 5) + ' ' + 5 + 'H' + (bw - 15) + 'M' + 5 + ' ' + (10 + 5) + 'V' + (bh - 15), { stroke: IVORY, 'stroke-width': 2, fill: 'none' }));
      svg.appendChild(g);
    } else {
      svg.appendChild(path(outline(w, h, 0, 3), { fill: INK }));
    }
    el.insertBefore(svg, el.firstChild);
    el.classList.add('px-framed');
  }
  function frames() {
    var els = document.querySelectorAll('.px-panel, .px-button, .px-badge');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.querySelector(':scope > .label') && el.classList.contains('px-button')) {
        var label = document.createElement('span');
        label.className = 'label';
        while (el.firstChild) label.appendChild(el.firstChild);
        el.appendChild(label);
      }
      if (el.classList.contains('px-badge') && !el.querySelector(':scope > .label')) {
        var b = document.createElement('span');
        b.className = 'label';
        b.textContent = el.textContent;
        el.textContent = '';
        el.appendChild(b);
      }
      draw(el);
    }
  }
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { draw(e.target); }); });
    var watch = function () { document.querySelectorAll('.px-panel, .px-button, .px-badge').forEach(function (el) { ro.observe(el); }); };
  }

  // ── 스티커 (앱 24×24 도트 스티커) ──
  function sticker(layers) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    layers.forEach(function (l) { svg.appendChild(path(l[1], { fill: l[0] })); });
    return svg;
  }

  // ── 화면 ──
  function showProblem(kind, max) {
    var copy = {
      closed: ['curious', '이 목표에는\n들어갈 수 없어요', '목표가 지워졌거나 초대 링크가 바뀌었어요. 초대한 친구에게 새 링크를 부탁해 주세요.'],
      full: ['shy', '자리가 다 찼어요', '이 목표는 ' + max + '명이 모두 함께하고 있어요.'],
      rate_limited: ['sleepy', '지금은 초대를\n확인할 수 없어요', '잠시 뒤에 이 초대 링크를 다시 열어 주세요.'],
    }[kind];
    $('problem-mascot').src = '/assets/invite/mascot-' + copy[0] + '.svg';
    setLines($('problem-title'), copy[1]);
    $('problem-detail').textContent = copy[2];
    $('join').hidden = true;
    $('problem').hidden = false;
    document.title = '차곡차곡 초대';
    frames();
  }
  function setLines(el, text) {
    el.textContent = '';
    text.split('\n').forEach(function (line, i) {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));
    });
  }
  function showOpen(data) {
    var name = data.goal && data.goal.name;
    if (name) {
      setLines($('join-title'), '「' + name + '」\n같이 차곡차곡 쌓아요');
      document.title = '「' + name + '」 차곡차곡 초대';
    }
    var owner = data.owner_name, n = data.member_count;
    if (owner && n >= 1) {
      $('join-people-text').textContent = n > 1 ? owner + '님 외 ' + (n - 1) + '명이 함께해요' : owner + '님이 초대했어요';
      $('join-people').hidden = false;
    }
    var ids = (data.taken_stickers || []).slice(0, 6);
    if (ids.length) {
      fetch('/assets/invite/stickers.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (all) {
        ids.forEach(function (id) { if (all[id]) $('join-stickers').appendChild(sticker(all[id])); });
      }).catch(function () {});
    }
  }

  function start() {
    frames();
    if (ro) watch();
    var raw = decodeURIComponent((location.pathname.match(/\/invite\/([^/]+)\/?$/) || [])[1] || '');
    var code = raw.trim().toUpperCase();
    if (!code) return; // 코드 없이 /invite/ 만 열면 기본 안내만 둔다
    if (!CODE.test(code)) { showProblem('closed'); return; }
    $('open-app').href = 'chagok://invite/' + code;
    if (ANON_KEY.indexOf('__') === 0) return;
    fetch(API + '/rest/v1/rpc/preview_invite', {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code }),
    }).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then(function (data) {
      if (!data || typeof data.status !== 'string') return;
      if (data.status === 'open') showOpen(data);
      else if (data.status === 'full') showProblem('full', data.max_members || 6);
      else if (data.status === 'rate_limited') showProblem('rate_limited');
      else showProblem('closed');
    }).catch(function () { /* 서버에 닿지 못하면 기본 안내(앱 받기, 앱에서 열기)를 그대로 둔다 */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(frames);
})();
