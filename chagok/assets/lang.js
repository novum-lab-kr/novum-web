// 랜딩과 고객 지원의 언어 고르기(2026-11-06). 약관과 처리방침(assets/policy.js)과 같은 규칙이다:
// 주소의 ?lang=ko|en 먼저(이 브라우저에 기억한다), 그다음 기억한 값, 그다음 브라우저 첫 언어(한국어면 한국어, 나머지는 영어).
// 짝 페이지는 <html data-alt="...">의 상대 주소다(개발 사이트에서도 같은 사이트 안으로 옮기도록 절대 주소를 쓰지 않는다).
// 고른 적 없는 검색엔진과 링크 미리보기 로봇은 옮기지 않는다(한국어 쪽도 검색에 남도록). 옮길 때는 페이지의 다른 스크립트가
// window.chagokLangRedirect 를 보고 멈출 수 있다(랜딩의 Google 애널리틱스).
(function () {
  var root = document.documentElement;
  var here = root.lang === 'en' ? 'en' : 'ko';
  var alt = root.getAttribute('data-alt');
  var key = 'chagok-policy-lang'; // 약관 쪽과 같은 이름이라 한 곳에서 고르면 사이트 전체가 따른다
  var param = (location.search.match(/[?&]lang=(ko|en)\b/) || [])[1];
  var chosen = param;
  if (chosen) {
    try { localStorage.setItem(key, chosen); } catch (e) { /* 저장 못 해도 이번에는 따른다 */ }
  } else {
    try { chosen = localStorage.getItem(key); } catch (e) { chosen = null; }
  }
  if (chosen !== 'ko' && chosen !== 'en') {
    if (/bot|crawl|spider|slurp|preview|scrap|facebookexternalhit|lighthouse/i.test(navigator.userAgent)) return;
    var browser = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
    chosen = browser.indexOf('ko') === 0 ? 'ko' : 'en';
  }
  if (chosen !== here && alt) {
    window.chagokLangRedirect = true;
    location.replace(alt + location.hash);
  }
})();
