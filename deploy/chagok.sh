#!/bin/sh
# chagok.novum-lab.com 반영: 이 레포 main 커밋의 chagok/ 를 /var/www/chagok-site 에 그대로 맞춘다.
# deploy/athena.sh 와 같은 방식 — 작업 트리가 아니라 커밋(git archive)에서 꺼내므로, 어느 워크트리의 미커밋 변경도 섞이지 않는다.
# 보통은 remote.sh(Actions) 나 main 이 움직일 때 hook(deploy/hooks/reference-transaction)이 부른다. 손으로 부를 때: sh deploy/chagok.sh [ref]
# 검색 차단(noindex)은 서버 Caddy 블록 chagok.novum-lab.com 이 붙인다 — 사이트 파일에는 넣지 않는다.
set -eu

REF="${1:-main}"
DEST="${CHAGOK_DEST:-/var/www/chagok-site}"
GIT_DIR_COMMON="$(git rev-parse --git-common-dir)"
LOG="$GIT_DIR_COMMON/deploy-chagok.log"
LOCK="$GIT_DIR_COMMON/deploy-chagok.lock"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"; }

# 한 번에 하나만(빠르게 두 번 머지돼도 차례대로)
exec 9>"$LOCK"
flock 9

SHA="$(git rev-parse --short "$REF^{commit}")"
if ! git cat-file -e "$REF:chagok/index.html" 2>/dev/null; then
  log "건너뜀 $SHA: chagok/index.html 이 없음"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# tar.umask=022: 파일 644 · 폴더 755 로(athena.sh 와 같다)
git -c tar.umask=022 archive "$REF" chagok | tar -x -C "$TMP"

# --delete: 레포에서 지운 파일은 운영에서도 지운다. 체크섬으로 비교해 같은 파일은 건드리지 않는다
rsync -a --delete --checksum "$TMP/chagok/" "$DEST/"

if diff -rq "$TMP/chagok" "$DEST" >/dev/null; then
  log "반영 $SHA → $DEST"
else
  log "실패 $SHA: 반영 뒤에도 다름"
  exit 1
fi
