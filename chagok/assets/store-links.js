// App Store 배지 추적(2026-11-09). 랜딩(한국어, 영어)의 a.store-badge 에 쓴다.
// 1) App Store 캠페인: 배지 주소의 ct 를 들어온 SNS 꼬리표(utm_source)로 바꾼다 — landing_threads, 꼬리표가 없으면 HTML 에 적힌 landing 그대로.
//    App Store Connect 분석의 캠페인에서 다운로드까지 본다. 캠페인 하나에 서로 다른 Apple 계정 5개 이상이 설치해야 숫자가 보여서 위치로는 나누지 않는다.
//    pt(제공자 ID 129642498)는 App Store Connect 캠페인 링크 만들기에서 확인한 값이다.
// 2) GA: 배지를 누르면 app_store_click 이벤트를 position(data-position: nav, hero, mobile_end, bottom)과 campaign 과 함께 보낸다.
(function () {
  var source = (location.search.match(/[?&]utm_source=([a-z0-9_]{1,20})(?:&|$)/i) || [])[1];
  var campaign = source ? 'landing_' + source.toLowerCase() : 'landing';
  document.querySelectorAll('a.store-badge').forEach(function (link) {
    var url = new URL(link.href);
    url.searchParams.set('ct', campaign);
    link.href = url.toString();
    link.addEventListener('click', function () {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'app_store_click', { position: link.dataset.position || 'unknown', campaign: campaign });
      }
    });
  });
})();
