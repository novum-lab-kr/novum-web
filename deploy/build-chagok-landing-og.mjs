// 일본어 랜딩 공유 그림(chagok/assets/img/ja/og.jpg, 1200×630, ja/index.html 의 og:image)을 만든다(2026-11-14, 앱 1.2.0).
//   node deploy/build-chagok-landing-og.mjs
// 한국어 og.jpg 와 영어 en/og.jpg 는 만든 스크립트가 레포에 없다. 영어판은 한국어와 같은 그림에 제목만 바꾼 것이라(커밋 5ea4f73),
// 여기서도 영어 그림을 바탕으로 쓰고 가운데(차곡이와 제목 자리)만 같은 물방울 바탕으로 덮은 뒤 차곡이와 일본어 제목을 다시 그린다.
// 바탕 물방울은 영어 그림에서 잰 값이다: 간격 53.6px, 첫 물방울 중심 (52.22, 26.08), 반지름 약 6px, 민트 50%.
// 차곡이는 랜딩 첫 화면 SVG(판 세 장을 인 마지막 장면)를 1칸 7px로 그린다(영어 그림과 같은 크기).
// 제목 글꼴은 앱 일본어 화면과 같은 DotGothic16 부분 집합(deploy/build-chagok-ja-font.py). 맥의 Chrome 헤드리스로 찍고 sips 로 JPEG 로 바꾼다.
// Chrome 경로가 다르면 CHROME=<경로> 로 준다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'chagok');
const OUT = process.env.OUT ?? path.join(ROOT, 'assets/img/ja/og.jpg');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1200, H = 630, U = 7;
const PITCH = 53.6, DOT_X = 52.22, DOT_Y = 26.08;
const PATCH = { left: 240, top: 190, right: 970, bottom: 480 }; // 왼쪽 달리기 타일, 오른쪽 해 타일, 위 카메라, 아래 자전거에 닿지 않는 자리

const base = fs.readFileSync(path.join(ROOT, 'assets/img/en/og.jpg')).toString('base64');
const font = fs.readFileSync(path.join(ROOT, 'assets/fonts/dotgothic16/dotgothic16-ja.woff2')).toString('base64');
const landing = fs.readFileSync(path.join(ROOT, 'ja/index.html'), 'utf8');
const mascot = landing.match(/<svg class="m-hero2-splash"[^>]*>([\s\S]*?)<\/svg>/)?.[1];
if (!mascot) throw new Error('ja/index.html 에서 차곡이 SVG 를 찾지 못했다');

const mod = (a, n) => ((a % n) + n) % n;
const pw = PATCH.right - PATCH.left, ph = PATCH.bottom - PATCH.top;
const bx = mod(DOT_X - PITCH / 2 - PATCH.left, PITCH), by = mod(DOT_Y - PITCH / 2 - PATCH.top, PITCH);

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
@font-face { font-family: dg; src: url(data:font/woff2;base64,${font}) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { position: relative; background: url(data:image/jpeg;base64,${base}) 0 0 / ${W}px ${H}px no-repeat; color: #06261C; font-family: dg; }
.patch { position: absolute; left: ${PATCH.left}px; top: ${PATCH.top}px; width: ${pw}px; height: ${ph}px; background-color: #FCF2CF;
  background-image: radial-gradient(circle, rgba(175,225,203,.5) 6px, transparent 6.6px); background-size: ${PITCH}px ${PITCH}px; background-position: ${bx}px ${by}px; }
.hero { position: absolute; left: 50%; top: 316px; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 48px; }
.mascot { display: block; width: ${16 * U}px; height: ${21 * U}px; }
h1 { font-weight: normal; font-size: 50px; line-height: 68px; white-space: nowrap; }
.band { background: #FD855F; padding: 0 10px; }
</style></head><body>
<div class="patch"></div>
<div class="hero"><svg class="mascot" viewBox="4 2 16 21" shape-rendering="crispEdges">${mascot}</svg>
<h1>今日の「できた」に<br><span class="band">シールを1枚</span></h1></div>
<script>
document.fonts.ready.then(() => {
  const b = document.querySelector('.hero').getBoundingClientRect();
  const ok = b.left >= ${PATCH.left + 20} && b.right <= ${PATCH.right - 20} && b.top >= ${PATCH.top + 20} && b.bottom <= ${PATCH.bottom - 20};
  document.body.setAttribute('data-check', ok ? 'ok' : 'hero ' + [b.left, b.top, b.right, b.bottom].map(Math.round).join(','));
});
</script></body></html>`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chagok-landing-og-'));
const page = path.join(dir, 'og.html');
fs.writeFileSync(page, html);
const chrome = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${path.join(dir, 'profile')}`,
  '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`, '--virtual-time-budget=3000', ...args, `file://${page}`],
  { timeout: 60000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const check = chrome(['--dump-dom']).match(/data-check="([^"]*)"/)?.[1];
if (check !== 'ok') { console.error(`자리 검사 실패: ${check ?? '결과 없음'}`); process.exit(1); }
const png = path.join(dir, 'og.png');
chrome([`--screenshot=${png}`]);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', png, '--out', OUT], { stdio: 'ignore' });
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${path.relative(process.cwd(), OUT)} ${Math.round(fs.statSync(OUT).size / 1024)}KB`);
