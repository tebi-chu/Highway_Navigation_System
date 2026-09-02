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

## GitHub Pages版では使用しない機能

- サーバー側PIN認証と失敗回数制限
- Google OAuth管理者設定画面
- Cloudflare D1
- Google Routes APIによるリアルタイム渋滞反映

