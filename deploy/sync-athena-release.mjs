// 아테나 사이트(athena/)를 공개 저장소 최신 공개판에 맞춘다(2026-11-06 · 손으로: node deploy/sync-athena-release.mjs [--version vX.Y.Z])
// .github/workflows/athena-release-sync.yml 이 부른다 — athena-studio release-mac.yml 이 공개 직후 workflow_dispatch(입력 version)로 깨운다.
// 하는 일(영어 페이지 + 사전 ko · ja · zh — 언어판은 그 뒤 deploy/gen-athena-lang.mjs 가 만든다)
//   1) 다운로드 페이지 버전 줄 · 받기 카드 두 곳(data-rel-ver · data-rel-date)과 사전 d.ver
//   2) 릴리스 페이지 맨 위 묶음의 범위 끝 · 날짜 · GitHub 링크(r.<판>m). minor 가 바뀌면 묶음을 새로 만든다
//   3) 릴리스 항목 글 — athena-studio docs/site-release-notes.json({ "<minor>": [{ tag, en, ko, ja, zh }] })을 지난 공개판 태그와
//      새 공개판 태그에서 읽어(contents API · ref=태그) 새 태그에만 있는 줄(en 기준)을 새 판 항목으로 붙인다. 지난 태그에 파일이 없으면
//      새 판 minor 줄 전부. 줄은 CHANGELOG 를 쓸 때 같이 쓴다(2026-11-06 — 유료 API 를 쓰지 않는다). 검사(validateNotes)를 마친 뒤에만 쓰고 HTML 이스케이프한다
// 버전 = 공개 저장소 releases/latest 의 태그(입력은 확인용 — 늘 latest 를 다시 읽는다). 이미 같은 버전이거나 사이트보다 낮으면 아무것도 안 한다.
// 글 파일을 못 읽거나 형식이 틀리면 1) 2) 만 하고 글은 건너뛴다(경고 한 줄).
// 릴리스 페이지 머리 주석의 규칙(한 줄씩 짧게 · 태그 New/Improved/Fixed/Security · 버전 최신 순)을 따른다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASES_REPO = 'novum-lab-kr/athena-studio-releases';
const SOURCE_REPO = 'novum-lab-kr/athena-studio';
const GITHUB_API = 'https://api.github.com';
// 사이트 글 파일(athena-studio) — 태그 이름은 new · improved · fixed · security(페이지 태그 new · imp · fix · sec 로 바꾼다)
const NOTES_FILE = 'docs/site-release-notes.json';
const FILE_TAGS = { new: 'new', improved: 'imp', fixed: 'fix', security: 'sec' };
const LANGS = ['ko', 'ja', 'zh'];
const FILES = {
  download: 'athena/download/index.html',
  releases: 'athena/releases/index.html',
  ...Object.fromEntries(LANGS.map((lang) => [lang, `athena/assets/i18n/${lang}.js`])),
};
// 한 버전 안 순서 = 이 순서(New → Improved → Fixed → Security)
const TAG_LABELS = { new: 'New', imp: 'Improved', fix: 'Fixed', sec: 'Security' };
const TAG_ORDER = Object.keys(TAG_LABELS);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_TEXT_LENGTH = 500;

// ---- 버전 · 날짜 ----

export function parseVersion(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? '').trim());
  return match ? match.slice(1).map(Number) : null;
}

export function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < 3; index++) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

const bare = (version) => parseVersion(version).join('.');

// 배포판과 같은 한국 날짜(다운로드 페이지 formatDate 와 같은 기준)
export function kstDate(iso) {
  const kst = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1, day: kst.getUTCDate() };
}

// 다운로드 페이지 날짜 — 페이지 안 formatDate 와 같은 모양
export function formatDay(date, lang) {
  if (lang === 'ko') return `${date.year}년 ${date.month}월 ${date.day}일`;
  if (lang === 'ja' || lang === 'zh') return `${date.year} 年 ${date.month} 月 ${date.day} 日`;
  return `${MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
}

// 릴리스 묶음 날짜 — 사전에 있는 모양(Nov 3–5, 2026 · 2026년 11월 3–5일 · 2026 年 11 月 3–5 日). 달 · 해가 바뀌면 양쪽을 다 적는다
export function formatRange(start, end, lang) {
  const short = (date) => MONTHS[date.month - 1].slice(0, 3);
  const sameYear = start.year === end.year;
  const sameMonth = sameYear && start.month === end.month;
  const sameDay = sameMonth && start.day === end.day;
  if (lang === 'ko') {
    if (sameDay) return `${start.year}년 ${start.month}월 ${start.day}일`;
    if (sameMonth) return `${start.year}년 ${start.month}월 ${start.day}–${end.day}일`;
    if (sameYear) return `${start.year}년 ${start.month}월 ${start.day}일 – ${end.month}월 ${end.day}일`;
    return `${start.year}년 ${start.month}월 ${start.day}일 – ${end.year}년 ${end.month}월 ${end.day}일`;
  }
  if (lang === 'ja' || lang === 'zh') {
    if (sameDay) return `${start.year} 年 ${start.month} 月 ${start.day} 日`;
    if (sameMonth) return `${start.year} 年 ${start.month} 月 ${start.day}–${end.day} 日`;
    if (sameYear) return `${start.year} 年 ${start.month} 月 ${start.day} 日 – ${end.month} 月 ${end.day} 日`;
    return `${start.year} 年 ${start.month} 月 ${start.day} 日 – ${end.year} 年 ${end.month} 月 ${end.day} 日`;
  }
  if (sameDay) return `${short(start)} ${start.day}, ${start.year}`;
  if (sameMonth) return `${short(start)} ${start.day}–${end.day}, ${start.year}`;
  if (sameYear) return `${short(start)} ${start.day} – ${short(end)} ${end.day}, ${start.year}`;
  return `${short(start)} ${start.day}, ${start.year} – ${short(end)} ${end.day}, ${end.year}`;
}

// 영어 묶음 날짜에서 시작 날짜만 읽는다("Nov 3–5, 2026" · "Oct 31 – Nov 2, 2026" · "Dec 30, 2026 – Jan 2, 2027")
export function parseRangeStart(text) {
  const match = /^([A-Z][a-z]{2}) (\d{1,2})(?:–\d{1,2})?(?:, (\d{4}))?(?: – (?:[A-Z][a-z]{2} )?\d{1,2}, (\d{4}))?(?:, (\d{4}))?$/.exec(text.trim());
  if (!match) return null;
  const month = MONTHS.findIndex((name) => name.startsWith(match[1])) + 1;
  const year = Number(match[3] ?? match[4] ?? match[5]);
  if (!month || !year) return null;
  return { year, month, day: Number(match[2]) };
}

// ---- 글자 다루기 ----

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function readDict(text, lang) {
  const sandbox = { window: {} };
  vm.runInNewContext(text, sandbox);
  return sandbox.window.ATHENA_I18N?.[lang] ?? {};
}

// 사전 한 줄("  "key": "…",")의 값만 바꾼다 — 사전은 키 하나가 한 줄이다
function setDictValue(text, key, value) {
  const pattern = new RegExp(`^(  ${escapeRegExp(JSON.stringify(key))}: )"(?:[^"\\\\]|\\\\.)*"`, 'm');
  if (!pattern.test(text)) throw new Error(`사전에 ${key} 줄이 없다`);
  return text.replace(pattern, (whole, head) => head + JSON.stringify(value));
}

// 사전에서 key 줄 바로 앞에 줄들을 넣는다
function insertDictLines(text, beforeKey, entries) {
  if (!entries.length) return text;
  const anchor = `\n  ${JSON.stringify(beforeKey)}: `;
  const at = text.indexOf(anchor);
  if (at < 0) throw new Error(`사전에 ${beforeKey} 줄이 없다`);
  const lines = entries.map(([key, value]) => `\n  ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join('');
  return text.slice(0, at) + lines + text.slice(at);
}

const setSpans = (html, attr, value) => html.replace(new RegExp(`(<span ${attr}>)[^<]*(</span>)`, 'g'), (whole, open, close) => open + value + close);
const setLinkVersion = (html, version) => html.replace(/v\d+\.\d+\.\d+/g, `v${version}`);

// ---- 사이트 읽기 · 바꾸기(순수 함수 — 파일 글자를 받아 글자를 돌려준다) ----

export function readSite(root) {
  return Object.fromEntries(Object.entries(FILES).map(([name, file]) => [name, fs.readFileSync(path.join(root, file), 'utf8')]));
}

export function siteVersion(site) {
  const match = /<span data-rel-ver>(\d+\.\d+\.\d+)<\/span>/.exec(site.download);
  if (!match) throw new Error(`${FILES.download} 에서 data-rel-ver 를 찾지 못했다`);
  return match[1];
}

const GROUP_RE = /    <div class="rel"><div class="v"><b>(\d+\.\d+)<\/b><span>(v\d+\.\d+\.\d+ – )?v(\d+\.\d+\.\d+)<br><span data-t="r\.d([\w-]+)">([^<]*)<\/span><\/span><\/div><div>\n/;

const groupIdOf = (version) => {
  const [major, minor] = parseVersion(version);
  return major === 0 ? String(minor) : `${major}-${minor}`;
};

function versionBlocks(notes, keyFor) {
  return notes.map(({ version, items }) => [
    `      <div class="rel-ver"><h4 class="rel-vh">v${version}</h4>`,
    '      <ul>',
    ...items.map((item) => `      <li><span class="tag ${item.tag}" data-t="r.${item.tag}">${TAG_LABELS[item.tag]}</span><span data-t="${keyFor(item)}">${escapeHtml(item.en)}</span></li>`),
    '      </ul></div>',
  ].join('\n') + '\n').join('');
}

// notes: [{ version, items: [{ tag, en, ko, ja, zh }] }] — 검사를 마친 것(validateNotes). 비면 버전 · 날짜 · 링크만
export function applyRelease(site, { version, published, firstVersion, notes }) {
  const next = { ...site };
  const day = kstDate(published);

  // 1) 다운로드 페이지 · d.ver
  const verCount = (site.download.match(/<span data-rel-ver>/g) ?? []).length;
  const dateCount = (site.download.match(/<span data-rel-date>/g) ?? []).length;
  if (verCount !== 3 || dateCount !== 1) throw new Error(`${FILES.download} 모양이 바뀌었다(data-rel-ver ${verCount}개 · data-rel-date ${dateCount}개 — 3 · 1 이어야)`);
  next.download = setSpans(setSpans(site.download, 'data-rel-ver', version), 'data-rel-date', formatDay(day, 'en'));
  for (const lang of LANGS) {
    const value = readDict(next[lang], lang)['d.ver'];
    if (!value) throw new Error(`사전 ${lang} 에 d.ver 가 없다`);
    next[lang] = setDictValue(next[lang], 'd.ver', setSpans(setSpans(value, 'data-rel-ver', version), 'data-rel-date', formatDay(day, lang)));
  }

  // 2) · 3) 릴리스 페이지
  const group = GROUP_RE.exec(site.releases);
  if (!group) throw new Error(`${FILES.releases} 에서 맨 위 묶음 머리를 찾지 못했다`);
  const [head, groupMinor, , , groupId, groupDate] = group;
  const [major, minor] = parseVersion(version);
  const newMinor = `${major}.${minor}`;
  const ordered = [...notes].sort((left, right) => compareVersions(right.version, left.version));
  const chronological = [...ordered].reverse();
  const warnings = [];

  if (newMinor === groupMinor) {
    const moreRe = new RegExp(`      <p class="rel-more" data-t="r\\.${escapeRegExp(groupId)}m">.*</p>\n`);
    const moreLine = moreRe.exec(site.releases.slice(group.index))?.[0];
    if (!moreLine) throw new Error(`${FILES.releases} 에서 r.${groupId}m 줄을 찾지 못했다`);
    const used = [...site.releases.matchAll(new RegExp(`data-t="r\\.${escapeRegExp(groupId)}k(\\d+)"`, 'g'))].map((match) => Number(match[1]));
    let counter = used.length ? Math.max(...used) : 0;
    const keys = new Map();
    for (const { items } of chronological) for (const item of items) keys.set(item, `r.${groupId}k${++counter}`);

    const start = parseRangeStart(groupDate);
    if (!start) warnings.push(`묶음 날짜 "${groupDate}" 를 읽지 못해 날짜는 그대로 둔다`);
    const newHead = head
      .replace(/v\d+\.\d+\.\d+<br>/, `v${version}<br>`)
      .replace(/(<span data-t="r\.d[\w-]+">)[^<]*(<\/span>)/, (whole, open, close) => open + (start ? formatRange(start, day, 'en') : groupDate) + close);
    const groupAt = group.index;
    const afterHead = groupAt + head.length;
    const moreAt = site.releases.indexOf(moreLine, afterHead);
    next.releases = site.releases.slice(0, groupAt) + newHead + versionBlocks(ordered, (item) => keys.get(item))
      + site.releases.slice(afterHead, moreAt) + setLinkVersion(moreLine, version) + site.releases.slice(moreAt + moreLine.length);

    for (const lang of LANGS) {
      const dict = readDict(next[lang], lang);
      if (start) next[lang] = setDictValue(next[lang], `r.d${groupId}`, formatRange(start, day, lang));
      next[lang] = setDictValue(next[lang], `r.${groupId}m`, setLinkVersion(dict[`r.${groupId}m`] ?? '', version));
      const entries = chronological.flatMap(({ items }) => items.map((item) => [keys.get(item), escapeHtml(item[lang])]));
      next[lang] = insertDictLines(next[lang], `r.${groupId}m`, entries);
    }
  } else {
    if (compareVersions(`${newMinor}.0`, `${groupMinor}.0`) < 0) throw new Error(`새 공개판 ${version} 이 맨 위 묶음 ${groupMinor} 보다 낮다`);
    const newId = groupIdOf(version);
    const oldMore = new RegExp(`      <p class="rel-more" data-t="r\\.${escapeRegExp(groupId)}m">.*</p>\n`).exec(site.releases)?.[0];
    if (!oldMore) throw new Error(`${FILES.releases} 에서 r.${groupId}m 줄을 찾지 못했다`);
    let counter = 0;
    const keys = new Map();
    for (const { items } of chronological) for (const item of items) keys.set(item, `r.${newId}k${++counter}`);
    const range = firstVersion && firstVersion !== version ? `v${firstVersion} – v${version}` : `v${version}`;
    const block = `    <div class="rel"><div class="v"><b>${newMinor}</b><span>${range}<br><span data-t="r.d${newId}">${formatRange(day, day, 'en')}</span></span></div><div>\n`
      + versionBlocks(ordered, (item) => keys.get(item))
      + setLinkVersion(oldMore, version).replace(`data-t="r.${groupId}m"`, `data-t="r.${newId}m"`)
      + '    </div></div>\n';
    next.releases = site.releases.slice(0, group.index) + block + site.releases.slice(group.index);

    for (const lang of LANGS) {
      const dict = readDict(next[lang], lang);
      const oldMoreValue = dict[`r.${groupId}m`];
      if (!oldMoreValue) throw new Error(`사전 ${lang} 에 r.${groupId}m 이 없다`);
      const entries = [
        [`r.d${newId}`, formatRange(day, day, lang)],
        ...chronological.flatMap(({ items }) => items.map((item) => [keys.get(item), escapeHtml(item[lang])])),
        [`r.${newId}m`, setLinkVersion(oldMoreValue, version)],
      ];
      next[lang] = insertDictLines(next[lang], `r.d${groupId}`, entries);
    }
  }
  return { site: next, warnings };
}

// ---- 글 검사 ----

export function validateNotes(raw, versions) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || !Array.isArray(data.versions)) throw new Error('versions 배열이 없다');
  const allowed = new Set(versions);
  const seen = new Set();
  const notes = [];
  for (const entry of data.versions) {
    const version = String(entry?.version ?? '').replace(/^v/, '');
    if (!allowed.has(version)) throw new Error(`모르는 버전 ${entry?.version}`);
    if (seen.has(version)) throw new Error(`버전 ${version} 이 두 번 나온다`);
    seen.add(version);
    if (!Array.isArray(entry.items)) throw new Error(`${version} 에 items 배열이 없다`);
    const items = entry.items.map((item) => {
      const tag = String(item?.tag ?? '').toLowerCase();
      if (!TAG_ORDER.includes(tag)) throw new Error(`${version} 의 태그 ${item?.tag} 를 모른다`);
      const texts = {};
      for (const lang of ['en', ...LANGS]) {
        const text = item[lang];
        if (typeof text !== 'string' || !text.trim()) throw new Error(`${version} 항목에 ${lang} 글이 없다`);
        if (/[\r\n]/.test(text)) throw new Error(`${version} 항목 ${lang} 글에 줄바꿈이 있다`);
        if (text.length > MAX_TEXT_LENGTH) throw new Error(`${version} 항목 ${lang} 글이 ${MAX_TEXT_LENGTH}자를 넘는다`);
        texts[lang] = text.trim();
      }
      return { tag, ...texts };
    });
    items.sort((left, right) => TAG_ORDER.indexOf(left.tag) - TAG_ORDER.indexOf(right.tag));
    if (items.length) notes.push({ version, items });
  }
  return notes;
}

// ---- 바깥 읽기(GitHub) ----

function githubHeaders(env) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'novum-web-athena-release-sync' };
  if (env.GH_TOKEN) headers.Authorization = `Bearer ${env.GH_TOKEN}`;
  return headers;
}

async function githubJson(fetchImpl, env, route) {
  const res = await fetchImpl(GITHUB_API + route, { headers: githubHeaders(env), signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    const error = new Error(`GitHub ${route} HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

// 글 파일 글자 → { "<minor>": [줄…] }. 모양이 틀리면 던진다(줄 하나하나는 validateNotes 가 본다)
export function parseNotesFile(text, version) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${NOTES_FILE}@v${version} 이 { minor: [줄…] } 모양이 아니다`);
  for (const [minor, items] of Object.entries(data)) {
    if (!/^\d+\.\d+$/.test(minor) || !Array.isArray(items)) throw new Error(`${NOTES_FILE}@v${version} 의 ${minor} 가 "X.Y": [줄…] 모양이 아니다`);
  }
  return data;
}

// 소스 태그 v<version> 의 글 파일 — 그 태그에 파일이 없으면(404) null
export async function readNotesFile({ fetchImpl, env, version }) {
  let data;
  try {
    data = await githubJson(fetchImpl, env, `/repos/${SOURCE_REPO}/contents/${NOTES_FILE}?ref=v${version}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
  if (data?.encoding !== 'base64' || typeof data.content !== 'string') throw new Error(`${NOTES_FILE}@v${version} 내용을 받지 못했다`);
  return parseNotesFile(Buffer.from(data.content, 'base64').toString('utf8'), version);
}

const enOf = (item) => String(item?.en ?? '').trim();

// 지난 공개판 파일(어느 minor 든)에 없는 새 판 minor 의 줄(en 기준). 지난 파일이 없으면(null) 그 minor 줄 전부. 태그는 페이지 이름으로
export function newNoteItems(previous, latest, version) {
  const [major, minor] = parseVersion(version);
  const known = new Set(Object.values(previous ?? {}).flat().map(enOf));
  return (latest[`${major}.${minor}`] ?? [])
    .filter((item) => !known.has(enOf(item)))
    .map((item) => ({ ...item, tag: FILE_TAGS[String(item?.tag ?? '').toLowerCase()] ?? item?.tag }));
}

// 사이트 판 다음 첫 소스 태그(새 묶음 범위의 시작) — 없으면 새 판
export async function firstVersionAfter({ fetchImpl, env, fromVersion, toVersion }) {
  let first = toVersion;
  for (let page = 1; page <= 5; page++) {
    const tags = await githubJson(fetchImpl, env, `/repos/${SOURCE_REPO}/tags?per_page=100&page=${page}`);
    for (const tag of tags) {
      if (parseVersion(tag.name) && compareVersions(tag.name, fromVersion) > 0 && compareVersions(tag.name, first) < 0) first = bare(tag.name);
    }
    const oldest = tags.at(-1)?.name;
    if (tags.length < 100 || (parseVersion(oldest) && compareVersions(oldest, fromVersion) <= 0)) break;
  }
  return first;
}

// ---- 전체 ----

export async function sync({ root = REPO_ROOT, version = '', env = process.env, fetchImpl = fetch, sleep = (ms) => new Promise((done) => setTimeout(done, ms)), log = console.log, warn = console.warn } = {}) {
  const say = (text) => warn(env.GITHUB_ACTIONS ? `::warning::${text}` : `경고: ${text}`);
  if (version && !parseVersion(version)) throw new Error(`버전 입력이 vX.Y.Z 모양이 아니다: ${version}`);

  // 입력이 latest 보다 높으면 공개 직후라 아직 안 보일 수 있다 — 조금 기다려 다시 읽는다
  let latest;
  for (let attempt = 1; attempt <= 4; attempt++) {
    latest = await githubJson(fetchImpl, env, `/repos/${RELEASES_REPO}/releases/latest`);
    if (!parseVersion(latest.tag_name)) throw new Error(`공개 저장소 latest 태그 모양이 이상하다: ${latest.tag_name}`);
    if (!version || compareVersions(latest.tag_name, version) >= 0) break;
    if (attempt === 4) throw new Error(`입력 ${version} 이 공개 저장소 latest ${latest.tag_name} 보다 높다 — 아직 공개되지 않았다`);
    log(`latest ${latest.tag_name} 이 입력 ${version} 보다 낮다 — 20초 뒤 다시 읽는다(${attempt}/3)`);
    await sleep(20000);
  }
  const target = bare(latest.tag_name);
  if (version && compareVersions(target, version) > 0) log(`입력 ${version} 보다 latest v${target} 이 높다 — latest 로 맞춘다`);

  const site = readSite(root);
  const current = siteVersion(site);
  if (compareVersions(target, current) === 0) { log(`이미 v${target} — 할 일 없음`); return { changed: false, version: target }; }
  if (compareVersions(target, current) < 0) { say(`공개 저장소 latest v${target} 이 사이트 v${current} 보다 낮다 — 건너뜀`); return { changed: false, version: target }; }

  let firstVersion = target;
  try {
    firstVersion = await firstVersionAfter({ fetchImpl, env, fromVersion: current, toVersion: target });
  } catch (error) {
    say(`v${current}…v${target} 태그를 읽지 못했다(${error.message}) — 새 묶음 범위는 v${target} 부터로 둔다`);
  }

  let notes = [];
  try {
    const latestFile = await readNotesFile({ fetchImpl, env, version: target });
    if (!latestFile) throw new Error(`v${target} 에 ${NOTES_FILE} 이 없다`);
    const previousFile = await readNotesFile({ fetchImpl, env, version: current });
    // 사이트 릴리스 페이지에 이미 있는 줄(en 기준 · 손으로 넣었거나 다시 돌린 경우)은 다시 붙이지 않는다
    const items = newNoteItems(previousFile, latestFile, target).filter((item) => !site.releases.includes(`>${escapeHtml(enOf(item))}</span>`));
    notes = validateNotes({ versions: [{ version: target, items }] }, [target]);
    log(`릴리스 글 ${notes[0]?.items.length ?? 0}줄(v${target}${previousFile ? '' : ` · v${current} 에 파일이 없어 그 minor 줄 전부`})`);
  } catch (error) {
    say(`릴리스 글을 읽지 못했다(${error.message}) — 버전 · 날짜 · 링크만 맞춘다`);
    notes = [];
  }

  const { site: next, warnings } = applyRelease(site, { version: target, published: latest.published_at, firstVersion, notes });
  for (const text of warnings) say(text);
  for (const [name, file] of Object.entries(FILES)) {
    if (next[name] !== site[name]) {
      fs.writeFileSync(path.join(root, file), next[name]);
      log(`썼음 ${file}`);
    }
  }
  log(`v${current} → v${target} 맞춤`);
  return { changed: true, version: target, from: current };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const at = process.argv.indexOf('--version');
  const version = at > 0 ? (process.argv[at + 1] ?? '') : '';
  sync({ version }).then((result) => {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${result.changed}\nversion=v${result.version}\n`);
  }).catch((error) => {
    console.error(`맞추기 실패: ${error.message}`);
    process.exit(1);
  });
}
