# GitHub Pages版 公開手順

この版はGitHub Pagesだけで動く静的Webアプリです。PINは簡易的な表示制限であり、サーバー認証ではありません。リアルタイム渋滞API、Google管理者ログイン、アプリ内PIN設定画面は使用しません。

## 初回設定

1. GitHubリポジトリの **Settings** を開きます。
2. **Secrets and variables** → **Actions** を開きます。
3. **New repository secret** を押します。
4. Nameへ `PAGES_PIN`、Secretへ利用する4桁の数字を入力します。
5. **Settings** → **Pages** のSourceを **GitHub Actions** にします。
6. **Actions** タブから「GitHub Pagesへ公開」を開き、**Run workflow**を押します。

公開URLは通常 `https://GitHubユーザー名.github.io/Highway_Navigation_System/` です。

## PINを変更する方法

1. GitHubの **Settings** → **Secrets and variables** → **Actions** を開きます。
2. `PAGES_PIN`を選び、新しい4桁の数字に更新します。
3. **Actions** →「GitHub Pagesへ公開」→ **Run workflow**を押します。
4. 公開完了後、すでにログイン済みの端末では「終了」を押して新しいPINを入力します。

PINのハッシュは公開ファイルに含まれるため、技術知識のある第三者は総当たりでPINを特定できます。URLを信頼できる仲間以外へ広めず、個人情報や秘密情報はアプリへ保存しないでください。

## 維持される機能

- ChromeのGPSによる現在位置・速度取得
- 対応高速道路と走行方向の推定
- 現在地より先の最大6地点表示
- IC・JCT・SA・PA表示
- 道路データに基づく残距離
- 現在速度または標準速度に基づく予想通過時刻
- SA・PA設備および代表的な店舗表示
- 目的地通過後も登録済み道路上の地点を継続表示
- GPSが約3秒以上途切れた場合や精度が100mより悪化した場合、直前速度で最大15分間、道路上の距離と通過予定時刻を推定
- GPS復帰時に実測位置・距離・通過予定時刻へ自動補正
- ナビ画面を表示中はScreen Wake Lock APIで画面の自動消灯を防止し、画面へ戻った際に再取得

## 現在の走行テスト区間

- 海老名IC～久喜白岡JCT：首都圏中央連絡自動車道（C4）
- 久喜白岡JCT～青森JCT：東北自動車道（E4）
- 青森JCT～青森中央IC：青森自動車道（E4A）
- 上記区間の往路・復路に対応し、途中で降りた場合は表示を停止、対応区間へ再進入するとGPSの位置と進行方位から案内を再開します。

道路・地点データは公開情報を基にした検証用です。実走行前にGoogle Maps等の通常ナビも必ず併用し、運転者は画面を操作しないでください。

画面消灯防止はiPhoneの低電力状態、OS判断、ブラウザ制限などにより解除される場合があります。充電しながら利用し、実走行前に端末で動作を確認してください。

## GitHub Pages版では使用しない機能

- サーバー側PIN認証と失敗回数制限
- Google OAuth管理者設定画面
- Cloudflare D1
- Google Routes APIによるリアルタイム渋滞反映
