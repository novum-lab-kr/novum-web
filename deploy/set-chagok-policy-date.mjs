// 차곡 약관과 처리방침 2판의 게시일과 시행일을 한 번에 바꾼다.
// 앱 1.1.0 심사가 끝난 날, 그 날짜로 바꾸고 커밋한 뒤 PR을 main에 합치면 그날 게시와 시행이 된다(이용자에게 미리 알릴 대상이 없어 같은 날).
//   node deploy/set-chagok-policy-date.mjs 2026-11-12
// 바꾸는 곳: chagok/versions.json(약관과 처리방침 2판의 postedAt, effectiveAt),
//           chagok/terms/v2, chagok/privacy/v2 머리줄(한국어), chagok/en/terms/v2, chagok/en/privacy/v2 머리줄(영어).
// 판 목록(history.html)은 versions.json을 읽어 그리므로 따로 고치지 않는다.
import fs from 'node:fs';
import path from 'node:path';

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
  console.error('날짜를 YYYY-MM-DD로 주세요. 예: node deploy/set-chagok-policy-date.mjs 2026-11-12');
  process.exit(1);
}
const [y, m, d] = date.split('-').map(Number);
const ko = `${y}년 ${m}월 ${d}일`;
const en = `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${d}, ${y}`;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'chagok');
const VERSION = 2;

// versions.json: 한 줄에 한 판인 모양을 그대로 두고 2판 줄의 날짜만 바꾼다
const vPath = path.join(root, 'versions.json');
let vText = fs.readFileSync(vPath, 'utf8');
let vCount = 0;
vText = vText.replace(new RegExp(`(\\{ "version": ${VERSION}, "postedAt": ")\\d{4}-\\d{2}-\\d{2}(", "effectiveAt": ")\\d{4}-\\d{2}-\\d{2}(")`, 'g'), (_, a, b, c) => {
  vCount += 1;
  return `${a}${date}${b}${date}${c}`;
});
if (vCount !== 2) { console.error(`versions.json에서 ${VERSION}판 줄을 ${vCount}개 찾았어요(2개여야 함). 손으로 확인해 주세요.`); process.exit(1); }
JSON.parse(vText);
fs.writeFileSync(vPath, vText);

const pages = [
  [`terms/v${VERSION}/index.html`, /제2판, 게시일 [^,]+, 시행일 [^<]+/, `제2판, 게시일 ${ko}, 시행일 ${ko}`],
  [`privacy/v${VERSION}/index.html`, /제2판, 게시일 [^,]+, 시행일 [^<]+/, `제2판, 게시일 ${ko}, 시행일 ${ko}`],
  [`en/terms/v${VERSION}/index.html`, /Version 2, posted [^,]+, \d{4}, effective [^<]+/, `Version 2, posted ${en}, effective ${en}`],
  [`en/privacy/v${VERSION}/index.html`, /Version 2, posted [^,]+, \d{4}, effective [^<]+/, `Version 2, posted ${en}, effective ${en}`],
];
for (const [file, re, text] of pages) {
  const p = path.join(root, file);
  const before = fs.readFileSync(p, 'utf8');
  if (!re.test(before)) { console.error(`${file}에서 날짜 줄을 찾지 못했어요.`); process.exit(1); }
  fs.writeFileSync(p, before.replace(re, text));
}
console.log(`2판 게시일과 시행일을 ${date}로 바꿨어요: versions.json 2줄, 문서 ${pages.length}개`);
