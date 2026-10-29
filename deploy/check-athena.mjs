// athena/ 배포 전 검사(GitHub Actions · 손으로: node deploy/check-athena.mjs)
// 1) 언어 사전 ko · ja · zh 가 읽히고, 페이지의 data-t · data-ta 키가 세 사전에 모두 있는지
// 2) 페이지가 부르는 사이트 안 파일(/assets/… 등 href · src · srcset)이 실제로 있는지
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'athena');
const PAGES = ['index.html', 'features/index.html', 'docs/index.html', 'download/index.html', 'releases/index.html', 'terms/index.html'];
const errors = [];

const dicts = {};
for (const lang of ['ko', 'ja', 'zh']) {
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/i18n', lang + '.js'), 'utf8'), sandbox);
    dicts[lang] = sandbox.window.ATHENA_I18N?.[lang] ?? {};
  } catch (e) {
    errors.push(`사전 ${lang}.js 를 읽지 못함: ${e.message}`);
    dicts[lang] = {};
  }
}

for (const page of PAGES) {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) { errors.push(`페이지 없음: ${page}`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const keys = new Set([...html.matchAll(/data-t="([^"]+)"/g)].map(m => m[1]));
  for (const m of html.matchAll(/data-ta="([^"]+)"/g)) for (const pair of m[1].split(',')) keys.add(pair.split(':')[1].trim());
  for (const k of keys) for (const lang of Object.keys(dicts)) if (!(k in dicts[lang])) errors.push(`${page}: ${lang} 사전에 "${k}" 없음`);

  const refs = new Set();
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) refs.add(m[1]);
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(',')) refs.add(part.trim().split(/\s+/)[0]);
  for (const ref of refs) {
    if (!ref.startsWith('/') || ref.startsWith('//') || ref.includes('{')) continue;   // {l} 은 언어마다 바뀌는 자리
    const target = path.join(ROOT, ref.endsWith('/') ? ref + 'index.html' : ref);
    if (!fs.existsSync(target)) errors.push(`${page}: 없는 파일 ${ref}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n검사 실패 ${errors.length}건`);
  process.exit(1);
}
console.log(`검사 통과: 페이지 ${PAGES.length}장, 사전 키 ${Object.keys(dicts.ko).length}개`);
