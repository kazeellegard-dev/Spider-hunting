# クモの巣ハンティング Web版

ブラウザで遊べる一通り完成版。画像・音声ファイルは使わず、絵は Canvas、音は Web Audio ですべて作っている。

## 遊び方

- 画面をタップ → クモが糸を引きながらその場所へ移動。近くの結び目や糸にはくっついて巣がつながる
- 巣にかかった虫をタップ → クモが駆け寄って巻きつけ、食べる（得点・いと回復）
- かかった虫は、まわりの輪がなくなると糸を切って逃げる
- 重い虫（カナブン・クワガタなど）は弱い糸を切って通り抜ける。強化で糸を強くする
- 「いと」ゲージは時間でも減る。0になるとおしまい
- 続けて食べるとコンボ。ボーナスゲージがたまるとボーナスタイム（おかしを巣でキャッチ）
- スコアが伸びると、プレイ中にエリア（背景・虫の種類）が切り替わる

## 動かし方

```bash
# どれか1つ
npx http-server web -p 8080      # → http://localhost:8080
python3 -m http.server -d web 8080
```

`web/index.html` をファイルとして直接開いても遊べる（Service Worker だけ無効になる）。

### 確認端末で遊ぶ

- **GitHub Pages**: `main` に push すると `.github/workflows/pages.yml` が `web/` を公開する。
  非公開リポジトリでは GitHub Pro 以上が必要（Settings → Pages → Source を「GitHub Actions」）。
- **1ファイル版**: `node web/tools/bundle.mjs dist/spider-hunting.html` で、CSS・JSを埋め込んだ
  HTML 1枚ができる。好きな場所に置いて開けばそのまま遊べる。

## テスト

```bash
node --test web/tests/*.test.js
```

糸の物理演算（たわみ、アンカー固定、分割、切断、残骸の扱い、荷重）を確認している。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `js/physics.js` | 糸の物理演算（Verlet積分）。結び目・糸の分割・切断。DOM非依存でNodeからもテストできる |
| `js/data.js` | **バランス調整用の数値はすべてここ**（虫、エリア、強化、きせかえ、いとの減り方など） |
| `js/game.js` | ゲーム本体（巣作り、虫の飛行・捕獲・逃走、コンボ、ボーナスタイム、風、チュートリアル、結果計算） |
| `js/render.js` | 背景・クモ・虫・おかし・糸の描画 |
| `js/ui.js` | タイトル・HUD・各メニュー画面 |
| `js/audio.js` | 効果音とBGM（Web Audioで合成） |
| `js/i18n.js` | 日本語／英語の文言（端末の言語で自動切替、設定で変更可） |
| `js/save.js` | セーブデータ（localStorage） |
| `js/platform.js` | アプリ版との接続口（リワード広告・Game Center・振動）。ブラウザでは何もしない／即成功 |
| `js/main.js` | 起動、画面サイズ調整、入力、メインループ |
| `tools/bundle.mjs` | 1ファイル版HTMLを作る |

## 調整のしかた

遊んでみて「難しい／簡単」と感じたら、まず `js/data.js` の `BALANCE` を触る。

- いとの減りが速い → `drainBase` / `drainRamp` を下げる
- 糸を張るとすぐ尽きる → `silkCostPerPx` を下げる
- 虫がすぐ逃げる → `baseStruggle` を上げる
- エリアがすぐ変わる → `AREAS` の `score` を上げる

## アプリ化（次の段階）

ねこだるまおとしと同じく Capacitor で包む予定。`js/platform.js` の各関数を、
AdMob（リワード広告）・Game Center・StoreKit・Haptics のプラグイン呼び出しに置き換える。
