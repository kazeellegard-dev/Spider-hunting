# Builds web/fonts/*.woff2: M PLUS Rounded 1c cut down to the characters the game uses,
# so the title and menus render at once and offline (no Google Fonts request at launch).
# Usage: python3 web/tools/subset-font.py <dir with 700.ttf 800.ttf 900.ttf>
# The TTFs come from https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;800;900
# (fetched with a plain user agent, which is served truetype). Re-run when new text is added.
import glob, os, sys
from fontTools import subset

src = sys.argv[1]
web = os.path.join(os.path.dirname(__file__), '..')
text = set()
for f in glob.glob(os.path.join(web, 'js', '*.js')) + [os.path.join(web, 'index.html')]:
    text |= set(open(f, encoding='utf-8').read())
ranges = [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2190, 0x2193), (0x2605, 0x2606),
          (0x3000, 0x303F), (0x3041, 0x309F), (0x30A0, 0x30FF), (0xFF01, 0xFF5E)]
for a, b in ranges:
    text |= {chr(c) for c in range(a, b + 1)}
chars = ''.join(sorted(c for c in text if ord(c) >= 0x20))
for w in (700, 800, 900):
    opt = subset.Options(); opt.flavor = 'woff2'; opt.layout_features = ['*']
    font = subset.load_font(os.path.join(src, f'{w}.ttf'), opt)
    s = subset.Subsetter(opt); s.populate(text=chars); s.subset(font)
    out = os.path.join(web, 'fonts', f'mplus-rounded-{w}.woff2')
    subset.save_font(font, out, opt)
    print(out, os.path.getsize(out) // 1024, 'KB')
