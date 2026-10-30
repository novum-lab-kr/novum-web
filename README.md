# 홈페이지 (novum-lab.com)

노붐 회사 홈페이지(행님 2026-10-11 팀 시작).

- `site/` — 지금 운영 중인 정적 파일. 2026-10-08 급하게 만든 임시 랜딩 한 장을 `/var/www/novum-landing` 에서 그대로 옮겨 왔다.
- `main` 에 합치면 athena · chagok 과 같은 길로 `/var/www/novum-landing` 에 반영된다(`deploy/sites.txt` · 서버 폴더를 레포 `site/` 와 똑같이 맞춘다 — 서버에만 둔 파일은 지워진다).
- `chagok/` — 차곡차곡 사이트(chagok.novum-lab.com · 랜딩 · 지원 · 약관). `main` 에 합치면 athena 와 같은 길로 `/var/www/chagok-site` 에 반영된다. 개정 · 게시 방법은 `docs/chagok.md`.
