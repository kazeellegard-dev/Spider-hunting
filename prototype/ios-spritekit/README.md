> **注意**: これは方針転換前（SpriteKit 版）のプロトタイプです。いまのゲームは `web/`、アプリ版は `ios/`（Capacitor）にあります。
> 下の文中の `ios/...` は、この `prototype/ios-spritekit/...` に読み替えてください。

# T-02 プロトタイプ: 糸のVerlet物理演算

`docs/REQUIREMENTS.md` のT-02（糸の物理演算実装方法の調査）に対応するプロトタイプ。
「タップでクモを移動→巣を張る（F-12/F-13）」「重さが強度を超えると糸が切れる（F-03）」
「糸の総量に上限がある（F-15）」という既決の機能要件が、Verlet Integrationベースの
自前物理演算で実際に成立する・気持ちよく感じられるかを検証するためのものです。

## 実行環境について

当初はクラウド環境（Xcodeなし）で書かれたコードでしたが、2026-09-23のローカルセッションで
Xcode 26.6 によるビルド成功・iPhone 17 Pro シミュレータでの動作確認を行いました。
経緯と現状は一番下の「次セッションへの申し送り」を参照してください。

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

`ios/SpiderWebPrototype.xcodeproj` を開いて、スキーム `SpiderWebPrototype`、
iPhoneシミュレータ（または実機）を選んでRunするだけです。

このプロジェクトはリポジトリ内の `ios/SpiderWebPrototype/` フォルダ（Xcodeのフォルダ同期）と
`ios/SpiderWebPhysics` パッケージを**直接参照**しています。以前の手順（別フォルダに新規
プロジェクトを作り、ソースをドラッグ＆ドロップでコピーする）は、`git pull` しても
コピー側が古いまま残るため使わないでください。実機で動かす場合は Signing & Capabilities で
自分のTeamを選んでください。

コマンドラインでビルドする場合:

```bash
xcodebuild -project ios/SpiderWebPrototype.xcodeproj -scheme SpiderWebPrototype -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

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

## 次セッションへの申し送り（2026-09-23時点、ブランチ `claude/zealous-newton-c8j104`）

ローカル環境（Xcode 26.6）でビルドと iPhone 17 Pro シミュレータでの動作確認を行いました。

### 判明したこと: これまで実機で見ていたのは古いコードだった

これまでの実機確認に使っていたXcodeプロジェクト（`DEVELOP_APP/SpiderWebPrototype/`、
リポジトリ外）は、ソースを9/17時点でコピーしたものでした。そのため9/22にクラウド側で入れた修正
（HUDのsafe area対応、分断後の残骸描画、虫の色しきい値）は**一度も実行されていませんでした**。
「HUD修正の改善報告がない」原因はこれです。今後の取り違えを防ぐため、リポジトリを直接参照する
`ios/SpiderWebPrototype.xcodeproj` を追加しました（上の「2.」を参照）。

### シミュレータで確認して直したこと

1. **HUD**: safe area対応は正しく効いていて、縦位置はDynamic Islandの下に収まっていた。
   実際の問題は、1行が長すぎて右端からはみ出していたこと。2〜3行の複数行表示・左上基準に変更した。
2. **分断後の残骸**: 描画されることを確認した（アンカーから垂れ下がる）。
3. **HUDの threads 数が画面の糸の本数より多い**: 残骸の糸がもう一度突き破られると、アンカー側でない
   方の破片にはピン留め点が1つもなく、画面外へ永遠に落下しながら `web.threads` に残り続けていた
   （リーク）。`Web.breakThread` で、アンカーを含まない破片を捨てるよう修正した。
   テスト `testBreakingAStubAgainDropsThePieceWithNoAnchor` を追加し、修正前は失敗、修正後は成功することを確認済み。
4. `onChange(of:perform:)` の非推奨警告を解消した。

### まだ確認していないこと

- 虫の色としきい値の一致（オレンジの虫で糸が切れないか）: シミュレータでは、赤い虫が糸を切ることまでは確認した。
- 「確認したいポイント」チェックリストの、体感に関わる項目（たわみの自然さ、捕獲の手応え、テンポ、
  詰み感、多数オブジェクト時のフレームレート）。これは実機で触って判断してほしい。
- 破断時の演出: 今は残骸が垂れ下がるだけ。パーティクルなどを足すかは体感次第。
