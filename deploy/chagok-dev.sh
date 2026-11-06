#!/bin/sh
# 차곡 개발 사이트(https://chagok-dev.novum-lab.com)에 지금 체크아웃의 chagok/ 를 올린다.
# 운영 사이트(main 머지 때 자동 배포)와 달리 손으로 올리고, 어느 브랜치든 올릴 수 있다.
# 쓰는 곳: 개발 앱(com.novumlab.chagok.dev)의 초대 링크 받기, 약관과 정책 페이지를 공개 전에 미리 보기.
#
#   CHAGOK_DEPLOY_HOST=<서버 주소> sh deploy/chagok-dev.sh <chagok-app 저장소 경로>
#
# 바꾸는 것:
#   - 초대 페이지(assets/invite/invite.js)의 API 주소와 공개 키를 개발 서버(앱 저장소 .env.local 의
#     EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)로 바꾼다. 공개 키라 페이지에 들어가도 된다.
#   - [차곡차곡에서 열기]가 개발 앱(chagok-dev://)을 연다.
#   - robots.txt 는 모두 막는다(서버도 X-Robots-Tag noindex 를 붙인다).
# 서버 쪽: chagok 계정이 쓸 수 있는 /var/www/chagok-site-dev, Caddy 블록 chagok-dev.novum-lab.com (2026-11-06).
set -eu

APP="${1:?chagok-app 저장소 경로를 주세요}"
HOST="${CHAGOK_DEPLOY_HOST:?CHAGOK_DEPLOY_HOST 에 서버 주소를 넣어 주세요}"
ENV_FILE="$APP/.env.local"
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE 이 없어요"; exit 1; }

URL=$(grep '^EXPO_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
KEY=$(grep '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d= -f2-)
case "$URL" in https://*.supabase.co) ;; *) echo "개발 서버 주소가 아니에요: $URL"; exit 1 ;; esac
[ -n "$KEY" ] || { echo "EXPO_PUBLIC_SUPABASE_ANON_KEY 가 비어 있어요"; exit 1; }

ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp -R "$ROOT/chagok/." "$TMP/"

JS="$TMP/assets/invite/invite.js"
grep -q "var API = 'https://chagok-api.novum-lab.com';" "$JS" || { echo "invite.js 의 API 줄을 찾지 못했어요"; exit 1; }
# 값에 / 가 들어가므로 구분자는 | 를 쓴다
sed -i.bak \
  -e "s|var API = 'https://chagok-api.novum-lab.com';|var API = '$URL';|" \
  -e "s|var ANON_KEY = '[^']*';|var ANON_KEY = '$KEY';|" \
  -e "s|'chagok://invite/'|'chagok-dev://invite/'|" "$JS"
rm -f "$JS.bak"
grep -q "var API = '$URL';" "$JS" || { echo "API 주소를 바꾸지 못했어요"; exit 1; }

printf 'User-agent: *\nDisallow: /\n' > "$TMP/robots.txt"
rm -f "$TMP/sitemap.xml"

rsync -rlz --delete --chmod=D755,F644 "$TMP/" "chagok@$HOST:/var/www/chagok-site-dev/"
echo "올렸어요: https://chagok-dev.novum-lab.com ($(git -C "$ROOT" rev-parse --abbrev-ref HEAD) $(git -C "$ROOT" rev-parse --short HEAD))"
