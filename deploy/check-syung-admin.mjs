// syung-admin/ 배포 전 검사(GitHub Actions · 손으로: node deploy/check-syung-admin.mjs)
// 슝 관리 화면은 Vite + TypeScript + Preact(원본 syung-admin-src/)인데 서버(deploy/site.sh)는 빌드하지 않고 폴더를 그대로 복사한다.
// 그래서 빌드 결과(syung-admin/admin/)를 커밋하고, 여기서 원본으로 다시 빌드해 커밋한 결과와 같은지 본다 — 다르면 배포가 멈춘다.
// 0) syung-admin-src/node_modules 가 없으면 npm ci(GitHub Actions — 있으면 그대로 쓴다)
// 1) 타입 검사(npm run typecheck — tsc)
// 2) 시험(node --test syung-admin-src/tests/*.test.mjs — Node 22.18+ 가 .mts 를 바로 읽는다)
// 3) 원본을 임시 폴더로 빌드해 syung-admin/admin/ 과 파일 목록 · 내용이 같은지(고쳤으면 cd syung-admin-src && npm run build 결과까지 커밋)
// 4) 검색 막기: syung-admin/ 의 모든 페이지에 <meta name="robots" content="noindex">
// 5) 페이지가 부르는 같은 폴더 파일(./… · /admin/…)이 결과에 있는지 — Caddy 가 다른 곳에서 내는 주소(OTHER)는 빼고
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(REPO, 'syung-admin-src');
const SITE = path.join(REPO, 'syung-admin');
const BUILT = path.join(SITE, 'admin');
// 이 폴더 밖에서 오는 /admin/… 주소(Caddy — 슝 서버 · 지도 릴리스): 학습 자료 · 디버깅 화면의 지도 자료
const OTHER = [/^\/admin\/learning\.json$/, /^\/admin\/map\//];
const errors = [];

const run = (label, command, args, env = {}) => {
  try {
    execFileSync(command, args, { cwd: SRC, stdio: 'pipe', env: { ...process.env, ...env } });
    return true;
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() || error.message;
    errors.push(`${label} 실패:\n${output}`);
    return false;
  }
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

// 0) 설치
let ready = fs.existsSync(path.join(SRC, 'node_modules'));
if (!ready) ready = run('npm ci', 'npm', ['ci', '--no-audit', '--no-fund']);

let tests = [];
if (ready) {
  // 1) 타입
  run('타입 검사(npm run typecheck)', 'npm', ['run', '--silent', 'typecheck']);

  // 2) 시험
  tests = fs.readdirSync(path.join(SRC, 'tests')).filter((name) => name.endsWith('.test.mjs')).map((name) => path.join('tests', name));
  if (!tests.length) errors.push('syung-admin-src/tests 에 시험이 없다');
  else run('시험(node --test)', process.execPath, ['--test', ...tests]);

  // 3) 다시 빌드해 비교
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'syung-admin-'));
  try {
    if (run('빌드(npm run build)', 'npm', ['run', '--silent', 'build'], { SYUNG_ADMIN_OUT: tmp })) {
      const list = (dir) => (fs.existsSync(dir) ? walk(dir).map((file) => path.relative(dir, file)).sort() : []);
      const fresh = list(tmp);
      const committed = list(BUILT);
      for (const file of fresh) {
        if (!committed.includes(file)) errors.push(`syung-admin/admin/${file}: 빌드 결과에 있는데 커밋되지 않았다`);
        else if (!fs.readFileSync(path.join(tmp, file)).equals(fs.readFileSync(path.join(BUILT, file)))) errors.push(`syung-admin/admin/${file}: 원본으로 다시 빌드한 것과 다르다`);
      }
      for (const file of committed) if (!fresh.includes(file)) errors.push(`syung-admin/admin/${file}: 빌드 결과에 없는 파일(지우거나 원본에 더한다)`);
      if (errors.some((line) => line.startsWith('syung-admin/admin/'))) errors.push('→ cd syung-admin-src && npm run build 결과까지 커밋한다');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 4) · 5) 페이지
if (!fs.existsSync(path.join(SITE, 'index.html'))) errors.push('syung-admin/index.html 이 없다(deploy/site.sh 가 반영하지 않는다)');
const pages = fs.existsSync(SITE) ? walk(SITE).filter((file) => file.endsWith('.html')) : [];
const exists = (file) => fs.existsSync(file) && fs.statSync(file).isFile();
for (const file of pages) {
  const name = path.relative(REPO, file);
  const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  if (!/<meta name="robots" content="noindex">/.test(html)) errors.push(`${name}: <meta name="robots" content="noindex"> 없음`);
  for (const match of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
    const ref = match[1].split(/[?#]/)[0];
    let target = null;
    if (ref.startsWith('./')) target = path.join(path.dirname(file), ref);
    else if (ref.startsWith('/admin/') && !OTHER.some((pattern) => pattern.test(ref))) target = path.join(SITE, ref);
    // Caddy 가 try_files {path} {path}.html 로 낸다(/admin/learning → learning.html)
    if (target && !exists(target) && !exists(`${target}.html`)) errors.push(`${name}: 없는 파일 ${match[1]}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n검사 실패 ${errors.length}건`);
  process.exit(1);
}
console.log(`검사 통과: 타입 · 시험 ${tests.length}개 파일 · 빌드 결과가 원본과 같음, 페이지 ${pages.length}장`);
