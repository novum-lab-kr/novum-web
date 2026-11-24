/* 홈 06 모바일 앱 화면 슬라이드 — 외부 라이브러리 없이(2026-11-24).
   틀은 가로 scroll-snap 이라 휴대폰은 손가락으로 밀어 넘긴다(JS 가 없어도 된다). JS 는 그 위에
   몇 초마다 다음 장 · 점(지금 장 표시 · 눌러 이동) · 화면을 누르면 다음 장 · 마우스를 올리거나 점에 초점이 있으면 멈춤을 얹는다.
   동작 줄이기(prefers-reduced-motion)를 켠 사람은 자동으로 넘기지 않고, 넘길 때도 미끄러지지 않고 바로 바뀐다.
   데스크톱은 마우스로 끌어 넘길 수도 있다(2026-11-25) — 끄는 동안 멈추고, 놓으면 가까운 장으로 맞춘다 */
(function () {
  var root = document.querySelector('.as');
  if (!root) return;
  var track = root.querySelector('.as-track');
  var slides = [].slice.call(root.querySelectorAll('.as-slide'));
  var dotsBox = root.querySelector('.as-dots');
  if (!track || slides.length < 2 || !dotsBox) return;
  var DELAY = 4000;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = 0, timer = null, hovering = false, focused = false, touching = false, dragging = false;
  var label = dotsBox.getAttribute('data-label') || 'Screen';

  // 점 — 장마다 하나(번호는 화면 읽기 프로그램용)
  var dots = slides.map(function (slide, index) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', label + ' ' + (index + 1) + ' / ' + slides.length);
    dot.addEventListener('click', function () { go(index); restart(); });
    dotsBox.appendChild(dot);
    return dot;
  });

  // 다음 장 그림은 넘어가기 전에 미리 받는다(loading=lazy 는 가려진 장을 늦게 받을 수 있다)
  function warm(index) {
    var img = slides[index] && slides[index].querySelector('img');
    if (img && img.loading === 'lazy') img.loading = 'eager';
  }

  function mark(index) {
    current = index;
    dots.forEach(function (dot, dotIndex) { dot.setAttribute('aria-current', dotIndex === index ? 'true' : 'false'); });
    warm((index + 1) % slides.length);
  }

  function go(index) {
    var target = (index + slides.length) % slides.length;
    track.scrollTo({ left: slides[target].offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
    mark(target);
  }

  // 손으로 밀어 넘긴 뒤에도 점이 따라오게 — 스크롤 위치에서 가장 가까운 장
  var settle = null;
  track.addEventListener('scroll', function () {
    clearTimeout(settle);
    settle = setTimeout(function () {
      var index = Math.round(track.scrollLeft / track.clientWidth);
      if (index !== current && slides[index]) mark(index);
    }, 80);
  }, { passive: true });

  slides.forEach(function (slide) {
    slide.addEventListener('click', function () { go(current + 1); restart(); });
  });

  // 마우스로 끌어 넘기기 — 터치는 브라우저의 기본 밀기에 맡기고 마우스만 다룬다
  var DRAG_MIN = 5; // 이만큼(px) 움직여야 끌기로 본다 — 그 아래는 그냥 누르기(다음 장)
  var press = null, justDragged = false, unlockTimer = null;
  function unlock() {
    clearTimeout(unlockTimer);
    track.classList.remove('is-drag');
  }
  track.addEventListener('pointerdown', function (event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    press = { id: event.pointerId, x: event.clientX, left: track.scrollLeft, index: current };
  });
  track.addEventListener('pointermove', function (event) {
    if (!press || event.pointerId !== press.id) return;
    var moved = event.clientX - press.x;
    if (!dragging) {
      if (Math.abs(moved) < DRAG_MIN) return;
      dragging = true;
      unlock();
      // 끄는 동안은 스냅 · 부드러운 이동을 꺼야 손을 따라 바로 움직인다
      track.classList.add('is-drag');
      track.setPointerCapture(press.id);
      restart();
    }
    track.scrollLeft = press.left - moved;
  });
  function release(event) {
    if (!press || event.pointerId !== press.id) return;
    var moved = event.clientX - press.x;
    var from = press.index;
    press = null;
    if (!dragging) return;
    dragging = false;
    justDragged = true;
    setTimeout(function () { justDragged = false; }, 0);
    // 가까운 장으로 — 폭의 15% 넘게 끌었으면 그 방향 다음 장(끝에서는 더 가지 않는다)
    var target = Math.round(track.scrollLeft / track.clientWidth);
    var flick = track.clientWidth * 0.15;
    if (target === from && moved < -flick) target = from + 1;
    if (target === from && moved > flick) target = from - 1;
    target = Math.max(0, Math.min(slides.length - 1, target));
    go(target);
    // 맞춤 이동이 끝난 뒤 스냅을 되돌린다(이동 중에 되돌리면 중간에서 튄다)
    unlockTimer = setTimeout(unlock, reduce ? 0 : 600);
    restart();
  }
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  // 끈 뒤 손을 뗄 때 생기는 클릭이 '다음 장' 으로 눌리지 않게
  track.addEventListener('click', function (event) {
    if (justDragged) { event.stopPropagation(); event.preventDefault(); }
  }, true);
  // 그림을 끌면 브라우저가 그림 자체를 끌어 가는(고스트 이미지) 기본 동작을 막는다
  track.addEventListener('dragstart', function (event) { event.preventDefault(); });

  function paused() { return reduce || hovering || focused || touching || dragging || document.hidden; }
  function restart() {
    clearInterval(timer);
    timer = null;
    if (paused()) return;
    timer = setInterval(function () { go(current + 1); }, DELAY);
  }

  root.addEventListener('mouseenter', function () { hovering = true; restart(); });
  root.addEventListener('mouseleave', function () { hovering = false; restart(); });
  // 키보드로 점에 왔을 때만 멈춘다(마우스로 누른 점에 남은 초점 때문에 계속 멈춰 있지 않게)
  root.addEventListener('focusin', function (event) {
    // :focus-visible 을 모르는 옛 브라우저는 matches 가 예외를 던진다 — 그때는 초점이면 멈춘다
    try { focused = event.target.matches(':focus-visible'); } catch (error) { focused = true; }
    restart();
  });
  root.addEventListener('focusout', function () { focused = false; restart(); });
  // 미는 동안은 멈추고, 손을 뗀 뒤 다시 센다
  track.addEventListener('touchstart', function () { touching = true; restart(); }, { passive: true });
  track.addEventListener('touchend', function () { touching = false; restart(); }, { passive: true });
  document.addEventListener('visibilitychange', restart);

  mark(0);
  restart();
})();
