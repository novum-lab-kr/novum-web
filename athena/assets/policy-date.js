// 약관 · 처리방침의 시행일 전 · 후 표시를 오늘 날짜(한국 시간)로 고른다 — 시행일에 손으로 바꾸거나 다시 배포하지 않아도 된다.
// HTML 은 시행 전 모양으로 두고, 날짜로 바뀌는 조각에만 표시를 단다(새 판을 낼 때도 날짜만 적는다).
//   data-until="YYYY-MM-DD"  그날 0시(한국 시간)부터 숨긴다(예: "(시행 예정)")
//   data-from="YYYY-MM-DD"   그날 0시(한국 시간)부터 보인다 — HTML 에는 hidden 을 함께 단다
//   <title data-from="…" data-from-text="…"> · <meta data-from="…" data-from-content="…">  그날부터 그 글로 바꾼다
// 언어판(/ko/ · /ja/ · /zh/)은 deploy/gen-athena-lang.mjs 가 표시를 그대로 복사한다. 검사는 deploy/check-athena.mjs.
(() => {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const today = new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
  for (const element of document.querySelectorAll('[data-until]')) {
    if (today >= element.dataset.until) element.hidden = true;
  }
  for (const element of document.querySelectorAll('[data-from]')) {
    if (today < element.dataset.from) continue;
    if (element.dataset.fromText !== undefined) element.textContent = element.dataset.fromText;
    else if (element.dataset.fromContent !== undefined) element.setAttribute('content', element.dataset.fromContent);
    else element.hidden = false;
  }
})();
