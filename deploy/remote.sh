#!/bin/sh
# GitHub Actions 가 SSH 로 부르는 서버 쪽 배포(배포 키의 forced command 로만 돈다 — Actions 가 보낸 명령은 무시된다).
# GitHub main 을 서버 레포의 refs/remotes/upstream/main 으로 받아 오고, 그 커밋의 deploy/site.sh --all 로
# deploy/sites.txt 의 서비스(athena/ · chagok/ …) 가운데 마지막 배포 뒤로 바뀐 것만 반영한다. 한 서비스가 실패해도 나머지는 반영하고, 실패가 있으면 exit 1.
# 이 파일은 서버의 고정 자리(/usr/local/sbin/homepage-deploy)에 복사해 쓴다 — 고치면 서버 창이 다시 복사해야 한다.
# 서비스를 더하거나 반영 방식을 바꿀 때는 site.sh · sites.txt 만 고치면 되도록, 여기에는 받아 오고 넘기는 일만 둔다.
set -eu

REPO="${HOMEPAGE_REPO:-/root/.local/share/novum-hm/repos/homepage}"
UPSTREAM="${HOMEPAGE_UPSTREAM:-https://github.com/novum-lab-kr/novum-web.git}"
REF=refs/remotes/upstream/main   # nhm 이 운영 레포 base 를 두는 자리와 같다

cd "$REPO"
git fetch --quiet "$UPSTREAM" "+main:$REF"
SHA="$(git rev-parse --short "$REF")"
echo "homepage deploy: $SHA"

# 반영 스크립트도 그 커밋에서 꺼내 쓴다(서버 작업 트리가 낡았어도 같은 커밋의 방식으로)
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
if git show "$REF:deploy/site.sh" >"$TMP" 2>/dev/null; then
  sh "$TMP" --all "$REF"
else
  # site.sh 가 없는 옛 커밋(서비스 단위 배포 전): 그때 방식대로 athena 만
  git show "$REF:deploy/athena.sh" >"$TMP"
  sh "$TMP" "$REF"
  tail -n 1 "$(git rev-parse --git-common-dir)/deploy-athena.log"
fi
