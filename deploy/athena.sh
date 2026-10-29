#!/bin/sh
# 호환용: 옛 서버 고정 명령(remote.sh 복사본)과 옛 hook 이 이 파일을 꺼내 "sh <꺼낸 파일> <ref>" 로 부른다.
# 지금 반영은 deploy/site.sh 가 한다 — 같은 커밋의 site.sh 로 athena 만 반영한다(바뀌었는지 보지 않고).
# 서버 복사본 · hook 을 새 판으로 바꾼 뒤에는 지워도 된다.
set -eu
REF="${1:-main}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
git show "$REF:deploy/site.sh" >"$TMP"
sh "$TMP" athena "$REF"
