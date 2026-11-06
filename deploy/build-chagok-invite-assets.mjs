// 초대 페이지(chagok/invite/)가 쓰는 그림을 앱 저장소에서 만든다. 앱의 차곡이 그림이나 스티커가 바뀌면 다시 돌린다.
//   node deploy/build-chagok-invite-assets.mjs <chagok-app 저장소 경로>
// 만드는 것: chagok/assets/invite/mascot-<포즈>.svg (앱 docs/design/character/character-data.json),
//           chagok/assets/invite/stickers.json (앱 src/stickers/color/stickers.generated.ts, 24×24 도트 스티커 {id: [[색, 경로], ...]})
import fs from 'node:fs';
import path from 'node:path';

const app = process.argv[2];
if (!app) { console.error('앱 저장소 경로를 주세요'); process.exit(1); }
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'chagok', 'assets', 'invite');

// 차곡이: 같은 색 칸을 가로로 이어 사각형 하나로 (앱 src/design-system/mascot.tsx mascotPaths와 같다)
const ink = '#06261C', lcd = '#C7DE94', apricot = '#FD855F', ivory = '#FEF1D1', mint = '#AFE1CB';
const cellColor = { '#': ink, g: lcd, o: apricot, w: ivory, m: mint };
const source = JSON.parse(fs.readFileSync(path.join(app, 'docs/design/character/character-data.json'), 'utf8'));
const art = { ...source.faces, ...source.variants, ...source.blockStates };
for (const pose of ['b0', 'b1', 'b2', 'b3', 'curious', 'shy', 'sleepy']) {
  const rows = art[pose];
  const byCell = new Map();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const cell = row[x];
      let end = x + 1;
      while (row[end] === cell) end += 1;
      if (cell !== '.') byCell.set(cell, [...(byCell.get(cell) ?? []), `M${x} ${y}H${end}V${y + 1}H${x}Z`]);
      x = end;
    }
  });
  const width = Math.max(...rows.map((r) => r.length));
  const paths = [...byCell].map(([cell, d]) => `<path fill="${cellColor[cell]}" d="${d.join('')}"/>`).join('');
  fs.writeFileSync(path.join(OUT, `mascot-${pose}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges">${paths}</svg>\n`);
}

// 스티커: 생성 파일에서 id와 층(색, 경로)만 꺼낸다
const ts = fs.readFileSync(path.join(app, 'src/stickers/color/stickers.generated.ts'), 'utf8');
const stickers = {};
for (const m of ts.matchAll(/\{id:'([^']+)',label:'[^']*',pack:'[^']+',layers:\[([^\]]*)\]\}/g)) {
  stickers[m[1]] = [...m[2].matchAll(/\{color:'([^']+)',d:'([^']+)'\}/g)].map((l) => [l[1], l[2]]);
}
fs.writeFileSync(path.join(OUT, 'stickers.json'), JSON.stringify(stickers));
console.log(`차곡이 7장, 스티커 ${Object.keys(stickers).length}종`);
