// chagok/ 배포 전 검사(GitHub Actions · 손으로: node deploy/check-chagok.mjs)
// 옛 레포 chagok-app-policy 검증과 같은 내용에, 사이트 안 파일 참조 검사를 더했다.
// 1) versions.json — terms · privacy 판 목록, version 은 1 이상 정수 · 겹침 없음, postedAt · effectiveAt 은 YYYY-MM-DD · 게시일 <= 시행일,
//    summary 있음, requiresConsent 는 true/false, <kind>/v<N>/index.html 이 있고 <main> 이 있다(assets/policy.js 가 그 <main> 을 가져와 보여 준다)
// 2) assets/policy.js 문법(node --check)
// 3) 페이지(*.html)의 href · src · srcset · poster 와 CSS 의 url() 이 가리키는 사이트 안 파일이 실제로 있는지
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'chagok');
const errors = [];

// 1) versions.json
const dateKey = /^\d{4}-\d{2}-\d{2}$/;
let versions = {};
try {
  versions = JSON.parse(fs.readFileSync(path.join(ROOT, 'versions.json'), 'utf8'));
} catch (e) {
  errors.push(`versions.json 을 읽지 못함: ${e.message}`);
}
for (const kind of ['terms', 'privacy']) {
  const list = versions[kind];
  if (!Array.isArray(list) || list.length === 0) { errors.push(`${kind}: 판 목록이 없다`); continue; }
  const seen = new Set();
  for (const entry of list) {
    const label = `${kind} v${entry.version}`;
    if (!Number.isInteger(entry.version) || entry.version < 1) errors.push(`${label}: version 은 1 이상 정수`);
    if (seen.has(entry.version)) errors.push(`${label}: 번호가 겹친다`);
    seen.add(entry.version);
    for (const key of ['postedAt', 'effectiveAt']) if (!dateKey.test(entry[key] ?? '')) errors.push(`${label}: ${key} 는 YYYY-MM-DD`);
    if (entry.postedAt > entry.effectiveAt) errors.push(`${label}: 게시일이 시행일보다 늦다`);
    if (typeof entry.summary !== 'string' || !entry.summary) errors.push(`${label}: summary 없음`);
    if (typeof entry.requiresConsent !== 'boolean') errors.push(`${label}: requiresConsent 는 true/false`);
    const page = `${kind}/v${entry.version}/index.html`;
    const pageFile = path.join(ROOT, page);
    if (!fs.existsSync(pageFile)) errors.push(`${label}: ${page} 없음`);
    else if (!/<main[\s>]/.test(fs.readFileSync(pageFile, 'utf8'))) errors.push(`${label}: ${page} 에 <main> 없음`);
  }
}

// 2) policy.js 문법
try {
  execFileSync(process.execPath, ['--check', path.join(ROOT, 'assets/policy.js')], { stdio: 'pipe' });
} catch (e) {
  errors.push(`assets/policy.js 문법 오류: ${String(e.stderr ?? e.message).trim()}`);
}

// 3) 사이트 안 파일 참조
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const files = walk(ROOT);
const pages = files.filter((file) => file.endsWith('.html'));
const styles = files.filter((file) => file.endsWith('.css'));

// 바깥 주소 · 메일 · 같은 쪽 안 이동 · 스크립트 문자열 조각(v'+v.version+'/ 등)은 건너뛴다
const isSiteRef = (ref) => ref !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(ref) && !ref.startsWith('//') && !ref.startsWith('#') && !/['{\s]/.test(ref);

const checkRef = (from, ref) => {
  const clean = ref.split(/[?#]/)[0];
  if (!isSiteRef(clean)) return;
  // 페이지는 폴더 주소(/privacy/)로 열리므로 상대 경로는 그 파일이 있는 폴더 기준이다
  const base = clean.startsWith('/') ? ROOT : path.dirname(from);
  const target = path.join(base, clean.endsWith('/') ? clean + 'index.html' : clean);
  if (!target.startsWith(ROOT + path.sep)) errors.push(`${path.relative(ROOT, from)}: 사이트 밖을 가리킴 ${ref}`);
  else if (!fs.existsSync(target)) errors.push(`${path.relative(ROOT, from)}: 없는 파일 ${ref}`);
};

for (const file of pages) {
  // 주석 안의 예시(href="App Store 주소" 등)는 보지 않는다
  const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const match of html.matchAll(/(?:href|src|poster)="([^"]*)"/g)) checkRef(file, match[1]);
  for (const match of html.matchAll(/srcset="([^"]+)"/g)) for (const part of match[1].split(',')) checkRef(file, part.trim().split(/\s+/)[0]);
}
for (const file of styles) {
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) checkRef(file, match[2]);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n검사 실패 ${errors.length}건`);
  process.exit(1);
}
console.log(`검사 통과: 판 terms ${versions.terms.length} · privacy ${versions.privacy.length}, 페이지 ${pages.length}장, CSS ${styles.length}개`);
