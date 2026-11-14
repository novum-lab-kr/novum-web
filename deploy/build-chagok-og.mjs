// 초대 링크 미리보기 그림(chagok/assets/invite/og.png, 1200×630, invite/index.html 의 og:image)을 만든다.
//   node deploy/build-chagok-og.mjs            # 한국어 og.png
//   LANG_CODE=en node deploy/build-chagok-og.mjs  # 영어 og-en.png (invite/en.html 의 og:image, 2026-11-12)
//   LANG_CODE=ja node deploy/build-chagok-og.mjs  # 일본어 og-ja.png (invite/ja.html 의 og:image, 2026-11-14). 글꼴은 DotGothic16 부분 집합(deploy/build-chagok-ja-font.py)
// HTML 한 장(인라인 CSS, 사이트 도트 글꼴, 차곡이 SVG(기본 웃는 얼굴 mascot-smile, MASCOT=<이름>으로 바꿈), stickers.json 스티커)을 쓰고 맥의 Chrome 헤드리스로 찍는다.
// 카카오톡은 미리보기를 2:1 카드에 크게 채우며 양옆을 100px 안팎 자른다(2026-11-12 카톡 화면으로 확인). 그래서 차곡이와 글은 가운데에 두고,
// 스티커 타일은 글 줄과 차곡이에서 80px 넘게, 양옆 끝에서 60px 넘게 떨어뜨린다. 찍기 전에 같은 페이지를 한 번 더 열어 이 간격을 재고, 어기면 멈춘다.
// 간격은 글 덩어리(.text) 상자가 아니라 줄마다(h1 의 각 줄, 띠, 작은 줄) 실제 글자 상자로 잰다. 40px 기준은 카톡이 키워 보여 주면
// 타일이 「채워요」에 붙어 보였다(2026-11-12 사용자 카톡 화면).
// Chrome 경로가 다르면 CHROME=<경로> 로 준다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'chagok');
const LANG = ['en', 'ja'].includes(process.env.LANG_CODE) ? process.env.LANG_CODE : 'ko';
const OUT = process.env.OUT ?? path.join(ROOT, 'assets', 'invite', LANG === 'ko' ? 'og.png' : `og-${LANG}.png`);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1200, H = 630, GAP = 80, SIDE = 60;

const ink = '#06261C', mint = '#AFE1CB', apricot = '#FD855F', ivory = '#FEF1D1';
// 일본어는 앱과 같은 DotGothic16(일본어 화면 글꼴), 나머지는 Neo둥근모
const font = fs.readFileSync(path.join(ROOT, LANG === 'ja' ? 'assets/fonts/dotgothic16/dotgothic16-ja.woff2' : 'assets/fonts/neodgm/neodgm.woff2')).toString('base64');
const mascot = fs.readFileSync(path.join(ROOT, `assets/invite/mascot-${process.env.MASCOT ?? 'smile'}.svg`), 'utf8');
const stickers = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/invite/stickers.json'), 'utf8'));

// 타일: [스티커, 왼쪽, 위, 기울기]. 타일은 104px(그림자 8px 별도)
const tiles = [
  ['basic.star', 84, 52, -8], ['basic.flower', 86, 262, 6], ['basic.cat', 84, 468, -5],
  ['basic.shoe', 330, 34, 7], ['basic.moon', 780, 34, -6],
  ['basic.clover', 420, 488, -7], ['basic.music', 690, 494, 5],
  ['animals_normal.rabbit', 1010, 52, 8], ['basic.water', 1000, 262, -6], ['animals_normal.dog', 1010, 468, 6],
];

// 언어별 글. 줄과 띠는 같은 모양이다. 영어는 줄이 길어 글자를 줄인다(.en)
const COPY = {
  ko: '<h1>친구와 같이<br><span class="band">스티커 판</span> 채워요</h1><p>초대를 받았어요</p>',
  en: '<h1 class="en">Fill a<br><span class="band">sticker board</span> together</h1><p class="en">You\'re invited</p>',
  ja: '<h1 class="ja">友達と一緒に<br><span class="band">シール</span>を貼ろう</h1><p>招待が届きました</p>',
};

// 글과 차곡이 묶음의 크기. 0.9 아래로 줄여 옆 타일과 80px를 지킨다(2026-11-12). 영어는 줄이 길어 더 줄인다
const SCALE = { ko: 0.9, en: 0.85, ja: 0.85 };

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
.hero { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(var(--s, 1)); display: flex; align-items: center; gap: 40px; }
.mascot { width: 156px; height: 156px; }
.mascot svg { width: 100%; height: 100%; display: block; }
h1 { font-weight: normal; font-size: 54px; line-height: 72px; white-space: nowrap; }
.band { background: ${apricot}; padding: 0 12px; margin-right: 6px; }
p { font-size: 26px; line-height: 34px; margin-top: 18px; }
h1.en { font-size: 46px; line-height: 64px; }
h1.ja { font-size: 50px; line-height: 66px; } /* DotGothic16 은 글자 상자가 글자 크기의 1.45배라 조금 줄인다 */
h1.ja .band { margin-right: 0; } /* 일본어는 띠 뒤에 빈칸 없이 「を」가 붙는다 */
.tile { position: absolute; width: 104px; height: 104px; background: #FFFDF6; border: 6px solid ${ink}; border-radius: 16px;
  box-shadow: 8px 8px 0 ${ink}; display: flex; align-items: center; justify-content: center; }
.tile svg { width: 64px; height: 64px; display: block; }
</style></head><body style="--s:${SCALE[LANG]}">
<div class="hero"><div class="mascot">${mascot}</div>
<div class="text">${COPY[LANG]}</div></div>
${tiles.map(([id, x, y, r]) => `<div class="tile" style="left:${x}px;top:${y}px;transform:rotate(${r}deg)">${sticker(id)}</div>`).join('\n')}
<script>
document.fonts.ready.then(() => {
  const box = (el) => el.getBoundingClientRect();
  // 글은 줄마다 실제 글자 상자(Range.getClientRects)로 잰다. .text 상자 하나로 재면 줄 끝 모양을 못 본다
  const keep = [box(document.querySelector('.mascot'))];
  document.querySelectorAll('.text h1, .text p').forEach((el) => {
    const r = document.createRange(); r.selectNodeContents(el);
    for (const rect of r.getClientRects()) if (rect.width && rect.height) keep.push(rect);
  });
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
  document.body.setAttribute('data-check', bad.length ? bad.join(', ') + ' | ' + keep.map((k) => [k.left, k.top, k.right, k.bottom].map(Math.round).join(',')).join(' ; ') : 'ok');
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
