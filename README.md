# 高速道路アシスト（MVP）

## Web版

現在の公開対象は、サーバーを使わずGitHub Pagesで動作する簡易PIN付きWebアプリです。公開とPIN変更の手順は[`pages/README.md`](pages/README.md)を参照してください。

CarPlay上のGoogle Mapsとは独立してiPhoneで動作し、GPSから推定した高速道路の前方にあるSA・PA・IC・JCTをWeb公開版では最大5件表示します。

## 現在の実装範囲

- Core Locationによる位置・速度・進行方向の取得
- 座標、方位、直前リンクの連続性を使った簡易マップマッチング
- 有向道路グラフ上の前方地点抽出（Web公開版は最大5件）
- 道路リンクに沿った残距離と予想通過時刻
- 現在地を最下部、近い地点を下側に置く独自SwiftUI画面
- 開始前の目的IC選択と、目的地通過後も継続する前方案内
- 残り件数にかかわらず高さが変わらない6枠固定レイアウト
- SA・PA設備の汎用SF Symbols表示
- SA・PAのブランド名バッジ（正式許諾前は企業ロゴ画像を使用しない）
- 位置情報拒否、道路未判定、データ欠落時の状態表示
- 海老名ICから圏央道・東北道・青森道を経て青森中央ICまでの往復道路形状・地点データ（検証中）
- 架空データによるロジックの単体テスト

実道路版は道路形状・地点座標にOpenStreetMapデータを使用し、地点順をNEXCO東日本の公開情報と照合しています。設備内容、店舗、通行規制、実走行精度はまだ検証中であり、現段階では運転中の案内に使用できません。

## Xcodeで開く

macOSにXcode 16以降と[XcodeGen](https://github.com/yonaskolb/XcodeGen)を用意し、リポジトリ直下で次を実行します。

```sh
xcodegen generate
open HighwayAssist.xcodeproj
```

Signing & Capabilitiesで開発チームを選択してから実機またはSimulatorで実行してください。SimulatorではDebugメニューのLocationから[TestRoutes/DemoRoute.gpx](TestRoutes/DemoRoute.gpx)を読み込むと、架空道路上の西向き走行を再生できます。

## iPadのSwift Playgroundsで開く

Windowsしかない期間は、同梱の`HighwayAssistPlayground.swiftpm`をiPadへ転送してUIと基本ロジックを確認できます。詳しい手順は[docs/IPAD_PLAYGROUNDS.md](docs/IPAD_PLAYGROUNDS.md)を参照してください。

共有コードを変更した後は、Windowsで次を実行してApp Playground側へ反映します。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Build-PlaygroundPackage.ps1
```

## Chromeで動くWeb版

`web`ディレクトリに、4桁PIN認証、Google管理者認証、PIN設定画面、ブラウザ位置情報を備えたWeb版を追加しています。Swift版は削除していません。構築・Google Cloud・環境変数・確認手順は[web/README.md](web/README.md)を参照してください。

## 制約

- Windows環境ではXcodeビルドとiOS Simulator検証はできません。
- JCTの複数分岐は現状、`nextLinkIDs`の先頭を予定経路として扱います。
- 渋滞API、目的地検索、全国道路データ、自動更新は後続フェーズです。
- バックグラウンド位置更新はMVPで有効化していません。

## データ利用

実道路データを追加する際は、出典、ライセンス、更新日、方向別リンク、再配布条件を確認してください。外部の画面画像、店舗ロゴ、設備アイコンはアプリ素材として使用していません。
