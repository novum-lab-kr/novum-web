// athena/ 언어판 · 검색용 파일 만들기(손으로: node deploy/gen-athena-lang.mjs — 만든 파일도 커밋한다)
// 정본은 영어 페이지 athena/<페이지> 와 사전 athena/assets/i18n/<언어>.js 다. 아래는 모두 여기서 만든다 — 손으로 고치지 않는다.
//   1) 영어 페이지 head 의 seo 블록(hreflang · JSON-LD) — 블록 밖은 건드리지 않는다
//   2) athena/<ko|ja|zh>/<페이지> — 영어 페이지의 data-t · data-ta 를 사전 문구로 바꾼 언어판(사전에 없는 키는 영어 그대로)
//   3) athena/sitemap.xml — lastmod 는 그 페이지 원본 · 사전의 마지막 커밋 날짜(커밋 안 된 변경이 있으면 오늘)
//   4) athena/llms.txt — AI 가 읽는 사이트 안내(페이지 제목 · description 문구 그대로)
// check-athena.mjs 가 같은 함수로 다시 만들어 파일과 같은지 본다(sitemap lastmod 는 날짜 모양만 — CI 는 얕은 clone 이라 커밋 날짜를 모른다).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'athena');
export const ORIGIN = 'https://athena.novum-lab.com';
export const LANGS = ['ko', 'ja', 'zh'];
// [파일, 주소] — 새 페이지는 여기와 check-athena.mjs 가 함께 본다
export const PAGES = [
  ['index.html', '/'],
  ['features/index.html', '/features/'],
  ['docs/index.html', '/docs/'],
  ['download/index.html', '/download/'],
  ['releases/index.html', '/releases/'],
  ['terms/index.html', '/terms/'],
];
const HTML_LANG = { en: 'en', ko: 'ko', ja: 'ja', zh: 'zh-Hans' };
const LANG_NAMES = { en: 'English', ko: '한국어', ja: '日本語', zh: '中文' };
const SEO_START = '<!-- seo:start · deploy/gen-athena-lang.mjs 가 만든다(손으로 고치지 않는다) -->';
const SEO_END = '<!-- seo:end -->';
const SEO_BLOCK = /\n?<!-- seo:start[^\n]*-->[\s\S]*?<!-- seo:end -->/;

// JSON-LD 에 넣는 사실 — 페이지에 적혀 있는 것만(무료 · macOS 13+ · Apple Silicon / Intel · Novum Lab — 받기 주소는 받기를 막아 둔 동안 넣지 않는다).
// 버전 · 평점 · 사용자 수는 넣지 않는다
const ORG = { '@type': 'Organization', '@id': 'https://novum-lab.com/#organization', name: 'Novum Lab', url: 'https://novum-lab.com' };
const APP_PAGES = new Set(['/', '/download/']);

export function pageUrl(lang, route) {
  return ORIGIN + (lang === 'en' ? '' : '/' + lang) + route;
}

export function readDicts() {
  const dicts = {};
  for (const lang of LANGS) {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/i18n', lang + '.js'), 'utf8'), sandbox);
    dicts[lang] = sandbox.window.ATHENA_I18N?.[lang] ?? {};
  }
  return dicts;
}

// ---- HTML 다루기(빌드 도구 없이 정규식 — 이 사이트 페이지 모양에 맞춘 것) ----

function escapeAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
    return named[name.toLowerCase()] ?? whole;
  });
}

export function plainText(html) {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

// innerStart 부터 같은 이름 태그의 닫는 자리를 찾는다(같은 태그가 안에 겹쳐 있어도)
function findClose(html, tag, innerStart) {
  const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  tagRe.lastIndex = innerStart;
  let depth = 1;
  let match;
  while ((match = tagRe.exec(html))) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return match.index;
  }
  throw new Error(`<${tag}> 의 닫는 태그를 찾지 못함(${innerStart})`);
}

// data-t 키가 있는 요소의 innerHTML 을 사전 문구로(lang.js 가 브라우저에서 하던 것과 같다 — 사전 값은 HTML)
function applyText(html, dict, missing) {
  const openRe = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?\sdata-t="([^"]+)"[^>]*>/g;
  let out = '';
  let pos = 0;
  let match;
  while ((match = openRe.exec(html))) {
    const [openTag, tag, key] = match;
    const innerStart = match.index + openTag.length;
    if (!(key in dict)) {
      // 사전에 없으면 영어 그대로 두고 안쪽의 data-t 는 계속 바꾼다
      missing.add(key);
      continue;
    }
    const innerEnd = findClose(html, tag, innerStart);
    out += html.slice(pos, innerStart) + dict[key];
    pos = innerEnd;
    openRe.lastIndex = innerEnd;
  }
  return out + html.slice(pos);
}

// data-ta="속성:키,…" 의 속성 값을 사전 문구로(사전 값은 글자 그대로 — 속성 안에 넣을 때 이스케이프)
function applyAttrs(html, dict, missing) {
  return html.replace(/<[a-zA-Z][^>]*\sdata-ta="([^"]+)"[^>]*>/g, (tagText, spec) => {
    let out = tagText;
    for (const pair of spec.split(',')) {
      const [attr, key] = pair.split(':').map((part) => part.trim());
      if (!(key in dict)) { missing.add(key); continue; }
      out = out.replace(new RegExp(`(\\s${attr}=")[^"]*(")`), (whole, head, tail) => head + escapeAttr(dict[key]) + tail);
    }
    return out;
  });
}

function setMeta(html, attrName, attrValue, content) {
  const re = new RegExp(`(<meta ${attrName}="${attrValue}"[^>]*\\scontent=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`<meta ${attrName}="${attrValue}"> 없음`);
  return html.replace(re, (whole, head, tail) => head + content + tail);
}

function innerOf(html, key) {
  const match = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*?\\sdata-t="${key.replace(/\./g, '\\.')}"[^>]*>`).exec(html);
  if (!match) return null;
  const innerStart = match.index + match[0].length;
  return html.slice(innerStart, findClose(html, match[1], innerStart));
}

function metaContent(html, attrName, attrValue) {
  const match = new RegExp(`<meta ${attrName}="${attrValue}"[^>]*\\scontent="([^"]*)"`).exec(html);
  return match ? decodeEntities(match[1]) : '';
}

// 사이트 안 페이지 링크(/ · /features/ …, #절 포함)를 그 언어 주소로. /assets/ 같은 파일 주소는 그대로
function localizeLinks(html, lang) {
  const routes = new Set(PAGES.map(([, route]) => route));
  const withHref = html.replace(/(\shref=")(\/[^"#?]*)([^"]*")/g, (whole, head, route, tail) => (routes.has(route) ? head + '/' + lang + route + tail : whole));
  // 인라인 스크립트 안의 페이지 주소 문자열('/docs/#workflow' 같은 이동 주소)도 같은 언어로 — src 가 있는 스크립트는 건드리지 않는다
  return withHref.replace(/(<script>)([\s\S]*?)(<\/script>)/g, (whole, open, code, close) => open + code.replace(
    /(['"])(\/[^'"#?]*)([^'"]*)\1/g,
    (literal, quote, route, rest) => (routes.has(route) ? quote + '/' + lang + route + rest + quote : literal),
  ) + close);
}

// 언어 링크(data-set-lang)는 같은 페이지의 각 언어 주소 · 지금 언어에 aria-current
function setLangLinks(html, lang, route) {
  return html.replace(/<a\b[^>]*\sdata-set-lang="([a-z]+)"[^>]*>/g, (tagText, target) => tagText
    .replace(/\shref="[^"]*"/, ` href="${target === 'en' ? '' : '/' + target}${route}"`)
    .replace(/\saria-current="[^"]*"/, ` aria-current="${target === lang}"`));
}

// 언어마다 바뀌는 스크린샷(data-lang-src · data-tab-src 의 {l})과 언어 탭 기본 선택
function setLangShots(html, lang) {
  let out = html.replace(/<img\b[^>]*\sdata-(?:lang|tab)-src="([^"]+)"[^>]*>/g, (tagText, base) => {
    const shot = base.replace('{l}', lang);
    // src 는 영어판과 같은 크기(-1200 이 붙어 있으면 그대로)
    const size = /\ssrc="[^"]*-1200\.webp"/.test(tagText) ? '-1200' : '';
    return tagText
      .replace(/\ssrc="[^"]*"/, ` src="${shot}${size}.webp"`)
      .replace(/\ssrcset="[^"]*"/, ` srcset="${shot}-1200.webp 1200w, ${shot}.webp 2400w"`);
  });
  out = out.replace(/<button\b[^>]*\sdata-tab="([a-z]+)"[^>]*>/g, (tagText, tab) => tagText.replace(/\saria-selected="[^"]*"/, ` aria-selected="${tab === lang}"`));
  return out;
}

// ---- seo 블록(hreflang · JSON-LD) ----

function faqItems(html) {
  const section = /<section\b[^>]*\sid="faq"[^>]*>([\s\S]*?)<\/section>/.exec(html);
  if (!section) return [];
  return [...section[1].matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>\s*<p\b[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, question, answer]) => ({ question: plainText(question), answer: plainText(answer) }));
}

function seoBlock(html, lang, route) {
  const links = [...['en', ...LANGS].map((target) => `<link rel="alternate" hreflang="${HTML_LANG[target]}" href="${pageUrl(target, route)}">`),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl('en', route)}">`];
  const graph = [ORG];
  if (APP_PAGES.has(route)) {
    graph.push({
      '@type': 'SoftwareApplication',
      name: 'Athena Studio',
      url: pageUrl(lang, '/'),
      description: metaContent(html, 'name', 'description'),
      operatingSystem: 'macOS 13 or later',
      processorRequirements: 'Apple Silicon or Intel',
      applicationCategory: 'DeveloperApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': ORG['@id'] },
    });
  }
  const faq = faqItems(html);
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      url: pageUrl(lang, route) + '#faq',
      inLanguage: HTML_LANG[lang],
      mainEntity: faq.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
    });
  }
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c');
  return [SEO_START, ...links, '<script type="application/ld+json">', json, '</script>', SEO_END].join('\n');
}

function withSeo(html, lang, route) {
  const bare = html.replace(SEO_BLOCK, '');
  const canonical = /<link rel="canonical"[^>]*>/.exec(bare);
  if (!canonical) throw new Error(`${route}: canonical 없음`);
  const at = canonical.index + canonical[0].length;
  return bare.slice(0, at) + '\n' + seoBlock(bare, lang, route) + bare.slice(at);
}

// ---- 페이지 · 파일 만들기 ----

function renderLang(source, lang, route, dict, missing) {
  let html = source.replace(SEO_BLOCK, '');
  html = applyText(html, dict, missing);
  html = applyAttrs(html, dict, missing);
  html = html.replace(/<html lang="en" data-lang="en">/, `<html lang="${HTML_LANG[lang]}" data-lang="${lang}">`);
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/.exec(html);
  if (title) html = setMeta(html, 'property', 'og:title', escapeAttr(plainText(title[1])));
  html = setMeta(html, 'property', 'og:description', escapeAttr(metaContent(html, 'name', 'description')));
  html = setMeta(html, 'property', 'og:url', pageUrl(lang, route));
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${pageUrl(lang, route)}$2`);
  html = localizeLinks(html, lang);
  html = setLangLinks(html, lang, route);
  html = setLangShots(html, lang);
  return withSeo(html, lang, route);
}

function sitemap(lastmodFor) {
  const urls = [];
  for (const lang of ['en', ...LANGS]) {
    for (const [, route] of PAGES) {
      const loc = pageUrl(lang, route);
      urls.push(`  <url><loc>${loc}</loc><lastmod>${lastmodFor(loc, lang, route)}</lastmod></url>`);
    }
  }
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n');
}

function llms(sources, dicts) {
  const home = sources.get('/');
  const lines = [
    '# Athena Studio',
    '',
    `> ${metaContent(home, 'name', 'description')}`,
    '',
    `${plainText(innerOf(home, 'n.note2') ?? '')}. ${plainText(innerOf(home, 'c.made') ?? '')}`,
    '',
    '## Pages',
    '',
  ];
  for (const [, route] of PAGES) {
    const html = sources.get(route);
    const title = plainText(/<title\b[^>]*>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? '').replace(/ — Athena Studio$/, '');
    lines.push(`- [${route === '/' ? 'Home' : title}](${pageUrl('en', route)}): ${metaContent(html, 'name', 'description')}`);
  }
  lines.push('', '## Other languages', '', 'Every page is also published in Korean, Japanese and Chinese under /ko/, /ja/ and /zh/.', '');
  for (const lang of LANGS) lines.push(`- [${LANG_NAMES[lang]}](${pageUrl(lang, '/')}): ${decodeEntities(dicts[lang]['h.desc'] ?? '')}`);
  return lines.join('\n') + '\n';
}

// 만들 파일 전부를 { 'athena 안 경로': 내용 } 으로. lastmodFor(loc, lang, route) 가 sitemap 날짜를 준다
export function buildAll(lastmodFor) {
  const dicts = readDicts();
  const sources = new Map();
  const files = new Map();
  const missing = Object.fromEntries(LANGS.map((lang) => [lang, new Set()]));
  for (const [file, route] of PAGES) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    sources.set(route, source);
    files.set(file, withSeo(source, 'en', route));
    for (const lang of LANGS) files.set(`${lang}/${file}`, renderLang(source, lang, route, dicts[lang], missing[lang]));
  }
  files.set('sitemap.xml', sitemap(lastmodFor));
  files.set('llms.txt', llms(sources, dicts));
  return { files, missing };
}

// git 의 마지막 커밋 날짜(YYYY-MM-DD). 커밋 안 된 변경이 있으면 오늘
function gitDate(files) {
  const repo = path.dirname(ROOT);
  const dirty = execFileSync('git', ['status', '--porcelain', '--', ...files], { cwd: repo, encoding: 'utf8' }).trim();
  const committed = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...files], { cwd: repo, encoding: 'utf8' }).trim();
  return dirty || !committed ? new Date().toLocaleDateString('sv-SE') : committed;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const lastmodFor = (loc, lang, route) => {
    const file = PAGES.find(([, pageRoute]) => pageRoute === route)[0];
    return gitDate(lang === 'en' ? [`athena/${file}`] : [`athena/${file}`, `athena/assets/i18n/${lang}.js`]);
  };
  const { files, missing } = buildAll(lastmodFor);
  for (const [file, content] of files) {
    const target = path.join(ROOT, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
      fs.writeFileSync(target, content);
      console.log(`썼음 athena/${file}`);
    }
  }
  for (const lang of LANGS) {
    if (missing[lang].size) console.log(`${lang}: 사전에 없어 영어로 둔 키 ${missing[lang].size}개 — ${[...missing[lang]].join(', ')}`);
  }
  console.log(`만들기 끝: 파일 ${files.size}개`);
}
