// 차곡 약관과 처리방침 새 판의 게시일과 시행일을 한 번에 넣는다.
// 새 판은 날짜 자리에 2026-11-XX(게시일)와 2026-11-YY(시행일)를 두고 만든다. 이 자리가 남아 있으면 check-chagok.mjs가 실패해 배포되지 않는다.
//   node deploy/set-chagok-policy-date.mjs <게시일 YYYY-MM-DD> <시행일 YYYY-MM-DD>
//   예: node deploy/set-chagok-policy-date.mjs 2026-11-20 2026-11-27
// 바꾸는 곳: chagok/versions.json의 자리 표시, 아래 PAGES 머리줄(한국어, 영어, 일본어). 판 목록(history.html)은 versions.json을 읽으므로 따로 고치지 않는다.
// 2026-11: 약관 3판과 처리방침 4판(일본어판 추가). 다음 판을 만들 때 PAGES를 바꾼다.
import fs from 'node:fs';
import path from 'node:path';

const [posted, effective] = process.argv.slice(2);
const valid = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
if (!valid(posted) || !valid(effective) || posted > effective) {
  console.error('게시일과 시행일을 YYYY-MM-DD로 주세요(게시일 <= 시행일). 예: node deploy/set-chagok-policy-date.mjs 2026-11-20 2026-11-27');
  process.exit(1);
}
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const label = {
  ko: (d) => { const [y, m, dd] = d.split('-').map(Number); return `${y}년 ${m}월 ${dd}일`; },
  en: (d) => { const [y, m, dd] = d.split('-').map(Number); return `${months[m - 1]} ${dd}, ${y}`; },
  ja: (d) => { const [y, m, dd] = d.split('-').map(Number); return `${y}年${m}月${dd}日`; },
};
const POSTED = '2026-11-XX';
const EFFECTIVE = '2026-11-YY';
const PAGES = [
  ['terms/v3/index.html', 'ko'], ['en/terms/v3/index.html', 'en'], ['ja/terms/v3/index.html', 'ja'],
  ['privacy/v4/index.html', 'ko'], ['en/privacy/v4/index.html', 'en'], ['ja/privacy/v4/index.html', 'ja'],
];

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'chagok');
const replaceAll = (text, file, expected) => {
  const count = text.split(POSTED).length - 1 + text.split(EFFECTIVE).length - 1;
  if (count !== expected) { console.error(`${file}에서 날짜 자리를 ${count}개 찾았어요(${expected}개여야 함). 손으로 확인해 주세요.`); process.exit(1); }
  return (fmt) => text.split(POSTED).join(fmt(posted)).split(EFFECTIVE).join(fmt(effective));
};

const vPath = path.join(root, 'versions.json');
const vText = replaceAll(fs.readFileSync(vPath, 'utf8'), 'versions.json', 4)((d) => d);
JSON.parse(vText);
const writes = [[vPath, vText]];
for (const [file, lang] of PAGES) {
  const p = path.join(root, file);
  writes.push([p, replaceAll(fs.readFileSync(p, 'utf8'), file, 2)(label[lang])]);
}
for (const [p, text] of writes) fs.writeFileSync(p, text);
console.log(`게시일 ${posted}, 시행일 ${effective}로 바꿨어요: versions.json, 문서 ${PAGES.length}개`);
