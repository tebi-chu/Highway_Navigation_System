# iPad Swift Playgroundsで確認する

## 必要なもの

- 対応する最新iPadOSへ更新したiPad
- App Storeから入手した無料の「Swift Playgrounds」
- Filesアプリで参照できるiCloud Drive、OneDriveなど

Apple Developer Programへの有料登録は、画面と基本動作を確認する段階では不要です。

## Windowsから転送する

1. Windowsでリポジトリ直下から次を実行する。

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/Build-PlaygroundPackage.ps1
   ```

2. `HighwayAssistPlayground.swiftpm`フォルダをZIPにする。
3. ZIPをiCloud DriveまたはOneDriveへ保存する。
4. iPadのFilesアプリでZIPを展開する。
5. 展開された`HighwayAssistPlayground.swiftpm`をタップし、Swift Playgroundsで開く。

`.swiftpm`はフォルダ全体がひとつのApp Playgroundです。中のSwiftファイルだけを個別に開かないでください。

## 最初の位置情報設定

Swift Playgroundsでプロジェクトを開いたら、サイドバーのApp SettingsからCapabilitiesを開き、以下を追加します。

- `Core Location When in Use`
- 目的説明：`走行中の高速道路と進行方向を判定し、前方のSA・PA・IC・JCTを表示するために現在地を使用します。`

位置情報は機能を試す段階で許可します。常時位置情報はMVPでは使用しません。

## 動作確認

実道路版には海老名ICから久喜白岡JCTを経て鹿沼ICまでの検証中データが入っています。最初は「デモ走行を表示」を選び、全区間を短時間で再生します。

確認項目：

- 現在地が最下部に表示される
- 近い地点が下、遠い地点が上に表示される
- 最大6地点になる
- 距離と通過予定時刻が表示される
- SA・PAだけに設備アイコンが表示される
- デモの進行に合わせ、通過地点が消えて次地点が追加される

## 注意

- このApp PlaygroundはiPad上でのUI・基本ロジック確認用です。
- 実道路形状を使用していますが、走行精度・設備情報は検証中であり、運転中の案内にはまだ使用できません。
- Swift Playgrounds側でPackage.swiftを自動更新した場合は、そのコピーをWindowsへ戻す前に差分を保存してください。
- 実GPS走行、署名、TestFlight配布へ進む段階ではApple Developer ProgramとmacOS/Xcodeまたは相当するビルド環境を改めて用意します。
