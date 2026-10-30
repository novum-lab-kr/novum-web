# 홈페이지 (novum-lab.com)

노붐 회사 홈페이지(행님 2026-10-11 팀 시작).

- `site/` — 지금 운영 중인 정적 파일. 2026-10-08 급하게 만든 임시 랜딩 한 장을 `/var/www/novum-landing` 에서 그대로 옮겨 왔다.
- `main` 에 합치면 athena · chagok 과 같은 길로 `/var/www/novum-landing` 에 반영된다(`deploy/sites.txt` · 서버 폴더를 레포 `site/` 와 똑같이 맞춘다 — 서버에만 둔 파일은 지워진다).
- `chagok/` — 차곡차곡 사이트(chagok.novum-lab.com · 랜딩 · 지원 · 약관). `main` 에 합치면 athena 와 같은 길로 `/var/www/chagok-site` 에 반영된다. 개정 · 게시 방법은 `docs/chagok.md`.
- `syung/` — 슝 소개 사이트(syung.novum-lab.com · 한국어 `/` · 영어 `/en/`). 2026-10-30 슝 레포 `web/intro/`(136d2e8)에서 그대로 옮겨 왔다. `main` 에 합치면 같은 길로 `/var/www/syung-landing` 에 반영된다. 같은 주소의 `/privacy.html` · `/brand/*` 는 슝 레포가 계속 낸다.
