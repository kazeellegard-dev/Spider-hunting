# T-02 プロトタイプ: 糸のVerlet物理演算

`docs/REQUIREMENTS.md` のT-02（糸の物理演算実装方法の調査）に対応するプロトタイプ。
「タップでクモを移動→巣を張る（F-12/F-13）」「重さが強度を超えると糸が切れる（F-03）」
「糸の総量に上限がある（F-15）」という既決の機能要件が、Verlet Integrationベースの
自前物理演算で実際に成立する・気持ちよく感じられるかを検証するためのものです。

## 重要な注意（実行環境について）

このコードはClaude Codeのクラウド実行環境（Linuxコンテナ、macOS/Xcodeなし）で
作成しました。**このクラウドセッションではビルド・実機/シミュレータでの動作確認ができません。**
これまでのやり取りは「クラウド側でコードを直して push → ユーザーがローカルのXcodeで
ビルド・実機確認してフィードバックをもらう」というラウンドトリップで進めていましたが、
見た目のバグ（HUD位置、糸が切れる演出など）はスクリーンショット等なしのテキストだけの
フィードバックでは原因特定に時間がかかるため、**以降はローカル環境（Xcodeが使える環境）の
Claude Codeセッションに引き継ぎ、実際にビルド→シミュレータ/実機で確認しながら反復するのを
推奨します。** 引き継ぎ時の状況は一番下の「次セッションへの申し送り」を参照してください。

一方で `SpiderWebPhysics`（後述）はSpriteKit/UIKitに一切依存しない純粋なSwiftコードなので、
Xcode不要でmacOS/Linux上の`swift test`だけでロジックの正しさ（後述のテスト項目）を検証できます。
ローカル環境なら `cd ios/SpiderWebPhysics && swift test` がそのまま使えるはずです。

## 構成

```
ios/
  SpiderWebPhysics/        ← 物理演算コア（Swift Packageとして独立、SpriteKit非依存）
    Sources/SpiderWebPhysics/
      Vector2.swift        ← CoreGraphics非依存の2Dベクトル
      VerletPoint.swift    ← Verlet積分される質点
      SilkThread.swift     ← 糸1本（アンカー間の質点列＋距離拘束、強度による破断判定）
      Web.swift            ← 巣全体（糸の集合＋総糸量の予算管理＝F-15）
    Tests/SpiderWebPhysicsTests/
      SilkThreadTests.swift
      WebTests.swift
  SpiderWebPrototype/       ← SpriteKit連携部分（Xcodeプロジェクトに追加して使う）
    App/SpiderWebPrototypeApp.swift  ← SwiftUIエントリーポイント（SpriteViewでSKSceneを表示）
    Game/
      GameScene.swift       ← メインループ、タップ操作、糸の生成・描画、虫との当たり判定
      Spider.swift          ← クモ（タップ移動）
      Insect.swift          ← 虫（飛行、捕獲演出）
      CoreGraphics+Vector2.swift ← Vector2 <-> CGPoint 変換
```

## 1. まずロジックだけ検証する（Xcode不要）

```bash
cd ios/SpiderWebPhysics
swift test
```

以下を確認するテストを用意しています:
- 糸が重力で自然にたわむか（`testThreadSagsUnderGravity`）
- アンカー（両端）が固定されたままか（`testAnchorsStayPinned`）
- 拘束後もセグメント長がほぼ一定に保たれるか（`testSegmentLengthIsRoughlyMaintained`）
- 強度を超える重さの虫が来ると糸が切れるか／切れないか（`testHeavyInsectBreaksWeakThread` / `testLightInsectDoesNotBreakThread`）
- 虫の位置から糸への最近接点が正しく求まるか（`testClosestPointFindsMidSegment`）
- 衝突時のインパルスが糸を動かすか（`testApplyImpactDisplacesBracketingPoints`）
- 巣の総糸量予算の消費・枯渇・糸切れ後のクリーンアップ（`WebTests`）

## 2. 実際に触って「気持ちよさ」を検証する（Xcode必要）

1. Xcodeで新規プロジェクトを作成: **iOS → App**（Interface: SwiftUI、Language: Swift）
2. プロジェクトに `ios/SpiderWebPhysics` をローカルパッケージとして追加:
   File → Add Package Dependencies... → Add Local... → `ios/SpiderWebPhysics` を選択
3. `ios/SpiderWebPrototype/App/SpiderWebPrototypeApp.swift` と `ios/SpiderWebPrototype/Game/*.swift` を
   プロジェクトにドラッグ＆ドロップで追加（自動生成された `ContentView.swift` や既定の `@main App` は削除）
4. シミュレータ（iPhone想定）でRun

### 操作方法
- 画面をタップ → クモがその位置へ移動し、直前の位置からタップ位置まで糸が張られる
- 虫が自動的に左右から飛来する。糸に触れると:
  - 糸の強度 ≥ 虫の重さ → 捕獲（糸に巻かれてポンと消える、F-03a準拠のライト表現）
  - 糸の強度 < 虫の重さ → 糸が切れて消え、虫はそのまま飛び続ける

### 確認したいポイント（チェックリスト）
- [ ] `gravity`（`GameScene.swift`内）を変えたとき、糸のたわみ方が「クモの巣らしい」自然さになるか
- [ ] 虫が当たった瞬間の糸の揺れ（インパルス）が捕獲の手応えとして感じられるか
- [ ] 糸が切れる瞬間が視覚的にわかりやすいか（現状は消えるだけ。破断時の演出は要検討）
- [ ] タップから移動→着地→糸が張られるまでのテンポが、1プレイ1〜3分のカジュアルゲームとして快適か
- [ ] 総糸量（`maxWebLength`）を使い切ったときの「詰み感」の出方
- [ ] 多数の糸・虫が同時に存在してもフレームレートが落ちないか（`constraintIterations`や虫の同時数上限を要調整）

## 未実装・今回のスコープ外（次のイテレーションで検討）

- 糸の修復（F-16）、巣の形状による捕獲率変化（F-14）は含めていない
- レベルによる糸強度の変化（F-08/F-09）は`threadStrength`定数の手動変更でのみ検証可能
- 破断時の演出（パーティクル等）は未実装
- タップでの複数アンカー・網目状の巣作成（放射状・同心円状など本来のクモの巣らしい形状）は
  今回は「直前の位置から新しい位置まで1本」の単純化版。網目形状はT-03で改めて検討する

## 次セッションへの申し送り（2026-09-22時点、ブランチ `claude/zealous-newton-c8j104`）

実機での動作確認を数ラウンド繰り返した結果、以下の状態です。**このクラウドセッションでは
ビルドも実行もできず、すべてコードリーディングだけで判断しているため、ここに書いた「直した」
は「テキストのバグ報告から原因を特定してコードは直したが未検証」という意味です。** ローカルで
ビルドして確認しながら、必要なら再修正してください。

### 直近の変更で直した（と思われる）バグ

1. **虫の色と実際の強度しきい値がズレていた**（`Insect.swift`）
   `threadStrength`（デフォルト2.0）に対して、オレンジ色の判定は固定値`weight < 2.5`だったため、
   重さ2.0〜2.4の虫は見た目「オレンジ」なのに実際は糸を切る挙動になっていた。これが
   「オレンジの虫でも糸が消える」の主因と推測。`Insect.color(forWeight:threadStrength:)`が
   `threadStrength`を引数に取り、しきい値を相対化するよう修正済み。
2. **糸を突き破って分断したときの残骸が描画されていなかった**（`GameScene.swift`）
   `Web.breakThread`が新しい`SilkThread`（分断後の残骸2本）を`web.threads`に追加する一方、
   対応する`SKShapeNode`を作る処理が`spinThread()`（タップ時のみ呼ばれる）にしかなく、
   分断で生まれた残骸には描画ノードが一度も作られていなかった。物理的には存在し当たり判定も
   生きているのに画面には一切見えない糸ができてしまい、「突き破っても線がただ消えるだけ」
   「見えない糸に別の虫が反応する」といった不可解な挙動の原因になっていたはず。
   `syncThreadNodes()`を、`web.threads`にある全スレッドに対して汎用的にノードを
   作成/更新/削除する実装に書き換えて解消（`spinThread()`はノード管理をしなくなった）。

### まだ未検証・原因を確信できていない問題

- **HUDの位置**: 2回修正（`didMove`内の一度きりの計算 → 毎フレーム再計算）を試したが改善報告なし。
  今回さらに、`SKView.safeAreaInsets`に頼るのをやめ、SwiftUIの`GeometryReader`から
  `safeAreaInsets`を取得して`GameScene.externalSafeAreaInsets`に注入する方式に変更した
  （`SpiderWebPrototypeApp.swift`）。これも未検証。もしこれでも直らない場合は:
  - `positionHUD()`内に`print(insets, size)`を仕込んで実際の値をXcodeコンソールで確認する
  - Xcodeの View Debugger でHUDラベルの実際のフレーム座標を確認する
  - そもそも「ノッチと被る」がHUDの位置の話ではなく、フォントサイズ/文字が長すぎて画面外に
    はみ出している可能性も切り分ける
- **糸の突き破り演出が「意図通りでない」の詳細不明**: 上記のノード描画漏れが主因だった可能性が
  高いが、それ以外に何が「意図通りでない」と感じられたのか（分断位置がずれる、垂れ下がり方が
  不自然、等）は具体的なフィードバックがなくまだ切り分けられていない。修正後に改めて
  「突き破ったときの見た目」を確認してほしい。

### ローカルセッションでまず実行してほしいこと

1. `cd ios/SpiderWebPhysics && swift test` — 既存＋今回追加したテスト
   （`testSeverSplitsThreadAtSegmentAndFreesTornEnds`、`WebTests`内の分断系テスト3件）が
   通るか確認。ここが通らない場合はSpriteKit以前にロジックが壊れているので最優先で直す。
2. Xcodeでビルド → シミュレータ/実機で本READMEの「確認したいポイント」チェックリストを再実施。
3. 特にHUD位置は、直っていなければ上記のデバッグ手順で実際の値を見てから対処する
   （テキストの往復だけで直そうとするのは非効率と判断したため、ここで引き継ぎ）。
