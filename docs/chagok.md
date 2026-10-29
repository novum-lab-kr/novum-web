# 차곡차곡 사이트 (chagok.novum-lab.com)

차곡차곡 앱의 소개(랜딩) · 고객 지원 · 이용약관 · 개인정보 처리방침 사이트. 파일은 이 레포 `chagok/` 에 있다.
앱은 `https://chagok.novum-lab.com/{terms,privacy}/` 를 앱 안 시트로 열고, 판 정보는 `versions.json` 을 읽는다.

이전 기록은 GitHub `novum-lab-kr/chagok-app-policy`(보관)에 있다 — 2026-10-29 그 레포 `main`(ca97b05)의 사이트 파일만 옮겨 왔다.

| 경로 | 내용 | 검색 노출 |
|---|---|---|
| `/` | 랜딩(`index.html`, 스타일 `assets/landing.css`, 그림 `assets/img`, 영상 `assets/vid`, 글꼴 `assets/fonts` — Pretendard, Neo둥근모 원본 그대로, SIL OFL 1.1, 폴더마다 `LICENSE.txt`) | 허용 |
| `/support/` | 문의, 자주 묻는 것, 운영자 정보 | 차단(공식 게시 전) |
| `/terms/`, `/privacy/`, `/delete-account/`, `/versions.json` | 약관, 처리방침, 계정 삭제 안내, 판 목록 — **앱이 읽는 경로라 바꾸지 않는다** | 차단(공식 게시 전) |

랜딩의 App Store 버튼은 출시 전이라 누를 수 없는 「곧 출시」다. 주소가 생기면 `chagok/index.html` 맨 위 주석대로 세 곳을 바꾼다.
판 본문(`terms/v1` 등)의 사이트 안 링크는 `/delete-account/` 처럼 **사이트 기준 절대 경로**로 쓴다 — 같은 본문이 `/privacy/v1/` 과 `/privacy/`(끼워 넣기) 두 주소에서 보여 상대 경로는 한쪽에서 깨진다.

## 개정하는 방법

**정식 출시 전에는 새 판을 만들지 않고 1판(`terms/v1`, `privacy/v1`)을 고친다** (2026-10-14 결정). 아래는 출시 뒤 개정할 때다.

1. `chagok/terms/v2/index.html` 처럼 새 판 폴더를 만든다. 이미 시행된 판의 본문은 고치지 않는다(오탈자만).
2. `chagok/versions.json` 에 판을 추가한다. `postedAt`(게시일)과 `effectiveAt`(시행일)은 로컬 날짜 `YYYY-MM-DD`.
   - 사전 고지: 시행일 7일 전, 이용자에게 불리하면 30일 전에 게시한다.
   - `requiresConsent`: 로그인한 사용자에게 다시 동의를 받을 개정이면 `true`.
3. 시행일 전까지 `terms/` 는 이전 판을 보여주고 위에 "M월 D일부터 바뀌어요"를 띄운다.
   판 선택 규칙은 앱의 `src/policy/versions.ts` 와 같다.

고친 뒤 `node deploy/check-chagok.mjs` 로 검사한다(Actions 도 같은 검사를 돌린다 — `versions.json` 형식 · 판 파일 · `policy.js` 문법 · 페이지가 부르는 사이트 안 파일).

## 게시 전 채울 것

판 날짜, 약관 끝과 지원 페이지(`support/`)의 사업장 주소, 전화번호, 통신판매업 신고번호(유료 상품을 팔기 전에, 전자상거래법 제10조와 제13조). 최종 문안은 법률 검토를 받는다.

## 게시

athena.novum-lab.com 과 같은 길이다. **`main` 에 합치는 순간 운영 반영**이다.

- `main` 에 push(머지)되면 `.github/workflows/deploy.yml` 이 검사(`deploy/check-chagok.mjs`) 뒤 서버에 SSH → 서버 고정 명령(`deploy/remote.sh` 복사본)이 GitHub `main` 을 받아 그 커밋의 `deploy/chagok.sh` 로 `chagok/` 를 `/var/www/chagok-site` 에 맞춘다(rsync `--delete` · 기록 서버 레포 `.git/deploy-chagok.log`)
- 서버 레포 안에서 `main` 이 움직여도 hook(`deploy/hooks/reference-transaction`)이 같은 반영을 돈다
- Caddy 블록 `chagok.novum-lab.com` 이 그 폴더를 낸다. 서버 · Caddy 는 서버 창 일이다

2026-09-30부터 초안을 공개해 두었다(앱 연결 확인용). 검색 차단은 서버 Caddy 블록이 `/` 를 뺀 모든 경로에 `X-Robots-Tag: noindex` 헤더를 붙여 한다(`@noindex` · 레포에는 없다).
공식 게시 때: 위 「게시 전 채울 것」을 채우고, 판 날짜(`versions.json`, 각 판 상단)를 게시하는 날로 맞추고, Caddy 블록의 noindex 규칙을 지운다(서버 창).
