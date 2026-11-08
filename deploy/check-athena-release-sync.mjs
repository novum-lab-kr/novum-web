// deploy/sync-athena-release.mjs 시험(GitHub Actions · 손으로: node deploy/check-athena-release-sync.mjs) — 네트워크 없이
// 지금 사이트 파일을 임시 폴더에 복사하고 가짜 GitHub 응답(공개 저장소 · 소스 태그 · 태그별 docs/site-release-notes.json)으로 맞춰 본다. 실제 사이트 파일은 건드리지 않는다.
//   다음 패치(앞 2줄 · 뒤 3줄 → 새 1줄) · 새 minor(지난 태그에 파일 없음 → 그 minor 줄 전부) · 판 하나 묶음 → 다음 패치(범위 시작 남김) · 새 줄 없음 · 사이트에 이미 있는 줄 · 파일 없음 · 파일 이상 · 같은 버전 · 낮은 버전 · 입력이 latest 보다 높음 · 이스케이프
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { REPO_ROOT, sync, parseRangeStart, formatRange, validateNotes, newNoteItems } from './sync-athena-release.mjs';

const LANGS = ['ko', 'ja', 'zh'];
const FILES = ['athena/download/index.html', 'athena/releases/index.html', ...LANGS.map((lang) => `athena/assets/i18n/${lang}.js`)];
const PUBLISHED = '2027-01-15T03:00:00Z'; // 한국 날짜 2027-01-15 — 지금 묶음 날짜와 해가 달라 범위 모양까지 본다
const NOTES_PATH = '/repos/novum-lab-kr/athena-studio/contents/docs/site-release-notes.json?ref=v';
const errors = [];
const expect = (ok, message) => { if (!ok) errors.push(message); };

const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const dict = (root, lang) => {
  const sandbox = { window: {} };
  vm.runInNewContext(read(root, `athena/assets/i18n/${lang}.js`), sandbox);
  return sandbox.window.ATHENA_I18N[lang];
};

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-sync-'));
  for (const file of FILES) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, file), path.join(root, file));
  }
  return root;
}

const current = /<span data-rel-ver>(\d+)\.(\d+)\.(\d+)<\/span>/.exec(read(REPO_ROOT, 'athena/download/index.html')).slice(1).map(Number);
const currentVersion = current.join('.');
const currentMinor = `${current[0]}.${current[1]}`;
const nextMinor = `${current[0]}.${current[1] + 1}`;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const line = (tag, en) => ({ tag, en, ko: `${en} ko`, ja: `${en} ja`, zh: `${en} zh` });
const OLD_LINES = [line('new', 'Old line one.'), line('improved', 'Old line two.')];
const ESCAPED = { tag: 'fixed', en: 'Fixed <b>"quotes"</b> & tags.', ko: '따옴표 "고침" <i>', ja: '修正しました。', zh: '已修复。' };
const NEW_MINOR_LINES = [line('fixed', 'A fix in the new minor.'), line('new', 'A new thing.')];

// 가짜 바깥: 공개 저장소 latest, 소스 tags, 태그별 글 파일(notes: { "<버전>": 글 객체 | 글자 | undefined(404) })
function fakeFetch({ latest, tags, notes }) {
  const calls = [];
  const handler = async (url) => {
    calls.push(url);
    if (url.endsWith('/repos/novum-lab-kr/athena-studio-releases/releases/latest')) return json({ tag_name: `v${latest}`, published_at: PUBLISHED, body: '### New\n- Line\n' });
    if (url.includes('/repos/novum-lab-kr/athena-studio/tags?')) return json(tags.map((tag, index) => ({ name: `v${tag}`, commit: { sha: `sha${index}` } })));
    if (url.includes(NOTES_PATH)) {
      const file = notes[url.slice(url.indexOf(NOTES_PATH) + NOTES_PATH.length)];
      if (file === undefined) return json({ message: 'Not Found' }, 404);
      const text = typeof file === 'string' ? file : JSON.stringify(file);
      return json({ type: 'file', encoding: 'base64', content: Buffer.from(text).toString('base64') });
    }
    return json({ message: 'not found' }, 404);
  };
  return { handler, calls };
}

async function run(name, { latest, tags, input = '', notes = {}, root = makeRoot() }) {
  const logs = [];
  const fake = fakeFetch({ latest, tags, notes });
  let result;
  let failure = null;
  try {
    result = await sync({ root, version: input, env: {}, fetchImpl: fake.handler, sleep: async () => {}, log: (text) => logs.push(text), warn: (text) => logs.push(text) });
  } catch (error) {
    failure = error;
  }
  expect(!fake.calls.some((url) => url.includes('anthropic')), `${name}: Claude API 를 불렀다`);
  return { root, result, failure, logs, calls: fake.calls };
}

const warningsOf = (logs) => logs.filter((text) => text.startsWith('경고:'));

function unchanged(root) {
  return FILES.every((file) => read(root, file) === read(REPO_ROOT, file));
}

// 페이지의 data-t 키가 세 사전에 모두 있는지(check-athena.mjs 1번과 같은 뜻)
function keysCovered(root, name) {
  const keys = new Set([...read(root, 'athena/releases/index.html').matchAll(/data-t="([^"]+)"/g)].map((match) => match[1]));
  for (const lang of LANGS) {
    const values = dict(root, lang);
    for (const key of keys) expect(key in values, `${name}: ${lang} 사전에 ${key} 없음`);
  }
}

// ---- 순수 함수 ----
expect(JSON.stringify(parseRangeStart('Nov 3–5, 2026')) === '{"year":2026,"month":11,"day":3}', 'parseRangeStart 같은 달');
expect(JSON.stringify(parseRangeStart('Oct 31 – Nov 2, 2026')) === '{"year":2026,"month":10,"day":31}', 'parseRangeStart 달 넘김');
expect(JSON.stringify(parseRangeStart('Dec 30, 2026 – Jan 2, 2027')) === '{"year":2026,"month":12,"day":30}', 'parseRangeStart 해 넘김');
expect(formatRange({ year: 2026, month: 11, day: 3 }, { year: 2026, month: 11, day: 6 }, 'en') === 'Nov 3–6, 2026', 'formatRange en');
expect(formatRange({ year: 2026, month: 11, day: 3 }, { year: 2026, month: 11, day: 6 }, 'ko') === '2026년 11월 3–6일', 'formatRange ko');
expect(formatRange({ year: 2026, month: 11, day: 3 }, { year: 2026, month: 11, day: 6 }, 'ja') === '2026 年 11 月 3–6 日', 'formatRange ja');
for (const bad of [{}, { versions: [{ version: '9.9.9', items: [] }] }, { versions: [{ version: '1.0.0', items: [{ tag: 'new', en: 'a', ko: 'b', ja: 'c' }] }] }, { versions: [{ version: '1.0.0', items: [{ tag: 'odd', en: 'a', ko: 'b', ja: 'c', zh: 'd' }] }] }]) {
  let threw = false;
  try { validateNotes(bad, ['1.0.0']); } catch { threw = true; }
  expect(threw, `validateNotes 가 잘못된 응답을 받았다: ${JSON.stringify(bad)}`);
}

{
  const items = newNoteItems({ [currentMinor]: OLD_LINES }, { [currentMinor]: [...OLD_LINES, line('security', 'Sec.')], [nextMinor]: [line('new', 'Other minor.')] }, `${currentMinor}.99`);
  expect(items.length === 1 && items[0].tag === 'sec' && items[0].en === 'Sec.', `newNoteItems: 새 줄 · 태그 이름 바꾸기 — ${JSON.stringify(items)}`);
  expect(newNoteItems(null, { [nextMinor]: NEW_MINOR_LINES }, `${nextMinor}.0`).length === 2, 'newNoteItems: 지난 파일 없음 → 그 minor 줄 전부');
}

// ---- 다음 패치(지금 묶음에 더하기 · 앞 2줄 → 뒤 3줄이면 새 1줄만) ----
{
  const between = `${current[0]}.${current[1]}.${current[2] + 1}`;
  const next = `${current[0]}.${current[1]}.${current[2] + 2}`;
  const notes = { [currentVersion]: { [currentMinor]: OLD_LINES }, [next]: { [currentMinor]: [...OLD_LINES, ESCAPED] } };
  const { root, result, failure, logs } = await run('다음 패치', { latest: next, tags: [next, between, currentVersion], input: `v${next}`, notes });
  expect(!failure, `다음 패치: 실패 ${failure?.message}`);
  expect(result?.changed === true, '다음 패치: changed 가 아니다');
  expect(!warningsOf(logs).length, `다음 패치: 경고가 나왔다 — ${logs.join(' / ')}`);
  const download = read(root, 'athena/download/index.html');
  expect((download.match(new RegExp(`<span data-rel-ver>${next.replace(/\./g, '\\.')}</span>`, 'g')) ?? []).length === 3, '다음 패치: 다운로드 data-rel-ver 3곳');
  expect(download.includes('<span data-rel-date>January 15, 2027</span>'), '다음 패치: 다운로드 날짜');
  for (const lang of LANGS) expect(dict(root, lang)['d.ver'].includes(`<span data-rel-ver>${next}</span>`), `다음 패치: ${lang} d.ver`);
  expect(dict(root, 'ko')['d.ver'].includes('2027년 1월 15일'), '다음 패치: ko d.ver 날짜');
  const releases = read(root, 'athena/releases/index.html');
  const firstGroup = releases.slice(releases.indexOf('<div class="rel">'), releases.indexOf('<div class="rel">', releases.indexOf('<div class="rel">') + 1));
  expect(firstGroup.includes(` – v${next}<br>`), '다음 패치: 묶음 범위 끝');
  expect(firstGroup.includes(`<h4 class="rel-vh">v${next}</h4>`), '다음 패치: 새 버전 제목');
  expect(!firstGroup.includes(`<h4 class="rel-vh">v${between}</h4>`), '다음 패치: 항목 없는 버전에 제목이 생겼다');
  const block = firstGroup.slice(firstGroup.indexOf(`<h4 class="rel-vh">v${next}</h4>`));
  const blockItems = block.slice(0, block.indexOf('</ul>')).match(/<li>/g) ?? [];
  expect(blockItems.length === 1, `다음 패치: 새 판 항목이 ${blockItems.length}줄 — 1줄이어야`);
  expect(!releases.includes('Old line one.'), '다음 패치: 지난 줄이 다시 붙었다');
  expect(firstGroup.includes('<span class="tag fix" data-t="r.fix">Fixed</span>'), '다음 패치: fixed → fix 태그');
  expect(firstGroup.includes('Fixed &lt;b&gt;&quot;quotes&quot;&lt;/b&gt; &amp; tags.'), '다음 패치: 영어 글 이스케이프');
  expect(firstGroup.includes(`releases/tag/v${next}">See everything in v${next}`), '다음 패치: GitHub 링크');
  expect(/2027/.test(firstGroup.split('\n')[0]), '다음 패치: 묶음 날짜가 새 날짜까지');
  expect(Object.values(dict(root, 'ko')).includes('따옴표 &quot;고침&quot; &lt;i&gt;'), '다음 패치: ko 글 이스케이프');
  keysCovered(root, '다음 패치');
  fs.rmSync(root, { recursive: true, force: true });
}

// ---- 새 minor(묶음 새로 · 지난 태그에 파일 없음 → 그 minor 줄 전부) ----
{
  const between = `${current[0]}.${current[1]}.${current[2] + 1}`;
  const next = `${nextMinor}.0`;
  const notes = { [next]: { [currentMinor]: OLD_LINES, [nextMinor]: NEW_MINOR_LINES } };
  const { root, result, failure, logs } = await run('새 minor', { latest: next, tags: [next, between, currentVersion], notes });
  expect(!failure && result?.changed, `새 minor: 실패 ${failure?.message}`);
  expect(!warningsOf(logs).length, `새 minor: 경고가 나왔다 — ${logs.join(' / ')}`);
  const releases = read(root, 'athena/releases/index.html');
  const id = current[0] === 0 ? String(current[1] + 1) : `${current[0]}-${current[1] + 1}`;
  expect(releases.includes(`<b>${nextMinor}</b><span>v${between} – v${next}<br><span data-t="r.d${id}">Jan 15, 2027</span>`), '새 minor: 묶음 머리');
  expect(releases.indexOf(`<b>${nextMinor}</b>`) < releases.indexOf(`<b>${currentMinor}</b>`), '새 minor: 새 묶음이 맨 위');
  expect(releases.includes(`data-t="r.${id}m"`), '새 minor: 링크 줄');
  expect(releases.includes(`data-t="r.${id}k1"`) && releases.includes(`data-t="r.${id}k2"`) && !releases.includes(`data-t="r.${id}k3"`), '새 minor: 항목 키 2개');
  expect(!releases.includes('Old line one.'), '새 minor: 다른 minor 줄이 붙었다');
  expect(releases.indexOf('A new thing.') < releases.indexOf('A fix in the new minor.'), '새 minor: New 가 Fixed 보다 앞');
  for (const lang of LANGS) {
    const values = dict(root, lang);
    expect(values[`r.${id}m`]?.includes(`v${next}`), `새 minor: ${lang} r.${id}m`);
    expect(Boolean(values[`r.d${id}`]), `새 minor: ${lang} r.d${id}`);
    expect(Object.values(values).includes(`A new thing. ${lang}`), `새 minor: ${lang} 글`);
  }
  keysCovered(root, '새 minor');
  fs.rmSync(root, { recursive: true, force: true });
}

// ---- 판 하나로 시작한 묶음 → 다음 패치(시작 판을 범위 시작으로 남긴다 · 2026-11-08 v0.56.0 → v0.56.1 때 시작 판이 사라졌다) ----
{
  const first = `${nextMinor}.0`;
  const patch = `${nextMinor}.1`;
  const { root, failure } = await run('판 하나 묶음', { latest: first, tags: [first], notes: { [first]: { [nextMinor]: NEW_MINOR_LINES } } });
  expect(!failure, `판 하나 묶음: 새 minor 실패 ${failure?.message}`);
  expect(read(root, 'athena/releases/index.html').includes(`<b>${nextMinor}</b><span>v${first}<br>`), '판 하나 묶음: 머리가 판 하나가 아니다');
  const second = await run('판 하나 묶음 다음 패치', { root, latest: patch, tags: [patch, first], notes: { [first]: { [nextMinor]: NEW_MINOR_LINES }, [patch]: { [nextMinor]: [...NEW_MINOR_LINES, line('fixed', 'Patch fix.')] } } });
  expect(!second.failure && second.result?.changed, `판 하나 묶음: 다음 패치 실패 ${second.failure?.message}`);
  expect(read(root, 'athena/releases/index.html').includes(`<b>${nextMinor}</b><span>v${first} – v${patch}<br>`), '판 하나 묶음: 범위 시작 판이 사라졌다');
  keysCovered(root, '판 하나 묶음');
  fs.rmSync(root, { recursive: true, force: true });
}

// ---- 새 줄 없음 → 버전만 · 경고 없음 ----
{
  const next = `${current[0]}.${current[1]}.${current[2] + 1}`;
  const same = { [currentMinor]: OLD_LINES };
  const { root, result, failure, logs } = await run('새 줄 없음', { latest: next, tags: [next], notes: { [currentVersion]: same, [next]: same } });
  expect(!failure && result?.changed, `새 줄 없음: 실패 ${failure?.message}`);
  expect(!read(root, 'athena/releases/index.html').includes(`<h4 class="rel-vh">v${next}</h4>`), '새 줄 없음: 빈 버전 제목이 생겼다');
  expect(!warningsOf(logs).length, `새 줄 없음: 경고가 나왔다 — ${logs.join(' / ')}`);
  fs.rmSync(root, { recursive: true, force: true });
}

// ---- 사이트에 이미 있는 줄 → 건너뜀(첫 회 · 지난 태그에 파일 없음) ----
{
  const next = `${current[0]}.${current[1]}.${current[2] + 1}`;
  const onSite = /<span data-t="r\.[\w-]+k\d+">([^<]+)<\/span>/.exec(read(REPO_ROOT, 'athena/releases/index.html'))[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const { root, result, failure } = await run('이미 있는 줄', { latest: next, tags: [next], notes: { [next]: { [currentMinor]: [line('new', onSite), line('new', 'Only new.')] } } });
  expect(!failure && result?.changed, `이미 있는 줄: 실패 ${failure?.message}`);
  const releases = read(root, 'athena/releases/index.html');
  expect(releases.includes('>Only new.</span>'), '이미 있는 줄: 새 줄이 없다');
  const block = releases.slice(releases.indexOf(`<h4 class="rel-vh">v${next}</h4>`));
  expect((block.slice(0, block.indexOf('</ul>')).match(/<li>/g) ?? []).length === 1, '이미 있는 줄: 사이트에 있는 줄을 다시 붙였다');
  fs.rmSync(root, { recursive: true, force: true });
}

// ---- 파일 없음 · 파일 이상 → 버전만 + 경고 한 줄 ----
const goodPrevious = { [currentMinor]: OLD_LINES };
for (const [name, latestFile] of [
  ['파일 없음', undefined],
  ['JSON 아님', 'not json'],
  ['모양 틀림', [OLD_LINES]],
  ['태그 모름', { [currentMinor]: [line('odd', 'Odd tag.')] }],
  ['언어 빠짐', { [currentMinor]: [{ tag: 'new', en: 'No zh.', ko: '가', ja: 'あ' }] }],
]) {
  const next = `${current[0]}.${current[1]}.${current[2] + 1}`;
  const { root, result, failure, logs } = await run(name, { latest: next, tags: [next], notes: { [currentVersion]: goodPrevious, [next]: latestFile } });
  expect(!failure && result?.changed, `${name}: 실패 ${failure?.message}`);
  expect(read(root, 'athena/download/index.html').includes(`<span data-rel-ver>${next}</span>`), `${name}: 버전을 맞추지 않았다`);
  expect(!read(root, 'athena/releases/index.html').includes(`<h4 class="rel-vh">v${next}</h4>`), `${name}: 글이 들어갔다`);
  expect(warningsOf(logs).length === 1, `${name}: 경고가 한 줄이 아니다 — ${logs.join(' / ')}`);
  keysCovered(root, name);
  fs.rmSync(root, { recursive: true, force: true });
}

// ---- 같은 버전 · 낮은 버전 → 아무것도 안 함 ----
for (const [name, latest] of [['같은 버전', currentVersion], ['낮은 버전', `${current[0]}.${current[1]}.${Math.max(current[2] - 1, 0)}`]]) {
  if (latest === currentVersion && name === '낮은 버전') continue;
  const { root, result, failure } = await run(name, { latest, tags: [latest] });
  expect(!failure && result?.changed === false, `${name}: 바꾸려 했다(${failure?.message ?? ''})`);
  expect(unchanged(root), `${name}: 파일이 바뀌었다`);
  fs.rmSync(root, { recursive: true, force: true });
}

// ---- 입력이 latest 보다 높음 → 실패(아직 공개 안 됨) ----
{
  const next = `${current[0]}.${current[1]}.${current[2] + 1}`;
  const { root, failure } = await run('입력이 더 높음', { latest: currentVersion, tags: [], input: `v${next}` });
  expect(Boolean(failure), '입력이 더 높음: 실패해야 한다');
  expect(unchanged(root), '입력이 더 높음: 파일이 바뀌었다');
  fs.rmSync(root, { recursive: true, force: true });
}

if (errors.length) {
  console.error(`릴리스 맞추기 시험 실패 ${errors.length}건:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('릴리스 맞추기 시험 통과');
