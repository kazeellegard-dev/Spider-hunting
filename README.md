# クモの巣ハンティング（英語名: Spider Web Catch）

飛んでくる虫をクモの巣で捕らえて育てる、タップ操作のカジュアルゲーム。
Webアプリとして開発してブラウザで動作確認し、Capacitor で iPhone / iPad アプリにする（ねこだるまおとしと同じ構成）。

- 遊び方・Web版の開発手順: [web/README.md](web/README.md)
- 要件定義書: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- 公開中のWeb版: https://kazeellegard-dev.github.io/Spider-hunting/

## フォルダ構成

| 場所 | 中身 |
|---|---|
| `web/` | ゲーム本体（HTML5 Canvas）。GitHub Pages でそのまま公開 |
| `ios/` | iOS アプリ（Capacitor）。`npm run sync` で `web/` の中身を取り込む |
| `scripts/` | `www/` を作るスクリプト、AdMob プラグインの修正、証明書の後片付け |
| `prototype/ios-spritekit/` | 方針転換前の SpriteKit 版プロトタイプ（糸の物理演算の検証用。参考として残している） |

## アプリ版のビルド

```bash
npm install      # 依存パッケージ（AdMob / Preferences）
npm run sync     # web/ → www/ → ios/App/App/public にコピー
```

- `ios/` などを push すると、GitHub Actions（`.github/workflows/ios.yml`）が署名なしのシミュレーター用ビルドで確認する
- Actions 画面の「Run workflow」で TestFlight にアップロードできる（要: Secrets の `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_KEY_P8` / `APPLE_TEAM_ID`、App Store Connect にバンドルID `com.kazeellegard.spiderwebcatch` のアプリ登録。App Store の名前は英語「Spider Web Catch: Bug Hunt」／日本語「クモの巣ハンティング」）

### 広告（AdMob）

- 広告は2種類
  - **バナー**: 画面のいちばん下にずっと出す
  - **インタースティシャル**: いとがなくなったあと「広告を見て つづける」を押したときに1回出す（1プレイ1回まで）。広告が読み込めていないときは、広告なしでそのままつづけられる
- アプリID（`Info.plist` の `GADApplicationIdentifier`）は本番の `ca-app-pub-8743645031370957~4534432873`
- 広告ユニットは、いまは **Google のテスト用ID**（`web/js/platform.js` の `ADMOB.test`）
- 本番用の広告ユニットIDは `ADMOB.live` に登録済み
  - バナー: `ca-app-pub-8743645031370957/1267859878`
  - インタースティシャル: `ca-app-pub-8743645031370957/6451158939`
- 本番に切り替えるときは、`ADMOB.useTest` を `false` にするだけ
- EEA・英国では Google の UMP で同意を確認し、そのあと全員に ATT（トラッキングの許可）を聞いてから広告を読み込む（ATT がないと審査で却下される。ガイドライン 5.1.2(i)）
- AdMob のメディエーションで **Unity Ads** にも広告を依頼する（ねこだるまおとしと同じ）
  - `scripts/patch-admob.mjs`（`npm install` のあとに自動で実行）が、Google の Unity アダプター（SPM、4.21.0）をプラグインの依存に足す
  - アダプターを読み込むため、`App` ターゲットのリンク設定に `-ObjC` を入れている
  - iOS のビルドのたびに、アダプターと `UnityAds.framework` がアプリに入ったかを Actions で確認する（入っていないとメディエーションが何も言わずに Unity を飛ばすため）
  - 実際に Unity の広告が出るのは、AdMob 管理画面でメディエーション グループを作り、本番広告に切り替えたあと
  - Unity の管理画面（cloud.unity.com）のアプリ「Spider Web Catch: Bug Hunt」：iOS の Game ID `800402235`、子ども向け（Child-directed）は「No」。Placement ID（入札用）はバナー `BP_Banner_iOS`・インタースティシャル `BP_Interstitial_iOS`
- バナーは画面のいちばん下（ホームバーのすぐ上）。ゲーム画面は最初からバナーの高さぶん上に収める。Web版は同じ場所を「AD」の帯であけてある
