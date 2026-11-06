// 오늘 날짜(로컬)로 시행 중인 판을 골라 본문을 보여준다. 시행 예정인 판이 있으면 위에 알린다.
// 앱의 src/policy/versions.ts effectiveVersion과 같은 규칙이다.
// 언어(2026-11-06): 앱은 언어와 상관없이 /terms/, /privacy/를 연다. 브라우저 첫 언어가 한국어가 아니고 시행 중인 판에
// 영어판이 있으면(versions.json의 languages에 'en') /en/ 쪽으로 보낸다. ?lang=ko 또는 ?lang=en으로 고를 수 있고,
// 고른 언어는 이 브라우저에 기억한다. 영어판은 같은 판 번호의 번역이라 앱의 동의 기록(판 번호)은 언어와 상관없다.
(function () {
  const kind = document.documentElement.dataset.kind; // 'terms' | 'privacy'
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ko';
  const base = lang === 'en' ? '../../' : '../'; // versions.json이 있는 chagok/ 기준
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateLabel = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return lang === 'en' ? `${months[m - 1]} ${d}, ${y}` : `${m}월 ${d}일`;
  };
  const text = lang === 'en'
    ? { none: 'No document is in effect yet.', changing: (d) => `Changing from ${d}.`, see: 'See what changes', failed: 'Could not load the document. You can open it from the <a href="history.html">list of versions</a>.', koOnly: 'This version is available in Korean only.', other: '한국어' }
    : { none: '아직 시행 중인 문서가 없어요.', changing: (d) => `${d}부터 바뀌어요.`, see: '바뀌는 내용 보기', failed: '문서를 불러오지 못했어요. <a href="history.html">판 목록</a>에서 직접 열 수 있어요.', koOnly: '', other: 'English' };
  const target = document.getElementById('content');
  const hasLang = (v, l) => (v.languages || ['ko']).includes(l);

  // 고른 언어: 주소의 ?lang= 먼저, 그다음 기억한 값, 그다음 브라우저 언어
  const params = new URLSearchParams(location.search);
  let chosen = params.get('lang');
  if (chosen === 'ko' || chosen === 'en') {
    try { localStorage.setItem('chagok-policy-lang', chosen); } catch (e) { /* 저장 못 해도 이번에는 따른다 */ }
  } else {
    try { chosen = localStorage.getItem('chagok-policy-lang'); } catch (e) { chosen = null; }
  }
  const browserLang = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
  const wanted = chosen === 'ko' || chosen === 'en' ? chosen : (browserLang.startsWith('ko') ? 'ko' : 'en');

  fetch(`${base}versions.json`, { cache: 'no-store' })
    .then((r) => r.json())
    .then(async (all) => {
      const list = all[kind];
      const effective = list.filter((v) => v.effectiveAt <= today).sort((a, b) => b.version - a.version)[0];
      const upcoming = list.filter((v) => v.effectiveAt > today).sort((a, b) => a.effectiveAt < b.effectiveAt ? -1 : 1)[0];
      if (!effective) { target.textContent = text.none; return; }

      // 다른 언어 쪽으로 옮겨야 하면 옮긴다. 시행 중인 판에 그 언어가 없으면 지금 쪽에 남는다
      if (wanted !== lang && hasLang(effective, wanted)) {
        location.replace(wanted === 'en' ? `${base}en/${kind}/` : `${base}${kind}/`);
        return;
      }

      // 영어 쪽인데 시행 중인 판에 영어판이 없으면 한국어 원문을 보여 준다
      const showEn = lang === 'en' && hasLang(effective, 'en');
      const src = lang === 'en' && !showEn ? `${base}${kind}/v${effective.version}/` : `v${effective.version}/`;
      const html = await (await fetch(src, { cache: 'no-store' })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      target.innerHTML = doc.querySelector('main').innerHTML;

      // 언어 바꾸기: 시행 중인 판에 다른 언어가 있을 때만
      const other = lang === 'en' ? 'ko' : 'en';
      if (hasLang(effective, other)) {
        const sw = document.createElement('p');
        sw.className = 'lang-switch';
        const href = other === 'en' ? `${base}en/${kind}/?lang=en` : `${base}${kind}/?lang=ko`;
        sw.innerHTML = `<a href="${href}" hreflang="${other}" lang="${other}">${text.other}</a>`;
        target.prepend(sw);
      }
      if (lang === 'en' && !showEn) {
        const note = document.createElement('p');
        note.className = 'notice';
        note.textContent = text.koOnly;
        target.prepend(note);
      }
      if (upcoming) {
        const box = document.createElement('p');
        box.className = 'notice';
        const upHref = lang === 'en' && hasLang(upcoming, 'en') ? `v${upcoming.version}/` : `${lang === 'en' ? `${base}${kind}/` : ''}v${upcoming.version}/`;
        box.innerHTML = `${text.changing(dateLabel(upcoming.effectiveAt))} <a href="${upHref}">${text.see}</a>`;
        target.prepend(box);
      }
    })
    .catch(() => { target.innerHTML = text.failed; });
})();
