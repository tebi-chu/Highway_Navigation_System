# GitHub Pages版 公開手順

画面と基本道路データはGitHub Pagesで公開します。PINは簡易的な表示制限であり、サーバー認証ではありません。共通の施設修正だけはCloudflare Worker + D1を使用します。Cloudflare未設定でも従来のナビは動作し、施設編集だけが無効になります。

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

## 共通施設編集の初回設定

この作業は最初の1回だけ必要です。コード、D1テーブル作成、テスト、以後の公開はGitHub Actionsが自動実行します。

### 1. CloudflareでD1を作成

1. Cloudflareへ無料登録またはログインします。
2. **Storage & Databases** → **D1 SQL database** → **Create database**を開きます。
3. Database nameを`highway-facility-sync`として作成します。
4. 表示された**Database ID**を控えます。
5. Cloudflare画面右側などに表示される**Account ID**も控えます。
6. **My Profile** → **API Tokens**で、Workers Scriptsの編集とD1の編集を許可したAPI Tokenを作成します。

Worker自体とデータベース内のテーブルはGitHub Actionsが自動作成するため、Cloudflare画面でコードを貼り付ける必要はありません。

### 2. Googleログイン用クライアントを作成

1. Google Cloud Consoleでプロジェクトを作成します。
2. **Google Auth Platform**でアプリ名、連絡先、対象ユーザーを設定します。
3. テスト運用中は、登録編集者にするGoogleアカウントをテストユーザーへ追加します。
4. **クライアント** → **クライアントを作成** → **ウェブ アプリケーション**を選びます。
5. 承認済みJavaScript生成元へ`https://tebi-chu.github.io`を登録します。末尾にリポジトリ名は付けません。
6. 発行されたクライアントID（`apps.googleusercontent.com`で終わる値）を控えます。クライアントシークレットはこの方式では使用しません。

### 3. GitHub Secretsを登録

GitHubリポジトリの **Settings** → **Secrets and variables** → **Actions** → **Secrets**へ次を登録します。

| 名前 | 内容 |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | CloudflareのAccount ID |
| `CLOUDFLARE_API_TOKEN` | 作成したAPI Token |
| `CLOUDFLARE_D1_DATABASE_ID` | D1のDatabase ID |
| `RATE_LIMIT_SALT` | 推測されにくい32文字以上のランダム文字列 |
| `EDITOR_EMAILS` | 制限なし編集を許可するGoogleメール。複数は半角カンマ区切り |

### 4. GitHub Variablesを登録

同じ画面の **Variables**へ次を登録します。

| 名前 | 内容 |
|---|---|
| `GOOGLE_CLIENT_ID` | GoogleのウェブクライアントID |
| `ALLOWED_ORIGINS` | `https://tebi-chu.github.io` |
| `CLOUDFLARE_WORKER_NAME` | `highway-facility-sync` |
| `CLOUDFLARE_D1_DATABASE_NAME` | `highway-facility-sync` |
| `FACILITY_API_ENABLED` | `true`（Secretsをすべて登録した後に追加） |

### 5. APIを自動公開

1. GitHubの **Actions**を開きます。
2. **施設編集APIをCloudflareへ公開**を選択します。
3. **Run workflow**を押します。
4. 緑色のチェックになったら、ログ末尾またはCloudflareのWorkers画面で公開URLを確認します。
5. 例：`https://highway-facility-sync.ユーザー名.workers.dev`

### 6. GitHub Pagesと接続

1. GitHubのActions Variablesへ`PAGES_API_BASE_URL`を追加します。
2. 値には上で確認したWorker URLを末尾の`/`なしで登録します。
3. **GitHub Pagesへ公開**を開き、**Run workflow**を押します。
4. 公開後、ナビ画面のSA・PAカードを約0.7秒長押しして編集画面が開くことを確認します。
5. `https://tebi-chu.github.io/Highway_Navigation_System/?editor=1`でGoogle登録編集者画面を確認します。

## 施設編集の仕様

- 一般利用者：iPhone・Androidから表示中のSA・PAを長押し。1時間に5回まで。
- 走行速度が10km/h以上のときは一般編集を開かず、停車を案内。
- Google登録編集者：専用画面で高速道路、方向、SA・PAを指定して自宅から編集。アプリ独自の回数制限なし。
- 変更対象：設備と登録済み店舗名だけ。地点名、道路、座標、距離基準は変更不可。
- 詳細な修正履歴は保存せず、同期用の最終更新日時だけ保存。
- 起動時、道路データ読込時、画面復帰時、5分ごとに共通データを同期。
- 通信できない場合は端末に保存した最後の共通データを使用。

## 維持される機能

- ChromeのGPSによる現在位置・速度取得
- 対応高速道路と走行方向の推定
- 現在地より先の最大5地点表示（走行中の視認性を優先）
- スマートフォン横向き時は、直近3地点を右側の通常カード、その先最大4地点を左側の簡略カードとして自動表示し、現在地表示も右側カード列の直下へ配置
- IC・JCT・SA・PA表示
- 道路データに基づく残距離
- IC・JCT・SA・PAは施設中心や代表点ではなく、進行方向側で本線から退出ランプが分岐する地点を0km基準として計算
- 高精度GPS受信中は前回位置・速度との連続性を照合し、並走車線や近接道路への不自然な位置飛びを抑制
- 現在速度または標準速度に基づく予想通過時刻
- SA・PA設備および代表的な店舗表示
- SA・PAカード長押しによる全端末共通の設備編集（Cloudflare設定後）
- Google登録編集者による現在地不要の道路・方向・地点別編集
- 目的地通過後も登録済み道路上の地点を継続表示
- GPSが約3秒以上途切れた場合や精度が100mより悪化した場合、直前速度で最大15分間、道路上の距離と通過予定時刻を推定
- GPS復帰時に実測位置・距離・通過予定時刻へ自動補正
- ナビ画面を表示中はScreen Wake Lock APIで画面の自動消灯を防止し、解除時・画面復帰時・画面操作時・15秒ごとの確認時に再取得

## 現在の走行テスト区間

- 海老名IC～久喜白岡JCT：首都圏中央連絡自動車道（C4）
- 久喜白岡JCT～青森JCT：東北自動車道（E4）
- 青森JCT～青森中央IC：青森自動車道（E4A）

地点データは上下線について照合し、一関IC～盛岡IC間で欠けていた一関IC、平泉スマートIC、中尊寺PA、水沢IC、花巻IC、紫波SA、紫波IC、矢巾PA・スマートIC、盛岡南IC、滝沢ICを補完しています。SA・PA併設スマートICなど、同じ場所のSA／PAとICは1枚のカードにまとめて両方の種別を表示します。
- 上記区間の往路・復路に対応し、途中で降りた場合は表示を停止、対応区間へ再進入するとGPSの位置と進行方位から案内を再開します。

道路・地点データは公開情報を基にした検証用です。実走行前にGoogle Maps等の通常ナビも必ず併用し、運転者は画面を操作しないでください。

画面消灯防止はiPhoneの低電力状態、OS判断、ブラウザ制限などにより解除される場合があります。充電しながら利用し、実走行前に端末で動作を確認してください。

設備欄に表示するのは、食事、コンビニ、カフェ、ガソリンスタンド、温泉、シャワー、ビューエリアだけです。設備マークは高速道路の案内表示で直感的に判別できる形を参考にした独自SVGで、外部画像の転載や直リンクは行いません。スターバックス、タリーズ、ドトール、セブンイレブン、ローソン、ファミリーマート、gooz!、ミニストップ、吉野家、松屋、すき家はピクトグラムではなく文字バッジで表示します。

## 現在使用しない機能

- サーバー側PIN認証と失敗回数制限
- Google Routes APIによるリアルタイム渋滞反映
