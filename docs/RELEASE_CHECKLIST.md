# リリースのときにやること

App Store でリリースしたら、作業する人（Claude）から次のことを案内する。

## 1. 本番広告に切り替える

- `web/js/platform.js` の `ADMOB.useTest` を `false` にする（本番の ID は README の「AdMob」に記録済み）。
- 「本番広告に切り替えて」と言われてから行う。

## 2. GitHub をプライベートにする前に

リリース後、リポジトリをプライベートにする予定（2026年10月に相談）。その前に次の2つを決めて準備する。

### Web 版の置き場所

無料プランでは、プライベートのリポジトリから GitHub Pages で公開できない。切り替えると今の Web 版は見られなくなる。

| 方法 | 費用 | メモ |
|---|---|---|
| A. KAZE Application のサイト（Cloudflare）に置く（おすすめ） | 無料 | 例：`/play/spider-web-catch/`。更新のたびにコピーが要る |
| B. GitHub Pro にする | 月4ドルほど | 今の URL のまま |
| C. Web 版をやめる | 無料 | アプリだけ |

### iOS ビルドの回数

プライベートでは GitHub Actions の無料枠は月2,000分。Mac は10倍で数えるので、実質は月200分ほど（1回10〜20分なので月10〜15回）。

- `.github/workflows/ios.yml` の push での自動ビルド確認をやめ、TestFlight に上げるとき（手動実行）だけにするのがおすすめ。
