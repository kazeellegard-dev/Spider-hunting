# T-02 プロトタイプ: 糸のVerlet物理演算

`docs/REQUIREMENTS.md` のT-02（糸の物理演算実装方法の調査）に対応するプロトタイプ。
「タップでクモを移動→巣を張る（F-12/F-13）」「重さが強度を超えると糸が切れる（F-03）」
「糸の総量に上限がある（F-15）」という既決の機能要件が、Verlet Integrationベースの
自前物理演算で実際に成立する・気持ちよく感じられるかを検証するためのものです。

## 重要な注意（実行環境について）

このコードはClaude Codeのクラウド実行環境（Linuxコンテナ、macOS/Xcodeなし）で
作成しました。**このセッションではビルド・実機/シミュレータでの動作確認ができていません。**
Swift/SpriteKitの文法・APIは注意して書きましたが、実際にXcodeで開いてビルドが通るかは
未検証です。まずはXcodeでビルドし、エラーが出た場合は教えてください、すぐに修正します。

一方で `SpiderWebPhysics`（後述）はSpriteKit/UIKitに一切依存しない純粋なSwiftコードなので、
Xcode不要でmacOS/Linux上の`swift test`だけでロジックの正しさ（後述のテスト項目）を検証できます。

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
