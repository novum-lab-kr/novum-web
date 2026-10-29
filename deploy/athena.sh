#!/bin/sh
# athena.novum-lab.com 반영: 이 레포 main 커밋의 athena/ 를 /var/www/athena-landing 에 그대로 맞춘다.
# 작업 트리가 아니라 커밋(git archive)에서 꺼내므로, 어느 워크트리의 미커밋 변경도 섞이지 않는다.
# 보통은 main 이 움직일 때 hook(deploy/hooks/reference-transaction)이 부른다. 손으로 부를 때: sh deploy/athena.sh [ref]
set -eu

REF="${1:-main}"
DEST="${ATHENA_DEST:-/var/www/athena-landing}"
GIT_DIR_COMMON="$(git rev-parse --git-common-dir)"
LOG="$GIT_DIR_COMMON/deploy-athena.log"
LOCK="$GIT_DIR_COMMON/deploy-athena.lock"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"; }

# 한 번에 하나만(빠르게 두 번 머지돼도 차례대로)
exec 9>"$LOCK"
flock 9

SHA="$(git rev-parse --short "$REF^{commit}")"
if ! git cat-file -e "$REF:athena/index.html" 2>/dev/null; then
  log "건너뜀 $SHA: athena/index.html 이 없음"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive "$REF" athena | tar -x -C "$TMP"

# --delete: 레포에서 지운 파일은 운영에서도 지운다. 체크섬으로 비교해 같은 파일은 건드리지 않는다
rsync -a --delete --checksum "$TMP/athena/" "$DEST/"

if diff -rq "$TMP/athena" "$DEST" >/dev/null; then
  log "반영 $SHA → $DEST"
else
  log "실패 $SHA: 반영 뒤에도 다름"
  exit 1
fi
