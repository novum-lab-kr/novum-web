#!/bin/sh
# GitHub Actions 가 SSH 로 부르는 서버 쪽 배포(배포 키의 forced command 로만 돈다 — Actions 가 보낸 명령은 무시된다).
# GitHub main 을 서버 레포의 refs/remotes/upstream/main 으로 받아 오고, 그 커밋의 deploy/athena.sh 로 athena/ 를 반영한다.
# 이 파일은 서버의 고정 자리(예: /usr/local/sbin/homepage-deploy)에 복사해 쓴다 — 고치면 서버 창이 다시 복사해야 한다.
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
git show "$REF:deploy/athena.sh" >"$TMP"
sh "$TMP" "$REF"
tail -n 1 "$(git rev-parse --git-common-dir)/deploy-athena.log"
