// deploy/sync-athena-release.mjs 시험(GitHub Actions · 손으로: node deploy/check-athena-release-sync.mjs) — 네트워크 없이
// 지금 사이트 파일을 임시 폴더에 복사하고 가짜 GitHub · Claude 응답으로 맞춰 본다. 실제 사이트 파일은 건드리지 않는다.
//   다음 패치 · 새 minor · 키 없음 · Claude 응답 이상 · 같은 버전 · 낮은 버전 · 입력이 latest 보다 높음 · 이스케이프 · 키 값이 로그에 없음
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { REPO_ROOT, sync, parseRangeStart, formatRange, validateNotes } from './sync-athena-release.mjs';

const LANGS = ['ko', 'ja', 'zh'];
const FILES = ['athena/download/index.html', 'athena/releases/index.html', ...LANGS.map((lang) => `athena/assets/i18n/${lang}.js`)];
const FAKE_KEY = 'sk-test-not-a-real-key-0000';
const PUBLISHED = '2027-01-15T03:00:00Z'; // 한국 날짜 2027-01-15 — 지금 묶음 날짜와 해가 달라 범위 모양까지 본다
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

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

// 가짜 바깥: 공개 저장소 latest · 목록, 소스 compare · tags, Claude
function fakeFetch({ latest, tags, claude }) {
  const calls = [];
  const handler = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/repos/novum-lab-kr/athena-studio-releases/releases/latest')) return json({ tag_name: `v${latest}`, published_at: PUBLISHED, body: '### New\n- Old line\n- Brand new line from the CHANGELOG\n' });
    if (url.includes('/repos/novum-lab-kr/athena-studio-releases/releases?')) return json([{ tag_name: `v${currentVersion}`, draft: false, body: '### New\n- Old line\n' }]);
    if (url.includes('/repos/novum-lab-kr/athena-studio/compare/')) return json({ commits: tags.map((tag, index) => ({ sha: `sha${index}`, commit: { message: `커밋 ${tag}\n\n본문` } })) });
    if (url.includes('/repos/novum-lab-kr/athena-studio/tags?')) return json(tags.map((tag, index) => ({ name: `v${tag}`, commit: { sha: `sha${index}` } })));
    if (url === 'https://api.anthropic.com/v1/messages') return claude(init);
    return json({ message: 'not found' }, 404);
  };
  return { handler, calls };
}

const claudeOk = (versions) => (init) => {
  const body = JSON.parse(init.body);
  expect(init.headers['x-api-key'] === FAKE_KEY, 'Claude 요청에 x-api-key 가 없다');
  expect(init.headers['anthropic-version'] === '2026-10-21', 'anthropic-version 헤더가 다르다');
  expect(body.model === 'claude-sonnet-5-5', `모델이 ${body.model}`);
  expect(body.output_config?.format?.type === 'json_schema', 'output_config.format 이 json_schema 가 아니다');
  const items = [{ tag: 'Fix', en: 'Fixed <b>"quotes"</b> & tags.', ko: '따옴표 "고침" <i>', ja: '修正しました。', zh: '已修复。' }, { tag: 'new', en: 'A new thing.', ko: '새것.', ja: '新しいもの。', zh: '新东西。' }];
  const text = JSON.stringify({ versions: versions.map((version, index) => ({ version, items: index === versions.length - 1 ? items : [] })) });
  return json({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });
};

async function run(name, { latest, tags, input = '', key = FAKE_KEY, claude }) {
  const root = makeRoot();
  const logs = [];
  const fake = fakeFetch({ latest, tags, claude: claude ?? claudeOk(tags) });
  let result;
  let failure = null;
  try {
    result = await sync({ root, version: input, env: key ? { ANTHROPIC_API_KEY: key } : {}, fetchImpl: fake.handler, sleep: async () => {}, log: (text) => logs.push(text), warn: (text) => logs.push(text) });
  } catch (error) {
    failure = error;
  }
  const leaked = logs.some((text) => text.includes(FAKE_KEY)) || String(failure?.message ?? '').includes(FAKE_KEY);
  expect(!leaked, `${name}: 키 값이 로그에 나왔다`);
  return { root, result, failure, logs, calls: fake.calls };
}

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

// ---- 다음 패치(지금 묶음에 더하기) ----
{
  const between = `${current[0]}.${current[1]}.${current[2] + 1}`;
  const next = `${current[0]}.${current[1]}.${current[2] + 2}`;
  const { root, result, failure } = await run('다음 패치', { latest: next, tags: [between, next], input: `v${next}` });
  expect(!failure, `다음 패치: 실패 ${failure?.message}`);
  expect(result?.changed === true, '다음 패치: changed 가 아니다');
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
  expect(firstGroup.includes('Fixed &lt;b&gt;&quot;quotes&quot;&lt;/b&gt; &amp; tags.'), '다음 패치: 영어 글 이스케이프');
  expect(firstGroup.indexOf('A new thing.') < firstGroup.indexOf('Fixed &lt;b&gt;'), '다음 패치: New 가 Fixed 보다 앞');
  expect(firstGroup.includes(`releases/tag/v${next}">See everything in v${next}`), '다음 패치: GitHub 링크');
  expect(/2027/.test(firstGroup.split('\n')[0]), '다음 패치: 묶음 날짜가 새 날짜까지');
  expect(Object.values(dict(root, 'ko')).includes('따옴표 &quot;고침&quot; &lt;i&gt;'), '다음 패치: ko 글 이스케이프');
  keysCovered(root, '다음 패치');
  fs.rmSync(root, { recursive: true, force: true });
}

// ---- 새 minor(묶음 새로) ----
{
  const between = `${current[0]}.${current[1]}.${current[2] + 1}`;
  const next = `${current[0]}.${current[1] + 1}.0`;
  const { root, result, failure } = await run('새 minor', { latest: next, tags: [between, next] });
  expect(!failure && result?.changed, `새 minor: 실패 ${failure?.message}`);
  const releases = read(root, 'athena/releases/index.html');
  const id = current[0] === 0 ? String(current[1] + 1) : `${current[0]}-${current[1] + 1}`;
  expect(releases.includes(`<b>${current[0]}.${current[1] + 1}</b><span>v${between} – v${next}<br><span data-t="r.d${id}">Jan 15, 2027</span>`), '새 minor: 묶음 머리');
  expect(releases.indexOf(`<b>${current[0]}.${current[1] + 1}</b>`) < releases.indexOf(`<b>${current[0]}.${current[1]}</b>`), '새 minor: 새 묶음이 맨 위');
  expect(releases.includes(`data-t="r.${id}m"`), '새 minor: 링크 줄');
  expect(releases.includes(`data-t="r.${id}k1"`) && releases.includes(`data-t="r.${id}k2"`), '새 minor: 항목 키');
  for (const lang of LANGS) {
    const values = dict(root, lang);
    expect(values[`r.${id}m`]?.includes(`v${next}`), `새 minor: ${lang} r.${id}m`);
    expect(Boolean(values[`r.d${id}`]), `새 minor: ${lang} r.d${id}`);
  }
  keysCovered(root, '새 minor');
  fs.rmSync(root, { recursive: true, force: true });
}

// ---- 키 없음 · Claude 실패 · 응답 이상 → 버전만 ----
for (const [name, options] of [
  ['키 없음', { key: '' }],
  ['Claude HTTP 500', { claude: () => json({ type: 'error', error: { type: 'api_error' } }, 500) }],
  ['Claude JSON 아님', { claude: () => json({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }) }],
  ['Claude 잘림', { claude: () => json({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"versions":[' }] }) }],
]) {
  const next = `${current[0]}.${current[1]}.${current[2] + 1}`;
  const { root, result, failure, logs, calls } = await run(name, { latest: next, tags: [next], ...options });
  expect(!failure && result?.changed, `${name}: 실패 ${failure?.message}`);
  expect(read(root, 'athena/download/index.html').includes(`<span data-rel-ver>${next}</span>`), `${name}: 버전을 맞추지 않았다`);
  expect(!read(root, 'athena/releases/index.html').includes(`<h4 class="rel-vh">v${next}</h4>`), `${name}: 글이 들어갔다`);
  expect(logs.filter((text) => text.startsWith('경고:')).length === 1, `${name}: 경고가 한 줄이 아니다 — ${logs.join(' / ')}`);
  if (name === '키 없음') expect(!calls.some((call) => call.url.includes('anthropic')), '키 없음: Claude 를 불렀다');
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
