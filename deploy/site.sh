#!/bin/sh
# 서비스 폴더(athena/ · chagok/ …)를 그 서비스의 서버 폴더에 그대로 맞춘다. 서비스와 서버 폴더는 같은 커밋의 deploy/sites.txt 에 있다.
# 작업 트리가 아니라 커밋(git archive)에서 꺼내므로, 어느 워크트리의 미커밋 변경도 섞이지 않는다.
#
#   sh deploy/site.sh --all [ref]             sites.txt 의 서비스를 차례로 — 바뀐 서비스만 반영(--changed). 한 서비스가 실패해도 나머지는 하고, 실패가 있으면 마지막에 exit 1
#   sh deploy/site.sh --changed <서비스> [ref] 마지막 배포 커밋(git common dir 의 deploy-<서비스>.last) 뒤로 <서비스>/ · deploy/site.sh · deploy/sites.txt 가 바뀐 때만 반영
#   sh deploy/site.sh <서비스> [ref]           바뀌었는지 보지 않고 반영(손으로 다시 맞출 때)
#
# ref 기본값 main. 서버 폴더는 <서비스 대문자>_DEST(예 ATHENA_DEST · CHAGOK_DEST)로 바꿀 수 있다(시험용).
# 기록은 서비스마다 git common dir 의 deploy-<서비스>.log, 잠금은 deploy-<서비스>.lock.
# 보통 서버 고정 명령(deploy/remote.sh 복사본)과 hook(deploy/hooks/reference-transaction)이 같은 커밋에서 이 파일을 꺼내 --all 로 부른다.
set -eu

MODE=one
case "${1:-}" in
  --all) MODE=all; shift ;;
  --changed) MODE=changed; shift ;;
esac

GIT_DIR_COMMON="$(git rev-parse --path-format=absolute --git-common-dir)"

if [ "$MODE" = all ]; then
  REF="${1:-main}"
  SHA="$(git rev-parse --short "$REF^{commit}")"
  failed=
  # 서비스 이름만 뽑는다(빈 줄 · # 주석 제외). 하나씩 따로 띄워 한 서비스의 실패가 다른 서비스를 막지 않게
  for service in $(git show "$REF:deploy/sites.txt" | sed -e 's/#.*//' | awk 'NF { print $1 }'); do
    sh "$0" --changed "$service" "$REF" || failed="$failed $service"
  done
  if [ -n "$failed" ]; then
    echo "실패한 서비스($SHA):$failed"
    exit 1
  fi
  exit 0
fi

SERVICE="${1:?서비스 이름이 필요하다}"
REF="${2:-main}"
case "$SERVICE" in
  *[!a-z0-9-]* | '' | -*) echo "서비스 이름이 이상하다: $SERVICE" >&2; exit 2 ;;
esac

LOG="$GIT_DIR_COMMON/deploy-$SERVICE.log"
LAST="$GIT_DIR_COMMON/deploy-$SERVICE.last"
LOCK="$GIT_DIR_COMMON/deploy-$SERVICE.lock"
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"; }
say() { log "$*"; echo "$SERVICE: $*"; }

# 한 서비스는 한 번에 하나만(빠르게 두 번 머지되거나 hook 과 Actions 가 겹쳐도 차례대로)
exec 9>"$LOCK"
flock 9

FULL="$(git rev-parse "$REF^{commit}")"
SHA="$(git rev-parse --short "$FULL")"

# 서버 폴더: sites.txt 의 "<서비스> <폴더>" 줄. 환경 변수 <서비스>_DEST 가 있으면 그쪽
VAR="$(printf '%s' "$SERVICE" | tr 'a-z-' 'A-Z_')_DEST"
DEST="$(eval "printf '%s' \"\${$VAR:-}\"")"
if [ -z "$DEST" ]; then
  DEST="$(git show "$FULL:deploy/sites.txt" | sed -e 's/#.*//' | awk -v s="$SERVICE" '$1 == s { print $2; exit }')"
fi
case "$DEST" in
  /?*) ;;
  *) say "실패 $SHA: deploy/sites.txt 에 서버 폴더가 없거나 절대 경로가 아님"; exit 1 ;;
esac

if [ "$MODE" = changed ] && [ -s "$LAST" ]; then
  PREV="$(cat "$LAST")"
  # 마지막 배포 커밋이 이 레포에 있고, 그 뒤로 이 서비스와 배포 스크립트가 그대로면 건너뛴다(기록은 남기지 않고 화면에만)
  if git cat-file -e "$PREV^{commit}" 2>/dev/null \
    && git diff --quiet "$PREV" "$FULL" -- "$SERVICE/" deploy/site.sh deploy/sites.txt; then
    echo "$SERVICE: 바뀐 것 없음($(git rev-parse --short "$PREV") → $SHA)"
    exit 0
  fi
fi

if ! git cat-file -e "$FULL:$SERVICE/index.html" 2>/dev/null; then
  say "건너뜀 $SHA: $SERVICE/index.html 이 없음"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# tar.umask=022: 파일 644 · 폴더 755 로(기본 umask 002 면 664 · 775 로 나간다 — 서버 창 2026-10-29)
git -c tar.umask=022 archive "$FULL" "$SERVICE" | tar -x -C "$TMP"

# --delete: 레포에서 지운 파일은 운영에서도 지운다. 체크섬으로 비교해 같은 파일은 건드리지 않는다
if ! rsync -a --delete --checksum "$TMP/$SERVICE/" "$DEST/"; then
  say "실패 $SHA: rsync → $DEST"
  exit 1
fi

if diff -rq "$TMP/$SERVICE" "$DEST" >/dev/null; then
  printf '%s\n' "$FULL" >"$LAST"
  say "반영 $SHA → $DEST"
else
  say "실패 $SHA: 반영 뒤에도 다름"
  exit 1
fi
