# 홈페이지 — 항상 읽는 기록

- 목표: novum-lab.com 회사 홈페이지. 노붐 소개와 서비스(슝 · 차곡차곡 등) 소개를 싣는다.
- 지금 운영: Caddy `novum-lab.com` 블록이 `/var/www/novum-landing` 정적 파일을 그대로 낸다. 2026-10-08 임시 랜딩 한 장(`index.html`, 이미지가 base64 로 들어 있어 크다). 이 레포 `site/` 가 그 사본(2026-10-11).
- athena.novum-lab.com(`athena/`)은 main 이 움직이면 자동 반영된다: 원본 레포 hook `reference-transaction` → `deploy/site.sh --all` 이 main 커밋에서 `deploy/sites.txt` 의 서비스 가운데 바뀐 것만 서버 폴더에 맞춘다(athena → `/var/www/athena-landing` · rsync --delete · 기록 `.git/deploy-athena.log`). GitHub main 머지도 Actions → `remote.sh` → 같은 `site.sh --all`. 차곡(`chagok/` → chagok.novum-lab.com)도 같은 길이다(2026-10-29 서비스 단위 배포 — `docs/chagok.md`). "올려" → `nhm push` 한 번이면 끝이고 서버 창에 따로 넘기지 않는다. hook 설치 · `/var/www` 는 서버 창 일(2026-10-29 설치).
- novum-lab.com(`site/`)도 같은 길로 자동 반영된다(site → `/var/www/novum-landing` · 2026-10-30 켬 — 켜기 전 서버 폴더에 레포 밖 파일이 없음을 확인). `/var/www` · Caddy 는 직접 고치지 않는다. Caddy 는 서버 창 일이다.
- 서비스 소개 글: 문안은 사업 전략 팀이 쓰고(그 서비스 팀이 최신 문서를 넘겨 준 것 기준), 홈페이지 팀이 화면에 넣는다. 출시 전 서비스는 공개해도 되는 범위를 그 서비스 담당자에게 먼저 확인한다(차곡차곡은 은주).
- 비밀값(키 · 토큰)은 레포에 넣지 않는다.
