# 高速道路アシスト Web版

Swift版を残したまま追加した、Chrome向けWebアプリです。通常利用者は4桁PIN、管理画面は許可されたGoogleアカウントで認証します。

## 構成とセキュリティ

- Next.js互換のVinext + React + Cloudflare Workers
- Cloudflare D1（SQLite）に設定、セッション、入力失敗履歴、OAuth stateを保存
- PINはPBKDF2-HMAC-SHA-256（310,000回、利用者ごとのランダムsalt）で保存し、平文は保存しない
- PIN認証Cookieは7日、管理Cookieは8時間。HttpOnly、SameSite=Lax、本番Secure
- PINを5回間違えると、その接続元からの入力を15分間停止
- PIN変更・クリア時は既存PINセッションをすべて無効化
- Google OAuth Authorization Code + PKCEを使用し、`ADMIN_EMAIL`との一致をサーバーで確認
- Google Routes APIの交通状況込みルート行列で、前方最大6地点の距離・通過時刻・渋滞度を更新
- 渋滞APIは同一接続元45秒に1回まで。APIキーはサーバーだけに保存
- PINそのものや管理者メールアドレスを返す公開APIは用意しない

## 必要な環境変数

`.env.example`を参照してください。本番環境ではホスティング側の「環境変数／Secrets」に登録し、GitHubへコミットしません。

| 名前 | 内容 |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuthクライアントID |
| `GOOGLE_CLIENT_SECRET` | Google OAuthクライアントシークレット |
| `ADMIN_EMAIL` | 管理を許可するGoogleメールアドレス1件 |
| `APP_BASE_URL` | 公開URL（末尾の `/` なし） |
| `COOKIE_SECURE` | ローカルHTTPだけ `false`。本番は未設定または `true` |
| `GOOGLE_MAPS_API_KEY` | Google Maps Platform Routes API用のサーバーAPIキー |

## Google Cloud Consoleの設定

1. Google Cloud Consoleでプロジェクトを作成します。
2. 「Google Auth Platform」でアプリ名、連絡先、対象ユーザーを設定します。
3. 外部ユーザー向けで公開前の場合は、使用する管理者Googleアカウントをテストユーザーへ追加します。
4. 「クライアント」から種類が「ウェブ アプリケーション」のOAuthクライアントを作成します。
5. 承認済みのJavaScript生成元へ公開URLを登録します（例：`https://example.com`）。
6. 承認済みのリダイレクトURIへ `公開URL/api/admin/google/callback` を登録します。
7. 発行されたIDとシークレットをホスティング環境へ設定します。

ローカル確認用のリダイレクトURIは `http://localhost:3000/api/admin/google/callback` です。

## リアルタイム渋滞APIの設定

1. Google Cloud Consoleでプロジェクトに請求先アカウントを関連付けます。
2. 「APIとサービス」から **Routes API** を有効にします。
3. サーバー用APIキーを作成します。
4. APIキーのAPI制限で、利用可能なAPIを **Routes API** のみにします。
5. `GOOGLE_MAPS_API_KEY`としてホスティング環境へ登録します。HTMLやJavaScriptには記載しません。
6. Google Cloud Consoleで日次割り当て上限と予算アラートを設定します。

ナビ画面は約45秒ごとに、現在地1件×前方最大6地点を1回のRoute Matrixリクエストで照会します。交通状況込み所要時間が取得できた地点は「順調」「混雑」「渋滞」を表示し、その所要時間から通過時刻を計算します。API障害・未設定・対象ルートなしの場合は、従来の道路データと走行速度による計算へ自動的に戻ります。

## 初回PIN設定

1. `/settings`を開きます。
2. 「Googleでログイン」を選び、`ADMIN_EMAIL`に設定したアカウントでログインします。
3. 新しい4桁PINを2回入力し「PINコードを設定」を押します。
4. `/`へ戻り、そのPINでナビを開きます。

設定済みの場合は同じ欄が「PINコードを変更」になります。変更直後から新しいPINだけが有効です。

## PINクリアと再設定

管理画面の「PINコードをクリア」を押すと確認ダイアログが表示されます。承認後はPIN未設定となり、通常利用者は誰もナビへログインできません。再設定は同じ管理画面から新しいPINを2回入力します。

## URL

- `/`：PIN入力
- `/nav`：認証済みナビ（未認証なら `/` へ戻る）
- `/settings`：Google管理者認証／PIN管理

## ローカル起動

```powershell
cd web
pnpm install
pnpm dev
```

Chromeで `http://localhost:3000` を開きます。実際のGoogleログインを試すときだけ、`.env.example`と同じ項目を `.env.local` に設定してください。

## 動作確認項目

1. PIN未設定時にナビが開かない
2. 数字以外や4桁以外が拒否される
3. 誤ったPINでエラーが表示され、5回目以降15分ロックされる
4. 正しいPINで `/nav` が開き、再読み込み後も認証が維持される
5. 未認証で `/nav` を直接開くと `/` へ戻る
6. 許可外Googleアカウントが管理画面へ入れない
7. PIN変更後、以前のPINと以前の利用者セッションが無効になる
8. PINクリア後、ナビが公開されず未設定メッセージが出る
9. Chromeで位置情報を許可すると、対応ルート付近で最大6地点が更新される
10. Routes API設定時に「渋滞反映」と更新時刻が表示され、混雑状況に応じて通過時刻が変化する

位置情報はHTTPSまたはlocalhostでのみ利用できます。実走行確認は同乗者が操作し、安全な場所で行ってください。

## GitHubからCloudflareへ公開

GitHubの`main`ブランチへWebアプリの変更を送ると、GitHub Actionsが自動的にCloudflare Workersへ公開します。GitHub Pagesは静的サイト専用でサーバー認証とD1を実行できないため使用しません。

### 1. Cloudflareで作成するもの

1. Cloudflareにログインし、Workers & PagesからWorkerを1つ作成します。名前は`highway-assist`を推奨します。
2. Storage & DatabasesのD1からデータベースを作成します。名前は`highway-assist-db`を推奨します。
3. D1のDatabase IDを控えます。
4. API TokensでWorkers Scriptsの編集権限を持つトークンを作成します。D1を同じトークンで扱う場合はD1の編集権限も付けます。
5. Cloudflare Account IDを控えます。

### 2. GitHubリポジトリへ登録するSecrets

GitHubのリポジトリで Settings → Secrets and variables → Actions → Secrets に次を登録します。

| 名前 | 内容 |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | CloudflareのAccount ID |
| `CLOUDFLARE_API_TOKEN` | 作成したAPI Token |
| `CLOUDFLARE_D1_DATABASE_ID` | D1のDatabase ID |

Database ID自体は秘密鍵ではありませんが、初心者が公開設定と混同しないようSecretsで管理します。

Actions → Variablesには必要な場合だけ次を登録します。未登録なら表の既定値が使われます。

| 名前 | 既定値 |
|---|---|
| `CLOUDFLARE_WORKER_NAME` | `highway-assist` |
| `CLOUDFLARE_D1_DATABASE_NAME` | `highway-assist-db` |

### 3. Workerへ登録する秘密情報

CloudflareのWorker画面で Settings → Variables and Secretsを開き、以下をSecretとして登録します。値はGitHubやソースコードへ書きません。

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAIL`
- `APP_BASE_URL`（例：`https://highway-assist.<サブドメイン>.workers.dev`）
- `GOOGLE_MAPS_API_KEY`

通常の変数として`COOKIE_SECURE=true`も登録します。

### 4. 初回公開と確認

1. GitHubのActionsタブを開きます。
2. 「WebアプリをCloudflareへ公開」を選択します。
3. Run workflowを押します。
4. 緑色のチェックになったら、CloudflareのWorkerに表示される`workers.dev` URLをChromeで開きます。
5. Google OAuthの承認済み生成元とリダイレクトURIを、実際の公開URLに合わせます。
6. `公開URL/settings`で管理者ログインし、最初の4桁PINを設定します。

以後は`main`ブランチの`web`フォルダーまたは公開ワークフローを変更すると自動公開されます。公開失敗時は、GitHubのActions画面に未設定項目が日本語で表示されます。
