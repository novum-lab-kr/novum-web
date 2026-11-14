// 오늘 날짜(로컬)로 시행 중인 판을 골라 본문을 보여준다. 시행 예정인 판이 있으면 위에 알린다.
// 앱의 src/policy/versions.ts effectiveVersion과 같은 규칙이다.
// 언어(2026-11-06): 앱은 언어와 상관없이 /terms/, /privacy/를 연다. 브라우저 첫 언어가 한국어가 아니고 시행 중인 판에
// 영어판이 있으면(versions.json의 languages에 'en') /en/ 쪽으로 보낸다. ?lang=ko 또는 ?lang=en으로 고를 수 있고,
// 고른 언어는 이 브라우저에 기억한다. 영어판은 같은 판 번호의 번역이라 앱의 동의 기록(판 번호)은 언어와 상관없다.
// 일본어(2026-11, 약관 3판과 처리방침 4판부터): /ja/ 쪽. ?lang=ja, 브라우저 첫 언어가 일본어면 고른다.
// 시행 중인 판에 일본어판이 없으면 영어판으로, 영어판도 없으면 지금 쪽에 남는다.
(function () {
  const kind = document.documentElement.dataset.kind; // 'terms' | 'privacy'
  const langs = ['ko', 'en', 'ja'];
  const lang = langs.includes(document.documentElement.lang) ? document.documentElement.lang : 'ko';
  const base = lang === 'ko' ? '../' : '../../'; // versions.json이 있는 chagok/ 기준
  const pageOf = (l) => (l === 'ko' ? `${base}${kind}/` : `${base}${l}/${kind}/`);
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateLabel = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    if (lang === 'en') return `${months[m - 1]} ${d}, ${y}`;
    return lang === 'ja' ? `${m}月${d}日` : `${m}월 ${d}일`;
  };
  const texts = {
    en: { none: 'No document is in effect yet.', changing: (d) => `Changing from ${d}.`, see: 'See what changes', failed: 'Could not load the document. You can open it from the <a href="history.html">list of versions</a>.', koOnly: 'This version is available in Korean only.' },
    ko: { none: '아직 시행 중인 문서가 없어요.', changing: (d) => `${d}부터 바뀌어요.`, see: '바뀌는 내용 보기', failed: '문서를 불러오지 못했어요. <a href="history.html">판 목록</a>에서 직접 열 수 있어요.', koOnly: '' },
    ja: { none: 'まだ施行中の文書はありません。', changing: (d) => `${d}から変わります。`, see: '変更内容を見る', failed: `文書を読み込めませんでした。<a href="${base}${kind}/history.html">版の一覧（韓国語）</a>から開けます。`, koOnly: 'この版は韓国語のみです。' },
  };
  const text = texts[lang];
  const names = { ko: '한국어', en: 'English', ja: '日本語' };
  const content = document.getElementById('content');
  const hasLang = (v, l) => (v.languages || ['ko']).includes(l);

  // 고른 언어: 주소의 ?lang= 먼저, 그다음 기억한 값, 그다음 브라우저 언어
  const params = new URLSearchParams(location.search);
  let chosen = params.get('lang');
  if (langs.includes(chosen)) {
    try { localStorage.setItem('chagok-policy-lang', chosen); } catch (e) { /* 저장 못 해도 이번에는 따른다 */ }
  } else {
    try { chosen = localStorage.getItem('chagok-policy-lang'); } catch (e) { chosen = null; }
  }
  const browserLang = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
  const wanted = langs.includes(chosen) ? chosen : (browserLang.startsWith('ko') ? 'ko' : browserLang.startsWith('ja') ? 'ja' : 'en');

  fetch(`${base}versions.json`, { cache: 'no-store' })
    .then((r) => r.json())
    .then(async (all) => {
      const list = all[kind];
      const effective = list.filter((v) => v.effectiveAt <= today).sort((a, b) => b.version - a.version)[0];
      const upcoming = list.filter((v) => v.effectiveAt > today).sort((a, b) => a.effectiveAt < b.effectiveAt ? -1 : 1)[0];
      if (!effective) { content.textContent = text.none; return; }

      // 다른 언어 쪽으로 옮겨야 하면 옮긴다. 일본어판이 없으면 영어판으로, 그것도 없으면 지금 쪽에 남는다
      const target = hasLang(effective, wanted) ? wanted : (wanted === 'ja' && hasLang(effective, 'en') ? 'en' : lang);
      if (target !== lang) {
        location.replace(pageOf(target));
        return;
      }

      // 한국어가 아닌 쪽인데 시행 중인 판에 그 언어판이 없으면 한국어 원문을 보여 준다
      const showLocal = lang === 'ko' || hasLang(effective, lang);
      const src = showLocal ? `v${effective.version}/` : `${base}${kind}/v${effective.version}/`;
      const html = await (await fetch(src, { cache: 'no-store' })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      content.innerHTML = doc.querySelector('main').innerHTML;

      // 언어 바꾸기: 시행 중인 판에 있는 다른 언어만
      const others = langs.filter((l) => l !== lang && hasLang(effective, l));
      if (others.length) {
        const sw = document.createElement('p');
        sw.className = 'lang-switch';
        sw.innerHTML = others.map((l) => `<a href="${pageOf(l)}?lang=${l}" hreflang="${l}" lang="${l}">${names[l]}</a>`).join(' | ');
        content.prepend(sw);
      }
      if (!showLocal) {
        const note = document.createElement('p');
        note.className = 'notice';
        note.textContent = text.koOnly;
        content.prepend(note);
      }
      if (upcoming) {
        const box = document.createElement('p');
        box.className = 'notice';
        const upHref = lang === 'ko' || hasLang(upcoming, lang) ? `v${upcoming.version}/` : `${base}${kind}/v${upcoming.version}/`;
        box.innerHTML = `${text.changing(dateLabel(upcoming.effectiveAt))} <a href="${upHref}">${text.see}</a>`;
        content.prepend(box);
      }
    })
    .catch(() => { content.innerHTML = text.failed; });
})();
