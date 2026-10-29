/* 구글 애널리틱스(GA4) — 모든 페이지의 <head> 가 이 파일 하나를 부른다(2026-10-29).
   측정 ID 는 공개 값(페이지에 드러나는 값)이다. 비밀값이 아니다.
   다운로드 버튼(<a data-dl="arm64|x64">)을 누르면 'download' 이벤트(chip)를 보낸다 — 링크 이동은 막지 않는다 */
(() => {
  const MEASUREMENT_ID = 'G-18ZVYMT3X5';

  window.dataLayer = window.dataLayer || [];
  // gtag.js 는 arguments 객체를 그대로 받아야 해서 화살표 함수가 아니라 function 으로 둔다
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID);

  const loader = document.createElement('script');
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(loader);

  // 같은 탭에서 바로 이동해도 요청이 끊기지 않게 beacon 으로 보낸다
  const sendDownload = (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[data-dl]') : null;
    if (!link) return;
    window.gtag('event', 'download', { chip: link.getAttribute('data-dl'), transport_type: 'beacon' });
  };
  document.addEventListener('click', sendDownload);
  // 가운데 버튼(새 탭으로 열기)은 click 이 아니라 auxclick 으로 온다
  document.addEventListener('auxclick', (event) => { if (event.button === 1) sendDownload(event); });
})();
