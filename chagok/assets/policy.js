// 오늘 날짜(로컬)로 시행 중인 판을 골라 본문을 보여준다. 시행 예정인 판이 있으면 위에 알린다.
// 앱의 src/policy/versions.ts effectiveVersion과 같은 규칙이다.
(function () {
  const kind = document.documentElement.dataset.kind; // 'terms' | 'privacy'
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const md = (key) => { const [, m, d] = key.split('-').map(Number); return `${m}월 ${d}일`; };
  const target = document.getElementById('content');

  fetch('../versions.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then(async (all) => {
      const list = all[kind];
      const effective = list.filter((v) => v.effectiveAt <= today).sort((a, b) => b.version - a.version)[0];
      const upcoming = list.filter((v) => v.effectiveAt > today).sort((a, b) => a.effectiveAt < b.effectiveAt ? -1 : 1)[0];
      if (!effective) { target.textContent = '아직 시행 중인 문서가 없어요.'; return; }
      const html = await (await fetch(`v${effective.version}/`, { cache: 'no-store' })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      target.innerHTML = doc.querySelector('main').innerHTML;
      if (upcoming) {
        const box = document.createElement('p');
        box.className = 'notice';
        box.innerHTML = `${md(upcoming.effectiveAt)}부터 바뀌어요. <a href="v${upcoming.version}/">바뀌는 내용 보기</a>`;
        target.prepend(box);
      }
    })
    .catch(() => { target.innerHTML = '문서를 불러오지 못했어요. <a href="history.html">판 목록</a>에서 직접 열 수 있어요.'; });
})();
