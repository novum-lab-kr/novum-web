# 차곡차곡 사이트 (chagok.novum-lab.com)

차곡차곡 앱의 소개(랜딩) · 고객 지원 · 이용약관 · 개인정보 처리방침 사이트. 파일은 이 레포 `chagok/` 에 있다.
앱은 약관 · 처리방침(`/{terms,privacy}/`)을 앱 안 시트로 열고, 판 정보는 `versions.json` 을 읽는다. 앱이 이 주소(`https://chagok.novum-lab.com`)를 보게 하는 변경은 앱 레포 `chore/policy-url-vps` 에 있고, 2026-10-29 앱 `main` 은 아직 옛 주소 `https://chagok-app-terms.netlify.app` 을 읽는다(앱 `src/policy/urls.ts`).

이전 기록은 GitHub `novum-lab-kr/chagok-app-policy`(보관)에 있다 — 2026-10-29 그 레포 `main`(ca97b05)의 사이트 파일만 옮겨 왔다. 옮긴 뒤 원본과 달라진 곳: ⓐ 운영자 줄 — `terms/v1/index.html` 의 HTML 주석(통신판매업 신고 면제 반영)과, `terms/v1/index.html` · `support/index.html` 에 더한 사업장 주소 · 전화번호 ⓑ 2026-10-29 법률 검토 2차 반영 — 랜딩 문구 2곳(로그인 없이 쓰는 범위 · 광고), 약관 1판 제8조 제1항 · 제11조 제3항 · 제12조 제1항, 처리방침 1판 5절 1항 · 7~11항(지운 기록의 서버 표식 · 카카오 연결 해제 실패 기록 · 로그인 기록과 인증 감사 기록 3개월 · 서버 운영 기록 3개월 · 삭제 처리 기록 1년 — 보관 기간은 2026-10-29 결정). 출시 전이라 판 번호와 날짜(`versions.json`)는 그대로다.

| 경로 | 내용 | 검색 노출 |
|---|---|---|
| `/` | 랜딩(`index.html`, 스타일 `assets/landing.css`, 그림 `assets/img`, 영상 `assets/vid`, 글꼴 `assets/fonts` — Pretendard, Neo둥근모 원본 그대로, SIL OFL 1.1, 폴더마다 `LICENSE.txt`) | 허용 |
| `/support/` | 문의, 자주 묻는 것, 운영자 정보 | 차단(공식 게시 전) |
| `/terms/`, `/privacy/`, `/delete-account/`, `/versions.json` | 약관, 처리방침, 계정 삭제 안내, 판 목록 — **앱이 읽는 경로라 바꾸지 않는다** | 차단(공식 게시 전) |

랜딩의 App Store 버튼은 출시 전이라 누를 수 없는 「곧 출시」다. 주소가 생기면 `chagok/index.html` 맨 위 주석대로 세 곳을 바꾼다.
판 본문(`terms/v1` 등)의 사이트 안 링크는 `/delete-account/` 처럼 **사이트 기준 절대 경로**로 쓴다 — 같은 본문이 `/privacy/v1/` 과 `/privacy/`(끼워 넣기) 두 주소에서 보여 상대 경로는 한쪽에서 깨진다.
문의 메일 링크(`terms/v1` · `privacy/v1` · `support` · `delete-account` 4곳)는 앱 설정 「문의하기」와 같은 제목 · 본문 틀을 `encodeURIComponent` 로 미리 인코딩해 `href` 에 넣었다(앱 `src/support/contactMail.ts` 의 `SUBJECT.question` · `BODY.question` — 사이트는 앱 버전 · OS 를 모르니 `---` 아래 앱 정보 줄은 뺀다). 앱 틀을 바꾸면 4곳도 같이 바꾼다.

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

## 게시 전 채울 것

판 날짜. 최종 문안은 법률 검토를 받는다.

사업장 주소(2026-10-29 사업자등록증 사업장소재지 그대로)와 전화번호(050-6994-4416 · 2026-10-29 은주)는 약관 끝 · 지원 페이지 운영자 줄에 넣었다(전자상거래법 10조 · 13조 표시 · 랜딩은 짧게 — 푸터의 「고객 지원」 링크로 이어진다).

통신판매업 신고번호는 **면제 조건이 맞는 동안은 칸을 두지 않는다** — 직전년도 거래 50회 미만이거나 간이과세자면 신고 면제다(공정위 「통신판매업 신고 면제 기준에 대한 고시」 2조 · 앱 레포 `docs/LEGAL-REVIEW.md`). 지금은 면제 기간이라 신고하지 않았다(2026-10-28 은주). **조건이 바뀌면 신고한 뒤 번호를 넣는다** — 법률 점검(`docs/LEGAL-REVIEW.md` 2절)에서 조건이 아직 맞는지 본다.

## 게시

athena.novum-lab.com 과 같은 길이다. **`main` 에 합치는 순간 운영 반영**이다.

- 레포 공용 배포다(2026-10-29 은주 · minsoon 합의 — 서비스 폴더 단위). `deploy/sites.txt` 에 `chagok /var/www/chagok-site` 가 있다
- `main` 에 push(머지)되면 `.github/workflows/deploy.yml` 이 검사(`deploy/check-*.mjs` 전부) 뒤 서버에 SSH → 서버 고정 명령(`deploy/remote.sh` 복사본)이 GitHub `main` 을 받아 그 커밋의 `deploy/site.sh --all` 을 돌린다. 마지막 배포 뒤로 `chagok/` 나 `deploy/site.sh` · `deploy/sites.txt` 가 바뀌었으면 `chagok/` 를 `/var/www/chagok-site` 에 맞춘다(rsync `--delete` · 기록 서버 레포 `.git/deploy-chagok.log` · 마지막 배포 커밋 `.git/deploy-chagok.last`). 다른 서비스가 실패해도 chagok 은 따로 반영된다
- 손으로 다시 맞출 때(서버): `sh deploy/site.sh chagok main`
- 서버 레포 안에서 `main` 이 움직여도 hook(`deploy/hooks/reference-transaction`)이 같은 실행기(`site.sh --all`)를 돈다
- Caddy 블록 `chagok.novum-lab.com` 이 그 폴더를 낸다. 서버 · Caddy 는 서버 창 일이다

지금은 운영 주소(`https://chagok.novum-lab.com`)에 올라가 있지만 **공식 게시 전**이라 랜딩(`/`)만 검색에 열어 둔다. 검색 차단은 서버 Caddy 블록이 `/` 를 뺀 모든 경로에 `X-Robots-Tag: noindex` 헤더를 붙여 한다(`@noindex` · 레포에는 없다).
공식 게시 때: 위 「게시 전 채울 것」을 채우고, 판 날짜(`versions.json`, 각 판 상단)를 게시하는 날로 맞추고, Caddy 블록의 noindex 규칙을 지운다(서버 창).

`chagok/app-ads.txt` 는 AdMob 광고 판매자 확인용 한 줄이다(2026-10-29 출시 전에 미리 · `https://chagok.novum-lab.com/app-ads.txt`). 게시자 ID `pub-3557389923784580` 은 앱 `app.json` 의 iOS AdMob 앱 ID 앞부분이다(Android 쪽 `3940256099942544` 는 Google 테스트 ID 라 아니다). 앱 ID 나 AdMob 계정이 바뀌면 이 줄도 바꾼다. 검색 차단(noindex 헤더)과 상관없이 광고 크롤러가 읽는다. 앱 레포 `docs/RELEASE-DECISIONS.md` 「`app-ads.txt`」 줄은 옛 Netlify 주소 · 옛 레포 기준이다.
