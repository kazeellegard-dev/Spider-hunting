# スクリーンショットの作り方

ゲーム（Web版・広告なし）をブラウザで開いて場面を作り、App Store 用の画像を書き出します。
ねこだるまおとしの `store/tools` と同じ作り方・見た目です。

```sh
python3 -m http.server -d web 8765 &                     # Web版を手元で動かす（URL=... で変えられる）
LANG_UI=ja node store/tools/capture.js                   # 生の画面を store/tools/shots/ja/ に保存
LANG_UI=ja node store/tools/compose.js                   # 見出しをつけて store/screenshots/ja/ に書き出す
LANG_UI=en node store/tools/capture.js && LANG_UI=en node store/tools/compose.js   # 英語版
```

- `capture.js` の1つめの引数で場面をしぼれる（例：`title,eat`）。`DEV=iphone` で端末もしぼれる
- Playwright が要る（`npm i -D playwright`、または `PLAYWRIGHT=/path/to/playwright`）
- iPhone 6.9 インチ（1320×2868）と iPad 13 インチ（2064×2752）を作る
- iPhone 6.3 インチ（1206×2622）は、6.9 インチの画像を縮小して作る（比率がほぼ同じ）：
  `python3 -c "from PIL import Image;import os;[Image.open(f'store/screenshots/ja/iphone/{f}').resize((1206,2622),Image.LANCZOS).save(f'store/screenshots/ja/iphone-6.3/{f}',quality=92) for f in os.listdir('store/screenshots/ja/iphone')]"`（`-plain` と `en` も同じように）
- 見出しの文字は `compose.js` の `ORDER` で変えられる
- 場面は、プレイ中の画面をプログラムで作っている（大きな巣・かかった虫・時間帯など）。セーブデータは `capture.js` の `SAVE`（レベル18・ずかん27種類くらいの、遊びこんだ人の想定）

## App Store のヘッダ・検索結果の画像（クリエイティブアセット）

```sh
node store/tools/creative.js /tmp/cr      # 生の画面を書き出す（3倍・5244×2952）
```

- App Store Connect が受けつけるのは 16:9・5244×2950 の PNG 1枚。Apple がそこからヘッダ（21:9）と検索結果（3:2）を切り出す
- 両方で残るのは まんなかの 4425×2247。クモと巣は その中に入れる
- できた画像の上下を 1px ずつ切って、`store/creative/universal-5244x2950.png`（透明なし）にする
- 文字は入れていないので、日本語・英語で同じ画像を使える
