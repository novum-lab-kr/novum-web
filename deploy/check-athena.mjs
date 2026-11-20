// athena/ 배포 전 검사(GitHub Actions · 손으로: node deploy/check-athena.mjs)
// 1) 언어 사전 ko · ja · zh 가 읽히고, 페이지의 data-t · data-ta 키가 세 사전에 모두 있는지
// 2) 페이지가 부르는 사이트 안 파일(/assets/… 등 href · src · srcset)이 실제로 있는지 — 언어판(/ko/ …)까지
// 3) 언어판 · seo 블록 · sitemap · llms.txt 가 영어 페이지와 사전으로 다시 만든 것과 같은지(deploy/gen-athena-lang.mjs)
// 4) JSON-LD 가 JSON 으로 읽히고 schema.org 필수 칸이 있는지, sitemap 주소가 실제 파일과 맞는지
// 5) 약관 · 처리방침의 시행일 전환 표시(data-until · data-from)가 맞게 달렸는지
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, ORIGIN, LANGS, PAGES, pageUrl, buildAll } from './gen-athena-lang.mjs';

const ALL_PAGES = [...PAGES.map(([file]) => file), ...LANGS.flatMap((lang) => PAGES.map(([file]) => `${lang}/${file}`))];
const errors = [];

const dicts = {};
for (const lang of LANGS) {
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/i18n', lang + '.js'), 'utf8'), sandbox);
    dicts[lang] = sandbox.window.ATHENA_I18N?.[lang] ?? {};
  } catch (e) {
    errors.push(`사전 ${lang}.js 를 읽지 못함: ${e.message}`);
    dicts[lang] = {};
  }
}

// JSON-LD 필수 칸(Google 구조화 데이터 문서 기준 — 이 사이트가 쓰는 유형만)
function checkJsonLd(page, html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) { errors.push(`${page}: JSON-LD 없음`); return; }
  for (const [, text] of blocks) {
    let data;
    try { data = JSON.parse(text); } catch (e) { errors.push(`${page}: JSON-LD 가 JSON 이 아님: ${e.message}`); continue; }
    for (const item of data['@graph'] ?? [data]) {
      const type = item['@type'];
      if (type === 'Organization' && !(item.name && item.url)) errors.push(`${page}: Organization 에 name · url 없음`);
      if (type === 'SoftwareApplication') {
        for (const field of ['name', 'operatingSystem', 'applicationCategory']) if (!item[field]) errors.push(`${page}: SoftwareApplication 에 ${field} 없음`);
        if (item.offers?.price == null || !item.offers?.priceCurrency) errors.push(`${page}: SoftwareApplication offers 에 price · priceCurrency 없음`);
      }
      if (type === 'FAQPage') {
        if (!item.mainEntity?.length) errors.push(`${page}: FAQPage 에 문답 없음`);
        for (const question of item.mainEntity ?? []) if (!question.name || !question.acceptedAnswer?.text) errors.push(`${page}: FAQPage 문답에 빈 칸`);
      }
    }
  }
}

for (const page of ALL_PAGES) {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) { errors.push(`페이지 없음: ${page}(node deploy/gen-athena-lang.mjs 로 만든다)`); continue; }
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
  checkJsonLd(page, html);
}

// 영어 페이지(손으로 쓰는 원본)의 언어 링크가 같은 페이지의 각 언어 주소인지
for (const [file, route] of PAGES) {
  const html = fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '';
  const links = [...html.matchAll(/<a\b[^>]*\sdata-set-lang="([a-z]+)"[^>]*>/g)];
  if (links.length !== LANGS.length + 1) errors.push(`${file}: 언어 링크(data-set-lang)가 ${links.length}개 — en · ${LANGS.join(' · ')} 넷이어야 한다`);
  for (const [tagText, target] of links) {
    const want = (target === 'en' ? '' : '/' + target) + route;
    if (!tagText.includes(` href="${want}"`)) errors.push(`${file}: ${target} 언어 링크가 ${want} 가 아님`);
  }
}

// sitemap: 주소마다 실제 파일이 있고, 페이지마다 주소가 있고, lastmod 가 날짜인지
const sitemapFile = path.join(ROOT, 'sitemap.xml');
const sitemapText = fs.existsSync(sitemapFile) ? fs.readFileSync(sitemapFile, 'utf8') : '';
const lastmods = new Map();
for (const [, loc, lastmod] of sitemapText.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]*)<\/lastmod><\/url>/g)) {
  lastmods.set(loc, lastmod);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) errors.push(`sitemap.xml: ${loc} lastmod 가 날짜가 아님(${lastmod})`);
  if (!loc.startsWith(ORIGIN + '/')) { errors.push(`sitemap.xml: 사이트 밖 주소 ${loc}`); continue; }
  const route = loc.slice(ORIGIN.length);
  if (!fs.existsSync(path.join(ROOT, route.endsWith('/') ? route + 'index.html' : route))) errors.push(`sitemap.xml: 없는 페이지 ${loc}`);
}
for (const lang of ['en', ...LANGS]) for (const [, route] of PAGES) if (!lastmods.has(pageUrl(lang, route))) errors.push(`sitemap.xml: ${pageUrl(lang, route)} 없음`);

// 약관 · 처리방침의 시행일 전환 표시(assets/policy-date.js) — 언어판과 보관판(/terms/v2/ 같은 v<숫자>)까지
// data-until · data-from 은 날짜여야 하고, data-from 조각은 hidden 으로 시작해야 하고, 표시가 있으면 스크립트를 불러야 한다.
// 시행 전 · 후 어느 쪽에서도 "시행 예정 · 시행 중" 같은 날짜에 묶인 말이 표시 밖에 남으면 안 된다(시행일 뒤에 틀린 채 남는다).
const LEGAL_KINDS = ['terms', 'privacy'];
const legalPages = ['', ...LANGS.map((lang) => lang + '/')].flatMap((prefix) => LEGAL_KINDS.flatMap((kind) => {
  const dir = path.join(ROOT, prefix + kind);
  const archives = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /^v\d+$/.test(name)).map((name) => `${prefix}${kind}/${name}/index.html`) : [];
  return [`${prefix}${kind}/index.html`, `${prefix}${kind}/history/index.html`, ...archives];
})).filter((page) => fs.existsSync(path.join(ROOT, page)));
const DATE_BOUND = /시행 예정|\(시행 중\)|시행일 전까지|\(scheduled\)|\(in effect\)|in effect until|remains in effect until|Scheduled version/;
// 표시가 달린 조각을 통째로 뺀다(같은 이름 태그가 안에 겹치지 않는 span · p 만 쓴다)
const dropMarked = (html, attr) => html.replace(new RegExp(`<(span|p)\\b[^>]*\\s${attr}="[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`, 'g'), '');
for (const page of legalPages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const marks = [...html.matchAll(/<(\w+)\b([^>]*\sdata-(until|from)="([^"]*)"[^>]*)>/g)];
  for (const [, tag, attrs, kind, date] of marks) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) errors.push(`${page}: data-${kind} 날짜가 이상함(${date})`);
    const swaps = /\sdata-from-(text|content)="/.test(attrs);
    if (kind === 'from' && !swaps && !/\shidden\b/.test(attrs)) errors.push(`${page}: data-from 조각(<${tag}>)에 hidden 없음 — 시행일 전에 보인다`);
  }
  if (marks.length && !html.includes('src="/assets/policy-date.js')) errors.push(`${page}: 시행일 표시가 있는데 /assets/policy-date.js 를 부르지 않음`);
  const body = html.slice(html.indexOf('<body'));
  if (DATE_BOUND.test(dropMarked(body, 'data-until'))) errors.push(`${page}: 시행일 뒤에도 남는 "시행 예정 · 시행 중" 류 글 — data-until 조각 안에 둔다`);
}

// 만든 파일이 원본(영어 페이지 · 사전)과 맞는지 — sitemap 날짜는 지금 파일의 것을 그대로 쓴다
try {
  const { files } = buildAll((loc) => lastmods.get(loc) ?? '');
  for (const [file, content] of files) {
    const target = path.join(ROOT, file);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (current !== content) errors.push(`athena/${file} 가 영어 페이지 · 사전과 맞지 않음 — node deploy/gen-athena-lang.mjs 로 다시 만든다`);
  }
} catch (e) {
  errors.push(`언어판 만들기 실패: ${e.message}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n검사 실패 ${errors.length}건`);
  process.exit(1);
}
console.log(`검사 통과: 페이지 ${ALL_PAGES.length}장(영어 ${PAGES.length} · 언어판 ${ALL_PAGES.length - PAGES.length}), 사전 키 ${Object.keys(dicts.ko).length}개, sitemap 주소 ${lastmods.size}개`);
