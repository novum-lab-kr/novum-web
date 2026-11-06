# 차곡차곡 사이트 (chagok.novum-lab.com)

차곡차곡 앱의 소개(랜딩) · 고객 지원 · 이용약관 · 개인정보 처리방침 사이트. 파일은 이 레포 `chagok/` 에 있다.
앱은 약관 · 처리방침(`/{terms,privacy}/`)을 앱 안 시트로 열고, 판 정보는 `versions.json` 을 읽는다. 앱은 이 주소(`https://chagok.novum-lab.com`)를 읽는다(앱 `src/policy/urls.ts`). 약관과 처리방침의 원본은 이 레포 `chagok/` 하나뿐이다.

| 경로 | 내용 | 검색 노출 |
|---|---|---|
| `/` | 랜딩(`index.html`, 스타일 `assets/landing.css`, 그림 `assets/img`, 영상 `assets/vid`, 글꼴 `assets/fonts` — Neo둥근모 원본 그대로(모든 글자), SIL OFL 1.1, `LICENSE.txt`) | 허용 |
| `/support/` | 문의, 자주 묻는 것, 운영자 정보 | 허용 |
| `/terms/`, `/privacy/`, `/delete-account/`, `/versions.json` | 약관, 처리방침, 계정 삭제 안내, 판 목록 — **앱이 읽는 경로라 바꾸지 않는다** | 허용 (`/versions.json` 은 sitemap 에 넣지 않는다) |
| `/invite/<코드>` | 함께 목표 초대 페이지(`invite/index.html`, `assets/invite/`). 앱이 없거나 앱이 열리지 않을 때 보인다 | 차단(페이지의 `noindex`) |
| `/.well-known/apple-app-site-association` | 앱이 `/invite/*` 링크를 바로 여는 유니버설 링크 설정. 출시 앱(`com.novumlab.chagok`)과 개발 앱(`.dev`) | — |

랜딩(`/`)에만 Google 애널리틱스(측정 ID `G-DR15LTP1EW`, 속성 「차곡차곡 랜딩」)를 넣는다. 처리방침 1판 15절이 이 설정을 설명하므로, 아래를 바꾸면 15절도 같이 고친다. 페이지 소스는 누구나 보므로 GA 코드에 주석을 달지 않고 이유는 여기에 적는다.
- 동의 기본값은 태그를 읽기 전에 정한다. EEA 30개국과 영국은 `analytics_storage: 'denied'`(쿠키 없이 측정), 광고 항목 셋은 모든 지역에서 `denied`.
- `cookie_domain` 을 `chagok.novum-lab.com` 으로 고정한다. 기본값 `auto` 는 쿠키를 `.novum-lab.com` 에 저장해 다른 서비스 주소까지 보낸다.
- `allow_google_signals`, `allow_ad_personalization_signals` 는 `false`. 콘솔의 데이터 보관은 2개월(2026-11-04 확인).

랜딩의 App Store 배지 세 곳(위 막대, 첫 화면, 맨 아래)은 2026-11-04부터 한국 App Store 앱 페이지로 연결한다(앱 1.0 출시 2026-11-03). 배지는 Apple 공식 자산 `assets/img/app-store-badge-ko.svg`(검은색, 한국어) 그대로이고, 화면 높이 40px 이상으로 둔다(App Store 마케팅 지침). 휴대폰 화면에는 첫 화면 배지가 없고 위 막대와 맨 아래 두 곳이다. 배지 그림은 고치지 않고, 도트 글꼴 느낌은 배지 위 「무료로 받을 수 있어요」 한 줄(`.store-cap`)로 낸다. 배지에 Apple 로고를 따로 넣은 버튼을 직접 만들지 않는다(같은 지침: Apple 로고 단독 사용 금지).

휴대폰 폭(560px 이하)에서는 컴퓨터용 구역을 숨기고 `index.html` 의 `<main id="m" class="m-only">` 를 보여 준다(2026-11-04). 휴대폰 한 화면을 한 섹션으로 짠 별도 구성이라, **랜딩 문구를 고치면 컴퓨터용 구역과 `#m` 두 곳을 같이 고친다.**
- 첫 화면(`.m-hero2`)은 기기 화면 높이(위 막대 62px 제외)를 채운다. 차곡이는 앱 스플래시(앱 `src/design-system/splash.tsx`)의 판 받기 장면을 `assets/hero-splash.js` 가 같은 도트 그림(앱 `docs/design/character/character-data.json` 의 `splashLayers`)과 타이밍으로 한 번 그린다(색 채우기와 글자 치기는 뺐다). 스크립트가 없어도 판 세 장을 인 마지막 장면이 HTML에 들어 있다.
- 첫 화면 둘레의 스티커(`assets/img/st-*.png`, 앱 `assets/widget-art/color-*.png` 원본)은 컴퓨터와 휴대폰 첫 화면에 모두 있다. 두 화면 모두 첫 화면 전체 폭에 흩뿌려 모서리와 가장자리에 반쯤 걸치게 놓는다. 컴퓨터는 1181px 이상에서 글 오른쪽에 두 장(`.wide-only`)을 더하고, 첫 화면이 세로로 쌓이는 561~900px에서는 글을 가리지 않게 자리를 따로 정한다. 첫 화면이 열리면 한 장씩 붙고(앱 `StickMotion` 과 같은 느낌), 그 뒤 첫 화면이 보이는 동안 4.5초마다 한 장만 다시 톡 붙는다(`assets/hero-splash.js`). 동작 줄이기 설정이면 움직이지 않는다.
- 「하나씩 채워 가는 재미」의 붙이는 재미와 완성하는 재미 그림은 앱 화면 캡처가 아니라 앱 스티커 원본과 차곡이 그림(`mascot-excited.png`)으로 HTML에서 그린 작은 판(`.mini`)이다. 붙이는 재미 판은 빈칸 두 곳에 스티커가 차례로 붙는 장면을 반복한다.
- 앱의 스플래시나 붙이기 모션을 바꾸면 여기도 맞춘다.

판 본문(`terms/v1` 등)의 사이트 안 링크는 `/delete-account/` 처럼 **사이트 기준 절대 경로**로 쓴다 — 같은 본문이 `/privacy/v1/` 과 `/privacy/`(끼워 넣기) 두 주소에서 보여 상대 경로는 한쪽에서 깨진다.
문의 메일 링크(랜딩 footer `index.html` · `terms/v1` · `privacy/v1` · `support` · `delete-account` 5곳)는 앱 설정 「문의하기」와 같은 제목 · 본문 틀을 `encodeURIComponent` 로 미리 인코딩해 `href` 에 넣었다(앱 `src/support/contactMail.ts` 의 `SUBJECT.question` · `BODY.question` — 사이트는 앱 버전 · OS 를 모르니 `---` 아래 앱 정보 줄은 뺀다). 앱 틀을 바꾸면 5곳도 같이 바꾼다.

## 초대 페이지 (2026-11-06)

- 모양은 앱 디자인 시스템과 같다(앱 저장소 `docs/design/proposals-2026-10/invite-web-v2` C안). 계단 테두리는 `assets/invite/invite.js`가 앱 `PixelFrame`과 같은 계산으로 그린다.
- 페이지가 운영 서버 초대 미리보기(`preview_invite`, 로그인 없이)를 불러 목표 이름, 초대한 사람, 함께하는 사람 스티커를 넣는다. 공개 키(anon)는 앱에 들어 있는 것과 같다. 운영 서버 주소나 키가 바뀌면 `invite.js` 맨 위 두 줄을 바꾼다. 서버에 닿지 못하면 목표 이름 없이 기본 안내가 남는다.
- 서버가 돌려주는 `closed`, `full`, `rate_limited`(없는 코드를 한 곳에서 1시간 30번, 앱 저장소 `supabase/migrations/20261106000001~3`)마다 차곡이 카드를 보여 준다.
- 차곡이 그림과 스티커는 앱 저장소에서 만든다: `node deploy/build-chagok-invite-assets.mjs <chagok-app 경로>`.
- 초대 링크 미리보기 그림(`assets/invite/og.png`, 1200×630)은 `node deploy/build-chagok-og.mjs`로 만든다(맥 Chrome 헤드리스). 카카오톡이 양옆을 잘라서 스티커 타일은 글과 차곡이에서 40px, 양옆 끝에서 60px 넘게 떨어뜨리고, 스크립트가 이 간격을 재서 어기면 멈춘다.
- **서버(Caddy) 설정은 끝났다(2026-11-06, 운영 서버):** `/invite/*`를 `/invite/index.html`로 보내고, `/.well-known/apple-app-site-association`을 `Content-Type: application/json`으로 낸다. 이 설정이 빠지면 `/invite/<코드>`가 404다.

## 개정하는 방법

**정식 출시 전에는 새 판을 만들지 않고 1판(`terms/v1`, `privacy/v1`)을 고친다** (2026-10-14 결정). 아래는 출시 뒤 개정할 때다.

1. `chagok/terms/v2/index.html` 처럼 새 판 폴더를 만든다. 이미 시행된 판의 본문은 고치지 않는다(오탈자만).
2. `chagok/versions.json` 에 판을 추가한다. `postedAt`(게시일)과 `effectiveAt`(시행일)은 로컬 날짜 `YYYY-MM-DD`.
   - 사전 고지: 시행일 7일 전, 이용자에게 불리하면 30일 전에 게시한다.
   - `requiresConsent`: 다시 동의를 받을 개정이면 `true` 로 적어 두지만 **앱은 이 값을 읽지 않는다** — 2026-10-01 설계 변경으로 재동의 화면이 없다(앱 `src/policy/versions.ts` 주석). 바꿔도 앱 동작은 그대로다.
3. 시행일 전까지 `terms/` 는 이전 판을 보여주고 위에 "M월 D일부터 바뀌어요"를 띄운다.
   **시행 중인 판**(시행일이 지난 판 중 번호가 가장 큰 것)은 사이트와 앱이 같게 고르지만, **시행 예정 판**은 다르게 고른다.
   - 사이트(`assets/policy.js`): 시행일이 오늘보다 뒤인 판 중 **시행일이 가장 이른 것**(게시일은 안 본다)
   - 앱(`src/policy/versions.ts` `upcomingChange`): 게시일 ≤ 오늘 < 시행일인 판 중 **번호가 가장 큰 것**(이미 알린 판 · 시행 중인 판이 없는 처음 게시는 빼고)

   그래서 **예정 판은 하나만 두고, 게시일을 미래로 두지 않는다**(게시하는 날 넣는다). 둘 이상이거나 게시일이 미래면 사이트 안내와 앱 안내가 달라진다. 판 선택 규칙을 고치면 사이트와 앱을 같이 고친다.

> **`versions.json` 이 깨지거나, 약관 · 처리방침 중 하나라도 시행 중인 판이 없으면 앱이 계정 연결을 멈춘다**(앱 `src/policy/manifest.ts` · `app/account/connect.tsx` — 어느 판에 동의했는지 모른 채 연결하지 않는다). 새 판만 미래 시행일로 넣고 기존 판을 지우면 안 된다. 날짜는 `YYYY-MM-DD` 문자열로 비교하므로 0 을 채운다(`2026-9-30` ✕).

고친 뒤 `node deploy/check-chagok.mjs` 로 검사한다(Actions 도 같은 검사를 돌린다 — `versions.json` 형식 · 판 파일 · `policy.js` 문법 · 페이지가 부르는 사이트 안 파일).

## 게시 때 채운 것

판 날짜는 앱 1.0 출시일(2026-11-03)로 맞췄다(`versions.json`, 약관 · 처리방침 1판 맨 위). 판 번호는 그대로라 앱 동의 기록에는 영향이 없다. 최종 문안은 법률 검토를 받는다.

사업장 주소(2026-10-29 사업자등록증 사업장소재지 그대로)와 전화번호(050-6994-4416 · 2026-10-29 은주)는 약관 끝 · 지원 페이지 운영자 줄에 넣었다(전자상거래법 10조 · 13조 표시 · 랜딩은 짧게 — 푸터의 「고객 지원」 링크로 이어진다).

통신판매업 신고번호는 **면제 조건이 맞는 동안은 칸을 두지 않는다** — 직전년도 거래 50회 미만이거나 간이과세자면 신고 면제다(공정위 「통신판매업 신고 면제 기준에 대한 고시」 2조 · 앱 레포 `docs/LEGAL-REVIEW.md`). 지금은 면제 기간이라 신고하지 않았다(2026-10-28 은주). **조건이 바뀌면 신고한 뒤 번호를 넣는다** — 법률 점검(`docs/LEGAL-REVIEW.md` 2절)에서 조건이 아직 맞는지 본다.

## 게시

athena.novum-lab.com 과 같은 길이다. **`main` 에 합치는 순간 운영 반영**이다.

- 레포 공용 배포다(2026-10-29 은주 · minsoon 합의 — 서비스 폴더 단위). `deploy/sites.txt` 에 `chagok /var/www/chagok-site` 가 있다
- `main` 에 push(머지)되면 `.github/workflows/deploy.yml` 이 검사(`deploy/check-*.mjs` 전부) 뒤 서버에 SSH → 서버 고정 명령(`deploy/remote.sh` 복사본)이 GitHub `main` 을 받아 그 커밋의 `deploy/site.sh --all` 을 돌린다. 마지막 배포 뒤로 `chagok/` 나 `deploy/site.sh` · `deploy/sites.txt` 가 바뀌었으면 `chagok/` 를 `/var/www/chagok-site` 에 맞춘다(rsync `--delete` · 기록 서버 레포 `.git/deploy-chagok.log` · 마지막 배포 커밋 `.git/deploy-chagok.last`). 다른 서비스가 실패해도 chagok 은 따로 반영된다
- 손으로 다시 맞출 때(서버): `sh deploy/site.sh chagok main`
- 서버 레포 안에서 `main` 이 움직여도 hook(`deploy/hooks/reference-transaction`)이 같은 실행기(`site.sh --all`)를 돈다
- Caddy 블록 `chagok.novum-lab.com` 이 그 폴더를 낸다. 서버 · Caddy 는 서버 창 일이다

2026-11-03 앱 1.0 출시로 공식 게시했다. 모든 경로를 검색에 연다. 출시 전에는 서버 Caddy 블록이 `/` 를 뺀 모든 경로에 `X-Robots-Tag: noindex` 헤더를 붙였다(`@noindex` · 레포에는 없다). 이 규칙은 2026-11-04 서버 Caddyfile 에서 지웠다(백업 `/etc/caddy/Caddyfile.bak-chagok-noindex-20261104`).
검색용 파일: `chagok/robots.txt`(모두 허용, sitemap 주소), `chagok/sitemap.xml`(랜딩, 지원, 약관, 처리방침, 계정 삭제). 각 페이지 `<head>` 에 canonical 주소를 두고, 랜딩에는 iPhone Safari 앱 배너(`apple-itunes-app`, 앱 id 6824725721)를 둔다. 페이지를 더하거나 주소를 바꾸면 sitemap 도 고친다.

`chagok/app-ads.txt` 는 AdMob 광고 판매자 확인용 한 줄이다(2026-10-29 출시 전에 미리 · `https://chagok.novum-lab.com/app-ads.txt`). 게시자 ID `pub-3557389923784580` 은 앱 `app.json` 의 iOS AdMob 앱 ID 앞부분이다(Android 쪽 `3940256099942544` 는 Google 테스트 ID 라 아니다). 앱 ID 나 AdMob 계정이 바뀌면 이 줄도 바꾼다. 검색 차단(noindex 헤더)과 상관없이 광고 크롤러가 읽는다.
## 개발 사이트 (2026-11-06)

`https://chagok-dev.novum-lab.com`은 개발 앱(`com.novumlab.chagok.dev`)과 개발 서버(Supabase chagok-dev)용이다. main 머지로 올라가지 않고, 손으로 올린다.

```sh
CHAGOK_DEPLOY_HOST=<서버 주소> sh deploy/chagok-dev.sh <chagok-app 저장소 경로>
```

- 지금 체크아웃의 `chagok/`를 올린다. 어느 브랜치든 공개 전에 미리 볼 수 있다.
- 초대 페이지는 개발 서버를 읽고, [차곡차곡에서 열기]는 개발 앱(`chagok-dev://`)을 연다. 검색엔진은 막는다.
- 개발 앱은 `.env.local`의 `EXPO_PUBLIC_INVITE_BASE`로 이 주소의 초대 링크를 만들고, 이 주소의 앱 링크만 받는다(앱 저장소 `app.config.js`).
- 서버: `/var/www/chagok-site-dev`(chagok 계정), Caddy 블록 `chagok-dev.novum-lab.com`(백업 `/etc/caddy/Caddyfile.bak-20261106-chagok-dev`).

## 약관과 처리방침 2판 게시 (앱 1.1.0)

PR #64 하나에 2판(한국어, 영어), 해외 조항, 언어 자동 전환(`assets/policy.js`, `versions.json`의 `languages`), 초대 페이지 영어판, 개발 사이트 배포 스크립트가 모두 들어 있다. 머지하면 운영에 바로 반영된다.

**게시 순서 (앱 1.1.0 심사가 끝난 날)**

```sh
node deploy/set-chagok-policy-date.mjs <심사 끝난 날 YYYY-MM-DD>
node deploy/check-chagok.mjs
git commit -am "chagok: post policy v2 on <날짜>"
git push   # 그다음 PR #64를 main에 합친다
```

- 날짜는 게시일과 시행일이 같다(1.0 이용자가 사실상 없어 미리 알릴 대상이 없다, 2026-11-06 결정).
- 날짜를 바꾸지 않고 합치면 PR에 적힌 날짜(지금 2026-11-06)로 게시된다.
- 시행일을 미래 날짜로 두고 합치면 그날까지 1판이 보이고 「바뀌어요」 안내가 붙는다.
