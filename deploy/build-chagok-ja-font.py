# 일본어 페이지용 도트 글꼴(chagok/assets/fonts/dotgothic16/dotgothic16-ja.woff2)을 만든다(2026-11-14, 앱 1.2.0 일본어).
#   python3 -m pip install fonttools brotli
#   python3 deploy/build-chagok-ja-font.py <DotGothic16 ttf 경로>
# 원본은 앱 저장소 src/design-system/assets/dotgothic16-jis.ttf(앱이 쓰는 DotGothic16, SIL OFL 1.1). 원본 그대로는 1.7MB라
# 사이트가 쓰는 글자만 남긴다: 아래 파일에 나오는 모든 글자 + ASCII + 히라가나와 가타카나 전부 + 일본어 문장 부호와 전각 기호
# (초대 페이지는 사람이 쓴 이름과 목표 이름을 넣으니 가나는 모두 둔다. 여기 없는 한자는 그 글자만 시스템 글꼴로 그려진다).
# 일본어 문구(ja/, invite/ja.html, invite.js, 미리보기 그림 스크립트)를 고치면 다시 돌린다.
import sys
from pathlib import Path
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    *sorted((ROOT / 'chagok/ja').rglob('*.html')),
    ROOT / 'chagok/invite/ja.html',
    ROOT / 'chagok/assets/invite/invite.js',
    ROOT / 'deploy/build-chagok-og.mjs',
    ROOT / 'deploy/build-chagok-landing-og.mjs',
]
OUT = ROOT / 'chagok/assets/fonts/dotgothic16/dotgothic16-ja.woff2'

chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set(chr(c) for c in range(0x3000, 0x3040))  # 일본어 문장 부호
chars |= set(chr(c) for c in range(0x3041, 0x3097))  # 히라가나
chars |= set(chr(c) for c in range(0x30A1, 0x3100))  # 가타카나, ー
chars |= set(chr(c) for c in range(0xFF01, 0xFF5F))  # 전각 기호와 영숫자
for path in SOURCES:
    chars |= set(path.read_text(encoding='utf-8'))
chars = {c for c in chars if c.isprintable()}

options = subset.Options()
options.flavor = 'woff2'
options.layout_features = ['*']
options.name_IDs = ['*']  # 저작권과 OFL 안내(이름 표)를 그대로 둔다
options.notdef_outline = True
font = subset.load_font(sys.argv[1], options)
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=[ord(c) for c in chars])
subsetter.subset(font)
OUT.parent.mkdir(parents=True, exist_ok=True)
subset.save_font(font, str(OUT), options)
print(f'{OUT.relative_to(ROOT)} {OUT.stat().st_size // 1024}KB, 글자 {len(font.getBestCmap())}개')
