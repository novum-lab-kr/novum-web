// 초대 링크 미리보기 그림(chagok/assets/invite/og.png, 1200×630, invite/index.html 의 og:image)을 만든다.
//   node deploy/build-chagok-og.mjs
// HTML 한 장(인라인 CSS, 사이트 도트 글꼴, 차곡이 SVG, stickers.json 스티커)을 쓰고 맥의 Chrome 헤드리스로 찍는다.
// 카카오톡은 미리보기 양옆을 조금 자르므로 차곡이와 글은 가운데에 두고, 스티커 타일은 글과 차곡이에서 40px 넘게,
// 양옆 끝에서 60px 넘게 떨어뜨린다. 찍기 전에 같은 페이지를 한 번 더 열어 이 간격을 재고, 어기면 멈춘다.
// Chrome 경로가 다르면 CHROME=<경로> 로 준다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'chagok');
const OUT = path.join(ROOT, 'assets', 'invite', 'og.png');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1200, H = 630, GAP = 40, SIDE = 60;

const ink = '#06261C', mint = '#AFE1CB', apricot = '#FD855F', ivory = '#FEF1D1';
const font = fs.readFileSync(path.join(ROOT, 'assets/fonts/neodgm/neodgm.woff2')).toString('base64');
const mascot = fs.readFileSync(path.join(ROOT, 'assets/invite/mascot-b3.svg'), 'utf8');
const stickers = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/invite/stickers.json'), 'utf8'));

// 타일: [스티커, 왼쪽, 위, 기울기]. 타일은 104px(그림자 8px 별도)
const tiles = [
  ['basic.star', 84, 52, -8], ['basic.flower', 86, 262, 6], ['basic.cat', 84, 468, -5],
  ['basic.shoe', 330, 34, 7], ['basic.moon', 770, 40, -6],
  ['basic.clover', 420, 488, -7], ['basic.music', 690, 494, 5],
  ['animals_normal.rabbit', 1010, 52, 8], ['basic.water', 1000, 262, -6], ['animals_normal.dog', 1010, 468, 6],
];

const sticker = (id) => {
  const layers = stickers[id];
  if (!layers) throw new Error(`stickers.json 에 ${id} 가 없다`);
  return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">${layers.map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('')}</svg>`;
};

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: px; src: url(data:font/woff2;base64,${font}) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { position: relative; font-family: px; color: ${ink}; background-color: ${ivory};
  background-image: radial-gradient(circle, ${mint} 6px, transparent 6.5px); background-size: 52px 52px; background-position: -4px -4px; }
.hero { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 40px; }
.mascot { width: 156px; height: 156px; }
.mascot svg { width: 100%; height: 100%; display: block; }
h1 { font-weight: normal; font-size: 54px; line-height: 72px; white-space: nowrap; }
.band { background: ${apricot}; padding: 0 12px; margin-right: 6px; }
p { font-size: 26px; line-height: 34px; margin-top: 18px; }
.tile { position: absolute; width: 104px; height: 104px; background: #FFFDF6; border: 6px solid ${ink}; border-radius: 16px;
  box-shadow: 8px 8px 0 ${ink}; display: flex; align-items: center; justify-content: center; }
.tile svg { width: 64px; height: 64px; display: block; }
</style></head><body>
<div class="hero"><div class="mascot">${mascot}</div>
<div class="text"><h1>친구와 같이<br><span class="band">스티커 판</span> 채워요</h1><p>초대를 받았어요</p></div></div>
${tiles.map(([id, x, y, r]) => `<div class="tile" style="left:${x}px;top:${y}px;transform:rotate(${r}deg)">${sticker(id)}</div>`).join('\n')}
<script>
document.fonts.ready.then(() => {
  const box = (el) => el.getBoundingClientRect();
  const keep = [box(document.querySelector('.mascot')), box(document.querySelector('.text'))];
  const bad = [];
  document.querySelectorAll('.tile').forEach((t, i) => {
    const b = box(t), right = b.right + 8, bottom = b.bottom + 8; // 그림자까지
    if (b.left < ${SIDE} || right > ${W - SIDE} || b.top < 0 || bottom > ${H}) bad.push('tile' + i + ' 안전 영역 밖');
    for (const k of keep) {
      const dx = Math.max(k.left - right, b.left - k.right, 0), dy = Math.max(k.top - bottom, b.top - k.bottom, 0);
      if (Math.hypot(dx, dy) < ${GAP}) bad.push('tile' + i + ' 글이나 차곡이와 ' + Math.round(Math.hypot(dx, dy)) + 'px');
    }
  });
  const t = box(document.querySelector('.hero'));
  if (t.left < ${SIDE} || t.right > ${W - SIDE}) bad.push('글이 안전 영역 밖');
  document.body.setAttribute('data-check', bad.length ? bad.join(', ') : 'ok');
});
</script></body></html>`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chagok-og-'));
const page = path.join(dir, 'og.html');
fs.writeFileSync(page, html);

// Chrome 헤드리스가 가끔 멈춘다: 60초 제한, 세 번까지
const chrome = (args) => {
  for (let i = 1; ; i += 1) {
    try {
      return execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${path.join(dir, 'profile' + i)}`,
        '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`, '--virtual-time-budget=3000', ...args, `file://${page}`],
        { timeout: 60000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
      if (i >= 3) throw e;
      console.error(`Chrome 재시도 ${i}: ${e.message.split('\n')[0]}`);
    }
  }
};

const check = chrome(['--dump-dom']).match(/data-check="([^"]*)"/)?.[1];
if (check !== 'ok') { console.error(`간격 검사 실패: ${check ?? '결과 없음'}`); process.exit(1); }
chrome([`--screenshot=${OUT}`]);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${path.relative(process.cwd(), OUT)} ${Math.round(fs.statSync(OUT).size / 1024)}KB`);
